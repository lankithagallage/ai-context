import type { Stage, DistillationContext } from '../stage.js';
import type { RedactionPattern } from '../../../infrastructure/config/config.js';

export class RedactStage implements Stage {
  readonly name = 'redact';
  private readonly compiled: ReadonlyArray<{ regex: RegExp; replacement: string }>;

  constructor(patterns: readonly RedactionPattern[]) {
    this.compiled = patterns.map((p) => ({
      regex: new RegExp(p.regex, 'g'),
      replacement: p.replacement,
    }));
  }

  async execute(ctx: DistillationContext): Promise<DistillationContext> {
    let text = ctx.raw.content;
    for (const { regex, replacement } of this.compiled) {
      text = text.replace(regex, replacement);
    }
    return { ...ctx, redacted: text };
  }
}
