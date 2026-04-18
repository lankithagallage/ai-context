export type DecisionStatus = 'proposed' | 'accepted' | 'superseded' | 'rejected';

export interface Decision {
  readonly id: string;
  readonly title: string;
  readonly status: DecisionStatus;
  readonly context: string;
  readonly decision: string;
  readonly consequences: string;
  readonly sourceSessionIds: readonly string[];
  readonly supersedes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
