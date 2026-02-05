'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Plus, X, CheckCircle, XCircle, Edit, Trash2, Save, Archive, Calendar } from 'lucide-react';
// import { formatDate } from 'date-fns';



const formatDate = (date?: string | Date | null): string => {
  if (!date) return 'TBD';

  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid';

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};
// ─── TYPES ────────────────────────────────────────────────
type Employee = {
  name: string;
  dept: string;
  desig: string;
  email: string;
};

const STATUS_OPTIONS = [
  'Proposed',
  'Suggested',
  'Scheduled',
  'Rejected',
  'Completed',
  'Archived'
] as const;

type Outing = {
  _id?: string;
  topic: string;
  description: string;
  tentativePlace?: string;
  tentativeBudget?: number;
  tentativeDate?: string | Date;
  status: string;
  priority?: 'P1' | 'P2' | 'P3';
  reason?: string;
  remark?: string;
  proposedByRole?: string;
  proposedByName?: string;
  quarter?: string;
  financialYear?: string;
  archivedAt?: string;
  feedbacks?: Array<{
    employeeName: string;
    department: string;
    designation: string;
    attended: boolean;
    overallRating?: number;
    contentQuality?: number;
    whatWasMissing?: string;
    howHelpful?: string;
    submittedAt: string;
  }>;
  discrepancies?: Array<{
    employeeName: string;
    reason: string;
    createdAt: string;
  }>;
};

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function Outing() {
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'HR';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [outingList, setOutingList] = useState<Outing[]>([]);

  // HR: Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    description: '',
    tentativePlace: '',
    tentativeBudget: '',
    tentativeDate: '',
    priority: 'P3' as 'P1' | 'P2' | 'P3',
  });

  // HR: Inline Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Outing>>({});

const [outingNameFilter, setOutingNameFilter] = useState('');
const [quarterFilter, setQuarterFilter] = useState('');
const [fyFilter, setFyFilter] = useState('');
const [archivedFilter, setArchivedFilter] = useState('');



  const filteredOutings = useMemo(() => {
  let list = [...outingList];

  // Outing Name filter
  if (outingNameFilter.trim()) {
    const lower = outingNameFilter.trim().toLowerCase();
    list = list.filter(o => o.topic?.toLowerCase().includes(lower));
  }

  // Quarter
  if (quarterFilter) {
    list = list.filter(o => o.quarter === quarterFilter);
  }

  // Financial Year
  if (fyFilter) {
    list = list.filter(o => o.financialYear === fyFilter);
  }

  // Archived
  if (archivedFilter === 'yes') {
    list = list.filter(o => o.status === 'Archived');
  } else if (archivedFilter === 'no') {
    list = list.filter(o => o.status !== 'Archived');
  }

  return list;
}, [outingList, outingNameFilter, quarterFilter, fyFilter, archivedFilter]);

  // Management: Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectOutingId, setRejectOutingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Management: Suggest New Outing
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
const [suggestForm, setSuggestForm] = useState({
  topic: '',
  description: '',
  tentativePlace: '',
  tentativeBudget: '',
  tentativeDate: '',
  reason: '',
  priority: '' as 'P1' | 'P2' | 'P3',
});


  const handleArchive = async (id: string) => {
  if (!window.confirm('Are you sure you want to archive this outing?')) return;

  try {
    await axios.patch(`${API_BASE}/outing/${id}`, {
      status: 'Archived',
      archivedAt: new Date().toISOString(),
    });
    alert('Outing archived successfully!');
    refreshData(); // Refresh the table to reflect the change
  } catch (err: any) {
    console.error('Archive failed:', err);
    alert('Failed to archive: ' + (err.response?.data?.error || err.message));
  }
};

  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api';

  // ─── LOAD DATA ────────────────────────────────────────────
  const refreshData = async () => {
    try {
      const [oRes, eRes] = await Promise.all([
        axios.get(`${API_BASE}/outing`),
        axios.get(`${API_BASE}/employees?lightweight=true`)
      ]);
      setOutingList(oRes.data.data || []);
      setEmployees(eRes.data.data || []);
    } catch (err) {
      console.error("Data load failed", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ─── MANAGEMENT ACTIONS ───────────────────────────────────
  
  const openRejectModal = (id: string) => {
    setRejectOutingId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectOutingId) return;
    if (!rejectReason.trim()) return alert('Rejection reason is required');

    try {
      await axios.patch(`${API_BASE}/outing/${rejectOutingId}`, {
        status: 'Rejected',
        reason: rejectReason.trim()
      });
      alert('Outing rejected!');
      setIsRejectModalOpen(false);
      setRejectOutingId(null);
      setRejectReason('');
      refreshData();
    } catch (err: any) {
      alert('Reject failed: ' + (err.response?.data?.error || err.message));
    }
  };
  const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'P1': return 'text-red-600';
    case 'P2': return 'text-orange-600';
    case 'P3': return 'text-green-600';
    default: return 'text-gray-500';
  }
};

  // ─── HR: CREATE PROPOSAL ─────────────────────────────────
  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
    topic: suggestForm.topic.trim(),
    description: suggestForm.description.trim(),
    tentativePlace: suggestForm.tentativePlace.trim() || undefined,
    tentativeBudget: Number(suggestForm.tentativeBudget) || undefined,
    tentativeDate: suggestForm.tentativeDate ? new Date(suggestForm.tentativeDate).toISOString() : undefined,
    reason: suggestForm.reason.trim() || undefined,
    priority: suggestForm.priority,
    proposedByRole: 'Management',
    proposedByName: 'Management User',
    status: 'Suggested',           // ← this is the key change
  };

    try {
      const res = await axios.post(`${API_BASE}/outing`, payload);
      if (res.data.success) {
        alert('Outing proposal submitted!');
        setIsCreateModalOpen(false);
        setFormData({ topic: '', description: '', tentativePlace: '', tentativeBudget: '', tentativeDate: '', priority: 'P3' });
        refreshData();
      }
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'Server error'));
    }
  };
  const approveOuting = async (id: string) => {
  if (!window.confirm('Approve this outing proposal?')) return;

  try {
    await axios.patch(`${API_BASE}/outing/${id}`, { 
      status: 'Scheduled'          // ← changed from 'Approved' to 'Scheduled'
    });
    alert('Outing approved and scheduled!');
    refreshData();
  } catch (err: any) {
    alert('Approve failed: ' + (err.response?.data?.error || err.message));
  }
};

useEffect(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight

  outingList.forEach(async (o) => {
    if (!o.tentativeDate || o.status === 'Completed' || o.status === 'Archived') return;

    const trainingDate = new Date(o.tentativeDate);
    trainingDate.setHours(0, 0, 0, 0);

    // 1. Mark as Completed if date is today or earlier
    if (today >= trainingDate) {
      try {
        await axios.patch(`${API_BASE}/outing/${o._id}`, {
          status: 'Completed',
          // Optional: completionDate: new Date().toISOString()
        });
        console.log(`Marked as Completed: ${o.topic}`);
      } catch (err) {
        console.error('Auto-complete failed:', err);
      }
    }

    // 2. Auto-archive if Completed and 3+ days passed
    // (you can store completionDate, or just use tentativeDate + 3 days)
    const threeDaysAfter = new Date(trainingDate);
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

    if (o.status === 'Completed' && today >= threeDaysAfter) {
      try {
        await axios.patch(`${API_BASE}/outing/${o._id}`, {
          status: 'Archived',
          archivedAt: new Date().toISOString()
        });
        console.log(`Archived: ${o.topic}`);
      } catch (err) {
        console.error('Auto-archive failed:', err);
      }
    }
  });

}, [outingList, refreshData]);
  // ─── HR: INLINE EDITING ───────────────────────────────────
  const startEditing = (outing: Outing) => {
    setEditingId(outing._id || null);
    setEditData({ ...outing });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
  if (!editingId || !editData) return;

  try {
    // Optional: auto-set Scheduled from Suggested when date is added
    const updated = { ...editData };
    if (updated.tentativeDate && editData.status === 'Suggested') {
      updated.status = 'Scheduled';
    }

    await axios.patch(`${API_BASE}/outing/${editingId}`, updated);
    alert('Outing updated!');
    setEditingId(null);
    setEditData({});
    refreshData();
  } catch (err: any) {
    alert('Update failed: ' + (err.response?.data?.error || err.message));
  }
};
  // ─── MANAGEMENT: SUGGEST NEW OUTING ───────────────────────
  const submitSuggestion = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!suggestForm.topic.trim() || !suggestForm.description.trim()) {
    return alert('Topic and Description are required');
  }

  const payload = {
    topic: suggestForm.topic.trim(),
    description: suggestForm.description.trim(),
    tentativePlace: suggestForm.tentativePlace.trim() || undefined,
    tentativeBudget: Number(suggestForm.tentativeBudget) || undefined,
    tentativeDate: suggestForm.tentativeDate ? new Date(suggestForm.tentativeDate).toISOString() : undefined,
    reason: suggestForm.reason.trim() || undefined,
    priority: suggestForm.priority,
    proposedByRole: 'Management',
    proposedByName: 'Management User',
    status: 'Suggested',  // ← Management suggestion → directly "Suggested"
  };

  try {
    const res = await axios.post(`${API_BASE}/outing`, payload);
    if (res.data.success) {
      alert('Your suggestion has been submitted to HR!');
      setIsSuggestModalOpen(false);
      setSuggestForm({
        topic: '',
        description: '',
        tentativePlace: '',
        tentativeBudget: '',
        tentativeDate: '',
        reason: '',
        priority: 'P3',
      });
      refreshData();
    }
  } catch (err: any) {
    alert('Failed to submit: ' + (err.response?.data?.error || err.message));
  }
};

// Feedback form state
const [feedbackForm, setFeedbackForm] = useState({
  employeeName: '',
  department: '',
  designation: '',
  outingId: '',
  attended: false,
  overallRating: '',
  contentQuality: '',
  whatWasMissing: '',
  howHelpful: '',
});
const [loadingFeedback, setLoadingFeedback] = useState(false);

// Submit handler
const handleOutingFeedbackSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!feedbackForm.employeeName || !feedbackForm.outingId) {
    return alert('Please select your name and an outing');
  }

  if (!feedbackForm.attended) {
    return alert('Please confirm attendance');
  }

  if (!feedbackForm.overallRating || !feedbackForm.contentQuality) {
    return alert('Please provide both ratings');
  }

  setLoadingFeedback(true);

  try {
    await axios.post(`${API_BASE}/outing/${feedbackForm.outingId}/feedback`, {
      employeeName: feedbackForm.employeeName,
      department: feedbackForm.department,
      designation: feedbackForm.designation,
      attended: feedbackForm.attended,
      overallRating: Number(feedbackForm.overallRating),
      contentQuality: Number(feedbackForm.contentQuality),
      whatWasMissing: feedbackForm.whatWasMissing?.trim() || undefined,
      howHelpful: feedbackForm.howHelpful?.trim() || undefined,
      submittedAt: new Date().toISOString(),
    });

    alert('Feedback submitted successfully!');
    
    // Reset form
    setFeedbackForm({
      employeeName: '',
      department: '',
      designation: '',
      outingId: '',
      attended: false,
      overallRating: '',
      contentQuality: '',
      whatWasMissing: '',
      howHelpful: '',
    });
  } catch (err: any) {
    alert('Failed to submit feedback: ' + (err.response?.data?.error || err.message));
  } finally {
    setLoadingFeedback(false);
  }
};

  // ─── RENDER ────────────────────────────────────────────────
return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />

        <main className="p-4 mt-20 max-w-7xl mx-auto w-full relative">
          {/* Floating + Button - HR tab */}
          {currentTab === 'HR' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="fixed top-24 right-8 z-40 bg-[#7a8b2e] text-white rounded-full p-5 shadow-2xl hover:bg-[#5e6c24]"
              title="Propose New Outing"
            >
              <Plus size={32} />
            </button>
          )}

          {/* Floating + Button - Management suggestion */}
          {currentTab === 'management' && (
            <button
              onClick={() => setIsSuggestModalOpen(true)}
              className="fixed top-24 right-8 z-40 bg-indigo-600 text-white rounded-full p-5 shadow-2xl hover:bg-indigo-700 transition transform hover:scale-110 active:scale-95"
              title="Suggest New Outing / Event"
            >
              <Plus size={32} />
            </button>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 capitalize">
              Outing / Event Module - {currentTab.replace('-', ' ')}
            </h2>
          </div>

          {/* ─── HR TAB ─── */}
          {currentTab === 'HR' && (
              <div className="space-y-8">
                {/* Debug Info */}
                <div className="bg-yellow-100 p-4 rounded border border-yellow-400 text-sm">
                  <strong>Debug Info:</strong><br />
                  Total outings loaded: {outingList.length}<br />
                  Filtered outings: {filteredOutings.length}<br />
                  Current filters → Outing: "{outingNameFilter}", Quarter: "{quarterFilter}", FY: "{fyFilter}", Archived: "{archivedFilter}"
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Outing Name</label>
                      <input
                        placeholder="Search outing topics..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                        value={outingNameFilter}
                        onChange={(e) => setOutingNameFilter(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                        value={quarterFilter}
                        onChange={(e) => setQuarterFilter(e.target.value)}
                      >
                        <option value="">All Quarters</option>
                        <option value="Q1">Q1 (Apr–Jun)</option>
                        <option value="Q2">Q2 (Jul–Sep)</option>
                        <option value="Q3">Q3 (Oct–Dec)</option>
                        <option value="Q4">Q4 (Jan–Mar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                        value={fyFilter}
                        onChange={(e) => setFyFilter(e.target.value)}
                      >
                        <option value="">All FY</option>
                        <option value="FY 2025-2026">FY 2025-2026</option>
                        <option value="FY 2024-2025">FY 2024-2025</option>
                        <option value="FY 2023-2024">FY 2023-2024</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Archived</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                        value={archivedFilter}
                        onChange={(e) => setArchivedFilter(e.target.value)}
                      >
                        <option value="">All</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setOutingNameFilter('');
                          setQuarterFilter('');
                          setFyFilter('');
                          setArchivedFilter('');
                        }}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>

                {/* Editable Table */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 bg-gray-50 border-b">
                    <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">
                      Outing / Event Control Panel
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                        <tr>
                          <th className="p-4">Sno.</th>
                          <th className="p-4">Outing Topic</th>
                          <th className="p-4">Description</th>
                          <th className="p-4">Tentative Place</th>
                          <th className="p-4">Tentative Budget</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Priority</th>
                          <th className="p-4 text-center">Action</th>
                          <th className="p-4 text-center">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-gray-100">
                          {filteredOutings.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-gray-500 italic">
                                No outings found matching the filters
                              </td>
                            </tr>
                          ) : (
                            filteredOutings.map((o, i) => {
                              const isEditing = editingId === o._id;
                              const isApproved = o.status === 'Approved';
                              const isSuggested = o.status === 'Suggested';

                            return (
                              <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                                <td className="p-4 text-gray-400">{i + 1}</td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <input
                                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.topic ?? o.topic ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))}
                                    />
                                  ) : (
                                    <span className="font-bold text-gray-800">{o.topic || '—'}</span>
                                  )}
                                </td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <textarea
                                      className="w-full border rounded px-2 py-1 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.description ?? o.description ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                  ) : (
                                    <span className="text-gray-500 block max-w-[180px] truncate">{o.description || '—'}</span>
                                  )}
                                </td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <input
                                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.tentativePlace ?? o.tentativePlace ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, tentativePlace: e.target.value }))}
                                    />
                                  ) : (
                                    o.tentativePlace || '—'
                                  )}
                                </td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.tentativeBudget ?? o.tentativeBudget ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, tentativeBudget: Number(e.target.value) || 0 }))}
                                    />
                                  ) : (
                                    o.tentativeBudget ? `₹${o.tentativeBudget}` : '—'
                                  )}
                                </td>

                                <td className="p-4">
                                    <span className={`status-pill ${o.status?.toLowerCase().replace(' ', '-') || ''}`}>
                                      {o.status || '—'}
                                    </span>
                                  </td>

                                <td className="p-4 text-gray-600 font-mono italic">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                    value={
                                      editData.tentativeDate
                                        ? new Date(editData.tentativeDate).toISOString().split('T')[0]
                                        : ''
                                    }
                                    onChange={e =>
                                      setEditData(prev => ({
                                        ...prev,
                                        tentativeDate: e.target.value || undefined,
                                      }))
                                    }
                                  />
                                ) : (
                                  o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'
                                )}
                              </td>

                                {/* Priority */}
                                <td className="p-4">
                                  {isEditing ? (
                                    <select
                                      className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.priority ?? o.priority ?? 'P3'}
                                      onChange={e =>
                                        setEditData(prev => ({
                                          ...prev,
                                          priority: e.target.value as 'P1' | 'P2' | 'P3'
                                        }))
                                      }
                                    >
                                      <option value="P1">P1</option>
                                      <option value="P2">P2</option>
                                      <option value="P3">P3</option>
                                    </select>
                                  ) : (
                                    <span className={`priority-text ${o.priority?.toLowerCase() || 'p3'}`}>
                                      {o.priority || 'P3'}
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                {/* Action */}
                                <td className="p-4 text-center">
                                  <div className="flex justify-center gap-3 flex-wrap">
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={saveEdit}
                                          className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                                          title="Save changes"
                                        >
                                          <Save size={16} />
                                        </button>
                                        <button
                                          onClick={cancelEditing}
                                          className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                          title="Cancel"
                                        >
                                          <X size={16} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => startEditing(o)}
                                          className="p-2 hover:bg-blue-50 text-blue-600 rounded transition"
                                          title="Edit"
                                        >
                                          <Edit size={16} />
                                        </button>

                                        {/* Show Schedule button for Suggested items */}
                                        {isSuggested && (
                                          <button
                                            onClick={() => startEditing(o)}
                                            className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                            title="Schedule this suggested outing"
                                          >
                                            <Calendar size={16} />
                                          </button>
                                        )}

                                        {/* Archive button */}
                                        <button
                                          onClick={() => handleArchive(o._id!)}
                                          className="p-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition"
                                          title="Archive"
                                        >
                                          <Archive size={16} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>

                                {/* Remark */}
                                <td className="p-4 text-center text-gray-400 italic font-medium">
                                  {o.remark || '--'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

          {/* ─── MANAGEMENT TAB ─── */}
          {currentTab === 'management' && (
  <div className="space-y-8">
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 bg-gray-50 border-b">
        <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">
          Management Review – Pending HR Proposals
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
            <tr>
              <th className="p-4">Sno.</th>
              <th className="p-4">Outing Topic</th>
              <th className="p-4">Topic Description</th>
              <th className="p-4">Tentative place</th>
              <th className="p-4">Tentative Budget</th>
              <th className="p-4 text-center">Action</th>
              <th className="p-4 text-center">Priority</th>
              <th className="p-4">Suggestions (if any)</th>
              <th className="p-4">Date of the Outing (tentative)</th>
            </tr>
          </thead>

          <tbody className="text-xs divide-y divide-gray-100">
            {outingList
              .filter(o => o.status === 'Proposed')  // ← Only show Proposed (from HR)
              .length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-500 italic">
                  No pending proposals from HR at the moment
                </td>
              </tr>
            ) : (
              outingList
                .filter(o => o.status === 'Proposed')
                .map((o, i) => (
                  <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                    <td className="p-4 text-gray-400">{i + 1}</td>
                    <td className="p-4 font-bold text-gray-800">{o.topic || '—'}</td>
                    <td className="p-4 text-gray-600 max-w-[200px] truncate">{o.description || '—'}</td>
                    <td className="p-4">{o.tentativePlace || '—'}</td>
                    <td className="p-4">{o.tentativeBudget ? `₹${o.tentativeBudget.toLocaleString()}` : '—'}</td>

                    {/* Action - Approve/Reject only for Proposed */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => approveOuting(o._id!)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-xs font-medium transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectModal(o._id!)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-xs font-medium transition"
                        >
                          Reject
                        </button>
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`font-medium ${getPriorityColor(o.priority)}`}>
                        {o.priority || '—'}
                      </span>
                    </td>

                    <td className="p-4 text-gray-600">{o.reason || '—'}</td>
                    <td className="p-4 text-gray-600 font-mono italic">
                      {o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </section>
    {/* Editable Table */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 bg-gray-50 border-b">
                    <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">
                      Outing / Event Control Panel
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                        <tr>
                          <th className="p-4">Sno.</th>
                          <th className="p-4">Outing Topic</th>
                          <th className="p-4">Description</th>
                          <th className="p-4">Tentative Place</th>
                          <th className="p-4">Tentative Budget</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Priority</th>
                          <th className="p-4 text-center">Action</th>
                          <th className="p-4 text-center">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-gray-100">
                          {filteredOutings.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-gray-500 italic">
                                No outings found matching the filters
                              </td>
                            </tr>
                          ) : (
                            filteredOutings.map((o, i) => {
                              const isEditing = editingId === o._id;
                              const isApproved = o.status === 'Approved';
                              const isSuggested = o.status === 'Suggested';

                            return (
                              <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                                <td className="p-4 text-gray-400">{i + 1}</td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <input
                                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.topic ?? o.topic ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))}
                                    />
                                  ) : (
                                    <span className="font-bold text-gray-800">{o.topic || '—'}</span>
                                  )}
                                </td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <textarea
                                      className="w-full border rounded px-2 py-1 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.description ?? o.description ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                  ) : (
                                    <span className="text-gray-500 block max-w-[180px] truncate">{o.description || '—'}</span>
                                  )}
                                </td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <input
                                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.tentativePlace ?? o.tentativePlace ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, tentativePlace: e.target.value }))}
                                    />
                                  ) : (
                                    o.tentativePlace || '—'
                                  )}
                                </td>

                                <td className="p-4">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.tentativeBudget ?? o.tentativeBudget ?? ''}
                                      onChange={e => setEditData(prev => ({ ...prev, tentativeBudget: Number(e.target.value) || 0 }))}
                                    />
                                  ) : (
                                    o.tentativeBudget ? `₹${o.tentativeBudget}` : '—'
                                  )}
                                </td>

                                <td className="p-4">
                                    <span className={`status-pill ${o.status?.toLowerCase().replace(' ', '-') || ''}`}>
                                      {o.status || '—'}
                                    </span>
                                  </td>

                                <td className="p-4 text-gray-600 font-mono italic">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                    value={
                                      editData.tentativeDate
                                        ? new Date(editData.tentativeDate).toISOString().split('T')[0]
                                        : ''
                                    }
                                    onChange={e =>
                                      setEditData(prev => ({
                                        ...prev,
                                        tentativeDate: e.target.value || undefined,
                                      }))
                                    }
                                  />
                                ) : (
                                  o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'
                                )}
                              </td>

                                {/* Priority */}
                                <td className="p-4">
                                  {isEditing ? (
                                    <select
                                      className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                      value={editData.priority ?? o.priority ?? 'P3'}
                                      onChange={e =>
                                        setEditData(prev => ({
                                          ...prev,
                                          priority: e.target.value as 'P1' | 'P2' | 'P3'
                                        }))
                                      }
                                    >
                                      <option value="P1">P1</option>
                                      <option value="P2">P2</option>
                                      <option value="P3">P3</option>
                                    </select>
                                  ) : (
                                    <span className={`priority-text ${o.priority?.toLowerCase() || 'p3'}`}>
                                      {o.priority || 'P3'}
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                {/* Action */}
                                <td className="p-4 text-center">
                                  <div className="flex justify-center gap-3 flex-wrap">
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={saveEdit}
                                          className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                                          title="Save changes"
                                        >
                                          <Save size={16} />
                                        </button>
                                        <button
                                          onClick={cancelEditing}
                                          className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                          title="Cancel"
                                        >
                                          <X size={16} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => startEditing(o)}
                                          className="p-2 hover:bg-blue-50 text-blue-600 rounded transition"
                                          title="Edit"
                                        >
                                          <Edit size={16} />
                                        </button>

                                        {/* Show Schedule button for Suggested items */}
                                        {isSuggested && (
                                          <button
                                            onClick={() => startEditing(o)}
                                            className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                            title="Schedule this suggested outing"
                                          >
                                            <Calendar size={16} />
                                          </button>
                                        )}

                                        {/* Archive button */}
                                        <button
                                          onClick={() => handleArchive(o._id!)}
                                          className="p-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition"
                                          title="Archive"
                                        >
                                          <Archive size={16} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>

                                {/* Remark */}
                                <td className="p-4 text-center text-gray-400 italic font-medium">
                                  {o.remark || '--'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
  

          {/* ─── REJECT MODAL ─── */}
          {isRejectModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center bg-red-50">
                  <h3 className="text-xl font-bold text-red-800">Reject Outing Proposal</h3>
                  <button
                    onClick={() => {
                      setIsRejectModalOpen(false);
                      setRejectOutingId(null);
                      setRejectReason('');
                    }}
                    className="p-2 hover:bg-gray-200 rounded-full transition"
                  >
                    <X size={24} className="text-gray-600" />
                  </button>
                </div>

                <div className="p-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Reason for Rejection *
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter detailed reason why this proposal is being rejected..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  {!rejectReason.trim() && (
                    <p className="text-red-600 text-sm mt-2 font-medium">
                      Reason is required
                    </p>
                  )}
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setIsRejectModalOpen(false);
                      setRejectOutingId(null);
                      setRejectReason('');
                    }}
                    className="px-6 py-3 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={submitReject}
                    disabled={!rejectReason.trim()}
                    className={`px-8 py-3 rounded-xl font-bold transition ${
                      rejectReason.trim()
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-red-300 text-white cursor-not-allowed'
                    }`}
                  >
                    Confirm Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── MANAGEMENT SUGGESTION MODAL ─── */}
          {isSuggestModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center z-10">
                  <h3 className="text-xl font-bold text-gray-800">
                    Suggest New Outing / Event
                  </h3>
                  <button
                    onClick={() => {
                      setIsSuggestModalOpen(false);
                      setSuggestForm({
                        topic: '',
                        description: '',
                        tentativePlace: '',
                        tentativeBudget: '',
                        tentativeDate: '',
                        reason: '',
                        priority: 'P3',
                      });
                    }}
                    className="p-2 hover:bg-gray-200 rounded-full transition"
                  >
                    <X size={24} className="text-gray-600" />
                  </button>
                </div>

                <form onSubmit={submitSuggestion} className="p-8 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Outing / Event Name *
                    </label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Team Picnic, CSR Activity, Annual Offsite"
                      value={suggestForm.topic}
                      onChange={(e) => setSuggestForm({ ...suggestForm, topic: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="What is the purpose? Expected outcomes? Target group?..."
                      value={suggestForm.description}
                      onChange={(e) => setSuggestForm({ ...suggestForm, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tentative Place
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-xl px-4 py-3"
                      placeholder="e.g. Adventure Park, Resort, Office Terrace..."
                      value={suggestForm.tentativePlace}
                      onChange={(e) => setSuggestForm({ ...suggestForm, tentativePlace: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tentative Budget (₹)
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3"
                      placeholder="Approximate cost"
                      value={suggestForm.tentativeBudget}
                      onChange={(e) => setSuggestForm({ ...suggestForm, tentativeBudget: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tentative Date
                    </label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3"
                      value={suggestForm.tentativeDate}
                      onChange={(e) => setSuggestForm({ ...suggestForm, tentativeDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Why are you suggesting this?
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24"
                      placeholder="Team building need, celebration, morale booster, etc..."
                      value={suggestForm.reason}
                      onChange={(e) => setSuggestForm({ ...suggestForm, reason: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={suggestForm.priority}
                      onChange={(e) =>
                        setSuggestForm({ ...suggestForm, priority: e.target.value as 'P1' | 'P2' | 'P3' })
                      }
                    >
                      <option value="P3">P3 - Medium</option>
                      <option value="P2">P2 - High</option>
                      <option value="P1">P1 - Urgent</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSuggestModalOpen(false);
                        setSuggestForm({
                          topic: '',
                          description: '',
                          tentativePlace: '',
                          tentativeBudget: '',
                          tentativeDate: '',
                          reason: '',
                          priority: 'P3',
                        });
                      }}
                      className="px-8 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition"
                    >
                      Submit Suggestion
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── CREATE MODAL (HR) ─── */}
          {currentTab === 'HR' && isCreateModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-800">Propose New Outing / Event</h3>
                  <button onClick={() => setIsCreateModalOpen(false)}>
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={submitProposal} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-2">Outing / Event Name *</label>
                    <input
                      required
                      className="w-full border rounded-xl px-4 py-3"
                      value={formData.topic}
                      onChange={e => setFormData({ ...formData, topic: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-2">Description *</label>
                    <textarea
                      required
                      className="w-full border rounded-xl px-4 py-3 h-32"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Tentative Place</label>
                    <input
                      className="w-full border rounded-xl px-4 py-3"
                      value={formData.tentativePlace}
                      onChange={e => setFormData({ ...formData, tentativePlace: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Tentative Budget (₹)</label>
                    <input
                      type="number"
                      className="w-full border rounded-xl px-4 py-3"
                      value={formData.tentativeBudget}
                      onChange={e => setFormData({ ...formData, tentativeBudget: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Tentative Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-xl px-4 py-3"
                      value={formData.tentativeDate}
                      onChange={e => setFormData({ ...formData, tentativeDate: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-4 pt-6 border-t">
                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-8 py-3 text-gray-600">
                      Cancel
                    </button>
                    <button type="submit" className="bg-[#7a8b2e] text-white px-10 py-3 rounded-xl font-bold">
                      Submit Proposal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

            {/* ─── EMPLOYEE FEEDBACK TAB ─── */}
          {currentTab === 'employee-feedback' && (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto">
    <h3 className="text-2xl font-bold text-gray-800 mb-8 text-center">
      Outing / Event Feedback
    </h3>

    <form onSubmit={handleOutingFeedbackSubmit} className="space-y-6">
      {/* Your Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Your Name *
        </label>
        <select
          required
          value={feedbackForm.employeeName}
          onChange={(e) => {
            const emp = employees.find(em => em.name === e.target.value);
            setFeedbackForm({
              ...feedbackForm,
              employeeName: e.target.value,
              department: emp?.dept || '',
              designation: emp?.desig || '',
            });
          }}
          className="w-full border border-gray-300 rounded-xl px-4 py-3"
        >
          <option value="">Select your name</option>
          {employees.map(emp => (
            <option key={emp.email} value={emp.name}>{emp.name}</option>
          ))}
        </select>
      </div>

      {/* Department & Designation - Auto-filled */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
          <input
            value={feedbackForm.department}
            readOnly
            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
          <input
            value={feedbackForm.designation}
            readOnly
            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-100"
          />
        </div>
      </div>

      {/* Outing / Event – only Completed ones */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Outing / Event *
        </label>
        <select
          required
          value={feedbackForm.outingId}
          onChange={e => setFeedbackForm({ ...feedbackForm, outingId: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-4 py-3"
        >
          <option value="">-- Select Outing --</option>
          {outingList
            .filter(o => o.status === 'Completed')
            .map(o => (
              <option key={o._id} value={o._id}>
                {o.topic} ({o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'})
              </option>
            ))}
        </select>
      </div>

      {/* Attendance */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="attended"
          checked={feedbackForm.attended}
          onChange={e => setFeedbackForm({ ...feedbackForm, attended: e.target.checked })}
          className="h-5 w-5 text-[#7a8b2e]"
        />
        <label htmlFor="attended" className="text-sm font-medium text-gray-700">
          I attended this outing/event *
        </label>
      </div>

      {/* Ratings */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Overall Rating *</label>
        <select
          required
          value={feedbackForm.overallRating}
          onChange={e => setFeedbackForm({ ...feedbackForm, overallRating: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-4 py-3"
        >
          <option value="">--Select--</option>
          {[1, 2, 3, 4, 5].map(v => <option key={v} value={v.toString()}>{v}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Content Quality *</label>
        <select
          required
          value={feedbackForm.contentQuality}
          onChange={e => setFeedbackForm({ ...feedbackForm, contentQuality: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-4 py-3"
        >
          <option value="">--Select--</option>
          {[1, 2, 3, 4, 5].map(v => <option key={v} value={v.toString()}>{v}</option>)}
        </select>
      </div>

      {/* Feedback Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">What was missing?</label>
        <textarea
          value={feedbackForm.whatWasMissing}
          onChange={e => setFeedbackForm({ ...feedbackForm, whatWasMissing: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24"
          placeholder="Topics, activities, arrangements, food, etc. not covered..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">How was it helpful?</label>
        <textarea
          value={feedbackForm.howHelpful}
          onChange={e => setFeedbackForm({ ...feedbackForm, howHelpful: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24"
          placeholder="How this outing helped you personally or professionally..."
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loadingFeedback || !feedbackForm.attended}
          className={`px-10 py-3 rounded-xl font-bold text-white transition ${
            loadingFeedback || !feedbackForm.attended
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#7a8b2e] hover:bg-[#5e6c24]'
          }`}
        >
          {loadingFeedback ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </form>
  </div>
)}
        </main>
      </div>
    </div>
  );
}