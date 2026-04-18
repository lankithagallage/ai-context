import type { AiContextConfig } from './infrastructure/config/config.js';
import { DEFAULT_REDACTION_PATTERNS, resolvePaths } from './infrastructure/config/config.js';
import { SystemClock } from './application/ports/clock.js';
import { UuidIdGenerator } from './infrastructure/ids/uuid-id-generator.js';
import { OllamaLLMProvider } from './infrastructure/llm/ollama-llm-provider.js';
import { TransformersEmbeddingProvider } from './infrastructure/embeddings/transformers-embedding-provider.js';
import { SqliteVecStore } from './infrastructure/vector/sqlite-vec-store.js';
import { MarkdownSessionRepository } from './infrastructure/repositories/markdown-session-repository.js';
import { MarkdownFactRepository } from './infrastructure/repositories/markdown-fact-repository.js';
import { MarkdownDecisionRepository } from './infrastructure/repositories/markdown-decision-repository.js';
import { DistillationPipeline } from './application/distillation/pipeline.js';
import { RedactStage } from './application/distillation/stages/redact-stage.js';
import { SummarizeStage } from './application/distillation/stages/summarize-stage.js';
import { ExtractFactsStage } from './application/distillation/stages/extract-facts-stage.js';
import { ExtractDecisionsStage } from './application/distillation/stages/extract-decisions-stage.js';
import { ChunkStage } from './application/distillation/stages/chunk-stage.js';
import { CaptureSessionUseCase } from './application/use-cases/capture-session.js';
import { RecallContextUseCase } from './application/use-cases/recall-context.js';
import { StatusUseCase } from './application/use-cases/status.js';
import { ReindexUseCase } from './application/use-cases/reindex.js';

export interface Container {
  readonly captureSession: CaptureSessionUseCase;
  readonly recallContext: RecallContextUseCase;
  readonly status: StatusUseCase;
  readonly reindex: ReindexUseCase;
  readonly close: () => Promise<void>;
}

export interface CreateContainerOptions {
  readonly workspaceRoot: string;
  readonly config: AiContextConfig;
}

export async function createContainer(options: CreateContainerOptions): Promise<Container> {
  const { workspaceRoot, config } = options;
  const paths = resolvePaths(workspaceRoot, config);

  const clock = new SystemClock();
  const idGen = new UuidIdGenerator();

  const llm = new OllamaLLMProvider(config.llm);
  const embeddings = await TransformersEmbeddingProvider.create(config.embeddings);
  const vectors = await SqliteVecStore.create({
    dbPath: paths.indexDbFile,
    dimensions: embeddings.dimensions,
  });

  const sessions = new MarkdownSessionRepository(paths.sessionsDir);
  const facts = new MarkdownFactRepository(paths.factsDir);
  const decisions = new MarkdownDecisionRepository(paths.decisionsDir);

  const redactionPatterns =
    config.redaction.patterns.length > 0 ? config.redaction.patterns : DEFAULT_REDACTION_PATTERNS;

  const pipeline = new DistillationPipeline([
    new RedactStage(redactionPatterns),
    new SummarizeStage({ llm, idGen, clock }),
    new ExtractFactsStage({ llm, idGen, clock }),
    new ExtractDecisionsStage({ llm, decisions, clock }),
    new ChunkStage({ idGen, clock }),
  ]);

  const captureSession = new CaptureSessionUseCase({
    pipeline,
    sessions,
    facts,
    decisions,
    embeddings,
    vectors,
  });
  const recallContext = new RecallContextUseCase({ embeddings, vectors });
  const status = new StatusUseCase({ sessions, facts, decisions, vectors });
  const reindex = new ReindexUseCase({
    sessions,
    facts,
    decisions,
    embeddings,
    vectors,
    idGen,
    clock,
  });

  return {
    captureSession,
    recallContext,
    status,
    reindex,
    close: async () => {
      vectors.close();
    },
  };
}
