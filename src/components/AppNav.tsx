import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

const documentLinks = [
  { segment: 'nmck', label: 'НМЦК' },
  { segment: 'offers', label: 'КП' },
  { segment: 'kp', label: 'Запрос КП' },
  { segment: 'memo', label: 'Служебка' },
];

const navClass = (active: boolean) =>
  `btn-brutal text-[11px] ${active ? 'btn-brutal-active' : ''}`;

export default function AppNav() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <nav className="flex gap-2">
        <Link to="/purchases" className={navClass(false)}>
          К закупкам
        </Link>
      </nav>
    );
  }

  const cardTo = `/purchases/${id}`;
  const cardActive = location.pathname === cardTo;

  return (
    <nav className="flex gap-2">
      <Link to={cardTo} className={navClass(cardActive)}>
        Карточка
      </Link>
      {documentLinks.map(link => {
        const to = `/purchases/${id}/${link.segment}`;
        const active = location.pathname === to;
        return (
          <Link key={to} to={to} className={navClass(active)}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
