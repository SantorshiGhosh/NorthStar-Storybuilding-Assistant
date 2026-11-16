import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  BookOpen,
  GitFork,
  Sparkles,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Lock,
  Menu,
  X,
  FolderOpen
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import OrbitalCards from '../components/OrbitalCards/OrbitalCards';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Landing() {
  useDocumentTitle('Continuity Guardian for Novelists & Screenwriters');
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#faf6ef] dark:bg-[#0d1117] text-[#1c1815] dark:text-[#f0f6fc] font-inter flex flex-col selection:bg-[#7b2d3b] selection:text-[#faf6ef] transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-[#1c1815]/10 dark:border-[#30363d] bg-[#faf6ef]/90 dark:bg-[#0d1117]/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#7b2d3b] text-[#faf6ef] flex items-center justify-center shadow-xs group-hover:bg-[#5e1f2b] transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-fraunces font-medium text-[#1c1815] dark:text-[#f0f6fc] text-[19px] tracking-tight">
              NorthStar
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-medium text-[#1c1815]/70 dark:text-[#8b949e]">
            <a href="/#features" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
              Features
            </a>
            <Link to="/support" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
              Help &amp; Support
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <ThemeToggle className="h-8 w-8" />
            {user ? (
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex text-xs font-semibold px-4 py-2 rounded-lg bg-[#7b2d3b] hover:bg-[#5e1f2b] text-[#faf6ef] transition-all shadow-xs"
              >
                Workspace
              </Link>
            ) : (
              <Link
                to="/auth"
                className="hidden sm:inline-flex text-xs font-medium text-[#1c1815]/70 dark:text-[#8b949e] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] px-3 py-1.5 transition-colors"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden h-8 w-8 rounded-lg border border-[#1c1815]/15 dark:border-[#30363d] flex items-center justify-center text-[#1c1815] dark:text-[#f0f6fc] hover:bg-[#1c1815]/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-x-0 top-16 bg-[#faf6ef] dark:bg-[#161b22] border-b border-[#1c1815]/10 dark:border-[#30363d] shadow-xl p-4 space-y-3 z-50">
            {user ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-[#7b2d3b] hover:bg-[#5e1f2b] text-[#faf6ef] text-xs font-semibold shadow-xs"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Open Workspaces</span>
              </Link>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#7b2d3b] hover:bg-[#5e1f2b] text-[#faf6ef] text-xs font-semibold shadow-xs"
                >
                  <span>Get Started / Sign In</span>
                </Link>
              </div>
            )}
            <Link
              to="/support"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg border border-[#1c1815]/15 dark:border-[#30363d] text-xs font-semibold text-[#1c1815] dark:text-[#f0f6fc] hover:bg-[#1c1815]/5 dark:hover:bg-white/5 transition-colors"
            >
              <span>Help &amp; Support</span>
            </Link>
            <div className="pt-2 border-t border-[#1c1815]/10 dark:border-[#30363d] flex justify-between text-xs text-[#1c1815]/60 dark:text-[#8b949e]">
              <a href="mailto:codebrew@gmail.com" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5]">
                codebrew@gmail.com
              </a>
              <a href="tel:+18005550199" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5]">
                +919231456311
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 bg-[#faf6ef] dark:bg-[#0d1117] transition-colors duration-200">
        {/* 1. First Impression: Dynamic Orbital Cards (Narrative Guardian Showcase) */}
        <section className="w-full bg-[#faf6ef] dark:bg-[#0d1117] relative transition-colors duration-200">
          <OrbitalCards />
        </section>

        {/* 2. Hero Section with Call to Actions */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 border border-[#7b2d3b]/25 dark:border-[#7b2d3b]/40 text-[#7b2d3b] dark:text-[#fca5a5] text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5 text-[#7b2d3b] dark:text-[#fca5a5]" />
            <span>AI Continuity Guardian for Novelists &amp; Screenwriters</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-light tracking-tight text-[#1c1815] dark:text-[#f0f6fc] leading-[1.15] mb-6 font-fraunces">
            Your story remembers <br />
            <span className="text-[#7b2d3b] dark:text-[#f87171] italic underline decoration-[#7b2d3b]/30 dark:decoration-[#f87171]/40 decoration-wavy underline-offset-8">
              everything.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[#1c1815]/75 dark:text-[#8b949e] max-w-2xl mx-auto leading-relaxed mb-10">
            Most AI tools try to write the next sentence. NorthStar remembers every single sentence you have written before—protecting your manuscript from continuity contradictions with verifiable canon evidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#7b2d3b] hover:bg-[#5e1f2b] text-[#faf6ef] text-sm font-semibold flex items-center justify-center space-x-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
                <Link
                  to="/auth"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#7b2d3b] hover:bg-[#5e1f2b] text-[#faf6ef] text-sm font-semibold flex items-center justify-center space-x-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
                <Link
                  to="/auth"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#fffdfa] dark:bg-[#161b22] hover:bg-[#fbf9f4] dark:hover:bg-[#21262d] text-[#1c1815] dark:text-[#f0f6fc] text-sm font-medium border border-[#1c1815]/15 dark:border-[#30363d] shadow-2xs transition-all flex items-center justify-center"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Differentiator Subhead */}
          <p className="text-xs text-[#1c1815]/50 dark:text-[#6e7681] mt-4">
            Author Sovereignty Guaranteed: The AI never modifies or rewrites your manuscript.
          </p>
        </section>

        {/* 3. Live Scenario Preview Card */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="bg-[#fffdfa] dark:bg-[#161b22] rounded-2xl border border-[#1c1815]/10 dark:border-[#30363d] shadow-lg shadow-[#1c1815]/5 dark:shadow-black/20 p-6 sm:p-8 text-left transition-colors duration-200">
            <div className="flex items-center justify-between border-b border-[#1c1815]/10 dark:border-[#30363d] pb-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-[#1c1815]/50 dark:text-[#6e7681] ml-2 font-mono">
                  Continuity Guardian &bull; Live Canon Memory
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] border border-[#7b2d3b]/25 dark:border-[#7b2d3b]/40">
                1 Contradiction Detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#faf6ef] dark:bg-[#0d1117] rounded-xl p-4 border border-[#1c1815]/10 dark:border-[#30363d] transition-colors duration-200">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1 flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Chapter 2 &mdash; Established Canon</span>
                </div>
                <p className="text-xs sm:text-sm text-[#1c1815]/85 dark:text-[#c9d1d9] italic leading-relaxed">
                  "Arin lost his left arm during the battle at Blackstone when a jagged shadowblade severed the limb beneath the shoulder."
                </p>
              </div>

              <div className="bg-[#fdf8f4] dark:bg-[#2b1114]/40 rounded-xl p-4 border border-[#7b2d3b]/20 dark:border-[#671e24] transition-colors duration-200">
                <div className="text-xs font-semibold text-[#7b2d3b] dark:text-[#f85149] mb-1 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#7b2d3b] dark:text-[#f85149]" />
                  <span>Chapter 4 &mdash; New Conflicting Passage</span>
                </div>
                <p className="text-xs sm:text-sm text-[#1c1815]/85 dark:text-[#c9d1d9] italic leading-relaxed">
                  "Arin lifted his left hand to adjust his iron gauntlet, gripping his sword hilt firmly with both hands as he signaled forward."
                </p>
              </div>
            </div>

            <div className="bg-[#f3ece0]/70 dark:bg-[#0d1117]/80 rounded-xl p-4 border border-[#1c1815]/10 dark:border-[#30363d] text-xs text-[#1c1815]/80 dark:text-[#8b949e] space-y-2 transition-colors duration-200">
              <div className="font-semibold text-[#1c1815] dark:text-[#f0f6fc]">AI Guardian Verdict:</div>
              <p>
                Arin is depicted using his left hand/arm, directly contradicting Chapter 2 where his left arm was severed.
              </p>
              <div className="text-[11px] text-[#1c1815]/50 dark:text-[#6e7681] pt-1 flex items-center space-x-4">
                <span>&bull; Suggestion: Clarify whether Arin has received a prosthetic or adjust action to right hand.</span>
                <span className="text-[#7b2d3b] dark:text-[#fca5a5] font-medium cursor-pointer">
                  Author control: Resolve / Mark Intentional
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Feature Grid */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-light text-[#1c1815] dark:text-[#f0f6fc] mb-3 font-fraunces">
              Purpose-built for large, complex story worlds
            </h2>
            <p className="text-[#1c1815]/65 dark:text-[#8b949e] text-sm max-w-xl mx-auto">
              Everything you need to safeguard canon across multi-chapter novels, sequels, and cinematic scripts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#fffdfa] dark:bg-[#161b22] rounded-xl border border-[#1c1815]/10 dark:border-[#30363d] p-6 shadow-xs transition-colors duration-200">
              <div className="w-10 h-10 rounded-lg bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#1c1815] dark:text-[#f0f6fc] mb-2 font-fraunces">
                Multi-Format Ingestion
              </h3>
              <p className="text-xs sm:text-sm text-[#1c1815]/75 dark:text-[#8b949e] leading-relaxed">
                Accepts DOCX, Markdown, plain text, and PDF. Automatically divides chapters into passages with stable citation offsets.
              </p>
            </div>

            <div className="bg-[#fffdfa] dark:bg-[#161b22] rounded-xl border border-[#1c1815]/10 dark:border-[#30363d] p-6 shadow-xs transition-colors duration-200">
              <div className="w-10 h-10 rounded-lg bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center mb-4">
                <GitFork className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#1c1815] dark:text-[#f0f6fc] mb-2 font-fraunces">
                Interactive Knowledge Graph
              </h3>
              <p className="text-xs sm:text-sm text-[#1c1815]/75 dark:text-[#8b949e] leading-relaxed">
                Explore your narrative as a living network of characters, locations, factions, and world rules powered by NetworkX and React Flow.
              </p>
            </div>

            <div className="bg-[#fffdfa] dark:bg-[#161b22] rounded-xl border border-[#1c1815]/10 dark:border-[#30363d] p-6 shadow-xs transition-colors duration-200">
              <div className="w-10 h-10 rounded-lg bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#1c1815] dark:text-[#f0f6fc] mb-2 font-fraunces">
                Confidential Vault Storage
              </h3>
              <p className="text-xs sm:text-sm text-[#1c1815]/75 dark:text-[#8b949e] leading-relaxed">
                Your manuscripts are protected with authenticated AES-256-GCM encryption and isolated by project, ensuring creative privacy.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Comprehensive Responsive Footer */}
      <footer className="border-t border-[#1c1815]/10 dark:border-[#30363d] py-12 bg-[#faf6ef] dark:bg-[#0d1117] text-xs text-[#1c1815]/60 dark:text-[#8b949e] transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-left">
          {/* Brand Col */}
          <div className="sm:col-span-2 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#7b2d3b] text-[#faf6ef] flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-fraunces font-medium text-[#1c1815] dark:text-[#f0f6fc] text-base tracking-tight">
                NorthStar AI
              </span>
            </div>
            <p className="text-xs text-[#1c1815]/60 dark:text-[#8b949e] max-w-sm leading-relaxed">
              The calm, verifiable continuity guardian for novelists and screenwriters. AI-powered canon preservation without touching author prose.
            </p>
            <div className="pt-2 flex flex-col space-y-1.5 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[#1c1815]/50 dark:text-[#6e7681]">Email:</span>
                <a href="mailto:codebrew@gmail.com" className="text-[#7b2d3b] dark:text-[#fca5a5] hover:underline font-medium">
                  codebrew@gmail.com
                </a>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[#1c1815]/50 dark:text-[#6e7681]">Phone:</span>
                <a href="tel:+18005550199" className="text-[#7b2d3b] dark:text-[#fca5a5] hover:underline font-medium">
                  9231456311
                </a>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-xs text-[#1c1815] dark:text-[#f0f6fc] uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/support" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
                  Help &amp; Support
                </Link>
              </li>
              <li>
                <Link to={user ? "/dashboard" : "/auth"} className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
                  {user ? 'My Workspaces' : 'Get Started'}
                </Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
                  Author Login
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors cursor-pointer text-left"
                >
                  Continuity Showcase
                </button>
              </li>
            </ul>
          </div>

          {/* Integrity & Security */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-xs text-[#1c1815] dark:text-[#f0f6fc] uppercase tracking-wider">Security & Canon</h4>
            <ul className="space-y-2 text-xs">
              <li className="text-[#1c1815]/70 dark:text-[#8b949e]">
                AES-256-GCM Vault Storage
              </li>
              <li className="text-[#1c1815]/70 dark:text-[#8b949e]">
                Zero Training on Author Prose
              </li>
              <li className="text-[#1c1815]/70 dark:text-[#8b949e]">
                Author Sovereignty Protected
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar with dynamic year */}
        <div className="max-w-6xl mx-auto px-6 pt-6 border-t border-[#1c1815]/10 dark:border-[#30363d] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#1c1815]/50 dark:text-[#6e7681]">
          <p>&copy; {new Date().getFullYear()} NorthStar AI &bull; AI Continuity Guardian for Novelists &amp; Screenwriters</p>
          <div className="flex items-center space-x-4">
            <Link to="/support" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
              Help &amp; Support
            </Link>
            <span>&bull;</span>
            <a href="mailto:codebrew@gmail.com" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
              codebrew@gmail.com
            </a>
            <span>&bull;</span>
            <a href="tel:+18005550199" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors">
              +919231456311
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
