import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { productionV2Api } from '../api';

const STAGES = [
  { key: 'VALIDATING_DOCUMENT', label: 'Validate Signature & Mime' },
  { key: 'ENCRYPTING_VAULT', label: 'AES-256-GCM Vault Seal' },
  { key: 'CHUNKING_PASSAGES', label: 'Passage & Boundary Chunking' },
  { key: 'EXTRACTING_ENTITIES', label: 'Hybrid Entity Extraction' },
  { key: 'RESOLVING_IDENTITIES', label: 'Canonical Identity Resolution' },
  { key: 'BUILDING_TEMPORAL_MEMORY', label: 'Temporal Narrative Memory' },
  { key: 'TRACKING_CHARACTER_STATES', label: 'Character Physical State Machine' },
  { key: 'TRACKING_OBJECT_CUSTODY', label: 'Object Custody Chains' },
  { key: 'INDEXING_HYBRID_VECTORS', label: 'Dense & Lexical Vector Indexing' },
  { key: 'UPDATING_KNOWLEDGE_GRAPH', label: 'Knowledge Graph Synthesis' },
  { key: 'RUNNING_CONTINUITY_GUARDIAN', label: 'Continuity Guardian Verification' },
  { key: 'VERIFYING_EVIDENCE_SPANS', label: 'Strict Source-Span Certification' },
  { key: 'PREPARING_CANON_PROPOSALS', label: 'Author Canon Proposals' },
  { key: 'COMPLETED', label: 'Pipeline Ingestion Finalized' },
];

export default function JobProgressDashboard({ jobId, onComplete }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    let intervalId = null;

    const pollJob = async () => {
      try {
        const data = await productionV2Api.getJobStatus(jobId);
        setJob(data);
        setError(null);

        if (data.status === 'completed') {
          if (intervalId) clearInterval(intervalId);
          if (onComplete) onComplete(data);
        } else if (data.status === 'failed') {
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to poll job status.');
      } finally {
        setLoading(false);
      }
    };

    pollJob();
    intervalId = setInterval(pollJob, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId]);

  const handleRetry = async () => {
    if (!jobId) return;
    try {
      setRetrying(true);
      await productionV2Api.retryJob(jobId);
      // Restart polling
      const refreshed = await productionV2Api.getJobStatus(jobId);
      setJob(refreshed);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  if (!jobId) return null;

  if (loading && !job) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-sm">
        <Activity className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
        Connecting to durable job stream...
      </div>
    );
  }

  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';
  const completedStages = new Set(job?.stages_completed || []);
  const currentStageIndex = STAGES.findIndex(s => s.key === job?.current_stage);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-100">Durable Narrative Pipeline</h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            {jobId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Ingestion Complete
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-3 h-3" /> Stalled / Failed
            </span>
          )}
          {!isCompleted && !isFailed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <RefreshCw className="w-3 h-3 animate-spin" /> Processing ({job?.progress_percent?.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Current Stage: <strong className="text-slate-200">{job?.current_stage}</strong></span>
          <span className="font-mono">{job?.progress_percent?.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, job?.progress_percent || 0))}%` }}
          />
        </div>
      </div>

      {/* Failure Message and Retry Action */}
      {isFailed && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start justify-between gap-3 text-sm text-rose-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
            <div>
              <p className="font-medium text-rose-200">Execution Interrupted</p>
              <p className="text-xs text-rose-300/80">{job?.error || 'Worker paused or connection reset.'}</p>
            </div>
          </div>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 shrink-0"
          >
            {retrying ? 'Resuming...' : 'Resume Job'}
          </button>
        </div>
      )}

      {/* 14-Stage Visual Progress Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {STAGES.map((stage, idx) => {
          const isDone = completedStages.has(stage.key);
          const isCurrent = job?.current_stage === stage.key && !isCompleted;
          return (
            <div
              key={stage.key}
              className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                isDone
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : isCurrent
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : isCurrent ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className="truncate">{idx + 1}. {stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
