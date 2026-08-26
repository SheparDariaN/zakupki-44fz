import { describe, expect, it } from 'vitest';
import {
  declineFullName,
  declinePosition,
  formatDateRu,
  formatInitials,
  formatSignatureName,
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
});
