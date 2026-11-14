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
  RefreshCw,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  Minimize2,
  Maximize2,
  RotateCcw,
  Layout
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Editor from '../components/Editor';
import IssueCard from '../components/IssueCard';
import { projectService, chapterService, getCached } from '../services/api';

const PANELS_STORAGE_KEY = 'northstar_workspace_panels';

// Helper to load persisted panel states from localStorage
const getSavedPanelState = () => {
  try {
    const saved = localStorage.getItem(PANELS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        left: typeof parsed.left === 'boolean' ? parsed.left : true,
        center: typeof parsed.center === 'boolean' ? parsed.center : true,
        right: typeof parsed.right === 'boolean' ? parsed.right : true,
      };
    }
  } catch (e) {
    console.warn('Failed to parse saved panel state:', e);
  }
  return { left: true, center: true, right: true };
};

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

  // Panel Collapsible Visibility State & Persistence
  const initialPanels = getSavedPanelState();
  const [isLeftOpen, setIsLeftOpen] = useState(initialPanels.left);
  const [isCenterOpen, setIsCenterOpen] = useState(initialPanels.center);
  const [isRightOpen, setIsRightOpen] = useState(initialPanels.right);

  // Sync panel states to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        PANELS_STORAGE_KEY,
        JSON.stringify({ left: isLeftOpen, center: isCenterOpen, right: isRightOpen })
      );
    } catch (e) {
      console.warn('Failed to persist panel state:', e);
    }
  }, [isLeftOpen, isCenterOpen, isRightOpen]);

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
      // Auto-open Right Guardian Panel so author immediately sees the scanning progress and results
      setIsRightOpen(true);

      const res = await chapterService.analyzeChapter(currentChapter.id, currentChapter.content, projectId);

      // If backend returned the full issues list directly, set state immediately
      if (res && Array.isArray(res.issues) && res.issues.length > 0) {
        setIssues(res.issues);
      }

      // Switch active filter tab to 'all' so author sees all detected issues immediately
      setIssueFilter('all');

      // Also refresh project issues and stats with forceRefresh
      try {
        const projIssues = await projectService.getIssues(projectId, { forceRefresh: true });
        if (Array.isArray(projIssues) && projIssues.length > 0) {
          setIssues(projIssues);
        }
      } catch (silentErr) {
        console.warn('Silent issues refresh skipped:', silentErr);
      }

      projectService.getProject(projectId, { forceRefresh: true }).then(setProject).catch(console.error);
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

  // Count unresolved issues for live indicator badge
  const unresolvedCount = issues.filter(
    (i) => i.status === 'unresolved' || i.status === 'open'
  ).length;

  // Filter issues for current view
  const currentChapterIssues = issues.filter((i) => {
    const chNum = currentChapter?.chapter_number;
    return (
      i.chapter_id === selectedChapterId ||
      i.new_chapter_number === chNum ||
      (Array.isArray(i.evidence) && i.evidence.some((ev) => ev.chapter === chNum))
    );
  });

  const displayedIssues = issues.filter((i) => {
    if (issueFilter === 'unresolved') return i.status === 'unresolved' || i.status === 'open';
    if (issueFilter === 'high') return (i.severity || '').toLowerCase() === 'high';
    if (issueFilter === 'current_chapter') {
      const chNum = currentChapter?.chapter_number;
      return (
        i.chapter_id === selectedChapterId ||
        i.new_chapter_number === chNum ||
        (Array.isArray(i.evidence) && i.evidence.some((ev) => ev.chapter === chNum))
      );
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

      {/* Top Edge Sub-Bar: Breadcrumbs & Quick Panel Controls */}
      <div className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-xs px-4 py-1.5 flex items-center justify-between text-xs select-none">
        {/* Left: Project & Active Chapter breadcrumb */}
        <div className="flex items-center space-x-2 truncate">
          <span className="font-semibold text-neutral-800 truncate">
            {project?.name || 'Project'}
          </span>
          {currentChapter && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="text-neutral-600 truncate">
                Ch {currentChapter.chapter_number}: {currentChapter.title ? currentChapter.title.replace(/^Chapter\s+\d+\s*[:—\-]\s*/i, '') : `Chapter ${currentChapter.chapter_number}`}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                {currentChapter.word_count || 0}w
              </span>
            </>
          )}
        </div>

        {/* Right: Quick Panel Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 hidden sm:inline">
            Panels:
          </span>
          <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/80 space-x-0.5">
            <button
              onClick={() => setIsLeftOpen(!isLeftOpen)}
              title={isLeftOpen ? 'Collapse Manuscript Panel (L)' : 'Open Manuscript Panel (L)'}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isLeftOpen
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Manuscript</span>
            </button>

            <button
              onClick={() => setIsCenterOpen(!isCenterOpen)}
              title={isCenterOpen ? 'Collapse Editor Panel (E)' : 'Open Editor Panel (E)'}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isCenterOpen
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Editor</span>
            </button>

            <button
              onClick={() => setIsRightOpen(!isRightOpen)}
              title={isRightOpen ? 'Collapse AI Guardian Panel (G)' : 'Open AI Guardian Panel (G)'}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all relative ${
                isRightOpen
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Guardian</span>
              {unresolvedCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-0.5" />
              )}
            </button>
          </div>

          {(!isLeftOpen || !isCenterOpen || !isRightOpen) && (
            <button
              onClick={() => {
                setIsLeftOpen(true);
                setIsCenterOpen(true);
                setIsRightOpen(true);
              }}
              title="Restore All 3 Panels"
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ========================================================= */}
        {/* COLUMN 1: LEFT CHAPTER TREE & OUTLINE */}
        {/* ========================================================= */}
        <div
          className={`h-full transition-all duration-300 ease-in-out overflow-hidden flex flex-col shrink-0 ${
            isLeftOpen
              ? (!isCenterOpen && !isRightOpen ? 'flex-1 w-full min-w-0 opacity-100' : 'w-64 lg:w-72 opacity-100')
              : 'w-0 min-w-0 opacity-0 pointer-events-none border-none'
          }`}
        >
          <div className="w-full h-full flex flex-col">
            <Sidebar
              chapters={chapters}
              selectedChapterId={selectedChapterId}
              onSelectChapter={handleSelectChapter}
              onAddChapter={handleAddChapter}
              projectName={project?.name}
              onClose={() => setIsLeftOpen(false)}
            />
          </div>
        </div>

        {/* Collapsed Left Edge Slider Handle */}
        {!isLeftOpen && (
          <button
            onClick={() => setIsLeftOpen(true)}
            title={`Expand Manuscript Panel (${chapters.length} chapters)`}
            className="group relative flex flex-col items-center justify-start pt-3 w-8 shrink-0 h-full bg-white hover:bg-neutral-50 border-r border-neutral-200/90 text-neutral-500 hover:text-neutral-900 transition-all select-none cursor-pointer z-10 shadow-2xs"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors mb-3">
              <PanelLeftOpen className="w-3.5 h-3.5" />
            </div>
            <div
              className="flex items-center justify-center space-x-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 group-hover:text-neutral-800 transition-colors select-none mt-2"
              style={{ writingMode: 'vertical-rl' }}
            >
              <span className="rotate-180">Chapters ({chapters.length})</span>
            </div>
          </button>
        )}

        {/* ========================================================= */}
        {/* COLUMN 2: CENTRE TIPTAP WRITING CANVAS */}
        {/* ========================================================= */}
        <section
          className={`h-full transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
            isCenterOpen
              ? 'flex-1 min-w-0 opacity-100 p-4'
              : 'w-0 flex-none min-w-0 opacity-0 pointer-events-none p-0 overflow-hidden'
          }`}
        >
          {currentChapter ? (
            <Editor
              initialContent={currentChapter.content}
              chapterTitle={currentChapter.title}
              onSave={handleSaveEditor}
              onAnalyze={handleAnalyzeChapter}
              analyzing={analyzing}
              onCollapse={() => setIsCenterOpen(false)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-neutral-200 text-xs text-neutral-400">
              No chapter selected. Pick a chapter from the sidebar.
            </div>
          )}
        </section>

        {/* Collapsed Center Rail Handle (when editor is closed but at least one other panel is open) */}
        {!isCenterOpen && (isLeftOpen || isRightOpen) && (
          <button
            onClick={() => setIsCenterOpen(true)}
            title="Expand Writing Editor"
            className="group relative flex flex-col items-center justify-start pt-3 w-9 shrink-0 h-full bg-white hover:bg-neutral-50 border-r border-neutral-200/90 text-neutral-500 hover:text-neutral-900 transition-all select-none cursor-pointer z-10 shadow-2xs"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors mb-3">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div
              className="flex items-center justify-center space-x-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 group-hover:text-neutral-800 transition-colors select-none mt-2"
              style={{ writingMode: 'vertical-rl' }}
            >
              <span className="rotate-180">Open Editor</span>
            </div>
          </button>
        )}

        {/* ========================================================= */}
        {/* ALL PANELS CLOSED FALLBACK */}
        {/* ========================================================= */}
        {!isLeftOpen && !isCenterOpen && !isRightOpen && (
          <div className="flex-1 flex items-center justify-center p-6 bg-[#fbfbf9]">
            <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center space-y-5">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center mx-auto">
                <Layout className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">All Panels Collapsed</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  You are currently in an ultra-minimal workspace view. Click any panel below or restore all panels to continue writing.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={() => setIsLeftOpen(true)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 text-neutral-700 transition-all text-xs font-medium space-y-1.5 cursor-pointer"
                >
                  <PanelLeft className="w-4 h-4 text-neutral-600" />
                  <span>Manuscript</span>
                </button>
                <button
                  onClick={() => setIsCenterOpen(true)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 text-neutral-700 transition-all text-xs font-medium space-y-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Editor</span>
                </button>
                <button
                  onClick={() => setIsRightOpen(true)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 text-neutral-700 transition-all text-xs font-medium space-y-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>AI Guardian</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setIsLeftOpen(true);
                  setIsCenterOpen(true);
                  setIsRightOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white transition-colors shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Restore All Panels</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* COLUMN 3: RIGHT AI GUARDIAN PANEL */}
        {/* ========================================================= */}
        <div
          className={`h-full transition-all duration-300 ease-in-out overflow-hidden flex flex-col shrink-0 ${
            isRightOpen
              ? (!isCenterOpen ? 'flex-1 w-full min-w-0 opacity-100' : 'w-80 lg:w-96 opacity-100')
              : 'w-0 min-w-0 opacity-0 pointer-events-none border-none'
          }`}
        >
          <aside className="w-full h-full bg-white border-l border-neutral-200/80 flex flex-col overflow-hidden text-left shadow-2xs">
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

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleAnalyzeChapter}
                  disabled={analyzing}
                  title="Run live continuity scan"
                  className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-neutral-100 rounded-md transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsRightOpen(false)}
                  title="Collapse Guardian Panel"
                  className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
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
                Unresolved ({unresolvedCount})
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

        {/* Collapsed Right Edge Slider Handle */}
        {!isRightOpen && (
          <button
            onClick={() => setIsRightOpen(true)}
            title={`Expand AI Continuity Guardian (${unresolvedCount} unresolved)`}
            className="group relative flex flex-col items-center justify-start pt-3 w-9 shrink-0 h-full bg-white hover:bg-neutral-50 border-l border-neutral-200/90 text-neutral-500 hover:text-neutral-900 transition-all select-none cursor-pointer z-10 shadow-2xs"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white transition-colors mb-3 relative">
              <ShieldCheck className="w-3.5 h-3.5" />
              {unresolvedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div
              className="flex items-center justify-center space-x-1.5 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 group-hover:text-neutral-800 transition-colors select-none mt-2"
              style={{ writingMode: 'vertical-rl' }}
            >
              <span className="rotate-180">AI Guardian</span>
            </div>
            {unresolvedCount > 0 ? (
              <span className="mt-4 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                {unresolvedCount}
              </span>
            ) : (
              <span className="mt-4 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" title="Canon coherent" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
