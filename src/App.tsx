import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainApp from './components/MainApp';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import Profile from './components/Profile';
import KpRequest from './components/KpRequest';
import ServiceMemo from './components/ServiceMemo';
import Counterparties from './components/Counterparties';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './components/AppShell';
import PurchasesList from './components/PurchasesList';
import PurchaseDetail from './components/PurchaseDetail';
import PurchaseOffers from './components/PurchaseOffers';
import Reports from './components/Reports';
import { getStoredUser, getToken } from './utils/api';

const ProtectedRoute = ({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) => {
  const location = useLocation();
  const user = getStoredUser();

  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  if (user?.mustChangePassword && location.pathname !== '/cabinet') {
    return <Navigate to="/cabinet" replace />;
  }
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/purchases" replace />;
  }
  return <>{children}</>;
};

const withProtection = (children: React.ReactNode, adminOnly = false) => (
  <ProtectedRoute adminOnly={adminOnly}>
    {children}
  </ProtectedRoute>
);

const withShell = (children: React.ReactNode, adminOnly = false) => withProtection(
  <AppShell>
    {children}
  </AppShell>,
  adminOnly
);

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={withProtection(<Navigate to="/purchases" replace />)} />
          <Route path="/purchases" element={withShell(<PurchasesList />)} />
          <Route path="/purchases/:id" element={withShell(<PurchaseDetail />)} />
          <Route path="/purchases/:id/nmck" element={withProtection(<MainApp />)} />
          <Route path="/purchases/:id/offers" element={withProtection(<PurchaseOffers />)} />
          <Route path="/purchases/:id/kp" element={withProtection(<KpRequest />)} />
          <Route path="/purchases/:id/memo" element={withProtection(<ServiceMemo />)} />
          <Route path="/reports" element={withShell(<Reports />)} />
          <Route path="/cabinet" element={withShell(<Profile />)} />
          <Route path="/cabinet/counterparties" element={withShell(<Counterparties />)} />
          <Route path="/admin" element={withShell(<AdminPanel />, true)} />
          <Route path="/profile" element={withProtection(<Navigate to="/cabinet" replace />)} />
          <Route path="/counterparties" element={withProtection(<Navigate to="/cabinet/counterparties" replace />)} />
          <Route path="/kp" element={withProtection(<Navigate to="/purchases" replace />)} />
          <Route path="/memo" element={withProtection(<Navigate to="/purchases" replace />)} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
