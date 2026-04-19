/**
 * Sidebar.tsx
 * Left sidebar panel with three tabs:
 *  - Files      → Dynamic file tree with Add / Upload / Rename / Delete
 *  - DOM Tree   → Static HTML-like structure, expandable, right-click menu
 *  - Users      → Connected collaborators + room info
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ChangeEvent,
  type KeyboardEvent as KbEvent,
} from 'react';
import { getSocket } from '@/socket/socket';
import {
  ChevronRight,
  ChevronDown,
  FilePlus2,
  FolderPlus,
  Upload,
  File,
  FileCode2,
  FileJson,
  FileType2,
  Folder,
  FolderOpen,
  Users,
  Copy,
  Check,
  Hash,
  Layers,
  Globe,
  EyeOff,
  PlusSquare,
  ListTree,
  Files,
  Pencil,
  Trash2,
  X,
  MoreHorizontal,
  FileText,
  LogOut,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;           // file content (text)
  language?: string;          // detected language
  children?: FileNode[];
  isNew?: boolean;            // being created inline
}

export interface TreeNode {
  id: string;
  label: string;
  tag?: string;
  type: 'element' | 'component' | 'folder' | 'file';
  children?: TreeNode[];
}

interface ConnectedUser {
  socketId: string;
  username: string;
  canEdit?: boolean;
}

interface FileCtxMenu {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  nodeType: 'file' | 'folder';
}

interface DomCtxMenu {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
  nodeLabel: string;
}

interface UserCtxMenu {
  visible: boolean;
  x: number;
  y: number;
  socketId: string;
  username: string;
  canEdit: boolean;
}

export interface SidebarProps {
  roomId: string;
  username: string;
  connectedUsers: ConnectedUser[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onCopyRoomId: () => void;
  copiedRoomId: boolean;
  /** Called when user opens a file — passes content + language to editor */
  onOpenFile?: (content: string, language: string, name: string) => void;
  /** Called when user logged out */
  onLogout?: () => void;
  /** Shared file state */
  files: FileNode[];
  onFilesChange: (newFiles: FileNode[]) => void;
  isAdmin?: boolean;
}

// ── Language detection helpers ────────────────────────────────────────────────

function detectLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp',
    rs: 'rust',
    go: 'go',
    java: 'java',
    html: 'html', htm: 'html',
    css: 'css', scss: 'css', sass: 'css',
    json: 'json',
    md: 'markdown', mdx: 'markdown',
    sh: 'shell', bash: 'shell',
    yaml: 'yaml', yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
  };
  return map[ext] ?? 'plaintext';
}

function FileIcon({ name, className = 'w-3.5 h-3.5' }: { name: string; className?: string }) {
  const lang = detectLanguage(name);
  const cols: Record<string, string> = {
    javascript: 'text-yellow-400',
    typescript: 'text-blue-400',
    python: 'text-green-400',
    html: 'text-orange-400',
    css: 'text-purple-400',
    json: 'text-amber-400',
    markdown: 'text-gray-400',
    rust: 'text-orange-500',
    go: 'text-cyan-400',
    java: 'text-red-400',
  };
  const col = cols[lang] ?? 'text-gray-500';
  if (lang === 'json') return <FileJson className={`${className} ${col}`} />;
  if (['javascript','typescript'].includes(lang)) return <FileCode2 className={`${className} ${col}`} />;
  if (lang === 'markdown') return <FileText className={`${className} ${col}`} />;
  return <File className={`${className} ${col}`} />;
}

// ── Default file tree ─────────────────────────────────────────────────────────

const INITIAL_FILES: FileNode[] = [];

// ── Static DOM tree ───────────────────────────────────────────────────────────

const DOM_TREE: TreeNode[] = [];

// ── Tag colours ───────────────────────────────────────────────────────────────

function tagColor(tag?: string) {
  const m: Record<string, string> = {
    html:'text-orange-400', head:'text-yellow-400', body:'text-lime-400',
    header:'text-cyan-400', footer:'text-cyan-400', nav:'text-sky-400',
    main:'text-violet-400', section:'text-purple-400', div:'text-blue-400',
    p:'text-gray-300', h1:'text-emerald-400', h2:'text-emerald-400',
    ul:'text-amber-400', li:'text-amber-300', button:'text-rose-400',
    a:'text-teal-400', span:'text-gray-400', title:'text-yellow-300',
    meta:'text-gray-500', link:'text-gray-500',
  };
  return m[tag ?? ''] ?? 'text-gray-400';
}

// ── Avatar colours ────────────────────────────────────────────────────────────

const AV = [
  'from-violet-500 to-purple-600','from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600','from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
];
const avatarColor = (n: string) => AV[n.charCodeAt(0) % AV.length];

// ── Unique id helper ──────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `f_${Date.now()}_${_uid++}`;

// ─────────────────────────────────────────────────────────────────────────────
// FileTreeItem
// ─────────────────────────────────────────────────────────────────────────────

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  activeFileId: string | null;
  renamingId: string | null;
  onOpen:        (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onRenameCommit:(id: string, newName: string) => void;
  onRenameCancel:() => void;
  onAddChild?:   (parentId: string, type: 'file' | 'folder') => void;
}

function FileTreeItem({
  node, depth, activeFileId, renamingId,
  onOpen, onContextMenu, onRenameCommit, onRenameCancel, onAddChild,
}: FileTreeItemProps) {
  const [open, setOpen] = useState(depth === 0);
  const [renameVal, setRenameVal] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const isFolder = node.type === 'folder';
  const isActive = activeFileId === node.id;
  const isRenaming = renamingId === node.id;

  useEffect(() => {
    if (isRenaming) {
      setRenameVal(node.name);
      setTimeout(() => renameRef.current?.select(), 0);
    }
  }, [isRenaming, node.name]);

  const commitRename = () => {
    const v = renameVal.trim();
    if (v && v !== node.name) onRenameCommit(node.id, v);
    else onRenameCancel();
  };

  const handleKey = (e: KbEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') onRenameCancel();
  };

  return (
    <li>
      <div
        id={`file-node-${node.id}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) setOpen(v => !v);
          else onOpen(node);
        }}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, node); }}
        className={`group relative flex items-center gap-1.5 py-[3px] pr-1 rounded cursor-pointer select-none transition-all text-xs border-l-2 ${
          isActive
            ? 'bg-violet-500/15 border-violet-400'
            : 'hover:bg-white/[0.04] border-transparent'
        }`}
      >
        {/* chevron */}
        {isFolder
          ? open
            ? <ChevronDown  className="w-3 h-3 text-gray-600 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
          : <span className="w-3 shrink-0" />
        }

        {/* icon */}
        {isFolder
          ? open
            ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400/70 shrink-0" />
            : <Folder     className="w-3.5 h-3.5 text-yellow-400/50 shrink-0" />
          : <FileIcon name={node.name} />
        }

        {/* name / rename input */}
        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={handleKey}
            onBlur={commitRename}
            className="flex-1 bg-[#1e1e2e] border border-violet-500/60 rounded px-1 py-0 text-[11px] text-gray-200 outline-none min-w-0"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={`truncate text-[11px] leading-5 flex-1 min-w-0 ${isActive ? 'text-violet-200 font-medium' : 'text-gray-300'}`}>
            {node.name}
          </span>
        )}

        {/* hover actions (quick buttons) */}
        {!isRenaming && (
          <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            {isFolder && onAddChild && (
              <>
                <QuickBtn title="New file" onClick={e => { e.stopPropagation(); onAddChild(node.id, 'file'); setOpen(true); }}>
                  <FilePlus2 className="w-3 h-3" />
                </QuickBtn>
                <QuickBtn title="New folder" onClick={e => { e.stopPropagation(); onAddChild(node.id, 'folder'); setOpen(true); }}>
                  <FolderPlus className="w-3 h-3" />
                </QuickBtn>
              </>
            )}
            <QuickBtn title="More" onClick={e => { e.stopPropagation(); onContextMenu(e, node); }}>
              <MoreHorizontal className="w-3 h-3" />
            </QuickBtn>
          </span>
        )}
      </div>

      {/* children */}
      {isFolder && open && node.children && (
        <ul>
          {node.children.map(child => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              renamingId={renamingId}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onAddChild={onAddChild}
            />
          ))}
          {/* Inline "new" node placeholder rendered inside parent */}
          {node.children.some(c => c.isNew) && null /* handled in the isNew node itself */}
        </ul>
      )}
    </li>
  );
}

function QuickBtn({ title, onClick, children }: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-gray-200 hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DomTreeItem  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

interface DomTreeItemProps {
  node: TreeNode;
  depth: number;
  selectedNodeId: string | null;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, label: string) => void;
}

function DomTreeItem({ node, depth, selectedNodeId, hiddenIds, onSelect, onContextMenu }: DomTreeItemProps) {
  const [open, setOpen] = useState(depth < 2);
  const has = !!(node.children?.length);
  const sel = selectedNodeId === node.id;
  if (hiddenIds.has(node.id)) return null;

  return (
    <li>
      <div
        id={`tree-node-${node.id}`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={() => { onSelect(node.id); if (has) setOpen(v => !v); }}
        onContextMenu={e => onContextMenu(e, node.id, node.label)}
        className={`group flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer rounded transition-all text-xs select-none border-l-2 ${
          sel ? 'bg-violet-500/20 border-violet-400' : 'hover:bg-white/[0.035] border-transparent'
        }`}
      >
        {has
          ? open ? <ChevronDown  className="w-3 h-3 text-gray-600 shrink-0" />
                 : <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
          : <span className="w-3 shrink-0" />}
        {has
          ? open ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400/80 shrink-0" />
                 : <Folder     className="w-3.5 h-3.5 text-yellow-400/60 shrink-0" />
          : <File className="w-3 h-3 text-blue-400/70 shrink-0" />}
        <span className={`truncate leading-5 ${tagColor(node.tag)} ${sel ? 'font-semibold' : ''}`}>
          {node.label}
        </span>
      </div>
      {has && open && (
        <ul>
          {node.children!.map(c => (
            <DomTreeItem
              key={c.id} node={c} depth={depth + 1}
              selectedNodeId={selectedNodeId} hiddenIds={hiddenIds}
              onSelect={onSelect} onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File context menu
// ─────────────────────────────────────────────────────────────────────────────

function FileContextMenu({
  state, onClose, onRename, onDelete,
}: {
  state: FileCtxMenu;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  if (!state.visible) return null;

  return (
    <div
      ref={ref}
      id="file-context-menu"
      style={{ top: state.y, left: state.x }}
      className="fixed z-50 w-44 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/60 py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] text-gray-500 font-medium truncate border-b border-white/8 mb-1 flex items-center gap-1.5">
        {state.nodeType === 'folder' ? <Folder className="w-3 h-3" /> : <File className="w-3 h-3" />}
        {state.nodeName}
      </div>
      <CtxBtn icon={<Pencil className="w-3.5 h-3.5" />}  label="Rename"  onClick={() => { onRename(); onClose(); }} />
      <CtxBtn icon={<Trash2  className="w-3.5 h-3.5" />}  label="Delete"  onClick={() => { onDelete(); onClose(); }} danger />
    </div>
  );
}

function CtxBtn({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left ${
        danger ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : 'text-gray-300 hover:bg-white/8 hover:text-white'
      }`}
    >
      <span className={danger ? 'text-red-500/70' : 'text-gray-500'}>{icon}</span>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM context menu
// ─────────────────────────────────────────────────────────────────────────────

function DomContextMenu({
  state, onClose, onCopy, onHide, onCreate,
}: {
  state: DomCtxMenu;
  onClose: () => void;
  onCopy: () => void;
  onHide: () => void;
  onCreate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  if (!state.visible) return null;

  return (
    <div
      ref={ref}
      id="sidebar-context-menu"
      style={{ top: state.y, left: state.x }}
      className="fixed z-50 w-48 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/60 py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] text-gray-500 font-medium truncate border-b border-white/8 mb-1">
        {state.nodeLabel}
      </div>
      <CtxBtn icon={<Copy      className="w-3.5 h-3.5" />} label="Copy selector"    onClick={() => { onCopy();   onClose(); }} />
      <CtxBtn icon={<EyeOff    className="w-3.5 h-3.5" />} label="Hide element"     onClick={() => { onHide();   onClose(); }} />
      <CtxBtn icon={<PlusSquare className="w-3.5 h-3.5"/>} label="Create component"  onClick={() => { onCreate(); onClose(); }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User context menu
// ─────────────────────────────────────────────────────────────────────────────

function UserContextMenu({
  state, onClose, onGrant, onRevoke,
}: {
  state: UserCtxMenu;
  onClose: () => void;
  onGrant: (socketId: string) => void;
  onRevoke: (socketId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  if (!state.visible) return null;

  return (
    <div
      ref={ref}
      id="user-context-menu"
      style={{ top: state.y, left: state.x }}
      className="fixed z-50 w-48 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/60 py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] text-gray-500 font-medium truncate border-b border-white/8 mb-1">
        {state.username} Actions
      </div>
      {state.canEdit ? (
        <CtxBtn icon={<EyeOff className="w-3.5 h-3.5" />} label="Revoke Edit Access" onClick={() => { onRevoke(state.socketId); onClose(); }} danger />
      ) : (
        <CtxBtn icon={<Pencil className="w-3.5 h-3.5" />} label="Grant Edit Access" onClick={() => { onGrant(state.socketId); onClose(); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder upload modal
//
// Uses <input webkitdirectory> to pick an entire directory tree.
// Reads all files as text, rebuilds the nested FileNode tree from
// each file's webkitRelativePath, then inserts the whole tree into the sidebar.
// ─────────────────────────────────────────────────────────────────────────────

interface RawFile {
  relativePath: string; // e.g. "my-project/src/App.tsx"
  name: string;
  content: string;
}

/** Build a nested FileNode tree from a flat list of { relativePath, name, content } */
function buildFolderTree(rawFiles: RawFile[]): FileNode[] {
  const root: FileNode[] = [];

  for (const rf of rawFiles) {
    const parts = rf.relativePath.split('/');
    let cursor = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        cursor.push({
          id: uid(),
          name: part,
          type: 'file',
          content: rf.content,
          language: detectLanguage(part),
        });
      } else {
        let folder = cursor.find(n => n.type === 'folder' && n.name === part);
        if (!folder) {
          folder = { id: uid(), name: part, type: 'folder', children: [] };
          cursor.push(folder);
        }
        cursor = folder.children!;
      }
    }
  }

  return root;
}

/** Rows shown in the preview — only first N paths, grouped */
interface PreviewRow {
  label: string;
  depth: number;
  type: 'file' | 'folder';
}

function buildPreviewRows(tree: FileNode[], depth = 0, out: PreviewRow[] = []): PreviewRow[] {
  for (const n of tree) {
    out.push({ label: n.name, depth, type: n.type });
    if (n.children) buildPreviewRows(n.children, depth + 1, out);
  }
  return out;
}

interface UploadModalProps {
  onConfirm: (nodes: FileNode[]) => void;
  onClose: () => void;
}

// Ignored file/folder names (like node_modules, .git, etc.)
const SKIP_NAMES = new Set([
  'node_modules', '.git', '.DS_Store', 'dist', 'build', '.next',
  '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.turbo',
]);

function UploadModal({ onConfirm, onClose }: UploadModalProps) {
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [rawFiles, setRawFiles]     = useState<RawFile[]>([]);
  const [previewTree, setPreviewTree] = useState<FileNode[]>([]);
  const [folderName, setFolderName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Read FileList ──────────────────────────────────────────────────────────
  const processFileList = (fileList: FileList) => {
    setLoading(true);
    const allFiles = Array.from(fileList);

    // Filter out skipped paths
    const filtered = allFiles.filter(f => {
      const parts = (f.webkitRelativePath || f.name).split('/');
      return !parts.some(p => SKIP_NAMES.has(p));
    });

    if (filtered.length === 0) { setLoading(false); return; }

    // Derive folder name from the first file's relative path root
    const firstPath = filtered[0].webkitRelativePath || filtered[0].name;
    setFolderName(firstPath.split('/')[0] ?? 'uploaded-folder');

    // Read all files as text
    const readers = filtered.map(f =>
      new Promise<RawFile>(res => {
        const r = new FileReader();
        const path = f.webkitRelativePath || f.name;
        r.onload  = () => res({ relativePath: path, name: f.name, content: r.result as string });
        r.onerror = () => res({ relativePath: path, name: f.name, content: '' });
        // Skip reading binary/large files
        if (f.size > 500_000) {
          res({ relativePath: path, name: f.name, content: `// [binary or large file — ${(f.size / 1024).toFixed(0)} KB]` });
        } else {
          r.readAsText(f);
        }
      }),
    );

    Promise.all(readers).then(results => {
      setRawFiles(results);
      setPreviewTree(buildFolderTree(results));
      setLoading(false);
    });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFileList(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) processFileList(e.dataTransfer.files);
  };

  const handleConfirm = () => {
    onConfirm(previewTree);
    onClose();
  };

  const fileCount  = rawFiles.length;
  const previewRows = buildPreviewRows(previewTree).slice(0, 60);
  const hiddenCount = Math.max(0, buildPreviewRows(previewTree).length - 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[480px] max-w-[95vw] rounded-xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[80vh]">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-100">Upload Folder</p>
              <p className="text-[10px] text-gray-500">Select a project folder to import</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-gray-200 hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Drop zone ────────────────────────────────────────────────── */}
        <div className="p-4 shrink-0">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 h-[88px] rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              dragging
                ? 'border-violet-400 bg-violet-500/12 scale-[1.01]'
                : rawFiles.length > 0
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/10 hover:border-violet-500/50 hover:bg-white/[0.025]'
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2 text-violet-400">
                {/* spinner */}
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-xs">Reading folder…</span>
              </div>
            ) : rawFiles.length > 0 ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-semibold text-gray-200">{folderName}</span>
                </div>
                <span className="text-[11px] text-emerald-400">{fileCount} file{fileCount !== 1 ? 's' : ''} loaded — click to change</span>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-600" />
                <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                  <span className="text-violet-400 font-semibold">Click to select a folder</span>
                  <br />or drag &amp; drop a project folder here
                </p>
              </>
            )}

            {/* Hidden folder input */}
            <input
              ref={inputRef}
              type="file"
              // @ts-ignore — webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              // @ts-ignore
              directory=""
              multiple
              onChange={handleInputChange}
              className="sr-only"
            />
          </div>
        </div>

        {/* ── Tree preview ─────────────────────────────────────────────── */}
        {previewTree.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col border-t border-white/[0.05]">
            <div className="px-4 py-2 flex items-center gap-2 shrink-0">
              <ListTree className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Preview</span>
              <span className="ml-auto text-[10px] text-gray-600">{fileCount} files · skipped node_modules &amp; .git</span>
            </div>
            <ul className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-px">
              {previewRows.map((row, i) => (
                <li
                  key={i}
                  style={{ paddingLeft: `${row.depth * 14 + 8}px` }}
                  className="flex items-center gap-1.5 py-[2px] text-[11px] text-gray-400"
                >
                  {row.type === 'folder'
                    ? <Folder className="w-3 h-3 text-yellow-400/60 shrink-0" />
                    : <FileIcon name={row.label} className="w-3 h-3 shrink-0" />}
                  <span className={row.type === 'folder' ? 'text-gray-300 font-medium' : ''}>{row.label}</span>
                </li>
              ))}
              {hiddenCount > 0 && (
                <li className="px-2 py-1 text-[10px] text-gray-600 italic">
                  … and {hiddenCount} more file{hiddenCount !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-white/[0.06] shrink-0 bg-[#0d0d0d]">
          <p className="text-[10px] text-gray-600">
            {rawFiles.length === 0
              ? 'No folder selected'
              : `${folderName}/ — ${fileCount} file${fileCount !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-colors"
            >
              Cancel
            </button>
            <button
              id="folder-upload-confirm"
              onClick={handleConfirm}
              disabled={previewTree.length === 0 || loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md shadow-violet-500/20 transition-all active:scale-95"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Import Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline new-file / new-folder input
// ─────────────────────────────────────────────────────────────────────────────

function NewNodeInput({
  type,
  onCommit,
  onCancel,
  depth = 1,
}: {
  type: 'file' | 'folder';
  onCommit: (name: string) => void;
  onCancel: () => void;
  depth?: number;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const commit = () => {
    const v = val.trim();
    if (v) onCommit(v); else onCancel();
  };

  return (
    <li>
      <div
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className="flex items-center gap-1.5 py-[3px] pr-2"
      >
        <span className="w-3 shrink-0" />
        {type === 'folder'
          ? <Folder className="w-3.5 h-3.5 text-yellow-400/50 shrink-0" />
          : <File   className="w-3 h-3 text-gray-500 shrink-0" />}
        <input
          ref={ref}
          value={val}
          placeholder={type === 'folder' ? 'folder-name' : 'file.js'}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
          onBlur={commit}
          className="flex-1 bg-[#1e1e2e] border border-violet-500/60 rounded px-1.5 py-0.5 text-[11px] text-gray-200 outline-none min-w-0"
        />
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree mutators (pure)
// ─────────────────────────────────────────────────────────────────────────────

function insertNode(tree: FileNode[], parentId: string | null, node: FileNode): FileNode[] {
  if (!parentId) return [...tree, node];
  return tree.map(n => {
    if (n.id === parentId) return { ...n, children: [...(n.children ?? []), node] };
    if (n.children) return { ...n, children: insertNode(n.children, parentId, node) };
    return n;
  });
}

function deleteNode(tree: FileNode[], id: string): FileNode[] {
  return tree
    .filter(n => n.id !== id)
    .map(n => n.children ? { ...n, children: deleteNode(n.children, id) } : n);
}

function renameNode(tree: FileNode[], id: string, name: string): FileNode[] {
  return tree.map(n => {
    if (n.id === id) return { ...n, name, language: n.type === 'file' ? detectLanguage(name) : undefined };
    if (n.children) return { ...n, children: renameNode(n.children, id, name) };
    return n;
  });
}

function findNode(tree: FileNode[], id: string): FileNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar  (main export)
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'files' | 'tree' | 'users';

export default function Sidebar({
  roomId, username, connectedUsers,
  selectedNodeId, onSelectNode,
  onCopyRoomId, copiedRoomId,
  onOpenFile, onLogout,
  files, onFilesChange,
  isAdmin,
}: SidebarProps) {
  const [activeTab, setActiveTab]   = useState<Tab>('files');
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // new-node creation state
  const [newNode, setNewNode] = useState<{ parentId: string | null; type: 'file' | 'folder' } | null>(null);

  // file context menu
  const [fileCtx, setFileCtx] = useState<FileCtxMenu>({
    visible: false, x: 0, y: 0, nodeId: '', nodeName: '', nodeType: 'file',
  });

  // DOM tab state
  const [hiddenIds, setHiddenIds]   = useState<Set<string>>(new Set());
  const [domCtx, setDomCtx]         = useState<DomCtxMenu>({
    visible: false, x: 0, y: 0, nodeId: null, nodeLabel: '',
  });

  // User tab state
  const [userCtx, setUserCtx] = useState<UserCtxMenu>({
    visible: false, x: 0, y: 0, socketId: '', username: '', canEdit: false,
  });

  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── File open ──────────────────────────────────────────────────────────────
  const openFile = useCallback((node: FileNode) => {
    setActiveFileId(node.id);
    onOpenFile?.(node.content ?? '', node.language ?? 'plaintext', node.name);
  }, [onOpenFile]);

  // ── File context menu ──────────────────────────────────────────────────────
  const openFileCtx = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault(); e.stopPropagation();
    setFileCtx({ visible: true, x: e.clientX, y: e.clientY, nodeId: node.id, nodeName: node.name, nodeType: node.type });
  }, []);

  // ── Rename ─────────────────────────────────────────────────────────────────
  const startRename = useCallback(() => setRenamingId(fileCtx.nodeId), [fileCtx.nodeId]);
  const commitRename = useCallback((id: string, name: string) => {
    onFilesChange(renameNode(files, id, name));
    setRenamingId(null);
  }, [files, onFilesChange]);
  const cancelRename = useCallback(() => setRenamingId(null), []);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    onFilesChange(deleteNode(files, fileCtx.nodeId));
    if (activeFileId === fileCtx.nodeId) setActiveFileId(null);
  }, [files, onFilesChange, fileCtx.nodeId, activeFileId]);

  // ── Add child (from hover button) ──────────────────────────────────────────
  const handleAddChild = useCallback((parentId: string, type: 'file' | 'folder') => {
    setNewNode({ parentId, type });
  }, []);

  // ── Commit new node ────────────────────────────────────────────────────────
  const commitNewNode = useCallback((name: string) => {
    if (!newNode) return;
    const node: FileNode = {
      id: uid(), name, type: newNode.type,
      ...(newNode.type === 'file'
        ? { content: `// ${name}\n`, language: detectLanguage(name) }
        : { children: [] }),
    };
    onFilesChange(insertNode(files, newNode.parentId, node));
    if (newNode.type === 'file') {
      setActiveFileId(node.id);
      onOpenFile?.(node.content ?? '', node.language ?? 'plaintext', node.name);
    }
    setNewNode(null);
  }, [newNode, onOpenFile, files, onFilesChange]);

  // ── Upload resolved ────────────────────────────────────────────────────────
  const handleUploadConfirm = useCallback((nodes: FileNode[]) => {
    onFilesChange([...files, ...nodes]);
    if (nodes.length > 0) {
      const first = nodes[0];
      setActiveFileId(first.id);
      onOpenFile?.(first.content ?? '', first.language ?? 'plaintext', first.name);
    }
  }, [files, onFilesChange, onOpenFile]);

  // ── DOM tab helpers ────────────────────────────────────────────────────────
  const openDomCtx = useCallback((e: React.MouseEvent, id: string, label: string) => {
    e.preventDefault(); e.stopPropagation();
    setDomCtx({ visible: true, x: e.clientX, y: e.clientY, nodeId: id, nodeLabel: label });
  }, []);

  const openUserCtx = useCallback((e: React.MouseEvent, user: ConnectedUser) => {
    if (!isAdmin) return; // Only admin can open this
    e.preventDefault(); e.stopPropagation();
    setUserCtx({
      visible: true, x: e.clientX, y: e.clientY,
      socketId: user.socketId, username: user.username, canEdit: !!user.canEdit
    });
  }, [isAdmin]);

  const handleGrantAccess = useCallback((targetSocketId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('grant_edit_access', { roomId, targetSocketId });
    }
  }, [roomId]);

  const handleRevokeAccess = useCallback((targetSocketId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('revoke_edit_access', { roomId, targetSocketId });
    }
  }, [roomId]);

  const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'files', icon: <Files    className="w-3.5 h-3.5" />, label: 'Files' },
    { id: 'tree',  icon: <ListTree className="w-3.5 h-3.5" />, label: 'DOM' },
    { id: 'users', icon: <Users    className="w-3.5 h-3.5" />, label: `Users (${connectedUsers.length})` },
  ];

  return (
    <>
      <aside id="sidebar-panel" className="flex flex-col h-full bg-[#0f0f0f] border-r border-white/[0.06] overflow-hidden">

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center h-9 border-b border-white/[0.06] shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              id={`sidebar-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1 h-full px-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                activeTab === t.id
                  ? 'text-violet-300 border-violet-400 bg-violet-500/5'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/[0.03]'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FILES TAB                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'files' && (
          <>
            {/* Toolbar row */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.04] shrink-0">
              <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider flex-1 pl-1">Explorer</span>

              {isAdmin && (
                <>
                  <button
                    id="sidebar-new-file"
                    title="New file"
                    onClick={() => setNewNode({ parentId: null, type: 'file' })}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id="sidebar-new-folder"
                    title="New folder"
                    onClick={() => setNewNode({ parentId: null, type: 'folder' })}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id="sidebar-upload"
                    title="Upload files"
                    onClick={() => setShowUpload(true)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* File tree */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
              <ul>
                {files.map(node => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    activeFileId={activeFileId}
                    renamingId={renamingId}
                    onOpen={openFile}
                    onContextMenu={openFileCtx}
                    onRenameCommit={commitRename}
                    onRenameCancel={cancelRename}
                    onAddChild={handleAddChild}
                  />
                ))}

                {/* Root-level new node input */}
                {newNode && newNode.parentId === null && (
                  <NewNodeInput
                    type={newNode.type}
                    depth={0}
                    onCommit={commitNewNode}
                    onCancel={() => setNewNode(null)}
                  />
                )}
              </ul>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* DOM TREE TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tree' && (
          <>
            <div className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.04] shrink-0">
              <Layers className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Structure</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
              <ul>
                {DOM_TREE.map(n => (
                  <DomTreeItem
                    key={n.id} node={n} depth={0}
                    selectedNodeId={selectedNodeId} hiddenIds={hiddenIds}
                    onSelect={onSelectNode} onContextMenu={openDomCtx}
                  />
                ))}
              </ul>
            </div>
            {hiddenIds.size > 0 && (
              <button
                onClick={() => setHiddenIds(new Set())}
                className="shrink-0 text-[10px] text-yellow-500 hover:text-yellow-300 px-3 py-2 border-t border-white/[0.06] text-left transition-colors"
              >
                Show {hiddenIds.size} hidden element{hiddenIds.size > 1 ? 's' : ''}
              </button>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* USERS TAB                                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <>
            <div className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.04] shrink-0">
              <Globe className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Room</span>
            </div>
            <div className="px-3 py-3 border-b border-white/[0.04] shrink-0">
              <p className="text-[10px] text-gray-600 mb-1 font-medium uppercase tracking-wider">Room ID</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[11px] font-mono text-gray-400 bg-white/5 border border-white/[0.06] px-2 py-1 rounded truncate">
                  {roomId ? roomId.slice(0, 16) + '...' : '—'}
                </code>
                <button
                  id="sidebar-copy-room"
                  onClick={onCopyRoomId}
                  title="Copy room ID"
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-200"
                >
                  {copiedRoomId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {connectedUsers.length === 0 && (
                <p className="text-center text-[11px] text-gray-600 mt-8">No users online</p>
              )}
              {connectedUsers.map(user => (
                <div 
                  key={user.socketId} 
                  onContextMenu={e => openUserCtx(e, user)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-white/[0.03] hover:bg-white/[0.055] border border-white/[0.05] transition-colors cursor-context-menu"
                >
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(user.username)} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>
                    {user.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 font-medium truncate">
                      {user.username}
                      {user.username === username && <span className="ml-1.5 text-[10px] text-violet-400 font-normal">(you)</span>}
                      {/* Show Admin badge or Editor badge */}
                      {user.username === sessionStorage.getItem('roomOwner') ? (
                        <span className="ml-1.5 px-1 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[9px] font-bold border border-amber-500/30 uppercase tracking-tighter">Admin</span>
                      ) : user.canEdit ? (
                        <span className="ml-1.5 px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[9px] font-bold border border-violet-500/30 uppercase tracking-tighter">Editor</span>
                      ) : (
                        <span className="ml-1.5 px-1 py-0.5 rounded bg-gray-500/20 text-gray-400 text-[9px] font-bold border border-gray-500/30 uppercase tracking-tighter">Viewer</span>
                      )}
                    </p>
                    <p className="text-[10px] text-emerald-500 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />Online
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Bottom username strip ──────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/[0.06] px-3 py-2.5 flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(username)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
            {username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300 font-medium truncate">{username || 'Anonymous'}</p>
            <p className="text-[10px] text-gray-600 truncate">{isAdmin ? 'Admin' : 'Developer'}</p>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* ── Portals ─────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <FileContextMenu
          state={fileCtx}
          onClose={() => setFileCtx(s => ({ ...s, visible: false }))}
          onRename={startRename}
          onDelete={handleDelete}
        />
      )}

      <DomContextMenu
        state={domCtx}
        onClose={() => setDomCtx(s => ({ ...s, visible: false }))}
        onCopy={() => navigator.clipboard.writeText(`#${domCtx.nodeId ?? ''}`).catch(() => {})}
        onHide={() => { if (domCtx.nodeId) setHiddenIds(s => new Set([...s, domCtx.nodeId!])); }}
        onCreate={() => {}}
      />

      <UserContextMenu
        state={userCtx}
        onClose={() => setUserCtx(s => ({ ...s, visible: false }))}
        onGrant={handleGrantAccess}
        onRevoke={handleRevokeAccess}
      />

      {showUpload && (
        <UploadModal
          onConfirm={handleUploadConfirm}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}
