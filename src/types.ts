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
