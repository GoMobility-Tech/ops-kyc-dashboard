import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { opsLogin } from '../api/opsApi.js';
import { setSession } from '../utils/auth.js';
import { firstAvailableRoute } from '../components/layout/moduleRoutes.js';
import { Button, Input, Alert } from '../components/ui';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoad]      = useState(false);
  const [error, setError]       = useState('');
  const nav = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return setError('Please enter a valid email');
    if (password.length < 8 || password.length > 128) return setError('Password must be 8-128 characters');

    setLoad(true); setError('');
    try {
      const res = await opsLogin(trimmed, password);
      const d = res.data?.data || {};
      const token = d.accessToken;
      const user  = d.user || {};
      const modules = Array.isArray(d.modules) ? d.modules : [];
      if (!token) throw new Error('No token in response');
      setSession({
        token,
        role:    user.role || 'ops_team',
        name:    user.fullName || '',
        email:   user.email || trimmed,
        modules,
      });
      nav(firstAvailableRoute(modules), { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message;
      if (status === 401) setError('Invalid email or password. Please try again.');
      else if (status === 403) setError(msg || 'Account is deactivated. Contact your administrator.');
      else if (status === 429) setError('Too many login attempts. Please wait 15 minutes.');
      else if (status === 400) {
        const first = err.response?.data?.errors?.[0]?.msg;
        setError(first || msg || 'Validation failed');
      } else setError(msg || 'Something went wrong. Please try again.');
    } finally { setLoad(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent-navy px-4 py-8 relative overflow-hidden">
      {/* Ambient shapes — gold and blue */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-brand-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 bg-accent-navyMid/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpeg" alt="GO Mobility"
            className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-pop ring-2 ring-brand-500/60" />
          <h1 className="text-xl font-bold text-white">Ops KYC Dashboard</h1>
          <p className="text-brand-400 text-xs mt-1 text-center">GO Mobility — Driver Onboarding</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-500/30 shadow-pop p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@gomobility.in"
              autoComplete="username"
              icon={Mail}
            />

            <Input
              label="Password"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              icon={Lock}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="text-ink-faint hover:text-ink shrink-0"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />

            {error && <Alert tone="danger">{error}</Alert>}

            <Button
              type="submit"
              loading={loading}
              icon={LogIn}
              className="w-full"
              size="lg"
            >
              Log in
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-brand-400/80 mt-6">
          Built in Bihar · Built for Bharat
        </p>
      </div>
    </div>
  );
}
