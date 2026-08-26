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

  it('поддерживает служебную записку как тип документа', async () => {
    const db = await loadDb({ users: [], documents: [], counterparties: [] });

    const document = await db.addDocument(1, 'Служебная записка', { subjectIntro: 'Закупка ПО' }, 'memo');

    expect(document.type).toBe('memo');
    await expect(db.addDocument(1, 'Неверный тип', {}, 'letter')).rejects.toMatchObject({
      status: 400,
      message: 'Тип документа должен быть nmck, kp или memo',
    });
  });

  it('нормализует расширенные настройки профиля и отбрасывает лишние поля', async () => {
    const db = await loadDb({
      users: [
        {
          id: 1,
          username: 'user',
          password: 'hash',
          role: 'user',
          settings: {
            customer: 'ГКУ «ЦИТ Кузбасса»',
            executorName: 'Иванов Иван Иванович',
          },
          mustChangePassword: false,
        },
      ],
      documents: [],
      counterparties: [],
    });

    expect(await db.getUserSettings(1)).toEqual({
      customer: 'ГКУ «ЦИТ Кузбасса»',
      executorPosition: '',
      executorName: 'Иванов Иван Иванович',
      submissionEmail: '',
      contactPerson: '',
      contactPhone: '',
      contractServiceHeadPosition: 'Руководитель контрактной службы',
      contractServiceHeadName: '',
      defaultServiceConditions: [],
    });

    await expect(db.updateUserSettings(1, {
      submissionEmail: 'kp@example.test',
      contactPerson: 'Петров Петр Петрович',
      contactPhone: '+7 000 000-00-00',
      contractServiceHeadName: 'Сидоров Сидор Сидорович',
      defaultServiceConditions: ['Срок оказания услуг: 30 дней', '  ', 'Гарантия 12 месяцев'],
      ignored: 'не сохраняется',
    })).resolves.toEqual({
      customer: 'ГКУ «ЦИТ Кузбасса»',
      executorPosition: '',
      executorName: 'Иванов Иван Иванович',
      submissionEmail: 'kp@example.test',
      contactPerson: 'Петров Петр Петрович',
      contactPhone: '+7 000 000-00-00',
      contractServiceHeadPosition: 'Руководитель контрактной службы',
      contractServiceHeadName: 'Сидоров Сидор Сидорович',
      defaultServiceConditions: ['Срок оказания услуг: 30 дней', 'Гарантия 12 месяцев'],
    });
  });

  it('преобразует старые строковые типовые условия профиля в список пунктов', async () => {
    const db = await loadDb({
      users: [
        {
          id: 1,
          username: 'user',
          password: 'hash',
          role: 'user',
          settings: {
            defaultServicePlace: 'г. Кемерово',
            defaultServiceConditions: 'Срок оказания услуг: 30 дней\nГарантия 12 месяцев',
          },
          mustChangePassword: false,
        },
      ],
      documents: [],
      counterparties: [],
    });

    expect(await db.getUserSettings(1)).toMatchObject({
      defaultServiceConditions: ['Срок оказания услуг: 30 дней', 'Гарантия 12 месяцев'],
    });
    expect(await db.getUserSettings(1)).not.toHaveProperty('defaultServicePlace');
  });

  it('нормализует контрагентов из файла БД', async () => {
    const db = await loadDb({
      users: [],
      documents: [],
      counterparties: [
        {
          id: 10,
          companyName: '  ООО Ромашка  ',
          shortName: ' Ромашка ',
          fullName: '  Общество с ограниченной ответственностью Ромашка  ',
          director: '  Иванов Иван Иванович  ',
          directorGenitive: ' Иванова Ивана Ивановича ',
          directorDative: ' Иванову Ивану Ивановичу ',
          email: '  info@example.test  ',
          phone: ' +7 000 000-00-00 ',
          legalAddress: '  г. Москва  ',
          postalAddress: '  101000, г. Москва  ',
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
        shortName: 'Ромашка',
        fullName: 'Общество с ограниченной ответственностью Ромашка',
        director: 'Иванов Иван Иванович',
        directorGenitive: 'Иванова Ивана Ивановича',
        directorDative: 'Иванову Ивану Ивановичу',
        email: 'info@example.test',
        phone: '+7 000 000-00-00',
        legalAddress: 'г. Москва',
        postalAddress: '101000, г. Москва',
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
      shortName: ' Вектор ',
      fullName: '  Общество с ограниченной ответственностью Вектор  ',
      director: '  Петров Пётр Петрович  ',
      directorGenitive: ' Петрова Петра Петровича ',
      directorDative: ' Петрову Петру Петровичу ',
      email: '  vector@example.test  ',
      phone: ' +7 111 111-11-11 ',
      legalAddress: '  г. Казань  ',
      postalAddress: '  420000, г. Казань  ',
      tags: [' срочно ', 'важно', 'срочно', '', null],
    });

    expect(created).toEqual({
      id: 1,
      companyName: 'ООО Вектор',
      shortName: 'Вектор',
      fullName: 'Общество с ограниченной ответственностью Вектор',
      director: 'Петров Пётр Петрович',
      directorGenitive: 'Петрова Петра Петровича',
      directorDative: 'Петрову Петру Петровичу',
      email: 'vector@example.test',
      phone: '+7 111 111-11-11',
      legalAddress: 'г. Казань',
      postalAddress: '420000, г. Казань',
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
