import type { Counterparty, InflectedPhrase, Position } from '../types';
import type { TemplateTransform } from './templateTypes';
import {
  declinePhrase,
  formatDateRu,
  formatSignatureName,
  isLikelyFullName,
  resolveInflection,
  type RussianCase,
} from '../utils/morphology';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isInflectedPhrase(value: unknown): value is Partial<InflectedPhrase> {
  return isRecord(value) && typeof value.nominative === 'string';
}

export function compactString(value: unknown): string {
  if (isInflectedPhrase(value)) return resolveInflection(value, 'nominative');
  return typeof value === 'string' ? value.trim() : '';
}

export function isMeaningful(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (isRecord(value)) return Object.values(value).some(isMeaningful);
  return value !== null && value !== undefined;
}

export function getPathValue(source: unknown, path?: string): unknown {
  if (!path) return source;
  if (path.includes(',')) {
    return path.split(',').map((part) => getPathValue(source, part.trim()));
  }

  const repeatedMatch = path.match(/^(.+)\[\](?:\.(.+))?$/);
  if (repeatedMatch) {
    const [, collectionPath, itemPath] = repeatedMatch;
    const collection = getPathValue(source, collectionPath);
    if (!Array.isArray(collection)) return undefined;
    return itemPath ? collection.map((item) => getPathValue(item, itemPath)) : collection;
  }

  return path.split('.').reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, source);
}

export function setPathValue<T>(state: T, path: string, value: unknown): T {
  if (path.includes('[]')) return state;

  const parts = path.split('.');
  const copy: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  let cursor = copy;

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }

    const next = cursor[part];
    const nextCopy: Record<string, unknown> = { ...(isRecord(next) ? next : {}) };
    cursor[part] = nextCopy;
    cursor = nextCopy;
  });

  return copy as T;
}

function isCounterparty(value: unknown): value is Counterparty {
  return isRecord(value) && typeof value.companyName === 'string';
}

export function formatCounterpartyVendorInfo(counterparty: Counterparty): string {
  const storedDirectorDative = counterparty.directorDative.trim();
  const director = counterparty.director.trim();
  const directorDative = storedDirectorDative
    || (isLikelyFullName(director)
      ? resolveInflection({ nominative: director }, 'dative')
      : director);
  const addressLines = [
    counterparty.legalAddress,
    counterparty.postalAddress && counterparty.postalAddress !== counterparty.legalAddress
      ? counterparty.postalAddress
      : '',
  ];

  return [
    counterparty.fullName || counterparty.companyName,
    directorDative,
    ...addressLines,
    counterparty.email,
    counterparty.phone,
  ].map((value) => value.trim()).filter(Boolean).join('\n\n');
}

function formatPositionLine(position: Position): string {
  const name = position.name.trim();
  const details = [
    position.unit.trim() ? `ЕИ: ${position.unit.trim()}` : '',
    Number.isFinite(position.quantity) ? `кол-во: ${position.quantity}` : '',
  ].filter(Boolean);

  return details.length > 0 ? `${name} (${details.join(', ')})` : name;
}

function joinLines(value: unknown): string {
  if (!Array.isArray(value)) return compactString(value);

  return value
    .flatMap((item) => {
      if (isRecord(item) && typeof item.name === 'string') {
        return formatPositionLine(item as unknown as Position);
      }
      if (Array.isArray(item)) return item.map(compactString);
      return compactString(item);
    })
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function toListLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(toListLines);
  }
  if (typeof value !== 'string') return [];

  return value
    .split('\n')
    .map((line) => line.replace(/^[\s•*-]+/, '').trim())
    .filter(Boolean);
}

export function formatContactPersonWithPhone(value: unknown): string {
  const parts = Array.isArray(value) ? value : [value];
  const name = compactString(parts[0]);
  const phone = compactString(parts[1]).replace(/^т\.\s*/iu, '');

  if (!name) return '';
  if (!phone) return name;
  if (/(?:^|,)\s*т\.\s*/u.test(name) || name.includes(phone)) return name;

  return `${name}, т. ${phone}`;
}

export function formatListItems(value: unknown): string {
  const lines = toListLines(value)
    .map((line) => line.replace(/[;.]+$/u, '').trim())
    .map((line) => line.replace(/^[А-ЯЁA-Z]/u, (letter) => letter.toLowerCase()))
    .filter(Boolean);

  return lines
    .map((line, index) => `${line}${index === lines.length - 1 ? '.' : ';'}`)
    .join('\n');
}

function applyCaseTransform(value: unknown, grammaticalCase: Exclude<RussianCase, 'nominative'>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => applyCaseTransform(item, grammaticalCase));
  }
  if (isInflectedPhrase(value)) {
    return resolveInflection(value, grammaticalCase);
  }

  return typeof value === 'string' ? declinePhrase(value, grammaticalCase) : value;
}

function applyTransform(value: unknown, transform: TemplateTransform): unknown {
  switch (transform) {
    case 'trim':
      return typeof value === 'string' || isInflectedPhrase(value) ? compactString(value) : value;
    case 'joinLines':
      return joinLines(value);
    case 'formatCounterpartyVendorInfo':
      if (Array.isArray(value)) {
        return value.filter(isCounterparty).map(formatCounterpartyVendorInfo).filter(Boolean);
      }
      return isCounterparty(value) ? formatCounterpartyVendorInfo(value) : value;
    case 'formatDateRu':
      return formatDateRu(value);
    case 'formatSignatureName':
      return typeof value === 'string' ? formatSignatureName(value) : value;
    case 'toGenitiveCase':
      return applyCaseTransform(value, 'genitive');
    case 'toDativeCase':
      return applyCaseTransform(value, 'dative');
    case 'formatListItems':
      return formatListItems(value);
    case 'formatContactPersonWithPhone':
      return formatContactPersonWithPhone(value);
    case 'formatMoney':
    case 'formatAmountInWords':
      return value;
  }
}

export function applyTemplateTransforms(
  value: unknown,
  transforms: readonly TemplateTransform[] = []
): unknown {
  return transforms.reduce((current, transform) => applyTransform(current, transform), value);
}
