// pages/Recruitment/AllApplicants.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail, Phone, Loader2, Eye, X, ClipboardList, CheckSquare, User, UserCheck,
  ExternalLink, Video, Search, SlidersHorizontal, RotateCcw, ArrowUpDown, Sparkles, Lock, History,
  Briefcase, TrendingUp, Clock, Hourglass, ChevronDown, ChevronRight,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import CandidateInformationTab from './CandidateInformationTab';
import RoundPipelineTab from './RoundPipelineTab';
import EditCandidateInfoModal from './EditCandidateInfoModal';
import { hasAnyRole, getRole } from '../../config/rbac';

import {
  ApplicantRecord, API_BASE,
  INTERVIEW_FINAL_STATUS_OPTIONS, INTERVIEW_FINAL_STATUS_COLORS,
  STATUS_COLORS, ROUND_TYPE_LABELS, hasPassedRound,
} from './applicantTypes';

// CTC/offer figures and the Management Round are restricted to HR,
// Management and Admin — a Manager/HeadOfDepartment (this app's closest
// analogue to the mockup's "Technical Manager") can run interviews without
// seeing compensation data.
const CAN_SEE_FINANCIALS = () => hasAnyRole(['Admin', 'HR', 'Management']);

// Per-round-type edit permission, mirroring the mockup's canEditRound: HR
// edits every round; a Manager/HeadOfDepartment-equivalent only edits
// Technical; Management only edits Management. Admin edits everything.
function canEditRoundType(roundType: 'hr' | 'tech' | 'mgmt'): boolean {
  const role = getRole();
  if (role === 'Admin' || role === 'HR') return true;
  if (roundType === 'tech') return role === 'Manager' || role === 'HeadOfDepartment';
  if (roundType === 'mgmt') return role === 'Management';
  return false;
}

// AI fit fields — kept as a local extension of ApplicantRecord rather
// than editing applicantTypes.ts directly (which this conversation
// doesn't have visibility into), since these three fields are optional
// additions that don't change any existing behavior.
type ApplicantRecordWithAI = ApplicantRecord & {
  ai_fit_score?: number | null;
  ai_fit_summary?: string;
  ai_analyzed_at?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell — the fixed HR -> Technical -> Management pipeline (matching
// the mockup exactly) plus Candidate Information. Offer & Placement and
// Timeline & History are no longer tabs here — they're separate top-level
// pages with their own candidate picker (OfferJoiningPage, TimelineHistoryPage).
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'details', label: 'Candidate Information', icon: User },
  { id: 'hr',      label: 'HR Round',               icon: UserCheck },
  { id: 'tech',    label: 'Technical Round',        icon: ClipboardList },
  { id: 'mgmt',    label: 'Management Round',       icon: CheckSquare },
] as const;

type TabId = typeof TABS[number]['id'];

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline "Stage" shown on the dashboard table — which round type the
// candidate has actually reached, derived from real progress.
// ─────────────────────────────────────────────────────────────────────────────
function getStageLabel(record: Pick<ApplicantRecordWithAI, 'interviewRounds' | 'finalDecision'>): string {
  if (record.finalDecision?.decision && record.finalDecision.decision !== 'Pending') {
    return 'Offer & Joining';
  }
  const rounds = record.interviewRounds || [];
  if (rounds.some((r) => r.roundType === 'mgmt')) return ROUND_TYPE_LABELS.mgmt;
  if (rounds.some((r) => r.roundType === 'tech')) return ROUND_TYPE_LABELS.tech;
  if (rounds.some((r) => r.roundType === 'hr'))   return ROUND_TYPE_LABELS.hr;
  return 'Screening';
}

const STAGE_COLORS: Record<string, string> = {
  'HR Round':          'bg-amber-100  text-amber-700',
  'Technical Round':   'bg-blue-100   text-blue-700',
  'Management Round':  'bg-indigo-100 text-indigo-700',
  'Offer & Joining':   'bg-purple-100 text-purple-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Clickable summary cards — quick one-click filters for the 4 pipeline
// outcomes HR checks most often, on top of the free-form FilterBar below.
// 'Joined' is distinguished from 'Offer Made' by joiningDate having actually
// arrived — there's no separate "joined" flag on the record, so an offer
// whose joining date is still in the future counts as Offer Made only.
// ─────────────────────────────────────────────────────────────────────────────
type CardFilterKey = 'newApplications' | 'screenerShortlisted' | 'interviewsScheduled' | 'offerMade' | 'joined';

type CardFilterRecord = Pick<ApplicantRecordWithAI, 'status' | 'finalDecision' | 'interviewRounds' | 'screenerStatus' | 'interviewFinalStatus' | 'createdAt' | 'joining'>;

// Rejection can happen at any stage — screener, interview, or offer — so
// check each stage's own status rather than trusting only the rollup
// `status` field, which can desync if a save path overwrites it without
// going through the stage-specific PATCH routes.
function isRejected(r: CardFilterRecord): boolean {
  return r.status === 'Rejected'
    || r.screenerStatus === 'Rejected'
    || r.interviewFinalStatus === 'Rejected'
    || r.finalDecision?.decision === 'Rejected';
}

function isThisMonth(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function matchesCardFilter(r: CardFilterRecord, key: CardFilterKey): boolean {
  const decision = r.finalDecision?.decision;
  switch (key) {
    case 'newApplications':
      return isThisMonth(r.createdAt);
    case 'screenerShortlisted':
      // Everyone who has passed the HR Round, regardless of whether they've
      // since moved further into Technical/Management/Offer — but NOT
      // someone later rejected at a later stage; they belong only under
      // "Rejected", not here too.
      return hasPassedRound(r.interviewRounds, 'hr') && !isRejected(r);
    case 'interviewsScheduled':
      return !isRejected(r) && (r.interviewRounds || []).some((round) =>
        ['Scheduled', 'Rescheduled'].includes(round.schedulingStatus)
        && !!round.scheduledDate
        && new Date(round.scheduledDate).getTime() >= Date.now()
      );
    case 'offerMade':
      return decision === 'Offer Made';
    case 'joined':
      return r.joining?.status === 'Joined' && isThisMonth(r.joining?.actualDate);
    default:
      return true;
  }
}

// Pipeline KPI cards — mirrors the mockup's 8-card row. Open Positions,
// Average Time to Hire and Pending Positions are requisition-level figures
// (not per-candidate), so they come from the backend's pipeline-summary /
// days-to-hire analytics rather than client-side filtering of `records`,
// and aren't clickable filters.
type PipelineSummary = {
  openPositions: number;
  pendingPositions: number;
};

const StatCards = ({
  counts, active, onToggle, pipeline, avgDaysToHire,
}: {
  counts: Record<CardFilterKey, number>;
  active: CardFilterKey | null;
  onToggle: (key: CardFilterKey) => void;
  pipeline: PipelineSummary | null;
  avgDaysToHire: number | null;
}) => {
  const cards: { key: CardFilterKey | 'openPositions' | 'avgTimeToHire' | 'pendingPositions'; label: string; value: number | string; icon: any; activeClasses: string; clickable: boolean }[] = [
    { key: 'openPositions',       label: 'Open Positions',           value: pipeline?.openPositions ?? '—', icon: Briefcase, activeClasses: '', clickable: false },
    { key: 'newApplications',     label: 'New Applications (Month)', value: counts.newApplications,         icon: TrendingUp, activeClasses: 'border-blue-400 bg-blue-50', clickable: true },
    { key: 'screenerShortlisted', label: 'Shortlisted',              value: counts.screenerShortlisted,     icon: UserCheck, activeClasses: 'border-amber-400 bg-amber-50', clickable: true },
    { key: 'interviewsScheduled', label: 'Interviews Scheduled',     value: counts.interviewsScheduled,     icon: ClipboardList, activeClasses: 'border-indigo-400 bg-indigo-50', clickable: true },
    { key: 'offerMade',           label: 'Offers Released',          value: counts.offerMade,               icon: CheckSquare, activeClasses: 'border-green-400 bg-green-50', clickable: true },
    { key: 'joined',              label: 'Joined (Month)',           value: counts.joined,                  icon: User, activeClasses: 'border-purple-400 bg-purple-50', clickable: true },
    { key: 'avgTimeToHire',       label: 'Avg. Time to Hire',        value: avgDaysToHire != null ? `${avgDaysToHire}d` : '—', icon: Clock, activeClasses: '', clickable: false },
    { key: 'pendingPositions',    label: 'Pending Positions',        value: pipeline?.pendingPositions ?? '—', icon: Hourglass, activeClasses: '', clickable: false },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {cards.map(({ key, label, value, icon: Icon, activeClasses, clickable }) => {
        const isActive = clickable && active === key;
        const Wrapper: any = clickable ? 'button' : 'div';
        return (
          <Wrapper
            key={key}
            onClick={clickable ? () => onToggle(key as CardFilterKey) : undefined}
            className={`flex items-center gap-3 p-4 rounded-lg shadow border text-left transition ${
              isActive ? activeClasses : 'bg-white border-gray-200' + (clickable ? ' hover:border-gray-300' : '')
            }`}
          >
            <Icon size={18} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xl font-bold text-gray-800 leading-none">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
};

const ApplicantModal = ({
  record,
  onClose,
  onUpdate,
  initialTab = 'details',
}: {
  record:      ApplicantRecordWithAI;
  onClose:     () => void;
  onUpdate:    (updated: ApplicantRecordWithAI) => void;
  initialTab?: TabId;
}) => {
  const canSeeMgmt = CAN_SEE_FINANCIALS();
  const visibleTabs = TABS.filter((t) => t.id !== 'mgmt' || canSeeMgmt);

  const [activeTab,  setActiveTab]  = useState<TabId>(initialTab === 'mgmt' && !canSeeMgmt ? 'details' : initialTab);
  const [localRec,   setLocalRec]   = useState<ApplicantRecordWithAI>(record);
  const [statusBusy, setStatusBusy] = useState(false);
  const [editInfoOpen, setEditInfoOpen] = useState(false);

  useEffect(() => { setLocalRec(record); }, [record]);
  useEffect(() => { setActiveTab(initialTab === 'mgmt' && !canSeeMgmt ? 'details' : initialTab); }, [record._id, initialTab]);

  const handleRecordUpdate = (updated: ApplicantRecord) => {
    setLocalRec(updated);
    onUpdate(updated);
  };

  const handleFinalStatusChange = async (newStatus: string) => {
    setStatusBusy(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${localRec._id}/interview-final-status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ interviewFinalStatus: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update final status');
      handleRecordUpdate(json.data);
      toast.success(`Final Status → ${newStatus}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update final status');
    } finally {
      setStatusBusy(false);
    }
  };

  // A recommended (P1/P2) round rules out Rejected; a Not Recommended one
  // rules out Shortlisted — same constraint enforced server-side. But when
  // rounds give CONFLICTING signals (one round Recommended, another Not
  // Recommended), that would block both options and leave the candidate
  // permanently stuck at "In Progress" with no way to resolve it — so a
  // genuine conflict instead leaves the choice to HR's judgment rather
  // than blocking either one.
  const feedbackStatuses = (localRec.interviewRounds || []).map((r) => r.interviewerFeedbackStatus).filter(Boolean);
  const hasRecommended    = feedbackStatuses.some((s) => s === 'Recommended as P1' || s === 'Recommended as P2');
  const hasNotRecommended = feedbackStatuses.includes('Not Recommended');
  const conflictingSignals = hasRecommended && hasNotRecommended;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const stageLabel = getStageLabel(localRec);
  const canEditInfo = hasAnyRole(['Admin', 'HR']);

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">

        {/* ── Modal header — two-line subtitle, pills, Edit Information ── */}
        <div className="flex items-start justify-between px-6 py-4 border-b gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{localRec.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {localRec.designation || '—'}
              &nbsp;·&nbsp;Applied {new Date(localRec.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{localRec.phone}&nbsp;·&nbsp;{localRec.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[stageLabel] || 'bg-gray-100 text-gray-600'}`}>
              {stageLabel}
            </span>
            <div className="relative flex items-center gap-1">
              {statusBusy && <Loader2 size={12} className="animate-spin text-gray-400" />}
              <select
                value={localRec.interviewFinalStatus || 'New'}
                onChange={(e) => handleFinalStatusChange(e.target.value)}
                disabled={statusBusy}
                className={`text-xs font-bold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-lime-400 ${
                  INTERVIEW_FINAL_STATUS_COLORS[localRec.interviewFinalStatus] || INTERVIEW_FINAL_STATUS_COLORS['New']
                }`}
              >
                {INTERVIEW_FINAL_STATUS_OPTIONS.map((s) => (
                  <option
                    key={s}
                    value={s}
                    disabled={s === 'New' || (s === 'Rejected' && hasRecommended && !conflictingSignals) || (s === 'Shortlisted' && hasNotRecommended && !conflictingSignals)}
                  >
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {canEditInfo && (
              <button
                onClick={() => setEditInfoOpen(true)}
                className="text-xs font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 px-2.5 py-1.5 rounded-lg transition"
              >
                Edit Information
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Links row — always visible, regardless of active tab ── */}
        <div className="flex items-center flex-wrap gap-2 px-6 py-2.5 border-b bg-gray-50/60">
          {localRec.resume && (
            <a href={localRec.resume.startsWith('http') ? localRec.resume : `${API_BASE.replace(/\/api\/?$/, '')}${localRec.resume.startsWith('/') ? '' : '/'}${localRec.resume}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition">
              <ExternalLink size={12} /> Resume
            </a>
          )}
          {localRec.linkedin && (
            <a href={localRec.linkedin} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition">
              <ExternalLink size={12} /> LinkedIn
            </a>
          )}
          {!localRec.resume && !localRec.linkedin && <span className="text-xs text-gray-400">No resume or LinkedIn on file</span>}
        </div>

        {/* AI fit summary banner — only shown once analyzed */}
        {localRec.ai_fit_score != null && (
          <div className={`px-6 py-3 text-sm border-b flex items-start gap-2 ${
            localRec.ai_fit_score >= 8 ? 'bg-green-50 border-green-100 text-green-800'
              : localRec.ai_fit_score >= 5 ? 'bg-amber-50 border-amber-100 text-amber-800'
              : 'bg-red-50 border-red-100 text-red-800'
          }`}>
            <Sparkles size={15} className="flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ATS Score: {localRec.ai_fit_score}/10</span>
              {localRec.ai_fit_summary && <p className="mt-0.5 opacity-90">{localRec.ai_fit_summary}</p>}
            </div>
          </div>
        )}

        {/* ── Tabs — pill style, matching the mockup ── */}
        <div className="flex items-center gap-1.5 border-b px-4 py-2 overflow-x-auto">
          {visibleTabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${
                activeTab === id ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content — scrollable ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === 'details' && (
            <CandidateInformationTab record={localRec} onSave={handleRecordUpdate} />
          )}
          {activeTab === 'hr' && (
            <RoundPipelineTab record={localRec} roundType="hr" onUpdate={handleRecordUpdate} canEdit={canEditRoundType('hr')} />
          )}
          {activeTab === 'tech' && (
            <RoundPipelineTab record={localRec} roundType="tech" onUpdate={handleRecordUpdate} canEdit={canEditRoundType('tech')} />
          )}
          {activeTab === 'mgmt' && canSeeMgmt && (
            <RoundPipelineTab record={localRec} roundType="mgmt" onUpdate={handleRecordUpdate} canEdit={canEditRoundType('mgmt')} />
          )}
        </div>
      </div>
    </div>

      {editInfoOpen && (
        <EditCandidateInfoModal
          record={localRec}
          onClose={() => setEditInfoOpen(false)}
          onSave={handleRecordUpdate}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AI fit score badge — color-coded, shows "—" with a subtle hint if never
// analyzed rather than an empty cell that looks like a loading state.
// ─────────────────────────────────────────────────────────────────────────────
const ScoreBadge = ({ score }: { score?: number | null }) => {
  if (score == null) return <span className="text-gray-300 text-xs">Not analyzed</span>;
  const color =
    score >= 8 ? 'bg-green-100 text-green-700'
      : score >= 5 ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{score}/10</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic ATS match % (skills/experience/location/notice-period
// weighted, see backend utils/atsMatchScore.js) — a DIFFERENT, automatic
// metric from the AI fit score above, kept visually distinct (% vs /10,
// separate column) so the two are never confused for the same number.
// ─────────────────────────────────────────────────────────────────────────────
const MatchScoreBadge = ({ score }: { score?: number | null }) => {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  const color =
    score >= 70 ? 'bg-green-100 text-green-700'
      : score >= 40 ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{score}%</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sorting — expected_monthly_ctc is free text ("6,00,000", "50000", "6 LPA"),
// not a clean number, so sorting by it needs a best-effort numeric parse
// rather than a plain string comparison (which would put "6,00,000" before
// "50000" purely alphabetically — wrong).
// ─────────────────────────────────────────────────────────────────────────────
type SortOption = 'newest' | 'oldest' | 'ctc_high' | 'ctc_low' | 'name_az' | 'ai_score_high';

const SORT_LABELS: Record<SortOption, string> = {
  newest:         'Newest First',
  oldest:         'Oldest First',
  ctc_high:       'Expected CTC (High to Low)',
  ctc_low:        'Expected CTC (Low to High)',
  name_az:        'Name (A–Z)',
  ai_score_high:  'ATS Score (High to Low)',
};

function parseCtcToNumber(raw?: string): number {
  if (!raw) return 0;
  const digitsOnly = raw.replace(/[^\d.]/g, '');
  const n = parseFloat(digitsOnly);
  return isNaN(n) ? 0 : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Odoo-style "Filters" dropdown — a single button opens a checkbox panel,
// grouped by field (Profile / Expected CTC / Location / Experience); each
// group is itself a tree (group → subgroup → sub-subgroup, e.g. Location is
// Country → State → City) rather than one flat list per field. Any number
// of nodes at any depth can be ticked (OR within a group, AND across
// groups) and every ticked node shows up as its own removable chip, the
// same drill-down-with-checkboxes interaction as Odoo's list-view filter
// menu — just extended one level further since this data actually nests
// (a candidate's location really is Country > State > City).
// ─────────────────────────────────────────────────────────────────────────────
type FilterGroupKey = 'profile' | 'ctc' | 'location' | 'experience';

const FILTER_GROUP_LABELS: Record<FilterGroupKey, string> = {
  profile: 'Profile', ctc: 'Expected CTC', location: 'Location', experience: 'Experience',
};

type FilterNode = {
  id: string;
  label: string;
  // Full breadcrumb ("India > Maharashtra > Pune") — used on the chip so a
  // deeply nested pick stays unambiguous once it's out of the tree.
  path: string;
  predicate: (r: ApplicantRecordWithAI) => boolean;
  children?: FilterNode[];
};

function flattenFilterNodes(nodes: FilterNode[], out: Map<string, FilterNode> = new Map()): Map<string, FilterNode> {
  nodes.forEach((n) => {
    out.set(n.id, n);
    if (n.children) flattenFilterNodes(n.children, out);
  });
  return out;
}

// ── Location: Country → State → City — a genuine 3-level hierarchy already
// present on every record, unlike the other fields.
function buildLocationTree(records: ApplicantRecordWithAI[]): FilterNode[] {
  const byCountry = new Map<string, Map<string, Set<string>>>();
  records.forEach((r) => {
    const country = r.country || 'Unspecified';
    const state   = r.state   || 'Unspecified';
    const city    = r.city    || 'Unspecified';
    if (!byCountry.has(country)) byCountry.set(country, new Map());
    const byState = byCountry.get(country)!;
    if (!byState.has(state)) byState.set(state, new Set());
    byState.get(state)!.add(city);
  });
  return Array.from(byCountry.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([country, byState]) => ({
    id: `loc:country:${country}`,
    label: country,
    path: country,
    predicate: (r) => (r.country || 'Unspecified') === country,
    children: Array.from(byState.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([state, cities]) => ({
      id: `loc:state:${country}|${state}`,
      label: state,
      path: `${country} › ${state}`,
      predicate: (r) => (r.state || 'Unspecified') === state,
      children: Array.from(cities).sort().map((city) => ({
        id: `loc:city:${country}|${state}|${city}`,
        label: city,
        path: `${country} › ${state} › ${city}`,
        predicate: (r) => (r.city || 'Unspecified') === city,
      })),
    })),
  }));
}

// ── Expected CTC: range bucket → the exact raw values that fall in it.
const CTC_BUCKETS = [
  { label: 'Below ₹3L',    min: 0,       max: 300000 },
  { label: '₹3L – ₹6L',    min: 300000,  max: 600000 },
  { label: '₹6L – ₹10L',   min: 600000,  max: 1000000 },
  { label: '₹10L – ₹20L',  min: 1000000, max: 2000000 },
  { label: 'Above ₹20L',   min: 2000000, max: Infinity },
];

function buildCtcTree(records: ApplicantRecordWithAI[]): FilterNode[] {
  const buckets = CTC_BUCKETS.map((b) => ({ ...b, values: new Set<string>() }));
  records.forEach((r) => {
    if (!r.expected_monthly_ctc) return;
    const n = parseCtcToNumber(r.expected_monthly_ctc);
    const bucket = buckets.find((b) => n >= b.min && n < b.max);
    if (bucket) bucket.values.add(r.expected_monthly_ctc);
  });
  return buckets.filter((b) => b.values.size > 0).map((b) => ({
    id: `ctc:bucket:${b.label}`,
    label: b.label,
    path: b.label,
    predicate: (r) => {
      const n = parseCtcToNumber(r.expected_monthly_ctc);
      return n >= b.min && n < b.max;
    },
    children: Array.from(b.values).sort().map((v) => ({
      id: `ctc:value:${v}`,
      label: v,
      path: `${b.label} › ${v}`,
      predicate: (r) => r.expected_monthly_ctc === v,
    })),
  }));
}

// ── Experience: Experienced / Fresher → years-of-experience sub-buckets
// (only meaningful under Experienced).
const EXPERIENCE_BUCKETS = [
  { label: '0–2 yrs',  min: 0,  max: 2 },
  { label: '2–5 yrs',  min: 2,  max: 5 },
  { label: '5–10 yrs', min: 5,  max: 10 },
  { label: '10+ yrs',  min: 10, max: Infinity },
];

function parseYears(v?: string): number | null {
  const m = String(v || '').match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function buildExperienceTree(records: ApplicantRecordWithAI[]): FilterNode[] {
  const bucketsInUse = EXPERIENCE_BUCKETS.filter((b) =>
    records.some((r) => {
      if (r.experience !== 'Yes') return false;
      const y = parseYears(r.total_experience);
      return y != null && y >= b.min && y < b.max;
    })
  );
  return [
    {
      id: 'exp:Yes',
      label: 'Experienced',
      path: 'Experienced',
      predicate: (r) => r.experience === 'Yes',
      children: bucketsInUse.map((b) => ({
        id: `exp:range:${b.label}`,
        label: b.label,
        path: `Experienced › ${b.label}`,
        predicate: (r) => {
          if (r.experience !== 'Yes') return false;
          const y = parseYears(r.total_experience);
          return y != null && y >= b.min && y < b.max;
        },
      })),
    },
    { id: 'exp:No', label: 'Fresher', path: 'Fresher', predicate: (r) => r.experience === 'No' },
  ];
}

// ── Profile — no natural hierarchy in the data, stays a flat list of
// designations (depth 0), rendered through the same tree component.
function buildProfileTree(options: string[]): FilterNode[] {
  return options.map((p) => ({ id: `profile:${p}`, label: p, path: p, predicate: (r) => r.designation === p }));
}

const FilterTreeRow: React.FC<{
  node: FilterNode;
  depth: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
}> = ({ node, depth, selected, onToggle }) => {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = !!node.children?.length;
  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="inline-block w-[18px] flex-shrink-0" />
        )}
        <label className="flex items-center gap-2 py-1 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex-1 min-w-0">
          <input
            type="checkbox"
            checked={selected.has(node.id)}
            onChange={() => onToggle(node.id)}
            className="rounded border-gray-300 text-lime-600 focus:ring-lime-400 flex-shrink-0"
          />
          <span className="truncate">{node.label}</span>
        </label>
      </div>
      {hasChildren && expanded && node.children!.map((c) => (
        <FilterTreeRow key={c.id} node={c} depth={depth + 1} selected={selected} onToggle={onToggle} />
      ))}
    </div>
  );
};

const FILTER_GROUP_ORDER: FilterGroupKey[] = ['profile', 'ctc', 'location', 'experience'];

const FiltersDropdown = ({
  trees, active, onToggle,
}: {
  trees: Record<FilterGroupKey, FilterNode[]>;
  active: Record<FilterGroupKey, string[]>;
  onToggle: (group: FilterGroupKey, id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const activeCount = Object.values(active).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition ${
          activeCount > 0 ? 'border-lime-300 bg-lime-50 text-lime-700' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
        }`}
      >
        <SlidersHorizontal size={14} />
        Filters
        {activeCount > 0 && (
          <span className="bg-lime-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {FILTER_GROUP_ORDER.map((group) => {
            const nodes = trees[group];
            if (!nodes.length) return null;
            const selectedSet = new Set(active[group]);
            return (
              <div key={group} className="border-b border-gray-100 last:border-b-0 py-2">
                <p className="px-3 pb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                  {FILTER_GROUP_LABELS[group]}
                </p>
                <div className="px-2">
                  {nodes.map((n) => (
                    <FilterTreeRow key={n.id} node={n} depth={0} selected={selectedSet} onToggle={(id) => onToggle(group, id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FilterBar = ({
  search, setSearch,
  trees, nodeIndex, active, onToggle,
  sortBy, setSortBy,
  onReset, hasActiveFilters,
}: {
  search: string; setSearch: (v: string) => void;
  trees: Record<FilterGroupKey, FilterNode[]>;
  nodeIndex: Record<FilterGroupKey, Map<string, FilterNode>>;
  active: Record<FilterGroupKey, string[]>;
  onToggle: (group: FilterGroupKey, id: string) => void;
  sortBy: SortOption; setSortBy: (v: SortOption) => void;
  onReset: () => void; hasActiveFilters: boolean;
}) => {
  const chips: { group: FilterGroupKey; id: string; path: string }[] = (Object.keys(active) as FilterGroupKey[])
    .flatMap((group) => active[group].map((id) => ({ group, id, path: nodeIndex[group].get(id)?.path || id })));

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
          />
        </div>

        <FiltersDropdown trees={trees} active={active} onToggle={onToggle} />

        {/* Sort */}
        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowUpDown size={13} className="text-gray-400 hidden sm:block" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <option key={key} value={key}>{SORT_LABELS[key]}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-500 px-2 py-2 transition"
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      {/* Active filter chips — each individually removable, labeled with
          its full breadcrumb when it came from a nested pick. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {chips.map(({ group, id, path }) => (
            <span
              key={`${group}-${id}`}
              className="flex items-center gap-1.5 bg-lime-50 border border-lime-200 text-lime-700 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full"
            >
              <span className="text-lime-500">{FILTER_GROUP_LABELS[group]}:</span>
              {path}
              <button onClick={() => onToggle(group, id)} className="hover:bg-lime-100 rounded-full p-0.5 transition">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page — Applicant Records table
// ─────────────────────────────────────────────────────────────────────────────
const CandidatesTab: React.FC = () => {
  const navigate = useNavigate();
  const [records,    setRecords]    = useState<ApplicantRecordWithAI[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<ApplicantRecordWithAI | null>(null);
  const [initialTab, setInitialTab] = useState<TabId>('details');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Filter state — Odoo-style: each group holds any number of ticked
  // values (OR within a group), combined with AND across groups.
  const [search,  setSearch]  = useState('');
  const [filters, setFilters] = useState<Record<FilterGroupKey, string[]>>({
    profile: [], ctc: [], location: [], experience: [],
  });
  const [sortBy,  setSortBy]  = useState<SortOption>('newest');
  const [cardFilter,       setCardFilter]       = useState<CardFilterKey | null>(null);
  const [pipeline,         setPipeline]         = useState<PipelineSummary | null>(null);
  const [avgDaysToHire,    setAvgDaysToHire]    = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/applicant-records`)
      .then((r) => r.json())
      .then((res) => { setRecords(res.data ?? []); setLoading(false); })
      .catch(() => { toast.error('Failed to load records'); setLoading(false); });

    fetch(`${API_BASE}/hiringrequisitions/analytics/pipeline-summary`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setPipeline(res); })
      .catch(() => {});

    fetch(`${API_BASE}/hiringrequisitions/analytics/days-to-hire`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setAvgDaysToHire(res.overall?.avgDays ?? null); })
      .catch(() => {});
  }, []);

  const handleUpdate = (updated: ApplicantRecordWithAI) => {
    setRecords((prev) => prev.map((r) => r._id === updated._id ? updated : r));
    setSelected(updated);
  };

  const openModal = (record: ApplicantRecordWithAI, tab: TabId = 'details') => {
    setInitialTab(tab);
    setSelected(record);
  };

  // Fires the AI analysis for a single record. Deliberately per-row and
  // on-demand only — with 200+ applications, auto-analyzing everything
  // would be a real, ongoing API cost with no way to opt out.
  const handleAnalyze = async (record: ApplicantRecordWithAI, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnalyzingId(record._id);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/analyze`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Analysis failed');
      setRecords((prev) => prev.map((r) => r._id === record._id ? json.data : r));
      if (selected?._id === record._id) setSelected(json.data);
      toast.success(`ATS score: ${json.data.ai_fit_score}/10`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to analyze');
    } finally {
      setAnalyzingId(null);
    }
  };

  // Unique dropdown options derived from the loaded records
  const profileOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.designation).filter(Boolean))) as string[],
    [records]
  );

  // Nested filter trees (group → subgroup → sub-subgroup) + a flattened
  // id->node index per group, used both to render the dropdown and to look
  // a node's predicate/path back up by id (for matching and for chips).
  const filterTrees = useMemo<Record<FilterGroupKey, FilterNode[]>>(() => ({
    profile:    buildProfileTree(profileOptions),
    ctc:        buildCtcTree(records),
    location:   buildLocationTree(records),
    experience: buildExperienceTree(records),
  }), [records, profileOptions]);

  const filterNodeIndex = useMemo<Record<FilterGroupKey, Map<string, FilterNode>>>(() => ({
    profile:    flattenFilterNodes(filterTrees.profile),
    ctc:        flattenFilterNodes(filterTrees.ctc),
    location:   flattenFilterNodes(filterTrees.location),
    experience: flattenFilterNodes(filterTrees.experience),
  }), [filterTrees]);

  const cardCounts = useMemo(() => ({
    newApplications:     records.filter((r) => matchesCardFilter(r, 'newApplications')).length,
    screenerShortlisted: records.filter((r) => matchesCardFilter(r, 'screenerShortlisted')).length,
    interviewsScheduled: records.filter((r) => matchesCardFilter(r, 'interviewsScheduled')).length,
    offerMade:           records.filter((r) => matchesCardFilter(r, 'offerMade')).length,
    joined:              records.filter((r) => matchesCardFilter(r, 'joined')).length,
  }), [records]);

  const toggleCardFilter = (key: CardFilterKey) =>
    setCardFilter((prev) => (prev === key ? null : key));

  const toggleFilter = (group: FilterGroupKey, value: string) =>
    setFilters((prev) => ({
      ...prev,
      [group]: prev[group].includes(value) ? prev[group].filter((v) => v !== value) : [...prev[group], value],
    }));

  // A group matches when ANY of its ticked nodes' predicates match (OR
  // within the group, regardless of which depth they came from — e.g.
  // ticking "India" at depth 0 and "Pune" at depth 2 in the same group
  // just ORs those two predicates together).
  const matchesFilterGroup = (r: ApplicantRecordWithAI, group: FilterGroupKey): boolean => {
    const ids = filters[group];
    if (ids.length === 0) return true;
    const index = filterNodeIndex[group];
    return ids.some((id) => index.get(id)?.predicate(r));
  };

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchesSearch =
        !term ||
        r.full_name?.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.phone?.toLowerCase().includes(term);

      const matchesProfile    = matchesFilterGroup(r, 'profile');
      const matchesCtc        = matchesFilterGroup(r, 'ctc');
      const matchesLocation   = matchesFilterGroup(r, 'location');
      const matchesExperience = matchesFilterGroup(r, 'experience');
      const matchesCard       = !cardFilter || matchesCardFilter(r, cardFilter);

      return matchesSearch && matchesProfile && matchesCtc && matchesLocation && matchesExperience && matchesCard;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, search, filters, filterNodeIndex, cardFilter]);

  // Sorting applied on top of the already-filtered set — a separate step
  // from filtering, so the two never interfere with each other.
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'ctc_high':
        return sorted.sort((a, b) => parseCtcToNumber(b.expected_monthly_ctc) - parseCtcToNumber(a.expected_monthly_ctc));
      case 'ctc_low':
        return sorted.sort((a, b) => parseCtcToNumber(a.expected_monthly_ctc) - parseCtcToNumber(b.expected_monthly_ctc));
      case 'name_az':
        return sorted.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      case 'ai_score_high':
        // Unanalyzed records (null score) always sink to the bottom,
        // regardless of sort direction — there's nothing to rank them
        // against yet, so treating them as "worse than any real score"
        // keeps analyzed candidates visibly grouped at the top.
        return sorted.sort((a, b) => (b.ai_fit_score ?? -1) - (a.ai_fit_score ?? -1));
      default:
        return sorted;
    }
  }, [filteredRecords, sortBy]);

  const hasActiveFilters = !!(search || Object.values(filters).some((arr) => arr.length > 0) || cardFilter);

  const resetFilters = () => {
    setSearch('');
    setFilters({ profile: [], ctc: [], location: [], experience: [] });
    setCardFilter(null);
  };

  return (
    <>
      <Toaster position="top-right" />

      {selected && (
        <ApplicantModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          initialTab={initialTab}
        />
      )}

      <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Recruitment Tracker</h1>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
              {sortedRecords.length} of {records.length} Applicants
            </span>
          </div>

          {!loading && records.length > 0 && (
            <StatCards counts={cardCounts} active={cardFilter} onToggle={toggleCardFilter} pipeline={pipeline} avgDaysToHire={avgDaysToHire} />
          )}

          {!loading && records.length > 0 && (
            <FilterBar
              search={search} setSearch={setSearch}
              trees={filterTrees} nodeIndex={filterNodeIndex}
              active={filters} onToggle={toggleFilter}
              sortBy={sortBy} setSortBy={setSortBy}
              onReset={resetFilters} hasActiveFilters={hasActiveFilters}
            />
          )}

          {loading ? (
            <div className="flex justify-center mt-20">
              <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center mt-20 text-gray-400">No applications yet.</div>
          ) : sortedRecords.length === 0 ? (
            <div className="text-center mt-20 text-gray-400">No applicants match your filters.</div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b font-semibold text-gray-600">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4 w-48">Contact</th>
                    <th className="p-4">Profile</th>
                    <th className="p-4">Exp</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Stage</th>
                    <th className="p-4">Status</th>
                    {/* <th className="p-4">Match %</th> */}
                    <th className="p-4">AI Score</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedRecords.map((r) => {
                    const isAnalyzing = analyzingId === r._id;
                    return (
                      <tr
                        key={r._id}
                        onClick={() => openModal(r, 'details')}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="p-4 font-bold text-gray-900">{r.full_name}</td>
                        <td className="p-4 space-y-1 max-w-[12rem]">
                          <div className="flex items-center gap-2 text-gray-600 truncate"><Mail size={14} className="flex-shrink-0" /><span className="truncate">{r.email}</span></div>
                          <div className="flex items-center gap-2 text-gray-400 text-xs truncate"><Phone size={14} className="flex-shrink-0" />{r.phone}</div>
                        </td>
                        <td className="p-4 text-gray-600 text-xs">{r.designation || '—'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.experience === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {r.experience === 'Yes' ? 'EXP' : 'FRESH'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 text-xs">{[r.city, r.state].filter(Boolean).join(', ')}</td>
                        <td className="p-4">
                          {(() => {
                            const stage = getStageLabel(r);
                            return (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600'}`}>
                                {stage}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                            {r.status || 'New'}
                          </span>
                        </td>
                        {/* <td className="p-4">
                          <MatchScoreBadge score={r.atsMatchScore} />
                        </td> */}
                        <td className="p-4">
                          <div className="flex items-center gap-2" title={r.ai_fit_summary || undefined}>
                            <ScoreBadge score={r.ai_fit_score} />
                            <button
                              onClick={(e) => handleAnalyze(r, e)}
                              disabled={isAnalyzing}
                              title={r.ai_fit_score != null ? 'Re-analyze ATS score' : 'Analyze ATS score'}
                              className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition disabled:opacity-50"
                            >
                              {isAnalyzing
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Sparkles size={13} />}
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openModal(r, 'details')}
                              className="p-1.5 text-gray-400 hover:text-lime-600 hover:bg-lime-50 rounded-lg transition"
                              title="View / Edit"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => openModal(r, 'hr')}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="HR Round"
                            >
                              <UserCheck size={15} />
                            </button>
                            <button
                              onClick={() => openModal(r, 'tech')}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Technical Round"
                            >
                              <ClipboardList size={15} />
                            </button>
                            <button
                              onClick={() => navigate('/applicants?tab=offerJoining')}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="Offer & Joining"
                            >
                              <CheckSquare size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
};

export default CandidatesTab;
