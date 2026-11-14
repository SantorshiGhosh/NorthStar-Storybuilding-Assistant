import React, { Suspense, lazy, useEffect } from 'react';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link
} from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';


import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';

// Route-level code splitting for heavy interactive workspaces
const Workspace = lazy(() => import('./pages/Workspace'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const ContinuityReport = lazy(() => import('./pages/ContinuityReport'));
const CharacterProfiles = lazy(() => import('./pages/CharacterProfiles'));
const Timeline = lazy(() => import('./pages/Timeline'));

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col animate-pulse">
      <div className="h-14 bg-white border-b border-neutral-200/80 px-6 flex items-center justify-between">
        <div className="w-36 h-4 bg-neutral-200 rounded-md" />
        <div className="w-24 h-4 bg-neutral-100 rounded-md" />
      </div>
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="w-48 h-6 bg-neutral-200 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="h-44 bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs" />
          <div className="h-44 bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs" />
          <div className="h-44 bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs" />
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fbfbf9] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-8 max-w-lg shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              !
            </div>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Something went wrong</h2>
            <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Reload Page
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 text-xs font-semibold bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Cold-start backend warmup on initial load
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    fetch(`${API_BASE}/health`, { mode: 'cors' }).catch(() => {});
  }, []);

  return (

<ThemeProvider>
  <ErrorBoundary>
   

      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workspace/:projectId" element={<Workspace />} />
            <Route path="/graph/:projectId" element={<KnowledgeGraph />} />
            <Route path="/continuity/:projectId" element={<ContinuityReport />} />
            <Route path="/characters/:projectId" element={<CharacterProfiles />} />
            <Route path="/timeline/:projectId" element={<Timeline />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
