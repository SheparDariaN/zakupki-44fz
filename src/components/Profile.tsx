import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import InflectedNameField from './InflectedNameField';
import { apiFetch, getStoredUser, readApiError } from '../utils/api';
import type { UserSettings } from '../server/types';
import { hydrateInflection } from '../utils/morphology';

const emptySettings: UserSettings = {
  customer: '',
  executorPosition: '',
  executorName: '',
  executorNameGenitive: '',
  executorNameDative: '',
  submissionEmail: '',
  contactPerson: '',
  contactPersonGenitive: '',
  contactPersonDative: '',
  contactPhone: '',
  contractServiceHeadPosition: 'Руководитель контрактной службы',
  contractServiceHeadName: '',
  contractServiceHeadNameGenitive: '',
  contractServiceHeadNameDative: '',
  defaultServiceConditions: [],
};

function hydrateSettingsInflections(settings: UserSettings): UserSettings {
  const executor = hydrateInflection({
    nominative: settings.executorName,
    genitive: settings.executorNameGenitive,
    dative: settings.executorNameDative,
  });
  const contractServiceHead = hydrateInflection({
    nominative: settings.contractServiceHeadName,
    genitive: settings.contractServiceHeadNameGenitive,
    dative: settings.contractServiceHeadNameDative,
  });
  const contactPerson = hydrateInflection({
    nominative: settings.contactPerson,
    genitive: settings.contactPersonGenitive,
    dative: settings.contactPersonDative,
  });

  return {
    ...settings,
    executorName: executor.nominative,
    executorNameGenitive: executor.genitive,
    executorNameDative: executor.dative,
    contractServiceHeadName: contractServiceHead.nominative,
    contractServiceHeadNameGenitive: contractServiceHead.genitive,
    contractServiceHeadNameDative: contractServiceHead.dative,
    contactPerson: contactPerson.nominative,
    contactPersonGenitive: contactPerson.genitive,
    contactPersonDative: contactPerson.dative,
  };
}

export default function Profile() {
  const [settings, setSettings] = useState<UserSettings>(emptySettings);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const navigate = useNavigate();
  const user = getStoredUser();

  useEffect(() => {
    fetchSettings();
  }, []);

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  useEffect(() => {
    if (user?.mustChangePassword) {
      showMessage('Смените пароль администратора перед продолжением работы.', true);
    }
  }, [user?.mustChangePassword]);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/user/settings');
      if (res.ok) {
        const data: UserSettings = await res.json();
        setSettings(hydrateSettingsInflections({
          ...emptySettings,
          ...data,
          defaultServiceConditions: Array.isArray(data.defaultServiceConditions)
            ? data.defaultServiceConditions
            : [],
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const payload: UserSettings = hydrateSettingsInflections({
      ...settings,
      defaultServiceConditions: settings.defaultServiceConditions.map((item) => item.trim()).filter(Boolean),
    });
    try {
      const res = await apiFetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSettings(payload);
        showMessage('Настройки успешно сохранены!');
      } else {
        showMessage(await readApiError(res, 'Ошибка сохранения.'), true);
      }
    } catch (err) {
      showMessage('Ошибка сохранения.', true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        showMessage('Пароль успешно изменен!');
        if (user) {
          localStorage.setItem('user', JSON.stringify({ ...user, mustChangePassword: false }));
        }
        setNewPassword('');
      } else {
        showMessage(await readApiError(res), true);
      }
    } catch (err) {
      showMessage('Ошибка сети', true);
    }
  };

  return (
    <div className="pb-8 font-sans text-[#141414]">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-[#141414] pb-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Личный кабинет</h1>
            <p className="text-[10px] opacity-60">Пользователь: {user?.username}</p>
          </div>
          <div className="flex gap-3 items-center shrink-0 flex-wrap justify-end">
            <button onClick={() => navigate('/cabinet/counterparties')} className="btn-brutal bg-white text-sm font-bold">
              Контрагенты
            </button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="text-sm font-bold hover:underline">Админ-панель</button>
            )}
          </div>
        </header>

        {message && (
          <div className={`mb-4 p-3 bg-white border border-[#141414] text-sm ${messageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          <aside className="md:col-span-4 flex flex-col gap-8">
            <section className="bg-white p-6 border border-[#141414]">
              <h2 className="text-sm uppercase font-bold mb-4">Данные по умолчанию</h2>
              <p className="text-[10px] opacity-70 mb-4">Эти данные будут автоматически подставляться в новые документы.</p>

              <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Заказчик</label>
                  <input
                    type="text"
                    className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    value={settings.customer || ''}
                    onChange={e => setSettings({...settings, customer: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Должность подписанта</label>
                  <input
                    type="text"
                    className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    value={settings.executorPosition || ''}
                    onChange={e => setSettings({...settings, executorPosition: e.target.value})}
                  />
                </div>
                <InflectedNameField
                  label="ФИО подписанта"
                  value={settings.executorName || ''}
                  genitive={settings.executorNameGenitive || ''}
                  dative={settings.executorNameDative || ''}
                  onChange={(value) => setSettings({
                    ...settings,
                    executorName: value.nominative,
                    executorNameGenitive: value.genitive,
                    executorNameDative: value.dative,
                  })}
                />
                <div className="border-t border-[#141414]/20 pt-4 mt-1 flex flex-col gap-4">
                  <p className="text-[10px] uppercase font-bold opacity-60">Руководитель контрактной службы</p>
                  <p className="text-[10px] opacity-60 -mt-2">Подставляется в запрос КП как подписант и в служебную записку.</p>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Должность</label>
                    <input
                      type="text"
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      value={settings.contractServiceHeadPosition || ''}
                      onChange={e => setSettings({...settings, contractServiceHeadPosition: e.target.value})}
                      placeholder="Руководитель контрактной службы"
                    />
                  </div>
                  <InflectedNameField
                    label="ФИО"
                    value={settings.contractServiceHeadName || ''}
                    genitive={settings.contractServiceHeadNameGenitive || ''}
                    dative={settings.contractServiceHeadNameDative || ''}
                    onChange={(value) => setSettings({
                      ...settings,
                      contractServiceHeadName: value.nominative,
                      contractServiceHeadNameGenitive: value.genitive,
                      contractServiceHeadNameDative: value.dative,
                    })}
                  />
                </div>
                <div className="border-t border-[#141414]/20 pt-4 mt-1 flex flex-col gap-4">
                  <p className="text-[10px] uppercase font-bold opacity-60">Контакты для запроса КП</p>
                  <p className="text-[10px] opacity-60 -mt-2">В запросе КП e-mail и контактные лица заполняются вместе: к ФИО добавляется телефон в формате «т. n».</p>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">E-mail для приема КП</label>
                    <input
                      type="text"
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      value={settings.submissionEmail || ''}
                      onChange={e => setSettings({...settings, submissionEmail: e.target.value})}
                    />
                  </div>
                  <InflectedNameField
                    label="Контактное лицо"
                    value={settings.contactPerson || ''}
                    genitive={settings.contactPersonGenitive || ''}
                    dative={settings.contactPersonDative || ''}
                    onChange={(value) => setSettings({
                      ...settings,
                      contactPerson: value.nominative,
                      contactPersonGenitive: value.genitive,
                      contactPersonDative: value.dative,
                    })}
                  />
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Телефон контактного лица</label>
                    <input
                      type="text"
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      value={settings.contactPhone || ''}
                      onChange={e => setSettings({...settings, contactPhone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="border-t border-[#141414]/20 pt-4 mt-1 flex flex-col gap-4">
                  <div className="flex justify-between items-center gap-2">
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-60">Типовые условия</p>
                      <p className="text-[10px] opacity-60 mt-1">Подставляются в запрос КП в раздел «Сроки и состав услуг».</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        defaultServiceConditions: [...prev.defaultServiceConditions, ''],
                      }))}
                      className="text-[10px] font-bold flex items-center gap-1 hover:text-blue-600 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить пункт
                    </button>
                  </div>
                  {settings.defaultServiceConditions.length === 0 ? (
                    <p className="text-[10px] opacity-50 border border-dashed border-[#141414] px-3 py-4 text-center">
                      Нет пунктов. Добавьте типовое условие.
                    </p>
                  ) : (
                    settings.defaultServiceConditions.map((condition, index) => (
                      <div key={index} className="flex gap-2 items-start relative group">
                        <span className="font-bold mt-2 text-xs shrink-0">{index + 1}.</span>
                        <textarea
                          rows={3}
                          className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none flex-1"
                          value={condition}
                          onChange={e => {
                            const next = [...settings.defaultServiceConditions];
                            next[index] = e.target.value;
                            setSettings({ ...settings, defaultServiceConditions: next });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({
                            ...prev,
                            defaultServiceConditions: prev.defaultServiceConditions.filter((_, i) => i !== index),
                          }))}
                          className="absolute top-2 right-2 text-black/30 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                          title="Удалить пункт"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <button type="submit" className="mt-2 bg-[#141414] text-white py-2 text-sm font-bold uppercase hover:bg-black/80 transition-colors">
                  Сохранить
                </button>
              </form>
            </section>

            <section className="bg-white p-6 border border-[#141414]">
              <h2 className="text-sm uppercase font-bold mb-4">Смена пароля</h2>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="Новый пароль"
                  className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={5}
                />
                <button type="submit" className="bg-[#141414] text-white py-2 text-sm font-bold uppercase hover:bg-black/80 transition-colors">
                  Изменить
                </button>
              </form>
            </section>
          </aside>

          <main className="md:col-span-8 flex flex-col gap-8">
            <section className="bg-white p-6 border border-[#141414]">
              <h2 className="text-sm uppercase font-bold mb-4">Разделы кабинета</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate('/cabinet/counterparties')}
                  className="border border-[#141414] p-4 text-left hover:bg-black/5 transition-colors"
                >
                  <span className="block text-sm font-bold uppercase">Контрагенты</span>
                  <span className="text-[11px] opacity-60">Справочник организаций для запросов КП.</span>
                </button>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="border border-[#141414] p-4 text-left hover:bg-black/5 transition-colors"
                  >
                    <span className="block text-sm font-bold uppercase">Админ-панель</span>
                    <span className="text-[11px] opacity-60">Пользователи и роли.</span>
                  </button>
                )}
              </div>
            </section>
          </main>

        </div>
      </div>
    </div>
  );
}
