import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  GitFork,
  AlertTriangle,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  FolderOpen,
  Feather,
  Layers,
  LogOut,
  User as UserIcon,
  Paperclip
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentProject, onProjectChange, isDashboard: isDashboardProp }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [seeding, setSeeding] = useState(false);

  const isDashboard = isDashboardProp ?? (location.pathname === '/dashboard');
  const projectId = currentProject?.id;

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      const res = await projectService.seedDemo();
      if (res.project_id) {
        navigate(`/workspace/${res.project_id}`);
      }
    } catch (err) {
      console.error('Failed to seed demo:', err);
    } finally {
      setSeeding(false);
    }
  };

  if (isDashboard) {
    const authorName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Guest Author');

    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#eae9e4] px-2 sm:px-4 lg:px-6 py-2 sm:py-2.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 min-w-0">
          {/* Left section: Logo, Icon & Brand Name (Far left) + Dashboard Navigation Item */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Far left: NorthStar logo, icon, and brand name */}
            <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2 group shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-600 transition-colors shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="text-left shrink-0">
                <span className="font-semibold text-neutral-900 text-xs sm:text-sm tracking-tight block leading-tight">
                  NorthStar
                </span>
                <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium tracking-wide uppercase block leading-none">
                  AI Continuity Guardian
                </span>
              </div>
            </Link>

            {/* Left section: Dashboard navigation item */}
            <nav className="flex items-center shrink-0">
              <Link
                to="/dashboard"
                className="h-8 inline-flex items-center space-x-1.5 px-2.5 sm:px-3 rounded-md text-xs font-medium bg-neutral-100 text-neutral-900 shadow-2xs transition-colors shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            </nav>
          </div>

          {/* Far right: Group all remaining navigation buttons and account controls in one horizontal row */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0 ml-auto">
            <ThemeToggle className="h-8 w-8 shrink-0" />

            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              title="Load the official 'The Last Kingdom' demonstration manuscript with intentional continuity conflicts"
              className="h-8 inline-flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:border-neutral-300 transition-all shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{seeding ? 'Loading Demo...' : 'Load Demo Story'}</span>
            </button>

            <Link
              to="/dashboard"
              className="h-8 inline-flex items-center px-2.5 sm:px-3 rounded-md text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs whitespace-nowrap shrink-0"
            >
              Projects
            </Link>

            {user ? (
              <div className="flex items-center space-x-1 sm:space-x-2 pl-1.5 sm:pl-2.5 border-l border-neutral-200 dark:border-neutral-700 shrink-0">
                <span
                  className="inline-block text-xs font-medium text-neutral-600 dark:text-neutral-300 max-w-[80px] sm:max-w-[120px] truncate shrink-0"
                  title={user.email || authorName}
                >
                  {authorName}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-2 pl-1.5 sm:pl-2.5 border-l border-neutral-200 dark:border-neutral-700 shrink-0">
                <span className="inline-block text-xs font-medium text-neutral-600 dark:text-neutral-300 shrink-0">
                  Guest Author
                </span>
                <Link
                  to="/auth"
                  className="h-8 inline-flex items-center text-xs font-semibold text-blue-600 hover:underline shrink-0 whitespace-nowrap"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#eae9e4] px-2 sm:px-3 lg:px-4 xl:px-5 py-2 sm:py-2.5 transition-all">
      <div className="w-full flex items-center justify-between gap-1 sm:gap-1.5 xl:gap-2 min-w-0">
        {/* Left Section: Brand, Project Breadcrumb, and Environment Switcher */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 xl:space-x-2.5 shrink-0">
          {/* 1. NorthStar logo and branding */}
          <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2 group shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-600 transition-colors shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="text-left shrink-0">
              <span className="font-semibold text-neutral-900 text-xs sm:text-sm tracking-tight block leading-tight">
                NorthStar
              </span>
              <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium tracking-wide uppercase block leading-none">
                AI Continuity Guardian
              </span>
            </div>
          </Link>

          {/* 2 & 3. Dashboard and project breadcrumb */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 pl-1.5 sm:pl-2.5 border-l border-neutral-200 dark:border-neutral-800 shrink-0">
            <Link
              to="/dashboard"
              className="flex items-center space-x-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0"
              title="Dashboard"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Dashboard</span>
            </Link>

            {currentProject && (
              <>
                <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0" />
                <span
                  className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md whitespace-nowrap min-w-[36px] max-w-[150px] truncate shrink-0"
                  title={currentProject.name}
                >
                  {currentProject.name}
                </span>
              </>
            )}
          </div>

          {/* 4 & 5. Story Architect and Manuscript Workspace */}
          {projectId && (
            <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/80 ml-0.5 sm:ml-1 xl:ml-1.5 shrink-0">
              <Link
                to={`/architect/${projectId}`}
                className={`flex items-center space-x-1 px-1.5 sm:px-2 xl:px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  location.pathname.startsWith('/architect')
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="World-building, Universe Canon & Multi-View Knowledge Graph"
              >
                <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="whitespace-nowrap">Story Architect</span>
              </Link>
              <Link
                to={`/workspace/${projectId}`}
                className={`flex items-center space-x-1 px-1.5 sm:px-2 xl:px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  location.pathname.startsWith('/workspace')
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Manuscript Writing & AI Continuity Guardian"
              >
                <Feather className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="whitespace-nowrap">Manuscript Workspace</span>
              </Link>
            </div>
          )}
        </div>

        {/* 6, 7, 8, 9, 10. Navigation Links: Knowledge Graph (2 lines), Continuity Report (2 lines), Characters, Timeline, Vault */}
        <nav className="flex items-center space-x-0.5 sm:space-x-1 xl:space-x-1.5 shrink-0">
          {navItems.map((item) => {
            if (!item.path) return null;
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path.split('/')[1]);

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center space-x-1 sm:space-x-1.5 px-1.5 xl:px-2 2xl:px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.twoLine ? (
                  <span className="flex flex-col text-center leading-[1.15] justify-center">
                    <span>{item.twoLine[0]}</span>
                    <span>{item.twoLine[1]}</span>
                  </span>
                ) : (
                  <span className="whitespace-nowrap">{item.label}</span>
                )}
                {item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:text-[#92400e] rounded-full border border-amber-200 shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 11, 12, 13, 14, 15. Right Action buttons: Theme toggle, Load Demo Story, Projects, Profile/Username, Sign Out */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 xl:space-x-2 shrink-0 ml-auto">
          {/* 11. Theme toggle */}
          <ThemeToggle className="shrink-0" />

          {/* 12. Load Demo Story */}
          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            title="Load the official 'The Last Kingdom' demonstration manuscript with intentional continuity conflicts"
            className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:border-neutral-300 transition-all shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{seeding ? 'Loading Demo...' : 'Load Demo Story'}</span>
          </button>

          {/* 13. Projects */}
          <Link
            to="/dashboard"
            className="px-2 sm:px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs whitespace-nowrap shrink-0"
          >
            Projects
          </Link>

          {/* 14 & 15. Profile / Username and Sign Out */}
          {user ? (
            <div className="flex items-center space-x-1 sm:space-x-1.5 pl-1.5 sm:pl-2 border-l border-neutral-200 dark:border-neutral-700 shrink-0">
              <span
                className="inline-block text-xs font-medium text-neutral-600 dark:text-neutral-300 min-w-[30px] max-w-[110px] truncate shrink-0"
                title={user.email || user.full_name}
              >
                {user.full_name || user.email.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-md text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="text-xs font-semibold text-blue-600 hover:underline pl-1.5 sm:pl-2 border-l border-neutral-200 dark:border-neutral-700 shrink-0 whitespace-nowrap"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
