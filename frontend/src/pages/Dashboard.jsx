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
  ShieldCheck
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { projectService, getCached, prefetchProjectWorkspace } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(() => getCached('projects:list') || []);
  const [loading, setLoading] = useState(() => !getCached('projects:list'));

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
  }, []);

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
    e.preventDefault();
    if (!uploadFile || !selectedUploadProject) return;

    try {
      setUploading(true);
      setUploadError('');
      await projectService.uploadManuscript(selectedUploadProject.id, uploadFile);
      setShowUploadModal(false);
      setUploadFile(null);
      navigate(`/workspace/${selectedUploadProject.id}`);
    } catch (err) {
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
        formattedError = 'Connection failed: The Render backend service may be spinning up from idle (cold start takes ~50s) or had a temporary connection drop. Please wait a few seconds and try again.';
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
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 max-w-md w-full text-left">
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              Upload Manuscript
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Add your document to <span className="font-semibold text-neutral-700">{selectedUploadProject.name}</span>. The system parses chapters, encrypts the file into vault storage, and extracts canon facts.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
                {uploadError}
              </div>
            )}

            {uploading ? (
              <div className="py-6 space-y-4">
                <div className="flex items-center justify-center space-x-2 text-blue-600 font-semibold text-xs">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Processing Manuscript with Multi-Agent Pipeline...</span>
                </div>
                <div className="space-y-2.5 bg-neutral-50 p-4 rounded-xl border border-neutral-200/80 text-left text-xs">
                  <div className="flex items-center space-x-2 text-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium">1. Parsing manuscript & AES-256-GCM Vault Encryption</span>
                  </div>
                  <div className="flex items-center space-x-2 text-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-medium">2. Segmenting chapters & indexing passages</span>
                  </div>
                  <div className="flex items-center space-x-2 text-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="font-medium">3. Extracting canonical entities, facts & relationships</span>
                  </div>
                  <div className="flex items-center space-x-2 text-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="font-medium">4. Running Continuity Guardian contradiction analysis</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400 text-center">
                  Verifying evidence against established canon memory...
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
