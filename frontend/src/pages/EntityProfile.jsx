import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Sparkles,
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Save,
  Check,
  Tag,
  Clock,
  BookOpen,
  Image,
  Paperclip,
  Share2,
  Layers,
  ChevronRight,
  Quote,
  Eye,
  Sliders,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { projectService, entityService, relationshipService, architectService } from '../services/api';

export default function EntityProfile() {
  const { projectId, entityId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Form states for editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [canonStatus, setCanonStatus] = useState('draft');
  const [protectionLevel, setProtectionLevel] = useState(1);
  const [customProps, setCustomProps] = useState({});

  // Additional data
  const [facts, setFacts] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [attachments, setAttachments] = useState([]);

  // New relation modal state
  const [showAddRel, setShowAddRel] = useState(false);
  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState('Ally');

  // New custom prop state
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');
  const [newPropType, setNewPropType] = useState('text');

  // New attachment state
  const [showAddAttach, setShowAddAttach] = useState(false);
  const [attachTitle, setAttachTitle] = useState('');
  const [attachType, setAttachType] = useState('image');
  const [attachUrl, setAttachUrl] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId, entityId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proj, graph, ents, attachList] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getGraph(projectId),
        entityService.getEntities(projectId),
        architectService.getAttachments(projectId).catch(() => []),
      ]);

      setProject(proj);
      setAllEntities(ents || []);
      setAttachments(attachList || []);

      const current = (ents || []).find((e) => String(e.id) === String(entityId));
      if (current) {
        setEntity(current);
        setName(current.name || '');
        setDescription(current.description || '');
        setCanonStatus(current.canon_status || 'draft');
        setProtectionLevel(current.protection_level || 1);
        setCustomProps(current.custom_properties || {});

        // Extract facts
        setFacts(current.facts || []);

        // Filter relationships involving this entity
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

  const handleSaveCore = async () => {
    if (protectionLevel >= 3) {
      const confirmEdit = window.confirm(
        'This entity is LOCKED or IMMUTABLE under Canon Protection. Are you sure you want to alter its profile?'
      );
      if (!confirmEdit) return;
    }

    try {
      setSaving(true);
      const updated = await entityService.updateEntity(entityId, {
        name: name.trim(),
        description: description.trim(),
        canon_status: canonStatus,
        protection_level: protectionLevel,
        custom_properties: customProps,
      });
      setEntity(updated);
      alert('Entity saved successfully.');
    } catch (err) {
      console.error('Failed to update entity:', err);
      alert('Error updating entity: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (protectionLevel >= 3) {
      alert('Cannot delete: Entity is Protected/Locked (Level ' + protectionLevel + '). Lower protection level first.');
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete "${entity.name}"? This action is logged in audit history.`);
    if (!confirmed) return;

    try {
      await entityService.deleteEntity(entityId);
      navigate(`/architect/${projectId}`);
    } catch (err) {
      console.error('Failed to delete entity:', err);
      alert('Error deleting entity: ' + (err.response?.data?.detail || err.message));
    }
  };

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
      await loadData();
    } catch (err) {
      console.error('Failed to create relationship:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRemoveRelationship = async (edgeId) => {
    try {
      await relationshipService.deleteRelationship(edgeId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete relationship:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAddCustomProperty = () => {
    if (!newPropKey.trim()) return;
    setCustomProps((prev) => ({
      ...prev,
      [newPropKey.trim()]: newPropVal,
    }));
    setNewPropKey('');
    setNewPropVal('');
  };

  const handleRemoveCustomProperty = (key) => {
    setCustomProps((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleAddAttachment = async (e) => {
    e.preventDefault();
    if (!attachTitle.trim() || !attachUrl.trim()) return;
    try {
      await architectService.createAttachment(projectId, {
        title: attachTitle.trim(),
        attachment_type: attachType,
        file_url: attachUrl.trim(),
        entity_id: entityId,
      });
      setAttachTitle('');
      setAttachUrl('');
      setShowAddAttach(false);
      const updatedAttachments = await architectService.getAttachments(projectId, { forceRefresh: true });
      setAttachments(updatedAttachments || []);
    } catch (err) {
      console.error('Failed to add attachment:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col">
        <Navbar currentProject={project} />
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
          Loading entity profile...
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col">
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'relations', label: `Relations (${relationships.length})`, icon: Share2 },
    { id: 'history', label: `History & Facts (${facts.length})`, icon: Clock },
    { id: 'appearances', label: 'Appearances', icon: Eye },
    { id: 'properties', label: 'Properties', icon: Sliders },
    { id: 'attachments', label: 'Attachments Vault', icon: Paperclip },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col font-sans transition-colors">
      <Navbar currentProject={project} />

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Breadcrumb */}
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
              onClick={handleDelete}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Entity</span>
            </button>
            <button
              onClick={handleSaveCore}
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </div>

        {/* Hero Card / Profile Header */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-2xl font-black text-neutral-700 dark:text-neutral-300 select-none shadow-xs">
                {name.charAt(0).toUpperCase() || 'E'}
              </div>
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xl font-bold text-neutral-900 dark:text-white bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Entity Name..."
                />
                <div className="flex flex-wrap items-center gap-2 mt-2">
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

            <div className="flex items-center space-x-3 text-xs text-neutral-400">
              <span>First Appearance: Ch {entity.first_appearance || 1}</span>
              <span>•</span>
              <span>Canon ID: {String(entity.id).slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto pb-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
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
            );
          })}
        </div>

        {/* Tab Content Panes */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs min-h-[400px]">
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

              {/* Add Relationship Modal */}
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
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">Introduced in Chapter {entity.first_appearance || 1}</span>
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

          {/* 5. PROPERTIES TAB (Dynamic Hybrid Property System) */}
          {activeTab === 'properties' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Custom World-Building Properties
                  </h4>
                  <p className="text-xs text-neutral-500">Structured traits, statistics, titles, birthdates, or faction rankings</p>
                </div>
              </div>

              {/* Add Property Row */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40">
                <input
                  type="text"
                  placeholder="Property name (e.g. Title, Age, Alignment, House)"
                  value={newPropKey}
                  onChange={(e) => setNewPropKey(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newPropVal}
                  onChange={(e) => setNewPropVal(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomProperty}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Field
                </button>
              </div>

              {/* List of Properties */}
              <div className="space-y-2">
                {Object.keys(customProps).length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    No custom properties defined yet. Add key-value attributes above.
                  </div>
                ) : (
                  Object.entries(customProps).map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850"
                    >
                      <div className="flex items-center space-x-3">
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{key}:</span>
                        <span className="text-xs text-neutral-900 dark:text-white font-medium">{String(val)}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveCustomProperty(key)}
                        className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. ATTACHMENTS VAULT TAB */}
          {activeTab === 'attachments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Media & Moodboard Vault
                  </h4>
                  <p className="text-xs text-neutral-500">Reference portraits, maps, character sheets, and design inspirations</p>
                </div>
                <button
                  onClick={() => setShowAddAttach(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Attach Media</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {attachments
                  .filter((a) => !a.entity_id || String(a.entity_id) === String(entityId))
                  .map((att) => (
                    <div
                      key={att.id}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col"
                    >
                      {att.attachment_type === 'image' && att.file_url ? (
                        <img
                          src={att.file_url}
                          alt={att.title}
                          className="w-full h-36 object-cover bg-neutral-200 dark:bg-neutral-700"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-24 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                          <Paperclip className="w-6 h-6" />
                        </div>
                      )}
                      <div className="p-3">
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white truncate">{att.title}</h5>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">{att.attachment_type}</span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Add Attachment Modal */}
              {showAddAttach && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                  <form
                    onSubmit={handleAddAttachment}
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Attach Reference Media</h4>
                      <button
                        type="button"
                        onClick={() => setShowAddAttach(false)}
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
                        placeholder="e.g. Portrait, Royal Crest, Castle Blueprint"
                        value={attachTitle}
                        onChange={(e) => setAttachTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                        Type
                      </label>
                      <select
                        value={attachType}
                        onChange={(e) => setAttachType(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                      >
                        <option value="image">Image / Artwork</option>
                        <option value="document">Document / PDF</option>
                        <option value="link">External Reference Link</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                        Media URL / Link *
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://images.unsplash.com/..."
                        value={attachUrl}
                        onChange={(e) => setAttachUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddAttach(false)}
                        className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Save Attachment
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
