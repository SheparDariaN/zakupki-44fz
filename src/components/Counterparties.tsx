import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, RefreshCw, Search, Tag, Trash2, User, X } from 'lucide-react';
import AppNav from './AppNav';
import { apiFetch, readApiError } from '../utils/api';
import type { Counterparty } from '../types';

type CounterpartyForm = {
  companyName: string;
  director: string;
  email: string;
  legalAddress: string;
  tagsInput: string;
};

type MutationResponse = {
  success: boolean;
  counterparty: Counterparty;
};

const emptyForm: CounterpartyForm = {
  companyName: '',
  director: '',
  email: '',
  legalAddress: '',
  tagsInput: '',
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value.split(',')) {
    const tag = rawTag.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

function tagsToInput(tags: string[]): string {
  return tags.join(', ');
}

function formatDate(value: number): string {
  return dateFormatter.format(new Date(value));
}

export default function Counterparties() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [form, setForm] = useState<CounterpartyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  useEffect(() => {
    void fetchCounterparties();
  }, []);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    counterparties.forEach((counterparty) => counterparty.tags.forEach((tag) => tags.add(tag)));
    return [...tags].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [counterparties]);

  const filteredCounterparties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const tagFilter = new Set(selectedTags);

    return counterparties.filter((counterparty) => {
      const matchesQuery = !normalizedQuery || [
        counterparty.companyName,
        counterparty.director,
        counterparty.email,
        counterparty.legalAddress,
        counterparty.tags.join(' '),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesTags = tagFilter.size === 0 || counterparty.tags.some((tag) => tagFilter.has(tag));
      return matchesQuery && matchesTags;
    });
  }, [counterparties, query, selectedTags]);

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const fetchCounterparties = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/counterparties');
      if (res.ok) {
        const data: Counterparty[] = await res.json();
        setCounterparties(data);
      } else {
        showMessage(await readApiError(res, 'Не удалось загрузить справочник.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось загрузить справочник: ошибка сети.', true);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (counterparty: Counterparty) => {
    setEditingId(counterparty.id);
    setForm({
      companyName: counterparty.companyName,
      director: counterparty.director,
      email: counterparty.email,
      legalAddress: counterparty.legalAddress,
      tagsInput: tagsToInput(counterparty.tags),
    });
    setMessage('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');

    const payload = {
      companyName: form.companyName,
      director: form.director,
      email: form.email,
      legalAddress: form.legalAddress,
      tags: parseTags(form.tagsInput),
    };

    setSaving(true);
    try {
      const res = await apiFetch(editingId ? `/api/counterparties/${editingId}` : '/api/counterparties', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: MutationResponse = await res.json();
        setCounterparties((prev) => {
          if (editingId) {
            return prev.map((item) => item.id === data.counterparty.id ? data.counterparty : item);
          }
          return [data.counterparty, ...prev];
        });
        resetForm();
        showMessage(editingId ? 'Контрагент обновлён.' : 'Контрагент добавлен.');
      } else {
        showMessage(await readApiError(res, 'Не удалось сохранить контрагента.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось сохранить контрагента: ошибка сети.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (counterparty: Counterparty) => {
    const confirmed = window.confirm(`Удалить контрагента «${counterparty.companyName}»?`);
    if (!confirmed) return;

    setMessage('');
    try {
      const res = await apiFetch(`/api/counterparties/${counterparty.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCounterparties((prev) => prev.filter((item) => item.id !== counterparty.id));
        if (editingId === counterparty.id) resetForm();
        showMessage('Контрагент удалён.');
      } else {
        showMessage(await readApiError(res, 'Не удалось удалить контрагента.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось удалить контрагента: ошибка сети.', true);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (
      prev.includes(tag)
        ? prev.filter((item) => item !== tag)
        : [...prev, tag]
    ));
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedTags([]);
  };

  const labelClass = 'text-[10px] uppercase font-bold mb-1 opacity-70';
  const inputClass = 'border border-[#141414] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black';
  const mutedText = 'text-[11px] opacity-60';
  const canSave = Boolean(form.companyName.trim()) && !saving;

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-8 font-sans text-[#141414] overflow-auto">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-[#141414] pb-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Справочник контрагентов</h1>
            <p className="text-[10px] opacity-60">Общий список организаций для запросов коммерческих предложений.</p>
          </div>
          <div className="flex gap-3 items-center shrink-0 flex-wrap justify-end">
            <AppNav />
            <a href="/profile" className="btn-brutal bg-white flex items-center gap-2 hover:bg-gray-100 text-sm font-bold">
              <User className="w-4 h-4" /> Личный кабинет
            </a>
            <button
              type="button"
              onClick={() => void fetchCounterparties()}
              className="btn-brutal bg-white border border-[#141414] flex items-center gap-2 hover:bg-yellow-100 text-sm font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Обновить
            </button>
          </div>
        </header>

        {message && (
          <div className={`mb-4 p-3 bg-white border border-[#141414] text-sm ${messageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
            {message}
          </div>
        )}

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <aside className="xl:col-span-4 flex flex-col gap-6">
            <section className="bg-white p-6 border border-[#141414]">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-sm uppercase font-bold">{editingId ? 'Редактирование' : 'Новый контрагент'}</h2>
                {editingId && (
                  <button type="button" onClick={resetForm} className="text-[10px] uppercase font-bold flex items-center gap-1 hover:text-red-700">
                    <X className="w-3.5 h-3.5" /> Отменить
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <label className={labelClass}>Наименование *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.companyName}
                    onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    placeholder="ООО «Пример»"
                  />
                </div>
                <div className="flex flex-col">
                  <label className={labelClass}>Руководитель</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.director}
                    onChange={(event) => setForm((prev) => ({ ...prev, director: event.target.value }))}
                    placeholder="Генеральный директор Иванов И.И."
                  />
                </div>
                <div className="flex flex-col">
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="info@example.ru"
                  />
                </div>
                <div className="flex flex-col">
                  <label className={labelClass}>Юридический адрес</label>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    value={form.legalAddress}
                    onChange={(event) => setForm((prev) => ({ ...prev, legalAddress: event.target.value }))}
                    placeholder="Адрес одной или несколькими строками"
                  />
                </div>
                <div className="flex flex-col">
                  <label className={labelClass}>Теги</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.tagsInput}
                    onChange={(event) => setForm((prev) => ({ ...prev, tagsInput: event.target.value }))}
                    placeholder="ПО, поддержка, регион"
                  />
                  <p className="text-[10px] opacity-50 mt-1">Через запятую. Пустые и повторяющиеся теги будут отброшены.</p>
                </div>
                <button
                  type="submit"
                  disabled={!canSave}
                  className="mt-2 bg-[#141414] text-white py-2 text-sm font-bold uppercase hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить контрагента'}
                </button>
              </form>
            </section>

            <section className="bg-white/60 p-6 border border-[#141414]">
              <h2 className="text-sm uppercase font-bold mb-4">Фильтры</h2>
              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="search"
                  className="border border-[#141414] pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black w-full"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Поиск по названию, email, адресу..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {availableTags.length === 0 && <p className={mutedText}>Теги появятся после добавления контрагентов.</p>}
                {availableTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-[11px] font-bold px-2 py-1 border border-[#141414] transition-colors ${
                        selected ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white hover:bg-black/5'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {(query || selectedTags.length > 0) && (
                <button type="button" onClick={clearFilters} className="mt-4 text-[10px] uppercase font-bold hover:underline">
                  Сбросить фильтры
                </button>
              )}
            </section>
          </aside>

          <section className="xl:col-span-8 bg-white border border-[#141414] min-h-[520px]">
            <div className="p-4 border-b border-[#141414] flex items-center justify-between gap-3 bg-black/5">
              <div>
                <h2 className="text-sm uppercase font-bold">Контрагенты</h2>
                <p className="text-[10px] opacity-60">
                  Показано: {filteredCounterparties.length} из {counterparties.length}
                </p>
              </div>
              <Tag className="w-5 h-5 opacity-50" />
            </div>

            <div className="divide-y divide-[#141414]">
              {loading && (
                <div className="p-8 text-sm font-bold uppercase opacity-60">Загрузка справочника...</div>
              )}

              {!loading && filteredCounterparties.length === 0 && (
                <div className="p-8">
                  <p className="text-sm font-bold uppercase mb-2">Ничего не найдено</p>
                  <p className={mutedText}>Добавьте первого контрагента или измените условия поиска.</p>
                </div>
              )}

              {!loading && filteredCounterparties.map((counterparty) => (
                <article key={counterparty.id} className="p-5 hover:bg-[#E4E3E0]/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold uppercase tracking-tight break-words">{counterparty.companyName}</h3>
                      <p className="text-[10px] opacity-50 mt-1">Обновлено: {formatDate(counterparty.updatedAt)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(counterparty)}
                        className="border border-[#141414] bg-white p-2 hover:bg-yellow-100 transition-colors"
                        title="Редактировать"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(counterparty)}
                        className="border border-[#141414] bg-white p-2 hover:bg-red-100 hover:text-red-700 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <dt className={labelClass}>Руководитель</dt>
                      <dd className="break-words">{counterparty.director || <span className="opacity-40">Не указан</span>}</dd>
                    </div>
                    <div>
                      <dt className={labelClass}>Email</dt>
                      <dd className="break-words">{counterparty.email || <span className="opacity-40">Не указан</span>}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className={labelClass}>Юридический адрес</dt>
                      <dd className="whitespace-pre-wrap break-words">{counterparty.legalAddress || <span className="opacity-40">Не указан</span>}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {counterparty.tags.length === 0 && <span className="text-[10px] opacity-40">Без тегов</span>}
                    {counterparty.tags.map((tag) => (
                      <span key={tag} className="status-chip bg-white">{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
