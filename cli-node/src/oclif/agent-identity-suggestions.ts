import { DEFAULT_ENROLL_NAME } from "./agent-enroll.js";
import { defaultSessionName, MACHINE_RUNTIMES } from "./machine-session.js";

/**
 * A follow-up the agent can offer its owner after connecting. Neither is
 * run automatically: the owner decides.
 */
export type IdentitySuggestion = {
  kind: "rename" | "runtime_note";
  command: string;
};

/** npx runs the CLI from its cache; print follow-up commands the same way. */
export function cliInvocation(entry: string | undefined): string {
  return entry && /[\\/]_npx[\\/]/.test(entry)
    ? "npx -y primitive@latest"
    : "primitive";
}

/**
 * Whether a connection name is one this CLI chose by itself: enrollment's
 * fallback name, or the `<runtime>-<repository>` name session registration
 * derives from the working directory.
 */
export function generatedAgentName(name: string, cwd: string): boolean {
  return (
    name === DEFAULT_ENROLL_NAME ||
    MACHINE_RUNTIMES.some(
      (runtime) => name === defaultSessionName(runtime, cwd),
    )
  );
}

/**
 * Additive result fields for a connect, enroll or session registration.
 * `nameIsDefault` appears only when the connection name is known. The
 * runtime note is suggested once, after a connection this run completed.
 */
export function identitySuggestions(params: {
  invocation: string;
  profile: string;
  name?: string | null;
  cwd: string;
  connectedNow: boolean;
}): { nameIsDefault?: boolean; suggestions: IdentitySuggestion[] } {
  const prefix = `PRIMITIVE_AGENT_PROFILE=${params.profile} ${params.invocation}`;
  const suggestions: IdentitySuggestion[] = [];
  const nameIsDefault =
    typeof params.name === "string"
      ? generatedAgentName(params.name, params.cwd)
      : undefined;
  if (nameIsDefault)
    suggestions.push({
      kind: "rename",
      command: `${prefix} agent rename "<new name>"`,
    });
  if (params.connectedNow)
    suggestions.push({
      kind: "runtime_note",
      command: `${prefix} agent runtime set`,
    });
  return nameIsDefault === undefined
    ? { suggestions }
    : { nameIsDefault, suggestions };
}
