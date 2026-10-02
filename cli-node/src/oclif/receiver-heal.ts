import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { detectAgentRuntime } from "./connect-skill.js";
import {
  AGENT_PROFILE_ENV,
  agentProfileDirectory,
  agentProfileName,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import {
  BACKGROUND_LISTEN_TOKEN_ENV,
  backgroundListenRestartable,
  backgroundListenStatus,
  claimBackgroundListenRestart,
} from "./listen-background.js";
import { notificationScope } from "./notify-session.js";
import { SESSION_UUID } from "./notify-session-native.js";
import { readMailJson } from "./shared-mail-files.js";

/** Set to 0 to turn off restarting a stopped receiver from ordinary commands. */
export const RECEIVER_HEAL_ENV = "PRIMITIVE_RECEIVER_HEAL";

export type ReceiverHealResult =
  | { action: "restarting"; profile: string; session: string }
  | { action: "none"; reason: string };

function activeConfigDir(env: NodeJS.ProcessEnv, home: string): string {
  if (env.PRIMITIVE_CONFIG_DIR) return env.PRIMITIVE_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "primitive");
}

/**
 * Restart the selected agent profile's native receiver when it died without
 * being stopped. It acts only for a command run from inside the exact session
 * the profile is bound to, so a receiver is never revived for a session that
 * is gone, and it never waits: the restart runs in a detached process.
 */
export function healSelectedReceiver(
  options: {
    argv?: string[];
    env?: NodeJS.ProcessEnv;
    configDir?: string;
    entry?: string;
    now?: number;
    spawnListener?(argv: string[], env: NodeJS.ProcessEnv): void;
  } = {},
): ReceiverHealResult {
  const env = options.env ?? process.env;
  const none = (reason: string): ReceiverHealResult => ({
    action: "none",
    reason,
  });
  if (env[RECEIVER_HEAL_ENV] === "0") return none("disabled");
  if (env[BACKGROUND_LISTEN_TOKEN_ENV] || env.PRIMITIVE_LISTEN_SUPERVISOR)
    return none("receiver_process");
  const argv = options.argv ?? process.argv.slice(2);
  // Stopping or disconnecting must not race a restart.
  if (
    (argv[0] === "listen" && argv.includes("--stop")) ||
    (argv[0] === "agent" && argv[1] === "disconnect") ||
    argv[0] === "agent:disconnect"
  )
    return none("stopping");
  const selected = env[AGENT_PROFILE_ENV]?.trim();
  if (!selected) return none("no_profile");
  const entry = options.entry ?? process.argv[1];
  if (!entry) return none("no_entrypoint");
  const configDir = options.configDir ?? activeConfigDir(env, homedir());
  const profileName = agentProfileName(selected);
  const setup = readMailJson(
    join(agentProfileDirectory(configDir, profileName), "setup.json"),
  );
  if (!setup || typeof setup !== "object" || Array.isArray(setup))
    return none("no_setup");
  const saved = setup as Record<string, unknown>;
  const session = saved.session;
  if (
    typeof session !== "string" ||
    !SESSION_UUID.test(session) ||
    saved.receiverMode === "external" ||
    saved.phase !== "sent"
  )
    return none("not_native_receiver");
  if (detectAgentRuntime(session, env) === null) return none("other_session");
  const profile = loadConnectedAgentProfile(configDir, profileName);
  if (!profile) return none("no_profile");
  const target = {
    configDir,
    scope: notificationScope(profile.api_base_url, profile.api_key),
    threadId: session,
  };
  if (!backgroundListenRestartable(backgroundListenStatus(target)))
    return none("not_restartable");
  if (!claimBackgroundListenRestart(target, options.now))
    return none("recently_attempted");
  // The same command setup uses, so the restarted receiver has the same
  // saved configuration and is reused by a later setup resume.
  const listenArgv = [
    entry,
    "listen",
    "--background",
    "--notify-session",
    session,
    "--contacts",
    ...(saved.contactRequests === true ? ["--contact-requests"] : []),
  ];
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    [AGENT_PROFILE_ENV]: profileName,
    PRIMITIVE_CONFIG_DIR: configDir,
    [RECEIVER_HEAL_ENV]: "0",
  };
  (options.spawnListener ?? spawnDetached)(listenArgv, childEnv);
  return { action: "restarting", profile: profileName, session };
}

function spawnDetached(argv: string[], env: NodeJS.ProcessEnv): void {
  const child = spawn(process.execPath, argv, {
    env,
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  });
  child.on("error", () => {});
  child.unref();
}

/** Never let receiver recovery change what the requested command does. */
export function healSelectedReceiverQuietly(): void {
  try {
    healSelectedReceiver();
  } catch {
    /* Recovery is opportunistic; the command runs either way. */
  }
}
