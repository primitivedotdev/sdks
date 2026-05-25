# @primitivedotdev/cli

Official Primitive CLI. Deploy Primitive Functions, send and inspect mail, manage endpoints, all from the terminal.

```bash
brew install primitivedotdev/cli/primitive
primitive whoami
```

Or with npm:

```bash
npm install -g @primitivedotdev/cli
primitive whoami
```

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

Use `primitive signin` for existing accounts. It defaults to browser approval; `primitive signin browser` is the explicit form and `primitive login` remains available for compatibility.

Use `primitive signin otp <email> --signup-code <code> --accept-terms`, then `primitive signin otp confirm <email> <code>` for email-code sign-in.

Use `primitive signup <email>` for new account creation, then `primitive signup confirm <email> <code>` with the emailed verification code. Non-interactive signup is available with `--signup-code` and `--accept-terms`.

## Command style

Use task-oriented commands for normal workflows:

```bash
primitive send --to alice@example.com --body "Hello"
primitive reply --id <inbound-email-id> --body "Thanks"
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
