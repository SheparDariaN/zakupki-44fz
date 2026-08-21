import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainApp from './components/MainApp';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import Profile from './components/Profile';
import KpRequest from './components/KpRequest';
import ErrorBoundary from './components/ErrorBoundary';
import { getStoredUser, getToken } from './utils/api';

const ProtectedRoute = ({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) => {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && getStoredUser()?.role !== 'admin') {
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
