export const DOCUMENT_KINDS = ['nmck', 'kp', 'memo'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export const PURCHASE_DOCUMENT_KINDS = [...DOCUMENT_KINDS, 'contract'] as const;

export type PurchaseDocumentKind = (typeof PURCHASE_DOCUMENT_KINDS)[number];

export function isPurchaseDocumentKind(value: unknown): value is PurchaseDocumentKind {
  return typeof value === 'string' && (PURCHASE_DOCUMENT_KINDS as readonly string[]).includes(value);
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
  signerPosition: string;
  signerName: string;
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

export interface UserSettings {
  customer: string;
  executorPosition: string;
  executorName: string;
  executorNameGenitive: string;
  executorNameDative: string;
  submissionEmail: string;
  contactPerson: string;
  contactPersonGenitive: string;
  contactPersonDative: string;
  contactPhone: string;
  contractServiceHeadPosition: string;
  contractServiceHeadName: string;
  contractServiceHeadNameGenitive: string;
  contractServiceHeadNameDative: string;
  defaultServiceConditions: string[];
}

export interface InflectedPhrase {
  nominative: string;
  genitive: string;
  dative: string;
}

export interface ServiceMemoData {
  purpose: string;
  subjectIntro: string;
  subjectTable: string;
  requester: string;
  requesterNameInflection?: Pick<InflectedPhrase, 'nominative' | 'genitive'>;
  addressee: string;
  contractServiceHead: string;
  date: string;
}

export type DocumentStateByKind = {
  nmck: AppState;
  kp: KpDocxData;
  memo: ServiceMemoData;
};

export type DocumentState = DocumentStateByKind[DocumentKind];

export interface Purchase {
  id: number;
  userId: number;
  name: string;
  price: number | null;
  budgetYear: number | null;
  createdAt: number;
  updatedAt: number;
}

export type PurchaseDocumentCounts = Record<PurchaseDocumentKind, number> & {
  offers: number;
};

export interface PurchaseListItem extends Purchase {
  documentCounts: PurchaseDocumentCounts;
  linksCount: number;
}

export interface PurchaseLink {
  id: number;
  purchaseId: number;
  url: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseDocumentMetadata {
  id: number;
  purchaseId: number;
  kind: PurchaseDocumentKind;
  storage: 'mongo' | 'file';
  mongoId: string | null;
  fileRelPath: string | null;
  mime: string | null;
  fileName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseOffer {
  id: number;
  purchaseId: number;
  registeredNumber: string;
  registeredDate: string;
  companyName: string;
  counterpartyId: number | null;
  mime: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
}

export type PurchaseDocumentStates = Partial<Record<DocumentKind, unknown>>;

export interface PurchaseContext {
  purchase: Purchase;
  links: PurchaseLink[];
  documents: PurchaseDocumentStates;
  contract: PurchaseDocumentMetadata | null;
  offers: PurchaseOffer[];
  settings: UserSettings;
}
