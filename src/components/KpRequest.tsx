import React, { useEffect, useMemo, useState } from 'react';
import { Counterparty, KpDocxData } from '../types';
import { generateKpDocx } from '../utils/kpDocxGenerator';
import KpDocumentPreview from './KpDocumentPreview';
import AppNav from './AppNav';
import { Trash2, Plus, RefreshCw, Download, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch, readApiError } from '../utils/api';

const defaultValues: KpDocxData = {
  vendorInfos: [
    `ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "СОФТМОЛЛ"

630005, Новосибирская область, г. Новосибирск, 
ул. Достоевского, зд. 58, офис 404

info@softmall.ru`
  ],
  subjectIntro: `оказание услуг по предоставлению сертификата технической поддержки «Astra Linux Special Edition»`,
  subjectTable: `Оказание услуг по предоставлению сертификата технической поддержки «Astra Linux Special Edition»`,
  serviceConditions: [
    `Срок оказания услуг: с 01.08.2026 г. по 31.01.2027 г.`,
    `Услуги включают:обновление программного обеспечения, а также консультации по использованию программы для ЭВМ на операционную систему специального назначения «Astra Linux Special Edition» для 64-х разрядной платформы на базе процессорной архитектуры х86-64, уровень защищенности  «Усиленный» ("Воронеж"), РУСБ.10015-01 (ФСТЭК), и вариант лицензирования «Орел», РУСБ.10015-10, без ограничения по количеству установок, для рабочей станции, тип "Стандарт", на 7 мес.`
  ],
  purchasePeriod: `с 01.09.2026 г. по 30.09.2026 г.`,
  submissionDeadline: `До 17.08.2026 г.`,
  submissionEmail: `e-mail: citko@ako.ru`,
  contactPerson: `Богданов Валентин Олегович, т. 8-384-244-26-28`
};

function formatCounterpartyVendorInfo(counterparty: Counterparty): string {
  return [
    counterparty.companyName,
    counterparty.director,
    counterparty.legalAddress,
    counterparty.email,
  ].map((value) => value.trim()).filter(Boolean).join('\n\n');
}

export default function KpRequest() {
  const [data, setData] = useState<KpDocxData>(defaultValues);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloadMessageError, setDownloadMessageError] = useState(false);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState('');
  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [selectedCounterpartyTag, setSelectedCounterpartyTag] = useState('');
  const [counterpartiesLoading, setCounterpartiesLoading] = useState(true);
  const [counterpartiesError, setCounterpartiesError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchCounterparties() {
      setCounterpartiesLoading(true);
      setCounterpartiesError('');

      try {
        const res = await apiFetch('/api/counterparties');
        if (!active) return;

        if (res.ok) {
          const data: Counterparty[] = await res.json();
          setCounterparties(data);
          setSelectedCounterpartyId((current) => current || (data[0] ? String(data[0].id) : ''));
        } else {
          setCounterpartiesError(await readApiError(res, 'Не удалось загрузить справочник контрагентов.'));
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setCounterpartiesError('Не удалось загрузить справочник контрагентов: ошибка сети.');
        }
      } finally {
        if (active) {
          setCounterpartiesLoading(false);
        }
      }
    }

    void fetchCounterparties();

    return () => {
      active = false;
    };
  }, []);

  const availableCounterpartyTags = useMemo(() => {
    const tags = new Set<string>();
    counterparties.forEach((counterparty) => {
      counterparty.tags.forEach((tag) => {
        const trimmedTag = tag.trim();
        if (trimmedTag) {
          tags.add(trimmedTag);
        }
      });
    });

    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [counterparties]);

  const filteredCounterparties = useMemo(() => {
    const normalizedSearch = counterpartySearch.trim().toLowerCase();

    return counterparties.filter((counterparty) => {
      const matchesSearch = !normalizedSearch
        || counterparty.companyName.toLowerCase().includes(normalizedSearch)
        || counterparty.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      const matchesTag = !selectedCounterpartyTag
        || counterparty.tags.includes(selectedCounterpartyTag);

      return matchesSearch && matchesTag;
    });
  }, [counterparties, counterpartySearch, selectedCounterpartyTag]);

  useEffect(() => {
    if (filteredCounterparties.length === 0) {
      setSelectedCounterpartyId('');
      return;
    }

    const selectedIsVisible = filteredCounterparties.some(
      (counterparty) => String(counterparty.id) === selectedCounterpartyId
    );
    if (!selectedIsVisible) {
      setSelectedCounterpartyId(String(filteredCounterparties[0].id));
    }
  }, [filteredCounterparties, selectedCounterpartyId]);

  const handleChange = (field: keyof KpDocxData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleVendorChange = (index: number, value: string) => {
    const newVendors = [...data.vendorInfos];
    newVendors[index] = value;
    setData(prev => ({ ...prev, vendorInfos: newVendors }));
  };

  const addVendor = () => {
    setData(prev => ({ ...prev, vendorInfos: [...prev.vendorInfos, ''] }));
    setPreviewIndex(data.vendorInfos.length);
  };

  const getSelectedCounterparty = () => (
    counterparties.find((counterparty) => String(counterparty.id) === selectedCounterpartyId)
  );

  const addSelectedCounterparty = () => {
    const selectedCounterparty = getSelectedCounterparty();
    if (!selectedCounterparty) return;

    const vendorInfo = formatCounterpartyVendorInfo(selectedCounterparty);
    const emptyIndex = data.vendorInfos.findIndex((vendor) => !vendor.trim());

    if (emptyIndex >= 0) {
      handleVendorChange(emptyIndex, vendorInfo);
      setPreviewIndex(emptyIndex);
      return;
    }

    setData(prev => ({ ...prev, vendorInfos: [...prev.vendorInfos, vendorInfo] }));
    setPreviewIndex(data.vendorInfos.length);
  };

  const replaceCurrentVendorWithCounterparty = () => {
    const selectedCounterparty = getSelectedCounterparty();
    if (!selectedCounterparty) return;

    const vendorInfo = formatCounterpartyVendorInfo(selectedCounterparty);
    const currentIndex = Math.min(previewIndex, data.vendorInfos.length - 1);
    handleVendorChange(currentIndex, vendorInfo);
  };

  const removeVendor = (index: number) => {
    const newVendors = data.vendorInfos.filter((_, i) => i !== index);
    setData(prev => ({ ...prev, vendorInfos: newVendors }));
    if (previewIndex >= newVendors.length) {
      setPreviewIndex(Math.max(0, newVendors.length - 1));
    }
  };

  const handleConditionChange = (index: number, value: string) => {
    const newConditions = [...data.serviceConditions];
    newConditions[index] = value;
    setData(prev => ({ ...prev, serviceConditions: newConditions }));
  };

  const addCondition = () => {
    setData(prev => ({ ...prev, serviceConditions: [...prev.serviceConditions, ''] }));
  };

  const removeCondition = (index: number) => {
    setData(prev => ({
      ...prev,
      serviceConditions: prev.serviceConditions.filter((_, i) => i !== index)
    }));
  };

  const resetState = () => {
    setData(defaultValues);
    setPreviewIndex(0);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setDownloadMessage('');
    try {
      await generateKpDocx(data);

      try {
        const firstVendor = data.vendorInfos.find(v => v.trim()) || '';
        const name = data.subjectTable || data.subjectIntro || 'Запрос КП';
        const res = await apiFetch('/api/user/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: firstVendor ? `Запрос КП: ${name}` : name,
            state: data,
            type: 'kp'
          })
        });
        if (!res.ok) {
          setDownloadMessage(`Документ скачан, но история не сохранена: ${await readApiError(res)}`);
          setDownloadMessageError(true);
        }
      } catch (e) {
        console.error("Failed to save document history", e);
        setDownloadMessage('Документ скачан, но история не сохранена: ошибка сети.');
        setDownloadMessageError(true);
      }
    } catch (error) {
      console.error("Failed to generate docx", error);
      setDownloadMessage('Не удалось сформировать документ. Проверьте данные и попробуйте ещё раз.');
      setDownloadMessageError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const labelClass = "text-[9px] uppercase opacity-60 mb-1 font-bold";
  const fieldClass = "bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors";
  const textareaClass = "w-full bg-transparent border border-[#141414] px-2 py-1.5 text-xs focus:outline-none focus:bg-white resize-none";
  const vendorCount = data.vendorInfos.filter(v => v.trim()).length;
  const canUseSelectedCounterparty = Boolean(getSelectedCounterparty());

  return (
    <div className="flex flex-col h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden p-6">

      <header className="flex justify-between items-center mb-6 pb-4 border-b border-[#141414] shrink-0 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Запрос коммерческих предложений</h1>
        </div>
        <div className="flex gap-3 items-center shrink-0 flex-wrap justify-end">
          <AppNav />
          <a href="/profile" className="btn-brutal bg-white flex items-center gap-2 hover:bg-gray-100 text-sm font-bold">
            <User className="w-4 h-4" /> Личный кабинет
          </a>
          <button onClick={resetState} className="btn-brutal bg-white border border-[#141414] flex items-center gap-2 hover:bg-yellow-100 text-sm font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> Сбросить
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || vendorCount === 0}
            className="border border-[#141414] bg-[#141414] text-white px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 hover:bg-white hover:text-[#141414] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isGenerating
              ? 'Создание...'
              : vendorCount > 1
                ? `Скачать ZIP (${vendorCount})`
                : 'Сгенерировать DOCX'}
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

          <section className="flex flex-col border border-[#141414] bg-white/40 shrink-0 shadow-sm transition-all hover:bg-white/60">
            <div className="p-3 border-b border-[#141414] flex justify-between items-center shrink-0 bg-black/5">
              <h2 className="text-[11px] uppercase font-bold">Исполнители (Кому)</h2>
              <button onClick={addVendor} className="text-[10px] font-bold flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div className="border border-[#141414]/30 bg-white/70 p-3 flex flex-col gap-2">
                <label className={labelClass}>Выбор из справочника</label>
                <input
                  type="text"
                  value={counterpartySearch}
                  onChange={(e) => setCounterpartySearch(e.target.value)}
                  placeholder="Поиск по названию или тегу..."
                  disabled={counterpartiesLoading || counterparties.length === 0}
                  className="w-full border border-[#141414] bg-white px-2 py-1.5 text-xs focus:outline-none disabled:opacity-50"
                />
                {availableCounterpartyTags.length > 0 && (
                  <select
                    value={selectedCounterpartyTag}
                    onChange={(e) => setSelectedCounterpartyTag(e.target.value)}
                    disabled={counterpartiesLoading}
                    className="w-full border border-[#141414] bg-white px-2 py-1.5 text-xs focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Все теги</option>
                    {availableCounterpartyTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={selectedCounterpartyId}
                  onChange={(e) => setSelectedCounterpartyId(e.target.value)}
                  disabled={counterpartiesLoading || filteredCounterparties.length === 0}
                  className="w-full border border-[#141414] bg-white px-2 py-1.5 text-xs focus:outline-none disabled:opacity-50"
                >
                  {filteredCounterparties.length === 0 && (
                    <option value="">
                      {counterpartiesLoading
                        ? 'Загрузка контрагентов...'
                        : counterparties.length === 0
                          ? 'Справочник пуст'
                          : 'Ничего не найдено'}
                    </option>
                  )}
                  {filteredCounterparties.map((counterparty) => (
                    <option key={counterparty.id} value={counterparty.id}>
                      {counterparty.tags.length > 0
                        ? `${counterparty.companyName} (${counterparty.tags.join(', ')})`
                        : counterparty.companyName}
                    </option>
                  ))}
                </select>
                {(counterpartySearch || selectedCounterpartyTag) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCounterpartySearch('');
                      setSelectedCounterpartyTag('');
                    }}
                    className="self-start text-[10px] font-bold uppercase hover:text-blue-700"
                  >
                    Сбросить фильтр
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={addSelectedCounterparty}
                    disabled={!canUseSelectedCounterparty}
                    className="border border-[#141414] bg-white px-2 py-1.5 text-[10px] font-bold uppercase hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    onClick={replaceCurrentVendorWithCounterparty}
                    disabled={!canUseSelectedCounterparty}
                    className="border border-[#141414] bg-white px-2 py-1.5 text-[10px] font-bold uppercase hover:bg-yellow-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Заменить текущего
                  </button>
                </div>
                {counterpartiesError && (
                  <p className="text-[10px] text-red-700">{counterpartiesError}</p>
                )}
                {!counterpartiesLoading && counterparties.length === 0 && !counterpartiesError && (
                  <p className="text-[10px] opacity-60">Добавьте контрагентов в справочнике, чтобы подставлять их в запрос КП.</p>
                )}
              </div>
              {data.vendorInfos.map((vendor, index) => (
                <div key={index} className="relative group">
                  <div className="text-[9px] uppercase font-bold opacity-50 mb-1">#{index + 1}</div>
                  <textarea
                    value={vendor}
                    onChange={(e) => handleVendorChange(index, e.target.value)}
                    rows={4}
                    className={textareaClass}
                    placeholder="Наименование, адрес, email..."
                  />
                  {data.vendorInfos.length > 1 && (
                    <button
                      onClick={() => removeVendor(index)}
                      className="absolute top-5 right-2 text-black/30 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                      title="Удалить исполнителя"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {vendorCount > 1 && (
                <p className="text-[10px] opacity-60">Будет скачан ZIP-архив с {vendorCount} документами.</p>
              )}
            </div>
          </section>

          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse"></span> Предмет закупки
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className={labelClass}>Предмет закупки (введение)</label>
                <textarea
                  rows={2}
                  className={`${fieldClass} resize-none`}
                  value={data.subjectIntro}
                  onChange={e => handleChange('subjectIntro', e.target.value)}
                />
                <p className="text-[10px] opacity-40 mt-1">Продолжение фразы: «...планирует осуществить закупку на»</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Предмет закупки (в таблице)</label>
                <textarea
                  rows={2}
                  className={`${fieldClass} resize-none`}
                  value={data.subjectTable}
                  onChange={e => handleChange('subjectTable', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col border border-[#141414] bg-white/40 shrink-0 shadow-sm transition-all hover:bg-white/60">
            <div className="p-3 border-b border-[#141414] flex justify-between items-center shrink-0 bg-black/5">
              <h2 className="text-[11px] uppercase font-bold">Сроки и состав услуг</h2>
              <button onClick={addCondition} className="text-[10px] font-bold flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Добавить пункт
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div className="flex gap-2 items-start text-xs">
                <span className="font-bold mt-1 shrink-0">1.</span>
                <div className="flex-1 leading-relaxed bg-black/5 p-2 border border-[#141414]/20">
                  Место оказания услуг: 650064, г. Кемерово, ул. Арочная, 37А, Государственное казенное учреждение «Центр информационных технологий Кузбасса».
                </div>
              </div>

              {data.serviceConditions.map((cond, index) => (
                <div key={index} className="flex gap-2 items-start relative group">
                  <span className="font-bold mt-2 text-xs shrink-0">{index + 2}.</span>
                  <textarea
                    value={cond}
                    onChange={(e) => handleConditionChange(index, e.target.value)}
                    rows={3}
                    className={`${textareaClass} flex-1`}
                  />
                  <button
                    onClick={() => removeCondition(index)}
                    className="absolute top-2 right-2 text-black/30 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                    title="Удалить пункт"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4">Реквизиты запроса</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className={labelClass}>Сроки закупки</label>
                <input
                  type="text"
                  className={fieldClass}
                  value={data.purchasePeriod}
                  onChange={e => handleChange('purchasePeriod', e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Срок подачи КП</label>
                <input
                  type="text"
                  className={fieldClass}
                  value={data.submissionDeadline}
                  onChange={e => handleChange('submissionDeadline', e.target.value)}
                />
              </div>
              <div className="flex flex-col col-span-2">
                <label className={labelClass}>E-mail для приема КП</label>
                <input
                  type="text"
                  className={fieldClass}
                  value={data.submissionEmail}
                  onChange={e => handleChange('submissionEmail', e.target.value)}
                />
              </div>
              <div className="flex flex-col col-span-2">
                <label className={labelClass}>Контактное лицо</label>
                <input
                  type="text"
                  className={fieldClass}
                  value={data.contactPerson}
                  onChange={e => handleChange('contactPerson', e.target.value)}
                />
              </div>
            </div>
          </section>

        </aside>

        <article className="col-span-1 xl:col-span-8 overflow-hidden flex flex-col h-full">
          <div className="flex justify-between items-end mb-2 shrink-0">
            <span className="text-[11px] uppercase font-bold flex items-center gap-2">
              Предварительный просмотр документа
            </span>
            <div className="flex items-center gap-3">
              {data.vendorInfos.length > 1 && (
                <div className="flex items-center border border-[#141414] bg-white">
                  <button
                    onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    className="p-1 hover:bg-black/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] uppercase font-bold px-3">
                    Документ {previewIndex + 1} из {data.vendorInfos.length}
                  </span>
                  <button
                    onClick={() => setPreviewIndex(i => Math.min(data.vendorInfos.length - 1, i + 1))}
                    disabled={previewIndex === data.vendorInfos.length - 1}
                    className="p-1 hover:bg-black/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <span className="text-[10px] text-green-700 font-bold uppercase animate-pulse">● Авто-обновление</span>
            </div>
          </div>
          <div className="scroll-area flex-1 transition-all overflow-auto bg-[#d7d5d0] p-6">
            <KpDocumentPreview data={data} vendorIndex={previewIndex} />
          </div>
        </article>

      </main>
    </div>
  );
}
