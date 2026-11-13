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
  Check
} from 'lucide-react';

export default function Editor({
  initialContent,
  chapterTitle,
  onSave,
  onAnalyze,
  analyzing
}) {
  const [savedStatus, setSavedStatus] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || '<p>Start writing your chapter...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-hidden min-h-[520px] text-neutral-800 text-base leading-relaxed',
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
      <div className="flex items-center justify-center h-96 text-neutral-400 text-sm">
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
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
      {/* Editor Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-200 px-4 py-2.5 bg-neutral-50/60 gap-2">
        {/* Formatting Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              editor.isActive('bold') ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              editor.isActive('italic') ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-neutral-200 mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-md text-xs font-semibold transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              editor.isActive('bulletList') ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              editor.isActive('blockquote') ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Word Count & Action Buttons */}
        <div className="flex items-center space-x-3">
          <span className="text-xs text-neutral-400 font-medium">
            {wordCount} words &bull; {charCount} chars
          </span>

          <button
            onClick={handleManualSave}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-colors shadow-2xs"
          >
            {savedStatus ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-neutral-500" />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            onClick={() => onAnalyze && onAnalyze(editor.getText())}
            disabled={analyzing}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs disabled:opacity-50"
            title="Check this chapter against established narrative memory"
          >
            <Sparkles className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Guardian Analyzing...' : 'Analyze Chapter'}</span>
          </button>
        </div>
      </div>

      {/* Editor Writing Canvas */}
      <div className="flex-1 p-6 sm:p-10 overflow-y-auto max-w-4xl mx-auto w-full">
        {chapterTitle && (
          <h2 className="text-2xl font-bold text-neutral-900 mb-6 pb-2 border-b border-neutral-100">
            {chapterTitle}
          </h2>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
