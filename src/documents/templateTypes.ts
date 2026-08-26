import type { DocumentKind } from '../types';

export type TemplateValueType =
  | 'text'
  | 'multilineText'
  | 'date'
  | 'number'
  | 'money'
  | 'list'
  | 'table'
  | 'calculated';

export type AutofillSourceKind =
  | 'userSettings'
  | 'counterparty'
  | 'currentPurchase'
  | 'currentDate'
  | 'documentState'
  | 'calculated'
  | 'fixedText';

export type TemplateTransform =
  | 'trim'
  | 'joinLines'
  | 'formatCounterpartyVendorInfo'
  | 'formatDateRu'
  | 'formatSignatureName'
  | 'toGenitiveCase'
  | 'toDativeCase'
  | 'formatListItems'
  | 'formatContactPersonWithPhone'
  | 'formatMoney'
  | 'formatAmountInWords';

export type AutofillSource = {
  kind: AutofillSourceKind;
  label: string;
  path?: string;
  description?: string;
  transforms?: readonly TemplateTransform[];
};

export type RepeatableField = {
  statePath: string;
  itemLabel: string;
  minItems?: number;
};

export type LinkedFieldGroup = {
  key: string;
  label: string;
};

export type DocumentBatchScenarioStatus = 'implemented' | 'prepared';

export type DocumentBatchScenario<K extends DocumentKind = DocumentKind> = {
  documentKind: K;
  id: string;
  label: string;
  description: string;
  status: DocumentBatchScenarioStatus;
  batchKey: string;
  variantLabel: string;
  repeatableStatePath?: string;
  varyingFields: readonly string[];
  singleFileName: string;
  zipFileName: string;
};

export type TemplateFieldSchema<K extends DocumentKind = DocumentKind> = {
  documentKind: K;
  fieldKey: string;
  label: string;
  statePath: string;
  valueType: TemplateValueType;
  required: boolean;
  sources: readonly AutofillSource[];
  description?: string;
  transforms?: readonly TemplateTransform[];
  repeatable?: RepeatableField;
  linkedGroup?: LinkedFieldGroup;
  batchKey?: string;
};

export type DocumentTemplateSchema<K extends DocumentKind = DocumentKind> = {
  kind: K;
  title: string;
  fields: readonly TemplateFieldSchema<K>[];
};
