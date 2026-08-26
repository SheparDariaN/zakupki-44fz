export const DOCUMENT_KINDS = ['nmck', 'kp', 'memo'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export interface Supplier {
  id: string;
  name: string;
  kpDetails: string;
}

export interface Position {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface PriceEntry {
  positionId: string;
  supplierId: string;
  price: number;
}

export interface Requisites {
  customer: string;
  subject: string;
  date: string;
  executorName: string;
  executorPosition: string;
}

export interface AppState {
  requisites: Requisites;
  suppliers: Supplier[];
  positions: Position[];
  prices: PriceEntry[];
}

export interface KpDocxData {
  vendorInfos: string[];
  subjectIntro: string;
  subjectTable: string;
  serviceConditions: string[];
  purchasePeriod: string;
  submissionDeadline: string;
  submissionEmail: string;
  contactPerson: string;
}

export interface Counterparty {
  id: number;
  companyName: string;
  shortName: string;
  fullName: string;
  director: string;
  directorGenitive: string;
  directorDative: string;
  email: string;
  phone: string;
  legalAddress: string;
  postalAddress: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ServiceMemoData {
  purpose: string;
  subjectIntro: string;
  subjectTable: string;
  requester: string;
  contractServiceHead: string;
  date: string;
}

export type DocumentStateByKind = {
  nmck: AppState;
  kp: KpDocxData;
  memo: ServiceMemoData;
};

export type DocumentState = DocumentStateByKind[DocumentKind];
