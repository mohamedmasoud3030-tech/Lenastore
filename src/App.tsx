import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ProjectProvider, useProject } from './lib/ProjectContext';
import { supabase } from './lib/supabase';

import SupabaseSetup from './components/SupabaseSetup';
import Login from './components/Login';
import ProjectSetup from './components/ProjectSetup';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Materials from './components/Materials';
import Movements from './components/Movements';
import Suppliers from './components/Suppliers';

import Purchases from './components/Purchases';
import CreatePurchase from './components/CreatePurchase';
import PurchaseDetails from './components/PurchaseDetails';
import PurchaseRequests from './components/PurchaseRequests';
import CreatePurchaseRequest from './components/CreatePurchaseRequest';
import RequestDetails from './components/RequestDetails';
import Reports from './components/Reports';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { project, loading: projectLoading } = useProject();

  if (authLoading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (projectLoading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!project) return <Navigate to="/setup-project" replace />;

  return <>{children}</>;
}

function AppContent() {
  if (!supabase) {
    return <SupabaseSetup />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup-project" element={<ProjectSetup />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<PurchaseRequests />} />
        <Route path="requests/new" element={<CreatePurchaseRequest />} />
        <Route path="requests/:id" element={<RequestDetails />} />
        <Route path="materials" element={<Materials />} />
        <Route path="movements" element={<Movements />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="purchases/new" element={<CreatePurchase />} />
        <Route path="purchases/:id" element={<PurchaseDetails />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ProjectProvider>
    </AuthProvider>
  );
}

