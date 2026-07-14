import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, CheckCircle2, Info } from 'lucide-react';
import { registerDriver } from '../../api/opsApi.js';
import { Button, Input, Card, Alert } from '../../components/ui';

export default function RegisterPage() {
  const nav = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim())            return setError('Full name is required');
    if (fullName.trim().length < 2)  return setError('Name must be at least 2 characters');
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

  if (done) {
    return (
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav('/my-drivers')} className="mb-4">
          Back to drivers
        </Button>

        <Card padding="lg" className="text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-50 text-accent-green flex items-center justify-center mx-auto ring-4 ring-green-100">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <p className="text-ink font-bold text-lg">Account Created!</p>
            <p className="text-ink-muted text-sm mt-1">
              <span className="text-ink font-medium">{done.fullName}</span> registered successfully.
            </p>
            <p className="text-ink-faint text-xs mt-0.5">+91 {done.phone}</p>
          </div>

          <Alert tone="info">
            Phone OTP verification happens when driver signs in to the app for the first time. KYC can start now.
          </Alert>

          <div className="bg-surface-soft rounded-xl border border-line p-4 text-left space-y-2.5">
            <p className="text-ink-muted text-xs font-medium uppercase tracking-wider mb-1">Onboarding Steps</p>
            {[
              'Upload Aadhaar (front + back)',
              'Upload PAN Card',
              'Upload Driving Licence',
              'Upload Vehicle RC',
              'Take Selfie / Photo',
              'Click "Verify" to run KYC',
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-ink text-xs">{s}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Button className="w-full" size="lg" onClick={() => nav(`/my-drivers/${done.userId}`)}>
              Start KYC → Upload Documents
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => nav('/my-drivers')}>
              Back to drivers
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav('/my-drivers')} className="mb-4">
        Back to drivers
      </Button>

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 className="text-ink font-semibold text-base">Register New Driver</h2>
            <p className="text-ink-muted text-xs mt-1 leading-relaxed">
              Account is created immediately — no OTP needed from ops side.
            </p>
          </div>

          <Input
            label="Full Name *"
            icon={User}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Akash Kumar Gupta"
          />

          <Input
            label="Phone Number *"
            icon={Phone}
            type="tel"
            maxLength={10}
            inputMode="numeric"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="9XXXXXXXXX"
            hint="Driver will verify this when they sign in to the app for the first time"
          />

          <Input
            label="Email (optional)"
            icon={Mail}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="driver@example.com"
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" loading={loading} size="lg" className="w-full">
            {loading ? 'Registering…' : 'Register Driver →'}
          </Button>
        </form>
      </Card>

      <Card padding="md" className="mt-4">
        <p className="text-ink-muted text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Info size={12} /> What happens next?
        </p>
        <div className="space-y-1.5 text-xs text-ink-muted leading-relaxed">
          <p>• Driver account created instantly with <span className="text-ink">is_verified = false</span></p>
          <p>• KYC documents can be uploaded immediately after registration</p>
          <p>• Driver verifies phone when they <span className="text-ink">sign in to the app</span> for the first time</p>
          <p>• KYC data persists — no re-upload needed after phone verification</p>
        </div>
      </Card>
    </div>
  );
}
