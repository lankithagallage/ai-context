import type { DistillationContext, Stage } from './stage.js';

export class DistillationPipeline {
  constructor(private readonly stages: readonly Stage[]) {}

  async run(initial: DistillationContext): Promise<DistillationContext> {
    let ctx = initial;
    for (const stage of this.stages) {
      ctx = await stage.execute(ctx);
    }
    return ctx;
  }
}
