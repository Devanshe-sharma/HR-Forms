// pages/Recruitment/InterviewRoundTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Loader2, Edit2, Save, Plus, ClipboardList,
  ChevronDown, ChevronUp, ExternalLink, CalendarClock, RefreshCw,
  X, Send, Check, Ban, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EditField, EditSelect } from './ApplicantFieldComponents';
import { TemplateModal } from './FeedbackTemplate';
import {
  ApplicantRecord, InterviewRound, API_BASE,
  STAGE_OPTIONS, MODE_OPTIONS,
  SCHEDULING_STATUS_OPTIONS, SCHEDULING_STATUS_COLORS,
  CANDIDATE_CONFIRMATION_COLORS,
  INTERVIEWER_FEEDBACK_STATUS_OPTIONS, INTERVIEWER_FEEDBACK_STATUS_COLORS,
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
  interviewerFeedbackStatus: '',
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
  existingRound, onSchedule, onReschedule, onCancelRound, onMarkDone,
}: {
  data: Partial<InterviewRound>;
  onChange: (f: string, v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  interviewers: EmployeeOption[];
  loadingInterviewers: boolean;
  // Only present when editing an already-saved round — a brand new round
  // has no _id yet, so there's nothing for Schedule/Reschedule/Done/Cancel
  // to act on until it's been saved once.
  existingRound?: InterviewRound;
  onSchedule?: () => void;
  onReschedule?: () => void;
  onCancelRound?: () => void;
  onMarkDone?: () => void;
}) => {
  // Keep the currently-saved interviewer selectable even if they've since
  // left the employee master list, so editing an old round doesn't blank it.
  const interviewerOptions = data.interviewer && !interviewers.some((e) => e.name === data.interviewer)
    ? [{ name: data.interviewer, designation: '' }, ...interviewers]
    : interviewers;

  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-gray-50 border-t border-dashed border-gray-200">
      {existingRound && existingRound.schedulingStatus !== 'Cancelled' && (
        <div className="col-span-2 md:col-span-3 flex items-center gap-2 flex-wrap pb-3 mb-1 border-b border-dashed border-gray-300">
          <button onClick={onSchedule} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
            <CalendarClock size={13} /> Schedule
          </button>
          <button onClick={onReschedule} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition">
            <RefreshCw size={13} /> Reschedule
          </button>
          <button onClick={onMarkDone} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition">
            <CheckCircle2 size={13} /> Mark Done
          </button>
          <button onClick={onCancelRound} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition ml-auto">
            <Ban size={13} /> Cancel Round
          </button>
        </div>
      )}

      <EditSelect label="Stage"                    name="stage"                 value={data.stage || ''}                 options={STAGE_OPTIONS}               onChange={(_, v) => onChange('stage', v)} />
      <EditSelect label="Scheduling Status"        name="schedulingStatus"      value={data.schedulingStatus || ''}      options={SCHEDULING_STATUS_OPTIONS}   onChange={(_, v) => onChange('schedulingStatus', v)} />
      <EditSelect label="Interviewer Feedback Status" name="interviewerFeedbackStatus" value={data.interviewerFeedbackStatus || ''} options={INTERVIEWER_FEEDBACK_STATUS_OPTIONS} onChange={(_, v) => onChange('interviewerFeedbackStatus', v)} />
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

      <div className="col-span-2 md:col-span-3 mt-4 pt-4 border-t border-dashed border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block">Remarks</label>
          <button
            type="button"
            onClick={() => setTemplateOpen(true)}
            className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
          >
            {data.feedback ? 'Edit via template' : 'Use template'}
          </button>
        </div>
        <textarea
          value={data.feedback || ''}
          onChange={(e) => onChange('feedback', e.target.value)}
          rows={4}
          placeholder="Enter interview remarks…"
          className="w-full text-sm text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
        />
        <TemplateModal
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
          onInsert={(text: string) => onChange('feedback', text)}
          screenerName={data.interviewer || ''}
          existingText={data.feedback || ''}
          defaultRound={data.stage || 'Interview Round'}
          title="Interview Feedback Template"
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
  type MailContent = { to: string; cc: string; subject: string; body: string };
  const [mailModal, setMailModal] = useState<{
    open: boolean; type: 'schedule' | 'reschedule' | 'cancel'; round: InterviewRound | null;
    tab: 'interviewer' | 'candidate'; sentTabs: string[]; sending: boolean; reason: string;
    content: Partial<Record<'interviewer' | 'candidate', MailContent>>;
    loadingPreview: boolean; previewError: string | null;
  }>({
    open: false, type: 'schedule', round: null, tab: 'interviewer', sentTabs: [], sending: false, reason: '',
    content: {}, loadingPreview: false, previewError: null,
  });

  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean; to: string; cc: string; subject: string; body: string;
    loading: boolean; sending: boolean; error: string;
  }>({ open: false, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  useEffect(() => { setRounds(record.interviewRounds ?? []); }, [record]);

  // Whether any round an interviewer already gave feedback on was Not
  // Recommended — the overall Final Status dropdown (in the candidate
  // modal header) is constrained by this too; here it just gates the
  // rejection-mail action.
  const hasNotRecommended = rounds.some((r) => r.interviewerFeedbackStatus === 'Not Recommended');

  const openRejectionModal = async () => {
    setRejectionModal((m) => ({ ...m, open: true, loading: true, error: '' }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/rejection-mail/preview`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load rejection mail');
      setRejectionModal((m) => ({ ...m, loading: false, to: json.data.to, cc: '', subject: json.data.subject, body: json.data.body }));
    } catch (e: any) {
      setRejectionModal((m) => ({ ...m, loading: false, error: e.message || 'Failed to load rejection mail' }));
    }
  };

  const sendRejectionMail = async () => {
    setRejectionModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/rejection-mail/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to: rejectionModal.to.trim() || undefined,
          cc: rejectionModal.cc.trim() || undefined,
          subject: rejectionModal.subject,
          customBody: rejectionModal.body,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send rejection mail');
      toast.success(`Rejection mail sent to ${json.data.sentTo}`);
      setRejectionModal((m) => ({ ...m, open: false, sending: false }));
    } catch (e: any) {
      toast.error(e.message || 'Failed to send rejection mail');
      setRejectionModal((m) => ({ ...m, sending: false }));
    }
  };

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
      content: {}, loadingPreview: false, previewError: null,
    });

  const closeMailModal = () => setMailModal((m) => ({ ...m, open: false }));

  // Pulls the exact subject/html the send-mail route would generate, so HR
  // sees (and, for the interviewer's copy, can edit) the real content before
  // it goes out — rather than sending blind based on the metadata summary alone.
  const fetchPreview = async (
    tab: 'interviewer' | 'candidate', round: InterviewRound,
    type: 'schedule' | 'reschedule' | 'cancel', reason: string,
  ) => {
    setMailModal((m) => ({ ...m, loadingPreview: true, previewError: null }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${round._id}/preview-mail`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, audience: tab, cancellationReason: type === 'cancel' ? reason : undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Server returned ${res.status}`);
      }
      setMailModal((m) => ({
        ...m,
        loadingPreview: false,
        content: {
          ...m.content,
          // Regenerating keeps whatever CC HR already typed — only To/Subject/Body reset to the fresh default.
          [tab]: { to: json.data.to || '', cc: m.content[tab]?.cc || '', subject: json.data.subject, body: json.data.body },
        },
      }));
    } catch (e: any) {
      console.error('[preview-mail] failed:', e);
      setMailModal((m) => ({ ...m, loadingPreview: false, previewError: e.message || 'Failed to load mail content' }));
    }
  };

  // Fetches the preview for whichever tab is active, once per tab per
  // modal-open — a manual "Regenerate" button (near the editor) re-fetches
  // on demand, e.g. after the cancellation reason text changes.
  useEffect(() => {
    if (!mailModal.open || !mailModal.round || mailModal.content[mailModal.tab]) return;
    fetchPreview(mailModal.tab, mailModal.round, mailModal.type, mailModal.reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailModal.open, mailModal.tab, mailModal.round?._id]);

  const updateMailContent = (tab: 'interviewer' | 'candidate', field: keyof MailContent, value: string) =>
    setMailModal((m) => ({
      ...m,
      content: { ...m.content, [tab]: { to: '', cc: '', subject: '', body: '', ...m.content[tab], [field]: value } },
    }));

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
          to: mailModal.content[tab]?.to.trim() || undefined,
          cc: mailModal.content[tab]?.cc.trim() || undefined,
          subject: mailModal.content[tab]?.subject,
          customBody: mailModal.content[tab]?.body,
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

  // Marking a round Done is a plain status update — no mail involved,
  // since it just records that the interview already happened.
  const markRoundDone = async (round: InterviewRound) => {
    try {
      await patchRound(round._id, { schedulingStatus: 'Done' });
      toast.success('Round marked as done');
    } catch {
      toast.error('Failed to mark round as done');
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
      {/* The overall Interview Final Status dropdown now lives in the
          candidate modal header (AllApplicants.tsx) — this tab only
          surfaces the rejection-mail action once it's relevant. */}
      {hasNotRecommended && (
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-red-100 bg-red-50">
          <p className="text-xs text-red-700">A round was marked Not Recommended.</p>
          <button
            onClick={openRejectionModal}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            <Send size={13} /> Send Rejection Mail
          </button>
        </div>
      )}

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
            {/* ── Header bar — click anywhere on it to collapse/expand ── */}
            <div
              onClick={() => toggleCollapse(r._id)}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 cursor-pointer hover:bg-blue-50 transition"
            >
              <span className="flex-shrink-0 text-[11px] font-bold text-white bg-slate-800 px-2.5 py-1 rounded">
                Round {r.roundNumber}
              </span>
              <span className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Interviewer:</span> {r.interviewer || '—'}</span>
              <span className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Date:</span> {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'TBD'}</span>
              <span className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Mode:</span> {r.mode || '—'}</span>

              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${SCHEDULING_STATUS_COLORS[r.schedulingStatus] || 'bg-gray-100 text-gray-600'}`}>
                {r.schedulingStatus || 'Scheduled'}
              </span>

              <div className="flex items-center gap-1 flex-shrink-0 ml-auto text-gray-400">
                {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
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
                <DetailRow label="Interviewer Feedback Status">
                  {r.interviewerFeedbackStatus
                    ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${INTERVIEWER_FEEDBACK_STATUS_COLORS[r.interviewerFeedbackStatus] || 'bg-gray-100 text-gray-600'}`}>
                        {r.interviewerFeedbackStatus}
                      </span>
                    : <span className="text-gray-400 italic">—</span>}
                </DetailRow>
                <DetailRow label="Note (if any)">{r.note || <span className="text-gray-400 italic">—</span>}</DetailRow>
                <DetailRow label="Remarks">
                  <p className="whitespace-pre-wrap font-bold text-black">{r.feedback || <span className="font-normal text-gray-400 italic">No remarks recorded</span>}</p>
                </DetailRow>

                <div className="flex justify-end px-3 py-2.5 bg-gray-50">
                  <button
                    onClick={() => startEdit(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                </div>
              </div>
            )}

            {/* ── Edit mode — Schedule/Reschedule/Done/Cancel now live here too ── */}
            {isEditing && (
              <RoundForm
                data={drafts[r._id] || r}
                onChange={(f, v) => handleDraftChange(r._id, f, v)}
                onSave={() => saveRound(r._id)}
                onCancel={() => setEditingId(null)}
                saving={saving}
                interviewers={interviewers}
                loadingInterviewers={loadingInterviewers}
                existingRound={r}
                onSchedule={() => openMailModal('schedule', r)}
                onReschedule={() => openMailModal('reschedule', r)}
                onCancelRound={() => openMailModal('cancel', r)}
                onMarkDone={() => markRoundDone(r)}
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

      {!adding && (() => {
        const lastRound = rounds[rounds.length - 1];
        // A round left Scheduled/Rescheduled is still "open" — the next
        // round can't start until this one is actually resolved, one way
        // or the other.
        const canAddRound = !lastRound || lastRound.schedulingStatus === 'Done' || lastRound.schedulingStatus === 'Cancelled';

        return canAddRound ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 hover:border-lime-400 hover:text-lime-600 rounded-xl text-sm text-gray-400 transition"
          >
            <Plus size={15} /> Add Interview Round
          </button>
        ) : (
          <p className="w-full text-center py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 italic">
            Mark Round {lastRound.roundNumber} as Done or Cancelled before adding a new round.
          </p>
        );
      })()}

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

              {/* ── Edit & Send Mail — To/CC/Subject/Body, all plain text and
                  editable for either audience, until the round is done. ── */}
              {(() => {
                const isDone = ['Done', 'Cancelled'].includes(mailModal.round.schedulingStatus);
                const current = mailModal.content[mailModal.tab];
                const fieldClass = (editable: boolean) =>
                  `w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm ${
                    editable ? 'focus:outline-none focus:ring-2 focus:ring-lime-400' : 'bg-gray-50 text-gray-600'
                  }`;

                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                        {isDone ? 'Mail Content — locked (round is Done/Cancelled)' : 'Edit & Send Mail'}
                      </span>
                      <button
                        type="button"
                        onClick={() => mailModal.round && fetchPreview(mailModal.tab, mailModal.round, mailModal.type, mailModal.reason)}
                        disabled={mailModal.loadingPreview}
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-lime-600 disabled:opacity-50 transition"
                        title="Regenerate from the current round details (e.g. after changing the cancellation reason)"
                      >
                        <RefreshCw size={11} className={mailModal.loadingPreview ? 'animate-spin' : ''} /> Regenerate
                      </button>
                    </div>

                    {!current && mailModal.loadingPreview && (
                      <p className="text-sm text-gray-400 italic p-4">Loading mail content…</p>
                    )}
                    {!current && !mailModal.loadingPreview && mailModal.previewError && (
                      <p className="text-sm text-red-500 p-4">
                        Couldn't load mail content: {mailModal.previewError}. Click Regenerate to retry.
                      </p>
                    )}
                    {current && (
                      <div className="p-3 space-y-2.5 bg-white">
                        <div>
                          <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">To</label>
                          <input
                            value={current.to}
                            onChange={(e) => updateMailContent(mailModal.tab, 'to', e.target.value)}
                            readOnly={isDone}
                            placeholder={mailModal.tab === 'interviewer' ? "Interviewer's email" : "Candidate's email"}
                            className={fieldClass(!isDone)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                          <input
                            value={current.cc}
                            onChange={(e) => updateMailContent(mailModal.tab, 'cc', e.target.value)}
                            readOnly={isDone}
                            placeholder="cc1@company.com, cc2@company.com"
                            className={fieldClass(!isDone)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Subject</label>
                          <input
                            value={current.subject}
                            onChange={(e) => updateMailContent(mailModal.tab, 'subject', e.target.value)}
                            readOnly={isDone}
                            className={fieldClass(!isDone)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Body</label>
                          <textarea
                            value={current.body}
                            onChange={(e) => updateMailContent(mailModal.tab, 'body', e.target.value)}
                            readOnly={isDone}
                            rows={10}
                            className={`${fieldClass(!isDone)} resize-y`}
                          />
                          {mailModal.tab === 'candidate' && mailModal.type !== 'cancel' && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              A Yes / Maybe / Can't-attend confirmation block is added automatically below this message.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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

      {/* ── Rejection mail — shown when any round is Not Recommended ── */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectionModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl bg-red-700">
              <p className="text-sm font-bold text-white">Send Rejection Mail</p>
              <button onClick={() => setRejectionModal((m) => ({ ...m, open: false }))} className="text-white/70 hover:text-white transition"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-2.5">
              {rejectionModal.loading ? (
                <p className="text-sm text-gray-400 italic">Loading…</p>
              ) : rejectionModal.error && !rejectionModal.subject ? (
                <p className="text-sm text-red-500">{rejectionModal.error}</p>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">To</label>
                    <input
                      value={rejectionModal.to}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, to: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                    <input
                      value={rejectionModal.cc}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, cc: e.target.value }))}
                      placeholder="cc1@company.com, cc2@company.com"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Subject</label>
                    <input
                      value={rejectionModal.subject}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, subject: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Body</label>
                    <textarea
                      value={rejectionModal.body}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, body: e.target.value }))}
                      rows={10}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setRejectionModal((m) => ({ ...m, open: false }))} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
              <button
                onClick={sendRejectionMail}
                disabled={rejectionModal.sending || rejectionModal.loading || !rejectionModal.subject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition"
              >
                {rejectionModal.sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoundTab;
