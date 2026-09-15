import bcrypt from 'bcryptjs';
import type pg from 'pg';
import { type Collection, type Db } from 'mongodb';
import { DOCUMENT_KINDS, isDocumentKind, isPurchaseDocumentKind, type DocumentKind } from '../types';
import { HttpError } from './errors';
import { getMongoDb, pingMongo } from './db/mongo';
import { getPostgresPool, pingPostgres } from './db/postgres';
import {
  isUserRole,
  type Counterparty,
  type DocumentType,
  type PublicUser,
  type StoredCounterparty,
  type StoredDocument,
  type StoredPurchase,
  type StoredPurchaseContext,
  type StoredPurchaseDocumentCounts,
  type StoredPurchaseDocumentKind,
  type StoredPurchaseDocumentMetadata,
  type StoredPurchaseLink,
  type StoredPurchaseListItem,
  type StoredPurchaseOffer,
  type StoredUser,
  type UserRole,
  type UserSettings,
} from './types';

export const MIN_PASSWORD_LENGTH = 5;
export const MAX_STATE_BYTES = 256 * 1024;
export const MAX_DOCUMENT_NAME_LENGTH = 500;
export const MAX_PURCHASE_NAME_LENGTH = 500;
export const MAX_PURCHASE_LINK_URL_LENGTH = 2048;
export const MAX_PURCHASE_LINK_TITLE_LENGTH = 500;
export const MAX_OFFER_NUMBER_LENGTH = 100;
export const MAX_OFFER_COMPANY_NAME_LENGTH = 500;
export const MAX_OFFERS_PER_PURCHASE = 50;

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

type UserRow = {
  id: number;
  username: string;
  password: string;
  role: string;
  settings: unknown;
  must_change_password: boolean;
};

type CounterpartyRow = {
  id: number;
  company_name: string;
  short_name: string | null;
  full_name: string | null;
  director: string | null;
  director_genitive: string | null;
  director_dative: string | null;
  email: string | null;
  phone: string | null;
  legal_address: string | null;
  postal_address: string | null;
  tags: unknown;
  created_at_ms: string | number;
  updated_at_ms: string | number;
};

type DocumentHistoryRecord = StoredDocument & { _id?: unknown };
type DocumentStateRecord = {
  _id: string;
  purchaseId: number;
  kind: DocumentKind;
  state: unknown;
  updatedAt: number;
};

type PurchaseRow = {
  id: number;
  user_id: number;
  name: string;
  price: string | number | null;
  budget_year: number | null;
  created_at_ms: string | number;
  updated_at_ms: string | number;
};

type PurchaseListRow = PurchaseRow & {
  nmck_count: string | number;
  kp_count: string | number;
  memo_count: string | number;
  contract_count: string | number;
  offers_count: string | number;
  links_count: string | number;
};

type PurchaseLinkRow = {
  id: number;
  purchase_id: number;
  url: string;
  title: string;
  created_at_ms: string | number;
  updated_at_ms: string | number;
};

type PurchaseDocumentRow = {
  id: number;
  purchase_id: number;
  kind: string;
  storage: string;
  mongo_id: string | null;
  file_rel_path: string | null;
  mime: string | null;
  file_name: string | null;
  created_at_ms: string | number;
  updated_at_ms: string | number;
};

type PurchaseOfferRow = {
  id: number;
  purchase_id: number;
  registered_number: string;
  registered_date: string;
  company_name: string;
  counterparty_id: number | null;
  file_rel_path: string;
  mime: string;
  file_name: string;
  created_at_ms: string | number;
  updated_at_ms: string | number;
};

export type OfferMetadata = {
  registeredNumber: string;
  registeredDate: string;
  companyName: string;
  counterpartyId: number | null;
};

type StoredPurchaseOfferRecord = StoredPurchaseOffer & { fileRelPath: string };

let dbInstance: AppDatabase | null = null;

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

export function pickSettings(input: unknown, base: UserSettings = EMPTY_SETTINGS): UserSettings {
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

export function normalizeUserRecord(raw: unknown): StoredUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const role: UserRole = isUserRole(u.role) ? u.role : 'user';
  const id = typeof u.id === 'number' ? u.id : Number(u.id);

  if (!Number.isInteger(id) || id <= 0 || typeof u.username !== 'string' || typeof u.password !== 'string') {
    return null;
  }

  return {
    id,
    username: u.username,
    password: u.password,
    role,
    settings: pickSettings(u.settings),
    mustChangePassword: typeof u.mustChangePassword === 'boolean' ? u.mustChangePassword : false,
  };
}

export function normalizeCounterpartyRecord(raw: unknown): StoredCounterparty | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'number' ? c.id : Number(c.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const companyName = trimString(c.companyName);
  if (!companyName) return null;

  const createdAt = typeof c.createdAt === 'number' ? c.createdAt : Number(c.createdAt) || Date.now();
  const updatedAt = typeof c.updatedAt === 'number' ? c.updatedAt : Number(c.updatedAt) || createdAt;

  return {
    id,
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

export function normalizeCounterpartyInput(
  input: unknown,
  base?: Counterparty
): Omit<Counterparty, 'id' | 'createdAt' | 'updatedAt'> {
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

export function measureJsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function validateDocumentInput(
  userId: number,
  name: unknown,
  state: unknown,
  type: unknown = 'nmck',
  id = 0,
  createdAt = Date.now()
): StoredDocument {
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

  if (measureJsonBytes(state) > MAX_STATE_BYTES) {
    throw new HttpError(400, 'Снимок документа слишком большой');
  }

  return { id, userId, name: trimmedName, state, type: resolvedType as DocumentType, createdAt };
}

function parseNullableMoney(value: unknown, fallback: number | null = null): number | null {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9999999999999.99) {
    throw new HttpError(400, 'Цена закупки должна быть неотрицательным числом');
  }
  return Math.round(parsed * 100) / 100;
}

function parseNullableBudgetYear(value: unknown, fallback: number | null = null): number | null {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 3000) {
    throw new HttpError(400, 'Год лимитов должен быть целым числом');
  }
  return parsed;
}

export function normalizePurchaseInput(
  input: unknown,
  base?: Pick<StoredPurchase, 'name' | 'price' | 'budgetYear'>
): Pick<StoredPurchase, 'name' | 'price' | 'budgetYear'> {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const rawName = src.name === undefined ? base?.name : src.name;
  const name = trimString(rawName).slice(0, MAX_PURCHASE_NAME_LENGTH);

  if (!name) {
    throw new HttpError(400, 'Укажите название закупки');
  }

  return {
    name,
    price: parseNullableMoney(src.price, base?.price ?? null),
    budgetYear: parseNullableBudgetYear(src.budgetYear ?? src.budget_year, base?.budgetYear ?? null),
  };
}

export function normalizePurchaseLinkInput(
  input: unknown,
  base?: Pick<StoredPurchaseLink, 'url' | 'title'>
): Pick<StoredPurchaseLink, 'url' | 'title'> {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const url = trimString(src.url === undefined ? base?.url : src.url).slice(0, MAX_PURCHASE_LINK_URL_LENGTH);
  const title = trimString(src.title === undefined ? base?.title : src.title).slice(0, MAX_PURCHASE_LINK_TITLE_LENGTH);

  if (!url) {
    throw new HttpError(400, 'Укажите ссылку закупки');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, 'Некорректная ссылка закупки');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Ссылка закупки должна начинаться с http:// или https://');
  }

  return { url, title };
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseRegisteredDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const ru = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!ru) return null;
  const day = Number(ru[1]);
  const month = Number(ru[2]);
  const year = Number(ru[3]);
  if (!isValidCalendarDate(year, month, day)) return null;
  return `${ru[3]}-${ru[2]}-${ru[1]}`;
}

function parseOptionalCounterpartyId(value: unknown, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new HttpError(400, 'Некорректный идентификатор контрагента');
  }
  return raw;
}

export function normalizeOfferMetadataInput(input: unknown, base?: OfferMetadata): OfferMetadata {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const registeredNumber = trimString(
    src.registeredNumber === undefined ? base?.registeredNumber : src.registeredNumber
  ).slice(0, MAX_OFFER_NUMBER_LENGTH);
  if (!registeredNumber) {
    throw new HttpError(400, 'Укажите номер КП');
  }

  const registeredDate = parseRegisteredDate(
    src.registeredDate === undefined ? base?.registeredDate : src.registeredDate
  );
  if (!registeredDate) {
    throw new HttpError(400, 'Укажите дату регистрации КП');
  }

  return {
    registeredNumber,
    registeredDate,
    companyName: trimString(src.companyName === undefined ? base?.companyName : src.companyName)
      .slice(0, MAX_OFFER_COMPANY_NAME_LENGTH),
    counterpartyId: parseOptionalCounterpartyId(src.counterpartyId, base?.counterpartyId ?? null),
  };
}

const PURCHASE_OFFER_SELECT = `id, purchase_id, registered_number,
       to_char(registered_date, 'YYYY-MM-DD') as registered_date,
       company_name, counterparty_id, file_rel_path, mime, file_name,
       floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
       floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`;

function mapPurchaseOfferRecord(row: PurchaseOfferRow): StoredPurchaseOfferRecord {
  return {
    id: Number(row.id),
    purchaseId: Number(row.purchase_id),
    registeredNumber: row.registered_number,
    registeredDate: row.registered_date,
    companyName: row.company_name,
    counterpartyId: row.counterparty_id === null ? null : Number(row.counterparty_id),
    fileRelPath: row.file_rel_path,
    mime: row.mime,
    fileName: row.file_name,
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

function toPublicOffer(record: StoredPurchaseOfferRecord): StoredPurchaseOffer {
  return {
    id: record.id,
    purchaseId: record.purchaseId,
    registeredNumber: record.registeredNumber,
    registeredDate: record.registeredDate,
    companyName: record.companyName,
    counterpartyId: record.counterpartyId,
    mime: record.mime,
    fileName: record.fileName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function validatePurchaseDocumentState(kind: unknown, state: unknown): DocumentKind {
  if (!isDocumentKind(kind)) {
    throw new HttpError(400, 'Тип документа должен быть nmck, kp или memo');
  }
  if (state === null || typeof state !== 'object') {
    throw new HttpError(400, 'Некорректный снимок документа');
  }
  if (measureJsonBytes(state) > MAX_STATE_BYTES) {
    throw new HttpError(400, 'Снимок документа слишком большой');
  }
  return kind;
}

function mapUserRow(row: UserRow): StoredUser {
  return {
    id: Number(row.id),
    username: row.username,
    password: row.password,
    role: isUserRole(row.role) ? row.role : 'user',
    settings: pickSettings(row.settings),
    mustChangePassword: row.must_change_password,
  };
}

function mapCounterpartyRow(row: CounterpartyRow): StoredCounterparty {
  return {
    id: Number(row.id),
    companyName: row.company_name,
    shortName: row.short_name ?? '',
    fullName: row.full_name ?? '',
    director: row.director ?? '',
    directorGenitive: row.director_genitive ?? '',
    directorDative: row.director_dative ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    legalAddress: row.legal_address ?? '',
    postalAddress: row.postal_address ?? '',
    tags: normalizeTags(row.tags),
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

function mapPurchaseRow(row: PurchaseRow): StoredPurchase {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    name: row.name,
    price: row.price === null ? null : Number(row.price),
    budgetYear: row.budget_year === null ? null : Number(row.budget_year),
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

function emptyDocumentCounts(): StoredPurchaseDocumentCounts {
  return { nmck: 0, kp: 0, memo: 0, contract: 0, offers: 0 };
}

function mapPurchaseListRow(row: PurchaseListRow): StoredPurchaseListItem {
  return {
    ...mapPurchaseRow(row),
    documentCounts: {
      ...emptyDocumentCounts(),
      nmck: Number(row.nmck_count),
      kp: Number(row.kp_count),
      memo: Number(row.memo_count),
      contract: Number(row.contract_count),
      offers: Number(row.offers_count),
    },
    linksCount: Number(row.links_count),
  };
}

function mapPurchaseLinkRow(row: PurchaseLinkRow): StoredPurchaseLink {
  return {
    id: Number(row.id),
    purchaseId: Number(row.purchase_id),
    url: row.url,
    title: row.title,
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

function mapPurchaseDocumentRow(row: PurchaseDocumentRow): StoredPurchaseDocumentMetadata {
  if (!isPurchaseDocumentKind(row.kind)) {
    throw new HttpError(500, 'Некорректный тип документа закупки в базе данных');
  }
  if (row.storage !== 'mongo' && row.storage !== 'file') {
    throw new HttpError(500, 'Некорректный тип хранения документа закупки в базе данных');
  }

  return {
    id: Number(row.id),
    purchaseId: Number(row.purchase_id),
    kind: row.kind,
    storage: row.storage,
    mongoId: row.mongo_id,
    fileRelPath: row.file_rel_path,
    mime: row.mime,
    fileName: row.file_name,
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

export class AppDatabase {
  constructor(
    private readonly pgPool: pg.Pool,
    private readonly mongoDb: Db
  ) {}

  async init() {
    await this.ensureDefaultAdmin();
    await this.ensureMongoIndexes();
  }

  async health(): Promise<{ postgres: boolean; mongo: boolean }> {
    const [postgres, mongo] = await Promise.all([pingPostgres(), pingMongo()]);
    return { postgres, mongo };
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    const result = await this.pgPool.query<UserRow>('select * from users where username = $1', [username]);
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getUserById(id: number): Promise<StoredUser | null> {
    const result = await this.pgPool.query<UserRow>('select * from users where id = $1', [id]);
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async listUsers(): Promise<PublicUser[]> {
    const result = await this.pgPool.query<Pick<UserRow, 'id' | 'username' | 'role'>>(
      'select id, username, role from users order by id'
    );
    return result.rows.map((u) => ({ id: Number(u.id), username: u.username, role: isUserRole(u.role) ? u.role : 'user' }));
  }

  async createUser(username: string, passwordHash: string, role: UserRole = 'user'): Promise<{ lastID: number }> {
    try {
      const result = await this.pgPool.query<{ id: number }>(
        `insert into users (username, password, role, settings, must_change_password)
         values ($1, $2, $3, $4::jsonb, false)
         returning id`,
        [username, passwordHash, role, JSON.stringify(pickSettings({}))]
      );
      return { lastID: Number(result.rows[0].id) };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(400, 'Пользователь с таким именем уже существует');
      }
      throw err;
    }
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    const result = await this.pgPool.query(
      'update users set password = $1, must_change_password = false where id = $2',
      [passwordHash, userId]
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, 'Пользователь не найден');
    }
  }

  async getUserSettings(userId: number): Promise<UserSettings> {
    const result = await this.pgPool.query<Pick<UserRow, 'settings'>>('select settings from users where id = $1', [userId]);
    return result.rows[0] ? pickSettings(result.rows[0].settings) : { ...EMPTY_SETTINGS };
  }

  async updateUserSettings(userId: number, settings: unknown): Promise<UserSettings> {
    const current = await this.getUserById(userId);
    if (!current) {
      throw new HttpError(404, 'Пользователь не найден');
    }

    const nextSettings = pickSettings(settings, current.settings);
    await this.pgPool.query('update users set settings = $1::jsonb where id = $2', [
      JSON.stringify(nextSettings),
      userId,
    ]);
    return nextSettings;
  }

  async listPurchasesByUser(userId: number): Promise<StoredPurchaseListItem[]> {
    const result = await this.pgPool.query<PurchaseListRow>(
      `select p.id, p.user_id, p.name, p.price, p.budget_year,
              floor(extract(epoch from p.created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from p.updated_at) * 1000)::bigint as updated_at_ms,
              coalesce(d.nmck_count, 0)::int as nmck_count,
              coalesce(d.kp_count, 0)::int as kp_count,
              coalesce(d.memo_count, 0)::int as memo_count,
              coalesce(d.contract_count, 0)::int as contract_count,
              coalesce(o.offers_count, 0)::int as offers_count,
              coalesce(l.links_count, 0)::int as links_count
         from purchases p
         left join (
           select purchase_id,
                  count(*) filter (where kind = 'nmck') as nmck_count,
                  count(*) filter (where kind = 'kp') as kp_count,
                  count(*) filter (where kind = 'memo') as memo_count,
                  count(*) filter (where kind = 'contract') as contract_count
             from purchase_documents
            group by purchase_id
         ) d on d.purchase_id = p.id
         left join (
           select purchase_id, count(*) as offers_count
             from purchase_offers
            group by purchase_id
         ) o on o.purchase_id = p.id
         left join (
           select purchase_id, count(*) as links_count
             from purchase_links
            group by purchase_id
         ) l on l.purchase_id = p.id
        where p.user_id = $1
        order by p.updated_at desc, p.id desc`,
      [userId]
    );
    return result.rows.map(mapPurchaseListRow);
  }

  async createPurchase(userId: number, input: unknown): Promise<StoredPurchase> {
    const values = normalizePurchaseInput(input);
    const result = await this.pgPool.query<PurchaseRow>(
      `insert into purchases (user_id, name, price, budget_year)
       values ($1, $2, $3, $4)
       returning id, user_id, name, price, budget_year,
                 floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                 floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [userId, values.name, values.price, values.budgetYear]
    );
    return mapPurchaseRow(result.rows[0]);
  }

  async getPurchaseById(userId: number, purchaseId: number): Promise<StoredPurchase | null> {
    return this.getPurchaseForUser(userId, purchaseId);
  }

  async updatePurchase(userId: number, purchaseId: number, input: unknown): Promise<StoredPurchase> {
    const current = await this.requirePurchaseForUser(userId, purchaseId);
    const values = normalizePurchaseInput(input, current);
    const result = await this.pgPool.query<PurchaseRow>(
      `update purchases
          set name = $1,
              price = $2,
              budget_year = $3,
              updated_at = now()
        where id = $4 and user_id = $5
        returning id, user_id, name, price, budget_year,
                  floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                  floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [values.name, values.price, values.budgetYear, purchaseId, userId]
    );
    return mapPurchaseRow(result.rows[0]);
  }

  async deletePurchase(userId: number, purchaseId: number): Promise<StoredPurchaseDocumentMetadata[]> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const documents = await this.listPurchaseDocumentMetadata(userId, purchaseId);
    await this.documentStates().deleteMany({ purchaseId });
    await this.pgPool.query('delete from purchases where id = $1 and user_id = $2', [purchaseId, userId]);
    return documents;
  }

  async listPurchaseLinks(userId: number, purchaseId: number): Promise<StoredPurchaseLink[]> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query<PurchaseLinkRow>(
      `select id, purchase_id, url, title,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from purchase_links
        where purchase_id = $1
        order by created_at desc, id desc`,
      [purchaseId]
    );
    return result.rows.map(mapPurchaseLinkRow);
  }

  async createPurchaseLink(userId: number, purchaseId: number, input: unknown): Promise<StoredPurchaseLink> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const values = normalizePurchaseLinkInput(input);
    const result = await this.pgPool.query<PurchaseLinkRow>(
      `insert into purchase_links (purchase_id, url, title)
       values ($1, $2, $3)
       returning id, purchase_id, url, title,
                 floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                 floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [purchaseId, values.url, values.title]
    );
    await this.touchPurchase(purchaseId);
    return mapPurchaseLinkRow(result.rows[0]);
  }

  async updatePurchaseLink(userId: number, purchaseId: number, linkId: number, input: unknown): Promise<StoredPurchaseLink> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const current = await this.getPurchaseLinkForPurchase(purchaseId, linkId);
    if (!current) {
      throw new HttpError(404, 'Ссылка закупки не найдена');
    }
    const values = normalizePurchaseLinkInput(input, current);
    const result = await this.pgPool.query<PurchaseLinkRow>(
      `update purchase_links
          set url = $1,
              title = $2,
              updated_at = now()
        where id = $3 and purchase_id = $4
        returning id, purchase_id, url, title,
                  floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                  floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [values.url, values.title, linkId, purchaseId]
    );
    await this.touchPurchase(purchaseId);
    return mapPurchaseLinkRow(result.rows[0]);
  }

  async deletePurchaseLink(userId: number, purchaseId: number, linkId: number): Promise<void> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query('delete from purchase_links where id = $1 and purchase_id = $2', [
      linkId,
      purchaseId,
    ]);
    if (result.rowCount === 0) {
      throw new HttpError(404, 'Ссылка закупки не найдена');
    }
    await this.touchPurchase(purchaseId);
  }

  async upsertPurchaseDocumentState(
    userId: number,
    purchaseId: number,
    kind: unknown,
    state: unknown
  ): Promise<StoredPurchaseDocumentMetadata> {
    const documentKind = validatePurchaseDocumentState(kind, state);
    await this.requirePurchaseForUser(userId, purchaseId);
    const mongoId = documentStateId(purchaseId, documentKind);
    const now = Date.now();
    await this.documentStates().updateOne(
      { _id: mongoId },
      { $set: { purchaseId, kind: documentKind, state, updatedAt: now } },
      { upsert: true }
    );

    const result = await this.pgPool.query<PurchaseDocumentRow>(
      `insert into purchase_documents (purchase_id, kind, storage, mongo_id)
       values ($1, $2, 'mongo', $3)
       on conflict (purchase_id, kind) do update
          set storage = 'mongo',
              mongo_id = excluded.mongo_id,
              file_rel_path = null,
              mime = null,
              file_name = null,
              updated_at = now()
       returning id, purchase_id, kind, storage, mongo_id, file_rel_path, mime, file_name,
                 floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                 floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [purchaseId, documentKind, mongoId]
    );
    await this.touchPurchase(purchaseId);
    return mapPurchaseDocumentRow(result.rows[0]);
  }

  async getPurchaseDocumentState(
    userId: number,
    purchaseId: number,
    kind: unknown
  ): Promise<{ metadata: StoredPurchaseDocumentMetadata; state: unknown } | null> {
    if (!isDocumentKind(kind)) {
      throw new HttpError(400, 'Тип документа должен быть nmck, kp или memo');
    }
    await this.requirePurchaseForUser(userId, purchaseId);
    const metadata = await this.getPurchaseDocumentMetadata(userId, purchaseId, kind);
    if (!metadata?.mongoId) return null;
    const record = await this.documentStates().findOne({ _id: metadata.mongoId }, { projection: { _id: 0 } });
    return record ? { metadata, state: record.state } : null;
  }

  async deletePurchaseDocumentState(userId: number, purchaseId: number, kind: unknown): Promise<void> {
    if (!isDocumentKind(kind)) {
      throw new HttpError(400, 'Тип документа должен быть nmck, kp или memo');
    }
    await this.requirePurchaseForUser(userId, purchaseId);
    await this.documentStates().deleteOne({ _id: documentStateId(purchaseId, kind) });
    await this.pgPool.query(
      "delete from purchase_documents where purchase_id = $1 and kind = $2 and storage = 'mongo'",
      [purchaseId, kind]
    );
    await this.touchPurchase(purchaseId);
  }

  async getPurchaseContext(userId: number, purchaseId: number): Promise<StoredPurchaseContext> {
    const [purchase, links, settings] = await Promise.all([
      this.requirePurchaseForUser(userId, purchaseId),
      this.listPurchaseLinks(userId, purchaseId),
      this.getUserSettings(userId),
    ]);
    const records = await this.documentStates()
      .find({ purchaseId, kind: { $in: [...DOCUMENT_KINDS] } }, { projection: { _id: 0 } })
      .toArray();
    const documents: StoredPurchaseContext['documents'] = {};
    for (const record of records) {
      documents[record.kind] = record.state;
    }
    const contract = await this.getPurchaseDocumentMetadata(userId, purchaseId, 'contract');
    const offers = await this.listPurchaseOffers(userId, purchaseId);
    return { purchase, links, documents, contract, offers, settings };
  }

  async listPurchaseDocumentMetadata(userId: number, purchaseId: number): Promise<StoredPurchaseDocumentMetadata[]> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query<PurchaseDocumentRow>(
      `select id, purchase_id, kind, storage, mongo_id, file_rel_path, mime, file_name,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from purchase_documents
        where purchase_id = $1
        order by updated_at desc, id desc`,
      [purchaseId]
    );
    return result.rows.map(mapPurchaseDocumentRow);
  }

  async getPurchaseDocumentMetadata(
    userId: number,
    purchaseId: number,
    kind: StoredPurchaseDocumentKind
  ): Promise<StoredPurchaseDocumentMetadata | null> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query<PurchaseDocumentRow>(
      `select id, purchase_id, kind, storage, mongo_id, file_rel_path, mime, file_name,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from purchase_documents
        where purchase_id = $1 and kind = $2`,
      [purchaseId, kind]
    );
    return result.rows[0] ? mapPurchaseDocumentRow(result.rows[0]) : null;
  }

  async upsertContractMetadata(
    userId: number,
    purchaseId: number,
    file: { fileRelPath: string; mime: string; fileName: string }
  ): Promise<StoredPurchaseDocumentMetadata> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query<PurchaseDocumentRow>(
      `insert into purchase_documents (purchase_id, kind, storage, file_rel_path, mime, file_name)
       values ($1, 'contract', 'file', $2, $3, $4)
       on conflict (purchase_id, kind) do update
          set storage = 'file',
              mongo_id = null,
              file_rel_path = excluded.file_rel_path,
              mime = excluded.mime,
              file_name = excluded.file_name,
              updated_at = now()
       returning id, purchase_id, kind, storage, mongo_id, file_rel_path, mime, file_name,
                 floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                 floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [purchaseId, file.fileRelPath, file.mime, file.fileName]
    );
    await this.touchPurchase(purchaseId);
    return mapPurchaseDocumentRow(result.rows[0]);
  }

  async deleteContractMetadata(userId: number, purchaseId: number): Promise<StoredPurchaseDocumentMetadata | null> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const current = await this.getPurchaseDocumentMetadata(userId, purchaseId, 'contract');
    if (!current) return null;
    await this.pgPool.query("delete from purchase_documents where purchase_id = $1 and kind = 'contract'", [purchaseId]);
    await this.touchPurchase(purchaseId);
    return current;
  }

  async listPurchaseOffers(userId: number, purchaseId: number): Promise<StoredPurchaseOffer[]> {
    const records = await this.listPurchaseOfferRecords(userId, purchaseId);
    return records.map(toPublicOffer);
  }

  async getPurchaseOfferFile(
    userId: number,
    purchaseId: number,
    offerId: number
  ): Promise<StoredPurchaseOfferRecord> {
    const record = await this.getPurchaseOfferRecord(userId, purchaseId, offerId);
    if (!record) {
      throw new HttpError(404, 'КП не найдено');
    }
    return record;
  }

  async createPurchaseOffer(
    userId: number,
    purchaseId: number,
    input: unknown,
    file: { fileRelPath: string; mime: string; fileName: string }
  ): Promise<StoredPurchaseOffer> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const countResult = await this.pgPool.query<{ count: string | number }>(
      'select count(*)::int as count from purchase_offers where purchase_id = $1',
      [purchaseId]
    );
    if (Number(countResult.rows[0]?.count) >= MAX_OFFERS_PER_PURCHASE) {
      throw new HttpError(400, `Нельзя загрузить больше ${MAX_OFFERS_PER_PURCHASE} КП в одну закупку`);
    }

    const metadata = await this.resolveOfferMetadata(normalizeOfferMetadataInput(input));
    const result = await this.pgPool.query<PurchaseOfferRow>(
      `insert into purchase_offers (
         purchase_id, registered_number, registered_date, company_name, counterparty_id,
         file_rel_path, mime, file_name
       )
       values ($1, $2, $3::date, $4, $5, $6, $7, $8)
       returning ${PURCHASE_OFFER_SELECT}`,
      [
        purchaseId,
        metadata.registeredNumber,
        metadata.registeredDate,
        metadata.companyName,
        metadata.counterpartyId,
        file.fileRelPath,
        file.mime,
        file.fileName,
      ]
    );
    await this.touchPurchase(purchaseId);
    return toPublicOffer(mapPurchaseOfferRecord(result.rows[0]));
  }

  async updatePurchaseOffer(
    userId: number,
    purchaseId: number,
    offerId: number,
    input: unknown,
    file?: { fileRelPath: string; mime: string; fileName: string }
  ): Promise<{ offer: StoredPurchaseOffer; previousFileRelPath: string | null }> {
    const current = await this.getPurchaseOfferRecord(userId, purchaseId, offerId);
    if (!current) {
      throw new HttpError(404, 'КП не найдено');
    }

    const metadata = await this.resolveOfferMetadata(normalizeOfferMetadataInput(input, {
      registeredNumber: current.registeredNumber,
      registeredDate: current.registeredDate,
      companyName: current.companyName,
      counterpartyId: current.counterpartyId,
    }));
    const nextFile = file ?? {
      fileRelPath: current.fileRelPath,
      mime: current.mime,
      fileName: current.fileName,
    };

    const result = await this.pgPool.query<PurchaseOfferRow>(
      `update purchase_offers
          set registered_number = $1,
              registered_date = $2::date,
              company_name = $3,
              counterparty_id = $4,
              file_rel_path = $5,
              mime = $6,
              file_name = $7,
              updated_at = now()
        where id = $8 and purchase_id = $9
        returning ${PURCHASE_OFFER_SELECT}`,
      [
        metadata.registeredNumber,
        metadata.registeredDate,
        metadata.companyName,
        metadata.counterpartyId,
        nextFile.fileRelPath,
        nextFile.mime,
        nextFile.fileName,
        offerId,
        purchaseId,
      ]
    );
    await this.touchPurchase(purchaseId);
    return {
      offer: toPublicOffer(mapPurchaseOfferRecord(result.rows[0])),
      previousFileRelPath: file && file.fileRelPath !== current.fileRelPath ? current.fileRelPath : null,
    };
  }

  async deletePurchaseOffer(
    userId: number,
    purchaseId: number,
    offerId: number
  ): Promise<StoredPurchaseOfferRecord> {
    const current = await this.getPurchaseOfferRecord(userId, purchaseId, offerId);
    if (!current) {
      throw new HttpError(404, 'КП не найдено');
    }
    await this.pgPool.query('delete from purchase_offers where id = $1 and purchase_id = $2', [offerId, purchaseId]);
    await this.touchPurchase(purchaseId);
    return current;
  }

  async listCounterparties(): Promise<StoredCounterparty[]> {
    const result = await this.pgPool.query<CounterpartyRow>(
      `select id, company_name, short_name, full_name, director, director_genitive, director_dative,
              email, phone, legal_address, postal_address, tags,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from counterparties
        order by created_at desc, id desc`
    );
    return result.rows.map(mapCounterpartyRow);
  }

  async createCounterparty(input: unknown): Promise<StoredCounterparty> {
    const values = normalizeCounterpartyInput(input);
    const result = await this.pgPool.query<CounterpartyRow>(
      `insert into counterparties (
         company_name, short_name, full_name, director, director_genitive, director_dative,
         email, phone, legal_address, postal_address, tags
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       returning id, company_name, short_name, full_name, director, director_genitive, director_dative,
                 email, phone, legal_address, postal_address, tags,
                 floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                 floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [
        values.companyName,
        values.shortName,
        values.fullName,
        values.director,
        values.directorGenitive,
        values.directorDative,
        values.email,
        values.phone,
        values.legalAddress,
        values.postalAddress,
        JSON.stringify(values.tags),
      ]
    );

    return mapCounterpartyRow(result.rows[0]);
  }

  async updateCounterparty(id: number, input: unknown): Promise<StoredCounterparty> {
    const current = await this.getCounterpartyById(id);
    if (!current) {
      throw new HttpError(404, 'Контрагент не найден');
    }

    const values = normalizeCounterpartyInput(input, current);
    const result = await this.pgPool.query<CounterpartyRow>(
      `update counterparties
          set company_name = $1,
              short_name = $2,
              full_name = $3,
              director = $4,
              director_genitive = $5,
              director_dative = $6,
              email = $7,
              phone = $8,
              legal_address = $9,
              postal_address = $10,
              tags = $11::jsonb,
              updated_at = now()
        where id = $12
        returning id, company_name, short_name, full_name, director, director_genitive, director_dative,
                  email, phone, legal_address, postal_address, tags,
                  floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
                  floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms`,
      [
        values.companyName,
        values.shortName,
        values.fullName,
        values.director,
        values.directorGenitive,
        values.directorDative,
        values.email,
        values.phone,
        values.legalAddress,
        values.postalAddress,
        JSON.stringify(values.tags),
        id,
      ]
    );

    return mapCounterpartyRow(result.rows[0]);
  }

  async deleteCounterparty(id: number): Promise<void> {
    const result = await this.pgPool.query('delete from counterparties where id = $1', [id]);
    if (result.rowCount === 0) {
      throw new HttpError(404, 'Контрагент не найден');
    }
  }

  async importLegacyUsersAndCounterparties(users: StoredUser[], counterparties: StoredCounterparty[]): Promise<void> {
    const client = await this.pgPool.connect();
    try {
      await client.query('begin');
      for (const user of users) {
        await client.query(
          `insert into users (id, username, password, role, settings, must_change_password)
           values ($1, $2, $3, $4, $5::jsonb, $6)
           on conflict (username) do update
              set password = excluded.password,
                  role = excluded.role,
                  settings = excluded.settings,
                  must_change_password = excluded.must_change_password`,
          [user.id, user.username, user.password, user.role, JSON.stringify(pickSettings(user.settings)), user.mustChangePassword]
        );
      }

      for (const counterparty of counterparties) {
        await client.query(
          `insert into counterparties (
             id, company_name, short_name, full_name, director, director_genitive, director_dative,
             email, phone, legal_address, postal_address, tags, created_at, updated_at
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
             to_timestamp($13::double precision / 1000),
             to_timestamp($14::double precision / 1000)
           )
           on conflict (id) do update
              set company_name = excluded.company_name,
                  short_name = excluded.short_name,
                  full_name = excluded.full_name,
                  director = excluded.director,
                  director_genitive = excluded.director_genitive,
                  director_dative = excluded.director_dative,
                  email = excluded.email,
                  phone = excluded.phone,
                  legal_address = excluded.legal_address,
                  postal_address = excluded.postal_address,
                  tags = excluded.tags,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at`,
          [
            counterparty.id,
            counterparty.companyName,
            counterparty.shortName,
            counterparty.fullName,
            counterparty.director,
            counterparty.directorGenitive,
            counterparty.directorDative,
            counterparty.email,
            counterparty.phone,
            counterparty.legalAddress,
            counterparty.postalAddress,
            JSON.stringify(counterparty.tags),
            counterparty.createdAt,
            counterparty.updatedAt,
          ]
        );
      }

      await client.query(
        "select setval(pg_get_serial_sequence('users', 'id'), greatest(coalesce((select max(id) from users), 1), 1), true)"
      );
      await client.query(
        "select setval(pg_get_serial_sequence('counterparties', 'id'), greatest(coalesce((select max(id) from counterparties), 1), 1), true)"
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private async ensureDefaultAdmin() {
    const admin = await this.getUserByUsername('admin');
    if (!admin) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      await this.pgPool.query(
        `insert into users (username, password, role, settings, must_change_password)
         values ($1, $2, 'admin', $3::jsonb, true)`,
        ['admin', hash, JSON.stringify(pickSettings({}))]
      );
      console.log('Default admin user created (admin / admin)');
    } else if (!admin.mustChangePassword && bcrypt.compareSync('admin', admin.password)) {
      await this.pgPool.query('update users set must_change_password = true where id = $1', [admin.id]);
    }
  }

  private async ensureMongoIndexes() {
    await this.documentStates().createIndex({ purchaseId: 1, kind: 1 }, { unique: true });
  }

  private async resolveOfferMetadata(metadata: OfferMetadata): Promise<OfferMetadata> {
    if (metadata.counterpartyId === null) return metadata;
    const counterparty = await this.getCounterpartyById(metadata.counterpartyId);
    if (!counterparty) {
      throw new HttpError(400, 'Контрагент не найден');
    }
    return {
      ...metadata,
      companyName: metadata.companyName || counterparty.companyName,
    };
  }

  private async listPurchaseOfferRecords(userId: number, purchaseId: number): Promise<StoredPurchaseOfferRecord[]> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query<PurchaseOfferRow>(
      `select ${PURCHASE_OFFER_SELECT}
         from purchase_offers
        where purchase_id = $1
        order by registered_date desc, id desc`,
      [purchaseId]
    );
    return result.rows.map(mapPurchaseOfferRecord);
  }

  private async getPurchaseOfferRecord(
    userId: number,
    purchaseId: number,
    offerId: number
  ): Promise<StoredPurchaseOfferRecord | null> {
    await this.requirePurchaseForUser(userId, purchaseId);
    const result = await this.pgPool.query<PurchaseOfferRow>(
      `select ${PURCHASE_OFFER_SELECT}
         from purchase_offers
        where id = $1 and purchase_id = $2`,
      [offerId, purchaseId]
    );
    return result.rows[0] ? mapPurchaseOfferRecord(result.rows[0]) : null;
  }

  private async getCounterpartyById(id: number): Promise<StoredCounterparty | null> {
    const result = await this.pgPool.query<CounterpartyRow>(
      `select id, company_name, short_name, full_name, director, director_genitive, director_dative,
              email, phone, legal_address, postal_address, tags,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from counterparties
        where id = $1`,
      [id]
    );
    return result.rows[0] ? mapCounterpartyRow(result.rows[0]) : null;
  }

  private async getPurchaseForUser(userId: number, purchaseId: number): Promise<StoredPurchase | null> {
    const result = await this.pgPool.query<PurchaseRow>(
      `select id, user_id, name, price, budget_year,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from purchases
        where id = $1 and user_id = $2`,
      [purchaseId, userId]
    );
    return result.rows[0] ? mapPurchaseRow(result.rows[0]) : null;
  }

  private async requirePurchaseForUser(userId: number, purchaseId: number): Promise<StoredPurchase> {
    const purchase = await this.getPurchaseForUser(userId, purchaseId);
    if (!purchase) {
      throw new HttpError(404, 'Закупка не найдена');
    }
    return purchase;
  }

  private async getPurchaseLinkForPurchase(purchaseId: number, linkId: number): Promise<StoredPurchaseLink | null> {
    const result = await this.pgPool.query<PurchaseLinkRow>(
      `select id, purchase_id, url, title,
              floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms,
              floor(extract(epoch from updated_at) * 1000)::bigint as updated_at_ms
         from purchase_links
        where id = $1 and purchase_id = $2`,
      [linkId, purchaseId]
    );
    return result.rows[0] ? mapPurchaseLinkRow(result.rows[0]) : null;
  }

  private async touchPurchase(purchaseId: number): Promise<void> {
    await this.pgPool.query('update purchases set updated_at = now() where id = $1', [purchaseId]);
  }

  private documentStates(): Collection<DocumentStateRecord> {
    return this.mongoDb.collection<DocumentStateRecord>('document_states');
  }
}

function documentStateId(purchaseId: number, kind: DocumentKind): string {
  return `${purchaseId}:${kind}`;
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '23505');
}

export async function getDb(): Promise<AppDatabase> {
  if (dbInstance) return dbInstance;

  const pgPool = getPostgresPool();
  const mongoDb = await getMongoDb();
  dbInstance = new AppDatabase(pgPool, mongoDb);
  await dbInstance.init();

  return dbInstance;
}
