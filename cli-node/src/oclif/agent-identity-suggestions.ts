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
 * Whether a connection name read back from a claim is one nobody chose for
 * this agent: the enrollment fallback, or a name that only repeats the
 * address's local part (what an invitation gets when the owner typed just
 * the address). A name the owner wrote out is never reported as default.
 */
export function defaultConnectionName(name: string, address: string): boolean {
  const local = address.split("@")[0]?.toLowerCase() ?? "";
  return generatedAgentName(name) || name.trim().toLowerCase() === local;
}

/** The line that tells an agent to load its handling rules before acting on mail. */
export const LOAD_SKILL_LINE =
  "Load the primitive-connect skill first if it is not loaded.";

/** One short clause saying how this session will receive mail. */
export function receivingOutcome(receiving: {
  state: string;
  mode?: string;
}): string {
  if (receiving.mode === "poll")
    return "nothing wakes this session for new mail, so it checks at the start of each turn and after sending";
  if (receiving.mode === "external")
    return receiving.state === "hooks_installed"
      ? "new mail wakes this session through its installed hooks, confirmed by the first real delivery"
      : "receiving is not set up yet, so new mail will not wake this session";
  return receiving.state === "healthy"
    ? "a background listener receives new mail for this session"
    : "receiving is not ready yet, so new mail may not reach this session";
}

/**
 * What an agent does right after a connection completes, in order. Agents
 * act on command output even when they have not loaded the skill, so the
 * steps are carried in the result itself.
 */
export function connectNextSteps(params: {
  address: string;
  receiving: { state: string; mode?: string };
  name?: string;
  nameIsDefault?: boolean;
  suggestions: IdentitySuggestion[];
}): string[] {
  const rename = params.suggestions.find((s) => s.kind === "rename")?.command;
  const runtime = params.suggestions.find(
    (s) => s.kind === "runtime_note",
  )?.command;
  const offers = [
    rename
      ? `rename this agent from its generated name${params.name ? ` "${params.name}"` : ""} (\`${rename}\`)`
      : null,
    runtime ? `record where it runs (\`${runtime}\`)` : null,
  ].filter((offer): offer is string => offer !== null);
  return [
    `Report to the owner in two short sentences: that this agent is connected as ${params.address}, and that ${receivingOutcome(params.receiving)}. Leave out the organization id, profile name and command output.`,
    ...(offers.length
      ? [
          `In the same message, make one offer to ${offers.join(" and to ")}. Run either only after the owner answers.`,
        ]
      : []),
    "Load the primitive-connect skill before handling any mail.",
  ];
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
