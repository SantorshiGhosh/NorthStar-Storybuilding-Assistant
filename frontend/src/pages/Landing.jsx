import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  BookOpen,
  GitFork,
  Sparkles,
  ArrowRight,
  CheckCircle,
  FileText,
  AlertTriangle,
  Lock,
  Layers,
  Feather
} from 'lucide-react';
import { projectService } from '../services/api';

export default function Landing() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  const handleQuickDemo = async () => {
    try {
      setSeeding(true);
      const res = await projectService.seedDemo();
      if (res.project_id) {
        navigate(`/workspace/${res.project_id}`);
      } else {
        navigate('/dashboard');
      }
    } catch (e) {
      console.error(e);
      navigate('/dashboard');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-neutral-900 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <header className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-semibold text-neutral-900 text-base tracking-tight">
              Living Story Bible
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/auth"
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={handleQuickDemo}
              disabled={seeding}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs disabled:opacity-50"
            >
              {seeding ? 'Loading Story...' : 'Launch Demo Workspace'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Continuity Guardian for Novelists & Screenwriters</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-neutral-900 leading-[1.15] mb-6">
            Your story remembers <br />
            <span className="text-blue-600 underline decoration-blue-200 decoration-wavy underline-offset-8">
              everything.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed mb-10">
            Most AI tools try to write the next sentence. Living Story Bible remembers every single sentence you have written before—protecting your manuscript from continuity contradictions with verifiable canon evidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleQuickDemo}
              disabled={seeding}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold flex items-center justify-center space-x-2 shadow-sm transition-all"
            >
              <span>{seeding ? 'Preparing Demo...' : 'Explore Demo Story ("The Last Kingdom")'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 text-sm font-medium border border-neutral-300 shadow-2xs transition-all flex items-center justify-center"
            >
              Go to Workspace Dashboard
            </Link>
          </div>

          {/* Differentiator Subhead */}
          <p className="text-xs text-neutral-400 mt-4">
            Author Sovereignty Guaranteed: The AI never modifies or rewrites your manuscript.
          </p>
        </section>

        {/* Live Scenario Preview Card (Notion-style) */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-md p-6 sm:p-8 text-left">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-neutral-400 ml-2 font-mono">
                  Continuity Guardian &bull; Live Canon Memory
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                1 Contradiction Detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/60">
                <div className="text-xs font-semibold text-emerald-800 mb-1 flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chapter 2 &mdash; Established Canon</span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-800 italic leading-relaxed">
                  "Arin lost his left arm during the battle at Blackstone when a jagged shadowblade severed the limb beneath the shoulder."
                </p>
              </div>

              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/60">
                <div className="text-xs font-semibold text-amber-800 mb-1 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Chapter 4 &mdash; New Conflicting Passage</span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-800 italic leading-relaxed">
                  "Arin lifted his left hand to adjust his iron gauntlet, gripping his sword hilt firmly with both hands as he signaled forward."
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/70 text-xs text-neutral-700 space-y-2">
              <div className="font-semibold text-neutral-900">AI Guardian Verdict:</div>
              <p>
                Arin is depicted using his left hand/arm, directly contradicting Chapter 2 where his left arm was severed.
              </p>
              <div className="text-[11px] text-neutral-500 pt-1 flex items-center space-x-4">
                <span>&bull; Suggestion: Clarify whether Arin has received a prosthetic or adjust action to right hand.</span>
                <span className="text-blue-600 font-medium">Author control: Resolve / Mark Intentional</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3">
              Purpose-built for large, complex story worlds
            </h2>
            <p className="text-neutral-500 text-sm max-w-xl mx-auto">
              Everything you need to safeguard canon across multi-chapter novels, sequels, and cinematic scripts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-xl border border-neutral-200/80 p-6 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-2">
                Multi-Format Ingestion
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Accepts DOCX, Markdown, plain text, and PDF. Automatically divides chapters into passages with stable citation offsets.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200/80 p-6 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <GitFork className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-2">
                Interactive Knowledge Graph
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Explore your narrative as a living network of characters, locations, factions, and world rules powered by NetworkX and React Flow.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200/80 p-6 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-2">
                Confidential Vault Storage
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Your manuscripts are protected with authenticated AES-256-GCM encryption and isolated by project, ensuring creative privacy.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200/80 py-8 bg-white text-xs text-neutral-500 text-center">
        <p>Living Story Bible &mdash; AI Continuity Guardian &bull; Built for Novelists & Screenwriters</p>
      </footer>
    </div>
  );
}
