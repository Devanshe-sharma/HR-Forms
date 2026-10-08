// pages/Recruitment/InterviewRoundTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Loader2, Edit2, Save, Plus, ClipboardList,
  ChevronDown, ChevronUp, ExternalLink, CalendarClock, RefreshCw,
  X, Send, Check, Ban, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FIELD_PLACEHOLDER_CLASS } from './ApplicantFieldComponents';
import { TemplateModal } from './FeedbackTemplate';
import {
  ApplicantRecord, InterviewRound, API_BASE,
  STAGE_OPTIONS, MODE_OPTIONS,
  SCHEDULING_STATUS_COLORS,
  CANDIDATE_CONFIRMATION_COLORS,
  INTERVIEWER_FEEDBACK_STATUS_COLORS,
} from './applicantTypes';

// "14:30" -> "02:30 PM" — the round list/detail view always shows time in
// 12-hour format, regardless of what the native time input produces.
function formatTime12h(time24?: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${mStr || '00'} ${period}`;
}

function formatDateTime12h(date?: string | null, time?: string): string {
  if (!date) return 'Date & Time TBD';
  const d = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const t = formatTime12h(time);
  return t ? `${d}, ${t}` : d;
}

function resolveResumeUrl(resume?: string): string {
  if (!resume) return '';
  if (/^https?:\/\//i.test(resume)) return resume;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${resume.startsWith('/') ? '' : '/'}${resume}`;
}

type EmployeeOption = { name: string; designation: string };

// Default CC on every candidate-management mail (interview round + rejection) —
// HR previously had to type this in by hand on every single send.
const DEFAULT_HR_CC = 'hr@briskolive.com';

const emptyRound = (): Omit<InterviewRound, '_id'> => ({
  roundNumber:           1,
  stage:                 '',
  schedulingStatus:      '',
  cancellationReason:    '',
  scheduledDate:         '',
  scheduledTime:         '',
  interviewer:           '',
  mode:                  '',
  meetingLink:           '',
  candidateConfirmation: 'Pending',
  note:                  '',
  feedback:              '',
  interviewerFeedbackStatus: '',
});

// Label/value row for the read-only detail table — compact (small font,
// tight padding) so a round's full details fit on screen without scrolling;
// bold headings, black data text, per explicit design feedback.
const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(110px,35%)_1fr] border-b border-gray-100 last:border-b-0">
    <div className="bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-gray-600">{label}</div>
    <div className="px-2.5 py-1 text-xs text-black break-words">{children}</div>
  </div>
);

// Boxed input styling for a DetailRow's value cell — a real bordered field
// (not the flush/no-border look HR found undefined and hard to see) so
// every editable control reads clearly as a field you can click into.
const rowControlClass = 'w-full border border-gray-300 rounded-md bg-white px-2.5 py-1.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400';
// Multi-line fields (Remarks, Cancellation Reason) keep a light border —
// free text benefits from a visible boundary even in an otherwise flush table.
const rowTextareaClass = `w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-black bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none ${FIELD_PLACEHOLDER_CLASS}`;

const RoundForm = ({
  data, onChange, onSave, onCancel, saving, interviewers, loadingInterviewers,
  existingRound, onSchedule, onReschedule, onCancelRound, onMarkDone, jdLink, resumeUrl, linkedin,
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
  jdLink?: string | null;
  resumeUrl?: string;
  linkedin?: string;
}) => {
  // Keep the currently-saved interviewer selectable even if they've since
  // left the employee master list, so editing an old round doesn't blank it.
  const interviewerOptions = data.interviewer && !interviewers.some((e) => e.name === data.interviewer)
    ? [{ name: data.interviewer, designation: '' }, ...interviewers]
    : interviewers;

  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <div className="border-t border-dashed border-gray-200">
      {/* Field order and layout match the read-only detail table exactly
          (shared DetailRow component) — Stage, Interviewer (2nd), Date &
          Time (combined, 12-hour display), Mode, Meeting Link, then the
          non-editable context rows (JD Link/Resume/Candidate Confirmation)
          inline for reference, then Note/Remarks/Cancellation Reason/
          Interviewer Feedback. Scheduling Status and Interviewer Feedback
          Status are deliberately NOT editable here — scheduling status only
          changes via the Schedule/Reschedule/Mark Done/Cancel actions below
          (shown once the round is saved), and interviewer feedback status
          is set only by the interviewer's own submission. */}
      <DetailRow label="Stage">
        <select value={data.stage || ''} onChange={(e) => onChange('stage', e.target.value)} className={rowControlClass}>
          <option value="">— Select stage —</option>
          {STAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </DetailRow>

      <DetailRow label="Interviewer Name">
        <select value={data.interviewer || ''} onChange={(e) => onChange('interviewer', e.target.value)} className={rowControlClass}>
          <option value="">— Select interviewer —</option>
          {loadingInterviewers
            ? <option disabled>Loading…</option>
            : interviewerOptions.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}{e.designation ? ` — ${e.designation}` : ''}
              </option>
            ))}
        </select>
      </DetailRow>

      <DetailRow label="Date & Time">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="datetime-local"
            value={data.scheduledDate && data.scheduledTime ? `${String(data.scheduledDate).slice(0, 10)}T${data.scheduledTime}` : ''}
            onChange={(e) => {
              const [d, t] = e.target.value.split('T');
              onChange('scheduledDate', d || '');
              onChange('scheduledTime', t || '');
            }}
            className={rowControlClass}
          />
          {data.scheduledDate && data.scheduledTime && (
            <span className="text-xs text-gray-400">{formatDateTime12h(data.scheduledDate, data.scheduledTime)}</span>
          )}
        </div>
      </DetailRow>

      <DetailRow label="Mode">
        <select value={data.mode || ''} onChange={(e) => onChange('mode', e.target.value)} className={rowControlClass}>
          <option value="">— Select mode —</option>
          {MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </DetailRow>

      <DetailRow label="Meeting Link / Location">
        <input
          value={data.meetingLink || ''}
          onChange={(e) => onChange('meetingLink', e.target.value)}
          placeholder="URL or physical location"
          className={`${rowControlClass} ${FIELD_PLACEHOLDER_CLASS}`}
        />
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
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CANDIDATE_CONFIRMATION_COLORS[data.candidateConfirmation || ''] || 'bg-gray-100 text-gray-600'}`}>
          {data.candidateConfirmation || 'Pending'}
        </span>
      </DetailRow>

      <DetailRow label="Note (if any)">
        <input
          value={data.note || ''}
          onChange={(e) => onChange('note', e.target.value)}
          placeholder="Any note about this round…"
          className={`${rowControlClass} ${FIELD_PLACEHOLDER_CLASS}`}
        />
      </DetailRow>

      <DetailRow label="Remarks">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span />
          <button
            type="button"
            onClick={() => setTemplateOpen(true)}
            className="flex-shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
          >
            {data.feedback ? 'Edit via template' : 'Use template'}
          </button>
        </div>
        <textarea
          value={data.feedback || ''}
          onChange={(e) => onChange('feedback', e.target.value)}
          rows={4}
          placeholder="Enter interview remarks…"
          className={rowTextareaClass}
        />
        <TemplateModal
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
          onInsert={(text: string) => onChange('feedback', text)}
          screenerName={data.interviewer || ''}
          existingText={data.feedback || ''}
          defaultRound={data.stage || 'Interview Round'}
          title="Interview Feedback Template"
          defaultResume={resumeUrl}
          defaultLinkedin={linkedin}
        />
      </DetailRow>

      {data.schedulingStatus === 'Cancelled' && (
        <DetailRow label="Cancellation Reason">
          <textarea
            value={data.cancellationReason || ''}
            onChange={(e) => onChange('cancellationReason', e.target.value)}
            rows={2}
            placeholder="Why was this round cancelled?"
            className={rowTextareaClass}
          />
        </DetailRow>
      )}

      <DetailRow label="Interviewer Feedback">
        {data.interviewerFeedbackStatus
          ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${INTERVIEWER_FEEDBACK_STATUS_COLORS[data.interviewerFeedbackStatus] || 'bg-gray-100 text-gray-600'}`}>
              {data.interviewerFeedbackStatus}
            </span>
          : <span className="text-gray-400 italic">—</span>}
      </DetailRow>

      {existingRound && existingRound.schedulingStatus !== 'Cancelled' && existingRound.schedulingStatus !== 'Done' && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-3 bg-gray-50 border-t border-gray-100">
          <button onClick={onSchedule} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 bg-white hover:bg-blue-50 rounded-lg transition">
            <CalendarClock size={13} /> Schedule
          </button>
          <button onClick={onReschedule} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 rounded-lg transition">
            <RefreshCw size={13} /> Reschedule
          </button>
          <button onClick={onMarkDone} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition">
            <CheckCircle2 size={13} /> Mark Done
          </button>
          <button onClick={onCancelRound} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 rounded-lg transition ml-auto">
            <Ban size={13} /> Cancel Round
          </button>
        </div>
      )}

      <div className="flex gap-2 justify-end px-3 py-3 bg-gray-50 border-t border-gray-100">
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
  type PreviousRoundFeedback = { stage: string; interviewer: string; interviewerFeedbackStatus: string; feedback: string };
  type PreviousFeedback = { screener: { name: string; status: string; notes: string } | null; previousRounds: PreviousRoundFeedback[] } | null;
  type MailContent = {
    to: string; cc: string; subject: string; body: string;
    previousFeedback: PreviousFeedback; willIncludeFeedbackLink: boolean;
  };
  const [mailModal, setMailModal] = useState<{
    open: boolean; type: 'schedule' | 'reschedule' | 'cancel'; round: InterviewRound | null;
    tab: 'interviewer' | 'candidate'; sentTabs: string[]; sending: boolean; reason: string;
    content: Partial<Record<'interviewer' | 'candidate', MailContent>>;
    loadingPreview: boolean; previewError: string | null;
  }>({
    open: false, type: 'schedule', round: null, tab: 'interviewer', sentTabs: [], sending: false, reason: '',
    content: {}, loadingPreview: false, previewError: null,
  });
  const [previousFeedbackOpen, setPreviousFeedbackOpen] = useState(false);

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
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || `Server returned ${res.status}`);
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      setEditingId(null);
      toast.success('Round updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save round');
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
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || `Server returned ${res.status}`);
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      setAdding(false);
      setNewRound(emptyRound());
      toast.success('Round added');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add round');
    } finally {
      setSaving(false);
    }
  };

  // ── Schedule / Reschedule / Cancel mail dialog ─────────────────────────
  const openMailModal = (type: 'schedule' | 'reschedule' | 'cancel', round: InterviewRound) => {
    setMailModal({
      open: true, type, round, tab: 'interviewer', sentTabs: [],
      sending: false, reason: type === 'cancel' ? (round.cancellationReason || '') : '',
      content: {}, loadingPreview: false, previewError: null,
    });
    setPreviousFeedbackOpen(false);
  };

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
          [tab]: {
            to: json.data.to || '', cc: m.content[tab]?.cc ?? DEFAULT_HR_CC, subject: json.data.subject, body: json.data.body,
            previousFeedback: json.data.previousFeedback || null,
            willIncludeFeedbackLink: !!json.data.willIncludeFeedbackLink,
          },
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

  const updateMailContent = (tab: 'interviewer' | 'candidate', field: 'to' | 'cc' | 'subject' | 'body', value: string) =>
    setMailModal((m) => ({
      ...m,
      content: {
        ...m.content,
        [tab]: {
          to: '', cc: '', subject: '', body: '', previousFeedback: null, willIncludeFeedbackLink: false,
          ...m.content[tab], [field]: value,
        },
      },
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

      {[...rounds].reverse().map((r, idx) => {
        const isEditing   = editingId === r._id;
        const isLatest    = idx === 0;
        // Default contracted — HR explicitly expands a round to see its
        // full info; only a round the user has clicked gets an entry here.
        const isCollapsed = collapsed[r._id] === undefined ? true : collapsed[r._id];

        return (
          <div key={r._id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition">
            {/* ── Header bar — click anywhere on it to collapse/expand ── */}
            <div
              onClick={() => toggleCollapse(r._id)}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-blue-50/60 border-b border-blue-100 cursor-pointer hover:bg-blue-50 transition"
            >
              <span className="flex-shrink-0 text-[11px] font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                Round {r.roundNumber}
              </span>
              {isLatest && (
                <span className="flex-shrink-0 text-[11px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded">
                  Latest
                </span>
              )}
              <span className="text-xs text-black"><span className="font-bold text-gray-600">Interviewer:</span> {r.interviewer || '—'}</span>
              <span className="text-xs text-black"><span className="font-bold text-gray-600">Date &amp; Time:</span> {formatDateTime12h(r.scheduledDate, r.scheduledTime)}</span>
              <span className="text-xs text-black"><span className="font-bold text-gray-600">Mode:</span> {r.mode || '—'}</span>

              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${SCHEDULING_STATUS_COLORS[r.schedulingStatus] || 'bg-gray-100 text-gray-600'}`}>
                {r.schedulingStatus || 'Not Scheduled'}
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
                    {r.schedulingStatus || 'Not Scheduled'}
                  </span>
                </DetailRow>
                {r.schedulingStatus === 'Cancelled' && (
                  <DetailRow label="Cancellation Reason">
                    {r.cancellationReason || <span className="text-gray-400 italic">—</span>}
                  </DetailRow>
                )}
                <DetailRow label="Interviewer Name">{r.interviewer || '—'}</DetailRow>
                <DetailRow label="Date & Time">{formatDateTime12h(r.scheduledDate, r.scheduledTime)}</DetailRow>
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

                <div className="flex justify-end items-center px-3 py-2.5 bg-gray-50">
                  {r.schedulingStatus === 'Done' ? (
                    <span className="text-xs font-semibold text-gray-400">
                      This round is marked Done and cannot be edited.
                    </span>
                  ) : (
                    <button
                      onClick={() => startEdit(r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  )}
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
                jdLink={jdLink}
                resumeUrl={resumeUrl}
                linkedin={record.linkedin}
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
            jdLink={jdLink}
            resumeUrl={resumeUrl}
            linkedin={record.linkedin}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl flex-shrink-0 ${mailModal.type === 'cancel' ? 'bg-red-700' : 'bg-slate-800'}`}>
              <p className="text-sm font-bold text-white">
                {mailModal.type === 'schedule' ? 'Schedule Interview' : mailModal.type === 'reschedule' ? 'Reschedule Interview' : 'Cancel Interview'} — Round {mailModal.round.roundNumber}
              </p>
              <button onClick={closeMailModal} className="text-white/70 hover:text-white transition"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
              {mailModal.type === 'cancel' && (
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={mailModal.reason}
                    onChange={(e) => setMailModal((m) => ({ ...m, reason: e.target.value }))}
                    rows={2}
                    placeholder="Why is this interview being cancelled?"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none placeholder:text-gray-400 placeholder:font-normal"
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
                  `w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm placeholder:text-gray-400 placeholder:font-normal ${
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
                        {/* Previous feedback — read-only, contracted (collapsed) by
                            default, separate from the editable body below so it
                            can't be accidentally edited away. Only ever present
                            for the interviewer's schedule/reschedule mail. */}
                        {current.previousFeedback && (current.previousFeedback.screener || current.previousFeedback.previousRounds.length > 0) && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                            <button
                              type="button"
                              onClick={() => setPreviousFeedbackOpen((o) => !o)}
                              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide"
                            >
                              Previous Feedback (included in mail)
                              {previousFeedbackOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            {previousFeedbackOpen && (
                              <div className="px-3 pb-3 space-y-2">
                                {current.previousFeedback.screener && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500">
                                      HR Screening{current.previousFeedback.screener.name ? ` — ${current.previousFeedback.screener.name}` : ''}
                                      {current.previousFeedback.screener.status ? ` (${current.previousFeedback.screener.status})` : ''}
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{current.previousFeedback.screener.notes || '—'}</p>
                                  </div>
                                )}
                                {current.previousFeedback.previousRounds.map((r, i) => (
                                  <div key={i}>
                                    <p className="text-xs font-semibold text-gray-500">
                                      {r.stage}{r.interviewer ? ` — ${r.interviewer}` : ''}{r.interviewerFeedbackStatus ? ` (${r.interviewerFeedbackStatus})` : ''}
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.feedback || '—'}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">To</label>
                          <input
                            value={current.to}
                            onChange={(e) => updateMailContent(mailModal.tab, 'to', e.target.value)}
                            readOnly={isDone}
                            placeholder={mailModal.tab === 'interviewer' ? "Interviewer's email" : "Candidate's email"}
                            className={fieldClass(!isDone)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                          <input
                            value={current.cc}
                            onChange={(e) => updateMailContent(mailModal.tab, 'cc', e.target.value)}
                            readOnly={isDone}
                            placeholder="cc1@company.com, cc2@company.com"
                            className={fieldClass(!isDone)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Subject</label>
                          <input
                            value={current.subject}
                            onChange={(e) => updateMailContent(mailModal.tab, 'subject', e.target.value)}
                            readOnly={isDone}
                            className={fieldClass(!isDone)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Body</label>
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
                          {mailModal.tab === 'interviewer' && mailModal.type !== 'cancel' && current.willIncludeFeedbackLink && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              A "Submit Interview Feedback" button linking to the feedback form is added automatically below this message.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl flex-wrap flex-shrink-0">
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
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">To</label>
                    <input
                      value={rejectionModal.to}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, to: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                    <input
                      value={rejectionModal.cc}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, cc: e.target.value }))}
                      placeholder="cc1@company.com, cc2@company.com"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Subject</label>
                    <input
                      value={rejectionModal.subject}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, subject: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Body</label>
                    <textarea
                      value={rejectionModal.body}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, body: e.target.value }))}
                      rows={10}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400 placeholder:font-normal"
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
