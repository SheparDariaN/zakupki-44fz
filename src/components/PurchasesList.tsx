import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { apiFetch, readApiError } from '../utils/api';
import type { PurchaseListItem } from '../types';

type CreatePurchaseResponse = {
  success: boolean;
  purchase: PurchaseListItem;
};

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const documentLabels = {
  nmck: 'НМЦК',
  kp: 'КП',
  memo: 'СЗ',
  contract: 'Контракт',
} as const;

function formatDate(value: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PurchasesList() {
  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [budgetYear, setBudgetYear] = useState('');
  const navigate = useNavigate();

  const currentYear = useMemo(() => String(new Date().getFullYear()), []);

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/purchases');
      if (res.ok) {
        const data: PurchaseListItem[] = await res.json();
        setPurchases(data);
      } else {
        showMessage(await readApiError(res, 'Не удалось загрузить закупки.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось загрузить закупки: ошибка сети.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPurchases();
  }, []);

  const createPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Новая закупка',
          price: parseOptionalNumber(price),
          budgetYear: parseOptionalNumber(budgetYear || currentYear),
        }),
      });

      if (!res.ok) {
        showMessage(await readApiError(res, 'Не удалось создать закупку.'), true);
        return;
      }

      const data: CreatePurchaseResponse = await res.json();
      navigate(`/purchases/${data.purchase.id}`);
    } catch (err) {
      console.error(err);
      showMessage('Не удалось создать закупку: ошибка сети.', true);
    } finally {
      setSaving(false);
    }
  };

  const deletePurchase = async (purchase: PurchaseListItem) => {
    if (!window.confirm(`Удалить закупку «${purchase.name}» вместе с документами и ссылками?`)) return;

    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}`, { method: 'DELETE' });
      if (res.ok) {
        setPurchases(prev => prev.filter(item => item.id !== purchase.id));
        showMessage('Закупка удалена.');
      } else {
        showMessage(await readApiError(res, 'Не удалось удалить закупку.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось удалить закупку: ошибка сети.', true);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-8">
      <section className="border border-[#141414] bg-white p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tighter">Закупки</h2>
            <p className="text-[11px] opacity-60">Создавайте карточки и ведите документы внутри каждой закупки.</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchPurchases()}
            className="btn-brutal flex items-center gap-2 bg-white text-sm font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Обновить
          </button>
        </div>

        {message && (
          <div className={`mb-4 border border-[#141414] bg-white px-4 py-3 text-sm ${messageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
            {message}
          </div>
        )}

        <form onSubmit={createPurchase} className="grid grid-cols-1 gap-3 border border-[#141414] bg-[#E4E3E0] p-4 md:grid-cols-[1fr_160px_140px_auto]">
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-bold uppercase opacity-70">Название</label>
            <input
              className="border border-[#141414] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Новая закупка"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-bold uppercase opacity-70">Цена</label>
            <input
              className="border border-[#141414] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              value={price}
              onChange={event => setPrice(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-bold uppercase opacity-70">Год лимитов</label>
            <input
              className="border border-[#141414] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              value={budgetYear || currentYear}
              onChange={event => setBudgetYear(event.target.value)}
              inputMode="numeric"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-brutal mt-auto flex items-center justify-center gap-2 bg-[#141414] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Добавить закупку
          </button>
        </form>
      </section>

      <section className="border border-[#141414] bg-white p-6">
        {loading ? (
          <div className="border border-dashed border-[#141414] py-10 text-center text-sm opacity-60">Загрузка закупок...</div>
        ) : purchases.length === 0 ? (
          <div className="border border-dashed border-[#141414] py-10 text-center text-sm opacity-60">Закупок пока нет</div>
        ) : (
          <div className="flex flex-col gap-3">
            {purchases.map(purchase => (
              <div key={purchase.id} className="grid grid-cols-1 gap-4 border border-black/15 p-4 transition-colors hover:border-black md:grid-cols-[1fr_auto]">
                <Link to={`/purchases/${purchase.id}`} className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-bold">{purchase.name}</h3>
                    <span className="status-chip">обновлено {formatDate(purchase.updatedAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] opacity-70">
                    <span>Цена: {purchase.price === null ? 'не указана' : `${moneyFormatter.format(purchase.price)} ₽`}</span>
                    <span>Год лимитов: {purchase.budgetYear || 'не указан'}</span>
                    <span>Ссылок: {purchase.linksCount}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(documentLabels).map(([kind, label]) => (
                      <span key={kind} className="status-chip flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {label}: {purchase.documentCounts[kind as keyof typeof documentLabels] || 0}
                      </span>
                    ))}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void deletePurchase(purchase)}
                  className="self-start p-2 text-black/40 transition-colors hover:bg-red-50 hover:text-red-700"
                  title="Удалить закупку"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
