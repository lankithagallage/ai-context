# ADR 0001 — Hexagonal architecture with a pure domain

- Status: Accepted
- Date: 2026-04-18

## Context

`ai-context` must integrate with many external systems whose APIs and
availability change independently:

- LLM backends (Ollama today, OpenAI / Anthropic / local GGUF tomorrow)
- Embedding models (sentence-transformers today, others later)
- Vector stores (sqlite-vec today, LanceDB / pgvector later)
- AI-tool capture sources (Claude Code hooks today, Cursor / Copilot later)
- AI-tool recall surfaces (MCP, CLI, repo-root markdown)

Baking any of these into the domain would couple the product to vendors it
should outlast.

## Decision

Adopt a hexagonal (ports-and-adapters) architecture with three dependency
rings:

1. **Domain** — plain TypeScript types describing Session, Fact, Decision,
   Chunk, ContextQuery. No imports of `node:*` or third-party libraries.
2. **Application** — use cases and the distillation pipeline, depending only
   on domain types and port interfaces.
3. **Infrastructure** — concrete adapters (Ollama, transformers.js,
   sqlite-vec, markdown filesystem) implementing the ports.

Wiring happens in a composition root at the edge (CLI entry, MCP entry,
tests). No framework-level DI container — manual wiring is small, explicit,
and avoids magic.

## Consequences

- Swapping any backend is a single new adapter, no domain or use-case changes.
- Unit tests for use cases use in-memory fakes of the ports; no mocks of
  concrete classes.
- Each layer has a clear, enforceable dependency direction. A lint rule can
  keep domain / application from importing infrastructure.
- Slight file-count overhead at v0.1. Worth it — the abstractions are the
  product's long-term moat against the churn in the AI-tooling ecosystem.
