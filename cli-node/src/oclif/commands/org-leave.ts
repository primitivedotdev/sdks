import { createInterface } from "node:readline/promises";
import { Command, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorCode,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { orgSecretsErrorPayload } from "./org-secrets-shared.js";

export const STEP_UP_HEADER = "primitive-step-up";

export function organizationLeaveUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/organization/leave`;
}

export type OrgLeaveInput = {
  fetchImpl: typeof fetch;
  baseUrl: string;
  headers: Record<string, string>;
  orgLabel: string;
  yes: boolean;
  stepUpToken?: string;
  interactive: boolean;
  prompt: (question: string) => Promise<string>;
  write: (text: string) => void;
};

export type OrgLeaveOutcome =
  | { kind: "left"; data: unknown }
  | { kind: "cancelled" }
  | { kind: "needs_confirmation" }
  | { kind: "error"; payload: unknown; stepUpUrl?: string };

type RequestOutcome =
  | { kind: "ok"; data: unknown }
  | { kind: "error"; payload: unknown };

async function postLeave(
  input: OrgLeaveInput,
  stepUpToken: string | undefined,
): Promise<RequestOutcome> {
  const headers = {
    ...input.headers,
    ...(stepUpToken ? { [STEP_UP_HEADER]: stepUpToken } : {}),
  };
  let response: Response;
  try {
    response = await input.fetchImpl(organizationLeaveUrl(input.baseUrl), {
      method: "POST",
      headers,
    });
  } catch (error) {
    return { kind: "error", payload: extractErrorPayload(error) };
  }
  if (!response.ok) {
    return {
      kind: "error",
      payload: extractErrorPayload(await orgSecretsErrorPayload(response)),
    };
  }
  const body = (await response.json().catch(() => ({}))) as { data?: unknown };
  return { kind: "ok", data: body.data ?? null };
}

function stepUpUrlOf(payload: unknown): string | undefined {
  if (extractErrorCode(payload) !== "step_up_required") return undefined;
  if (!payload || typeof payload !== "object") return undefined;
  const details = (payload as { details?: unknown }).details;
  if (!details || typeof details !== "object") return undefined;
  const url = (details as { step_up_url?: unknown }).step_up_url;
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

// Confirms, then asks the server to remove the caller from the organization.
// Every refusal is the server's own payload, returned unchanged. When the
// server asks for a dashboard confirmation, an interactive caller is shown
// the page and asked for its token, and the request is sent once more.
export async function runOrgLeave(
  input: OrgLeaveInput,
): Promise<OrgLeaveOutcome> {
  if (!input.yes) {
    if (!input.interactive) return { kind: "needs_confirmation" };
    const answer = await input.prompt(
      `Leave ${input.orgLabel}? Leaving is final. [y/N] `,
    );
    if (!/^y(es)?$/i.test(answer.trim())) return { kind: "cancelled" };
  }

  const first = await postLeave(input, input.stepUpToken);
  if (first.kind === "ok") return { kind: "left", data: first.data };

  const stepUpUrl = stepUpUrlOf(first.payload);
  if (!stepUpUrl || input.stepUpToken || !input.interactive) {
    return { kind: "error", payload: first.payload, stepUpUrl };
  }

  input.write(
    `Confirm leaving in the dashboard: ${stepUpUrl}\nThen paste the token it shows.\n`,
  );
  const token = (await input.prompt("Token: ")).trim();
  if (!token) return { kind: "error", payload: first.payload, stepUpUrl };

  const second = await postLeave(input, token);
  if (second.kind === "ok") return { kind: "left", data: second.data };
  return { kind: "error", payload: second.payload };
}

async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

class OrgLeaveCommand extends Command {
  static description = `Leave the organization you are signed in to.

  Asks for confirmation first; pass --yes to skip the prompt in scripts.
  Leaving is final. The only owner of an organization cannot leave it;
  make someone else an owner first.

  Only a person can leave, so sign in with \`primitive login\`; API keys are
  refused. The server may ask you to confirm in the dashboard first. The
  command prints the confirmation page and, in a terminal, asks for the
  token it shows. In a script, pass that token with --step-up-token.

  The server's refusal is printed as it was returned.`;

  static summary = "Leave the organization";

  static examples = [
    "<%= config.bin %> org leave",
    "<%= config.bin %> org leave --yes --step-up-token pstep_...",
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
    yes: Flags.boolean({
      char: "y",
      description: "Leave without asking for confirmation.",
    }),
    "step-up-token": Flags.string({
      description:
        "Confirmation token from the dashboard confirmation page, sent in the Primitive-Step-Up header.",
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgLeaveCommand);

    await runWithTiming(flags.time, async () => {
      const { auth, baseUrlOverridden, requestConfig } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });

      const credentials = auth.credentials;
      const orgLabel = credentials
        ? `organization ${credentials.org_name ? `${credentials.org_name} (${credentials.org_id})` : credentials.org_id}`
        : "this organization";

      const outcome = await runOrgLeave({
        fetchImpl: fetch,
        baseUrl: requestConfig.resolvedApiBaseUrl,
        headers: {
          ...(requestConfig.headers ?? {}),
          ...(auth.apiKey ? { authorization: `Bearer ${auth.apiKey}` } : {}),
        },
        orgLabel,
        yes: flags.yes,
        stepUpToken: flags["step-up-token"],
        interactive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
        prompt: promptLine,
        write: (text) => process.stderr.write(text),
      });

      switch (outcome.kind) {
        case "left":
          process.stderr.write(`Left ${orgLabel}.\n`);
          return;
        case "cancelled":
          process.stderr.write("Cancelled. You are still a member.\n");
          process.exitCode = 1;
          return;
        case "needs_confirmation":
          process.stderr.write(
            "Not leaving: no terminal to confirm in. Pass --yes to leave without confirmation.\n",
          );
          process.exitCode = 1;
          return;
        case "error":
          writeErrorWithHints(outcome.payload);
          if (outcome.stepUpUrl) {
            process.stderr.write(
              `Confirm in the dashboard: ${outcome.stepUpUrl}\nThen rerun with --step-up-token <token>.\n`,
            );
          }
          surfaceUnauthorizedHint({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload: outcome.payload,
          });
          process.exitCode = 1;
          return;
      }
    });
  }
}

export default OrgLeaveCommand;
