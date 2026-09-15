import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

const documentLinks = [
  { segment: 'nmck', label: 'НМЦК' },
  { segment: 'kp', label: 'Запрос КП' },
  { segment: 'memo', label: 'Служебка' },
];

export default function AppNav() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <nav className="flex gap-2">
        <Link
          to="/purchases"
          className="border border-[#141414] bg-white px-3 py-1.5 text-[11px] font-bold uppercase transition-colors hover:bg-black/5"
        >
          К закупкам
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex gap-2">
      <Link
        to={`/purchases/${id}`}
        className="border border-[#141414] bg-white px-3 py-1.5 text-[11px] font-bold uppercase transition-colors hover:bg-black/5"
      >
        Карточка
      </Link>
      {documentLinks.map(link => {
        const to = `/purchases/${id}/${link.segment}`;
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
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
