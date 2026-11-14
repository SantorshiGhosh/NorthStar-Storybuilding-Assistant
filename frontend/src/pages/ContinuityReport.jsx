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
import { projectService } from '../services/api';

export default function ContinuityReport() {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadIssues = async () => {
    try {
      setLoading(true);
      const proj = await projectService.getProject(projectId);
      setProject(proj);

      const allIssues = await projectService.getIssues(projectId);
      setIssues(allIssues);
    } catch (err) {
      console.error('Failed to load continuity issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadIssues();
    }
  }, [projectId]);

  const handleStatusUpdate = (updatedIssue) => {
    setIssues(issues.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)));
    projectService.getProject(projectId).then(setProject);
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
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col">
      <Navbar currentProject={project} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-neutral-200/80 gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full w-fit mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full Narrative Audit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              Continuity Guardian Report
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Complete registry of candidate contradictions detected between new passages and established story canon.
            </p>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
          <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-xs text-left">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1">
              Total Evaluated
            </span>
            <span className="text-2xl font-bold text-neutral-900">{totalCount}</span>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-xs text-left">
            <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider block mb-1">
              Unresolved Warnings
            </span>
            <span className="text-2xl font-bold text-amber-600">{unresolvedCount}</span>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-xs text-left">
            <span className="text-[11px] font-medium text-purple-600 uppercase tracking-wider block mb-1">
              Intentional Twists
            </span>
            <span className="text-2xl font-bold text-purple-600">{intentionalCount}</span>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-xs text-left">
            <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider block mb-1">
              Resolved Issues
            </span>
            <span className="text-2xl font-bold text-emerald-600">{resolvedCount}</span>
          </div>
        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-3 rounded-xl border border-neutral-200/80">
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence quotes or issues..."
              className="pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:border-blue-500 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Issues List */}
        {loading ? (
          <div className="py-20 text-center text-xs text-neutral-400">
            Scanning narrative memory...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center text-neutral-400 text-xs">
            No continuity issues match the selected filter.
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
