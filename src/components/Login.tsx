import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to login');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#E4E3E0] font-sans">
      <div className="bg-white p-8 border border-[#141414] shadow-sm w-[400px]">
        <h1 className="text-xl font-bold uppercase tracking-tighter mb-1 text-center">Вход в систему</h1>
        <p className="text-[10px] opacity-60 text-center mb-6">Fullstack Procurement Suite</p>
        
        {error && <div className="bg-red-100 text-red-700 p-2 text-xs mb-4 text-center border border-red-200">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Логин</label>
            <input 
              type="text" 
              className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold mb-1 opacity-70">Пароль</label>
            <input 
              type="password" 
              className="border border-[#141414] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="mt-2 bg-[#141414] text-white py-2 text-sm font-bold uppercase hover:bg-black/80 transition-colors">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
