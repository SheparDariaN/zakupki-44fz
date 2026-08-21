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
  if (user?.mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } />
          <Route path="/kp" element={
            <ProtectedRoute>
              <KpRequest />
            </ProtectedRoute>
          } />
          <Route path="/memo" element={
            <ProtectedRoute>
              <ServiceMemo />
            </ProtectedRoute>
          } />
          <Route path="/counterparties" element={
            <ProtectedRoute>
              <Counterparties />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
