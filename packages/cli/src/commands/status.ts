import { Command } from 'commander';
import { createContainer } from '@ai-context/core';
import { loadConfig } from '../lib/load-config.js';

export function statusCommand(): Command {
  return new Command('status').description('Show counts and freshness of the context store').action(async () => {
    const { workspaceRoot, config, paths } = await loadConfig();
    const container = await createContainer({ workspaceRoot, config });
    try {
      const r = await container.status.execute();
      process.stdout.write(`workspace:       ${workspaceRoot}\n`);
      process.stdout.write(`store root:      ${paths.root}\n`);
      process.stdout.write(`sessions:        ${r.sessions}\n`);
      process.stdout.write(`facts:           ${r.facts}\n`);
      process.stdout.write(`decisions:       ${r.decisions}\n`);
      process.stdout.write(`indexed chunks:  ${r.indexedChunks}\n`);
      process.stdout.write(
        `last session:    ${r.lastSessionEndedAt ? r.lastSessionEndedAt.toISOString() : '(none)'}\n`,
      );
    } finally {
      await container.close();
    }
  });
}
