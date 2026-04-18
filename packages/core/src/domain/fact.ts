export interface Fact {
  readonly id: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly sourceSessionIds: readonly string[];
  readonly confidence: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
