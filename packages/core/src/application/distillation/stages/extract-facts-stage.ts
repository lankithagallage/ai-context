import { z } from 'zod';
import type { Stage, DistillationContext } from '../stage.js';
import type { LLMProvider } from '../../ports/llm-provider.js';
import type { Clock } from '../../ports/clock.js';
import type { IdGenerator } from '../../ports/id-generator.js';
import type { Fact } from '../../../domain/fact.js';

const FactsSchema = z.object({
  facts: z
    .array(
      z.object({
        content: z.string().min(4),
        tags: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1).default(0.7),
      }),
    )
    .default([]),
});

const SYSTEM_PROMPT = `Extract atomic, reusable FACTS from this AI coding session that would help a
future AI session understand the codebase without re-reading everything.

A good fact is:
- Self-contained and true *today* (not step-of-a-task)
- Specific: names files, functions, env vars, constants
- Useful for code decisions: "the auth middleware expects header X"
- Tagged with 1-4 short lowercase tags

Skip: task status, small bugs fixed, chit-chat, uncertain conjecture.
Return ONLY valid JSON:

{
  "facts": [
    { "content": string, "tags": string[], "confidence": number /* 0..1 */ }
  ]
}

If no reusable facts, return { "facts": [] }.`;

export interface ExtractFactsStageDeps {
  readonly llm: LLMProvider;
  readonly idGen: IdGenerator;
  readonly clock: Clock;
}

export class ExtractFactsStage implements Stage {
  readonly name = 'extract-facts';
  constructor(private readonly deps: ExtractFactsStageDeps) {}

  async execute(ctx: DistillationContext): Promise<DistillationContext> {
    if (!ctx.session) return ctx;
    const input = ctx.redacted ?? ctx.raw.content;

    const parsed = await this.deps.llm.generateJson({
      jsonSchemaName: 'Facts',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      parse: (raw) => FactsSchema.parse(JSON.parse(raw)),
    });

    const now = this.deps.clock.now();
    const sessionId = ctx.session.id;
    const facts: Fact[] = parsed.facts.map((f) => ({
      id: this.deps.idGen.next(),
      content: f.content.trim(),
      tags: f.tags.map((t) => t.toLowerCase()),
      sourceSessionIds: [sessionId],
      confidence: f.confidence,
      createdAt: now,
      updatedAt: now,
    }));

    return { ...ctx, facts };
  }
}
