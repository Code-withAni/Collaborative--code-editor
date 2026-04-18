/**
 * Layout.tsx
 * Full-screen dark-theme shell.
 * Uses react-resizable-panels for a draggable sidebar / editor split.
 * All socket logic stays in the parent Editor.tsx page — this component
 * is purely structural and presentational.
 */

import { useState, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import EditorPanel from './EditorPanel';
import type { EditorProps } from '@monaco-editor/react';
import type { FileNode } from './Sidebar';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectedUser {
  socketId: string;
  username: string;
}

export interface LayoutProps {
  /* Socket / room state */
  isConnected: boolean;
  roomId: string;
  username: string;
  connectedUsers: ConnectedUser[];

  /* Editor state */
  code: string;
  onCodeChange: (value: string | undefined) => void;
  onEditorMount: EditorProps['onMount'];

  /* Actions */
  onLeaveRoom: () => void;
  onLogout: () => void;
  onCopyRoomId: () => void;
  copiedRoomId: boolean;

  /* Shared files */
  files: FileNode[];
  onFilesChange: (files: FileNode[]) => void;
  isAdmin: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Layout({
  isConnected,
  roomId,
  username,
  connectedUsers,
  code,
  onCodeChange,
  onEditorMount,
  onLeaveRoom,
  onLogout,
  onCopyRoomId,
  copiedRoomId,
  files,
  onFilesChange,
  isAdmin,
}: LayoutProps) {
  const [language, setLanguage] = useState('javascript');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>(null);

  // Active open file name for the breadcrumb
  const [openFileName, setOpenFileName] = useState<string>('main.js');

  // Keep label in sync with id for the breadcrumb
  const handleSelectNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setSelectedNodeLabel(id);
  }, []);

  // Called by Sidebar when user opens / uploads a file
  const handleOpenFile = useCallback(
    (content: string, lang: string, name: string) => {
      onCodeChange(content);
      setLanguage(lang === 'plaintext' ? 'javascript' : lang);
      setOpenFileName(name);
    },
    [onCodeChange],
  );

  return (
    <div
      id="app-layout"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f0f0f] text-gray-200 antialiased"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* ── Top Toolbar ─────────────────────────────────────────────────── */}
      <Toolbar
        isConnected={isConnected}
        roomId={roomId}
        username={username}
        connectedUsers={connectedUsers}
        language={language}
        onLanguageChange={setLanguage}
        onLeaveRoom={onLeaveRoom}
        onLogout={onLogout}
        onCopyRoomId={onCopyRoomId}
      />

      {/* ── Main area (sidebar + editor) ──────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="codesync-layout">
          {/* ── Sidebar Panel ─────────────────────────────────────────── */}
          <Panel
            id="sidebar"
            defaultSize={18}
            minSize={12}
            maxSize={32}
            className="h-full"
          >
            <Sidebar
              roomId={roomId}
              username={username}
              connectedUsers={connectedUsers}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onCopyRoomId={onCopyRoomId}
              copiedRoomId={copiedRoomId}
              onOpenFile={handleOpenFile}
              onLogout={onLogout}
              files={files}
              onFilesChange={onFilesChange}
              isAdmin={isAdmin}
            />
          </Panel>

          {/* ── Drag handle ───────────────────────────────────────────── */}
          <PanelResizeHandle className="w-[3px] bg-white/[0.04] hover:bg-violet-500/40 transition-colors cursor-col-resize group relative">
            {/* Visual drag indicator */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10 group-hover:bg-violet-400/60 transition-colors" />
          </PanelResizeHandle>

          {/* ── Editor Panel ──────────────────────────────────────────── */}
          <Panel id="editor" defaultSize={82} minSize={40} className="h-full">
            <EditorPanel
              code={code}
              language={language}
              fileName={openFileName}
              selectedNodeLabel={selectedNodeLabel}
              onChange={onCodeChange}
              onMount={onEditorMount}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
