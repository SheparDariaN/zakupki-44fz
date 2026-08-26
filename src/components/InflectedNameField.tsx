import type { InflectedPhrase } from '../types';
import { hydrateInflection, suggestInflection, syncInflection } from '../utils/morphology';

type InflectedNameFieldProps = {
  label: string;
  value: string;
  genitive: string;
  dative: string;
  onChange: (value: InflectedPhrase) => void;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

const defaultLabelClass = 'text-[10px] uppercase font-bold mb-1 opacity-70';
const defaultInputClass = 'border border-[#141414] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black';

export default function InflectedNameField({
  label,
  value,
  genitive,
  dative,
  onChange,
  placeholder,
  className = '',
  labelClassName = defaultLabelClass,
  inputClassName = defaultInputClass,
}: InflectedNameFieldProps) {
  const stored: InflectedPhrase = {
    nominative: value,
    genitive,
    dative,
  };
  const hasValue = value.trim().length > 0;
  const hydrated = hydrateInflection(stored);
  const auto = suggestInflection(value);
  const isAuto = hydrated.genitive === auto.genitive && hydrated.dative === auto.dative;

  return (
    <div className={`flex flex-col ${className}`.trim()}>
      <label className={labelClassName}>{label}</label>
      <input
        type="text"
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(syncInflection(hydrated, event.target.value))}
        placeholder={placeholder}
      />

      {hasValue && (
        <div className="mt-2 border border-[#141414] bg-[#E4E3E0]/50 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] uppercase font-bold opacity-60">Падежи для документов</p>
            <button
              type="button"
              onClick={() => onChange(auto)}
              disabled={isAuto}
              className="text-[10px] uppercase font-bold hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              Вернуть авто
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[38px_1fr] gap-2 items-center">
              <span className="text-[10px] uppercase font-bold opacity-50">Им.</span>
              <div className="border border-[#141414]/20 bg-white/70 px-2 py-1.5 text-xs break-words">
                {auto.nominative}
              </div>
            </div>
            <label className="grid grid-cols-[38px_1fr] gap-2 items-center">
              <span className="text-[10px] uppercase font-bold opacity-50">Род.</span>
              <input
                type="text"
                className="border border-[#141414] bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                value={hydrated.genitive}
                onChange={(event) => onChange({ ...hydrated, genitive: event.target.value })}
              />
            </label>
            <label className="grid grid-cols-[38px_1fr] gap-2 items-center">
              <span className="text-[10px] uppercase font-bold opacity-50">Дат.</span>
              <input
                type="text"
                className="border border-[#141414] bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                value={hydrated.dative}
                onChange={(event) => onChange({ ...hydrated, dative: event.target.value })}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
