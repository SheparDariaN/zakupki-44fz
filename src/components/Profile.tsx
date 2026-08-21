import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateDocx } from '../utils/docxGenerator';
import { generateKpDocx } from '../utils/kpDocxGenerator';
import { Download } from 'lucide-react';
import AppNav from './AppNav';

export default function Profile() {
  const [settings, setSettings] = useState({ customer: '', executorPosition: '', executorName: '' });
  const [documents, setDocuments] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSettings();
    fetchDocuments();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch('/api/user/settings', { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
    }
  };

  const fetchDocuments = async () => {
    const res = await fetch('/api/user/documents', { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage('Настройки успешно сохранены!');
      }
    } catch (err) {
      setMessage('Ошибка сохранения.');
    }
  };

  const handleRegenerate = async (doc: any) => {
    if (doc.type === 'kp' || doc.state?.vendorInfos) {
      await generateKpDocx(doc.state);
    } else {
      await generateDocx(doc.state);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-[#141414] pb-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Личный кабинет</h1>
            <p className="text-[10px] opacity-60">Пользователь: {user.username}</p>
          </div>
          <div className="flex gap-4 items-center shrink-0 flex-wrap justify-end">
            <AppNav />
            {user.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="text-sm font-bold hover:underline">Админ-панель</button>
            )}
          </div>
        </header>

        {message && <div className="mb-4 p-3 bg-white border border-[#141414] text-sm text-green-700 font-bold">{message}</div>}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          <aside className="md:col-span-4">
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
                <button type="submit" className="mt-2 bg-[#141414] text-white py-2 text-sm font-bold uppercase hover:bg-black/80 transition-colors">
                  Сохранить
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
                        <h3 className="text-sm font-bold">{doc.name || 'Обоснование НМЦК'}</h3>
                        <p className="text-[10px] opacity-60">
                          {doc.type === 'kp' ? 'Запрос КП' : 'Обоснование НМЦК'} · {new Date(doc.createdAt).toLocaleString('ru-RU')}
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
