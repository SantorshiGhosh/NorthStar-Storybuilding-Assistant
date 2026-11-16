import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  FileText,
  ChevronRight,
  Sparkles,
  Layers,
  PanelLeftClose
} from 'lucide-react';

export default function Sidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  onAddChapter,
  projectName,
  onClose
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const nextNum = chapters.length + 1;
    onAddChapter({
      title: newTitle.trim(),
      chapter_number: nextNum,
      content: `# Chapter ${nextNum}: ${newTitle.trim()}\n\nWrite your scene here...`,
    });
    setNewTitle('');
    setShowAddModal(false);
  };

  const totalWords = (chapters || []).reduce((sum, c) => sum + (c.word_count || 0), 0);

  return (
    <aside className="w-full h-full bg-[#fcfcfb] dark:bg-[#1c1c1e] graphite-grid-bg border-r border-[#1c1c1e]/10 dark:border-white/10 flex flex-col select-none transition-colors duration-200">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-[#1c1c1e]/10 dark:border-white/10 flex items-center justify-between bg-[#fcfcfb]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xs">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-[#8e8e93]" />
          <span className="state-cap text-[10px]">
            Manuscript
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 rounded-md text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Add Chapter"
          >
            <Plus className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Collapse Manuscript Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chapters Navigation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chapters.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#8e8e93] leading-relaxed bg-[#fcfcfb]/85 dark:bg-[#1c1c1e]/85 backdrop-blur-xs rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 mx-1 mt-2">
            No chapters yet. Click + to add one or upload a manuscript.
          </div>
        ) : (
          chapters.map((ch) => {
            const isSelected = ch.id === selectedChapterId;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChapter(ch.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all group cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-[#222224] text-[#1c1c1e] dark:text-[#f5f5f7] font-medium shadow-xs border border-[#1c1c1e]/15 dark:border-white/20'
                    : 'bg-[#fcfcfb]/75 dark:bg-[#1c1c1e]/75 backdrop-blur-2xs text-[#636366] dark:text-[#8e8e93] hover:bg-white dark:hover:bg-[#222224] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] border border-transparent hover:border-[#1c1c1e]/10'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#1c1c1e] dark:text-[#f5f5f7]' : 'text-[#8e8e93] group-hover:text-[#636366]'}`} />
                  <span className="text-xs truncate">
                    Ch {ch.chapter_number}: {ch.title ? ch.title.replace(/^Chapter\s+\d+\s*[:—\-]\s*/i, '') : `Chapter ${ch.chapter_number}`}
                  </span>
                </div>

                <span className="text-[10px] text-[#8e8e93] shrink-0 font-mono ml-2">
                  {ch.word_count || 0}w
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      <div className="p-3 border-t border-[#1c1c1e]/10 dark:border-white/10 bg-[#fcfcfb]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xs text-[11px] text-[#636366] dark:text-[#8e8e93] flex justify-between font-mono-cap">
        <span>{chapters.length} chapters</span>
        <span>{totalWords.toLocaleString()} words</span>
      </div>

      {/* Add Chapter Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfcfb] dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-[#1c1c1e]/10 dark:border-white/10 p-5 max-w-sm w-full text-left transition-colors">
            <h3 className="text-sm font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] mb-2">New Chapter</h3>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. The Siege Begins"
                autoFocus
                className="w-full text-xs p-2.5 bg-white dark:bg-[#222224] border border-[#1c1c1e]/15 dark:border-white/15 rounded-lg text-[#1c1c1e] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-hidden focus:border-[#1c1c1e] dark:focus:border-white focus:ring-1 focus:ring-[#1c1c1e] dark:focus:ring-white mb-4 transition-colors"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-solid btn-sm"
                >
                  Create Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
