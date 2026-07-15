import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, Pencil } from 'lucide-react';
import DriverWorkspace from '../../components/driver/DriverWorkspace.jsx';
import OtpViewerModal from '../../components/driver/OtpViewerModal.jsx';
import EditProfileModal from '../../components/driver/EditProfileModal.jsx';
import { getDriverKycDetail } from '../../api/opsApi.js';

function DetailToolbar({ onOtp, onEdit }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onEdit}
        title="Edit profile"
        className="p-2 rounded-lg bg-white/10 border border-white/20 text-brand-400 hover:bg-white/20 hover:text-white transition"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={onOtp}
        title="View active OTP"
        className="p-2 rounded-lg bg-brand-500 text-accent-navy hover:bg-brand-400 transition"
      >
        <KeyRound size={14} />
      </button>
    </div>
  );
}

export default function DetailPage() {
  const { userId } = useParams();
  const [otpOpen,   setOtpOpen]   = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Memoized so DriverWorkspace's useCallback deps stay stable
  const fetchDetail = useCallback((uid) => getDriverKycDetail(uid), []);

  return (
    <>
      <DriverWorkspace
        key={reloadKey}
        fetchDetail={fetchDetail}
        backTo="/all-drivers"
        toolbar={
          <DetailToolbar
            onOtp={() => setOtpOpen(true)}
            onEdit={() => setEditOpen(true)}
          />
        }
      />

      {otpOpen && (
        <OtpViewerModal
          userId={userId}
          onClose={() => setOtpOpen(false)}
        />
      )}

      {editOpen && (
        <EditProfileModal
          userId={userId}
          onDone={() => { setEditOpen(false); setReloadKey(k => k + 1); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
