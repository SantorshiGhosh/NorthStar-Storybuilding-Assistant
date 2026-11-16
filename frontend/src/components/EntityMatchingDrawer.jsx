import React, { useState, useEffect } from 'react';
import {
  Users,
  GitMerge,
  ShieldAlert,
  Check,
  X,
  Link2,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { architectService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function EntityMatchingDrawer({ projectId, isOpen, onClose, onCandidateResolved }) {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    loadCandidates();
  }, [isOpen, projectId]);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const data = await architectService.getMatchingCandidates(projectId);
      setCandidates(data || []);
    } catch (err) {
      console.error('Failed to load matching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (candidateId, action, targetEntityId = null) => {
    try {
      setProcessingId(candidateId);
      await architectService.resolveMatchingCandidate(candidateId, {
        action, // 'merge', 'keep_separate', 'link_related', 'review_later'
        target_entity_id: targetEntityId,
      });
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      toast.success('Decision recorded');
      if (onCandidateResolved) {
        onCandidateResolved();
      }
    } catch (err) {
      console.error('Failed to resolve candidate:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
            <GitMerge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Entity Identity Matching Queue</h3>
            <p className="text-xs text-neutral-500">Author-in-the-loop review: AI never merges identities without your explicit approval</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info Warning Banner */}
      <div className="px-6 py-2.5 bg-purple-50/40 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/30 flex items-center space-x-2 text-[11px] text-purple-800 dark:text-purple-300">
        <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
        <span>Candidates detected during manuscript extraction with high name or profile similarity.</span>
      </div>

      {/* Candidates List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="py-20 text-center text-xs text-neutral-400">Scanning matching candidates...</div>
        ) : candidates.length === 0 ? (
          <div className="py-20 text-center">
            <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2 p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-full" />
            <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No Ambiguous Entities</h4>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
              All extracted entities are cleanly differentiated. New candidates will appear here if similar aliases are detected.
            </p>
          </div>
        ) : (
          candidates.map((cand) => {
            const isProcessing = processingId === cand.id;
            const confidencePercent = Math.round((cand.confidence || 0.85) * 100);

            return (
              <div
                key={cand.id}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 shadow-xs space-y-3"
              >
                {/* Comparison Title */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                      "{cand.candidate_name}"
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-1 rounded-md">
                      "{cand.matched_entity_name || 'Existing Entity'}"
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    {confidencePercent}% match
                  </span>
                </div>

                {/* Evidence / Reason */}
                {cand.reason && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                    <strong className="text-neutral-700 dark:text-neutral-200">AI Observation: </strong>
                    {cand.reason}
                  </p>
                )}

                {/* Source Quotes */}
                {cand.source_quote && (
                  <blockquote className="text-[11px] italic text-neutral-500 border-l-2 border-purple-300 dark:border-purple-700 pl-2 py-0.5">
                    "{cand.source_quote}"
                  </blockquote>
                )}

                {/* Author Decisions (4 Core Actions) */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleResolve(cand.id, 'merge', cand.matched_entity_id)}
                    disabled={isProcessing}
                    className="flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Merge into Existing</span>
                  </button>

                  <button
                    onClick={() => handleResolve(cand.id, 'keep_separate')}
                    disabled={isProcessing}
                    className="flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Keep Separate</span>
                  </button>

                  <button
                    onClick={() => handleResolve(cand.id, 'link_related', cand.matched_entity_id)}
                    disabled={isProcessing}
                    className="flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link as Related</span>
                  </button>

                  <button
                    onClick={() => handleResolve(cand.id, 'review_later')}
                    disabled={isProcessing}
                    className="flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Review Later</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
