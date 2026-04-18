export interface EmbeddingProvider {
  readonly dimensions: number;
  readonly modelId: string;
  embed(texts: readonly string[]): Promise<ReadonlyArray<ReadonlyArray<number>>>;
}
