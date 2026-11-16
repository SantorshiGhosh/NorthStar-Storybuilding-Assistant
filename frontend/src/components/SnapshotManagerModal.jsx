import React, { useState, useEffect } from 'react';
import {
  Camera,
  X,
  Plus,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  GitCompare,
  Layers,
  Sparkles
} from 'lucide-react';
import { architectService, projectService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function SnapshotManagerModal({ projectId, isOpen, onClose, onSnapshotRestored }) {
  const toast = useToast();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);

  // Form fields
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    loadSnapshots();
  }, [isOpen, projectId]);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const data = await architectService.getSnapshots(projectId, { forceRefresh: true });
      setSnapshots(data || []);
      if (data && data.length > 0 && !selectedSnapshot) {
        setSelectedSnapshot(data[0]);
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;
    try {
      setCreating(true);
      const newSnap = await architectService.createSnapshot(projectId, {
        name: snapshotName.trim(),
        description: snapshotDesc.trim(),
        is_milestone: isMilestone,
      });
      setSnapshotName('');
      setSnapshotDesc('');
      setIsMilestone(false);
      setShowCreateForm(false);
      toast.success('Snapshot milestone saved');
      await loadSnapshots();
      setSelectedSnapshot(newSnap);
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      toast.error('Error creating snapshot: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snapshotId) => {
    try {
      setRestoring(true);
      await architectService.restoreSnapshot(snapshotId);
      setConfirmRestoreId(null);
      toast.success('Story canon restored to snapshot state');
      if (onSnapshotRestored) {
        onSnapshotRestored();
      }
      onClose();
    } catch (err) {
      console.error('Failed to restore snapshot:', err);
      toast.error('Error restoring snapshot: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRestoring(false);
    }
  };

  if (!isOpen) return null;

  const snapData = selectedSnapshot?.snapshot_data || {};
  const entityList = snapData.entities || [];
  const relList = snapData.relationships || [];
  const factList = snapData.story_facts || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">World State Snapshots & Time-Travel</h3>
              <p className="text-xs text-neutral-500">Capture point-in-time milestones, inspect historic diffs, or rollback disaster states</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg shadow-2xs hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Take Snapshot</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left sidebar (list of snapshots) + Right pane (snapshot inspect & diff) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Snapshots List Sidebar */}
          <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/50 flex flex-col">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Saved Snapshots ({snapshots.length})
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="py-12 text-center text-xs text-neutral-400">Loading snapshots...</div>
              ) : snapshots.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 p-4">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  <p className="font-semibold text-neutral-600 dark:text-neutral-300">No snapshots yet</p>
                  <p className="text-[11px] mt-1 text-neutral-400">Create one before making major world-building or continuity edits.</p>
                </div>
              ) : (
                snapshots.map((snap) => {
                  const isSelected = selectedSnapshot?.id === snap.id;
                  const dateStr = snap.created_at ? new Date(snap.created_at).toLocaleDateString() : 'Recent';
                  const timeStr = snap.created_at ? new Date(snap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                  return (
                    <div
                      key={snap.id}
                      onClick={() => setSelectedSnapshot(snap)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-neutral-800 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                          : 'bg-white/70 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700/80 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {snap.name}
                        </span>
                        {snap.is_milestone && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Milestone
                          </span>
                        )}
                      </div>
                      {snap.description && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mb-1.5">
                          {snap.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{dateStr} {timeStr}</span>
                        <span>{snap.snapshot_data?.entities?.length || 0} entities</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Snapshot Inspector & Diff Viewer */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-white dark:bg-neutral-900">
            {selectedSnapshot ? (
              <div className="space-y-6">
                {/* Snapshot Overview Banner */}
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-base font-bold text-neutral-900 dark:text-white">{selectedSnapshot.name}</h4>
                      {selectedSnapshot.is_milestone && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                          Canon Milestone
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {selectedSnapshot.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center space-x-4 mt-3 text-xs text-neutral-500">
                      <span>Created: {new Date(selectedSnapshot.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span>Author: {selectedSnapshot.created_by ? 'User' : 'Auto-Capture'}</span>
                    </div>
                  </div>

                  {/* Restore Action */}
                  <div>
                    {confirmRestoreId === selectedSnapshot.id ? (
                      <div className="flex items-center space-x-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 p-2 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Confirm Rollback?</span>
                        <button
                          onClick={() => handleRestore(selectedSnapshot.id)}
                          disabled={restoring}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                          {restoring ? 'Restoring...' : 'Yes, Restore'}
                        </button>
                        <button
                          onClick={() => setConfirmRestoreId(null)}
                          className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRestoreId(selectedSnapshot.id)}
                        className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Rollback to this Version</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Entity & Relationship Breakdown Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Entities Preserved</span>
                    <span className="text-2xl font-black text-neutral-900 dark:text-white">{entityList.length}</span>
                    <span className="text-[11px] text-neutral-400 block mt-1">Characters, locations, rules, factions</span>
                  </div>
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Relationships</span>
                    <span className="text-2xl font-black text-neutral-900 dark:text-white">{relList.length}</span>
                    <span className="text-[11px] text-neutral-400 block mt-1">Active graph links</span>
                  </div>
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Story Facts</span>
                    <span className="text-2xl font-black text-neutral-900 dark:text-white">{factList.length}</span>
                    <span className="text-[11px] text-neutral-400 block mt-1">Verified canonical citations</span>
                  </div>
                </div>

                {/* Visual Entities Snapshot List */}
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    Entities in this Snapshot ({entityList.length})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {entityList.map((ent, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between"
                      >
                        <div className="truncate">
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate block">
                            {ent.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 capitalize">
                            {ent.entity_type} {ent.canon_status ? `• ${ent.canon_status}` : ''}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-mono">
                          Lvl {ent.protection_level || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-xs text-neutral-400">
                Select a snapshot from the sidebar to inspect details
              </div>
            )}
          </div>
        </div>

        {/* Create Snapshot Slide-over Modal / Modal Overlay */}
        {showCreateForm && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleCreate}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Create World State Snapshot</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Snapshot Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Act 1 Final Canon, Pre-Battle Reorg"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-neutral-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Why is this snapshot being captured?"
                  value={snapshotDesc}
                  onChange={(e) => setSnapshotDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-neutral-800 dark:text-white"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="milestone"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-neutral-300 focus:ring-emerald-500"
                />
                <label htmlFor="milestone" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Mark as protected Canon Milestone
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
                >
                  {creating ? 'Saving...' : 'Save Snapshot'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
