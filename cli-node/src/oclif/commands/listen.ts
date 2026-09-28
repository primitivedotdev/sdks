import { Command, Errors, Flags } from "@oclif/core";
import { resolveCliApiRequestConfig } from "../api-client.js";
import { API_BASE_URL_FLAG_DESCRIPTION } from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import { createListenHandler } from "../listen-handlers.js";
import { ListenError, runListen } from "../listen-runner.js";
import { ListenStateError } from "../listen-state.js";
import { notificationScope, notificationSenders } from "../notify-session.js";
import { SESSION_UUID } from "../notify-session-native.js";
import { notificationReceiptPage } from "../notify-session-state.js";

export default class ListenCommand extends Command {
  static summary = "Receive webhook events locally without a public endpoint";
  static description =
    "Subscribe once and reconnect using the same durable server queue. Connected-agent credentials automatically receive only their assigned address. Use --notify-session with an exact loaded session UUID and --contacts for saved contact preferences, or approved --sender addresses, for native session notifications, a short --exec hook to durably accept an event, --forward-to for a local webhook, or newline-delimited JSON on stdout. Notifications require an existing native local-session socket; the CLI never launches or resumes a session.";
  static examples = [
    "<%= config.bin %> listen",
    '<%= config.bin %> listen --subscription my-agent --exec "python3 accept.py"',
    "<%= config.bin %> listen --forward-to localhost:3000",
    "<%= config.bin %> listen --once --timeout 60",
    "<%= config.bin %> listen --notify-session 11111111-1111-4111-8111-111111111111 --sender person@example.com",
    "<%= config.bin %> listen --notify-session 11111111-1111-4111-8111-111111111111 --contacts",
    "<%= config.bin %> listen --status --notify-session 11111111-1111-4111-8111-111111111111",
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
      exclusive: ["sender", "status"],
    }),
    "contact-requests": Flags.boolean({
      description:
        "Also consider one authenticated structured first-contact request per unknown sender when owner policy enables requests. No ordinary unknown mail or task authority is admitted.",
      dependsOn: ["contacts", "notify-session"],
      exclusive: ["sender", "status"],
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
        "Inspect saved notification receipts without connecting to a session or receiving events.",
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
    if (flags.status && flags["notify-session"]) {
      const requestConfig = resolveCliApiRequestConfig({
        configDir: this.config.configDir,
        apiBaseUrl: flags["api-base-url"],
      });
      const auth = resolveCliAuth({
        configDir: this.config.configDir,
        apiBaseUrl: requestConfig.apiBaseUrl,
        apiKey: flags["api-key"],
      });
      const page = notificationReceiptPage(
        this.config.configDir,
        notificationScope(auth.apiBaseUrl, auth.apiKey),
        flags["notify-session"],
        { limit: flags.limit, cursor: flags.cursor },
      );
      this.log(
        JSON.stringify(
          {
            sessionId: flags["notify-session"],
            receipts: page.receipts.map((receipt) => ({
              ...receipt,
              state: receipt.state === "submitting" ? "unknown" : receipt.state,
            })),
            nextCursor: page.nextCursor,
            guidance:
              "Accepted means queued, not read or answered. Unknown receipts are held and are never resent automatically; inspect the exact session before any manual resend.",
          },
          null,
          2,
        ),
      );
      return;
    }
    const senders =
      flags["notify-session"] && !flags.contacts
        ? notificationSenders(flags.sender ?? [])
        : undefined;
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
      await runListen({
        transport: flags.transport === "poll" ? "poll" : "websocket",
        configDir: this.config.configDir,
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
              socketPath: flags["session-socket"],
            }
          : undefined,
        handler,
        signal: controller.signal,
      });
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
