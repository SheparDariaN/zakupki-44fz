import 'dotenv/config';
import fs from 'fs/promises';
import { AppDatabase, normalizeCounterpartyRecord, normalizeUserRecord } from '../src/server/db';
import { getMongoDb } from '../src/server/db/mongo';
import { getPostgresPool } from '../src/server/db/postgres';
import type { StoredCounterparty, StoredUser } from '../src/server/types';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Укажите путь к JSON-БД: npm run import:json -- ./database.json');
  process.exit(1);
}

const raw = JSON.parse(await fs.readFile(filePath, 'utf-8')) as Record<string, unknown>;
const users = Array.isArray(raw.users)
  ? raw.users.map(normalizeUserRecord).filter((user): user is StoredUser => user !== null)
  : [];
const counterparties = Array.isArray(raw.counterparties)
  ? raw.counterparties
      .map(normalizeCounterpartyRecord)
      .filter((counterparty): counterparty is StoredCounterparty => counterparty !== null)
  : [];

const db = new AppDatabase(getPostgresPool(), await getMongoDb());
await db.importLegacyUsersAndCounterparties(users, counterparties);
await db.init();

console.log(`Импортировано пользователей: ${users.length}`);
console.log(`Импортировано контрагентов: ${counterparties.length}`);
console.log('История документов из JSON не переносится.');

await getPostgresPool().end();
process.exit(0);
