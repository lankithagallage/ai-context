import type { EmbeddingProvider } from '../ports/embedding-provider.js';
import type { VectorStore } from '../ports/vector-store.js';
import type {
  DecisionRepository,
  FactRepository,
  SessionRepository,
} from '../ports/repositories.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Chunk, EmbeddedChunk } from '../../domain/chunk.js';

export interface ReindexReport {
  readonly chunksIndexed: number;
}

export interface ReindexDeps {
  readonly sessions: SessionRepository;
  readonly facts: FactRepository;
  readonly decisions: DecisionRepository;
  readonly embeddings: EmbeddingProvider;
  readonly vectors: VectorStore;
  readonly idGen: IdGenerator;
  readonly clock: Clock;
  readonly maxChunkChars?: number;
}

export class ReindexUseCase {
  constructor(private readonly deps: ReindexDeps) {}

  async execute(): Promise<ReindexReport> {
    const maxChars = this.deps.maxChunkChars ?? 1200;
    const now = this.deps.clock.now();
    const chunks: Chunk[] = [];

    const sessions = await this.deps.sessions.list();
    for (const s of sessions) {
      for (const slice of split(s.summary, maxChars)) {
        chunks.push({
          id: this.deps.idGen.next(),
          source: { kind: 'session-summary', sourceId: s.id },
          content: slice,
          tokens: Math.ceil(slice.length / 4),
          createdAt: now,
        });
      }
    }

    for (const f of await this.deps.facts.list()) {
      chunks.push({
        id: this.deps.idGen.next(),
        source: { kind: 'fact', sourceId: f.id },
        content: f.content,
        tokens: Math.ceil(f.content.length / 4),
        createdAt: now,
      });
    }

    for (const d of await this.deps.decisions.list()) {
      const body = `# ${d.title}\n\nContext: ${d.context}\n\nDecision: ${d.decision}\n\nConsequences: ${d.consequences}`;
      for (const slice of split(body, maxChars)) {
        chunks.push({
          id: this.deps.idGen.next(),
          source: { kind: 'decision', sourceId: d.id },
          content: slice,
          tokens: Math.ceil(slice.length / 4),
          createdAt: now,
        });
      }
    }

    if (chunks.length === 0) return { chunksIndexed: 0 };

    const vectors = await this.deps.embeddings.embed(chunks.map((c) => c.content));
    const embedded: EmbeddedChunk[] = chunks.map((chunk, i) => {
      const embedding = vectors[i];
      if (!embedding) throw new Error(`Missing embedding for chunk ${chunk.id}`);
      return { ...chunk, embedding };
    });
    await this.deps.vectors.upsert(embedded);
    return { chunksIndexed: embedded.length };
  }
}

function split(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];
  const paragraphs = trimmed.split(/\n{2,}/);
  const out: string[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > maxChars && buf) {
      out.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) out.push(buf);
  return out;
}
