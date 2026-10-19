// pages/Recruitment/OfferPlacementTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Offer Management / Joining Management — two always-editable cards, matching
// the mockup's vOffer() layout exactly (field names, the Pending -> Released
// -> Accepted/Declined offer lifecycle, and the Joining tracker below it).
// Reaching this page at all already means the candidate was selected (see
// RoundPipelineTab's "Select Candidate & Email" / "Select Without Management
// Round", which now sets finalDecision.decision = 'Offer Made' directly) —
// no separate manual "mark as Offer Made" step needed here.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Loader2, FileText, Upload, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditField, EditSelect } from './ApplicantFieldComponents';
import letterheadLogo from '../../assets/BriskOliveLetterheadLogo.png';
import {
  ApplicantRecord, Joining, API_BASE,
  OFFER_STATUS_COLORS,
  JOINING_STATUS_OPTIONS, JOINING_STATUS_COLORS, DOCS_STATUS_OPTIONS, BGV_STATUS_OPTIONS,
} from './applicantTypes';

const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const toDateInput = (v?: string | null) => v ? String(v).slice(0, 10) : '';

// Same company letterhead used for every other generated letter (Offer,
// Appointment, Confirmation, Salary Revision — see LetterTemplate.tsx on the
// employee Profile page), so a candidate's generated Offer Letter looks
// identical to the one an employee sees later, just rendered here from the
// ApplicantRecord instead of an onboarded Employee record.
const LETTERHEAD_FONT: CSSProperties = { fontFamily: '"Times New Roman", Times, serif', fontSize: '12px' };
const NOWRAP: CSSProperties = { whiteSpace: 'nowrap' };

const LetterHeader = () => (
  <div className="pb-3 mb-4 border-b-2 border-[#622423] print:mb-3" style={LETTERHEAD_FONT}>
    <img src={letterheadLogo} alt="Brisk Olive" className="h-10" />
  </div>
);

const LetterFooter = () => (
  <table className="mt-8 pt-2 border-t-2 border-[#622423] text-gray-600 w-full" style={{ ...LETTERHEAD_FONT, borderCollapse: 'separate', tableLayout: 'fixed' }}>
    <tbody>
      <tr>
        <td className="w-1/2 pt-2 align-top" style={NOWRAP}>Brisk Olive Business Solutions Pvt Ltd</td>
        <td className="w-1/2 pt-2 align-top" style={NOWRAP}>Website:&nbsp;&nbsp;briskolive.com</td>
      </tr>
      <tr>
        <td className="align-top" style={NOWRAP}>Address:&nbsp;G‑203, Sector 63, Noida - 201301,U.P., India</td>
        <td className="align-top" style={NOWRAP}>CIN:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;U74999UP2019PTC120473</td>
      </tr>
      <tr>
        <td className="align-top" style={NOWRAP}>Mobile:&nbsp;&nbsp;8787240832</td>
        <td className="align-top" style={NOWRAP}>GSTIN:&nbsp;&nbsp;&nbsp;09AAICB6090J1ZA</td>
      </tr>
      <tr>
        <td className="align-top" style={NOWRAP}>Email:&nbsp;&nbsp;&nbsp;&nbsp;info@briskolive.com</td>
        <td></td>
      </tr>
    </tbody>
  </table>
);

const OfferPlacementTab = ({
  record,
  onUpdate,
  canSeeFinancials = true,
  department,
}: {
  record: ApplicantRecord;
  onUpdate: (updated: ApplicantRecord) => void;
  canSeeFinancials?: boolean;
  department?: string;
}) => {
  const fd = record.finalDecision || ({} as ApplicantRecord['finalDecision']);
  const offerStatus = fd.offerStatus || 'Offer Pending';
  const ended = offerStatus === 'Offer Declined';

  const [offerDraft, setOfferDraft] = useState({
    offeredCTC: fd.offeredCTC || '',
    joiningDate: toDateInput(fd.joiningDate),
    offerRemarks: fd.offerRemarks || '',
  });
  const [savingOffer, setSavingOffer] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [uploadingLetter, setUploadingLetter] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [acceptedDateInput, setAcceptedDateInput] = useState(new Date().toISOString().slice(0, 10));

  const [joiningDraft, setJoiningDraft] = useState<Joining>(record.joining ?? {} as Joining);
  const [savingJoining, setSavingJoining] = useState(false);

  useEffect(() => {
    setOfferDraft({
      offeredCTC: fd.offeredCTC || '',
      joiningDate: toDateInput(fd.joiningDate),
      offerRemarks: fd.offerRemarks || '',
    });
    setJoiningDraft(record.joining ?? {} as Joining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const offerLetter = fd.offerLetter;

  const handleSaveOffer = async () => {
    setSavingOffer(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/final-decision`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(offerDraft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save');
      onUpdate(json.data);
      toast.success('Offer details saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingOffer(false);
    }
  };

  const handleGenerateLetter = async () => {
    setGeneratingLetter(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer-letter/generate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to generate offer letter');
      onUpdate({ ...record, finalDecision: { ...record.finalDecision, offerLetter: json.data.offerLetter } });
      toast.success('Offer letter generated from template');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate offer letter');
    } finally {
      setGeneratingLetter(false);
    }
  };

  const handleUploadLetter = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLetter(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer-letter/upload`, { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to upload offer letter');
      onUpdate({ ...record, finalDecision: { ...record.finalDecision, offerLetter: json.data.offerLetter } });
      toast.success(`Offer letter uploaded: ${file.name}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload offer letter');
    } finally {
      setUploadingLetter(false);
    }
  };

  const handleReleaseOffer = async () => {
    setReleasing(true);
    try {
      // Save whatever's in the draft first, same as the mockup's releaseOffer
      // reading the live inputs before sending.
      const saveRes = await fetch(`${API_BASE}/applicant-records/${record._id}/final-decision`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(offerDraft),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok || !saveJson.success) throw new Error(saveJson.message || 'Failed to save offer details');

      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer/release`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to release offer');
      onUpdate(json.data);
      toast.success('Offer released.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to release offer');
    } finally {
      setReleasing(false);
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer/send-reminder`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send reminder');
      onUpdate(json.data);
      toast.success('Reminder sent.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!acceptedDateInput) { toast.error('Select the offer accepted date.'); return; }
    setAccepting(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptedDate: acceptedDateInput }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to mark offer accepted');
      onUpdate(json.data);
      toast.success('Offer marked accepted. Joining date confirmed.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark offer accepted');
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!window.confirm(`Confirm that ${record.full_name} declined the offer? The profile is kept in the candidate database.`)) return;
    setDeclining(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer/decline`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to mark offer declined');
      onUpdate(json.data);
      toast.success('Offer marked declined.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark offer declined');
    } finally {
      setDeclining(false);
    }
  };

  const handleJoiningChange = (field: string, value: string) =>
    setJoiningDraft((p) => ({ ...p, [field]: value }));

  const handleSaveJoining = async () => {
    if (joiningDraft.status === 'Joined') {
      if (!joiningDraft.actualDate) { toast.error('Enter the actual joining date.'); return; }
      if (joiningDraft.actualDate > new Date().toISOString().slice(0, 10)) { toast.error('Actual joining date cannot be in the future.'); return; }
    }
    setSavingJoining(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/joining`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(joiningDraft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update joining details');
      onUpdate(json.data);
      toast.success('Joining details updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update joining details');
    } finally {
      setSavingJoining(false);
    }
  };

  const accepted = offerStatus === 'Offer Accepted';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Offer Management ── */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-800">Offer Management</p>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Candidate" value={record.full_name} />
          <Field label="Position" value={record.designation} />
          <Field label="Department" value={department} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Offer Status</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${OFFER_STATUS_COLORS[offerStatus]}`}>{offerStatus}</span>
          </div>
          <Field label="Offer Release Date" value={fmtDate(fd.offerReleaseDate)} />
          <Field label="Offer Accepted Date" value={fmtDate(fd.offerAcceptedDate)} />
        </div>

        {!ended ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {canSeeFinancials ? (
                <EditField
                  label="Offered CTC" name="offeredCTC"
                  value={offerDraft.offeredCTC}
                  onChange={(_, v) => setOfferDraft((p) => ({ ...p, offeredCTC: v }))}
                  placeholder="e.g. 6 LPA"
                />
              ) : <Field label="Offered CTC" value="Restricted" />}
              <EditField
                label="Expected Joining Date" name="joiningDate" type="date"
                value={offerDraft.joiningDate}
                onChange={(_, v) => setOfferDraft((p) => ({ ...p, joiningDate: v }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Offer Remarks</label>
              <textarea
                value={offerDraft.offerRemarks}
                onChange={(e) => setOfferDraft((p) => ({ ...p, offerRemarks: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a9c56] resize-none"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Offer Letter</p>
              {offerLetter?.source ? (
                <p className="text-sm font-bold text-gray-800">{offerLetter.fileName || 'Offer letter generated'}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No offer letter prepared</p>
              )}
              {offerStatus === 'Offer Pending' && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">
                    {uploadingLetter ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Upload
                    <input type="file" className="hidden" onChange={handleUploadLetter} disabled={uploadingLetter} />
                  </label>
                  <button
                    onClick={handleGenerateLetter}
                    disabled={generatingLetter}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 rounded-lg transition"
                  >
                    {generatingLetter ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    Generate from template
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button onClick={handleSaveOffer} disabled={savingOffer} className="px-4 py-2 text-sm font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 rounded-lg transition">
                {savingOffer ? 'Saving…' : 'Save Details'}
              </button>
              {offerLetter?.source === 'generated' && (
                <button onClick={() => setPreviewOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition">
                  <Eye size={14} /> Preview Offer Letter
                </button>
              )}
              {offerStatus === 'Offer Pending' && (
                <button onClick={handleReleaseOffer} disabled={releasing} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition">
                  {releasing ? 'Releasing…' : 'Release Offer'}
                </button>
              )}
              {offerStatus === 'Offer Released' && (
                <>
                  <button onClick={handleSendReminder} disabled={sendingReminder} className="px-4 py-2 text-sm font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 rounded-lg transition">
                    {sendingReminder ? 'Sending…' : 'Send Offer Reminder'}
                  </button>
                  <input
                    type="date"
                    value={acceptedDateInput}
                    onChange={(e) => setAcceptedDateInput(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button onClick={handleAcceptOffer} disabled={accepting} className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition">
                    {accepting ? 'Saving…' : 'Mark Offer Accepted'}
                  </button>
                  <button onClick={handleDeclineOffer} disabled={declining} className="px-4 py-2 text-sm font-bold text-red-600 border border-red-500 bg-white hover:bg-red-50 disabled:opacity-60 rounded-lg transition">
                    Mark Offer Declined
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">This offer is closed.</p>
        )}
      </div>

      {/* ── Joining Management ── */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-800">Joining Management</p>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Candidate" value={record.full_name} />
          <Field label="Position" value={record.designation} />
          {canSeeFinancials && <Field label="Offered CTC" value={fd.offeredCTC || '—'} />}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overall Status</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${JOINING_STATUS_COLORS[record.joining?.status || ''] || 'bg-gray-100 text-gray-600'}`}>
            {record.joining?.status || 'Not started'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <EditField
            label="Confirmed Joining Date" name="confirmedDate" type="date"
            value={toDateInput(joiningDraft.confirmedDate)}
            onChange={(_, v) => handleJoiningChange('confirmedDate', v)}
          />
          <EditField
            label="Actual Joining Date" name="actualDate" type="date"
            value={toDateInput(joiningDraft.actualDate)}
            onChange={(_, v) => handleJoiningChange('actualDate', v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {accepted ? (
            <EditSelect label="Joining Status" name="status" value={joiningDraft.status || ''} options={JOINING_STATUS_OPTIONS} onChange={(_, v) => handleJoiningChange('status', v)} />
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Joining Status</label>
              <select disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400">
                <option>Offer not yet accepted</option>
              </select>
            </div>
          )}
          <EditSelect label="Joining Documents" name="docsStatus" value={joiningDraft.docsStatus || 'Pending'} options={DOCS_STATUS_OPTIONS} onChange={(_, v) => handleJoiningChange('docsStatus', v)} />
        </div>

        <EditSelect label="Background Verification" name="bgvStatus" value={joiningDraft.bgvStatus || 'Not Applicable'} options={BGV_STATUS_OPTIONS} onChange={(_, v) => handleJoiningChange('bgvStatus', v)} />

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">HR Remarks</label>
          <textarea
            value={joiningDraft.remarks || ''}
            onChange={(e) => handleJoiningChange('remarks', e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a9c56] resize-none"
          />
        </div>

        <button onClick={handleSaveJoining} disabled={savingJoining} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition">
          {savingJoining ? 'Saving…' : 'Update Joining'}
        </button>

        {record.offerLetterSentAt && (
          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
            Offer letter email sent on {fmtDate(record.offerLetterSentAt)}
            {record.documentsUploadFolderLink && (
              <> · <a href={record.documentsUploadFolderLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline">View Documents Folder</a></>
            )}
            <br />{record.uploadedDocuments?.length ?? 0} document{(record.uploadedDocuments?.length ?? 0) === 1 ? '' : 's'} uploaded by candidate so far
          </p>
        )}
      </div>

      {previewOpen && offerLetter?.source === 'generated' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
              <p className="font-bold text-gray-800">Offer Letter Preview</p>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-12 font-[Arial] font-bold leading-relaxed text-[9px]">
              <LetterHeader />

              <div className="text-center mb-8">
                <h2 className="text-[12px] font-bold tracking-wide pb-2">Strictly Personal &amp; Confidential</h2>
              </div>

              <div className="text-left mb-6">
                <p>Date: {fmtDate(new Date().toISOString())}</p>
              </div>

              <div className="mb-6">
                <p>{record.full_name}</p>
              </div>

              <p className="mb-6 text-[12px] font-bold">SUBJECT: OFFER LETTER</p>

              <p className="mb-6">Dear {record.full_name},</p>

              <p className="mb-4">
                We are pleased to offer you the position of <strong>{record.designation || '[Designation]'}</strong>
                {department ? <> in the <strong>{department}</strong> department</> : null} of Brisk Olive Business Solutions Pvt Ltd. Your date of joining shall be by <strong>{fmtDate(fd.joiningDate) !== '—' ? fmtDate(fd.joiningDate) : fmtDate(new Date().toISOString())}</strong>.
              </p>

              <p className="mb-4">
                As agreed, your CTC is <strong>{fd.offeredCTC || '[CTC]'}</strong> per annum. Also enclosed is a breakup of Compensation being offered to you.
              </p>

              <p className="mb-4">
                We request you to sign the duplicate copy of this Offer Letter, and return it to the undersigned, indicating your acceptance of the offer. A formal Appointment Letter shall be issued to you on your joining. In case your signed acceptance is not received within 2 days of issue of this letter, this offer shall automatically lapse. The offer shall also lapse in case you do not report for work on or before the due date.
              </p>

              <p className="mb-4">
                Please Note that this is only an offer letter. Your appointment shall be subject to your clearing the Medical Examination at the Company approved Hospital and satisfactory background check (If Applicable).
              </p>

              <p className="mb-4">
                Prior to beginning work on the first day of employment, you are requested to report to the HR Department, which shall assist you in completing the joining formalities.
              </p>

              <p className="mb-6">
                We are in an exciting phase of expansion and development and we believe that with your knowledge and skills you will be able to make a significant contribution to the success of the Company.
              </p>

              <div className="mt-12 text-left">
                <p>For Brisk Olive Business Solutions Pvt Ltd</p>
                <p className="mt-8">Authorised Signatory</p>
              </div>

              <div className="mt-8">
                <p className="font-bold text-center">Candidate Confirmation</p>
                <p className="mt-4">I hereby accept the offer on the terms and conditions of employment discussed with you.</p>
                <div className="mt-8 space-y-2">
                  <p><strong>Signature:</strong></p>
                  <p><strong>Name of the Candidate:</strong> {record.full_name}</p>
                  <p><strong>Date:</strong></p>
                </div>
              </div>

              <LetterFooter />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferPlacementTab;
