import { describe, expect, it } from 'vitest';
import type { AppState, KpDocxData, ServiceMemoData } from '../types';
import { normalizeDocumentState } from './templateNormalization';

describe('template normalization', () => {
  it('нормализует НМЦК по схеме перед выводом документа', () => {
    const state: AppState = {
      requisites: {
        customer: '  ГКУ «ЦИТ Кузбасса»  ',
        subject: '  Поставка оборудования  ',
        date: '2026-08-26',
        executorPosition: '  Главный специалист  ',
        executorName: '  Иванова Анна Сергеевна  ',
      },
      suppliers: [
        { id: '1', name: '  ООО «Пример»  ', kpDetails: '  Вх. № 7  ' },
      ],
      positions: [
        { id: '1', name: '  Сертификат поддержки  ', unit: '', quantity: 2 },
      ],
      prices: [
        { positionId: '1', supplierId: '1', price: 1000 },
      ],
    };

    const normalized = normalizeDocumentState('nmck', state);

    expect(normalized).not.toBe(state);
    expect(normalized.requisites).toMatchObject({
      customer: 'ГКУ «ЦИТ Кузбасса»',
      subject: 'Поставка оборудования',
      date: '26.08.2026',
      executorPosition: 'Главный специалист',
      executorName: 'А.С. Иванова',
    });
    expect(normalized.suppliers[0]).toMatchObject({
      name: 'ООО «Пример»',
      kpDetails: 'Вх. № 7',
    });
    expect(normalized.positions[0]).toMatchObject({
      name: 'Сертификат поддержки',
      unit: 'штука',
    });
    expect(state.requisites.customer).toBe('  ГКУ «ЦИТ Кузбасса»  ');
  });

  it('сохраняет инициалы подписанта НМЦК без перестановки в К.Д.', () => {
    const state: AppState = {
      requisites: {
        customer: 'ГКУ «ЦИТ Кузбасса»',
        subject: 'Поставка оборудования',
        date: '26.08.2026',
        executorPosition: 'Начальник СЗИ',
        executorName: 'Д.Кокорин',
      },
      suppliers: [{ id: '1', name: 'ООО «Пример»', kpDetails: 'Вх. № 7' }],
      positions: [{ id: '1', name: 'Сертификат поддержки', unit: 'шт', quantity: 1 }],
      prices: [{ positionId: '1', supplierId: '1', price: 1000 }],
    };

    expect(normalizeDocumentState('nmck', state).requisites.executorName).toBe('Д. Кокорин');
  });

  it('нормализует данные КП для превью и DOCX', () => {
    const state: KpDocxData = {
      vendorInfos: ['  ООО «Поставщик»\n\ninfo@example.ru  '],
      subjectIntro: '  оказание услуг  ',
      subjectTable: '  Услуга технической поддержки  ',
      serviceConditions: ['  Срок оказания услуг: 7 месяцев.  ', ''],
      purchasePeriod: '  август 2026 г.  ',
      submissionDeadline: '  До 30.08.2026 г.  ',
      submissionEmail: '  kp@example.ru  ',
      contactPerson: '  Иванов Иван Иванович  ',
      signerPosition: '  Руководитель контрактной службы  ',
      signerName: '  Петров Петр Петрович  ',
    };

    const normalized = normalizeDocumentState('kp', state);

    expect(normalized.vendorInfos).toEqual(['ООО «Поставщик»\n\ninfo@example.ru']);
    expect(normalized.subjectIntro).toBe('оказание услуг');
    expect(normalized.subjectTable).toBe('Услуга технической поддержки');
    expect(normalized.serviceConditions).toEqual(['Срок оказания услуг: 7 месяцев.', '']);
    expect(normalized.purchasePeriod).toBe('август 2026 г.');
    expect(normalized.submissionDeadline).toBe('До 30.08.2026 г.');
    expect(normalized.submissionEmail).toBe('kp@example.ru');
    expect(normalized.contactPerson).toBe('Иванов Иван Иванович');
    expect(normalized.signerPosition).toBe('Руководитель контрактной службы');
    expect(normalized.signerName).toBe('Петров Петр Петрович');
  });

  it('нормализует служебную записку без искажения составных ФИО и должностей', () => {
    const state: ServiceMemoData = {
      purpose: '  В целях оптимизации прошу рассмотреть возможность  ',
      subjectIntro: '  приобретения лицензии:  ',
      subjectTable: '  Позиция 1\n- Позиция 2  ',
      requester: '  Главный специалист\nИванова Анна Сергеевна  ',
      addressee: '  Директору  ',
      contractServiceHead: '  Петров Петр Петрович  ',
      date: '2026-08-26',
    };

    const normalized = normalizeDocumentState('memo', state);

    expect(normalized).toMatchObject({
      purpose: 'В целях оптимизации прошу рассмотреть возможность',
      subjectIntro: 'приобретения лицензии:',
      subjectTable: 'Позиция 1\n- Позиция 2',
      requester: 'Главный специалист\nИванова Анна Сергеевна',
      addressee: 'Директору',
      contractServiceHead: 'Петров Петр Петрович',
      date: '26.08.2026',
    });
  });
});
