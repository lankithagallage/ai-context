import { z } from 'zod';
import type { Stage, DistillationContext } from '../stage.js';
import type { LLMProvider } from '../../ports/llm-provider.js';
import type { Clock } from '../../ports/clock.js';
import type { DecisionRepository } from '../../ports/repositories.js';
import type { Decision } from '../../../domain/decision.js';

const DecisionsSchema = z.object({
  decisions: z
    .array(
      z.object({
        title: z.string().min(3),
        context: z.string(),
        decision: z.string(),
        consequences: z.string(),
      }),
    )
    .default([]),
});

const SYSTEM_PROMPT = `Extract any ARCHITECTURAL DECISIONS made in this AI coding session that are
worth capturing as ADRs. Only substantive decisions — technology choices,
architectural tradeoffs, protocol choices, data model shape. NOT:
- naming tweaks, refactors, or typos
- choices that could be trivially reversed

Return ONLY valid JSON:

{
  "decisions": [
    {
      "title": "Short title (imperative mood)",
      "context": "Why this came up — the problem or constraint",
      "decision": "What was decided",
      "consequences": "Tradeoffs, follow-ups, what it forecloses"
    }
  ]
}

If none, return { "decisions": [] }.`;

export interface ExtractDecisionsStageDeps {
  readonly llm: LLMProvider;
  readonly decisions: DecisionRepository;
  readonly clock: Clock;
}

export class ExtractDecisionsStage implements Stage {
  readonly name = 'extract-decisions';
  constructor(private readonly deps: ExtractDecisionsStageDeps) {}

  async execute(ctx: DistillationContext): Promise<DistillationContext> {
    if (!ctx.session) return ctx;
    const input = ctx.redacted ?? ctx.raw.content;

    const parsed = await this.deps.llm.generateJson({
      jsonSchemaName: 'Decisions',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      parse: (raw) => DecisionsSchema.parse(JSON.parse(raw)),
    });

    const now = this.deps.clock.now();
    const sessionId = ctx.session.id;
    const decisions: Decision[] = [];
    for (const d of parsed.decisions) {
      const id = await this.deps.decisions.nextId();
      decisions.push({
        id,
        title: d.title.trim(),
        status: 'accepted',
        context: d.context.trim(),
        decision: d.decision.trim(),
        consequences: d.consequences.trim(),
        sourceSessionIds: [sessionId],
        supersedes: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { ...ctx, decisions };
  }
}
