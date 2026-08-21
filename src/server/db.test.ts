import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('JSONDatabase', () => {
  let tempDir = '';
  let dbFile = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zakupki-db-'));
    dbFile = path.join(tempDir, 'database.json');
    process.env.DB_FILE = dbFile;
    vi.resetModules();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.DB_FILE;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function loadDb(initialData?: unknown) {
    if (initialData !== undefined) {
      await fs.writeFile(dbFile, JSON.stringify(initialData, null, 2), 'utf-8');
    }

    const { getDb } = await import('./db');
    return getDb();
  }

  it('сериализует параллельные сохранения документов в одном процессе', async () => {
    const db = await loadDb();
    const names = Array.from({ length: 20 }, (_, index) => `Документ ${index + 1}`);

    await Promise.all(names.map((name, index) => db.addDocument(1, name, { index }, 'nmck')));

    const raw = JSON.parse(await fs.readFile(dbFile, 'utf-8')) as {
      documents: Array<{ name: string; userId: number }>;
    };
    const userDocuments = raw.documents.filter((document) => document.userId === 1);

    expect(userDocuments).toHaveLength(names.length);
    expect(new Set(userDocuments.map((document) => document.name))).toEqual(new Set(names));
  });

  it('добавляет пустую коллекцию контрагентов для старого файла БД', async () => {
    const db = await loadDb({ users: [], documents: [] });

    expect(await db.listCounterparties()).toEqual([]);

    const raw = JSON.parse(await fs.readFile(dbFile, 'utf-8')) as { counterparties?: unknown };
    expect(raw.counterparties).toEqual([]);
  });

  it('нормализует контрагентов из файла БД', async () => {
    const db = await loadDb({
      users: [],
      documents: [],
      counterparties: [
        {
          id: 10,
          companyName: '  ООО Ромашка  ',
          director: '  Иванов Иван Иванович  ',
          email: '  info@example.test  ',
          legalAddress: '  г. Москва  ',
          tags: [' поставщик ', '', 'поставщик', '44-ФЗ', 123, '44-ФЗ'],
          createdAt: 1000,
        },
        { id: 11, companyName: '   ', tags: ['пустое название'] },
        { companyName: 'Без id' },
      ],
    });

    expect(await db.listCounterparties()).toEqual([
      {
        id: 10,
        companyName: 'ООО Ромашка',
        director: 'Иванов Иван Иванович',
        email: 'info@example.test',
        legalAddress: 'г. Москва',
        tags: ['поставщик', '44-ФЗ'],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);
  });

  it('создаёт контрагента с trim-полями и уникальными тегами', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    const db = await loadDb({ users: [], documents: [], counterparties: [] });
    const created = await db.createCounterparty({
      companyName: '  ООО Вектор  ',
      director: '  Петров Пётр Петрович  ',
      email: '  vector@example.test  ',
      legalAddress: '  г. Казань  ',
      tags: [' срочно ', 'важно', 'срочно', '', null],
    });

    expect(created).toEqual({
      id: 1,
      companyName: 'ООО Вектор',
      director: 'Петров Пётр Петрович',
      email: 'vector@example.test',
      legalAddress: 'г. Казань',
      tags: ['срочно', 'важно'],
      createdAt: new Date('2026-01-01T10:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-01T10:00:00.000Z').getTime(),
    });
    await expect(db.createCounterparty({ companyName: '   ' })).rejects.toMatchObject({
      status: 400,
      message: 'Укажите название контрагента',
    });
  });

  it('изменяет контрагента, сохраняя базовые поля при частичном вводе', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));

    const db = await loadDb({ users: [], documents: [], counterparties: [] });
    const created = await db.createCounterparty({
      companyName: 'ООО Вектор',
      director: 'Петров Пётр Петрович',
      email: 'vector@example.test',
      legalAddress: 'г. Казань',
      tags: ['важно'],
    });

    vi.setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
    const updated = await db.updateCounterparty(created.id, {
      companyName: '  ООО Вектор Плюс  ',
      tags: [' важно ', 'новый', 'важно'],
    });

    expect(updated).toEqual({
      ...created,
      companyName: 'ООО Вектор Плюс',
      tags: ['важно', 'новый'],
      updatedAt: new Date('2026-01-02T10:00:00.000Z').getTime(),
    });
    await expect(db.updateCounterparty(999, { companyName: 'Нет' })).rejects.toMatchObject({
      status: 404,
      message: 'Контрагент не найден',
    });
  });

  it('удаляет контрагента и сообщает об отсутствующей записи', async () => {
    const db = await loadDb({ users: [], documents: [], counterparties: [] });
    const first = await db.createCounterparty({ companyName: 'ООО Первый' });
    const second = await db.createCounterparty({ companyName: 'ООО Второй' });

    await db.deleteCounterparty(first.id);

    expect(await db.listCounterparties()).toEqual([second]);
    await expect(db.deleteCounterparty(first.id)).rejects.toMatchObject({
      status: 404,
      message: 'Контрагент не найден',
    });
  });
});
