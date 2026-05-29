import { Args, Command, Errors } from "@oclif/core";
import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";
import { createOperationCommand } from "./api-command.js";
import {
  CANONICAL_OPERATION_COMMANDS,
  isPublicGeneratedOperation,
  operationId,
  publicOperationCommandId,
} from "./command-surface.js";
import ChatCommand, { ChatReplyCommand } from "./commands/chat.js";
import {
  ConfigCommand,
  ConfigListCommand,
  ConfigResetCommand,
  ConfigSetCommand,
  ConfigUseCommand,
} from "./commands/config.js";
import DoctorCommand from "./commands/doctor.js";
import DomainsZoneFileCommand from "./commands/domains-zone-file.js";
import EmailsWaitCommand from "./commands/emails-wait.js";
import EmailsWatchCommand from "./commands/emails-watch.js";
import FunctionsDeployCommand from "./commands/functions-deploy.js";
import FunctionsInitCommand from "./commands/functions-init.js";
import FunctionsLogsCommand from "./commands/functions-logs.js";
import FunctionsRedeployCommand from "./commands/functions-redeploy.js";
import FunctionsSetSecretCommand from "./commands/functions-set-secret.js";
import FunctionsTemplatesCommand from "./commands/functions-templates.js";
import FunctionsTestFunctionCommand from "./commands/functions-test-function.js";
import InboxSetupCommand from "./commands/inbox-setup.js";
import InboxStatusCommand from "./commands/inbox-status.js";
import LogoutCommand from "./commands/logout.js";
import ReplyCommand from "./commands/reply.js";
import SemanticSearchCommand from "./commands/semantic-search.js";
import SendCommand from "./commands/send.js";
import {
  LoginBrowserCommand,
  LoginCommand,
  LoginConfirmCommand,
  LoginResendCommand,
} from "./commands/signin.js";
import SignupCommand, {
  SignupConfirmCommand,
  SignupResendCommand,
  SignupStatusCommand,
} from "./commands/signup.js";
import WhoamiCommand from "./commands/whoami.js";
import { renderFishCompletion } from "./fish-completion.js";

export { CANONICAL_OPERATION_COMMANDS } from "./command-surface.js";

class ListOperationsCommand extends Command {
  static description =
    "List public generated API operations as JSON. Useful for piping to `jq` to discover available commands, their request/response schemas, and per-field descriptions. For inspecting a single operation in detail, prefer `primitive describe <command-or-operation-name>`.";

  static summary = "List public generated API operations (JSON)";

  async run(): Promise<void> {
    this.log(JSON.stringify(publicOperationEntries(), null, 2));
  }
}

export function publicOperationEntries(): Array<
  PrimitiveOperationManifest & { cliCommandId: string }
> {
  return operationManifest
    .filter(isPublicGeneratedOperation)
    .map((operation) => {
      const cliCommandId = publicOperationCommandId(operation);
      const separator = cliCommandId.indexOf(":");
      const tagCommand =
        separator === -1
          ? operation.tagCommand
          : cliCommandId.slice(0, separator);
      const command =
        separator === -1 ? cliCommandId : cliCommandId.slice(separator + 1);

      return {
        ...operation,
        cliCommandId,
        command,
        tagCommand,
      };
    });
}

function normalizeLookupToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function operationLookupTokens(
  operation: PrimitiveOperationManifest,
): string[] {
  return unique([
    operationId(operation),
    operation.command,
    operation.operationId,
    operation.sdkName,
    `${operation.tagCommand}:${operation.operationId}`,
    `${operation.tagCommand}:${operation.sdkName}`,
  ]);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

function scoreLookupToken(query: string, token: string): number {
  const normalizedQuery = normalizeLookupToken(query);
  const normalizedToken = normalizeLookupToken(token);
  if (!normalizedQuery || !normalizedToken) return 0;
  if (normalizedQuery === normalizedToken) return 100;
  if (normalizedToken.includes(normalizedQuery)) {
    return Math.max(50, 90 - (normalizedToken.length - normalizedQuery.length));
  }
  if (normalizedQuery.includes(normalizedToken)) {
    return Math.max(45, 80 - (normalizedQuery.length - normalizedToken.length));
  }

  const distance = levenshteinDistance(normalizedQuery, normalizedToken);
  const maxLength = Math.max(normalizedQuery.length, normalizedToken.length);
  return Math.round((1 - distance / maxLength) * 75);
}

function scoreOperation(
  query: string,
  operation: PrimitiveOperationManifest,
): number {
  return Math.max(
    ...operationLookupTokens(operation).map((token) =>
      scoreLookupToken(query, token),
    ),
  );
}

// Looks up an operation manifest entry by CLI command id
// (`emails:get-email`), canonical alias (`emails:get`), generated
// SDK operation name (`getEmail`), or tagged operation name
// (`emails:getEmail`). On miss, returns up to 5 closest command ids
// so the caller can render a useful "did you mean" hint. Pure
// function: no oclif config dependency, so it's also unit-testable.
export function lookupOperation(id: string): {
  match: PrimitiveOperationManifest | null;
  candidates: string[];
} {
  const trimmed = resolveOperationAlias(id.trim());

  const match =
    operationManifest.find((op) =>
      operationLookupTokens(op).some(
        (token) =>
          token === trimmed ||
          normalizeLookupToken(token) === normalizeLookupToken(trimmed),
      ),
    ) ?? null;

  if (match) return { match, candidates: [] };

  const candidates = operationManifest
    .map((op) => ({ id: operationId(op), score: scoreOperation(trimmed, op) }))
    .filter(({ score }) => score >= 45)
    .sort(
      (left, right) =>
        right.score - left.score || left.id.localeCompare(right.id),
    )
    .slice(0, 5)
    .map(({ id }) => id);

  return { match: null, candidates };
}

// `primitive describe <command>` is the operation-detail inspector
// the AGX walkthrough kept wanting. The information is already in
// the operation manifest emitted by `list-operations`, but agents
// don't intuitively reach for `list-operations | jq '.[] | select(...)'`
// when they want to know "what does the from_email field on this
// response actually mean." A direct command is more discoverable.
//
// Lookup is by command id or generated operation name. Canonical
// aliases such as `emails:list` resolve to their generated operation
// entries; raw generated ids like `emails:get-email` and API-shaped
// names like `getEmail` continue to work.
class DescribeCommand extends Command {
  static args = {
    command: Args.string({
      description:
        "Command id, alias, or SDK operation name to describe, e.g. `emails:list`, `emails:get-email`, or `getEmail`. Run `primitive list-operations | jq -r '.[] | \"\\(.cliCommandId) \\(.operationId)\"'` to enumerate public generated operation ids.",
      required: true,
    }),
  };

  static description =
    `Print the full operation manifest entry for a single API command, including the path, request schema, response schema, and per-field descriptions sourced from the OpenAPI spec.

  The manifest entry's \`responseSchema\` carries the inlined JSON Schema for the operation's 200/201 \`data\` envelope contents (\`$ref\`s resolved). Use it to look up what specific response fields mean. Examples:

      # Domain setup records returned by add/verify
      primitive describe domains:add
      primitive describe addDomain

      # Which of EmailDetail's sender-shaped fields is canonical?
      primitive describe emails:get | jq '.responseSchema.properties | keys'
      primitive describe emails:get | jq -r '.responseSchema.properties.from_email.description'

      # What does each value of SentEmailStatus mean?
      primitive describe sent:get | jq -r '.responseSchema.properties.status.description'

  \`requestSchema\` is the same shape for the request body when one exists. For a single field across many operations at once, use \`primitive list-operations | jq\` instead.`;

  static summary = "Describe a single API operation in detail";

  static examples = [
    "<%= config.bin %> describe addDomain",
    "<%= config.bin %> describe domains:add",
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

const DESCRIBE_OPERATION_ALIASES: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(CANONICAL_OPERATION_COMMANDS).map(([operation, command]) => [
      command,
      operation,
    ]),
  ),
  "domains:zone-file": "domains:download-domain-zone-file",
  "functions:deploy": "functions:create-function",
  "functions:logs": "functions:list-function-logs",
  "functions:redeploy": "functions:update-function",
  "functions:set-secret": "functions:set-function-secret",
  "functions:test": "functions:test-function",
  "inbox:status": "inbox:get-inbox-status",
  reply: "sending:reply-to-email",
  search: "search:semantic-search",
  send: "sending:send-email",
};

function resolveOperationAlias(id: string): string {
  return DESCRIBE_OPERATION_ALIASES[id] ?? id;
}

const generatedCommands = Object.fromEntries(
  operationManifest
    .filter(isPublicGeneratedOperation)
    .map((operation) => [
      publicOperationCommandId(operation),
      createOperationCommand(operation),
    ]),
);

export const COMMANDS: Record<string, typeof Command> = {
  completion: CompletionCommand,
  "list-operations": ListOperationsCommand,
  config: ConfigCommand,
  "config:list": ConfigListCommand,
  "config:reset": ConfigResetCommand,
  "config:set": ConfigSetCommand,
  "config:use": ConfigUseCommand,
  // `describe` prints a single operation's full manifest entry
  // (path, request schema, response schema, per-field descriptions).
  // The same data is in `list-operations` but agents don't reach for
  // `list-operations | jq` when they want to clarify a field meaning.
  describe: DescribeCommand,
  // `send` is the canonical send-email command with sensible defaults
  // (auto from-address, auto subject) plus --raw-body for advanced fields.
  send: SendCommand,
  // `reply` is the top-level counterpart to `send` for the common
  // stored-inbound reply flow with --raw-body for advanced fields.
  reply: ReplyCommand,
  // `chat` is the first-party verb for agent-to-agent communication
  // over email. `send` is transport (fire-and-forget); `chat` is
  // semantic (send + wait for the threaded reply, then print the
  // body). Positioned as the canonical verb for the
  // agents-behind-email-addresses paradigm.
  chat: ChatCommand,
  "chat:reply": ChatReplyCommand,
  // Existing-account auth. With no args, login uses browser approval;
  // with an email address, it starts the email-code flow backed by the
  // agent signup API. `signup` owns new-account creation.
  login: LoginCommand,
  "login:browser": LoginBrowserCommand,
  "login:confirm": LoginConfirmCommand,
  "login:resend": LoginResendCommand,
  // `signup` starts account signup. Subcommands confirm, resend, or inspect
  // the pending local signup state.
  signup: SignupCommand,
  "signup:confirm": SignupConfirmCommand,
  "signup:resend": SignupResendCommand,
  "signup:status": SignupStatusCommand,
  // `logout` revokes the saved OAuth grant and removes local credentials.
  logout: LogoutCommand,
  // `whoami` is the credentials smoke test. Prints the account the
  // current OAuth session or explicit API key authenticates as. AGX
  // walkthroughs kept wanting this before risking a real call against
  // possibly-bad auth.
  whoami: WhoamiCommand,
  // `doctor` is the environment health check. Node version, proxy
  // env, auth resolution, /account reachability, verified-domain
  // status; every check that whoami implicitly assumes is fine.
  // AGX walkthroughs that hit ENETUNREACH from inside containers
  // had no single command to bisect "is the CLI / network / key /
  // server broken"; doctor is that command.
  doctor: DoctorCommand,
  // `emails:watch` and `emails:wait` poll the search API for new matching
  // inbound mail. `watch` defaults to a human table; `wait` defaults to JSONL.
  "emails:watch": EmailsWatchCommand,
  "emails:wait": EmailsWaitCommand,
  // `search` is the top-level verb for meaning-aware cross-corpus mail search.
  search: SemanticSearchCommand,
  // `domains:zone-file` downloads the server-generated DNS import file.
  // The API owns serialization so dashboard and CLI output stay aligned.
  "domains:zone-file": DomainsZoneFileCommand,
  // `inbox:status` is the guided readiness view for inbound setup. It folds
  // domain verification, endpoint/function processing, and recent mail into
  // the server-owned status API instead of making agents compose those lists.
  "inbox:setup": InboxSetupCommand,
  "inbox:status": InboxStatusCommand,
  // `functions:init` scaffolds a deployable Function project so a
  // new author can go zero-to-deployed without writing the handler,
  // package.json, build script, and tsconfig from scratch. The
  // scaffolded handler imports from @primitivedotdev/sdk/api (the
  // runtime-client subpath) and demonstrates client.reply() so the
  // first thing the author sees is the SDK pattern, not raw fetch.
  "functions:init": FunctionsInitCommand,
  // `functions:templates` is the local template catalog behind
  // functions:init. It gives humans a table and agents stable JSON
  // metadata before we have any remote template-search service.
  "functions:templates": FunctionsTemplatesCommand,
  // `functions:deploy` and `functions:redeploy` are file-input
  // commands for create-function / update-function. The underlying
  // ops take `code` as a body string, which is awkward at the CLI
  // for multi-line bundles; these read the bundle off disk and pass
  // it through.
  "functions:deploy": FunctionsDeployCommand,
  "functions:redeploy": FunctionsRedeployCommand,
  // `functions:set-secret` is the one-call shortcut for "write a
  // secret AND (optionally) push it live." The raw
  // functions:set-function-secret / functions:create-function-secret
  // operations only do the secret upsert; making the new value
  // visible to the running handler requires a separate redeploy,
  // which this shortcut folds in via --redeploy.
  "functions:set-secret": FunctionsSetSecretCommand,
  // `functions:test` is hand-rolled to add --wait, --show-sends,
  // and --timeout on top of POST /functions/{id}/test. Without those
  // flags, agents had to manually thread queued-send + emails:wait +
  // emails:get-email + sending:list-sent-emails to verify a function
  // ran and see what it emitted; AGX walkthroughs flagged that loop as
  // the single biggest verification time-sink.
  "functions:test": FunctionsTestFunctionCommand,
  ...generatedCommands,
  // `functions:logs` is the human/agent-friendly log viewer: compact
  // text by default, --jsonl for streaming tools, and --follow for
  // tailing.
  "functions:logs": FunctionsLogsCommand,
};
