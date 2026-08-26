import { describe, expect, it } from 'vitest';
import { formatListItems } from '../documents/templateTransforms';
import {
  formatServiceMemoHeaderRequester,
  getServiceMemoHeaderLines,
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
});
