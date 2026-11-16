import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Sparkles,
  ArrowLeft,
  Trash2,
  Plus,
  Save,
  Tag,
  Clock,
  BookOpen,
  Image as ImageIcon,
  Paperclip,
  Share2,
  Layers,
  ChevronRight,
  Quote,
  Eye,
  Sliders,
  Calendar,
  AlertCircle,
  X,
  Upload,
  Download,
  ExternalLink,
  Search,
  MoveUp,
  MoveDown,
  FolderPlus,
  EyeOff,
  Music,
  Video,
  FileText,
  CheckCircle2,
  Link2,
  Unlink,
  Edit3,
  HelpCircle,
  CornerDownRight,
  Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { projectService, entityService, relationshipService, architectService } from '../services/api';

export default function EntityProfile() {
  const { projectId, entityId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [entity, setEntity] = useState(null);
  useDocumentTitle(entity?.name ? `${entity.name} | Lore Profile` : 'Lore Profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Core Entity editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [canonStatus, setCanonStatus] = useState('draft');
  const [protectionLevel, setProtectionLevel] = useState(1);

  // Dynamic Custom Properties & Tabs Meta
  const [customProps, setCustomProps] = useState({});
  const [propertyList, setPropertyList] = useState([]);
  const [sections, setSections] = useState(['General Attributes', 'Physical Details', 'Narrative Role']);
  const [customTabs, setCustomTabs] = useState([]);
  const [hiddenDefaultTabs, setHiddenDefaultTabs] = useState([]);
  const [parentEntityId, setParentEntityId] = useState('');
  const [inheritedData, setInheritedData] = useState(null);
  const [propSearchQuery, setPropSearchQuery] = useState('');

  // Graph and additional data
  const [facts, setFacts] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [attachments, setAttachments] = useState([]);

  // Modals state
  const [showAddRel, setShowAddRel] = useState(false);
  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState('Ally');

  // Add Property state
  const [showAddPropModal, setShowAddPropModal] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [newPropVal, setNewPropVal] = useState('');
  const [newPropSection, setNewPropSection] = useState('General Attributes');
  const [newPropTab, setNewPropTab] = useState('properties');
  const [newPropOptions, setNewPropOptions] = useState('');
  const [newPropRefEntity, setNewPropRefEntity] = useState('');

  // Add Section state
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Custom Tabs state
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTabLabel, setNewTabLabel] = useState('');
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');

  // Attachments Vault state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showLinkVaultModal, setShowLinkVaultModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [projectId, entityId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proj, graph, ents, attachList, resolvedProps] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getGraph(projectId),
        entityService.getEntities(projectId),
        architectService.getAttachments(projectId, {}, { forceRefresh: true }).catch(() => []),
        entityService.getResolvedProperties(entityId).catch(() => null),
      ]);

      setProject(proj);
      setAllEntities(ents || []);
      setAttachments(attachList || []);
      setInheritedData(resolvedProps);

      const current = (ents || []).find((e) => String(e.id) === String(entityId));
      if (current) {
        setEntity(current);
        setName(current.name || '');
        setDescription(current.description || '');
        setCanonStatus(current.canon_status || 'draft');
        setProtectionLevel(current.protection_level || 1);

        // Parse custom properties & meta
        const rawProps = current.custom_properties || {};
        setCustomProps(rawProps);

        const meta = rawProps._meta || {};
        if (Array.isArray(meta.sections) && meta.sections.length > 0) {
          setSections(meta.sections);
        }
        if (Array.isArray(meta.customTabs)) {
          setCustomTabs(meta.customTabs);
        }
        if (Array.isArray(meta.hiddenDefaultTabs)) {
          setHiddenDefaultTabs(meta.hiddenDefaultTabs);
        }
        if (meta.parentId || rawProps._parent_id) {
          setParentEntityId(meta.parentId || rawProps._parent_id);
        }

        // Initialize structured property list
        if (Array.isArray(meta.properties) && meta.properties.length > 0) {
          setPropertyList(meta.properties);
        } else {
          // Upgrade flat key-value pairs into structured properties
          const generated = [];
          let idx = 0;
          Object.entries(rawProps).forEach(([k, v]) => {
            if (!k.startsWith('_')) {
              generated.push({
                id: `prop_${Date.now()}_${idx++}`,
                key: k,
                label: k,
                value: v,
                type: typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text',
                section: 'General Attributes',
                tabId: 'properties',
                order: idx,
              });
            }
          });
          setPropertyList(generated);
        }

        // Extract facts & relations
        setFacts(current.facts || []);
        const nodeRels = (graph.edges || []).filter(
          (edge) => String(edge.source) === String(entityId) || String(edge.target) === String(entityId)
        );
        setRelationships(nodeRels);
      }
    } catch (err) {
      console.error('Failed to load entity details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compile final custom_properties dict for backend persistence
  const buildCustomPropertiesPayload = () => {
    const payload = {};

    // Keep flat key-value representations for compatibility
    propertyList.forEach((p) => {
      payload[p.key] = p.value;
    });

    // Store structured metadata
    payload._meta = {
      sections,
      properties: propertyList,
      customTabs,
      hiddenDefaultTabs,
      parentId: parentEntityId || null,
    };
    if (parentEntityId) {
      payload._parent_id = parentEntityId;
    }

    return payload;
  };

  const handleSaveProfile = async () => {
    if (protectionLevel >= 3) {
      const confirmEdit = window.confirm(
        'This entity is LOCKED or IMMUTABLE under Canon Protection. Are you sure you want to alter its profile?'
      );
      if (!confirmEdit) return;
    }

    try {
      setSaving(true);
      const compiledProps = buildCustomPropertiesPayload();
      const updated = await entityService.updateEntity(entityId, {
        name: name.trim(),
        description: description.trim(),
        canon_status: canonStatus,
        protection_level: protectionLevel,
        custom_properties: compiledProps,
      });
      setEntity(updated);
      setCustomProps(compiledProps);

      // Refresh resolved properties to update inheritance
      const refreshedResolved = await entityService.getResolvedProperties(entityId).catch(() => null);
      setInheritedData(refreshedResolved);

      toast.success('Entity profile and custom properties saved successfully');
    } catch (err) {
      console.error('Failed to update entity:', err);
      toast.error('Error updating entity: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntity = async () => {
    if (protectionLevel >= 3) {
      toast.warning('Cannot delete: Entity is Protected/Locked (Level ' + protectionLevel + '). Lower protection level first.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete "${entity.name}"? This action is logged in the project audit history.`
    );
    if (!confirmed) return;

    try {
      await entityService.deleteEntity(entityId);
      toast.info(`Entity "${entity.name}" deleted`);
      navigate(`/architect/${projectId}`);
    } catch (err) {
      console.error('Failed to delete entity:', err);
      toast.error('Error deleting entity: ' + (err.response?.data?.detail || err.message));
    }
  };

  // --- Dynamic Properties Logic ---
  const handleAddPropertySubmit = (e) => {
    e.preventDefault();
    if (!newPropKey.trim()) return;

    let initialValue = newPropVal;
    if (newPropType === 'boolean') {
      initialValue = Boolean(newPropVal === 'true' || newPropVal === true);
    } else if (newPropType === 'number') {
      initialValue = Number(newPropVal) || 0;
    } else if (newPropType === 'multi_select') {
      initialValue = newPropVal ? newPropVal.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else if (newPropType === 'entity_ref') {
      initialValue = newPropRefEntity || '';
    }

    const newProp = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      key: newPropKey.trim(),
      label: newPropKey.trim(),
      value: initialValue,
      type: newPropType,
      section: newPropSection || sections[0] || 'General Attributes',
      tabId: newPropTab || 'properties',
      options: newPropOptions ? newPropOptions.split(',').map((s) => s.trim()).filter(Boolean) : [],
      order: propertyList.length,
    };

    setPropertyList((prev) => [...prev, newProp]);
    setNewPropKey('');
    setNewPropVal('');
    setNewPropOptions('');
    setNewPropRefEntity('');
    setShowAddPropModal(false);
  };

  const handleUpdatePropertyValue = (propId, val) => {
    setPropertyList((prev) =>
      prev.map((p) => (p.id === propId ? { ...p, value: val } : p))
    );
  };

  const handleRemoveProperty = (propId) => {
    setPropertyList((prev) => prev.filter((p) => p.id !== propId));
  };

  const handleMoveProperty = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= propertyList.length) return;
    const updated = [...propertyList];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setPropertyList(updated);
  };

  const handleAddSectionSubmit = (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    if (!sections.includes(newSectionName.trim())) {
      setSections((prev) => [...prev, newSectionName.trim()]);
    }
    setNewSectionName('');
    setShowAddSectionModal(false);
  };

  // --- Custom Tabs Logic ---
  const handleAddCustomTabSubmit = (e) => {
    e.preventDefault();
    if (!newTabLabel.trim()) return;
    const tabId = `custom_tab_${Date.now()}`;
    const newTab = {
      id: tabId,
      label: newTabLabel.trim(),
      icon: 'Sliders',
      order: customTabs.length,
    };
    setCustomTabs((prev) => [...prev, newTab]);
    setNewTabLabel('');
    setShowAddTabModal(false);
    setActiveTab(tabId);
  };

  const handleRenameCustomTab = (tabId) => {
    if (!editingTabLabel.trim()) return;
    setCustomTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, label: editingTabLabel.trim() } : t))
    );
    setEditingTabId(null);
    setEditingTabLabel('');
  };

  const handleDeleteCustomTab = (tabId) => {
    const confirmed = window.confirm('Delete this custom tab? Assigned properties will be moved to the Properties tab.');
    if (!confirmed) return;

    // Move assigned properties to default 'properties' tab
    setPropertyList((prev) =>
      prev.map((p) => (p.tabId === tabId ? { ...p, tabId: 'properties' } : p))
    );
    setCustomTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTab === tabId) {
      setActiveTab('properties');
    }
  };

  const handleToggleDefaultTab = (tabId) => {
    if (hiddenDefaultTabs.includes(tabId)) {
      setHiddenDefaultTabs((prev) => prev.filter((t) => t !== tabId));
    } else {
      setHiddenDefaultTabs((prev) => [...prev, tabId]);
      if (activeTab === tabId) {
        setActiveTab('overview');
      }
    }
  };

  // --- Attachments Vault Logic ---
  const handleUploadFilesSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      Array.from(uploadFiles).forEach((f) => {
        formData.append('files', f);
      });
      if (uploadDesc) formData.append('description', uploadDesc);
      formData.append('entity_ids', JSON.stringify([entityId]));
      if (uploadTags) {
        const tagsArr = uploadTags.split(',').map((t) => t.trim()).filter(Boolean);
        formData.append('tags', JSON.stringify(tagsArr));
      }

      await architectService.uploadAttachments(projectId, formData);
      setUploadFiles([]);
      setUploadDesc('');
      setUploadTags('');
      setShowUploadModal(false);
      const updatedAttachments = await architectService.getAttachments(projectId, {}, { forceRefresh: true });
      setAttachments(updatedAttachments || []);
      toast.success('File uploaded to vault');
    } catch (err) {
      console.error('File upload failed:', err);
      toast.error('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleLinkExistingVaultAttachment = async (attId) => {
    try {
      await architectService.linkEntityAttachment(entityId, attId);
      const updatedAttachments = await architectService.getAttachments(projectId, {}, { forceRefresh: true });
      setAttachments(updatedAttachments || []);
      setShowLinkVaultModal(false);
      toast.success('Attachment linked to entity');
    } catch (err) {
      console.error('Failed to link attachment:', err);
      toast.error('Error linking attachment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUnlinkAttachment = async (attId) => {
    try {
      await architectService.unlinkEntityAttachment(entityId, attId);
      const updatedAttachments = await architectService.getAttachments(projectId, {}, { forceRefresh: true });
      setAttachments(updatedAttachments || []);
      toast.info('Attachment unlinked');
    } catch (err) {
      console.error('Failed to unlink attachment:', err);
      toast.error('Error unlinking attachment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteAttachmentPermanently = async (attId, filename) => {
    const confirmed = window.confirm(`Permanently delete "${filename}" from vault storage?`);
    if (!confirmed) return;
    try {
      await architectService.deleteAttachment(attId, projectId);
      const updatedAttachments = await architectService.getAttachments(projectId, {}, { forceRefresh: true });
      setAttachments(updatedAttachments || []);
      toast.info('Attachment deleted');
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAnalyzeAttachment = async (att) => {
    try {
      setAnalyzingId(att.id);
      const res = await architectService.analyzeAttachment(att.id);
      setAiAnalysis({
        attachment: att,
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

  // --- Relationships Logic ---
  const handleAddRelationship = async (e) => {
    e.preventDefault();
    if (!relTargetId) return;
    try {
      await relationshipService.createRelationship(projectId, {
        source_entity_id: entityId,
        target_entity_id: relTargetId,
        relation_type: relType,
      });
      setShowAddRel(false);
      setRelTargetId('');
      toast.success('Relationship connected');
      await loadData();
    } catch (err) {
      console.error('Failed to create relationship:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRemoveRelationship = async (edgeId) => {
    try {
      await relationshipService.deleteRelationship(edgeId);
      toast.info('Relationship removed');
      await loadData();
    } catch (err) {
      console.error('Failed to delete relationship:', err);
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col font-sans">
        <Navbar currentProject={project} />
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
          Loading comprehensive entity profile...
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col font-sans">
        <Navbar currentProject={project} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">Entity Not Found</h2>
          <p className="text-xs text-neutral-500 mt-1 mb-4">This entity may have been deleted or archived.</p>
          <Link
            to={`/architect/${projectId}`}
            className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg"
          >
            Back to Story Architect
          </Link>
        </div>
      </div>
    );
  }

  const canonStatusColors = {
    draft: 'bg-neutral-100 text-neutral-700 border-neutral-300',
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    established: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    retired: 'bg-neutral-200 text-neutral-500 border-neutral-300 line-through',
  }[canonStatus] || 'bg-neutral-100 text-neutral-700';

  const protectionLabels = {
    1: { label: 'Unlocked (Level 1)', color: 'text-neutral-500 bg-neutral-100 border-neutral-200', icon: Unlock },
    2: { label: 'Protected (Level 2)', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: Shield },
    3: { label: 'Locked (Level 3)', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Lock },
    4: { label: 'Immutable (Level 4)', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: ShieldAlert },
  };

  const ProtIcon = protectionLabels[protectionLevel]?.icon || Shield;

  // Filter linked attachments for this entity
  const entityAttachments = attachments.filter((a) =>
    (a.linked_entities || []).some((l) => String(l.entity_id) === String(entityId)) ||
    String(a.entity_id) === String(entityId)
  );

  // Available vault attachments to link
  const unlinkedVaultAttachments = attachments.filter(
    (a) => !entityAttachments.some((ea) => ea.id === a.id)
  );

  // Compute all tabs
  const defaultTabDefs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'relations', label: `Relations (${relationships.length})`, icon: Share2 },
    { id: 'history', label: `History & Facts (${facts.length})`, icon: Clock },
    { id: 'appearances', label: 'Appearances', icon: Eye },
    { id: 'properties', label: 'Properties', icon: Sliders },
    { id: 'attachments', label: `Vault Media (${entityAttachments.length})`, icon: Paperclip },
  ];

  const visibleDefaultTabs = defaultTabDefs.filter((t) => !hiddenDefaultTabs.includes(t.id));
  const allTabs = [
    ...visibleDefaultTabs,
    ...customTabs.map((ct) => ({
      id: ct.id,
      label: ct.label,
      icon: Sliders,
      isCustom: true,
    })),
  ];

  // Properties for active tab
  const activeTabProperties = propertyList.filter((p) => {
    if (activeTab === 'properties') {
      return !p.tabId || p.tabId === 'properties';
    }
    return p.tabId === activeTab;
  });

  // Filter properties by search query
  const searchedProperties = activeTabProperties.filter((p) => {
    if (!propSearchQuery.trim()) return true;
    const q = propSearchQuery.toLowerCase();
    return (
      p.key.toLowerCase().includes(q) ||
      String(p.value).toLowerCase().includes(q) ||
      (p.section || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col font-sans transition-colors">
      <Navbar currentProject={project} />

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link
            to={`/architect/${projectId}`}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Story Architect</span>
          </Link>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDeleteEntity}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Entity</span>
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </div>

        {/* Profile Header Hero Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-2xl font-black text-neutral-700 dark:text-neutral-300 select-none shadow-xs">
                {name.charAt(0).toUpperCase() || 'E'}
              </div>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xl font-bold text-neutral-900 dark:text-white bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Entity Name..."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    {entity.entity_type}
                  </span>

                  {/* Canon Status Selector */}
                  <select
                    value={canonStatus}
                    onChange={(e) => setCanonStatus(e.target.value)}
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${canonStatusColors} focus:outline-none cursor-pointer`}
                  >
                    <option value="draft">Canon: Draft</option>
                    <option value="planned">Canon: Planned</option>
                    <option value="established">Canon: Established</option>
                    <option value="retired">Canon: Retired</option>
                  </select>

                  {/* Protection Level Selector */}
                  <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                    <ProtIcon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                    <select
                      value={protectionLevel}
                      onChange={(e) => setProtectionLevel(Number(e.target.value))}
                      className="bg-transparent focus:outline-none text-neutral-700 dark:text-neutral-200 cursor-pointer"
                    >
                      <option value={1}>Level 1: Unlocked</option>
                      <option value={2}>Level 2: Protected</option>
                      <option value={3}>Level 3: Locked</option>
                      <option value={4}>Level 4: Immutable</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Hierarchical Parent Inheritance Selector */}
            <div className="flex flex-col md:items-end text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5">
                <CornerDownRight className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-500 font-semibold">Parent / Enclosing Entity:</span>
                <select
                  value={parentEntityId}
                  onChange={(e) => setParentEntityId(e.target.value)}
                  className="px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none"
                >
                  <option value="">None (Independent Root)</option>
                  {allEntities
                    .filter((e) => String(e.id) !== String(entityId))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.entity_type})
                      </option>
                    ))}
                </select>
              </div>

              {inheritedData?.parent_name && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Inheriting properties from {inheritedData.parent_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Tab Navigation & Custom Tabs Management */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto pb-0.5 gap-2">
          <div className="flex items-center space-x-1">
            {allTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div key={tab.id} className="relative flex items-center group">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap ${
                      isActive
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-white dark:bg-neutral-900 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-850'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>

                  {tab.isCustom && (
                    <button
                      onClick={() => handleDeleteCustomTab(tab.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition-opacity ml-[-6px] mr-1"
                      title="Delete custom tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center space-x-1 shrink-0 pb-1">
            <button
              onClick={() => setShowAddTabModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
              title="Add a custom tab to this entity profile"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Tab</span>
            </button>
          </div>
        </div>

        {/* Tab Panes Container */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs min-h-[450px]">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  Narrative Description & Profile Summary
                </label>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide a comprehensive narrative summary of this entity's role in the world..."
                  className="w-full p-4 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed text-neutral-800 dark:text-neutral-200"
                />
              </div>

              {/* Inherited Properties Preview */}
              {inheritedData?.inherited_properties && Object.keys(inheritedData.inherited_properties).length > 0 && (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Inherited Properties from {inheritedData.parent_name}</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold">Hierarchy active</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(inheritedData.inherited_properties).map(([k, v]) => (
                      <div key={k} className="p-2 rounded bg-white dark:bg-neutral-900 text-xs border border-emerald-100 dark:border-emerald-900">
                        <span className="text-neutral-400 font-semibold block text-[10px]">{k}:</span>
                        <span className="text-neutral-800 dark:text-neutral-200 font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/30">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-2">Canon Status Guidelines</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    <strong>Draft:</strong> Early idea; suggestions and contradictions are flagged gently.<br />
                    <strong>Established:</strong> Canonical element; any chapter violating its facts triggers High/Critical continuity alerts.<br />
                    <strong>Retired:</strong> Historical, deceased, or superseded lore; preserved for archive continuity.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/30">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-2">Protection Tier Guidelines</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    <strong>Level 1 (Unlocked):</strong> Open for rapid modification.<br />
                    <strong>Level 2 (Protected):</strong> Requires author review before automated AI updates.<br />
                    <strong>Level 3 (Locked):</strong> Explicit confirmation required to edit or delete.<br />
                    <strong>Level 4 (Immutable):</strong> World pillar; immutable core lore.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. RELATIONS TAB */}
          {activeTab === 'relations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Active Graph Relationships ({relationships.length})
                  </h4>
                  <p className="text-xs text-neutral-500">Connections linking {name} to other world entities</p>
                </div>
                <button
                  onClick={() => setShowAddRel(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Relationship</span>
                </button>
              </div>

              {relationships.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  No relationships recorded. Connect this entity on the Knowledge Graph or click Add Relationship above.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {relationships.map((rel) => {
                    const isSource = String(rel.source) === String(entityId);
                    const otherId = isSource ? rel.target : rel.source;
                    const otherEnt = allEntities.find((e) => String(e.id) === String(otherId));
                    const relLabel = rel.label || rel.data?.label || rel.relation_type || 'Connected to';

                    return (
                      <div
                        key={rel.id}
                        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <Share2 className="w-4 h-4 text-blue-500 shrink-0" />
                          <div>
                            <div className="flex items-center space-x-1.5 text-xs">
                              <span className="font-semibold text-neutral-500">{isSource ? 'Outbound' : 'Inbound'}:</span>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                {relLabel}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-neutral-900 dark:text-white mt-1 block">
                              {otherEnt ? otherEnt.name : `Entity #${String(otherId).slice(0, 6)}`}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveRelationship(rel.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Remove connection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. HISTORY & FACTS TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Verified Canonical Facts ({facts.length})
              </h4>
              {facts.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  No explicit facts recorded yet. Uploading chapters or running the AI Extraction pipeline extracts verifiable facts.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {facts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/30 text-xs"
                    >
                      <div className="flex items-start space-x-2">
                        <Quote className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200 leading-relaxed">
                          {fact.fact || fact}
                        </p>
                      </div>
                      {fact.source_quote && (
                        <blockquote className="mt-2 text-[11px] italic text-neutral-500 border-l-2 border-emerald-300 dark:border-emerald-700 pl-2">
                          "{fact.source_quote}"
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. APPEARANCES TAB */}
          {activeTab === 'appearances' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Manuscript Appearances
              </h4>
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    Introduced in Chapter {entity.first_appearance_chapter || entity.first_appearance || 1}
                  </span>
                  <p className="text-[11px] text-neutral-500">First recorded appearance in the manuscript canon.</p>
                </div>
                <Link
                  to={`/workspace/${projectId}`}
                  className="px-3 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  View in Workspace &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* 5. DYNAMIC PROPERTIES & CUSTOM TABS (Phase 4.1 & 4.2) */}
          {(activeTab === 'properties' || customTabs.some((t) => t.id === activeTab)) && (
            <div className="space-y-6">
              {/* Properties Top Bar: Search, Add Section, Add Property */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search properties in this tab..."
                    value={propSearchQuery}
                    onChange={(e) => setPropSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowAddSectionModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>New Section</span>
                  </button>
                  <button
                    onClick={() => {
                      setNewPropTab(activeTab);
                      setShowAddPropModal(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Property</span>
                  </button>
                </div>
              </div>

              {/* Grouped Properties by Section */}
              {sections.map((secName) => {
                const sectionProps = searchedProperties.filter(
                  (p) => (p.section || 'General Attributes') === secName
                );
                if (sectionProps.length === 0 && propSearchQuery) return null;

                return (
                  <div key={secName} className="space-y-3">
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        {secName} ({sectionProps.length})
                      </span>
                    </div>

                    {sectionProps.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic pl-3">
                        No properties in this section. Click Add Custom Property above.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sectionProps.map((prop, idx) => {
                          const globalIdx = propertyList.findIndex((p) => p.id === prop.id);
                          return (
                            <div
                              key={prop.id}
                              className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                            >
                              {/* Key and Type */}
                              <div className="flex items-center space-x-2.5 sm:w-1/3">
                                <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <div>
                                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                    {prop.label || prop.key}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-mono">
                                    {prop.type}
                                  </span>
                                </div>
                              </div>

                              {/* Value Editor according to Type */}
                              <div className="flex-1">
                                {prop.type === 'long_text' ? (
                                  <textarea
                                    rows={2}
                                    value={prop.value || ''}
                                    onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                  />
                                ) : prop.type === 'boolean' ? (
                                  <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(prop.value)}
                                      onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.checked)}
                                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                      {prop.value ? 'Enabled / True' : 'Disabled / False'}
                                    </span>
                                  </label>
                                ) : prop.type === 'number' ? (
                                  <input
                                    type="number"
                                    value={prop.value ?? ''}
                                    onChange={(e) => handleUpdatePropertyValue(prop.id, Number(e.target.value))}
                                    className="w-full max-w-xs px-3 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                  />
                                ) : prop.type === 'date' ? (
                                  <input
                                    type="date"
                                    value={prop.value || ''}
                                    onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.value)}
                                    className="w-full max-w-xs px-3 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                  />
                                ) : prop.type === 'select' ? (
                                  <select
                                    value={prop.value || ''}
                                    onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.value)}
                                    className="w-full max-w-xs px-3 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                  >
                                    <option value="">-- Select --</option>
                                    {(prop.options || []).map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : prop.type === 'entity_ref' ? (
                                  <div className="flex items-center space-x-2">
                                    <select
                                      value={prop.value || ''}
                                      onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.value)}
                                      className="flex-1 max-w-xs px-3 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                    >
                                      <option value="">-- Choose Referenced Entity --</option>
                                      {allEntities.map((e) => (
                                        <option key={e.id} value={e.id}>
                                          {e.name} ({e.entity_type})
                                        </option>
                                      ))}
                                    </select>
                                    {prop.value && (
                                      <Link
                                        to={`/entity/${projectId}/${prop.value}`}
                                        className="p-1 text-blue-600 hover:text-blue-800"
                                        title="View entity profile"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </Link>
                                    )}
                                  </div>
                                ) : prop.type === 'image' ? (
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="text"
                                      placeholder="https://image-url..."
                                      value={prop.value || ''}
                                      onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.value)}
                                      className="flex-1 px-3 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                    />
                                    {prop.value && (
                                      <img
                                        src={prop.value}
                                        alt={prop.key}
                                        className="w-7 h-7 rounded object-cover border border-neutral-300"
                                        onError={(e) => (e.target.style.display = 'none')}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={prop.value || ''}
                                    onChange={(e) => handleUpdatePropertyValue(prop.id, e.target.value)}
                                    className="w-full px-3 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                                  />
                                )}
                              </div>

                              {/* Ordering & Delete Actions */}
                              <div className="flex items-center space-x-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleMoveProperty(globalIdx, -1)}
                                  disabled={globalIdx === 0}
                                  className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                                  title="Move Up"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveProperty(globalIdx, 1)}
                                  disabled={globalIdx === propertyList.length - 1}
                                  className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                                  title="Move Down"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProperty(prop.id)}
                                  className="p-1 text-neutral-400 hover:text-red-600 transition-colors"
                                  title="Delete Property"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 6. ATTACHMENTS VAULT TAB (Phase 4.3) */}
          {activeTab === 'attachments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Linked Vault Media ({entityAttachments.length})
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Encrypted portraits, concept art, maps, character sheets, and audio references
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowLinkVaultModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors shadow-2xs"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Link from Vault</span>
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload to Entity</span>
                  </button>
                </div>
              </div>

              {entityAttachments.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  No attachments linked to this entity. Click "Upload to Entity" or "Link from Vault" above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {entityAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col group"
                    >
                      {/* Thumbnail / Media Container */}
                      <div
                        onClick={() => setPreviewAttachment(att)}
                        className="w-full h-36 bg-neutral-200 dark:bg-neutral-700 relative flex items-center justify-center cursor-pointer overflow-hidden"
                      >
                        {att.file_type === 'image' && (att.url || att.storage_path) ? (
                          <img
                            src={architectService.getAttachmentPreviewUrl(att.id)}
                            alt={att.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => (e.target.style.display = 'none')}
                          />
                        ) : att.file_type === 'audio' ? (
                          <Music className="w-10 h-10 text-purple-500" />
                        ) : att.file_type === 'video' ? (
                          <Video className="w-10 h-10 text-rose-500" />
                        ) : (
                          <FileText className="w-10 h-10 text-amber-500" />
                        )}

                        <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {att.storage_path && (
                            <a
                              href={architectService.getAttachmentDownloadUrl(att.id)}
                              download={att.filename}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur-xs"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Info & Actions */}
                      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <h5 className="text-xs font-bold text-neutral-900 dark:text-white truncate" title={att.filename}>
                            {att.filename}
                          </h5>
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                            {att.file_type}
                          </span>
                          {att.description && (
                            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1">
                              {att.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
                          <button
                            onClick={() => handleAnalyzeAttachment(att)}
                            disabled={analyzingId === att.id}
                            className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                          >
                            <Sparkles className={`w-3 h-3 ${analyzingId === att.id ? 'animate-spin' : ''}`} />
                            <span>AI Lore</span>
                          </button>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleUnlinkAttachment(att.id)}
                              className="p-1 text-neutral-400 hover:text-amber-600 rounded transition-colors"
                              title="Unlink from entity (keeps in vault)"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAttachmentPermanently(att.id, att.filename)}
                              className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                              title="Delete permanently"
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
            </div>
          )}
        </div>

        {/* Modal: Add Custom Property */}
        {showAddPropModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleAddPropertySubmit}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Add Custom Property</h4>
                <button
                  type="button"
                  onClick={() => setShowAddPropModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Property Name / Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Title, Age, Alignment, House, Power Rating"
                  value={newPropKey}
                  onChange={(e) => setNewPropKey(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Property Type
                </label>
                <select
                  value={newPropType}
                  onChange={(e) => setNewPropType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  <option value="text">Text (Single-line)</option>
                  <option value="long_text">Long text / Markdown</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown / Single-select</option>
                  <option value="multi_select">Multi-select / Tags</option>
                  <option value="boolean">Checkbox / Boolean</option>
                  <option value="image">Image / Media Reference</option>
                  <option value="entity_ref">Entity Reference (Linked World Entity)</option>
                </select>
              </div>

              {newPropType === 'select' && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Dropdown Options (Comma separated) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lawful Good, Neutral, Chaotic Evil"
                    value={newPropOptions}
                    onChange={(e) => setNewPropOptions(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                  />
                </div>
              )}

              {newPropType === 'entity_ref' && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Select Referenced Entity
                  </label>
                  <select
                    value={newPropRefEntity}
                    onChange={(e) => setNewPropRefEntity(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                  >
                    <option value="">-- Choose Entity --</option>
                    {allEntities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.entity_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Section Group
                </label>
                <select
                  value={newPropSection}
                  onChange={(e) => setNewPropSection(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Assign to Tab
                </label>
                <select
                  value={newPropTab}
                  onChange={(e) => setNewPropTab(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  <option value="properties">Properties (Default)</option>
                  {customTabs.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPropModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Property
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal: Add Section */}
        {showAddSectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleAddSectionSubmit}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Create Section Group</h4>
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Section Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Magic Aptitude, Political Affiliation"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Section
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal: Add Custom Tab */}
        {showAddTabModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleAddCustomTabSubmit}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Create Custom Tab</h4>
                <button
                  type="button"
                  onClick={() => setShowAddTabModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Tab Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spellbook, Equipment, Lore"
                  value={newTabLabel}
                  onChange={(e) => setNewTabLabel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTabModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Tab
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal: Upload Media to Entity */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleUploadFilesSubmit}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Upload Media to Vault</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Select File(s) *
                </label>
                <input
                  type="file"
                  multiple
                  required
                  onChange={(e) => setUploadFiles(e.target.files)}
                  className="w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 dark:file:bg-neutral-800 file:text-neutral-700 dark:file:text-neutral-300 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description / Caption (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official Sigil, Portrait, Map..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. portrait, crest, weapon"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

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
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Encrypting & Saving...' : 'Save Attachment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal: Link Existing Vault Attachment */}
        {showLinkVaultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Link Vault Media</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkVaultModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-500">
                Choose an asset from your project vault to associate with this entity without duplicating files:
              </p>

              {unlinkedVaultAttachments.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-6 text-center">
                  All vault assets are already linked to this entity.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {unlinkedVaultAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                        <div>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block truncate max-w-[260px]">
                            {att.filename}
                          </span>
                          <span className="text-[10px] text-neutral-400 uppercase">{att.file_type}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLinkExistingVaultAttachment(att.id)}
                        className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs"
                      >
                        Link
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowLinkVaultModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Preview Media */}
        {previewAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {previewAttachment.filename}
                </h3>
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
                  <div className="w-full max-w-md p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
                    <FileText className="w-12 h-12 text-amber-500 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {previewAttachment.filename}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: AI Analysis */}
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
                  {aiAnalysis.result?.lore_summary || 'Visual reference material.'}
                </p>
              </div>

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

        {/* Modal: Add Relationship */}
        {showAddRel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <form
              onSubmit={handleAddRelationship}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Create Relationship</h4>
                <button
                  type="button"
                  onClick={() => setShowAddRel(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Connect "{name}" to Target Entity *
                </label>
                <select
                  required
                  value={relTargetId}
                  onChange={(e) => setRelTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  <option value="">-- Choose Entity --</option>
                  {allEntities
                    .filter((e) => String(e.id) !== String(entityId))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.entity_type})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Relationship Type *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ally, Mentor, Parent, Ruler, Enemy, Member"
                  value={relType}
                  onChange={(e) => setRelType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRel(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Connection
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}