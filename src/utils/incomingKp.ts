import type { AutofillSuggestion } from '../documents/autofill';
import type { PurchaseOffer, Supplier } from '../types';
import { formatDateRu } from './morphology';

export function formatIncomingKpDetails(registeredNumber: string, registeredDate: string): string {
  const number = registeredNumber.trim();
  if (!number) return '';
  const date = formatDateRu(registeredDate);
  return date ? `Вх. № ${number} от ${date}` : `Вх. № ${number}`;
}

export function buildOfferSupplierSuggestions(
  offers: readonly PurchaseOffer[],
  supplier: Supplier
): AutofillSuggestion<'nmck'>[] {
  const suggestions: AutofillSuggestion<'nmck'>[] = [];

  for (const offer of offers) {
    const kpDetails = formatIncomingKpDetails(offer.registeredNumber, offer.registeredDate);
    if (!kpDetails) continue;

    const companyName = offer.companyName.trim();
    const updates = [
      {
        fieldKey: 'supplierKpDetails',
        label: 'Входящий номер и дата КП',
        statePath: 'suppliers[].kpDetails',
        currentValue: supplier.kpDetails,
        value: kpDetails,
      },
      ...(companyName
        ? [{
          fieldKey: 'supplierName',
          label: 'Наименование поставщика',
          statePath: 'suppliers[].name',
          currentValue: supplier.name,
          value: companyName,
        }]
        : []),
    ];

    suggestions.push({
      documentKind: 'nmck',
      fieldKey: 'supplierKpDetails',
      label: 'Входящий номер и дата КП',
      statePath: 'suppliers[].kpDetails',
      currentValue: supplier.kpDetails,
      value: kpDetails,
      sourceKind: 'currentPurchase',
      sourceLabel: companyName || `КП ${offer.registeredNumber}`,
      reason: 'из загруженного КП',
      willOverwrite: supplier.kpDetails.trim().length > 0 || (companyName.length > 0 && supplier.name.trim().length > 0),
      updates,
    });
  }

  return suggestions;
}
