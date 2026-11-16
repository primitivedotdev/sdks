import { Command, Errors, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import { API_BASE_URL_FLAG_DESCRIPTION } from "../api-command.js";
import {
  FOCUS_ENV,
  type FocusChoice,
  type FocusProfile,
  focusProfile,
  joinNames,
  loadSavedFocus,
  MAX_FOCUS_DOMAINS,
  manyDomainsSupported,
  normalizeDomainNames,
  oneDomainAtATimeError,
  type ReadableDomains,
  readReadableDomains,
  resolveDomainNames,
  saveFocus,
} from "../focus.js";
import { JSON_OUTPUT_FLAG } from "../json-output.js";

const commonFlags = {
  json: JSON_OUTPUT_FLAG,
  "api-key": Flags.string({
    description: "API key override",
    env: "PRIMITIVE_API_KEY",
  }),
  "api-base-url": Flags.string({
    description: API_BASE_URL_FLAG_DESCRIPTION,
    env: "PRIMITIVE_API_BASE_URL",
    hidden: true,
  }),
};

type CommonFlags = {
  json?: boolean;
  "api-key"?: string;
  "api-base-url"?: string;
};

const FOCUS_DESCRIPTION = `Which domains mail listings and searches show.

On a credential that reads mail on more than one domain, listings and searches are refused until a focus is chosen: \`primitive focus set <domain...>\` to see only those domains, or \`primitive focus set --all\` to see every domain. The choice is saved for this profile (the member login, or the connected agent selected by PRIMITIVE_AGENT_PROFILE), never in a credential file.

A focus applies to \`emails list\`, \`emails latest\`, \`emails search\`, \`search\`, \`emails watch\`, \`inbox next\`, \`sent list\` and \`semantic-search\`. Every focused command says so on stderr, and under --json in \`meta.focus\`. It never applies to reads by id or to notifications (\`listen\`, \`wait\`, \`emails wait\`, \`agent check-mail\`).

Override it for one command with --domain <name> or --all-domains, or for a session with ${FOCUS_ENV}=<name,...> (or ${FOCUS_ENV}=all).`;

type FocusState = {
  profile: FocusProfile;
  orgId: string;
  /** Null when the domains could not be read and the caller allows it. */
  readable: ReadableDomains | null;
};

async function readState(
  command: Command,
  flags: CommonFlags,
  lookupOptional: true,
): Promise<FocusState>;
async function readState(
  command: Command,
  flags: CommonFlags,
  lookupOptional?: false,
): Promise<FocusState & { readable: ReadableDomains }>;
async function readState(
  command: Command,
  flags: CommonFlags,
  lookupOptional = false,
): Promise<FocusState> {
  const { apiClient, auth } = await createAuthenticatedCliApiClient({
    configDir: command.config.configDir,
    apiKey: flags["api-key"],
    apiBaseUrl: flags["api-base-url"],
  });
  const readable = await readReadableDomains(apiClient.client);
  // Showing and clearing a saved focus work from the credential's own
  // organization when the domains cannot be read, as listings do.
  const fallbackOrg =
    auth.connectedAgent?.orgId ?? auth.credentials?.org_id ?? null;
  if (!readable && lookupOptional && fallbackOrg)
    return {
      profile: focusProfile(command.config.configDir, auth),
      orgId: fallbackOrg,
      readable: null,
    };
  if (!readable)
    throw new Errors.CLIError(
      "Could not read this credential's domains; retry in a moment.",
      { exit: 1, code: "focus_lookup_failed" },
    );
  const orgId =
    readable.orgId ??
    auth.connectedAgent?.orgId ??
    auth.credentials?.org_id ??
    null;
  if (!orgId)
    throw new Errors.CLIError(
      "This credential reads no verified domain, so there is no focus to choose.",
      { exit: 1, code: "focus_no_domains" },
    );
  return {
    profile: focusProfile(command.config.configDir, auth),
    orgId,
    readable,
  };
}

function profileLabel(profile: FocusProfile): string {
  return profile.kind === "agent"
    ? `agent profile ${profile.name}`
    : "the member login";
}

function describeChoice(choice: FocusChoice | null): string {
  if (!choice) return "none chosen";
  if ("all" in choice) return "every domain";
  return joinNames(choice.domains.map((d) => d.name));
}

function choiceJson(choice: FocusChoice | null) {
  if (!choice) return null;
  if ("all" in choice) return { all: true, domains: [] };
  return { all: false, domains: choice.domains };
}

export class FocusCommand extends Command {
  static summary = "Show which domains mail listings and searches show";

  static description = FOCUS_DESCRIPTION;

  static examples = [
    "<%= config.bin %> focus",
    "<%= config.bin %> focus set support.example.com",
    "<%= config.bin %> focus set --all",
    "<%= config.bin %> focus clear",
  ];

  static flags = commonFlags;

  async run(): Promise<void> {
    const { flags } = await this.parse(FocusCommand);
    const state = await readState(this, flags, true);
    const saved = loadSavedFocus(state.profile, state.orgId);
    const choice = saved?.choice ?? null;
    const session = process.env[FOCUS_ENV]?.trim() || null;
    const names = state.readable?.domains.map((d) => d.name) ?? null;
    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            profile: profileLabel(state.profile),
            saved: choiceJson(choice),
            session_override: session,
            domains: names,
            applies: names === null ? null : names.length > 1,
          },
          null,
          2,
        ),
      );
      return;
    }
    if (names !== null && names.length <= 1) {
      this.log(
        `This credential reads mail on ${names.length === 1 ? `one domain, ${names[0]}` : "no verified domain"}, so listings are never focused.`,
      );
      return;
    }
    this.log(
      `Focus for ${profileLabel(state.profile)}: ${describeChoice(choice)}.`,
    );
    if (session)
      this.log(`${FOCUS_ENV}=${session} overrides it in this session.`);
    this.log(
      names === null
        ? "Could not read this credential's domains just now."
        : `Domains this credential reads mail on: ${joinNames(names)}.`,
    );
    if (!choice)
      this.log(
        "Choose with `primitive focus set <domain...>` or `primitive focus set --all`.",
      );
  }
}

export class FocusSetCommand extends Command {
  static summary = "Choose which domains mail listings and searches show";

  static description =
    `Save the focus for this profile: the domains named, or every domain with --all. Names are checked against the domains this credential reads mail on.

${FOCUS_DESCRIPTION}`;

  static strict = false;

  static args = {};

  static examples = [
    "<%= config.bin %> focus set support.example.com",
    "<%= config.bin %> focus set --all",
  ];

  static flags = {
    ...commonFlags,
    all: Flags.boolean({
      description: "Show every domain this credential reads mail on.",
    }),
  };

  async run(): Promise<void> {
    const { flags, argv } = await this.parse(FocusSetCommand);
    const given = (argv as unknown[]).filter(
      (a): a is string => typeof a === "string",
    );
    const flagLike = given.find((a) => a.startsWith("-"));
    if (flagLike)
      throw new Errors.CLIError(
        `${flagLike} is not a flag of focus set: name domains as arguments, or pass --all.`,
        { exit: 2, code: "usage_error" },
      );
    const names = normalizeDomainNames(given);
    if (flags.all && names.length > 0)
      throw new Errors.CLIError("Name domains or pass --all, not both.", {
        exit: 2,
        code: "usage_error",
      });
    if (!flags.all && names.length === 0)
      throw new Errors.CLIError(
        "Name one or more domains, or pass --all for every domain.",
        { exit: 2, code: "usage_error" },
      );
    if (names.length > 1 && !manyDomainsSupported())
      throw oneDomainAtATimeError(names);
    // Checked before saving, so a choice no listing could send never
    // replaces a working one.
    if (names.length > MAX_FOCUS_DOMAINS)
      throw new Errors.CLIError(
        `A focus names at most ${MAX_FOCUS_DOMAINS} domains (got ${names.length}).`,
        { exit: 2, code: "usage_error" },
      );
    const state = await readState(this, flags);
    const choice: FocusChoice = flags.all
      ? { all: true }
      : {
          domains: resolveDomainNames(
            names,
            state.readable.domains,
            "primitive focus set",
          ),
        };
    const at = new Date().toISOString();
    saveFocus(state.profile, state.orgId, () => ({
      choice,
      chosen_at: at,
    }));
    if (flags.json) {
      this.log(
        JSON.stringify(
          { profile: profileLabel(state.profile), saved: choiceJson(choice) },
          null,
          2,
        ),
      );
      return;
    }
    this.log(
      "all" in choice
        ? `Listings and searches for ${profileLabel(state.profile)} now show every domain.`
        : `Listings and searches for ${profileLabel(state.profile)} now show only ${describeChoice(choice)}. Widen one command with --all-domains, or run \`primitive focus clear\`.`,
    );
  }
}

export class FocusClearCommand extends Command {
  static summary = "Forget the saved focus for this profile";

  static description =
    `Forget this profile's saved focus. On a credential that reads mail on more than one domain, listings and searches are then refused until a focus is chosen again.

${FOCUS_DESCRIPTION}`;

  static examples = ["<%= config.bin %> focus clear"];

  static flags = commonFlags;

  async run(): Promise<void> {
    const { flags } = await this.parse(FocusClearCommand);
    const state = await readState(this, flags, true);
    let had = false;
    saveFocus(state.profile, state.orgId, (current) => {
      had = Boolean(current?.choice);
      return null;
    });
    if (flags.json) {
      this.log(
        JSON.stringify(
          { profile: profileLabel(state.profile), saved: null, cleared: had },
          null,
          2,
        ),
      );
      return;
    }
    this.log(
      had
        ? `Cleared the focus for ${profileLabel(state.profile)}; listings and searches ask for a choice again (or pass --domain or --all-domains).`
        : `No focus was saved for ${profileLabel(state.profile)}.`,
    );
  }
}
