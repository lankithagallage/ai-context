import fs from 'node:fs';
import path from 'node:path';
import type { EmbeddedChunk } from '../../domain/chunk.js';
import type { RecalledChunk } from '../../domain/context-query.js';
import type { VectorSearchOptions, VectorStore } from '../../application/ports/vector-store.js';

export interface SqliteVecStoreConfig {
  readonly dbPath: string;
  readonly dimensions: number;
}

type Statement = {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
};
type Db = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  close(): void;
};

export class SqliteVecStore implements VectorStore {
  private constructor(
    private readonly db: Db,
    private readonly dims: number,
  ) {}

  static async create(config: SqliteVecStoreConfig): Promise<SqliteVecStore> {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    const [{ default: Database }, sqliteVec] = await Promise.all([
      import('better-sqlite3'),
      import('sqlite-vec'),
    ]);
    const db = new Database(config.dbPath) as unknown as Db & { loadExtension?: (p: string) => void };
    sqliteVec.load(db as unknown as Parameters<typeof sqliteVec.load>[0]);

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        embedding float[${config.dimensions}]
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        rowid INTEGER UNIQUE,
        kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_kind ON chunks(kind);
      CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id);
    `);

    return new SqliteVecStore(db, config.dimensions);
  }

  async upsert(chunks: readonly EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const dims = this.dims;

    const getRowId = this.db.prepare('SELECT rowid FROM chunks WHERE id = ?');
    const insertChunk = this.db.prepare(
      'INSERT INTO chunks (id, rowid, kind, source_id, content, tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const updateChunk = this.db.prepare(
      'UPDATE chunks SET kind = ?, source_id = ?, content = ?, tokens = ?, created_at = ? WHERE id = ?',
    );
    const deleteVec = this.db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
    const insertVec = this.db.prepare('INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)');
    const nextRowId = this.db.prepare('SELECT COALESCE(MAX(rowid), 0) + 1 AS next FROM chunks');

    const tx = this.db.transaction((batch: readonly EmbeddedChunk[]) => {
      for (const chunk of batch) {
        if (chunk.embedding.length !== dims) {
          throw new Error(
            `Embedding dimension mismatch for chunk ${chunk.id}: expected ${dims}, got ${chunk.embedding.length}`,
          );
        }
        const vec = Buffer.from(new Float32Array(chunk.embedding).buffer);

        const existing = getRowId.get(chunk.id) as { rowid: number } | undefined;
        const rowid =
          existing?.rowid ?? ((nextRowId.get() as { next: number }).next as number);

        if (existing) {
          updateChunk.run(
            chunk.source.kind,
            chunk.source.sourceId,
            chunk.content,
            chunk.tokens,
            chunk.createdAt.toISOString(),
            chunk.id,
          );
          deleteVec.run(rowid);
        } else {
          insertChunk.run(
            chunk.id,
            rowid,
            chunk.source.kind,
            chunk.source.sourceId,
            chunk.content,
            chunk.tokens,
            chunk.createdAt.toISOString(),
          );
        }
        insertVec.run(rowid, vec);
      }
    });

    tx(chunks);
  }

  async delete(chunkIds: readonly string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    const selectRow = this.db.prepare('SELECT rowid FROM chunks WHERE id = ?');
    const deleteChunk = this.db.prepare('DELETE FROM chunks WHERE id = ?');
    const deleteVec = this.db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');

    const tx = this.db.transaction((ids: readonly string[]) => {
      for (const id of ids) {
        const row = selectRow.get(id) as { rowid: number } | undefined;
        if (!row) continue;
        deleteVec.run(row.rowid);
        deleteChunk.run(id);
      }
    });
    tx(chunkIds);
  }

  async search(options: VectorSearchOptions): Promise<readonly RecalledChunk[]> {
    if (options.embedding.length !== this.dims) {
      throw new Error(
        `Query embedding dimension mismatch: expected ${this.dims}, got ${options.embedding.length}`,
      );
    }
    const vec = Buffer.from(new Float32Array(options.embedding).buffer);
    const kinds = options.filters?.kinds;
    const kindFilter = kinds && kinds.length > 0 ? `AND c.kind IN (${kinds.map(() => '?').join(',')})` : '';

    const sql = `
      SELECT c.id as id, c.kind as kind, c.source_id as source_id, c.content as content,
             v.distance as distance
      FROM vec_chunks v
      JOIN chunks c ON c.rowid = v.rowid
      WHERE v.embedding MATCH ? AND k = ? ${kindFilter}
      ORDER BY v.distance
    `;
    const stmt = this.db.prepare(sql);
    const params: unknown[] = [vec, options.k];
    if (kinds && kinds.length > 0) params.push(...kinds);
    const rows = stmt.all(...params) as Array<{
      id: string;
      kind: string;
      source_id: string;
      content: string;
      distance: number;
    }>;

    return rows.map((r) => ({
      chunkId: r.id,
      kind: r.kind as RecalledChunk['kind'],
      sourceId: r.source_id,
      score: 1 / (1 + r.distance),
      content: r.content,
    }));
  }

  async count(): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number };
    return row.n;
  }

  close(): void {
    this.db.close();
  }
}
