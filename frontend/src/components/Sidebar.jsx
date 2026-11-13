import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  FileText,
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';

export default function Sidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  onAddChapter,
  projectName
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

  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);

  return (
    <aside className="w-64 h-full bg-white border-r border-neutral-200/80 flex flex-col select-none">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-neutral-800">
          <Layers className="w-4 h-4 text-neutral-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Manuscript
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          title="Add Chapter"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Chapters Navigation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chapters.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-400">
            No chapters yet. Click + to add one or upload a manuscript.
          </div>
        ) : (
          chapters.map((ch) => {
            const isSelected = ch.id === selectedChapterId;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChapter(ch.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all group ${
                  isSelected
                    ? 'bg-neutral-100 text-neutral-900 font-medium shadow-2xs'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="text-xs truncate">
                    Ch {ch.chapter_number}: {ch.title.replace(/^Chapter\s+\d+\s*[:—\-]\s*/i, '')}
                  </span>
                </div>

                <span className="text-[10px] text-neutral-400 shrink-0 font-mono ml-2">
                  {ch.word_count || 0}w
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      <div className="p-3 border-t border-neutral-100 bg-neutral-50/50 text-[11px] text-neutral-500 flex justify-between">
        <span>{chapters.length} chapters</span>
        <span className="font-mono">{totalWords.toLocaleString()} words</span>
      </div>

      {/* Add Chapter Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-5 max-w-sm w-full text-left">
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">New Chapter</h3>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. The Siege Begins"
                autoFocus
                className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500 mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-md shadow-2xs"
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
