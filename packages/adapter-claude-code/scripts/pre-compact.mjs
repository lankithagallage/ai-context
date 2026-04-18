#!/usr/bin/env node
// Claude Code hook entry point.
// Reads the hook payload from stdin (JSON), resolves the transcript path,
// and invokes `ai-context capture` against the current working directory.
//
// Wire this up in your Claude Code settings (see README.md) as a PreCompact
// and/or SessionEnd hook. Non-zero exit is swallowed by Claude Code — we keep
// the AI session from being blocked by capture failures.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function pickTranscriptPath(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload.transcript_path ??
    payload.transcriptPath ??
    payload.session_transcript ??
    (payload.session && payload.session.transcript_path) ??
    null
  );
}

async function main() {
  const raw = await readStdin().catch(() => '');
  let payload = null;
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      /* ignore non-JSON payloads */
    }
  }

  const transcriptPath = pickTranscriptPath(payload);
  if (!transcriptPath) {
    process.stderr.write('ai-context-claude-hook: no transcript_path in payload — skipping\n');
    return;
  }

  try {
    await readFile(transcriptPath);
  } catch {
    process.stderr.write(
      `ai-context-claude-hook: transcript not readable at ${transcriptPath}\n`,
    );
    return;
  }

  await new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['-y', '@ai-context/cli', 'capture', '--file', transcriptPath, '--tool', 'claude-code'],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    );
    child.on('close', () => resolve(undefined));
    child.on('error', () => resolve(undefined));
  });
}

main().catch((err) => {
  process.stderr.write(`ai-context-claude-hook: ${err?.message ?? String(err)}\n`);
});
