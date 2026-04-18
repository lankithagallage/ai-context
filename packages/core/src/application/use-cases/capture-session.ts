import type { EmbeddingProvider } from '../ports/embedding-provider.js';
import type { VectorStore } from '../ports/vector-store.js';
import type {
  DecisionRepository,
  FactRepository,
  SessionRepository,
} from '../ports/repositories.js';
import type { DistillationPipeline } from '../distillation/pipeline.js';
import type { RawTranscript } from '../distillation/stage.js';
import type { EmbeddedChunk } from '../../domain/chunk.js';

export interface CaptureSessionResult {
  readonly sessionId: string;
  readonly factCount: number;
  readonly decisionCount: number;
  readonly chunkCount: number;
}

export interface CaptureSessionDeps {
  readonly pipeline: DistillationPipeline;
  readonly sessions: SessionRepository;
  readonly facts: FactRepository;
  readonly decisions: DecisionRepository;
  readonly embeddings: EmbeddingProvider;
  readonly vectors: VectorStore;
}

export class CaptureSessionUseCase {
  constructor(private readonly deps: CaptureSessionDeps) {}

  async execute(raw: RawTranscript): Promise<CaptureSessionResult> {
    const { pipeline, sessions, facts, decisions, embeddings, vectors } = this.deps;

    const result = await pipeline.run({ raw });
    if (!result.session) throw new Error('Distillation did not produce a session.');
    if (!result.chunks) throw new Error('Distillation did not produce chunks.');

    await sessions.save(result.session);
    for (const fact of result.facts ?? []) await facts.upsert(fact);
    for (const decision of result.decisions ?? []) await decisions.save(decision);

    const vectors$ = await embeddings.embed(result.chunks.map((c) => c.content));
    const embedded: EmbeddedChunk[] = result.chunks.map((chunk, i) => {
      const embedding = vectors$[i];
      if (!embedding) throw new Error(`Missing embedding for chunk ${chunk.id}`);
      return { ...chunk, embedding };
    });
    await vectors.upsert(embedded);

    return {
      sessionId: result.session.id,
      factCount: result.facts?.length ?? 0,
      decisionCount: result.decisions?.length ?? 0,
      chunkCount: result.chunks.length,
    };
  }
}
