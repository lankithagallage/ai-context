# @lankithagallage/ai-context-adapter-claude-code

Claude Code `PreCompact` / `SessionEnd` hook that automatically captures session
transcripts into [ai-context](https://github.com/lankithagallage/ai-context).

## Prerequisites

Run `init` once in your project first:

```bash
npx @lankithagallage/ai-context-cli init
```

This creates `.ai-context/`, `AI_CONTEXT.md`, appends recall instructions to
`CLAUDE.md`, and registers the MCP server in `.mcp.json`.

## Install

```bash
pnpm add -D @lankithagallage/ai-context-adapter-claude-code
# or
npm install --save-dev @lankithagallage/ai-context-adapter-claude-code
```

## Wire up

Add the hook to `.claude/settings.json` in your repo:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @lankithagallage/ai-context-adapter-claude-code"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @lankithagallage/ai-context-adapter-claude-code"
          }
        ]
      }
    ]
  }
}
```

Claude Code passes the hook payload on stdin. The hook reads `transcript_path`
and runs `ai-context capture` against it. Failures are swallowed so a capture
hiccup never blocks your coding session.

## How it works

On every session end or context compression:

1. Hook fires with a JSON payload containing the transcript path
2. Transcript is piped through the distillation pipeline: `redact → summarize → extract-facts → extract-decisions → chunk`
3. Distilled artifacts land in `.ai-context/sessions/`, `facts/`, `decisions/` as git-tracked markdown
4. Chunks are embedded locally (ONNX, no network) and indexed in sqlite-vec

The next session calls `recall_context` via MCP and loads only the relevant
chunks — no manual intervention needed.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) running locally (`ollama pull llama3.1:8b`)
