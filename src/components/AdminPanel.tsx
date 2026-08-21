import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNav from './AppNav';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePassword, setChangePassword] = useState('');
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
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
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: 'user' })
      });
      if (res.ok) {
        setMessage('Пользователь создан');
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        const err = await res.json();
        setMessage(`Ошибка: ${err.error}`);
      }
    } catch (err) {
      setMessage('Ошибка сети');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: changePassword })
      });
      if (res.ok) {
        setMessage('Пароль успешно изменен!');
        setChangePassword('');
      } else {
        const err = await res.json();
        setMessage(`Ошибка: ${err.error}`);
      }
    } catch (err) {
      setMessage('Ошибка сети');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-[#141414] pb-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Панель управления</h1>
            <p className="text-[10px] opacity-60">Текущий пользователь: {user.username} ({user.role})</p>
          </div>
          <div className="flex gap-4 items-center shrink-0 flex-wrap justify-end">
            <AppNav />
            <button onClick={logout} className="text-sm font-bold text-red-600 hover:underline">Выйти</button>
          </div>
        </header>

        {message && <div className="mb-4 p-3 bg-white border border-[#141414] text-sm">{message}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <section className="bg-white p-6 border border-[#141414]">
            <h2 className="text-sm uppercase font-bold mb-4">Смена собственного пароля</h2>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <input 
                type="password" 
                placeholder="Новый пароль" 
                className="border border-[#141414] px-3 py-2 text-sm"
                value={changePassword}
                onChange={e => setChangePassword(e.target.value)}
                required
                minLength={5}
              />
              <button type="submit" className="bg-[#141414] text-white py-2 text-sm font-bold uppercase">Изменить</button>
            </form>
          </section>

          {user.role === 'admin' && (
            <section className="bg-white p-6 border border-[#141414]">
              <h2 className="text-sm uppercase font-bold mb-4">Создание пользователя</h2>
              <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Логин" 
                  className="border border-[#141414] px-3 py-2 text-sm"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                />
                <input 
                  type="password" 
                  placeholder="Пароль" 
                  className="border border-[#141414] px-3 py-2 text-sm"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                <button type="submit" className="bg-[#141414] text-white py-2 text-sm font-bold uppercase">Создать</button>
              </form>
            </section>
          )}

          {user.role === 'admin' && (
            <section className="bg-white p-6 border border-[#141414] md:col-span-2">
              <h2 className="text-sm uppercase font-bold mb-4">Список пользователей</h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#141414]">
                    <th className="py-2 text-xs uppercase opacity-70">ID</th>
                    <th className="py-2 text-xs uppercase opacity-70">Логин</th>
                    <th className="py-2 text-xs uppercase opacity-70">Роль</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-black/10 last:border-0">
                      <td className="py-2 text-sm">{u.id}</td>
                      <td className="py-2 text-sm font-medium">{u.username}</td>
                      <td className="py-2 text-sm">
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold ${u.role === 'admin' ? 'bg-black text-white' : 'bg-gray-200'}`}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
