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
import { projectService, chapterService } from '../services/api';

export default function Workspace() {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [issueFilter, setIssueFilter] = useState('all'); // all, unresolved, high

  // Load project details and chapters
  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const proj = await projectService.getProject(projectId);
      setProject(proj);

      const chaps = await chapterService.getChapters(projectId);
      setChapters(chaps);

      if (chaps.length > 0) {
        // Default to first chapter or keep currently selected
        const targetId = selectedChapterId || chaps[0].id;
        setSelectedChapterId(targetId);
        const chData = await chapterService.getChapter(targetId);
        setCurrentChapter(chData);
      }

      // Fetch issues for project
      const projIssues = await projectService.getIssues(projectId);
      setIssues(projIssues);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] flex flex-col">
        <Navbar currentProject={project} />
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
          Loading story workspace...
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
