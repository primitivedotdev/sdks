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

The same CLI is also published unscoped as [`primitivecli`](https://www.npmjs.com/package/primitivecli) — `npm install -g primitivecli` installs an identical build with the same `primitive`/`prim` commands. Use whichever name you prefer; they track the same version.

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

## Migrating from `@primitivedotdev/sdk` CLI

The CLI previously shipped inside `@primitivedotdev/sdk`. The shipped surface area is identical; only the package name changes.

| Before | After |
|--------|-------|
| `npm install -g @primitivedotdev/sdk` | `npm install -g @primitivedotdev/cli` |
| `npx @primitivedotdev/sdk@latest <cmd>` | `npx @primitivedotdev/cli@latest <cmd>` |

`@primitivedotdev/sdk` continues to ship the runtime SDK (webhook, API client, contract, parser, openapi). Use it in your application code; use `@primitivedotdev/cli` in your shell and CI.

## License

MIT
