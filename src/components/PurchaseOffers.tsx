import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Eye, Plus, RefreshCw, Save, Trash2, User } from 'lucide-react';
import AppNav from './AppNav';
import ThemeToggle from './ThemeToggle';
import { apiFetch, readApiError } from '../utils/api';
import type { Counterparty, PurchaseOffer } from '../types';

type OfferMutationResponse = {
  success: boolean;
  offer: PurchaseOffer;
};

function parseFileName(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || fallback;
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

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf';
}

function formatOfferDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

type OfferFormState = {
  file: File | null;
  registeredNumber: string;
  registeredDate: string;
  companyName: string;
  counterpartyId: string;
};

const emptyForm: OfferFormState = {
  file: null,
  registeredNumber: '',
  registeredDate: '',
  companyName: '',
  counterpartyId: '',
};

function appendOfferFields(formData: FormData, form: OfferFormState) {
  formData.set('registeredNumber', form.registeredNumber);
  formData.set('registeredDate', form.registeredDate);
  formData.set('companyName', form.companyName);
  formData.set('counterpartyId', form.counterpartyId);
}

export default function PurchaseOffers() {
  const { id } = useParams<{ id: string }>();
  const purchaseId = Number(id);

  const [offers, setOffers] = useState<PurchaseOffer[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [form, setForm] = useState<OfferFormState>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<OfferFormState>(emptyForm);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const isValidId = Number.isInteger(purchaseId) && purchaseId > 0;
  const previewOffer = useMemo(
    () => offers.find((item) => item.id === previewId) ?? null,
    [offers, previewId]
  );

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const applyCounterparty = (next: OfferFormState, counterpartyId: string): OfferFormState => {
    const counterparty = counterparties.find((item) => String(item.id) === counterpartyId);
    return {
      ...next,
      counterpartyId,
      companyName: counterparty ? counterparty.companyName : next.companyName,
    };
  };

  const applyCompanyName = (next: OfferFormState, companyName: string): OfferFormState => {
    const match = counterparties.find((item) => item.companyName === companyName.trim());
    return {
      ...next,
      companyName,
      counterpartyId: match ? String(match.id) : '',
    };
  };

  const fetchOffers = async () => {
    if (!isValidId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/offers`);
      if (res.ok) {
        const data: PurchaseOffer[] = await res.json();
        setOffers(data);
      } else {
        showMessage(await readApiError(res, 'Не удалось загрузить КП.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось загрузить КП: ошибка сети.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOffers();
  }, [purchaseId]);

  useEffect(() => {
    let active = true;
    async function loadCounterparties() {
      try {
        const res = await apiFetch('/api/counterparties');
        if (!active) return;
        if (res.ok) {
          const data: Counterparty[] = await res.json();
          setCounterparties(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    void loadCounterparties();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isValidId || previewId === null) {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setPreviewMime('');
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    async function loadPreview() {
      try {
        const res = await apiFetch(`/api/purchases/${purchaseId}/offers/${previewId}`);
        if (!res.ok) {
          showMessage(await readApiError(res, 'Не удалось открыть файл КП.'), true);
          return;
        }
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return objectUrl;
        });
        setPreviewMime(blob.type || previewOffer?.mime || '');
      } catch (err) {
        console.error(err);
        if (!revoked) showMessage('Не удалось открыть файл КП: ошибка сети.', true);
      }
    }

    void loadPreview();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [purchaseId, previewId, previewNonce, isValidId, previewOffer?.mime]);

  const uploadOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidId || !form.file) return;
    const formData = new FormData();
    formData.set('file', form.file);
    appendOfferFields(formData, form);

    setBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/offers`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data: OfferMutationResponse = await res.json();
        setOffers((prev) => [data.offer, ...prev]);
        setForm(emptyForm);
        showMessage('КП загружено.');
      } else {
        showMessage(await readApiError(res, 'Не удалось загрузить КП.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось загрузить КП: ошибка сети.', true);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (offer: PurchaseOffer) => {
    setEditId(offer.id);
    setEditForm({
      file: null,
      registeredNumber: offer.registeredNumber,
      registeredDate: offer.registeredDate,
      companyName: offer.companyName,
      counterpartyId: offer.counterpartyId === null ? '' : String(offer.counterpartyId),
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidId || editId === null) return;
    const formData = new FormData();
    if (editForm.file) formData.set('file', editForm.file);
    appendOfferFields(formData, editForm);

    setBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/offers/${editId}`, {
        method: 'PUT',
        body: formData,
      });
      if (res.ok) {
        const data: OfferMutationResponse = await res.json();
        setOffers((prev) => prev.map((item) => item.id === data.offer.id ? data.offer : item));
        setEditId(null);
        setEditForm(emptyForm);
        if (previewId === data.offer.id) setPreviewNonce((value) => value + 1);
        showMessage('КП обновлено.');
      } else {
        showMessage(await readApiError(res, 'Не удалось обновить КП.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось обновить КП: ошибка сети.', true);
    } finally {
      setBusy(false);
    }
  };

  const downloadOffer = async (offer: PurchaseOffer) => {
    if (!isValidId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/offers/${offer.id}?download=1`);
      if (res.ok) {
        downloadBlob(await res.blob(), parseFileName(res.headers.get('Content-Disposition'), offer.fileName));
      } else {
        showMessage(await readApiError(res, 'Не удалось скачать КП.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось скачать КП: ошибка сети.', true);
    } finally {
      setBusy(false);
    }
  };

  const deleteOffer = async (offer: PurchaseOffer) => {
    if (!isValidId || !window.confirm(`Удалить КП № ${offer.registeredNumber}?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/offers/${offer.id}`, { method: 'DELETE' });
      if (res.ok) {
        setOffers((prev) => prev.filter((item) => item.id !== offer.id));
        if (previewId === offer.id) setPreviewId(null);
        if (editId === offer.id) {
          setEditId(null);
          setEditForm(emptyForm);
        }
        showMessage('КП удалено.');
      } else {
        showMessage(await readApiError(res, 'Не удалось удалить КП.'), true);
      }
    } catch (err) {
      console.error(err);
      showMessage('Не удалось удалить КП: ошибка сети.', true);
    } finally {
      setBusy(false);
    }
  };

  const companyFields = (
    formState: OfferFormState,
    onChange: (next: OfferFormState) => void,
    prefix: string
  ) => (
    <>
      <select
        className="border border-line bg-surface px-3 py-2 text-sm"
        value={formState.counterpartyId}
        onChange={(event) => onChange(applyCounterparty(formState, event.target.value))}
      >
        <option value="">Компания не указана / свой текст</option>
        {counterparties.map((counterparty) => (
          <option key={counterparty.id} value={String(counterparty.id)}>
            {counterparty.companyName}
          </option>
        ))}
      </select>
      <input
        list={`${prefix}-companies`}
        className="border border-line px-3 py-2 text-sm"
        value={formState.companyName}
        onChange={(event) => onChange(applyCompanyName(formState, event.target.value))}
        placeholder="Название компании"
      />
      <datalist id={`${prefix}-companies`}>
        {counterparties.map((counterparty) => (
          <option key={counterparty.id} value={counterparty.companyName} />
        ))}
      </datalist>
    </>
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-page p-6 font-sans text-ink">
      <header className="mb-6 flex shrink-0 items-center justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Входящие КП</h1>
          <p className="text-[11px] opacity-60">PDF или изображение. Номер и дата регистрации обязательны.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <AppNav />
          <ThemeToggle />
          <a href="/cabinet" className="btn-brutal flex items-center gap-2 text-sm font-bold">
            <User className="h-4 w-4" /> Личный кабинет
          </a>
          <button
            type="button"
            onClick={() => void fetchOffers()}
            className="btn-brutal flex items-center gap-2 bg-surface text-sm font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Обновить
          </button>
        </div>
      </header>

      {message && (
        <div className={`mb-4 border border-line bg-surface px-4 py-3 text-sm ${messageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
          {message}
        </div>
      )}

      <main className="grid min-h-0 flex-grow grid-cols-1 gap-6 overflow-hidden xl:grid-cols-12">
        <section className="scroll-area col-span-1 flex flex-col gap-6 overflow-auto xl:col-span-5">
          <form onSubmit={(event) => void uploadOffer(event)} className="border border-line bg-surface p-5">
            <h2 className="mb-4 text-[11px] font-bold uppercase">Загрузить КП</h2>
            <div className="grid grid-cols-1 gap-3">
              <input
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                className="border border-line bg-surface px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  className="border border-line px-3 py-2 text-sm"
                  value={form.registeredNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, registeredNumber: event.target.value }))}
                  placeholder="Номер КП"
                />
                <input
                  required
                  type="date"
                  className="border border-line px-3 py-2 text-sm"
                  value={form.registeredDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, registeredDate: event.target.value }))}
                />
              </div>
              {companyFields(form, setForm, 'upload')}
              <button type="submit" disabled={busy || !form.file} className="btn-brutal btn-brutal-primary flex items-center justify-center gap-2 disabled:opacity-50">
                <Plus className="h-4 w-4" /> Загрузить
              </button>
            </div>
          </form>

          <div className="border border-line bg-surface p-5">
            <h2 className="mb-4 text-[11px] font-bold uppercase">Загруженные КП</h2>
            {loading ? (
              <div className="border border-dashed border-line py-8 text-center text-sm opacity-60">Загрузка...</div>
            ) : offers.length === 0 ? (
              <div className="border border-dashed border-line py-8 text-center text-sm opacity-60">КП ещё не загружены</div>
            ) : (
              <div className="flex flex-col gap-3">
                {offers.map((offer) => (
                  <div key={offer.id} className="border border-ink/15 p-3">
                    {editId === offer.id ? (
                      <form onSubmit={(event) => void saveEdit(event)} className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <input
                            required
                            className="border border-line px-3 py-2 text-sm"
                            value={editForm.registeredNumber}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, registeredNumber: event.target.value }))}
                          />
                          <input
                            required
                            type="date"
                            className="border border-line px-3 py-2 text-sm"
                            value={editForm.registeredDate}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, registeredDate: event.target.value }))}
                          />
                        </div>
                        {companyFields(editForm, setEditForm, `edit-${offer.id}`)}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(event) => setEditForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                          className="border border-line bg-surface px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" disabled={busy} className="btn-brutal btn-brutal-primary flex items-center gap-2 disabled:opacity-50">
                            <Save className="h-4 w-4" /> Сохранить
                          </button>
                          <button type="button" onClick={() => setEditId(null)} className="btn-brutal bg-surface text-sm font-bold">
                            Отмена
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">Вх. № {offer.registeredNumber} от {formatOfferDate(offer.registeredDate)}</p>
                          <p className="text-[11px] opacity-70">{offer.companyName || 'Компания не указана'}</p>
                          <p className="text-[10px] opacity-50">{offer.fileName}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => setPreviewId(offer.id)} className="p-2 text-ink/50 hover:bg-ink/5 hover:text-ink" title="Просмотр">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={busy} onClick={() => void downloadOffer(offer)} className="p-2 text-ink/50 hover:bg-ink/5 hover:text-ink" title="Скачать">
                            <Download className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => startEdit(offer)} className="btn-brutal bg-surface text-[11px] font-bold">
                            Править
                          </button>
                          <button type="button" disabled={busy} onClick={() => void deleteOffer(offer)} className="p-2 text-ink/40 hover:bg-red-50 hover:text-red-700" title="Удалить">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="col-span-1 flex min-h-0 flex-col border border-line bg-surface xl:col-span-7">
          <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase">
            {previewOffer ? `Просмотр: ${previewOffer.fileName}` : 'Просмотр файла'}
          </div>
          <div className="min-h-0 flex-1 bg-ink/5">
            {!previewOffer || !previewUrl ? (
              <div className="flex h-full items-center justify-center text-sm opacity-50">Выберите КП для просмотра</div>
            ) : isImageMime(previewMime) ? (
              <img src={previewUrl} alt={previewOffer.fileName} className="h-full w-full object-contain" />
            ) : isPdfMime(previewMime) ? (
              <iframe title={previewOffer.fileName} src={previewUrl} className="h-full w-full border-0 bg-white" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-50">Этот формат можно только скачать</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
