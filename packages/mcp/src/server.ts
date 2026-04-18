import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ConfigSchema,
  createContainer,
  resolvePaths,
  type AiContextConfig,
  type Container,
  type ToolName,
} from '@ai-context/core';

const TOOL_NAMES: readonly ToolName[] = [
  'claude-code',
  'cursor',
  'copilot',
  'chatgpt',
  'windsurf',
  'cline',
  'continue',
  'unknown',
];

async function loadConfig(workspaceRoot: string): Promise<AiContextConfig> {
  const file = path.join(workspaceRoot, '.ai-context', 'config.json');
  try {
    const text = await fs.readFile(file, 'utf8');
    return ConfigSchema.parse(JSON.parse(text));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return ConfigSchema.parse({});
  }
}

export async function startServer(workspaceRoot: string = process.cwd()): Promise<void> {
  const config = await loadConfig(workspaceRoot);
  const paths = resolvePaths(workspaceRoot, config);
  await fs.mkdir(paths.root, { recursive: true });
  const container: Container = await createContainer({ workspaceRoot, config });

  const server = new McpServer({ name: 'ai-context', version: '0.1.0' });

  server.registerTool(
    'recall_context',
    {
      title: 'Recall relevant prior project context',
      description:
        'Search the repo-local context store and return the top-K chunks most relevant to the task you are about to work on. Call this BEFORE editing code.',
      inputSchema: {
        query: z.string().min(1).describe('Short description of the task you are about to perform'),
        k: z.number().int().min(1).max(50).default(8),
        kinds: z
          .array(z.enum(['session-summary', 'fact', 'decision']))
          .optional()
          .describe('Optionally limit to these kinds'),
      },
    },
    async ({ query, k, kinds }) => {
      const results = await container.recallContext.execute({
        query,
        k,
        ...(kinds ? { filters: { kinds } } : {}),
      });
      if (results.length === 0) {
        return { content: [{ type: 'text', text: '(no results)' }] };
      }
      const md = results
        .map(
          (r) =>
            `### [${r.kind}] ${r.sourceId}  (score=${r.score.toFixed(3)})\n\n${r.content}`,
        )
        .join('\n\n---\n\n');
      return { content: [{ type: 'text', text: md }] };
    },
  );

  server.registerTool(
    'save_session',
    {
      title: 'Distill and persist a raw transcript',
      description:
        'Run the distillation pipeline on a raw transcript and commit the resulting session, facts, decisions, and index entries.',
      inputSchema: {
        tool: z.enum(TOOL_NAMES as readonly [ToolName, ...ToolName[]]).default('unknown'),
        branch: z.string().nullable().default(null),
        content: z.string().min(1).describe('Raw transcript text'),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime().optional(),
      },
    },
    async ({ tool, branch, content, startedAt, endedAt }) => {
      const now = new Date();
      const result = await container.captureSession.execute({
        tool,
        branch,
        workspace: workspaceRoot,
        startedAt: startedAt ? new Date(startedAt) : now,
        endedAt: endedAt ? new Date(endedAt) : now,
        content,
      });
      return {
        content: [
          {
            type: 'text',
            text: `saved session ${result.sessionId}: ${result.factCount} facts, ${result.decisionCount} decisions, ${result.chunkCount} chunks indexed`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'list_decisions',
    {
      title: 'List architectural decisions (ADRs) recorded in this repo',
      description: 'Return all decisions. Useful when asked "why did we choose X?"',
      inputSchema: {},
    },
    async () => {
      const r = await container.status.execute();
      const md = `sessions=${r.sessions}  facts=${r.facts}  decisions=${r.decisions}  indexed_chunks=${r.indexedChunks}`;
      return { content: [{ type: 'text', text: md }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
