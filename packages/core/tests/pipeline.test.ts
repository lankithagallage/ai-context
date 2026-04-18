import { describe, it, expect } from 'vitest';
import { DistillationPipeline } from '../src/application/distillation/pipeline.js';
import type { Stage, DistillationContext } from '../src/application/distillation/stage.js';

class TagStage implements Stage {
  constructor(
    readonly name: string,
    private readonly tag: string,
  ) {}
  async execute(ctx: DistillationContext): Promise<DistillationContext> {
    return { ...ctx, redacted: `${ctx.redacted ?? ''}${this.tag}` };
  }
}

describe('DistillationPipeline', () => {
  it('runs stages in declaration order', async () => {
    const pipeline = new DistillationPipeline([
      new TagStage('a', '[A]'),
      new TagStage('b', '[B]'),
      new TagStage('c', '[C]'),
    ]);
    const out = await pipeline.run({
      raw: {
        tool: 'unknown',
        workspace: '/tmp',
        branch: null,
        startedAt: new Date(),
        endedAt: new Date(),
        content: '',
      },
    });
    expect(out.redacted).toBe('[A][B][C]');
  });
});
