import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  GitFork,
  AlertTriangle,
  Users,
  Clock,
  ChevronRight,
  FolderOpen,
  Feather,
  LogOut,
  Paperclip,
  Menu,
  X
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentProject, onProjectChange, isDashboard: isDashboardProp }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Automatically close mobile menu whenever navigation occurs
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isDashboard = isDashboardProp ?? (location.pathname === '/dashboard');
  const projectId = currentProject?.id;
  const authorName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Guest Author');

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  if (isDashboard) {

    return (
      <header className="sticky top-0 z-50 h-16 bg-[#f6f6f4]/80 dark:bg-[#161618]/80 backdrop-blur-[14px] saturate-[180%] border-b border-[#1c1c1e]/10 dark:border-white/10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
        <div className="max-w-[1180px] h-full mx-auto flex items-center justify-between gap-4">
          {/* LEFT: Brand cluster */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <Link to={user ? "/dashboard" : "/"} className="flex items-center space-x-2.5 group">
              <div className="h-7 w-7 rounded-[7px] bg-[#1c1c1e] dark:bg-[#f5f5f7] text-white dark:text-[#1c1c1e] flex items-center justify-center font-bold text-sm tracking-tighter shadow-2xs transition-colors shrink-0">
                N
              </div>
              <span className="font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] text-[15px] tracking-tight">
                NorthStar
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-[#8e8e93] border border-[#1c1c1e]/10 dark:border-white/10 rounded-full px-2 py-0.5">
              v1.0
            </span>
          </div>

          {/* CENTER: Clean navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-[13.5px] font-medium text-[#636366] dark:text-[#8e8e93]">
            <a
              href="#projects"
              onClick={(e) => {
                if (location.pathname === '/dashboard') {
                  e.preventDefault();
                  document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-[#1c1c1e] dark:text-[#f5f5f7] font-medium transition-colors cursor-pointer"
            >
              My Projects
            </a>
          </nav>

          {/* RIGHT: ThemeToggle + Solid button + User */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <ThemeToggle className="h-8 w-8" />

            <a
              href="#projects"
              onClick={(e) => {
                if (location.pathname === '/dashboard') {
                  e.preventDefault();
                  document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="hidden sm:inline-flex btn btn-solid btn-sm text-[13px] shadow-2xs cursor-pointer"
            >
              <span>My Projects</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </a>

            {user ? (
              <div className="hidden sm:flex items-center space-x-2 pl-2.5 border-l border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
                <div className="h-6 w-6 rounded-full bg-[#1c1c1e]/10 dark:bg-white/10 flex items-center justify-center text-[#1c1c1e] dark:text-[#f5f5f7] shrink-0 font-medium text-[11px] select-none">
                  {authorName.charAt(0).toUpperCase()}
                </div>
                <span
                  className="inline-block text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] whitespace-nowrap shrink-0"
                  title={user.email || authorName}
                >
                  {authorName}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#8e8e93] hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
                <Link
                  to="/auth"
                  className="text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] hover:underline whitespace-nowrap"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile Menu Hamburger for Dashboard */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden h-8 w-8 rounded-lg border border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-center text-[#1c1c1e] dark:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown for Dashboard */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-x-0 top-16 bg-[#fcfcfb] dark:bg-[#1c1c1e] border-b border-[#1c1c1e]/10 dark:border-white/10 shadow-2xl z-50 p-4 space-y-3">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full btn btn-solid btn-md flex items-center justify-center space-x-2 text-xs shadow-2xs cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>My Story Projects</span>
            </button>

            {user ? (
              <div className="pt-3 border-t border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="h-7 w-7 rounded-full bg-[#1c1c1e]/10 dark:bg-white/10 flex items-center justify-center text-[#1c1c1e] dark:text-[#f5f5f7] font-semibold text-xs select-none">
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
                      {authorName}
                    </span>
                    <span className="block text-[10px] text-[#8e8e93] truncate max-w-[170px]">
                      {user.email || 'Author session'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#1c1c1e]/10 dark:border-white/10">
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full btn btn-outline btn-md text-xs text-center"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}
      </header>
    );
  }

  const navItems = [
    {
      label: 'Knowledge Graph',
      twoLine: ['Knowledge', 'Graph'],
      path: projectId ? `/graph/${projectId}` : null,
      icon: GitFork,
    },
    {
      label: 'Continuity Report',
      twoLine: ['Continuity', 'Report'],
      path: projectId ? `/continuity/${projectId}` : null,
      icon: AlertTriangle,
      badge: currentProject?.unresolved_issues_count,
    },
    { label: 'Characters', path: projectId ? `/characters/${projectId}` : null, icon: Users },
    { label: 'Timeline', path: projectId ? `/timeline/${projectId}` : null, icon: Clock },
    { label: 'Vault', path: projectId ? `/vault/${projectId}` : null, icon: Paperclip },
  ];

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#f6f6f4]/90 dark:bg-[#161618]/90 backdrop-blur-[14px] saturate-[180%] border-b border-[#1c1c1e]/10 dark:border-white/10 px-3 sm:px-4 lg:px-6 transition-colors duration-200">
      <div className="w-full h-full flex items-center justify-between gap-2 min-w-0">
        {/* Left Section: Brand, Project Breadcrumb, and Environment Switcher */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* 1. NorthStar logo and branding */}
          <Link to={user ? "/dashboard" : "/"} className="flex items-center space-x-2 group shrink-0">
            <div className="h-7 w-7 rounded-[7px] bg-[#1c1c1e] dark:bg-[#f5f5f7] text-white dark:text-[#1c1c1e] flex items-center justify-center font-bold text-sm tracking-tighter shadow-2xs transition-colors shrink-0">
              N
            </div>
            <div className="text-left shrink-0 hidden sm:block">
              <span className="font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] text-[13.5px] tracking-tight block leading-tight">
                NorthStar
              </span>
              <span className="text-[9px] text-[#8e8e93] font-mono-cap tracking-wider uppercase block leading-none">
                AI Continuity Guardian
              </span>
            </div>
          </Link>

          {/* 2 & 3. Dashboard and project breadcrumb */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
            <Link
              to="/dashboard"
              className="flex items-center space-x-1 text-xs font-medium text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors shrink-0"
              title="Dashboard"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Dashboard</span>
            </Link>

            {currentProject && (
              <>
                <ChevronRight className="w-3 h-3 text-[#8e8e93] shrink-0" />
                <span
                  className="text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] bg-[#1c1c1e]/5 dark:bg-white/5 border border-[#1c1c1e]/10 dark:border-white/10 px-2 py-0.5 rounded-md whitespace-nowrap min-w-[36px] max-w-[90px] sm:max-w-[150px] truncate shrink-0"
                  title={currentProject.name}
                >
                  {currentProject.name}
                </span>
              </>
            )}
          </div>

          {/* 4 & 5. Story Architect and Manuscript Workspace switcher - DESKTOP ONLY */}
          {projectId && (
            <div className="hidden sm:flex items-center bg-[#1c1c1e]/5 dark:bg-white/5 p-0.5 rounded-lg border border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
              <Link
                to={`/architect/${projectId}`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                  location.pathname.startsWith('/architect')
                    ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] shadow-2xs font-semibold'
                    : 'text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
                }`}
                title="World-building, Universe Canon & Multi-View Knowledge Graph"
              >
                <Compass className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-[#f5f5f7] shrink-0" />
                <span className="whitespace-nowrap hidden lg:inline">Story Architect</span>
              </Link>
              <Link
                to={`/workspace/${projectId}`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                  location.pathname.startsWith('/workspace')
                    ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] shadow-2xs font-semibold'
                    : 'text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
                }`}
                title="Manuscript Writing & AI Continuity Guardian"
              >
                <Feather className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-[#f5f5f7] shrink-0" />
                <span className="whitespace-nowrap hidden 2xl:inline">Manuscript Workspace</span>
                <span className="whitespace-nowrap 2xl:hidden">Workspace</span>
              </Link>
            </div>
          )}
        </div>

        {/* 6, 7, 8, 9, 10. Navigation Links (Desktop xl+) */}
        <nav className="hidden xl:flex items-center space-x-0.5 shrink">
          {navItems.map((item) => {
            if (!item.path) return null;
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path.split('/')[1]);

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] border border-[#1c1c1e]/10 dark:border-white/10 shadow-2xs font-semibold'
                    : 'text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-[#8e8e93]" />
                <span className="whitespace-nowrap hidden 2xl:inline">{item.label}</span>
                <span className="whitespace-nowrap 2xl:hidden">{item.twoLine ? item.twoLine[1] : item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono-cap bg-[#1c1c1e]/10 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] rounded-full border border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2 shrink-0 ml-auto pr-1">
          {/* Theme toggle */}
          <ThemeToggle className="h-8 w-8 shrink-0" />

          {/* Projects - Desktop only */}
          <Link
            to="/dashboard"
            className="hidden sm:inline-flex btn btn-solid btn-sm text-[13px] shadow-2xs shrink-0"
          >
            <span>Projects</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>

          {/* Profile / Username and Sign Out - Desktop only */}
          {user ? (
            <div className="hidden sm:flex items-center space-x-2 pl-2.5 border-l border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
              <div className="h-6 w-6 rounded-full bg-[#1c1c1e]/10 dark:bg-white/10 flex items-center justify-center text-[#1c1c1e] dark:text-[#f5f5f7] shrink-0 font-medium text-[11px] select-none">
                {authorName.charAt(0).toUpperCase()}
              </div>
              <span
                className="inline-block text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] whitespace-nowrap shrink-0"
                title={user.email || authorName}
              >
                {authorName}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#8e8e93] hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="hidden sm:inline-block text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] hover:underline pl-2 border-l border-[#1c1c1e]/10 dark:border-white/10 shrink-0 whitespace-nowrap"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Menu Hamburger Trigger (< sm) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden h-8 w-8 rounded-lg border border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-center text-[#1c1c1e] dark:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (visible on < sm screens when toggled) */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-x-0 top-16 bg-[#fcfcfb] dark:bg-[#1c1c1e] border-b border-[#1c1c1e]/10 dark:border-white/10 shadow-2xl z-50 p-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Workspace Mode Switcher */}
          {projectId && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block">
                Workspace Mode
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/architect/${projectId}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    location.pathname.startsWith('/architect')
                      ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] border-[#1c1c1e]/20 dark:border-white/20 shadow-2xs font-semibold'
                      : 'border-[#1c1c1e]/10 dark:border-white/10 text-[#636366] dark:text-[#8e8e93]'
                  }`}
                >
                  <Compass className="w-4 h-4 text-[#1c1c1e] dark:text-[#f5f5f7] shrink-0" />
                  <span>Story Architect</span>
                </Link>
                <Link
                  to={`/workspace/${projectId}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    location.pathname.startsWith('/workspace')
                      ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] border-[#1c1c1e]/20 dark:border-white/20 shadow-2xs font-semibold'
                      : 'border-[#1c1c1e]/10 dark:border-white/10 text-[#636366] dark:text-[#8e8e93]'
                  }`}
                >
                  <Feather className="w-4 h-4 text-[#1c1c1e] dark:text-[#f5f5f7] shrink-0" />
                  <span>Manuscript</span>
                </Link>
              </div>
            </div>
          )}

          {/* Quick World & Narrative Views */}
          {projectId && (
            <div className="space-y-1.5 pt-2 border-t border-[#1c1c1e]/10 dark:border-white/10">
              <span className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block">
                Narrative Continuum
              </span>
              <div className="grid grid-cols-1 gap-1">
                {navItems.map((item) => {
                  if (!item.path) return null;
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path.split('/')[1]);

                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] border border-[#1c1c1e]/10 dark:border-white/10 font-semibold'
                          : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className="w-4 h-4 text-[#8e8e93]" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-mono-cap bg-[#1c1c1e]/10 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] rounded-full border border-[#1c1c1e]/10 dark:border-white/10">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projects Button */}
          <div className="pt-2 border-t border-[#1c1c1e]/10 dark:border-white/10">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full btn btn-solid btn-md flex items-center justify-center space-x-2 text-xs shadow-2xs"
            >
              <FolderOpen className="w-4 h-4" />
              <span>All Projects Dashboard</span>
            </Link>
          </div>

          {/* User Profile & Sign Out in Mobile Menu */}
          <div className="pt-3 border-t border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between">
            {user ? (
              <>
                <div className="flex items-center space-x-2.5">
                  <div className="h-7 w-7 rounded-full bg-[#1c1c1e]/10 dark:bg-white/10 flex items-center justify-center text-[#1c1c1e] dark:text-[#f5f5f7] font-semibold text-xs select-none">
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
                      {authorName}
                    </span>
                    <span className="block text-[10px] text-[#8e8e93] truncate max-w-[170px]">
                      {user.email || 'Author session'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full btn btn-outline btn-md text-xs text-center"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
