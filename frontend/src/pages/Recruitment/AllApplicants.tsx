// pages/Recruitment/AllApplicants.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail, Phone, Loader2, Eye, X, ClipboardList, CheckSquare, User, UserCheck,
  ExternalLink, Video, Search, SlidersHorizontal, RotateCcw, ArrowUpDown, Sparkles, Lock,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import CandidateInformationTab from './CandidateInformationTab';
import ScreenerRoundTab from './ScreenerRoundTab';
import InterviewRoundTab from './InterviewRoundTab';
import OfferPlacementTab from './OfferPlacementTab';

import {
  ApplicantRecord, API_BASE,
  SCREENER_STATUS_COLORS,
  INTERVIEW_FINAL_STATUS_OPTIONS, INTERVIEW_FINAL_STATUS_COLORS,
} from './applicantTypes';

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
// Modal shell — 4 tabs, one per stage, each its own imported component
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'details',   label: 'Candidate Information', icon: User },
  { id: 'screener',  label: 'HR Round',         icon: UserCheck },
  { id: 'interview', label: 'Interview Round',        icon: ClipboardList },
  { id: 'offer',     label: 'Offer & Placement',      icon: CheckSquare },
] as const;

type TabId = typeof TABS[number]['id'];

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
  const [activeTab,  setActiveTab]  = useState<TabId>(initialTab);
  const [editMode,   setEditMode]   = useState<'view' | 'edit'>('view');
  const [screenerEditMode, setScreenerEditMode] = useState<'view' | 'edit'>('view');
  const [localRec,   setLocalRec]   = useState<ApplicantRecordWithAI>(record);
  const [statusBusy, setStatusBusy] = useState(false);

  // Keeps localRec in sync on every update, but only jumps the active tab
  // when the modal is (re)opened for a given record/tab pair — not on every
  // save, which would otherwise snap the user back to the opening tab and
  // hide whatever they just saved (e.g. the Status they just set).
  useEffect(() => { setLocalRec(record); }, [record]);
  useEffect(() => { setActiveTab(initialTab); }, [record._id, initialTab]);

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
  // rules out Shortlisted — same constraint enforced server-side.
  const feedbackStatuses = (localRec.interviewRounds || []).map((r) => r.interviewerFeedbackStatus).filter(Boolean);
  const hasRecommended    = feedbackStatuses.some((s) => s === 'Recommended as P1' || s === 'Recommended as P2');
  const hasNotRecommended = feedbackStatuses.includes('Not Recommended');

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const roundCount = localRec.interviewRounds?.length ?? 0;

  // Interview Round and Offer & Placement only open once the screening
  // decision is Shortlisted — enforced again server-side on the routes
  // those tabs write to, this just keeps HR from navigating there at all
  // when it isn't relevant yet.
  const pipelineLocked = localRec.screenerStatus !== 'Shortlisted';

  useEffect(() => {
    if (pipelineLocked && (activeTab === 'interview' || activeTab === 'offer')) setActiveTab('details');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineLocked]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">

        {/* ── Modal header ── */}
        <div className="flex items-start justify-between px-6 py-4 border-b gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{localRec.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Applied {new Date(localRec.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              &nbsp;·&nbsp;{localRec.designation || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex items-center gap-1">
              {statusBusy && <Loader2 size={12} className="animate-spin text-gray-400" />}
              <select
                value={localRec.interviewFinalStatus || 'In Progress'}
                onChange={(e) => handleFinalStatusChange(e.target.value)}
                disabled={statusBusy}
                className={`text-xs font-bold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-lime-400 ${
                  INTERVIEW_FINAL_STATUS_COLORS[localRec.interviewFinalStatus] || INTERVIEW_FINAL_STATUS_COLORS['In Progress']
                }`}
              >
                {INTERVIEW_FINAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} disabled={(s === 'Rejected' && hasRecommended) || (s === 'Shortlisted' && hasNotRecommended)}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
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
              <span className="font-bold">AI Fit Score: {localRec.ai_fit_score}/10</span>
              {localRec.ai_fit_summary && <p className="mt-0.5 opacity-90">{localRec.ai_fit_summary}</p>}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="grid grid-cols-4 border-b px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const locked = pipelineLocked && (id === 'interview' || id === 'offer');
            return (
              <button
                key={id}
                onClick={() => !locked && setActiveTab(id)}
                disabled={locked}
                title={locked ? 'Mark the HR Round as Shortlisted to unlock this tab' : undefined}
                className={`flex items-center justify-center gap-1.5 px-2 py-3 text-xs sm:text-sm font-semibold border-b-2 transition -mb-px min-w-0 ${
                  locked
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : activeTab === id
                      ? 'border-lime-500 text-lime-700'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {locked ? <Lock size={14} className="flex-shrink-0" /> : <Icon size={14} className="flex-shrink-0" />}
                <span className="truncate">{label}</span>
                {id === 'interview' && roundCount > 0 && (
                  <span className="flex-shrink-0 bg-lime-100 text-lime-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {roundCount}
                  </span>
                )}
                {id === 'screener' && localRec.screenerStatus && (
                  <span className="flex-shrink-0 bg-lime-100 text-lime-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content — scrollable ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === 'details' && (
            <CandidateInformationTab
              record={localRec}
              mode={editMode}
              setMode={setEditMode}
              onSave={handleRecordUpdate}
            />
          )}
          {activeTab === 'screener' && (
            <ScreenerRoundTab
              record={localRec}
              mode={screenerEditMode}
              setMode={setScreenerEditMode}
              onSave={handleRecordUpdate}
            />
          )}
          {activeTab === 'interview' && (
            <InterviewRoundTab record={localRec} onUpdate={handleRecordUpdate} />
          )}
          {activeTab === 'offer' && (
            <OfferPlacementTab record={localRec} onUpdate={handleRecordUpdate} />
          )}
        </div>
      </div>
    </div>
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
  ai_score_high:  'AI Fit Score (High to Low)',
};

function parseCtcToNumber(raw?: string): number {
  if (!raw) return 0;
  const digitsOnly = raw.replace(/[^\d.]/g, '');
  const n = parseFloat(digitsOnly);
  return isNaN(n) ? 0 : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar
// ─────────────────────────────────────────────────────────────────────────────
const FilterBar = ({
  search, setSearch,
  profileFilter, setProfileFilter, profileOptions,
  ctcFilter, setCtcFilter, ctcOptions,
  locationFilter, setLocationFilter, locationOptions,
  experienceFilter, setExperienceFilter,
  sortBy, setSortBy,
  onReset, hasActiveFilters,
}: {
  search: string; setSearch: (v: string) => void;
  profileFilter: string; setProfileFilter: (v: string) => void; profileOptions: string[];
  ctcFilter: string; setCtcFilter: (v: string) => void; ctcOptions: string[];
  locationFilter: string; setLocationFilter: (v: string) => void; locationOptions: string[];
  experienceFilter: string; setExperienceFilter: (v: string) => void;
  sortBy: SortOption; setSortBy: (v: SortOption) => void;
  onReset: () => void; hasActiveFilters: boolean;
}) => (
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

      <div className="hidden sm:flex items-center gap-1 text-gray-400 text-xs font-semibold px-1">
        <SlidersHorizontal size={13} /> Filters
      </div>

      {/* Profile */}
      <select
        value={profileFilter}
        onChange={(e) => setProfileFilter(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
      >
        <option value="">All Profiles</option>
        {profileOptions.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      {/* Expected CTC */}
      <select
        value={ctcFilter}
        onChange={(e) => setCtcFilter(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
      >
        <option value="">All Expected CTC</option>
        {ctcOptions.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Location */}
      <select
        value={locationFilter}
        onChange={(e) => setLocationFilter(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
      >
        <option value="">All Locations</option>
        {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      {/* Experience */}
      <select
        value={experienceFilter}
        onChange={(e) => setExperienceFilter(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
      >
        <option value="">All Experience</option>
        <option value="Yes">Experienced</option>
        <option value="No">Fresher</option>
      </select>

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
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main page — Applicant Records table
// ─────────────────────────────────────────────────────────────────────────────
const CandidatesTab: React.FC = () => {
  const [records,    setRecords]    = useState<ApplicantRecordWithAI[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<ApplicantRecordWithAI | null>(null);
  const [initialTab, setInitialTab] = useState<TabId>('details');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Filter state
  const [search,           setSearch]           = useState('');
  const [profileFilter,    setProfileFilter]    = useState('');
  const [ctcFilter,        setCtcFilter]        = useState('');
  const [locationFilter,   setLocationFilter]   = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [sortBy,           setSortBy]           = useState<SortOption>('newest');

  useEffect(() => {
    fetch(`${API_BASE}/applicant-records`)
      .then((r) => r.json())
      .then((res) => { setRecords(res.data ?? []); setLoading(false); })
      .catch(() => { toast.error('Failed to load records'); setLoading(false); });
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
      toast.success(`Fit score: ${json.data.ai_fit_score}/10`);
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
  const ctcOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.expected_monthly_ctc).filter(Boolean))) as string[],
    [records]
  );
  const locationOptions = useMemo(() => {
    const locs = records.map((r) => [r.city, r.state].filter(Boolean).join(', ')).filter(Boolean);
    return Array.from(new Set(locs));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchesSearch =
        !term ||
        r.full_name?.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.phone?.toLowerCase().includes(term);

      const matchesProfile  = !profileFilter    || r.designation === profileFilter;
      const matchesCtc      = !ctcFilter        || r.expected_monthly_ctc === ctcFilter;
      const matchesLocation = !locationFilter   || [r.city, r.state].filter(Boolean).join(', ') === locationFilter;
      const matchesExp      = !experienceFilter || r.experience === experienceFilter;

      return matchesSearch && matchesProfile && matchesCtc && matchesLocation && matchesExp;
    });
  }, [records, search, profileFilter, ctcFilter, locationFilter, experienceFilter]);

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

  const hasActiveFilters = !!(search || profileFilter || ctcFilter || locationFilter || experienceFilter);

  const resetFilters = () => {
    setSearch('');
    setProfileFilter('');
    setCtcFilter('');
    setLocationFilter('');
    setExperienceFilter('');
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
            <FilterBar
              search={search} setSearch={setSearch}
              profileFilter={profileFilter} setProfileFilter={setProfileFilter} profileOptions={profileOptions}
              ctcFilter={ctcFilter} setCtcFilter={setCtcFilter} ctcOptions={ctcOptions}
              locationFilter={locationFilter} setLocationFilter={setLocationFilter} locationOptions={locationOptions}
              experienceFilter={experienceFilter} setExperienceFilter={setExperienceFilter}
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
                    <th className="p-4">Interview Status</th>
                    <th className="p-4">AI Fit</th>
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
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${INTERVIEW_FINAL_STATUS_COLORS[r.interviewFinalStatus] || 'bg-gray-100 text-gray-600'}`}>
                            {r.interviewFinalStatus || 'In Progress'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2" title={r.ai_fit_summary || undefined}>
                            <ScoreBadge score={r.ai_fit_score} />
                            <button
                              onClick={(e) => handleAnalyze(r, e)}
                              disabled={isAnalyzing}
                              title={r.ai_fit_score != null ? 'Re-analyze' : 'Analyze fit'}
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
                              onClick={() => openModal(r, 'screener')}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="Screener round"
                            >
                              <UserCheck size={15} />
                            </button>
                            <button
                              onClick={() => openModal(r, 'interview')}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Interview rounds"
                            >
                              <ClipboardList size={15} />
                            </button>
                            <button
                              onClick={() => openModal(r, 'offer')}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="Offer & Placement"
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