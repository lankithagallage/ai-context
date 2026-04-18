import { describe, it, expect } from 'vitest';
import { RedactStage } from '../src/application/distillation/stages/redact-stage.js';
import { DEFAULT_REDACTION_PATTERNS } from '../src/infrastructure/config/config.js';

describe('RedactStage', () => {
  it('redacts default secret patterns from the raw transcript', async () => {
    const stage = new RedactStage(DEFAULT_REDACTION_PATTERNS);
    const ctx = await stage.execute({
      raw: {
        tool: 'claude-code',
        workspace: '/tmp',
        branch: null,
        startedAt: new Date(),
        endedAt: new Date(),
        content: [
          'Here is my openai key: sk-abcdefghijklmnopqrstuvwxyz1234567890',
          'bearer: Bearer abcdefghijklmnopqrstuvwxyz1234567890',
          'and my email lankithagallage@gmail.com',
        ].join('\n'),
      },
    });

    expect(ctx.redacted).toBeDefined();
    expect(ctx.redacted).not.toMatch(/sk-abcdef/);
    expect(ctx.redacted).toContain('[REDACTED_OPENAI_KEY]');
    expect(ctx.redacted).toContain('Bearer [REDACTED]');
    expect(ctx.redacted).toContain('[REDACTED_EMAIL]');
  });

  it('passes through when no patterns match', async () => {
    const stage = new RedactStage(DEFAULT_REDACTION_PATTERNS);
    const ctx = await stage.execute({
      raw: {
        tool: 'claude-code',
        workspace: '/tmp',
        branch: null,
        startedAt: new Date(),
        endedAt: new Date(),
        content: 'totally clean transcript with nothing sensitive',
      },
    });
    expect(ctx.redacted).toBe('totally clean transcript with nothing sensitive');
  });
});
