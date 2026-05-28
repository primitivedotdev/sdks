import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Command, Flags } from "@oclif/core";
import type { Account } from "@primitivedotdev/api-core";
import {
  getAccount,
  listDomains,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";

// `primitive doctor` is a one-command health check the AGX walkthrough
// kept asking for. Before this command, a user with a misconfigured
// environment had to triangulate across whoami, list-domains, and raw
// network probes to figure out which piece was off. The checklist
// below covers the four things that fail in practice: stale Node, a
// proxy env we don't pick up, a missing/wrong API key, and an org
// with no verified domain.
//
// Designed as an interactive checklist on stderr (so a piped invocation
// keeps the structured JSON on stdout). Each check prints its label,
// runs, and reports OK/WARN/FAIL with a one-line hint when not OK. The
// command exits 1 if any FAIL check fires; WARN doesn't fail the run.

const MIN_NODE_MAJOR = 22;

type CheckOutcome =
  | { status: "ok"; message: string }
  | { status: "warn"; message: string; hint?: string }
  | { status: "fail"; message: string; hint?: string };

interface CheckRow {
  label: string;
  outcome: CheckOutcome;
}

function renderRow({ label, outcome }: CheckRow): string {
  const tag =
    outcome.status === "ok"
      ? "[OK]  "
      : outcome.status === "warn"
        ? "[WARN]"
        : "[FAIL]";
  return `${tag} ${label}: ${outcome.message}`;
}

function checkNode(): CheckOutcome {
  const version = process.version; // e.g. "v22.10.2"
  const majorStr = version.replace(/^v/, "").split(".")[0];
  const major = majorStr ? Number(majorStr) : Number.NaN;
  if (!Number.isFinite(major)) {
    return {
      status: "warn",
      message: `unrecognized version string ${version}`,
      hint: "Ensure node --version reports a semver-shaped value.",
    };
  }
  if (major < MIN_NODE_MAJOR) {
    return {
      status: "fail",
      message: `${version} is below the minimum supported major (${MIN_NODE_MAJOR})`,
      hint: `Install Node.js ${MIN_NODE_MAJOR} or newer. The CLI relies on Web Fetch APIs that are stable from ${MIN_NODE_MAJOR} on.`,
    };
  }
  return { status: "ok", message: version };
}

function checkProxy(): CheckOutcome {
  // Surface the four env vars Node's fetch consults when
  // NODE_USE_ENV_PROXY=1 is set. Don't claim they're broken if absent;
  // many environments don't need them. Surface NODE_USE_ENV_PROXY
  // itself because Node 22+ ignores HTTP_PROXY etc. without it: a
  // surprisingly common gotcha that turns the CLI into ENETUNREACH
  // from inside containers and corporate networks.
  const vars = [
    "NODE_USE_ENV_PROXY",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
  ] as const;
  const present = vars
    .map((name) => {
      const value = process.env[name];
      return value && value.length > 0 ? `${name}=${value}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  if (present.length === 0) {
    return { status: "ok", message: "no proxy env vars set" };
  }

  // Identify which specific proxy host var(s) are set so the warning
  // names what the shell actually has, not a hardcoded string. Order
  // is reporting-only; if both are set, both surface in the message.
  const proxyHostVars = (["HTTPS_PROXY", "HTTP_PROXY"] as const).filter(
    (name) => (process.env[name] ?? "").length > 0,
  );
  const proxyEnabled = process.env.NODE_USE_ENV_PROXY === "1";
  if (proxyHostVars.length > 0 && !proxyEnabled) {
    return {
      status: "warn",
      message: `${present.join(", ")} (${proxyHostVars.join(" / ")} set, NODE_USE_ENV_PROXY not)`,
      hint: "Node 22+ ignores HTTP(S)_PROXY by default. Re-run with NODE_USE_ENV_PROXY=1 if API calls fail with ENETUNREACH or ECONNREFUSED.",
    };
  }
  return { status: "ok", message: present.join(", ") };
}

function checkApiKey(opts: {
  apiKey?: string;
  configDir: string;
  env?: NodeJS.ProcessEnv;
}): CheckOutcome {
  // Take env explicitly so the unit test can inject a clean
  // environment without mutating process.env across cases. Default to
  // the live process env for real runs.
  const env = opts.env ?? process.env;
  if (opts.apiKey?.startsWith("prim_")) {
    return { status: "ok", message: "provided via flag/env (prim_ prefix)" };
  }
  if (opts.apiKey) {
    return {
      status: "warn",
      message: "provided but does not start with prim_",
      hint: "Verify the key is a Primitive API key, not a value from another service.",
    };
  }
  // PRIMITIVE_KEY rename detection. AGX feedback: users on older docs
  // (or coming from other tools) set PRIMITIVE_KEY and then can't
  // figure out why the CLI says "no API key found". The CLI reads
  // PRIMITIVE_API_KEY only. Surface the rename hint when PRIMITIVE_KEY
  // is set but PRIMITIVE_API_KEY is not, before falling through to
  // the credentials.json / no-key checks. The hint runs before the
  // credentials.json branch on purpose: if both PRIMITIVE_KEY and a
  // valid credentials file are present, the credentials file wins
  // silently and the user never sees the rename suggestion, which is
  // the same trap by another name.
  const primitiveKey = env.PRIMITIVE_KEY;
  const primitiveApiKey = env.PRIMITIVE_API_KEY;
  if ((primitiveKey?.length ?? 0) > 0 && (primitiveApiKey?.length ?? 0) === 0) {
    return {
      status: "fail",
      message: "PRIMITIVE_KEY is set but the CLI reads PRIMITIVE_API_KEY",
      hint: "Rename your env var, or re-run with PRIMITIVE_API_KEY=$PRIMITIVE_KEY.",
    };
  }
  const credsPath = join(opts.configDir, "credentials.json");
  if (existsSync(credsPath)) {
    let parsed: Record<string, unknown> | null = null;
    let parseError: string | null = null;
    try {
      parsed = JSON.parse(readFileSync(credsPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    if (
      parsed?.auth_method === "oauth" &&
      typeof parsed.access_token === "string" &&
      parsed.access_token.length > 0
    ) {
      return {
        status: "ok",
        message: `loaded OAuth session from ${credsPath}`,
      };
    }
    if (typeof parsed?.api_key === "string" && parsed.api_key.length > 0) {
      return {
        status: "fail",
        message: `${credsPath} contains legacy API-key login state`,
        hint: "Run `primitive signin` to create saved OAuth credentials. Existing API keys still work with --api-key or PRIMITIVE_API_KEY.",
      };
    }
    if (parsed) {
      // File parsed but had no usable OAuth token. Different cause than a
      // malformed file; surface the distinction so the user knows
      // whether to re-run login or to inspect the file by hand.
      return {
        status: "fail",
        message: `${credsPath} exists but contains no OAuth access_token`,
        hint: "Run `primitive logout` to clear it, then `primitive signin` to recreate.",
      };
    }
    return {
      status: "fail",
      message: `${credsPath} exists but is unreadable or malformed${parseError ? ` (${parseError})` : ""}`,
      hint: "Run `primitive logout` to clear it, then `primitive signin` to recreate.",
    };
  }
  return {
    status: "fail",
    message: "no CLI OAuth session or explicit API key found",
    hint: "Run `primitive signin`, pass --api-key explicitly, or export PRIMITIVE_API_KEY=prim_...",
  };
}

async function checkAccount(
  client: PrimitiveApiClient,
): Promise<{ outcome: CheckOutcome; account: Account | null }> {
  try {
    const result = await getAccount({
      client: client.client,
      responseStyle: "fields",
    });
    // Capture once to avoid TS over-narrowing across the truthy +
    // typeof checks; result.error can resolve to never on the third
    // access when the generated union types collapse.
    const apiError: unknown = result.error;
    if (apiError) {
      const errorBody =
        typeof apiError === "object" && apiError !== null
          ? JSON.stringify(apiError).slice(0, 300)
          : String(apiError).slice(0, 300);
      return {
        outcome: {
          status: "fail",
          message: `API rejected the key (${errorBody})`,
          hint: "Run `primitive whoami` for the full error envelope. If the key was rotated, regenerate it in the dashboard.",
        },
        account: null,
      };
    }
    const envelope = result.data as { data?: Account } | undefined;
    const account = envelope?.data ?? null;
    if (!account) {
      return {
        outcome: {
          status: "fail",
          message: "/account returned an empty body",
        },
        account: null,
      };
    }
    return {
      outcome: {
        status: "ok",
        message: `${account.email} (plan: ${account.plan}, id: ${account.id})`,
      },
      account,
    };
  } catch (error) {
    const code =
      error instanceof Error &&
      (error as { cause?: { code?: unknown } }).cause &&
      typeof (error as { cause?: { code?: unknown } }).cause === "object" &&
      typeof (error as { cause: { code?: unknown } }).cause.code === "string"
        ? ((error as { cause: { code: string } }).cause.code as string)
        : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const hint =
      code === "ENETUNREACH" ||
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "EAI_AGAIN"
        ? "Network unreachable. If you're behind a proxy, re-run with NODE_USE_ENV_PROXY=1 and HTTPS_PROXY set. If you're in a container, check that egress to *.primitive.dev is allowed."
        : 'Inspect the error above. `curl https://api.primitive.dev/v1/account -H "Authorization: Bearer $PRIMITIVE_API_KEY"` is the fastest way to bisect CLI vs network.';
    return {
      outcome: {
        status: "fail",
        message: code ? `${message} (${code})` : message,
        hint,
      },
      account: null,
    };
  }
}

async function checkDomains(client: PrimitiveApiClient): Promise<CheckOutcome> {
  try {
    const result = await listDomains({
      client: client.client,
      responseStyle: "fields",
    });
    if (result.error) {
      return {
        status: "warn",
        message: "could not list domains",
        hint: "Run `primitive domains list` for the full error envelope.",
      };
    }
    const envelope = result.data as
      | { data?: Array<{ domain: string; is_active?: boolean }> }
      | undefined;
    const rows = envelope?.data ?? [];
    const active = rows.filter((row) => row.is_active === true);
    if (active.length === 0 && rows.length === 0) {
      return {
        status: "warn",
        message: "no domains on this account yet",
        hint: "A managed `*.primitive.email` subdomain is auto-issued on signup. If this is empty, complete onboarding or check the dashboard.",
      };
    }
    if (active.length === 0) {
      return {
        status: "warn",
        message: `${rows.length} domain(s), none active`,
        hint: "Run `primitive domains verify --id <id>` for any domain you intend to send / receive on.",
      };
    }
    return {
      status: "ok",
      message: `${active.length} active domain(s): ${active.map((row) => row.domain).join(", ")}`,
    };
  } catch (error) {
    return {
      status: "warn",
      message: `listDomains threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

class DoctorCommand extends Command {
  static description =
    `Run a one-shot environment health check: Node version, proxy env, CLI auth resolution, /account reachability, and verified-domain status. Fails fast on anything that would block other commands and prints actionable hints for each warning or failure.`;

  static summary =
    "Check the local environment and live API for common problems";

  static examples = [
    "<%= config.bin %> doctor",
    "<%= config.bin %> doctor --api-key prim_...",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DoctorCommand);

    const rows: CheckRow[] = [];

    rows.push({ label: "Node version", outcome: checkNode() });
    rows.push({ label: "Proxy env", outcome: checkProxy() });

    const apiKeyCheck = checkApiKey({
      apiKey: flags["api-key"],
      configDir: this.config.configDir,
    });
    rows.push({ label: "Auth", outcome: apiKeyCheck });

    // Only run the live checks if we have a key to authenticate with.
    // Reporting the network-failure case without a key would just
    // confuse the user; the missing-key row above already covers it.
    if (apiKeyCheck.status !== "fail") {
      const { apiClient, auth } = await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
      // resolveCliAuth's apiKey is typed as string | undefined; we
      // narrowed the failure case via apiKeyCheck above, so the
      // undefined branch shouldn't fire in practice. Skip the live
      // checks defensively rather than passing "" to the API.
      if (auth.apiKey !== undefined) {
        const accountCheck = await checkAccount(apiClient);
        rows.push({ label: "API auth", outcome: accountCheck.outcome });

        if (accountCheck.outcome.status === "ok") {
          const domainsOutcome = await checkDomains(apiClient);
          rows.push({ label: "Domains", outcome: domainsOutcome });
        }
      }
    }

    for (const row of rows) {
      process.stderr.write(`${renderRow(row)}\n`);
      if ("hint" in row.outcome && row.outcome.hint) {
        process.stderr.write(`       hint: ${row.outcome.hint}\n`);
      }
    }

    // Structured stdout for piping. Keep stderr human-readable;
    // stdout JSON is what `primitive doctor | jq` consumers parse.
    const summary = {
      ok: rows.every((row) => row.outcome.status === "ok"),
      checks: rows.map(({ label, outcome }) => ({
        label,
        status: outcome.status,
        message: outcome.message,
        ...("hint" in outcome && outcome.hint ? { hint: outcome.hint } : {}),
      })),
    };
    this.log(JSON.stringify(summary, null, 2));

    if (rows.some((row) => row.outcome.status === "fail")) {
      process.exitCode = 1;
    }
  }
}

export default DoctorCommand;

export type { CheckOutcome, CheckRow };
// Exported for unit testing. The pure helpers (formatters and the
// proxy / node-version checks) get isolated coverage so the oclif
// run() lifecycle doesn't have to be stood up for every case.
export { checkApiKey, checkNode, checkProxy, renderRow };
