import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Upload,
  BookOpen,
  Users,
  AlertTriangle,
  Clock,
  Sparkles,
  Trash2,
  FileText,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Circle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { projectService, getCached, prefetchProjectWorkspace } from '../services/api';

const UPLOAD_STAGES = [
  {
    id: 1,
    title: 'Upload & Vault Encryption',
    desc: 'Encrypting manuscript with AES-256-GCM vault security',
    threshold: 25,
  },
  {
    id: 2,
    title: 'Chapter & Passage Segmentation',
    desc: 'Detecting chapters, word counts & indexing passages',
    threshold: 50,
  },
  {
    id: 3,
    title: 'Entity & Relationship Extraction',
    desc: 'Extracting characters, locations, factions & lore facts',
    threshold: 75,
  },
  {
    id: 4,
    title: 'Continuity Guardian Verification',
    desc: 'Checking cross-chapter consistency against established canon',
    threshold: 100,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userKey = user?.id || 'anon';
  const [projects, setProjects] = useState(() => getCached(`projects:list:${userKey}`) || []);
  const [loading, setLoading] = useState(() => !getCached(`projects:list:${userKey}`));

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadProject, setSelectedUploadProject] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSeconds, setUploadSeconds] = useState(0);

  const fetchProjects = async () => {
    try {
      if (projects.length === 0) setLoading(true);
      const data = await projectService.getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user?.id]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      setCreating(true);
      const created = await projectService.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      if (created) {
        setProjects((prev) => [created, ...(Array.isArray(prev) ? prev.filter((p) => p.id !== created.id) : [])]);
      }
      await fetchProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleUploadManuscript = async (e) => {
    if (e) e.preventDefault();
    if (!uploadFile || !selectedUploadProject) return;

    let secondsInterval = null;
    let progressInterval = null;

    try {
      setUploading(true);
      setUploadError('');
      setUploadProgress(5);
      setUploadSeconds(0);

      secondsInterval = setInterval(() => {
        setUploadSeconds((prev) => prev + 1);
      }, 1000);

      // Smooth responsive progress ticker across stages matching fast backend execution
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev < 26) return prev + 3; // Stage 1: Upload & Encryption (~1s)
          if (prev < 52) return prev + 2; // Stage 2: Segmentation (~2.5s)
          if (prev < 76) return prev + 2; // Stage 3: Entity Extraction (~4s)
          if (prev < 94) return prev + 1; // Stage 4: Continuity Verification (~5s+)
          return prev;
        });
      }, 140);

      await projectService.uploadManuscript(selectedUploadProject.id, uploadFile, (networkPct) => {
        // Map 0-100% upload network progress to the first stage (0-25%)
        const mapped = Math.round((networkPct / 100) * 25);
        setUploadProgress((prev) => Math.max(prev, mapped));
      });

      clearInterval(progressInterval);
      clearInterval(secondsInterval);

      // Mark all 4 stages 100% complete
      setUploadProgress(100);

      // Allow 750ms so user can see all 4 steps marked Done
      await new Promise((resolve) => setTimeout(resolve, 750));

      setShowUploadModal(false);
      setUploadFile(null);
      navigate(`/workspace/${selectedUploadProject.id}`);
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      if (secondsInterval) clearInterval(secondsInterval);
      console.error('Upload manuscript error:', err);
      const detail = err.response?.data?.detail;
      let formattedError = '';
      if (typeof detail === 'string') {
        formattedError = detail;
      } else if (Array.isArray(detail)) {
        formattedError = detail.map((d) => (d.msg || (typeof d === 'object' ? JSON.stringify(d) : String(d)))).join(', ');
      } else if (detail && typeof detail === 'object') {
        formattedError = detail.msg || detail.message || JSON.stringify(detail);
      } else if (err.message === 'Network Error' || !err.response) {
        formattedError = 'Connection failed: The Render backend service was spinning up or restarting after a deployment. Please click "Retry Upload" below.';
      } else {
        formattedError = (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
          ? 'Upload connection timed out while processing. Large manuscripts may still be building memory in the background.'
          : (err.message || 'Failed to upload manuscript. Ensure it is DOCX, TXT, MD, or PDF.');
      }
      setUploadError(formattedError);
    } finally {
      setUploading(false);
    }
  };

  const [seeding, setSeeding] = useState(false);

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      const res = await projectService.seedDemo();
      if (res.project_id) {
        navigate(`/workspace/${res.project_id}`);
      } else {
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
      fetchProjects();
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project and its story memory?')) return;
    const prev = [...projects];
    // Optimistic delete: remove from UI immediately
    setProjects(projects.filter((p) => p.id !== id));
    try {
      await projectService.deleteProject(id);
    } catch (err) {
      console.error('Failed to delete project:', err);
      setProjects(prev); // Rollback on error
    }
  };

  const completedStagesCount = UPLOAD_STAGES.filter((s) => uploadProgress >= s.threshold).length;
  const remainingStagesCount = UPLOAD_STAGES.length - completedStagesCount;

  return (
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-neutral-200/80 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              Projects & NorthStar
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Select an active story workspace or upload a manuscript to build persistent canon memory.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Loads The Last Kingdom demo manuscript with pre-configured canon and continuity checks"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{seeding ? 'Loading Demo...' : 'Load Demo Manuscript ("The Last Kingdom")'}</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="mt-8">
          {loading && (!Array.isArray(projects) || projects.length === 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs animate-pulse space-y-4 text-left">
                  <div className="flex items-start justify-between">
                    <div className="h-5 bg-neutral-200 rounded-md w-2/3" />
                    <div className="h-4 bg-neutral-100 rounded-md w-6" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-neutral-100 rounded-md w-full" />
                    <div className="h-3 bg-neutral-100 rounded-md w-4/5" />
                  </div>
                  <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <div className="h-3.5 bg-neutral-200 rounded-md w-24" />
                    <div className="h-4 bg-neutral-100 rounded-full w-20" />
                  </div>
                  <div className="pt-3 border-t border-neutral-50 flex items-center justify-between">
                    <div className="h-3 bg-neutral-100 rounded-md w-28" />
                    <div className="h-3 bg-blue-100 rounded-md w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (!Array.isArray(projects) || projects.length === 0) ? (
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center max-w-md mx-auto shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-1">
                No story projects yet
              </h3>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                Start by creating a new story project, or load the official demo manuscript to see the Continuity Guardian in action.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full py-2.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                >
                  Create Story Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onMouseEnter={() => prefetchProjectWorkspace(proj.id)}
                  onClick={() => navigate(`/workspace/${proj.id}`)}
                  className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between text-left group"
                >
                  <div>
                    {/* Top Row: Title + Delete button */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                        {proj.name}
                      </h3>
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-1 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors shrink-0"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Manuscript info or description */}
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-4 leading-relaxed">
                      {proj.description || (proj.manuscript_title ? `Manuscript: ${proj.manuscript_title}` : 'No description provided.')}
                    </p>
                  </div>

                  {/* Metadata Stats */}
                  <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{proj.chapter_count} ch</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{proj.character_count} chars</span>
                      </span>
                    </div>

                    {/* Issues pill */}
                    {proj.unresolved_issues_count > 0 ? (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{proj.unresolved_issues_count} contradictions</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                        Canon Clean
                      </span>
                    )}
                  </div>

                  {/* Card Quick Action Bar */}
                  <div className="mt-4 pt-3 border-t border-neutral-50 flex items-center justify-between text-xs font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUploadProject(proj);
                        setShowUploadModal(true);
                      }}
                      className="text-neutral-600 hover:text-neutral-900 flex items-center space-x-1 text-[11px]"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload Manuscript</span>
                    </button>

                    <span className="text-blue-600 flex items-center space-x-0.5 text-[11px] group-hover:translate-x-0.5 transition-transform">
                      <span>Open Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 max-w-md w-full text-left">
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              Create NorthStar Project
            </h3>
            <p className="text-xs text-neutral-500 mb-5">
              Set up a dedicated narrative container for your novel, script, or series.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. The Last Kingdom"
                  autoFocus
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Premise or Logline (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="A fantasy saga of honor, siege warfare, and forgotten ancient laws..."
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 min-w-[80px] text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg shadow-xs disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Manuscript Modal */}
      {showUploadModal && selectedUploadProject && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 ${uploading ? 'max-w-lg' : 'max-w-md'} w-full text-left transition-all`}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-neutral-900">
                {uploading ? 'Analyzing Manuscript' : 'Upload Manuscript'}
              </h3>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadError('');
                  }}
                  className="text-neutral-400 hover:text-neutral-600 text-sm font-semibold p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {!uploading && (
              <p className="text-xs text-neutral-500 mb-4">
                Add your document to <span className="font-semibold text-neutral-700">{selectedUploadProject.name}</span>. The system parses chapters, encrypts the file into vault storage, and extracts canon facts.
              </p>
            )}

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs space-y-2">
                <p>{uploadError}</p>
                {uploadFile && (
                  <button
                    type="button"
                    onClick={() => handleUploadManuscript()}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-[11px] transition-colors shadow-xs"
                  >
                    <span>Retry Upload</span>
                  </button>
                )}
              </div>
            )}

            {uploading ? (
              <div className="py-2 space-y-4">
                {/* Header card with Done / Left Summary and Percentage */}
                <div className="bg-neutral-900 text-white rounded-xl p-4 shadow-sm border border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                      </span>
                      <span className="text-xs font-semibold tracking-wide uppercase text-neutral-300">
                        {uploadProgress >= 100 ? 'Processing Complete' : 'Multi-Agent Pipeline'}
                      </span>
                    </div>
                    <span className="text-base font-mono font-bold text-blue-400">
                      {uploadProgress}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>

                  {/* Metrics Bar: Done, Left, Elapsed Time */}
                  <div className="flex items-center justify-between mt-3 text-xs text-neutral-300 border-t border-neutral-800 pt-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        <span>{completedStagesCount} Done</span>
                      </span>
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[11px] border border-amber-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        <span>{remainingStagesCount} Left</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-400 font-mono">
                      Elapsed: {uploadSeconds}s
                    </div>
                  </div>
                </div>

                {/* Individual Stage Cards */}
                <div className="space-y-2 text-left">
                  {UPLOAD_STAGES.map((stage, idx) => {
                    const isDone = uploadProgress >= stage.threshold;
                    const isActive = !isDone && (idx === 0 || uploadProgress >= UPLOAD_STAGES[idx - 1].threshold);

                    return (
                      <div
                        key={stage.id}
                        className={`flex items-start justify-between p-3 rounded-xl border transition-all duration-300 ${
                          isDone
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : isActive
                            ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-400/30 text-blue-950'
                            : 'bg-neutral-50/60 border-neutral-200 text-neutral-400 opacity-70'
                        }`}
                      >
                        <div className="flex items-start space-x-3 pr-2">
                          <div className="mt-0.5">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            ) : isActive ? (
                              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-xs font-semibold ${
                                  isDone
                                    ? 'text-emerald-900'
                                    : isActive
                                    ? 'text-blue-900 font-bold'
                                    : 'text-neutral-500'
                                }`}
                              >
                                {stage.id}. {stage.title}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] mt-0.5 leading-tight ${
                                isDone
                                  ? 'text-emerald-700'
                                  : isActive
                                  ? 'text-blue-700'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {stage.desc}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge: Done vs In Progress vs Left to do */}
                        <div className="flex-shrink-0 self-center">
                          {isDone ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Done
                            </span>
                          ) : isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                              Left to do
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-neutral-400 text-center pt-1">
                  Verifying evidence against established canon memory &bull; please keep this tab open
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadManuscript} className="space-y-4">
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-neutral-400 transition-colors cursor-pointer bg-neutral-50/50">
                  <input
                    type="file"
                    id="manuscript-file-input"
                    accept=".docx,.txt,.md,.pdf"
                    required
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="hidden"
                  />
                  <label htmlFor="manuscript-file-input" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                    <span className="text-xs font-semibold text-neutral-800 block">
                      {uploadFile ? uploadFile.name : 'Select or drag DOCX, TXT, MD, or PDF'}
                    </span>
                    <span className="text-[11px] text-neutral-400 block mt-1">
                      Up to 25 MB &bull; AES-256-GCM Vault Encrypted
                    </span>
                  </label>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs disabled:opacity-50"
                  >
                    Upload & Build Memory
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
