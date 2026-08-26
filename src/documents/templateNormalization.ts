import type { DocumentKind, DocumentStateByKind } from '../types';
import { DOCUMENT_TEMPLATE_SCHEMAS } from './templateSchemas';
import type { TemplateFieldSchema, TemplateTransform } from './templateTypes';
import {
  applyTemplateTransforms,
  compactString,
  getPathValue,
  isMeaningful,
  isRecord,
  setPathValue,
} from './templateTransforms';

function uniqueTransforms(transforms: readonly TemplateTransform[]): TemplateTransform[] {
  return transforms.filter((transform, index) => transforms.indexOf(transform) === index);
}

function getFieldTransforms(field: TemplateFieldSchema): TemplateTransform[] {
  const documentStateSource = field.sources.find((source) => source.kind === 'documentState');
  const fieldTransforms = field.valueType === 'multilineText'
    ? (field.transforms ?? []).filter((transform) => transform !== 'formatSignatureName')
    : (field.transforms ?? []);

  return uniqueTransforms([
    ...(documentStateSource?.transforms ?? []),
    ...fieldTransforms,
  ]);
}

function normalizeByValueType(value: unknown, field: TemplateFieldSchema): unknown {
  if (field.valueType === 'list') {
    if (!Array.isArray(value)) return value;
    return value.map((item) => (
      typeof item === 'string' ? item.trim() : item
    ));
  }

  if (field.valueType === 'text' || field.valueType === 'multilineText' || field.valueType === 'date') {
    return compactString(value);
  }

  return value;
}

function getFixedTextDefault(field: TemplateFieldSchema): string | undefined {
  const fixedTextSource = field.sources.find((source) => source.kind === 'fixedText');
  return fixedTextSource?.description;
}

function normalizeValue(value: unknown, field: TemplateFieldSchema): unknown {
  const defaultValue = getFixedTextDefault(field);
  const valueWithDefault = !isMeaningful(value) && defaultValue !== undefined
    ? defaultValue
    : value;
  const transformed = applyTemplateTransforms(valueWithDefault, getFieldTransforms(field));

  return normalizeByValueType(transformed, field);
}

function normalizeRepeatedField<K extends DocumentKind>(
  state: DocumentStateByKind[K],
  field: TemplateFieldSchema
): DocumentStateByKind[K] {
  const repeatedMatch = field.statePath.match(/^(.+)\[\](?:\.(.+))?$/);
  if (!repeatedMatch) return state;

  const [, collectionPath, itemPath] = repeatedMatch;
  const collection = getPathValue(state, collectionPath);
  if (!Array.isArray(collection)) return state;

  const normalizedCollection = collection.map((item) => {
    if (!itemPath) {
      return normalizeValue(item, field);
    }

    if (!isRecord(item)) return item;
    const currentValue = getPathValue(item, itemPath);
    return setPathValue(item, itemPath, normalizeValue(currentValue, field));
  });

  return setPathValue(state, collectionPath, normalizedCollection);
}

export function normalizeDocumentState<K extends DocumentKind>(
  documentKind: K,
  state: DocumentStateByKind[K]
): DocumentStateByKind[K] {
  const schema = DOCUMENT_TEMPLATE_SCHEMAS[documentKind];

  return schema.fields.reduce<DocumentStateByKind[K]>((currentState, field) => {
    if (field.valueType === 'calculated') return currentState;
    if (field.statePath.includes('[]')) {
      return normalizeRepeatedField(currentState, field);
    }

    const currentValue = getPathValue(currentState, field.statePath);
    return setPathValue(currentState, field.statePath, normalizeValue(currentValue, field));
  }, state);
}

export function normalizeNmckState(state: DocumentStateByKind['nmck']) {
  return normalizeDocumentState('nmck', state);
}

export function normalizeKpState(state: DocumentStateByKind['kp']) {
  return normalizeDocumentState('kp', state);
}

export function normalizeMemoState(state: DocumentStateByKind['memo']) {
  return normalizeDocumentState('memo', state);
}
