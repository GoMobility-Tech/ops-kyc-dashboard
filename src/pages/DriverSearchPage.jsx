import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchDrivers } from '../api/opsApi.js';
import { Search, UserCheck, LogOut, Loader2, ChevronRight, UserPlus } from 'lucide-react';

const STATUS_COLORS = {
  verified:       'bg-green-500/20 text-green-400',
  in_progress:    'bg-yellow-500/20 text-yellow-400',
  pending_review: 'bg-blue-500/20 text-blue-400',
  not_started:    'bg-slate-500/20 text-slate-400',
  rejected:       'bg-red-500/20 text-red-400',
  suspended:      'bg-orange-500/20 text-orange-400',
};

export default function DriverSearchPage() {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [error,    setError]    = useState('');
  const nav = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setSearched(false);
    try {
      const res = await searchDrivers(query.trim());
      setResults(res.data?.data?.drivers || res.data?.data || []);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('ops_token');
    nav('/login');
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#1a1d27] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img src="/logo.jpeg" alt="GO Mobility" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">GO Mobility</p>
            <p className="text-slate-400 text-xs hidden sm:block">Ops KYC Dashboard</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs sm:text-sm transition shrink-0">
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {/* Title + New Driver button */}
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Driver Onboarding</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 hidden sm:block">Search existing driver or register a new one</p>
          </div>
          <button
            onClick={() => nav('/driver/new')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-yellow-500 text-black text-xs sm:text-sm font-bold hover:bg-yellow-400 transition shrink-0">
            <UserPlus size={14} />
            <span>New Driver</span>
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 sm:gap-3 mb-5 sm:mb-6">
          <div className="flex-1 flex items-center gap-2 bg-[#1a1d27] rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/10 focus-within:border-yellow-500/30 transition">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Phone, name, or User ID..."
              className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-slate-600 min-w-0"
            />
          </div>
          <button type="submit" disabled={loading}
            className="px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-[#1a1d27] border border-white/10 text-slate-300 font-medium text-sm flex items-center gap-1.5 hover:border-white/20 hover:text-white transition disabled:opacity-60 shrink-0">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* No results */}
        {searched && results.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
              <UserCheck size={22} className="text-slate-600" />
            </div>
            <div>
              <p className="text-white font-medium text-sm sm:text-base">No driver found for "{query}"</p>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">Is this a new driver? Register them below.</p>
            </div>
            <button
              onClick={() => nav('/driver/new')}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 transition">
              <UserPlus size={14} />
              Register New Driver
            </button>
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs mb-3">{results.length} driver{results.length > 1 ? 's' : ''} found</p>
            {results.map(driver => (
              <button key={driver.user_id || driver.id}
                onClick={() => nav(`/driver/${driver.user_id || driver.id}`)}
                className="w-full bg-[#1a1d27] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-yellow-500/30 active:border-yellow-500/50 transition flex items-center gap-3 sm:gap-4 group text-left">
                {/* Avatar */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <span className="text-yellow-400 font-bold text-sm">
                    {(driver.full_name || 'D')[0].toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{driver.full_name || 'Unknown'}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{driver.phone_number}</p>
                </div>
                {/* Status + arrow */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[driver.overall_status] || STATUS_COLORS.not_started}`}>
                    {driver.overall_status?.replace(/_/g, ' ') || 'not started'}
                  </span>
                  <ChevronRight size={15} className="text-slate-600 group-hover:text-yellow-400 transition" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Initial empty state */}
        {!searched && results.length === 0 && (
          <div className="mt-2 border border-dashed border-white/10 rounded-2xl p-8 sm:p-10 text-center">
            <Search size={26} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Search a driver by phone, name, or ID</p>
            <p className="text-slate-600 text-xs mt-1">or register a new driver using the button above</p>
          </div>
        )}
      </div>
    </div>
  );
}
