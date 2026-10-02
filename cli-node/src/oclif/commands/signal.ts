import { Args, Command, Flags } from "@oclif/core";
import { haltAutoWorking, restoreAutoWorking } from "../auto-signals.js";
import {
  type SignalKind,
  type SignalStatus,
  sendSignal,
} from "../signal-command.js";
import {
  contactCommandContext,
  reportContactCommand,
} from "./contact-request-shared.js";
import { contactFlags } from "./contacts-shared.js";

export default class SignalCommand extends Command {
  static summary = "Send an explicit read, acknowledgement, or activity signal";
  static description =
    "Send ordinary email signaling in response to one authenticated plain email. Requires PRIMITIVE_AGENT_PROFILE; the saved identity pins the sender. This command never grants task authority. Separately, connected receivers report read automatically for verified owner and same-organization mail they surface, and emails get --brief reports working until you answer; set PRIMITIVE_NO_AUTO_SIGNALS=1 to turn that off. Signal and interaction parents are refused to prevent reply loops. Read and ack deduplicate per parent, kind and ack status. Working/typing default to 30 seconds (typing maximum 30, working maximum 60): repeated calls while unexpired deduplicate; a new explicit invocation after a known outcome expires may send fresh activity. Unknown outcomes must reconcile before renewal and are never blindly resent. An expired unsent intent is reported without replay. JSON outcomes: sent/already_sent/expired exit 0; not_sent exit 1; uncertain exit 4.";
  static args = {
    kind: Args.string({
      required: true,
      options: ["read", "ack", "working", "typing"],
      description: "Communication state to report",
    }),
  };
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> signal read --id <email-id> --json",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> signal ack --id <email-id> --status received --json",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> signal working --id <email-id> --expires-in 30 --json",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> signal typing --id <email-id> --expires-in 30 --json",
  ];
  static flags = {
    ...contactFlags,
    id: Flags.string({
      required: true,
      description: "Exact received plain email ID",
    }),
    status: Flags.string({
      options: ["received", "will_process", "will_not_process"],
      description:
        "Required for ack only; report the action you actually intend",
    }),
    "expires-in": Flags.integer({
      min: 1,
      max: 60,
      description:
        "Validity in seconds: typing 1-30, working 1-60 (default 30); never automatically renewed",
    }),
    json: Flags.boolean({
      description: "Print the structured signal outcome (also the default)",
    }),
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(SignalCommand);
    const context = await contactCommandContext(this, flags, "Signals");
    // Declining ends automatic working for that email.
    const halted =
      args.kind === "ack" && flags.status === "will_not_process"
        ? await haltAutoWorking(
            this.config.configDir,
            { emailIds: [flags.id] },
            "will_not_process",
          )
        : null;
    const result = await sendSignal(context, {
      id: flags.id,
      kind: args.kind as SignalKind,
      status: flags.status as SignalStatus | undefined,
      expiresIn: flags["expires-in"],
    });
    // A refused decline reached nobody, so the sender still sees working.
    if (halted && result.data.outcome === "not_sent")
      restoreAutoWorking(halted);
    reportContactCommand(this, result);
  }
}
