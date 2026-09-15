import { MongoClient, type Db } from 'mongodb';

let client: MongoClient | null = null;
let database: Db | null = null;

function resolveMongoDatabaseName(uri: string): string {
  const explicitName = process.env.MONGODB_DATABASE?.trim();
  if (explicitName) return explicitName;

  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace(/^\//, '').trim();
    return dbName || 'zakupki';
  } catch {
    return 'zakupki';
  }
}

export async function getMongoDb(): Promise<Db> {
  if (database) return database;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI must be set');
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(resolveMongoDatabaseName(uri));
  return database;
}

export async function pingMongo(): Promise<boolean> {
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
