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
        "BEARER_TOKEN_BEARERAUTH": "prim_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add primitive npx -y @primitivedotdev/mcp --env BEARER_TOKEN_BEARERAUTH=prim_...
```

Or add to `.mcp.json` in the project root.

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "primitive": {
      "command": "npx",
      "args": ["-y", "@primitivedotdev/mcp"],
      "env": { "BEARER_TOKEN_BEARERAUTH": "prim_..." }
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
env = { BEARER_TOKEN_BEARERAUTH = "prim_..." }
```

### Other clients (Cline, Continue, Zed, Goose, Windsurf, Gemini CLI)

Same shape, see your client's MCP docs:

```
command: npx
args:    ["-y", "@primitivedotdev/mcp"]
env:     BEARER_TOKEN_BEARERAUTH=prim_...
```

## Environment variables

| Var | Meaning |
|---|---|
| `BEARER_TOKEN_BEARERAUTH` | Your Primitive API key (`prim_...`). Required for any tool call. |
| `API_BASE_URL` | Override the API base URL. Defaults to `https://api.primitive.dev/v1`. Set this only if you're targeting a non-production environment. |

## Behavior on missing credentials

Without `BEARER_TOKEN_BEARERAUTH`, tool calls return a 401 error from the Primitive API. The MCP server itself starts fine. Set the env var in your client's MCP config block, not as a shell export.

## How this is built

The server source (`src/index.ts`) is generated from Primitive's OpenAPI spec via [`openapi-mcp-generator`](https://github.com/harsha-iiiv/openapi-mcp-generator). The seven exposed operations are marked with the `x-mcp: true` extension on the operation in the spec; everything else is excluded by the `--default-include false` flag. Regenerate with:

```bash
pnpm --filter @primitivedotdev/mcp generate
```

## License

MIT. See LICENSE.
