import fs from 'node:fs/promises';
import path from 'node:path';
import type { RawTranscript, ToolName } from '@lankithagallage/ai-context-core';

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

// ~30k chars ≈ 7,500 tokens — fits comfortably in an 8k-context LLM alongside the system prompt
const MAX_TRANSCRIPT_CHARS = 30_000;

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

  const full = parts.join('\n\n');
  if (full.length <= MAX_TRANSCRIPT_CHARS) return full;

  // Keep the tail — the most recent turns carry the most relevant context
  const tail = full.slice(-MAX_TRANSCRIPT_CHARS);
  const firstNewline = tail.indexOf('\n');
  return `[transcript truncated — showing last ~${MAX_TRANSCRIPT_CHARS} chars]\n\n` +
    (firstNewline >= 0 ? tail.slice(firstNewline + 1) : tail);
}

// XML tags injected by Claude Code's harness that add noise to LLM distillation.
// These appear in tool_result content blocks and sometimes in user message text.
const NOISE_TAG_PATTERN = new RegExp(
  '<(?:' +
    [
      'system-reminder',
      'local-command-stdout',
      'local-command-caveat',
      'command-name',
      'command-message',
      'command-args',
      'antml:function_calls',
      'antml:invoke',
      'antml:parameter',
      'function_calls',
      'ide_selection',
      'user-prompt-submit-hook',
    ].join('|') +
    ')[^>]*>[\\s\\S]*?<\\/(?:[a-z-:]+)>',
  'gi',
);

function renderEvent(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;

  // Claude Code JSONL: {type:"user"|"assistant", message:{role, content:[...]}}
  // Fall back to flat format: {role, content}
  const msgObj = e.message && typeof e.message === 'object'
    ? (e.message as Record<string, unknown>)
    : e;

  const role = pickString(msgObj, ['role']) ?? pickString(e, ['type', 'sender']);

  // Only render user/assistant turns — skip queue-operations, metadata, etc.
  if (role !== 'user' && role !== 'assistant') return null;

  const content = extractContent(msgObj);
  if (!content) return null;

  const cleaned = stripNoise(content);
  if (!cleaned.trim()) return null;

  const header = `## ${role}`;
  return `${header}\n\n${cleaned}`;
}

function stripNoise(text: string): string {
  return text
    .replace(NOISE_TAG_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
          // Skip tool_use and tool_result blocks — structured noise, not conversation
          const partType = typeof p.type === 'string' ? p.type : null;
          if (partType === 'tool_use' || partType === 'tool_result') return '';
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
    if (typeof c.content === 'string') return c.content;
  }
  return null;
}
