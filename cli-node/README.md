# primitive

Official Primitive CLI. Deploy Primitive Functions, send and inspect mail, manage endpoints, all from the terminal.

```bash
brew install primitivedotdev/tap/primitive
primitive whoami
```

Or with npm:

```bash
npm install -g primitive
primitive whoami
# `prim` is installed as a short alias for the same CLI.
prim whoami
```

The same CLI is also published as [`primcli`](https://www.npmjs.com/package/primcli) and under the legacy scoped name [`@primitivedotdev/cli`](https://www.npmjs.com/package/@primitivedotdev/cli). Each installs an identical build with the same `primitive`/`prim` commands. Use whichever name you prefer; they track the same version.

Or with no install:

```bash
npx primitive@latest <command>
```

This package wraps the [@primitivedotdev/sdk](https://www.npmjs.com/package/@primitivedotdev/sdk) runtime client with one-shot commands. For in-handler use (calling Primitive from inside a Function), import `createPrimitiveClient` from `@primitivedotdev/sdk/api` directly; the CLI is for operator and deploy workflows.

## Quickstart

### Receive webhook events without a public endpoint

With an existing Primitive account and inbox, sign in or set `PRIMITIVE_API_KEY`.
Run `primitive listen` to print existing webhook events as JSONL.
`--json` is accepted explicitly; status remains JSON and stdout events remain JSONL. Status goes to
stderr. No public URL or separate destination setup is required.

For an agent, use a short hook that saves each event into its durable inbox:

```sh
primitive listen init --language python
cd primitive-listener
primitive listen --subscription my-agent --exec 'python3 accept_event.py'
```

The starter works locally and refuses to overwrite an existing directory. Its
SQLite inbox is application-owned example code. Replace `accept_event` with your
agent's existing durable input function. Exit 0 means the input was saved; run
model work separately so the listener can keep receiving while the agent thinks.
The hook has a 30-second deadline. Do not spawn a background agent from the hook.
`--exec` requires macOS or Linux for process-group cleanup. On Windows, use
`--forward-to` with your agent's local HTTP acceptance handler.

The CLI passes the unchanged event body on stdin, plus `PRIMITIVE_EVENT_ID`,
`PRIMITIVE_DELIVERY_ID`, and `PRIMITIVE_EVENT_TYPE` in the hook environment.
Deduplicate by `PRIMITIVE_EVENT_ID`, which stays the same on redelivery. Delivery
IDs identify individual attempts. Related events need not contain an email or a
body-level event ID. The generated processing example shows existing Python SDK
conversation and reply calls; sending requires an explicit choice.

To run an existing HTTP webhook handler locally:

```sh
primitive listen --subscription local-webhook --forward-to http://localhost:3000/webhook
```

This mode forwards the exact signed body and existing webhook headers. Configure
the handler with your existing account webhook secret and normal signature
verification. The CLI never forwards your API credentials. It does not follow
redirects or disable TLS verification. A response must finish within 30 seconds
and remain within 1 MiB. Existing confirmation headers retain their meaning,
including account content-discard behavior; exec and stdout do not confirm
content discard.

Use `--events email.received,interaction.ack.received` to select events on a new
subscription. Omitting `--events` when resuming preserves its selection. A
conflicting selection requires a different subscription name. Ctrl-C disconnects
without deleting the destination; restart with the same name to receive pending
events. On the same machine, a second listener cannot consume that subscription
while the first holds it. The same name on different machines shares consumption;
different names receive independent copies. With no name, the CLI saves a private
default identity scoped to your API host and account.

`--number N` exits after N successful, server-confirmed completions. A crash after
the hook saves input but before completion can redeliver it. Bare stdout is for
inspection: a successful pipe write does not prove a downstream agent saved the
event. Use the durable hook for ingestion.

The server retains pending references for 24 hours, subject to source-content
availability and queue capacity. The listener reports delivery gaps instead of
silently claiming it is caught up. Saving download links does not preserve
attachment bytes or extend their expiry. To remove a destination, use its ID from
the readiness message: `primitive endpoints delete --id DESTINATION_ID`.

### Low-level delivery API

The generated `endpoints pull-webhook-event` and `endpoints complete-webhook-event`
commands expose the local-delivery API when enabled on your API host. These are
single API calls; a receive loop must retain the destination identity and report
each attempt's outcome. Use `--help` to inspect the request fields:

```sh
primitive endpoints pull-webhook-event --help
primitive endpoints complete-webhook-event --help
```

Completion uses a mode-specific JSON body. For a successful process handler:

```sh
primitive endpoints complete-webhook-event --id ENDPOINT_ID --raw-body '{"queue_id":"QUEUE_ID","delivery_id":"DELIVERY_ID","lease_token":"LEASE_TOKEN","mode":"exec","exit_code":0,"duration_ms":12}'
```

Use the IDs and lease token returned by pull. HTTP forwarding reports
`mode: "http"` with `status_code`; stdout reports `mode: "stdout"` with
`write_succeeded`. Transport failures must also be reported. Successful handler
acceptance is separate from any later agent reasoning.

Pull delivery preserves existing webhook bodies and supplies canonical event and
attempt IDs separately. Deduplicate by event ID. A successful completion can be
retried with the same queue, attempt, token, and outcome. Check the returned gap
count as well as the backlog; queue retention does not extend email-content
retention. Conversation retrieval and threaded replies use the existing SDK API.

```bash
primitive signin
primitive whoami
primitive functions templates
primitive functions init my-fn
cd my-fn && npm install && npm run build
primitive functions deploy --name my-fn --file ./dist/handler.js

primitive send --to alice@example.com --body "Hello!" --wait
primitive emails latest --limit 5
primitive inbox next
```

Run `primitive --help` for the full command list. Per-command help (`primitive functions deploy --help`) carries enough detail that an agent can compose any operation without leaving the terminal.

## Waiting with connected credentials

After sending, wait for the existing send's reply without sending again:

```bash
primitive emails wait --reply-to-sent-email-id <sent-id> --from peer@example.com
```

The CLI reads that sent record to derive your receiving address. Optional `--to`
must match it. The peer stays explicit because sent records do not expose a
complete recipient inventory. Connected waits include existing replies by
default, so fast replies are not missed; use `--since <timestamp>` to narrow the
window. They require an authenticated peer and the exact outbound parent.
Interaction attachments remain pending with inspection guidance. JSONL includes
matching email details, or use `--table` for compact output and `--number N` for
multiple replies. Timeout exits 1; repeat the same wait to recover without
resending. Connected waits share one local address event receiver and recover
through exact-parent search, without scanning inbox history. Additional content
filters on this command require organization credentials.

Connected `primitive chat <peer> <message> --from <own-address>` registers its
reply wait and authenticates the receiver before sending. It records an explicit
idempotency key before the request. If the send response is lost, repeating the
same command looks up that key without sending again. A timeout retains the exact
parent claim for resume. A plain reply is an email response, not proof that a task
is complete.

## Authentication

Use `primitive signin` or `primitive login` for existing accounts. With no email, both use browser approval; `primitive signin browser` and `primitive login browser` are the explicit browser forms.

Use `primitive signin <email> --signup-code <code> --accept-terms`, then `primitive signin confirm <email> <code>` for email-code sign-in. `primitive login <email>` and `primitive otp <email>` support the same email-code flow with matching `confirm` and `resend` subcommands.

Use `primitive logout --force` to remove local CLI credentials, pending email-code auth state, and stale credential locks without contacting Primitive. This is the recovery command when an interrupted auth command leaves the CLI saying another credential operation is already in progress.

Use `primitive signup <email>` for new account creation, then `primitive signup confirm <email> <code>` with the emailed verification code. Non-interactive signup is available with `--accept-terms` (pass `--signup-code <code>` too if you have one).

## Reply state and the agent loop

Every inbound email carries reply state: `awaiting` is `you` when the latest
message in its thread is inbound (it waits on your reply) and `them` when you
replied last; `reply_count` and `last_replied_at` describe replies to that one
email. A reply counts once it is sent or committed to go (queued and scheduled
count; gate-denied, agent-failed and canceled sends do not).

`primitive emails latest` shows it as the AWAITING and REPLIES columns, and
`--json` carries the fields. Filter on it with `--awaiting you|them` on
`emails latest`, `emails list`, `emails search`, `emails wait`, `emails watch`
and `search`, or with `awaiting:you` in a search query.

`primitive inbox next` returns the oldest email awaiting your reply, its
conversation (roles `user` and `assistant`; the API caps long threads and sets
`truncated` when older messages are omitted), an `automated` verdict with
reasons, and the exact `primitive reply --id <id>` command that answers it. The
loop is:

```bash
primitive inbox next --json > next.json   # exit 5: nothing awaits you
primitive reply --id "$(jq -r .email.id next.json)" --body "..."
primitive inbox next --json               # the next one
```

| Exit | Meaning |
|---|---|
| 0 | An email awaits your reply; it is printed. |
| 1 | Error, including `reply_state_unsupported` or `automated_filter_unsupported` from an older server. |
| 2 | Invalid flags or arguments. |
| 5 | Nothing awaits your reply (with `--wait`: still nothing at `--timeout`). |

- Automated mail is skipped unless you pass `--include-automated`: null envelope
  sender (bounces), mailer-daemon and postmaster, mail sent from the very address
  it was delivered to, delivery, feedback and disposition reports, and mail that
  declares itself automated (Auto-Submitted, Precedence bulk/list/junk,
  List-Unsubscribe, List-Id, X-Auto-Response-Suppress, X-Failed-Recipients).
  This is the same set Primitive's own automatic responders decline to answer.
  The API decides this
  when the mail arrives (`automated`, `automated_reasons` on every email) and
  `inbox next` filters on it server-side (`awaiting=you&automated=false`), so a
  call costs the same however much unanswered automated mail has piled up. On
  an empty result, `automated_awaiting` says how much automated mail also
  awaits. `automation_headers_known: false` means the email had no automation
  headers on record (none declared, or received before they were captured), so
  `automated: false` rests on the sender checks alone. Filter on the verdict
  yourself with `--automated true|false` on `emails list`, `emails search`,
  `emails wait` and `emails watch`, or `automated:false` in a search query.
- The `awaiting` filter covers delivered mail only: mail the server rejected
  (for example over the storage limit) was never delivered and is never
  returned as awaiting you. A server whose filter still returns rejected mail
  fails with `awaiting_rejected_unsupported`.
- `--wait [--timeout N]` blocks until something awaits you (default 300 seconds,
  0 waits forever). It reads the inbox's newest position before checking reply
  state, then long-polls from that position and re-checks on every arrival and
  at least every 30 seconds, so mail that lands between the check and the wait is
  not missed. Mail that arrives while you compose a reply is still `awaiting=you`
  on the next call, because the state lives on the server, not in a cursor.
- The email carries `from_known_address` and `auth` (SPF, DMARC) so an agent can
  weigh instructions in it; the transcript prints them and strips terminal
  control sequences from sender-supplied text.
- It is not a work queue. Nothing is claimed or locked, so two agents calling
  `inbox next` on the same inbox get the same email until one replies. Run one
  agent per inbox.
- Against a server without the `automated` filter, `inbox next` fails with
  `automated_filter_unsupported` rather than deciding automated mail itself and
  re-reading all of it on every call; `--include-automated` still works there.
- Against a server that does not report reply state, `inbox next` and every
  `--awaiting` filter fail with `reply_state_unsupported` instead of treating
  mail as unanswered.

## Command style

Use task-oriented commands for normal workflows:

```bash
primitive send --to alice@example.com --body "Hello"
primitive reply --id <inbound-email-id> --body "Thanks"
primitive reply --id <inbound-email-id> --body "See attached" --attachment ./report.pdf
primitive reply --thread <thread-id> --body "Answering the latest message"
primitive reply --id <inbound-email-id> --fyi --body "Merged. No action needed."
primitive chat reply "See attached" --attachment ./report.pdf
primitive emails list
primitive emails get --id <inbound-email-id>
primitive emails get --id <inbound-email-id> --brief
primitive sent list
primitive sent delete --id <sent-email-id>
primitive domains list
primitive functions templates
primitive functions init my-fn --template email-reply
primitive functions logs --id <function-id>
primitive memories set thread:latest '{"email_id":"em_123"}'
primitive memories get thread:latest
primitive deliveries replay --id <delivery-id>
```

Generated API commands remain available for compatibility and full schema parity, for example `primitive emails:list-emails` and `primitive sending:reply-to-email`.

## Send outcomes and exit codes

`primitive chat`, `primitive chat reply`, `primitive send` and `primitive reply`
report the same outcomes. Exit codes tell you whether a message left and whether
sending again is safe. With `--json`, stdout is an envelope for every outcome
(failures included) whose `outcome` field carries the name. The envelope always
has `sent_email_id` (null until a send record is known) and `idempotency_key`,
including when the outcome is uncertain.

| Outcome | Exit | Meaning |
|---|---|---|
| `replied` | 0 | Chat only: the message was sent and a reply arrived. |
| `sent` | 0 | Accepted for delivery. `status: "queued"` is a success, not a pending failure. |
| `already_sent` | 0 | The server recognised an identical earlier send, or refused with HTTP 410 `sent_email_deleted` because that earlier send was deleted. Nothing new went out. Do not resend. |
| `not_sent` | 1 | The API rejected the request (HTTP 400, 401, 402, 403, 404, 413, 422 or 429), the command failed before sending, or the send record has status `agent_failed`, `gate_denied` or `canceled`. Nothing went out. |
| (usage error) | 2 | Invalid flags or arguments. Nothing went out. |
| `sent_awaiting_reply` | 3 | Chat only: the message was sent but no reply arrived before `--timeout`. Wait with the printed command; do not resend. |
| `uncertain` | 4 | Transport error, conflict, server error, or a send record with status `unknown`. The message may or may not have gone out; reconcile with `primitive sent get --idempotency-key <key>` (or check `primitive sent list`) before retrying. |

A chat that times out prints `Message sent (id X). No reply yet after Ns. Do NOT
resend; wait with: <command>`, and its `--json` envelope has `"reply": null`, the
`sent` record, and `follow_up_commands` that only wait on or inspect that send.

Every send carries an idempotency key. Pass your own with `--idempotency-key`, or
let the CLI derive one from the message content, so an identical retry is still
deduplicated. If an outcome is uncertain, or you lost the output, reconcile by
key instead of resending:

```bash
primitive sent get --idempotency-key <key> --json
```

It prints the newest send with that key. When nothing matches it exits 1 with
error code `not_found`: the request did not create a send record, and retrying
with the same `--idempotency-key` is safe because the API returns the original
send instead of sending twice.

Without `--json`, `send` and `reply` keep printing the send record on stdout exactly
as before and add a one-line stderr summary such as `Reply sent (queued for
delivery, id X). Do not resend.` Before sending, `primitive reply` (and
`primitive chat --reply`) warns on stderr when the inbound email already has a reply
that went out. The warning never blocks the send; if the lookup fails, the reply is
still sent and stderr says the check was skipped. `--json` includes the replies as
`prior_replies`.

### Replying to the latest message in a thread

`primitive reply --thread <thread-id>` answers the newest inbound email in the
thread instead of a specific one, so an older message is never answered while
newer ones wait. It uses the thread's `latest_inbound_id` when the API returns
it and otherwise the newest inbound entry in the thread's message list. Without
`--json`, stderr names the email that was answered; with `--json`, the envelope
carries `reply_target: { thread_id, email_id, resolved_by }`. `--id` and
`--thread` are mutually exclusive.

### Informational replies

`primitive reply --fyi` sends a reply that needs no answer. It goes out as an
ordinary threaded reply carrying an `ack` signal (status `received`, see
[optional email signals](../docs/signal-emails.md)) whose note is the
plain-text body:

```text
Received your message.

<your body>
```

Receivers that classify signal content treat it as informational and do not
wake for it. `--fyi` takes plain text only: no HTML or attachments, at most 2000
characters, and trailing whitespace is dropped. With no body the reply is the
bare acknowledgement. It is refused when the email being answered is itself a
signal or interaction, so two agents cannot keep acknowledging each other.
`primitive send --fyi --in-reply-to <message-id>` sends the same kind of
acknowledgement for a message identified by its Message-Id.

An informational reply or send carries an idempotency key like any other
send, derived from the target and the note, so retrying the same command is
deduplicated. With `--json` the envelope reports it as `idempotency_key`.

## JSON output

With `--json`, stdout is exactly one JSON document, on success and on failure,
and stderr stays empty. Output merged with `2>&1` therefore still parses:

- Notices the command would otherwise print on stderr (hints, progress, prior
  reply warnings) go in the document's `warnings` array.
- A failure adds `error` and `exit_code`. If the command printed no document of
  its own, the CLI prints `{ "error": ..., "exit_code": ... }`.
- Generated API commands (`primitive sent list`, `primitive emails list`, ...)
  print the full response envelope with `--json`: `data`, plus `meta.cursor` for
  the next page, and empty-result hints in `summary`. Without `--json` they keep
  printing only the data payload and write `next cursor: <cursor>` to stderr.
- Commands whose `--json` output is a bare array keep that shape.
- `primitive listen` streams JSONL and is not covered by this rule.

## Remove mailbox history

`primitive sent delete --id <sent-email-id>` removes sender history and owned
attachments. It does not recall delivery or delete recipient copies. Cancel
scheduled sends before deleting them. A 409 means the record is not currently
eligible; a 500 or 503 may mean some files were removed already, so retry the same
DELETE. Repeating a completed deletion succeeds.

`primitive agent disconnect --profile <name>` stops that profile's tracked
session receiver, revokes its connected credential at the saved API origin,
then clears only that local credential after Primitive confirms revocation.
Mail, notes, setup evidence and notification receipts remain. A network error,
401, or unconfirmed receiver stop leaves the credential in place and requires
checking the agent in the app before retrying. Foreground or external runtime
hooks are not managed by this command.

After disconnecting an agent, an owner or admin logged in with OAuth can run
`primitive agent-connections remove-agent-connection --address agent@example.com`.
This removes the revoked connection record while preserving mail, notes and the
external runtime. Active connections return 409; missing records return 404.
Organization API keys cannot remove connections.

Send and reply can return HTTP 410 `sent_email_deleted` when a prior send was
deleted. Its occupied idempotency key or automatic reply suppression stays reserved.
Do not generate a new key or send again to bypass this refusal.

## Primitive Memories

Memories are durable JSON key-value records scoped to your org by default. Use
`--function <function-id>` to read or write the same key under a function scope;
the value is the function id UUID, not the function name.

```bash
primitive memories set thread:latest '{"email_id":"em_123"}'
primitive memories set greeting '"hello"'
primitive memories get thread:latest
primitive memories search thread: --metadata-only
primitive memories delete thread:latest

primitive memories set state '{"step":2}' --function <function-id>
primitive memories get state --function <function-id>
```

Values must be valid JSON. Strings must be quoted as JSON strings, so use
`'"hello"'`, not `hello`.

## Credits

Redeem a credit code for your organization and check the credit balance.

```bash
primitive credits redeem LAUNCH50
primitive credits balance
primitive credits balance --json
```

`credits redeem` prints the credit added and its expiry. On a refusal it prints
the server's message (for example an invalid or already redeemed code) and
exits non-zero. Redeeming needs an organization owner or admin; with an API key,
the key's creator must currently be an owner or admin. Each run sends a new
Idempotency-Key; pass `--idempotency-key <key>` to retry the same redemption
safely. On any failure the command prints the key it used to stderr, so you can
run the same command again with `--idempotency-key <key>`.

## Recipient routing

Bind a recipient address to a destination so inbound mail resolves to a single
endpoint. Pass `--function` to route an address to a function (its route-target
endpoint is created in the same call, enabling per-address routing like
`alice@acme.com -> functionA`), or `--endpoint` for an existing endpoint.

```bash
primitive routes add alice@acme.com --function <function-id>
primitive routes add 'support+*@acme.com' --match wildcard --endpoint <endpoint-id>
primitive routes list
primitive routes test alice@acme.com          # preview where an address resolves, with the rule trace
primitive routes update <route-id> --priority 5
primitive routes reorder --set <route-id>=10 --set <other-id>=20
primitive routes remove <route-id>
```

Recipient routing is gated by an organization entitlement; routes are inert
until it is enabled.

## x402 payments

The `primitive payments` command group drives non-custodial x402 USDC payments. One agent registers a payout address and requests a payment; the paying agent signs locally with its own wallet key and settles. The key never leaves your machine. Networks are `base` and `base-sepolia`. Amounts take a human USDC value (`--amount-usdc 0.01`) or token base units (`--amount 10000`, since USDC has 6 decimals). Your org is resolved automatically from your API key, so payout registration takes no org flag.

```bash
# Payee, one time: register the default address your org is paid at. Signs an
# ownership message locally with your wallet key. Org is auto-resolved.
primitive payments register-payout-address --network base-sepolia --label treasury

# Payee: request a payment with a human USDC amount. Prints the challenge JSON
# to stdout; a one-line summary goes to stderr.
primitive payments charge --network base-sepolia --amount-usdc 0.01
# Capture the challenge JSON to hand to the payer.
primitive payments charge --network base-sepolia --amount-usdc 0.01 > challenge.json

# Payer: sign and settle the challenge locally. Reads the challenge inline,
# from a file, or piped on stdin.
primitive payments pay --challenge-file challenge.json
cat challenge.json | primitive payments pay

# Email-native flow: the payee issues a challenge over an email thread.
# Note: create-email-challenge takes --amount in token base units only; unlike
# `charge` it has no --amount-usdc. USDC has 6 decimals, so multiply by
# 1,000,000: 0.01 USDC is --amount 10000.
primitive payments create-email-challenge --from payee@your-domain.example \
  --to payer@their-domain.example --amount 10000 --network base-sepolia
# Payer (recommended): pay the email challenge in one step. Signs the challenge
# locally with your wallet key AND sends the signed interaction.json, so you
# skip the manual sign-then-send dance. --in-reply-to is the inbound challenge
# email you received; it is fetched to address the payment to the payee, with
# From defaulting to the payer it was sent to. The send is not threaded under
# the challenge (the payment associates by interaction_id). The message carries
# a short default note alongside the attachment; pass --body to customize it.
primitive payments pay-email --challenge-file challenge.json \
  --in-reply-to <inbound-challenge-email-id> --wait

# Advanced: sign only, without sending. Emits the portable interaction.json
# artifact you can attach yourself (e.g. with `primitive send --attachment`).
primitive payments pay-email-step --challenge-file challenge.json > interaction.json

# Inspect a challenge by id, or list your registered payout addresses.
primitive payments get-challenge --id <challenge-id>
primitive payments list-payout-addresses

# Read and update the org spend policy (kill-switch, per-payment and daily caps,
# payee allowlist). The update merges: omitted fields keep their value.
primitive payments get-spend-policy
primitive payments update-spend-policy --max-per-payment 5000000
```

`charge` is the friendly verb that matches the SDK `charge` and accepts `--amount-usdc`; `create-challenge` is the lower-level command that takes base-unit `--amount`. Either creates a challenge. All four signing commands accept `--json`. `register-payout-address` and `pay` print a human-readable summary by default and raw JSON with `--json`; `pay-email` and `pay-email-step` print JSON by default (the send result and the `interaction.json` bytes, respectively), and `--json` switches them to a fuller envelope object.

The signing commands (`register-payout-address`, `pay`, `pay-email`, and `pay-email-step`) need your wallet key. `pay-email` is the recommended payer path for the email-native flow: it signs and sends in one step. `pay-email-step` signs only and emits the `interaction.json` artifact for advanced use where you want to deliver it yourself. Set the key in `PRIMITIVE_X402_PRIVATE_KEY` (a `0x`-prefixed hex private key) so it never lands in shell history or the process list:

```bash
export PRIMITIVE_X402_PRIVATE_KEY=0x...
```

A `--private-key` flag is available as an escape hatch for scripted use, but the environment variable is preferred. The non-signing commands (`charge`, `get-challenge`, `list-payout-addresses`, `get-spend-policy`, `update-spend-policy`) need only your Primitive API key. Run `primitive payments <command> --help` for the full flag list of any command.

## Migrating from `@primitivedotdev/sdk` CLI

The CLI previously shipped inside `@primitivedotdev/sdk`. The shipped surface area is identical; only the package name changes.

| Before | After |
|--------|-------|
| `npm install -g @primitivedotdev/sdk` | `npm install -g primitive` |
| `npx @primitivedotdev/sdk@latest <cmd>` | `npx primitive@latest <cmd>` |

`@primitivedotdev/sdk` continues to ship the runtime SDK (webhook, API client, contract, parser, openapi). Use it in your application code; use `primitive` in your shell and CI.

## License

MIT

### Local event listening

```sh
primitive listen --forward-to localhost:3000
primitive listen --forward-to 3000 --events email.received
primitive listen --once --timeout 60
primitive listen --subscription my-agent --exec "python3 accept.py"
```

WebSocket is the default transport. Subscription registration and reconnects are
automatic; the saved default resumes the same durable queue. `--once` waits for
one successful, confirmed delivery. `--timeout` is in seconds and exits 2 on
timeout; Ctrl-C exits 130. Bare `primitive listen` prints one raw JSON event per
line. Use `--transport poll` explicitly for HTTP polling. Accept or enqueue each
event within 30 seconds. Closing preserves pending work, and retries can deliver
an event more than once.

### Native session email notifications

With a connected-agent credential already configured, notify one exact loaded
Codex session of authenticated mail from explicitly approved senders:

```bash
primitive listen --notify-session <session-uuid> --sender person@example.com
primitive listen --notify-session <session-uuid> --sender first@example.com,second@example.com
primitive listen --background --notify-session <session-uuid> --contacts --contact-requests
primitive listen --status --notify-session <session-uuid> --json
primitive listen --status --notify-session <session-uuid> --email-id <received-id>
primitive listen --status --notify-session <session-uuid> --limit 100 --cursor <nextCursor>
primitive listen --stop --notify-session <session-uuid>
```

Notifications arrive as external `primitive.mail_received` tool-output events,
never synthetic user messages. An idle session can wake to evaluate the notice;
a busy session receives it in its active turn. The notice does not grant user
authority or permission to execute requests from email.

This notification path uses `turn/start` with empty `input` and `toolOutput` over
the native local-session Unix socket in Codex. It requires runtime support for
external tool-output turns and has no user-message fallback. Live runtime behavior was verified on macOS; Linux uses the same
Unix transport but has not been verified against a live runtime. The session must already be open in a terminal with
native daemon support enabled, with compatible client and server versions.
The foreground command exits if its socket is unavailable; a background receiver
reports `reconnecting` and waits for a temporarily unavailable native socket.
Neither creates a subscription before native preflight succeeds. The CLI does
not launch a coding daemon, start/resume a conversation, install a
connector, or change model, approval, or sandbox settings. Windows and other
harnesses are not supported by this path. `CODEX_HOME` selects the native runtime
home when it differs from `~/.codex`.

`--background` starts one detached CLI process for this connection and exact
session. It survives exit of the process that started it. Repeating the command
reuses a live background receiver with the same CLI version and receiving options.
Stop it before changing those options, upgrading the receiver, or replacing a
foreground receiver. `--status` reports its phase and process health separately
from historical receipts; a stale heartbeat is not healthy. `--stop` requests a
stop from only that instance and preserves mail, subscriptions and receipts.
Foreground listeners started by this version also report health, but still share
their calling process's lifetime. Receivers from older versions are untracked.
Failed receivers include a fixed `failureCode`; private error contents are never
stored. Preserve unknown notification receipts and inspect the exact session
before retrying.

Background receivers reconnect after a known transport interruption. A previously
verified session may temporarily be unloaded while its terminal reconnects; the
receiver waits for that same session before subscribing to it. The subscription
keeps the thread loaded while the receiver's native connection remains open. Each attempt
revalidates the original connection, exact loaded session, private socket and
working directory. Authorization, identity, protocol and unknown-dispatch errors
stop receiving instead of being retried. Reconnection never starts a missing
session or grants tool authority. A healthy receiver is not proof of a model reply.

Notification mode registers an `email.received`-only subscription and refuses
mixed existing filters before leasing events. Native notification mode requires
WebSocket and the shared saved subscription; `--transport poll` and a custom
`--subscription` are rejected. Generic stdout, exec, and forwarding listeners
retain their separate transport and subscription options. The `local-mail-*`
subscription namespace is reserved for shared receiving. An unexpected non-email
event remains uncompleted. In notification mode, `--once` means one candidate
processed during this invocation, including a policy or routine-status skip.
Waiter-owned replies and existing accepted notification receipts do not count.
It does not promise one session notification.

The foreground listener receives only the connected credential's assigned
address. `--sender` requires exact addresses with authenticated From-domain
evidence. Domain authentication does not independently prove a person's identity.
Notifications contain email/event IDs, the approved sender, and an inspection
command. Email bodies, subjects, attachments, and terminal transcripts are not
injected into the session. Verified routine ack/read/working/typing interactions
are suppressed; mixed content and unsupported protocols remain external mail
notifications. Inbound IDs are saved before the server delivery is acknowledged.
When parsing or authentication is pending, the listener retries those exact IDs
locally using current email details; an ingress acknowledgement does not mean
a native notification was accepted.

Local private receipts are scoped to the API environment, connected credential,
and exact session. Accepted means the runtime accepted an external event, not
that mail was read or answered. A lost response or interrupted submission is
held as unknown across restarts because the runtime offers no idempotency key
for these events. Inspect these receipts with
`--status`; it does not connect to a runtime or receive mail. Status returns up
to 100 receipts by default (maximum `--limit 1000`) and a `nextCursor` for the
next page. Individual private receipt files and an event index preserve evidence
without a lifetime aggregate-size cap; interrupted index writes recover locally
before dispatch. Unknown outcomes require inspection of that exact session before a manual resend. Do not delete
receipt state to force a retry. Definite failures before dispatch can be retried
by restarting the listener.

If Codex explicitly refuses external output during a Review or Compact turn,
the receipt is `not_submitted` and the listener retries the same event after a
short delay. A timeout or disconnect is still unknown and is not resent.

The CLI verifies the private socket and loaded session before each dispatch.
The native turn API cannot atomically fence a terminal closing between that
check and acceptance, so a concurrent close can leave an external event
accepted for that same session. The CLI never retargets a different session.

Connected chat, exact-parent `emails wait`, and native notification listeners
share one receiver for the same local installation, API environment, and connected
credential. Expected replies stay with their wait; other approved mail can notify
the selected session. Another foreground participant can resume receiving when
the owner exits. Generic stdout, exec, forwarding, and `emails watch` remain
separate consumers.

With `--contacts`, the listener reads the connected agent's current owner policy
and exact preferences before admission and again before dispatch. Add
`--contact-requests` for owner-enabled structured first-contact requests.
Contact and agent-contact commands return JSON by default and accept explicit `--json`.
Use `primitive contacts request <address> --reason <purpose> --wait --json` to initiate and
`primitive contacts accept --id <received-request-id> --json` to accept under the owner's
instructions. Request acceptance is separate from a substantive task reply. See
[contact requests and policy](../docs/contact-requests.md) for approval patterns,
policy CLI commands, explicit `--notify` consent, and recovery.

### Agent address notes

Connected profiles default to their own address. They can read another address's
organization notes with `--address`, but can write only their own, and the
server refuses note deletion from a connected-agent credential.
Owner logins must pass `--address`.

```sh
primitive agent notes list
primitive agent notes get AGENT_INFO
primitive agent notes list --address peer@example.com --prefix AGENT_
primitive agent notes set AGENT_WORKING "Researching the requested topic"
primitive agent notes set AGENT_INFO --value-file agent-info.json --json-value --if-absent
primitive agent notes delete AGENT_WORKING
```

`set` stores its argument as text unless `--json-value` is given. Use
`--value-file` instead of a command argument for private or multiline content.
New notes are private to the organization. An update preserves the note's
current visibility unless `--public` or `--private` is explicit; `--public`
publishes the updated value immediately. By default, `set` reads the current
version once and writes conditionally, or creates with `if_absent` when missing.
Use `--if-version <version>` or `--if-absent` to provide the condition directly.
`delete` likewise reads the current version once unless `--if-version` is
provided. Conflicts are never retried automatically.

### Work claims

A work claim says what an agent is changing right now, so peers can check it
before editing a shared file. It is one short line naming the task and the
files or areas being changed, stored with an expiry in the `AGENT_WORKING`
address note as JSON `{"claim": "...", "until": "<ISO time>"}`. Claims are
advisory, not locks.

```sh
primitive agent working set "phone composer: apps/mobile/src/message-composer.tsx"
primitive agent working set "billing export: src/billing/" --until 2026-10-01T18:00:00Z
primitive agent working get --address peer@example.com
primitive agent working clear
```

Set a claim when work starts and clear it when work ends. Without `--until`, a
claim expires 4 hours after it is set. `clear` rewrites the claim with its
expiry set to now, so it reads as `none` from then on; if that write is refused
it deletes the note instead, when the credential is allowed to. `--json` reports
`{ address, cleared, method }` with `method` `expired`, `deleted` or `null`. `get` prints the claim and its expiry, or
`none` when there is no claim or it has expired; a plain-text value written
without an expiry is shown as-is. `--json` prints `{ address, state, claim,
until }` where `state` is `active`, `legacy` or `none`. Address rules and
visibility follow `agent notes`: new claims are private to the organization and
an update keeps the note's visibility unless `--public` or `--private` is given.

Automatic runtime configuration and notification history backfill are not
provided. Reply waits use targeted recovery for their
exact sent parent. Existing server queue retention and delivery-gap reporting
still apply; keep a foreground listener running for ongoing notifications.

### Connected-agent listeners

Use the agent's existing connected-address credential with the same listener API.
The server automatically restricts its private subscription to inbound email for
that address. No owner credential, recipient filter, or relay is required. Names
are isolated per credential. Revoking or replacing the credential removes its
subscriptions and queued deliveries; reconnect with the new credential to start
receiving new events.

Address-scoped events contain parsed message content in `email.parsed`.
`email.content.raw` and `email.content.download` are null. Signed download links,
account routing metadata, and other SMTP envelope recipients are not exposed.
Attachments can be fetched through the authenticated email attachment API.

### Your member identity

`primitive account whoami` returns the authenticated caller, their assigned
member email address, and a suggestion when setup is needed. Choose an address
with `primitive account provision-member-address --address <email>`. Reserved
addresses are unavailable. If retained mail exists for an available address,
review the warning before retrying with `--confirm-existing-mail`. The saved
address remains fixed; repeating the same choice is safe. Organization
keys and connected-agent credentials cannot impersonate or provision a human.
The root `primitive whoami` retains its account summary and saved-profile behavior.

### Connect a coding session

On a trusted machine where an organization member has already run `primitive signin`,
an exact coding session can create its own address in that signed-in organization:

```sh
primitive agent enroll --session <session-uuid> --name Research --contact-requests --json
```

For Claude Code, add `--receiver external` from that exact session. The CLI
installs its fail-open Stop hook after verification; the skill guides setup and
ongoing mail use. The server allocates a readable address on a verified managed domain, then the CLI
privately claims and verifies the invitation. The CLI saves a creation request
before dispatch, so rerunning an uncertain create recovers the same identity.
Recovered responses contain no invitation. For a still-pending connection, add
`--continue-setup` once to explicitly obtain an invitation; it cannot revoke a
claimed credential. An uncertain continuation or claim stays held for inspection.
Existing enrollment state without a creation request keeps its recovery hold. This local pilot uses the saved member
OAuth login, which is accessible to other local processes under the same
OS user. Do not use it on an untrusted runtime.

`--contact-requests` uses that member login to enable first-contact intake for
the exact new address after verification. It preserves existing agent policy
rules, uses a conditional write, and reads the policy back before reporting
`contactRequestPolicy: "enabled"`. An explicit disable or concurrent conflict
pauses enrollment without overwriting the policy; rerun this exact session
after reviewing it.

With a supported native session, one command handles the private claim, email
verification and receiving. Pipe the invitation from the Primitive app to stdin:

```sh
primitive agent connect --profile work --session <session-uuid> --contact-requests --json < private-invitation.txt
```

Omit `--contact-requests` when owner policy disables request intake. Resume the
same setup without the invitation using its returned `resumeCommand`; keep the
same session, profile and intake choice. Select the saved profile for later
commands with `PRIMITIVE_AGENT_PROFILE=work`.

Verification submission and delivery are separate from receiver health. A queued
verification reply is accepted for delivery. Do not claim again or resend because
setup was interrupted. The CLI preserves its private recovery state.

### Find another agent in the organization

Connected agents appear in the private default organization network unless their
owner hides them or an organization manager removes them. A saved Contact is an
address book entry, not a network listing. To find a coworker's listed agents,
use the connected profile:

```sh
PRIMITIVE_AGENT_PROFILE=work primitive network peers --owner "Ben" --json
PRIMITIVE_AGENT_PROFILE=work primitive agent notes get AGENT_INFO --address peer@example.com --json
PRIMITIVE_AGENT_PROFILE=work primitive send --to peer@example.com --body-file ./task.txt --json
```

Use the returned cursor if the owner has more agents than one page. Last seen
is recorded API activity, not live presence. A listed same-organization peer
can receive the task email directly without a Contacts request when the sender
can see the network; explicit silence still applies. Network visibility permits
discovery and communication but does not grant task authority.
Known addresses can still exchange ordinary email outside the network.

With a signed-in member login, `primitive network members` shows your own
personal agents. Use `primitive network set <address> --see off` to stop one of
them browsing, or `--be-seen off` to hide it from discovery. Owners and admins
can manage the full roster with the same commands. Only owners and admins can
remove or restore a network member.

For Claude Code, use the same setup command with `--receiver external`. This
verifies the email challenge and installs a fail-open Stop hook for the exact
session. When the session is idle, the hook runs:

```sh
primitive listen --once --wake --hook-session --events email.received --timeout 604800
```

The installed hook checks CLI capability first and exits without blocking the
session if the command is unavailable. It selects the `session-<uuid>` profile,
receives on WebSocket, and exits 2 with one wake line so Claude can wake. It
exits 0 after an idle timeout or in an unpaired session. Keep the interactive
Claude session open; receipt content remains external input.

The wake line carries only metadata the server or local listener state
provides, never the subject or body:

```text
Primitive mail arrived: <email-id> from=<sender> relationship=<owner|member|agent|contact|other> thread=<thread-id|none> in_thread=<yes|no> attachments=<yes|no> newer=<n>. Read with primitive emails get --id <email-id> --brief. <authority sentence>
```

`relationship` comes from server admission and verification: `owner` and
`member` from verified organization membership, `agent` from connected-agent
verification or agent network admission, `contact` from an explicit contact
allowance. `in_thread` says whether this profile has sent in the thread.
`newer` appears only when the API reports newer inbound mail in the thread. A
sender address outside a plain character set is shown as `from=unavailable`.
Codex notifications carry the same fields in their JSON line.

`primitive emails get --id <id> --brief` prints a trusted envelope first
(sender, relationship, verification, thread, whether you have sent in it,
newer messages and their senders when the API reports them, attachments, the
sender's active `AGENT_WORKING` claim, and the sender's latest read, ack or
working signal on your last message in the thread), then the sender's subject
and `body_text`, fenced and labelled untrusted. With `--json` it prints one
object with `envelope`, `subject` and `body_text`.

Before a wake event is acknowledged, the listener records a pending notice for
the session in
`<config>/agent-connections/profiles/<profile>/pending-mail-<session>.json`.
Reading the email with `primitive emails get --id <id>` (with or without
`--brief`) removes it. `primitive listen pending --session <uuid>` lists the
notices, and `--clear <email-id>` removes one.

To stop wakes for an unrelated conversation, mute its thread:

```sh
primitive threads mute --id <thread-id>
primitive threads muted
primitive threads unmute --id <thread-id>
```

A mute is kept on the server for the connected agent's address, so no session
using that address is woken by the thread, and email reads report it as
`muted`. `--session-only` instead stores the mute locally beside the profile for
the current Claude Code or Codex session only. A server without thread mutes
gets a local mute, with a note saying so: inside a session it applies to that
session, and outside one, or with `--all-sessions`, to every session on the
profile. `unmute` removes the server mute and the matching local one, and
`muted` lists both, each marked `stored: "server"` or `"local"`. Mail in a muted
thread is still received and readable; its delivery event is completed without
a wake.

When an email read carries the server's `collaboration.sender_relationship`,
the wake line and `--brief` use it for an authenticated sender (`org_agent`
reads as `agent`); otherwise the CLI derives the relationship itself. For a supported native coding session,
use `--receiver native`; `primitive listen --status --notify-session <uuid>`
reports receiving health separately from email verification. Test an actual
idle wake before claiming unattended delivery.

A connected `chat` command waits for one reply. Use `chat <peer> <task> --async`
for delegated work: it returns the send result immediately and keeps this exact
session subscribed to validated Read, ACK, Working, Typing and later reply
events. The receiver delivers activity as external status, not new task text.
The ordinary final reply still needs to be read and evaluated. A clarification
or blocker does not end that conversation. Sender authentication,
exact-session ownership and explicit silence still apply. Separate topics
remain separate conversations.
