import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, ExternalLink, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import {
  DOCUMENT_KINDS,
  type AppState,
  type DocumentKind,
  type KpDocxData,
  type Purchase,
  type PurchaseContext,
  type PurchaseDocumentMetadata,
  type PurchaseLink,
  type PurchaseOffer,
  type ServiceMemoData,
} from '../types';
import AutofillSuggestField from './AutofillSuggestField';
import { generateRegisteredDocument, getDocumentTitle } from '../documents/registry';
import type { AutofillSuggestion } from '../documents/autofill';
import { apiFetch, readApiError } from '../utils/api';
import { calculateMinSupplierTotal } from '../utils/currentPurchase';
import { nmckWizardOffersPath } from '../utils/purchaseWizard';

type PurchaseMutationResponse = {
  success: boolean;
  purchase: Purchase;
};

type LinkMutationResponse = {
  success: boolean;
  link: PurchaseLink;
};

type ContractMutationResponse = {
  success: boolean;
  document: PurchaseDocumentMetadata;
};

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseOptionalNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return 'contract';
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || 'contract';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNmckState(value: unknown): value is AppState {
  return (
    isRecord(value)
    && isRecord(value.requisites)
    && Array.isArray(value.suppliers)
    && Array.isArray(value.positions)
    && Array.isArray(value.prices)
  );
}

function isKpState(value: unknown): value is KpDocxData {
  return isRecord(value) && typeof value.subjectIntro === 'string';
}

function isMemoState(value: unknown): value is ServiceMemoData {
  return isRecord(value) && typeof value.subjectIntro === 'string';
}

function compactString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function createCardSuggestion(
  fieldKey: 'name' | 'price' | 'budgetYear',
  label: string,
  value: string | number,
  sourceLabel: string,
  reason: string,
  currentValue: string,
  documentKind: DocumentKind = 'nmck'
): AutofillSuggestion {
  return {
    documentKind,
    fieldKey,
    label,
    statePath: `purchase.${fieldKey}`,
    currentValue,
    value,
    sourceKind: 'currentPurchase',
    sourceLabel,
    reason,
    willOverwrite: currentValue.trim().length > 0,
  };
}

function pushUniqueSuggestion(suggestions: AutofillSuggestion[], suggestion: AutofillSuggestion) {
  const value = compactString(suggestion.value).toLowerCase();
  if (!value || suggestions.some((item) => compactString(item.value).toLowerCase() === value)) return;
  suggestions.push(suggestion);
}

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const purchaseId = Number(id);
  const navigate = useNavigate();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [links, setLinks] = useState<PurchaseLink[]>([]);
  const [documents, setDocuments] = useState<PurchaseContext['documents']>({});
  const [contract, setContract] = useState<PurchaseDocumentMetadata | null>(null);
  const [offers, setOffers] = useState<PurchaseOffer[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [budgetYear, setBudgetYear] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractBusy, setContractBusy] = useState(false);

  const isValidId = Number.isInteger(purchaseId) && purchaseId > 0;
  const documentKinds = useMemo(() => [...DOCUMENT_KINDS], []);
  const hasContract = Boolean(contract?.fileName && contract.fileRelPath);
  const cardNameSuggestions = useMemo(() => {
    const suggestions: AutofillSuggestion[] = [];
    const nmck = isNmckState(documents.nmck) ? documents.nmck : undefined;
    const kp = isKpState(documents.kp) ? documents.kp : undefined;
    const memo = isMemoState(documents.memo) ? documents.memo : undefined;

    pushUniqueSuggestion(
      suggestions,
      createCardSuggestion('name', 'Название', compactString(nmck?.requisites.subject), 'НМЦК', 'объект закупки', name, 'nmck')
    );
    pushUniqueSuggestion(
      suggestions,
      createCardSuggestion('name', 'Название', compactString(kp?.subjectIntro), 'Запрос КП', 'предмет закупки', name, 'kp')
    );
    pushUniqueSuggestion(
      suggestions,
      createCardSuggestion('name', 'Название', compactString(kp?.subjectTable), 'Запрос КП', 'табличный предмет закупки', name, 'kp')
    );
    pushUniqueSuggestion(
      suggestions,
      createCardSuggestion('name', 'Название', compactString(memo?.subjectIntro), 'Служебная записка', 'предмет закупки', name, 'memo')
    );
    pushUniqueSuggestion(
      suggestions,
      createCardSuggestion('name', 'Название', compactString(memo?.subjectTable), 'Служебная записка', 'перечень объектов закупки', name, 'memo')
    );

    return suggestions;
  }, [documents, name]);
  const cardPriceSuggestions = useMemo(() => {
    const nmck = isNmckState(documents.nmck) ? documents.nmck : undefined;
    if (!nmck) return [];
    const minSupplierTotal = calculateMinSupplierTotal(nmck);
    return minSupplierTotal > 0
      ? [createCardSuggestion('price', 'Цена', minSupplierTotal, 'НМЦК', 'минимальная сумма поставщика', price, 'nmck')]
      : [];
  }, [documents, price]);
  const cardBudgetYearSuggestions = useMemo(() => [
    createCardSuggestion('budgetYear', 'Год лимитов', new Date().getFullYear(), 'Текущая дата', 'текущий год', budgetYear, 'nmck'),
  ], [budgetYear]);

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const applyPurchase = (nextPurchase: Purchase) => {
    setPurchase(nextPurchase);
    setName(nextPurchase.name);
    setPrice(nextPurchase.price === null ? '' : String(nextPurchase.price));
    setBudgetYear(nextPurchase.budgetYear === null ? '' : String(nextPurchase.budgetYear));
  };

  const fetchContext = async () => {
    if (!isValidId) {
      navigate('/purchases', { replace: true });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/context`);
      if (res.ok) {
        const data: PurchaseContext = await res.json();
        applyPurchase(data.purchase);
        setLinks(data.links);
        setDocuments(data.documents);
        setContract(data.contract);
        setOffers(data.offers ?? []);
      } else if (res.status === 404) {
        showMessage('Закупка не найдена.', true);
      } else {
        showMessage(await readApiError(res, 'Не удалось загрузить закупку.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось загрузить закупку: ошибка сети.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContext();
  }, [purchaseId]);

  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!purchase) return;

    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: parseOptionalNumber(price),
          budgetYear: parseOptionalNumber(budgetYear),
        }),
      });

      if (res.ok) {
        const data: PurchaseMutationResponse = await res.json();
        applyPurchase(data.purchase);
        showMessage('Карточка закупки сохранена.');
      } else {
        showMessage(await readApiError(res, 'Не удалось сохранить карточку.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось сохранить карточку: ошибка сети.', true);
    } finally {
      setSaving(false);
    }
  };

  const pickCardSuggestion = (
    field: 'name' | 'price' | 'budgetYear',
    suggestion: AutofillSuggestion
  ) => {
    const value = String(suggestion.value);
    if (field === 'name') setName(value);
    if (field === 'price') setPrice(value);
    if (field === 'budgetYear') setBudgetYear(value);
    showMessage(`Поле заполнено: ${suggestion.sourceLabel}.`);
  };

  const createLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!purchase) return;

    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newLinkUrl, title: newLinkTitle }),
      });

      if (res.ok) {
        const data: LinkMutationResponse = await res.json();
        setLinks(prev => [data.link, ...prev]);
        setNewLinkUrl('');
        setNewLinkTitle('');
        showMessage('Ссылка добавлена.');
      } else {
        showMessage(await readApiError(res, 'Не удалось добавить ссылку.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось добавить ссылку: ошибка сети.', true);
    }
  };

  const updateLink = async (linkId: number) => {
    if (!purchase) return;
    const link = links.find(item => item.id === linkId);
    if (!link) return;

    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.url, title: link.title }),
      });

      if (res.ok) {
        const data: LinkMutationResponse = await res.json();
        setLinks(prev => prev.map(item => item.id === link.id ? data.link : item));
      } else {
        showMessage(await readApiError(res, 'Не удалось обновить ссылку.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось обновить ссылку: ошибка сети.', true);
    }
  };

  const deleteLink = async (link: PurchaseLink) => {
    if (!purchase) return;

    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/links/${link.id}`, { method: 'DELETE' });
      if (res.ok) {
        setLinks(prev => prev.filter(item => item.id !== link.id));
        showMessage('Ссылка удалена.');
      } else {
        showMessage(await readApiError(res, 'Не удалось удалить ссылку.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось удалить ссылку: ошибка сети.', true);
    }
  };

  const deleteDocument = async (kind: DocumentKind) => {
    if (!purchase || !window.confirm(`Удалить документ «${getDocumentTitle(kind)}» из закупки?`)) return;

    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/documents/${kind}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => {
          const next = { ...prev };
          delete next[kind];
          return next;
        });
        showMessage('Документ удалён.');
      } else {
        showMessage(await readApiError(res, 'Не удалось удалить документ.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось удалить документ: ошибка сети.', true);
    }
  };

  const downloadDocument = async (kind: DocumentKind) => {
    const state = documents[kind];
    if (!state) return;

    try {
      await generateRegisteredDocument(kind, state);
    } catch (err) {
      console.error(err);
      showMessage('Не удалось сформировать DOCX из сохранённого состояния.', true);
    }
  };

  const uploadContract = async () => {
    if (!purchase || !contractFile) return;
    const formData = new FormData();
    formData.set('file', contractFile);

    setContractBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/contract`, {
        method: 'PUT',
        body: formData,
      });
      if (res.ok) {
        const data: ContractMutationResponse = await res.json();
        setContract(data.document);
        setContractFile(null);
        showMessage('Контракт загружен.');
      } else {
        showMessage(await readApiError(res, 'Не удалось загрузить контракт.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось загрузить контракт: ошибка сети.', true);
    } finally {
      setContractBusy(false);
    }
  };

  const downloadContract = async () => {
    if (!purchase || !hasContract) return;
    setContractBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/contract`);
      if (res.ok) {
        downloadBlob(await res.blob(), parseFileName(res.headers.get('Content-Disposition')));
      } else {
        showMessage(await readApiError(res, 'Контракт не найден.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось скачать контракт: ошибка сети.', true);
    } finally {
      setContractBusy(false);
    }
  };

  const deleteContract = async () => {
    if (!purchase || !window.confirm('Удалить файл контракта из закупки?')) return;
    setContractBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchase.id}/contract`, { method: 'DELETE' });
      if (res.ok) {
        setContract(null);
        showMessage('Контракт удалён.');
      } else {
        showMessage(await readApiError(res, 'Не удалось удалить контракт.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось удалить контракт: ошибка сети.', true);
    } finally {
      setContractBusy(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl border border-dashed border-line bg-surface py-10 text-center text-sm opacity-60">Загрузка карточки...</div>;
  }

  if (!purchase) {
    return (
      <div className="mx-auto max-w-3xl border border-line bg-surface p-6">
        <h2 className="mb-2 text-xl font-bold uppercase tracking-tighter">Закупка недоступна</h2>
        {message && <p className="mb-4 text-sm text-red-700">{message}</p>}
        <Link to="/purchases" className="btn-brutal inline-flex bg-surface text-sm font-bold">К списку закупок</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/purchases" className="mb-2 inline-block text-[11px] font-bold uppercase hover:underline">← Все закупки</Link>
          <h2 className="text-xl font-bold uppercase tracking-tighter">{purchase.name}</h2>
          <p className="text-[11px] opacity-60">
            Цена: {purchase.price === null ? 'не указана' : `${moneyFormatter.format(purchase.price)} ₽`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchContext()}
          className="btn-brutal flex items-center gap-2 bg-surface text-sm font-bold"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Обновить
        </button>
      </div>

      {message && (
        <div className={`border border-line bg-surface px-4 py-3 text-sm ${messageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
          {message}
        </div>
      )}

      <section className="border border-line bg-surface p-6">
        <h3 className="mb-4 text-sm font-bold uppercase">Карточка закупки</h3>
        <form onSubmit={savePurchase} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_140px_auto]">
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-bold uppercase opacity-70">Название</label>
            <AutofillSuggestField
              fieldKey="name"
              className="border border-line px-3 py-2 text-sm"
              value={name}
              onChange={setName}
              suggestions={cardNameSuggestions}
              onPick={suggestion => pickCardSuggestion('name', suggestion)}
              placeholder="Название закупки"
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-bold uppercase opacity-70">Цена</label>
            <AutofillSuggestField
              fieldKey="price"
              className="border border-line px-3 py-2 text-sm"
              value={price}
              onChange={setPrice}
              suggestions={cardPriceSuggestions}
              onPick={suggestion => pickCardSuggestion('price', suggestion)}
              inputMode="decimal"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-bold uppercase opacity-70">Год лимитов</label>
            <AutofillSuggestField
              fieldKey="budgetYear"
              className="border border-line px-3 py-2 text-sm"
              value={budgetYear}
              onChange={setBudgetYear}
              suggestions={cardBudgetYearSuggestions}
              onPick={suggestion => pickCardSuggestion('budgetYear', suggestion)}
              inputMode="numeric"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-brutal btn-brutal-primary mt-auto flex items-center justify-center gap-2 disabled:opacity-50">
            <Save className="h-4 w-4" /> Сохранить
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="border border-line bg-surface p-6">
          <h3 className="mb-4 text-sm font-bold uppercase">Документы закупки</h3>
          <div className="flex flex-col gap-3">
            {documentKinds.map(kind => {
              const hasState = Boolean(documents[kind]);
              return (
                <div key={kind} className="flex flex-wrap items-center justify-between gap-3 border border-ink/15 p-3">
                  <div>
                    <p className="text-sm font-bold">{getDocumentTitle(kind)}</p>
                    <p className="text-[10px] opacity-60">{hasState ? 'Сохранённое состояние есть' : 'Документ ещё не сохранён'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/purchases/${purchase.id}/${kind}`} className="btn-brutal bg-surface text-[11px] font-bold">
                      {hasState ? 'Открыть' : 'Добавить'}
                    </Link>
                    <button type="button" disabled={!hasState} onClick={() => void downloadDocument(kind)} className="btn-brutal bg-surface text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40">
                      <Download className="inline h-3.5 w-3.5" /> DOCX
                    </button>
                    <button type="button" disabled={!hasState} onClick={() => void deleteDocument(kind)} className="p-2 text-ink/40 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-3 border border-ink/15 p-3">
              <div>
                <p className="text-sm font-bold">КП</p>
                <p className="text-[10px] opacity-60">
                  {offers.length > 0 ? `Загружено: ${offers.length}` : 'Ещё не загружены'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/purchases/${purchase.id}/offers`} className="btn-brutal bg-surface text-[11px] font-bold">
                  {offers.length > 0 ? 'Открыть' : 'Добавить'}
                </Link>
                <Link to={nmckWizardOffersPath(purchase.id)} className="btn-brutal btn-brutal-primary text-[11px] font-bold">
                  Все КП получены
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-line bg-surface p-6">
          <h3 className="mb-4 text-sm font-bold uppercase">Контракт</h3>
          <p className="mb-4 text-[11px] opacity-60">Загрузите PDF или DOCX. Повторная загрузка заменяет предыдущий файл.</p>
          <div className="flex flex-col gap-3">
            <div className="border border-line/30 bg-ink/5 px-3 py-2 text-[11px]">
              {hasContract ? (
                <>
                  <span className="font-bold">Файл загружен:</span> {contract?.fileName}
                  <span className="ml-2 opacity-60">обновлён {contract ? new Date(contract.updatedAt).toLocaleString('ru-RU') : ''}</span>
                </>
              ) : (
                <span className="opacity-60">Файл контракта ещё не загружен.</span>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={event => setContractFile(event.target.files?.[0] || null)}
              className="border border-line bg-surface px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!contractFile || contractBusy} onClick={() => void uploadContract()} className="btn-brutal btn-brutal-primary flex items-center gap-2 disabled:opacity-50">
                <Upload className="h-4 w-4" /> Загрузить
              </button>
              <button type="button" disabled={!hasContract || contractBusy} onClick={() => void downloadContract()} className="btn-brutal flex items-center gap-2 bg-surface text-sm font-bold disabled:opacity-50">
                <Download className="h-4 w-4" /> Скачать
              </button>
              <button type="button" disabled={!hasContract || contractBusy} onClick={() => void deleteContract()} className="btn-brutal flex items-center gap-2 bg-surface text-sm font-bold text-red-700 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Удалить
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-line bg-surface p-6">
        <h3 className="mb-4 text-sm font-bold uppercase">Ссылки закупки</h3>
        <form onSubmit={createLink} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input className="border border-line px-3 py-2 text-sm" value={newLinkUrl} onChange={event => setNewLinkUrl(event.target.value)} placeholder="https://..." required />
          <input className="border border-line px-3 py-2 text-sm" value={newLinkTitle} onChange={event => setNewLinkTitle(event.target.value)} placeholder="Название ссылки" />
          <button type="submit" className="btn-brutal flex items-center justify-center gap-2 bg-surface text-sm font-bold">
            <Plus className="h-4 w-4" /> Добавить
          </button>
        </form>

        {links.length === 0 ? (
          <div className="border border-dashed border-line py-8 text-center text-sm opacity-60">Ссылок пока нет</div>
        ) : (
          <div className="flex flex-col gap-3">
            {links.map(link => (
              <div key={link.id} className="grid grid-cols-1 gap-2 border border-ink/15 p-3 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className="border border-line px-3 py-2 text-sm"
                  value={link.url}
                  onChange={event => setLinks(prev => prev.map(item => item.id === link.id ? { ...item, url: event.target.value } : item))}
                  onBlur={() => void updateLink(link.id)}
                />
                <input
                  className="border border-line px-3 py-2 text-sm"
                  value={link.title}
                  onChange={event => setLinks(prev => prev.map(item => item.id === link.id ? { ...item, title: event.target.value } : item))}
                  onBlur={() => void updateLink(link.id)}
                />
                <div className="flex gap-2">
                  <a href={link.url} target="_blank" rel="noreferrer" className="p-2 text-ink/50 hover:bg-ink/5 hover:text-ink" title="Открыть ссылку">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button type="button" onClick={() => void deleteLink(link)} className="p-2 text-ink/40 hover:bg-red-50 hover:text-red-700" title="Удалить ссылку">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
