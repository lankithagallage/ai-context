import type {
  DecisionRepository,
  FactRepository,
  SessionRepository,
} from '../ports/repositories.js';
import type { VectorStore } from '../ports/vector-store.js';

export interface StatusReport {
  readonly sessions: number;
  readonly facts: number;
  readonly decisions: number;
  readonly indexedChunks: number;
  readonly lastSessionEndedAt: Date | null;
}

export interface StatusDeps {
  readonly sessions: SessionRepository;
  readonly facts: FactRepository;
  readonly decisions: DecisionRepository;
  readonly vectors: VectorStore;
}

export class StatusUseCase {
  constructor(private readonly deps: StatusDeps) {}

  async execute(): Promise<StatusReport> {
    const [sessions, facts, decisions, indexedChunks] = await Promise.all([
      this.deps.sessions.list(),
      this.deps.facts.list(),
      this.deps.decisions.list(),
      this.deps.vectors.count(),
    ]);

    const lastSessionEndedAt = sessions.reduce<Date | null>((latest, s) => {
      if (!latest || s.endedAt > latest) return s.endedAt;
      return latest;
    }, null);

    return {
      sessions: sessions.length,
      facts: facts.length,
      decisions: decisions.length,
      indexedChunks,
      lastSessionEndedAt,
    };
  }
}
