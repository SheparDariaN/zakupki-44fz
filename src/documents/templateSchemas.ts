import type { DocumentKind } from '../types';
import type { DocumentTemplateSchema } from './templateTypes';
import { KP_TEMPLATE } from './kpTemplate';
import { MEMO_TEMPLATE } from './memoTemplate';
import { NMCK_TEMPLATE } from './nmckTemplate';

export const DOCUMENT_TEMPLATE_SCHEMAS = {
  nmck: NMCK_TEMPLATE,
  kp: KP_TEMPLATE,
  memo: MEMO_TEMPLATE,
} satisfies { [K in DocumentKind]: DocumentTemplateSchema<K> };

export function getDocumentTemplateSchema(kind: 'nmck'): DocumentTemplateSchema<'nmck'>;
export function getDocumentTemplateSchema(kind: 'kp'): DocumentTemplateSchema<'kp'>;
export function getDocumentTemplateSchema(kind: 'memo'): DocumentTemplateSchema<'memo'>;
export function getDocumentTemplateSchema(kind: DocumentKind): DocumentTemplateSchema {
  switch (kind) {
    case 'nmck':
      return DOCUMENT_TEMPLATE_SCHEMAS.nmck;
    case 'kp':
      return DOCUMENT_TEMPLATE_SCHEMAS.kp;
    case 'memo':
      return DOCUMENT_TEMPLATE_SCHEMAS.memo;
  }
}

export type { AutofillSource, DocumentTemplateSchema, TemplateFieldSchema } from './templateTypes';
