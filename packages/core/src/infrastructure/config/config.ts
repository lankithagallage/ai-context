import { z } from 'zod';
import path from 'node:path';

export const RedactionPatternSchema = z.object({
  name: z.string(),
  regex: z.string(),
  replacement: z.string().default('[REDACTED]'),
});

export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  llm: z
    .object({
      provider: z.literal('ollama').default('ollama'),
      baseUrl: z.string().url().default('http://localhost:11434'),
      model: z.string().default('llama3.1:8b'),
      temperature: z.number().min(0).max(2).default(0.2),
      requestTimeoutMs: z.number().int().positive().default(120_000),
    })
    .default({}),
  embeddings: z
    .object({
      provider: z.literal('transformers').default('transformers'),
      model: z.string().default('Xenova/all-MiniLM-L6-v2'),
      dimensions: z.number().int().positive().default(384),
    })
    .default({}),
  storage: z
    .object({
      root: z.string().default('.ai-context'),
    })
    .default({}),
  redaction: z
    .object({
      patterns: z.array(RedactionPatternSchema).default([]),
    })
    .default({}),
});

export type AiContextConfig = z.infer<typeof ConfigSchema>;
export type RedactionPattern = z.infer<typeof RedactionPatternSchema>;

export interface ResolvedPaths {
  readonly root: string;
  readonly sessionsDir: string;
  readonly factsDir: string;
  readonly decisionsDir: string;
  readonly indexDir: string;
  readonly rawDir: string;
  readonly configFile: string;
  readonly indexDbFile: string;
  readonly manifestFile: string;
}

export function resolvePaths(workspaceRoot: string, config: AiContextConfig): ResolvedPaths {
  const root = path.resolve(workspaceRoot, config.storage.root);
  return {
    root,
    sessionsDir: path.join(root, 'sessions'),
    factsDir: path.join(root, 'facts'),
    decisionsDir: path.join(root, 'decisions'),
    indexDir: path.join(root, 'index'),
    rawDir: path.join(root, 'raw'),
    configFile: path.join(root, 'config.json'),
    indexDbFile: path.join(root, 'index', 'vectors.sqlite'),
    manifestFile: path.join(root, 'index', 'manifest.jsonl'),
  };
}

export const DEFAULT_REDACTION_PATTERNS: readonly RedactionPattern[] = [
  { name: 'openai-key', regex: 'sk-[A-Za-z0-9]{20,}', replacement: '[REDACTED_OPENAI_KEY]' },
  {
    name: 'anthropic-key',
    regex: 'sk-ant-[A-Za-z0-9_-]{20,}',
    replacement: '[REDACTED_ANTHROPIC_KEY]',
  },
  { name: 'github-pat', regex: 'ghp_[A-Za-z0-9]{30,}', replacement: '[REDACTED_GH_PAT]' },
  { name: 'aws-access-key', regex: 'AKIA[0-9A-Z]{16}', replacement: '[REDACTED_AWS_KEY]' },
  {
    name: 'jwt',
    regex: 'eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
    replacement: '[REDACTED_JWT]',
  },
  {
    name: 'bearer-token',
    regex: 'Bearer\\s+[A-Za-z0-9._~+/=-]{20,}',
    replacement: 'Bearer [REDACTED]',
  },
  {
    name: 'email',
    regex: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
    replacement: '[REDACTED_EMAIL]',
  },
];
