import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, Loader2, CheckCircle2, Info } from 'lucide-react';
import { registerDriver } from '../api/opsApi.js';

function Field({ label, icon: Icon, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-3 py-3 border border-white/10 focus-within:border-yellow-500/40 transition">
        <Icon size={15} className="text-slate-500 shrink-0" />
        {children}
      </div>
      {hint && <p className="text-slate-600 text-[11px] mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export default function DriverRegisterPage() {
  const nav = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim())           return setError('Full name is required');
    if (fullName.trim().length < 2) return setError('Name must be at least 2 characters');
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter valid 10-digit Indian mobile number (starts with 6-9)');

    setLoading(true); setError('');
    try {
      const res = await registerDriver({
        fullName: fullName.trim(),
        phone,
        email: email.trim() || undefined,
      });
      const userId = res.data?.data?.userId;
      if (!userId) throw new Error('No userId in response');
      setDone({ userId, fullName: fullName.trim(), phone });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  // ─── Success ──
  if (done) {
    return (
      <div className="min-h-screen bg-[#0f1117]">
        <div className="border-b border-white/5 bg-[#1a1d27] px-4 py-3 sm:py-4 flex items-center gap-3">
          <button onClick={() => nav('/')} className="p-1 text-slate-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-white font-semibold text-sm">Driver Registered</p>
            <p className="text-slate-400 text-xs">Proceed to KYC document upload</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-3 sm:px-4 py-8 sm:py-10">
          <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-5 sm:p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>

            <div>
              <p className="text-white font-bold text-lg">Account Created!</p>
              <p className="text-slate-400 text-sm mt-1">
                <span className="text-white font-medium">{done.fullName}</span> registered successfully.
              </p>
              <p className="text-slate-500 text-xs mt-0.5">+91 {done.phone}</p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-left">
              <div className="flex items-start gap-2">
                <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-400/80 text-xs leading-relaxed">
                  Phone OTP verification will happen when driver signs in to the app for the first time. KYC can start now.
                </p>
              </div>
            </div>

            <div className="bg-[#0f1117] rounded-xl p-4 text-left space-y-2.5 border border-white/5">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Onboarding Steps</p>
              {[
                'Upload Aadhaar (front + back)',
                'Upload PAN Card',
                'Upload Driving Licence',
                'Upload Vehicle RC',
                'Take Selfie / Photo',
                'Click "Verify All" to run KYC',
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-slate-300 text-xs">{s}</span>
                </div>
              ))}
            </div>

            <button onClick={() => nav(`/driver/${done.userId}`)}
              className="w-full py-3.5 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 active:bg-yellow-600 transition">
              Start KYC → Upload Documents
            </button>

            <button onClick={() => nav('/')}
              className="w-full py-2 text-slate-500 text-xs hover:text-slate-300 transition">
              Back to search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──
  return (
    <div className="min-h-screen bg-[#0f1117]">
      <div className="border-b border-white/5 bg-[#1a1d27] px-4 py-3 sm:py-4 flex items-center gap-3">
        <button onClick={() => nav('/')} className="p-1 text-slate-400 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-white font-semibold text-sm">Register New Driver</p>
          <p className="text-slate-400 text-xs">No OTP needed — account created instantly</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="bg-[#1a1d27] rounded-2xl border border-white/5 p-5 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <p className="text-white font-semibold text-sm mb-0.5">Driver Details</p>
            <p className="text-slate-500 text-xs leading-relaxed">
              Fill in the driver's info. Account is created immediately — no OTP needed from ops side.
            </p>
          </div>

          <Field label="Full Name *" icon={User}>
            <input
              value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Akash Kumar Gupta"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-600"
            />
          </Field>

          <Field
            label="Phone Number *" icon={Phone}
            hint="Driver will verify this when they sign in to the app for the first time">
            <span className="text-slate-500 text-sm shrink-0">+91</span>
            <input
              type="tel" maxLength={10} value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="9XXXXXXXXX"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-600"
            />
          </Field>

          <Field label="Email (optional)" icon={Mail}>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="driver@example.com"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-600"
            />
          </Field>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-red-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-yellow-500 text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 active:bg-yellow-600 transition disabled:opacity-60">
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Registering...</>
              : 'Register Driver →'}
          </button>
        </form>

        <div className="mt-4 bg-[#1a1d27] rounded-2xl border border-white/5 p-4">
          <p className="text-slate-400 text-xs font-medium mb-2">What happens next?</p>
          <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
            <p>• Driver account created instantly with <span className="text-slate-300">is_verified = false</span></p>
            <p>• KYC documents can be uploaded immediately after registration</p>
            <p>• Driver verifies phone when they <span className="text-slate-300">sign in to the app</span> for the first time</p>
            <p>• KYC data persists — no re-upload needed after phone verification</p>
          </div>
        </div>
      </div>
    </div>
  );
}
