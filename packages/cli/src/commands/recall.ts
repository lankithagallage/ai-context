import { Command } from 'commander';
import { createContainer } from '@ai-context/core';
import { loadConfig } from '../lib/load-config.js';

export function recallCommand(): Command {
  return new Command('recall')
    .description('Query the context store and print the top-K relevant chunks')
    .argument('<query...>', 'Task description or question')
    .option('-k, --k <n>', 'Number of chunks to return', '8')
    .option('--json', 'Emit JSON instead of markdown', false)
    .action(async (queryParts: string[], opts: { k: string; json: boolean }) => {
      const query = queryParts.join(' ').trim();
      const k = Number.parseInt(opts.k, 10);
      if (!Number.isFinite(k) || k <= 0) throw new Error('--k must be a positive integer');

      const { workspaceRoot, config } = await loadConfig();
      const container = await createContainer({ workspaceRoot, config });
      try {
        const results = await container.recallContext.execute({ query, k });
        if (opts.json) {
          process.stdout.write(JSON.stringify(results, null, 2) + '\n');
          return;
        }
        if (results.length === 0) {
          process.stdout.write('(no results)\n');
          return;
        }
        for (const r of results) {
          process.stdout.write(
            `\n---\n### [${r.kind}] ${r.sourceId}  (score=${r.score.toFixed(3)})\n\n${r.content}\n`,
          );
        }
      } finally {
        await container.close();
      }
    });
}
