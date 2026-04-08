import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Plus, X, CheckCircle, XCircle, Edit, Trash2, Save, Archive, Calendar, MapPin, IndianRupee, AlignLeft, Tag, Eye, Star } from 'lucide-react';
axios.defaults.headers.common['x-user-role'] = localStorage.getItem('role') || 'Admin';


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
  full_name: string;
  department: string;
  designation: string;
  official_email: string;
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
const Outing: React.FC = () => {
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

  // NEW: Global + Details Modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOuting, setSelectedOuting] = useState<Outing | null>(null);

  const filteredOutings = useMemo(() => {
    let list = [...outingList];

    if (outingNameFilter.trim()) {
      const lower = outingNameFilter.trim().toLowerCase();
      list = list.filter(o => o.topic?.toLowerCase().includes(lower));
    }

    if (quarterFilter) {
      list = list.filter(o => o.quarter === quarterFilter);
    }

    if (fyFilter) {
      list = list.filter(o => o.financialYear === fyFilter);
    }

    // Handle archivedFilter differently for outings-view tab
    if (currentTab === 'outings-view') {
      if (archivedFilter === 'scheduled') {
        list = list.filter(o => o.status === 'Scheduled');
      } else if (archivedFilter === 'completed') {
        list = list.filter(o => o.status === 'Completed');
      } else if (archivedFilter === 'archived') {
        list = list.filter(o => o.status === 'Archived');
      }
    } else {
      if (archivedFilter === 'yes') {
        list = list.filter(o => o.status === 'Archived');
      } else if (archivedFilter === 'no') {
        list = list.filter(o => o.status !== 'Archived');
      }
    }

    return list;
  }, [outingList, outingNameFilter, quarterFilter, fyFilter, archivedFilter, currentTab]);

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
      refreshData();
    } catch (err: any) {
      console.error('Archive failed:', err);
      alert('Failed to archive: ' + (err.response?.data?.error || err.message));
    }
  };

  const API_BASE = 'http://3.110.162.1:5000/api';

  // ─── LOAD DATA ────────────────────────────────────────────
  const refreshData = async () => {
    try {
      const [oRes, eRes] = await Promise.all([
        axios.get(`${API_BASE}/outing`),
        axios.get(`${API_BASE}/employees?lightweight=true`)
      ]);
      setOutingList(oRes.data.data || []);
      const rawEmployees = eRes.data.data || [];
      console.log('Raw employees data:', rawEmployees); // Debug log
      
      // Map employees to consistent format
      const mappedEmployees = rawEmployees.map((emp: any) => ({
        full_name: emp.full_name || emp.name || 'Unknown',
        department: emp.department || emp.dept || 'Unknown',
        designation: emp.designation || emp.desig || 'Unknown',
        official_email: emp.official_email || emp.email || 'unknown@example.com'
      }));
      
      setEmployees(mappedEmployees);
      console.log('Mapped employees:', mappedEmployees); // Debug log
    } catch (err) {
      console.error("Data load failed", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Debug: Log current state
  useEffect(() => {
    console.log('Current employees state:', employees);
    console.log('Current outings state:', outingList);
    console.log('Completed outings count:', outingList.filter(o => o.status === 'Completed').length);
  }, [employees, outingList]);

  // Reset form state when component unmounts or tab changes
  useEffect(() => {
    return () => {
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
      setIsCreateModalOpen(false);
      setFormData({
        topic: '',
        description: '',
        tentativePlace: '',
        tentativeBudget: '',
        tentativeDate: '',
        priority: 'P3',
      });
      setIsRejectModalOpen(false);
      setRejectOutingId(null);
      setRejectReason('');
      setIsDetailsModalOpen(false);
      setSelectedOuting(null);
      setEditingId(null);
      setEditData({});
    };
  }, [currentTab]);

  // ─── NEW HELPERS: Feedback & Details ──────────────────────
  const calculateAvgRating = (feedbacks?: Outing['feedbacks']) => {
    if (!feedbacks || feedbacks.length === 0) return 0;
    const sum = feedbacks.reduce((acc, f) => acc + (f.overallRating || 0), 0);
    return Number((sum / feedbacks.length).toFixed(1));
  };

  const openDetails = (outing: Outing) => {
    setSelectedOuting(outing);
    setIsDetailsModalOpen(true);
  };

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

    const priority = formData.priority || 'P3';

    const payload = {
      topic: formData.topic.trim(),
      description: formData.description.trim(),
      tentativePlace: formData.tentativePlace.trim() || undefined,
      tentativeBudget: Number(formData.tentativeBudget) || undefined,
      tentativeDate: formData.tentativeDate ? new Date(formData.tentativeDate).toISOString() : undefined,
      proposedByRole: 'HR',
      proposedByName: 'HR Admin',
      status: 'Proposed',
      priority,
    };

    try {
      const res = await axios.post(`${API_BASE}/outing`, payload);
      if (res.data.success) {
        alert('Outing proposal submitted!');
        setIsCreateModalOpen(false);
        setFormData({
          topic: '',
          description: '',
          tentativePlace: '',
          tentativeBudget: '',
          tentativeDate: '',
          priority: 'P3',
        });
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
        status: 'Scheduled'
      });
      alert('Outing approved and scheduled!');
      refreshData();
    } catch (err: any) {
      alert('Approve failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // Auto status (Completed / Archived) – kept but improved with try/catch per item
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    outingList.forEach(async (o) => {
      if (!o.tentativeDate || o.status === 'Completed' || o.status === 'Archived' || !o._id) return;

      const trainingDate = new Date(o.tentativeDate);
      trainingDate.setHours(0, 0, 0, 0);

      if (today >= trainingDate) {
        try {
          await axios.patch(`${API_BASE}/outing/${o._id}`, { status: 'Completed' });
          console.log(`Auto-marked Completed: ${o.topic}`);
        } catch (err) {
          console.error('Auto-complete failed:', err);
        }
      }

      const threeDaysAfter = new Date(trainingDate);
      threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

      if (o.status === 'Completed' && today >= threeDaysAfter) {
        try {
          await axios.patch(`${API_BASE}/outing/${o._id}`, {
            status: 'Archived',
            archivedAt: new Date().toISOString()
          });
          console.log(`Auto-archived: ${o.topic}`);
        } catch (err) {
          console.error('Auto-archive failed:', err);
        }
      }
    });
  }, [outingList]);

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

    const priority = suggestForm.priority || 'P3';

    const payload = {
      topic: suggestForm.topic.trim(),
      description: suggestForm.description.trim(),
      tentativePlace: suggestForm.tentativePlace.trim() || undefined,
      tentativeBudget: Number(suggestForm.tentativeBudget) || undefined,
      tentativeDate: suggestForm.tentativeDate ? new Date(suggestForm.tentativeDate).toISOString() : undefined,
      reason: suggestForm.reason.trim() || undefined,
      priority,
      proposedByRole: 'Management',
      proposedByName: 'Management User',
      status: 'Suggested',
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
      refreshData();
    } catch (err: any) {
      alert('Failed to submit feedback: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingFeedback(false);
    }
  };

  // ─── ENHANCED CARD RENDERER (used in Global + future views) ───
  const renderOutingCards = (outingsToRender: Outing[], isProposalView: boolean = false, isReadOnly: boolean = false) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {outingsToRender.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-gray-500 italic shadow-sm border border-gray-200 mt-4">
            No outings found matching the filters
          </div>
        ) : (
          outingsToRender.map((o) => {
            const isEditing = editingId === o._id;

            return (
              <div key={o._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col relative group mt-4">
                <div className={`h-1.5 ${o.priority === 'P1' ? 'bg-red-500' : o.priority === 'P2' ? 'bg-orange-500' : 'bg-[#7a8b2e]'}`} />
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    {isEditing ? (
                      <input
                        className="w-full font-bold text-gray-800 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e] mb-1"
                        value={editData.topic ?? o.topic ?? ''}
                        onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))}
                      />
                    ) : (
                      <h4 className="font-bold text-lg text-gray-800 leading-tight pr-4">{o.topic || 'Unnamed Outing'}</h4>
                    )}
                    <span className={`status-pill self-start shrink-0 text-[10px] ${o.status?.toLowerCase().replace(' ', '-') || ''}`}>
                      {o.status || '—'}
                    </span>
                  </div>

                  {isEditing ? (
                    <textarea
                      className="w-full border rounded-lg px-2 py-1 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-[#7a8b2e] text-gray-600 mb-3"
                      value={editData.description ?? o.description ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  ) : (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2" title={o.description}>{o.description || 'No description provided'}</p>
                  )}

                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-600 mb-4 mt-auto bg-gray-50/50 p-3 rounded-xl border border-transparent hover:border-gray-200 transition">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-[#7a8b2e] shrink-0" />
                      {isEditing ? (
                        <input type="date" className="w-full bg-white border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7a8b2e]" value={editData.tentativeDate ? new Date(editData.tentativeDate).toISOString().split('T')[0] : ''} onChange={e => setEditData(prev => ({ ...prev, tentativeDate: e.target.value || undefined }))} />
                      ) : (
                        <span className="truncate">{o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-[#7a8b2e] shrink-0" />
                      {isEditing ? (
                        <input className="w-full bg-white border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7a8b2e]" value={editData.tentativePlace ?? o.tentativePlace ?? ''} onChange={e => setEditData(prev => ({ ...prev, tentativePlace: e.target.value }))} placeholder="Place" />
                      ) : (
                        <span className="truncate" title={o.tentativePlace}>{o.tentativePlace || 'TBD'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <IndianRupee size={14} className="text-[#7a8b2e] shrink-0" />
                      {isEditing ? (
                        <input type="number" className="w-full bg-white border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7a8b2e]" value={editData.tentativeBudget ?? o.tentativeBudget ?? ''} onChange={e => setEditData(prev => ({ ...prev, tentativeBudget: Number(e.target.value) || 0 }))} placeholder="Budget" />
                      ) : (
                        <span className="truncate">{o.tentativeBudget ? `₹${o.tentativeBudget.toLocaleString()}` : 'TBD'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-[#7a8b2e] shrink-0" />
                      {isEditing ? (
                        <select className="w-full bg-white border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7a8b2e]" value={editData.priority ?? o.priority ?? 'P3'} onChange={e => setEditData(prev => ({ ...prev, priority: e.target.value as 'P1' | 'P2' | 'P3' }))}>
                          <option value="P1">P1 - Urgent</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Med</option>
                        </select>
                      ) : (
                        <span className={`font-medium truncate ${getPriorityColor(o.priority)}`}>
                          {o.priority || 'P3'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Feedback summary in card */}
                  {!isEditing && o.feedbacks && o.feedbacks.length > 0 && (
                    <div className="text-xs bg-emerald-50 text-[#7a8b2e] px-3 py-1.5 rounded-lg mb-4 flex items-center gap-1.5">
                      <Star size={14} />
                      {o.feedbacks.length} feedback{ o.feedbacks.length > 1 ? 's' : '' } • Avg {calculateAvgRating(o.feedbacks)} ⭐
                    </div>
                  )}

                  {(o.remark || (currentTab === 'management' && o.reason)) && !isEditing && (
                    <div className="text-xs text-gray-500 italic mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100 flex items-start gap-2">
                      <AlignLeft size={12} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2" title={o.remark || o.reason}>{o.remark || o.reason}</span>
                    </div>
                  )}

                  <div className="pt-4 mt-auto border-t border-gray-100 flex justify-between items-center bg-white z-10">
                    <div className="text-[10px] text-gray-400 font-mono">ID: {o._id?.slice(-5)}</div>
                    <div className="flex gap-2">
                      {isProposalView ? (
                        <>
                          <button onClick={() => approveOuting(o._id!)} className="px-3 py-1 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white rounded-md text-xs font-bold transition">Approve</button>
                          <button onClick={() => openRejectModal(o._id!)} className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white rounded-md text-xs font-bold transition">Reject</button>
                        </>
                      ) : isEditing ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-md transition" title="Save"><Save size={16} /></button>
                          <button onClick={cancelEditing} className="p-1.5 bg-gray-50 text-gray-600 hover:bg-gray-600 hover:text-white rounded-md transition" title="Cancel"><X size={16} /></button>
                        </>
                      ) : isReadOnly ? (
                        <button onClick={() => openDetails(o)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md transition" title="View Details & Feedbacks">
                          <Eye size={16} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => startEditing(o)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md transition" title="Edit"><Edit size={16} /></button>
                          {o.status === 'Suggested' && (
                            <button onClick={() => startEditing(o)} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-md transition" title="Schedule">
                              <Calendar size={16} />
                            </button>
                          )}
                          <button onClick={() => handleArchive(o._id!)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-md transition" title="Archive"><Archive size={16} /></button>
                          <button onClick={() => openDetails(o)} className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white rounded-md transition" title="View Details & Feedbacks">
                            <Eye size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-0">
        <Navbar />

        <main className="p-3 sm:p-4 mt-16 sm:mt-20 md:mt-20 max-w-7xl mx-auto w-full relative">
          {/* Floating + Button - HR tab */}
          {currentTab === 'HR' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="fixed top-20 sm:top-24 right-4 sm:right-8 z-40 bg-[#7a8b2e] text-white rounded-full p-3 sm:p-5 shadow-2xl hover:bg-[#5e6c24] transition-transform hover:scale-105"
              title="Propose New Outing"
            >
              <Plus size={20} className="sm:hidden" />
              <Plus size={32} className="hidden sm:block" />
            </button>
          )}

          {/* Floating + Button - Management suggestion */}
          {currentTab === 'management' && (
            <button
              onClick={() => setIsSuggestModalOpen(true)}
              className="fixed top-20 sm:top-24 right-4 sm:right-8 z-40 bg-indigo-600 text-white rounded-full p-3 sm:p-5 shadow-2xl hover:bg-indigo-700 transition transform hover:scale-110 active:scale-95"
              title="Suggest New Outing / Event"
            >
              <Plus size={20} className="sm:hidden" />
              <Plus size={32} className="hidden sm:block" />
            </button>
          )}

          {/* <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 capitalize">
              Outing / Event Module - {currentTab.replace('-', ' ')}
            </h2>
          </div> */}

          {/* ─── HR TAB (detailed control) ─── */}
          {currentTab === 'HR' && (
            <div className="space-y-8">
              {/* Filters */}
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Outing Name</label>
                    <input placeholder="Search outing topics..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={outingNameFilter} onChange={(e) => setOutingNameFilter(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)}>
                      <option value="">All Quarters</option>
                      <option value="Q1">Q1 (Apr–Jun)</option>
                      <option value="Q2">Q2 (Jul–Sep)</option>
                      <option value="Q3">Q3 (Oct–Dec)</option>
                      <option value="Q4">Q4 (Jan–Mar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={fyFilter} onChange={(e) => setFyFilter(e.target.value)}>
                      <option value="">All FY</option>
                      <option value="FY 2025-2026">FY 2025-2026</option>
                      <option value="FY 2024-2025">FY 2024-2025</option>
                      <option value="FY 2023-2024">FY 2023-2024</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Archived</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)}>
                      <option value="">All</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => { setOutingNameFilter(''); setQuarterFilter(''); setFyFilter(''); setArchivedFilter(''); }} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition">Clear Filters</button>
                  </div>
                </div>
              </div>

              {/* Editable Table (HR Control Panel) */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Outing / Event Control Panel (HR)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                      <tr>
                        <th className="p-2 sm:p-4">Sno.</th>
                        <th className="p-2 sm:p-4">Topic</th>
                        <th className="p-2 sm:p-4 hidden sm:table-cell">Description</th>
                        <th className="p-2 sm:p-4 hidden md:table-cell">Place</th>
                        <th className="p-2 sm:p-4 hidden lg:table-cell">Budget</th>
                        <th className="p-2 sm:p-4 hidden sm:table-cell">Status</th>
                        <th className="p-2 sm:p-4 hidden md:table-cell">Date</th>
                        <th className="p-2 sm:p-4">Priority</th>
                        <th className="p-2 sm:p-4 text-center">Action</th>
                        <th className="p-2 sm:p-4 hidden lg:table-cell text-center">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {filteredOutings.length === 0 ? (
                        <tr><td colSpan={10} className="p-8 text-center text-gray-500 italic">No outings found</td></tr>
                      ) : (
                        filteredOutings.map((o, i) => {
                          const isEditing = editingId === o._id;
                          return (
                            <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                              <td className="p-2 sm:p-4 text-gray-400">{i + 1}</td>
                              <td className="p-2 sm:p-4">
                                {isEditing ?
                                  <input className="w-full border rounded px-2 py-1 text-sm" value={editData.topic ?? o.topic ?? ''} onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))} /> :
                                  <span className="font-bold text-gray-800 text-xs sm:text-sm">{o.topic}</span>
                                }
                              </td>
                              <td className="p-2 sm:p-4 hidden sm:table-cell">
                                {isEditing ?
                                  <textarea className="w-full border rounded px-2 py-1 text-sm h-20" value={editData.description ?? o.description ?? ''} onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))} /> :
                                  <span className="text-gray-500 block max-w-[180px] truncate text-xs sm:text-sm">{o.description}</span>
                                }
                              </td>
                              <td className="p-2 sm:p-4 hidden md:table-cell">
                                {isEditing ?
                                  <input className="w-full border rounded px-2 py-1 text-sm" value={editData.tentativePlace ?? o.tentativePlace ?? ''} onChange={e => setEditData(prev => ({ ...prev, tentativePlace: e.target.value }))} /> :
                                  o.tentativePlace || '—'
                                }
                              </td>
                              <td className="p-2 sm:p-4 hidden lg:table-cell">
                                {isEditing ?
                                  <input
                                    type="number"
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={editData.tentativeBudget ?? o.tentativeBudget ?? ''}
                                    onChange={e => setEditData(prev => ({ ...prev, tentativeBudget: Number(e.target.value) || 0 }))}
                                  /> :
                                  o.tentativeBudget ? `₹${o.tentativeBudget}` : '—'
                                }
                              </td>
                              <td className="p-2 sm:p-4 hidden sm:table-cell">
                                <span className={`status-pill ${o.status?.toLowerCase().replace(' ', '-') || ''}`}>{o.status}</span>
                              </td>
                              <td className="p-2 sm:p-4 hidden md:table-cell text-gray-600 font-mono italic">
                                {isEditing ?
                                  <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={editData.tentativeDate ? new Date(editData.tentativeDate).toISOString().split('T')[0] : ''} onChange={e => setEditData(prev => ({ ...prev, tentativeDate: e.target.value || undefined }))} /> :
                                  o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'
                                }
                              </td>
                              <td className="p-2 sm:p-4">
                                {isEditing ?
                                  <select className="border rounded px-2 py-1 text-sm" value={editData.priority ?? o.priority ?? 'P3'} onChange={e => setEditData(prev => ({ ...prev, priority: e.target.value as 'P1' | 'P2' | 'P3' }))}>
                                    <option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
                                  </select> :
                                  <span className={`priority-text ${o.priority?.toLowerCase() || 'p3'}`}>{o.priority || 'P3'}</span>
                                }
                              </td>
                              <td className="p-2 sm:p-4 text-center">
                                <div className="flex justify-center gap-1 sm:gap-3 flex-wrap">
                                  {isEditing ? (
                                    <>
                                      <button onClick={saveEdit} className="p-1 sm:p-2 bg-green-600 text-white rounded hover:bg-green-700" title="Save"><Save size={12} className="sm:hidden" /><Save size={16} className="hidden sm:block" /></button>
                                      <button onClick={cancelEditing} className="p-1 sm:p-2 bg-gray-600 text-white rounded hover:bg-gray-700" title="Cancel"><X size={12} className="sm:hidden" /><X size={16} className="hidden sm:block" /></button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditing(o)} className="p-1 sm:p-2 hover:bg-blue-50 text-blue-600 rounded" title="Edit"><Edit size={12} className="sm:hidden" /><Edit size={16} className="hidden sm:block" /></button>
                                      {o.status === 'Suggested' && <button onClick={() => startEditing(o)} className="p-1 sm:p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" title="Schedule"><Calendar size={12} className="sm:hidden" /><Calendar size={16} className="hidden sm:block" /></button>}
                                      <button onClick={() => handleArchive(o._id!)} className="p-1 sm:p-2 bg-amber-600 text-white rounded hover:bg-amber-700" title="Archive"><Archive size={12} className="sm:hidden" /><Archive size={16} className="hidden sm:block" /></button>
                                      <button onClick={() => openDetails(o)} className="p-1 sm:p-2 hover:bg-purple-50 text-purple-600 rounded" title="View Details & Feedbacks"><Eye size={12} className="sm:hidden" /><Eye size={16} className="hidden sm:block" /></button>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 sm:p-4 hidden lg:table-cell text-center text-gray-400 italic font-medium">{o.remark || '--'}</td>
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
              {/* Pending Proposals Review */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Management Review – Pending HR Proposals</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                      <tr>
                        <th className="p-2 sm:p-4">Sno.</th>
                        <th className="p-2 sm:p-4">Topic</th>
                        <th className="p-2 sm:p-4 hidden sm:table-cell">Description</th>
                        <th className="p-2 sm:p-4 hidden md:table-cell">Place</th>
                        <th className="p-2 sm:p-4 hidden lg:table-cell">Budget</th>
                        <th className="p-2 sm:p-4 text-center">Action</th>
                        <th className="p-2 sm:p-4 text-center">Priority</th>
                        <th className="p-2 sm:p-4 hidden md:table-cell">Suggestions</th>
                        <th className="p-2 sm:p-4 hidden sm:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {outingList.filter(o => o.status === 'Proposed').length === 0 ? (
                        <tr><td colSpan={9} className="p-8 sm:p-12 text-center text-gray-500 italic">No pending proposals from HR</td></tr>
                      ) : (
                        outingList.filter(o => o.status === 'Proposed').map((o, i) => (
                          <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                            <td className="p-2 sm:p-4 text-gray-400">{i + 1}</td>
                            <td className="p-2 sm:p-4 font-bold text-gray-800 text-xs sm:text-sm">{o.topic}</td>
                            <td className="p-2 sm:p-4 text-gray-600 max-w-[200px] truncate hidden sm:table-cell text-xs sm:text-sm">{o.description}</td>
                            <td className="p-2 sm:p-4 hidden md:table-cell">{o.tentativePlace || '—'}</td>
                            <td className="p-2 sm:p-4 hidden lg:table-cell">{o.tentativeBudget ? `₹${o.tentativeBudget.toLocaleString()}` : '—'}</td>
                            <td className="p-2 sm:p-4 text-center">
                              <div className="flex justify-center gap-1 sm:gap-3 flex-wrap">
                                <button onClick={() => approveOuting(o._id!)} className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-1.5 rounded text-xs font-medium">Approve</button>
                                <button onClick={() => openRejectModal(o._id!)} className="bg-red-600 hover:bg-red-700 text-white px-2 sm:px-4 py-1.5 rounded text-xs font-medium">Reject</button>
                                <button onClick={() => openDetails(o)} className="p-1 sm:p-2 text-purple-600 hover:bg-purple-50 rounded" title="View Details"><Eye size={12} className="sm:hidden" /><Eye size={16} className="hidden sm:block" /></button>
                              </div>
                            </td>
                            <td className="p-2 sm:p-4 text-center"><span className={`font-medium ${getPriorityColor(o.priority)}`}>{o.priority || '—'}</span></td>
                            <td className="p-2 sm:p-4 hidden md:table-cell text-gray-600 text-xs sm:text-sm">{o.reason || '—'}</td>
                            <td className="p-2 sm:p-4 hidden sm:table-cell text-gray-600 font-mono italic text-xs sm:text-sm">{o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ─── OUTINGS VIEW TAB (Scheduled & Completed) ─── */}
          {currentTab === 'outings-view' && (
            <div className="space-y-8">
              {/* Filters */}
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Outing Name</label>
                    <input placeholder="Search outing topics..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={outingNameFilter} onChange={(e) => setOutingNameFilter(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)}>
                      <option value="">All Quarters</option>
                      <option value="Q1">Q1 (Apr–Jun)</option>
                      <option value="Q2">Q2 (Jul–Sep)</option>
                      <option value="Q3">Q3 (Oct–Dec)</option>
                      <option value="Q4">Q4 (Jan–Mar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={fyFilter} onChange={(e) => setFyFilter(e.target.value)}>
                      <option value="">All FY</option>
                      <option value="FY 2025-2026">FY 2025-2026</option>
                      <option value="FY 2024-2025">FY 2024-2025</option>
                      <option value="FY 2023-2024">FY 2023-2024</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)}>
                      <option value="">All</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => { setOutingNameFilter(''); setQuarterFilter(''); setFyFilter(''); setArchivedFilter(''); }} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition">Clear Filters</button>
                  </div>
                </div>
              </div>

              {/* Scheduled & Completed Outings Table */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Scheduled & Completed Outings</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                      <tr>
                        <th className="p-2 sm:p-4">Sno.</th>
                        <th className="p-2 sm:p-4">Topic</th>
                        <th className="p-2 sm:p-4 hidden sm:table-cell">Description</th>
                        <th className="p-2 sm:p-4 hidden md:table-cell">Place</th>
                        <th className="p-2 sm:p-4 hidden lg:table-cell">Budget</th>
                        <th className="p-2 sm:p-4 hidden sm:table-cell">Status</th>
                        <th className="p-2 sm:p-4 hidden md:table-cell">Date</th>
                        <th className="p-2 sm:p-4">Priority</th>
                        <th className="p-2 sm:p-4 text-center">Action</th>
                        <th className="p-2 sm:p-4 hidden lg:table-cell text-center">Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {filteredOutings.filter(o => o.status === 'Scheduled' || o.status === 'Completed' || o.status === 'Archived').length === 0 ? (
                        <tr><td colSpan={10} className="p-8 text-center text-gray-500 italic">No scheduled or completed outings found</td></tr>
                      ) : (
                        filteredOutings.filter(o => o.status === 'Scheduled' || o.status === 'Completed' || o.status === 'Archived').map((o, i) => (
                          <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                            <td className="p-2 sm:p-4 text-gray-400">{i + 1}</td>
                            <td className="p-2 sm:p-4 font-bold text-gray-800 text-xs sm:text-sm">{o.topic}</td>
                            <td className="p-2 sm:p-4 text-gray-600 max-w-[200px] truncate hidden sm:table-cell text-xs sm:text-sm">{o.description}</td>
                            <td className="p-2 sm:p-4 hidden md:table-cell">{o.tentativePlace || '—'}</td>
                            <td className="p-2 sm:p-4 hidden lg:table-cell">{o.tentativeBudget ? `₹${o.tentativeBudget.toLocaleString()}` : '—'}</td>
                            <td className="p-2 sm:p-4 hidden sm:table-cell">
                              <span className={`status-pill ${o.status?.toLowerCase().replace(' ', '-') || ''}`}>{o.status}</span>
                            </td>
                            <td className="p-2 sm:p-4 hidden md:table-cell text-gray-600 font-mono italic text-xs sm:text-sm">{o.tentativeDate ? formatDate(o.tentativeDate) : 'TBD'}</td>
                            <td className="p-2 sm:p-4 text-center"><span className={`font-medium ${getPriorityColor(o.priority)}`}>{o.priority || '—'}</span></td>
                            <td className="p-2 sm:p-4 text-center">
                              <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
                                <button onClick={() => openDetails(o)} className="p-1 sm:p-2 text-purple-600 hover:bg-purple-50 rounded" title="View Details"><Eye size={12} className="sm:hidden" /><Eye size={16} className="hidden sm:block" /></button>
                                {o.status === 'Scheduled' && (
                                  <button onClick={() => handleArchive(o._id!)} className="p-1 sm:p-2 bg-amber-600 text-white rounded hover:bg-amber-700" title="Archive"><Archive size={12} className="sm:hidden" /><Archive size={16} className="hidden sm:block" /></button>
                                )}
                              </div>
                            </td>
                            <td className="p-2 sm:p-4 hidden lg:table-cell text-center">
                              {o.feedbacks && o.feedbacks.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <Star size={14} className="text-yellow-400 fill-current" />
                                  <span className="text-xs font-medium">{o.feedbacks.length}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ─── GLOBAL TAB ─── */}
          {currentTab === 'global' && (
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Outing Name</label>
                    <input placeholder="Search outing topics..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={outingNameFilter} onChange={(e) => setOutingNameFilter(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)}>
                      <option value="">All Quarters</option>
                      <option value="Q1">Q1 (Apr–Jun)</option>
                      <option value="Q2">Q2 (Jul–Sep)</option>
                      <option value="Q3">Q3 (Oct–Dec)</option>
                      <option value="Q4">Q4 (Jan–Mar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={fyFilter} onChange={(e) => setFyFilter(e.target.value)}>
                      <option value="">All FY</option>
                      <option value="FY 2025-2026">FY 2025-2026</option>
                      <option value="FY 2024-2025">FY 2024-2025</option>
                      <option value="FY 2023-2024">FY 2023-2024</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Archived</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]" value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)}>
                      <option value="">All</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => { setOutingNameFilter(''); setQuarterFilter(''); setFyFilter(''); setArchivedFilter(''); }} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition">Clear Filters</button>
                  </div>
                </div>
              </div>

              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
                    Global Outing / Event Overview
                    <span className="bg-[#7a8b2e] text-white text-[10px] px-3 py-0.5 rounded-full font-mono">({filteredOutings.length} total)</span>
                  </h3>
                </div>
                {renderOutingCards(filteredOutings, false, true)}
              </section>
            </div>
          )}

          {/* ─── EMPLOYEE FEEDBACK TAB ─── */}
          {currentTab === 'employee-feedback' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">
              Outing / Event Feedback
            </h3>

            <form onSubmit={handleOutingFeedbackSubmit} className="space-y-2">

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <select
                  required
                  value={feedbackForm.employeeName}
                  onChange={(e) => {
                    console.log('Selected employee:', e.target.value);
                    const emp = employees.find(em => em.full_name === e.target.value);
                    console.log('Found employee:', emp);
                    setFeedbackForm({
                      ...feedbackForm,
                      employeeName: e.target.value,
                      department: emp?.department || '',
                      designation: emp?.designation || ''
                    });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.official_email} value={emp.full_name}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Dept + Desig - Auto-fetched */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={feedbackForm.department}
                  readOnly
                  placeholder="Department (Auto)"
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-gray-100 text-xs"
                />
                <input
                  value={feedbackForm.designation}
                  readOnly
                  placeholder="Designation (Auto)"
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-gray-100 text-xs"
                />
              </div>

              {/* Outing - Only Completed */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Completed Outing *</label>
                <select
                  required
                  value={feedbackForm.outingId}
                  onChange={e => setFeedbackForm({ ...feedbackForm, outingId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">Select Completed Outing</option>
                  {outingList
                    .filter(o => o.status === 'Completed')
                    .sort((a, b) => new Date(b.tentativeDate || 0).getTime() - new Date(a.tentativeDate || 0).getTime())
                    .map(o => (
                      <option key={o._id} value={o._id}>
                        {o.topic} ({o.tentativeDate ? formatDate(o.tentativeDate) : 'No date'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={feedbackForm.attended}
                  onChange={e => setFeedbackForm({ ...feedbackForm, attended: e.target.checked })}
                  className="h-3 w-3"
                />
                <span className="text-xs text-gray-600">Attended *</span>
              </div>

              {/* Ratings */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  required
                  value={feedbackForm.overallRating}
                  onChange={e => setFeedbackForm({ ...feedbackForm, overallRating: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">Overall</option>
                  {[1,2,3,4,5].map(v => <option key={v}>{v}</option>)}
                </select>

                <select
                  required
                  value={feedbackForm.contentQuality}
                  onChange={e => setFeedbackForm({ ...feedbackForm, contentQuality: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">Content</option>
                  {[1,2,3,4,5].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              {/* Textareas */}
              <textarea
                value={feedbackForm.whatWasMissing}
                onChange={e => setFeedbackForm({ ...feedbackForm, whatWasMissing: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs h-12"
                placeholder="What was missing..."
              />

              <textarea
                value={feedbackForm.howHelpful}
                onChange={e => setFeedbackForm({ ...feedbackForm, howHelpful: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs h-12"
                placeholder="How was it helpful..."
              />

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loadingFeedback || !feedbackForm.attended}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition ${
                    loadingFeedback || !feedbackForm.attended
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[#7a8b2e] hover:bg-[#5e6c24]'
                  }`}
                >
                  {loadingFeedback ? '...' : 'Submit'}
                </button>
              </div>

            </form>
          </div>
          )}

          {/* ─── REJECT MODAL ─── */}
          {isRejectModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto">
                <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-red-50">
                  <h3 className="text-lg sm:text-xl font-bold text-red-800">Reject Outing Proposal</h3>
                  <button onClick={() => { setIsRejectModalOpen(false); setRejectOutingId(null); setRejectReason(''); }} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20} className="text-gray-600" /></button>
                </div>
                <div className="p-4 sm:p-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Reason for Rejection *</label>
                  <textarea className="w-full border border-gray-300 rounded-xl px-3 sm:px-4 py-2 sm:py-3 h-24 sm:h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 text-sm" placeholder="Enter detailed reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  {!rejectReason.trim() && <p className="text-red-600 text-sm mt-2 font-medium">Reason is required</p>}
                </div>
                <div className="p-4 sm:p-6 border-t bg-gray-50 flex justify-end gap-3 sm:gap-4">
                  <button onClick={() => { setIsRejectModalOpen(false); setRejectOutingId(null); setRejectReason(''); }} className="px-4 sm:px-6 py-2 sm:py-3 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition text-sm">Cancel</button>
                  <button onClick={submitReject} disabled={!rejectReason.trim()} className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl font-bold transition text-sm ${rejectReason.trim() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-300 text-white cursor-not-allowed'}`}>Confirm Reject</button>
                </div>
              </div>
            </div>
          )}

          {/* ─── MANAGEMENT SUGGESTION MODAL (compact, navbar-aware) ─── */}
          {isSuggestModalOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
              onClick={() => { 
                setIsSuggestModalOpen(false); 
                setSuggestForm({ 
                  topic: '', 
                  description: '', 
                  tentativePlace: '', 
                  tentativeBudget: '', 
                  tentativeDate: '', 
                  reason: '', 
                  priority: 'P3' 
                }); 
              }}
            >
              <div 
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
                style={{ maxHeight: 'calc(100vh - 64px)', marginTop: '64px' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b bg-white rounded-t-2xl sm:rounded-t-2xl shrink-0">
                  <h3 className="text-base font-bold text-gray-800">Suggest New Outing / Event</h3>
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
                        priority: 'P3' 
                      }); 
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition"
                    type="button"
                  >
                    <X size={18} className="text-gray-600" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1">
                  <form onSubmit={submitSuggestion} className="p-4 space-y-3" noValidate>
                    {/* Row 1: Name + Description side by side on md+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Event Name *</label>
                        <input
                          required
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="e.g. Team Picnic..."
                          value={suggestForm.topic}
                          onChange={(e) => setSuggestForm({ ...suggestForm, topic: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={suggestForm.priority}
                          onChange={(e) => setSuggestForm({ ...suggestForm, priority: e.target.value as 'P1' | 'P2' | 'P3' })}
                        >
                          <option value="P3">P3 - Medium</option>
                          <option value="P2">P2 - High</option>
                          <option value="P1">P1 - Urgent</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
                      <textarea
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Purpose and expected outcomes..."
                        value={suggestForm.description}
                        onChange={(e) => setSuggestForm({ ...suggestForm, description: e.target.value })}
                      />
                    </div>

                    {/* Row 2: Place + Budget + Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Place</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="e.g. Adventure Park"
                          value={suggestForm.tentativePlace}
                          onChange={(e) => setSuggestForm({ ...suggestForm, tentativePlace: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Budget (₹)</label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="Approx. cost"
                          value={suggestForm.tentativeBudget}
                          onChange={(e) => setSuggestForm({ ...suggestForm, tentativeBudget: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={suggestForm.tentativeDate}
                          onChange={(e) => setSuggestForm({ ...suggestForm, tentativeDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Why are you suggesting this?</label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-14 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Team building need, morale boost..."
                        value={suggestForm.reason}
                        onChange={(e) => setSuggestForm({ ...suggestForm, reason: e.target.value })}
                      />
                    </div>

                    {/* Footer buttons inside form scroll area */}
                    <div className="flex justify-end gap-3 pt-2 border-t">
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
                            priority: 'P3' 
                          }); 
                        }}
                        className="px-5 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-indigo-700 transition"
                      >
                        Submit
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ─── CREATE MODAL (HR) ─── */}
          {currentTab === 'HR' && isCreateModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
              <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
                   style={{ maxHeight: 'calc(100vh - 64px)', marginTop: '64px' }}>
                <div className="flex justify-between items-center px-4 py-3 border-b shrink-0">
                  <h3 className="text-base font-bold text-gray-800">Propose New Outing / Event</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full transition"><X size={18} className="text-gray-600" /></button>
                </div>
                <div className="overflow-y-auto flex-1">
                  <form onSubmit={submitProposal} className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Event Name *</label>
                      <input required className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
                      <textarea required className="w-full border rounded-lg px-3 py-2 text-sm h-16 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Place</label>
                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.tentativePlace} onChange={e => setFormData({ ...formData, tentativePlace: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Budget (₹)</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.tentativeBudget} onChange={e => setFormData({ ...formData, tentativeBudget: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.tentativeDate} onChange={e => setFormData({ ...formData, tentativeDate: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t">
                      <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
                      <button type="submit" className="bg-[#7a8b2e] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-[#5e6c24] transition">Submit Proposal</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ─── FULL OUTING DETAILS MODAL ─── */}
          {isDetailsModalOpen && selectedOuting && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
                <div className="sticky top-0 bg-white p-3 sm:p-4 border-b flex justify-between items-center z-10">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-800">{selectedOuting.topic}</h3>
                    <p className="text-xs text-gray-500 mt-1">ID: {selectedOuting._id?.slice(-8)} • {selectedOuting.proposedByRole} Proposal</p>
                    <p className="text-xs text-gray-400 mt-1">Proposed by: {selectedOuting.proposedByName || 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className={`status-pill ${selectedOuting.status?.toLowerCase().replace(' ', '-') || ''}`}>{selectedOuting.status}</span>
                    <span className={`font-medium px-2 sm:px-3 py-1 rounded-full text-xs ${getPriorityColor(selectedOuting.priority)}`}>{selectedOuting.priority}</span>
                    <button onClick={() => { setIsDetailsModalOpen(false); setSelectedOuting(null); }} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20} className="text-gray-600" /></button>
                  </div>
                </div>

                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {/* Quick Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-600 font-medium mb-1">Tentative Date</div>
                      <div className="text-sm font-semibold text-blue-800">{formatDate(selectedOuting.tentativeDate)}</div>
                    </div>
                    <div className="bg-green-50 p-2 sm:p-3 rounded-lg border border-green-200">
                      <div className="text-xs text-green-600 font-medium mb-1">Place</div>
                      <div className="text-sm font-medium text-green-800 truncate">{selectedOuting.tentativePlace || 'Not decided'}</div>
                    </div>
                    <div className="bg-purple-50 p-2 sm:p-3 rounded-lg border border-purple-200">
                      <div className="text-xs text-purple-600 font-medium mb-1">Budget</div>
                      <div className="text-sm font-semibold text-purple-800">₹{selectedOuting.tentativeBudget?.toLocaleString() || 'TBD'}</div>
                    </div>
                    <div className="bg-orange-50 p-2 sm:p-3 rounded-lg border border-orange-200">
                      <div className="text-xs text-orange-600 font-medium mb-1">Priority</div>
                      <div className="text-sm font-semibold text-orange-800">{selectedOuting.priority || 'P3'}</div>
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg border">
                      <div className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1"><Calendar size={12} /> Time Period</div>
                      <div className="text-sm font-medium text-gray-800">
                        {selectedOuting.quarter && <span>Q{selectedOuting.quarter} </span>}
                        {selectedOuting.financialYear && <span>• FY{selectedOuting.financialYear}</span>}
                        {!selectedOuting.quarter && !selectedOuting.financialYear && <span className="text-gray-500">Not specified</span>}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border">
                      <div className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1"><Tag size={12} /> Category</div>
                      <div className="text-sm font-medium text-gray-800">
                        {selectedOuting.proposedByRole === 'HR' ? 'HR Initiative' : selectedOuting.proposedByRole === 'Management' ? 'Management Suggestion' : 'Employee Proposal'}
                      </div>
                    </div>
                  </div>

                  {/* Description with enhanced formatting */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><AlignLeft size={16} /> Description</h4>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border">
                      <p className="text-gray-600 leading-relaxed text-sm">{selectedOuting.description}</p>
                      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                        <span>Word count: {selectedOuting.description?.split(' ').length || 0}</span>
                        <span>Characters: {selectedOuting.description?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Remarks/Reason Section */}
                  {(selectedOuting.remark || selectedOuting.reason) && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                      <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                        Additional Notes
                      </h4>
                      <p className="text-gray-700 text-sm mb-2">{selectedOuting.remark || selectedOuting.reason}</p>
                      <div className="text-xs text-amber-600 font-medium">Type: {selectedOuting.remark ? 'Internal Remark' : 'Rejection Reason'}</div>
                    </div>
                  )}

                  {/* Enhanced Feedback Section */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-3 gap-2">
                      <h4 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                        <Star size={16} className="text-yellow-500" />
                        Employee Feedbacks ({selectedOuting.feedbacks?.length || 0})
                      </h4>
                      {selectedOuting.feedbacks && selectedOuting.feedbacks.length > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="text-[#7a8b2e] font-medium text-sm">Avg Rating: <span className="text-xl sm:text-2xl">{calculateAvgRating(selectedOuting.feedbacks)}</span> ⭐</div>
                          <div className="text-xs text-gray-500">
                            {selectedOuting.feedbacks.filter(f => f.attended).length} attended
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedOuting.feedbacks && selectedOuting.feedbacks.length > 0 ? (
                      <div className="space-y-3">
                        {selectedOuting.feedbacks.map((fb, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-semibold text-sm">{fb.employeeName}</div>
                                  {fb.attended && <span className="inline-flex items-center gap-1 text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Attended</span>}
                                </div>
                                <div className="text-xs text-gray-500 mb-2">{fb.department} • {fb.designation}</div>
                                
                                {/* Rating Breakdown */}
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-600">Overall:</span>
                                    <div className="flex gap-0.5">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} size={12} className={i < (fb.overallRating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'} />
                                      ))}
                                    </div>
                                    <span className="text-xs font-medium">{fb.overallRating || 0}/5</span>
                                  </div>
                                  {fb.contentQuality && (
                                    <div className="text-xs text-gray-600">
                                      Content: <span className="font-medium">{fb.contentQuality}/5</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatDate(fb.submittedAt)}
                              </div>
                            </div>
                            
                            {/* Detailed Feedback */}
                            {(fb.whatWasMissing || fb.howHelpful) && (
                              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {fb.whatWasMissing && (
                                  <div className="bg-red-50 p-2 rounded border border-red-100">
                                    <div className="text-xs font-medium text-red-700 mb-1">What was missing?</div>
                                    <div className="text-xs text-red-600">{fb.whatWasMissing}</div>
                                  </div>
                                )}
                                {fb.howHelpful && (
                                  <div className="bg-green-50 p-2 rounded border border-green-100">
                                    <div className="text-xs font-medium text-green-700 mb-1">How helpful?</div>
                                    <div className="text-xs text-green-600">{fb.howHelpful}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-2xl text-gray-500 text-sm">No feedback submitted yet.</div>
                    )}
                  </div>

                  {/* Enhanced Discrepancies Section */}
                  {selectedOuting.discrepancies && selectedOuting.discrepancies.length > 0 && (
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold mb-3 text-red-700 flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        Discrepancies Reported ({selectedOuting.discrepancies.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedOuting.discrepancies.map((d, idx) => (
                          <div key={idx} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-red-800 text-sm">{d.employeeName}</div>
                                <div className="text-red-700 text-sm mt-1">{d.reason}</div>
                              </div>
                              <div className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                {formatDate(d.createdAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 bg-white border-t p-3 sm:p-4 flex justify-end">
                  <button onClick={() => { setIsDetailsModalOpen(false); setSelectedOuting(null); }} className="px-4 sm:px-6 py-2 bg-gray-800 text-white rounded-2xl font-medium hover:bg-black transition text-sm">Close Details</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Outing;