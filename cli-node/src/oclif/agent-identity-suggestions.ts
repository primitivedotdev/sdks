/** The connection name enrollment uses when none is given. */
export const DEFAULT_ENROLL_NAME = "Coding agent";

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
 * Whether an enrollment's connection name is the fallback it chose by itself.
 * Session registration's `<runtime>-<repository>` names are reported by
 * registration, which knows the exact name it generated.
 */
export function generatedAgentName(name: string): boolean {
  return name === DEFAULT_ENROLL_NAME;
}

/**
 * Additive result fields for a connect, enroll or session registration.
 * `nameIsDefault` appears only when it is known whether the connection name
 * is one this CLI generated. The runtime note is suggested once, after a
 * connection this run completed.
 */
export function identitySuggestions(params: {
  invocation: string;
  profile: string;
  nameIsDefault?: boolean;
  connectedNow: boolean;
}): { nameIsDefault?: boolean; suggestions: IdentitySuggestion[] } {
  const prefix = `PRIMITIVE_AGENT_PROFILE=${params.profile} ${params.invocation}`;
  const suggestions: IdentitySuggestion[] = [];
  const nameIsDefault = params.nameIsDefault;
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
