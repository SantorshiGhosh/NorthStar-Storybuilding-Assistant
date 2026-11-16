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
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Circle,
  Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
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
  useDocumentTitle('My Story Projects & Dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
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
        toast.success(`Project "${created.name}" created successfully`);
      }
      await fetchProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
      toast.error(err.response?.data?.detail || 'Failed to create story project');
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


  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project and its story memory?')) return;
    const prev = [...projects];
    // Optimistic delete: remove from UI immediately
    setProjects(projects.filter((p) => p.id !== id));
    toast.info('Story project deleted');
    try {
      await projectService.deleteProject(id);
    } catch (err) {
      console.error('Failed to delete project:', err);
      toast.error('Failed to delete story project from server');
      setProjects(prev); // Rollback on error
    }
  };

  const completedStagesCount = UPLOAD_STAGES.filter((s) => uploadProgress >= s.threshold).length;
  const remainingStagesCount = UPLOAD_STAGES.length - completedStagesCount;

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      <Navbar />

      {/* ========================================================
          HERO SECTION WITH 28px DOTTED GRID & FADE OVERLAY
          ======================================================== */}
      <section className="relative border-b border-[#1c1c1e]/10 dark:border-white/10 overflow-hidden">
        {/* Dotted engineering grid background */}
        <div className="absolute inset-0 graphite-grid-bg pointer-events-none" />
        {/* Soft paper gradient fading over the grid */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f6f6f4]/40 to-[#f6f6f4] dark:via-[#161618]/40 dark:to-[#161618] pointer-events-none" />

        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-20 sm:pb-16 lg:pt-24 lg:pb-20">
          <div className="max-w-3xl text-left">
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1c1c1e]/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1c1c1e] px-3 py-1 shadow-2xs mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1c1c1e] dark:bg-white" />
              <span className="text-[12px] font-medium text-[#636366] dark:text-[#8e8e93]">
                AI Continuity Guardian &bull; monochrome
              </span>
            </div>

            {/* Bold tightest-tracked headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-[66px] font-bold tracking-[-0.03em] leading-[1.04] text-[#1c1c1e] dark:text-[#f5f5f7]">
              Every story, <br className="hidden sm:inline" />
              one calm canon.
            </h1>

            {/* Graphite subhead */}
            <p className="mt-5 text-[17px] sm:text-[18px] text-[#48484a] dark:text-[#8e8e93] leading-relaxed max-w-xl">
              A restrained, monochrome story workspace in graphite and platinum. Persistent lore vaults, chapter segmentation, and multi-agent contradiction detection, drawn on hairlines so the writing stays quiet and the canon stays obvious.
            </p>

            {/* CTA button pair */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-solid btn-lg shadow-2xs"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>New Story Project</span>
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('projects');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="btn btn-outline btn-lg shadow-2xs"
              >
                <FolderOpen className="w-4 h-4 mr-1 text-[#8e8e93]" />
                <span>My Projects</span>
              </button>
            </div>

            {/* Check-marked feature notes row */}
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12.5px] font-medium text-[#8e8e93] dark:text-[#8e8e93]">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-[#f5f5f7]" />
                <span>AES-256 Vault Encryption</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-[#f5f5f7]" />
                <span>Chapter Segmentation</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-[#f5f5f7]" />
                <span>Entity &amp; Lore Memory</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-[#f5f5f7]" />
                <span>Proactive Contradiction Audit</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          MY PROJECTS MAIN WORKSPACE (FULL WIDTH CENTERED)
          ======================================================== */}
      <main id="projects" className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 text-left scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-3 mb-6 border-b border-[#1c1c1e]/10 dark:border-white/10 gap-2">
          <div>
            <h2 className="text-2xl sm:text-[27px] font-semibold tracking-[-0.03em] text-[#1c1c1e] dark:text-[#f5f5f7]">
              My Projects
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#636366] dark:text-[#8e8e93] leading-relaxed mt-1">
              One primary narrative container per story. Manuscript uploads, character continuity, and chapter segmentation mapped on hairline cards with zero hue.
            </p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <span className="state-cap">
              {projects.length} {projects.length === 1 ? 'WORKSPACE' : 'WORKSPACES'}
            </span>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-solid btn-sm shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {loading && (!Array.isArray(projects) || projects.length === 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-5 shadow-2xs animate-pulse space-y-4"
              >
                <div className="h-5 bg-[#1c1c1e]/10 dark:bg-white/10 rounded-md w-2/3" />
                <div className="space-y-2">
                  <div className="h-3 bg-[#1c1c1e]/5 dark:bg-white/5 rounded-md w-full" />
                  <div className="h-3 bg-[#1c1c1e]/5 dark:bg-white/5 rounded-md w-4/5" />
                </div>
                <div className="pt-4 border-t border-[#1c1c1e]/10 dark:border-white/10 flex justify-between">
                  <div className="h-3.5 bg-[#1c1c1e]/10 dark:bg-white/10 rounded-md w-20" />
                  <div className="h-3.5 bg-[#1c1c1e]/5 dark:bg-white/5 rounded-md w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : (!Array.isArray(projects) || projects.length === 0) ? (
          <div className="rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1c1c1e] p-12 text-center max-w-md mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-lg bg-[#1c1c1e]/5 dark:bg-white/5 border border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-6 h-6 text-[#8e8e93]" />
            </div>
            <h3 className="text-base font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
              No story projects yet
            </h3>
            <p className="text-xs text-[#636366] dark:text-[#8e8e93] mb-6 leading-relaxed">
              Start by creating a new story project to begin writing chapters and tracking canon continuity.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-solid btn-md w-full"
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
                className="rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1c1c1e] p-5 shadow-2xs hover:border-[#1c1c1e]/30 dark:hover:border-white/30 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group text-left"
              >
                <div>
                  {/* Top Row: Title + Delete button */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] group-hover:text-black dark:group-hover:text-white transition-colors truncate">
                      {proj.name}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      className="p-1 text-[#8e8e93] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Manuscript info or description */}
                  <p className="text-xs text-[#636366] dark:text-[#8e8e93] line-clamp-2 mb-4 leading-relaxed">
                    {proj.description || (proj.manuscript_title ? `Manuscript: ${proj.manuscript_title}` : 'No premise provided.')}
                  </p>
                </div>

                {/* Metadata Stats */}
                <div className="pt-4 border-t border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between text-[11px] text-[#636366] dark:text-[#8e8e93]">
                  <div className="flex items-center space-x-3 font-mono-cap">
                    <span className="flex items-center space-x-1">
                      <BookOpen className="w-3.5 h-3.5 text-[#8e8e93]" />
                      <span>{proj.chapter_count} ch</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-[#8e8e93]" />
                      <span>{proj.character_count} chars</span>
                    </span>
                  </div>

                  {/* Issues pill */}
                  {proj.unresolved_issues_count > 0 ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#1c1c1e]/5 dark:bg-white/5 border border-[#1c1c1e]/10 dark:border-white/10 text-[10px] font-mono-cap text-[#1c1c1e] dark:text-[#f5f5f7]">
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>{proj.unresolved_issues_count} contradictions</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#1c1c1e]/3 dark:bg-white/5 border border-[#1c1c1e]/10 dark:border-white/10 text-[10px] font-mono-cap text-[#636366] dark:text-[#8e8e93]">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Canon Clean</span>
                    </span>
                  )}
                </div>

                {/* Card Quick Action Bar */}
                <div className="mt-4 pt-3 border-t border-[#1c1c1e]/5 dark:border-white/5 flex items-center justify-between text-xs font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUploadProject(proj);
                      setShowUploadModal(true);
                    }}
                    className="btn btn-ghost btn-sm text-[11.5px] px-2 py-1"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    <span>Upload Manuscript</span>
                  </button>

                  <span className="text-[#1c1c1e] dark:text-[#f5f5f7] flex items-center space-x-0.5 text-[11.5px] font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Open Workspace</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ========================================================
          ENHANCED MONOCHROME FOOTER
          ======================================================== */}
      <footer className="border-t border-[#1c1c1e]/10 dark:border-white/10 bg-[#f6f6f4] dark:bg-[#161618] py-8 transition-colors mt-auto">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center space-x-2.5">
            <Link to="/dashboard" className="h-6 w-6 rounded-[6px] bg-[#1c1c1e] dark:bg-[#f5f5f7] text-white dark:text-[#1c1c1e] flex items-center justify-center font-bold text-xs tracking-tighter shadow-2xs hover:opacity-90 transition-opacity">
              N
            </Link>
            <span className="text-[13px] font-medium text-[#636366] dark:text-[#8e8e93]">
              NorthStar &bull; AI Continuity Guardian
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-[#8e8e93]">
            <Link to="/dashboard" className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors">
              Workspaces
            </Link>
            <Link to="/support" className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors">
              Help &amp; Support
            </Link>
            <a href="mailto:codebrew@gmail.com" className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors">
              codebrew@gmail.com
            </a>
            <a href="tel:+18005550199" className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors">
              +919231456311
            </a>
            <span className="text-[#8e8e93]/60">&copy; {new Date().getFullYear()} NorthStar AI</span>
          </div>
        </div>
      </footer>

      {/* ========================================================
          CREATE PROJECT MODAL (PRESERVED FUNCTIONALITY)
          ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-2xl shadow-xl border border-[#1c1c1e]/10 dark:border-white/10 p-6 max-w-md w-full text-left transition-colors">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
                Create NorthStar Project
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] text-sm p-1 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#636366] dark:text-[#8e8e93] mb-5">
              Set up a dedicated narrative container for your novel, script, or series.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] mb-1.5">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. The Last Kingdom"
                  autoFocus
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#222224] border border-[#1c1c1e]/15 dark:border-white/15 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e] dark:focus:border-white focus:ring-1 focus:ring-[#1c1c1e] dark:focus:ring-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] mb-1.5">
                  Premise or Logline (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="A fantasy saga of honor, siege warfare, and forgotten ancient laws..."
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#222224] border border-[#1c1c1e]/15 dark:border-white/15 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e] dark:focus:border-white focus:ring-1 focus:ring-[#1c1c1e] dark:focus:ring-white transition-colors"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-solid btn-sm min-w-[80px]"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          UPLOAD MANUSCRIPT MODAL (4-STAGE PIPELINE PRESERVED)
          ======================================================== */}
      {showUploadModal && selectedUploadProject && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-2xl shadow-xl border border-[#1c1c1e]/10 dark:border-white/10 p-6 ${uploading ? 'max-w-lg' : 'max-w-md'} w-full text-left transition-all`}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
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
                  className="text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] text-sm p-1 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {!uploading && (
              <p className="text-xs text-[#636366] dark:text-[#8e8e93] mb-4">
                Add your document to <span className="font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">{selectedUploadProject.name}</span>. The system parses chapters, encrypts the file into vault storage, and extracts canon facts.
              </p>
            )}

            {uploadError && (
              <div className="mb-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-xs space-y-2">
                <p>{uploadError}</p>
                {uploadFile && (
                  <button
                    type="button"
                    onClick={() => handleUploadManuscript()}
                    className="btn btn-solid btn-sm text-[11px]"
                  >
                    <span>Retry Upload</span>
                  </button>
                )}
              </div>
            )}

            {uploading ? (
              <div className="py-2 space-y-4">
                {/* Graphite Pipeline Card */}
                <div className="bg-[#1c1c1e] dark:bg-[#222224] text-white rounded-xl p-4 shadow-sm border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      <span className="state-cap text-[#8e8e93]">
                        {uploadProgress >= 100 ? 'Processing Complete' : 'Multi-Agent Pipeline'}
                      </span>
                    </div>
                    <span className="text-sm font-mono font-semibold text-[#f5f5f7]">
                      {uploadProgress}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#2c2c2e] dark:bg-[#161618] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>

                  {/* Metrics Bar: Done, Left, Elapsed Time */}
                  <div className="flex items-center justify-between mt-3 text-xs text-[#8e8e93] border-t border-white/10 pt-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-white/10 text-[#f5f5f7] font-medium text-[10px] border border-white/15">
                        <CheckCircle2 className="w-3 h-3 mr-0.5 text-white" />
                        <span>{completedStagesCount} Done</span>
                      </span>
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-white/5 text-[#8e8e93] font-medium text-[10px] border border-white/10">
                        <Clock className="w-3 h-3 mr-0.5 text-[#8e8e93]" />
                        <span>{remainingStagesCount} Left</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-[#8e8e93] font-mono">
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
                            ? 'bg-[#fcfcfb] dark:bg-[#222224] border-[#1c1c1e]/10 dark:border-white/10 text-[#1c1c1e] dark:text-[#f5f5f7]'
                            : isActive
                            ? 'bg-white dark:bg-[#28282b] border-[#1c1c1e] dark:border-white shadow-2xs ring-1 ring-[#1c1c1e]/15 dark:ring-white/20 text-[#1c1c1e] dark:text-[#f5f5f7]'
                            : 'bg-white/40 dark:bg-white/[0.02] border-[#1c1c1e]/5 dark:border-white/5 text-[#8e8e93] opacity-60'
                        }`}
                      >
                        <div className="flex items-start space-x-3 pr-2">
                          <div className="mt-0.5">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-[#1c1c1e] dark:text-white flex-shrink-0" />
                            ) : isActive ? (
                              <Loader2 className="w-4 h-4 text-[#1c1c1e] dark:text-white animate-spin flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-[#8e8e93] flex-shrink-0" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-xs font-semibold ${
                                  isDone || isActive
                                    ? 'text-[#1c1c1e] dark:text-[#f5f5f7]'
                                    : 'text-[#8e8e93]'
                                }`}
                              >
                                {stage.id}. {stage.title}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] mt-0.5 leading-tight ${
                                isDone || isActive
                                  ? 'text-[#636366] dark:text-[#8e8e93]'
                                  : 'text-[#8e8e93]'
                              }`}
                            >
                              {stage.desc}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex-shrink-0 self-center">
                          {isDone ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1c1c1e]/10 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7]">
                              ✓ Done
                            </span>
                          ) : isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1c1c1e] dark:bg-white text-white dark:text-[#1c1c1e] animate-pulse">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1c1c1e]/5 dark:bg-white/5 text-[#8e8e93]">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-[#8e8e93] text-center pt-1">
                  Verifying evidence against established canon memory &bull; please keep this tab open
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadManuscript} className="space-y-4">
                <div className="border-2 border-dashed border-[#1c1c1e]/15 dark:border-white/15 rounded-xl p-6 text-center hover:border-[#1c1c1e]/30 dark:hover:border-white/30 transition-colors cursor-pointer bg-white/50 dark:bg-white/[0.02]">
                  <input
                    type="file"
                    id="manuscript-file-input"
                    accept=".docx,.txt,.md,.pdf"
                    required
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="hidden"
                  />
                  <label htmlFor="manuscript-file-input" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-[#8e8e93] mx-auto mb-2" />
                    <span className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block">
                      {uploadFile ? uploadFile.name : 'Select or drag DOCX, TXT, MD, or PDF'}
                    </span>
                    <span className="text-[11px] text-[#8e8e93] block mt-1">
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
                    className="btn btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className="btn btn-solid btn-sm"
                  >
                    Upload &amp; Build Memory
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
