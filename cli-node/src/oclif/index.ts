import { Args, Command, Errors } from "@oclif/core";
import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";
import { createOperationCommand } from "./api-command.js";
import AgentUpgradeCommand from "./commands/agent-upgrade.js";
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
import EmailsLatestCommand from "./commands/emails-latest.js";
import EmailsWaitCommand from "./commands/emails-wait.js";
import EmailsWatchCommand from "./commands/emails-watch.js";
import FunctionsDeployCommand from "./commands/functions-deploy.js";
import FunctionsInitCommand from "./commands/functions-init.js";
import FunctionsLogsCommand from "./commands/functions-logs.js";
import FunctionsRedeployCommand from "./commands/functions-redeploy.js";
import FunctionsRouteGetCommand from "./commands/functions-route-get.js";
import FunctionsRouteSetCommand from "./commands/functions-route-set.js";
import FunctionsRouteUnsetCommand from "./commands/functions-route-unset.js";
import FunctionsRoutingTopologyCommand from "./commands/functions-routing-topology.js";
import FunctionsSetSecretCommand from "./commands/functions-set-secret.js";
import FunctionsTemplatesCommand from "./commands/functions-templates.js";
import FunctionsTestFunctionCommand from "./commands/functions-test-function.js";
import InboxSetupCommand from "./commands/inbox-setup.js";
import InboxStatusCommand from "./commands/inbox-status.js";
import LogoutCommand from "./commands/logout.js";
import OrgSecretsListCommand from "./commands/org-secrets-list.js";
import OrgSecretsRemoveCommand from "./commands/org-secrets-remove.js";
import OrgSecretsSetCommand from "./commands/org-secrets-set.js";
import ReplyCommand from "./commands/reply.js";
import SearchCommand from "./commands/search.js";
import SemanticSearchCommand from "./commands/semantic-search.js";
import SendCommand from "./commands/send.js";
import {
  LoginBrowserCommand,
  LoginCommand,
  LoginConfirmCommand,
  LoginOtpCommand,
  LoginOtpConfirmCommand,
  LoginOtpResendCommand,
  LoginResendCommand,
  OtpCommand,
  OtpConfirmCommand,
  OtpResendCommand,
  SigninBrowserCommand,
  SigninCommand,
  SigninConfirmCommand,
  SigninOtpCommand,
  SigninOtpConfirmCommand,
  SigninOtpResendCommand,
  SigninResendCommand,
} from "./commands/signin.js";
import SignupCommand, {
  SignupConfirmCommand,
  SignupInteractiveCommand,
  SignupResendCommand,
  SignupStatusCommand,
} from "./commands/signup.js";
import WhoamiCommand from "./commands/whoami.js";
import { renderFishCompletion } from "./fish-completion.js";
import { readCompletionFunction } from "./shell-completion-script.js";

class ListOperationsCommand extends Command {
  static description =
    "List all generated API operations as JSON. Useful for piping to `jq` to discover available commands, their request/response schemas, and per-field descriptions. For inspecting a single operation in detail, prefer `primitive describe <command-or-operation-name>`.";

  static summary = "List all generated API operations (JSON)";

  async run(): Promise<void> {
    this.log(JSON.stringify(operationManifest, null, 2));
  }
}

function operationId(operation: PrimitiveOperationManifest): string {
  return `${operation.tagCommand}:${operation.command}`;
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
        "Command id, alias, or SDK operation name to describe, e.g. `emails:list`, `emails:get-email`, or `getEmail`. Run `primitive list-operations | jq -r '.[] | \"\\(.tagCommand):\\(.command) \\(.operationId)\"'` to enumerate generated operation ids.",
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
    `Output a sourceable shell completion script, or print setup instructions.

  For fish, and for bash/zsh when the output is piped or redirected (e.g. into a
  completion file under bash_completion.d or zsh's site-functions), this emits
  the raw completion script. For bash/zsh in an interactive terminal it prints
  the human-readable setup instructions instead. This keeps a redirected
  \`${"<%= config.bin %>"} completion bash > <file>\` safe to source -- the file holds an
  actual completion function, never instructional prose a shell would choke on.`;

  static summary =
    "Output a shell completion script or print setup instructions";

  static examples = [
    "<%= config.bin %> completion bash >> /etc/bash_completion.d/primitive",
    "<%= config.bin %> completion zsh > /usr/local/share/zsh/site-functions/_primitive",
    "<%= config.bin %> completion fish > ~/.config/fish/completions/primitive.fish",
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(CompletionCommand);
    const shell = args.shell;

    if (shell === "fish") {
      this.log(renderFishCompletion(this.config.bin));
      return;
    }

    // When stdout is not an interactive terminal the caller is capturing the
    // output -- a redirect into a completion file, or a package manager
    // generating one. In that case emit the raw sourceable completion
    // *function* rather than `autocomplete`'s human-readable setup
    // instructions, which a shell would otherwise try to execute line by line
    // (the cause of `bash: Setup: command not found` style errors when the
    // instructions land in bash_completion.d).
    if ((shell === "bash" || shell === "zsh") && !process.stdout.isTTY) {
      // `--refresh-cache` rebuilds the cached completion function for the
      // current command set without printing the instructions.
      await this.config.runCommand("autocomplete", [shell, "--refresh-cache"]);
      this.log(
        readCompletionFunction(this.config.cacheDir, this.config.bin, shell),
      );
      return;
    }

    await this.config.runCommand("autocomplete", [args.shell]);
  }
}

export const CANONICAL_OPERATION_ALIASES: Record<string, string> = {
  "account:show": "account:get-account",
  "account:storage": "account:get-storage-stats",
  "account:webhook-secret": "account:get-webhook-secret",
  "agent:claim": "agent:start-agent-claim",
  "agent:claim-link": "agent:create-agent-claim-link",
  "agent:claim-verify": "agent:verify-agent-claim",
  "agent:create": "agent:create-agent-account",
  "deliveries:list": "webhook-deliveries:list-deliveries",
  "deliveries:replay": "webhook-deliveries:replay-delivery",
  "domains:add": "domains:add-domain",
  "domains:delete": "domains:delete-domain",
  "domains:list": "domains:list-domains",
  "domains:update": "domains:update-domain",
  "domains:verify": "domains:verify-domain",
  "emails:conversation": "emails:get-conversation",
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
  "sending:get": "sending:get-sent-email",
  "sending:list": "sending:list-sent-emails",
  "sending:permissions": "sending:get-send-permissions",
  "sending:reply": "sending:reply-to-email",
  "sending:send": "sending:send-email",
  "sent:get": "sending:get-sent-email",
  "sent:list": "sending:list-sent-emails",
  "threads:get": "threads:get-thread",
  "webhook-deliveries:list": "webhook-deliveries:list-deliveries",
  "webhook-deliveries:replay": "webhook-deliveries:replay-delivery",
};

const DESCRIBE_OPERATION_ALIASES: Record<string, string> = {
  ...CANONICAL_OPERATION_ALIASES,
  "domains:zone-file": "domains:download-domain-zone-file",
  "functions:logs": "functions:list-function-logs",
  reply: "sending:reply-to-email",
};

function resolveOperationAlias(id: string): string {
  return DESCRIBE_OPERATION_ALIASES[id] ?? id;
}

// Operation ids whose surface is owned by a hand-rolled command in
// COMMANDS below. The auto-generated wrapper is filtered out so the
// hand-rolled command owns the id without a name collision.
const OVERRIDDEN_OPERATION_IDS = new Set<string>([
  // `domains:download-domain-zone-file` is hand-rolled so the CLI writes
  // text to stdout or --output instead of dumping a generated binary object.
  "domains:download-domain-zone-file",
  // `functions:test-function` is hand-rolled to add --wait, --show-sends,
  // and --timeout flags on top of the auto-generated POST /functions/{id}/test.
  "functions:test-function",
  // `inbox:get-inbox-status` is hand-rolled so the CLI defaults to a
  // compact readiness summary instead of dumping a large JSON object.
  "inbox:get-inbox-status",
  // `search:semantic-search` is folded into the root `semantic-search`
  // command (which takes a positional query) so users do not have to
  // discover the topic-nested form. The manual COMMANDS entry below
  // keeps the topic-nested id callable for back-compat scripts.
  "search:semantic-search",
]);

const generatedCommands = Object.fromEntries(
  operationManifest
    .filter(
      (operation) => !OVERRIDDEN_OPERATION_IDS.has(operationId(operation)),
    )
    .map((operation) => [
      operationId(operation),
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
  // Interactive one-command upgrade (start claim -> prompt for code -> verify),
  // on top of the generated agent:claim / agent:claim-verify operations.
  "agent:upgrade": AgentUpgradeCommand,
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
  // `send` is the agent-grade shortcut for sending:send-email with
  // sensible defaults (auto from-address, auto subject). The full
  // operation stays available under sending:send-email for callers
  // who want every flag.
  send: SendCommand,
  // `reply` is the top-level counterpart to `send` for the common
  // stored-inbound reply flow. The generated operation remains
  // available as sending:reply-to-email for full API parity.
  reply: ReplyCommand,
  // `chat` is the first-party verb for agent-to-agent communication
  // over email. `send` is transport (fire-and-forget); `chat` is
  // semantic (send + wait for the threaded reply, then print the
  // body). Positioned as the canonical verb for the
  // agents-behind-email-addresses paradigm.
  chat: ChatCommand,
  "chat:reply": ChatReplyCommand,
  // `login` and `signin` are intentionally interchangeable public
  // auth surfaces. With no args they use browser approval; with an
  // email address they start the email-code flow. `otp` is the
  // terse first-party email-code auth alias.
  login: LoginCommand,
  "login:browser": LoginBrowserCommand,
  "login:confirm": LoginConfirmCommand,
  "login:otp": LoginOtpCommand,
  "login:otp:confirm": LoginOtpConfirmCommand,
  "login:otp:resend": LoginOtpResendCommand,
  "login:resend": LoginResendCommand,
  otp: OtpCommand,
  "otp:confirm": OtpConfirmCommand,
  "otp:resend": OtpResendCommand,
  // `signin` mirrors `login` for users who think in sign-in terms.
  // The OTP subcommands remain for compatibility with the earlier
  // explicit naming.
  signin: SigninCommand,
  "signin:browser": SigninBrowserCommand,
  "signin:confirm": SigninConfirmCommand,
  "signin:otp": SigninOtpCommand,
  "signin:otp:confirm": SigninOtpConfirmCommand,
  "signin:otp:resend": SigninOtpResendCommand,
  "signin:resend": SigninResendCommand,
  // `signup` starts account signup. Subcommands confirm, resend, or run the
  // whole flow in one interactive session.
  signup: SignupCommand,
  "signup:confirm": SignupConfirmCommand,
  "signup:interactive": SignupInteractiveCommand,
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
  // `emails:latest` is the inbox-triage shortcut: the most recent N
  // inbound emails as a compact text table. emails:list-emails stays
  // available for the full JSON envelope + cursor pagination.
  "emails:latest": EmailsLatestCommand,
  // `emails:watch` and `emails:wait` poll the search API for new matching
  // inbound mail. `watch` defaults to a human table; `wait` defaults to JSONL.
  "emails:watch": EmailsWatchCommand,
  "emails:wait": EmailsWaitCommand,
  // `search` is the canonical top-level search verb. Defaults to
  // lexical full-text against inbound mail (positional query becomes
  // `q=<query>` against /v1/emails/search, which already matches every
  // indexed field). `--mode` switches dispatch to the cross-corpus
  // semantic backend.
  search: SearchCommand,
  // `semantic-search` is the top-level search verb for meaning-aware
  // cross-corpus mail search. The generated operation remains available
  // under its manifest id for full API parity.
  "semantic-search": SemanticSearchCommand,
  // `search:semantic-search` is the old topic-nested form kept callable
  // so back-compat scripts that learned it from earlier help text do
  // not break. New surface is `prim search --mode <mode>` or the root
  // `prim semantic-search`.
  "search:semantic-search": SemanticSearchCommand,
  // `domains:zone-file` downloads the server-generated DNS import file.
  // The API owns serialization so dashboard and CLI output stay aligned.
  "domains:zone-file": DomainsZoneFileCommand,
  "domains:download-domain-zone-file": DomainsZoneFileCommand,
  // `inbox:status` is the guided readiness view for inbound setup. It folds
  // domain verification, endpoint/function processing, and recent mail into
  // the server-owned status API instead of making agents compose those lists.
  "inbox:setup": InboxSetupCommand,
  "inbox:status": InboxStatusCommand,
  "inbox:get-inbox-status": InboxStatusCommand,
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
  // Org-level ("global") secrets, shared across every function. Hand-rolled
  // with raw fetch because /v1/org/secrets is not on the generated client yet.
  "org:secrets:list": OrgSecretsListCommand,
  "org:secrets:set": OrgSecretsSetCommand,
  "org:secrets:remove": OrgSecretsRemoveCommand,
  // `functions:test-function` is hand-rolled to add --wait, --show-sends,
  // and --timeout on top of POST /functions/{id}/test. Without those
  // flags, agents had to manually thread queued-send + emails:wait +
  // emails:get-email + sending:list-sent-emails to verify a function
  // ran and see what it emitted; AGX walkthroughs flagged that loop as
  // the single biggest verification time-sink.
  "functions:test": FunctionsTestFunctionCommand,
  "functions:test-function": FunctionsTestFunctionCommand,
  // `functions:route-*` and `functions:routing-topology` wrap the
  // route-binding operations (`PUT/DELETE/GET /functions/:id/route` and
  // `GET /functions/routing-topology`). Without these, deploy and test
  // hints that point users at `route-set` would dead-end at
  // command-not-found.
  "functions:route-set": FunctionsRouteSetCommand,
  "functions:route-unset": FunctionsRouteUnsetCommand,
  "functions:route-get": FunctionsRouteGetCommand,
  "functions:routing-topology": FunctionsRoutingTopologyCommand,
  ...generatedCommandAliases,
  ...generatedCommands,
  // `functions:logs` is the human/agent-friendly log viewer: compact
  // text by default, --jsonl for streaming tools, and --follow for
  // tailing. The raw generated functions:list-function-logs operation
  // remains available for callers that want the full page envelope.
  "functions:logs": FunctionsLogsCommand,
};
