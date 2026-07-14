import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, Pencil } from 'lucide-react';
import DriverWorkspace from '../../components/driver/DriverWorkspace.jsx';
import OtpViewerModal from '../../components/driver/OtpViewerModal.jsx';
import EditProfileModal from '../../components/driver/EditProfileModal.jsx';
import { getDriverKycDetail } from '../../api/opsApi.js';

// Toolbar rendered inside DriverWorkspace header.
function DetailToolbar({ userId, onOtp, onEdit }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onEdit}
        title="Edit profile"
        className="p-1.5 rounded-lg bg-surface-alt border border-line text-ink-muted hover:text-ink hover:border-brand-500 transition"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={onOtp}
        title="View active OTP"
        className="p-1.5 rounded-lg bg-brand-100 border border-brand-400 text-brand-800 hover:bg-brand-200 transition"
      >
        <KeyRound size={13} />
      </button>
    </div>
  );
}

export default function DetailPage() {
  const { userId } = useParams();
  const [otpOpen,  setOtpOpen]  = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // We need driver data for OTP/edit modals — DriverWorkspace loads it internally.
  // Simpler: attach a small state adapter by passing a wrapper fetchDetail.
  const [driverBrief, setDriverBrief] = useState({});
  const fetchDetail = async (uid) => {
    const res = await getDriverKycDetail(uid);
    const raw = res.data?.data;
    if (raw?.user) {
      setDriverBrief({
        full_name: raw.user.fullName,
        phone:     raw.user.phone,
        email:     raw.user.email,
      });
    }
    return res;
  };

  return (
    <>
      <DriverWorkspace
        key={reloadKey}
        fetchDetail={fetchDetail}
        backTo="/all-drivers"
        toolbar={
          <DetailToolbar
            userId={userId}
            onOtp={() => setOtpOpen(true)}
            onEdit={() => setEditOpen(true)}
          />
        }
      />

      {otpOpen && (
        <OtpViewerModal
          userId={userId}
          driverName={driverBrief.full_name}
          driverPhone={driverBrief.phone}
          onClose={() => setOtpOpen(false)}
        />
      )}

      {editOpen && (
        <EditProfileModal
          userId={userId}
          initial={driverBrief}
          onDone={() => { setEditOpen(false); setReloadKey(k => k + 1); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
