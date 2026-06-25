# @primitivedotdev/cli

Official Primitive CLI. Deploy Primitive Functions, send and inspect mail, manage endpoints, all from the terminal.

```bash
brew install primitivedotdev/tap/primitive
primitive whoami
```

Or with npm:

```bash
npm install -g @primitivedotdev/cli
primitive whoami
# `prim` is installed as a short alias for the same CLI.
prim whoami
```

The same CLI is also published unscoped as [`primcli`](https://www.npmjs.com/package/primcli). `npm install -g primcli` installs an identical build with the same `primitive`/`prim` commands. Use whichever name you prefer; they track the same version.

Or with no install:

```bash
npx @primitivedotdev/cli@latest <command>
```

This package wraps the [@primitivedotdev/sdk](https://www.npmjs.com/package/@primitivedotdev/sdk) runtime client with one-shot commands. For in-handler use (calling Primitive from inside a Function), import `createPrimitiveClient` from `@primitivedotdev/sdk/api` directly; the CLI is for operator and deploy workflows.

## Quickstart

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
primitive domains list
primitive functions templates
primitive functions init my-fn --template email-reply
primitive functions logs --id <function-id>
primitive deliveries replay --id <delivery-id>
```

Generated API commands remain available for compatibility and full schema parity, for example `primitive emails:list-emails` and `primitive sending:reply-to-email`.

## x402 payments

The `primitive payments` command group drives non-custodial x402 USDC payments. One agent registers a payout address and requests a payment; the paying agent signs locally with its own wallet key and settles. The key never leaves your machine. Networks are `base` and `base-sepolia`. Amounts take a human USDC value (`--amount-usdc 0.01`) or token base units (`--amount 10000`, since USDC has 6 decimals). Your org is resolved automatically from your API key, so payout registration takes no org flag.

```bash
# Payee, one time: register the default address your org is paid at. Signs an
# ownership message locally with your wallet key. Org is auto-resolved.
primitive payments register-payout-address --network base-sepolia --label treasury

# Payee: request a payment with a human USDC amount. Prints a summary by default.
primitive payments charge --network base-sepolia --amount-usdc 0.01
# Capture the raw challenge JSON to hand to the payer.
primitive payments charge --network base-sepolia --amount-usdc 0.01 --json > challenge.json

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
# Payer: sign a received email challenge into an interaction.json payment step.
# This does NOT send; attach the output to your reply (e.g. with `primitive reply`).
primitive payments pay-email-step --challenge-file challenge.json > interaction.json

# Inspect a challenge by id, or list your registered payout addresses.
primitive payments get-challenge --id <challenge-id>
primitive payments list-payout-addresses

# Read and update the org spend policy (kill-switch, per-payment and daily caps,
# payee allowlist). The update merges: omitted fields keep their value.
primitive payments get-spend-policy
primitive payments update-spend-policy --max-per-payment 5000000
```

`charge` is the friendly verb that matches the SDK `charge` and accepts `--amount-usdc`; `create-challenge` is the lower-level command that takes base-unit `--amount`. Either creates a challenge. The signing commands print a human-readable summary by default; pass `--json` for raw JSON suitable for piping.

The two signing commands (`register-payout-address` and `pay`) need your wallet key. Set it in `PRIMITIVE_X402_PRIVATE_KEY` (a `0x`-prefixed hex private key) so it never lands in shell history or the process list:

```bash
export PRIMITIVE_X402_PRIVATE_KEY=0x...
```

A hidden `--private-key` flag is available as an escape hatch for scripted use, but the environment variable is preferred. The non-signing commands (`charge`, `get-challenge`, `list-payout-addresses`, `get-spend-policy`, `update-spend-policy`) need only your Primitive API key. Run `primitive payments <command> --help` for the full flag list of any command.

## Migrating from `@primitivedotdev/sdk` CLI

The CLI previously shipped inside `@primitivedotdev/sdk`. The shipped surface area is identical; only the package name changes.

| Before | After |
|--------|-------|
| `npm install -g @primitivedotdev/sdk` | `npm install -g @primitivedotdev/cli` |
| `npx @primitivedotdev/sdk@latest <cmd>` | `npx @primitivedotdev/cli@latest <cmd>` |

`@primitivedotdev/sdk` continues to ship the runtime SDK (webhook, API client, contract, parser, openapi). Use it in your application code; use `@primitivedotdev/cli` in your shell and CI.

## License

MIT
