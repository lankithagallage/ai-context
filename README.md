# ai-context

Git-versioned, cross-AI context memory for AI-assisted codebases.

When AI coding assistants (Claude Code, Cursor, Copilot, ChatGPT, …) run out of
context, they "forget" project history and start producing inconsistent code.
`ai-context` captures, distills, and commits that history into the repo so any
future AI session — with any tool — can rehydrate the relevant pieces before
making changes.

## How it works

1. **Capture.** On context-compression / session-end, the raw transcript is
   piped through a distillation pipeline:
   `redact → summarize → extract-facts → extract-decisions → chunk`.
2. **Store.** Only the distilled artifacts land in `.ai-context/` as markdown
   with YAML frontmatter. Raw transcripts stay local (gitignored).
3. **Index.** Chunks are embedded locally and written to a sqlite-vec index.
4. **Recall.** The next AI session calls `recall_context(query)` via the MCP
   server (or `ai-context recall "<task>"` via CLI), gets the top-K relevant
   chunks, and loads only those into its window.

Nothing leaves your machine: embeddings run via `@huggingface/transformers`
(ONNX in Node), distillation runs via Ollama on localhost.

## Install

```bash
pnpm install
pnpm -r run build
```

Requirements:

- Node.js 20+
- pnpm 9+
- [Ollama](https://ollama.com) running locally with a model pulled
  (e.g. `ollama pull llama3.1:8b`)
- Native build tools for `better-sqlite3` (only needed at install time)

## Use it in a target repo

```bash
# 1. Initialise the per-repo store
cd /path/to/your/project
npx @ai-context/cli init

# 2. Capture a session by hand (or wire up the hook — see below)
npx @ai-context/cli capture --tool claude-code --file path/to/transcript.jsonl

# 3. From any future AI session: recall relevant context before editing
npx @ai-context/cli recall "what does the auth middleware expect?"

# 4. Check the store's health
npx @ai-context/cli status
```

## Auto-capture with Claude Code

Install the hook adapter in your target repo:

```bash
pnpm add -D @ai-context/adapter-claude-code
```

Then add to `.claude/settings.json`:

```jsonc
{
  "hooks": {
    "PreCompact": [
      { "hooks": [{ "type": "command", "command": "npx -y @ai-context/adapter-claude-code" }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "npx -y @ai-context/adapter-claude-code" }] }
    ]
  }
}
```

## Cross-AI via MCP

`@ai-context/mcp` exposes three tools over stdio MCP — compatible with Claude
Code, Cursor, Windsurf, Cline, Continue, and any other MCP client:

| Tool              | Use                                                            |
|-------------------|----------------------------------------------------------------|
| `recall_context`  | Semantic search for relevant prior context                     |
| `save_session`    | Distill and persist a raw transcript                           |
| `list_decisions`  | Summary of counts + ADR titles                                 |

`ai-context init` registers the server in `.mcp.json` automatically.

## Architecture

Hexagonal (ports and adapters). See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/adr/0001-hexagonal-architecture.md`](docs/adr/0001-hexagonal-architecture.md).

Packages:

| Package                           | What it is                               |
|-----------------------------------|------------------------------------------|
| `@ai-context/core`                | Domain, application, infrastructure      |
| `@ai-context/cli`                 | `ai-context` CLI                         |
| `@ai-context/mcp`                 | MCP server                               |
| `@ai-context/adapter-claude-code` | PreCompact / SessionEnd hook             |

## Layout per target repo

```
.ai-context/
├── config.json
├── sessions/*.md              distilled summaries (tracked)
├── facts/*.md                 atomic, reusable facts (tracked)
├── decisions/*.md             ADR-style decisions (tracked)
├── index/
│   ├── vectors.sqlite         local vector index (gitignored)
│   └── manifest.jsonl
└── raw/                       full transcripts (gitignored)
AI_CONTEXT.md                  generated index for non-MCP tools
```

## Develop

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
```

## License

MIT
