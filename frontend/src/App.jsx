import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Workspace from './pages/Workspace';
import KnowledgeGraph from './pages/KnowledgeGraph';
import ContinuityReport from './pages/ContinuityReport';
import CharacterProfiles from './pages/CharacterProfiles';
import Timeline from './pages/Timeline';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
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
  return (
    <ErrorBoundary>
      <BrowserRouter>
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
      </BrowserRouter>
    </ErrorBoundary>
  );
}
