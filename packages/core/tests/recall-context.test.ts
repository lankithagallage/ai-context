import { describe, it, expect } from 'vitest';
import { RecallContextUseCase } from '../src/application/use-cases/recall-context.js';
import { HashEmbeddingProvider, InMemoryVectorStore } from './fakes.js';

describe('RecallContextUseCase', () => {
  it('embeds the query and returns top-K chunks ordered by score', async () => {
    const embeddings = new HashEmbeddingProvider();
    const vectors = new InMemoryVectorStore();

    const contents = [
      'Auth middleware uses JWT and validates with HS256',
      'Billing runs on Stripe; webhooks posted to /api/webhooks/stripe',
      'Search uses Postgres full-text index on the documents table',
    ];
    const [e1, e2, e3] = await embeddings.embed(contents);
    if (!e1 || !e2 || !e3) throw new Error('embeddings missing');
    await vectors.upsert([
      {
        id: 'c1',
        source: { kind: 'fact', sourceId: 'f1' },
        content: contents[0]!,
        tokens: 10,
        createdAt: new Date(),
        embedding: e1,
      },
      {
        id: 'c2',
        source: { kind: 'fact', sourceId: 'f2' },
        content: contents[1]!,
        tokens: 10,
        createdAt: new Date(),
        embedding: e2,
      },
      {
        id: 'c3',
        source: { kind: 'fact', sourceId: 'f3' },
        content: contents[2]!,
        tokens: 10,
        createdAt: new Date(),
        embedding: e3,
      },
    ]);

    const useCase = new RecallContextUseCase({ embeddings, vectors });
    const results = await useCase.execute({ query: 'how does JWT auth work', k: 2 });

    expect(results).toHaveLength(2);
    expect(results[0]?.sourceId).toBe('f1');
  });
});
