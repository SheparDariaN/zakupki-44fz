import { describe, expect, it } from 'vitest';
import { DOCUMENT_KINDS, type DocumentStateByKind } from '../types';
import { DOCUMENT_REGISTRY, getDocumentTitle } from './registry';

describe('DOCUMENT_REGISTRY', () => {
  it('содержит запись реестра для каждого типа документа', () => {
    expect(Object.keys(DOCUMENT_REGISTRY).sort()).toEqual([...DOCUMENT_KINDS].sort());

    for (const kind of DOCUMENT_KINDS) {
      const entry = DOCUMENT_REGISTRY[kind];

      expect(entry.kind).toBe(kind);
      expect(entry.title).toBeTruthy();
      expect(entry.route).toMatch(/^\//);
      expect(entry.defaultHistoryName).toBeTruthy();
      expect(entry.template.kind).toBe(kind);
      expect(getDocumentTitle(kind)).toBe(entry.title);
    }
  });

  it('описывает batch-сценарии для каждого документа и реализацию для КП', () => {
    expect(DOCUMENT_REGISTRY.nmck.batchScenarios.map((scenario) => scenario.id)).toEqual(['supplier-price-sources']);
    expect(DOCUMENT_REGISTRY.kp.batchScenarios.map((scenario) => scenario.id)).toEqual(['vendor-infos']);
    expect(DOCUMENT_REGISTRY.memo.batchScenarios.map((scenario) => scenario.id)).toEqual(['memo-recipients-and-dates']);

    expect(DOCUMENT_REGISTRY.nmck.supportsBatch).toBe(false);
    expect(DOCUMENT_REGISTRY.kp.supportsBatch).toBe(true);
    expect(DOCUMENT_REGISTRY.memo.supportsBatch).toBe(false);
    expect(DOCUMENT_REGISTRY.nmck.batchScenarios[0].status).toBe('prepared');
    expect(DOCUMENT_REGISTRY.kp.batchScenarios[0].status).toBe('implemented');
    expect(DOCUMENT_REGISTRY.memo.batchScenarios[0].status).toBe('prepared');
  });

  it('строит названия истории для НМЦК, КП и служебной записки', () => {
    const nmckState: DocumentStateByKind['nmck'] = {
      requisites: {
        customer: '',
        subject: 'Поставка серверного оборудования',
        date: '',
        executorName: '',
        executorPosition: '',
      },
      suppliers: [],
      positions: [],
      prices: [],
    };
    const kpState: DocumentStateByKind['kp'] = {
      vendorInfos: ['ООО «Ромашка»'],
      subjectIntro: 'Оказание услуг техподдержки',
      subjectTable: '',
      serviceConditions: [],
      purchasePeriod: '',
      submissionDeadline: '',
      submissionEmail: '',
      contactPerson: '',
      signerPosition: '',
      signerName: '',
    };
    const memoState: DocumentStateByKind['memo'] = {
      purpose: '',
      subjectIntro: 'Приобретение лицензий',
      subjectTable: '',
      requester: '',
      addressee: '',
      contractServiceHead: '',
      date: '',
    };

    expect(DOCUMENT_REGISTRY.nmck.getHistoryName(nmckState)).toBe('Поставка серверного оборудования');
    expect(DOCUMENT_REGISTRY.kp.getHistoryName(kpState)).toBe('Запрос КП: Оказание услуг техподдержки');
    expect(DOCUMENT_REGISTRY.memo.getHistoryName(memoState)).toBe('Приобретение лицензий');
  });
});
