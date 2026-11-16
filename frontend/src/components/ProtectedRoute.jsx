import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f4] dark:bg-neutral-950 flex flex-col items-center justify-center p-6">
        <div className="flex items-center space-x-3 text-xs text-neutral-500 font-mono animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
          <span>Verifying secure author session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}
