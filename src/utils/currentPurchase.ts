import type { AppState } from '../types';

const CURRENT_PURCHASE_STORAGE_KEY = 'zakupki.currentPurchase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function saveCurrentPurchase(state: AppState) {
  try {
    localStorage.setItem(CURRENT_PURCHASE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save current purchase', error);
  }
}

export function loadCurrentPurchase(): AppState | undefined {
  try {
    const raw = localStorage.getItem(CURRENT_PURCHASE_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed)
      || !isRecord(parsed.requisites)
      || !Array.isArray(parsed.positions)
      || !Array.isArray(parsed.suppliers)
      || !Array.isArray(parsed.prices)
    ) {
      return undefined;
    }

    return parsed as unknown as AppState;
  } catch (error) {
    console.error('Failed to load current purchase', error);
    return undefined;
  }
}

export function describeCurrentPurchase(purchase?: AppState): string {
  const subject = purchase?.requisites.subject.trim();
  const positionsCount = purchase?.positions.length ?? 0;

  if (!purchase) return 'Нет сохраненных данных НМЦК';
  if (subject && positionsCount > 0) return `${subject}; позиций: ${positionsCount}`;
  if (subject) return subject;
  return `Без объекта закупки; позиций: ${positionsCount}`;
}
