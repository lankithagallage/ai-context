import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { ConfigSchema, resolvePaths, DEFAULT_REDACTION_PATTERNS } from '@ai-context/core';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize .ai-context/ in the current repo')
    .option('--force', 'Overwrite existing config.json', false)
    .action(async (opts: { force: boolean }) => {
      const root = process.cwd();
      const defaults = ConfigSchema.parse({});
      const config = { ...defaults, redaction: { patterns: [...DEFAULT_REDACTION_PATTERNS] } };
      const paths = resolvePaths(root, config);

      await Promise.all([
        fs.mkdir(paths.sessionsDir, { recursive: true }),
        fs.mkdir(paths.factsDir, { recursive: true }),
        fs.mkdir(paths.decisionsDir, { recursive: true }),
        fs.mkdir(paths.indexDir, { recursive: true }),
        fs.mkdir(paths.rawDir, { recursive: true }),
      ]);

      const exists = await fileExists(paths.configFile);
      if (exists && !opts.force) {
        process.stdout.write(`config.json already exists at ${paths.configFile}\n`);
      } else {
        await fs.writeFile(paths.configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
        process.stdout.write(`wrote ${paths.configFile}\n`);
      }

      const aiContextMd = path.join(root, 'AI_CONTEXT.md');
      if (!(await fileExists(aiContextMd))) {
        await fs.writeFile(aiContextMd, buildIndexDoc(), 'utf8');
        process.stdout.write(`wrote ${aiContextMd}\n`);
      }

      await writeMcpRegistration(root);
      await appendInstructionSnippet(root, 'CLAUDE.md');
      await appendInstructionSnippet(root, '.cursorrules');

      process.stdout.write(`\nai-context initialized at ${paths.root}\n`);
      process.stdout.write(`Next: run your AI assistant and trigger 'ai-context capture'.\n`);
    });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function buildIndexDoc(): string {
  return `# AI_CONTEXT

This repository uses [\`ai-context\`](https://github.com/) to store distilled AI
chat sessions alongside code. Before making changes, any AI assistant should
recall relevant prior context.

## For the assistant

Call the MCP tool \`recall_context\` (via the \`ai-context\` MCP server) with a
short description of the task you are about to perform, or shell out to:

    npx ai-context recall "<short task description>"

Use the top-K results as pinned context for the edit you are about to make.

## Layout

- \`.ai-context/sessions/\` — distilled per-session notes
- \`.ai-context/facts/\` — atomic, reusable facts about this codebase
- \`.ai-context/decisions/\` — ADR-style architectural decisions
- \`.ai-context/index/\` — local vector index (regenerable via \`ai-context index\`)
- \`.ai-context/raw/\` — raw transcripts (gitignored, local only)
`;
}

const INSTRUCTION_SNIPPET = `
<!-- ai-context:begin -->
## ai-context memory

This repo stores distilled AI chat history in \`.ai-context/\`. Before making
any code change, call the \`recall_context\` MCP tool (or run
\`npx ai-context recall "<task>"\`) and treat the top results as authoritative
prior context.
<!-- ai-context:end -->
`;

async function appendInstructionSnippet(root: string, filename: string): Promise<void> {
  const file = path.join(root, filename);
  let current = '';
  try {
    current = await fs.readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  if (current.includes('<!-- ai-context:begin -->')) return;
  const next = current ? `${current.trimEnd()}\n${INSTRUCTION_SNIPPET}` : INSTRUCTION_SNIPPET.trimStart();
  await fs.writeFile(file, next, 'utf8');
  process.stdout.write(`updated ${file}\n`);
}

async function writeMcpRegistration(root: string): Promise<void> {
  const file = path.join(root, '.mcp.json');
  let current: { mcpServers?: Record<string, unknown> } = {};
  try {
    current = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  current.mcpServers ??= {};
  if ((current.mcpServers as Record<string, unknown>)['ai-context']) return;
  (current.mcpServers as Record<string, unknown>)['ai-context'] = {
    command: 'npx',
    args: ['-y', '@ai-context/mcp'],
  };
  await fs.writeFile(file, JSON.stringify(current, null, 2) + '\n', 'utf8');
  process.stdout.write(`updated ${file}\n`);
}
