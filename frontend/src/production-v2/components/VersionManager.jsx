import React, { useState, useEffect } from 'react';
import { History, RotateCcw, GitCompare, CheckCircle2, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { productionV2Api } from '../api';

export default function VersionManager({ manuscriptId, projectId, onVersionChanged }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(null);

  const fetchVersions = async () => {
    if (!manuscriptId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await productionV2Api.getVersions(manuscriptId);
      setVersions(data);
      if (data.length >= 2) {
        setSelectedBase(data[1].version_number);
        setSelectedTarget(data[0].version_number);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load manuscript versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [manuscriptId]);

  const handleRollback = async (versionNumber) => {
    try {
      setRollbackLoading(true);
      await productionV2Api.rollbackVersion(manuscriptId, versionNumber, `Reverted to v${versionNumber}`);
      setShowConfirmModal(null);
      await fetchVersions();
      if (onVersionChanged) onVersionChanged(versionNumber);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to execute rollback.');
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedBase || !selectedTarget || selectedBase === selectedTarget) return;
    try {
      setCompareLoading(true);
      const diff = await productionV2Api.compareVersions(manuscriptId, selectedBase, selectedTarget);
      setCompareData(diff);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to compare versions.');
    } finally {
      setCompareLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2"></div>
        <p>Loading manuscript version ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-slate-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-slate-100">Manuscript Version Ledger</h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
            Non-Destructive Storage
          </span>
        </div>
        <button
          onClick={fetchVersions}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Refresh Ledger
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Version History Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Chapters</th>
              <th className="py-3 px-4">Words</th>
              <th className="py-3 px-4">Facts</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {versions.map((ver) => (
              <tr key={ver.version_number} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-mono font-medium text-slate-100">
                  v{ver.version_number}
                </td>
                <td className="py-3 px-4">
                  {ver.is_active ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Historical Draft</span>
                  )}
                </td>
                <td className="py-3 px-4">{ver.chapter_count}</td>
                <td className="py-3 px-4 font-mono">{ver.word_count.toLocaleString()}</td>
                <td className="py-3 px-4">{ver.fact_count}</td>
                <td className="py-3 px-4 text-xs text-slate-400">
                  {new Date(ver.created_at).toLocaleDateString()} {new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-3 px-4 text-right">
                  {!ver.is_active && (
                    <button
                      onClick={() => setShowConfirmModal(ver.version_number)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                      title="Roll back active status to this draft"
                    >
                      <RotateCcw className="w-3 h-3 text-amber-400" /> Rollback
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cross-Version Comparison Controls */}
      {versions.length >= 2 && (
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-400" /> Compare Draft Revisions
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Base Draft:</span>
              <select
                value={selectedBase || ''}
                onChange={(e) => setSelectedBase(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                {versions.map((v) => (
                  <option key={`base-${v.version_number}`} value={v.version_number}>
                    v{v.version_number} ({v.chapter_count} chs)
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-500" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Target Draft:</span>
              <select
                value={selectedTarget || ''}
                onChange={(e) => setSelectedTarget(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                {versions.map((v) => (
                  <option key={`target-${v.version_number}`} value={v.version_number}>
                    v{v.version_number} ({v.chapter_count} chs)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCompare}
              disabled={compareLoading || selectedBase === selectedTarget}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
            >
              {compareLoading ? 'Comparing...' : 'Compute Diff'}
            </button>
          </div>

          {/* Diff Result Breakdown */}
          {compareData && (
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Comparison: v{compareData.base_version} → v{compareData.target_version}</span>
                <span className={`font-mono ${compareData.word_count_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Net Word Delta: {compareData.word_count_delta >= 0 ? `+${compareData.word_count_delta}` : compareData.word_count_delta}
                </span>
              </div>

              <div className="space-y-2">
                {compareData.chapter_diffs.map((diff) => (
                  <div
                    key={diff.chapter_number}
                    className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/80 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-200">{diff.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{diff.diff_summary}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                          diff.status === 'identical'
                            ? 'bg-slate-800 text-slate-400'
                            : diff.status === 'modified'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : diff.status === 'added'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {diff.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showConfirmModal !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" /> Confirm Version Rollback
            </h4>
            <p className="text-sm text-slate-300">
              Are you sure you want to activate Version {showConfirmModal}? Your current active draft will remain safely preserved in the ledger as a historical version.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollback(showConfirmModal)}
                disabled={rollbackLoading}
                className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded font-medium disabled:opacity-50"
              >
                {rollbackLoading ? 'Restoring...' : `Activate v${showConfirmModal}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
