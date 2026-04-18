/**
 * Toolbar.tsx
 * Top action bar — language picker, run/format buttons, room-info pill,
 * connection badge, and collaborator avatars.
 */

import { useState } from 'react';
import {
  Play,
  Settings,
  GitBranch,
  Wifi,
  WifiOff,
  Share2,
  Save,
  ChevronDown,
  Code2,
  Users,
  Moon,
  Bell,
  Terminal,
  Zap,
  LogOut,
} from 'lucide-react';

interface CollabUser {
  socketId: string;
  username: string;
}

interface ToolbarProps {
  isConnected: boolean;
  roomId: string;
  username: string;
  connectedUsers: CollabUser[];
  language: string;
  onLanguageChange: (lang: string) => void;
  onLeaveRoom: () => void;
  onCopyRoomId: () => void;
  onFormat?: () => void;
  onRun?: () => void;
  onLogout?: () => void;
}

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
  { id: 'typescript', label: 'TypeScript', icon: '🔷' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'cpp', label: 'C++', icon: '⚡' },
  { id: 'rust', label: 'Rust', icon: '🦀' },
  { id: 'go', label: 'Go', icon: '🐹' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'html', label: 'HTML', icon: '🌐' },
  { id: 'css', label: 'CSS', icon: '🎨' },
  { id: 'json', label: 'JSON', icon: '📄' },
];

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-700',
];

function getAvatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function Toolbar({
  isConnected,
  roomId,
  username,
  connectedUsers,
  language,
  onLanguageChange,
  onLeaveRoom,
  onCopyRoomId,
  onFormat,
  onRun,
  onLogout,
}: ToolbarProps) {
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = LANGUAGES.find((l) => l.id === language) ?? LANGUAGES[0];

  return (
    <header className="flex items-center h-12 px-3 gap-2 border-b border-white/[0.06] bg-[#0f0f0f] select-none shrink-0 z-20">
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pr-3 border-r border-white/10 mr-1">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Code2 className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold text-white tracking-tight hidden sm:block">
          CodeSync
        </span>
      </div>

      {/* ── File name pill ─────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/[0.06] text-xs text-gray-400">
        <Terminal className="w-3 h-3 text-violet-400" />
        <span className="text-gray-300 font-medium">main.{currentLang.id === 'javascript' ? 'js' : currentLang.id}</span>
        <span className="text-green-500/70 ml-1">●</span>
      </div>

      {/* ── Language selector ──────────────────────────────────────────── */}
      <div className="relative ml-1">
        <button
          id="toolbar-lang-select"
          onClick={() => setLangOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/[0.06] hover:border-violet-500/40 transition-all text-xs text-gray-300 font-medium"
        >
          <span>{currentLang.icon}</span>
          <span className="hidden sm:inline">{currentLang.label}</span>
          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
        </button>

        {langOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />
            <div className="absolute top-full left-0 mt-1.5 z-40 w-44 rounded-lg border border-white/10 bg-[#161616] shadow-2xl shadow-black/60 overflow-hidden py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => { onLanguageChange(lang.id); setLangOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-white/8 transition-colors text-left ${
                    lang.id === language ? 'text-violet-300 bg-violet-500/10' : 'text-gray-300'
                  }`}
                >
                  <span>{lang.icon}</span>
                  <span>{lang.label}</span>
                  {lang.id === language && <Zap className="w-3 h-3 ml-auto text-violet-400" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────────────────── */}
      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <ToolbarBtn
          id="toolbar-format"
          icon={<Settings className="w-3.5 h-3.5" />}
          label="Format"
          onClick={onFormat}
          variant="ghost"
        />
        <ToolbarBtn
          id="toolbar-branch"
          icon={<GitBranch className="w-3.5 h-3.5" />}
          label="Branch"
          variant="ghost"
        />
        <ToolbarBtn
          id="toolbar-save"
          icon={<Save className="w-3.5 h-3.5" />}
          label="Save"
          variant="ghost"
        />
        <ToolbarBtn
          id="toolbar-share"
          icon={<Share2 className="w-3.5 h-3.5" />}
          label="Share"
          onClick={onCopyRoomId}
          variant="ghost"
        />
      </div>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Collaborator avatars ───────────────────────────────────────── */}
      {connectedUsers.length > 0 && (
        <div className="hidden sm:flex items-center">
          <div className="flex -space-x-1.5">
            {connectedUsers.slice(0, 4).map((user) => (
              <div
                key={user.socketId}
                title={user.username + (user.username === username ? ' (you)' : '')}
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(user.username)} flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[#0f0f0f] cursor-default`}
              >
                {user.username[0]?.toUpperCase()}
              </div>
            ))}
            {connectedUsers.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-400 ring-2 ring-[#0f0f0f]">
                +{connectedUsers.length - 4}
              </div>
            )}
          </div>
          <div className="ml-2 flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            <span>{connectedUsers.length}</span>
          </div>
        </div>
      )}

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* ── Connection badge ───────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition-all ${
          isConnected
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}
      >
        {isConnected ? (
          <Wifi className="w-3 h-3" />
        ) : (
          <WifiOff className="w-3 h-3" />
        )}
        <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
        {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      </div>

      {/* ── Run button ─────────────────────────────────────────────────── */}
      <button
        id="toolbar-run"
        onClick={onRun}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-violet-500/20 transition-all hover:shadow-violet-500/40 active:scale-95"
      >
        <Play className="w-3 h-3 fill-white" />
        <span className="hidden sm:inline">Run</span>
      </button>

      {/* ── Notifications / Moon ──────────────────────────────────────────── */}
      <button className="hidden lg:flex items-center justify-center w-7 h-7 rounded hover:bg-white/8 text-gray-500 hover:text-gray-300 transition-colors">
        <Bell className="w-3.5 h-3.5" />
      </button>
      <button className="hidden lg:flex items-center justify-center w-7 h-7 rounded hover:bg-white/8 text-gray-500 hover:text-gray-300 transition-colors">
        <Moon className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={onLogout}
        title="Log out"
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </header>
  );
}

// ── Small helper ─────────────────────────────────────────────────────────────

function ToolbarBtn({
  id,
  icon,
  label,
  onClick,
  variant = 'ghost',
}: {
  id?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'ghost' | 'accent';
}) {
  return (
    <button
      id={id}
      title={label}
      onClick={onClick}
      className={`flex items-center justify-center w-7 h-7 rounded transition-all ${
        variant === 'accent'
          ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-500/30'
          : 'hover:bg-white/8 text-gray-500 hover:text-gray-200'
      }`}
    >
      {icon}
    </button>
  );
}
