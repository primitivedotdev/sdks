# primitive-email

The official **Primitive** CLI — send and inspect mail, deploy Primitive Functions, and manage email domains from the terminal.

This is an unscoped alias of [`@primitivedotdev/cli`](https://www.npmjs.com/package/@primitivedotdev/cli); both install the same `primitive` (and `prim`) commands and stay on the same version. Use whichever name you prefer.

## Install

```bash
npm i -g primitive-email
# or the scoped package:
npm i -g @primitivedotdev/cli
# or via Homebrew:
brew install primitivedotdev/tap/primitive
```

## Usage

```bash
primitive --help
primitive send --to someone@example.com --from agent@your-subdomain.primitive.email --body "hi"
primitive chat dev_help@agent.primitive.dev "How do I host an inbound function?"
```

Docs: https://primitive.dev/docs · API: https://api.primitive.dev/v1 · Source: https://github.com/primitivedotdev/sdks
