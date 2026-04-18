import { Command } from 'commander';
import { createContainer } from '@ai-context/core';
import { loadConfig } from '../lib/load-config.js';

export function reindexCommand(): Command {
  return new Command('index')
    .description('Rebuild the vector index from the markdown artifacts on disk')
    .action(async () => {
      const { workspaceRoot, config } = await loadConfig();
      const container = await createContainer({ workspaceRoot, config });
      try {
        const r = await container.reindex.execute();
        process.stdout.write(`indexed ${r.chunksIndexed} chunks\n`);
      } finally {
        await container.close();
      }
    });
}
