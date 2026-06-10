import os from 'node:os';
import path from 'node:path';
import type { EmbeddingProvider } from '../../application/ports/embedding-provider.js';

export interface TransformersEmbeddingConfig {
  readonly model: string;
  readonly dimensions: number;
}

// Shared, persistent model cache so the embeddings model is downloaded once and
// reused across every entrypoint (local build, `npx` CLI/MCP/adapter — each of
// which otherwise gets its own empty cache inside a throwaway npx dir and
// re-downloads ~90MB from HuggingFace on first use, which can fail on flaky
// networks). Honors HF_HOME / TRANSFORMERS_CACHE if the user already set one.
function resolveModelCacheDir(): string {
  return (
    process.env.AI_CONTEXT_MODEL_CACHE ??
    process.env.TRANSFORMERS_CACHE ??
    (process.env.HF_HOME ? path.join(process.env.HF_HOME, 'transformers') : undefined) ??
    path.join(os.homedir(), '.cache', 'ai-context', 'models')
  );
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
    const { pipeline, env } = await import('@huggingface/transformers');
    // Point every invocation at one persistent cache so the model is fetched at
    // most once, not re-downloaded per npx temp dir.
    env.cacheDir = resolveModelCacheDir();
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
