import { Command } from 'commander';
import { createContainer, type ToolName } from '@ai-context/core';
import { loadConfig } from '../lib/load-config.js';
import { parseTranscript } from '../lib/parse-transcript.js';

const TOOLS: readonly ToolName[] = [
  'claude-code',
  'cursor',
  'copilot',
  'chatgpt',
  'windsurf',
  'cline',
  'continue',
  'unknown',
];

export function captureCommand(): Command {
  return new Command('capture')
    .description('Distill a raw transcript file and persist artifacts + index')
    .requiredOption('-f, --file <path>', 'Path to the raw transcript (jsonl, md, txt)')
    .option('-t, --tool <name>', `Source AI tool (one of: ${TOOLS.join(', ')})`, 'unknown')
    .option('--branch <name>', 'Git branch this session belongs to', '')
    .action(async (opts: { file: string; tool: string; branch: string }) => {
      if (!TOOLS.includes(opts.tool as ToolName)) {
        throw new Error(`Unknown tool "${opts.tool}". Use one of: ${TOOLS.join(', ')}`);
      }
      const { workspaceRoot, config } = await loadConfig();
      const container = await createContainer({ workspaceRoot, config });
      try {
        const raw = await parseTranscript({
          filePath: opts.file,
          tool: opts.tool as ToolName,
          workspace: workspaceRoot,
          branch: opts.branch ? opts.branch : null,
        });
        const result = await container.captureSession.execute(raw);
        process.stdout.write(
          `captured session ${result.sessionId}: ${result.factCount} facts, ${result.decisionCount} decisions, ${result.chunkCount} chunks indexed\n`,
        );
      } finally {
        await container.close();
      }
    });
}
