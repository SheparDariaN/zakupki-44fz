import { describe, expect, it } from 'vitest';
import type { AppState, Counterparty, KpDocxData, ServiceMemoData } from '../types';
import { applyAutofill, formatCounterpartyVendorInfo, resolveAutofill } from './autofill';
import { DOCUMENT_TEMPLATE_SCHEMAS } from './templateSchemas';
import type { TemplateTransform } from './templateTypes';
import { formatContactPersonWithPhone } from './templateTransforms';

function kpState(overrides: Partial<KpDocxData> = {}): KpDocxData {
  return {
    vendorInfos: [''],
    subjectIntro: '',
    subjectTable: '',
    serviceConditions: [],
    purchasePeriod: '',
    submissionDeadline: '',
    submissionEmail: '',
    contactPerson: '',
    signerPosition: '',
    signerName: '',
    ...overrides,
  };
}

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

  it('формирует адресата КП из выбранного контрагента и контакты из профиля', () => {
    const state = kpState();

    const result = applyAutofill('kp', state, {
      selectedCounterparties: [counterparty],
      userSettings: {
        executorName: 'Петров Петр Петрович',
        submissionEmail: 'kp@example.ru',
        contactPerson: 'Сидорова Сидора Сидоровна',
        contactPhone: '8-384-244-26-28',
      },
    });

    expect(result.state.vendorInfos).toEqual([formatCounterpartyVendorInfo(counterparty)]);
    expect(result.state.submissionEmail).toBe('kp@example.ru');
    expect(result.state.contactPerson).toBe('Сидорова Сидора Сидоровна, т. 8-384-244-26-28');
    expect(result.state.signerPosition).toBe('');
    expect(result.state.signerName).toBe('');
    expect(result.changed.some((item) => item.reason === 'из выбранного контрагента')).toBe(true);
  });

  it('формирует адресата КП с сохраненным дательным падежом руководителя или fallback-склонением', () => {
    expect(formatCounterpartyVendorInfo(counterparty)).toContain('Директору Иванову И.И.');
    expect(formatCounterpartyVendorInfo({
      ...counterparty,
      director: 'Иванов Иван Иванович',
      directorDative: '',
    })).toContain('Иванову Ивану Ивановичу');
  });

  it('предлагает e-mail, контактные лица и подписанта КП из профиля', () => {
    const suggestions = resolveAutofill('kp', kpState(), {
      userSettings: {
        submissionEmail: 'kp@example.ru',
        contactPerson: 'Сидорова Сидора Сидоровна',
        contactPhone: '8-384-244-26-28',
        executorName: 'Петров Петр Петрович',
        executorPosition: 'Директор',
        contractServiceHeadPosition: 'Руководитель контрактной службы',
        contractServiceHeadName: 'Сидоров Сидор Сидорович',
      },
    });

    const contacts = suggestions.find((item) => item.fieldKey === 'kpContacts');
    expect(contacts?.label).toBe('Контакты для приема КП');
    expect(contacts?.updates?.map((item) => item.fieldKey)).toEqual(['submissionEmail', 'contactPerson']);
    expect(contacts?.updates?.map((item) => item.value)).toEqual([
      'kp@example.ru',
      'Сидорова Сидора Сидоровна, т. 8-384-244-26-28',
    ]);

    const signer = suggestions.find((item) => item.fieldKey === 'kpSigner');
    expect(signer?.label).toBe('Подписант запроса КП');
    expect(signer?.updates?.map((item) => item.fieldKey)).toEqual(['signerPosition', 'signerName']);
    expect(signer?.updates?.map((item) => item.value)).toEqual([
      'Руководитель контрактной службы',
      'Сидоров Сидор Сидорович',
    ]);
  });

  it('при загрузке КП не подставляет подписанта из профиля, только контакты', () => {
    const state = kpState({
      submissionEmail: 'demo@example.ru',
      contactPerson: 'Демо',
      signerPosition: '',
      signerName: '',
    });
    const result = applyAutofill('kp', state, {
      userSettings: {
        submissionEmail: 'kp@example.ru',
        contactPerson: 'Сидорова Сидора Сидоровна',
        contactPhone: '8-384-244-26-28',
        contractServiceHeadPosition: 'Руководитель контрактной службы',
        contractServiceHeadName: 'Сидоров Сидор Сидорович',
      },
    }, {
      overwrite: true,
      sourceKinds: ['userSettings'],
      fieldKeys: ['submissionEmail', 'contactPerson', 'kpContacts'],
    });

    expect(result.state.submissionEmail).toBe('kp@example.ru');
    expect(result.state.contactPerson).toBe('Сидорова Сидора Сидоровна, т. 8-384-244-26-28');
    expect(result.state.signerPosition).toBe('');
    expect(result.state.signerName).toBe('');
  });

  it('подставляет типовые условия из профиля в сроки и состав услуг КП', () => {
    const result = applyAutofill('kp', kpState(), {
      userSettings: {
        defaultServiceConditions: [
          'Срок оказания услуг: 30 дней',
          'Гарантия 12 месяцев',
        ],
      },
    });

    expect(result.state.serviceConditions).toEqual([
      'Срок оказания услуг: 30 дней',
      'Гарантия 12 месяцев',
    ]);
    expect(result.changed.some((item) => item.fieldKey === 'serviceConditions')).toBe(true);
  });

  it('собирает поля КП из текущих данных закупки', () => {
    const state = kpState({ vendorInfos: ['Адресат'] });

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

  it('предлагает руководителя контрактной службы для служебной записки и не подставляет его без явного применения', () => {
    const state: ServiceMemoData = {
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: '',
      addressee: 'Руководителю контрактной службы',
      contractServiceHead: '',
      date: '2026-08-21',
    };
    const context = {
      userSettings: {
        executorPosition: 'Главный специалист',
        executorName: 'Иванова Анна Сергеевна',
        contractServiceHeadPosition: 'Руководитель контрактной службы',
        contractServiceHeadName: 'Петров Петр Петрович',
      },
    };

    const loaded = applyAutofill('memo', state, context, {
      excludeFieldKeys: ['addressee', 'contractServiceHead', 'memoContractServiceHead'],
    });
    expect(loaded.state.requester).toBe('Главный специалист\nИванова Анна Сергеевна');
    expect(loaded.state.requesterNameInflection).toEqual({
      nominative: 'Иванова Анна Сергеевна',
      genitive: 'Ивановой Анны Сергеевны',
    });
    expect(loaded.state.addressee).toBe('Руководителю контрактной службы');
    expect(loaded.state.contractServiceHead).toBe('');

    const result = applyAutofill('memo', state, context);
    expect(result.state.requester).toBe('Главный специалист\nИванова Анна Сергеевна');
    expect(result.state.addressee).toBe('Руководителю контрактной службы');
    expect(result.state.contractServiceHead).toBe('Петров Петр Петрович');
    expect(result.changed.some((item) => item.fieldKey === 'contractServiceHead')).toBe(true);
  });

  it('применяет сохраненный родительный падеж к ФИО и склоняет должность через transforms источника', () => {
    const state: ServiceMemoData = {
      purpose: '',
      subjectIntro: '',
      subjectTable: '',
      requester: '',
      addressee: '',
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
          executorNameGenitive: 'Ивановой Анны Сергеевны (ручная форма)',
        },
      });

      expect(suggestions.find((item) => item.fieldKey === 'requester')?.value).toBe(
        'Главного специалиста\nИвановой Анны Сергеевны (ручная форма)'
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
      addressee: '',
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
    const state = kpState({
      vendorInfos: ['Адресат'],
      subjectIntro: 'Ручной предмет',
    });
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

  it('подставляет телефон контактного лица в формате «т. n» и не дублирует его', () => {
    expect(formatContactPersonWithPhone(['Иванов Иван Иванович', '8-384-244-26-28'])).toBe(
      'Иванов Иван Иванович, т. 8-384-244-26-28'
    );
    expect(formatContactPersonWithPhone(['Иванов Иван Иванович', 'т. 8-384-244-26-28'])).toBe(
      'Иванов Иван Иванович, т. 8-384-244-26-28'
    );
    expect(formatContactPersonWithPhone(['Иванов Иван Иванович, т. 8-384-244-26-28', '8-384-244-26-28'])).toBe(
      'Иванов Иван Иванович, т. 8-384-244-26-28'
    );
    expect(formatContactPersonWithPhone(['Иванов Иван Иванович', ''])).toBe('Иванов Иван Иванович');
    expect(formatContactPersonWithPhone(['', '8-384-244-26-28'])).toBe('');
  });
});
