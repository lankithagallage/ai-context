import fs from 'node:fs/promises';
import path from 'node:path';
import type { RawTranscript, ToolName } from '@ai-context/core';

export interface ParseTranscriptOptions {
  readonly filePath: string;
  readonly tool: ToolName;
  readonly workspace: string;
  readonly branch: string | null;
}

export async function parseTranscript(opts: ParseTranscriptOptions): Promise<RawTranscript> {
  const raw = await fs.readFile(opts.filePath, 'utf8');
  const ext = path.extname(opts.filePath).toLowerCase();
  const content = ext === '.jsonl' ? renderJsonlToMarkdown(raw) : raw;
  const stat = await fs.stat(opts.filePath);

  return {
    tool: opts.tool,
    workspace: opts.workspace,
    branch: opts.branch,
    startedAt: stat.birthtime,
    endedAt: stat.mtime,
    content,
  };
}

function renderJsonlToMarkdown(jsonl: string): string {
  const lines = jsonl.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const parts: string[] = [];

  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const rendered = renderEvent(event);
    if (rendered) parts.push(rendered);
  }
  return parts.join('\n\n');
}

function renderEvent(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  const role = pickString(e, ['role', 'type', 'sender']);
  const content = extractContent(e);
  if (!content) return null;
  const header = role ? `## ${role}` : '##';
  return `${header}\n\n${content}`;
}

function pickString(e: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = e[k];
    if (typeof v === 'string') return v;
  }
  return null;
}

function extractContent(e: Record<string, unknown>): string | null {
  const content = e.content ?? e.text ?? e.message;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (typeof p.text === 'string') return p.text;
          if (typeof p.content === 'string') return p.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (typeof c.text === 'string') return c.text;
  }
  return null;
}
