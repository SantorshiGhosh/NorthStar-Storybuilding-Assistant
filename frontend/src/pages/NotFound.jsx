import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft, Home, FolderOpen } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function NotFound() {
  useDocumentTitle('404 Not Found');
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <header className="h-16 border-b border-[#1c1c1e]/10 dark:border-white/10 px-4 sm:px-6 lg:px-8 bg-[#f6f6f4]/80 dark:bg-[#161618]/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-[1180px] h-full mx-auto flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center space-x-2.5 group">
            <div className="h-7 w-7 rounded-[7px] bg-[#1c1c1e] dark:bg-[#f5f5f7] text-white dark:text-[#1c1c1e] flex items-center justify-center font-bold text-sm tracking-tighter shadow-2xs transition-colors shrink-0">
              N
            </div>
            <span className="font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] text-[15px] tracking-tight">
              NorthStar
            </span>
          </Link>

          <div className="flex items-center space-x-3">
            <ThemeToggle className="h-8 w-8" />
            <Link
              to={user ? "/dashboard" : "/"}
              className="btn btn-outline btn-sm text-xs shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main 404 Canvas */}
      <main className="flex-1 relative flex items-center justify-center px-4 sm:px-6 py-16 overflow-hidden">
        {/* Dotted engineering grid background */}
        <div className="absolute inset-0 graphite-grid-bg pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f6f6f4]/40 to-[#f6f6f4] dark:via-[#161618]/40 dark:to-[#161618] pointer-events-none" />

        <div className="relative max-w-lg w-full text-center p-8 rounded-2xl bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/25">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1c1c1e]/10 dark:border-white/10 bg-[#f6f6f4] dark:bg-[#222224] px-3 py-1 shadow-2xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-mono-cap text-[#8e8e93]">
              STATUS 404 &bull; MISSING COORDINATE
            </span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-[#1c1c1e]/5 dark:bg-white/5 border border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-center mx-auto mb-6">
            <Compass className="w-8 h-8 text-[#8e8e93]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1c1c1e] dark:text-[#f5f5f7] mb-3">
            Page Not Found
          </h1>

          <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] leading-relaxed mb-8 max-w-md mx-auto">
            The narrative link, chapter, or coordinate you requested does not exist in NorthStar canon memory. It may have been relocated, deleted, or unindexed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto btn btn-solid btn-md flex items-center justify-center space-x-2 text-xs shadow-2xs"
              >
                <FolderOpen className="w-4 h-4 mr-1" />
                <span>Return to Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/"
                className="w-full sm:w-auto btn btn-solid btn-md flex items-center justify-center space-x-2 text-xs shadow-2xs"
              >
                <Home className="w-4 h-4 mr-1" />
                <span>Return to Home</span>
              </Link>
            )}
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="w-full sm:w-auto btn btn-outline btn-md flex items-center justify-center space-x-2 text-xs shadow-2xs"
            >
              <span>{user ? 'My Workspaces' : 'Sign In'}</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c1c1e]/10 dark:border-white/10 bg-[#f6f6f4] dark:bg-[#161618] py-6 text-xs text-[#8e8e93] transition-colors">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>&copy; {new Date().getFullYear()} NorthStar AI &bull; AI Continuity Guardian</span>
          <div className="flex items-center space-x-4">
            <a href="mailto:codebrew@gmail.com" className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors">
              codebrew@gmail.com
            </a>
            <span className="text-[#8e8e93]/40">&bull;</span>
            <a href="tel:+18005550199" className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors">
              9231456311
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
