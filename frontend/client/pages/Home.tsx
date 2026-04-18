import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Copy, Plus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Home() {
  const navigate = useNavigate();
  // Pre-fill username from localStorage so returning users don't have to retype
  const [username, setUsername] = useState(() => localStorage.getItem('username') ?? '');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);

  // Keep localStorage in sync whenever the username field changes
  useEffect(() => {
    if (username.trim()) {
      localStorage.setItem('username', username.trim());
    }
  }, [username]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/auth');
  };

  const handleCreateRoom = async () => {
    setError('');
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: username.trim() }),
      });
      const json = await response.json();

      if (json.success) {
        setRoomId(json.data.roomId);
        setCopiedRoomId(false);
        // We set this here but handleJoinRoom overrides it if needed
        sessionStorage.setItem('roomOwner', json.data.owner);
      } else {
        setError(json.message || 'Failed to create room');
      }
    } catch (err) {
      console.error('Create room error:', err);
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setError('');
    const u = username.trim();
    const r = roomId.trim();

    if (!u) { setError('Please enter a username'); return; }
    if (!r) { setError('Please enter or create a room ID'); return; }

    setLoading(true);
    try {
      // 1. Verify existence in DB first to avoid socket "Room Error"
      const res = await fetch(`${API}/api/rooms/${r}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || 'Room not found. Check the ID or create a new one.');
        return;
      }

      // 2. Persist session data
      localStorage.setItem('username', u);
      sessionStorage.setItem('username', u);
      sessionStorage.setItem('roomId', r);
      sessionStorage.setItem('roomOwner', json.data.owner);

      navigate('/editor');
    } catch (err) {
      console.error('Join room error:', err);
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRoomId = async () => {
    if (!roomId) return;
    
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedRoomId(true);
      setTimeout(() => setCopiedRoomId(false), 2000);
    } catch (err) {
      console.error('Failed to copy room ID:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (roomId) {
        handleJoinRoom();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <button
            onClick={handleLogout}
            title="Logout"
            className="absolute right-0 top-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
          <div className="inline-block mb-4 p-3 bg-primary/10 rounded-lg">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <code className="text-primary-foreground font-bold text-lg">&lt;/&gt;</code>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">CodeSync</h1>
          <p className="text-muted-foreground text-base">Real-time collaborative coding</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl shadow-xl p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Username
            </label>
            <Input
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Room ID Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Room ID
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Room ID or create one"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground flex-1"
              />
              {roomId && (
                <Button
                  onClick={handleCopyRoomId}
                  variant="outline"
                  size="icon"
                  title={copiedRoomId ? 'Copied!' : 'Copy room ID'}
                  className="border-border hover:bg-secondary"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button
              onClick={handleCreateRoom}
              variant="outline"
              disabled={loading}
              className="border-border hover:bg-secondary text-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              {loading && !roomId ? 'Creating...' : 'Create Room'}
            </Button>
            <Button
              onClick={handleJoinRoom}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading && roomId ? 'Joining...' : 'Join Room'}
            </Button>
          </div>

          {/* Info */}
          {roomId && (
            <div className="bg-secondary/50 border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">Room ID created:</p>
              <p className="font-mono text-sm text-foreground break-all">{roomId}</p>
              <p className="text-xs text-muted-foreground mt-2">Share this ID with others to collaborate</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by React, Socket.io & Monaco Editor
        </p>
      </div>
    </div>
  );
}
