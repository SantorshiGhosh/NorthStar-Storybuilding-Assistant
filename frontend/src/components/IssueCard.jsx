import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  BookmarkCheck,
  EyeOff,
  HelpCircle,
  Lightbulb,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { continuityService } from '../services/api';

export default function IssueCard({ issue, onStatusUpdate }) {
  const [loading, setLoading] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [authorNotes, setAuthorNotes] = useState(issue.author_notes || '');

  const handleUpdateStatus = async (newStatus) => {
    try {
      setLoading(true);
      const res = await continuityService.updateIssue(issue.id, {
        status: newStatus,
        author_notes: authorNotes,
      });
      if (onStatusUpdate) onStatusUpdate(res);
    } catch (err) {
      console.error('Failed to update issue status:', err);
    } finally {
      setLoading(false);
    }
  };

  const severityBadge = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-blue-50 text-blue-700 border-blue-200',
  }[issue.severity.toLowerCase()] || 'bg-neutral-100 text-neutral-700 border-neutral-200';

  const statusBadge = {
    unresolved: 'bg-amber-50 text-amber-800 border-amber-200',
    resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    intentional: 'bg-purple-50 text-purple-800 border-purple-200',
    dismissed: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    review_later: 'bg-blue-50 text-blue-800 border-blue-200',
  }[issue.status.toLowerCase()] || 'bg-neutral-100 text-neutral-700 border-neutral-200';

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-5 shadow-xs hover:border-neutral-300 transition-all text-left">
      {/* Header: Issue Type, Severity, Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1 rounded-md bg-amber-50 text-amber-600 border border-amber-200/60">
            <AlertTriangle className="w-4 h-4" />
          </span>
          <h4 className="text-sm font-semibold text-neutral-900 capitalize">
            {issue.issue_type.replace(/_/g, ' ')}
          </h4>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${severityBadge} uppercase tracking-wider`}>
            {issue.severity}
          </span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusBadge} capitalize`}>
            {issue.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed mb-4">
        {issue.explanation}
      </p>

      {/* Evidence Comparison Grid */}
      <div className="space-y-2.5 mb-4">
        {/* Earlier Canon Evidence */}
        {issue.earlier_passage && (
          <div className="bg-neutral-50/80 rounded-lg p-3 border border-neutral-200/60">
            <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500 mb-1">
              <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                <FileText className="w-3 h-3" />
                <span>Established Canon (Chapter {issue.earlier_chapter_number || '?'})</span>
              </span>
            </div>
            <p className="text-xs text-neutral-800 italic leading-snug">
              "{issue.earlier_passage}"
            </p>
          </div>
        )}

        {/* Conflicting Passage */}
        {issue.new_passage && (
          <div className="bg-amber-50/40 rounded-lg p-3 border border-amber-200/60">
            <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500 mb-1">
              <span className="flex items-center space-x-1 text-amber-800 font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Conflicting Passage (Chapter {issue.new_chapter_number || '?'})</span>
              </span>
            </div>
            <p className="text-xs text-neutral-800 italic leading-snug">
              "{issue.new_passage}"
            </p>
          </div>
        )}
      </div>

      {/* Suggested Resolutions */}
      {issue.suggestions && issue.suggestions.length > 0 && (
        <div className="bg-blue-50/40 rounded-lg p-3 border border-blue-100 mb-4">
          <div className="flex items-center space-x-1 text-[11px] font-semibold text-blue-900 mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Continuity Guardian Suggestions</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-neutral-700 leading-relaxed pl-1">
            {issue.suggestions.map((sugg, idx) => (
              <li key={idx} className="marker:text-blue-500">{sugg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Author Notes toggle */}
      {showNotesInput ? (
        <div className="mb-3 space-y-1.5">
          <textarea
            value={authorNotes}
            onChange={(e) => setAuthorNotes(e.target.value)}
            placeholder="Author's canon notes (e.g., 'Arin received a runic iron gauntlet in chapter 3.5')..."
            rows={2}
            className="w-full text-xs p-2 rounded-md border border-neutral-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ) : null}

      {/* Author Sovereignty Controls */}
      <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-400">
          Author Decision:
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleUpdateStatus('resolved')}
            disabled={loading || issue.status === 'resolved'}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-100 text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent transition-colors disabled:opacity-40"
            title="Mark resolved after adjusting the manuscript or notes"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Resolve</span>
          </button>

          <button
            onClick={() => handleUpdateStatus('intentional')}
            disabled={loading || issue.status === 'intentional'}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-100 text-neutral-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 border border-transparent transition-colors disabled:opacity-40"
            title="Mark intentional if this is a deliberate twist, magic recovery, or unreliable narrator"
          >
            <BookmarkCheck className="w-3 h-3" />
            <span>Intentional Twist</span>
          </button>

          <button
            onClick={() => handleUpdateStatus('dismissed')}
            disabled={loading || issue.status === 'dismissed'}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-transparent transition-colors disabled:opacity-40"
            title="Dismiss warning"
          >
            <EyeOff className="w-3 h-3" />
            <span>Dismiss</span>
          </button>

          <button
            onClick={() => setShowNotesInput(!showNotesInput)}
            className="px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            {showNotesInput ? 'Hide Notes' : '+ Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
