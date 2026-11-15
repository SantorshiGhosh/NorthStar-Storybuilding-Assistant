import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
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

export default function Navbar({ currentProject, onProjectChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [seeding, setSeeding] = useState(false);

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

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: FolderOpen },
    { label: 'Story Architect', path: projectId ? `/architect/${projectId}` : null, icon: Compass },
    { label: 'Workspace', path: projectId ? `/workspace/${projectId}` : null, icon: BookOpen },
    { label: 'Knowledge Graph', path: projectId ? `/graph/${projectId}` : null, icon: GitFork },
    { label: 'Continuity Report', path: projectId ? `/continuity/${projectId}` : null, icon: AlertTriangle, badge: currentProject?.unresolved_issues_count },
    { label: 'Characters', path: projectId ? `/characters/${projectId}` : null, icon: Users },
    { label: 'Timeline', path: projectId ? `/timeline/${projectId}` : null, icon: Clock },
    { label: 'Vault', path: projectId ? `/vault/${projectId}` : null, icon: Paperclip },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#eae9e4] px-4 lg:px-8 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Project Breadcrumb */}
        <div className="flex items-center space-x-3">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-600 transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-neutral-900 text-sm tracking-tight block leading-tight">
                NorthStar
              </span>
              <span className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase block">
                AI Continuity Guardian
              </span>
            </div>
          </Link>

          {currentProject && (
            <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-neutral-200">
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs font-medium text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md truncate max-w-[160px]">
                {currentProject.name}
              </span>
            </div>
          )}

          {/* Prominent Environment Switcher for Project */}
          {projectId && (
            <div className="hidden lg:flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/80 ml-3">
              <Link
                to={`/architect/${projectId}`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  location.pathname.startsWith('/architect')
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="World-building, Universe Canon & Multi-View Knowledge Graph"
              >
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                <span>Story Architect</span>
              </Link>
              <Link
                to={`/workspace/${projectId}`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  location.pathname.startsWith('/workspace')
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Manuscript Writing & AI Continuity Guardian"
              >
                <Feather className="w-3.5 h-3.5 text-emerald-600" />
                <span>Manuscript Workspace</span>
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            if (!item.path) return null;
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path.split('/')[1]);

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:text-[#92400e] rounded-full border border-amber-200">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2.5">
          <ThemeToggle />

          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            title="Load the official 'The Last Kingdom' demonstration manuscript with intentional continuity conflicts"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:border-neutral-300 transition-all shadow-2xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{seeding ? 'Loading Demo...' : 'Load Demo Story'}</span>
          </button>

          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs"
          >
            Projects
          </Link>

          {user ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-neutral-200 dark:border-neutral-700">
              <span
                className="hidden xl:inline-block text-xs font-medium text-neutral-600 dark:text-neutral-300 max-w-[130px] truncate"
                title={user.email}
              >
                {user.full_name || user.email.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-md text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="text-xs font-semibold text-blue-600 hover:underline pl-2 border-l border-neutral-200 dark:border-neutral-700"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
