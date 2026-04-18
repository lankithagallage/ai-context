import type { EmbeddingProvider } from '../ports/embedding-provider.js';
import type { VectorStore } from '../ports/vector-store.js';
import type { ContextQuery, RecalledChunk } from '../../domain/context-query.js';

export interface RecallContextDeps {
  readonly embeddings: EmbeddingProvider;
  readonly vectors: VectorStore;
}

export class RecallContextUseCase {
  constructor(private readonly deps: RecallContextDeps) {}

  async execute(query: ContextQuery): Promise<readonly RecalledChunk[]> {
    const [embedding] = await this.deps.embeddings.embed([query.query]);
    if (!embedding) throw new Error('Embedding provider returned no vector for the query.');

    return this.deps.vectors.search({
      embedding,
      k: query.k,
      ...(query.filters ? { filters: query.filters } : {}),
    });
  }
}
