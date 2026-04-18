import type { Session } from '../../domain/session.js';
import type { Fact } from '../../domain/fact.js';
import type { Decision } from '../../domain/decision.js';

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  list(): Promise<readonly Session[]>;
  delete(id: string): Promise<void>;
}

export interface FactRepository {
  upsert(fact: Fact): Promise<void>;
  findById(id: string): Promise<Fact | null>;
  listByTag(tag: string): Promise<readonly Fact[]>;
  list(): Promise<readonly Fact[]>;
}

export interface DecisionRepository {
  save(decision: Decision): Promise<void>;
  findById(id: string): Promise<Decision | null>;
  list(): Promise<readonly Decision[]>;
  nextId(): Promise<string>;
}
