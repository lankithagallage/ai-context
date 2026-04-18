import fs from 'node:fs/promises';
import path from 'node:path';
import type { Decision, DecisionStatus } from '../../domain/decision.js';
import type { DecisionRepository } from '../../application/ports/repositories.js';
import { parseMarkdown, serializeMarkdown } from '../serialization/frontmatter.js';

interface DecisionFrontmatter extends Record<string, unknown> {
  id: string;
  title: string;
  status: DecisionStatus;
  supersedes: string | null;
  sourceSessionIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export class MarkdownDecisionRepository implements DecisionRepository {
  constructor(private readonly dir: string) {}

  async save(decision: Decision): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const body = [
      `# ${decision.title}`,
      '',
      '## Context',
      '',
      decision.context.trim(),
      '',
      '## Decision',
      '',
      decision.decision.trim(),
      '',
      '## Consequences',
      '',
      decision.consequences.trim(),
      '',
    ].join('\n');

    const data: DecisionFrontmatter = {
      id: decision.id,
      title: decision.title,
      status: decision.status,
      supersedes: decision.supersedes,
      sourceSessionIds: decision.sourceSessionIds,
      createdAt: decision.createdAt.toISOString(),
      updatedAt: decision.updatedAt.toISOString(),
    };

    await fs.writeFile(this.fileFor(decision), serializeMarkdown(data, body), 'utf8');
  }

  async findById(id: string): Promise<Decision | null> {
    const files = await this.safeReaddir();
    for (const f of files) {
      const d = await this.readFile(path.join(this.dir, f));
      if (d.id === id) return d;
    }
    return null;
  }

  async list(): Promise<readonly Decision[]> {
    const files = await this.safeReaddir();
    const out: Decision[] = [];
    for (const f of files) out.push(await this.readFile(path.join(this.dir, f)));
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }

  async nextId(): Promise<string> {
    const decisions = await this.list();
    const maxN = decisions.reduce((n, d) => {
      const parsed = Number.parseInt(d.id, 10);
      return Number.isFinite(parsed) && parsed > n ? parsed : n;
    }, 0);
    return String(maxN + 1).padStart(4, '0');
  }

  private fileFor(decision: Decision): string {
    const slug = decision.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);
    return path.join(this.dir, `${decision.id}-${slug || 'decision'}.md`);
  }

  private async safeReaddir(): Promise<string[]> {
    try {
      return (await fs.readdir(this.dir)).filter((f) => f.endsWith('.md'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private async readFile(file: string): Promise<Decision> {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = parseMarkdown<DecisionFrontmatter>(raw);
    return {
      id: data.id,
      title: data.title,
      status: data.status,
      supersedes: data.supersedes ?? null,
      sourceSessionIds: data.sourceSessionIds ?? [],
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      ...parseAdrSections(content),
    };
  }
}

function parseAdrSections(md: string): Pick<Decision, 'context' | 'decision' | 'consequences'> {
  const section = (name: string): string => {
    const re = new RegExp(`##\\s+${name}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
    const m = md.match(re);
    return (m?.[1] ?? '').trim();
  };
  return {
    context: section('Context'),
    decision: section('Decision'),
    consequences: section('Consequences'),
  };
}
