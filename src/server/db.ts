import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { HttpError } from './errors';
import {
  isUserRole,
  type DatabaseFile,
  type DocumentType,
  type PublicUser,
  type StoredDocument,
  type StoredUser,
  type UserRole,
  type UserSettings,
} from './types';

const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'database.json');

export const MIN_PASSWORD_LENGTH = 5;
export const MAX_STATE_BYTES = 256 * 1024;
export const MAX_DOCUMENTS_PER_USER = 50;
export const MAX_DOCUMENT_NAME_LENGTH = 500;
export const DOCUMENT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const DOCUMENT_TYPES: readonly DocumentType[] = ['nmck', 'kp'];

const EMPTY_SETTINGS: UserSettings = {
  customer: '',
  executorPosition: '',
  executorName: '',
};

let dbInstance: JSONDatabase | null = null;

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function pickSettings(input: unknown, base: UserSettings = EMPTY_SETTINGS): UserSettings {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    customer: asString(src.customer, base.customer),
    executorPosition: asString(src.executorPosition, base.executorPosition),
    executorName: asString(src.executorName, base.executorName),
  };
}

function measureJsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

class JSONDatabase {
  data: DatabaseFile = { users: [], documents: [] };

  async init() {
    try {
      const fileData = await fs.readFile(DB_FILE, 'utf-8');
      const parsed: unknown = JSON.parse(fileData);
      this.data = this.normalizeFile(parsed);
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : undefined;
      if (code === 'ENOENT') {
        await this.save();
      } else {
        throw e;
      }
    }

    const admin = this.data.users.find((u) => u.username === 'admin');
    if (!admin) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      this.data.users.push({
        id: this.getNextId('users'),
        username: 'admin',
        password: hash,
        role: 'admin',
        settings: { ...EMPTY_SETTINGS },
      });
      await this.save();
      console.log('Default admin user created (admin / admin)');
    }
  }

  private normalizeFile(raw: unknown): DatabaseFile {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const users = Array.isArray(obj.users) ? obj.users.map((u) => this.normalizeUser(u)).filter((u): u is StoredUser => u !== null) : [];
    const documents = Array.isArray(obj.documents)
      ? obj.documents.map((d) => this.normalizeDocument(d)).filter((d): d is StoredDocument => d !== null)
      : [];
    return { users, documents };
  }

  private normalizeUser(raw: unknown): StoredUser | null {
    if (!raw || typeof raw !== 'object') return null;
    const u = raw as Record<string, unknown>;
    if (typeof u.id !== 'number' || typeof u.username !== 'string' || typeof u.password !== 'string') return null;
    const role: UserRole = isUserRole(u.role) ? u.role : 'user';
    return {
      id: u.id,
      username: u.username,
      password: u.password,
      role,
      settings: pickSettings(u.settings),
    };
  }

  private normalizeDocument(raw: unknown): StoredDocument | null {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    if (typeof d.id !== 'number' || typeof d.userId !== 'number' || typeof d.createdAt !== 'number') return null;
    return {
      id: d.id,
      userId: d.userId,
      name: asString(d.name),
      state: d.state ?? {},
      type: isDocumentType(d.type) ? d.type : 'nmck',
      createdAt: d.createdAt,
    };
  }

  async save() {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    const serialized = JSON.stringify(this.data, null, 2);
    const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
    try {
      await fs.writeFile(tmpFile, serialized, 'utf-8');
      await fs.rename(tmpFile, DB_FILE);
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => undefined);
      throw err;
    }
  }

  private getNextId(table: 'users' | 'documents') {
    const records = this.data[table];
    if (records.length === 0) return 1;
    return Math.max(...records.map((r) => r.id)) + 1;
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    return this.data.users.find((u) => u.username === username) ?? null;
  }

  async getUserById(id: number): Promise<StoredUser | null> {
    return this.data.users.find((u) => u.id === id) ?? null;
  }

  async listUsers(): Promise<PublicUser[]> {
    return this.data.users.map((u) => ({ id: u.id, username: u.username, role: u.role }));
  }

  async createUser(username: string, passwordHash: string, role: UserRole = 'user'): Promise<{ lastID: number }> {
    const existing = this.data.users.find((u) => u.username === username);
    if (existing) {
      throw new HttpError(400, 'Пользователь с таким именем уже существует');
    }

    const id = this.getNextId('users');
    this.data.users.push({
      id,
      username,
      password: passwordHash,
      role,
      settings: { ...EMPTY_SETTINGS },
    });
    await this.save();
    return { lastID: id };
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) {
      throw new HttpError(404, 'Пользователь не найден');
    }
    user.password = passwordHash;
    await this.save();
  }

  async getUserSettings(userId: number): Promise<UserSettings> {
    const user = this.data.users.find((u) => u.id === userId);
    return user ? pickSettings(user.settings) : { ...EMPTY_SETTINGS };
  }

  async updateUserSettings(userId: number, settings: unknown): Promise<UserSettings> {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) {
      throw new HttpError(404, 'Пользователь не найден');
    }
    user.settings = pickSettings(settings, user.settings);
    await this.save();
    return user.settings;
  }

  async addDocument(userId: number, name: unknown, state: unknown, type: unknown = 'nmck'): Promise<StoredDocument> {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new HttpError(400, 'Укажите название документа');
    }
    const trimmedName = name.trim().slice(0, MAX_DOCUMENT_NAME_LENGTH);

    const resolvedType = type === undefined || type === null || type === '' ? 'nmck' : type;
    if (!isDocumentType(resolvedType)) {
      throw new HttpError(400, 'Тип документа должен быть nmck или kp');
    }

    if (state === null || typeof state !== 'object') {
      throw new HttpError(400, 'Некорректный снимок документа');
    }

    const stateBytes = measureJsonBytes(state);
    if (stateBytes > MAX_STATE_BYTES) {
      throw new HttpError(400, 'Снимок документа слишком большой');
    }

    const pruned = this.pruneExpiredDocuments();

    const userDocs = this.data.documents.filter((d) => d.userId === userId);
    if (userDocs.length >= MAX_DOCUMENTS_PER_USER) {
      if (pruned) await this.save();
      throw new HttpError(400, 'Превышен лимит документов');
    }

    const doc: StoredDocument = {
      id: this.getNextId('documents'),
      userId,
      name: trimmedName,
      state,
      type: resolvedType,
      createdAt: Date.now(),
    };
    this.data.documents.push(doc);
    await this.save();
    return doc;
  }

  async getDocuments(userId: number): Promise<StoredDocument[]> {
    const pruned = this.pruneExpiredDocuments();
    if (pruned) {
      await this.save();
    }

    return this.data.documents
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  private pruneExpiredDocuments(): boolean {
    const cutoff = Date.now() - DOCUMENT_TTL_MS;
    const kept = this.data.documents.filter((d) => d.createdAt > cutoff);
    if (kept.length === this.data.documents.length) return false;
    this.data.documents = kept;
    return true;
  }
}

export async function getDb(): Promise<JSONDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = new JSONDatabase();
  await dbInstance.init();

  return dbInstance;
}

