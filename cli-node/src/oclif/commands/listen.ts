import { Command, Errors, Flags } from "@oclif/core";
import { API_BASE_URL_FLAG_DESCRIPTION } from "../api-command.js";
import { createListenHandler } from "../listen-handlers.js";
import { ListenError, runListen } from "../listen-runner.js";
import { ListenStateError } from "../listen-state.js";

export default class ListenCommand extends Command {
  static summary = "Receive webhook events locally without a public endpoint";
  static description =
    "Subscribe once and reconnect using the same durable server queue. Use a short --exec hook to durably accept an event, --forward-to for a local webhook, or newline-delimited JSON on stdout.";
  static examples = [
    "<%= config.bin %> listen",
    '<%= config.bin %> listen --subscription my-agent --exec "python3 accept.py"',
    "<%= config.bin %> listen --forward-to http://127.0.0.1:3000/webhook",
  ];
  static flags = {
    subscription: Flags.string({
      description:
        "Stable subscription name. Defaults to a saved name for this account and API environment.",
    }),
    exec: Flags.string({
      description:
        "Short POSIX shell command accepting each complete event on stdin.",
      exclusive: ["forward-to"],
    }),
    "forward-to": Flags.string({
      description: "Forward each event to this HTTP(S) webhook URL.",
      exclusive: ["exec"],
    }),
    events: Flags.string({
      description:
        "Comma-separated event types. Omit when reconnecting to preserve the existing selection.",
    }),
    number: Flags.integer({
      description:
        "Exit after this many successfully handled and confirmed deliveries.",
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
    const cancel = () => controller.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    try {
      await runListen({
        configDir: this.config.configDir,
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        subscription: flags.subscription,
        events: events === undefined ? undefined : [...new Set(events)],
        number: flags.number,
        mode: flags.exec ? "exec" : flags["forward-to"] ? "http" : "stdout",
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
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    }
    if (controller.signal.aborted) process.exitCode = 130;
  }
}
