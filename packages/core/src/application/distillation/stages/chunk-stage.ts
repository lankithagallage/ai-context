import type { Stage, DistillationContext } from '../stage.js';
import type { Clock } from '../../ports/clock.js';
import type { IdGenerator } from '../../ports/id-generator.js';
import type { Chunk } from '../../../domain/chunk.js';

export interface ChunkStageDeps {
  readonly idGen: IdGenerator;
  readonly clock: Clock;
  readonly maxChunkChars?: number;
}

export class ChunkStage implements Stage {
  readonly name = 'chunk';
  private readonly maxChars: number;

  constructor(private readonly deps: ChunkStageDeps) {
    this.maxChars = deps.maxChunkChars ?? 1200;
  }

  async execute(ctx: DistillationContext): Promise<DistillationContext> {
    if (!ctx.session) return ctx;
    const now = this.deps.clock.now();
    const chunks: Chunk[] = [];

    for (const slice of splitText(ctx.session.summary, this.maxChars)) {
      chunks.push({
        id: this.deps.idGen.next(),
        source: { kind: 'session-summary', sourceId: ctx.session.id },
        content: slice,
        tokens: approxTokens(slice),
        createdAt: now,
      });
    }

    for (const fact of ctx.facts ?? []) {
      chunks.push({
        id: this.deps.idGen.next(),
        source: { kind: 'fact', sourceId: fact.id },
        content: fact.content,
        tokens: approxTokens(fact.content),
        createdAt: now,
      });
    }

    for (const decision of ctx.decisions ?? []) {
      const body = `# ${decision.title}\n\nContext: ${decision.context}\n\nDecision: ${decision.decision}\n\nConsequences: ${decision.consequences}`;
      for (const slice of splitText(body, this.maxChars)) {
        chunks.push({
          id: this.deps.idGen.next(),
          source: { kind: 'decision', sourceId: decision.id },
          content: slice,
          tokens: approxTokens(slice),
          createdAt: now,
        });
      }
    }

    return { ...ctx, chunks };
  }
}

function splitText(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > maxChars && buf.length > 0) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
