import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { isDocumentKind } from '../types';
import { HttpError } from './errors';
import {
  isUserRole,
  type Counterparty,
  type DatabaseFile,
  type DocumentType,
  type PublicUser,
  type StoredCounterparty,
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

const EMPTY_SETTINGS: UserSettings = {
  customer: '',
  executorPosition: '',
  executorName: '',
  executorNameGenitive: '',
  executorNameDative: '',
  submissionEmail: '',
  contactPerson: '',
  contactPersonGenitive: '',
  contactPersonDative: '',
  contactPhone: '',
  contractServiceHeadPosition: 'Руководитель контрактной службы',
  contractServiceHeadName: '',
  contractServiceHeadNameGenitive: '',
  contractServiceHeadNameDative: '',
  defaultServiceConditions: [],
};

const EMPTY_COUNTERPARTY_FIELDS = {
  shortName: '',
  fullName: '',
  director: '',
  directorGenitive: '',
  directorDative: '',
  email: '',
  phone: '',
  legalAddress: '',
  postalAddress: '',
};

let dbInstance: JSONDatabase | null = null;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function trimString(value: unknown, fallback = ''): string {
  return asString(value, fallback).trim();
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = item.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

function pickSettings(input: unknown, base: UserSettings = EMPTY_SETTINGS): UserSettings {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    customer: asString(src.customer, base.customer),
    executorPosition: asString(src.executorPosition, base.executorPosition),
    executorName: asString(src.executorName, base.executorName),
    executorNameGenitive: asString(src.executorNameGenitive, base.executorNameGenitive),
    executorNameDative: asString(src.executorNameDative, base.executorNameDative),
    submissionEmail: asString(src.submissionEmail, base.submissionEmail),
    contactPerson: asString(src.contactPerson, base.contactPerson),
    contactPersonGenitive: asString(src.contactPersonGenitive, base.contactPersonGenitive),
    contactPersonDative: asString(src.contactPersonDative, base.contactPersonDative),
    contactPhone: asString(src.contactPhone, base.contactPhone),
    contractServiceHeadPosition: asString(src.contractServiceHeadPosition, base.contractServiceHeadPosition),
    contractServiceHeadName: asString(src.contractServiceHeadName, base.contractServiceHeadName),
    contractServiceHeadNameGenitive: asString(
      src.contractServiceHeadNameGenitive,
      base.contractServiceHeadNameGenitive
    ),
    contractServiceHeadNameDative: asString(src.contractServiceHeadNameDative, base.contractServiceHeadNameDative),
    defaultServiceConditions: asStringList(src.defaultServiceConditions, base.defaultServiceConditions),
  };
}

function measureJsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

class JSONDatabase {
  data: DatabaseFile = { users: [], documents: [], counterparties: [] };
  private saveQueue: Promise<void> = Promise.resolve();

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
        mustChangePassword: true,
      });
      await this.save();
      console.log('Default admin user created (admin / admin)');
    } else if (!admin.mustChangePassword && bcrypt.compareSync('admin', admin.password)) {
      admin.mustChangePassword = true;
      await this.save();
    }
  }

  private normalizeFile(raw: unknown): DatabaseFile {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const users = Array.isArray(obj.users) ? obj.users.map((u) => this.normalizeUser(u)).filter((u): u is StoredUser => u !== null) : [];
    const documents = Array.isArray(obj.documents)
      ? obj.documents.map((d) => this.normalizeDocument(d)).filter((d): d is StoredDocument => d !== null)
      : [];
    const counterparties = Array.isArray(obj.counterparties)
      ? obj.counterparties.map((c) => this.normalizeCounterparty(c)).filter((c): c is StoredCounterparty => c !== null)
      : [];
    return { users, documents, counterparties };
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
      mustChangePassword: typeof u.mustChangePassword === 'boolean' ? u.mustChangePassword : false,
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
      type: isDocumentKind(d.type) ? d.type : 'nmck',
      createdAt: d.createdAt,
    };
  }

  private normalizeCounterparty(raw: unknown): StoredCounterparty | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== 'number') return null;

    const companyName = trimString(c.companyName);
    if (!companyName) return null;

    const createdAt = typeof c.createdAt === 'number' ? c.createdAt : Date.now();
    const updatedAt = typeof c.updatedAt === 'number' ? c.updatedAt : createdAt;

    return {
      id: c.id,
      companyName,
      shortName: trimString(c.shortName),
      fullName: trimString(c.fullName),
      director: trimString(c.director),
      directorGenitive: trimString(c.directorGenitive),
      directorDative: trimString(c.directorDative),
      email: trimString(c.email),
      phone: trimString(c.phone),
      legalAddress: trimString(c.legalAddress),
      postalAddress: trimString(c.postalAddress),
      tags: normalizeTags(c.tags),
      createdAt,
      updatedAt,
    };
  }

  async save() {
    const saveJob = this.saveQueue.then(() => this.writeFile());
    this.saveQueue = saveJob.catch(() => undefined);
    return saveJob;
  }

  private async writeFile() {
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

  private getNextId(table: 'users' | 'documents' | 'counterparties') {
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
      mustChangePassword: false,
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
    user.mustChangePassword = false;
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
    if (!isDocumentKind(resolvedType)) {
      throw new HttpError(400, 'Тип документа должен быть nmck, kp или memo');
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

  async listCounterparties(): Promise<StoredCounterparty[]> {
    return [...this.data.counterparties].sort((a, b) => b.createdAt - a.createdAt);
  }

  async createCounterparty(input: unknown): Promise<StoredCounterparty> {
    const values = this.normalizeCounterpartyInput(input);
    const now = Date.now();
    const counterparty: StoredCounterparty = {
      id: this.getNextId('counterparties'),
      companyName: values.companyName,
      shortName: values.shortName,
      fullName: values.fullName,
      director: values.director,
      directorGenitive: values.directorGenitive,
      directorDative: values.directorDative,
      email: values.email,
      phone: values.phone,
      legalAddress: values.legalAddress,
      postalAddress: values.postalAddress,
      tags: values.tags,
      createdAt: now,
      updatedAt: now,
    };

    this.data.counterparties.push(counterparty);
    await this.save();
    return counterparty;
  }

  async updateCounterparty(id: number, input: unknown): Promise<StoredCounterparty> {
    const counterparty = this.data.counterparties.find((c) => c.id === id);
    if (!counterparty) {
      throw new HttpError(404, 'Контрагент не найден');
    }

    const values = this.normalizeCounterpartyInput(input, counterparty);
    counterparty.companyName = values.companyName;
    counterparty.shortName = values.shortName;
    counterparty.fullName = values.fullName;
    counterparty.director = values.director;
    counterparty.directorGenitive = values.directorGenitive;
    counterparty.directorDative = values.directorDative;
    counterparty.email = values.email;
    counterparty.phone = values.phone;
    counterparty.legalAddress = values.legalAddress;
    counterparty.postalAddress = values.postalAddress;
    counterparty.tags = values.tags;
    counterparty.updatedAt = Date.now();

    await this.save();
    return counterparty;
  }

  async deleteCounterparty(id: number): Promise<void> {
    const index = this.data.counterparties.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new HttpError(404, 'Контрагент не найден');
    }

    this.data.counterparties.splice(index, 1);
    await this.save();
  }

  private normalizeCounterpartyInput(input: unknown, base?: Counterparty): Omit<Counterparty, 'id' | 'createdAt' | 'updatedAt'> {
    const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const companyName = trimString(src.companyName, base?.companyName);

    if (!companyName) {
      throw new HttpError(400, 'Укажите название контрагента');
    }

    return {
      companyName,
      shortName: trimString(src.shortName, base?.shortName ?? EMPTY_COUNTERPARTY_FIELDS.shortName),
      fullName: trimString(src.fullName, base?.fullName ?? EMPTY_COUNTERPARTY_FIELDS.fullName),
      director: trimString(src.director, base?.director ?? EMPTY_COUNTERPARTY_FIELDS.director),
      directorGenitive: trimString(src.directorGenitive, base?.directorGenitive ?? EMPTY_COUNTERPARTY_FIELDS.directorGenitive),
      directorDative: trimString(src.directorDative, base?.directorDative ?? EMPTY_COUNTERPARTY_FIELDS.directorDative),
      email: trimString(src.email, base?.email ?? EMPTY_COUNTERPARTY_FIELDS.email),
      phone: trimString(src.phone, base?.phone ?? EMPTY_COUNTERPARTY_FIELDS.phone),
      legalAddress: trimString(src.legalAddress, base?.legalAddress ?? EMPTY_COUNTERPARTY_FIELDS.legalAddress),
      postalAddress: trimString(src.postalAddress, base?.postalAddress ?? EMPTY_COUNTERPARTY_FIELDS.postalAddress),
      tags: Array.isArray(src.tags) ? normalizeTags(src.tags) : base?.tags ?? [],
    };
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

