
// pages/Recruitment/OfferPlacementTab.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, Save, CheckSquare, CheckCircle2, Mail, FileText, Upload, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditField, EditSelect } from './ApplicantFieldComponents';
import {
  ApplicantRecord, FinalDecision, Joining, API_BASE,
  DECISION_OPTIONS, DECISION_COLORS,
  JOINING_STATUS_OPTIONS, JOINING_STATUS_COLORS, DOCS_STATUS_OPTIONS, BGV_STATUS_OPTIONS,
} from './applicantTypes';

const OfferPlacementTab = ({
  record,
  onUpdate,
  canSeeFinancials = true,
}: {
  record: ApplicantRecord;
  onUpdate: (updated: ApplicantRecord) => void;
  canSeeFinancials?: boolean;
}) => {
  const [draft,  setDraft]  = useState<FinalDecision>(record.finalDecision ?? {} as FinalDecision);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<'view' | 'edit'>('view');
  const [showSaved, setShowSaved] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [uploadingLetter, setUploadingLetter] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [joiningDraft, setJoiningDraft] = useState<Joining>(record.joining ?? {} as Joining);
  const [joiningEdit, setJoiningEdit] = useState(false);
  const [savingJoining, setSavingJoining] = useState(false);

  useEffect(() => {
    setDraft(record.finalDecision ?? {} as FinalDecision);
    setEditMode('view');
    setJoiningDraft(record.joining ?? {} as Joining);
    setJoiningEdit(false);
  }, [record]);

  const handleChange = (field: string, value: string) =>
    setDraft((p) => ({ ...p, [field]: value }));

  const handleCancel = () => {
    setDraft(record.finalDecision ?? {} as FinalDecision);
    setEditMode('view');
  };

  const handleSave = async () => {
    if (!window.confirm('Save changes to Offer & Placement?')) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/final-decision`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onUpdate(json.data);
      setEditMode('view');
      toast.success('Offer & Placement saved');
      setShowSaved(true);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSendOfferLetter = async () => {
    if (!window.confirm(`Send the Offer Letter email to ${record.email || 'this candidate'}?`)) return;
    setSendingOffer(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/send-offer-letter`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send offer letter');
      onUpdate(json.data);
      toast.success('Offer Letter sent');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send offer letter');
    } finally {
      setSendingOffer(false);
    }
  };

  const handleGenerateLetter = async () => {
    setGeneratingLetter(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/offer-letter/generate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to generate offer letter');
      onUpdate({ ...record, finalDecision: { ...record.finalDecision, offerLetter: json.data.offerLetter } });
      toast.success('Offer letter preview generated');
      setPreviewOpen(true);
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
      toast.success('Offer letter uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload offer letter');
    } finally {
      setUploadingLetter(false);
    }
  };

  const handleJoiningChange = (field: string, value: string) =>
    setJoiningDraft((p) => ({ ...p, [field]: value }));

  const handleSaveJoining = async () => {
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
      setJoiningEdit(false);
      toast.success('Joining details updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update joining details');
    } finally {
      setSavingJoining(false);
    }
  };

  const currentDecision = record.finalDecision?.decision || 'Pending';
  const displayDecision = editMode === 'edit' ? draft.decision || 'Pending' : currentDecision;
  const offerLetter = record.finalDecision?.offerLetter;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
          <CheckSquare size={20} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Current Decision</p>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${DECISION_COLORS[displayDecision]}`}>
              {displayDecision}
            </span>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          {editMode === 'view' && currentDecision === 'Offer Made' && (
            <button
              onClick={handleSendOfferLetter}
              disabled={sendingOffer}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl transition"
            >
              {sendingOffer ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {record.offerLetterSentAt ? 'Resend Offer Letter' : 'Send Offer Letter'}
            </button>
          )}
          {editMode === 'view' ? (
            <button
              onClick={() => setEditMode('edit')}
              className="px-4 py-2 text-sm font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-xl transition"
            >
              Edit Decision
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-xl transition"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Decision
              </button>
            </>
          )}
        </div>
      </div>

      {editMode === 'view' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Decision" value={record.finalDecision?.decision || 'Pending'} />
          <Field label="Decision Date" value={record.finalDecision?.decisionDate ? new Date(record.finalDecision.decisionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
          <Field label="Joining Date" value={record.finalDecision?.joiningDate ? new Date(record.finalDecision.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
          {canSeeFinancials && <Field label="Offered CTC (₹)" value={record.finalDecision?.offeredCTC} />}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditSelect
              label="Decision *"
              name="decision"
              value={draft.decision || 'Pending'}
              options={DECISION_OPTIONS}
              onChange={(_, v) => handleChange('decision', v)}
            />
            <EditField
              label="Decision Date"
              name="decisionDate"
              value={draft.decisionDate ? draft.decisionDate.split('T')[0] : ''}
              onChange={(_, v) => handleChange('decisionDate', v)}
              type="date"
            />
            <EditField
              label="Joining Date"
              name="joiningDate"
              value={draft.joiningDate ? draft.joiningDate.split('T')[0] : ''}
              onChange={(_, v) => handleChange('joiningDate', v)}
              type="date"
            />
            {canSeeFinancials && (
              <EditField
                label="Offered CTC (₹)"
                name="offeredCTC"
                value={draft.offeredCTC || ''}
                onChange={(_, v) => handleChange('offeredCTC', v)}
              />
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Notes</label>
            <textarea
              value={draft.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              placeholder="Any additional notes about the hiring decision..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
            />
          </div>
        </>
      )}

      {record.finalDecision?.decision && (
        <div className={`mt-4 p-4 rounded-xl border ${
          currentDecision === 'Offer Made'  ? 'bg-green-50  border-green-200' :
          currentDecision === 'Rejected'    ? 'bg-red-50    border-red-200'   :
          currentDecision === 'On Hold'     ? 'bg-yellow-50 border-yellow-200' :
                                              'bg-orange-50 border-orange-200'
        }`}>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Decision Summary</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {canSeeFinancials && record.finalDecision?.offeredCTC  && <div><span className="text-gray-400">Offered CTC:</span> <strong>{record.finalDecision.offeredCTC}</strong></div>}
            {record.finalDecision?.joiningDate && <div><span className="text-gray-400">Joining:</span> <strong>{new Date(record.finalDecision.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>}
            {record.finalDecision?.decisionDate && <div><span className="text-gray-400">Decided on:</span> <strong>{new Date(record.finalDecision.decisionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>}
          </div>
          {record.finalDecision?.notes && <p className="mt-2 text-xs text-gray-600 italic">"{record.finalDecision.notes}"</p>}
        </div>
      )}

      {currentDecision === 'Offer Made' && (
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Offer Letter Document</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateLetter}
              disabled={generatingLetter}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 rounded-lg transition"
            >
              {generatingLetter ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Generate Preview
            </button>
            {offerLetter?.generatedHtml && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <Eye size={14} /> View Preview
              </button>
            )}
            <label className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">
              {uploadingLetter ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload Signed Letter
              <input type="file" className="hidden" onChange={handleUploadLetter} disabled={uploadingLetter} />
            </label>
          </div>
          {offerLetter?.source === 'uploaded' && offerLetter.driveLink && (
            <p className="text-xs text-gray-600">
              Uploaded: <a href={offerLetter.driveLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{offerLetter.fileName || 'View file'}</a>
            </p>
          )}
        </div>
      )}

      {/* ── Joining Management — post-acceptance tracking, distinct from the
          planned joiningDate above ── */}
      {currentDecision === 'Offer Made' && (
        <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Joining Management</p>
            {!joiningEdit ? (
              <button onClick={() => setJoiningEdit(true)} className="text-xs font-semibold text-lime-700 hover:underline">Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setJoiningDraft(record.joining ?? {} as Joining); setJoiningEdit(false); }} className="text-xs font-semibold text-gray-500 hover:underline">Cancel</button>
                <button onClick={handleSaveJoining} disabled={savingJoining} className="text-xs font-semibold text-lime-700 hover:underline">
                  {savingJoining ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {!joiningEdit ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${JOINING_STATUS_COLORS[record.joining?.status || '']}`}>
                  {record.joining?.status || 'Not started'}
                </span>
              </div>
              <Field label="Confirmed Date" value={record.joining?.confirmedDate ? new Date(record.joining.confirmedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              <Field label="Actual Joining Date" value={record.joining?.actualDate ? new Date(record.joining.actualDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              <Field label="Documents" value={record.joining?.docsStatus || 'Pending'} />
              <Field label="BGV Status" value={record.joining?.bgvStatus || 'Not Applicable'} />
              {record.joining?.remarks && <Field label="Remarks" value={record.joining.remarks} />}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <EditSelect label="Status" name="status" value={joiningDraft.status || ''} options={JOINING_STATUS_OPTIONS} onChange={(_, v) => handleJoiningChange('status', v)} />
              <EditField label="Confirmed Date" name="confirmedDate" type="date" value={joiningDraft.confirmedDate ? joiningDraft.confirmedDate.split('T')[0] : ''} onChange={(_, v) => handleJoiningChange('confirmedDate', v)} />
              <EditField label="Actual Joining Date" name="actualDate" type="date" value={joiningDraft.actualDate ? joiningDraft.actualDate.split('T')[0] : ''} onChange={(_, v) => handleJoiningChange('actualDate', v)} />
              <EditSelect label="Documents" name="docsStatus" value={joiningDraft.docsStatus || 'Pending'} options={DOCS_STATUS_OPTIONS} onChange={(_, v) => handleJoiningChange('docsStatus', v)} />
              <EditSelect label="BGV Status" name="bgvStatus" value={joiningDraft.bgvStatus || 'Not Applicable'} options={BGV_STATUS_OPTIONS} onChange={(_, v) => handleJoiningChange('bgvStatus', v)} />
              <div className="md:col-span-2">
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Remarks</label>
                <textarea
                  value={joiningDraft.remarks || ''}
                  onChange={(e) => handleJoiningChange('remarks', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {record.offerLetterSentAt && (
        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-400 mb-2">Document Upload</p>
          <p className="text-sm text-gray-700">
            Offer letter email sent on {new Date(record.offerLetterSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {record.documentsUploadFolderLink && (
              <>
                {' · '}
                <a href={record.documentsUploadFolderLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                  View Documents Folder
                </a>
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {record.uploadedDocuments?.length ?? 0} document{(record.uploadedDocuments?.length ?? 0) === 1 ? '' : 's'} uploaded by candidate so far
          </p>
        </div>
      )}

      {previewOpen && offerLetter?.generatedHtml && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="font-bold text-gray-800">Offer Letter Preview</p>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: offerLetter.generatedHtml }} />
          </div>
        </div>
      )}

      {showSaved && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
          onClick={() => setShowSaved(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-3 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CheckCircle2 size={40} className="text-green-500" />
            <p className="text-base font-bold text-gray-800">Saved Successfully</p>
            <p className="text-sm text-gray-500 text-center">Offer &amp; Placement details have been updated.</p>
            <button
              onClick={() => setShowSaved(false)}
              className="mt-2 px-5 py-2 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferPlacementTab;
