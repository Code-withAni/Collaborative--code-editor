/**
 * Auth.tsx
 * Login / Register page for CodeSync.
 * On success, stores the JWT + username in localStorage then forwards to home.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';

const API = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode]           = useState<Mode>('login');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const reset = (nextMode: Mode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) { setError('Username is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || 'Something went wrong.');
        return;
      }

      // Persist token + username
      localStorage.setItem('token', json.data.token);
      localStorage.setItem('username', json.data.username);

      if (mode === 'register') {
        setSuccess('Account created! Taking you to the app…');
        setTimeout(() => navigate('/'), 800);
      } else {
        navigate('/');
      }
    } catch {
      setError('Cannot reach the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex mb-4 p-3 bg-primary/10 rounded-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <code className="text-primary-foreground font-bold text-lg">&lt;/&gt;</code>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-1">CodeSync</h1>
          <p className="text-muted-foreground text-sm">Real-time collaborative coding</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8">

          {/* Tab switcher */}
          <div className="flex bg-secondary rounded-lg p-1 mb-6">
            <button
              onClick={() => reset('login')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
            <button
              onClick={() => reset('register')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Error / Success */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input
                id="auth-username"
                type="text"
                placeholder="e.g. john_doe"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
            >
              {loading
                ? 'Please wait…'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Switch mode hint */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            {mode === 'login'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <button
              onClick={() => reset(mode === 'login' ? 'register' : 'login')}
              className="text-primary hover:underline font-medium"
            >
              {mode === 'login' ? 'Register' : 'Login'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by React, Socket.io &amp; Monaco Editor
        </p>
      </div>
    </div>
  );
}
