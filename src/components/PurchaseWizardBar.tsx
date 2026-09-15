import React from 'react';
import { X } from 'lucide-react';
import type { PurchaseWizardStep } from '../utils/purchaseWizard';

type PurchaseWizardBarProps = {
  steps: readonly PurchaseWizardStep[];
  currentIndex: number;
  onCancel: () => void;
};

export default function PurchaseWizardBar({ steps, currentIndex, onCancel }: PurchaseWizardBarProps) {
  return (
    <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border border-line bg-surface px-4 py-3">
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => {
          const active = index === currentIndex;
          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 && <span className="text-[10px] opacity-40">/</span>}
              <span className={`text-[11px] font-bold uppercase ${active ? '' : 'opacity-45'}`}>
                {index + 1}. {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={onCancel} className="btn-brutal flex items-center gap-2 bg-surface text-[11px] font-bold">
        <X className="h-3.5 w-3.5" /> Отменить
      </button>
    </div>
  );
}
