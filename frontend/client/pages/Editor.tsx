/**
 * Editor.tsx
 * Real-Time Collaborative Code Editor page.
 *
 * All socket / room logic lives here. Presentation is fully delegated
 * to the <Layout> component which composes Toolbar, Sidebar, and EditorPanel.
 *
 * Bug-fixes preserved from original:
 *   FIX #1 — VITE_SOCKET_URL read from env (socket.ts)
 *   FIX #2 — "room_error" event name (not "error")
 *   FIX #3 — code_change payload includes "username"
 *   FIX #4 — join_room emitted inside 'connect' handler
 *   FIX #5 — ConnectedUser key is "socketId" not "id"
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EditorProps } from '@monaco-editor/react';
import { initSocket, getSocket, disconnectSocket } from '@/socket/socket';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import type { FileNode } from '@/components/Sidebar';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectedUser {
  socketId: string;
  username: string;
  canEdit?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [code, setCode] = useState(
    '// Welcome to CodeSync!\n// Start typing to collaborate in real-time\n\nconst greeting = () => {\n  console.log("Hello, World!");\n};\n\ngreeting();\n',
  );
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<FileNode[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const editorRef = useRef<any>(null);

  // Guards against re-emitting code changes that arrived FROM the socket,
  // which would create an infinite broadcast loop.
  const isUpdatingFromSocket = useRef(false);

  // ── Step 1: load session from storage ─────────────────────────────────────
  useEffect(() => {
    // sessionStorage holds the active tab session; localStorage holds the persisted username.
    const storedUsername = sessionStorage.getItem('username') ?? localStorage.getItem('username');
    const storedRoomId = sessionStorage.getItem('roomId');

    if (!storedUsername || !storedRoomId) {
      console.warn('[Editor] No session found — redirecting to home.');
      navigate('/');
      return;
    }

    console.log(`[Editor] Session — username: "${storedUsername}", roomId: "${storedRoomId}"`);
    setUsername(storedUsername);
    setRoomId(storedRoomId);

    // Check if user is the admin (owner)
    const owner = sessionStorage.getItem('roomOwner');
    setIsAdmin(storedUsername === owner);
  }, [navigate]);

  // ── Step 2: init socket & register listeners once username+roomId are ready ─
  useEffect(() => {
    if (!username || !roomId) return;

    const socket = initSocket();

    const joinRoom = () => {
      console.log(`[Editor] Emitting join_room — roomId: "${roomId}", username: "${username}"`);
      socket.emit('join_room', { roomId, username });
    };

    if (socket.connected) joinRoom();

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[Editor] ✅ Socket connected. socket.id = ${socket.id}`);
      joinRoom();
    });

    socket.on('disconnect', (reason: string) => {
      setIsConnected(false);
      console.warn(`[Editor] ⚡ Socket disconnected. reason = ${reason}`);
    });

    socket.on(
      'user_joined',
      (data: { username: string; users: ConnectedUser[]; lastCode?: string }) => {
        setConnectedUsers(data.users);
        if (data.lastCode && data.lastCode.trim() !== '') {
          isUpdatingFromSocket.current = true;
          setCode(data.lastCode);
          editorRef.current?.setValue(data.lastCode);
          setTimeout(() => { isUpdatingFromSocket.current = false; }, 0);
        }
        if (data.username !== username) {
          toast({ title: 'User Joined', description: `${data.username} joined the room` });
        }
        if (data.files) {
          setSharedFiles(data.files);
        }
      },
    );

    socket.on('user_left', (data: { username: string; users: ConnectedUser[] }) => {
      setConnectedUsers(data.users);
      toast({ title: 'User Left', description: `${data.username} left the room` });
    });

    socket.on('user_list', (data: { users: ConnectedUser[] }) => {
      setConnectedUsers(data.users);
    });

    socket.on('receive_code', (data: { code: string; username: string }) => {
      isUpdatingFromSocket.current = true;
      setCode(data.code);
      editorRef.current?.setValue(data.code);
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 0);
    });

    socket.on('load_code', (data: { code: string }) => {
      isUpdatingFromSocket.current = true;
      setCode(data.code);
      editorRef.current?.setValue(data.code);
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 0);
    });

    // FIX #2: "room_error" not "error"
    socket.on('room_error', (data: { message: string }) => {
      toast({ title: 'Room Error', description: data.message, variant: 'destructive' });
    });

    socket.on('receive_files', (data: { files: FileNode[] }) => {
      setSharedFiles(data.files);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('user_list');
      socket.off('receive_code');
      socket.off('load_code');
      socket.off('room_error');
      socket.off('receive_files');
    };
  }, [username, roomId, toast]);

  // ── Monaco Editor handlers ─────────────────────────────────────────────────

  const handleEditorMount: EditorProps['onMount'] = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      if (isUpdatingFromSocket.current) return;

      setCode(value);

      const socket = getSocket();
      if (socket && socket.connected) {
        // FIX #3: include "username" in payload
        socket.emit('code_change', { roomId, code: value, username });
      }
    },
    [roomId, username],
  );

  const handleFilesChange = useCallback(
    (newFiles: FileNode[]) => {
      setSharedFiles(newFiles);
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('files_update', { roomId, files: newFiles });
      }
    },
    [roomId],
  );

  // ── Leave room ─────────────────────────────────────────────────────────────

  const handleLeaveRoom = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_room', { roomId });
      disconnectSocket();
    }
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('roomId');
    navigate('/');
  };

  const handleLogout = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_room', { roomId });
      disconnectSocket();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('roomId');
    navigate('/auth');
  };

  // ── Copy room ID ───────────────────────────────────────────────────────────

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedRoomId(true);
      setTimeout(() => setCopiedRoomId(false), 2000);
      toast({ title: 'Copied!', description: 'Room ID copied to clipboard' });
    } catch (err) {
      console.error('Failed to copy room ID:', err);
    }
  };

  const currentUser = connectedUsers.find(u => u.username === username);
  const canEdit = isAdmin || (currentUser?.canEdit ?? false);

  return (
    <Layout
      isConnected={isConnected}
      roomId={roomId}
      username={username}
      connectedUsers={connectedUsers}
      code={code}
      onCodeChange={handleCodeChange}
      onEditorMount={handleEditorMount}
      onLeaveRoom={handleLeaveRoom}
      onLogout={handleLogout}
      onCopyRoomId={handleCopyRoomId}
      copiedRoomId={copiedRoomId}
      files={sharedFiles}
      onFilesChange={handleFilesChange}
      isAdmin={isAdmin}
      canEdit={canEdit}
    />
  );
}
