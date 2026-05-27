import { Command, Errors, Flags } from "@oclif/core";
import {
  getInboxStatus,
  type InboxStatus,
  type InboxStatusDomain,
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
import { statusText } from "./inbox-status.js";

type InboxStatusEnvelope = {
  data?: InboxStatus;
  success?: boolean;
  [key: string]: unknown;
};

export type InboxSetupCommandSet = {
  scaffold: string[];
  logs: string;
  status: string;
};

export type InboxSetupProof = {
  after_test: string[];
  logs_command: string;
};

export type InboxSetupGuide = {
  readiness: {
    ready: boolean;
    receiving_ready: boolean;
    processing_ready: boolean;
    mode: "actively_processed" | "stored_only" | "not_receiving";
    summary: string;
  };
  receive: {
    address: string | null;
    domain: string | null;
    managed: boolean;
    placeholder_local_part: string | null;
  };
  processing: {
    stored_only: boolean;
    active: boolean;
    enabled_endpoints: number;
    deployed_functions: number;
  };
  commands: InboxSetupCommandSet;
  proof: InboxSetupProof;
  status: InboxStatus;
};

const DEFAULT_FUNCTION_NAME = "inbound-reply";
const DEFAULT_LOCAL_PART = "inbox";
const FUNCTION_ID_PLACEHOLDER = "<function-id>";

function firstUsableManagedDomain(
  status: InboxStatus,
): InboxStatusDomain | null {
  return (
    status.domains.find(
      (domain) => domain.managed && domain.receiving_ready && domain.active,
    ) ??
    status.domains.find((domain) => domain.managed && domain.receiving_ready) ??
    null
  );
}

export function buildInboxSetupCommands(
  functionName = DEFAULT_FUNCTION_NAME,
): InboxSetupCommandSet {
  return {
    scaffold: [
      `primitive functions init ${functionName}`,
      `cd ${functionName}`,
      "npm install",
      "npm run build",
      `primitive functions deploy --name ${functionName} --file ./dist/handler.js --wait`,
      `primitive functions test --id ${FUNCTION_ID_PLACEHOLDER} --wait --show-sends`,
    ],
    logs: `primitive functions logs --id ${FUNCTION_ID_PLACEHOLDER}`,
    status: "primitive inbox status",
  };
}

export function buildInboxSetupProof(
  commands: InboxSetupCommandSet,
): InboxSetupProof {
  return {
    after_test: [
      "inbound id for the generated test email",
      "function id matching the deployed Function",
      "invocation status completed, failed, or send_failed",
      "reply/send result emitted by the handler",
    ],
    logs_command: commands.logs,
  };
}

export function buildInboxSetupGuide(status: InboxStatus): InboxSetupGuide {
  const domain = firstUsableManagedDomain(status);
  const commands = buildInboxSetupCommands();
  const mode = !status.receiving_ready
    ? "not_receiving"
    : status.processing_ready
      ? "actively_processed"
      : "stored_only";

  return {
    readiness: {
      ready: status.ready,
      receiving_ready: status.receiving_ready,
      processing_ready: status.processing_ready,
      mode,
      summary: status.summary,
    },
    receive: {
      address: domain ? `${DEFAULT_LOCAL_PART}@${domain.domain}` : null,
      domain: domain?.domain ?? null,
      managed: domain?.managed ?? false,
      placeholder_local_part: domain ? DEFAULT_LOCAL_PART : null,
    },
    processing: {
      stored_only: status.receiving_ready && !status.processing_ready,
      active: status.processing_ready,
      enabled_endpoints: status.endpoints.enabled,
      deployed_functions: status.functions.deployed,
    },
    commands,
    proof: buildInboxSetupProof(commands),
    status,
  };
}

function formatReadiness(guide: InboxSetupGuide): string {
  const readiness = guide.readiness.ready ? "ready" : "not ready";
  const receiving = guide.readiness.receiving_ready ? "yes" : "no";
  const processing = guide.readiness.processing_ready ? "yes" : "no";
  const mode =
    guide.readiness.mode === "actively_processed"
      ? "actively processed"
      : guide.readiness.mode === "stored_only"
        ? "stored-only"
        : "not receiving";

  return [
    `Readiness: ${readiness}`,
    `Receiving: ${receiving}`,
    `Processing: ${processing}`,
    `Mode: ${mode}`,
  ].join("\n");
}

function formatReceiveAddress(guide: InboxSetupGuide): string {
  if (!guide.receive.domain || !guide.receive.address) {
    return "Receive address: none found on a receiving-ready Primitive-managed domain";
  }

  return [
    `Receive address: ${guide.receive.address}`,
    `Receive domain: ${guide.receive.domain} (Primitive-managed)`,
  ].join("\n");
}

function formatDomainDetails(status: InboxStatus): string[] {
  if (status.domains.length === 0) return ["Domains: none configured"];

  return status.domains.map(
    (domain) =>
      `- ${domain.domain}: ${statusText(domain.status)}, receive ${domain.receiving_ready ? "yes" : "no"}, process ${domain.processing_ready ? "yes" : "no"}, routes ${domain.processing_route_count}`,
  );
}

function formatScaffoldCommands(commands: InboxSetupCommandSet): string[] {
  return commands.scaffold.map((command) => `  ${command}`);
}

export function formatInboxSetupGuide(guide: InboxSetupGuide): string {
  const lines = [
    "Inbound setup",
    "",
    guide.readiness.summary,
    "",
    formatReadiness(guide),
    "",
    formatReceiveAddress(guide),
    "",
    "Domains",
    ...formatDomainDetails(guide.status),
    "",
    `Processing routes: ${guide.processing.enabled_endpoints} enabled endpoint(s), ${guide.processing.deployed_functions} deployed Function(s)`,
  ];

  if (guide.readiness.mode === "not_receiving") {
    lines.push(
      "",
      "Next actions",
      "Make a receiving-ready domain available, then re-run:",
      `  ${guide.commands.status}`,
    );
  } else if (!guide.processing.active) {
    lines.push(
      "",
      "Next actions",
      "No processing route is enabled. Scaffold, deploy, and test an email Function:",
      ...formatScaffoldCommands(guide.commands),
    );
  } else {
    lines.push(
      "",
      "Next actions",
      "Inbound mail has an active processing route. Run a Function test when you know the Function id:",
      `  primitive functions test --id ${FUNCTION_ID_PLACEHOLDER} --wait --show-sends`,
    );
  }

  if (guide.status.next_actions.length > 0) {
    lines.push("", "API suggested actions");
    for (const action of guide.status.next_actions) {
      lines.push(
        action.command
          ? `- ${action.message}\n  ${action.command}`
          : `- ${action.message}`,
      );
    }
  }

  lines.push(
    "",
    "Proof after functions test",
    "- Inbound id: the generated test email should have an inbound id.",
    "- Function id: the run should point at the Function id you deployed.",
    "- Invocation status: expect completed; failed or send_failed identifies the failing stage.",
    "- Reply/send result: --show-sends should show the handler's outbound result when it replies or sends.",
    "- Logs:",
    `  ${guide.proof.logs_command}`,
  );

  return lines.join("\n");
}

class InboxSetupCommand extends Command {
  static description =
    `Guide inbound email setup from the server-owned inbox status API.

  This command does not scaffold, deploy, or run tests. It verifies auth, fetches inbox readiness, shows the first usable Primitive-managed receive address/domain, explains whether inbound mail is stored-only or actively processed, and prints the exact commands to add a Function processing route when one is missing.`;

  static summary = "Guide inbound email setup";

  static examples = [
    "<%= config.bin %> inbox setup",
    "<%= config.bin %> inbox setup --json",
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
    json: Flags.boolean({
      description:
        "Print structured readiness, receive address, commands, proof metadata, and raw status as JSON.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InboxSetupCommand);

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

      const guide = buildInboxSetupGuide(status);
      if (flags.json) {
        this.log(JSON.stringify({ ...envelope, data: guide }, null, 2));
        return;
      }

      this.log(formatInboxSetupGuide(guide));
    });
  }
}

export default InboxSetupCommand;
