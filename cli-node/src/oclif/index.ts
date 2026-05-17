import { Args, Command, Errors } from "@oclif/core";
import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";
import { createOperationCommand } from "./api-command.js";
import DoctorCommand from "./commands/doctor.js";
import EmailsLatestCommand from "./commands/emails-latest.js";
import EmailsWaitCommand from "./commands/emails-wait.js";
import EmailsWatchCommand from "./commands/emails-watch.js";
import FunctionsDeployCommand from "./commands/functions-deploy.js";
import FunctionsInitCommand from "./commands/functions-init.js";
import FunctionsRedeployCommand from "./commands/functions-redeploy.js";
import FunctionsSetSecretCommand from "./commands/functions-set-secret.js";
import FunctionsTestFunctionCommand from "./commands/functions-test-function.js";
import LoginCommand from "./commands/login.js";
import LogoutCommand from "./commands/logout.js";
import ReplyCommand from "./commands/reply.js";
import SendCommand from "./commands/send.js";
import WhoamiCommand from "./commands/whoami.js";
import { renderFishCompletion } from "./fish-completion.js";

class ListOperationsCommand extends Command {
  static description =
    "List all generated API operations as JSON. Useful for piping to `jq` to discover available commands, their request/response schemas, and per-field descriptions. For inspecting a single operation in detail, prefer `primitive describe <command>`.";

  static summary = "List all generated API operations (JSON)";

  async run(): Promise<void> {
    this.log(JSON.stringify(operationManifest, null, 2));
  }
}

// Looks up an operation manifest entry by its `<topic>:<command>` id
// (e.g. `emails:get-email`). On miss, returns up to 5 closest
// candidates by substring match so the caller can render a
// "did you mean" hint. Pure function: no oclif config dependency,
// so it's also unit-testable in isolation.
export function lookupOperation(id: string): {
  match: PrimitiveOperationManifest | null;
  candidates: string[];
} {
  const trimmed = resolveOperationAlias(id.trim());
  const sep = trimmed.indexOf(":");
  const tag = sep === -1 ? "" : trimmed.slice(0, sep);
  const cmd = sep === -1 ? trimmed : trimmed.slice(sep + 1);

  const match =
    operationManifest.find(
      (op) => op.command === cmd && op.tagCommand === tag,
    ) ?? null;

  if (match) return { match, candidates: [] };

  const candidates = operationManifest
    .filter((op) => op.command.includes(cmd) || op.tagCommand.includes(tag))
    .slice(0, 5)
    .map((op) =>
      op.tagCommand ? `${op.tagCommand}:${op.command}` : op.command,
    );

  return { match: null, candidates };
}

// `primitive describe <command>` is the operation-detail inspector
// the AGX walkthrough kept wanting. The information is already in
// the operation manifest emitted by `list-operations`, but agents
// don't intuitively reach for `list-operations | jq '.[] | select(...)'`
// when they want to know "what does the from_email field on this
// response actually mean." A direct command is more discoverable.
//
// Lookup is by command id. Canonical aliases such as `emails:list`
// resolve to their generated operation entries; raw generated ids
// like `emails:get-email` continue to work.
class DescribeCommand extends Command {
  static args = {
    command: Args.string({
      description:
        "Command id to describe, e.g. `emails:list` or `emails:get-email`. Run `primitive list-operations | jq -r '.[] | \"\\(.tagCommand):\\(.command)\"'` to enumerate generated operation ids.",
      required: true,
    }),
  };

  static description =
    `Print the full operation manifest entry for a single API command, including the path, request schema, response schema, and per-field descriptions sourced from the OpenAPI spec.

  The manifest entry's \`responseSchema\` carries the inlined JSON Schema for the operation's 200/201 \`data\` envelope contents (\`$ref\`s resolved). Use it to look up what specific response fields mean. Examples:

      # Which of EmailDetail's sender-shaped fields is canonical?
      primitive describe emails:get | jq '.responseSchema.properties | keys'
      primitive describe emails:get | jq -r '.responseSchema.properties.from_email.description'

      # What does each value of SentEmailStatus mean?
      primitive describe sent:get | jq -r '.responseSchema.properties.status.description'

  \`requestSchema\` is the same shape for the request body when one exists. For a single field across many operations at once, use \`primitive list-operations | jq\` instead.`;

  static summary = "Describe a single API operation in detail";

  static examples = [
    "<%= config.bin %> describe emails:get",
    "<%= config.bin %> describe sent:get",
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(DescribeCommand);
    const { match, candidates } = lookupOperation(args.command);

    if (!match) {
      const hint =
        candidates.length > 0
          ? `Did you mean: ${candidates.join(", ")}?`
          : "Run `primitive list-operations` to enumerate.";

      throw new Errors.CLIError(
        `Unknown operation \`${args.command.trim()}\`. ${hint}`,
        { exit: 1 },
      );
    }

    this.log(JSON.stringify(match, null, 2));
  }
}

class CompletionCommand extends Command {
  static args = {
    shell: Args.string({
      description: "Shell type",
      options: ["bash", "zsh", "powershell", "fish"],
      required: true,
    }),
  };

  static description =
    "Show shell completion output or installation instructions for supported shells";

  static summary = "Show shell completion output or installation instructions";

  async run(): Promise<void> {
    const { args } = await this.parse(CompletionCommand);

    if (args.shell === "fish") {
      this.log(renderFishCompletion(this.config.bin));
      return;
    }

    await this.config.runCommand("autocomplete", [args.shell]);
  }
}

function commandId(operation: PrimitiveOperationManifest): string {
  return `${operation.tagCommand}:${operation.command}`;
}

export const CANONICAL_OPERATION_ALIASES: Record<string, string> = {
  "account:show": "account:get-account",
  "account:storage": "account:get-storage-stats",
  "account:webhook-secret": "account:get-webhook-secret",
  "deliveries:list": "webhook-deliveries:list-deliveries",
  "deliveries:replay": "webhook-deliveries:replay-delivery",
  "domains:add": "domains:add-domain",
  "domains:delete": "domains:delete-domain",
  "domains:list": "domains:list-domains",
  "domains:update": "domains:update-domain",
  "domains:verify": "domains:verify-domain",
  "emails:delete": "emails:delete-email",
  "emails:discard-content": "emails:discard-email-content",
  "emails:download-raw": "emails:download-raw-email",
  "emails:get": "emails:get-email",
  "emails:list": "emails:list-emails",
  "emails:replay-webhooks": "emails:replay-email-webhooks",
  "emails:search": "emails:search-emails",
  "endpoints:create": "endpoints:create-endpoint",
  "endpoints:delete": "endpoints:delete-endpoint",
  "endpoints:list": "endpoints:list-endpoints",
  "endpoints:test": "endpoints:test-endpoint",
  "endpoints:update": "endpoints:update-endpoint",
  "filters:create": "filters:create-filter",
  "filters:delete": "filters:delete-filter",
  "filters:list": "filters:list-filters",
  "filters:update": "filters:update-filter",
  "functions:delete": "functions:delete-function",
  "functions:delete-secret": "functions:delete-function-secret",
  "functions:get": "functions:get-function",
  "functions:list": "functions:list-functions",
  "functions:list-secrets": "functions:list-function-secrets",
  "functions:logs": "functions:list-function-logs",
  "sending:get": "sending:get-sent-email",
  "sending:list": "sending:list-sent-emails",
  "sending:permissions": "sending:get-send-permissions",
  "sending:reply": "sending:reply-to-email",
  "sending:send": "sending:send-email",
  "sent:get": "sending:get-sent-email",
  "sent:list": "sending:list-sent-emails",
  "webhook-deliveries:list": "webhook-deliveries:list-deliveries",
  "webhook-deliveries:replay": "webhook-deliveries:replay-delivery",
};

const DESCRIBE_OPERATION_ALIASES: Record<string, string> = {
  ...CANONICAL_OPERATION_ALIASES,
  reply: "sending:reply-to-email",
};

function resolveOperationAlias(id: string): string {
  return DESCRIBE_OPERATION_ALIASES[id] ?? id;
}

// Operation ids whose surface is owned by a hand-rolled command in
// COMMANDS below. The auto-generated wrapper is filtered out so the
// hand-rolled command owns the id without a name collision.
const OVERRIDDEN_OPERATION_IDS = new Set<string>([
  // `functions:test-function` is hand-rolled to add --wait, --show-sends,
  // and --timeout flags on top of the auto-generated POST /functions/{id}/test.
  "functions:test-function",
]);

const generatedCommands = Object.fromEntries(
  operationManifest
    .filter((operation) => !OVERRIDDEN_OPERATION_IDS.has(commandId(operation)))
    .map((operation) => [
      commandId(operation),
      createOperationCommand(operation),
    ]),
);

const generatedCommandAliases = Object.fromEntries(
  Object.entries(CANONICAL_OPERATION_ALIASES).map(([alias, target]) => {
    const command = generatedCommands[target];
    if (!command) {
      throw new Error(`Missing generated command target for alias ${alias}`);
    }
    return [alias, command];
  }),
);

export const COMMANDS: Record<string, typeof Command> = {
  completion: CompletionCommand,
  "list-operations": ListOperationsCommand,
  // `describe` prints a single operation's full manifest entry
  // (path, request schema, response schema, per-field descriptions).
  // The same data is in `list-operations` but agents don't reach for
  // `list-operations | jq` when they want to clarify a field meaning.
  describe: DescribeCommand,
  // `send` is the agent-grade shortcut for sending:send-email with
  // sensible defaults (auto from-address, auto subject). The full
  // operation stays available under sending:send-email for callers
  // who want every flag.
  send: SendCommand,
  // `reply` is the top-level counterpart to `send` for the common
  // stored-inbound reply flow. The generated operation remains
  // available as sending:reply-to-email for full API parity.
  reply: ReplyCommand,
  // `login` creates and stores an org-scoped CLI API key via browser approval.
  login: LoginCommand,
  // `logout` revokes the saved CLI API key and removes local credentials.
  logout: LogoutCommand,
  // `whoami` is the credentials smoke test. Prints the account the
  // current API key authenticates as. AGX walkthroughs kept
  // wanting this before risking a real call against a possibly-
  // bad key.
  whoami: WhoamiCommand,
  // `doctor` is the environment health check. Node version, proxy
  // env, API key resolution, /account reachability, verified-domain
  // status — every check that whoami implicitly assumes is fine.
  // AGX walkthroughs that hit ENETUNREACH from inside containers
  // had no single command to bisect "is the CLI / network / key /
  // server broken"; doctor is that command.
  doctor: DoctorCommand,
  // `emails:latest` is the inbox-triage shortcut: the most recent N
  // inbound emails as a compact text table. emails:list-emails stays
  // available for the full JSON envelope + cursor pagination.
  "emails:latest": EmailsLatestCommand,
  // `emails:watch` and `emails:wait` poll the search API for new matching
  // inbound mail. `watch` defaults to a human table; `wait` defaults to JSONL.
  "emails:watch": EmailsWatchCommand,
  "emails:wait": EmailsWaitCommand,
  // `functions:init` scaffolds a deployable Function project so a
  // new author can go zero-to-deployed without writing the handler,
  // package.json, build script, and tsconfig from scratch. The
  // scaffolded handler imports from @primitivedotdev/sdk/api (the
  // runtime-client subpath) and demonstrates client.send() so the
  // first thing the author sees is the SDK pattern, not raw fetch.
  "functions:init": FunctionsInitCommand,
  // `functions:deploy` and `functions:redeploy` are file-input
  // shortcuts for create-function / update-function. The underlying
  // ops take `code` as a body string, which is awkward at the CLI
  // for multi-line bundles; these read the bundle off disk and pass
  // it through. The auto-generated functions:* operations stay
  // available for callers that want the full surface.
  "functions:deploy": FunctionsDeployCommand,
  "functions:redeploy": FunctionsRedeployCommand,
  // `functions:set-secret` is the one-call shortcut for "write a
  // secret AND (optionally) push it live." The raw
  // functions:set-function-secret / functions:create-function-secret
  // operations only do the secret upsert; making the new value
  // visible to the running handler requires a separate redeploy,
  // which this shortcut folds in via --redeploy.
  "functions:set-secret": FunctionsSetSecretCommand,
  // `functions:test-function` is hand-rolled to add --wait, --show-sends,
  // and --timeout on top of POST /functions/{id}/test. Without those
  // flags, agents had to manually thread queued-send + emails:wait +
  // emails:get-email + sending:list-sent-emails to verify a function
  // ran and see what it emitted; AGX walkthroughs flagged that loop as
  // the single biggest verification time-sink.
  "functions:test": FunctionsTestFunctionCommand,
  "functions:test-function": FunctionsTestFunctionCommand,
  ...generatedCommandAliases,
  ...generatedCommands,
};
