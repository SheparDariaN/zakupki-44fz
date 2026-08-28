import React, { useState, useEffect, useMemo } from 'react';
import { AppState } from '../types';
import { formatMoney, formatMoney4, calculateAverage, calculateStandardDeviation, calculateCV, isCvHeterogeneous } from '../utils/math';
import { METHOD_TEXT } from '../utils/docxGenerator';
import { formatAmountInWords } from '../utils/numberToWords';
import { Trash2, Plus, RefreshCw, Download, User } from 'lucide-react';
import AppNav from './AppNav';
import { apiFetch, readApiError } from '../utils/api';
import { DOCUMENT_REGISTRY } from '../documents/registry';
import { applyNmckAutofill, resolveAutofill, type AutofillUserSettings } from '../documents/autofill';
import type { AutofillSourceKind } from '../documents/templateTypes';
import { formatDateRu } from '../utils/morphology';
import AutofillPanel from './AutofillPanel';
import { saveCurrentPurchase } from '../utils/currentPurchase';
import { normalizeNmckState } from '../documents/templateNormalization';

const initialState: AppState = {
  requisites: {
    customer: '',
    subject: '',
    date: formatDateRu(new Date()),
    executorName: '',
    executorPosition: '',
  },
  suppliers: [
    { id: '1', name: 'Компания 1', kpDetails: 'Вх. № 1' },
    { id: '2', name: 'Компания 2', kpDetails: 'Вх. № 2' },
    { id: '3', name: 'Компания 3', kpDetails: 'Вх. № 3' }
  ],
  positions: [
    { id: '1', name: 'Позиция 1', quantity: 1, unit: 'шт' },
    { id: '2', name: 'Позиция 2', quantity: 1, unit: 'шт' }
  ],
  prices: [
    { positionId: '1', supplierId: '1', price: 0 },
    { positionId: '1', supplierId: '2', price: 0 },
    { positionId: '1', supplierId: '3', price: 0 },
    { positionId: '2', supplierId: '1', price: 0 },
    { positionId: '2', supplierId: '2', price: 0 },
    { positionId: '2', supplierId: '3', price: 0 },
  ]
};

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [userSettings, setUserSettings] = useState<AutofillUserSettings>();
  const [autofillSource, setAutofillSource] = useState<'all' | AutofillSourceKind>('all');
  const [autofillOverwrite, setAutofillOverwrite] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloadMessageError, setDownloadMessageError] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch('/api/user/settings');
        if (res.ok) {
          const settings = await res.json();
          setUserSettings(settings);
          setState(prev => applyNmckAutofill(prev, { userSettings: settings }).state);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    saveCurrentPurchase(state);
  }, [state]);

  const autofillSourceKinds = autofillSource === 'all' ? undefined : [autofillSource];
  const autofillSuggestions = useMemo(() => resolveAutofill('nmck', state, { userSettings }, {
    includeFilled: true,
    sourceKinds: autofillSourceKinds,
  }), [autofillSourceKinds, state, userSettings]);

  const applyAutofillSuggestions = () => {
    const result = applyNmckAutofill(state, { userSettings }, {
      includeFilled: true,
      overwrite: autofillOverwrite,
      sourceKinds: autofillSourceKinds,
    });
    setState(result.state);
    setDownloadMessage(result.changed.length > 0
      ? `Автозаполнение применено: ${result.changed.length} пол.`
      : 'Нет полей для автозаполнения без перезаписи.');
    setDownloadMessageError(false);
  };

  const resetState = () => {
    // preserve settings when resetting
    const currentCustomer = state.requisites.customer;
    const currentPos = state.requisites.executorPosition;
    const currentName = state.requisites.executorName;
    setState({
      ...initialState,
      requisites: {
        ...initialState.requisites,
        customer: currentCustomer,
        executorPosition: currentPos,
        executorName: currentName
      }
    });
  };

  const addSupplier = () => {
    setState(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, { id: Date.now().toString(), name: 'Новый поставщик', kpDetails: 'Вх. № ...' }]
    }));
  };

  const removeSupplier = (id: string) => {
    setState(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter(s => s.id !== id),
      prices: prev.prices.filter(p => p.supplierId !== id)
    }));
  };

  const addPosition = () => {
    setState(prev => ({
      ...prev,
      positions: [...prev.positions, { id: Date.now().toString(), name: 'Новая позиция', quantity: 1, unit: 'штука' }]
    }));
  };

  const removePosition = (id: string) => {
    setState(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.id !== id),
      prices: prev.prices.filter(p => p.positionId !== id)
    }));
  };

  const handlePriceChange = (positionId: string, supplierId: string, value: string) => {
    const price = parseFloat(value) || 0;
    setState(prev => {
      const existing = prev.prices.find(p => p.positionId === positionId && p.supplierId === supplierId);
      if (existing) {
        return {
          ...prev,
          prices: prev.prices.map(p => p === existing ? { ...p, price } : p)
        };
      }
      return {
        ...prev,
        prices: [...prev.prices, { positionId, supplierId, price }]
      };
    });
  };

  const handleDocxDownload = async () => {
    setDownloadMessage('');
    const documentState = normalizeNmckState(state);
    try {
      await DOCUMENT_REGISTRY.nmck.generate(documentState);
    } catch (e) {
      console.error(e);
      setDownloadMessage('Не удалось сформировать DOCX. Проверьте данные и попробуйте ещё раз.');
      setDownloadMessageError(true);
      return;
    }

    try {
      const res = await apiFetch('/api/user/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: DOCUMENT_REGISTRY.nmck.getHistoryName(documentState),
          state: documentState,
          type: DOCUMENT_REGISTRY.nmck.kind
        })
      });
      if (!res.ok) {
        setDownloadMessage(`DOCX скачан, но история не сохранена: ${await readApiError(res)}`);
        setDownloadMessageError(true);
      }
    } catch (e) {
      console.error("Failed to save document history", e);
      setDownloadMessage('DOCX скачан, но история не сохранена: ошибка сети.');
      setDownloadMessageError(true);
    }
  };

  const inputClass = "w-full h-full bg-transparent border border-transparent hover:bg-black/5 focus:bg-white focus:border-black outline-none px-2 py-1.5 text-[11px] transition-all duration-200 cursor-text rounded-sm";
  const labelClass = "text-[9px] uppercase opacity-60 mb-1 font-bold";

  return (
    <div className="flex flex-col h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden p-6">
      
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-[#141414] shrink-0 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Система Обоснования НМЦК</h1>
        </div>
        <div className="flex gap-3 items-center shrink-0 flex-wrap justify-end">
          <AppNav />
          <a href="/profile" className="btn-brutal bg-white flex items-center gap-2 hover:bg-gray-100 text-sm font-bold">
            <User className="w-4 h-4" /> Личный кабинет
          </a>
          <button onClick={resetState} className="btn-brutal bg-white border border-[#141414] flex items-center gap-2 hover:bg-yellow-100 text-sm font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> Сбросить
          </button>
          <button onClick={handleDocxDownload} className="border border-[#141414] bg-[#141414] text-white px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 hover:bg-white hover:text-[#141414] transition-colors cursor-pointer">
            <Download className="w-4 h-4" /> Сгенерировать DOCX
          </button>
        </div>
      </header>

      {downloadMessage && (
        <div className={`mb-4 border border-[#141414] bg-white px-4 py-3 text-sm ${downloadMessageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
          {downloadMessage}
        </div>
      )}

      <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-grow overflow-hidden">
        
        {/* LEFT COLUMN: FORMS */}
        <aside className="col-span-1 xl:col-span-4 flex flex-col gap-6 overflow-hidden scroll-area pr-2">
          <AutofillPanel
            title="Автозаполнение"
            description="Проверьте предложения перед подстановкой в реквизиты НМЦК."
            sourceOptions={[
              { value: 'all', label: 'Все доступные источники' },
              { value: 'userSettings', label: 'Профиль пользователя' },
              { value: 'currentDate', label: 'Текущая дата' },
            ]}
            selectedSource={autofillSource}
            onSourceChange={setAutofillSource}
            suggestions={autofillSuggestions}
            overwrite={autofillOverwrite}
            onOverwriteChange={setAutofillOverwrite}
            onApply={applyAutofillSuggestions}
            contextNote="Эта НМЦК автоматически доступна для переноса в запрос КП и служебку."
          />
          
          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse"></span> Реквизиты Закупки
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className={labelClass}>Заказчик</label>
                <input type="text" className="bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors"
                  value={state.requisites.customer} onChange={e => setState({ ...state, requisites: { ...state.requisites, customer: e.target.value } })} />
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Дата составления</label>
                <input type="text" className="bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors"
                  value={state.requisites.date} onChange={e => setState({ ...state, requisites: { ...state.requisites, date: e.target.value } })} />
              </div>
              <div className="flex flex-col col-span-2">
                <label className={labelClass}>Объект закупки</label>
                <input type="text" className="bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors"
                  value={state.requisites.subject} onChange={e => setState({ ...state, requisites: { ...state.requisites, subject: e.target.value } })} />
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Должность подписанта (Лев)</label>
                <input type="text" className="bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors"
                  value={state.requisites.executorPosition} onChange={e => setState({ ...state, requisites: { ...state.requisites, executorPosition: e.target.value } })} />
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>ФИО подписанта (Прав)</label>
                <input type="text" className="bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors"
                  value={state.requisites.executorName} onChange={e => setState({ ...state, requisites: { ...state.requisites, executorName: e.target.value } })} />
              </div>
            </div>
          </section>

          <section className="flex flex-col border border-[#141414] bg-white/40 shrink-0 shadow-sm transition-all hover:bg-white/60">
            <div className="p-3 border-b border-[#141414] flex justify-between items-center shrink-0 bg-black/5">
              <h2 className="text-[11px] uppercase font-bold">Источники (КП)</h2>
              <button onClick={addSupplier} className="text-[10px] font-bold flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full data-grid border-none">
                <thead>
                  <tr>
                    <th className="col-header text-left">Название</th>
                    <th className="col-header text-left">Вх. № / Дата</th>
                    <th className="col-header w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {state.suppliers.map((supplier) => (
                    <tr key={supplier.id} className="group hover:bg-black/5 transition-colors">
                      <td className="p-0"><input type="text" className={inputClass} value={supplier.name} onChange={e => setState({ ...state, suppliers: state.suppliers.map(s => s.id === supplier.id ? { ...s, name: e.target.value } : s) })} /></td>
                      <td className="mono p-0"><input type="text" className={inputClass} value={supplier.kpDetails} onChange={e => setState({ ...state, suppliers: state.suppliers.map(s => s.id === supplier.id ? { ...s, kpDetails: e.target.value } : s) })} /></td>
                      <td className="text-center p-0 align-middle">
                        <button onClick={() => removeSupplier(supplier.id)} className="text-black/30 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100 mx-auto" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col border border-[#141414] bg-white/40 shrink-0 shadow-sm transition-all hover:bg-white/60">
            <div className="p-3 border-b border-[#141414] flex justify-between items-center shrink-0 bg-black/5">
              <h2 className="text-[11px] uppercase font-bold">Позиции закупки</h2>
              <button onClick={addPosition} className="text-[10px] font-bold flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full data-grid border-none">
                <thead>
                  <tr>
                    <th className="col-header text-left">Наименование</th>
                    <th className="col-header text-left w-24">ЕИ</th>
                    <th className="col-header text-right w-24">Кол-во</th>
                    <th className="col-header w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {state.positions.map((position) => (
                    <tr key={position.id} className="group hover:bg-black/5 transition-colors">
                      <td className="p-0"><textarea rows={2} className={`${inputClass} resize-none min-h-[40px]`} value={position.name} onChange={e => setState({ ...state, positions: state.positions.map(p => p.id === position.id ? { ...p, name: e.target.value } : p) })} /></td>
                      <td className="p-0"><input type="text" className={inputClass} value={position.unit} onChange={e => setState({ ...state, positions: state.positions.map(p => p.id === position.id ? { ...p, unit: e.target.value } : p) })} /></td>
                      <td className="mono p-0 text-right"><input type="number" min="1" className={`${inputClass} text-right`} value={position.quantity} onChange={e => setState({ ...state, positions: state.positions.map(p => p.id === position.id ? { ...p, quantity: parseInt(e.target.value) || 1 } : p) })} /></td>
                      <td className="text-center p-0 align-middle">
                        <button onClick={() => removePosition(position.id)} className="text-black/30 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100 mx-auto" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border border-[#141414] bg-white/50 flex flex-col shrink-0 shadow-sm">
            <div className="p-3 border-b border-[#141414] shrink-0 bg-[#141414] text-[#E4E3E0]">
              <h2 className="text-[11px] uppercase font-bold tracking-widest">Цены поставщиков (входные руб.)</h2>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full data-grid border-none whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="col-header text-left min-w-[120px]">Позиция</th>
                    {state.suppliers.map(s => (
                      <th key={s.id} className="col-header text-right min-w-[80px]" title={s.name}>{s.name.substring(0,15)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.positions.map(pos => (
                    <tr key={pos.id} className="hover:bg-black/5 transition-colors">
                      <td className="text-[11px] whitespace-normal break-words min-w-[120px] max-w-[200px] font-medium" title={pos.name}>{pos.name}</td>
                      {state.suppliers.map(sup => {
                        const val = state.prices.find(p => p.positionId === pos.id && p.supplierId === sup.id)?.price || '';
                        return (
                          <td key={sup.id} className="mono p-0 text-right">
                            <input 
                              type="number" 
                              placeholder="0.00"
                              className="w-full h-full bg-transparent border border-transparent hover:bg-blue-50 focus:bg-white focus:border-blue-500 outline-none px-2 py-2 text-right text-[11px] transition-all cursor-text"
                              value={val}
                              onChange={(e) => handlePriceChange(pos.id, sup.id, e.target.value)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </aside>

        {/* RIGHT COLUMN: PREVIEW */}
        <article className="col-span-1 xl:col-span-8 overflow-hidden flex flex-col h-full">
          <div className="flex justify-between items-end mb-2 shrink-0">
            <span className="text-[11px] uppercase font-bold flex items-center gap-2">
              Предварительный просмотр документа
            </span>
            <span className="text-[10px] text-green-700 font-bold uppercase animate-pulse">● Авто-обновление</span>
          </div>
          <div className="scroll-area flex-1 transition-all overflow-auto bg-[#d7d5d0] p-6">
            <PreviewContent state={state} />
          </div>
        </article>

      </main>

    </div>
  );
}

function PreviewContent({ state }: { state: AppState }) {
  const normalizedState = useMemo(() => normalizeNmckState(state), [state]);
  const { requisites, suppliers, positions, prices } = normalizedState;
  let grandTotal = 0;
  let hasHeterogeneousCv = false;

  // Calculate minimum total among all suppliers
  const supplierTotals = suppliers.map(sup => {
    let supTotal = 0;
    positions.forEach(pos => {
      const entry = prices.find(p => p.positionId === pos.id && p.supplierId === sup.id);
      const rawPrice = entry?.price || 0;
      supTotal += rawPrice * pos.quantity;
    });
    return supTotal;
  });
  const minSupplierTotal = Math.min(...supplierTotals) || 0;

  return (
    <div className="animate-in fade-in duration-300 box-border w-[297mm] min-w-[297mm] min-h-[210mm] mx-auto bg-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] p-[10mm] text-[10pt] font-serif leading-tight">
      <div className="text-center mb-0">
        <h3 className="text-[10pt] font-bold">Обоснование начальной (максимальной) цены</h3>
        <p className="mt-1 text-[9pt]">{requisites.subject}</p>
      </div>
      
      <br/>
      <br/>

      <table className="w-full table-fixed border-collapse border border-black mb-0">
        <colgroup>
          <col className="w-[3.5cm]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td className="w-[3.5cm] border border-black p-1 text-center">Характеристики<br/>объекта закупки</td>
            <td className="border border-black p-1">
              {requisites.subject}
            </td>
          </tr>
          <tr>
            <td className="w-[3.5cm] border border-black p-1 text-center">Используемый метод<br/>определения НМЦ<br/>с обоснованием:</td>
            <td className="border border-black p-1 text-justify">
              {METHOD_TEXT}
            </td>
          </tr>
        </tbody>
      </table>
      
      <table className="w-full table-fixed border-collapse border border-black mb-4 -mt-px">
        <colgroup>
          <col className="w-[1cm]" />
          <col />
          <col className="w-[1.5cm]" />
          <col className="w-[1.5cm]" />
          {suppliers.map((supplier) => (
            <col key={supplier.id} />
          ))}
          <col />
          <col />
          <col />
          <col className="w-[2.6cm]" />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={4 + suppliers.length + 4} className="border border-black p-1 text-center">РАСЧЕТ НМЦК</td>
          </tr>
          
          <tr className="text-center bg-gray-50/30">
            <td className="border border-black p-1 w-[1cm]">№</td>
            <td className="border border-black p-1">Наименование<br/>товара, услуги<br/>(работы)</td>
            <td className="border border-black p-1 w-[1.5cm]">ЕИ</td>
            <td className="border border-black p-1 w-[1.5cm]">Кол-во</td>
            {suppliers.map(s => (
              <td key={s.id} className="border border-black p-1 text-xs whitespace-nowrap">
                Цена единицы товара<br/>(работ, услуг)<br/>{s.kpDetails}
              </td>
            ))}
            <td className="border border-black p-1 text-xs whitespace-nowrap">Средняя цена единицы<br/>товара (работ, услуг),<br/>(руб.)</td>
            <td className="border border-black p-1 text-xs whitespace-nowrap">Среднее<br/>квадратичное<br/>отклонение</td>
            <td className="border border-black p-1 text-xs whitespace-nowrap">Коэффициент<br/>вариации,<br/>(%)</td>
            <td className="border border-black p-1 w-[2.6cm] text-xs">НМЦК (руб.)</td>
          </tr>

          {positions.map((pos, index) => {
            const posPrices: number[] = [];
            
            const supplierCells = suppliers.map((sup) => {
              const entry = prices.find(p => p.positionId === pos.id && p.supplierId === sup.id);
              const rawPrice = entry?.price || 0;
              if (rawPrice > 0) posPrices.push(rawPrice);
              return (
                <td key={sup.id} className="border border-black p-1 text-center font-mono text-[9pt]">
                  {formatMoney(rawPrice)}
                </td>
              );
            });

            const average = calculateAverage(posPrices);
            const stdDev = calculateStandardDeviation(posPrices, average);
            const cv = calculateCV(posPrices);
            const posTotal = average * pos.quantity;
            grandTotal += posTotal;
            const heterogeneous = isCvHeterogeneous(cv);
            if (heterogeneous) hasHeterogeneousCv = true;

            return (
              <tr key={pos.id}>
                <td className="border border-black p-1 text-center w-[1cm]">{index + 1}</td>
                <td className="border border-black p-1 text-xs leading-tight">{pos.name}</td>
                <td className="border border-black p-1 text-center w-[1.5cm] whitespace-nowrap">{pos.unit}</td>
                <td className="border border-black p-1 text-center font-mono w-[1.5cm] whitespace-nowrap">{pos.quantity}</td>
                {supplierCells}
                <td className="border border-black p-1 text-center font-mono text-[9pt] whitespace-nowrap">{formatMoney(average)}</td>
                <td className="border border-black p-1 text-center font-mono text-[9pt] whitespace-nowrap">{formatMoney4(stdDev)}</td>
                <td
                  className={`border border-black p-1 text-center font-mono text-[9pt] whitespace-nowrap${heterogeneous ? ' bg-black text-white font-bold' : ''}`}
                  title={heterogeneous ? 'Коэффициент вариации превышает 33% — выборка неоднородна (Приказ МЭР № 567)' : undefined}
                >
                  {formatMoney(cv)}%
                </td>
                <td className="border border-black p-1 text-center font-mono text-[9pt] w-[2.6cm] font-bold">{formatMoney(posTotal)}</td>
              </tr>
            );
          })}

          <tr>
            <td colSpan={3 + suppliers.length + 4} className="border border-black p-1 text-right pr-2">Итого:</td>
            <td className="border border-black p-1 text-center font-bold font-mono text-[12pt] w-[2.6cm]">{formatMoney(grandTotal)}</td>
          </tr>
          <tr>
            <td colSpan={4 + suppliers.length + 4} className="border border-black p-1 text-center text-[10pt]">
              На основании проведенного анализа рынка и расчетов Заказчик принимает решение о минимальном значении цены за единицу, в соответствии с выделенными лимитами бюджетных обязательств. НМЦК составляет: <span className="font-bold text-[14pt]">{formatMoney(minSupplierTotal)}</span> рублей ({formatAmountInWords(minSupplierTotal)}).
            </td>
          </tr>
        </tbody>
      </table>

      {hasHeterogeneousCv && (
        <p className="text-[9pt] mt-2">
          Коэффициент вариации превышает 33% — выборка цен признаётся неоднородной (Методические рекомендации, утверждённые Приказом МЭР № 567).
        </p>
      )}

      <p className="text-[10pt] mt-4">
        Цена Контракта включает в себя стоимость оказываемых Услуг, а также налоги и сборы, установленные действующим законодательством Российской Федерации.
      </p>

      <div className="mt-10">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[4.5cm]" />
            <col />
            <col className="w-[4.5cm]" />
          </colgroup>
          <tbody>
            <tr>
              <td className="w-[4.5cm] max-w-[4.5cm] border-b border-black text-center align-bottom p-0 pb-0.5 text-[10pt]">
                {requisites.executorPosition}
              </td>
              <td className="border-0 p-0" aria-hidden="true" />
              <td className="w-[4.5cm] max-w-[4.5cm] border-b border-black text-center align-bottom p-0 pb-0.5 text-[10pt]">
                {requisites.executorName}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
