import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { opsLogin } from '../api/opsApi.js';
import { setSession } from '../utils/auth.js';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

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
      if (!token) throw new Error('No token in response');
      setSession({
        token,
        role: user.role || 'ops_team',
        name: user.fullName || '',
      });
      nav('/');
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message;
      if (status === 401) setError('Invalid email or password. Please try again.');
      else if (status === 403) setError(msg || 'Account is deactivated. Contact your administrator.');
      else if (status === 429) setError('Too many login attempts. Please wait 15 minutes.');
      else if (status === 400) {
        const first = err.response?.data?.errors?.[0]?.msg;
        setError(first || msg || 'Validation failed');
      }
      else setError(msg || 'Something went wrong. Please try again.');
    } finally { setLoad(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpeg" alt="GO Mobility" className="w-20 h-20 rounded-2xl object-cover mb-4 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Ops KYC Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">GO Mobility — Driver Onboarding</p>
        </div>

        <div className="bg-[#1a1d27] rounded-2xl p-5 sm:p-6 border border-white/5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-4 py-3 border border-white/10">
                <Mail size={16} className="text-slate-500 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@gomobility.in"
                  autoComplete="username"
                  className="flex-1 bg-transparent text-white outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-4 py-3 border border-white/10">
                <Lock size={16} className="text-slate-500 shrink-0" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="flex-1 bg-transparent text-white outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-yellow-500 text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
