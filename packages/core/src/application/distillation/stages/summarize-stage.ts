import { z } from 'zod';
import type { Stage, DistillationContext } from '../stage.js';
import type { LLMProvider } from '../../ports/llm-provider.js';
import type { Clock } from '../../ports/clock.js';
import type { IdGenerator } from '../../ports/id-generator.js';
import type { Session } from '../../../domain/session.js';

const SummarySchema = z.object({
  summary: z.string(),
  filesTouched: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  rejectedApproaches: z.array(z.string()).default([]),
});

const SYSTEM_PROMPT = `You are a technical note-taker distilling a software-development AI assistant
conversation into a session record that a *future AI session* will use to avoid
repeating work and to maintain continuity.

Focus on what a fresh AI session would need to know to continue this project:
- What was actually accomplished (not step-by-step, just outcomes)
- Files created, modified, or discussed
- Architectural choices and why
- Dead-ends that were tried and abandoned
- Open questions or unresolved issues

Do NOT include chit-chat, self-correction, or verbose explanations.
Return ONLY valid JSON matching this exact shape:

{
  "summary": string,
  "filesTouched": string[],
  "openQuestions": string[],
  "rejectedApproaches": string[]
}`;

export interface SummarizeStageDeps {
  readonly llm: LLMProvider;
  readonly idGen: IdGenerator;
  readonly clock: Clock;
}

export class SummarizeStage implements Stage {
  readonly name = 'summarize';
  constructor(private readonly deps: SummarizeStageDeps) {}

  async execute(ctx: DistillationContext): Promise<DistillationContext> {
    const input = ctx.redacted ?? ctx.raw.content;
    const parsed = await this.deps.llm.generateJson({
      jsonSchemaName: 'SessionSummary',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      parse: (raw) => SummarySchema.parse(JSON.parse(raw)),
    });

    const session: Session = {
      id: this.deps.idGen.next(),
      tool: ctx.raw.tool,
      workspace: ctx.raw.workspace,
      branch: ctx.raw.branch,
      startedAt: ctx.raw.startedAt,
      endedAt: ctx.raw.endedAt,
      participants: [{ role: 'user' }, { role: 'assistant' }],
      summary: parsed.summary,
      filesTouched: parsed.filesTouched,
      openQuestions: parsed.openQuestions,
      rejectedApproaches: parsed.rejectedApproaches,
      rawTranscriptRef: null,
    };

    return { ...ctx, session };
  }
}
