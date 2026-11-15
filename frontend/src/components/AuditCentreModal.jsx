import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Clock,
  User,
  CheckCircle,
  FileText,
  Download
} from 'lucide-react';
import { architectService } from '../services/api';

export default function AuditCentreModal({ projectId, isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    loadLogs();
  }, [isOpen, projectId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await architectService.getAuditLogs(projectId, 100);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !search ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.target_type?.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(log.new_state || {}).toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action?.startsWith(actionFilter);
    return matchesSearch && matchesAction;
  });

  const exportLogsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_trail_${projectId}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Narrative Audit & Provenance History</h3>
              <p className="text-xs text-neutral-500">Tamper-evident activity trail of world changes, canon updates, and safety checks</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportLogsJson}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xs hover:bg-neutral-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Trail</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 bg-white dark:bg-neutral-900">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter by action, entity or change..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-800 dark:text-neutral-200"
            />
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 focus:outline-none"
            >
              <option value="all">All Actions</option>
              <option value="create">Creations</option>
              <option value="update">Modifications</option>
              <option value="delete">Deletions</option>
              <option value="canon">Canon / Protection</option>
              <option value="snapshot">Snapshots</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-neutral-400">Loading audit history...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center">
              <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-500 font-medium">No audit events match your criteria</p>
              <p className="text-[11px] text-neutral-400">Actions like creating or modifying entities and canvases are logged here automatically.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const dateStr = log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now';
              const isSelected = selectedLog?.id === log.id;

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(isSelected ? null : log)}
                  className={`border rounded-xl p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        log.action?.includes('create')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.action?.includes('delete')
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : log.action?.includes('canon') || log.action?.includes('protect')
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 capitalize">
                        {log.target_type || 'Entity'}
                      </span>
                      {log.target_id && (
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ID: {String(log.target_id).slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400">
                      <Clock className="w-3 h-3" />
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Summary / Changes */}
                  <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <User className="w-3 h-3 text-neutral-400" />
                      <span className="text-neutral-500">Actor:</span>
                      <span className="font-medium text-neutral-700 dark:text-neutral-200">{log.user_id ? 'Author' : 'System Agent'}</span>
                    </div>
                    <span className="text-[11px] text-blue-600 hover:underline">
                      {isSelected ? 'Hide state diff ▲' : 'Inspect state diff ▼'}
                    </span>
                  </div>

                  {/* Collapsible JSON State Diff */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Previous State</span>
                        <pre className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[10px] text-neutral-700 dark:text-neutral-300 overflow-x-auto max-h-40 font-mono">
                          {log.prev_state ? JSON.stringify(log.prev_state, null, 2) : 'None (Created)'}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-blue-500 block mb-1">New State</span>
                        <pre className="p-2.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/40 rounded-lg text-[10px] text-blue-900 dark:text-blue-200 overflow-x-auto max-h-40 font-mono">
                          {log.new_state ? JSON.stringify(log.new_state, null, 2) : 'None (Deleted)'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center space-x-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Audit trail is append-only and cryptographically sequenced.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
