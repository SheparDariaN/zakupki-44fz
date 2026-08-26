import type { DocumentKind, DocumentStateByKind } from '../types';
import { generateDocx } from '../utils/docxGenerator';
import { generateKpDocx } from '../utils/kpDocxGenerator';
import { generateServiceMemoDocx } from '../utils/serviceMemoDocxGenerator';
import type { DocumentBatchScenario, DocumentTemplateSchema } from './templateTypes';
import { KP_VENDOR_BATCH_SCENARIO, MEMO_BATCH_SCENARIOS, NMCK_BATCH_SCENARIOS } from './batchScenarios';
import { DOCUMENT_TEMPLATE_SCHEMAS } from './templateSchemas';

type DocumentGenerator<K extends DocumentKind> = (state: DocumentStateByKind[K]) => Promise<void>;

export type DocumentRegistryEntry<K extends DocumentKind = DocumentKind> = {
  kind: K;
  title: string;
  route: string;
  batchScenarios: readonly DocumentBatchScenario<K>[];
  supportsBatch: boolean;
  defaultHistoryName: string;
  getHistoryName: (state: DocumentStateByKind[K]) => string;
  generate: DocumentGenerator<K>;
  template: DocumentTemplateSchema<K>;
};

export const DOCUMENT_REGISTRY = {
  nmck: {
    kind: 'nmck',
    title: 'Обоснование НМЦК',
    route: '/',
    batchScenarios: NMCK_BATCH_SCENARIOS,
    supportsBatch: false,
    defaultHistoryName: 'Обоснование НМЦК',
    getHistoryName: (state) => state.requisites.subject || 'Обоснование НМЦК',
    generate: generateDocx,
    template: DOCUMENT_TEMPLATE_SCHEMAS.nmck,
  },
  kp: {
    kind: 'kp',
    title: 'Запрос КП',
    route: '/kp',
    batchScenarios: [KP_VENDOR_BATCH_SCENARIO],
    supportsBatch: true,
    defaultHistoryName: 'Запрос КП',
    getHistoryName: (state) => {
      const firstVendor = state.vendorInfos.find((vendor) => vendor.trim()) || '';
      const name = state.subjectTable || state.subjectIntro || 'Запрос КП';
      return firstVendor ? `Запрос КП: ${name}` : name;
    },
    generate: generateKpDocx,
    template: DOCUMENT_TEMPLATE_SCHEMAS.kp,
  },
  memo: {
    kind: 'memo',
    title: 'Служебная записка',
    route: '/memo',
    batchScenarios: MEMO_BATCH_SCENARIOS,
    supportsBatch: false,
    defaultHistoryName: 'Служебная записка',
    getHistoryName: (state) => state.subjectIntro || 'Служебная записка',
    generate: generateServiceMemoDocx,
    template: DOCUMENT_TEMPLATE_SCHEMAS.memo,
  },
} satisfies { [K in DocumentKind]: DocumentRegistryEntry<K> };

export function getDocumentTitle(kind: DocumentKind): string {
  return DOCUMENT_REGISTRY[kind].title;
}

export async function generateRegisteredDocument(kind: DocumentKind, state: unknown) {
  switch (kind) {
    case 'nmck':
      return DOCUMENT_REGISTRY.nmck.generate(state as DocumentStateByKind['nmck']);
    case 'kp':
      return DOCUMENT_REGISTRY.kp.generate(state as DocumentStateByKind['kp']);
    case 'memo':
      return DOCUMENT_REGISTRY.memo.generate(state as DocumentStateByKind['memo']);
  }
}
