import React, { useState } from 'react';
import { Download, RefreshCw, User } from 'lucide-react';
import { ServiceMemoData } from '../types';
import { generateServiceMemoDocx } from '../utils/serviceMemoDocxGenerator';
import AppNav from './AppNav';
import ServiceMemoPreview from './ServiceMemoPreview';

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultValues: ServiceMemoData = {
  purpose: 'В целях оптимизации процесса, ведения документооборота в части информационной безопасности, прошу рассмотреть возможность',
  subjectIntro: 'приобретения лицензии программного продукта «АльфаДок» в следующей комплектации:',
  subjectTable: 'Права на программу для ЭВМ «Альфа». Приложение «АльфаДок». Клиентская лицензия «Сегмент» на 1 год;\nПрава на программу для ЭВМ «Альфа». Приложение «АльфаДок». Клиентская лицензия «Модуль ГИС» на 1 год.',
  requester: '',
  contractServiceHead: '',
  date: todayIso(),
};

export default function ServiceMemo() {
  const [data, setData] = useState<ServiceMemoData>(defaultValues);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloadMessageError, setDownloadMessageError] = useState(false);

  const handleChange = (field: keyof ServiceMemoData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const resetState = () => {
    setData({ ...defaultValues, date: todayIso() });
    setDownloadMessage('');
    setDownloadMessageError(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setDownloadMessage('');
    setDownloadMessageError(false);

    try {
      await generateServiceMemoDocx(data);
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
  const canGenerate = Boolean(
    data.purpose.trim() &&
    data.subjectIntro.trim() &&
    data.subjectTable.trim() &&
    data.requester.trim() &&
    data.contractServiceHead.trim() &&
    data.date.trim()
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-[#141414] shrink-0 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Служебная записка на закупку</h1>
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
          <section className="bg-white/50 p-5 border border-[#141414] shrink-0 shadow-sm transition-all hover:bg-white/80">
            <h2 className="text-[11px] uppercase font-bold mb-4">Шапка документа</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className={labelClass}>Руководитель контрактной службы</label>
                <textarea
                  rows={3}
                  className={textareaClass}
                  value={data.contractServiceHead}
                  onChange={e => handleChange('contractServiceHead', e.target.value)}
                  placeholder="Должность, ФИО"
                />
                <p className="text-[10px] opacity-40 mt-1">Подставляется первым в шапке после обращения.</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Составитель запроса</label>
                <textarea
                  rows={3}
                  className={textareaClass}
                  value={data.requester}
                  onChange={e => handleChange('requester', e.target.value)}
                  placeholder="Должность, ФИО"
                />
                <p className="text-[10px] opacity-40 mt-1">Дублируется в шапке и в конце документа над датой.</p>
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
            <textarea
              rows={6}
              className={textareaClass}
              value={data.purpose}
              onChange={e => handleChange('purpose', e.target.value)}
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
                <textarea
                  rows={2}
                  className={`${fieldClass} resize-none`}
                  value={data.subjectIntro}
                  onChange={e => handleChange('subjectIntro', e.target.value)}
                />
                <p className="text-[10px] opacity-40 mt-1">Продолжает абзац цели перед маркированным списком.</p>
              </div>
              <div className="flex flex-col">
                <label className={labelClass}>Предмет закупки (перечень)</label>
                <textarea
                  rows={4}
                  className={textareaClass}
                  value={data.subjectTable}
                  onChange={e => handleChange('subjectTable', e.target.value)}
                />
                <p className="text-[10px] opacity-40 mt-1">Каждая строка станет отдельным пунктом списка.</p>
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
            <ServiceMemoPreview data={data} />
          </div>
        </article>
      </main>
    </div>
  );
}
