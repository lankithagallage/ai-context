# Architecture

## Goals

1. **Cross-AI.** Any assistant (Claude, Cursor, Copilot, ChatGPT, …) must be
   able to rehydrate context from the repo before producing new code.
2. **Automatic on compression.** Capture triggers on the AI's
   context-compression / session-end event, not on a human remembering.
3. **Semantic recall, not full-history replay.** The AI gets the K chunks
   relevant to *the current task*, not the whole archive.
4. **Distilled, not raw.** Only the useful, redacted, summarized artifacts are
   committed. Dead-ends and secrets stay out of git.
5. **Local-first.** Embeddings and distillation run against local models. No
   required network calls at runtime.
6. **Addon, not service.** Ship as npm (and later NuGet) packages that any
   project can install.

## Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│  interfaces       CLI        MCP server       Capture adapters       │   primary drivers
├──────────────────────────────────────────────────────────────────────┤
│  application      use cases         distillation pipeline            │   orchestration
├──────────────────────────────────────────────────────────────────────┤
│  domain           Session  Fact  Decision  Chunk  ContextQuery       │   pure, no I/O
├──────────────────────────────────────────────────────────────────────┤
│  infrastructure   Ollama   transformers   sqlite-vec   markdown FS   │   secondary drivers
└──────────────────────────────────────────────────────────────────────┘
```

Dependency rule: arrows point **inward**. Domain depends on nothing.
Application depends on domain + port interfaces. Infrastructure implements
ports. Interfaces compose the application via a composition root.

## Ports (application boundary)

| Port                    | Purpose                                             |
|-------------------------|-----------------------------------------------------|
| `LLMProvider`           | Text / structured generation for distillation       |
| `EmbeddingProvider`     | Turn text into vectors                              |
| `VectorStore`           | Upsert / nearest-neighbour search over chunks       |
| `SessionRepository`     | Persist and list distilled sessions                 |
| `FactRepository`        | Persist and query extracted facts                   |
| `DecisionRepository`    | Persist and query ADR-style decisions               |
| `Clock`                 | Time source (testable)                              |

## Use cases

- `CaptureSessionUseCase` — raw transcript → distillation pipeline → persist
  artifacts → embed chunks → upsert into vector store.
- `RecallContextUseCase` — query → vector search → hydrate source artifacts →
  format as markdown for injection.
- `ReindexUseCase` — walk markdown repos → re-embed → rewrite index.
- `StatusUseCase` — counts, freshness, index health.

## Distillation pipeline (chain of responsibility)

Each stage is a pure `Stage` with `execute(ctx) -> ctx'`. Stages can be
reordered, skipped, or replaced without changing other stages.

1. `RedactStage` — regex + heuristic secret removal (API keys, JWTs, emails,
   private IPs).
2. `SummarizeStage` — LLM call → high-level session summary.
3. `ExtractFactsStage` — LLM call → list of atomic facts.
4. `ExtractDecisionsStage` — LLM call → ADR-style decisions.
5. `ChunkStage` — produce embedding-ready chunks from the above.

## Cross-AI integration strategy

- **Primary: MCP.** Claude Code, Cursor, Windsurf, Cline, and Continue all
  speak the Model Context Protocol. One MCP server exposes
  `recall_context`, `save_session`, `list_decisions` — every MCP-aware AI
  gets memory for free.
- **Fallback: `AI_CONTEXT.md`.** A generated markdown index at repo root.
  Any AI that just reads the workspace picks up the pointer to the CLI.
- **Fallback-of-fallback: tool-specific instruction files.** `init` injects
  a short "before any change, recall context" header into `CLAUDE.md`,
  `.cursorrules`, `.github/copilot-instructions.md`, etc.

## Why these specific technologies

- **sqlite-vec** — single-file vector store, no server, embeds cleanly in an
  npm package, zero runtime dependencies beyond `better-sqlite3`.
- **`@huggingface/transformers`** (née `@xenova/transformers`) — runs
  sentence-transformer models via ONNX Runtime entirely in Node, no Python.
  Default model: `Xenova/all-MiniLM-L6-v2` (384 dims, ~23 MB).
- **Ollama** — ubiquitous, simple REST API, lets the user pick whichever
  local model fits their machine.

See also: [ADR 0001 — Hexagonal architecture](adr/0001-hexagonal-architecture.md).
