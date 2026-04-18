import type { ContextQueryFilters, RecalledChunk } from '../../domain/context-query.js';
import type { EmbeddedChunk } from '../../domain/chunk.js';

export interface VectorSearchOptions {
  readonly embedding: ReadonlyArray<number>;
  readonly k: number;
  readonly filters?: ContextQueryFilters;
}

export interface VectorStore {
  upsert(chunks: readonly EmbeddedChunk[]): Promise<void>;
  delete(chunkIds: readonly string[]): Promise<void>;
  search(options: VectorSearchOptions): Promise<readonly RecalledChunk[]>;
  count(): Promise<number>;
}
