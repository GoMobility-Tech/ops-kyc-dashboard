import React, { useState, useEffect } from 'react';
import { User, Phone, Mail } from 'lucide-react';
import { updateDriverProfile, getDriverKycDetail } from '../../api/opsApi.js';
import { Modal, Button, Input, Alert, Spinner } from '../ui';

// Normalize any driver detail response into a flat brief.
function toBrief(raw) {
  const u = raw?.driver || raw?.user || raw || {};
  return {
    full_name: u.full_name || u.fullName || '',
    phone:     String(u.phone_number || u.phone || u.phoneNumber || '').replace(/^\+?91/, ''),
    email:     u.email || '',
    go_id:     u.go_id  || u.goId || '',
  };
}

export default function EditProfileModal({ userId, initial, onDone, onClose }) {
  // Always trust the modal-owned fetch as the source of truth.
  const [brief,   setBrief]   = useState(initial ? toBrief({ user: initial }) : null);
  const [loading, setLoading] = useState(!initial);

  const [fullName, setFullName] = useState(brief?.full_name || '');
  const [phone,    setPhone]    = useState(brief?.phone     || '');
  const [email,    setEmail]    = useState(brief?.email     || '');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    let cancelled = false;
    getDriverKycDetail(userId)
      .then(res => {
        if (cancelled) return;
        const b = toBrief(res.data?.data);
        setBrief(b);
        setFullName(b.full_name);
        setPhone(b.phone);
        setEmail(b.email);
      })
      .catch(() => { /* keep whatever initial we had */ })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [userId]);

  const submit = async (e) => {
    e?.preventDefault();
    setErr('');
    const body = {};
    const cleanName  = fullName.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanEmail = email.trim();

    if (cleanName  && cleanName  !== brief?.full_name) body.fullName = cleanName;
    if (cleanPhone && cleanPhone !== brief?.phone) {
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) return setErr('Enter valid 10-digit Indian mobile');
      body.phone = cleanPhone;
    }
    if (cleanEmail !== (brief?.email || '')) body.email = cleanEmail || undefined;

    if (!Object.keys(body).length) return setErr('Nothing to update');

    setSaving(true);
    try {
      await updateDriverProfile(userId, body);
      onDone?.();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Driver Profile"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={submit} loading={saving} disabled={loading}>Save changes</Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-ink-muted text-xs">
          <Spinner size={14} /> Loading current details…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-lg border border-brand-400 bg-gradient-to-br from-brand-100 to-brand-200 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-brand-800 font-bold flex items-center gap-1.5">
              Current on file
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-brand-800/70 text-[10px] uppercase tracking-wider">Name</p>
                <p className="text-accent-navy font-semibold truncate">{brief?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-brand-800/70 text-[10px] uppercase tracking-wider">Phone</p>
                <p className="text-accent-navy font-semibold font-mono truncate">{brief?.phone ? `+91 ${brief.phone}` : '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-brand-800/70 text-[10px] uppercase tracking-wider">Email</p>
                <p className="text-accent-navy font-semibold truncate">{brief?.email || '—'}</p>
              </div>
              {brief?.go_id && (
                <div className="col-span-2">
                  <p className="text-brand-800/70 text-[10px] uppercase tracking-wider">GO ID</p>
                  <p className="text-accent-navy font-mono text-[11px] truncate">{brief.go_id}</p>
                </div>
              )}
            </div>
          </div>

          <Input
            label="Full Name"
            icon={User}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Driver's full name"
          />
          <Input
            label="Phone"
            icon={Phone}
            type="tel"
            maxLength={10}
            inputMode="numeric"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            hint="Changing phone requires driver to re-verify on next sign-in"
            placeholder="10-digit mobile"
          />
          <Input
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="driver@example.com"
          />
          {err && <Alert tone="danger">{err}</Alert>}
        </form>
      )}
    </Modal>
  );
}
