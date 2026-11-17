import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  BookmarkCheck,
  EyeOff,
  Filter,
  ShieldCheck,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import Navbar from '../components/Navbar';
import IssueCard from '../components/IssueCard';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { projectService, chapterService, getCached } from '../services/api';

export default function ContinuityReport() {
  const { projectId } = useParams();
  const toast = useToast();

  const cachedProj = getCached(`project:${projectId}`);
  const cachedIssues = getCached(`issues:${projectId}:{}`) || getCached(`issues:${projectId}`);
  const cachedChaps = getCached(`chapters:${projectId}`);

  const [project, setProject] = useState(() => cachedProj || null);
  useDocumentTitle(project?.name ? `${project.name} | Continuity Report` : 'Continuity Report');
  const [chapters, setChapters] = useState(() => Array.isArray(cachedChaps) ? cachedChaps : []);
  const [issues, setIssues] = useState(() => cachedIssues || []);
  const [loading, setLoading] = useState(() => !cachedIssues);

  // Filters
  const [activeTab, setActiveTab] = useState('all');
  const [selectedChapterFilter, setSelectedChapterFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadIssues = async (showLoading = !issues.length) => {
    try {
      if (showLoading) setLoading(true);
      const [proj, allIssues, chaps] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getIssues(projectId),
        chapterService.getChapters(projectId).catch(() => []),
      ]);
      setProject(proj);
      setIssues(allIssues);
      if (Array.isArray(chaps)) setChapters(chaps);
    } catch (err) {
      console.error('Failed to load continuity issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadIssues(!cachedIssues);
    }
  }, [projectId]);

  const handleStatusUpdate = (updatedIssue) => {
    setIssues(issues.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)));
    projectService.getProject(projectId).then(setProject);
    toast.success(`Contradiction marked as ${updatedIssue.status}`);
  };

  const filterTabs = [
    { id: 'all', label: 'All Issues' },
    { id: 'high', label: 'High Severity' },
    { id: 'physical_continuity', label: 'Character Conflicts' },
    { id: 'lore_rule_violation', label: 'World-Building Rules' },
    { id: 'location_conflict', label: 'Location Conflicts' },
    { id: 'timeline_inconsistency', label: 'Timeline Conflicts' },
    { id: 'review_later', label: 'Review Later' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'intentional', label: 'Intentional Twists' },
    { id: 'dismissed', label: 'Dismissed' },
  ];

  const filteredIssues = issues.filter((issue) => {
    // Chapter filter
    if (selectedChapterFilter !== 'all') {
      const chNum = Number(selectedChapterFilter);
      const matchesChapter =
        issue.new_chapter_number === chNum ||
        issue.earlier_chapter_number === chNum ||
        (Array.isArray(issue.evidence) && issue.evidence.some((ev) => ev.chapter === chNum));
      if (!matchesChapter) return false;
    }

    // Tab filter
    if (activeTab === 'high' && issue.severity.toLowerCase() !== 'high') return false;
    if (activeTab === 'physical_continuity' && issue.issue_type !== 'physical_continuity') return false;
    if (activeTab === 'lore_rule_violation' && issue.issue_type !== 'lore_rule_violation') return false;
    if (activeTab === 'location_conflict' && issue.issue_type !== 'location_conflict') return false;
    if (activeTab === 'timeline_inconsistency' && issue.issue_type !== 'timeline_inconsistency') return false;
    if (activeTab === 'review_later' && issue.status !== 'review_later') return false;
    if (activeTab === 'resolved' && issue.status !== 'resolved') return false;
    if (activeTab === 'intentional' && issue.status !== 'intentional') return false;
    if (activeTab === 'dismissed' && issue.status !== 'dismissed') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        issue.explanation.toLowerCase().includes(q) ||
        (issue.earlier_passage && issue.earlier_passage.toLowerCase().includes(q)) ||
        (issue.new_passage && issue.new_passage.toLowerCase().includes(q))
      );
    }

    return true;
  });

  // Summary Metrics
  const totalCount = issues.length;
  const unresolvedCount = issues.filter((i) => i.status === 'unresolved' || i.status === 'open').length;
  const intentionalCount = issues.filter((i) => i.status === 'intentional').length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      <Navbar currentProject={project} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#1c1c1e]/10 dark:border-white/10 gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] bg-[#1c1c1e]/5 dark:bg-white/10 border border-[#1c1c1e]/10 dark:border-white/10 px-2.5 py-0.5 rounded-full w-fit mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full Narrative Audit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1c1e] dark:text-[#f5f5f7] tracking-tight">
              Continuity Guardian Report
            </h1>
            <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
              Complete registry of candidate contradictions detected between new passages and established story canon.
            </p>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
          <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-4 shadow-2xs text-left">
            <span className="text-[11px] font-medium text-[#8e8e93] uppercase tracking-wider block mb-1">
              Total Evaluated
            </span>
            <span className="text-2xl font-bold text-[#1c1c1e] dark:text-[#f5f5f7]">{totalCount}</span>
          </div>

          <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-4 shadow-2xs text-left">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
              Unresolved Warnings
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{unresolvedCount}</span>
          </div>

          <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-4 shadow-2xs text-left">
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-1">
              Intentional Twists
            </span>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{intentionalCount}</span>
          </div>

          <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-4 shadow-2xs text-left">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
              Resolved Issues
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedCount}</span>
          </div>
        </div>

        {/* Chapter Scope Filter */}
        {chapters.length > 0 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
            <span className="text-[11px] font-semibold text-[#8e8e93] font-mono-cap flex items-center space-x-1 shrink-0 mr-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Chapter:</span>
            </span>
            <button
              onClick={() => setSelectedChapterFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-mono-cap transition-colors cursor-pointer shrink-0 ${
                selectedChapterFilter === 'all'
                  ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] font-semibold shadow-2xs'
                  : 'bg-[#1c1c1e]/5 dark:bg-white/5 text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
              }`}
            >
              All Chapters ({issues.length})
            </button>
            {chapters.map((ch) => {
              const chIssueCount = issues.filter(
                (i) =>
                  i.new_chapter_number === ch.chapter_number ||
                  i.earlier_chapter_number === ch.chapter_number ||
                  (Array.isArray(i.evidence) && i.evidence.some((ev) => ev.chapter === ch.chapter_number))
              ).length;
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChapterFilter(ch.chapter_number)}
                  className={`px-3 py-1 rounded-full text-xs font-mono-cap transition-colors cursor-pointer shrink-0 ${
                    selectedChapterFilter === ch.chapter_number
                      ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] font-semibold shadow-2xs'
                      : 'bg-[#1c1c1e]/5 dark:bg-white/5 text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
                  }`}
                >
                  Chapter {ch.chapter_number} ({chIssueCount})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Navigation & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-[#fcfcfb] dark:bg-[#222224] p-3 rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 shadow-2xs">
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs font-semibold'
                    : 'text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence quotes or issues..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Issues List */}
        {loading && issues.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-5 shadow-xs animate-pulse">
                <div className="flex items-center justify-between pb-3 border-b border-[#1c1c1e]/10 dark:border-white/10 mb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-5 w-24 bg-neutral-200 rounded-full" />
                    <div className="h-4 w-32 bg-neutral-200 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-neutral-200 rounded" />
                </div>
                <div className="h-4 w-3/4 bg-neutral-200 rounded mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="h-20 bg-neutral-100 rounded-lg" />
                  <div className="h-20 bg-neutral-100 rounded-lg" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <div className="h-7 w-40 bg-neutral-200 rounded-lg" />
                  <div className="flex space-x-2">
                    <div className="h-7 w-20 bg-neutral-200 rounded-lg" />
                    <div className="h-7 w-20 bg-neutral-200 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-12 text-center text-[#8e8e93] text-xs">
            {selectedChapterFilter !== 'all' ? (
              <p>
                No continuity contradictions found for Chapter {selectedChapterFilter}.{' '}
                <button
                  onClick={() => setSelectedChapterFilter('all')}
                  className="text-[#1c1c1e] dark:text-[#f5f5f7] underline font-medium cursor-pointer ml-1"
                >
                  View all chapters ({issues.length})
                </button>
              </p>
            ) : (
              'No continuity issues match the selected filter.'
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
