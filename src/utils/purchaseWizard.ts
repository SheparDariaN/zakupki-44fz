import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

export const PURCHASE_WIZARD_FLOWS = ['requests', 'nmck'] as const;

export type PurchaseWizardFlow = (typeof PURCHASE_WIZARD_FLOWS)[number];

export type PurchaseWizardStepId = 'memo' | 'kp' | 'offers' | 'nmck';

export type PurchaseWizardStep = {
  id: PurchaseWizardStepId;
  label: string;
  segment: PurchaseWizardStepId;
};

export const REQUESTS_WIZARD_STEPS: readonly PurchaseWizardStep[] = [
  { id: 'memo', label: 'Служебная записка', segment: 'memo' },
  { id: 'kp', label: 'Запросы КП', segment: 'kp' },
];

export const NMCK_WIZARD_STEPS: readonly PurchaseWizardStep[] = [
  { id: 'offers', label: 'Загрузка КП', segment: 'offers' },
  { id: 'nmck', label: 'Обоснование НМЦК', segment: 'nmck' },
];

export function isPurchaseWizardFlow(value: string | null): value is PurchaseWizardFlow {
  return value === 'requests' || value === 'nmck';
}

export function purchaseCardPath(purchaseId: string | number): string {
  return `/purchases/${purchaseId}`;
}

export function wizardPath(
  purchaseId: string | number,
  segment: PurchaseWizardStepId,
  flow: PurchaseWizardFlow
): string {
  return `/purchases/${purchaseId}/${segment}?flow=${flow}`;
}

export function requestsWizardMemoPath(purchaseId: string | number): string {
  return wizardPath(purchaseId, 'memo', 'requests');
}

export function nmckWizardOffersPath(purchaseId: string | number): string {
  return wizardPath(purchaseId, 'offers', 'nmck');
}

export function usePurchaseWizard(stepId: PurchaseWizardStepId) {
  const { id: purchaseId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const flowParam = searchParams.get('flow');
  const flow = isPurchaseWizardFlow(flowParam) ? flowParam : null;

  const steps = flow === 'requests'
    ? REQUESTS_WIZARD_STEPS
    : flow === 'nmck'
      ? NMCK_WIZARD_STEPS
      : [];

  const currentIndex = steps.findIndex((step) => step.id === stepId);
  const isActive = flow !== null && currentIndex >= 0;

  const cancel = () => {
    if (!purchaseId) return;
    navigate(purchaseCardPath(purchaseId));
  };

  const goNext = () => {
    if (!purchaseId || !flow) return;
    const next = steps[currentIndex + 1];
    if (!next) {
      navigate(purchaseCardPath(purchaseId));
      return;
    }
    navigate(wizardPath(purchaseId, next.segment, flow));
  };

  const finish = () => {
    if (!purchaseId) return;
    navigate(purchaseCardPath(purchaseId));
  };

  return {
    purchaseId,
    flow,
    isActive,
    isLast: isActive && currentIndex === steps.length - 1,
    steps,
    currentIndex,
    currentStep: currentIndex >= 0 ? steps[currentIndex] ?? null : null,
    cancel,
    goNext,
    finish,
  };
}
