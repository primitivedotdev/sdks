import { Command, Errors, Flags } from "@oclif/core";
import {
  getInboxStatus,
  type InboxStatus,
  type InboxStatusDomain,
  type InboxStatusNextAction,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_1_FLAG_DESCRIPTION,
  API_BASE_URL_2_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

type InboxStatusEnvelope = {
  data?: InboxStatus;
  success?: boolean;
  [key: string]: unknown;
};

const DOMAIN_DISPLAY_WIDTH = 34;
const STATUS_DISPLAY_WIDTH = 12;
const BOOL_DISPLAY_WIDTH = 7;
const NUM_DISPLAY_WIDTH = 6;

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function statusText(status: InboxStatusDomain["status"]): string {
  switch (status) {
    case "ready":
      return "ready";
    case "stored_only":
      return "stored-only";
    case "pending_dns":
      return "pending-dns";
    case "inactive":
      return "inactive";
  }
}

export function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function formatInboxDate(value: string | null | undefined): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function truncate(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, width - 3)}...`;
}

export function domainSummary(domain: InboxStatusDomain): string {
  switch (domain.status) {
    case "ready":
      return `${domain.domain} can receive mail and has ${plural(domain.processing_route_count, "processing route")}.`;
    case "stored_only":
      return `${domain.domain} can receive and store mail, but has no enabled processing route.`;
    case "pending_dns":
      return `${domain.domain} is waiting on DNS verification before it can receive mail.`;
    case "inactive":
      return `${domain.domain} is verified but inactive.`;
  }
}

export function focusInboxStatus(
  status: InboxStatus,
  domainName: string,
): InboxStatus {
  const normalized = domainName.toLowerCase();
  const domain = status.domains.find(
    (entry) => entry.domain.toLowerCase() === normalized,
  );
  if (!domain) {
    throw new Errors.CLIError(`Domain ${domainName} was not found.`, {
      exit: 1,
    });
  }

  return {
    ...status,
    domains: [domain],
    ready: domain.receiving_ready && domain.processing_ready,
    receiving_ready: domain.receiving_ready,
    processing_ready: domain.processing_ready,
    summary: domainSummary(domain),
    recent_emails: {
      total: domain.email_count,
      latest_received_at: domain.latest_email_received_at,
    },
  };
}

export function formatDomainHeader(): string {
  return [
    "DOMAIN".padEnd(DOMAIN_DISPLAY_WIDTH),
    "STATUS".padEnd(STATUS_DISPLAY_WIDTH),
    "RECEIVE".padEnd(BOOL_DISPLAY_WIDTH),
    "PROCESS".padEnd(BOOL_DISPLAY_WIDTH),
    "EMAILS".padStart(NUM_DISPLAY_WIDTH),
    "ROUTES".padStart(NUM_DISPLAY_WIDTH),
  ].join("  ");
}

export function formatDomainRow(domain: InboxStatusDomain): string {
  return [
    truncate(domain.domain, DOMAIN_DISPLAY_WIDTH),
    statusText(domain.status).padEnd(STATUS_DISPLAY_WIDTH),
    yesNo(domain.receiving_ready).padEnd(BOOL_DISPLAY_WIDTH),
    yesNo(domain.processing_ready).padEnd(BOOL_DISPLAY_WIDTH),
    String(domain.email_count).padStart(NUM_DISPLAY_WIDTH),
    String(domain.processing_route_count).padStart(NUM_DISPLAY_WIDTH),
  ].join("  ");
}

export function formatNextAction(action: InboxStatusNextAction): string {
  return action.command
    ? `- ${action.message}\n  ${action.command}`
    : `- ${action.message}`;
}

export function formatInboxStatus(status: InboxStatus): string {
  const lines = [status.summary, "", "Domains"];

  if (status.domains.length === 0) {
    lines.push("No domains configured.");
  } else {
    lines.push(formatDomainHeader());
    for (const domain of status.domains) {
      lines.push(formatDomainRow(domain));
    }
  }

  lines.push(
    "",
    `Endpoints: ${status.endpoints.enabled}/${status.endpoints.total} enabled (${status.endpoints.fallback_enabled} fallback, ${status.endpoints.domain_scoped_enabled} domain-scoped, ${status.endpoints.function_enabled} function)`,
    `Functions: ${status.functions.deployed}/${status.functions.total} deployed (${status.functions.pending} pending, ${status.functions.failed} failed)`,
    `Recent inbound: ${plural(status.recent_emails.total, "email")} latest ${formatInboxDate(status.recent_emails.latest_received_at)}`,
  );

  if (status.next_actions.length > 0) {
    lines.push("", "Next actions");
    for (const action of status.next_actions) {
      lines.push(formatNextAction(action));
    }
  }

  return lines.join("\n");
}

class InboxStatusCommand extends Command {
  static description = `Show consolidated inbound email readiness.

  This checks the server-owned inbox status API instead of reconstructing readiness locally from separate domain, endpoint, function, and email lists. Use it before testing inbound email setup: it tells you whether mail can be received, whether anything will process it, and which next command is most useful.`;

  static summary = "Show inbound email readiness";

  static examples = [
    "<%= config.bin %> inbox status",
    "<%= config.bin %> inbox status --domain example.com",
    "<%= config.bin %> inbox status --json | jq '.data.next_actions'",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url-1": Flags.string({
      description: API_BASE_URL_1_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description: API_BASE_URL_2_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL_2",
      hidden: true,
    }),
    domain: Flags.string({
      description:
        "Focus the status output on one domain returned by the inbox status API.",
    }),
    json: Flags.boolean({
      description:
        "Print the raw response envelope as JSON. With --domain, the envelope data is focused on the matched domain.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InboxStatusCommand);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
          configDir: this.config.configDir,
        });

      const result = await getInboxStatus({
        client: apiClient.client,
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = (result.data ?? {}) as InboxStatusEnvelope;
      const status = envelope.data;
      if (!status) {
        throw new Errors.CLIError("Primitive API returned no inbox status.", {
          exit: 1,
        });
      }

      const outputStatus = flags.domain
        ? focusInboxStatus(status, flags.domain)
        : status;

      if (flags.json) {
        this.log(JSON.stringify({ ...envelope, data: outputStatus }, null, 2));
        return;
      }

      this.log(formatInboxStatus(outputStatus));
    });
  }
}

export default InboxStatusCommand;
