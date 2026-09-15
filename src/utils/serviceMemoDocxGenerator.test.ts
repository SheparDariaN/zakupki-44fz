import { describe, expect, it } from 'vitest';
import { formatListItems } from '../documents/templateTransforms';
import {
  EMPTY_SERVICE_MEMO_DATE_PLACEHOLDER,
  formatServiceMemoHeaderRequester,
  getServiceMemoHeaderLines,
  getServiceMemoSignatureBlock,
  getServiceMemoSignatureParts,
  getServiceMemoSubjectItems,
} from './serviceMemoDocxGenerator';

describe('service memo list formatting', () => {
  it('начинает пункты со строчной буквы, ставит «;» и точку в конце последнего', () => {
    expect(getServiceMemoSubjectItems(
      'Права на программу для ЭВМ «Альфа». Клиентская лицензия «Сегмент» на 1 год\nПрава на программу для ЭВМ «Альфа». Клиентская лицензия «Модуль ГИС» на 1 год.'
    )).toEqual([
      'права на программу для ЭВМ «Альфа». Клиентская лицензия «Сегмент» на 1 год;',
      'права на программу для ЭВМ «Альфа». Клиентская лицензия «Модуль ГИС» на 1 год.',
    ]);
  });

  it('не формирует пункты списка при пустом перечне', () => {
    expect(getServiceMemoSubjectItems('')).toEqual([]);
    expect(getServiceMemoSubjectItems('  \n  ')).toEqual([]);
  });

  it('идемпотентно форматирует уже размеченный перечень', () => {
    const formatted = formatListItems(
      'права на программу для ЭВМ «Альфа»;\nправа на программу для ЭВМ «Бета».'
    );

    expect(formatListItems(formatted)).toBe(formatted);
  });
});

describe('service memo requester cases', () => {
  it('в шапке склоняет должность и ФИО составителя в родительный падеж', () => {
    expect(formatServiceMemoHeaderRequester('Главный специалист\nИванова Анна Сергеевна')).toBe(
      'Главного специалиста\nИвановой Анны Сергеевны'
    );

    expect(getServiceMemoHeaderLines({
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: 'Главный специалист\nИванов Иван Иванович',
      addressee: 'Директору',
      contractServiceHead: 'Петров Петр Петрович',
      date: '2026-08-26',
    })).toEqual([
      'Директору',
      'Петров Петр Петрович',
      'Главного специалиста',
      'Иванова Ивана Ивановича',
    ]);

    expect(getServiceMemoHeaderLines({
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: 'Главный специалист\nИванов Иван Иванович',
      addressee: '',
      contractServiceHead: 'Петров Петр Петрович',
      date: '2026-08-26',
    })).toEqual([
      'Руководителю контрактной службы',
      'Петров Петр Петрович',
      'Главного специалиста',
      'Иванова Ивана Ивановича',
    ]);
  });

  it('в подписи оставляет составителя в именительном падеже', () => {
    expect(getServiceMemoSignatureParts('Главный специалист\nИванова Анна Сергеевна')).toEqual({
      left: 'Главный специалист',
      right: 'Иванова Анна Сергеевна',
    });
  });

  it('ставит дату в одну колонку с должностью подписанта', () => {
    expect(getServiceMemoSignatureBlock({
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: 'Главный специалист\nИванова Анна Сергеевна',
      addressee: 'Директору',
      contractServiceHead: 'Петров Петр Петрович',
      date: '2026-08-26',
    })).toEqual({
      leftLines: ['Главный специалист', '26.08.2026'],
      right: 'Иванова Анна Сергеевна',
    });
  });

  it('оставляет место для даты подписи, если дата пустая', () => {
    expect(getServiceMemoSignatureBlock({
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: 'Главный специалист\nИванова Анна Сергеевна',
      addressee: 'Директору',
      contractServiceHead: 'Петров Петр Петрович',
      date: '',
    })).toEqual({
      leftLines: ['Главный специалист', EMPTY_SERVICE_MEMO_DATE_PLACEHOLDER],
      right: 'Иванова Анна Сергеевна',
    });
  });

  it('в шапке использует сохраненный родительный падеж ФИО составителя', () => {
    expect(getServiceMemoHeaderLines({
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: 'Главный специалист\nИванова Анна Сергеевна',
      requesterNameInflection: {
        nominative: 'Иванова Анна Сергеевна',
        genitive: 'Ивановой Анны Сергеевны (ручная форма)',
      },
      addressee: 'Директору',
      contractServiceHead: 'Петров Петр Петрович',
      date: '2026-08-26',
    })).toEqual([
      'Директору',
      'Петров Петр Петрович',
      'Главного специалиста',
      'Ивановой Анны Сергеевны (ручная форма)',
    ]);

    expect(formatServiceMemoHeaderRequester('Главный специалист\nПетров Петр Петрович', {
      nominative: 'Иванова Анна Сергеевна',
      genitive: 'Ивановой Анны Сергеевны (ручная форма)',
    })).toBe('Главного специалиста\nПетрова Петра Петровича');
  });
});
