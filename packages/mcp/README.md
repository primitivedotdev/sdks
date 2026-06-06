# @primitivedotdev/mcp

Model Context Protocol server for [Primitive](https://www.primitive.dev), the email layer for AI agents.

Exposes seven core operations from the Primitive API as MCP tools that work with Claude Desktop, Claude Code, Cursor, Codex CLI, Gemini CLI, Cline, Continue, Zed, Goose, Windsurf, and any other MCP client.

## What's exposed

| Tool | What it does |
|---|---|
| `sendEmail` | Send an outbound email through the Primitive relay |
| `replyToEmail` | Reply to an inbound email with threading + recipient derivation handled server-side |
| `listEmails` | Paginated list of inbound emails, with filtering by domain, status, date, and free-text search |
| `searchEmails` | Structured + full-text search across the inbox |
| `getEmail` | Full record for one inbound email (parsed bodies, threading, SMTP envelope, webhook state) |
| `getInboxStatus` | Consolidated readiness view: domain verification, processing routes, deployed Functions, recent activity |
| `getAccount` | Account info and current state |

This is intentionally a small surface. The full CLI surface (functions, domains, endpoints, filters, agent signup, webhook secret rotation, etc.) lives in [`@primitivedotdev/cli`](https://www.npmjs.com/package/@primitivedotdev/cli) and the [SDKs](https://www.npmjs.com/org/primitivedotdev). Use the CLI or an SDK directly when you need the full surface; use this MCP server when you want the seven core verbs available natively inside an MCP client.

## Install

You need a Primitive API key. The fastest way to get one is the CLI: `npx @primitivedotdev/cli agent start-agent-signup` then follow the prompt. The key has the prefix `prim_`.

Then add an entry to your client's MCP config. The config syntax differs per client; the underlying server is the same.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "primitive": {
      "command": "npx",
      "args": ["-y", "@primitivedotdev/mcp"],
      "env": {
        "PRIMITIVE_API_KEY": "prim_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add primitive -e PRIMITIVE_API_KEY=prim_... -- npx -y @primitivedotdev/mcp
```

The `-e` flag passes env vars, and `--` separates the MCP server name from the command. Or add to `.mcp.json` in the project root with the same shape as the Claude Desktop block above.

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "primitive": {
      "command": "npx",
      "args": ["-y", "@primitivedotdev/mcp"],
      "env": { "PRIMITIVE_API_KEY": "prim_..." }
    }
  }
}
```

### Codex CLI (OpenAI)

`~/.codex/config.toml`:

```toml
[mcp_servers.primitive]
command = "npx"
args = ["-y", "@primitivedotdev/mcp"]
env = { PRIMITIVE_API_KEY = "prim_..." }
```

### Other clients (Cline, Continue, Zed, Goose, Windsurf, Gemini CLI)

Same shape, see your client's MCP docs:

```
command: npx
args:    ["-y", "@primitivedotdev/mcp"]
env:     PRIMITIVE_API_KEY=prim_...
```

## Environment variables

| Var | Meaning |
|---|---|
| `PRIMITIVE_API_KEY` | Your Primitive API key (`prim_...`). Required for any tool call. |
| `BEARER_TOKEN_BEARERAUTH` | Legacy alias for `PRIMITIVE_API_KEY`. Read second; either works. |
| `API_BASE_URL` | Override the API base URL. Defaults to `https://api.primitive.dev/v1`. Validated at startup: must be `https://` (except for `localhost`), and the MCP server emits a warning on stderr when the host is not a `*.primitive.dev` host. The bearer is forwarded to whatever host you set here on every tool call, so do not point it at an untrusted origin. |

## Behavior on missing credentials

Without `PRIMITIVE_API_KEY` (or its alias), every tool call returns a clear error pointing at the signup CLI. The MCP server itself starts fine. Set the env var in your client's MCP config block, not as a shell export. The MCP client spawns the server with its own env.

## Pre-1.0 notice

This package is pre-1.0 (`0.x`). Tool names and surface shape may change. The seven tools listed above map 1:1 to Primitive's stable v1 API operations; the alignment is unlikely to break, but anything outside that set is fair game until 1.0.

## How this is built

The server source (`src/index.ts`) is generated from Primitive's OpenAPI spec via [`openapi-mcp-generator`](https://github.com/harsha-iiiv/openapi-mcp-generator). The seven exposed operations are marked with the `x-mcp: true` extension on the operation in the spec; everything else is excluded by the `--default-include false` flag. Regenerate with:

```bash
pnpm --filter @primitivedotdev/mcp generate
```

## License

MIT. See LICENSE.
