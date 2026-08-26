import React from 'react';
import type { AutofillSuggestion } from '../documents/autofill';
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
  onApply: () => void;
  disabled?: boolean;
  contextNote?: string;
};

function previewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => previewValue(item))
      .filter(Boolean)
      .join('\n---\n');
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return JSON.stringify(value);
  return '';
}

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
  const visibleSuggestions = overwrite
    ? suggestions
    : suggestions.filter((suggestion) => !suggestion.willOverwrite);
  const overwriteCount = suggestions.filter((suggestion) => suggestion.willOverwrite).length;

  return (
    <section className="border border-[#141414] bg-white/60 shrink-0 shadow-sm">
      <div className="p-3 border-b border-[#141414] bg-black/5 flex flex-col gap-2">
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
          <p className="text-[10px] bg-white border border-[#141414]/30 px-2 py-1">{contextNote}</p>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        <label className="text-[9px] uppercase opacity-60 font-bold">Источник данных</label>
        <select
          value={selectedSource}
          onChange={(event) => onSourceChange(event.target.value as 'all' | AutofillSourceKind)}
          className="w-full border border-[#141414] bg-white px-2 py-1.5 text-xs focus:outline-none"
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

        <div className="max-h-56 overflow-auto border border-[#141414]/30 bg-white">
          {suggestions.length === 0 && (
            <p className="p-3 text-[10px] opacity-60">Нет предложений для выбранного источника.</p>
          )}
          {suggestions.length > 0 && visibleSuggestions.length === 0 && (
            <p className="p-3 text-[10px] opacity-60">Есть только предложения с перезаписью. Включите замену заполненных полей, чтобы применить их.</p>
          )}
          {visibleSuggestions.map((suggestion) => (
            <div key={`${suggestion.statePath}:${suggestion.sourceKind}`} className="border-b border-[#141414]/20 p-2 last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase">{suggestion.label}</p>
                  <p className="text-[9px] opacity-60">{suggestion.sourceLabel}; {suggestion.reason}</p>
                </div>
                {suggestion.willOverwrite && (
                  <span className="text-[9px] font-bold uppercase bg-yellow-100 border border-[#141414]/30 px-1">
                    замена
                  </span>
                )}
              </div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-snug font-sans bg-black/5 p-2 max-h-24 overflow-hidden">
                {previewValue(suggestion.value)}
              </pre>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onApply}
          disabled={disabled || visibleSuggestions.length === 0}
          className="border border-[#141414] bg-[#141414] text-white px-3 py-2 text-[10px] font-bold uppercase hover:bg-white hover:text-[#141414] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Применить предложения
        </button>
      </div>
    </section>
  );
}
