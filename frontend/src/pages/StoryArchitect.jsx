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
  Archive,
  Search,
  Filter,
  Maximize2,
  Grid,
  GitMerge,
  Eye,
  Sliders,
  X,
  ExternalLink,
  Copy,
  Edit2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import ImportExportModal from '../components/ImportExportModal';
import EntityMatchingDrawer from '../components/EntityMatchingDrawer';
import { useTheme } from '../context/ThemeContext';
import {
  projectService,
  entityService,
  relationshipService,
  architectService,
  getCached,
  setCached
} from '../services/api';

// Custom Node Component for Story Architect in Graphite Monochrome
function ArchitectNode({ data, selected }) {
  const canonColors = {
    draft: 'bg-[#1c1c1e]/5 dark:bg-white/5 text-[#8e8e93] border-[#1c1c1e]/10 dark:border-white/10',
    planned: 'bg-[#1c1c1e]/10 dark:bg-white/10 text-[#48484a] dark:text-[#c7c7cc] border-[#1c1c1e]/20 dark:border-white/20',
    established: 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] border-[#1c1c1e] dark:border-white font-medium',
    retired: 'bg-transparent text-[#8e8e93] border-[#1c1c1e]/10 dark:border-white/10 line-through',
  }[data.canon_status || 'draft'] || 'bg-[#1c1c1e]/5 text-[#8e8e93] border-[#1c1c1e]/10 dark:border-white/10';

  const protIcons = {
    1: Unlock,
    2: Shield,
    3: Lock,
    4: ShieldAlert,
  };
  const ProtIcon = protIcons[data.protection_level || 1] || Shield;

  return (
    <div
      className={`bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-xl border p-3.5 shadow-2xs transition-all w-60 text-left select-none border-l-2 border-l-[#1c1c1e] dark:border-l-white ${
        selected ? 'ring-2 ring-[#1c1c1e] dark:ring-white shadow-md' : 'hover:border-[#1c1c1e]/25 dark:hover:border-white/25'
      } ${data.isSearchMatch ? 'ring-2 ring-[#8e8e93] bg-[#f6f6f4] dark:bg-[#222224]' : 'border-[#1c1c1e]/10 dark:border-white/10'}`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-[#8e8e93] dark:bg-[#636366] border-2 border-white dark:border-[#1c1c1e]" />

      {/* Top Badges Row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9.5px] font-mono-cap px-2 py-0.5 rounded-full bg-[#1c1c1e]/5 dark:bg-white/10 text-[#636366] dark:text-[#8e8e93] uppercase tracking-wider">
          {data.entity_type || 'Entity'}
        </span>
        <div className="flex items-center space-x-1">
          <span className={`text-[9px] font-mono-cap px-1.5 py-0.2 rounded-full border ${canonColors} capitalize`}>
            {data.canon_status || 'draft'}
          </span>
          <span title={`Protection Level ${data.protection_level || 1}`}>
            <ProtIcon className="w-3 h-3 text-[#8e8e93]" />
          </span>
        </div>
      </div>

      {/* Name & Summary */}
      <h4 className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] leading-snug truncate">
        {data.label || data.name}
      </h4>
      {data.description && (
        <p className="text-[11px] text-[#636366] dark:text-[#8e8e93] line-clamp-2 mt-0.5 leading-relaxed">
          {data.description}
        </p>
      )}

      {/* Footer Details */}
      <div className="mt-2.5 pt-2 border-t border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between text-[10px] text-[#8e8e93] font-mono-cap">
        <span>Ch {data.first_appearance || 1}</span>
        <span className="text-[#1c1c1e] dark:text-white font-medium flex items-center space-x-0.5 hover:underline">
          <span>Profile</span>
          <ChevronRight className="w-2.5 h-2.5" />
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-[#8e8e93] dark:bg-[#636366] border-2 border-white dark:border-[#1c1c1e]" />
    </div>
  );
}

const nodeTypes = { architectNode: ArchitectNode };

export default function StoryArchitect() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
  const [showRenameCanvasModal, setShowRenameCanvasModal] = useState(false);
  const [renameCanvasTitle, setRenameCanvasTitle] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'failed'

  // Context Menu
  const [contextMenu, setContextMenu] = useState(null);

  // Connect Nodes Modal (Edge creation)
  const [pendingConnection, setPendingConnection] = useState(null);
  const [relLabel, setRelLabel] = useState('Ally');
  const [connectingRel, setConnectingRel] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, [projectId]);

  // Auto-fit nodes to screen whenever ReactFlow mounts, canvas switches, or nodes are loaded
  useEffect(() => {
    if (rfInstance && nodes.length > 0) {
      const timer = setTimeout(() => {
        rfInstance.fitView({ padding: 0.18, duration: 350 });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [rfInstance, activeCanvas?.id, viewMode, nodes.length]);

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
      const nodePosMap = new Map();
      if (Array.isArray(details.nodes)) {
        details.nodes.forEach((cn) => nodePosMap.set(String(cn.entity_id), { x: cn.x, y: cn.y }));
      }
      if (details.node_coords) {
        Object.entries(details.node_coords).forEach(([eid, pos]) => nodePosMap.set(String(eid), pos));
      }
      if (nodePosMap.size > 0) {
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
      setSaveStatus('saving');
      const payload = nodes.map((n) => ({
        entity_id: n.id,
        x: n.position.x,
        y: n.position.y,
      }));
      await architectService.saveCanvasNodes(activeCanvas.id, payload);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save canvas layout:', err);
      setSaveStatus('failed');
      alert('Error saving canvas: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Canvas Management Handlers
  const handleDuplicateCanvas = async () => {
    if (!activeCanvas) return;
    try {
      const copy = await architectService.duplicateCanvas(activeCanvas.id);
      setCanvases((prev) => [...prev, copy]);
      setActiveCanvas(copy);
    } catch (err) {
      alert('Failed to duplicate canvas: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteCanvas = async () => {
    if (!activeCanvas) return;
    if (canvases.length <= 1) {
      alert('At least one canvas must be retained in your story bible.');
      return;
    }
    const confirm = window.confirm(
      `Delete canvas "${activeCanvas.name || activeCanvas.title}"? Your narrative entities and relationships will remain safe and intact.`
    );
    if (!confirm) return;
    try {
      await architectService.deleteCanvas(activeCanvas.id);
      const remaining = canvases.filter((c) => c.id !== activeCanvas.id);
      setCanvases(remaining);
      setActiveCanvas(remaining[0] || null);
    } catch (err) {
      alert('Failed to delete canvas: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRenameCanvas = async (newName) => {
    if (!activeCanvas || !newName?.trim()) return;
    try {
      const updated = await architectService.updateCanvas(activeCanvas.id, { name: newName.trim() });
      setCanvases((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setActiveCanvas((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      alert('Failed to rename canvas: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Create New Canvas
  const handleCreateCanvas = async (e) => {
    e.preventDefault();
    if (!newCanvasTitle.trim()) return;
    try {
      const newCanvas = await architectService.createCanvas(projectId, {
        name: newCanvasTitle.trim(),
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

  // Node Click -> Open Quick Properties Drawer
  const onNodeClick = useCallback(
    (_, node) => {
      const fullEnt = entities.find((e) => String(e.id) === String(node.id)) || node.data;
      setSelectedEntity(fullEnt);
      setIsPropertiesDrawerOpen(true);
      setContextMenu(null);
    },
    [entities]
  );

  // Context Menu & Pane Interaction Handlers
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node: node,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onPaneDoubleClick = useCallback((event) => {
    setShowNewEntityModal(true);
  }, []);

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
            style: { stroke: isDark ? '#8e8e93' : '#3a3a3c', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#8e8e93' : '#3a3a3c' },
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
    <div className="h-screen w-full flex flex-col bg-[#f6f6f4] dark:bg-[#161618] overflow-hidden font-sans select-none text-[#1c1c1e] dark:text-[#f5f5f7] transition-colors duration-200">
      <Navbar currentProject={project} />

      {/* Story Architect Sub-Header / Control Ribbon */}
      <div className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border-b border-[#1c1c1e]/10 dark:border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 z-20 shadow-2xs shrink-0">
        {/* Left: View Mode Tabs & Canvases */}
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto no-scrollbar py-0.5">
          {/* Canvases Tabs */}
          <div className="flex items-center space-x-1 border-r border-[#1c1c1e]/10 dark:border-white/10 pr-2 sm:pr-3 shrink-0">
            {canvases.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCanvas(c)}
                className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeCanvas?.id === c.id
                    ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                    : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
                }`}
              >
                {c.name || c.title || 'Canvas'}
              </button>
            ))}
            <button
              onClick={() => setShowNewCanvasModal(true)}
              className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded-md hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 cursor-pointer shrink-0"
              title="Add Canvas"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {activeCanvas && (
              <div className="flex items-center space-x-0.5 pl-1 shrink-0">
                <button
                  onClick={() => {
                    setRenameCanvasTitle(activeCanvas.name || activeCanvas.title || '');
                    setShowRenameCanvasModal(true);
                  }}
                  className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
                  title="Rename active canvas"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={handleDuplicateCanvas}
                  className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
                  title="Duplicate active canvas"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {canvases.length > 1 && (
                  <button
                    onClick={handleDeleteCanvas}
                    className="p-1 text-[#8e8e93] hover:text-red-500 rounded cursor-pointer"
                    title="Delete active canvas (entities preserved)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4 Dedicated View Modes */}
          <div className="flex items-center bg-[#f6f6f4] dark:bg-[#161618] p-0.5 rounded-lg border border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
            <button
              onClick={() => handleViewModeChange('graph')}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'graph'
                  ? 'bg-[#fcfcfb] dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] shadow-2xs font-semibold'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <GitFork className="w-3 h-3 text-[#8e8e93]" />
              <span>Relationship</span>
            </button>
            <button
              onClick={() => handleViewModeChange('family')}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'family'
                  ? 'bg-[#fcfcfb] dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] shadow-2xs font-semibold'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Crown className="w-3 h-3 text-[#8e8e93]" />
              <span>Family Tree</span>
            </button>
            <button
              onClick={() => handleViewModeChange('plot')}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'plot'
                  ? 'bg-[#fcfcfb] dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] shadow-2xs font-semibold'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Layers className="w-3 h-3 text-[#8e8e93]" />
              <span>Plot Structure</span>
            </button>
            <button
              onClick={() => handleViewModeChange('timeline')}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'timeline'
                  ? 'bg-[#fcfcfb] dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] shadow-2xs font-semibold'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Eye className="w-3 h-3 text-[#8e8e93]" />
              <span>Timeline</span>
            </button>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 overflow-x-auto no-scrollbar py-0.5">
          {/* Search Bar */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3 h-3 text-[#8e8e93] absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-24 sm:w-28 lg:w-40 text-xs pl-7 pr-2 py-1 bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
            />
          </div>

          {/* Save status badge */}
          {saveStatus !== 'idle' && (
            <div className="flex items-center space-x-1 text-[11px] font-mono-cap px-2 py-1 rounded-md bg-[#1c1c1e]/5 dark:bg-white/5 border border-[#1c1c1e]/10 dark:border-white/10 shrink-0">
              {saveStatus === 'saving' && <span className="text-[#8e8e93] animate-pulse">Saving...</span>}
              {saveStatus === 'saved' && (
                <span className="text-[#1c1c1e] dark:text-white flex items-center space-x-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Saved</span>
                </span>
              )}
              {saveStatus === 'failed' && <span className="text-red-500 font-semibold">Save failed</span>}
            </div>
          )}

          {/* Matching Queue Button */}
          {matchingCandidatesCount > 0 && (
            <button
              onClick={() => setShowMatchingDrawer(true)}
              className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 bg-[#fcfcfb] dark:bg-[#222224] border border-[#1c1c1e]/20 dark:border-white/20 text-[#1c1c1e] dark:text-white rounded-lg text-xs font-semibold hover:border-[#1c1c1e]/40 dark:hover:border-white/40 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Review pending AI entity matches"
            >
              <GitMerge className="w-3.5 h-3.5 text-[#8e8e93]" />
              <span className="hidden sm:inline">Matches ({matchingCandidatesCount})</span>
              <span className="sm:hidden">({matchingCandidatesCount})</span>
            </button>
          )}

          <button
            onClick={() => setShowImportExportModal(true)}
            className="btn btn-outline btn-sm text-[11.5px] px-2 sm:px-3 shrink-0"
            title="Universal JSON & CSV import/export"
          >
            <Archive className="w-3.5 h-3.5 sm:mr-1 text-[#8e8e93]" />
            <span className="hidden sm:inline">Vault</span>
          </button>

          <button
            onClick={handleSaveLayout}
            className="btn btn-outline btn-sm text-[11.5px] px-2 sm:px-3 shrink-0"
            title="Persist node coordinates for this canvas"
          >
            <Save className="w-3.5 h-3.5 sm:mr-1 text-[#8e8e93]" />
            <span className="hidden sm:inline">Save Layout</span>
          </button>

          {/* Fit View Button on Mobile & Desktop */}
          <button
            onClick={() => rfInstance?.fitView({ padding: 0.18, duration: 400 })}
            className="btn btn-outline btn-sm text-[11.5px] px-2 sm:px-3 shrink-0"
            title="Frame all nodes to screen"
          >
            <Maximize2 className="w-3.5 h-3.5 sm:mr-1 text-[#8e8e93]" />
            <span className="hidden md:inline">Fit View</span>
          </button>

          <button
            onClick={() => setShowNewEntityModal(true)}
            className="btn btn-solid btn-sm text-[11.5px] px-2.5 sm:px-3 shadow-2xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">New Entity</span>
            <span className="sm:hidden">Entity</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Mobile Backdrop for Hierarchy Sidebar */}
        {isGroupTreeOpen && (
          <div
            onClick={() => setIsGroupTreeOpen(false)}
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-30 transition-opacity"
          />
        )}

        {/* Left: Collapsible Nested Group Hierarchy Sidebar */}
        <div
          className={`fixed md:relative inset-y-0 left-0 z-40 md:z-10 border-r border-[#1c1c1e]/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1c1c1e] shadow-2xl md:shadow-none transition-all duration-300 flex flex-col ${
            isGroupTreeOpen ? 'w-72 sm:w-80 md:w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:pointer-events-none'
          }`}
        >
          <div className="p-3 border-b border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between bg-[#f6f6f4]/60 dark:bg-[#161618]/60">
            <div className="flex items-center space-x-2 text-[10.5px] font-mono-cap uppercase tracking-wider text-[#8e8e93]">
              <FolderTree className="w-3.5 h-3.5" />
              <span>World Hierarchy</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowNewGroupModal(true)}
                className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
                title="Add World Group"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsGroupTreeOpen(false)}
                className="md:hidden p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
                title="Close Hierarchy"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] px-2 py-1">Universe Root</div>
            {groups.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8e8e93]">
                No groups defined. Click + above to organize your universe (e.g. Realms, Kingdoms, Factions).
              </div>
            ) : (
              groups.map((g) => (
                <div
                  key={g.id}
                  className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <ChevronRight className="w-3 h-3 text-[#8e8e93]" />
                    <span className="truncate">{g.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(g.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8e8e93] hover:text-red-500 transition-opacity cursor-pointer"
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
        <div className="flex-1 h-full relative bg-[#f6f6f4] dark:bg-[#161618] overflow-hidden">
          {/* Toggle sidebar button */}
          <button
            onClick={() => setIsGroupTreeOpen(!isGroupTreeOpen)}
            className="absolute top-3 left-3 z-20 p-2 bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg shadow-2xs text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white cursor-pointer"
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
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            onDoubleClick={onPaneDoubleClick}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            fitView
            fitViewOptions={{ padding: 0.18, minZoom: 0.25, maxZoom: 1.5 }}
            minZoom={0.2}
            maxZoom={2}
            panOnScroll={false}
            zoomOnPinch={true}
            panOnDrag={true}
            preventScrolling={false}
          >
            <Background
              variant="lines"
              gap={28}
              size={1}
              color={isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(28, 28, 30, 0.035)'}
            />
            <Controls className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg shadow-2xs overflow-hidden bottom-3 left-3" />
            <MiniMap
              nodeColor={() => (isDark ? '#48484a' : '#c7c7cc')}
              maskColor={isDark ? 'rgba(22, 22, 24, 0.75)' : 'rgba(246, 246, 244, 0.75)'}
              className="hidden md:block bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg overflow-hidden shadow-2xs"
            />
          </ReactFlow>

          {/* Context Menu for Node Actions */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-xl shadow-xl py-1 text-xs text-[#1c1c1e] dark:text-[#f5f5f7] min-w-[170px]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  const fullEnt = entities.find((e) => String(e.id) === String(contextMenu.node.id)) || contextMenu.node.data;
                  setSelectedEntity(fullEnt);
                  setIsPropertiesDrawerOpen(true);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 flex items-center space-x-2 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-[#8e8e93]" />
                <span>Quick Properties</span>
              </button>
              <Link
                to={`/entity/${projectId}/${contextMenu.node.id}`}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 flex items-center space-x-2 cursor-pointer"
                onClick={() => setContextMenu(null)}
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#8e8e93]" />
                <span>Full Profile &amp; Vault</span>
              </Link>
              <div className="border-t border-[#1c1c1e]/10 dark:border-white/10 my-1" />
              <button
                onClick={async () => {
                  if (contextMenu.node.data?.protection_level >= 3) {
                    alert('Cannot delete Locked or Immutable entity.');
                    setContextMenu(null);
                    return;
                  }
                  if (window.confirm(`Delete "${contextMenu.node.data?.name || contextMenu.node.data?.label}" from story bible?`)) {
                    await entityService.deleteEntity(contextMenu.node.id);
                    setNodes((prev) => prev.filter((n) => n.id !== contextMenu.node.id));
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center space-x-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entity</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Quick Properties Drawer (Collapsible) */}
        {isPropertiesDrawerOpen && selectedEntity && (
          <div className="w-80 border-l border-[#1c1c1e]/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1c1c1e] flex flex-col z-20 shadow-xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between bg-[#f6f6f4]/60 dark:bg-[#161618]/60">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#8e8e93]" />
                <h4 className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] font-mono-cap uppercase tracking-wider">
                  Quick Properties
                </h4>
              </div>
              <button
                onClick={() => setIsPropertiesDrawerOpen(false)}
                className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Entity Quick Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block mb-1">
                  Entity Name
                </label>
                <input
                  type="text"
                  value={selectedEntity.name || ''}
                  onChange={(e) => setSelectedEntity({ ...selectedEntity, name: e.target.value })}
                  onBlur={() => handleUpdateSelectedEntity({ name: selectedEntity.name })}
                  className="w-full px-3 py-1.5 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block mb-1">
                  Canon Status
                </label>
                <select
                  value={selectedEntity.canon_status || 'draft'}
                  onChange={(e) => {
                    setSelectedEntity({ ...selectedEntity, canon_status: e.target.value });
                    handleUpdateSelectedEntity({ canon_status: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                >
                  <option value="draft">Draft</option>
                  <option value="planned">Planned</option>
                  <option value="established">Established</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block mb-1">
                  Canon Protection Level
                </label>
                <select
                  value={selectedEntity.protection_level || 1}
                  onChange={(e) => {
                    const lvl = Number(e.target.value);
                    setSelectedEntity({ ...selectedEntity, protection_level: lvl });
                    handleUpdateSelectedEntity({ protection_level: lvl });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                >
                  <option value={1}>Level 1: Unlocked</option>
                  <option value={2}>Level 2: Protected</option>
                  <option value={3}>Level 3: Locked</option>
                  <option value={4}>Level 4: Immutable</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={selectedEntity.description || ''}
                  onChange={(e) => setSelectedEntity({ ...selectedEntity, description: e.target.value })}
                  onBlur={() => handleUpdateSelectedEntity({ description: selectedEntity.description })}
                  className="w-full p-2.5 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg leading-relaxed text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                />
              </div>

              {/* Link to Full Profile */}
              <div className="pt-2">
                <Link
                  to={`/entity/${projectId}/${selectedEntity.id}`}
                  className="btn btn-solid btn-md w-full shadow-2xs"
                >
                  <span>Open Full Universal Profile</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
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
              className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-[#8e8e93]" />
                  <span>Define Connection</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setPendingConnection(null);
                    setConnectionError(null);
                  }}
                  className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source -> Target Indicator */}
              <div className="p-2.5 rounded-lg bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 text-xs flex items-center justify-between">
                <span className="font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] truncate max-w-[120px]" title={srcName}>
                  {srcName}
                </span>
                <span className="text-[#8e8e93] font-bold px-2">&rarr;</span>
                <span className="font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] truncate max-w-[120px]" title={tgtName}>
                  {tgtName}
                </span>
              </div>

              {connectionError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                  {connectionError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">
                  Relationship Type *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Ally, Mentor, Parent, Ruler, Enemy, Located In"
                  value={relLabel}
                  onChange={(e) => setRelLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 text-[#1c1c1e] dark:text-[#f5f5f7]"
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
                  className="btn btn-outline btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingRel || !relLabel.trim()}
                  className="btn btn-solid btn-sm text-xs disabled:opacity-50"
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
            className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">Create New Entity</h4>
              <button
                type="button"
                onClick={() => setShowNewEntityModal(false)}
                className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. King Alden, Dragon Peak, Shadow Syndicate"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 text-[#1c1c1e] dark:text-[#f5f5f7]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Category</label>
                <select
                  value={newEntityType}
                  onChange={(e) => setNewEntityType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden capitalize text-[#1c1c1e] dark:text-[#f5f5f7]"
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
                <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Canon Status</label>
                <select
                  value={newEntityCanon}
                  onChange={(e) => setNewEntityCanon(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden text-[#1c1c1e] dark:text-[#f5f5f7]"
                >
                  <option value="draft">Draft</option>
                  <option value="planned">Planned</option>
                  <option value="established">Established</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Brief role and lore..."
                value={newEntityDesc}
                onChange={(e) => setNewEntityDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 text-[#1c1c1e] dark:text-[#f5f5f7]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewEntityModal(false)}
                className="btn btn-outline btn-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-solid btn-sm text-xs shadow-2xs"
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
            className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">Add World Group</h4>
              <button
                type="button"
                onClick={() => setShowNewGroupModal(false)}
                className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Group Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Northern Realms, High Council"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 text-[#1c1c1e] dark:text-[#f5f5f7]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Parent Group (Optional)</label>
              <select
                value={newGroupParentId}
                onChange={(e) => setNewGroupParentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden text-[#1c1c1e] dark:text-[#f5f5f7]"
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
                className="btn btn-outline btn-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-solid btn-sm text-xs shadow-2xs"
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
            className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">New Independent Canvas</h4>
              <button
                type="button"
                onClick={() => setShowNewCanvasModal(false)}
                className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Canvas Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Act 2 Battle Plan, Magic System Web"
                value={newCanvasTitle}
                onChange={(e) => setNewCanvasTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 text-[#1c1c1e] dark:text-[#f5f5f7]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCanvasModal(false)}
                className="btn btn-outline btn-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-solid btn-sm text-xs shadow-2xs"
              >
                Create Canvas
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Canvas Modal */}
      {showRenameCanvasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameCanvas(renameCanvasTitle);
              setShowRenameCanvasModal(false);
            }}
            className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">Rename Canvas</h4>
              <button
                type="button"
                onClick={() => setShowRenameCanvasModal(false)}
                className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] block mb-1">Canvas Name</label>
              <input
                type="text"
                required
                value={renameCanvasTitle}
                onChange={(e) => setRenameCanvasTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 text-[#1c1c1e] dark:text-[#f5f5f7]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameCanvasModal(false)}
                className="btn btn-outline btn-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-solid btn-sm text-xs shadow-2xs"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Feature Modals */}
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
