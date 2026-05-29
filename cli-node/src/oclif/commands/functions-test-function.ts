import { Command, Flags } from "@oclif/core";
import {
  type EmailWebhookStatus,
  type FunctionTestRunReply,
  type FunctionTestRunState,
  type FunctionTestRunTrace,
  getFunctionTestRunTrace,
  listDomains,
  listEndpoints,
  type PrimitiveApiClient,
  type TestInvocationResult,
  testFunction,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { DEFAULT_EMAIL_POLL_INTERVAL_SECONDS, sleep } from "./emails-poll.js";

// `primitive functions test` is the agent-grade shortcut for
// triggering a real round-trip and (optionally) waiting for the
// function to actually run before exiting. The underlying
// `POST /functions/{id}/test` operation only kicks off a synthetic
// inbound through MX and returns the queued send id; AGX walkthroughs
// flagged the missing wait-and-show-sends step as the single biggest
// time-sink in the verification loop.
//
// Shapes:
//   primitive functions test --id <fn-id>
//       Fire-and-forget. Returns the TestInvocationResult JSON
//       (recipient, poll_since, watch_url, trace_url). Same behavior as the
//       auto-generated functions:test-function operation it replaces.
//
//   primitive functions test --id <fn-id> --wait
//       Blocks until the server-owned test-run trace reaches completed,
//       failed, or send_failed (or --timeout elapses). Exits non-zero on
//       timeout or terminal failure.
//
//   primitive functions test --id <fn-id> --wait --show-sends
//       Same as --wait, plus prints the inbound's `replies` array
//       (every outbound the function emitted while processing the
//       test inbound), with each send's id, status, recipient,
//       subject, and queue id.
//
// The auto-generated functions:test-function entry is filtered out
// of the generated-command set in oclif/index.ts so this hand-rolled
// version owns the public id.

const DEFAULT_WAIT_TIMEOUT_SECONDS = 60;

const TERMINAL_TEST_TRACE_STATES = new Set<FunctionTestRunState>([
  "completed",
  "failed",
  "send_failed",
]);

export type FunctionTestOutcome = {
  state: FunctionTestRunState;
  function_id: string;
  inbound_domain: string;
  inbound_id: string | null;
  inbound_to: string;
  test_run_id: string;
  test_send_id: string;
  test_subject: string;
  poll_since: string;
  trace_url: string;
  watch_url: string;
  webhook_status: EmailWebhookStatus;
  webhook_attempt_count: number | null;
  webhook_last_status_code: number | null;
  webhook_last_error: string | null;
  elapsed_seconds: number;
  sent_emails?: FunctionTestRunReply[];
};

export function buildFunctionTestOutcome(params: {
  functionId: string;
  invocation: TestInvocationResult;
  trace: FunctionTestRunTrace;
  elapsedSeconds: number;
  showSends: boolean;
}): FunctionTestOutcome {
  const inbound = params.trace.inbound_email;
  const outcome: FunctionTestOutcome = {
    elapsed_seconds: params.elapsedSeconds,
    function_id: params.functionId,
    inbound_domain: params.invocation.inbound_domain,
    inbound_id: inbound?.id ?? null,
    inbound_to: params.invocation.to,
    poll_since: params.invocation.poll_since,
    state: params.trace.state,
    test_run_id: params.invocation.test_run_id,
    test_send_id: params.invocation.send_id,
    test_subject: params.invocation.subject,
    trace_url: params.invocation.trace_url,
    watch_url: params.invocation.watch_url,
    webhook_attempt_count: inbound?.webhook_attempt_count ?? null,
    webhook_last_error: inbound?.webhook_last_error ?? null,
    webhook_last_status_code: inbound?.webhook_last_status_code ?? null,
    webhook_status: inbound?.webhook_status ?? null,
  };
  if (params.showSends) {
    outcome.sent_emails = params.trace.replies;
  }
  return outcome;
}

export function writeFunctionTestProgress(
  message: string,
  writeStderr: (chunk: string) => void = (chunk) => {
    process.stderr.write(chunk);
  },
): void {
  writeStderr(`${message}\n`);
}

type RawEndpointRow = {
  id?: unknown;
  enabled?: unknown;
  deactivated_at?: unknown;
  domain_id?: unknown;
  function_id?: unknown;
  kind?: unknown;
};

export type MatchingFunctionEndpoint = {
  id: string;
  function_id: string | null;
  is_current_function: boolean;
  scope: "fallback" | "domain";
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function findMatchingFunctionEndpoints(params: {
  endpoints: RawEndpointRow[];
  currentFunctionId: string;
  inboundDomainId: string | null;
}): MatchingFunctionEndpoint[] {
  const domainMatches: MatchingFunctionEndpoint[] = [];
  const fallbackMatches: MatchingFunctionEndpoint[] = [];
  for (const endpoint of params.endpoints) {
    if (endpoint.kind !== "function") continue;
    if (endpoint.enabled === false) continue;
    if (
      endpoint.deactivated_at !== null &&
      endpoint.deactivated_at !== undefined
    ) {
      continue;
    }

    const id = stringOrNull(endpoint.id);
    if (!id) continue;
    const domainId = stringOrNull(endpoint.domain_id);
    if (
      domainId !== null &&
      (params.inboundDomainId === null || domainId !== params.inboundDomainId)
    ) {
      continue;
    }

    const functionId = stringOrNull(endpoint.function_id);
    const match = {
      function_id: functionId,
      id,
      is_current_function: functionId === params.currentFunctionId,
      scope: domainId === null ? "fallback" : "domain",
    } satisfies MatchingFunctionEndpoint;

    if (domainId === null) fallbackMatches.push(match);
    else domainMatches.push(match);
  }

  return domainMatches.length > 0 ? domainMatches : fallbackMatches;
}

export function formatFunctionEndpointNoiseWarning(params: {
  toAddress: string;
  inboundDomain: string;
  endpoints: MatchingFunctionEndpoint[];
}): string | null {
  const otherMatches = params.endpoints.filter(
    (endpoint) => !endpoint.is_current_function,
  );
  if (otherMatches.length === 0) return null;

  const lines = [
    `Warning: ${params.endpoints.length} function endpoints may receive mail for ${params.toAddress}:`,
  ];
  for (const endpoint of params.endpoints) {
    const scope =
      endpoint.scope === "fallback"
        ? "fallback"
        : `scoped to ${params.inboundDomain}`;
    const current = endpoint.is_current_function ? " (this function)" : "";
    const target = endpoint.function_id
      ? ` -> function ${endpoint.function_id}`
      : "";
    lines.push(`- endpoint ${endpoint.id}${target}, ${scope}${current}`);
  }
  return lines.join("\n");
}

async function maybeWriteEndpointNoiseWarning(params: {
  apiClient: PrimitiveApiClient;
  currentFunctionId: string;
  invocation: TestInvocationResult;
  writeStderr: (chunk: string) => void;
}): Promise<void> {
  try {
    const [domainsResult, endpointsResult] = await Promise.all([
      listDomains({
        client: params.apiClient.client,
        responseStyle: "fields",
      }),
      listEndpoints({
        client: params.apiClient.client,
        responseStyle: "fields",
      }),
    ]);

    if (endpointsResult.error) return;
    if (domainsResult.error) return;

    const domainsEnvelope = domainsResult.data as
      | { data?: Array<{ id?: string; domain?: string }> }
      | undefined;
    const inboundDomainId =
      domainsEnvelope?.data?.find(
        (domain) =>
          domain.domain?.toLowerCase() ===
          params.invocation.inbound_domain.toLowerCase(),
      )?.id ?? null;

    const endpointsEnvelope = endpointsResult.data as
      | { data?: RawEndpointRow[] }
      | undefined;
    const endpoints = findMatchingFunctionEndpoints({
      currentFunctionId: params.currentFunctionId,
      endpoints: endpointsEnvelope?.data ?? [],
      inboundDomainId,
    });
    const warning = formatFunctionEndpointNoiseWarning({
      endpoints,
      inboundDomain: params.invocation.inbound_domain,
      toAddress: params.invocation.to,
    });
    if (warning) {
      params.writeStderr(`${warning}\n`);
    }
  } catch {
    // Advisory only; never fail the test command because warning lookup failed.
  }
}

class FunctionsTestFunctionCommand extends Command {
  static description =
    "Send a real test email through MX to trigger this function. With --wait, blocks until the function has processed the inbound; with --show-sends, also prints any outbound sends the function emitted in response.";

  static summary = "Trigger a test invocation; with --wait, watch it land";

  static examples = [
    "<%= config.bin %> functions test --id <fn-id>",
    "<%= config.bin %> functions test --id <fn-id> --local-part summarize",
    "<%= config.bin %> functions test --id <fn-id> --wait --show-sends",
    "<%= config.bin %> functions test --id <fn-id> --local-part summarize --wait --timeout 120",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    id: Flags.string({
      description: "Function id (UUID).",
      required: true,
    }),
    "local-part": Flags.string({
      description:
        "Override the synthetic local-part the test inbound is addressed to. Otherwise the runtime picks `__primitive_function_test+<random>`.",
    }),
    wait: Flags.boolean({
      description:
        "Block until the function test run reaches `completed`, `failed`, or `send_failed`, or --timeout elapses. Exits non-zero on timeout or terminal failure.",
    }),
    "show-sends": Flags.boolean({
      description:
        "When the wait resolves, also print the outbound emails the function emitted while processing the test inbound (id, status, to, subject). Implies --wait.",
    }),
    timeout: Flags.integer({
      default: DEFAULT_WAIT_TIMEOUT_SECONDS,
      description:
        "Seconds to wait before exiting non-zero when --wait is set; 0 waits forever.",
      min: 0,
    }),
    "poll-interval": Flags.integer({
      default: DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
      description: "Seconds between polls while waiting.",
      min: 1,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsTestFunctionCommand);

    // --show-sends implies --wait. You can't print what was sent
    // until the function has actually run.
    const shouldWait = flags.wait || flags["show-sends"];
    const shouldShowSends = flags["show-sends"];

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      // 1. Trigger the test send.
      const triggerResult = await testFunction({
        client: apiClient.client,
        path: { id: flags.id },
        body: flags["local-part"]
          ? { local_part: flags["local-part"] }
          : undefined,
        responseStyle: "fields",
      });

      if (triggerResult.error) {
        const payload = extractErrorPayload(triggerResult.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }

      const invocation = (triggerResult.data as { data: TestInvocationResult })
        .data;

      if (!shouldWait) {
        // Fire-and-forget path: print the TestInvocationResult JSON
        // unchanged. Same shape the auto-generated command emitted.
        this.log(JSON.stringify(invocation, null, 2));
        return;
      }

      await maybeWriteEndpointNoiseWarning({
        apiClient,
        currentFunctionId: flags.id,
        invocation,
        writeStderr: (chunk) => {
          process.stderr.write(chunk);
        },
      });

      const startedAt = Date.now();
      const timeoutMs = flags.timeout * 1000;
      const pollIntervalMs = flags["poll-interval"] * 1000;
      const isExpired = () =>
        flags.timeout > 0 && Date.now() - startedAt > timeoutMs;

      // 2. Wait for the server-owned test-run trace to reach a terminal
      // state. Polling by test_run_id avoids false positives from unrelated
      // inbound mail to the same local-part.
      writeFunctionTestProgress(
        `Waiting for test run ${invocation.test_run_id} to complete for ${invocation.to}...`,
      );
      let trace: FunctionTestRunTrace | undefined;
      while (!isExpired()) {
        const result = await getFunctionTestRunTrace({
          client: apiClient.client,
          path: { id: flags.id, run_id: invocation.test_run_id },
          responseStyle: "fields",
        });
        if (result.error) {
          const payload = extractErrorPayload(result.error);
          writeErrorWithHints(payload);
          surfaceUnauthorizedHint({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload,
          });
          process.exitCode = 1;
          return;
        }
        const fetched = (result.data as { data: FunctionTestRunTrace }).data;
        if (TERMINAL_TEST_TRACE_STATES.has(fetched.state)) {
          trace = fetched;
          break;
        }
        await sleep(pollIntervalMs);
      }

      if (!trace) {
        this.error(
          `Timed out after ${flags.timeout}s waiting for function test run ${invocation.test_run_id} to complete. Browse ${invocation.watch_url} for the live view, or inspect ${invocation.trace_url}.`,
          { exit: 2 },
        );
      }

      // 3. Emit the outcome.
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const outcome = buildFunctionTestOutcome({
        elapsedSeconds,
        functionId: flags.id,
        invocation,
        showSends: shouldShowSends,
        trace,
      });
      this.log(JSON.stringify(outcome, null, 2));

      // Exit non-zero when the test run reached a terminal failure state so CI
      // scripts can gate on the exit code.
      if (trace.state === "failed" || trace.state === "send_failed") {
        process.exitCode = 1;
      }
    });
  }
}

export default FunctionsTestFunctionCommand;
