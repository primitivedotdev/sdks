import { Command, Flags } from "@oclif/core";
import {
  type EmailDetail,
  getEmail,
  PrimitiveApiClient,
  type TestInvocationResult,
  testFunction,
} from "@primitivedotdev/api-core";
import {
  API_BASE_URL_1_FLAG_DESCRIPTION,
  API_BASE_URL_2_FLAG_DESCRIPTION,
  baseUrlOverriddenFromFlags,
  extractErrorPayload,
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import {
  DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
  fetchEmailSearchPage,
  sleep,
} from "./emails-poll.js";

// `primitive functions:test-function` is the agent-grade shortcut for
// triggering a real round-trip and (optionally) waiting for the
// function to actually run before exiting. The underlying
// `POST /functions/{id}/test` operation only kicks off a synthetic
// inbound through MX and returns the queued send id; AGX walkthroughs
// flagged the missing wait-and-show-sends step as the single biggest
// time-sink in the verification loop.
//
// Shapes:
//   primitive functions:test-function --id <fn-id>
//       Fire-and-forget. Returns the TestInvocationResult JSON
//       (recipient, poll_since, watch_url). Same behavior as the
//       auto-generated functions:test-function it replaces.
//
//   primitive functions:test-function --id <fn-id> --wait
//       Blocks until the test inbound has arrived AND the function's
//       webhook has fired (or --timeout elapses). Exits non-zero on
//       timeout or on exhausted retries.
//
//   primitive functions:test-function --id <fn-id> --wait --show-sends
//       Same as --wait, plus prints the inbound's `replies` array
//       (every outbound the function emitted while processing the
//       test inbound), with each send's id, status, recipient,
//       subject, and queue id.
//
// The auto-generated functions:test-function entry is filtered out
// of the generated-command set in oclif/index.ts so this hand-rolled
// version owns the id.

const DEFAULT_WAIT_TIMEOUT_SECONDS = 60;

// Terminal states from the EmailWebhookStatus enum. `fired` means the
// function returned 2xx; `exhausted` means all retries are spent and
// the delivery is permanently failed. `pending` / `in_flight` /
// `failed` are intermediate (`failed` is a temporary failure that may
// retry into `fired` or eventually `exhausted`), so we keep polling.
const TERMINAL_WEBHOOK_STATUSES = new Set<string>(["fired", "exhausted"]);

class FunctionsTestFunctionCommand extends Command {
  static description =
    "Send a real test email through MX to trigger this function. With --wait, blocks until the function has processed the inbound; with --show-sends, also prints any outbound sends the function emitted in response.";

  static summary = "Trigger a test invocation; with --wait, watch it land";

  static examples = [
    "<%= config.bin %> functions:test-function --id <fn-id>",
    "<%= config.bin %> functions:test-function --id <fn-id> --local-part summarize",
    "<%= config.bin %> functions:test-function --id <fn-id> --wait --show-sends",
    "<%= config.bin %> functions:test-function --id <fn-id> --local-part summarize --wait --timeout 120",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive login` credentials)",
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
        "Block until the function has processed the test inbound (webhook status is `fired` or `exhausted`) or --timeout elapses. Exits non-zero on timeout or on exhausted retries.",
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

    const baseUrlOverridden = baseUrlOverriddenFromFlags(flags);
    const auth = resolveCliAuth({
      apiKey: flags["api-key"],
      apiBaseUrl1: flags["api-base-url-1"],
      apiBaseUrl2: flags["api-base-url-2"],
      configDir: this.config.configDir,
    });
    const apiClient = new PrimitiveApiClient({
      apiKey: auth.apiKey,
      apiBaseUrl1: auth.apiBaseUrl1,
      apiBaseUrl2: auth.apiBaseUrl2,
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
        removeStaleSavedCredentialOnUnauthorized({
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

      const startedAt = Date.now();
      const timeoutMs = flags.timeout * 1000;
      const pollIntervalMs = flags["poll-interval"] * 1000;
      const isExpired = () =>
        flags.timeout > 0 && Date.now() - startedAt > timeoutMs;

      // 2. Wait for the test inbound to arrive. The synthetic
      // recipient is unique per call (random suffix in the local-part
      // unless --local-part overrides), so `to` + `since` uniquely
      // identifies the test inbound row.
      this.log(`Waiting for test inbound to arrive at ${invocation.to}...`);
      let inboundId: string | undefined;
      while (!isExpired()) {
        const page = await fetchEmailSearchPage({
          apiClient,
          filters: { to: invocation.to },
          pageSize: 25,
          since: invocation.poll_since,
        });
        if (!page.ok) {
          const payload = extractErrorPayload(page.error);
          writeErrorWithHints(payload);
          removeStaleSavedCredentialOnUnauthorized({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload,
          });
          process.exitCode = 1;
          return;
        }
        const found = page.rows[0];
        if (found) {
          inboundId = found.id;
          break;
        }
        await sleep(pollIntervalMs);
      }

      if (!inboundId) {
        this.error(
          `Timed out after ${flags.timeout}s waiting for test inbound ${invocation.to} to land. Browse ${invocation.watch_url} for the live view.`,
          { exit: 2 },
        );
      }

      // 3. Wait for the function (webhook) to actually run. We poll
      // the email-detail endpoint because it already carries both the
      // webhook_status terminal state and the `replies` array we'll
      // print under --show-sends. No second endpoint needed.
      this.log(`Inbound landed (${inboundId}). Waiting for function to run...`);
      let detail: EmailDetail | undefined;
      while (!isExpired()) {
        const result = await getEmail({
          client: apiClient.client,
          path: { id: inboundId },
          responseStyle: "fields",
        });
        if (result.error) {
          const payload = extractErrorPayload(result.error);
          writeErrorWithHints(payload);
          removeStaleSavedCredentialOnUnauthorized({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload,
          });
          process.exitCode = 1;
          return;
        }
        const fetched = (result.data as { data: EmailDetail }).data;
        if (
          fetched.webhook_status &&
          TERMINAL_WEBHOOK_STATUSES.has(fetched.webhook_status)
        ) {
          detail = fetched;
          break;
        }
        await sleep(pollIntervalMs);
      }

      if (!detail) {
        this.error(
          `Timed out after ${flags.timeout}s waiting for function webhook to fire for inbound ${inboundId}. Browse ${invocation.watch_url} for the live view.`,
          { exit: 2 },
        );
      }

      // 4. Emit the outcome.
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const outcome: Record<string, unknown> = {
        function_id: flags.id,
        inbound_id: inboundId,
        inbound_to: invocation.to,
        webhook_status: detail.webhook_status,
        webhook_attempt_count: detail.webhook_attempt_count,
        webhook_last_status_code: detail.webhook_last_status_code,
        webhook_last_error: detail.webhook_last_error,
        elapsed_seconds: elapsedSeconds,
      };
      if (shouldShowSends) {
        outcome.sent_emails = detail.replies;
      }
      this.log(JSON.stringify(outcome, null, 2));

      // Exit non-zero when the function failed permanently so CI
      // scripts can gate on the exit code.
      if (detail.webhook_status === "exhausted") {
        process.exitCode = 1;
      }
    });
  }
}

export default FunctionsTestFunctionCommand;
