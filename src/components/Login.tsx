import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readApiError } from '../utils/api';
import ThemeToggle from './ThemeToggle';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Не удалось войти'));
        return;
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(data.user?.mustChangePassword ? '/cabinet' : '/');
    } catch (err) {
      setError('Ошибка сети. Проверьте подключение и попробуйте ещё раз.');
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-page font-sans text-ink">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-[400px] border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-bold uppercase tracking-tighter mb-1 text-center">Вход в систему</h1>
        <p className="text-[10px] opacity-60 text-center mb-6">Система обоснования НМЦК</p>
        
        {error && <div className="bg-red-100 text-red-700 p-2 text-xs mb-4 text-center border border-red-200">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Логин</label>
            <input 
              type="text" 
              className="border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Пароль</label>
            <input 
              type="password" 
              className="border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-brutal btn-brutal-primary mt-2">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
