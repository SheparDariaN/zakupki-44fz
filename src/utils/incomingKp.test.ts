import { describe, expect, it } from 'vitest';
import type { PurchaseOffer, Supplier } from '../types';
import { buildOfferSupplierSuggestions, formatIncomingKpDetails } from './incomingKp';

const supplier: Supplier = { id: '1', name: 'Компания 1', kpDetails: 'Вх. № ...' };

function offer(overrides: Partial<PurchaseOffer> = {}): PurchaseOffer {
  return {
    id: 1,
    purchaseId: 10,
    registeredNumber: '12',
    registeredDate: '2026-09-01',
    companyName: '',
    counterpartyId: null,
    mime: 'application/pdf',
    fileName: 'kp.pdf',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('formatIncomingKpDetails', () => {
  it('собирает Вх. № и дату в формате НМЦК', () => {
    expect(formatIncomingKpDetails('12', '2026-09-01')).toBe('Вх. № 12 от 01.09.2026');
    expect(formatIncomingKpDetails('  7-А  ', '21.08.2026')).toBe('Вх. № 7-А от 21.08.2026');
  });

  it('не собирает строку без номера', () => {
    expect(formatIncomingKpDetails('   ', '2026-09-01')).toBe('');
  });
});

describe('buildOfferSupplierSuggestions', () => {
  it('предлагает только Вх. №, если компания не указана', () => {
    const suggestions = buildOfferSupplierSuggestions([offer()], supplier);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.value).toBe('Вх. № 12 от 01.09.2026');
    expect(suggestions[0]?.updates?.map((item) => item.fieldKey)).toEqual(['supplierKpDetails']);
  });

  it('добавляет название поставщика, если компания указана', () => {
    const suggestions = buildOfferSupplierSuggestions(
      [offer({ companyName: 'ООО «Вектор»' })],
      supplier
    );
    expect(suggestions[0]?.sourceLabel).toBe('ООО «Вектор»');
    expect(suggestions[0]?.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldKey: 'supplierName', value: 'ООО «Вектор»' }),
      expect.objectContaining({ fieldKey: 'supplierKpDetails', value: 'Вх. № 12 от 01.09.2026' }),
    ]));
  });
});
