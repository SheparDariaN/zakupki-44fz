import { describe, expect, it } from 'vitest';
import {
  declinePhrase,
  declineFullName,
  declinePosition,
  formatDateRu,
  formatInitials,
  formatSignatureName,
  hydrateInflection,
  resolveInflection,
  suggestInflection,
  syncInflection,
  splitFullName,
} from './morphology';

describe('morphology date formatting', () => {
  it('форматирует ISO-дату и Date в русскую короткую дату', () => {
    expect(formatDateRu('2026-08-21')).toBe('21.08.2026');
    expect(formatDateRu(new Date(2026, 7, 21))).toBe('21.08.2026');
    expect(formatDateRu(' 21.08.2026 ')).toBe('21.08.2026');
    expect(formatDateRu('')).toBe('');
  });

  it('форматирует дату с месяцем прописью', () => {
    expect(formatDateRu('2026-08-21', { monthName: true })).toBe('21 августа 2026 г.');
  });
});

describe('morphology full name formatting', () => {
  it('разбирает ФИО на части', () => {
    expect(splitFullName('  Иванов   Иван   Иванович  ')).toEqual({
      lastName: 'Иванов',
      firstName: 'Иван',
      patronymic: 'Иванович',
      extra: [],
    });
  });

  it('форматирует инициалы для таблиц и подписи', () => {
    expect(formatInitials('Иванов Иван Иванович')).toBe('Иванов И.И.');
    expect(formatSignatureName('Шайкомалов Сархан Шухратович')).toBe('С.Ш. Шайкомалов');
    expect(formatInitials('Петрова Анна-Мария Сергеевна')).toBe('Петрова А.-М.С.');
  });

  it('сохраняет документные формы подписанта и контактного лица', () => {
    expect(formatSignatureName('Петров Петр Петрович')).toBe('П.П. Петров');
    expect(formatInitials('Сидорова Мария Игоревна')).toBe('Сидорова М.И.');
  });
});

describe('morphology case transforms', () => {
  it('склоняет ФИО в родительный и дательный падежи', () => {
    expect(declineFullName('Иванов Иван Иванович', 'genitive')).toBe('Иванова Ивана Ивановича');
    expect(declineFullName('Иванов Иван Иванович', 'dative')).toBe('Иванову Ивану Ивановичу');
    expect(declineFullName('Иванова Анна Сергеевна', 'genitive')).toBe('Ивановой Анны Сергеевны');
    expect(declineFullName('Иванова Анна Сергеевна', 'dative')).toBe('Ивановой Анне Сергеевне');
  });

  it('склоняет типовые должности из шаблонов', () => {
    expect(declinePosition('руководитель контрактной службы', 'dative')).toBe('руководителю контрактной службы');
    expect(declinePosition('руководитель контрактной службы', 'genitive')).toBe('руководителя контрактной службы');
    expect(declinePosition('главный специалист', 'dative')).toBe('главному специалисту');
    expect(declinePosition('директор', 'genitive')).toBe('директора');
  });

  it('склоняет должности подписанта и директора контрагента без потери регистра', () => {
    expect(declinePosition('Начальник отдела', 'genitive')).toBe('Начальника отдела');
    expect(declinePosition('Директор', 'dative')).toBe('Директору');
  });

  it('склоняет фразу как ФИО или должность', () => {
    expect(declinePhrase('Иванов Иван Иванович', 'dative')).toBe('Иванову Ивану Ивановичу');
    expect(declinePhrase('Директор', 'dative')).toBe('Директору');
    expect(declinePhrase('Директор\nИванов Иван Иванович', 'genitive')).toBe(
      'Директора\nИванова Ивана Ивановича'
    );
  });
});

describe('morphology inflection helpers', () => {
  it('предлагает формы для именительного падежа', () => {
    expect(suggestInflection('  Иванов   Иван   Иванович  ')).toEqual({
      nominative: 'Иванов Иван Иванович',
      genitive: 'Иванова Ивана Ивановича',
      dative: 'Иванову Ивану Ивановичу',
    });
  });

  it('использует сохранённую форму, если она заполнена', () => {
    expect(resolveInflection({
      nominative: 'Иванов Иван Иванович',
      genitive: 'Иванова Ивана Ивановича (ручная форма)',
    }, 'genitive')).toBe('Иванова Ивана Ивановича (ручная форма)');
    expect(resolveInflection({
      nominative: 'Иванов Иван Иванович',
      genitive: '',
    }, 'genitive')).toBe('Иванова Ивана Ивановича');
  });

  it('гидратирует пустые формы авто-подсказкой при непустом именительном', () => {
    expect(hydrateInflection({
      nominative: 'Иванов Иван Иванович',
      genitive: '',
      dative: '',
    })).toEqual({
      nominative: 'Иванов Иван Иванович',
      genitive: 'Иванова Ивана Ивановича',
      dative: 'Иванову Ивану Ивановичу',
    });

    expect(hydrateInflection({
      nominative: 'Иванов Иван Иванович',
      genitive: 'ручной родительный',
      dative: '',
    })).toEqual({
      nominative: 'Иванов Иван Иванович',
      genitive: 'ручной родительный',
      dative: 'Иванову Ивану Ивановичу',
    });
  });

  it('сохраняет ручные формы, пока именительный падеж не изменился', () => {
    expect(syncInflection({
      nominative: 'Иванов Иван Иванович',
      genitive: 'ручной родительный',
      dative: 'ручной дательный',
    }, ' Иванов Иван Иванович ')).toEqual({
      nominative: 'Иванов Иван Иванович',
      genitive: 'ручной родительный',
      dative: 'ручной дательный',
    });
  });

  it('пересчитывает формы при смене именительного падежа', () => {
    expect(syncInflection({
      nominative: 'Иванов Иван Иванович',
      genitive: 'ручной родительный',
      dative: 'ручной дательный',
    }, 'Петров Петр Петрович')).toEqual({
      nominative: 'Петров Петр Петрович',
      genitive: 'Петрова Петра Петровича',
      dative: 'Петрову Петру Петровичу',
    });
  });
});
