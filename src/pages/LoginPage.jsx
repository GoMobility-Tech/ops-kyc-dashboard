import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../api/opsApi.js';
import { Shield, Phone, KeyRound, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [step, setStep]     = useState('phone');
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');
  const nav = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter valid 10-digit Indian mobile number (starts with 6-9)');
    setLoad(true); setError('');
    try {
      await sendOtp(phone);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoad(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) return setError('Enter OTP');
    setLoad(true); setError('');
    try {
      const res = await verifyOtp(phone, otp);
      const token = res.data?.data?.accessToken || res.data?.data?.token;
      if (!token) throw new Error('No token in response');
      localStorage.setItem('ops_token', token);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
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
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <label className="block text-sm text-slate-400 mb-1">Admin Phone Number</label>
              <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-4 py-3 border border-white/10">
                <Phone size={16} className="text-slate-500 shrink-0" />
                <span className="text-slate-500 text-sm">+91</span>
                <input
                  type="tel" maxLength={10} value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/, ''))}
                  placeholder="9XXXXXXXXX"
                  className="flex-1 bg-transparent text-white outline-none text-sm"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-yellow-500 text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition disabled:opacity-60">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-slate-400">OTP sent to +91 {phone}
                <button type="button" onClick={() => setStep('phone')} className="ml-2 text-yellow-400 text-xs underline">Change</button>
              </p>
              <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-4 py-3 border border-white/10">
                <KeyRound size={16} className="text-slate-500 shrink-0" />
                <input
                  type="text" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="flex-1 bg-transparent text-white outline-none text-sm tracking-widest"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-yellow-500 text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition disabled:opacity-60">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Verify & Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
