'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Plus, X, CheckCircle, XCircle, Edit, Trash2, Save, Globe, UserCheck } from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────
type Employee = {
  name: string;
  dept: string;
  desig: string;
  email: string;
};

type Feedback = {
  employeeName: string;
  attended: boolean;
  overallRating?: number;
  contentQuality?: number;
  whatWasMissing?: string;
  howHelpful?: string;
  submittedAt?: string;
};

type Training = {
  _id?: string;
  topic: string;
  description: string;
  trainingDate?: string | Date | null;
  status: string;
  reason?: string;
  priority?: 'P1' | 'P2' | 'P3';
  remark?: string;
  proposedByRole?: string;
  proposedByName?: string;
  trainer: {
    name: string;
    isExternal: boolean;
    department?: string;
    designation?: string;
    source?: string;
    organisation?: string;
    mobile?: string;
    email?: string;
  };
  feedbacks?: Feedback[];
  quarter?: string;
  financialYear?: string;
  archivedAt?: Date;
  scorecard?: {
    trainerAvgRating: number;
    totalAttendees: number;
    attendedCount: number;
    noShowCount: number;
    lastCalculated?: Date;
  };
};
const formatDate = (date?: string | Date | null): string => {
  if (!date) return '—';

  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid';

  // Force to date-only (midnight local time, but we only take date part)
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};


// ─── MAIN COMPONENT ───────────────────────────────────────
export default function TrainingPage() {
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'HR';

  // ─── SHARED DATA ──────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingList, setTrainingList] = useState<Training[]>([]);

  // ─── FILTER STATES (HR tab) ───────────────────────────────
  const [trainerFilter, setTrainerFilter] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [archivedFilter, setArchivedFilter] = useState('no');

  // Auto-set current quarter & FY on mount (optional – comment out if not wanted)
  useEffect(() => {
  const now = new Date();
  const month = now.getMonth() + 1;

  let currentQuarter: string;
  if (month >= 4 && month <= 6) currentQuarter = 'Q1';
  else if (month >= 7 && month <= 9) currentQuarter = 'Q2';
  else if (month >= 10 && month <= 12) currentQuarter = 'Q3';
  else currentQuarter = 'Q4'; // Jan–Mar

  const year = now.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const currentFY = `FY ${fyStart}-${fyStart + 1}`;

  // Set defaults
  setQuarterFilter(currentQuarter); // Now Q4 in February
  setFyFilter(currentFY);
}, []);

  // Computed filtered trainings (always returns array)
  const filteredTrainings = useMemo<Training[]>(() => {
    let list = [...(trainingList || [])];

    // Trainer filter
    if (trainerFilter.trim()) {
      const lower = trainerFilter.trim().toLowerCase();
      list = list.filter(t => 
        t.trainer?.name?.toLowerCase().includes(lower)
      );
    }

    // Quarter filter
    if (quarterFilter) {
      list = list.filter(t => t.quarter === quarterFilter);
    }

    // Financial Year filter
    if (fyFilter) {
      list = list.filter(t => t.financialYear === fyFilter);
    }

    // Archived filter
    if (archivedFilter === 'yes') {
      list = list.filter(t => t.status === 'Archived');
    } else if (archivedFilter === 'no') {
      list = list.filter(t => t.status !== 'Archived');
    }

    console.log('After all filters → remaining trainings:', list.length);

    return list;
  }, [trainingList, trainerFilter, quarterFilter, fyFilter, archivedFilter]);

  // ─── HR: CREATE MODAL STATES ─────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [trainerType, setTrainerType] = useState<'internal' | 'external'>('internal');
  const [formData, setFormData] = useState({
    topic: '',
    description: '',
    priority: 'P3' as 'P1' | 'P2' | 'P3',
    internalTrainer: '',
    dept: '',
    desig: '',
    source: '',
    extName: '',
    org: '',
    mobile: '',
    email: ''
  });

  // ─── HR: INLINE EDITING ──────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Training>>({});

  // ─── MANAGEMENT: REJECT MODAL ────────────────────────────
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTrainingId, setRejectTrainingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ─── MANAGEMENT: SUGGESTION MODAL ────────────────────────
  const [isManagementSuggestModalOpen, setIsManagementSuggestModalOpen] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    topic: '',
    description: '',
    trainerName: '',
    reason: '',
    priority: 'P3' as 'P1' | 'P2' | 'P3',
  });

  // ─── EMPLOYEE FEEDBACK ───────────────────────────────────
  const [feedbackForm, setFeedbackForm] = useState({
    employeeName: '',
    trainingId: '',
    overallRating: '',
    attended: false,
    contentQuality: '',
    whatWasMissing: '',
    howHelpful: ''
  });
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [nextTopicSuggestion, setNextTopicSuggestion] = useState('');

  // ─── SCORECARD DATA ──────────────────────────────────────
  const [scorecardData, setScorecardData] = useState<{
    trainerAvgRating: number;
    totalInvited: number;
    attendedCount: number;
    feedbackReceived: number;
    noShowCount: number;
    perEmployeeRatings?: { name: string; rating: number }[];
  } | null>(null);

  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api';

  // ─── DATA LOADING ────────────────────────────────────────
  const refreshData = async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        axios.get(`${API_BASE}/training`),
        axios.get(`${API_BASE}/employees?lightweight=true`)
      ]);

      console.log('Fetched trainings:', tRes.data);
      console.log('Fetched employees:', eRes.data);

      setTrainingList(tRes.data.data || tRes.data || []);
      setEmployees(eRes.data.data || eRes.data || []);
    } catch (err) {
      console.error('Data load failed:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ─── MANAGEMENT ACTIONS ──────────────────────────────────
  const approveTraining = async (id: string) => {
    if (!window.confirm('Approve this training proposal?')) return;

    try {
      await axios.patch(`${API_BASE}/training/${id}`, { status: 'Approved' });
      alert('Training approved!');
      refreshData();
    } catch (err: any) {
      alert('Approve failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const openRejectModal = (id: string) => {
    setRejectTrainingId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTrainingId) return;
    if (!rejectReason.trim()) return alert('Rejection reason is required');

    try {
      await axios.patch(`${API_BASE}/training/${rejectTrainingId}`, {
        status: 'Rejected',
        reason: rejectReason.trim()
      });
      alert('Training rejected!');
      setIsRejectModalOpen(false);
      setRejectTrainingId(null);
      setRejectReason('');
      refreshData();
    } catch (err: any) {
      alert('Reject failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // ─── HR: CREATE PROPOSAL ─────────────────────────────────
  const handleInternalSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const emp = employees.find(emp => emp.name === e.target.value);
    setFormData({
      ...formData,
      internalTrainer: e.target.value,
      dept: emp?.dept || '',
      desig: emp?.desig || ''
    });
  };

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();

    const trainerName = trainerType === 'internal' ? formData.internalTrainer : formData.extName;
    if (!trainerName) return alert('Trainer Name is required');

    const payload = {
      topic: formData.topic.trim(),
      description: formData.description.trim(),
      trainingDate: new Date().toISOString(),
      proposedByRole: 'HR',
      proposedByName: 'HR Admin',
      status: 'Under Review',
      priority: formData.priority,
      trainer: {
        name: trainerName,
        isExternal: trainerType === 'external',
        department: trainerType === 'internal' ? formData.dept : undefined,
        designation: trainerType === 'internal' ? formData.desig : undefined,
        externalOrg: trainerType === 'external' ? formData.org : undefined,
        externalContact: trainerType === 'external' ? (formData.mobile || formData.email) : undefined
      }
    };

    try {
      const res = await axios.post(`${API_BASE}/training`, payload);
      if (res.data.success) {
        alert('Proposal Submitted Successfully!');
        setIsCreateModalOpen(false);
        setFormData({
          topic: '', description: '', priority: 'P3', internalTrainer: '',
          dept: '', desig: '', source: '', extName: '', org: '', mobile: '', email: ''
        });
        refreshData();
      }
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'Server error'));
    }
  };

  // ─── HR: INLINE EDITING ──────────────────────────────────
  const startEditing = (training: Training) => {
    setEditingId(training._id || null);
    setEditData({
      topic: training.topic,
      description: training.description,
      priority: training.priority,
      trainer: { ...training.trainer },
      status: training.status,
      trainingDate: training.trainingDate,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId || !editData) return;

    try {
      await axios.patch(`${API_BASE}/training/${editingId}`, editData);
      alert('Training updated successfully!');
      setEditingId(null);
      setEditData({});
      refreshData();
    } catch (err: any) {
      alert('Update failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteTraining = async (id: string) => {
    if (!window.confirm('Delete this training permanently?')) return;

    try {
      await axios.delete(`${API_BASE}/training/${id}`);
      alert('Training deleted successfully!');
      refreshData();
    } catch (err: any) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // ─── MANAGEMENT SUGGESTION ───────────────────────────────
  const submitManagementSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!suggestForm.topic.trim() || !suggestForm.description.trim() || !suggestForm.trainerName.trim()) {
      return alert('Topic, Description, and Trainer Name are required');
    }

    const payload = {
      topic: suggestForm.topic.trim(),
      description: suggestForm.description.trim(),
      trainer: { name: suggestForm.trainerName.trim(), isExternal: false },
      reason: suggestForm.reason.trim() || undefined,
      priority: suggestForm.priority,
      status: 'Proposed',
      proposedByRole: 'Management',
      proposedByName: 'Management User',
      proposedAt: new Date().toISOString(),
    };

    try {
      const res = await axios.post(`${API_BASE}/training`, payload);
      if (res.data.success) {
        alert('Training topic suggested successfully!');
        setIsManagementSuggestModalOpen(false);
        setSuggestForm({ topic: '', description: '', trainerName: '', reason: '', priority: 'P3' });
        refreshData();
      }
    } catch (err: any) {
      alert('Failed to suggest topic: ' + (err.response?.data?.error || err.message));
    }
  };

  // ─── EMPLOYEE FEEDBACK ───────────────────────────────────
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackForm.employeeName || !feedbackForm.trainingId) {
      return alert('Please select your name and training');
    }
    if (!feedbackForm.attended) {
      return alert('Please confirm that you attended the training');
    }
    if (!feedbackForm.overallRating || !feedbackForm.contentQuality) {
      return alert('Please provide ratings');
    }

    setLoadingFeedback(true);

    try {
      await axios.post(`${API_BASE}/training/${feedbackForm.trainingId}/feedback`, {
        employeeName: feedbackForm.employeeName,
        attended: feedbackForm.attended,
        overallRating: Number(feedbackForm.overallRating),
        contentQuality: Number(feedbackForm.contentQuality),
        whatWasMissing: feedbackForm.whatWasMissing.trim(),
        howHelpful: feedbackForm.howHelpful.trim(),
        submittedAt: new Date().toISOString(),
      });

      alert('Feedback submitted successfully!');
      setShowSuggestionModal(true);

      setFeedbackForm({
        employeeName: '',
        trainingId: '',
        overallRating: '',
        attended: false,
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

  // ─── SCORECARD LOGIC ─────────────────────────────────────
  const loadScorecard = () => {
    if (currentTab !== 'scorecard') return;

    let totalTrainerPoints = 0;
    let totalRatingsCount = 0;
    let totalAttended = 0;
    let totalFeedbacks = 0;
    let totalNoShows = 0;
    let totalPossible = employees.length * trainingList.length;

    trainingList.forEach(training => {
      const feedbacks = training.feedbacks || [];

      const attended = feedbacks.filter(f => f.attended).length;
      totalAttended += attended;

      const noFeedbackButAttended = attended - feedbacks.filter(f => f.overallRating != null).length;
      totalNoShows += noFeedbackButAttended;

      const validRatings = feedbacks
        .filter(f => f.attended && typeof f.overallRating === 'number')
        .map(f => f.overallRating!);

      totalTrainerPoints += validRatings.reduce((sum, r) => sum + r, 0);
      totalRatingsCount += validRatings.length;
      totalFeedbacks += feedbacks.length;
    });

    const avgRating = totalRatingsCount > 0 
      ? Number((totalTrainerPoints / totalRatingsCount).toFixed(1)) 
      : 0;

    setScorecardData({
      trainerAvgRating: avgRating,
      totalInvited: totalPossible,
      attendedCount: totalAttended,
      feedbackReceived: totalFeedbacks,
      noShowCount: totalNoShows,
      perEmployeeRatings: employees.map(emp => {
        let rating = -1;
        for (const t of trainingList) {
          const fb = t.feedbacks?.find(f => f.employeeName === emp.name);
          if (fb?.attended && typeof fb.overallRating === 'number') {
            rating = fb.overallRating;
            break;
          }
        }
        return { name: emp.name, rating };
      })
    });
  };

  useEffect(() => {
    if (currentTab === 'scorecard') {
      loadScorecard();
    }
  }, [currentTab, trainingList, employees]);

  // ─── EXPANDABLE SCORE CARD LOGIC ─────────────────────────
  const [expandedTrainings, setExpandedTrainings] = useState<Record<string, boolean>>({});

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Approved: 'text-green-600',
      Scheduled: 'text-blue-600',
      Completed: 'text-purple-600',
      Rejected: 'text-red-600',
      Cancelled: 'text-gray-600',
      'Under Review': 'text-amber-600',
      Proposed: 'text-amber-600',
    };
    return colors[status] || 'text-gray-600';
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[10px]">
        <Navbar />

        <main className="p-8 max-w-7xl mx-auto w-full relative">
          {/* Floating + Button - only in HR tab */}
          {currentTab === 'HR' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="fixed top-24 right-8 z-40 bg-[#7a8b2e] text-white rounded-full p-5 shadow-2xl hover:bg-[#5e6c24] transition transform hover:scale-110 active:scale-95"
              title="Create New Training Proposal"
            >
              <Plus size={32} />
            </button>
          )}

          {/* Floating + Button - only in Management tab */}
          {currentTab === 'management' && (
            <button
              onClick={() => setIsManagementSuggestModalOpen(true)}
              className="fixed top-24 right-8 z-40 bg-indigo-600 text-white rounded-full p-5 shadow-2xl hover:bg-indigo-700 transition transform hover:scale-110 active:scale-95"
              title="Suggest New Training Topic"
            >
              <Plus size={32} />
            </button>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 capitalize">
              Training Module - {currentTab.replace('-', ' ')}
            </h2>
          </div>

          {/* ─── HR TAB ─── */}
          {currentTab === 'HR' && (
  <div className="space-y-8">
    {/* Debug Info – helps see what's happening */}
    <div className="bg-yellow-100 p-4 rounded border border-yellow-400 text-sm">
      <strong>Debug Info:</strong><br />
      Total trainings loaded: {trainingList.length}<br />
      Filtered trainings: {filteredTrainings.length}<br />
      Current filters → Trainer: "{trainerFilter}", Quarter: "{quarterFilter}", FY: "{fyFilter}", Archived: "{archivedFilter}"
    </div>

    {/* Filters */}
    <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Trainer Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trainer Name</label>
          <select
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
          >
            <option value="">All Trainers</option>
            {employees.map((emp) => (
              <option key={emp.email} value={emp.name}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quarter (Indian FY) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
          <select
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
          >
            <option value="">All Quarters</option>
            <option value="Q1">Q1 (Apr–Jun)</option>
            <option value="Q2">Q2 (Jul–Sep)</option>
            <option value="Q3">Q3 (Oct–Dec)</option>
            <option value="Q4">Q4 (Jan–Mar)</option>
          </select>
        </div>

        {/* Financial Year */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
          <select
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
          >
            <option value="">All FY</option>
            <option value="FY 2025-2026">FY 2025-2026</option>
            <option value="FY 2024-2025">FY 2024-2025</option>
            <option value="FY 2023-2024">FY 2023-2024</option>
          </select>
        </div>

        {/* Archived */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Archived</label>
          <select
            value={archivedFilter}
            onChange={(e) => setArchivedFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
          >
            <option value="">All</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div className="flex items-end">
          <button
            onClick={() => {
              setTrainerFilter('');
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
          Training Inventory Control Panel
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
            <tr>
              <th className="p-4">SNO.</th>
              <th className="p-4">TRAINING TOPIC</th>
              <th className="p-4">DESCRIPTION</th>
              <th className="p-4">TRAINER NAME</th>
              <th className="p-4">STATUS</th>
              <th className="p-4">REASON</th>
              <th className="p-4">DATE</th>
              <th className="p-4">PRIORITY</th>
              <th className="p-4 text-center">REMARK</th>
              <th className="p-4 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-gray-100">
            {filteredTrainings.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500 italic">
                  No trainings found matching the filters
                </td>
              </tr>
            ) : (
              filteredTrainings.map((t, i) => {
                const isEditing = editingId === t._id;

                return (
                  <tr key={t._id || i} className="hover:bg-gray-50/50 transition group">
                    <td className="p-4 text-gray-400">{i + 1}</td>

                    {/* Topic */}
                    <td className="p-4">
                      {isEditing ? (
                        <input
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                          value={editData.topic ?? t.topic ?? ''}
                          onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))}
                        />
                      ) : (
                        <span className="font-bold text-gray-800">{t.topic || '—'}</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="p-4">
                      {isEditing ? (
                        <textarea
                          className="w-full border rounded px-2 py-1 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                          value={editData.description ?? t.description ?? ''}
                          onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                        />
                      ) : (
                        <span className="text-gray-500 block max-w-[180px] truncate">{t.description || '—'}</span>
                      )}
                    </td>

                    {/* Trainer Name */}
                    <td className="p-4">
                              {isEditing ? (
                                <input
                                  className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                  value={editData.trainer?.name ?? t.trainer.name}
                                  onChange={e => setEditData(prev => ({
                                    ...prev,
                                    trainer: {
                                      name: e.target.value,
                                      isExternal: prev.trainer?.isExternal ?? t.trainer.isExternal,
                                      department: prev.trainer?.department ?? t.trainer.department,
                                      designation: prev.trainer?.designation ?? t.trainer.designation,
                                      source: prev.trainer?.source ?? t.trainer.source,
                                      organisation: prev.trainer?.organisation ?? t.trainer.organisation,
                                      mobile: prev.trainer?.mobile ?? t.trainer.mobile,
                                      email: prev.trainer?.email ?? t.trainer.email
                                    }
                                  }))}
                                />
                              ) : (
                                <span className="font-medium text-blue-600">{t.trainer.name}</span>
                              )}
                            </td>

                    {/* Status */}
                    <td className="p-4">
                      {isEditing ? (
                        <select
                          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                          value={editData.status ?? t.status ?? 'Proposed'}
                          onChange={e => setEditData(prev => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="Proposed">Proposed</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span className={`status-pill ${t.status?.toLowerCase().replace(' ', '-') || ''}`}>
                          {t.status || '—'}
                        </span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="p-4 text-center text-gray-700 font-medium">
                      {t.status === 'Rejected' ? (
                        <span className="text-red-600 italic">
                          {t.reason || 'No reason'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Date */}
                    <td className="p-4 text-gray-600 font-mono italic">
                      {isEditing ? (
                        <input
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                          type="date"
                          value={editData.trainingDate ? new Date(editData.trainingDate).toISOString().split('T')[0] : ''}
                          onChange={e => setEditData(prev => ({ ...prev, trainingDate: e.target.value }))}
                        />
                      ) : (
                        formatDate(t.trainingDate)
                      )}
                    </td>

                    {/* Priority */}
                    <td className="p-4">
                      {isEditing ? (
                        <select
                          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                          value={editData.priority ?? t.priority ?? 'P3'}
                          onChange={e => setEditData(prev => ({ ...prev, priority: e.target.value as 'P1' | 'P2' | 'P3' }))}
                        >
                          <option value="P3">P3</option>
                          <option value="P2">P2</option>
                          <option value="P1">P1</option>
                        </select>
                      ) : (
                        <span className={`priority-text ${t.priority?.toLowerCase() || 'p3'}`}>
                          {t.priority || 'P3'}
                        </span>
                      )}
                    </td>

                    {/* Remark */}
                    <td className="p-4 text-center text-gray-400 italic font-medium">
                      {t.remark || '--'}
                    </td>

                    {/* Action */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-3">
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
                              onClick={() => startEditing(t)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded transition"
                              title="Edit row"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => deleteTraining(t._id!)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded transition"
                              title="Delete row"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 bg-gray-50 border-b">
                <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">
                  Management Review – Pending Proposals
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-tighter border-b">
                    <tr>
                      <th className="p-4">Sno.</th>
                      <th className="p-4">Topic</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Trainer</th>
                      <th className="p-4">Priority</th>
                      <th className="p-4">Proposed By</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-gray-100">
                    {trainingList
                      .filter(t => t.status === 'Proposed' || t.status === 'Under Review')
                      .map((t, i) => (
                        <tr key={t._id} className="hover:bg-gray-50/50 transition group">
                          <td className="p-4 text-gray-400">{i + 1}</td>
                          <td className="p-4 font-bold text-gray-800">{t.topic}</td>
                          <td className="p-4 text-gray-500 max-w-[180px] truncate">{t.description}</td>
                          <td className="p-4 font-medium text-blue-600">{t.trainer.name}</td>
                          <td className="p-4">
                            <span className={`priority-text ${t.priority?.toLowerCase() || 'p3'}`}>{t.priority || 'P3'}</span>
                          </td>
                          <td className="p-4 text-gray-600">
                            {t.proposedByName || 'Unknown'} ({t.proposedByRole || '—'})
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => approveTraining(t._id!)}
                                className="flex items-center gap-1 bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition"
                              >
                                <CheckCircle size={14} /> Approve
                              </button>
                              <button
                                onClick={() => openRejectModal(t._id!)}
                                className="flex items-center gap-1 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition"
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {trainingList.filter(t => t.status === 'Proposed' || t.status === 'Under Review').length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-500 italic text-base">
                          No pending proposals to review at the moment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scorecard */}
          {currentTab === 'scorecard' && (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-gray-800 text-center mb-8">
      Training Participation & Feedback Scorecard
    </h3>

    {trainingList.length === 0 ? (
      <div className="bg-white rounded-2xl p-12 text-center text-gray-500 italic shadow-sm border border-gray-200">
        No trainings have been created yet.
      </div>
    ) : (
      trainingList.map((training) => {
        // Compute scores for every employee for this training
        const employeeScores = employees.map((emp) => {
          const feedback = training.feedbacks?.find(
            (f) => f.employeeName === emp.name
          );

          const attended = feedback?.attended ?? false;
          const hasFeedback = !!feedback && feedback.submittedAt != null;

          const score = attended && hasFeedback ? 0 : -1;

          return {
            name: emp.name,
            attended,
            hasFeedback,
            score,
          };
        });

        // Summary statistics
        const attendedCount = employeeScores.filter((e) => e.attended).length;
        const feedbackCount = employeeScores.filter((e) => e.hasFeedback).length;
        const perfectCount = employeeScores.filter((e) => e.score === 0).length;
        const missingCount = employeeScores.filter((e) => e.score === -1).length;

        // Expand/collapse state per training
        const trainingId = training._id || `training-${training.topic}`;
        const isExpanded = expandedTrainings[trainingId] || false;

        const toggleExpanded = () => {
          setExpandedTrainings((prev) => ({
            ...prev,
            [trainingId]: !prev[trainingId],
          }));
        };

        return (
          <div
            key={trainingId}
            className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden transition-all duration-200"
          >
            {/* Clickable header with summary */}
            <div
              className="p-5 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              onClick={toggleExpanded}
            >
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-800 mb-1">
                  {training.topic}
                </h4>
                <div className="text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Date:{' '}
                    {training.trainingDate
                      ? new Date(training.trainingDate).toLocaleDateString()
                      : 'Not scheduled'}
                  </span>
                  <span className={`font-medium ${getStatusColor(training.status)}`}>
                    {training.status}
                  </span>
                </div>
              </div>

              {/* Summary stats */}
              <div className="flex items-center gap-5 sm:gap-6 text-sm font-medium whitespace-nowrap">
                <div className="text-center">
                  <div className="text-green-600 font-bold">{attendedCount}</div>
                  <div className="text-xs text-gray-500">Attended</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-600 font-bold">{feedbackCount}</div>
                  <div className="text-xs text-gray-500">Feedback</div>
                </div>
                <div className="text-center">
                  <div className="text-emerald-600 font-bold">{perfectCount}</div>
                  <div className="text-xs text-gray-500">Score 0</div>
                </div>
                <div className="text-center">
                  <div className="text-red-600 font-bold">{missingCount}</div>
                  <div className="text-xs text-gray-500">Score -1</div>
                </div>

                <span className="text-gray-500 text-xl ml-2">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Expandable content */}
            {isExpanded && (
              <div className="border-t">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                      <tr>
                        <th className="p-4 text-left pl-6">Employee Name</th>
                        <th className="p-4 text-center">Attended</th>
                        <th className="p-4 text-center">Feedback Submitted</th>
                        <th className="p-4 text-center">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employeeScores.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-gray-50 transition-colors ${
                            item.score === 0 ? 'bg-green-50/40' : ''
                          }`}
                        >
                          <td className="p-4 pl-6 font-medium">{item.name}</td>
                          <td className="p-4 text-center">
                            {item.attended ? (
                              <span className="text-green-600 font-bold">Yes</span>
                            ) : (
                              <span className="text-red-600">No</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {item.hasFeedback ? (
                              <span className="text-green-600 font-bold">Yes</span>
                            ) : (
                              <span className="text-red-600">No</span>
                            )}
                          </td>
                          <td className="p-4 text-center text-lg font-bold">
                            {item.score === 0 ? (
                              <span className="text-emerald-700">0</span>
                            ) : (
                              <span className="text-red-700">-1</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {employeeScores.length === 0 && (
                  <div className="p-10 text-center text-gray-500 italic">
                    No employees found in the system
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
)}
          {/* ─── EMPLOYEE FEEDBACK TAB ─── */}
          {currentTab === 'employee-feedback' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-8 text-center">
                Training Feedback (Attendance)
              </h3>

              <form onSubmit={handleFeedbackSubmit} className="space-y-6">
                {/* Your Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <select
                    required
                    value={feedbackForm.employeeName}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, employeeName: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                  >
                    <option value="">Select your name</option>
                    {employees.map((emp) => (
                      <option key={emp.email} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Training */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Training *
                  </label>
                  <select
                    required
                    value={feedbackForm.trainingId}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, trainingId: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                  >
                    <option value="">-- Select Training --</option>
                    {trainingList
                      .filter((t) => ['Approved', 'Scheduled', 'Completed'].includes(t.status))
                      .map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.topic} 
                          {t.trainingDate ? ` (${new Date(t.trainingDate).toLocaleDateString()})` : ' (Date TBD)'}
                          {' - '}
                          <span className={`font-medium ${
                            t.status === 'Approved' ? 'text-green-600' :
                            t.status === 'Scheduled' ? 'text-blue-600' :
                            'text-purple-600'
                          }`}>
                            {t.status}
                          </span>
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
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, attended: e.target.checked })}
                    className="h-5 w-5 text-[#7a8b2e] border-gray-300 rounded focus:ring-[#7a8b2e]"
                  />
                  <label htmlFor="attended" className="text-sm font-medium text-gray-700">
                    I attended this training session *
                  </label>
                </div>

                {/* Ratings */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Overall Rating *
                  </label>
                  <select
                    required
                    value={feedbackForm.overallRating}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, overallRating: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                  >
                    <option value="">--Select--</option>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <option key={val} value={val.toString()}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Content Quality *
                  </label>
                  <select
                    required
                    value={feedbackForm.contentQuality}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, contentQuality: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                  >
                    <option value="">--Select--</option>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <option key={val} value={val.toString()}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Feedback Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What was missing?
                  </label>
                  <textarea
                    value={feedbackForm.whatWasMissing}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, whatWasMissing: e.target.value })}
                    placeholder="Any topics, examples, or areas that were not covered..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How was it helpful?
                  </label>
                  <textarea
                    value={feedbackForm.howHelpful}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, howHelpful: e.target.value })}
                    placeholder="How did this training help you in your work/role..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
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
                        : 'bg-[#7a8b2e] hover:bg-[#5e6c24] shadow-lg'
                    }`}
                  >
                    {loadingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── SUGGESTION MODAL (only after feedback) ─── */}
          {showSuggestionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center bg-green-50">
                  <h3 className="text-xl font-bold text-green-800">Thank You!</h3>
                  <button
                    onClick={() => {
                      setShowSuggestionModal(false);
                      setNextTopicSuggestion('');
                    }}
                    className="p-2 hover:bg-gray-200 rounded-full transition"
                  >
                    <X size={24} className="text-gray-600" />
                  </button>
                </div>

                <div className="p-6">
                  <p className="text-gray-700 mb-4">
                    Your feedback has been submitted successfully.<br />
                    Would you like to suggest a topic for the next training session?
                  </p>

                  <textarea
                    value={nextTopicSuggestion}
                    onChange={(e) => setNextTopicSuggestion(e.target.value)}
                    placeholder="E.g. Leadership Skills, Advanced Excel, Team Building Activities..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                  />
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setShowSuggestionModal(false);
                      setNextTopicSuggestion('');
                    }}
                    className="px-6 py-3 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition"
                  >
                    Skip
                  </button>

                  <button
                    onClick={() => {
                      if (nextTopicSuggestion.trim()) {
                        alert('Thank you! Your suggestion has been noted.');
                        // Optional: await axios.post(`${API_BASE}/suggestions`, { topic: nextTopicSuggestion.trim() });
                      } else {
                        alert('Suggestion skipped.');
                      }
                      setShowSuggestionModal(false);
                      setNextTopicSuggestion('');
                    }}
                    disabled={!nextTopicSuggestion.trim()}
                    className={`px-8 py-3 rounded-xl font-bold transition ${
                      nextTopicSuggestion.trim()
                        ? 'bg-[#7a8b2e] text-white hover:bg-[#5e6c24]'
                        : 'bg-gray-300 text-white cursor-not-allowed'
                    }`}
                  >
                    Submit Suggestion
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── REJECTION MODAL ─── */}
          {isRejectModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center bg-red-50">
                  <h3 className="text-xl font-bold text-red-800">Reject Training Proposal</h3>
                  <button
                    onClick={() => {
                      setIsRejectModalOpen(false);
                      setRejectTrainingId(null);
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
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter detailed reason why this proposal is being rejected..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
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
                      setRejectTrainingId(null);
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

          {/* ─── CREATE MODAL (HR) ─── */}
          {currentTab === 'HR' && isCreateModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white shadow-2xl w-half max-w-3xl max-h-[75vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center z-10">
                  <h3 className="text-xl font-bold text-gray-800">Create New Training Proposal</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={submitProposal} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Training Topic *</label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                      placeholder="e.g. Behavioral Skills Workshop"
                      value={formData.topic}
                      onChange={e => setFormData({ ...formData, topic: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Topic Description *</label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                      placeholder="Mention key learning objectives..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                    <select
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    >
                      <option value="P3">P3 (Medium)</option>
                      <option value="P2">P2 (High)</option>
                      <option value="P1">P1 (Urgent)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <div className="flex gap-6 mb-6">
                      <button
                        type="button"
                        onClick={() => setTrainerType('internal')}
                        className={`flex-1 py-3 rounded-xl font-bold transition text-base ${
                          trainerType === 'internal'
                            ? 'bg-[#7a8b2e] text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-3">
                          <UserCheck size={20} /> Internal Trainer
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrainerType('external')}
                        className={`flex-1 py-3 rounded-xl font-bold transition text-base ${
                          trainerType === 'external'
                            ? 'bg-[#7a8b2e] text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-3">
                          <Globe size={20} /> External Consultant
                        </div>
                      </button>
                    </div>

                    {trainerType === 'internal' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Trainer Name</label>
                          <select
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                            value={formData.internalTrainer}
                            onChange={handleInternalSelect}
                          >
                            <option value="">Select Employee</option>
                            {employees.map(e => (
                              <option key={e.email} value={e.name}>{e.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                          <input
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-100 cursor-not-allowed"
                            value={formData.dept}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                          <input
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-100 cursor-not-allowed"
                            value={formData.desig}
                            readOnly
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <input
                          className="w-full border border-gray-300 rounded-xl px-4 py-3"
                          placeholder="Source (e.g. LinkedIn)"
                          value={formData.source}
                          onChange={e => setFormData({ ...formData, source: e.target.value })}
                        />
                        <input
                          className="w-full border border-gray-300 rounded-xl px-4 py-3"
                          placeholder="Trainer Name *"
                          value={formData.extName}
                          onChange={e => setFormData({ ...formData, extName: e.target.value })}
                        />
                        <input
                          className="w-full border border-gray-300 rounded-xl px-4 py-3"
                          placeholder="Organisation"
                          value={formData.org}
                          onChange={e => setFormData({ ...formData, org: e.target.value })}
                        />
                        <div className="flex gap-3">
                          <input
                            className="w-full border border-gray-300 rounded-xl px-4 py-3"
                            placeholder="Mobile"
                            value={formData.mobile}
                            onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                          />
                          <input
                            className="w-full border border-gray-300 rounded-xl px-4 py-3"
                            placeholder="Email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-4 pt-6 border-t">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="px-8 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-[#7a8b2e] text-white px-10 py-3 rounded-xl font-bold shadow-lg hover:bg-[#5e6c24] transition"
                    >
                      Submit for Management Approval
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MANAGEMENT SUGGESTION MODAL ─── */}
          {currentTab === 'management' && isManagementSuggestModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center z-10">
                  <h3 className="text-xl font-bold text-gray-800">
                    Suggest New Training Topic
                  </h3>
                  <button
                    onClick={() => {
                      setIsManagementSuggestModalOpen(false);
                      setSuggestForm({ topic: '', description: '', trainerName: '', reason: '', priority: 'P3' });
                    }}
                    className="p-2 hover:bg-gray-200 rounded-full"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={submitManagementSuggestion} className="p-8 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Training Topic *
                    </label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Advanced Data Visualization with Power BI"
                      value={suggestForm.topic}
                      onChange={(e) => setSuggestForm({ ...suggestForm, topic: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Topic Description *
                    </label>
                    <textarea
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 h-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="What will participants learn? Target audience? Expected outcomes..."
                      value={suggestForm.description}
                      onChange={(e) => setSuggestForm({ ...suggestForm, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Suggested Trainer Name *
                    </label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. John Doe or Priya Sharma"
                      value={suggestForm.trainerName}
                      onChange={(e) => setSuggestForm({ ...suggestForm, trainerName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reason for Suggesting this Training
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Business need, skill gap, upcoming project, etc..."
                      value={suggestForm.reason}
                      onChange={(e) => setSuggestForm({ ...suggestForm, reason: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={suggestForm.priority}
                      onChange={(e) => setSuggestForm({ ...suggestForm, priority: e.target.value as any })}
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
                        setIsManagementSuggestModalOpen(false);
                        setSuggestForm({ topic: '', description: '', trainerName: '', reason: '', priority: 'P3' });
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
        </main>
      </div>

      {/* Styles */}
      <style>{`
        .status-pill {
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .status-pill.proposed { background: #e0f2fe; color: #0369a1; }
        .status-pill.under-review { background: #fef3c7; color: #92400e; }
        .status-pill.approved { background: #dcfce7; color: #166534; }
        .status-pill.rejected { background: #fee2e2; color: #b91c1c; }

        .priority-text { font-weight: 900; }
        .priority-text.p1 { color: #ef4444; }
        .priority-text.p2 { color: #f97316; }
        .priority-text.p3 { color: #7a8b2e; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
  }
      `}</style>
    </div>
  );
}

