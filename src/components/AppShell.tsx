import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ClipboardList, LogOut, User } from 'lucide-react';
import { clearSession, getStoredUser } from '../utils/api';
import ThemeToggle from './ThemeToggle';

const sectionLinks = [
  { to: '/purchases', label: 'Закупки', icon: BriefcaseBusiness },
  { to: '/reports', label: 'Отчётность', icon: ClipboardList },
  { to: '/cabinet', label: 'Личный кабинет', icon: User },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = getStoredUser();

  const logout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-page p-6 font-sans text-ink">
      <header className="mb-6 flex shrink-0 items-center justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Система закупок</h1>
          <p className="text-[10px] opacity-60">Пользователь: {user?.username || 'неизвестно'}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <nav className="flex flex-wrap gap-2">
            {sectionLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `btn-brutal flex items-center gap-2 text-sm font-bold ${
                  isActive ? 'btn-brutal-active' : ''
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
          <button onClick={logout} className="text-sm font-bold text-red-600 hover:underline">
            <LogOut className="mr-1 inline h-4 w-4" /> Выйти
          </button>
        </div>
      </header>

      <main className="scroll-area min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
