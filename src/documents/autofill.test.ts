import { describe, expect, it } from 'vitest';
import type { AppState, Counterparty, KpDocxData, ServiceMemoData } from '../types';
import { applyAutofill, formatCounterpartyVendorInfo, resolveAutofill } from './autofill';
import { DOCUMENT_TEMPLATE_SCHEMAS } from './templateSchemas';
import type { TemplateTransform } from './templateTypes';

const counterparty: Counterparty = {
  id: 1,
  companyName: 'ООО «Пример»',
  shortName: 'ООО «Пример»',
  fullName: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «ПРИМЕР»',
  director: 'Директор Иванов И.И.',
  directorGenitive: 'Директора Иванова И.И.',
  directorDative: 'Директору Иванову И.И.',
  legalAddress: '650000, г. Кемерово, ул. Тестовая, 1',
  postalAddress: '',
  email: 'info@example.ru',
  phone: '+7 (3842) 00-00-00',
  tags: ['ИТ'],
  createdAt: 1,
  updatedAt: 1,
};

describe('autofill engine', () => {
  it('подставляет реквизиты НМЦК из профиля только в пустые поля', () => {
    const state: AppState = {
      requisites: {
        customer: '',
        subject: 'Поставка оборудования',
        date: '',
        executorName: '',
        executorPosition: 'Заполнено вручную',
      },
      suppliers: [],
      positions: [],
      prices: [],
    };

    const result = applyAutofill('nmck', state, {
      userSettings: {
        customer: 'ГКУ «ЦИТ Кузбасса»',
        executorName: 'Петров Петр Петрович',
        executorPosition: 'Начальник отдела',
      },
      now: new Date(2026, 7, 21),
    });

    expect(result.state.requisites.customer).toBe('ГКУ «ЦИТ Кузбасса»');
    expect(result.state.requisites.executorName).toBe('Петров Петр Петрович');
    expect(result.state.requisites.executorPosition).toBe('Заполнено вручную');
    expect(result.state.requisites.date).toBe('21.08.2026');
    expect(result.changed.map((item) => item.fieldKey)).toEqual(['customer', 'date', 'executorName']);
  });

  it('формирует адресата КП из выбранного контрагента', () => {
    const state: KpDocxData = {
      vendorInfos: [''],
      subjectIntro: '',
      subjectTable: '',
      serviceConditions: [],
      purchasePeriod: '',
      submissionDeadline: '',
      submissionEmail: '',
      contactPerson: '',
    };

    const result = applyAutofill('kp', state, {
      selectedCounterparties: [counterparty],
      userSettings: {
        executorName: 'Петров Петр Петрович',
        submissionEmail: 'kp@example.ru',
        contactPerson: 'Сидорова Сидора Сидоровна',
      },
    });

    expect(result.state.vendorInfos).toEqual([formatCounterpartyVendorInfo(counterparty)]);
    expect(result.state.submissionEmail).toBe('kp@example.ru');
    expect(result.state.contactPerson).toBe('Сидорова Сидора Сидоровна');
    expect(result.changed.some((item) => item.reason === 'из выбранного контрагента')).toBe(true);
  });

  it('собирает поля КП из текущих данных закупки', () => {
    const state: KpDocxData = {
      vendorInfos: ['Адресат'],
      subjectIntro: '',
      subjectTable: '',
      serviceConditions: [],
      purchasePeriod: '',
      submissionDeadline: '',
      submissionEmail: '',
      contactPerson: '',
    };

    const suggestions = resolveAutofill('kp', state, {
      currentPurchase: {
        requisites: {
          customer: '',
          subject: 'Оказание услуг техподдержки',
          date: '',
          executorName: '',
          executorPosition: '',
        },
        positions: [
          { id: '1', name: 'Сертификат поддержки', unit: 'шт', quantity: 2 },
        ],
        suppliers: [],
        prices: [],
      },
    });

    expect(suggestions.find((item) => item.fieldKey === 'subjectIntro')?.value).toBe('Оказание услуг техподдержки');
    expect(suggestions.find((item) => item.fieldKey === 'subjectTable')?.value).toBe('Сертификат поддержки (ЕИ: шт, кол-во: 2)');
  });

  it('подставляет составителя служебной записки из профиля и не подставляет руководителя контрактной службы', () => {
    const state: ServiceMemoData = {
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: '',
      contractServiceHead: '',
      date: '2026-08-21',
    };

    const result = applyAutofill('memo', state, {
      userSettings: {
        executorPosition: 'Главный специалист',
        executorName: 'Иванова Анна Сергеевна',
      },
    });

    expect(result.state.requester).toBe('Главный специалист\nИванова Анна Сергеевна');
    expect(result.state.contractServiceHead).toBe('');
    expect(result.changed.some((item) => item.fieldKey === 'contractServiceHead')).toBe(false);
  });

  it('применяет родительный падеж к ФИО и должности через transforms источника', () => {
    const state: ServiceMemoData = {
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: '',
      contractServiceHead: '',
      date: '',
    };
    const requester = DOCUMENT_TEMPLATE_SCHEMAS.memo.fields.find(
      (field) => field.fieldKey === 'requester'
    );
    const source = requester?.sources[0] as { transforms?: readonly TemplateTransform[] };
    const originalTransforms = source.transforms;

    source.transforms = ['toGenitiveCase', 'joinLines', 'trim'];

    try {
      const suggestions = resolveAutofill('memo', state, {
        userSettings: {
          executorPosition: 'Главный специалист',
          executorName: 'Иванова Анна Сергеевна',
        },
      });

      expect(suggestions.find((item) => item.fieldKey === 'requester')?.value).toBe(
        'Главного специалиста\nИвановой Анны Сергеевны'
      );
    } finally {
      source.transforms = originalTransforms;
    }
  });

  it('подставляет перечень объектов закупки служебной записки со строчной буквы и списочной пунктуацией', () => {
    const state: ServiceMemoData = {
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: '',
      contractServiceHead: '',
      date: '',
    };

    const result = applyAutofill('memo', state, {
      currentPurchase: {
        requisites: {
          customer: '',
          subject: 'Оказание услуг техподдержки',
          date: '',
          executorName: '',
          executorPosition: '',
        },
        positions: [
          { id: '1', name: 'Сертификат поддержки', unit: 'шт', quantity: 2 },
          { id: '2', name: 'Лицензия', unit: 'шт', quantity: 1 },
        ],
        suppliers: [],
        prices: [],
      },
    });

    expect(result.state.subjectIntro).toBe('Оказание услуг техподдержки');
    expect(result.state.subjectTable).toBe(
      'сертификат поддержки (ЕИ: шт, кол-во: 2);\nлицензия (ЕИ: шт, кол-во: 1).'
    );
  });

  it('разделяет предложения для заполненных полей и перезапись по явному флагу', () => {
    const state: KpDocxData = {
      vendorInfos: ['Адресат'],
      subjectIntro: 'Ручной предмет',
      subjectTable: '',
      serviceConditions: [],
      purchasePeriod: '',
      submissionDeadline: '',
      submissionEmail: '',
      contactPerson: '',
    };
    const context = {
      currentPurchase: {
        requisites: {
          customer: '',
          subject: 'Предмет из НМЦК',
          date: '',
          executorName: '',
          executorPosition: '',
        },
      },
    };

    expect(resolveAutofill('kp', state, context).some((item) => item.fieldKey === 'subjectIntro')).toBe(false);

    const suggestions = resolveAutofill('kp', state, context, { includeFilled: true });
    expect(suggestions.find((item) => item.fieldKey === 'subjectIntro')).toMatchObject({
      currentValue: 'Ручной предмет',
      value: 'Предмет из НМЦК',
      willOverwrite: true,
      reason: 'из текущих данных закупки',
    });

    const defaultApply = applyAutofill('kp', state, context, { includeFilled: true });
    expect(defaultApply.state.subjectIntro).toBe('Ручной предмет');
    expect(defaultApply.changed.some((item) => item.fieldKey === 'subjectIntro')).toBe(false);

    const overwriteApply = applyAutofill('kp', state, context, { overwrite: true });
    expect(overwriteApply.state.subjectIntro).toBe('Предмет из НМЦК');
    expect(overwriteApply.changed.some((item) => item.fieldKey === 'subjectIntro')).toBe(true);
  });
});
