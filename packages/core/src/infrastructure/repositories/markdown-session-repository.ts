import fs from 'node:fs/promises';
import path from 'node:path';
import type { Session, SessionParticipant, ToolName } from '../../domain/session.js';
import type { SessionRepository } from '../../application/ports/repositories.js';
import { parseMarkdown, serializeMarkdown } from '../serialization/frontmatter.js';

interface SessionFrontmatter extends Record<string, unknown> {
  id: string;
  tool: ToolName;
  workspace: string;
  branch: string | null;
  startedAt: string;
  endedAt: string;
  participants: readonly SessionParticipant[];
  filesTouched: readonly string[];
  openQuestions: readonly string[];
  rejectedApproaches: readonly string[];
  rawTranscriptRef: string | null;
}

export class MarkdownSessionRepository implements SessionRepository {
  constructor(private readonly dir: string) {}

  async save(session: Session): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const file = this.fileFor(session);
    const body = `# Session summary\n\n${session.summary.trim()}\n`;
    const data: SessionFrontmatter = {
      id: session.id,
      tool: session.tool,
      workspace: session.workspace,
      branch: session.branch,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt.toISOString(),
      participants: session.participants,
      filesTouched: session.filesTouched,
      openQuestions: session.openQuestions,
      rejectedApproaches: session.rejectedApproaches,
      rawTranscriptRef: session.rawTranscriptRef,
    };
    await fs.writeFile(file, serializeMarkdown(data, body), 'utf8');
  }

  async findById(id: string): Promise<Session | null> {
    const files = await this.safeReaddir();
    for (const f of files) {
      const s = await this.readFile(path.join(this.dir, f));
      if (s.id === id) return s;
    }
    return null;
  }

  async list(): Promise<readonly Session[]> {
    const files = await this.safeReaddir();
    const sessions: Session[] = [];
    for (const f of files) sessions.push(await this.readFile(path.join(this.dir, f)));
    sessions.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    return sessions;
  }

  async delete(id: string): Promise<void> {
    const files = await this.safeReaddir();
    for (const f of files) {
      const full = path.join(this.dir, f);
      const s = await this.readFile(full);
      if (s.id === id) {
        await fs.unlink(full);
        return;
      }
    }
  }

  private fileFor(session: Session): string {
    const ts = session.startedAt.toISOString().replace(/[:.]/g, '-');
    return path.join(this.dir, `${ts}--${session.id}.md`);
  }

  private async safeReaddir(): Promise<string[]> {
    try {
      return (await fs.readdir(this.dir)).filter((f) => f.endsWith('.md'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private async readFile(file: string): Promise<Session> {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = parseMarkdown<SessionFrontmatter>(raw);
    return {
      id: data.id,
      tool: data.tool,
      workspace: data.workspace,
      branch: data.branch ?? null,
      startedAt: new Date(data.startedAt),
      endedAt: new Date(data.endedAt),
      participants: data.participants ?? [],
      filesTouched: data.filesTouched ?? [],
      openQuestions: data.openQuestions ?? [],
      rejectedApproaches: data.rejectedApproaches ?? [],
      rawTranscriptRef: data.rawTranscriptRef ?? null,
      summary: stripLeadingHeading(content).trim(),
    };
  }
}

function stripLeadingHeading(md: string): string {
  return md.replace(/^#\s+Session summary\s*\n+/m, '');
}
