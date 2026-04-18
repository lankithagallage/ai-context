export type ChunkKind = 'session-summary' | 'fact' | 'decision';

export interface ChunkSource {
  readonly kind: ChunkKind;
  readonly sourceId: string;
}

export interface Chunk {
  readonly id: string;
  readonly source: ChunkSource;
  readonly content: string;
  readonly tokens: number;
  readonly createdAt: Date;
}

export interface EmbeddedChunk extends Chunk {
  readonly embedding: ReadonlyArray<number>;
}
