import React, { useState } from 'react';
import { User, Phone, Mail } from 'lucide-react';
import { updateDriverProfile } from '../../api/opsApi.js';
import { Modal, Button, Input, Alert } from '../ui';

export default function EditProfileModal({ userId, initial = {}, onDone, onClose }) {
  const [fullName, setFullName] = useState(initial.full_name || initial.fullName || '');
  const [phone,    setPhone]    = useState(initial.phone_number || initial.phone || '');
  const [email,    setEmail]    = useState(initial.email || '');
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const body = {};
    const cleanName  = fullName.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanEmail = email.trim();

    if (cleanName  && cleanName  !== (initial.full_name || initial.fullName)) body.fullName = cleanName;
    if (cleanPhone && cleanPhone !== (initial.phone_number || initial.phone)) {
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) return setErr('Enter valid 10-digit Indian mobile');
      body.phone = cleanPhone;
    }
    if (cleanEmail !== (initial.email || '')) body.email = cleanEmail || undefined;

    if (!Object.keys(body).length) return setErr('Nothing to update');

    setLoading(true);
    try {
      await updateDriverProfile(userId, body);
      onDone?.();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Update failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Driver Profile"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={submit} loading={loading}>Save changes</Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="Full Name"
          icon={User}
          value={fullName}
          onChange={e => setFullName(e.target.value)}
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
        />
        <Input
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {err && <Alert tone="danger">{err}</Alert>}
      </form>
    </Modal>
  );
}
