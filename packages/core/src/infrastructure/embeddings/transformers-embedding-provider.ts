import type { EmbeddingProvider } from '../../application/ports/embedding-provider.js';

export interface TransformersEmbeddingConfig {
  readonly model: string;
  readonly dimensions: number;
}

type FeatureExtractor = (
  texts: string[],
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] | number[][][] }>;

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly modelId: string;

  private constructor(
    private readonly extractor: FeatureExtractor,
    config: TransformersEmbeddingConfig,
  ) {
    this.modelId = config.model;
    this.dimensions = config.dimensions;
  }

  static async create(config: TransformersEmbeddingConfig): Promise<TransformersEmbeddingProvider> {
    const { pipeline } = await import('@huggingface/transformers');
    const extractor = (await pipeline('feature-extraction', config.model)) as unknown as FeatureExtractor;
    return new TransformersEmbeddingProvider(extractor, config);
  }

  async embed(texts: readonly string[]): Promise<ReadonlyArray<ReadonlyArray<number>>> {
    if (texts.length === 0) return [];
    const output = await this.extractor([...texts], { pooling: 'mean', normalize: true });
    const list = output.tolist();
    return normalizeTo2d(list, texts.length, this.dimensions);
  }
}

function normalizeTo2d(list: number[][] | number[][][], n: number, dims: number): number[][] {
  const first = list[0];
  if (Array.isArray(first) && typeof first[0] === 'number') {
    return list as number[][];
  }
  const flat = (list as number[][][]).map((row) => row[0] ?? []);
  if (flat.length !== n) {
    throw new Error(`Embedding count mismatch: expected ${n}, got ${flat.length}`);
  }
  for (const v of flat) {
    if (v.length !== dims) {
      throw new Error(`Embedding dimension mismatch: expected ${dims}, got ${v.length}`);
    }
  }
  return flat;
}
