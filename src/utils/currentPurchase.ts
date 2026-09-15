import type { AppState, KpDocxData, PurchaseContext, ServiceMemoData } from '../types';

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

export function describeCurrentPurchase(purchase?: Partial<AppState> & Record<string, unknown>): string {
  const subject = purchase?.requisites?.subject.trim();
  const positionsCount = purchase?.positions?.length ?? 0;

  if (!purchase) return 'Нет данных закупки';
  if (subject && positionsCount > 0) return `${subject}; позиций: ${positionsCount}`;
  if (subject) return subject;
  return `Без объекта закупки; позиций: ${positionsCount}`;
}

function isNmckState(value: unknown): value is AppState {
  return (
    isRecord(value)
    && isRecord(value.requisites)
    && Array.isArray(value.positions)
    && Array.isArray(value.suppliers)
    && Array.isArray(value.prices)
  );
}

function isKpState(value: unknown): value is KpDocxData {
  return isRecord(value) && Array.isArray(value.vendorInfos);
}

export function isMemoState(value: unknown): value is ServiceMemoData {
  return isRecord(value) && typeof value.subjectIntro === 'string';
}

export function buildPurchaseAutofillContext(
  context?: PurchaseContext | null,
  fallback?: AppState
): (Partial<AppState> & Record<string, unknown>) | undefined {
  if (!context && !fallback) return undefined;

  const nmck = isNmckState(context?.documents.nmck) ? context.documents.nmck : fallback;
  const kp = isKpState(context?.documents.kp) ? context.documents.kp : undefined;
  const memo = isMemoState(context?.documents.memo) ? context.documents.memo : undefined;
  const subject = nmck?.requisites.subject.trim()
    || memo?.subjectIntro.trim()
    || context?.purchase.name.trim()
    || '';
  const requisites = nmck?.requisites ?? {
    customer: '',
    subject: '',
    date: '',
    executorName: '',
    executorPosition: '',
  };

  return {
    ...nmck,
    requisites: {
      ...requisites,
      subject,
    },
    subject,
    purchaseCard: context?.purchase,
    links: context?.links ?? [],
    documents: context?.documents ?? {},
    offers: context?.offers ?? [],
    serviceConditions: kp?.serviceConditions,
    purchasePeriod: kp?.purchasePeriod,
    purpose: memo?.purpose,
    subjectIntro: memo?.subjectIntro,
    subjectTable: memo?.subjectTable,
  };
}

export function seedKpStateFromMemo(kp: KpDocxData, memo: unknown): KpDocxData {
  if (!isMemoState(memo)) return kp;
  const subjectIntro = memo.subjectIntro.trim();
  const subjectTable = memo.subjectTable.trim();
  if (!subjectIntro && !subjectTable) return kp;
  return {
    ...kp,
    ...(subjectIntro ? { subjectIntro } : {}),
    ...(subjectTable ? { subjectTable } : {}),
  };
}

export function calculateMinSupplierTotal(state: AppState): number {
  const supplierTotals = state.suppliers.map((supplier) => (
    state.positions.reduce((total, position) => {
      const entry = state.prices.find((price) => (
        price.positionId === position.id && price.supplierId === supplier.id
      ));
      return total + (entry?.price || 0) * position.quantity;
    }, 0)
  ));

  if (supplierTotals.length === 0) return 0;
  return Math.min(...supplierTotals) || 0;
}
