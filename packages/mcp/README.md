# @lankithagallage/ai-context-mcp

MCP server for [ai-context](https://github.com/lankithagallage/ai-context) —
exposes context recall and capture tools to any MCP-aware AI (Claude Code,
Cursor, Windsurf, Cline, Continue).

## Setup

Run `init` in your project first — it registers this server in `.mcp.json`
automatically:

```bash
npx @lankithagallage/ai-context-cli init
```

Or add it manually to `.mcp.json`:

```json
{
  "mcpServers": {
    "ai-context": {
      "command": "npx",
      "args": ["-y", "@lankithagallage/ai-context-mcp"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `recall_context` | Semantic search over captured sessions, facts, and decisions |
| `save_session` | Distil and persist a raw transcript |
| `list_decisions` | List ADR-style decisions stored in the repo |

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) running locally (`ollama pull llama3.1:8b`)
