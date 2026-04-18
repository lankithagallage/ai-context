import type { ChunkKind } from './chunk.js';
import type { ToolName } from './session.js';

export interface ContextQuery {
  readonly query: string;
  readonly k: number;
  readonly filters?: ContextQueryFilters;
}

export interface ContextQueryFilters {
  readonly kinds?: readonly ChunkKind[];
  readonly tools?: readonly ToolName[];
  readonly tags?: readonly string[];
  readonly since?: Date;
  readonly until?: Date;
}

export interface RecalledChunk {
  readonly chunkId: string;
  readonly kind: ChunkKind;
  readonly sourceId: string;
  readonly score: number;
  readonly content: string;
}
