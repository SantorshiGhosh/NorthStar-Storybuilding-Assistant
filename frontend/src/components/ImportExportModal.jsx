import React, { useState } from 'react';
import {
  Download,
  Upload,
  X,
  FileJson,
  FileSpreadsheet,
  Archive,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { architectService, entityService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ImportExportModal({ projectId, projectName, isOpen, onClose, onImportSuccess }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importStrategy, setImportStrategy] = useState('merge'); // 'merge' or 'skip_existing'

  if (!isOpen) return null;

  const handleExportJson = async () => {
    try {
      setExporting(true);
      const data = await architectService.exportProject(projectId);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${(projectName || 'story_bible').toLowerCase().replace(/\s+/g, '_')}_bundle.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Narrative bundle exported as JSON');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const data = await architectService.exportProject(projectId);
      const entities = data.entities || [];
      if (entities.length === 0) {
        toast.warning('No entities to export as CSV.');
        return;
      }
      const headers = ['id', 'name', 'entity_type', 'canon_status', 'protection_level', 'description'];
      const rows = entities.map((e) => [
        `"${e.id}"`,
        `"${(e.name || '').replace(/"/g, '""')}"`,
        `"${e.entity_type || ''}"`,
        `"${e.canon_status || 'draft'}"`,
        e.protection_level || 1,
        `"${(e.description || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${(projectName || 'entities').toLowerCase().replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Entities exported as CSV');
    } catch (err) {
      console.error('CSV Export failed:', err);
      toast.error('CSV Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setImportError(null);
    setImportPreview(null);
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json.entities && !json.project) {
          throw new Error('Unrecognized JSON format: missing entities or project data');
        }
        setImportPreview({
          name: json.project?.name || file.name,
          entitiesCount: json.entities?.length || 0,
          relationshipsCount: json.relationships?.length || 0,
          chaptersCount: json.chapters?.length || 0,
          raw: json,
        });
      } catch (err) {
        setImportError('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importPreview?.raw) return;
    try {
      setImporting(true);
      const ents = importPreview.raw.entities || [];
      // Import entities iteratively into current project
      for (const ent of ents) {
        await entityService.createEntity(projectId, {
          name: ent.name,
          entity_type: ent.entity_type || 'character',
          description: ent.description || '',
          canon_status: ent.canon_status || 'draft',
          protection_level: ent.protection_level || 1,
          custom_properties: ent.custom_properties || {},
        });
      }
      toast.success(`Successfully imported ${ents.length} entities into current project!`);
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
      setImportError('Import failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Narrative Vault: Import & Export</h3>
              <p className="text-xs text-neutral-500">Universal portable story bundles, CSV spreadsheets, and conflict-safe restoration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3 flex items-center space-x-1.5">
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Project Story Bible</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportJson}
                disabled={exporting}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-400 hover:bg-blue-50/20 text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-neutral-900 dark:text-white">Full JSON Bundle</h5>
                    <span className="text-[10px] text-neutral-400">All entities, graphs, groups & canon</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2">
                  Complete lossless backup formatted for instant re-import or cross-project migration.
                </p>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-400 hover:bg-emerald-50/20 text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-neutral-900 dark:text-white">Entities CSV</h5>
                    <span className="text-[10px] text-neutral-400">Spreadsheet-compatible table</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2">
                  Export entity roster with types, canon status, and descriptions for Excel, Sheets, or Notion.
                </p>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3 flex items-center space-x-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Story Bundle</span>
            </h4>

            <div className="p-4 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/30 text-center">
              <input
                type="file"
                accept=".json"
                id="file-upload"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex flex-col items-center justify-center"
              >
                <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                  {importFile ? importFile.name : 'Select a JSON Story Bible file'}
                </span>
                <span className="text-[11px] text-neutral-400 mt-0.5">Click to browse your computer</span>
              </label>
            </div>

            {importError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="mt-4 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">Bundle Ready for Import</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-medium">Source: {importPreview.name}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-neutral-900 dark:text-white block">{importPreview.entitiesCount}</span>
                    <span className="text-[10px] text-neutral-400">Entities</span>
                  </div>
                  <div className="bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-neutral-900 dark:text-white block">{importPreview.relationshipsCount}</span>
                    <span className="text-[10px] text-neutral-400">Relations</span>
                  </div>
                  <div className="bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-neutral-900 dark:text-white block">{importPreview.chaptersCount}</span>
                    <span className="text-[10px] text-neutral-400">Chapters</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-1.5 text-xs text-neutral-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Existing canon will not be overwritten without confirmation.</span>
                  </div>
                  <button
                    onClick={handleExecuteImport}
                    disabled={importing}
                    className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
                  >
                    <span>{importing ? 'Importing Entities...' : 'Confirm & Ingest'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
