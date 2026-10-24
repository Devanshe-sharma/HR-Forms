// pages/Recruitment/RoundPipelineTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One component, parameterized by roundType ('hr' | 'tech' | 'mgmt'), used for
// all three tabs of the fixed HR -> Technical -> Management pipeline (see
// backend utils/roundPipeline.js). Replaces the old free-text-stage
// InterviewRoundTab + the separate ScreenerRoundTab — HR Round is now just
// roundType='hr' through this same component, not a distinct screening step.
//
// The structured "17-field HR background" the mockup shows is already
// available in this app via FeedbackTemplate.tsx's TemplateModal (Native,
// Residing, Commute, Age, Family, Experience, CTC/ECTC/Recommended CTC,
// Reason, Notice Period, When Can Join, Skills, Communication, Stability,
// Attitude/DISC, Education, Hobbies, Bond, Remarks — a superset of the
// mockup's fields) — it composes into the one `feedback` text field via the
// "Use template" button below, the same for every round type, so no separate
// structured form was rebuilt here.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  Loader2, Save, Plus, ClipboardList,
  RefreshCw,
  X, Send, Check, Ban, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FIELD_PLACEHOLDER_CLASS } from './ApplicantFieldComponents';
import { TemplateModal } from './FeedbackTemplate';
import { hasAnyRole } from '../../config/rbac';
import {
  ApplicantRecord, InterviewRound, HrBackground, RoundType, API_BASE,
  ROUND_TYPE_LABELS, hasPassedRound, roundLabel,
  MODE_OPTIONS,
  SCHEDULING_STATUS_COLORS,
  CANDIDATE_CONFIRMATION_COLORS,
  INTERVIEWER_FEEDBACK_STATUS_COLORS,
  HR_RECOMMENDATION_OPTIONS, MGMT_RECOMMENDATION_OPTIONS, BOND_OPTIONS, RATING_OPTIONS,
  DISC_TRAIT_LABELS,
} from './applicantTypes';

// The mockup's 17-field HR background subform — prefilled from the
// candidate's profile the first time an HR round is opened (see
// prefillHrBackground below), then independently editable.
const HR_BACKGROUND_FIELDS: { key: keyof HrBackground; label: string }[] = [
  { key: 'nativePlace',         label: 'Native Place' },
  { key: 'residingIn',          label: 'Residing In' },
  { key: 'commuteType',         label: 'Commute Type' },
  { key: 'age',                 label: 'Age' },
  { key: 'maritalStatus',       label: 'Marital Status' },
  { key: 'family',              label: 'Family' },
  { key: 'education',           label: 'Education' },
  { key: 'hobbies',             label: 'Hobbies' },
  { key: 'experienceSummary',   label: 'Experience' },
  { key: 'currentCtc',          label: 'Current CTC' },
  { key: 'pfApplicable',        label: 'PF Applicable' },
  { key: 'expectedCtc',         label: 'Expected CTC' },
  { key: 'recommendedCtc',      label: 'Recommended CTC' },
  { key: 'currentCompany',      label: 'Current Company' },
  { key: 'noticePeriodSummary', label: 'Notice Period' },
  { key: 'whenCanJoin',         label: 'When Can Join' },
  { key: 'reasonForLeaving',    label: 'Reason for Leaving' },
  { key: 'skillsSummary',       label: 'Skills' },
];

const EMPTY_HR_BACKGROUND: HrBackground = HR_BACKGROUND_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: '' }), {} as HrBackground,
);

// Best-effort prefill from the candidate's own application fields — only
// the ones this app actually captures; everything else (native place,
// residing in, commute, age, family, hobbies, PF, recommended CTC, when
// can join, reason for leaving) stays blank for HR to fill in during the
// interview. Never called once any field has already been edited.
function prefillHrBackground(record: ApplicantRecord): HrBackground {
  return {
    ...EMPTY_HR_BACKGROUND,
    experienceSummary:   record.total_experience ? `${record.total_experience} yrs` : '',
    currentCtc:          record.current_ctc || '',
    expectedCtc:         record.expected_monthly_ctc || '',
    noticePeriodSummary: record.notice_period || '',
    education:           record.highest_qualification || '',
  };
}

const recommendationOptionsFor = (roundType: RoundType) =>
  roundType === 'mgmt' ? MGMT_RECOMMENDATION_OPTIONS : HR_RECOMMENDATION_OPTIONS;

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

const DEFAULT_HR_CC = 'hr@briskolive.com';

// Label-above-control cell for the grid-based evaluation card, matching the
// mockup's form layout (several fields per row inside a white card) instead
// of the read-only detail table's label-left/value-right row style.
const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
    {children}
  </div>
);

const formControlClass = 'w-full border border-gray-300 rounded-lg bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#7a9c56] focus:border-[#7a9c56] disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed';
const formTextareaClass = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#7a9c56] resize-none disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed ${FIELD_PLACEHOLDER_CLASS}`;

const RoundForm = ({
  data, roundType, roundLabelText, onChange, onHrBackgroundChange, onSave, onCancel, saving, interviewers, loadingInterviewers,
  existingRound, onSchedule, onReschedule, onCancelRound, onMarkDone, resumeUrl, linkedin, discAssessment, excelTest,
  onMoveNext, moveNextLabel, movingNext, onSelect, selectLabel, onReject, readOnly,
}: {
  data: Partial<InterviewRound>;
  roundType: RoundType;
  roundLabelText: string;
  onChange: (f: string, v: string) => void;
  onHrBackgroundChange: (key: keyof HrBackground, v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  interviewers: EmployeeOption[];
  loadingInterviewers: boolean;
  existingRound?: InterviewRound;
  onSchedule?: () => void;
  onReschedule?: () => void;
  onCancelRound?: () => void;
  onMarkDone?: () => void;
  resumeUrl?: string;
  linkedin?: string;
  discAssessment?: { status?: string; primary?: 'D' | 'I' | 'S' | 'C' };
  excelTest?: { status?: string; score?: number };
  // Progression actions — shown alongside Save for the latest, still-open
  // round instance so HR can save feedback and move the candidate forward
  // (or reject them) in one place, matching the mockup's combined action row.
  onMoveNext?: () => void;
  moveNextLabel?: string;
  movingNext?: boolean;
  onSelect?: () => void;
  selectLabel?: string;
  onReject?: () => void;
  // Same layout as the editable form, every control just disabled — used
  // when the viewer can't (or hasn't switched into Edit mode to) edit this
  // round, instead of a separate, info-poorer read-only summary.
  readOnly?: boolean;
}) => {
  const interviewerOptions = data.interviewer && !interviewers.some((e) => e.name === data.interviewer)
    ? [{ name: data.interviewer, designation: '' }, ...interviewers]
    : interviewers;

  const [templateOpen, setTemplateOpen] = useState(false);

  // Auto-populate Attitude/DISC from the candidate's own completed DISC
  // test, same way prefillHrBackground seeds the other background fields —
  // only while the dropdown is still blank, so it never overwrites an
  // interviewer's own manual choice.
  useEffect(() => {
    if (roundType !== 'hr') return;
    if (data.attitude) return;
    if (discAssessment?.status === 'Completed' && discAssessment?.primary) {
      onChange('attitude', discAssessment.primary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundType, data.attitude, discAssessment?.status, discAssessment?.primary]);

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="px-4 pt-4 pb-1">
        <p className="text-sm font-bold text-black">{roundLabelText} evaluation</p>
      </div>

      <div className="px-4 pb-4 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Scheduling Status">
            <span className={`inline-flex items-center text-xs font-bold px-2 py-1.5 rounded-full ${SCHEDULING_STATUS_COLORS[data.schedulingStatus || ''] || 'bg-gray-100 text-gray-600'}`}>
              {data.schedulingStatus || 'Not Scheduled'}
            </span>
          </FormField>

          <FormField label="Interviewer">
            <select value={data.interviewer || ''} onChange={(e) => onChange('interviewer', e.target.value)} disabled={readOnly} className={formControlClass}>
              <option value="">— Select interviewer —</option>
              {loadingInterviewers
                ? <option disabled>Loading…</option>
                : interviewerOptions.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name}{e.designation ? ` — ${e.designation}` : ''}
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="Interview Date">
            <input
              type="date"
              value={data.scheduledDate ? String(data.scheduledDate).slice(0, 10) : ''}
              onChange={(e) => onChange('scheduledDate', e.target.value)}
              disabled={readOnly}
              className={formControlClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Interview Time">
            <input
              type="time"
              value={data.scheduledTime || ''}
              onChange={(e) => onChange('scheduledTime', e.target.value)}
              disabled={readOnly}
              className={formControlClass}
            />
          </FormField>

          <FormField label="Mode">
            <select value={data.mode || ''} onChange={(e) => onChange('mode', e.target.value)} disabled={readOnly} className={formControlClass}>
              <option value="">— Select mode —</option>
              {MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Meeting Link / Location">
            <input
              value={data.meetingLink || ''}
              onChange={(e) => onChange('meetingLink', e.target.value)}
              placeholder="URL or physical location"
              disabled={readOnly}
              className={`${formControlClass} ${FIELD_PLACEHOLDER_CLASS}`}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Candidate Confirmation">
            <span className={`inline-flex items-center text-xs font-bold px-2 py-1.5 rounded-full ${CANDIDATE_CONFIRMATION_COLORS[data.candidateConfirmation || ''] || 'bg-gray-100 text-gray-600'}`}>
              {data.candidateConfirmation || 'Pending'}
            </span>
          </FormField>
        </div>

        {roundType === 'hr' && (
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Candidate Background</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {HR_BACKGROUND_FIELDS.map(({ key, label }) => (
                <div key={key} className={key === 'skillsSummary' ? 'col-span-2 sm:col-span-4' : ''}>
                <FormField label={label}>
                  {key === 'family' || key === 'reasonForLeaving' || key === 'skillsSummary' ? (
                    <textarea
                      value={data.hrBackground?.[key] || ''}
                      onChange={(e) => onHrBackgroundChange(key, e.target.value)}
                      rows={key === 'skillsSummary' ? 3 : 2}
                      disabled={readOnly}
                      className={key === 'skillsSummary' ? formTextareaClass.replace('resize-none', 'resize-y') : formTextareaClass}
                    />
                  ) : key === 'pfApplicable' ? (
                    <select value={data.hrBackground?.[key] || ''} onChange={(e) => onHrBackgroundChange(key, e.target.value)} disabled={readOnly} className={formControlClass}>
                      <option value="">— Select —</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Not sure">Not sure</option>
                    </select>
                  ) : key === 'maritalStatus' ? (
                    <select value={data.hrBackground?.[key] || ''} onChange={(e) => onHrBackgroundChange(key, e.target.value)} disabled={readOnly} className={formControlClass}>
                      <option value="">— Select —</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  ) : (
                    <input
                      value={data.hrBackground?.[key] || ''}
                      onChange={(e) => onHrBackgroundChange(key, e.target.value)}
                      disabled={readOnly}
                      className={formControlClass}
                    />
                  )}
                </FormField>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Evaluation</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {roundType === 'hr' ? (
              <>
                <FormField label="Communication">
                  <select value={data.communication || ''} onChange={(e) => onChange('communication', e.target.value)} disabled={readOnly} className={formControlClass}>
                    <option value="">— Select —</option>
                    {RATING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Stability">
                  <input value={data.stability || ''} onChange={(e) => onChange('stability', e.target.value)} disabled={readOnly} className={formControlClass} />
                </FormField>
                <FormField label="Excel Test">
                  <div className={`${formControlClass} bg-gray-50 text-gray-700`}>
                    {excelTest?.status === 'Graded' ? `${excelTest.score}%` : excelTest?.status || 'Not sent'}
                  </div>
                </FormField>
                <div>
                  <FormField label="Attitude / DISC">
                    <select value={data.attitude || ''} onChange={(e) => onChange('attitude', e.target.value)} disabled={readOnly} className={formControlClass}>
                      <option value="">— Select —</option>
                      {(['D', 'I', 'S', 'C'] as const).map((t) => <option key={t} value={t}>{t} — {DISC_TRAIT_LABELS[t]}</option>)}
                    </select>
                  </FormField>
                  {!readOnly && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      {discAssessment?.status === 'Completed' && discAssessment?.primary
                        ? 'Auto-filled from the candidate\'s DISC test — change it if your own read differs.'
                        : 'Select the dominant behavioural style observed.'}
                    </p>
                  )}
                </div>
                <FormField label="Bond">
                  <select value={data.bond || ''} onChange={(e) => onChange('bond', e.target.value)} disabled={readOnly} className={formControlClass}>
                    <option value="">— Select —</option>
                    {BOND_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="HR Recommendation">
                  <select value={data.interviewerFeedbackStatus || ''} onChange={(e) => onChange('interviewerFeedbackStatus', e.target.value)} disabled={readOnly} className={formControlClass}>
                    <option value="">— Select —</option>
                    {recommendationOptionsFor(roundType).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Overall Rating">
                  <select value={data.rating || ''} onChange={(e) => onChange('rating', e.target.value)} disabled={readOnly} className={formControlClass}>
                    <option value="">— Select —</option>
                    {RATING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label={roundType === 'mgmt' ? 'Final Hiring Recommendation' : 'Technical Recommendation'}>
                  <select value={data.interviewerFeedbackStatus || ''} onChange={(e) => onChange('interviewerFeedbackStatus', e.target.value)} disabled={readOnly} className={formControlClass}>
                    <option value="">— Select —</option>
                    {recommendationOptionsFor(roundType).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
              </>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Recommendation can also be set by the interviewer via their feedback link.</p>
        </div>

        <FormField label={`${roundType === 'hr' ? 'HR' : roundType === 'mgmt' ? 'Manager' : 'Technical'} Remarks`}>
          {roundType !== 'hr' && !readOnly && (
            <div className="flex items-start justify-end gap-2 mb-1.5">
              <button
                type="button"
                onClick={() => setTemplateOpen(true)}
                className="flex-shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                {data.feedback ? 'Edit via template' : 'Use template'}
              </button>
            </div>
          )}
          <textarea
            value={data.feedback || ''}
            onChange={(e) => onChange('feedback', e.target.value)}
            rows={4}
            placeholder="Enter interview remarks…"
            disabled={readOnly}
            className={formTextareaClass}
          />
          {roundType !== 'hr' && (
            <TemplateModal
              open={templateOpen}
              onClose={() => setTemplateOpen(false)}
              onInsert={(text: string) => onChange('feedback', text)}
              screenerName={data.interviewer || ''}
              existingText={data.feedback || ''}
              defaultRound={roundLabelText}
              title={`${roundLabelText} Evaluation Template`}
              defaultResume={resumeUrl}
              defaultLinkedin={linkedin}
            />
          )}
        </FormField>

        {data.schedulingStatus === 'Cancelled' && (
          <FormField label="Cancellation Reason">
            <textarea
              value={data.cancellationReason || ''}
              onChange={(e) => onChange('cancellationReason', e.target.value)}
              rows={2}
              placeholder="Why was this round cancelled?"
              disabled={readOnly}
              className={formTextareaClass}
            />
          </FormField>
        )}
      </div>

      {!readOnly && existingRound && existingRound.schedulingStatus !== 'Cancelled' && existingRound.schedulingStatus !== 'Done' && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50 border-t border-gray-100">
          <button onClick={onMarkDone} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition">
            <CheckCircle2 size={13} /> Mark Done
          </button>
          <button onClick={onCancelRound} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 rounded-lg transition ml-auto">
            <Ban size={13} /> Cancel Round
          </button>
        </div>
      )}

      {!readOnly && (
      <div className="flex gap-2 justify-start flex-wrap px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save Feedback
        </button>
        {onMoveNext && (
          <button
            onClick={onMoveNext}
            disabled={saving || movingNext}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition"
          >
            {movingNext ? <Loader2 size={13} className="animate-spin" /> : null} {moveNextLabel}
          </button>
        )}
        {onSelect && (
          <button
            onClick={onSelect}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition"
          >
            {selectLabel}
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-600 border border-red-500 bg-white hover:bg-red-50 disabled:opacity-60 rounded-lg transition"
          >
            Reject &amp; Email
          </button>
        )}
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition ml-1">Discard changes</button>
      </div>
      )}
    </div>
  );
};

const RoundPipelineTab = ({
  record,
  roundType,
  onUpdate,
  canEdit = true,
}: {
  record: ApplicantRecord;
  roundType: RoundType;
  onUpdate: (updated: ApplicantRecord) => void;
  canEdit?: boolean;
}) => {
  const allRounds = record.interviewRounds ?? [];
  const rounds = allRounds.filter((r) => r.roundType === roundType);
  const typeLabel = ROUND_TYPE_LABELS[roundType];

  const [drafts,    setDrafts]    = useState<Record<string, Partial<InterviewRound>>>({});
  const [adding,    setAdding]    = useState(false);
  const [newRound,  setNewRound]  = useState<Partial<InterviewRound>>({});
  const [saving,    setSaving]    = useState(false);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [interviewers,        setInterviewers]        = useState<EmployeeOption[]>([]);
  const [loadingInterviewers, setLoadingInterviewers]  = useState(true);
  type MailContent = {
    to: string; cc: string; subject: string; body: string;
    willIncludeFeedbackLink: boolean;
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

  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean; to: string; cc: string; subject: string; body: string;
    loading: boolean; sending: boolean; error: string;
  }>({ open: false, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  // "You're selected" mail — mirrors rejectionModal exactly, used by both
  // "Select Candidate & Email" (Management round) and "Select Without
  // Management Round" (Technical round, HR-role only).
  const [selectionModal, setSelectionModal] = useState<{
    open: boolean; to: string; cc: string; subject: string; body: string;
    loading: boolean; sending: boolean; error: string;
  }>({ open: false, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  const openSelectionModal = async () => {
    setSelectionModal((m) => ({ ...m, open: true, loading: true, error: '' }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/selection-mail/preview`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load selection mail');
      setSelectionModal((m) => ({ ...m, loading: false, to: json.data.to, cc: '', subject: json.data.subject, body: json.data.body }));
    } catch (e: any) {
      setSelectionModal((m) => ({ ...m, loading: false, error: e.message || 'Failed to load selection mail' }));
    }
  };

  const sendSelectionMail = async () => {
    setSelectionModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/selection-mail/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to: selectionModal.to.trim() || undefined,
          cc: selectionModal.cc.trim() || undefined,
          subject: selectionModal.subject,
          customBody: selectionModal.body,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send selection mail');
      toast.success(`Selection mail sent to ${json.data.sentTo}`);
      setSelectionModal((m) => ({ ...m, open: false, sending: false }));
      onUpdate(json.data.record);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send selection mail');
      setSelectionModal((m) => ({ ...m, sending: false }));
    }
  };

  // "Shortlist Candidate & Email" — HR round's early, pre-interview quick
  // action (mirrors the mockup's `idx(c)<2` shortlist step): a one-time
  // notice sent before scheduling/evaluation even happens, distinct from
  // the later selection mail. Mirrors selectionModal exactly.
  const [shortlistModal, setShortlistModal] = useState<{
    open: boolean; to: string; cc: string; subject: string; body: string;
    loading: boolean; sending: boolean; error: string;
  }>({ open: false, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  const openShortlistModal = async () => {
    setShortlistModal((m) => ({ ...m, open: true, loading: true, error: '' }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/shortlist-mail/preview`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load shortlist mail');
      setShortlistModal((m) => ({ ...m, loading: false, to: json.data.to, cc: '', subject: json.data.subject, body: json.data.body }));
    } catch (e: any) {
      setShortlistModal((m) => ({ ...m, loading: false, error: e.message || 'Failed to load shortlist mail' }));
    }
  };

  const sendShortlistMail = async () => {
    setShortlistModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/shortlist-mail/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to: shortlistModal.to.trim() || undefined,
          cc: shortlistModal.cc.trim() || undefined,
          subject: shortlistModal.subject,
          customBody: shortlistModal.body,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send shortlist mail');
      toast.success(`Shortlist mail sent to ${json.data.sentTo}`);
      setShortlistModal((m) => ({ ...m, open: false, sending: false }));
      onUpdate(json.data.record);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send shortlist mail');
      setShortlistModal((m) => ({ ...m, sending: false }));
    }
  };

  // "Move to {Next Round} & Email" — creates the next round, then opens the
  // existing schedule-mail compose for it. Hidden once a round of the next
  // type already exists (HR should use that tab instead of creating a dup).
  const [movingNext, setMovingNext] = useState(false);
  const nextRoundType: RoundType | null = roundType === 'hr' ? 'tech' : roundType === 'tech' ? 'mgmt' : null;
  const nextRoundExists = !!nextRoundType && allRounds.some((r) => r.roundType === nextRoundType);

  const moveToNextRound = async () => {
    if (!nextRoundType) return;
    setMovingNext(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ roundType: nextRoundType }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to create the next round');
      onUpdate(json.data);
      toast.success(`Moved to ${ROUND_TYPE_LABELS[nextRoundType]}`);
      const createdRounds = (json.data.interviewRounds || []).filter((r: InterviewRound) => r.roundType === nextRoundType);
      const created = createdRounds[createdRounds.length - 1];
      if (created) openMailModal('schedule', created);
    } catch (e: any) {
      toast.error(e.message || 'Failed to move to the next round');
    } finally {
      setMovingNext(false);
    }
  };

  const isPositiveRec = (status: string) =>
    roundType === 'mgmt' ? ['Select', 'Select with Conditions'].includes(status) : ['Recommended as P1', 'Recommended as P2'].includes(status);

  // Whether this round type's prerequisite has passed — HR has none;
  // Technical needs HR passed; Management needs Technical passed.
  const prevType: RoundType | null = roundType === 'hr' ? null : roundType === 'tech' ? 'hr' : 'tech';
  const gateMessage = prevType && !hasPassedRound(allRounds, prevType)
    ? `The ${ROUND_TYPE_LABELS[prevType]} must be passed (Done, with a positive recommendation) before the ${typeLabel} can start.`
    : null;


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

  // Keep the pill-tab selection pointed at the most recently created round
  // whenever the list changes (new round added, or first load).
  useEffect(() => {
    if (rounds.length === 0) { setActiveRoundId(null); return; }
    if (!activeRoundId || !rounds.some((r) => r._id === activeRoundId)) {
      setActiveRoundId(rounds[rounds.length - 1]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length, rounds[rounds.length - 1]?._id]);

  const ensureDraft = (r: InterviewRound) => {
    let draft: Partial<InterviewRound> = { ...r };
    // First time an HR round is opened with the background subform still
    // all-blank, seed it from the candidate's own profile fields — never
    // once any field has actually been edited and saved.
    if (r.roundType === 'hr') {
      const hb = r.hrBackground;
      const isBlank = !hb || HR_BACKGROUND_FIELDS.every(({ key }) => !hb[key]);
      if (isBlank) draft = { ...draft, hrBackground: prefillHrBackground(record) };
    }
    setDrafts((p) => (p[r._id] ? p : { ...p, [r._id]: draft }));
  };

  // The evaluation form stays open and editable at all times — including
  // after a round is marked Done — rather than requiring an explicit "Edit"
  // click first; seed its draft as soon as it becomes the active pill.
  useEffect(() => {
    if (!canEdit || !activeRoundId) return;
    const r = rounds.find((x) => x._id === activeRoundId);
    if (r) ensureDraft(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoundId, canEdit]);

  const handleDraftChange = (id: string, field: string, value: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));

  const handleHrBackgroundChange = (id: string, key: keyof HrBackground, value: string) =>
    setDrafts((p) => ({
      ...p,
      [id]: { ...p[id], hrBackground: { ...(p[id]?.hrBackground || EMPTY_HR_BACKGROUND), [key]: value } },
    }));

  const saveRound = async (id: string, { silent = false }: { silent?: boolean } = {}): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(drafts[id]),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || `Server returned ${res.status}`);
      onUpdate(json.data);
      if (!silent) toast.success('Round updated');
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Failed to save round');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save-then-progress — used by the combined "Move/Select/Reject & Email"
  // buttons so HR's latest feedback edits aren't lost when they act on them
  // in the same click, rather than requiring a separate explicit Save first.
  //
  // Moving to the next round also marks THIS round Done (same evaluation
  // fields required, same lock as the explicit "Mark Done" button) — this
  // round can't still be "in progress" once the candidate has moved past
  // it, and locking it is what stops "Move to Next Round" from reappearing
  // and being clickable again on a later visit to this tab.
  const saveAndMoveNext = async (id: string) => {
    const round = rounds.find((r) => r._id === id);
    if (!round) return;
    const data = drafts[id] || round;
    const missing = missingBeforeDone(data);
    if (missing.length) {
      toast.error(`Please fill in before moving to the next round: ${missing.join(', ')}`);
      return;
    }
    try {
      await patchRound(id, { ...data, schedulingStatus: 'Done' });
    } catch {
      toast.error('Failed to save round');
      return;
    }
    moveToNextRound();
  };
  const saveAndSelect   = async (id: string) => { if (await saveRound(id, { silent: true })) openSelectionModal(); };
  const saveAndReject   = async (id: string) => { if (await saveRound(id, { silent: true })) openRejectionModal(); };

  const addRound = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...newRound, roundType }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || `Server returned ${res.status}`);
      onUpdate(json.data);
      setAdding(false);
      setNewRound({});
      toast.success(`${typeLabel} added`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add round');
    } finally {
      setSaving(false);
    }
  };

  const openMailModal = (type: 'schedule' | 'reschedule' | 'cancel', round: InterviewRound) => {
    setMailModal({
      open: true, type, round, tab: 'interviewer', sentTabs: [],
      sending: false, reason: type === 'cancel' ? (round.cancellationReason || '') : '',
      content: {}, loadingPreview: false, previewError: null,
    });
  };

  const closeMailModal = () => setMailModal((m) => ({ ...m, open: false }));

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
          [tab]: {
            to: json.data.to || '', cc: m.content[tab]?.cc ?? DEFAULT_HR_CC, subject: json.data.subject, body: json.data.body,
            willIncludeFeedbackLink: !!json.data.willIncludeFeedbackLink,
          },
        },
      }));
    } catch (e: any) {
      console.error('[preview-mail] failed:', e);
      setMailModal((m) => ({ ...m, loadingPreview: false, previewError: e.message || 'Failed to load mail content' }));
    }
  };

  useEffect(() => {
    if (!mailModal.open || !mailModal.round) return;
    if (mailModal.type === 'cancel') {
      (['interviewer', 'candidate'] as const).forEach((t) => {
        if (!mailModal.content[t]) fetchPreview(t, mailModal.round!, mailModal.type, mailModal.reason);
      });
      return;
    }
    if (mailModal.content[mailModal.tab]) return;
    fetchPreview(mailModal.tab, mailModal.round, mailModal.type, mailModal.reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailModal.open, mailModal.tab, mailModal.round?._id, mailModal.type]);

  const updateMailContent = (tab: 'interviewer' | 'candidate', field: 'to' | 'cc' | 'subject' | 'body', value: string) =>
    setMailModal((m) => ({
      ...m,
      content: {
        ...m.content,
        [tab]: {
          to: '', cc: '', subject: '', body: '', willIncludeFeedbackLink: false,
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

  // Missing-field check shared by "Mark Done" and "Move to Next Round" —
  // both end with the round locked as Done, so both need the same
  // evaluation fields filled in first (otherwise a round can get locked
  // with blank interviewer/recommendation/remarks and no way back short of
  // the reopen escape hatch below).
  const missingBeforeDone = (data: Partial<InterviewRound>): string[] => {
    const missing: string[] = [];
    if (!data.interviewer) missing.push('Interviewer');
    if (!data.scheduledDate) missing.push('Interview Date');
    if (!data.interviewerFeedbackStatus) missing.push('Recommendation');
    if (!data.feedback) missing.push('Remarks');
    return missing;
  };

  // Marking a round Done locks it forever (the backend refuses further
  // PATCHes once it's Done) — this saves whatever's currently in the draft
  // and sets it Done in the same call.
  const markRoundDone = async (round: InterviewRound) => {
    const data = drafts[round._id] || round;
    const missing = missingBeforeDone(data);
    if (missing.length) {
      toast.error(`Please fill in before marking done: ${missing.join(', ')}`);
      return;
    }
    try {
      await patchRound(round._id, { ...data, schedulingStatus: 'Done' });
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

  // Excel Test / DISC assessment status — shown on every round's read-only
  // Candidate Summary once a test has been sent, so HR/Technical/Management
  // interviewers all see the same score as soon as it's graded, instead of
  // only whichever round happened to show it first.
  const excelTest = (record as any).excelTest;
  const discAssessment = (record as any).discAssessment;

  if (!canEdit && rounds.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No {typeLabel.toLowerCase()} activity yet. Only the relevant interviewer or HR can schedule this round.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {gateMessage && (
        <div className="p-3 rounded-xl border border-amber-100 bg-amber-50 text-sm text-amber-800">
          {gateMessage}
        </div>
      )}

      {!gateMessage && (() => {
        const lastRound = rounds[rounds.length - 1];
        const canAddAnotherInstance = !lastRound || lastRound.schedulingStatus === 'Done' || lastRound.schedulingStatus === 'Cancelled';

        return (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {canEdit && !gateMessage && (
              canAddAnotherInstance ? (
                <button
                  onClick={() => {
                    setNewRound(roundType === 'hr' ? { hrBackground: prefillHrBackground(record) } : {});
                    setAdding(true);
                  }}
                  className={`flex items-center gap-1 flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border-2 border-dashed transition ${
                    adding
                      ? 'bg-[#eef3e6] border-[#7a9c56] text-[#3d5420]'
                      : 'border-gray-200 text-gray-400 hover:border-[#7a9c56] hover:text-[#597e37]'
                  }`}
                >
                  <Plus size={13} /> Add {typeLabel}
                </button>
              ) : (
                <span className="text-xs text-gray-400 italic flex-shrink-0">
                  Mark {lastRound.stage || roundLabel(roundType, lastRound.roundNumber)} as Done or Cancelled before adding another.
                </span>
              )
            )}
          </div>
        );
      })()}

      {!adding && !gateMessage && (() => {
        const r = rounds.find((x) => x._id === activeRoundId) || null;
        // Whether an actual Schedule/Reschedule mail has been sent — NOT
        // just whether scheduledDate/scheduledTime happen to be filled in.
        // Those two fields are also directly editable in the form above and
        // can get saved via the plain "Save Feedback" button with no mail
        // ever going out, which used to make this wrongly show "Reschedule"
        // (and the "Scheduled:" banner below) even though nothing had
        // actually been scheduled yet.
        const isScheduled = r?.schedulingStatus === 'Scheduled' || r?.schedulingStatus === 'Rescheduled';
        const ivLabel = roundType === 'hr' ? 'HR Interview' : roundType === 'tech' ? 'Technical Interview' : 'Management Interview';
        const canShortlist = roundType === 'hr' && canEdit && !record.shortlistedAt;

        return (
          <>
            {canEdit && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    if (!r) { setNewRound(roundType === 'hr' ? { hrBackground: prefillHrBackground(record) } : {}); setAdding(true); return; }
                    // The mail preview is built server-side from the saved
                    // round, not from whatever's currently typed into the
                    // form — so any unsaved Date/Time/Mode/Meeting Link
                    // edits must be saved first, or the mail would show
                    // "To be confirmed"/"To be decided" even though the
                    // form on screen has real values in it.
                    if (drafts[r._id]) {
                      const saved = await saveRound(r._id, { silent: true });
                      if (!saved) return;
                    }
                    openMailModal(isScheduled ? 'reschedule' : 'schedule', r);
                  }}
                  disabled={!r && rounds.length > 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition"
                >
                  Schedule {ivLabel}
                </button>
                {canShortlist && (
                  <button
                    onClick={openShortlistModal}
                    className="px-4 py-2 text-sm font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition"
                  >
                    Shortlist Candidate &amp; Email
                  </button>
                )}
              </div>
            )}

            {!r && (
              <div className="border border-gray-200 rounded-xl bg-white px-4 py-4 text-sm text-gray-600">
                No {typeLabel} has been scheduled yet. Use "Schedule {ivLabel}" above or add a round.
              </div>
            )}

            {r && (
              <div className="border border-gray-200 rounded-xl bg-white px-4 py-3 flex items-center gap-3 flex-wrap text-sm">
                {isScheduled ? (
                  <span className="text-gray-700">
                    Scheduled: <b>{formatDateTime12h(r.scheduledDate, r.scheduledTime)}</b> with {r.interviewer || '—'}
                    {r.meetingLink && (
                      /^https?:\/\//i.test(r.meetingLink)
                        ? <> · <a href={r.meetingLink} target="_blank" rel="noreferrer" className="text-blue-600 underline">{r.meetingLink}</a></>
                        : <> · {r.meetingLink}</>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-500">Interview not scheduled yet.</span>
                )}
                {isScheduled && canEdit && r.schedulingStatus !== 'Done' && r.schedulingStatus !== 'Cancelled' && (
                  <button
                    onClick={async () => {
                      if (drafts[r._id]) {
                        const saved = await saveRound(r._id, { silent: true });
                        if (!saved) return;
                      }
                      openMailModal('reschedule', r);
                    }}
                    className="text-xs font-semibold text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 px-2.5 py-1 rounded-lg transition"
                  >
                    Reschedule
                  </button>
                )}
                {isScheduled && r.schedulingStatus !== 'Done' && canEdit && (
                  <button onClick={() => markRoundDone(r)} className="text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-2.5 py-1 rounded-lg transition">
                    Mark Interview Completed
                  </button>
                )}
                <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${SCHEDULING_STATUS_COLORS[r.schedulingStatus] || 'bg-gray-100 text-gray-600'}`}>
                  {r.schedulingStatus || 'Not Scheduled'}
                </span>
              </div>
            )}
          </>
        );
      })()}

      {!adding && !gateMessage && rounds.length > 0 && (() => {
        const priorTypes: RoundType[] = roundType === 'tech' ? ['hr'] : roundType === 'mgmt' ? ['hr', 'tech'] : [];
        const priorRounds = allRounds.filter((r) => priorTypes.includes(r.roundType) && r.schedulingStatus === 'Done');
        return (
          <details className="border border-gray-200 rounded-xl overflow-hidden">
            <summary className="px-3 py-2 bg-gray-50 text-sm font-bold text-gray-700 cursor-pointer select-none">
              Previous Feedback {priorRounds.length ? `(${priorRounds.length})` : ''}
            </summary>
            <div className="divide-y divide-gray-100">
              {priorRounds.length ? priorRounds.map((r) => (
                <div key={r._id} className="p-3 text-xs space-y-1">
                  <p className="font-bold text-gray-700">
                    {r.stage || roundLabel(r.roundType, r.roundNumber)} <span className="font-normal text-gray-400">· {r.interviewer || '—'} · {formatDateTime12h(r.scheduledDate, r.scheduledTime)}</span>
                  </p>
                  {r.interviewerFeedbackStatus && (
                    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${INTERVIEWER_FEEDBACK_STATUS_COLORS[r.interviewerFeedbackStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {r.interviewerFeedbackStatus}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap text-gray-600">{r.feedback || <span className="italic text-gray-400">No remarks recorded</span>}</p>
                </div>
              )) : <p className="p-3 text-xs text-gray-400 italic">No previous feedback available.</p>}
            </div>
          </details>
        );
      })()}

      {!adding && rounds.filter((r) => r._id === activeRoundId).map((r) => {
        const isFormMode = canEdit;
        const isLatest    = r._id === rounds[rounds.length - 1]._id;

        return (
          <div key={r._id}>
            <RoundForm
              data={drafts[r._id] || r}
              roundType={roundType}
              roundLabelText={r.stage || roundLabel(roundType, r.roundNumber)}
              onChange={(f, v) => handleDraftChange(r._id, f, v)}
              onHrBackgroundChange={(k, v) => handleHrBackgroundChange(r._id, k, v)}
              onSave={() => saveRound(r._id)}
              onCancel={() => setDrafts((p) => ({ ...p, [r._id]: r }))}
              saving={saving}
              interviewers={interviewers}
              loadingInterviewers={loadingInterviewers}
              existingRound={r}
              onSchedule={() => openMailModal('schedule', r)}
              onReschedule={() => openMailModal('reschedule', r)}
              onCancelRound={() => openMailModal('cancel', r)}
              onMarkDone={() => markRoundDone(r)}
              resumeUrl={resumeUrl}
              linkedin={record.linkedin}
              discAssessment={discAssessment}
              excelTest={excelTest}
              readOnly={!isFormMode}
              onMoveNext={isFormMode && isLatest && roundType !== 'mgmt' && !nextRoundExists ? () => saveAndMoveNext(r._id) : undefined}
              moveNextLabel={nextRoundType ? `Move to ${ROUND_TYPE_LABELS[nextRoundType]} & Email` : undefined}
              movingNext={movingNext}
              onSelect={
                isFormMode && isLatest && roundType === 'tech' && hasAnyRole(['Admin', 'HR']) ? () => saveAndSelect(r._id)
                  : isFormMode && isLatest && roundType === 'mgmt' ? () => saveAndSelect(r._id)
                  : undefined
              }
              selectLabel={roundType === 'tech' ? 'Select Without Management Round' : 'Select Candidate & Email'}
              onReject={isFormMode && isLatest ? () => saveAndReject(r._id) : undefined}
            />
          </div>
        );
      })}

      {adding && (
        <div className="border border-[#cddcb8] rounded-xl overflow-hidden bg-[#eef3e6]/40">
          <p className="text-sm font-bold text-gray-700 px-3 pt-3">New {typeLabel} — #{rounds.length + 1}</p>
          <RoundForm
            data={newRound}
            roundType={roundType}
            roundLabelText={roundLabel(roundType, rounds.length + 1)}
            onChange={(f, v) => setNewRound((p) => ({ ...p, [f]: v }))}
            onHrBackgroundChange={(k, v) => setNewRound((p) => ({ ...p, hrBackground: { ...(p.hrBackground || EMPTY_HR_BACKGROUND), [k]: v } }))}
            onSave={addRound}
            onCancel={() => { setAdding(false); setNewRound({}); }}
            saving={saving}
            interviewers={interviewers}
            loadingInterviewers={loadingInterviewers}
            resumeUrl={resumeUrl}
            linkedin={record.linkedin}
            discAssessment={discAssessment}
            excelTest={excelTest}
          />
        </div>
      )}

      {mailModal.open && mailModal.round && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={closeMailModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl flex-shrink-0 ${mailModal.type === 'cancel' ? 'bg-red-700' : 'bg-slate-800'}`}>
              <p className="text-sm font-bold text-white">
                {mailModal.type === 'schedule' ? 'Schedule Interview' : mailModal.type === 'reschedule' ? 'Reschedule Interview' : 'Cancel Interview'} — {mailModal.round.stage || roundLabel(roundType, mailModal.round.roundNumber)}
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

              {mailModal.type === 'cancel' && mailModal.round && (() => {
                const round = mailModal.round;
                return (
                  <>
                    <div className="border border-blue-100 bg-blue-50/60 rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Interview Details</p>
                      <div className="space-y-0.5 text-sm text-gray-800">
                        <p><span className="font-semibold">Candidate:</span> {record.full_name}</p>
                        <p><span className="font-semibold">Position:</span> {record.designation}</p>
                        <p><span className="font-semibold">Interviewer:</span> {round.interviewer || '—'}</p>
                        <p><span className="font-semibold">Scheduled Date:</span> {round.scheduledDate ? new Date(round.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'TBD'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2 rounded-lg">
                      <AlertTriangle size={14} className="flex-shrink-0" /> Send cancellation notifications before finalizing.
                    </div>

                    {(['interviewer', 'candidate'] as const).map((tab) => {
                      const content = mailModal.content[tab];
                      const sent = mailModal.sentTabs.includes(tab);
                      const name = tab === 'interviewer' ? (round.interviewer || '—') : record.full_name;
                      return (
                        <div
                          key={tab}
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${sent ? 'bg-green-50 border-green-200' : 'border-gray-200'}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                              {tab === 'interviewer' ? 'Interviewer' : 'Candidate'}: {name}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === 'interviewer' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                {tab === 'interviewer' ? 'with reason' : 'no reason'}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {content?.to || (mailModal.loadingPreview ? 'Loading…' : 'No email on file')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSendMail(tab)}
                            disabled={mailModal.sending || sent || !mailModal.reason.trim() || !content?.to}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                              sent ? 'bg-gray-200 text-gray-500' : 'text-white bg-[#597e37] hover:bg-[#3d5420] disabled:opacity-50'
                            }`}
                          >
                            {sent ? <><Check size={13} /> Sent</> : <><Send size={13} /> Send</>}
                          </button>
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {mailModal.type !== 'cancel' && (
              <>
              <div className="flex gap-2">
                {(['interviewer', 'candidate'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setMailModal((m) => ({ ...m, tab }))}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition ${
                      mailModal.tab === tab ? 'bg-[#597e37] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'interviewer' ? 'Mail to Interviewer' : 'Mail to Candidate'}
                    {mailModal.sentTabs.includes(tab) && ' ✓'}
                  </button>
                ))}
              </div>

              {(() => {
                const isDone = ['Done', 'Cancelled'].includes(mailModal.round.schedulingStatus);
                const current = mailModal.content[mailModal.tab];
                const fieldClass = (editable: boolean) =>
                  `w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm placeholder:text-gray-400 placeholder:font-normal ${
                    editable ? 'focus:outline-none focus:ring-2 focus:ring-[#7a9c56]' : 'bg-gray-50 text-gray-600'
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
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-[#597e37] disabled:opacity-50 transition"
                        title="Regenerate from the current round details"
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
                          {mailModal.tab === 'candidate' && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              A Yes / Maybe / Can't-attend confirmation block is added automatically below this message.
                            </p>
                          )}
                          {mailModal.tab === 'interviewer' && current.willIncludeFeedbackLink && (
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
              </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl flex-wrap flex-shrink-0">
              <button onClick={closeMailModal} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Close</button>
              {mailModal.type === 'cancel' ? (
                <>
                  <button
                    onClick={finalizeCancellation}
                    disabled={!mailModal.reason.trim()}
                    className="px-3 py-1.5 text-sm font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 rounded-lg transition"
                  >
                    Cancel Without Email
                  </button>
                  <button
                    onClick={finalizeCancellation}
                    disabled={!mailModal.reason.trim() || !(mailModal.sentTabs.includes('interviewer') && mailModal.sentTabs.includes('candidate'))}
                    className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition"
                    title={!(mailModal.sentTabs.includes('interviewer') && mailModal.sentTabs.includes('candidate')) ? 'Send both notifications first, or use "Cancel Without Email"' : undefined}
                  >
                    Finalize Cancellation
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleSendMail(mailModal.tab)}
                  disabled={mailModal.sending || mailModal.sentTabs.includes(mailModal.tab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#597e37] hover:bg-[#3d5420] disabled:opacity-60 rounded-lg transition"
                >
                  {mailModal.sending
                    ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                    : mailModal.sentTabs.includes(mailModal.tab)
                      ? <><Check size={14} /> Sent</>
                      : <><Send size={14} /> Send</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

      {selectionModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectionModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl bg-green-700">
              <p className="text-sm font-bold text-white">Send Selection Mail</p>
              <button onClick={() => setSelectionModal((m) => ({ ...m, open: false }))} className="text-white/70 hover:text-white transition"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-2.5">
              {selectionModal.loading ? (
                <p className="text-sm text-gray-400 italic">Loading…</p>
              ) : selectionModal.error && !selectionModal.subject ? (
                <p className="text-sm text-red-500">{selectionModal.error}</p>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">To</label>
                    <input
                      value={selectionModal.to}
                      onChange={(e) => setSelectionModal((m) => ({ ...m, to: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                    <input
                      value={selectionModal.cc}
                      onChange={(e) => setSelectionModal((m) => ({ ...m, cc: e.target.value }))}
                      placeholder="cc1@company.com, cc2@company.com"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Subject</label>
                    <input
                      value={selectionModal.subject}
                      onChange={(e) => setSelectionModal((m) => ({ ...m, subject: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Body</label>
                    <textarea
                      value={selectionModal.body}
                      onChange={(e) => setSelectionModal((m) => ({ ...m, body: e.target.value }))}
                      rows={10}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setSelectionModal((m) => ({ ...m, open: false }))} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
              <button
                onClick={sendSelectionMail}
                disabled={selectionModal.sending || selectionModal.loading || !selectionModal.subject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition"
              >
                {selectionModal.sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {shortlistModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setShortlistModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl bg-indigo-700">
              <p className="text-sm font-bold text-white">Send Shortlist Mail</p>
              <button onClick={() => setShortlistModal((m) => ({ ...m, open: false }))} className="text-white/70 hover:text-white transition"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-2.5">
              {shortlistModal.loading ? (
                <p className="text-sm text-gray-400 italic">Loading…</p>
              ) : shortlistModal.error && !shortlistModal.subject ? (
                <p className="text-sm text-red-500">{shortlistModal.error}</p>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">To</label>
                    <input
                      value={shortlistModal.to}
                      onChange={(e) => setShortlistModal((m) => ({ ...m, to: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                    <input
                      value={shortlistModal.cc}
                      onChange={(e) => setShortlistModal((m) => ({ ...m, cc: e.target.value }))}
                      placeholder="cc1@company.com, cc2@company.com"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Subject</label>
                    <input
                      value={shortlistModal.subject}
                      onChange={(e) => setShortlistModal((m) => ({ ...m, subject: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5 block">Body</label>
                    <textarea
                      value={shortlistModal.body}
                      onChange={(e) => setShortlistModal((m) => ({ ...m, body: e.target.value }))}
                      rows={10}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShortlistModal((m) => ({ ...m, open: false }))} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
              <button
                onClick={sendShortlistMail}
                disabled={shortlistModal.sending || shortlistModal.loading || !shortlistModal.subject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition"
              >
                {shortlistModal.sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundPipelineTab;
