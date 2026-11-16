import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Edit3, BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import { productionV2Api } from '../api';

export default function CanonReviewDrawer({ projectId, onFactUpdated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingFactId, setEditingFactId] = useState(null);
  const [editClaimText, setEditClaimText] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const fetchPending = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await productionV2Api.getPendingCanon(projectId);
      setItems(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to fetch pending canon proposals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [projectId]);

  const handleDecision = async (factId, action, correctedText = null) => {
    try {
      setProcessingId(factId);
      await productionV2Api.reviewCanon(factId, action, correctedText);
      setItems(prev => prev.filter(item => item.fact_id !== factId));
      setEditingFactId(null);
      if (onFactUpdated) onFactUpdated(factId, action);
    } catch (err) {
      setError(err?.response?.data?.detail || `Failed to process decision '${action}'.`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-400 text-xs">
        <Sparkles className="w-4 h-4 animate-spin mx-auto mb-1 text-indigo-400" />
        Checking canon proposals...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
        All extracted facts have been validated. Canon ledger is clean.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h4 className="font-semibold text-sm text-slate-100">Author Canon Validation Queue</h4>
          <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
            {items.length} Pending Review
          </span>
        </div>
        <button
          onClick={fetchPending}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.fact_id}
            className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2 text-xs hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">
                    {item.entity_name || 'Narrative Element'}
                  </span>
                  {item.chapter_number && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      Ch. {item.chapter_number}
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {item.uncertainty_level}
                  </span>
                </div>

                {editingFactId === item.fact_id ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={editClaimText}
                      onChange={(e) => setEditClaimText(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision(item.fact_id, 'update', editClaimText)}
                        disabled={processingId === item.fact_id}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px]"
                      >
                        Save & Confirm
                      </button>
                      <button
                        onClick={() => setEditingFactId(null)}
                        className="px-2 py-0.5 text-slate-400 hover:text-white text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-300">{item.claim}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDecision(item.fact_id, 'confirm')}
                  disabled={processingId === item.fact_id}
                  title="Confirm as established canon"
                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setEditingFactId(item.fact_id);
                    setEditClaimText(item.claim);
                  }}
                  disabled={processingId === item.fact_id}
                  title="Edit claim wording"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDecision(item.fact_id, 'reject')}
                  disabled={processingId === item.fact_id}
                  title="Reject and suppress false alarms"
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Source Quote Preview */}
            {item.source_quote && (
              <div className="pt-1.5 border-t border-slate-800/80 text-[11px] text-slate-400 italic flex items-start gap-1.5">
                <BookOpen className="w-3 h-3 mt-0.5 text-slate-500 shrink-0" />
                <span>"{item.source_quote}"</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
