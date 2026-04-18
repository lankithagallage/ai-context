import type {
  Clock,
  DecisionRepository,
  EmbeddingProvider,
  FactRepository,
  IdGenerator,
  LLMGenerateOptions,
  LLMJsonOptions,
  LLMProvider,
  SessionRepository,
  VectorSearchOptions,
  VectorStore,
} from '../src/application/index.js';
import type { Decision, EmbeddedChunk, Fact, RecalledChunk, Session } from '../src/domain/index.js';

export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  constructor(private readonly prefix = 'id') {}
  next(): string {
    this.n += 1;
    return `${this.prefix}_${this.n}`;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly items = new Map<string, Session>();
  async save(s: Session): Promise<void> {
    this.items.set(s.id, s);
  }
  async findById(id: string): Promise<Session | null> {
    return this.items.get(id) ?? null;
  }
  async list(): Promise<readonly Session[]> {
    return [...this.items.values()];
  }
  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

export class InMemoryFactRepository implements FactRepository {
  private readonly items = new Map<string, Fact>();
  async upsert(f: Fact): Promise<void> {
    this.items.set(f.id, f);
  }
  async findById(id: string): Promise<Fact | null> {
    return this.items.get(id) ?? null;
  }
  async listByTag(tag: string): Promise<readonly Fact[]> {
    return [...this.items.values()].filter((f) => f.tags.includes(tag));
  }
  async list(): Promise<readonly Fact[]> {
    return [...this.items.values()];
  }
}

export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly items = new Map<string, Decision>();
  async save(d: Decision): Promise<void> {
    this.items.set(d.id, d);
  }
  async findById(id: string): Promise<Decision | null> {
    return this.items.get(id) ?? null;
  }
  async list(): Promise<readonly Decision[]> {
    return [...this.items.values()];
  }
  async nextId(): Promise<string> {
    return String(this.items.size + 1).padStart(4, '0');
  }
}

export class InMemoryVectorStore implements VectorStore {
  private readonly items = new Map<string, EmbeddedChunk>();
  async upsert(chunks: readonly EmbeddedChunk[]): Promise<void> {
    for (const c of chunks) this.items.set(c.id, c);
  }
  async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.items.delete(id);
  }
  async search(options: VectorSearchOptions): Promise<readonly RecalledChunk[]> {
    const results: Array<{ chunk: EmbeddedChunk; score: number }> = [];
    for (const chunk of this.items.values()) {
      if (options.filters?.kinds && !options.filters.kinds.includes(chunk.source.kind)) continue;
      const score = cosineSimilarity(options.embedding, chunk.embedding);
      results.push({ chunk, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options.k).map(({ chunk, score }) => ({
      chunkId: chunk.id,
      kind: chunk.source.kind,
      sourceId: chunk.source.sourceId,
      score,
      content: chunk.content,
    }));
  }
  async count(): Promise<number> {
    return this.items.size;
  }
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 16;
  readonly modelId = 'fake-hash-16';
  async embed(texts: readonly string[]): Promise<ReadonlyArray<ReadonlyArray<number>>> {
    return texts.map((t) => toVector(t, this.dimensions));
  }
}

export class ScriptedLLMProvider implements LLMProvider {
  constructor(private readonly responses: Record<string, unknown>) {}
  async generate(opts: LLMGenerateOptions): Promise<string> {
    return JSON.stringify(this.responses[lastUser(opts)] ?? {});
  }
  async generateJson<T>(opts: LLMJsonOptions<T>): Promise<T> {
    const key = opts.jsonSchemaName;
    const value = this.responses[key];
    if (value === undefined) throw new Error(`ScriptedLLMProvider has no response for "${key}"`);
    return opts.parse(JSON.stringify(value));
  }
}

function lastUser(opts: LLMGenerateOptions): string {
  for (let i = opts.messages.length - 1; i >= 0; i -= 1) {
    const m = opts.messages[i];
    if (m && m.role === 'user') return m.content;
  }
  return '';
}

function cosineSimilarity(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

function toVector(text: string, dims: number): number[] {
  const v = new Array<number>(dims).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const idx = text.charCodeAt(i) % dims;
    v[idx] = (v[idx] ?? 0) + 1;
  }
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / mag);
}
