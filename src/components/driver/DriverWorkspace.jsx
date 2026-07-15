import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, Play, RefreshCw, CheckCircle2,
  AlertTriangle, Flame, Sparkles, Phone,
} from 'lucide-react';
import {
  getStagedDocuments, stageDocument, removeStagedDocument,
  triggerBatchVerification, getBatchStatus, retryDeadJob,
  approveDocument, getVehicleMaster,
} from '../../api/opsApi.js';
import { compressImage } from '../../utils/compressImage.js';
import { Badge, Card, Spinner, Alert, Button } from '../ui';
import DocUploadRow from './DocUploadRow.jsx';
import BatchJobRow from './BatchJobRow.jsx';
import BankSection from './BankSection.jsx';
import RejectModal from './RejectModal.jsx';
import PreCheckReport from './PreCheckReport.jsx';
import { DOC_TYPES, OVERALL_TONE } from './constants.js';

/**
 * Shared driver KYC workspace.
 * Props:
 *   fetchDetail(userId) — API function returning driver detail
 *   backTo             — path to go back to on Header back button
 *   toolbar            — optional React node rendered next to header (extra actions)
 */
export default function DriverWorkspace({ fetchDetail, backTo = '/my-drivers', toolbar }) {
  const { userId, batchId: urlBatchId } = useParams();
  const nav = useNavigate();

  const [driver,        setDriver]        = useState(null);
  const [staged,        setStaged]        = useState([]);
  const [batch,         setBatch]         = useState(null);
  const [vehicleMaster, setVehicleMaster] = useState(null);
  const [vmError,       setVmError]       = useState('');
  const [uploading,     setUploading]     = useState(null);
  const [removing,      setRemoving]      = useState(null);
  const [triggering,    setTriggering]    = useState(false);
  const [approving,     setApproving]     = useState(null);
  const [rejectModal,   setRejectModal]   = useState(null);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [pollTimedOut,  setPTO]           = useState(false);

  const pollRef   = useRef(null);
  const pollStart = useRef(null);

  const batchStatus   = batch?.status;
  const isBatchDone   = ['completed', 'partial', 'failed'].includes(batchStatus);
  const phase         = (urlBatchId || batch) ? (isBatchDone ? 'complete' : 'polling') : 'upload';
  const activeBatchId = batch?.batchId || urlBatchId;

  const allDocs   = driver?.documents || [];
  const docMap    = Object.fromEntries(allDocs.map(d => [d.document_type, d]));
  const stagedMap = Object.fromEntries(staged.map(d => [d.document_type, d]));
  const jobMap    = Object.fromEntries((batch?.jobs || []).map(j => [j.documentType, j]));

  // Normalize response — supports both /kyc/admin/* (snake_case, nested `driver`)
  // and /ops/me/* (camelCase, flat).
  const normalize = (raw) => {
    if (!raw) return null;

    // /kyc/admin/drivers/:userId → { driver: {...}, documents: [...] } (snake_case)
    if (raw.driver) {
      const d = raw.driver;
      const documents = (raw.documents || []).map(doc => ({
        ...doc,
        document_type:    doc.document_type || doc.documentType,
        file_url:         doc.file_url      || doc.fileUrl,
        back_file_url:    doc.back_file_url || doc.backFileUrl,
        extracted_data:   doc.extracted_data|| doc.extractedData,
        rejection_reason: doc.rejection_reason || doc.rejectionReason,
        confidence_score: doc.confidence_score || doc.confidenceScore,
      }));
      const submitted = d.submitted_docs_count ?? 0;
      const verified  = d.verified_docs_count  ?? 0;
      const pct = submitted > 0 ? Math.round((verified / submitted) * 100) : 0;
      return {
        userId:             d.id,
        goId:               d.go_id || d.goId,
        full_name:          d.full_name || d.fullName,
        phone_number:       d.phone_number || d.phoneNumber || d.phone,
        email:              d.email,
        documents,
        kycStatus:          { overall_status: d.overall_status || d.overallStatus },
        completionPct:      pct,
        verifiedDocsCount:  verified,
        submittedDocsCount: submitted,
        lastActivityAt:     d.last_activity_at || d.lastActivityAt,
        preCheckReport:     d.pre_check_report || d.preCheckReport,
        nextAction:         null,
      };
    }

    // Older shape with `user` wrapper (backward compat)
    if (raw.user) {
      const u = raw.user;
      const k = raw.kycStatus || {};
      const documents = (raw.documents || []).map(doc => ({
        ...doc,
        document_type:    doc.type || doc.document_type,
        file_url:         doc.fileUrl || doc.file_url,
        back_file_url:    doc.backFileUrl || doc.back_file_url,
        extracted_data:   doc.extractedData || doc.extracted_data,
        rejection_reason: doc.rejectionReason || doc.rejection_reason,
        confidence_score: doc.confidenceScore || doc.confidence_score,
      }));
      return {
        userId:       u.id,
        goId:         u.goId || u.go_id,
        full_name:    u.fullName || u.full_name,
        phone_number: u.phone || u.phone_number,
        email:        u.email,
        documents,
        kycStatus:    { overall_status: k.overallStatus || k.overall_status },
      };
    }

    // /ops/me/* flat camelCase
    const documents = (raw.documents || []).map(doc => ({
      ...doc,
      document_type:    doc.documentType || doc.document_type,
      file_url:         doc.fileUrl || doc.file_url,
      back_file_url:    doc.backFileUrl || doc.back_file_url,
      extracted_data:   doc.extractedData || doc.extracted_data,
      rejection_reason: doc.rejectionReason || doc.rejection_reason,
      confidence_score: doc.confidenceScore || doc.confidence_score,
    }));
    return {
      ...raw,
      full_name:      raw.fullName || raw.full_name,
      phone_number:   raw.phoneNumber || raw.phone_number || raw.phone,
      documents,
      kycStatus:      { overall_status: raw.overallStatus || raw.kycStatus?.overallStatus },
      completionPct:  raw.completionPct,
      nextAction:     raw.nextAction,
    };
  };

  const loadDriver = useCallback(async (skipStaged = false) => {
    try {
      const reqs = [fetchDetail(userId)];
      if (!skipStaged) reqs.push(getStagedDocuments(userId));
      const [dRes, sRes] = await Promise.all(reqs);
      const norm = normalize(dRes.data?.data);
      setDriver(norm);
      if (!skipStaged) setStaged(sRes?.data?.data?.documents || []);
    } catch { setError('Failed to load driver info'); }
    finally { setLoading(false); }
  }, [userId, fetchDetail]);

  useEffect(() => { loadDriver(); }, [loadDriver]);

  useEffect(() => {
    let cancelled = false;
    getVehicleMaster()
      .then(res => {
        if (cancelled) return;
        const list = (res.data?.data || []).filter(v => v.is_active);
        list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setVehicleMaster({
          two_wheel:   list.filter(v => v.vehicle_class === 'two_wheel'),
          three_wheel: list.filter(v => v.vehicle_class === 'three_wheel'),
          car_side:    list.filter(v => v.vehicle_class === 'car_side'),
        });
        setVmError('');
      })
      .catch(err => {
        if (cancelled) return;
        setVmError(String(err.response?.status || err.message || 'unknown'));
      });
    return () => { cancelled = true; };
  }, []);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const startPoll = useCallback((bid) => {
    stopPoll();
    pollStart.current = Date.now();
    const MAX = 3 * 60 * 1000;
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStart.current > MAX) { stopPoll(); setPTO(true); return; }
      try {
        const res = await getBatchStatus(userId, bid);
        const data = res.data?.data;
        setBatch(data);
        if (['completed', 'partial', 'failed'].includes(data?.status)) { stopPoll(); loadDriver(true); }
      } catch { stopPoll(); setError('Lost connection to server — click Refresh to resume.'); }
    }, 2000);
  }, [userId, loadDriver]);

  useEffect(() => {
    if (!urlBatchId) return;
    getBatchStatus(userId, urlBatchId)
      .then(res => {
        const data = res.data?.data;
        setBatch(data);
        if (!['completed', 'partial', 'failed'].includes(data?.status)) startPoll(urlBatchId);
        else loadDriver(true);
      })
      .catch(() => setError('Failed to resume batch — try refreshing'));
    return stopPoll;
  }, []); // eslint-disable-line

  const handleUpload = async (docType, frontFile, backFile, docNumber = '', vehicleCategories = null) => {
    setUploading(docType); setError('');
    try {
      const [front, back] = await Promise.all([
        compressImage(frontFile),
        backFile ? compressImage(backFile) : Promise.resolve(null),
      ]);
      const fd = new FormData();
      fd.append('document_type', docType);
      if (docNumber) fd.append('document_number', docNumber);
      if (vehicleCategories?.length) fd.append('vehicle_categories', JSON.stringify(vehicleCategories));
      fd.append('file', front);
      if (back) fd.append('file_back', back);
      await stageDocument(userId, fd);
      const sRes = await getStagedDocuments(userId);
      setStaged(sRes.data?.data?.documents || []);
      return true;
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || 'Upload failed';
      if (status === 413) setError('File too large for upload. Try a smaller image (or screenshot of the doc).');
      else if (status === 409) setError(`${msg} — Reject the existing document first to re-verify.`);
      else setError(msg);
      return false;
    } finally { setUploading(null); }
  };

  const handleRemove = async (docId) => {
    setRemoving(docId); setError('');
    try {
      await removeStagedDocument(userId, docId);
      setStaged(s => s.filter(d => d.id !== docId));
    } catch (err) { setError(err.response?.data?.message || 'Remove failed'); }
    finally { setRemoving(null); }
  };

  const handleVerify = async () => {
    setTriggering(true); setError('');
    try {
      const res = await triggerBatchVerification(userId);
      const data = res.data?.data;
      setStaged([]);
      setBatch({ ...data, status: 'queued' });
      nav(`${backTo}/${userId}/batch/${data.batchId}`, { replace: true });
      startPoll(data.batchId);
    } catch (err) { setError(err.response?.data?.message || 'Verification trigger failed'); }
    finally { setTriggering(false); }
  };

  const handleRetry = async (jobId) => {
    try { await retryDeadJob(jobId); setPTO(false); startPoll(activeBatchId); }
    catch (err) { setError(err.response?.data?.message || 'Retry failed'); }
  };

  const handleApprove = async (docId) => {
    setApproving(docId);
    try {
      await approveDocument(docId, 'Manually approved by ops agent');
      const res = await getBatchStatus(userId, activeBatchId);
      setBatch(res.data?.data);
      loadDriver(true);
    } catch (err) { setError(err.response?.data?.message || 'Approve failed'); }
    finally { setApproving(null); }
  };

  const handleNewBatch = () => {
    stopPoll(); setBatch(null); setPTO(false);
    nav(`${backTo}/${userId}`, { replace: true });
    loadDriver();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  const kyc           = driver?.kycStatus || {};
  const tone          = OVERALL_TONE[kyc.overall_status] || 'neutral';
  const totalJobs     = batch?.totalJobs      ?? 0;
  const succeededJobs = batch?.succeededJobs  ?? 0;
  const failedJobs    = batch?.failedJobs     ?? 0;
  const doneJobs      = succeededJobs + failedJobs;
  const progress      = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

  const verifiedCount = allDocs.filter(d => ['auto_verified','approved','verified'].includes(d?.status)).length;
  const totalDocs     = 6;
  const overallPct    = driver?.completionPct != null
    ? driver.completionPct
    : Math.round((verifiedCount / totalDocs) * 100);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-3 sm:space-y-4">
      {/* Back link */}
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav(backTo)}>
        Back to list
      </Button>

      {/* Hero card — driver identity + KYC progress */}
      <div className="rounded-2xl bg-accent-navy text-white overflow-hidden border border-brand-500/40 shadow-pop">
        <div className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-brand-600 text-accent-navy font-bold text-xl flex items-center justify-center shrink-0 ring-2 ring-brand-400">
            {(driver?.full_name || 'D')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-base sm:text-lg truncate">{driver?.full_name || 'Driver'}</p>
              <Badge tone={tone}>{kyc.overall_status?.replace(/_/g, ' ') || 'not started'}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] sm:text-xs text-brand-400/90">
              {driver?.phone_number && <span className="inline-flex items-center gap-1"><Phone size={11} /> {driver.phone_number}</span>}
              {driver?.email && <span className="truncate max-w-[220px]">{driver.email}</span>}
              {driver?.goId && <span className="font-mono">{driver.goId}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {driver?.phone_number && (
              <a
                href={`tel:${driver.phone_number}`}
                title="Call driver"
                className="p-2 rounded-lg bg-accent-green/20 border border-accent-green/40 text-accent-green hover:bg-accent-green/30 transition"
              >
                <Phone size={14} />
              </a>
            )}
            {toolbar}
          </div>
        </div>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <div className="flex items-center justify-between text-[11px] text-brand-400/90 mb-1.5">
            <span>KYC Progress</span>
            <span className="font-semibold text-white">{verifiedCount}/{totalDocs} verified · {overallPct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
          </div>
        </div>
      </div>

      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      {/* Next action banner */}
      {driver?.nextAction && phase === 'upload' && (
        <Alert tone="warning" className="!items-center">
          <div className="flex items-center gap-2">
            <Sparkles size={13} /> <span>{driver.nextAction}</span>
          </div>
        </Alert>
      )}

      {/* Pre-check cross-verification report (admin scope) */}
      {driver?.preCheckReport && phase === 'upload' && (
        <PreCheckReport report={driver.preCheckReport} />
      )}

      {/* Upload phase */}
      {phase === 'upload' && (
        <div className="rounded-xl border border-line shadow-card overflow-hidden bg-surface-soft">
          <div className="px-4 sm:px-5 py-3 bg-accent-navy text-white flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                Documents
              </p>
              <p className="text-brand-400/90 text-[11px] mt-0.5">
                {staged.length > 0 ? `${staged.length} staged — tap Verify to run KYC` : 'Upload documents one by one'}
              </p>
            </div>
            {staged.length > 0 && (() => {
              const allCovered = DOC_TYPES.every(dt =>
                stagedMap[dt] || ['auto_verified', 'approved'].includes(docMap[dt]?.status)
              );
              const verifiedDocs = Object.values(docMap).filter(d => ['auto_verified', 'approved'].includes(d?.status)).length;
              return (
                <button
                  onClick={handleVerify}
                  disabled={!allCovered || triggering}
                  title={!allCovered ? 'Upload all documents first' : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 text-accent-navy text-xs font-bold hover:bg-brand-400 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {triggering ? <Spinner size={12} /> : <Play size={12} />}
                  Verify ({staged.length}/{DOC_TYPES.length - verifiedDocs})
                </button>
              );
            })()}
          </div>
          <div className="divide-y divide-line">
            {DOC_TYPES.map(dt => (
              <DocUploadRow
                key={dt}
                docType={dt}
                existingDoc={docMap[dt]}
                stagedDoc={stagedMap[dt]}
                vehicleMaster={vehicleMaster}
                vmError={vmError}
                uploading={uploading}
                removing={removing}
                onUpload={handleUpload}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'upload' && (
        <BankSection userId={userId} bankDoc={docMap.BANK_ACCOUNT} onVerified={() => loadDriver(true)} />
      )}

      {/* Polling / complete */}
      {(phase === 'polling' || phase === 'complete') && (
        <>
          <Card padding="md">
            <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
              <div className="min-w-0">
                <p className="text-ink font-semibold text-sm leading-tight">
                  {phase === 'polling'
                    ? `Verifying ${totalJobs} document${totalJobs !== 1 ? 's' : ''}...`
                    : batchStatus === 'completed' ? 'All documents verified!'
                    : batchStatus === 'partial'   ? 'Some documents need attention'
                    : batchStatus === 'failed'    ? 'Verification failed'
                    : 'Batch complete'}
                </p>
                <p className="text-ink-faint text-[11px] mt-0.5 truncate">
                  Batch #{(activeBatchId || '').slice(0, 8)}
                  {batch?.completedAt && ` · ${new Date(batch.completedAt).toLocaleTimeString()}`}
                </p>
              </div>
              <div className="shrink-0">
                {phase === 'polling' && !pollTimedOut && (
                  <span className="flex items-center gap-1 text-blue-700 text-xs"><Spinner size={12} /> Live</span>
                )}
                {batchStatus === 'completed' && <CheckCircle2 size={20} className="text-accent-green" />}
                {batchStatus === 'partial'   && <AlertTriangle size={20} className="text-amber-600" />}
                {batchStatus === 'failed'    && <Flame size={20} className="text-orange-600" />}
              </div>
            </div>

            <div className="h-2 bg-surface-alt rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: batchStatus === 'failed' ? '#dc2626' : '#a97c2f',
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-ink-muted">
              <span>{doneJobs}/{totalJobs} done</span>
              <span>{succeededJobs} ok · {failedJobs} failed</span>
            </div>

            {pollTimedOut && (
              <div className="mt-3">
                <Alert tone="warning">
                  Still running after 3 min. Background reconciler (every 2 min) will handle stuck jobs. Use Refresh below.
                </Alert>
              </div>
            )}
          </Card>

          <div className="rounded-xl border border-line shadow-card overflow-hidden bg-surface-soft">
            <p className="px-4 sm:px-5 py-2.5 bg-accent-navy text-brand-400 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              Per-Document Results
            </p>
            <div className="divide-y divide-line">
              {DOC_TYPES.map(dt => (
                <BatchJobRow
                  key={dt}
                  docType={dt}
                  job={jobMap[dt]}
                  existingDoc={docMap[dt]}
                  approving={approving}
                  onApprove={handleApprove}
                  onReject={(docId, type) => setRejectModal({ docId, docType: type })}
                  onRetry={handleRetry}
                  onReupload={handleNewBatch}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {pollTimedOut && (
              <Button variant="outline" className="flex-1" icon={RefreshCw}
                onClick={() => { setPTO(false); startPoll(activeBatchId); }}>
                Refresh
              </Button>
            )}
            {phase === 'complete' && (
              <Button variant="outline" className="flex-1" icon={Upload} onClick={handleNewBatch}>
                New Batch
              </Button>
            )}
          </div>
        </>
      )}

      {rejectModal && (
        <RejectModal
          docId={rejectModal.docId}
          docType={rejectModal.docType}
          onDone={async () => {
            setRejectModal(null);
            try { const res = await getBatchStatus(userId, activeBatchId); setBatch(res.data?.data); } catch {}
            loadDriver(true);
          }}
          onClose={() => setRejectModal(null)}
        />
      )}
    </div>
  );
}
