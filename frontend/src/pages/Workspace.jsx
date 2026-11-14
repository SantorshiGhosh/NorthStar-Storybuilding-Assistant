import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  BookOpen,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Editor from '../components/Editor';
import IssueCard from '../components/IssueCard';
import { projectService, chapterService, getCached } from '../services/api';

export default function Workspace() {
  const { projectId } = useParams();

  const cachedBundle = getCached(`project:bundle:${projectId}`);
  const cachedProj = getCached(`project:${projectId}`) || cachedBundle?.project;
  const cachedChaps = getCached(`chapters:${projectId}`) || cachedBundle?.chapters;
  const cachedIssues = getCached(`issues:${projectId}:{}`) || cachedBundle?.issues;

  const [project, setProject] = useState(() => cachedProj || null);
  const [chapters, setChapters] = useState(() => Array.isArray(cachedChaps) ? cachedChaps : []);
  const [selectedChapterId, setSelectedChapterId] = useState(() => cachedChaps?.[0]?.id || null);
  const [currentChapter, setCurrentChapter] = useState(() => cachedChaps?.[0] || null);
  const [issues, setIssues] = useState(() => Array.isArray(cachedIssues) ? cachedIssues : []);
  const [loading, setLoading] = useState(() => !cachedProj && !cachedBundle);
  const [analyzing, setAnalyzing] = useState(false);
  const [issueFilter, setIssueFilter] = useState('all'); // all, unresolved, high

  // Load project details and chapters using the fast bundle endpoint (1 roundtrip)
  const loadWorkspaceData = async () => {
    try {
      if (!project) setLoading(true);
      // Fetch combined bundle in a single network roundtrip
      try {
        const bundle = await projectService.getProjectBundle(projectId);
        if (bundle && bundle.project) {
          setProject(bundle.project);
          const safeChaps = Array.isArray(bundle.chapters) ? bundle.chapters : [];
          setChapters(safeChaps);
          setIssues(Array.isArray(bundle.issues) ? bundle.issues : []);

          if (safeChaps.length > 0) {
            const activeId = selectedChapterId || safeChaps[0].id;
            setSelectedChapterId(activeId);
            const found = safeChaps.find((c) => c.id === activeId) || safeChaps[0];
            setCurrentChapter(found);
          }
          return;
        }
      } catch (e) {
        // Fallback to parallel requests if bundle route is unavailable
      }

      const [proj, chaps, projIssues] = await Promise.all([
        projectService.getProject(projectId),
        chapterService.getChapters(projectId),
        projectService.getIssues(projectId),
      ]);

      setProject(proj);
      const safeChaps = Array.isArray(chaps) ? chaps : [];
      setChapters(safeChaps);
      setIssues(Array.isArray(projIssues) ? projIssues : []);

      if (safeChaps.length > 0) {
        const targetId = selectedChapterId || safeChaps[0].id;
        setSelectedChapterId(targetId);
        const chData = await chapterService.getChapter(targetId);
        setCurrentChapter(chData);
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadWorkspaceData();
    }
  }, [projectId]);

  // Handle chapter selection
  const handleSelectChapter = async (chapId) => {
    setSelectedChapterId(chapId);
    try {
      const chData = await chapterService.getChapter(chapId);
      setCurrentChapter(chData);
    } catch (err) {
      console.error('Failed to switch chapter:', err);
    }
  };

  // Handle adding new chapter
  const handleAddChapter = async (newChapData) => {
    try {
      const created = await chapterService.createChapter(projectId, newChapData);
      setChapters([...chapters, created]);
      setSelectedChapterId(created.id);
      setCurrentChapter(created);
    } catch (err) {
      console.error('Failed to add chapter:', err);
    }
  };

  // Handle editor save
  const handleSaveEditor = async (htmlContent, plainContent) => {
    if (!currentChapter) return;
    try {
      await chapterService.updateChapter(currentChapter.id, {
        content: plainContent,
      });
      // Refresh chapter list for word count
      const updatedChaps = await chapterService.getChapters(projectId);
      setChapters(updatedChaps);
    } catch (err) {
      console.error('Failed to save chapter:', err);
    }
  };

  // Handle live Continuity Guardian analysis
  const handleAnalyzeChapter = async () => {
    if (!currentChapter) return;
    try {
      setAnalyzing(true);
      const res = await chapterService.analyzeChapter(currentChapter.id);

      // Refresh issues list and project stats
      const projIssues = await projectService.getIssues(projectId);
      setIssues(projIssues);
      const proj = await projectService.getProject(projectId);
      setProject(proj);
    } catch (err) {
      console.error('Failed to analyze chapter:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Status update on an issue
  const handleStatusUpdate = (updatedIssue) => {
    setIssues(issues.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)));
    // Refresh project summary
    projectService.getProject(projectId).then(setProject);
  };

  // Filter issues for current view
  const currentChapterIssues = issues.filter(
    (i) => i.chapter_id === selectedChapterId || i.new_chapter_number === currentChapter?.chapter_number
  );

  const displayedIssues = issues.filter((i) => {
    if (issueFilter === 'unresolved') return i.status === 'unresolved';
    if (issueFilter === 'high') return i.severity === 'high';
    if (issueFilter === 'current_chapter') {
      return i.chapter_id === selectedChapterId || i.new_chapter_number === currentChapter?.chapter_number;
    }
    return true;
  });

  if (loading && !project) {
    return (
      <div className="h-screen flex flex-col bg-[#fbfbf9] overflow-hidden">
        <Navbar currentProject={null} />
        <div className="flex-1 flex overflow-hidden animate-pulse">
          {/* Column 1 Skeleton: Sidebar */}
          <div className="w-64 bg-white border-r border-neutral-200/80 p-4 space-y-3 shrink-0">
            <div className="h-4 bg-neutral-200 rounded-md w-3/4 mb-4" />
            <div className="h-8 bg-neutral-100 rounded-lg w-full" />
            <div className="h-8 bg-neutral-100 rounded-lg w-full" />
            <div className="h-8 bg-neutral-100 rounded-lg w-full" />
            <div className="h-8 bg-neutral-100 rounded-lg w-full" />
          </div>
          {/* Column 2 Skeleton: Editor */}
          <div className="flex-1 p-4 flex flex-col space-y-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-6 flex-1 space-y-4">
              <div className="h-7 bg-neutral-200 rounded-md w-1/3" />
              <div className="h-8 bg-neutral-100 rounded-lg w-full" />
              <div className="space-y-2.5 pt-4">
                <div className="h-4 bg-neutral-100 rounded-md w-full" />
                <div className="h-4 bg-neutral-100 rounded-md w-11/12" />
                <div className="h-4 bg-neutral-100 rounded-md w-4/5" />
                <div className="h-4 bg-neutral-100 rounded-md w-full" />
                <div className="h-4 bg-neutral-100 rounded-md w-3/4" />
              </div>
            </div>
          </div>
          {/* Column 3 Skeleton: Guardian Panel */}
          <div className="w-80 lg:w-96 bg-white border-l border-neutral-200/80 p-4 space-y-4 shrink-0">
            <div className="flex items-center space-x-2 pb-3 border-b border-neutral-100">
              <div className="w-6 h-6 rounded-md bg-blue-100" />
              <div className="h-4 bg-neutral-200 rounded-md w-36" />
            </div>
            <div className="h-32 bg-neutral-50 rounded-xl border border-neutral-200/80 p-4 space-y-2" />
            <div className="h-32 bg-neutral-50 rounded-xl border border-neutral-200/80 p-4 space-y-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#fbfbf9] overflow-hidden">
      <Navbar currentProject={project} />

      {/* 3-Column Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUMN 1: LEFT CHAPTER TREE & OUTLINE */}
        <Sidebar
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          onSelectChapter={handleSelectChapter}
          onAddChapter={handleAddChapter}
          projectName={project?.name}
        />

        {/* COLUMN 2: CENTRE TIPTAP WRITING CANVAS */}
        <section className="flex-1 flex flex-col p-4 overflow-hidden">
          {currentChapter ? (
            <Editor
              initialContent={currentChapter.content}
              chapterTitle={currentChapter.title}
              onSave={handleSaveEditor}
              onAnalyze={handleAnalyzeChapter}
              analyzing={analyzing}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-neutral-200 text-xs text-neutral-400">
              No chapter selected. Pick a chapter from the sidebar.
            </div>
          )}
        </section>

        {/* COLUMN 3: RIGHT AI GUARDIAN PANEL */}
        <aside className="w-80 lg:w-96 h-full bg-white border-l border-neutral-200/80 flex flex-col overflow-hidden text-left shadow-2xs">
          {/* Guardian Panel Header */}
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-900 tracking-tight">
                  AI Continuity Guardian
                </h3>
                <span className="text-[10px] text-neutral-400 font-medium">
                  Evidence-Backed Narrative Memory
                </span>
              </div>
            </div>

            <button
              onClick={handleAnalyzeChapter}
              disabled={analyzing}
              title="Run live continuity scan"
              className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="px-4 py-2 border-b border-neutral-100 flex items-center space-x-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => setIssueFilter('all')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                issueFilter === 'all' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              All ({issues.length})
            </button>
            <button
              onClick={() => setIssueFilter('unresolved')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                issueFilter === 'unresolved' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              Unresolved ({issues.filter(i => i.status === 'unresolved').length})
            </button>
            <button
              onClick={() => setIssueFilter('current_chapter')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                issueFilter === 'current_chapter' ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              This Chapter ({currentChapterIssues.length})
            </button>
          </div>

          {/* Issues List Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {displayedIssues.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                <CheckCircle className="w-8 h-8 text-emerald-500 mb-2 stroke-1" />
                <h4 className="text-xs font-semibold text-neutral-800 mb-1">
                  Canon is Coherent
                </h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  No active contradictions detected in this view. Click "Analyze Chapter" above to run a deep scan against established story facts.
                </p>
              </div>
            ) : (
              displayedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onStatusUpdate={handleStatusUpdate}
                />
              ))
            )}
          </div>

          {/* Author Sovereignty Note */}
          <div className="p-3 bg-neutral-50 border-t border-neutral-100 text-[10px] text-neutral-400 text-center">
            Author Rule: The AI never alters your prose. You decide what is canon.
          </div>
        </aside>
      </div>
    </div>
  );
}
