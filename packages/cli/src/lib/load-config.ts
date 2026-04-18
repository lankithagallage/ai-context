import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ConfigSchema,
  resolvePaths,
  type AiContextConfig,
  type ResolvedPaths,
} from '@ai-context/core';

export interface LoadedConfig {
  readonly workspaceRoot: string;
  readonly config: AiContextConfig;
  readonly paths: ResolvedPaths;
}

export async function findWorkspaceRoot(start: string = process.cwd()): Promise<string> {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, '.ai-context', 'config.json');
    try {
      await fs.access(candidate);
      return dir;
    } catch {
      /* not here */
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export async function loadConfig(workspaceRoot?: string): Promise<LoadedConfig> {
  const root = workspaceRoot ?? (await findWorkspaceRoot());
  const configFile = path.join(root, '.ai-context', 'config.json');

  let raw: unknown = {};
  try {
    const text = await fs.readFile(configFile, 'utf8');
    raw = JSON.parse(text);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const config = ConfigSchema.parse(raw);
  return { workspaceRoot: root, config, paths: resolvePaths(root, config) };
}
