import type { Session } from '../../domain/session.js';
import type { Fact } from '../../domain/fact.js';
import type { Decision } from '../../domain/decision.js';
import type { Chunk } from '../../domain/chunk.js';

export interface RawTranscript {
  readonly tool: Session['tool'];
  readonly workspace: string;
  readonly branch: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly content: string;
}

export interface DistillationContext {
  readonly raw: RawTranscript;
  redacted?: string;
  session?: Session;
  facts?: readonly Fact[];
  decisions?: readonly Decision[];
  chunks?: readonly Chunk[];
}

export interface Stage {
  readonly name: string;
  execute(ctx: DistillationContext): Promise<DistillationContext>;
}
