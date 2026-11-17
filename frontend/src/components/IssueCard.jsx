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
    const originalIssue = { ...issue };
    // Optimistic UI update: instantly update status in UI
    if (onStatusUpdate) {
      onStatusUpdate({ ...issue, status: newStatus, author_notes: authorNotes });
    }

    try {
      setLoading(true);
      const res = await continuityService.updateIssue(issue.id, {
        status: newStatus,
        author_notes: authorNotes,
      });
      if (onStatusUpdate) onStatusUpdate(res);
    } catch (err) {
      console.error('Failed to update issue status:', err);
      // Rollback on failure
      if (onStatusUpdate) onStatusUpdate(originalIssue);
    } finally {
      setLoading(false);
    }
  };

  const severityBadge = {
    high: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    medium: 'bg-[#1c1c1e]/5 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] border-[#1c1c1e]/10 dark:border-white/15',
    low: 'bg-[#1c1c1e]/3 dark:bg-white/5 text-[#636366] dark:text-[#8e8e93] border-[#1c1c1e]/10 dark:border-white/10',
  }[issue.severity.toLowerCase()] || 'bg-[#1c1c1e]/5 text-[#636366] border-[#1c1c1e]/10';

  const statusBadge = {
    unresolved: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold',
    resolved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold',
    intentional: 'bg-[#1c1c1e]/5 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] border-[#1c1c1e]/10 dark:border-white/15',
    dismissed: 'bg-[#1c1c1e]/3 dark:bg-white/5 text-[#8e8e93] border-[#1c1c1e]/10 dark:border-white/10',
    review_later: 'bg-[#1c1c1e]/5 dark:bg-white/10 text-[#636366] dark:text-[#8e8e93] border-[#1c1c1e]/10 dark:border-white/10',
  }[issue.status.toLowerCase()] || 'bg-[#1c1c1e]/5 text-[#636366] border-[#1c1c1e]/10';

  const getChapterBadgeText = () => {
    const earlier = issue.earlier_chapter_number;
    const current = issue.new_chapter_number;
    if (earlier && current && earlier !== current) {
      return `Ch ${earlier} ➔ Ch ${current}`;
    }
    if (current && earlier === current) {
      return `Ch ${current} (Internal)`;
    }
    if (current) {
      return `Chapter ${current}`;
    }
    if (earlier) {
      return `Chapter ${earlier}`;
    }
    return null;
  };

  const chapterBadgeText = getChapterBadgeText();

  return (
    <div className="bg-white dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-4 sm:p-5 shadow-2xs hover:border-[#1c1c1e]/25 dark:hover:border-white/25 transition-all text-left">
      {/* Header: Issue Type, Severity, Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1 rounded-md bg-[#1c1c1e]/5 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] border border-[#1c1c1e]/10 dark:border-white/15">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </span>
          <h4 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] capitalize tracking-tight">
            {issue.issue_type.replace(/_/g, ' ')}
          </h4>
          {chapterBadgeText && (
            <span className="text-[10px] font-mono-cap px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-semibold tracking-wide">
              {chapterBadgeText}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <span className={`text-[10px] font-mono-cap px-2 py-0.5 rounded-full border ${severityBadge} uppercase tracking-wider`}>
            {issue.severity}
          </span>
          <span className={`text-[10px] font-mono-cap px-2 py-0.5 rounded-full border ${statusBadge} capitalize`}>
            {issue.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-xs text-[#48484a] dark:text-[#8e8e93] leading-relaxed mb-4">
        {issue.explanation}
      </p>

      {/* Evidence Comparison Grid */}
      <div className="space-y-2.5 mb-4">
        {/* Earlier Canon Evidence */}
        {issue.earlier_passage && (
          <div className="bg-[#f6f6f4] dark:bg-[#1c1c1e] rounded-lg p-3 border border-[#1c1c1e]/10 dark:border-white/10">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#8e8e93] mb-1">
              <span className="flex items-center space-x-1 text-[#1c1c1e] dark:text-[#f5f5f7] font-semibold">
                <FileText className="w-3 h-3 text-[#8e8e93]" />
                <span>Established Canon (Chapter {issue.earlier_chapter_number || '?'})</span>
              </span>
            </div>
            <p className="text-xs text-[#1c1c1e] dark:text-[#f5f5f7] italic leading-snug">
              "{issue.earlier_passage}"
            </p>
          </div>
        )}

        {/* Conflicting Passage */}
        {issue.new_passage && (
          <div className="bg-[#1c1c1e]/3 dark:bg-white/[0.03] rounded-lg p-3 border border-[#1c1c1e]/10 dark:border-white/10">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#8e8e93] mb-1">
              <span className="flex items-center space-x-1 text-amber-700 dark:text-amber-400 font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Conflicting Passage (Chapter {issue.new_chapter_number || '?'})</span>
              </span>
            </div>
            <p className="text-xs text-[#1c1c1e] dark:text-[#f5f5f7] italic leading-snug">
              "{issue.new_passage}"
            </p>
          </div>
        )}
      </div>

      {/* Suggested Resolutions */}
      {issue.suggestions && issue.suggestions.length > 0 && (
        <div className="bg-[#f6f6f4] dark:bg-[#1c1c1e] rounded-lg p-3 border border-[#1c1c1e]/10 dark:border-white/10 mb-4">
          <div className="flex items-center space-x-1 text-[11px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1.5 font-mono-cap">
            <Lightbulb className="w-3.5 h-3.5 text-[#8e8e93]" />
            <span>Guardian Suggestions</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-[#48484a] dark:text-[#8e8e93] leading-relaxed pl-1">
            {issue.suggestions.map((sugg, idx) => (
              <li key={idx}>{sugg}</li>
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
            className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-[#1c1c1e] border border-[#1c1c1e]/15 dark:border-white/15 text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e] dark:focus:border-white focus:ring-1 focus:ring-[#1c1c1e] dark:focus:ring-white transition-colors"
          />
        </div>
      ) : null}

      {/* Author Sovereignty Controls */}
      <div className="pt-3 border-t border-[#1c1c1e]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[#8e8e93] font-mono-cap">
          Author Decision:
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleUpdateStatus('resolved')}
            disabled={loading || issue.status === 'resolved'}
            className="btn btn-sm text-[11px] border border-[#1c1c1e]/10 dark:border-white/10 bg-[#1c1c1e]/5 dark:bg-white/5 text-[#1c1c1e] dark:text-[#f5f5f7] hover:bg-[#1c1c1e]/10 dark:hover:bg-white/10"
            title="Mark resolved after adjusting the manuscript or notes"
          >
            <CheckCircle2 className="w-3 h-3 mr-0.5" />
            <span>Resolve</span>
          </button>

          <button
            onClick={() => handleUpdateStatus('intentional')}
            disabled={loading || issue.status === 'intentional'}
            className="btn btn-sm text-[11px] border border-[#1c1c1e]/10 dark:border-white/10 bg-[#1c1c1e]/5 dark:bg-white/5 text-[#1c1c1e] dark:text-[#f5f5f7] hover:bg-[#1c1c1e]/10 dark:hover:bg-white/10"
            title="Mark intentional if this is a deliberate twist, magic recovery, or unreliable narrator"
          >
            <BookmarkCheck className="w-3 h-3 mr-0.5" />
            <span>Intentional Twist</span>
          </button>

          <button
            onClick={() => handleUpdateStatus('dismissed')}
            disabled={loading || issue.status === 'dismissed'}
            className="btn btn-sm text-[11px] border border-[#1c1c1e]/10 dark:border-white/10 bg-[#1c1c1e]/5 dark:bg-white/5 text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]"
            title="Dismiss warning"
          >
            <EyeOff className="w-3 h-3 mr-0.5" />
            <span>Dismiss</span>
          </button>

          <button
            onClick={() => handleUpdateStatus('review_later')}
            disabled={loading || issue.status === 'review_later'}
            className="btn btn-sm text-[11px] border border-[#1c1c1e]/10 dark:border-white/10 bg-[#1c1c1e]/5 dark:bg-white/5 text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]"
            title="Defer review for later editing session"
          >
            <Clock className="w-3 h-3 mr-0.5" />
            <span>Review Later</span>
          </button>

          <button
            onClick={() => setShowNotesInput(!showNotesInput)}
            className="px-2 py-1 text-xs font-medium text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors cursor-pointer"
          >
            {showNotesInput ? 'Hide Notes' : '+ Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
