#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { captureCommand } from './commands/capture.js';
import { recallCommand } from './commands/recall.js';
import { statusCommand } from './commands/status.js';
import { reindexCommand } from './commands/reindex.js';

const program = new Command()
  .name('ai-context')
  .description('Git-versioned, cross-AI context memory for AI-assisted codebases')
  .version('0.1.0')
  .addCommand(initCommand())
  .addCommand(captureCommand())
  .addCommand(recallCommand())
  .addCommand(statusCommand())
  .addCommand(reindexCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`ai-context: ${message}\n`);
  process.exit(1);
});
