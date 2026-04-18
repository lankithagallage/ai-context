import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../application/ports/id-generator.js';

export class UuidIdGenerator implements IdGenerator {
  constructor(private readonly prefix?: string) {}

  next(): string {
    const uuid = randomUUID().replace(/-/g, '').slice(0, 16);
    return this.prefix ? `${this.prefix}_${uuid}` : uuid;
  }
}
