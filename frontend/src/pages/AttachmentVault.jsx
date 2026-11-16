import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  Search,
  Plus,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  HardDrive,
  Tag,
  Link2,
  Unlink,
  X,
  Check,
  Eye,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { projectService, entityService, architectService } from '../services/api';

export default function AttachmentVault() {
  const { projectId } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  useDocumentTitle(project?.name ? `${project.name} | Confidential Vault` : 'Confidential Vault');
  const [entities, setEntities] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState('');

  // Upload modal & state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadEntityIds, setUploadEntityIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // External reference link modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState('image');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkEntityIds, setLinkEntityIds] = useState([]);

  // Preview modal
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // AI Analysis modal
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);

  // Entity link manager modal
  const [managingAttachment, setManagingAttachment] = useState(null);
  const [entityToLink, setEntityToLink] = useState('');

  useEffect(() => {
    loadVaultData();
  }, [projectId]);

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const [proj, ents, attList, quotaData] = await Promise.all([
        projectService.getProject(projectId),
        entityService.getEntities(projectId).catch(() => []),
        architectService.getAttachments(projectId, {}, { forceRefresh: true }).catch(() => []),
        architectService.getAttachmentQuota(projectId).catch(() => null),
      ]);
      setProject(proj);
      setEntities(ents || []);
      setAttachments(attList || []);
      setQuota(quotaData);
    } catch (err) {
      console.error('Failed to load attachment vault data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setShowUploadModal(true);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setShowUploadModal(true);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress('Encrypting and uploading files with AES-256-GCM...');

      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      if (uploadDescription) formData.append('description', uploadDescription);
      if (uploadEntityIds.length > 0) formData.append('entity_ids', JSON.stringify(uploadEntityIds));
      if (uploadTags) {
        const tagsArr = uploadTags.split(',').map((t) => t.trim()).filter(Boolean);
        formData.append('tags', JSON.stringify(tagsArr));
      }

      await architectService.uploadAttachments(projectId, formData);

      setSelectedFiles([]);
      setUploadDescription('');
      setUploadTags('');
      setUploadEntityIds([]);
      setShowUploadModal(false);
      toast.success('Files encrypted and stored in vault');
      await loadVaultData();
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleCreateLinkSubmit = async (e) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    try {
      await architectService.createAttachment(projectId, {
        title: linkTitle.trim(),
        filename: linkTitle.trim(),
        file_type: linkType,
        url: linkUrl.trim(),
        description: linkDesc.trim(),
        entity_ids: linkEntityIds,
      });

      setLinkTitle('');
      setLinkUrl('');
      setLinkDesc('');
      setLinkEntityIds([]);
      setShowLinkModal(false);
      toast.success('Reference link created');
      await loadVaultData();
    } catch (err) {
      console.error('Failed to create reference link:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteAttachment = async (attachmentId, filename) => {
    const confirmed = window.confirm(`Permanently delete "${filename}" from vault storage? This will remove all entity references.`);
    if (!confirmed) return;

    try {
      await architectService.deleteAttachment(attachmentId, projectId);
      toast.info('Attachment removed from vault');
      await loadVaultData();
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      toast.error('Error deleting attachment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUnlinkEntity = async (attachmentId, entityId) => {
    try {
      await architectService.unlinkEntityAttachment(entityId, attachmentId);
      toast.info('Entity unlinked');
      await loadVaultData();
      if (managingAttachment && managingAttachment.id === attachmentId) {
        setManagingAttachment((prev) => ({
          ...prev,
          linked_entities: (prev.linked_entities || []).filter((l) => l.entity_id !== entityId),
        }));
      }
    } catch (err) {
      console.error('Failed to unlink entity:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleLinkNewEntity = async () => {
    if (!managingAttachment || !entityToLink) return;
    try {
      await architectService.linkEntityAttachment(entityToLink, managingAttachment.id);
      setEntityToLink('');
      toast.success('Entity linked');
      await loadVaultData();
      const updated = await architectService.getAttachments(projectId, {}, { forceRefresh: true });
      const found = updated.find((a) => a.id === managingAttachment.id);
      if (found) setManagingAttachment(found);
    } catch (err) {
      console.error('Failed to link entity:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAnalyzeWithAI = async (attachment) => {
    try {
      setAnalyzingId(attachment.id);
      const res = await architectService.analyzeAttachment(attachment.id);
      setAiAnalysis({
        attachment,
        result: res.suggestions,
        note: res.note,
      });
      toast.success('AI canon analysis complete');
    } catch (err) {
      console.error('AI analysis failed:', err);
      toast.error('AI analysis failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAnalyzingId(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filtered attachments
  const filteredAttachments = attachments.filter((att) => {
    if (selectedType !== 'all') {
      if (selectedType === 'image' && att.file_type !== 'image') return false;
      if (selectedType === 'document' && att.file_type !== 'document') return false;
      if (selectedType === 'audio' && att.file_type !== 'audio') return false;
      if (selectedType === 'video' && att.file_type !== 'video') return false;
      if (selectedType === 'link' && att.file_type !== 'link') return false;
    }
    if (selectedEntityFilter) {
      const isLinked = (att.linked_entities || []).some(
        (l) => String(l.entity_id) === String(selectedEntityFilter)
      );
      if (!isLinked) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (att.filename || '').toLowerCase().includes(q);
      const descMatch = (att.description || '').toLowerCase().includes(q);
      const tagMatch = (att.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!nameMatch && !descMatch && !tagMatch) return false;
    }
    return true;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      case 'audio':
        return <Music className="w-4 h-4 text-purple-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-rose-500" />;
      case 'link':
        return <ExternalLink className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
        <Navbar currentProject={project} />
        <div className="flex-1 flex items-center justify-center text-xs text-[#8e8e93]">
          Loading private narrative attachment vault...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      <Navbar currentProject={project} />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#8e8e93] mb-1">
              <Link
                to={`/architect/${projectId}`}
                className="hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] transition-colors flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Story Architect</span>
              </Link>
              <span>/</span>
              <span className="text-[#1c1c1e] dark:text-[#f5f5f7]">Attachment Vault</span>
            </div>
            <h1 className="text-xl font-bold text-[#1c1c1e] dark:text-[#f5f5f7] flex items-center space-x-2">
              <Paperclip className="w-5 h-5 text-[#1c1c1e] dark:text-[#f5f5f7]" />
              <span>Private Narrative Attachment Vault</span>
            </h1>
            <p className="text-xs text-[#636366] dark:text-[#8e8e93] mt-0.5">
              Secure AES-256 encrypted media, blueprints, portraits, audio tracks, and reference documents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] bg-white dark:bg-[#222224] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
              <span>Add URL Link</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold btn btn-solid rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {/* Vault Storage Quota Card */}
        {quota && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    Encrypted Vault Storage: {formatBytes(quota.used_bytes)} / {formatBytes(quota.quota_bytes)}
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-400">
                    ({quota.usage_percent}% used)
                  </span>
                </div>
                <div className="w-full md:w-96 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      quota.usage_percent > 85 ? 'bg-red-500' : quota.usage_percent > 60 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, quota.usage_percent)}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Images: {quota.by_type?.image?.count || 0}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Docs: {quota.by_type?.document?.count || 0}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Audio: {quota.by_type?.audio?.count || 0}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Video: {quota.by_type?.video?.count || 0}</span>
                </span>
                <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>AES-256-GCM at rest</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Supports PNG, JPEG, WebP, GIF, SVG, PDF, DOCX, TXT, Markdown, MP3, WAV, MP4, WebM (up to 50MB per file)
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {['all', 'image', 'document', 'audio', 'video', 'link'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  selectedType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* Filter by Entity */}
            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 focus:outline-none"
            >
              <option value="">All Entities</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search files or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Attachments Grid */}
        {filteredAttachments.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-12 text-center">
            <Paperclip className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No attachments found</h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              Upload narrative assets, maps, moodboards or drag-and-drop files above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAttachments.map((att) => (
              <div
                key={att.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xs flex flex-col hover:border-neutral-300 dark:hover:border-neutral-700 transition-all group"
              >
                {/* Preview Thumbnail */}
                <div
                  onClick={() => setPreviewAttachment(att)}
                  className="w-full h-36 bg-neutral-100 dark:bg-neutral-800/80 relative flex items-center justify-center cursor-pointer overflow-hidden group-hover:opacity-95"
                >
                  {att.file_type === 'image' && (att.url || att.storage_path) ? (
                    <img
                      src={architectService.getAttachmentPreviewUrl(att.id)}
                      alt={att.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : att.file_type === 'audio' ? (
                    <div className="flex flex-col items-center space-y-1 text-purple-500">
                      <Music className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Audio Track</span>
                    </div>
                  ) : att.file_type === 'video' ? (
                    <div className="flex flex-col items-center space-y-1 text-rose-500">
                      <Video className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Video Asset</span>
                    </div>
                  ) : att.file_type === 'link' ? (
                    <div className="flex flex-col items-center space-y-1 text-blue-500">
                      <ExternalLink className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Web Reference</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1 text-amber-500">
                      <FileText className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Document</span>
                    </div>
                  )}

                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewAttachment(att);
                      }}
                      className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-xs transition-colors"
                      title="Inspect preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {att.storage_path && (
                      <a
                        href={architectService.getAttachmentDownloadUrl(att.id)}
                        onClick={(e) => e.stopPropagation()}
                        download={att.filename}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-xs transition-colors"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center space-x-1.5 mb-1">
                      {getTypeIcon(att.file_type)}
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate flex-1" title={att.filename}>
                        {att.filename}
                      </h4>
                    </div>

                    {att.description && (
                      <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                        {att.description}
                      </p>
                    )}

                    {/* Tags */}
                    {att.tags && att.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {att.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Linked Entities */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                        <span className="font-semibold">Linked Entities ({att.linked_entities?.length || 0}):</span>
                        <button
                          onClick={() => setManagingAttachment(att)}
                          className="text-blue-600 hover:underline flex items-center space-x-1"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Manage</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(att.linked_entities || []).slice(0, 3).map((l, i) => (
                          <Link
                            key={i}
                            to={`/entity/${projectId}/${l.entity_id}`}
                            className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 hover:text-blue-600 px-2 py-0.5 rounded-full bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 truncate max-w-[120px]"
                          >
                            {l.name}
                          </Link>
                        ))}
                        {(att.linked_entities?.length || 0) > 3 && (
                          <span className="text-[10px] text-neutral-400 self-center">
                            +{att.linked_entities.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                    <span>{att.file_size ? formatBytes(att.file_size) : 'External'}</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleAnalyzeWithAI(att)}
                        disabled={analyzingId === att.id}
                        className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded transition-colors"
                        title="Analyze lore with AI"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${analyzingId === att.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteAttachment(att.id, att.filename)}
                        className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                        title="Delete attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleUploadSubmit}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Upload to Encrypted Vault ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selected files list */}
              <div className="max-h-32 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300">
                    <span className="truncate max-w-[300px]">{f.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description / Lore Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="e.g. Royal crest blueprint for Chapter 4 scene..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. weapon, map, chapter1, concept-art"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Associate with Entities (Optional)
                </label>
                <select
                  multiple
                  value={uploadEntityIds}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions, (option) => option.value);
                    setUploadEntityIds(opts);
                  }}
                  className="w-full h-24 px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.entity_type})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-neutral-400 mt-0.5 block">Hold Ctrl/Cmd to select multiple entities</span>
              </div>

              {uploadProgress && (
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Encrypting & Saving...' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Link Modal */}
        {showLinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleCreateLinkSubmit}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Add Web Reference Link</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Title / Caption *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Victorian Architecture Reference"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Type
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  <option value="image">Image / Art URL</option>
                  <option value="document">Document / PDF Link</option>
                  <option value="link">General Reference Link</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={linkDesc}
                  onChange={(e) => setLinkDesc(e.target.value)}
                  placeholder="Notes on what this link references..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs"
                >
                  Save Reference Link
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Media Preview Modal */}
        {previewAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(previewAttachment.file_type)}
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                    {previewAttachment.filename}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  {previewAttachment.storage_path && (
                    <a
                      href={architectService.getAttachmentDownloadUrl(previewAttachment.id)}
                      download={previewAttachment.filename}
                      className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewAttachment(null)}
                    className="p-1 text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Preview Body */}
              <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950/50">
                {previewAttachment.file_type === 'image' ? (
                  <img
                    src={architectService.getAttachmentPreviewUrl(previewAttachment.id)}
                    alt={previewAttachment.filename}
                    className="max-h-[60vh] object-contain rounded-xl shadow-xs"
                  />
                ) : previewAttachment.file_type === 'audio' ? (
                  <div className="w-full max-w-md p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center space-y-4">
                    <Music className="w-12 h-12 text-purple-500 mx-auto" />
                    <audio
                      controls
                      src={architectService.getAttachmentPreviewUrl(previewAttachment.id)}
                      className="w-full"
                    />
                  </div>
                ) : previewAttachment.file_type === 'video' ? (
                  <video
                    controls
                    src={architectService.getAttachmentPreviewUrl(previewAttachment.id)}
                    className="max-h-[60vh] rounded-xl shadow-xs"
                  />
                ) : (
                  <div className="w-full max-w-lg p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
                    <FileText className="w-12 h-12 text-amber-500 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {previewAttachment.filename}
                    </p>
                    {previewAttachment.url && (
                      <a
                        href={previewAttachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Document Reference</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Metadata & Integrity Footer */}
                <div className="w-full max-w-xl mt-6 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span>File Size: {formatBytes(previewAttachment.file_size)}</span>
                    <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>AES-256 Verified</span>
                    </span>
                  </div>
                  {previewAttachment.metadata?.sha256 && (
                    <div className="text-[10px] font-mono text-neutral-400 break-all">
                      SHA-256: {previewAttachment.metadata.sha256}
                    </div>
                  )}
                  {previewAttachment.description && (
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 italic pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      "{previewAttachment.description}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Lore Analysis Modal */}
        {aiAnalysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-purple-600">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-sm font-bold">AI Narrative Asset Analysis</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAiAnalysis(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Asset
                </span>
                <p className="text-xs font-bold text-neutral-900 dark:text-white">
                  {aiAnalysis.attachment?.filename}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Suggested Narrative Lore & Role
                </span>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900">
                  {aiAnalysis.result?.lore_summary || 'Visual moodboard asset for universe consistency.'}
                </p>
              </div>

              {aiAnalysis.result?.suggested_entities && aiAnalysis.result.suggested_entities.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                    Suggested Relevant Entities
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysis.result.suggested_entities.map((entName, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                      >
                        {entName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-neutral-400 italic">
                {aiAnalysis.note}
              </p>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAiAnalysis(null)}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entity Link Manager Modal */}
        {managingAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Manage Entity Associations
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setManagingAttachment(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-500">
                Attachment: <span className="font-bold text-neutral-800 dark:text-neutral-200">{managingAttachment.filename}</span>
              </p>

              {/* Currently Linked Entities */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Connected Entities ({managingAttachment.linked_entities?.length || 0}):
                </span>
                {(!managingAttachment.linked_entities || managingAttachment.linked_entities.length === 0) ? (
                  <p className="text-xs text-neutral-400 italic">No entities associated yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {managingAttachment.linked_entities.map((l) => (
                      <div
                        key={l.entity_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs"
                      >
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{l.name}</span>
                        <button
                          onClick={() => handleUnlinkEntity(managingAttachment.id, l.entity_id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove association without deleting file"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Link */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Link Another Entity
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={entityToLink}
                    onChange={(e) => setEntityToLink(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                  >
                    <option value="">-- Choose Entity --</option>
                    {entities
                      .filter(
                        (e) =>
                          !(managingAttachment.linked_entities || []).some(
                            (l) => String(l.entity_id) === String(e.id)
                          )
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.entity_type})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleLinkNewEntity}
                    disabled={!entityToLink}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setManagingAttachment(null)}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}