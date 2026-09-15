import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Supplier } from '../types';

interface ImportModalProps {
  suppliers: Supplier[];
  onClose: () => void;
  onImport: (text: string) => void;
}

export default function ImportModal({ suppliers, onClose, onImport }: ImportModalProps) {
  const [text, setText] = useState('');
  const canImport = text.trim().length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canImport) return;

    onImport(text);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <form
        className="w-full max-w-3xl border border-line bg-page p-5 shadow-[8px_8px_0_var(--ink)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-3">
          <div>
            <h2 id="import-modal-title" className="text-sm font-bold uppercase tracking-tighter">
              Импорт из Excel
            </h2>
            <p className="mt-1 text-[11px] uppercase opacity-60">
              Вставьте скопированный диапазон таблицы
            </p>
          </div>
          <button
            type="button"
            className="border border-line bg-surface p-2 hover:bg-ink hover:text-page transition-colors"
            aria-label="Закрыть окно импорта"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <label className="block">
            <span className="mb-1 block text-[9px] font-bold uppercase opacity-60">
              Данные таблицы
            </span>
            <textarea
              className="h-64 w-full resize-none border border-line bg-surface px-3 py-2 font-mono text-xs outline-none focus:shadow-[4px_4px_0_var(--ink)]"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Наименование&#9;ЕИ&#9;Количество&#9;Поставщик 1&#10;Позиция&#9;шт&#9;1&#9;1234,56"
              autoFocus
            />
          </label>

          <div className="border border-line bg-surface p-3">
            <p className="mb-2 text-[9px] font-bold uppercase opacity-60">Порядок колонок</p>
            <ol className="space-y-1 text-xs">
              <li>1. Наименование</li>
              <li>2. Единица измерения</li>
              <li>3. Количество</li>
              {suppliers.map((supplier, index) => (
                <li key={supplier.id}>
                  {index + 4}. {supplier.name || `Поставщик ${index + 1}`}
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-line/20 pt-3 text-[11px] leading-relaxed opacity-70">
              Цены можно оставить пустыми. Новые строки будут добавлены к текущим позициям.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase opacity-60">
            Закрытие: Esc или клик по фону
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-brutal bg-surface" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn-brutal btn-brutal-primary text-xs disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canImport}
            >
              Импортировать
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
