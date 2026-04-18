import { describe, it, expect } from 'vitest';
import { CaptureSessionUseCase } from '../src/application/use-cases/capture-session.js';
import { DistillationPipeline } from '../src/application/distillation/pipeline.js';
import { RedactStage } from '../src/application/distillation/stages/redact-stage.js';
import { SummarizeStage } from '../src/application/distillation/stages/summarize-stage.js';
import { ExtractFactsStage } from '../src/application/distillation/stages/extract-facts-stage.js';
import { ExtractDecisionsStage } from '../src/application/distillation/stages/extract-decisions-stage.js';
import { ChunkStage } from '../src/application/distillation/stages/chunk-stage.js';
import {
  FixedClock,
  HashEmbeddingProvider,
  InMemoryDecisionRepository,
  InMemoryFactRepository,
  InMemorySessionRepository,
  InMemoryVectorStore,
  ScriptedLLMProvider,
  SequentialIdGenerator,
} from './fakes.js';

describe('CaptureSessionUseCase', () => {
  it('runs the pipeline and persists session, facts, decisions, and index entries', async () => {
    const clock = new FixedClock(new Date('2026-04-18T19:00:00.000Z'));
    const idGen = new SequentialIdGenerator('x');
    const sessions = new InMemorySessionRepository();
    const facts = new InMemoryFactRepository();
    const decisions = new InMemoryDecisionRepository();
    const vectors = new InMemoryVectorStore();
    const embeddings = new HashEmbeddingProvider();

    const llm = new ScriptedLLMProvider({
      SessionSummary: {
        summary: 'Refactored auth middleware to use JWT instead of sessions.',
        filesTouched: ['src/auth/middleware.ts'],
        openQuestions: ['Rotate secret via env var?'],
        rejectedApproaches: ['Keeping server-side session store'],
      },
      Facts: {
        facts: [
          {
            content: 'Auth middleware now expects Bearer JWT in Authorization header.',
            tags: ['auth', 'jwt'],
            confidence: 0.95,
          },
        ],
      },
      Decisions: {
        decisions: [
          {
            title: 'Use JWT for auth',
            context: 'Sessions were leaking memory across instances.',
            decision: 'Switch to stateless JWT validation.',
            consequences: 'Secret rotation becomes operationally important.',
          },
        ],
      },
    });

    const pipeline = new DistillationPipeline([
      new RedactStage([]),
      new SummarizeStage({ llm, idGen, clock }),
      new ExtractFactsStage({ llm, idGen, clock }),
      new ExtractDecisionsStage({ llm, decisions, clock }),
      new ChunkStage({ idGen, clock }),
    ]);

    const useCase = new CaptureSessionUseCase({
      pipeline,
      sessions,
      facts,
      decisions,
      embeddings,
      vectors,
    });

    const result = await useCase.execute({
      tool: 'claude-code',
      workspace: '/tmp/demo',
      branch: 'main',
      startedAt: new Date('2026-04-18T18:00:00.000Z'),
      endedAt: new Date('2026-04-18T18:30:00.000Z'),
      content: 'user: refactor auth\nassistant: using JWT now',
    });

    expect(result.factCount).toBe(1);
    expect(result.decisionCount).toBe(1);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(await vectors.count()).toBe(result.chunkCount);

    const [session] = await sessions.list();
    expect(session?.tool).toBe('claude-code');
    expect(session?.filesTouched).toContain('src/auth/middleware.ts');

    const [decision] = await decisions.list();
    expect(decision?.title).toBe('Use JWT for auth');
    expect(decision?.id).toMatch(/^\d{4}$/);
  });
});
