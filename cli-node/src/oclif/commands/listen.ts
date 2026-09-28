import { createHash, randomUUID } from "node:crypto";
import { Command, Errors, Flags } from "@oclif/core";
import { resolveCliApiRequestConfig } from "../api-client.js";
import { API_BASE_URL_FLAG_DESCRIPTION } from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import {
  backgroundListenStatus,
  backgroundListenToken,
  runBackgroundListen,
  startBackgroundListen,
  stopBackgroundListen,
  verifyBackgroundListenTarget,
} from "../listen-background.js";
import { createListenHandler } from "../listen-handlers.js";
import {
  ListenError,
  type ListenOptions,
  runListen,
} from "../listen-runner.js";
import { ListenStateError } from "../listen-state.js";
import { notificationScope, notificationSenders } from "../notify-session.js";
import { NotificationOutcomeUnknownError } from "../notify-session-errors.js";
import {
  defaultSessionSocket,
  NativeSessionDisconnectedError,
  NativeSessionError,
  NativeSessionNotLoadedError,
  SESSION_UUID,
} from "../notify-session-native.js";
import { notificationReceiptPage } from "../notify-session-state.js";

export default class ListenCommand extends Command {
  static summary = "Receive webhook events locally without a public endpoint";
  static description =
    "Subscribe once and reconnect using the same durable server queue. Connected-agent credentials automatically receive only their assigned address. Use --notify-session with an exact loaded session UUID and --contacts for saved contact preferences, or approved --sender addresses, for native session notifications, a short --exec hook to durably accept an event, --forward-to for a local webhook, or newline-delimited JSON on stdout. Add --background to keep native receiving independent of the calling terminal process; --status reports receiver health and receipts, and --stop stops that receiver. Notifications require an existing native local-session socket; the CLI never launches or resumes a session.";
  static examples = [
    "<%= config.bin %> listen",
    '<%= config.bin %> listen --subscription my-agent --exec "python3 accept.py"',
    "<%= config.bin %> listen --forward-to localhost:3000",
    "<%= config.bin %> listen --once --timeout 60",
    "<%= config.bin %> listen --notify-session 11111111-1111-4111-8111-111111111111 --sender person@example.com",
    "<%= config.bin %> listen --notify-session 11111111-1111-4111-8111-111111111111 --contacts",
    "<%= config.bin %> listen --background --notify-session 11111111-1111-4111-8111-111111111111 --contacts --contact-requests",
    "<%= config.bin %> listen --status --notify-session 11111111-1111-4111-8111-111111111111",
    "<%= config.bin %> listen --stop --notify-session 11111111-1111-4111-8111-111111111111",
  ];
  static flags = {
    transport: Flags.string({
      description:
        "Event transport; native session notifications require WebSocket.",
      options: ["websocket", "poll"],
      default: "websocket",
    }),
    once: Flags.boolean({
      description:
        "Exit after one handled delivery, or one processed local candidate in notification mode.",
      exclusive: ["number"],
    }),
    timeout: Flags.integer({
      description:
        "Stop after this many seconds; exit 2 if the requested count was not reached.",
      min: 1,
      max: 2147483,
    }),
    subscription: Flags.string({
      description:
        "Stable subscription name for generic listeners. Native notifications use the shared saved subscription; local-mail-* names are reserved.",
    }),
    exec: Flags.string({
      description:
        "Short POSIX shell command accepting each complete event on stdin.",
      exclusive: ["forward-to", "notify-session"],
    }),
    "forward-to": Flags.string({
      description: "Forward each event to this HTTP(S) webhook URL.",
      exclusive: ["exec", "notify-session"],
    }),
    "notify-session": Flags.string({
      description:
        "Notify this exact loaded native session UUID using the shared WebSocket subscription and approved senders.",
      exclusive: ["exec", "forward-to"],
    }),
    contacts: Flags.boolean({
      description:
        "Use this agent address's saved contact notification preferences; disabled contacts never notify.",
      dependsOn: ["notify-session"],
      exclusive: ["sender", "status", "stop"],
    }),
    "contact-requests": Flags.boolean({
      description:
        "Also consider one authenticated structured first-contact request per unknown sender when owner policy enables requests. No ordinary unknown mail or task authority is admitted.",
      dependsOn: ["contacts", "notify-session"],
      exclusive: ["sender", "status", "stop"],
    }),
    sender: Flags.string({
      description:
        "Approved exact sender address for session notifications; repeat or separate with commas.",
      multiple: true,
      exclusive: ["contacts"],
      dependsOn: ["notify-session"],
    }),
    "session-socket": Flags.string({
      description: "Explicit private native Unix socket path.",
      hidden: true,
      dependsOn: ["notify-session"],
    }),
    status: Flags.boolean({
      description:
        "Inspect local receiver health and saved notification receipts without connecting to a session or receiving events.",
      dependsOn: ["notify-session"],
      exclusive: [
        "exec",
        "forward-to",
        "sender",
        "session-socket",
        "once",
        "number",
        "events",
        "subscription",
        "timeout",
        "background",
        "stop",
      ],
    }),
    background: Flags.boolean({
      description:
        "Run one native notification receiver independently of the calling process; reconnect safely to the same session after transport loss.",
      dependsOn: ["notify-session"],
      exclusive: ["status", "stop", "once", "number", "timeout"],
    }),
    stop: Flags.boolean({
      description:
        "Stop this profile and session's tracked receiver, preserving subscriptions and notification receipts.",
      dependsOn: ["notify-session"],
      exclusive: [
        "background",
        "status",
        "contacts",
        "contact-requests",
        "sender",
        "exec",
        "forward-to",
        "session-socket",
        "once",
        "number",
        "events",
        "subscription",
        "timeout",
      ],
    }),
    limit: Flags.integer({
      description:
        "Maximum notification receipts in a status page (default 100).",
      min: 1,
      max: 1000,
      dependsOn: ["status"],
    }),
    cursor: Flags.string({
      description:
        "Continue receipt status after the previous page's nextCursor UUID.",
      dependsOn: ["status"],
    }),
    events: Flags.string({
      description:
        "Comma-separated event types. Omit when reconnecting to preserve the existing selection.",
    }),
    number: Flags.integer({
      description:
        "Exit after this many handled deliveries, or processed local notification candidates.",
      min: 1,
    }),
    "api-key": Flags.string({
      description: "API key override; otherwise use saved login credentials.",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(ListenCommand);
    if (
      flags["notify-session"] !== undefined &&
      !SESSION_UUID.test(flags["notify-session"])
    )
      throw new Errors.CLIError(
        "--notify-session requires an exact session UUID.",
      );
    if (flags["notify-session"] && flags.transport === "poll")
      throw new Errors.CLIError(
        "--notify-session requires --transport websocket.",
      );
    if (flags["notify-session"] && flags.subscription !== undefined)
      throw new Errors.CLIError(
        "--notify-session uses the shared saved subscription; omit --subscription.",
      );
    if (flags.subscription?.trim().startsWith("local-mail-"))
      throw new Errors.CLIError(
        "Subscription names beginning local-mail- are reserved for shared mail receiving.",
      );
    const senders =
      flags["notify-session"] && !flags.contacts && !flags.status && !flags.stop
        ? notificationSenders(flags.sender ?? [])
        : undefined;
    const requestConfig = flags["notify-session"]
      ? resolveCliApiRequestConfig({
          configDir: this.config.configDir,
          apiBaseUrl: flags["api-base-url"],
        })
      : undefined;
    const connectionAuth = requestConfig
      ? resolveCliAuth({
          configDir: this.config.configDir,
          apiBaseUrl: requestConfig.apiBaseUrl,
          apiKey: flags["api-key"],
        })
      : undefined;
    const target =
      connectionAuth && flags["notify-session"]
        ? {
            configDir: this.config.configDir,
            scope: notificationScope(
              connectionAuth.apiBaseUrl,
              connectionAuth.apiKey,
            ),
            threadId: flags["notify-session"],
          }
        : undefined;
    const socketPath =
      target && !flags.status && !flags.stop
        ? (flags["session-socket"] ?? defaultSessionSocket())
        : undefined;
    const configuration = target
      ? createHash("sha256")
          .update(
            JSON.stringify({
              version: this.config.version,
              contacts: Boolean(flags.contacts),
              contactRequests: Boolean(flags["contact-requests"]),
              senders: [...(senders ?? [])].sort(),
              socketPath,
              events: flags.events
                ?.split(",")
                .map((event) => event.trim())
                .sort(),
            }),
          )
          .digest("hex")
      : undefined;
    if (target) verifyBackgroundListenTarget({ ...target, configuration });
    if (flags.stop && target) {
      this.log(
        JSON.stringify(
          {
            sessionId: target.threadId,
            listener: await stopBackgroundListen(target),
          },
          null,
          2,
        ),
      );
      return;
    }
    if (flags.status && target) {
      const page = notificationReceiptPage(
        this.config.configDir,
        target.scope,
        target.threadId,
        { limit: flags.limit, cursor: flags.cursor },
      );
      this.log(
        JSON.stringify(
          {
            sessionId: target.threadId,
            listener: backgroundListenStatus(target),
            receipts: page.receipts.map((receipt) => ({
              ...receipt,
              state: receipt.state === "submitting" ? "unknown" : receipt.state,
            })),
            nextCursor: page.nextCursor,
            guidance:
              "Listener health describes the tracked local receiver, not proof a message was read. Older untracked listeners have no health record. Accepted means queued, not read or answered. Unknown receipts are held and are never resent automatically; inspect the exact session before any manual resend.",
          },
          null,
          2,
        ),
      );
      return;
    }
    const events = flags.events?.split(",").map((event) => event.trim());
    if (events?.some((event) => !/^[a-zA-Z0-9_.-]+$/.test(event)))
      throw new Errors.CLIError(
        "--events requires nonempty comma-separated event types.",
      );
    const handler = createListenHandler({
      exec: flags.exec,
      forwardTo: flags["forward-to"],
    });
    const controller = new AbortController();
    let timedOut = false;
    const timer =
      flags.timeout === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, flags.timeout * 1000);
    const cancel = () => controller.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    try {
      const childToken = backgroundListenToken();
      if (flags.background && target && !childToken) {
        const entry = process.argv[1];
        if (!entry)
          throw new ListenStateError("The CLI entrypoint is unavailable.");
        const result = await startBackgroundListen({
          ...target,
          configuration,
          argv: [entry, "listen", ...this.argv],
          signal: controller.signal,
        });
        this.log(
          JSON.stringify({ sessionId: target.threadId, ...result }, null, 2),
        );
        return;
      }
      const options: ListenOptions = {
        transport: flags.transport === "poll" ? "poll" : "websocket",
        configDir: this.config.configDir,
        expectedNotificationScope: target?.scope,
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        subscription: flags.subscription,
        events: events === undefined ? undefined : [...new Set(events)],
        number: flags.once ? 1 : flags.number,
        mode: flags["notify-session"]
          ? "sdk"
          : flags.exec
            ? "exec"
            : flags["forward-to"]
              ? "http"
              : "stdout",
        notifySession: flags["notify-session"]
          ? {
              threadId: flags["notify-session"],
              senders: senders ?? [],
              contactPreferences: flags.contacts,
              contactRequests: flags["contact-requests"],
              socketPath,
            }
          : undefined,
        handler,
        signal: controller.signal,
      };
      if (!target || !options.notifySession || !requestConfig) {
        await runListen(options);
      } else {
        const notify = options.notifySession;
        let expectedCwd: string | undefined;
        let connectionChanged = false;
        await runBackgroundListen({
          ...target,
          configuration,
          token: childToken ?? randomUUID(),
          detached: childToken !== null,
          signal: controller.signal,
          failureCode: (error) =>
            error instanceof NotificationOutcomeUnknownError
              ? "notification-outcome-unknown"
              : connectionChanged
                ? "connection-changed"
                : error instanceof NativeSessionError
                  ? "native-session-unavailable"
                  : "receiving-failed",
          retryable: (error) =>
            childToken !== null &&
            (error instanceof NativeSessionDisconnectedError ||
              (expectedCwd !== undefined &&
                error instanceof NativeSessionNotLoadedError)),
          run: async (signal, onReady) => {
            // A retry must never adopt a replaced profile, credential or origin.
            const current = resolveCliAuth({
              configDir: this.config.configDir,
              apiBaseUrl: requestConfig.apiBaseUrl,
              apiKey: flags["api-key"],
            });
            if (
              notificationScope(current.apiBaseUrl, current.apiKey) !==
                target.scope ||
              current.connectedAgent?.agentAddress !==
                connectionAuth?.connectedAgent?.agentAddress
            ) {
              connectionChanged = true;
              throw new ListenStateError(
                "The selected connection changed. Stop this listener and start it again with the intended profile.",
              );
            }
            const attempt = new AbortController();
            let disconnected: NativeSessionError | undefined;
            await runListen({
              ...options,
              signal: AbortSignal.any([signal, attempt.signal]),
              onReady,
              notifySession: {
                ...notify,
                expectedCwd,
                onVerifiedCwd: (cwd) => {
                  expectedCwd ??= cwd;
                },
                onDisconnect: (error) => {
                  disconnected = error;
                  attempt.abort(error);
                },
              },
            });
            // Wait for dispatch reconciliation before choosing to reconnect.
            // A terminal unknown submission thrown by runListen takes priority.
            if (disconnected && !signal.aborted) throw disconnected;
          },
        });
      }
    } catch (error) {
      throw new Errors.CLIError(
        error instanceof ListenError || error instanceof ListenStateError
          ? error.message
          : "The listener stopped because of a local state or connection error.",
      );
    } finally {
      clearTimeout(timer);
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    }
    if (controller.signal.aborted) process.exitCode = timedOut ? 2 : 130;
  }
}
