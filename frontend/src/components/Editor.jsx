import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Quote,
  Save,
  Sparkles,
  Check,
  Minimize2
} from 'lucide-react';

export default function Editor({
  initialContent,
  chapterTitle,
  onSave,
  onAnalyze,
  analyzing,
  onCollapse
}) {
  const [savedStatus, setSavedStatus] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || '<p>Start writing your chapter...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-hidden min-h-[520px] text-[#1c1c1e] dark:text-[#f5f5f7] text-base leading-relaxed',
      },
    },
    onUpdate: () => {
      setSavedStatus(false);
    },
  });

  // Update editor if initialContent changes externally
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const current = editor.getHTML();
      // Only set if content actually differs
      if (current !== initialContent && editor.getText().trim() !== initialContent.trim()) {
        editor.commands.setContent(initialContent || '<p></p>');
      }
    }
  }, [initialContent, editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-96 text-[#8e8e93] text-sm font-mono-cap">
        Loading editor...
      </div>
    );
  }

  const handleManualSave = () => {
    if (onSave) {
      onSave(editor.getHTML(), editor.getText());
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2500);
    }
  };

  const wordCount = editor.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0;
  const charCount = editor.getText().length;

  return (
    <div className="flex flex-col h-full bg-[#fcfcfb] dark:bg-[#1c1c1e] sm:rounded-xl border-x sm:border border-[#1c1c1e]/10 dark:border-white/10 shadow-2xs overflow-hidden transition-colors duration-200">
      {/* Editor Top Toolbar */}
      <div className="flex items-center justify-between border-b border-[#1c1c1e]/10 dark:border-white/10 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-[#f6f6f4]/60 dark:bg-[#161618]/60 gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
        {/* Formatting Buttons */}
        <div className="flex items-center space-x-0.5 shrink-0">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              editor.isActive('bold')
                ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
            }`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              editor.isActive('italic')
                ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
            }`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-[#1c1c1e]/10 dark:border-white/10 mx-1 shrink-0" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              editor.isActive('bulletList')
                ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
            }`}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              editor.isActive('blockquote')
                ? 'bg-[#1c1c1e] text-white dark:bg-white dark:text-[#1c1c1e] shadow-2xs'
                : 'text-[#636366] dark:text-[#8e8e93] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7]'
            }`}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Word Count & Action Buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0 ml-auto">
          <span className="text-[10px] sm:text-[11px] text-[#8e8e93] font-mono-cap whitespace-nowrap">
            <span className="sm:hidden">{wordCount}w &bull; {charCount}c</span>
            <span className="hidden sm:inline">{wordCount} words &bull; {charCount} chars</span>
          </span>

          <button
            onClick={handleManualSave}
            className={`btn btn-sm text-[12px] px-2 sm:px-3 ${
              savedStatus
                ? 'btn-soft'
                : 'btn-outline'
            }`}
          >
            {savedStatus ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1c1c1e] dark:text-white" />
                <span className="hidden sm:inline">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-[#8e8e93]" />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            onClick={() => onAnalyze && onAnalyze(editor.getText())}
            disabled={analyzing}
            className="btn btn-solid btn-sm text-[12px] px-2.5 sm:px-3 shadow-2xs"
            title="Check this chapter against established narrative memory"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1 ${analyzing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{analyzing ? 'Guardian Analyzing...' : 'Analyze Chapter'}</span>
            <span className="sm:hidden">{analyzing ? '...' : 'Analyze'}</span>
          </button>

          {onCollapse && (
            <button
              onClick={onCollapse}
              className="hidden md:inline-flex p-1 rounded-md text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors ml-1 cursor-pointer"
              title="Collapse Editor Panel"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Writing Canvas */}
      <div className="flex-1 px-4 py-4 sm:p-10 overflow-y-auto max-w-4xl mx-auto w-full text-left">
        {chapterTitle && (
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1c1c1e] dark:text-[#f5f5f7] mb-4 sm:mb-6 pb-2 border-b border-[#1c1c1e]/10 dark:border-white/10">
            {chapterTitle}
          </h2>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
