import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, RefreshCw, Save, User } from 'lucide-react';
import { ServiceMemoData, type PurchaseContext } from '../types';
import AppNav from './AppNav';
import ServiceMemoPreview from './ServiceMemoPreview';
import { apiFetch, readApiError } from '../utils/api';
import { DOCUMENT_REGISTRY } from '../documents/registry';
import { applyMemoAutofill, resolveAutofill, suggestionsForField, syncMemoRequesterInflection, type AutofillSuggestion, type AutofillUserSettings } from '../documents/autofill';
import type { AutofillSourceKind } from '../documents/templateTypes';
import AutofillPanel from './AutofillPanel';
import AutofillSuggestField from './AutofillSuggestField';
import { buildPurchaseAutofillContext, describeCurrentPurchase } from '../utils/currentPurchase';
import { normalizeMemoState } from '../documents/templateNormalization';
import { DEFAULT_MEMO_ADDRESSEE } from '../utils/serviceMemoDocxGenerator';

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultValues: ServiceMemoData = {
  purpose: 'В целях оптимизации процесса, ведения документооборота в части информационной безопасности, прошу рассмотреть возможность',
  subjectIntro: 'приобретения лицензии программного продукта «АльфаДок» в следующей комплектации:',
  subjectTable: 'права на программу для ЭВМ «Альфа». Приложение «АльфаДок». Клиентская лицензия «Сегмент» на 1 год;\nправа на программу для ЭВМ «Альфа». Приложение «АльфаДок». Клиентская лицензия «Модуль ГИС» на 1 год.',
  requester: '',
  addressee: DEFAULT_MEMO_ADDRESSEE,
  contractServiceHead: '',
  date: todayIso(),
};

export default function ServiceMemo() {
  const { id: purchaseId } = useParams<{ id: string }>();
  const [data, setData] = useState<ServiceMemoData>(defaultValues);
  const [userSettings, setUserSettings] = useState<AutofillUserSettings>();
  const [purchaseContext, setPurchaseContext] = useState<PurchaseContext | null>(null);
  const [autofillSource, setAutofillSource] = useState<'all' | AutofillSourceKind>('all');
  const [autofillOverwrite, setAutofillOverwrite] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloadMessageError, setDownloadMessageError] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchPurchaseContext() {
      if (!purchaseId) return;
      try {
        const res = await apiFetch(`/api/purchases/${purchaseId}/context`);
        if (!active) return;

        if (res.ok) {
          const context: PurchaseContext = await res.json();
          const savedState = context.documents.memo;
          const nextData = savedState
            ? normalizeMemoState(savedState as ServiceMemoData)
            : applyMemoAutofill(defaultValues, { userSettings: context.settings }, {
              excludeFieldKeys: ['addressee', 'contractServiceHead', 'memoContractServiceHead'],
            }).state;
          setPurchaseContext(context);
          setUserSettings(context.settings);
          setData(nextData);
        }
      } catch (err) {
        console.error(err);
      }
    }

    void fetchPurchaseContext();

    return () => {
      active = false;
    };
  }, [purchaseId]);

  const currentPurchase = useMemo(
    () => buildPurchaseAutofillContext(purchaseContext),
    [purchaseContext]
  );
  const autofillContext = useMemo(() => ({
    userSettings,
    currentPurchase,
  }), [currentPurchase, userSettings]);

  const autofillSourceKinds = autofillSource === 'all' ? undefined : [autofillSource];
  const autofillSuggestions = useMemo(() => resolveAutofill('memo', data, autofillContext, {
    includeFilled: true,
    sourceKinds: autofillSourceKinds,
  }), [autofillContext, autofillSourceKinds, data]);
  const fieldAutofillSuggestions = useMemo(() => resolveAutofill('memo', data, autofillContext, {
    includeFilled: true,
  }), [autofillContext, data]);

  const applyAutofillSuggestions = (fieldKeys: string[]) => {
    const result = applyMemoAutofill(data, autofillContext, {
      includeFilled: true,
      overwrite: autofillOverwrite,
      sourceKinds: autofillSourceKinds,
      fieldKeys,
    });
    setData(result.state);
    setDownloadMessage(result.changed.length > 0
      ? `Автозаполнение применено: ${result.changed.length} пол.`
      : 'Нет полей для автозаполнения без перезаписи.');
    setDownloadMessageError(false);
  };

  const pickAutofillSuggestion = (field: keyof ServiceMemoData, suggestion: AutofillSuggestion) => {
    const result = applyMemoAutofill(data, autofillContext, {
      includeFilled: true,
      overwrite: true,
      sourceKinds: [suggestion.sourceKind],
      fieldKeys: [field],
    });
    setData(result.state);
    setDownloadMessage(result.changed.length > 0
      ? `Поле заполнено: ${result.changed[0].label}.`
      : 'Нет данных для подстановки.');
    setDownloadMessageError(false);
  };

  const handleChange = (field: keyof ServiceMemoData, value: string) => {
    setData(prev => {
      const next = { ...prev, [field]: value };
      return field === 'requester' ? syncMemoRequesterInflection(next, userSettings) : next;
    });
  };

  const resetState = () => {
    setData({ ...defaultValues, date: todayIso() });
    setDownloadMessage('');
    setDownloadMessageError(false);
  };

  const saveDocumentState = async (
    successMessage = 'Состояние служебной записки сохранено.',
    failurePrefix = 'Не удалось сохранить состояние служебной записки'
  ) => {
    setDownloadMessage('');
    setDownloadMessageError(false);
    const documentData = normalizeMemoState(syncMemoRequesterInflection(data, userSettings));
    if (!purchaseId) return false;

    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/purchases/${purchaseId}/documents/memo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: documentData })
      });
      if (!res.ok) {
        setDownloadMessage(`${failurePrefix}: ${await readApiError(res)}`);
        setDownloadMessageError(true);
        return false;
      }

      setPurchaseContext(prev => prev ? { ...prev, documents: { ...prev.documents, memo: documentData } } : prev);
      setDownloadMessage(successMessage);
      setDownloadMessageError(false);
      return true;
    } catch (error) {
      console.error("Failed to save purchase document", error);
      setDownloadMessage(`${failurePrefix}: ошибка сети.`);
      setDownloadMessageError(true);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setDownloadMessage('');
    setDownloadMessageError(false);
    const documentData = normalizeMemoState(syncMemoRequesterInflection(data, userSettings));

    try {
      await DOCUMENT_REGISTRY.memo.generate(documentData);
      await saveDocumentState(
        'Документ скачан, состояние закупки сохранено.',
        'Документ скачан, но состояние закупки не сохранено'
      );
    } catch (error) {
      console.error("Failed to generate service memo docx", error);
      setDownloadMessage('Не удалось сформировать служебную записку. Проверьте данные и попробуйте ещё раз.');
      setDownloadMessageError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const labelClass = "text-[9px] uppercase opacity-60 mb-1 font-bold";
  const fieldClass = "bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors";
  const textareaClass = "w-full bg-transparent border border-[#141414] px-2 py-1.5 text-xs focus:outline-none focus:bg-white resize-none";
  const normalizedData = useMemo(
    () => normalizeMemoState(syncMemoRequesterInflection(data, userSettings)),
    [data, userSettings]
  );
  const canGenerate = Boolean(
    normalizedData.purpose &&
    normalizedData.subjectIntro &&
    normalizedData.requester &&
    normalizedData.contractServiceHead &&
    normalizedData.date
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-[#141414] shrink-0 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Служебная записка на закупку</h1>
        </div>
        <div className="flex gap-3 items-center shrink-0 flex-wrap justify-end">
          <AppNav />
          <a href="/cabinet" className="btn-brutal bg-white flex items-center gap-2 hover:bg-gray-100 text-sm font-bold">
            <User className="w-4 h-4" /> Личный кабинет
          </a>
          <button onClick={resetState} className="btn-brutal bg-white border border-[#141414] flex items-center gap-2 hover:bg-yellow-100 text-sm font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> Сбросить
          </button>
          <button
            type="button"
            onClick={() => void saveDocumentState()}
            disabled={isSaving}
            className="btn-brutal bg-white border border-[#141414] flex items-center gap-2 hover:bg-green-50 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" /> {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className="border border-[#141414] bg-[#141414] text-white px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 hover:bg-white hover:text-[#141414] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'Создание...' : 'Сгенерировать DOCX'}
          </button>
        </div>
      </header>

      {downloadMessage && (
        <div className={`mb-4 border border-[#141414] bg-white px-4 py-3 text-sm ${downloadMessageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
          {downloadMessage}
        </div>
      )}

      <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-grow overflow-hidden">
        <aside className="col-span-1 xl:col-span-4 flex flex-col gap-6 overflow-hidden scroll-area pr-2">
          <AutofillPanel
            title="Автозаполнение"
            description="Проверьте предложения и перенесите данные НМЦК или профиля в служебку."
            sourceOptions={[
              { value: 'all', label: 'Все доступные источники' },
              { value: 'currentPurchase', label: 'Текущая НМЦК' },
              { value: 'userSettings', label: 'Профиль пользователя' },
              { value: 'currentDate', label: 'Текущая дата' },
            ]}
            selectedSource={autofillSource}
            onSourceChange={setAutofillSource}
            suggestions={autofillSuggestions}
            overwrite={autofillOverwrite}
            onOverwriteChange={setAutofillOverwrite}
            onApply={applyAutofillSuggestions}
            contextNote={`НМЦК: ${describeCurrentPurchase(currentPurchase)}`}
          />

          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4">Шапка документа</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className={labelClass}>Адресат</label>
                <AutofillSuggestField
                  fieldKey="addressee"
                  className={fieldClass}
                  value={data.addressee}
                  onChange={value => handleChange('addressee', value)}
                  suggestions={suggestionsForField(fieldAutofillSuggestions, 'addressee')}
                  onPick={suggestion => pickAutofillSuggestion('addressee', suggestion)}
                  placeholder={DEFAULT_MEMO_ADDRESSEE}
                />
                <p className="text-[10px] opacity-40 mt-1">Первая строка шапки. Можно заменить, например на «Директору».</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>ФИО руководителя контрактной службы</label>
                <AutofillSuggestField
                  fieldKey="contractServiceHead"
                  multiline
                  rows={3}
                  className={textareaClass}
                  value={data.contractServiceHead}
                  onChange={value => handleChange('contractServiceHead', value)}
                  suggestions={suggestionsForField(fieldAutofillSuggestions, 'contractServiceHead')}
                  onPick={suggestion => pickAutofillSuggestion('contractServiceHead', suggestion)}
                  placeholder="Петров Петр Петрович"
                />
                <p className="text-[10px] opacity-40 mt-1">Предлагается из профиля и подставляется только по кнопке автозаполнения.</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Составитель запроса</label>
                <AutofillSuggestField
                  fieldKey="requester"
                  multiline
                  rows={3}
                  className={textareaClass}
                  value={data.requester}
                  onChange={value => handleChange('requester', value)}
                  suggestions={suggestionsForField(fieldAutofillSuggestions, 'requester')}
                  onPick={suggestion => pickAutofillSuggestion('requester', suggestion)}
                  placeholder="Должность, ФИО"
                />
                <p className="text-[10px] opacity-40 mt-1">В шапке — родительный падеж, в подписи — именительный.</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Дата</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={data.date}
                  onChange={e => handleChange('date', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse"></span> Цель закупки
            </h2>
            <AutofillSuggestField
              fieldKey="purpose"
              multiline
              rows={6}
              className={textareaClass}
              value={data.purpose}
              onChange={value => handleChange('purpose', value)}
              suggestions={suggestionsForField(fieldAutofillSuggestions, 'purpose')}
              onPick={suggestion => pickAutofillSuggestion('purpose', suggestion)}
              placeholder="Текст после заголовка «Служебная записка»..."
            />
            <p className="text-[10px] opacity-40 mt-2">
              Этот текст вставляется после слов «СЛУЖЕБНАЯ ЗАПИСКА» перед перечнем объектов закупки.
            </p>
          </section>

          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4">Предмет закупки</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className={labelClass}>Предмет закупки (введение)</label>
                <AutofillSuggestField
                  fieldKey="subjectIntro"
                  multiline
                  rows={2}
                  className={`${fieldClass} resize-none`}
                  value={data.subjectIntro}
                  onChange={value => handleChange('subjectIntro', value)}
                  suggestions={suggestionsForField(fieldAutofillSuggestions, 'subjectIntro')}
                  onPick={suggestion => pickAutofillSuggestion('subjectIntro', suggestion)}
                />
                <p className="text-[10px] opacity-40 mt-1">Продолжает абзац цели. При одной позиции предмет можно указать здесь без перечня.</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Предмет закупки (перечень)</label>
                <AutofillSuggestField
                  fieldKey="subjectTable"
                  multiline
                  rows={4}
                  className={textareaClass}
                  value={data.subjectTable}
                  onChange={value => handleChange('subjectTable', value)}
                  suggestions={suggestionsForField(fieldAutofillSuggestions, 'subjectTable')}
                  onPick={suggestion => pickAutofillSuggestion('subjectTable', suggestion)}
                />
                <p className="text-[10px] opacity-40 mt-1">Необязательно. Каждая строка — пункт списка со строчной буквы: «;» между пунктами и «.» в конце.</p>
              </div>
            </div>
          </section>
        </aside>

        <article className="col-span-1 xl:col-span-8 overflow-hidden flex flex-col h-full">
          <div className="flex justify-between items-end mb-2 shrink-0">
            <span className="text-[11px] uppercase font-bold flex items-center gap-2">
              Предварительный просмотр документа
            </span>
            <span className="text-[10px] text-green-700 font-bold uppercase animate-pulse">● Авто-обновление</span>
          </div>
          <div className="scroll-area flex-1 transition-all overflow-auto bg-[#d7d5d0] p-6">
            <ServiceMemoPreview data={normalizedData} />
          </div>
        </article>
      </main>
    </div>
  );
}
