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
import { projectService, entityService, getCached } from '../services/api';

// Custom React Flow Node Card
function CustomEntityNode({ data, selected }) {
  const badgeColors = {
    character: 'bg-blue-50 text-blue-700 border-blue-200',
    location: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    object: 'bg-amber-50 text-amber-700 border-amber-200',
    rule: 'bg-red-50 text-red-700 border-red-200',
    faction: 'bg-purple-50 text-purple-700 border-purple-200',
  }[data.entity_type] || 'bg-neutral-100 text-neutral-700 border-neutral-200';

  return (
    <div
      className={`bg-white rounded-xl border p-3.5 shadow-xs transition-all w-52 text-left select-none ${
        selected ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' : 'border-neutral-200/90 hover:border-neutral-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-neutral-400" />

      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColors} capitalize`}>
          {data.badge || data.entity_type}
        </span>
        <span className="text-[10px] text-neutral-400">
          Ch {data.first_appearance || 1}
        </span>
      </div>

      <h4 className="text-sm font-bold text-neutral-900 leading-snug truncate">
        {data.label || data.name}
      </h4>

      {data.description && (
        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
          {data.description}
        </p>
      )}

      {data.traits && data.traits.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {data.traits.slice(0, 2).map((t, idx) => (
            <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded-sm bg-neutral-100 text-neutral-600">
              {t}
            </span>
          ))}
          {data.traits.length > 2 && (
            <span className="text-[9px] text-neutral-400">+{data.traits.length - 2}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
        <span className="flex items-center space-x-1 text-blue-600 font-medium">
          <Quote className="w-2.5 h-2.5" />
          <span>{data.fact_count || 0} facts</span>
        </span>
        <span>Click to inspect &rarr;</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-neutral-400" />
    </div>
  );
}

const nodeTypes = { custom: CustomEntityNode };

export default function KnowledgeGraph() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const cachedGraph = getCached(`graph:${projectId}`);
  const cachedProj = getCached(`project:${projectId}`);
  const cachedEnts = getCached(`entities:${projectId}:{}`);

  const [project, setProject] = useState(() => cachedProj || null);
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
    <div className="h-screen flex flex-col bg-[#fbfbf9] overflow-hidden">
      <Navbar currentProject={project} />

      {/* Control Bar: Search & Type Filter Tabs */}
      <div className="bg-white border-b border-neutral-200/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search narrative graph..."
              className="pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:border-blue-500 w-52 sm:w-64"
            />
          </div>

          <div className="hidden sm:flex items-center space-x-1 pl-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTypeFilter === tab.id
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-neutral-400 flex items-center space-x-3">
          <span>{nodes.length} entities visualized</span>
          <span>&bull;</span>
          <span>{edges.length} connections</span>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 relative">
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
          <Background color="#e5e5e0" gap={20} size={1} />
          <Controls className="bg-white! border-neutral-200! shadow-xs!" />
          <MiniMap
            nodeColor={(n) => n.data?.bgColor || '#f3f4f6'}
            className="border border-neutral-200/80 rounded-lg overflow-hidden"
          />
        </ReactFlow>

        {/* Slide-over Entity Inspector Drawer */}
        {drawerOpen && selectedEntity && (
          <aside className="absolute top-0 right-0 h-full w-80 sm:w-96 bg-white border-l border-neutral-200/80 shadow-lg z-20 flex flex-col text-left">
            {/* Drawer Header */}
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                  {selectedEntity.entity_type}
                </span>
                <span className="text-xs text-neutral-400">
                  Seen Ch {selectedEntity.first_appearance_chapter || 1}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleOpenEdit}
                  className="p-1 text-neutral-500 hover:text-neutral-900 rounded-md hover:bg-neutral-200 transition-colors"
                  title="Edit Entity"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 mb-1">
                  {selectedEntity.name}
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {selectedEntity.description || 'No description established yet.'}
                </p>
              </div>

              {/* Traits */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-700 mb-2">
                  Recognized Canon Traits
                </h4>
                {selectedEntity.traits && selectedEntity.traits.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntity.traits.map((trait, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-medium px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-800 border border-neutral-200"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400">No explicit traits extracted.</span>
                )}
              </div>

              {/* Established Story Facts */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-700 mb-2 flex items-center space-x-1.5">
                  <Quote className="w-3.5 h-3.5 text-blue-600" />
                  <span>Established Canon Facts ({selectedEntity.facts ? selectedEntity.facts.length : 0})</span>
                </h4>

                {selectedEntity.facts && selectedEntity.facts.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedEntity.facts.map((fact) => (
                      <div
                        key={fact.id}
                        className="bg-neutral-50/70 rounded-lg p-3 border border-neutral-200/70"
                      >
                        <p className="text-xs font-medium text-neutral-900 mb-1">
                          {fact.fact}
                        </p>
                        {fact.source_quote && (
                          <p className="text-[11px] text-neutral-600 italic bg-white p-2 rounded border border-neutral-100 mt-1 leading-snug">
                            "{fact.source_quote}"
                          </p>
                        )}
                        <span className="text-[10px] text-neutral-400 block mt-1.5">
                          Chapter {fact.source_chapter_number || '?'} &bull; Canon Fact
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400">No recorded facts for this node.</span>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Edit Entity Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 max-w-md w-full text-left">
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              Edit Canon Entity
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Modify the entity's traits or description. Changes persist into narrative memory and future continuity checks.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Traits (Comma separated)
                </label>
                <input
                  type="text"
                  value={editTraitsStr}
                  onChange={(e) => setEditTraitsStr(e.target.value)}
                  placeholder="e.g. brave, lost left arm, royal archivist"
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg shadow-xs disabled:opacity-50"
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
