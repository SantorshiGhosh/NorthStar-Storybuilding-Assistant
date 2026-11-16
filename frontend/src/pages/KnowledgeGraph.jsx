import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  GitFork,
  Search,
  Filter,
  Users,
  MapPin,
  Box,
  Scroll,
  Shield,
  X,
  Edit2,
  Quote,
  Check,
  Plus
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { projectService, entityService, getCached } from '../services/api';

// Custom React Flow Node Card
function CustomEntityNode({ data, selected }) {
  return (
    <div
      className={`bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-xl border p-3.5 shadow-2xs transition-all w-56 text-left select-none border-l-2 border-l-[#1c1c1e] dark:border-l-white ${
        selected
          ? 'ring-2 ring-[#1c1c1e] dark:ring-white shadow-md'
          : 'border-[#1c1c1e]/10 dark:border-white/10 hover:border-[#1c1c1e]/25 dark:hover:border-white/25'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-[#8e8e93] dark:bg-[#636366] border-2 border-white dark:border-[#1c1c1e]" />

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9.5px] font-mono-cap px-2 py-0.5 rounded-full bg-[#1c1c1e]/5 dark:bg-white/10 text-[#636366] dark:text-[#8e8e93] uppercase tracking-wider">
          {data.badge || data.entity_type}
        </span>
        <span className="text-[10px] text-[#8e8e93] font-mono-cap">
          Ch {data.first_appearance || 1}
        </span>
      </div>

      <h4 className="text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] leading-snug truncate">
        {data.label || data.name}
      </h4>

      {data.description && (
        <p className="text-[11px] text-[#636366] dark:text-[#8e8e93] line-clamp-1 mt-0.5 leading-relaxed">
          {data.description}
        </p>
      )}

      {data.traits && data.traits.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {data.traits.slice(0, 2).map((t, idx) => (
            <span key={idx} className="text-[9.5px] font-mono-cap px-1.5 py-0.2 rounded-sm bg-[#1c1c1e]/5 dark:bg-white/10 text-[#636366] dark:text-[#8e8e93]">
              {t}
            </span>
          ))}
          {data.traits.length > 2 && (
            <span className="text-[9.5px] text-[#8e8e93] font-mono-cap">+{data.traits.length - 2}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between text-[10px] text-[#8e8e93] font-mono-cap">
        <span className="flex items-center space-x-1 text-[#1c1c1e] dark:text-[#f5f5f7] font-medium">
          <Quote className="w-2.5 h-2.5 text-[#8e8e93]" />
          <span>{data.fact_count || 0} facts</span>
        </span>
        <span className="hover:underline flex items-center space-x-0.5 text-[#1c1c1e] dark:text-white">
          <span>Inspect &rarr;</span>
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-[#8e8e93] dark:bg-[#636366] border-2 border-white dark:border-[#1c1c1e]" />
    </div>
  );
}

const nodeTypes = { custom: CustomEntityNode };

export default function KnowledgeGraph() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const cachedGraph = getCached(`graph:${projectId}`);
  const cachedProj = getCached(`project:${projectId}`);
  const cachedEnts = getCached(`entities:${projectId}:{}`);

  const [project, setProject] = useState(() => cachedProj || null);
  useDocumentTitle(project?.name ? `${project.name} | Knowledge Graph` : 'Knowledge Graph');
  const [nodes, setNodes, onNodesChange] = useNodesState(() => cachedGraph?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => cachedGraph?.edges || []);
  const [allNodes, setAllNodes] = useState(() => cachedGraph?.nodes || []);
  const [rawEntities, setRawEntities] = useState(() => cachedEnts || []);
  const [loading, setLoading] = useState(() => !cachedGraph);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');

  // Selected Entity Drawer
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Edit Entity Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTraitsStr, setEditTraitsStr] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Load Graph Data in parallel
  const loadGraph = async () => {
    try {
      if (!cachedGraph) setLoading(true);
      const [proj, graphData, ents] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getGraph(projectId),
        entityService.getEntities(projectId)
      ]);

      setProject(proj);
      setNodes(graphData.nodes || []);
      setAllNodes(graphData.nodes || []);
      setEdges(graphData.edges || []);
      setRawEntities(ents);
    } catch (err) {
      console.error('Failed to load graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadGraph();
    }
  }, [projectId]);

  // Filter nodes based on type and search query
  useEffect(() => {
    let filtered = allNodes;
    if (activeTypeFilter !== 'all') {
      filtered = filtered.filter((n) => n.data.entity_type === activeTypeFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.data.label.toLowerCase().includes(term) ||
          (n.data.description && n.data.description.toLowerCase().includes(term))
      );
    }
    setNodes(filtered);
  }, [activeTypeFilter, searchTerm, allNodes]);

  // Click on a node
  const onNodeClick = async (event, node) => {
    try {
      const fullEntity = await entityService.getEntity(node.id);
      setSelectedEntity(fullEntity);
      setDrawerOpen(true);
    } catch (e) {
      setSelectedEntity(node.data);
      setDrawerOpen(true);
    }
  };

  // Open Edit Entity
  const handleOpenEdit = () => {
    if (!selectedEntity) return;
    setEditName(selectedEntity.name);
    setEditDesc(selectedEntity.description || '');
    setEditTraitsStr((selectedEntity.traits || []).join(', '));
    setShowEditModal(true);
  };

  // Save Entity Edits
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedEntity) return;
    try {
      setSavingEdit(true);
      const traitsArray = editTraitsStr.split(',').map((t) => t.trim()).filter(Boolean);
      const updated = await entityService.updateEntity(selectedEntity.id, {
        name: editName,
        description: editDesc,
        traits: traitsArray,
      });
      setSelectedEntity(updated);
      setShowEditModal(false);
      loadGraph(); // refresh nodes
    } catch (err) {
      console.error('Failed to update entity:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const filterTabs = [
    { id: 'all', label: 'All Entities' },
    { id: 'character', label: 'Characters' },
    { id: 'location', label: 'Locations' },
    { id: 'object', label: 'Objects' },
    { id: 'rule', label: 'World Rules' },
    { id: 'faction', label: 'Factions' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] overflow-hidden font-sans select-none transition-colors duration-200">
      <Navbar currentProject={project} />

      {/* Control Bar: Search & Type Filter Tabs */}
      <div className="bg-[#fcfcfb] dark:bg-[#1c1c1e] border-b border-[#1c1c1e]/10 dark:border-white/10 px-3 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 z-10 shadow-2xs">
        <div className="flex items-center space-x-2 min-w-0 max-w-full overflow-x-auto no-scrollbar py-0.5">
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search narrative graph..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30 w-44 sm:w-64"
            />
          </div>

          <div className="flex items-center space-x-1 pl-1 shrink-0 overflow-x-auto no-scrollbar">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono-cap transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTypeFilter === tab.id
                    ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs font-medium'
                    : 'text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono-cap text-[#8e8e93] flex items-center space-x-2 sm:space-x-3 shrink-0">
          <span>{nodes.length} entities</span>
          <span>&bull;</span>
          <span>{edges.length} connections</span>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 min-h-0 relative bg-[#f6f6f4] dark:bg-[#161618] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          attributionPosition="bottom-left"
        >
          <Background
            variant="lines"
            gap={28}
            size={1}
            color={isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(28, 28, 30, 0.035)'}
          />
          <Controls className="bg-[#fcfcfb]! dark:bg-[#1c1c1e]! border-[#1c1c1e]/10! dark:border-white/10! rounded-lg shadow-2xs! overflow-hidden text-[#1c1c1e] dark:text-[#f5f5f7] bottom-3 left-3" />
          <MiniMap
            nodeColor={() => (isDark ? '#48484a' : '#c7c7cc')}
            maskColor={isDark ? 'rgba(22, 22, 24, 0.75)' : 'rgba(246, 246, 244, 0.75)'}
            className="hidden md:block bg-[#fcfcfb] dark:bg-[#1c1c1e] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg overflow-hidden shadow-2xs"
          />
        </ReactFlow>

        {/* Slide-over Entity Inspector Drawer */}
        {drawerOpen && selectedEntity && (
          <aside className="absolute top-0 right-0 h-full w-full sm:w-96 bg-[#fcfcfb] dark:bg-[#1c1c1e] border-l border-[#1c1c1e]/10 dark:border-white/10 shadow-xl z-20 flex flex-col text-left animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between bg-[#f6f6f4]/60 dark:bg-[#161618]/60">
              <div className="flex items-center space-x-2">
                <span className="text-[9.5px] font-mono-cap px-2 py-0.5 rounded-full bg-[#1c1c1e]/5 dark:bg-white/10 text-[#636366] dark:text-[#8e8e93] uppercase tracking-wider">
                  {selectedEntity.entity_type}
                </span>
                <span className="text-[10px] text-[#8e8e93] font-mono-cap">
                  Seen Ch {selectedEntity.first_appearance_chapter || 1}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleOpenEdit}
                  className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] rounded-md hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Edit Entity"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-white rounded-md hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
                  {selectedEntity.name}
                </h3>
                <p className="text-xs text-[#636366] dark:text-[#8e8e93] leading-relaxed">
                  {selectedEntity.description || 'No description established yet.'}
                </p>
              </div>

              {/* Traits */}
              <div>
                <h4 className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] mb-2">
                  Recognized Canon Traits
                </h4>
                {selectedEntity.traits && selectedEntity.traits.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntity.traits.map((trait, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#1c1c1e]/5 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] border border-[#1c1c1e]/10 dark:border-white/10"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#8e8e93]">No explicit traits extracted.</span>
                )}
              </div>

              {/* Established Story Facts */}
              <div>
                <h4 className="text-[10px] font-mono-cap uppercase tracking-wider text-[#8e8e93] mb-2 flex items-center space-x-1.5">
                  <Quote className="w-3 h-3 text-[#8e8e93]" />
                  <span>Established Canon Facts ({selectedEntity.facts ? selectedEntity.facts.length : 0})</span>
                </h4>

                {selectedEntity.facts && selectedEntity.facts.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedEntity.facts.map((fact) => (
                      <div
                        key={fact.id}
                        className="bg-[#f6f6f4] dark:bg-[#161618] rounded-xl p-3 border border-[#1c1c1e]/10 dark:border-white/10"
                      >
                        <p className="text-xs font-medium text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
                          {fact.fact}
                        </p>
                        {fact.source_quote && (
                          <p className="text-[11px] text-[#636366] dark:text-[#8e8e93] italic bg-white dark:bg-[#222224] p-2 rounded-lg border border-[#1c1c1e]/10 dark:border-white/10 mt-1 leading-snug">
                            "{fact.source_quote}"
                          </p>
                        )}
                        <span className="text-[9.5px] font-mono-cap text-[#8e8e93] block mt-1.5">
                          Chapter {fact.source_chapter_number || '?'} &bull; Canon Fact
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#8e8e93]">No recorded facts for this node.</span>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Edit Entity Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-[#1c1c1e]/10 dark:border-white/10 p-6 max-w-md w-full text-left">
            <h3 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
              Edit Canon Entity
            </h3>
            <p className="text-xs text-[#636366] dark:text-[#8e8e93] mb-4">
              Modify the entity's traits or description. Changes persist into narrative memory and future continuity checks.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
                  Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1">
                  Traits (Comma separated)
                </label>
                <input
                  type="text"
                  value={editTraitsStr}
                  onChange={(e) => setEditTraitsStr(e.target.value)}
                  placeholder="e.g. brave, lost left arm, royal archivist"
                  className="w-full text-xs p-2.5 bg-[#f6f6f4] dark:bg-[#161618] border border-[#1c1c1e]/10 dark:border-white/10 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] focus:outline-hidden focus:border-[#1c1c1e]/30 dark:focus:border-white/30"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-outline btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-solid btn-sm text-xs shadow-2xs disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Update Canon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
