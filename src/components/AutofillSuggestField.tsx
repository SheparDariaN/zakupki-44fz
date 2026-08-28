import React, { useMemo, useState } from 'react';
import {
  previewAutofillValue,
  suggestionKey,
  type AutofillSuggestion,
} from '../documents/autofill';

type AutofillSuggestFieldProps = {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: AutofillSuggestion[];
  onPick: (suggestion: AutofillSuggestion) => void;
  className: string;
  type?: 'text';
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
};

function getFieldPreview(suggestion: AutofillSuggestion, fieldKey: string): string {
  const fieldUpdate = suggestion.updates?.find((update) => update.fieldKey === fieldKey);
  return previewAutofillValue(fieldUpdate ? fieldUpdate.value : suggestion.value);
}

export default function AutofillSuggestField({
  fieldKey,
  value,
  onChange,
  suggestions,
  onPick,
  className,
  type = 'text',
  multiline = false,
  rows,
  placeholder,
  disabled = false,
}: AutofillSuggestFieldProps) {
  const [open, setOpen] = useState(false);
  const hasSuggestions = suggestions.length > 0;
  const optionIdPrefix = useMemo(() => `autofill-${fieldKey}`, [fieldKey]);

  const openIfAvailable = () => {
    if (hasSuggestions) setOpen(true);
  };

  const handlePick = (suggestion: AutofillSuggestion) => {
    onPick(suggestion);
    setOpen(false);
  };

  const commonProps = {
    className,
    value,
    onFocus: openIfAvailable,
    onBlur: () => setOpen(false),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
      openIfAvailable();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    },
    placeholder,
    disabled,
    'aria-autocomplete': hasSuggestions ? 'list' as const : undefined,
    'aria-expanded': hasSuggestions ? open : undefined,
  };

  return (
    <div className="flex flex-col gap-1">
      {multiline ? (
        <textarea
          {...commonProps}
          rows={rows}
        />
      ) : (
        <input
          {...commonProps}
          type={type}
        />
      )}

      {hasSuggestions && open && (
        <div className="border border-[#141414]/40 bg-white shadow-sm">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestionKey(suggestion)}:${index}`}
              id={`${optionIdPrefix}-${index}`}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                handlePick(suggestion);
              }}
              className="w-full border-b border-[#141414]/20 px-2 py-1.5 text-left text-[10px] last:border-b-0 hover:bg-yellow-50 focus:bg-yellow-50 focus:outline-none"
            >
              <span className="block whitespace-pre-wrap break-words leading-snug">
                {getFieldPreview(suggestion, fieldKey)}
              </span>
              <span className="mt-1 block text-[9px] uppercase opacity-60">
                {suggestion.sourceLabel}; {suggestion.reason}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
