import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'НМЦК' },
  { to: '/kp', label: 'Запрос КП' },
  { to: '/memo', label: 'Служебка' },
  { to: '/counterparties', label: 'Контрагенты' },
];

export default function AppNav() {
  const location = useLocation();

  return (
    <nav className="flex gap-2">
      {links.map(link => {
        const active = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`text-[11px] uppercase font-bold px-3 py-1.5 border border-[#141414] transition-colors ${
              active
                ? 'bg-[#141414] text-[#E4E3E0]'
                : 'bg-white hover:bg-black/5'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
