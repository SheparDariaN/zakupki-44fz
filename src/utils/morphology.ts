import type { InflectedPhrase } from '../types';

export type RussianCase = 'nominative' | 'genitive' | 'dative';

export type FullNameParts = {
  lastName: string;
  firstName: string;
  patronymic: string;
  extra: string[];
};

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const POSITION_CASES: Record<string, Record<Exclude<RussianCase, 'nominative'>, string>> = {
  'главный специалист': {
    genitive: 'главного специалиста',
    dative: 'главному специалисту',
  },
  'директор': {
    genitive: 'директора',
    dative: 'директору',
  },
  'и. о. директора': {
    genitive: 'и. о. директора',
    dative: 'и. о. директора',
  },
  'руководитель контрактной службы': {
    genitive: 'руководителя контрактной службы',
    dative: 'руководителю контрактной службы',
  },
};

function compact(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function applyCapitalization(source: string, result: string): string {
  if (!source) return result;
  if (source === source.toUpperCase()) return result.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

function initialForPart(value: string): string {
  return value
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join('-');
}

function isLikelyFemaleName(parts: FullNameParts): boolean {
  const patronymic = parts.patronymic.toLowerCase();
  if (patronymic.endsWith('на')) return true;
  if (patronymic.endsWith('ич')) return false;
  return parts.lastName.toLowerCase().endsWith('а');
}

function declineHyphenated(value: string, decline: (part: string) => string): string {
  return value
    .split('-')
    .map((part) => decline(part))
    .join('-');
}

function declineMaleNamePart(value: string, grammaticalCase: Exclude<RussianCase, 'nominative'>): string {
  const lower = value.toLowerCase();
  const declined = (() => {
    if (lower.endsWith('ий')) return value.slice(0, -2) + (grammaticalCase === 'genitive' ? 'ия' : 'ию');
    if (lower.endsWith('й')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'я' : 'ю');
    if (lower.endsWith('ь')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'я' : 'ю');
    if (/[бвгджзклмнпрстфхцчшщ]$/i.test(value)) {
      return value + (grammaticalCase === 'genitive' ? 'а' : 'у');
    }
    return value;
  })();
  return applyCapitalization(value, declined);
}

function declineFemaleNamePart(value: string, grammaticalCase: Exclude<RussianCase, 'nominative'>): string {
  const lower = value.toLowerCase();
  const declined = (() => {
    if (/(ова|ева|ёва|ина|ына)$/.test(lower)) return value.slice(0, -1) + 'ой';
    if (lower.endsWith('ия')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'и' : 'и');
    if (lower.endsWith('ая')) return value.slice(0, -2) + (grammaticalCase === 'genitive' ? 'ой' : 'ой');
    if (lower.endsWith('а')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'ы' : 'е');
    if (lower.endsWith('я')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'и' : 'е');
    return value;
  })();
  return applyCapitalization(value, declined);
}

function declineSimpleNoun(value: string, grammaticalCase: Exclude<RussianCase, 'nominative'>): string {
  const lower = value.toLowerCase();
  const declined = (() => {
    if (lower.endsWith('ия')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'и' : 'и');
    if (lower.endsWith('ие')) return value.slice(0, -2) + (grammaticalCase === 'genitive' ? 'ия' : 'ию');
    if (lower.endsWith('ий')) return value.slice(0, -2) + (grammaticalCase === 'genitive' ? 'ия' : 'ию');
    if (lower.endsWith('ый') || lower.endsWith('ой')) {
      return value.slice(0, -2) + (grammaticalCase === 'genitive' ? 'ого' : 'ому');
    }
    if (lower.endsWith('ая')) return value.slice(0, -2) + 'ой';
    if (lower.endsWith('ое') || lower.endsWith('ее')) {
      return value.slice(0, -2) + (grammaticalCase === 'genitive' ? 'ого' : 'ому');
    }
    if (lower.endsWith('й')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'я' : 'ю');
    if (lower.endsWith('ь')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'я' : 'ю');
    if (lower.endsWith('а')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'ы' : 'е');
    if (lower.endsWith('я')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'и' : 'е');
    if (lower.endsWith('о')) return value.slice(0, -1) + (grammaticalCase === 'genitive' ? 'а' : 'у');
    if (/[бвгджзклмнпрстфхцчшщ]$/i.test(value)) {
      return value + (grammaticalCase === 'genitive' ? 'а' : 'у');
    }
    return value;
  })();
  return applyCapitalization(value, declined);
}

export function splitFullName(value: string): FullNameParts {
  const [lastName = '', firstName = '', patronymic = '', ...extra] = compact(value).split(' ').filter(Boolean);
  return { lastName, firstName, patronymic, extra };
}

export function formatInitials(value: string): string {
  const parts = splitFullName(value);
  const initials = [parts.firstName, parts.patronymic].filter(Boolean).map(initialForPart).join('');
  return [parts.lastName, initials, ...parts.extra].filter(Boolean).join(' ');
}

export function formatSignatureName(value: string): string {
  const parts = splitFullName(value);
  const initials = [parts.firstName, parts.patronymic].filter(Boolean).map(initialForPart).join('');
  return [initials, parts.lastName, ...parts.extra].filter(Boolean).join(' ');
}

export function formatDateRu(value: unknown, options: { monthName?: boolean } = {}): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    if (options.monthName) return `${value.getDate()} ${MONTHS_GENITIVE[value.getMonth()]} ${value.getFullYear()} г.`;
    return value.toLocaleDateString('ru-RU');
  }
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (options.monthName) {
      const monthIndex = Number(month) - 1;
      if (monthIndex >= 0 && monthIndex < MONTHS_GENITIVE.length) {
        return `${Number(day)} ${MONTHS_GENITIVE[monthIndex]} ${year} г.`;
      }
    }
    return `${day}.${month}.${year}`;
  }

  return trimmed;
}

export function declineFullName(value: string, grammaticalCase: RussianCase): string {
  if (grammaticalCase === 'nominative') return compact(value);

  const parts = splitFullName(value);
  if (!parts.lastName) return '';
  const female = isLikelyFemaleName(parts);
  const declineNamePart = female ? declineFemaleNamePart : declineMaleNamePart;
  const lastName = declineHyphenated(parts.lastName, (part) => (
    female ? declineFemaleNamePart(part, grammaticalCase) : declineMaleNamePart(part, grammaticalCase)
  ));
  const firstName = parts.firstName ? declineHyphenated(parts.firstName, (part) => declineNamePart(part, grammaticalCase)) : '';
  const patronymic = parts.patronymic
    ? declineHyphenated(parts.patronymic, (part) => declineNamePart(part, grammaticalCase))
    : '';

  return [lastName, firstName, patronymic, ...parts.extra].filter(Boolean).join(' ');
}

export function declinePosition(value: string, grammaticalCase: RussianCase): string {
  const normalized = compact(value);
  if (grammaticalCase === 'nominative' || !normalized) return normalized;

  const dictionaryValue = POSITION_CASES[normalized.toLowerCase()]?.[grammaticalCase];
  if (dictionaryValue) return applyCapitalization(normalized, dictionaryValue);

  const words = normalized.split(' ');
  if (words.length === 1) return declineSimpleNoun(words[0], grammaticalCase);

  const [first, second, ...rest] = words;
  if (words.length === 2 && /(?:ый|ий|ой)$/i.test(first)) {
    return [
      declineSimpleNoun(first, grammaticalCase),
      declineSimpleNoun(second, grammaticalCase),
      ...rest,
    ].join(' ');
  }

  if (words.length === 2) {
    return [declineSimpleNoun(first, grammaticalCase), second].join(' ');
  }

  return [...words.slice(0, -1), declineSimpleNoun(words[words.length - 1], grammaticalCase)].join(' ');
}

export function isLikelyFullName(value: string): boolean {
  const parts = splitFullName(value);
  const nameParts = [parts.lastName, parts.firstName, parts.patronymic];

  return parts.extra.length === 0
    && nameParts.every((part) => /^[А-ЯЁа-яё-]+$/.test(part))
    && !value.includes('.');
}

export function declinePhrase(value: string, grammaticalCase: RussianCase): string {
  if (value.includes('\n')) {
    return value
      .split('\n')
      .map((line) => declinePhrase(line, grammaticalCase))
      .join('\n');
  }

  const normalized = compact(value);
  if (grammaticalCase === 'nominative' || !normalized) return normalized;

  return isLikelyFullName(normalized)
    ? declineFullName(normalized, grammaticalCase)
    : declinePosition(normalized, grammaticalCase);
}

export function suggestInflection(value: string): InflectedPhrase {
  const nominative = declinePhrase(value, 'nominative');

  return {
    nominative,
    genitive: declinePhrase(nominative, 'genitive'),
    dative: declinePhrase(nominative, 'dative'),
  };
}

export function resolveInflection(
  stored: Partial<InflectedPhrase> | null | undefined,
  grammaticalCase: RussianCase
): string {
  const storedValue = compact(stored?.[grammaticalCase]);
  if (storedValue) return storedValue;

  const nominative = compact(stored?.nominative);
  if (grammaticalCase === 'nominative' || !nominative) return nominative;

  return declinePhrase(nominative, grammaticalCase);
}

export function syncInflection(
  stored: Partial<InflectedPhrase> | null | undefined,
  nextNominative: string
): InflectedPhrase {
  const normalizedNext = declinePhrase(nextNominative, 'nominative');
  const normalizedCurrent = declinePhrase(stored?.nominative ?? '', 'nominative');

  if (normalizedNext !== normalizedCurrent) {
    return suggestInflection(normalizedNext);
  }

  const suggested = suggestInflection(normalizedNext);

  return {
    nominative: normalizedNext,
    genitive: compact(stored?.genitive) || suggested.genitive,
    dative: compact(stored?.dative) || suggested.dative,
  };
}

export function hydrateInflection(stored: Partial<InflectedPhrase> | null | undefined): InflectedPhrase {
  return syncInflection(stored, stored?.nominative ?? '');
}
