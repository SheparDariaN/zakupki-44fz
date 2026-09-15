import React, { useEffect, useState } from 'react';
import { apiFetch, getStoredUser, readApiError } from '../utils/api';
import type { PublicUser } from '../server/types';

export default function AdminPanel() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const user = getStoredUser();

  useEffect(() => {
    fetchUsers();
  }, []);

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data: PublicUser[] = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: 'user' })
      });
      if (res.ok) {
        showMessage('Пользователь создан');
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        showMessage(`Ошибка: ${await readApiError(res)}`, true);
      }
    } catch (err) {
      showMessage('Ошибка сети', true);
    }
  };

  return (
    <div className="pb-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-line pb-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Панель управления</h1>
            <p className="text-[10px] opacity-60">Текущий пользователь: {user?.username} ({user?.role})</p>
          </div>
        </header>

        {message && (
          <div className={`mb-4 p-3 bg-surface border border-line text-sm ${messageError ? 'text-red-700' : 'text-green-700 font-bold'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="bg-surface p-6 border border-line">
            <h2 className="text-sm uppercase font-bold mb-4">Создание пользователя</h2>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Логин"
                className="border border-line px-3 py-2 text-sm"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                className="border border-line px-3 py-2 text-sm"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={5}
              />
              <button type="submit" className="btn-brutal btn-brutal-primary">Создать</button>
            </form>
          </section>

          <section className="bg-surface p-6 border border-line md:col-span-2">
            <h2 className="text-sm uppercase font-bold mb-4">Список пользователей</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-xs uppercase opacity-70">ID</th>
                  <th className="py-2 text-xs uppercase opacity-70">Логин</th>
                  <th className="py-2 text-xs uppercase opacity-70">Роль</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-ink/10 last:border-0">
                    <td className="py-2 text-sm">{u.id}</td>
                    <td className="py-2 text-sm font-medium">{u.username}</td>
                    <td className="py-2 text-sm">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold ${u.role === 'admin' ? 'bg-ink text-page' : 'bg-ink/15 text-ink'}`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
