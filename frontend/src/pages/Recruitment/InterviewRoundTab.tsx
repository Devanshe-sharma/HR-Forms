// pages/Recruitment/InterviewRoundTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Loader2, Edit2, Save, Plus, Trash2, ClipboardList,
  ChevronDown, ChevronUp, ExternalLink, CalendarClock, RefreshCw,
  X, Send, Check, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EditField, EditSelect } from './ApplicantFieldComponents';
import {
  ApplicantRecord, InterviewRound, API_BASE,
  STAGE_OPTIONS, MODE_OPTIONS, RESULT_OPTIONS, RESULT_COLORS,
  SCHEDULING_STATUS_OPTIONS, SCHEDULING_STATUS_COLORS,
  CANDIDATE_CONFIRMATION_OPTIONS, CANDIDATE_CONFIRMATION_COLORS,
} from './applicantTypes';

function resolveResumeUrl(resume?: string): string {
  if (!resume) return '';
  if (/^https?:\/\//i.test(resume)) return resume;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${resume.startsWith('/') ? '' : '/'}${resume}`;
}

type EmployeeOption = { name: string; designation: string };

const emptyRound = (): Omit<InterviewRound, '_id'> => ({
  roundNumber:           1,
  stage:                 'Technical Round 1',
  schedulingStatus:      'Scheduled',
  cancellationReason:    '',
  scheduledDate:         '',
  scheduledTime:         '',
  interviewer:           '',
  mode:                  'Not Decided Yet',
  meetingLink:           '',
  candidateConfirmation: 'Pending',
  note:                  '',
  feedback:              '',
  result:                'Pending',
});

// Label/value row for the read-only detail table
const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(120px,35%)_1fr] border-b border-gray-100 last:border-b-0">
    <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-gray-600">{label}</div>
    <div className="px-3 py-2 text-sm text-gray-800 break-words">{children}</div>
  </div>
);

const RoundForm = ({
  data, onChange, onSave, onCancel, saving, interviewers, loadingInterviewers,
}: {
  data: Partial<InterviewRound>;
  onChange: (f: string, v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  interviewers: EmployeeOption[];
  loadingInterviewers: boolean;
}) => {
  // Keep the currently-saved interviewer selectable even if they've since
  // left the employee master list, so editing an old round doesn't blank it.
  const interviewerOptions = data.interviewer && !interviewers.some((e) => e.name === data.interviewer)
    ? [{ name: data.interviewer, designation: '' }, ...interviewers]
    : interviewers;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-gray-50 border-t border-dashed border-gray-200">
      <EditSelect label="Stage"                    name="stage"                 value={data.stage || ''}                 options={STAGE_OPTIONS}               onChange={(_, v) => onChange('stage', v)} />
      <EditSelect label="Scheduling Status"        name="schedulingStatus"      value={data.schedulingStatus || ''}      options={SCHEDULING_STATUS_OPTIONS}   onChange={(_, v) => onChange('schedulingStatus', v)} />
      <EditSelect label="Result"                   name="result"                value={data.result || ''}                options={RESULT_OPTIONS}              onChange={(_, v) => onChange('result', v)} />
      <EditField  label="Date"                     name="scheduledDate"         value={data.scheduledDate || ''}         onChange={(_, v) => onChange('scheduledDate', v)} type="date" inputClassName="text-base py-2.5" />
      <EditField  label="Time"                     name="scheduledTime"         value={data.scheduledTime || ''}         onChange={(_, v) => onChange('scheduledTime', v)} type="time" inputClassName="text-base py-2.5" />
      <div>
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Interviewer Name</label>
        <select
          value={data.interviewer || ''}
          onChange={(e) => onChange('interviewer', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
        >
          <option value="">— Select interviewer —</option>
          {loadingInterviewers
            ? <option disabled>Loading…</option>
            : interviewerOptions.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}{e.designation ? ` — ${e.designation}` : ''}
              </option>
            ))}
        </select>
      </div>
      <EditSelect label="Mode"                     name="mode"                  value={data.mode || ''}                  options={MODE_OPTIONS}                onChange={(_, v) => onChange('mode', v)} />
      <EditField  label="Meeting Link / Location"  name="meetingLink"           value={data.meetingLink || ''}           onChange={(_, v) => onChange('meetingLink', v)} />
      <EditSelect label="Candidate Confirmation"   name="candidateConfirmation" value={data.candidateConfirmation || ''} options={CANDIDATE_CONFIRMATION_OPTIONS} onChange={(_, v) => onChange('candidateConfirmation', v)} />

      {data.schedulingStatus === 'Cancelled' && (
        <div className="col-span-2 md:col-span-3">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Cancellation Reason</label>
          <textarea
            value={data.cancellationReason || ''}
            onChange={(e) => onChange('cancellationReason', e.target.value)}
            rows={2}
            placeholder="Why was this round cancelled?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
          />
        </div>
      )}

      <div className="col-span-2 md:col-span-3">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Note (if any)</label>
        <input
          value={data.note || ''}
          onChange={(e) => onChange('note', e.target.value)}
          placeholder="Any note about this round…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
        />
      </div>

      <div className="col-span-2 md:col-span-3">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1 block">Remarks</label>
        <textarea
          value={data.feedback || ''}
          onChange={(e) => onChange('feedback', e.target.value)}
          rows={4}
          placeholder="Enter interview remarks…"
          className="w-full text-sm text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
        />
      </div>

      <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      </div>
    </div>
  );
};

const InterviewRoundTab = ({
  record,
  onUpdate,
}: {
  record: ApplicantRecord;
  onUpdate: (updated: ApplicantRecord) => void;
}) => {
  const [rounds,    setRounds]    = useState<InterviewRound[]>(record.interviewRounds ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts,    setDrafts]    = useState<Record<string, Partial<InterviewRound>>>({});
  const [adding,    setAdding]    = useState(false);
  const [newRound,  setNewRound]  = useState(emptyRound());
  const [saving,    setSaving]    = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [jdLink,    setJdLink]    = useState<string | null>(null);
  const [interviewers,        setInterviewers]        = useState<EmployeeOption[]>([]);
  const [loadingInterviewers, setLoadingInterviewers]  = useState(true);
  const [mailModal, setMailModal] = useState<{
    open: boolean; type: 'schedule' | 'reschedule' | 'cancel'; round: InterviewRound | null;
    tab: 'interviewer' | 'candidate'; sentTabs: string[]; sending: boolean; reason: string;
  }>({ open: false, type: 'schedule', round: null, tab: 'interviewer', sentTabs: [], sending: false, reason: '' });

  useEffect(() => { setRounds(record.interviewRounds ?? []); }, [record]);

  // JD Link and Resume are per-candidate/per-job, not per-round — pulled
  // once here instead of asking HR to paste them into every round.
  useEffect(() => {
    fetch(`${API_BASE}/applicant-records/${record._id}/jd-link`)
      .then((r) => r.json())
      .then((json) => setJdLink(json.success ? json.data.jdLink : null))
      .catch(() => setJdLink(null));
  }, [record._id]);

  // All current employees, with designation, for the Interviewer Name dropdown —
  // not just HR, since interviewers can come from any department.
  useEffect(() => {
    setLoadingInterviewers(true);
    fetch(`${API_BASE}/onboarding/employee-master`)
      .then((r) => r.json())
      .then((json) => {
        const all = json?.data?.employees ?? [];
        const list: EmployeeOption[] = all
          .filter((e: any) => e.is_current && e.full_name?.trim())
          .map((e: any) => ({ name: e.full_name.trim(), designation: e.designation || '' }))
          .sort((a: EmployeeOption, b: EmployeeOption) => a.name.localeCompare(b.name));
        setInterviewers(list);
      })
      .catch(() => setInterviewers([]))
      .finally(() => setLoadingInterviewers(false));
  }, []);

  const toggleCollapse = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const startEdit = (r: InterviewRound) => {
    setEditingId(r._id);
    setDrafts((p) => ({ ...p, [r._id]: { ...r } }));
  };

  const handleDraftChange = (id: string, field: string, value: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));

  const saveRound = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(drafts[id]),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      setEditingId(null);
      toast.success('Round updated');
    } catch {
      toast.error('Failed to save round');
    } finally {
      setSaving(false);
    }
  };

  const deleteRound = async (id: string) => {
    if (!window.confirm('Delete this round?')) return;
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      toast.success('Round deleted');
    } catch {
      toast.error('Failed to delete round');
    }
  };

  const addRound = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newRound),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      setAdding(false);
      setNewRound(emptyRound());
      toast.success('Round added');
    } catch {
      toast.error('Failed to add round');
    } finally {
      setSaving(false);
    }
  };

  // ── Schedule / Reschedule / Cancel mail dialog ─────────────────────────
  const openMailModal = (type: 'schedule' | 'reschedule' | 'cancel', round: InterviewRound) =>
    setMailModal({
      open: true, type, round, tab: 'interviewer', sentTabs: [],
      sending: false, reason: type === 'cancel' ? (round.cancellationReason || '') : '',
    });

  const closeMailModal = () => setMailModal((m) => ({ ...m, open: false }));

  const patchRound = async (id: string, body: Partial<InterviewRound>) => {
    const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    const json = await res.json();
    setRounds(json.data.interviewRounds);
    onUpdate(json.data);
  };

  const handleSendMail = async (tab: 'interviewer' | 'candidate') => {
    const round = mailModal.round;
    if (!round) return;
    if (mailModal.type === 'cancel' && !mailModal.reason.trim()) {
      toast.error('Enter a cancellation reason before sending');
      return;
    }

    setMailModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${round._id}/send-mail`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type: mailModal.type,
          audience: tab,
          cancellationReason: mailModal.type === 'cancel' ? mailModal.reason : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send mail');

      toast.success(`Mail sent to ${tab === 'interviewer' ? 'interviewer' : 'candidate'} (${json.data.sentTo})`);
      setMailModal((m) => ({ ...m, sentTabs: [...m.sentTabs, tab] }));

      // Schedule/Reschedule: a successful send also reflects the new status.
      // Cancel is finalized separately via "Finalize Cancellation" below.
      if (mailModal.type !== 'cancel') {
        const newStatus = mailModal.type === 'schedule' ? 'Scheduled' : 'Rescheduled';
        if (round.schedulingStatus !== newStatus) {
          await patchRound(round._id, { schedulingStatus: newStatus });
        }
      }
    } catch (e: any) {
      toast.error(e.message || `Failed to send mail to ${tab}`);
    } finally {
      setMailModal((m) => ({ ...m, sending: false }));
    }
  };

  const finalizeCancellation = async () => {
    const round = mailModal.round;
    if (!round) return;
    if (!mailModal.reason.trim()) {
      toast.error('Enter a cancellation reason first');
      return;
    }
    try {
      await patchRound(round._id, { schedulingStatus: 'Cancelled', cancellationReason: mailModal.reason });
      toast.success('Round marked as cancelled');
      closeMailModal();
    } catch {
      toast.error('Failed to finalize cancellation');
    }
  };

  const resumeUrl = resolveResumeUrl(record.resume);

  return (
    <div className="space-y-4">
      {/* Round cards */}
      {rounds.length === 0 && !adding && (
        <div className="text-center py-12 text-gray-400">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No interview rounds yet.</p>
        </div>
      )}

      {rounds.map((r) => {
        const isEditing   = editingId === r._id;
        const isCollapsed = !!collapsed[r._id];

        return (
          <div key={r._id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition">
            {/* ── Header bar ── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-blue-50/60 border-b border-blue-100">
              <span className="flex-shrink-0 text-[11px] font-bold text-white bg-slate-800 px-2.5 py-1 rounded">
                Round {r.roundNumber}
              </span>
              <span className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Interviewer:</span> {r.interviewer || '—'}</span>
              <span className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Date:</span> {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'TBD'}</span>
              <span className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Mode:</span> {r.mode || '—'}</span>

              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${RESULT_COLORS[r.result] || 'bg-gray-100 text-gray-600'}`}>
                {r.result}
              </span>

              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                {!isEditing && (
                  <>
                    <button onClick={() => startEdit(r)}      className="p-1 text-gray-400 hover:text-lime-600 hover:bg-lime-100 rounded transition"><Edit2 size={13} /></button>
                    <button onClick={() => deleteRound(r._id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded transition"><Trash2 size={13} /></button>
                  </>
                )}
                <button onClick={() => toggleCollapse(r._id)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition">
                  {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>
              </div>
            </div>

            {/* ── Detail table (view mode) ── */}
            {!isEditing && !isCollapsed && (
              <div>
                <DetailRow label="Stage">{r.stage || '—'}</DetailRow>
                <DetailRow label="Scheduling Status">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SCHEDULING_STATUS_COLORS[r.schedulingStatus] || 'bg-gray-100 text-gray-600'}`}>
                    {r.schedulingStatus || 'Scheduled'}
                  </span>
                </DetailRow>
                {r.schedulingStatus === 'Cancelled' && (
                  <DetailRow label="Cancellation Reason">
                    {r.cancellationReason || <span className="text-gray-400 italic">—</span>}
                  </DetailRow>
                )}
                <DetailRow label="Interviewer Name">{r.interviewer || '—'}</DetailRow>
                <DetailRow label="Date">
                  {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}
                </DetailRow>
                <DetailRow label="Time">{r.scheduledTime || '—'}</DetailRow>
                <DetailRow label="Mode">{r.mode || '—'}</DetailRow>
                <DetailRow label="Meeting Link / Location">
                  {r.meetingLink
                    ? (/^https?:\/\//i.test(r.meetingLink)
                      ? <a href={r.meetingLink} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">Open Link <ExternalLink size={12} /></a>
                      : r.meetingLink)
                    : <span className="text-gray-400 italic">—</span>}
                </DetailRow>
                <DetailRow label="JD Link">
                  {jdLink
                    ? <a href={jdLink} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">Open JD <ExternalLink size={12} /></a>
                    : <span className="text-gray-400 italic">Not available</span>}
                </DetailRow>
                <DetailRow label="Resume">
                  {resumeUrl
                    ? <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">Open CV <ExternalLink size={12} /></a>
                    : <span className="text-gray-400 italic">Not available</span>}
                </DetailRow>
                <DetailRow label="Candidate Confirmation">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CANDIDATE_CONFIRMATION_COLORS[r.candidateConfirmation] || 'bg-gray-100 text-gray-600'}`}>
                    {r.candidateConfirmation || 'Pending'}
                  </span>
                </DetailRow>
                <DetailRow label="Note (if any)">{r.note || <span className="text-gray-400 italic">—</span>}</DetailRow>
                <DetailRow label="Remarks">
                  <p className="whitespace-pre-wrap">{r.feedback || <span className="text-gray-400 italic">No remarks recorded</span>}</p>
                </DetailRow>

                {r.schedulingStatus !== 'Cancelled' && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 flex-wrap">
                    <button
                      onClick={() => openMailModal('schedule', r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      <CalendarClock size={13} /> Schedule
                    </button>
                    <button
                      onClick={() => openMailModal('reschedule', r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                    >
                      <RefreshCw size={13} /> Reschedule
                    </button>
                    <button
                      onClick={() => openMailModal('cancel', r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition ml-auto"
                    >
                      <Ban size={13} /> Cancel Round
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Edit mode ── */}
            {isEditing && (
              <RoundForm
                data={drafts[r._id] || r}
                onChange={(f, v) => handleDraftChange(r._id, f, v)}
                onSave={() => saveRound(r._id)}
                onCancel={() => setEditingId(null)}
                saving={saving}
                interviewers={interviewers}
                loadingInterviewers={loadingInterviewers}
              />
            )}
          </div>
        );
      })}

      {/* Add round form */}
      {adding && (
        <div className="border border-lime-200 rounded-xl overflow-hidden bg-lime-50/40">
          <p className="text-sm font-bold text-gray-700 px-3 pt-3">New Round — #{rounds.length + 1}</p>
          <RoundForm
            data={newRound}
            onChange={(f, v) => setNewRound((p) => ({ ...p, [f]: v }))}
            onSave={addRound}
            onCancel={() => { setAdding(false); setNewRound(emptyRound()); }}
            saving={saving}
            interviewers={interviewers}
            loadingInterviewers={loadingInterviewers}
          />
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 hover:border-lime-400 hover:text-lime-600 rounded-xl text-sm text-gray-400 transition"
        >
          <Plus size={15} /> Add Interview Round
        </button>
      )}

      {/* ── Schedule / Reschedule / Cancel mail dialog ── */}
      {mailModal.open && mailModal.round && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={closeMailModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl ${mailModal.type === 'cancel' ? 'bg-red-700' : 'bg-slate-800'}`}>
              <p className="text-sm font-bold text-white">
                {mailModal.type === 'schedule' ? 'Schedule Interview' : mailModal.type === 'reschedule' ? 'Reschedule Interview' : 'Cancel Interview'} — Round {mailModal.round.roundNumber}
              </p>
              <button onClick={closeMailModal} className="text-white/70 hover:text-white transition"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-3">
              {mailModal.type === 'cancel' && (
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={mailModal.reason}
                    onChange={(e) => setMailModal((m) => ({ ...m, reason: e.target.value }))}
                    rows={2}
                    placeholder="Why is this interview being cancelled?"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  />
                </div>
              )}

              <div className="flex gap-2">
                {(['interviewer', 'candidate'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setMailModal((m) => ({ ...m, tab }))}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition ${
                      mailModal.tab === tab ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'interviewer' ? 'Mail to Interviewer' : 'Mail to Candidate'}
                    {mailModal.sentTabs.includes(tab) && ' ✓'}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {[
                  ['To', mailModal.tab === 'interviewer' ? (mailModal.round.interviewer || '—') : (record.email || '—')],
                  ['Stage', mailModal.round.stage || '—'],
                  ['Date', mailModal.round.scheduledDate ? new Date(mailModal.round.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
                  ['Time', mailModal.round.scheduledTime || '—'],
                  ['Mode', mailModal.round.mode || '—'],
                  ['Link', mailModal.round.meetingLink || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2 text-sm">
                    <span className="font-semibold text-gray-500 w-20 flex-shrink-0">{label}</span>
                    <span className="text-gray-800 break-words">{value}</span>
                  </div>
                ))}
              </div>

              {mailModal.type === 'cancel' && (
                <p className="text-[11px] text-gray-400 italic">
                  The cancellation reason is included in the interviewer's mail only — the candidate mail simply notes the interview was cancelled.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl flex-wrap">
              <button onClick={closeMailModal} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Close</button>
              {mailModal.type === 'cancel' && (
                <button
                  onClick={finalizeCancellation}
                  className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                >
                  Finalize Cancellation
                </button>
              )}
              <button
                onClick={() => handleSendMail(mailModal.tab)}
                disabled={mailModal.sending || mailModal.sentTabs.includes(mailModal.tab) || (mailModal.type === 'cancel' && !mailModal.reason.trim())}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
              >
                {mailModal.sending
                  ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  : mailModal.sentTabs.includes(mailModal.tab)
                    ? <><Check size={14} /> Sent</>
                    : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoundTab;
