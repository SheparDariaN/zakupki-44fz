import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import AppNav from './AppNav';
import { apiFetch, clearSession, getStoredUser, readApiError } from '../utils/api';
import type { StoredDocument, UserSettings } from '../server/types';
import { generateRegisteredDocument, getDocumentTitle } from '../documents/registry';

const emptySettings: UserSettings = {
  customer: '',
  executorPosition: '',
  executorName: '',
  submissionEmail: '',
  contactPerson: '',
  contactPhone: '',
  defaultServicePlace: '',
  defaultServiceConditions: '',
};

export default function Profile() {
  const [settings, setSettings] = useState<UserSettings>(emptySettings);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const navigate = useNavigate();
  const user = getStoredUser();

  useEffect(() => {
    fetchSettings();
    fetchDocuments();
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
        setSettings({ ...emptySettings, ...data });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await apiFetch('/api/user/documents');
      if (res.ok) {
        const data: StoredDocument[] = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await apiFetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
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

  const handleRegenerate = async (doc: StoredDocument) => {
    try {
      await generateRegisteredDocument(doc.type, doc.state);
    } catch (err) {
      console.error(err);
      showMessage('Не удалось сформировать документ.', true);
    }
  };

  const logout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-[#141414] pb-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Личный кабинет</h1>
            <p className="text-[10px] opacity-60">Пользователь: {user?.username}</p>
          </div>
          <div className="flex gap-4 items-center shrink-0 flex-wrap justify-end">
            <AppNav />
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="text-sm font-bold hover:underline">Админ-панель</button>
            )}
            <button onClick={logout} className="text-sm font-bold text-red-600 hover:underline">Выйти</button>
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
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold mb-1 opacity-70">ФИО подписанта</label>
                  <input
                    type="text"
                    className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    value={settings.executorName || ''}
                    onChange={e => setSettings({...settings, executorName: e.target.value})}
                  />
                </div>
                <div className="border-t border-[#141414]/20 pt-4 mt-1 flex flex-col gap-4">
                  <p className="text-[10px] uppercase font-bold opacity-60">Контакты для запроса КП</p>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">E-mail для приема КП</label>
                    <input
                      type="text"
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      value={settings.submissionEmail || ''}
                      onChange={e => setSettings({...settings, submissionEmail: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Контактное лицо</label>
                    <input
                      type="text"
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                      value={settings.contactPerson || ''}
                      onChange={e => setSettings({...settings, contactPerson: e.target.value})}
                    />
                  </div>
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
                  <p className="text-[10px] uppercase font-bold opacity-60">Типовые условия</p>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Место оказания услуг</label>
                    <textarea
                      rows={3}
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                      value={settings.defaultServicePlace || ''}
                      onChange={e => setSettings({...settings, defaultServicePlace: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Типовые условия</label>
                    <textarea
                      rows={4}
                      className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                      value={settings.defaultServiceConditions || ''}
                      onChange={e => setSettings({...settings, defaultServiceConditions: e.target.value})}
                    />
                  </div>
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

          <main className="md:col-span-8">
            <section className="bg-white p-6 border border-[#141414]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm uppercase font-bold">История документов</h2>
                <span className="text-[10px] opacity-70">Хранятся 3 дня</span>
              </div>

              {documents.length === 0 ? (
                <div className="text-sm opacity-50 py-8 text-center border border-dashed border-[#141414]">
                  Нет сохраненных документов
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex justify-between items-center p-3 border border-black/10 hover:border-black transition-colors group">
                      <div>
                        <h3 className="text-sm font-bold">{doc.name || getDocumentTitle(doc.type)}</h3>
                        <p className="text-[10px] opacity-60">
                          {getDocumentTitle(doc.type)} · {new Date(doc.createdAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRegenerate(doc)}
                        className="p-2 text-black/50 hover:text-black hover:bg-black/5 rounded transition-colors"
                        title="Скачать заново"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

        </div>
      </div>
    </div>
  );
}
