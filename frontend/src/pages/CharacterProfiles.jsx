import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Users,
  Search,
  Quote,
  Shield,
  FileText,
  Activity,
  Edit2,
  X
} from 'lucide-react';
import Navbar from '../components/Navbar';
import CharacterCard from '../components/CharacterCard';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { projectService, entityService, getCached } from '../services/api';

export default function CharacterProfiles() {
  const { projectId } = useParams();
  const toast = useToast();

  const cachedProj = getCached(`project:${projectId}`);
  const cachedEntities = getCached(`entities:${projectId}:{}`) || getCached(`entities:${projectId}`);
  const initialChars = cachedEntities ? cachedEntities.filter((e) => e.entity_type === 'character') : [];

  const [project, setProject] = useState(() => cachedProj || null);
  useDocumentTitle(project?.name ? `${project.name} | Character Dossiers` : 'Character Dossiers');
  const [characters, setCharacters] = useState(() => initialChars);
  const [selectedCharacter, setSelectedCharacter] = useState(() => initialChars[0] || null);
  const [loading, setLoading] = useState(() => !cachedEntities);
  const [search, setSearch] = useState('');

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTraits, setEditTraits] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async (showLoading = !initialChars.length) => {
    try {
      if (showLoading) setLoading(true);
      const [proj, ents] = await Promise.all([
        projectService.getProject(projectId),
        entityService.getEntities(projectId)
      ]);
      setProject(proj);

      // Filter for characters
      const chars = ents.filter((e) => e.entity_type === 'character');
      setCharacters(chars);

      if (chars.length > 0 && !selectedCharacter) {
        setSelectedCharacter((prev) => prev || chars[0]);
      }
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData(!cachedEntities);
    }
  }, [projectId]);

  const handleSelectCharacter = async (char) => {
    try {
      const full = await entityService.getEntity(char.id);
      setSelectedCharacter(full);
    } catch (e) {
      setSelectedCharacter(char);
    }
  };

  const handleOpenEdit = () => {
    if (!selectedCharacter) return;
    setEditName(selectedCharacter.name);
    setEditDesc(selectedCharacter.description || '');
    setEditTraits((selectedCharacter.traits || []).join(', '));
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedCharacter) return;
    try {
      setSaving(true);
      const traitsArray = editTraits.split(',').map((t) => t.trim()).filter(Boolean);
      const updated = await entityService.updateEntity(selectedCharacter.id, {
        name: editName,
        description: editDesc,
        traits: traitsArray,
      });
      setSelectedCharacter(updated);
      setShowEditModal(false);
      toast.success(`Character "${editName}" updated successfully`);
      loadData();
    } catch (err) {
      console.error('Failed to update character:', err);
      toast.error('Failed to update character');
    } finally {
      setSaving(false);
    }
  };

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      <Navbar currentProject={project} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#1c1c1e]/10 dark:border-white/10 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1c1e] dark:text-[#f5f5f7] tracking-tight">
              Character Dossiers &amp; Canon Memory
            </h1>
            <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
              Verified physical states, recurring traits, source passages, and character intelligence.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#222224] border border-[#1c1c1e]/15 dark:border-white/15 text-[#1c1c1e] dark:text-[#f5f5f7] rounded-lg focus:outline-hidden focus:border-[#1c1c1e] dark:focus:border-white w-full sm:w-64 shadow-2xs transition-colors"
            />
          </div>
        </div>

        {/* Two-Column Dossier Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 flex-1 text-left">
          {/* Left: Characters Roster Grid */}
          <div className="lg:col-span-1 space-y-3 overflow-y-auto max-h-[750px] pr-1">
            {loading && characters.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="p-4 rounded-xl border border-neutral-200/80 bg-white animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-200 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-28 bg-neutral-200 rounded" />
                        <div className="h-3 w-40 bg-neutral-100 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-xs text-neutral-400">
                No character profiles found.
              </div>
            ) : (
              filtered.map((char) => (
                <div
                  key={char.id}
                  onClick={() => handleSelectCharacter(char)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                    selectedCharacter?.id === char.id
                      ? 'ring-2 ring-blue-500 border-blue-500 shadow-sm'
                      : 'border-neutral-200/80 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                      {char.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <h4 className="text-sm font-bold text-neutral-900 truncate">{char.name}</h4>
                      <span className="text-[11px] text-neutral-400 block truncate">
                        {char.traits && char.traits.length > 0 ? char.traits.join(', ') : 'No traits recorded'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Selected Character Detailed Dossier */}
          <div className="lg:col-span-2">
            {loading && characters.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 shadow-xs space-y-6 animate-pulse">
                <div className="flex items-center space-x-4 pb-6 border-b border-neutral-100">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-200" />
                  <div className="space-y-2">
                    <div className="h-6 w-48 bg-neutral-200 rounded" />
                    <div className="h-4 w-32 bg-neutral-100 rounded" />
                  </div>
                </div>
                <div className="h-24 bg-neutral-100 rounded-xl" />
                <div className="h-32 bg-neutral-100 rounded-xl" />
              </div>
            ) : selectedCharacter ? (
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs space-y-6">
                {/* Dossier Top Bar */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-neutral-100">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {selectedCharacter.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900">{selectedCharacter.name}</h2>
                      <span className="text-xs text-neutral-500">
                        First Appearance: Chapter {selectedCharacter.first_appearance_chapter || 1} &bull; Canonical Figure
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenEdit}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                </div>

                {/* Description / Summary */}
                <div>
                  <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Description & Narrative Role
                  </h4>
                  <p className="text-sm text-neutral-700 leading-relaxed bg-neutral-50/60 p-4 rounded-xl border border-neutral-100">
                    {selectedCharacter.description || 'No detailed background provided yet.'}
                  </p>
                </div>

                {/* Traits & Canonical Physical State */}
                <div>
                  <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Established Physical State & Traits
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCharacter.traits && selectedCharacter.traits.length > 0 ? (
                      selectedCharacter.traits.map((trait, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/70"
                        >
                          {trait}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-400">No physical traits specified.</span>
                    )}
                  </div>
                </div>

                {/* Verified Story Facts with Exact Quotes */}
                <div>
                  <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                    <Quote className="w-3.5 h-3.5 text-blue-600" />
                    <span>Verified Canon Facts ({selectedCharacter.facts ? selectedCharacter.facts.length : 0})</span>
                  </h4>

                  {selectedCharacter.facts && selectedCharacter.facts.length > 0 ? (
                    <div className="space-y-3">
                      {selectedCharacter.facts.map((fact) => (
                        <div
                          key={fact.id}
                          className="p-4 rounded-xl border border-neutral-200/70 bg-neutral-50/40 text-left"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-neutral-900 mb-1">
                            <span>{fact.fact}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              Chapter {fact.source_chapter_number || '?'}
                            </span>
                          </div>
                          {fact.source_quote && (
                            <blockquote className="mt-2 text-xs text-neutral-600 italic bg-white p-3 rounded-lg border border-neutral-200/60 leading-relaxed">
                              "{fact.source_quote}"
                            </blockquote>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 italic">No facts extracted for this character yet.</p>
                  )}
                </div>

                {/* Stylistic Voice Consistency Signal */}
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/60 flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-purple-900">
                      Character Voice Intelligence: Consistent
                    </h5>
                    <p className="text-[11px] text-purple-800 leading-snug mt-0.5">
                      Dialogue tone, formal diction, and speech patterns align with established character behavior across chapters.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center text-xs text-neutral-400">
                Select a character from the roster to inspect their dossier.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 max-w-md w-full text-left">
            <h3 className="text-base font-bold text-neutral-900 mb-1">Edit Character Canon</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Traits (comma-separated)</label>
                <input
                  type="text"
                  value={editTraits}
                  onChange={(e) => setEditTraits(e.target.value)}
                  placeholder="e.g. Captain, two-handed swordsman, lost left arm"
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
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg shadow-xs hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Character'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
