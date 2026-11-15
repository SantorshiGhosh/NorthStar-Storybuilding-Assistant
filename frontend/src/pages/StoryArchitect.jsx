import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Compass,
  GitFork,
  BookOpen,
  Feather,
  Plus,
  Trash2,
  Save,
  Layers,
  FolderTree,
  FolderPlus,
  Share2,
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Sparkles,
  Users,
  MapPin,
  Box,
  Crown,
  ChevronRight,
  ChevronDown,
  Camera,
  History,
  Archive,
  Search,
  Filter,
  Maximize2,
  Grid,
  GitMerge,
  Eye,
  Sliders,
  X,
  ExternalLink
} from 'lucide-react';
import Navbar from '../components/Navbar';
import AuditCentreModal from '../components/AuditCentreModal';
import SnapshotManagerModal from '../components/SnapshotManagerModal';
import ImportExportModal from '../components/ImportExportModal';
import EntityMatchingDrawer from '../components/EntityMatchingDrawer';
import {
  projectService,
  entityService,
  relationshipService,
  architectService,
  getCached,
  setCached
} from '../services/api';

// Custom Node Component for Story Architect
function ArchitectNode({ data, selected }) {
  const canonColors = {
    draft: 'bg-neutral-100 text-neutral-600 border-neutral-300',
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    established: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    retired: 'bg-neutral-200 text-neutral-500 border-neutral-300 line-through',
  }[data.canon_status || 'draft'] || 'bg-neutral-100 text-neutral-600 border-neutral-200';

  const protIcons = {
    1: Unlock,
    2: Shield,
    3: Lock,
    4: ShieldAlert,
  };
  const ProtIcon = protIcons[data.protection_level || 1] || Shield;

  const typeBg = {
    character: 'border-l-blue-500',
    family: 'border-l-indigo-500',
    location: 'border-l-emerald-500',
    faction: 'border-l-purple-500',
    plot: 'border-l-amber-500',
    event: 'border-l-rose-500',
  }[data.entity_type] || 'border-l-neutral-400';

  return (
    <div
      className={`bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 shadow-xs transition-all w-56 text-left select-none border-l-4 ${typeBg} ${
        selected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-neutral-400" />

      {/* Top Badges Row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
          {data.entity_type || 'Entity'}
        </span>
        <div className="flex items-center space-x-1">
          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border ${canonColors} capitalize`}>
            {data.canon_status || 'draft'}
          </span>
          <span title={`Protection Level ${data.protection_level || 1}`}>
            <ProtIcon className="w-3 h-3 text-neutral-400" />
          </span>
        </div>
      </div>

      {/* Name & Summary */}
      <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-snug truncate">
        {data.label || data.name}
      </h4>
      {data.description && (
        <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5 leading-relaxed">
          {data.description}
        </p>
      )}

      {/* Footer Details */}
      <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400">
        <span>Ch {data.first_appearance || 1}</span>
        <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center space-x-1">
          <span>Profile</span>
          <ChevronRight className="w-2.5 h-2.5" />
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-neutral-400" />
    </div>
  );
}

const nodeTypes = { architectNode: ArchitectNode };

export default function StoryArchitect() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // Core Data
  const [project, setProject] = useState(null);
  const [canvases, setCanvases] = useState([]);
  const [activeCanvas, setActiveCanvas] = useState(null);
  const [groups, setGroups] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // View Mode: 'graph', 'family', 'plot', 'timeline'
  const [viewMode, setViewMode] = useState('graph');

  // Sidebars & Modals
  const [isGroupTreeOpen, setIsGroupTreeOpen] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isPropertiesDrawerOpen, setIsPropertiesDrawerOpen] = useState(false);

  // Modals state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [showMatchingDrawer, setShowMatchingDrawer] = useState(false);
  const [matchingCandidatesCount, setMatchingCandidatesCount] = useState(0);

  // New Entity Modal
  const [showNewEntityModal, setShowNewEntityModal] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('character');
  const [newEntityDesc, setNewEntityDesc] = useState('');
  const [newEntityCanon, setNewEntityCanon] = useState('draft');

  // New Group Modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParentId, setNewGroupParentId] = useState('');

  // New Canvas Modal
  const [showNewCanvasModal, setShowNewCanvasModal] = useState(false);
  const [newCanvasTitle, setNewCanvasTitle] = useState('');

  // Connect Nodes Modal (Edge creation)
  const [pendingConnection, setPendingConnection] = useState(null);
  const [relLabel, setRelLabel] = useState('Ally');
  const [connectingRel, setConnectingRel] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, [projectId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [proj, canvasList, groupList, entList, graphData, matchings] = await Promise.all([
        projectService.getProject(projectId),
        architectService.getCanvases(projectId).catch(() => []),
        architectService.getGroups(projectId).catch(() => []),
        entityService.getEntities(projectId).catch(() => []),
        projectService.getGraph(projectId).catch(() => ({ nodes: [], edges: [] })),
        architectService.getMatchingCandidates(projectId).catch(() => []),
      ]);

      setProject(proj);
      setCanvases(canvasList || []);
      setGroups(groupList || []);
      setEntities(entList || []);
      setMatchingCandidatesCount(matchings?.length || 0);

      const defaultCanvas = canvasList?.[0] || null;
      setActiveCanvas(defaultCanvas);

      // Hydrate initial nodes and edges
      hydrateGraph(graphData, entList || [], viewMode);
    } catch (err) {
      console.error('Failed to load Story Architect data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert raw entities and graph data into layout-specific React Flow nodes and edges
  const hydrateGraph = (graphData, entList, mode) => {
    const rawNodes = graphData?.nodes || [];
    const rawEdges = graphData?.edges || [];

    // Map entity metadata into node data
    const entityMap = new Map((entList || []).map((e) => [String(e.id), e]));

    let flowNodes = rawNodes.map((n, idx) => {
      const ent = entityMap.get(String(n.id)) || {};
      let x = n.position?.x ?? (idx % 4) * 260 + 50;
      let y = n.position?.y ?? Math.floor(idx / 4) * 180 + 50;

      // Apply Layout depending on viewMode
      if (mode === 'family') {
        // Hierarchical level
        const level = ent.custom_properties?.generation || (idx % 3);
        x = (idx % 3) * 280 + 100;
        y = level * 200 + 80;
      } else if (mode === 'plot') {
        // Plot sequence
        const act = ent.custom_properties?.act || ((idx % 3) + 1);
        x = act * 300;
        y = (idx % 4) * 160 + 80;
      } else if (mode === 'timeline') {
        // Horizontal chronological flow
        const order = ent.first_appearance || idx + 1;
        x = order * 260;
        y = (idx % 2 === 0 ? 120 : 300);
      }

      return {
        id: String(n.id),
        type: 'architectNode',
        position: { x, y },
        data: {
          ...n.data,
          ...ent,
          label: ent.name || n.data?.label,
          canon_status: ent.canon_status || 'draft',
          protection_level: ent.protection_level || 1,
        },
      };
    });

    const flowEdges = rawEdges.map((e) => ({
      ...e,
      id: String(e.id || `${e.source}-${e.target}`),
      animated: mode === 'plot',
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  // Handle Switch View Mode
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    projectService.getGraph(projectId).then((graphData) => {
      hydrateGraph(graphData, entities, mode);
    });
  };

  // Switch Active Canvas
  const handleSelectCanvas = async (canvas) => {
    setActiveCanvas(canvas);
    try {
      const details = await architectService.getCanvasDetails(canvas.id);
      if (details.nodes && details.nodes.length > 0) {
        // Apply saved canvas node coordinates
        const nodePosMap = new Map(details.nodes.map((cn) => [String(cn.entity_id), { x: cn.x, y: cn.y }]));
        setNodes((prev) =>
          prev.map((node) => {
            const pos = nodePosMap.get(String(node.id));
            return pos ? { ...node, position: pos } : node;
          })
        );
      }
    } catch (err) {
      console.error('Failed to load canvas nodes:', err);
    }
  };

  // Save Canvas Layout Positions
  const handleSaveLayout = async () => {
    if (!activeCanvas) return;
    try {
      const payload = nodes.map((n) => ({
        entity_id: n.id,
        x: n.position.x,
        y: n.position.y,
      }));
      await architectService.saveCanvasNodes(activeCanvas.id, payload);
      alert('Canvas layout saved successfully!');
    } catch (err) {
      console.error('Failed to save canvas layout:', err);
      alert('Error saving canvas: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Create New Canvas
  const handleCreateCanvas = async (e) => {
    e.preventDefault();
    if (!newCanvasTitle.trim()) return;
    try {
      const newCanvas = await architectService.createCanvas(projectId, {
        title: newCanvasTitle.trim(),
        view_type: viewMode,
      });
      setCanvases((prev) => [...prev, newCanvas]);
      setActiveCanvas(newCanvas);
      setShowNewCanvasModal(false);
      setNewCanvasTitle('');
    } catch (err) {
      console.error('Failed to create canvas:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Apply World Template
  const handleApplyTemplate = async (templateType) => {
    const confirm = window.confirm(
      `Apply "${templateType.toUpperCase()}" starter template? This will add structured world categories and archetypes without overwriting existing entities.`
    );
    if (!confirm) return;
    try {
      setLoading(true);
      await architectService.applyTemplate(projectId, templateType);
      await loadInitialData();
    } catch (err) {
      console.error('Failed to apply template:', err);
      alert('Error applying template: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Node Click -> Open Quick Properties Drawer
  const onNodeClick = useCallback(
    (_, node) => {
      const fullEnt = entities.find((e) => String(e.id) === String(node.id)) || node.data;
      setSelectedEntity(fullEnt);
      setIsPropertiesDrawerOpen(true);
    },
    [entities]
  );

  // Connect two nodes (drag edge handle)
  const onConnect = useCallback((connection) => {
    setPendingConnection(connection);
    setConnectionError(null);
  }, []);

  const handleConfirmConnection = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!pendingConnection) return;
    try {
      setConnectingRel(true);
      setConnectionError(null);
      const cleanLabel = relLabel.trim() || 'Connected';
      const createdRel = await relationshipService.createRelationship(projectId, {
        source_entity_id: pendingConnection.source,
        target_entity_id: pendingConnection.target,
        relation_type: cleanLabel,
      });

      const newEdgeId = String(createdRel?.id || `rel-${Date.now()}`);
      const finalLabel = createdRel?.relation_type || cleanLabel;

      setEdges((eds) =>
        addEdge(
          {
            ...pendingConnection,
            id: newEdgeId,
            label: finalLabel,
            data: {
              id: newEdgeId,
              relation_type: finalLabel,
              label: finalLabel,
              source: pendingConnection.source,
              target: pendingConnection.target,
              ...createdRel,
            },
            style: { stroke: '#3b82f6', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
          },
          eds
        )
      );

      // Successfully saved: close modal and reset label
      setPendingConnection(null);
      setRelLabel('Ally');
    } catch (err) {
      console.error('Failed to connect entities:', err);
      const msg = err.response?.data?.detail || err.message || 'Error creating relationship';
      setConnectionError(msg);
      // NOTE: pendingConnection is NOT reset on error, keeping modal and values intact
    } finally {
      setConnectingRel(false);
    }
  };

  // Create New Entity
  const handleCreateEntity = async (e) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;
    try {
      const created = await entityService.createEntity(projectId, {
        name: newEntityName.trim(),
        entity_type: newEntityType,
        description: newEntityDesc.trim(),
        canon_status: newEntityCanon,
        protection_level: 1,
      });

      setEntities((prev) => [...prev, created]);
      const newNode = {
        id: String(created.id),
        type: 'architectNode',
        position: { x: 250, y: 150 },
        data: {
          ...created,
          label: created.name,
          canon_status: created.canon_status,
          protection_level: created.protection_level,
        },
      };
      setNodes((prev) => [...prev, newNode]);
      setShowNewEntityModal(false);
      setNewEntityName('');
      setNewEntityDesc('');
    } catch (err) {
      console.error('Failed to create entity:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Create New Nested Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const created = await architectService.createGroup(projectId, {
        name: newGroupName.trim(),
        group_type: 'hierarchy',
        parent_group_id: newGroupParentId || null,
      });
      setGroups((prev) => [...prev, created]);
      setShowNewGroupModal(false);
      setNewGroupName('');
      setNewGroupParentId('');
    } catch (err) {
      console.error('Failed to create group:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Delete Group (Safe Reparenting)
  const handleDeleteGroup = async (groupId) => {
    const confirm = window.confirm(
      'Delete this group? Child sub-groups will be safely promoted to root level. No entities will be deleted.'
    );
    if (!confirm) return;
    try {
      await architectService.deleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      console.error('Failed to delete group:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Update Entity Quick Properties in Drawer
  const handleUpdateSelectedEntity = async (updatedFields) => {
    if (!selectedEntity) return;
    try {
      const updated = await entityService.updateEntity(selectedEntity.id, updatedFields);
      setSelectedEntity(updated);
      setEntities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setNodes((prev) =>
        prev.map((n) =>
          n.id === String(updated.id)
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...updated,
                  label: updated.name,
                  canon_status: updated.canon_status,
                  protection_level: updated.protection_level,
                },
              }
            : n
        )
      );
    } catch (err) {
      console.error('Failed to update entity:', err);
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#fbfbf9] dark:bg-neutral-950 overflow-hidden font-sans select-none">
      <Navbar currentProject={project} />

      {/* Story Architect Sub-Header / Control Ribbon */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center justify-between z-20 shadow-2xs">
        {/* Left: View Mode Tabs & Canvases */}
        <div className="flex items-center space-x-3 overflow-x-auto">
          {/* Canvases Tabs */}
          <div className="flex items-center space-x-1 border-r border-neutral-200 dark:border-neutral-800 pr-3">
            {canvases.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCanvas(c)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeCanvas?.id === c.id
                    ? 'bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-850'
                }`}
              >
                {c.title}
              </button>
            ))}
            <button
              onClick={() => setShowNewCanvasModal(true)}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Add Canvas"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4 Dedicated View Modes */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => handleViewModeChange('graph')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'graph' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'
              }`}
            >
              <GitFork className="w-3 h-3 text-blue-500" />
              <span>Relationship</span>
            </button>
            <button
              onClick={() => handleViewModeChange('family')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'family' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'
              }`}
            >
              <Crown className="w-3 h-3 text-indigo-500" />
              <span>Family Tree</span>
            </button>
            <button
              onClick={() => handleViewModeChange('plot')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'plot' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'
              }`}
            >
              <Layers className="w-3 h-3 text-amber-500" />
              <span>Plot Structure</span>
            </button>
            <button
              onClick={() => handleViewModeChange('timeline')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'timeline' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'
              }`}
            >
              <Eye className="w-3 h-3 text-emerald-500" />
              <span>Timeline</span>
            </button>
          </div>

          {/* World Template Selector */}
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                handleApplyTemplate(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 focus:outline-none"
          >
            <option value="" disabled>Templates...</option>
            <option value="fantasy">High Fantasy Realm</option>
            <option value="scifi">Sci-Fi Galaxy</option>
            <option value="mystery">Gothic Mystery Town</option>
          </select>
        </div>

        {/* Right Action Tools: Snapshots, Audit, Matching Queue, Import/Export, + Node */}
        <div className="flex items-center space-x-2">
          {/* Matching Queue Button */}
          {matchingCandidatesCount > 0 && (
            <button
              onClick={() => setShowMatchingDrawer(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors animate-pulse"
              title="Review pending AI entity matches"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Review Matches ({matchingCandidatesCount})</span>
            </button>
          )}

          <button
            onClick={() => setShowSnapshotModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100"
            title="Point-in-time snapshots and rollbacks"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>Snapshots</span>
          </button>

          <button
            onClick={() => setShowAuditModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100"
            title="Activity audit and provenance trail"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setShowImportExportModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100"
            title="Universal JSON & CSV import/export"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600" />
            <span>Vault</span>
          </button>

          <button
            onClick={handleSaveLayout}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100"
            title="Persist node coordinates for this canvas"
          >
            <Save className="w-3.5 h-3.5 text-neutral-500" />
            <span>Save Layout</span>
          </button>

          <button
            onClick={() => setShowNewEntityModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Entity</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left: Collapsible Nested Group Hierarchy Sidebar */}
        <div
          className={`border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-all duration-300 flex flex-col z-10 ${
            isGroupTreeOpen ? 'w-64' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <FolderTree className="w-3.5 h-3.5 text-blue-600" />
              <span>World Hierarchy</span>
            </div>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
              title="Add World Group"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-[11px] font-semibold text-neutral-400 px-2 py-1">Universe Root</div>
            {groups.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No groups defined. Click + above to organize your universe (e.g. Realms, Kingdoms, Factions).
              </div>
            ) : (
              groups.map((g) => (
                <div
                  key={g.id}
                  className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <ChevronRight className="w-3 h-3 text-neutral-400" />
                    <span className="truncate">{g.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(g.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-600 transition-opacity"
                    title="Delete group (children reparented safely)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center: React Flow Canvas */}
        <div className="flex-1 h-full relative">
          {/* Toggle sidebar button */}
          <button
            onClick={() => setIsGroupTreeOpen(!isGroupTreeOpen)}
            className="absolute top-3 left-3 z-20 p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50"
            title={isGroupTreeOpen ? 'Collapse Hierarchy' : 'Expand Hierarchy'}
          >
            <FolderTree className="w-4 h-4" />
          </button>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background gap={18} size={1} color="#cbd5e1" />
            <Controls className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xs" />
            <MiniMap
              nodeColor={() => '#93c5fd'}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden shadow-xs"
            />
          </ReactFlow>
        </div>

        {/* Right: Quick Properties Drawer (Collapsible) */}
        {isPropertiesDrawerOpen && selectedEntity && (
          <div className="w-80 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col z-20 shadow-xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                  Quick Properties
                </h4>
              </div>
              <button
                onClick={() => setIsPropertiesDrawerOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Entity Quick Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Entity Name
                </label>
                <input
                  type="text"
                  value={selectedEntity.name || ''}
                  onChange={(e) => setSelectedEntity({ ...selectedEntity, name: e.target.value })}
                  onBlur={() => handleUpdateSelectedEntity({ name: selectedEntity.name })}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-bold text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Canon Status
                </label>
                <select
                  value={selectedEntity.canon_status || 'draft'}
                  onChange={(e) => {
                    setSelectedEntity({ ...selectedEntity, canon_status: e.target.value });
                    handleUpdateSelectedEntity({ canon_status: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                >
                  <option value="draft">Draft</option>
                  <option value="planned">Planned</option>
                  <option value="established">Established</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Canon Protection Level
                </label>
                <select
                  value={selectedEntity.protection_level || 1}
                  onChange={(e) => {
                    const lvl = Number(e.target.value);
                    setSelectedEntity({ ...selectedEntity, protection_level: lvl });
                    handleUpdateSelectedEntity({ protection_level: lvl });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200"
                >
                  <option value={1}>Level 1: Unlocked</option>
                  <option value={2}>Level 2: Protected</option>
                  <option value={3}>Level 3: Locked</option>
                  <option value={4}>Level 4: Immutable</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={selectedEntity.description || ''}
                  onChange={(e) => setSelectedEntity({ ...selectedEntity, description: e.target.value })}
                  onBlur={() => handleUpdateSelectedEntity({ description: selectedEntity.description })}
                  className="w-full p-2.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg leading-relaxed text-neutral-800 dark:text-neutral-200"
                />
              </div>

              {/* Link to Full Profile */}
              <div className="pt-2">
                <Link
                  to={`/entity/${projectId}/${selectedEntity.id}`}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-2xs"
                >
                  <span>Open Full Universal Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connect Nodes Edge Type Modal */}
      {pendingConnection && (() => {
        const sourceEnt = entities.find((e) => String(e.id) === String(pendingConnection.source));
        const targetEnt = entities.find((e) => String(e.id) === String(pendingConnection.target));
        const srcName = sourceEnt?.name || `Node #${String(pendingConnection.source).slice(0, 6)}`;
        const tgtName = targetEnt?.name || `Node #${String(pendingConnection.target).slice(0, 6)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <form
              onSubmit={handleConfirmConnection}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Define Connection</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setPendingConnection(null);
                    setConnectionError(null);
                  }}
                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source -> Target Indicator */}
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs flex items-center justify-between">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[120px]" title={srcName}>
                  {srcName}
                </span>
                <span className="text-neutral-400 font-bold px-2">&rarr;</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[120px]" title={tgtName}>
                  {tgtName}
                </span>
              </div>

              {connectionError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {connectionError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Relationship Type *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Ally, Mentor, Parent, Ruler, Enemy, Located In"
                  value={relLabel}
                  onChange={(e) => setRelLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendingConnection(null);
                    setConnectionError(null);
                  }}
                  disabled={connectingRel}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingRel || !relLabel.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {connectingRel ? 'Connecting...' : 'Connect Nodes'}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Create New Entity Modal */}
      {showNewEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateEntity}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Create New Entity</h4>
              <button
                type="button"
                onClick={() => setShowNewEntityModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. King Alden, Dragon Peak, Shadow Syndicate"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Category</label>
                <select
                  value={newEntityType}
                  onChange={(e) => setNewEntityType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none capitalize"
                >
                  <option value="character">Character</option>
                  <option value="family">Family / Dynasty</option>
                  <option value="location">Location</option>
                  <option value="faction">Faction / Org</option>
                  <option value="plot">Plot Beat</option>
                  <option value="event">Historical Event</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Canon Status</label>
                <select
                  value={newEntityCanon}
                  onChange={(e) => setNewEntityCanon(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="planned">Planned</option>
                  <option value="established">Established</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Brief role and lore..."
                value={newEntityDesc}
                onChange={(e) => setNewEntityDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewEntityModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Node
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateGroup}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Add World Group</h4>
              <button
                type="button"
                onClick={() => setShowNewGroupModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Group Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Northern Realms, High Council"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Parent Group (Optional)</label>
              <select
                value={newGroupParentId}
                onChange={(e) => setNewGroupParentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
              >
                <option value="">Root Universe Level</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewGroupModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Group
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create New Canvas Modal */}
      {showNewCanvasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateCanvas}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">New Independent Canvas</h4>
              <button
                type="button"
                onClick={() => setShowNewCanvasModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">Canvas Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Act 2 Battle Plan, Magic System Web"
                value={newCanvasTitle}
                onChange={(e) => setNewCanvasTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCanvasModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
              >
                Create Canvas
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Feature Modals */}
      <AuditCentreModal
        projectId={projectId}
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />

      <SnapshotManagerModal
        projectId={projectId}
        isOpen={showSnapshotModal}
        onClose={() => setShowSnapshotModal(false)}
        onSnapshotRestored={() => loadInitialData()}
      />

      <ImportExportModal
        projectId={projectId}
        projectName={project?.name}
        isOpen={showImportExportModal}
        onClose={() => setShowImportExportModal(false)}
        onImportSuccess={() => loadInitialData()}
      />

      <EntityMatchingDrawer
        projectId={projectId}
        isOpen={showMatchingDrawer}
        onClose={() => setShowMatchingDrawer(false)}
        onCandidateResolved={() => {
          loadInitialData();
        }}
      />
    </div>
  );
}
