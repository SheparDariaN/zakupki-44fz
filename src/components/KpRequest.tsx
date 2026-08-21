import React, { useState } from 'react';
import { KpDocxData } from '../types';
import { generateKpDocx } from '../utils/kpDocxGenerator';
import KpDocumentPreview from './KpDocumentPreview';
import AppNav from './AppNav';
import { Trash2, Plus, RefreshCw, Download, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../utils/api';

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

export default function KpRequest() {
  const [data, setData] = useState<KpDocxData>(defaultValues);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

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
    try {
      await generateKpDocx(data);

      try {
        const firstVendor = data.vendorInfos.find(v => v.trim()) || '';
        const name = data.subjectTable || data.subjectIntro || 'Запрос КП';
        await apiFetch('/api/user/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: firstVendor ? `Запрос КП: ${name}` : name,
            state: data,
            type: 'kp'
          })
        });
      } catch (e) {
        console.error("Failed to save document history");
      }
    } catch (error) {
      console.error("Failed to generate docx", error);
      alert("Ошибка при генерации документа");
    } finally {
      setIsGenerating(false);
    }
  };

  const labelClass = "text-[9px] uppercase opacity-60 mb-1 font-bold";
  const fieldClass = "bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs py-1.5 focus:outline-none w-full transition-colors";
  const textareaClass = "w-full bg-transparent border border-[#141414] px-2 py-1.5 text-xs focus:outline-none focus:bg-white resize-none";
  const vendorCount = data.vendorInfos.filter(v => v.trim()).length;

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
          <div className="paper scroll-area flex-1 transition-all overflow-x-auto">
            <KpDocumentPreview data={data} vendorIndex={previewIndex} />
          </div>
        </article>

      </main>
    </div>
  );
}
