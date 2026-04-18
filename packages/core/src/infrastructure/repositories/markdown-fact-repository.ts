import fs from 'node:fs/promises';
import path from 'node:path';
import type { Fact } from '../../domain/fact.js';
import type { FactRepository } from '../../application/ports/repositories.js';
import { parseMarkdown, serializeMarkdown } from '../serialization/frontmatter.js';

interface FactFrontmatter extends Record<string, unknown> {
  id: string;
  tags: readonly string[];
  sourceSessionIds: readonly string[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export class MarkdownFactRepository implements FactRepository {
  constructor(private readonly dir: string) {}

  async upsert(fact: Fact): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const data: FactFrontmatter = {
      id: fact.id,
      tags: fact.tags,
      sourceSessionIds: fact.sourceSessionIds,
      confidence: fact.confidence,
      createdAt: fact.createdAt.toISOString(),
      updatedAt: fact.updatedAt.toISOString(),
    };
    await fs.writeFile(this.fileFor(fact.id), serializeMarkdown(data, fact.content), 'utf8');
  }

  async findById(id: string): Promise<Fact | null> {
    try {
      return await this.readFile(this.fileFor(id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async listByTag(tag: string): Promise<readonly Fact[]> {
    const all = await this.list();
    return all.filter((f) => f.tags.includes(tag));
  }

  async list(): Promise<readonly Fact[]> {
    const files = await this.safeReaddir();
    const facts: Fact[] = [];
    for (const f of files) facts.push(await this.readFile(path.join(this.dir, f)));
    facts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return facts;
  }

  private fileFor(id: string): string {
    return path.join(this.dir, `${id}.md`);
  }

  private async safeReaddir(): Promise<string[]> {
    try {
      return (await fs.readdir(this.dir)).filter((f) => f.endsWith('.md'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private async readFile(file: string): Promise<Fact> {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = parseMarkdown<FactFrontmatter>(raw);
    return {
      id: data.id,
      tags: data.tags ?? [],
      sourceSessionIds: data.sourceSessionIds ?? [],
      confidence: data.confidence ?? 0.5,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      content: content.trim(),
    };
  }
}
