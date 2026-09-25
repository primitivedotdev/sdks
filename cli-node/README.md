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
Run `primitive listen` to print existing webhook events as JSONL. Status goes to
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
```

Run `primitive --help` for the full command list. Per-command help (`primitive functions deploy --help`) carries enough detail that an agent can compose any operation without leaving the terminal.

## Authentication

Use `primitive signin` or `primitive login` for existing accounts. With no email, both use browser approval; `primitive signin browser` and `primitive login browser` are the explicit browser forms.

Use `primitive signin <email> --signup-code <code> --accept-terms`, then `primitive signin confirm <email> <code>` for email-code sign-in. `primitive login <email>` and `primitive otp <email>` support the same email-code flow with matching `confirm` and `resend` subcommands.

Use `primitive logout --force` to remove local CLI credentials, pending email-code auth state, and stale credential locks without contacting Primitive. This is the recovery command when an interrupted auth command leaves the CLI saying another credential operation is already in progress.

Use `primitive signup <email>` for new account creation, then `primitive signup confirm <email> <code>` with the emailed verification code. Non-interactive signup is available with `--accept-terms` (pass `--signup-code <code>` too if you have one).

## Command style

Use task-oriented commands for normal workflows:

```bash
primitive send --to alice@example.com --body "Hello"
primitive reply --id <inbound-email-id> --body "Thanks"
primitive reply --id <inbound-email-id> --body "See attached" --attachment ./report.pdf
primitive chat reply "See attached" --attachment ./report.pdf
primitive emails list
primitive emails get --id <inbound-email-id>
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
(failures included) whose `outcome` field carries the name.

| Outcome | Exit | Meaning |
|---|---|---|
| `replied` | 0 | Chat only: the message was sent and a reply arrived. |
| `sent` | 0 | Accepted for delivery. `status: "queued"` is a success, not a pending failure. |
| `already_sent` | 0 | The server recognised an identical earlier send, or refused with HTTP 410 `sent_email_deleted` because that earlier send was deleted. Nothing new went out. Do not resend. |
| `not_sent` | 1 | The API rejected the request (HTTP 400, 401, 402, 403, 404, 413, 422 or 429), or the command failed before sending. Nothing went out. |
| (usage error) | 2 | Invalid flags or arguments. Nothing went out. |
| `sent_awaiting_reply` | 3 | Chat only: the message was sent but no reply arrived before `--timeout`. Wait with the printed command; do not resend. |
| `uncertain` | 4 | Transport error, conflict or server error. The message may or may not have gone out; check `primitive sent list` before retrying. |

A chat that times out prints `Message sent (id X). No reply yet after Ns. Do NOT
resend; wait with: <command>`, and its `--json` envelope has `"reply": null`, the
`sent` record, and `follow_up_commands` that only wait on or inspect that send.

Without `--json`, `send` and `reply` keep printing the send record on stdout exactly
as before and add a one-line stderr summary such as `Reply sent (queued for
delivery, id X). Do not resend.` Before sending, `primitive reply` (and
`primitive chat --reply`) warns on stderr when the inbound email already has a reply
that went out. The warning never blocks the send; if the lookup fails, the reply is
still sent and stderr says the check was skipped. `--json` includes the replies as
`prior_replies`.

## Remove mailbox history

`primitive sent delete --id <sent-email-id>` removes sender history and owned
attachments. It does not recall delivery or delete recipient copies. Cancel
scheduled sends before deleting them. A 409 means the record is not currently
eligible; a 500 or 503 may mean some files were removed already, so retry the same
DELETE. Repeating a completed deletion succeeds.

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
