import type {
  AppState,
  Counterparty,
  DocumentKind,
  DocumentStateByKind,
  KpDocxData,
  ServiceMemoData,
  Supplier,
} from '../types';
import { DOCUMENT_TEMPLATE_SCHEMAS } from './templateSchemas';
import type { AutofillSource, AutofillSourceKind, TemplateFieldSchema } from './templateTypes';
import {
  applyTemplateTransforms,
  formatCounterpartyVendorInfo,
  getPathValue,
  isMeaningful,
  setPathValue,
} from './templateTransforms';

export { formatCounterpartyVendorInfo } from './templateTransforms';

export type AutofillUserSettings = {
  customer?: string;
  executorPosition?: string;
  executorName?: string;
  submissionEmail?: string;
  contactPerson?: string;
  contactPhone?: string;
  defaultServicePlace?: string;
  defaultServiceConditions?: string;
};

export type AutofillContext = {
  userSettings?: AutofillUserSettings;
  counterparties?: Counterparty[];
  selectedCounterparties?: Counterparty[];
  currentPurchase?: Partial<AppState> & Record<string, unknown>;
  now?: Date;
};

export type AutofillSuggestion<K extends DocumentKind = DocumentKind> = {
  documentKind: K;
  fieldKey: string;
  label: string;
  statePath: string;
  currentValue: unknown;
  value: unknown;
  sourceKind: AutofillSourceKind;
  sourceLabel: string;
  reason: string;
  willOverwrite: boolean;
};

export type ResolveAutofillOptions = {
  includeFilled?: boolean;
  sourceKinds?: readonly AutofillSourceKind[];
};

export type ApplyAutofillOptions = ResolveAutofillOptions & {
  overwrite?: boolean;
};

export type ApplyAutofillResult<K extends DocumentKind> = {
  state: DocumentStateByKind[K];
  suggestions: AutofillSuggestion<K>[];
  changed: AutofillSuggestion<K>[];
};

function buildSuppliers(counterparties: Counterparty[], existing: Supplier[] = []): Supplier[] {
  return counterparties.map((counterparty, index) => ({
    id: existing[index]?.id ?? String(Date.now() + index),
    name: counterparty.companyName,
    kpDetails: existing[index]?.kpDetails ?? '',
  }));
}

function resolveSourceValue(
  field: TemplateFieldSchema,
  source: AutofillSource,
  state: unknown,
  context: AutofillContext
): unknown {
  switch (source.kind) {
    case 'userSettings':
      return applyTemplateTransforms(getPathValue(context.userSettings, source.path), source.transforms);
    case 'counterparty': {
      const selected = context.selectedCounterparties && context.selectedCounterparties.length > 0
        ? context.selectedCounterparties
        : [];
      if (selected.length === 0) return undefined;

      if (field.statePath === 'suppliers') {
        const currentSuppliers = getPathValue(state, 'suppliers');
        return buildSuppliers(selected, Array.isArray(currentSuppliers) ? currentSuppliers as Supplier[] : []);
      }

      const raw = field.valueType === 'list' || field.statePath.includes('[]') ? selected : selected[0];
      return applyTemplateTransforms(raw, source.transforms);
    }
    case 'currentPurchase':
      if (source.path?.startsWith('positions[]')) {
        return applyTemplateTransforms(getPathValue(context.currentPurchase, 'positions'), source.transforms);
      }
      return applyTemplateTransforms(getPathValue(context.currentPurchase, source.path), source.transforms);
    case 'currentDate':
      return applyTemplateTransforms(context.now ?? new Date(), source.transforms);
    case 'documentState':
      return applyTemplateTransforms(getPathValue(state, source.path), source.transforms);
    case 'fixedText':
      return source.description;
    case 'calculated':
      return undefined;
  }
}

function buildReason(source: AutofillSource): string {
  switch (source.kind) {
    case 'userSettings':
      return 'из профиля пользователя';
    case 'counterparty':
      return 'из выбранного контрагента';
    case 'currentPurchase':
      return 'из текущих данных закупки';
    case 'currentDate':
      return 'рассчитано по текущей дате';
    case 'documentState':
      return 'из текущего документа';
    case 'fixedText':
      return 'значение по умолчанию';
    case 'calculated':
      return 'рассчитано';
  }
}

export function resolveAutofill<K extends DocumentKind>(
  documentKind: K,
  state: DocumentStateByKind[K],
  context: AutofillContext,
  options: ResolveAutofillOptions = {}
): AutofillSuggestion<K>[] {
  const schema = DOCUMENT_TEMPLATE_SCHEMAS[documentKind];
  const sourceFilter = options.sourceKinds ? new Set(options.sourceKinds) : null;
  const suggestions: AutofillSuggestion<K>[] = [];

  for (const field of schema.fields) {
    if (field.statePath.includes('[]')) continue;

    const currentValue = getPathValue(state, field.statePath);
    const filled = isMeaningful(currentValue);
    if (filled && !options.includeFilled) continue;

    for (const source of field.sources) {
      if (source.kind === 'documentState' || source.kind === 'calculated') continue;
      if (sourceFilter && !sourceFilter.has(source.kind)) continue;

      const value = resolveSourceValue(field, source, state, context);
      if (!isMeaningful(value)) continue;

      suggestions.push({
        documentKind,
        fieldKey: field.fieldKey,
        label: field.label,
        statePath: field.statePath,
        currentValue,
        value,
        sourceKind: source.kind,
        sourceLabel: source.label,
        reason: buildReason(source),
        willOverwrite: filled,
      });
      break;
    }
  }

  return suggestions;
}

export function applyAutofill<K extends DocumentKind>(
  documentKind: K,
  state: DocumentStateByKind[K],
  context: AutofillContext,
  options: ApplyAutofillOptions = {}
): ApplyAutofillResult<K> {
  const suggestions = resolveAutofill(documentKind, state, context, {
    includeFilled: options.includeFilled ?? options.overwrite,
    sourceKinds: options.sourceKinds,
  });
  let nextState = state;
  const changed: AutofillSuggestion<K>[] = [];

  for (const suggestion of suggestions) {
    if (suggestion.willOverwrite && !options.overwrite) continue;
    nextState = setPathValue(nextState, suggestion.statePath, suggestion.value);
    changed.push(suggestion);
  }

  return { state: nextState, suggestions, changed };
}

export function applyNmckAutofill(
  state: AppState,
  context: AutofillContext,
  options?: ApplyAutofillOptions
) {
  return applyAutofill('nmck', state, context, options);
}

export function applyKpAutofill(
  state: KpDocxData,
  context: AutofillContext,
  options?: ApplyAutofillOptions
) {
  return applyAutofill('kp', state, context, options);
}

export function applyMemoAutofill(
  state: ServiceMemoData,
  context: AutofillContext,
  options?: ApplyAutofillOptions
) {
  return applyAutofill('memo', state, context, options);
}
