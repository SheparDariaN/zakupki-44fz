import { describe, expect, it } from 'vitest';
import {
  normalizeCounterpartyInput,
  normalizeCounterpartyRecord,
  normalizeOfferMetadataInput,
  normalizeUserRecord,
  pickSettings,
  validateDocumentInput,
} from './db';
import { HttpError } from './errors';

describe('db normalization', () => {
  it('поддерживает служебную записку как тип документа через общие типы', () => {
    expect(validateDocumentInput(1, 'Служебная записка', { subjectIntro: 'Закупка ПО' }, 'memo')).toMatchObject({
      type: 'memo',
    });
    expect(() => validateDocumentInput(1, 'Неверный тип', {}, 'letter')).toThrow('Тип документа должен быть nmck, kp или memo');
    expect(normalizeUserRecord({
      id: 1,
      username: 'user',
      password: 'hash',
      role: 'bad-role',
      settings: {},
      mustChangePassword: false,
    })).toMatchObject({ role: 'user' });
  });

  it('нормализует расширенные настройки профиля и отбрасывает лишние поля', () => {
    const initial = pickSettings({
      customer: 'ГКУ «ЦИТ Кузбасса»',
      executorName: 'Иванов Иван Иванович',
      defaultServiceConditions: 'Срок оказания услуг: 30 дней\nГарантия 12 месяцев',
      defaultServicePlace: 'г. Кемерово',
    });

    expect(initial).toEqual({
      customer: 'ГКУ «ЦИТ Кузбасса»',
      executorPosition: '',
      executorName: 'Иванов Иван Иванович',
      executorNameGenitive: '',
      executorNameDative: '',
      submissionEmail: '',
      contactPerson: '',
      contactPersonGenitive: '',
      contactPersonDative: '',
      contactPhone: '',
      contractServiceHeadPosition: 'Руководитель контрактной службы',
      contractServiceHeadName: '',
      contractServiceHeadNameGenitive: '',
      contractServiceHeadNameDative: '',
      defaultServiceConditions: ['Срок оказания услуг: 30 дней', 'Гарантия 12 месяцев'],
    });
    expect(initial).not.toHaveProperty('defaultServicePlace');

    expect(pickSettings({
      submissionEmail: 'kp@example.test',
      contactPerson: 'Петров Петр Петрович',
      contactPersonGenitive: 'Петрова Петра Петровича',
      contactPersonDative: 'Петрову Петру Петровичу',
      contactPhone: '+7 000 000-00-00',
      contractServiceHeadName: 'Сидоров Сидор Сидорович',
      contractServiceHeadNameGenitive: 'Сидорова Сидора Сидоровича',
      contractServiceHeadNameDative: 'Сидорову Сидору Сидоровичу',
      executorNameGenitive: 'Иванова Ивана Ивановича',
      executorNameDative: 'Иванову Ивану Ивановичу',
      defaultServiceConditions: ['Срок оказания услуг: 30 дней', '  ', 'Гарантия 12 месяцев'],
      ignored: 'не сохраняется',
    }, initial)).toEqual({
      customer: 'ГКУ «ЦИТ Кузбасса»',
      executorPosition: '',
      executorName: 'Иванов Иван Иванович',
      executorNameGenitive: 'Иванова Ивана Ивановича',
      executorNameDative: 'Иванову Ивану Ивановичу',
      submissionEmail: 'kp@example.test',
      contactPerson: 'Петров Петр Петрович',
      contactPersonGenitive: 'Петрова Петра Петровича',
      contactPersonDative: 'Петрову Петру Петровичу',
      contactPhone: '+7 000 000-00-00',
      contractServiceHeadPosition: 'Руководитель контрактной службы',
      contractServiceHeadName: 'Сидоров Сидор Сидорович',
      contractServiceHeadNameGenitive: 'Сидорова Сидора Сидоровича',
      contractServiceHeadNameDative: 'Сидорову Сидору Сидоровичу',
      defaultServiceConditions: ['Срок оказания услуг: 30 дней', 'Гарантия 12 месяцев'],
    });
  });

  it('нормализует контрагентов из legacy JSON', () => {
    expect(normalizeCounterpartyRecord({
      id: 10,
      companyName: '  ООО Ромашка  ',
      shortName: ' Ромашка ',
      fullName: '  Общество с ограниченной ответственностью Ромашка  ',
      director: '  Иванов Иван Иванович  ',
      directorGenitive: ' Иванова Ивана Ивановича ',
      directorDative: ' Иванову Ивану Ивановичу ',
      email: '  info@example.test  ',
      phone: ' +7 000 000-00-00 ',
      legalAddress: '  г. Москва  ',
      postalAddress: '  101000, г. Москва  ',
      tags: [' поставщик ', '', 'поставщик', '44-ФЗ', 123, '44-ФЗ'],
      createdAt: 1000,
    })).toEqual({
      id: 10,
      companyName: 'ООО Ромашка',
      shortName: 'Ромашка',
      fullName: 'Общество с ограниченной ответственностью Ромашка',
      director: 'Иванов Иван Иванович',
      directorGenitive: 'Иванова Ивана Ивановича',
      directorDative: 'Иванову Ивану Ивановичу',
      email: 'info@example.test',
      phone: '+7 000 000-00-00',
      legalAddress: 'г. Москва',
      postalAddress: '101000, г. Москва',
      tags: ['поставщик', '44-ФЗ'],
      createdAt: 1000,
      updatedAt: 1000,
    });

    expect(normalizeCounterpartyRecord({ id: 11, companyName: '   ' })).toBeNull();
    expect(normalizeCounterpartyRecord({ companyName: 'Без id' })).toBeNull();
  });

  it('создаёт ввод контрагента с trim-полями и уникальными тегами', () => {
    expect(normalizeCounterpartyInput({
      companyName: '  ООО Вектор  ',
      shortName: ' Вектор ',
      fullName: '  Общество с ограниченной ответственностью Вектор  ',
      director: '  Петров Пётр Петрович  ',
      directorGenitive: ' Петрова Петра Петровича ',
      directorDative: ' Петрову Петру Петровичу ',
      email: '  vector@example.test  ',
      phone: ' +7 111 111-11-11 ',
      legalAddress: '  г. Казань  ',
      postalAddress: '  420000, г. Казань  ',
      tags: [' срочно ', 'важно', 'срочно', '', null],
    })).toEqual({
      companyName: 'ООО Вектор',
      shortName: 'Вектор',
      fullName: 'Общество с ограниченной ответственностью Вектор',
      director: 'Петров Пётр Петрович',
      directorGenitive: 'Петрова Петра Петровича',
      directorDative: 'Петрову Петру Петровичу',
      email: 'vector@example.test',
      phone: '+7 111 111-11-11',
      legalAddress: 'г. Казань',
      postalAddress: '420000, г. Казань',
      tags: ['срочно', 'важно'],
    });

    expect(() => normalizeCounterpartyInput({ companyName: '   ' })).toThrow('Укажите название контрагента');
  });

  it('сохраняет базовые поля контрагента при частичном вводе', () => {
    const base = {
      id: 1,
      companyName: 'ООО Вектор',
      shortName: '',
      fullName: '',
      director: 'Петров Пётр Петрович',
      directorGenitive: '',
      directorDative: '',
      email: 'vector@example.test',
      phone: '',
      legalAddress: 'г. Казань',
      postalAddress: '',
      tags: ['важно'],
      createdAt: 1000,
      updatedAt: 1000,
    };

    expect(normalizeCounterpartyInput({
      companyName: '  ООО Вектор Плюс  ',
      tags: [' важно ', 'новый', 'важно'],
    }, base)).toEqual({
      companyName: 'ООО Вектор Плюс',
      shortName: '',
      fullName: '',
      director: 'Петров Пётр Петрович',
      directorGenitive: '',
      directorDative: '',
      email: 'vector@example.test',
      phone: '',
      legalAddress: 'г. Казань',
      postalAddress: '',
      tags: ['важно', 'новый'],
    });
  });
});

describe('offer metadata', () => {
  it('нормализует номер, дату и опциональную компанию', () => {
    expect(normalizeOfferMetadataInput({
      registeredNumber: '  12-А  ',
      registeredDate: '01.09.2026',
      companyName: '  ООО Вектор  ',
    })).toEqual({
      registeredNumber: '12-А',
      registeredDate: '2026-09-01',
      companyName: 'ООО Вектор',
      counterpartyId: null,
    });
  });

  it('требует номер и корректную дату', () => {
    expect(() => normalizeOfferMetadataInput({ registeredDate: '2026-09-01' })).toThrow(HttpError);
    expect(() => normalizeOfferMetadataInput({ registeredNumber: '1', registeredDate: '2026-13-40' })).toThrow('Укажите дату регистрации КП');
  });

  it('сохраняет базовые поля при частичном обновлении', () => {
    expect(normalizeOfferMetadataInput({
      companyName: '  Новая компания  ',
      counterpartyId: '4',
    }, {
      registeredNumber: '7',
      registeredDate: '2026-08-21',
      companyName: 'Старая',
      counterpartyId: null,
    })).toEqual({
      registeredNumber: '7',
      registeredDate: '2026-08-21',
      companyName: 'Новая компания',
      counterpartyId: 4,
    });
  });
});
