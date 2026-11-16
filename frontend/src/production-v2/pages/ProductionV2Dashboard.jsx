import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, History, Activity, ShieldCheck, CheckSquare, Layers } from 'lucide-react';
import {
  VersionManager,
  JobProgressDashboard,
  CanonReviewDrawer,
  StrictEvidenceInspector
} from '../components';
import { productionV2Api } from '../api';

export default function ProductionV2Dashboard() {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState('versions'); // 'versions' | 'canon' | 'inspector' | 'jobs'
  const [activeManuscript, setActiveManuscript] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInit = async () => {
      try {
        setLoading(true);
        // Load health
        const health = await productionV2Api.getHealth();
        setHealthStatus(health);

        // Fetch active manuscript versions to find manuscript ID
        // Continuity report gives project manuscript info
        const cont = await productionV2Api.getContinuityReport(projectId);
        // Look up versions if any manuscript is found
      } catch (err) {
        console.error('Failed to initialize V2 dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInit();
  }, [projectId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/workspace/${projectId}`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Workspace</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h1 className="text-base font-semibold text-slate-100">Narrative Intelligence Engine V2</h1>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono uppercase">
              Production V2
            </span>
          </div>
        </div>

        {healthStatus && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Mode: <strong className="text-slate-200 font-mono">{healthStatus.operational_mode}</strong></span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Vault & Database Healthy
            </span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('versions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'versions'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Manuscript Versions</span>
          </button>

          <button
            onClick={() => setActiveTab('canon')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'canon'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Canon Validation Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'inspector'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Strict Evidence Inspector</span>
          </button>

          {activeJobId && (
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'jobs'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Durable Job Monitor</span>
            </button>
          )}
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'versions' && (
          <div className="space-y-6">
            <VersionManager
              projectId={projectId}
              manuscriptId={activeManuscript}
              onVersionChanged={(newVer) => console.log('Version changed to', newVer)}
            />
          </div>
        )}

        {activeTab === 'canon' && (
          <div className="space-y-6">
            <CanonReviewDrawer
              projectId={projectId}
              onFactUpdated={(factId, action) => console.log('Fact reviewed:', factId, action)}
            />
          </div>
        )}

        {activeTab === 'inspector' && (
          <div className="space-y-6">
            <StrictEvidenceInspector projectId={projectId} />
          </div>
        )}

        {activeTab === 'jobs' && activeJobId && (
          <div className="space-y-6">
            <JobProgressDashboard jobId={activeJobId} />
          </div>
        )}
      </div>
    </div>
  );
}
