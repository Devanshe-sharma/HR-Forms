import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Edit2, Plus, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import Modal from '../../components/Modal';
import NewRequisitionForm from './new-requisition-form';
import UpdateRequisition  from './UpdateRequisition';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const fmtDate = (d?: string | null) => d ? dayjs(d).format('DD MMM YYYY') : '—';

type Requisition = {
  _id: string;
  serial_no: number;
  designation: string;
  hiring_dept: string;
  requisitioner_name: string;
  request_date: string;
  select_joining_days: string;
  planned_joined: string;
  hiring_status: string;
  fmsStatus: 'Open' | 'Closed';
  candidate_experience_level?: string;
  reporting_manager?: string;
  budget?: number;
  fms_score?: number;
  total_tasks?: number;
  done_in_time?: number;
  done_but_delayed?: number;
  tasks_due?: number;
  tasks_overdue?: number;
  not_yet_due?: number;
};

const HIRING_STATUS_OPTIONS = [
  'New', 'No Change in Status', 'CVs Shortlisting Started', 'Interviews Started',
  'Offer Sent', 'Offer Accepted', 'Joined', 'Not Accepted', 'Not Joined',
  'On Hold', 'Cancelled', 'Filled Internally', 'Filled Externally',
];

const STATUS_CHIP: Record<string, string> = {
  'New':                      'bg-blue-100 text-blue-800',
  'No Change in Status':      'bg-gray-100 text-gray-700',
  'CVs Shortlisting Started': 'bg-blue-100 text-blue-800',
  'Interviews Started':       'bg-blue-100 text-blue-800',
  'Offer Sent':               'bg-amber-100 text-amber-800',
  'Offer Accepted':           'bg-amber-100 text-amber-800',
  'Joined':                   'bg-green-100 text-green-800',
  'Not Accepted':             'bg-red-100 text-red-800',
  'Not Joined':               'bg-red-100 text-red-800',
  'On Hold':                  'bg-amber-100 text-amber-800',
  'Cancelled':                'bg-red-100 text-red-800',
  'Filled Internally':        'bg-green-100 text-green-800',
  'Filled Externally':        'bg-green-100 text-green-800',
};

type CardFilter = 'all' | 'open' | 'closed' | 'overdue';

export default function RequisitionDashboard() {
  const navigate                      = useNavigate();
  const [searchParams]                = useSearchParams();

  const [rows,     setRows]     = useState<Requisition[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [cardFilter,   setCardFilter]   = useState<CardFilter>('all');

  const modal  = searchParams.get('modal');
  const editId = searchParams.get('id');

  const newModalOpen    = modal === 'new';
  const viewModalOpen   = modal === 'view'   && !!editId;
  const updateModalOpen = modal === 'update' && !!editId;

  const openNew    = () => navigate('/recruitment?modal=new');
  const openView   = (id: string) => navigate(`/recruitment?modal=view&id=${id}`);
  const openEdit   = (id: string) => navigate(`/recruitment?modal=update&id=${id}`);
  const closeModal = () => navigate('/recruitment');

  // Always fetch the full set — filtering (including the stat cards) is
  // done client-side so the card counts stay accurate regardless of which
  // filter is currently active.
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/hiringrequisitions`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const counts = useMemo(() => ({
    total:   rows.length,
    open:    rows.filter(r => r.fmsStatus === 'Open').length,
    closed:  rows.filter(r => r.fmsStatus === 'Closed').length,
    overdue: rows.filter(r => r.fmsStatus !== 'Closed' && (r.tasks_overdue ?? 0) > 0).length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (cardFilter === 'open'    && r.fmsStatus !== 'Open')  return false;
      if (cardFilter === 'closed'  && r.fmsStatus !== 'Closed') return false;
      if (cardFilter === 'overdue' && (r.fmsStatus === 'Closed' || (r.tasks_overdue ?? 0) === 0)) return false;

      if (filterStatus && r.hiring_status !== filterStatus) return false;

      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.designation} ${r.hiring_dept} ${r.requisitioner_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [rows, cardFilter, filterStatus, search]);

  const anyModalOpen = newModalOpen || viewModalOpen || updateModalOpen;

  const CARDS: { key: CardFilter; label: string; value: number; color: string; bg: string }[] = [
    { key: 'all',     label: 'Total Requisitions', value: counts.total,   color: '#3B82F6', bg: '#EFF6FF' },
    { key: 'open',    label: 'Open',               value: counts.open,    color: '#059669', bg: '#ECFDF5' },
    { key: 'closed',  label: 'Closed',             value: counts.closed,  color: '#6B7280', bg: '#F9FAFB' },
    { key: 'overdue', label: 'Overdue Tasks',      value: counts.overdue, color: '#DC2626', bg: '#FEF2F2' },
  ];

  return (
    <>
      <div className={`min-h-screen bg-gray-100 flex transition-all duration-200 ${anyModalOpen ? 'blur-sm brightness-75 pointer-events-none select-none' : ''}`}>
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <div className="p-4 md:p-6 mt-10 text-sm text-gray-800">

            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold">Hiring Requisitions</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  title="Refresh"
                  className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={openNew}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
                >
                  <Plus size={16} />
                  New Requisition
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-md mb-4">
                {error}
                <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
              </div>
            )}

            {/* Stat / Filter Cards */}
            <div className="flex gap-3 mb-5 flex-wrap">
              {CARDS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCardFilter(c.key)}
                  className="flex-1 min-w-[150px] text-left p-3.5 rounded-lg border transition"
                  style={{
                    backgroundColor: c.bg,
                    borderColor: cardFilter === c.key ? c.color : 'transparent',
                    borderWidth: cardFilter === c.key ? 2 : 1,
                    boxShadow: cardFilter === c.key ? `0 0 0 1px ${c.color}30` : undefined,
                  }}
                >
                  <p className="text-2xl font-bold leading-none" style={{ color: c.color }}>{c.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-[2]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search designation, dept, name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="flex-1 min-w-[160px] px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Hiring Statuses</option>
                {HIRING_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={cardFilter === 'open' ? 'Open' : cardFilter === 'closed' ? 'Closed' : ''}
                onChange={e => {
                  const v = e.target.value;
                  setCardFilter(v === 'Open' ? 'open' : v === 'Closed' ? 'closed' : 'all');
                }}
                className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All FMS Statuses</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
              {(cardFilter !== 'all' || filterStatus || search) && (
                <button
                  onClick={() => { setCardFilter('all'); setFilterStatus(''); setSearch(''); }}
                  className="px-4 py-2 text-sm text-blue-600 hover:underline whitespace-nowrap"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <span className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-[0.813rem] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2.5 font-semibold w-10">#</th>
                      <th className="px-3 py-2.5 font-semibold">Designation</th>
                      <th className="px-3 py-2.5 font-semibold">Department</th>
                      <th className="px-3 py-2.5 font-semibold">Raised By</th>
                      <th className="px-3 py-2.5 font-semibold w-32">Request Date</th>
                      <th className="px-3 py-2.5 font-semibold w-32">Planned Joining</th>
                      <th className="px-3 py-2.5 font-semibold w-52">Hiring Status</th>
                      <th className="px-3 py-2.5 font-semibold w-24">FMS Status</th>
                      <th className="px-3 py-2.5 font-semibold w-20 text-right">FMS Score</th>
                      <th className="px-3 py-2.5 font-semibold w-20 text-center">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-gray-400">No requisitions match the current filters</td>
                      </tr>
                    )}
                    {filteredRows.map(row => {
                      return (
                        <tr key={row._id} onClick={() => openView(row._id)} className="hover:bg-gray-50 transition cursor-pointer">
                          <td className="px-3 py-2.5">{row.serial_no}</td>
                          <td className="px-3 py-2.5">
                            <span className="block font-medium">{row.designation}</span>
                            {row.candidate_experience_level && (
                              <span className="text-xs text-gray-400">{row.candidate_experience_level}</span>
                            )}
                          </td>

                          <td className="px-3 py-2.5">{row.hiring_dept}</td>
                          <td className="px-3 py-2.5">{row.requisitioner_name}</td>
                          <td className="px-3 py-2.5">{fmtDate(row.request_date)}</td>
                          <td className="px-3 py-2.5">{fmtDate(row.planned_joined)}</td>

                          {/* Hiring Status — read-only display. All
                              changes go through the Update Requisition
                              form, which uses the real PATCH /:id route
                              (rescoring + email included). */}
                          <td className="px-3 py-2.5">
                            {row.hiring_status && (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CHIP[row.hiring_status] ?? 'bg-gray-100 text-gray-700'}`}>
                                {row.hiring_status}
                              </span>
                            )}
                          </td>

                          {/* FMS Status — read-only. Computed automatically
                              from checklist completion server-side. */}
                          <td className="px-3 py-2.5">
                            <span
                              title="Computed automatically from checklist completion"
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                row.fmsStatus === 'Open'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {row.fmsStatus}
                            </span>
                          </td>

                          <td className={`px-3 py-2.5 text-right font-medium ${
                            (row.fms_score ?? 0) < 0 ? 'text-red-600' : 'text-gray-700'
                          }`}>
                            {row.fms_score ?? 0}
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <button
                              title="Update this requisition"
                              onClick={e => { e.stopPropagation(); openEdit(row._id); }}
                              className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition"
                            >
                              <Edit2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
              {(cardFilter !== 'all' || filterStatus || search) ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={newModalOpen}
        onClose={closeModal}
        title="New Hiring Requisition"
        maxWidth="max-w-3xl"
      >
        <NewRequisitionForm
          asModal
          onSuccess={() => { closeModal(); fetchData(); }}
          onClose={closeModal}
        />
      </Modal>

      <Modal
        open={viewModalOpen}
        onClose={closeModal}
        title="View Hiring Requisition"
        maxWidth="max-w-4xl"
      >
        {editId && (
          <UpdateRequisition
            id={editId}
            asModal
            viewOnly
            onClose={closeModal}
          />
        )}
      </Modal>

      <Modal
        open={updateModalOpen}
        onClose={closeModal}
        title="Update Hiring Requisition"
        maxWidth="max-w-4xl"
      >
        {editId && (
          <UpdateRequisition
            id={editId}
            asModal
            onSuccess={() => { closeModal(); fetchData(); }}
            onClose={closeModal}
          />
        )}
      </Modal>
    </>
  );
}