import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CREDENTIALS_FILE = "credentials.json";

type RootSignupHintOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  home?: string;
  write?: (message: string) => void;
};

function activeConfigDir(env: NodeJS.ProcessEnv, home: string): string {
  if (env.PRIMITIVE_CONFIG_DIR) return env.PRIMITIVE_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "primitive");
}

export function shouldShowLoggedOutSignupHint(
  options: RootSignupHintOptions = {},
): boolean {
  const argv = options.argv ?? process.argv.slice(2);
  if (argv.length > 0) return false;

  const env = options.env ?? process.env;
  if (env.PRIMITIVE_HIDE_SIGNUP_HINT === "1") return false;
  if (env.PRIMITIVE_API_KEY?.trim()) return false;

  const configDir = activeConfigDir(env, options.home ?? homedir());
  return !existsSync(join(configDir, CREDENTIALS_FILE));
}

export function loggedOutSignupHint(): string {
  return [
    "New to Primitive?",
    "  You or your user don't have an account yet?",
    "  Run `primitive signup <email> --signup-code <invite-code> --accept-terms`",
    "  to create an account, get your own domain, and get started now.",
    "",
  ].join("\n");
}

export function writeLoggedOutSignupHintIfNeeded(
  options: RootSignupHintOptions = {},
): void {
  if (!shouldShowLoggedOutSignupHint(options)) return;
  const write = options.write ?? ((message) => process.stdout.write(message));
  write(loggedOutSignupHint());
}
