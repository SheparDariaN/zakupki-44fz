import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('JSONDatabase save', () => {
  let tempDir = '';
  let dbFile = '';

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zakupki-db-'));
    dbFile = path.join(tempDir, 'database.json');
    process.env.DB_FILE = dbFile;
  });

  afterAll(async () => {
    delete process.env.DB_FILE;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('сериализует параллельные сохранения документов в одном процессе', async () => {
    const { getDb } = await import('./db');
    const db = await getDb();
    const names = Array.from({ length: 20 }, (_, index) => `Документ ${index + 1}`);

    await Promise.all(names.map((name, index) => db.addDocument(1, name, { index }, 'nmck')));

    const raw = JSON.parse(await fs.readFile(dbFile, 'utf-8')) as {
      documents: Array<{ name: string; userId: number }>;
    };
    const userDocuments = raw.documents.filter((document) => document.userId === 1);

    expect(userDocuments).toHaveLength(names.length);
    expect(new Set(userDocuments.map((document) => document.name))).toEqual(new Set(names));
  });
});
