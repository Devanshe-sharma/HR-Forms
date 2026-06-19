import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Edit2, Plus, RefreshCw } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import Modal from '../../components/Modal';
import NewRequisitionForm from './new-requisition-form';
import UpdateRequisition  from './UpdateRequisition';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

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

export default function RequisitionDashboard() {
  const navigate                      = useNavigate();
  const [searchParams]                = useSearchParams();

  const [rows,     setRows]     = useState<Requisition[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFms,    setFilterFms]    = useState('');

  // ── Modal state driven by URL query params ─────────────────────────────────
  const modal  = searchParams.get('modal');
  const editId = searchParams.get('id');

  const newModalOpen = modal === 'new';
  const updateModalOpen = modal === 'update' && !!editId;

  const openNew    = () => navigate('/recruitment?modal=new');
  const openEdit   = (id: string) => navigate(`/recruitment?modal=update&id=${id}`);
  const closeModal = () => navigate('/recruitment');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search)       params.set('search',    search);
      if (filterStatus) params.set('status',    filterStatus);
      if (filterFms)    params.set('fmsStatus', filterFms);

      const res  = await fetch(`${API_BASE}/hiringrequisitions?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterFms]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Inline status save ─────────────────────────────────────────────────────
  const saveStatus = async (id: string, field: 'hiring_status' | 'fmsStatus', value: string) => {
    setSavingId(id);
    try {
      const res = await fetch(`${API_BASE}/hiringrequisitions/${id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
    } catch {
      setError('Failed to save — please try again');
    } finally {
      setSavingId(null);
    }
  };

  const anyModalOpen = newModalOpen || updateModalOpen;

  return (
    <>
      {/* ── Page content — blurred when any modal is open ── */}
      <div className={`min-h-screen bg-gray-100 flex transition-all duration-200 ${anyModalOpen ? 'blur-sm brightness-75 pointer-events-none select-none' : ''}`}>
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <div className="p-4 md:p-6 mt-10 text-sm text-gray-800">

            {/* Header */}
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

            {/* Error */}
            {error && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-md mb-4">
                {error}
                <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
              </div>
            )}

            {/* Filters */}
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
                value={filterFms}
                onChange={e => setFilterFms(e.target.value)}
                className="flex-1 min-w-[130px] px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All FMS Statuses</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-16">
                <span className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-[0.813rem] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2.5 font-semibold w-10">#</th>
                      <th className="px-3 py-2.5 font-semibold">Designation</th>
                      <th className="px-3 py-2.5 font-semibold">Department</th>
                      <th className="px-3 py-2.5 font-semibold">Raised By</th>
                      <th className="px-3 py-2.5 font-semibold">Request Date</th>
                      <th className="px-3 py-2.5 font-semibold">Planned Joining</th>
                      <th className="px-3 py-2.5 font-semibold w-52">Hiring Status</th>
                      <th className="px-3 py-2.5 font-semibold w-28">FMS</th>
                      <th className="px-3 py-2.5 font-semibold w-20 text-center">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-400">No requisitions found</td>
                      </tr>
                    )}
                    {rows.map(row => (
                      <tr key={row._id} onClick={() => openEdit(row._id)} className={`hover:bg-gray-50 transition cursor-pointer ${savingId === row._id ? 'opacity-50' : ''}`} >
                        <td className="px-3 py-2.5">{row.serial_no}</td>
                        <td className="px-3 py-2.5">
                          <span className="block font-medium">{row.designation}</span>
                          {row.candidate_experience_level && (
                            <span className="text-xs text-gray-400">{row.candidate_experience_level}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{row.hiring_dept}</td>
                        <td className="px-3 py-2.5">{row.requisitioner_name}</td>
                        <td className="px-3 py-2.5">{row.request_date || '—'}</td>
                        <td className="px-3 py-2.5">{row.planned_joined || '—'}</td>

                        {/* Inline: Hiring Status */}
                        <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                          {row.hiring_status && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CHIP[row.hiring_status] ?? 'bg-gray-100 text-gray-700'}`}>
                              {row.hiring_status}
                            </span>
                          )}
                          <select
                            value={row.hiring_status || ''}
                            onChange={e => saveStatus(row._id, 'hiring_status', e.target.value)}
                            disabled={savingId === row._id}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          >
                            {HIRING_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>

                        {/* Inline: FMS Status */}
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => saveStatus(row._id, 'fmsStatus', row.fmsStatus === 'Open' ? 'Closed' : 'Open')}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${
                              row.fmsStatus === 'Open'
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {row.fmsStatus}
                          </button>
                        </td>

                        {/* Update button */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            title="Update this requisition"
                            onClick={() => openEdit(row._id)}
                            className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Edit2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              {rows.length} record{rows.length !== 1 ? 's' : ''}
              {(filterStatus || filterFms || search) ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Modals — outside the blur div so they stay sharp ── */}
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