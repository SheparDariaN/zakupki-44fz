import React, { useEffect, useMemo, useRef, useState } from 'react';
import { previewAutofillSuggestion, suggestionKey, type AutofillSuggestion } from '../documents/autofill';
import type { AutofillSourceKind } from '../documents/templateTypes';

type SourceOption = {
  value: 'all' | AutofillSourceKind;
  label: string;
};

type AutofillPanelProps = {
  title: string;
  description: string;
  sourceOptions: SourceOption[];
  selectedSource: 'all' | AutofillSourceKind;
  onSourceChange: (source: 'all' | AutofillSourceKind) => void;
  suggestions: AutofillSuggestion[];
  overwrite: boolean;
  onOverwriteChange: (overwrite: boolean) => void;
  onApply: (fieldKeys: string[]) => void;
  disabled?: boolean;
  contextNote?: string;
};

export default function AutofillPanel({
  title,
  description,
  sourceOptions,
  selectedSource,
  onSourceChange,
  suggestions,
  overwrite,
  onOverwriteChange,
  onApply,
  disabled = false,
  contextNote,
}: AutofillPanelProps) {
  const visibleSuggestions = useMemo(
    () => overwrite
      ? suggestions
      : suggestions.filter((suggestion) => !suggestion.willOverwrite),
    [overwrite, suggestions]
  );
  const overwriteCount = suggestions.filter((suggestion) => suggestion.willOverwrite).length;
  const visibleSuggestionKeys = useMemo(
    () => visibleSuggestions.map((suggestion) => suggestionKey(suggestion)),
    [visibleSuggestions]
  );
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(() => new Set(visibleSuggestionKeys));
  const previousVisibleKeysRef = useRef<Set<string>>(new Set(visibleSuggestionKeys));

  useEffect(() => {
    const previousVisibleKeys = previousVisibleKeysRef.current;
    setSelectedSuggestionKeys((current) => {
      const next = new Set<string>();

      for (const key of visibleSuggestionKeys) {
        if (current.has(key) || !previousVisibleKeys.has(key)) {
          next.add(key);
        }
      }

      return next;
    });
    previousVisibleKeysRef.current = new Set(visibleSuggestionKeys);
  }, [visibleSuggestionKeys]);

  const selectedFieldKeys = visibleSuggestions
    .filter((suggestion) => selectedSuggestionKeys.has(suggestionKey(suggestion)))
    .map((suggestion) => suggestion.fieldKey);
  const selectedCount = selectedFieldKeys.length;

  const selectAllVisible = () => {
    setSelectedSuggestionKeys(new Set(visibleSuggestionKeys));
  };

  const clearSelection = () => {
    setSelectedSuggestionKeys(new Set());
  };

  const toggleSuggestion = (key: string, checked: boolean) => {
    setSelectedSuggestionKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  return (
    <section className="border border-line bg-surface/60 shrink-0 shadow-sm">
      <div className="p-3 border-b border-line bg-ink/5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[11px] uppercase font-bold">{title}</h2>
            <p className="text-[10px] opacity-60 mt-1">{description}</p>
          </div>
          <span className="text-[10px] font-bold uppercase whitespace-nowrap">
            {visibleSuggestions.length} пол.
          </span>
        </div>
        {contextNote && (
          <p className="text-[10px] bg-surface border border-line/30 px-2 py-1">{contextNote}</p>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        <label className="text-[9px] uppercase opacity-60 font-bold">Источник данных</label>
        <select
          value={selectedSource}
          onChange={(event) => onSourceChange(event.target.value as 'all' | AutofillSourceKind)}
          className="w-full border border-line bg-surface px-2 py-1.5 text-xs focus:outline-none"
        >
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label className="flex items-start gap-2 text-[10px] leading-snug">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => onOverwriteChange(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Разрешить замену заполненных полей
            {overwriteCount > 0 ? ` (${overwriteCount})` : ''}
          </span>
        </label>

        {visibleSuggestions.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="opacity-60">
              Отмечено: {selectedCount} из {visibleSuggestions.length}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAllVisible}
                className="font-bold uppercase hover:text-blue-700 disabled:opacity-40"
                disabled={selectedCount === visibleSuggestions.length}
              >
                Выбрать все
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="font-bold uppercase hover:text-blue-700 disabled:opacity-40"
                disabled={selectedCount === 0}
              >
                Снять все
              </button>
            </div>
          </div>
        )}

        <div className="max-h-56 overflow-auto border border-line/30 bg-surface">
          {suggestions.length === 0 && (
            <p className="p-3 text-[10px] opacity-60">Нет предложений для выбранного источника.</p>
          )}
          {suggestions.length > 0 && visibleSuggestions.length === 0 && (
            <p className="p-3 text-[10px] opacity-60">Есть только предложения с перезаписью. Включите замену заполненных полей, чтобы применить их.</p>
          )}
          {visibleSuggestions.map((suggestion) => {
            const key = suggestionKey(suggestion);
            return (
              <div key={key} className="border-b border-line/20 p-2 last:border-b-0">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSuggestionKeys.has(key)}
                    onChange={(event) => toggleSuggestion(key, event.target.checked)}
                    className="mt-0.5 shrink-0"
                    aria-label={`Применить поле: ${suggestion.label}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase">{suggestion.label}</p>
                        <p className="text-[9px] opacity-60">{suggestion.sourceLabel}; {suggestion.reason}</p>
                      </div>
                      {suggestion.willOverwrite && (
                        <span className="text-[9px] font-bold uppercase bg-yellow-100 border border-line/30 px-1">
                          замена
                        </span>
                      )}
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-snug font-sans bg-ink/5 p-2 max-h-24 overflow-hidden">
                      {previewAutofillSuggestion(suggestion)}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onApply(selectedFieldKeys)}
          disabled={disabled || visibleSuggestions.length === 0 || selectedCount === 0}
          className="btn-brutal btn-brutal-primary text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Применить предложения
        </button>
      </div>
    </section>
  );
}
