/**
 * EditorPanel.tsx
 * Monaco Editor wrapper panel with:
 *  - vs-dark theme
 *  - Bottom status bar (line/col, encoding, language, char count)
 *  - Breadcrumb header showing selected tree node
 *  - Smooth loading skeleton
 */

import { useRef, useState } from 'react';
import MonacoEditor, { EditorProps } from '@monaco-editor/react';
import { FileCode2, CircleDot, Type, AlignLeft, Hash, Loader2 } from 'lucide-react';

interface EditorPanelProps {
  code: string;
  language: string;
  fileName?: string;
  selectedNodeLabel: string | null;
  onChange: (value: string | undefined) => void;
  onMount: EditorProps['onMount'];
}

export default function EditorPanel({
  code,
  language,
  fileName,
  selectedNodeLabel,
  onChange,
  onMount,
}: EditorPanelProps) {
  const [position, setPosition] = useState({ line: 1, col: 1 });
  const [isLoading, setIsLoading] = useState(true);

  const handleMount: EditorProps['onMount'] = (editor, monaco) => {
    setIsLoading(false);

    // Custom dark token colors on top of vs-dark
    monaco.editor.defineTheme('codesync-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4d5a6b', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c678dd' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'function', foreground: '61afef' },
        { token: 'variable', foreground: 'e06c75' },
        { token: 'type', foreground: 'e5c07b' },
      ],
      colors: {
        'editor.background': '#0f0f0f',
        'editor.foreground': '#abb2bf',
        'editorLineNumber.foreground': '#3a3f4b',
        'editorLineNumber.activeForeground': '#636d83',
        'editor.lineHighlightBackground': '#161921',
        'editor.selectionBackground': '#3e4451',
        'editorGutter.background': '#0f0f0f',
        'editorWidget.background': '#161616',
        'editorSuggestWidget.background': '#161616',
        'editorSuggestWidget.border': '#2a2a2a',
        'editorHoverWidget.background': '#161616',
        'scrollbarSlider.background': '#282828',
        'scrollbarSlider.hoverBackground': '#323232',
        'minimap.background': '#0f0f0f',
        'breadcrumb.background': '#0f0f0f',
      },
    });
    monaco.editor.setTheme('codesync-dark');

    // Track cursor position for status bar
    editor.onDidChangeCursorPosition((e) => {
      setPosition({ line: e.position.lineNumber, col: e.position.column });
    });

    // Call the parent handler
    onMount?.(editor, monaco);
  };

  const lineCount = code.split('\n').length;
  const langDisplay: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    cpp: 'C++',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f0f0f]">
      {/* ── Breadcrumb header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.06] shrink-0">
        <FileCode2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-[11px] text-gray-400 font-medium">
          src /
        </span>
        <span className="text-[11px] text-gray-200 font-semibold">
          {fileName ?? `main.${language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : language}`}
        </span>
        {selectedNodeLabel && (
          <>
            <span className="text-gray-700 text-[11px]">›</span>
            <span className="text-[11px] text-violet-300 font-medium truncate max-w-[200px]">
              {selectedNodeLabel}
            </span>
          </>
        )}

        {/* Right: unsaved dot */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <CircleDot className="w-2.5 h-2.5 text-yellow-500" />
            <span className="hidden sm:inline">Modified</span>
          </span>
          <span>{code.length.toLocaleString()} chars</span>
        </div>
      </div>

      {/* ── Monaco ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-[#0f0f0f] flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              <span className="text-[11px] text-gray-600">Loading editor…</span>
            </div>
          </div>
        )}

        <MonacoEditor
          theme="codesync-dark"
          language={language}
          value={code}
          onChange={onChange}
          onMount={handleMount}
          options={{
            minimap: { enabled: true, scale: 1, renderCharacters: false },
            fontSize: 13.5,
            fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", Menlo, Monaco, monospace',
            fontLigatures: true,
            lineHeight: 22,
            letterSpacing: 0.2,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            formatOnPaste: true,
            formatOnType: true,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            cursorBlinking: 'phase',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            stickyScroll: { enabled: true },
            inlineSuggest: { enabled: true },
            parameterHints: { enabled: true },
            suggest: { preview: true },
            overviewRulerLanes: 0,
            glyphMargin: false,
            folding: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          } as any}
        />
      </div>

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 h-6 bg-[#0a0a0a] border-t border-white/[0.04] shrink-0 text-[10px] text-gray-600 select-none">
        <span className="flex items-center gap-1">
          <AlignLeft className="w-2.5 h-2.5" />
          Ln {position.line}, Col {position.col}
        </span>
        <span className="flex items-center gap-1">
          <Hash className="w-2.5 h-2.5" />
          {lineCount} lines
        </span>
        <span className="hidden sm:flex items-center gap-1">
          <Type className="w-2.5 h-2.5" />
          UTF-8
        </span>
        <span className="flex-1" />
        <span className="hidden sm:inline">Spaces: 2</span>
        <span className="text-violet-400 font-medium">{langDisplay[language] ?? language}</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}
