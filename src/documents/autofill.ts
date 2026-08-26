import type {
  AppState,
  Counterparty,
  DocumentKind,
  DocumentStateByKind,
  InflectedPhrase,
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
import { resolveInflection } from '../utils/morphology';

export { formatCounterpartyVendorInfo } from './templateTransforms';

export type AutofillUserSettings = {
  customer?: string;
  executorPosition?: string;
  executorName?: string;
  executorNameGenitive?: string;
  executorNameDative?: string;
  submissionEmail?: string;
  contactPerson?: string;
  contactPersonGenitive?: string;
  contactPersonDative?: string;
  contactPhone?: string;
  contractServiceHeadPosition?: string;
  contractServiceHeadName?: string;
  contractServiceHeadNameGenitive?: string;
  contractServiceHeadNameDative?: string;
  defaultServiceConditions?: string[];
};

export type AutofillContext = {
  userSettings?: AutofillUserSettings;
  counterparties?: Counterparty[];
  selectedCounterparties?: Counterparty[];
  currentPurchase?: Partial<AppState> & Record<string, unknown>;
  now?: Date;
};

const USER_SETTINGS_INFLECTION_FIELDS = {
  executorName: ['executorNameGenitive', 'executorNameDative'],
  contactPerson: ['contactPersonGenitive', 'contactPersonDative'],
  contractServiceHeadName: ['contractServiceHeadNameGenitive', 'contractServiceHeadNameDative'],
} satisfies Record<string, readonly [string, string]>;

export type AutofillSuggestionUpdate = {
  fieldKey: string;
  label: string;
  statePath: string;
  currentValue: unknown;
  value: unknown;
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
  groupKey?: string;
  groupLabel?: string;
  updates?: AutofillSuggestionUpdate[];
};

export type ResolveAutofillOptions = {
  includeFilled?: boolean;
  sourceKinds?: readonly AutofillSourceKind[];
  fieldKeys?: readonly string[];
  excludeFieldKeys?: readonly string[];
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

function compactUserSetting(settings: AutofillUserSettings | undefined, path: string): string {
  const value = getPathValue(settings, path);
  return typeof value === 'string' ? value.trim() : '';
}

function getUserSettingsSourceValue(settings: AutofillUserSettings | undefined, path?: string): unknown {
  if (!path) return settings;
  if (path.includes(',')) {
    return path.split(',').map((part) => getUserSettingsSourceValue(settings, part.trim()));
  }

  const inflectionFields = USER_SETTINGS_INFLECTION_FIELDS[path as keyof typeof USER_SETTINGS_INFLECTION_FIELDS];
  if (inflectionFields) {
    const [genitivePath, dativePath] = inflectionFields;
    return {
      nominative: compactUserSetting(settings, path),
      genitive: compactUserSetting(settings, genitivePath),
      dative: compactUserSetting(settings, dativePath),
    } satisfies InflectedPhrase;
  }

  return getPathValue(settings, path);
}

function getLastMeaningfulLine(value: string): string {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

function withMemoRequesterInflection(state: ServiceMemoData, settings?: AutofillUserSettings): ServiceMemoData {
  const executorName = compactUserSetting(settings, 'executorName');
  if (!executorName || getLastMeaningfulLine(state.requester) !== executorName) return state;

  return {
    ...state,
    requesterNameInflection: {
      nominative: executorName,
      genitive: resolveInflection(getUserSettingsSourceValue(settings, 'executorName') as InflectedPhrase, 'genitive'),
    },
  };
}

function resolveSourceValue(
  field: TemplateFieldSchema,
  source: AutofillSource,
  state: unknown,
  context: AutofillContext
): unknown {
  switch (source.kind) {
    case 'userSettings':
      return applyTemplateTransforms(getUserSettingsSourceValue(context.userSettings, source.path), source.transforms);
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

function fieldMatchesKeys(field: TemplateFieldSchema, keys?: readonly string[]): boolean {
  if (!keys || keys.length === 0) return false;
  return keys.includes(field.fieldKey)
    || Boolean(field.linkedGroup && keys.includes(field.linkedGroup.key));
}

function mergeLinkedGroupSuggestions<K extends DocumentKind>(
  suggestions: AutofillSuggestion<K>[]
): AutofillSuggestion<K>[] {
  const result: AutofillSuggestion<K>[] = [];
  const emitted = new Set<string>();

  for (const suggestion of suggestions) {
    if (!suggestion.groupKey) {
      result.push(suggestion);
      continue;
    }

    const mergeKey = `${suggestion.groupKey}:${suggestion.sourceKind}`;
    if (emitted.has(mergeKey)) continue;

    const members = suggestions.filter(
      (item) => item.groupKey === suggestion.groupKey && item.sourceKind === suggestion.sourceKind
    );
    emitted.add(mergeKey);

    if (members.length === 1) {
      result.push(members[0]);
      continue;
    }

    result.push({
      documentKind: members[0].documentKind,
      fieldKey: suggestion.groupKey,
      label: members[0].groupLabel || members[0].label,
      statePath: members.map((item) => item.statePath).join(','),
      currentValue: members.map((item) => item.currentValue),
      value: members.map((item) => item.value),
      sourceKind: members[0].sourceKind,
      sourceLabel: members[0].sourceKind === 'userSettings'
        ? 'Профиль пользователя'
        : members[0].sourceLabel,
      reason: members[0].reason,
      willOverwrite: members.every((item) => item.willOverwrite),
      groupKey: suggestion.groupKey,
      groupLabel: members[0].groupLabel,
      updates: members.map((item) => ({
        fieldKey: item.fieldKey,
        label: item.label,
        statePath: item.statePath,
        currentValue: item.currentValue,
        value: item.value,
      })),
    });
  }

  return result;
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
    if (options.fieldKeys && !fieldMatchesKeys(field, options.fieldKeys)) continue;
    if (fieldMatchesKeys(field, options.excludeFieldKeys)) continue;

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
        groupKey: 'linkedGroup' in field ? field.linkedGroup?.key : undefined,
        groupLabel: 'linkedGroup' in field ? field.linkedGroup?.label : undefined,
      });
      break;
    }
  }

  return mergeLinkedGroupSuggestions(suggestions);
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
    fieldKeys: options.fieldKeys,
    excludeFieldKeys: options.excludeFieldKeys,
  });
  let nextState = state;
  const changed: AutofillSuggestion<K>[] = [];

  for (const suggestion of suggestions) {
    if (suggestion.willOverwrite && !options.overwrite) continue;

    const members = suggestion.updates ?? [{
      fieldKey: suggestion.fieldKey,
      label: suggestion.label,
      statePath: suggestion.statePath,
      currentValue: suggestion.currentValue,
      value: suggestion.value,
    }];

    for (const member of members) {
      if (isMeaningful(member.currentValue) && !options.overwrite) continue;
      nextState = setPathValue(nextState, member.statePath, member.value);
      changed.push({
        ...suggestion,
        fieldKey: member.fieldKey,
        label: member.label,
        statePath: member.statePath,
        currentValue: member.currentValue,
        value: member.value,
        willOverwrite: isMeaningful(member.currentValue),
        updates: undefined,
      });
    }
  }

  const finalState = documentKind === 'memo'
    ? withMemoRequesterInflection(nextState as ServiceMemoData, context.userSettings) as DocumentStateByKind[K]
    : nextState;

  return { state: finalState, suggestions, changed };
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
