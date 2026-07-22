// pages/Recruitment/AllApplicants.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail, Phone, Loader2, Eye, X, ClipboardList, CheckSquare, User, UserCheck,
  ExternalLink, Video, Search, SlidersHorizontal, RotateCcw,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';

import CandidateInformationTab from './CandidateInformationTab';
import ScreenerRoundTab from './ScreenerRoundTab';
import InterviewRoundTab from './InterviewRoundTab';
import OfferPlacementTab from './OfferPlacementTab';

import {
  ApplicantRecord, StatusType, API_BASE,
  STATUS_OPTIONS, STATUS_COLORS, SCREENER_STATUS_COLORS,
} from './applicantTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell — 4 tabs, one per stage, each its own imported component
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'details',   label: 'Candidate Information', icon: User },
  { id: 'screener',  label: 'Screener Round',         icon: UserCheck },
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
  record:      ApplicantRecord;
  onClose:     () => void;
  onUpdate:    (updated: ApplicantRecord) => void;
  initialTab?: TabId;
}) => {
  const [activeTab,  setActiveTab]  = useState<TabId>(initialTab);
  const [editMode,   setEditMode]   = useState<'view' | 'edit'>('view');
  const [screenerEditMode, setScreenerEditMode] = useState<'view' | 'edit'>('view');
  const [localRec,   setLocalRec]   = useState<ApplicantRecord>(record);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => { setLocalRec(record); setActiveTab(initialTab); }, [record, initialTab]);

  const handleRecordUpdate = (updated: ApplicantRecord) => {
    setLocalRec(updated);
    onUpdate(updated);
  };

  const handleStatusChange = async (newStatus: StatusType) => {
    setStatusBusy(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${localRec._id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      handleRecordUpdate(json.data);
      toast.success(`Status → ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const roundCount = localRec.interviewRounds?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

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
                value={localRec.status}
                onChange={(e) => handleStatusChange(e.target.value as StatusType)}
                disabled={statusBusy}
                className={`text-xs font-bold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-lime-400 ${STATUS_COLORS[localRec.status]}`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b px-6 gap-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px whitespace-nowrap ${
                activeTab === id
                  ? 'border-lime-500 text-lime-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'interview' && roundCount > 0 && (
                <span className="ml-1 bg-lime-100 text-lime-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {roundCount}
                </span>
              )}
              {id === 'screener' && localRec.screenerStatus && (
                <span className="ml-1 bg-lime-100 text-lime-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  ✓
                </span>
              )}
            </button>
          ))}
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
// Filter bar
// ─────────────────────────────────────────────────────────────────────────────
const FilterBar = ({
  search, setSearch,
  profileFilter, setProfileFilter, profileOptions,
  ctcFilter, setCtcFilter, ctcOptions,
  locationFilter, setLocationFilter, locationOptions,
  experienceFilter, setExperienceFilter,
  onReset, hasActiveFilters,
}: {
  search: string; setSearch: (v: string) => void;
  profileFilter: string; setProfileFilter: (v: string) => void; profileOptions: string[];
  ctcFilter: string; setCtcFilter: (v: string) => void; ctcOptions: string[];
  locationFilter: string; setLocationFilter: (v: string) => void; locationOptions: string[];
  experienceFilter: string; setExperienceFilter: (v: string) => void;
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
const AllApplicants: React.FC = () => {
  const [records,    setRecords]    = useState<ApplicantRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<ApplicantRecord | null>(null);
  const [initialTab, setInitialTab] = useState<TabId>('details');

  // Filter state
  const [search,           setSearch]           = useState('');
  const [profileFilter,    setProfileFilter]    = useState('');
  const [ctcFilter,        setCtcFilter]        = useState('');
  const [locationFilter,   setLocationFilter]   = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/applicant-records`)
      .then((r) => r.json())
      .then((res) => { setRecords(res.data ?? []); setLoading(false); })
      .catch(() => { toast.error('Failed to load records'); setLoading(false); });
  }, []);

  const handleUpdate = (updated: ApplicantRecord) => {
    setRecords((prev) => prev.map((r) => r._id === updated._id ? updated : r));
    setSelected(updated);
  };

  const openModal = (record: ApplicantRecord, tab: TabId = 'details') => {
    setInitialTab(tab);
    setSelected(record);
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

  const hasActiveFilters = !!(search || profileFilter || ctcFilter || locationFilter || experienceFilter);

  const resetFilters = () => {
    setSearch('');
    setProfileFilter('');
    setCtcFilter('');
    setLocationFilter('');
    setExperienceFilter('');
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Toaster position="top-right" />

      {selected && (
        <ApplicantModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          initialTab={initialTab}
        />
      )}

      <div className="w-64 flex-shrink-0 z-10 bg-white border-r">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white shadow-sm z-20 flex items-center px-4">
          <Navbar />
        </div>

        <main className="flex-1 overflow-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Recruitment Tracker</h1>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
              {filteredRecords.length} of {records.length} Applicants
            </span>
          </div>

          {!loading && records.length > 0 && (
            <FilterBar
              search={search} setSearch={setSearch}
              profileFilter={profileFilter} setProfileFilter={setProfileFilter} profileOptions={profileOptions}
              ctcFilter={ctcFilter} setCtcFilter={setCtcFilter} ctcOptions={ctcOptions}
              locationFilter={locationFilter} setLocationFilter={setLocationFilter} locationOptions={locationOptions}
              experienceFilter={experienceFilter} setExperienceFilter={setExperienceFilter}
              onReset={resetFilters} hasActiveFilters={hasActiveFilters}
            />
          )}

          {loading ? (
            <div className="flex justify-center mt-20">
              <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center mt-20 text-gray-400">No applications yet.</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center mt-20 text-gray-400">No applicants match your filters.</div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b font-semibold text-gray-600">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Profile</th>
                    <th className="p-4">Current CTC</th>
                    <th className="p-4">Expected CTC</th>
                    <th className="p-4">Exp</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{r.full_name}</td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2 text-gray-600"><Mail size={14} />{r.email}</div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs"><Phone size={14} />{r.phone}</div>
                      </td>
                      <td className="p-4 text-gray-600 text-xs">{r.designation || '—'}</td>
                      <td className="p-4 font-medium">{r.current_ctc || 'N/A'}</td>
                      <td className="p-4 font-medium">{r.expected_monthly_ctc || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.experience === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {r.experience === 'Yes' ? 'EXP' : 'FRESH'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{[r.city, r.state].filter(Boolean).join(', ')}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AllApplicants;