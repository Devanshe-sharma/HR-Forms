'use client';

import { useState, useEffect } from 'react';
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

type Training = {
  _id?: string;
  topic: string;
  description: string;
  trainingDate?: string | Date;
  status: string;
  priority: 'P1' | 'P2' | 'P3';
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
};

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function TrainingPage() {
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'hr';

  // Shared Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingList, setTrainingList] = useState<Training[]>([]);

  // HR: Create Modal
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

  // HR: Inline Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Training>>({});

  // Management: Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTrainingId, setRejectTrainingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api';

  // ─── LOAD DATA ────────────────────────────────────────────
  const refreshData = async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        axios.get(`${API_BASE}/training`),
        axios.get(`${API_BASE}/employees?lightweight=true`)
      ]);
      setTrainingList(tRes.data.data || []);
      setEmployees(eRes.data.data || []);
    } catch (err) {
      console.error("Data load failed", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ─── MANAGEMENT ACTIONS ───────────────────────────────────
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
        remark: rejectReason.trim()
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

  // ─── HR: INLINE EDITING ───────────────────────────────────
  const startEditing = (training: Training) => {
    setEditingId(training._id || null);
    setEditData({
      topic: training.topic,
      description: training.description,
      priority: training.priority,
      trainer: { ...training.trainer }
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

// Add this function (you can place it near submitProposal)
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

    // ── Success flow ──
    alert('Feedback submitted successfully!');
    setShowSuggestionModal(true);           // ← open suggestion modal

    // Reset feedback form
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



const submitTopicSuggestion = async () => {
  if (nextTopicSuggestion.trim()) {
    try {
      // Optional: save suggestion to backend
      await axios.post(`${API_BASE}/suggestions`, { suggestion: nextTopicSuggestion.trim() });
      // OR attach to last training if needed
      alert('Thank you! Your topic suggestion has been recorded.');
    } catch (err) {
      console.error('Suggestion save failed', err);
    }
  }

  // Close modal & reset
  setIsSuggestionModalOpen(false);
  setNextTopicSuggestion('');
};


// Optional: submit suggestion (you can send it to a separate endpoint or same training)
const submitSuggestion = async () => {
  if (!nextTopicSuggestion.trim()) return;

  try {
    // You can either:
    // 1. Send to a new endpoint: /api/suggestions
    // await axios.post(`${API_BASE}/suggestions`, { suggestion: nextTopicSuggestion });

    // OR 2. Add to last submitted training's remark/suggestedTopics
    if (feedbackForm.trainingId) {
      await axios.patch(`${API_BASE}/training/${feedbackForm.trainingId}`, {
        remark: `Suggested topic: ${nextTopicSuggestion.trim()}`
      });
    }

    alert('Thank you! Your suggestion has been recorded.');
  } catch (err) {
    alert('Suggestion submission failed');
  } finally {
    setShowSuggestionModal(false);
    setNextTopicSuggestion('');
  }
};

  function setIsSuggestionModalOpen(arg0: boolean): void {
    throw new Error('Function not implemented.');
  }

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[10px]">
        <Navbar />

        <main className="p-8 max-w-7xl mx-auto w-full relative">
          {/* Floating + Button - only in HR tab */}
          {currentTab === 'hr' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="fixed top-24 right-8 z-40 bg-[#7a8b2e] text-white rounded-full p-5 shadow-2xl hover:bg-[#5e6c24] transition transform hover:scale-110 active:scale-95"
              title="Create New Training Proposal"
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
          {currentTab === 'hr' && (
            <div className="space-y-8">
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
                        <th className="p-4">Sno.</th>
                        <th className="p-4">Training Topic</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Trainer Name</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Priority</th>
                        <th className="p-4 text-center">Remark</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {trainingList.map((t, i) => {
                        const isEditing = editingId === t._id;

                        return (
                          <tr key={t._id} className="hover:bg-gray-50/50 transition group">
                            <td className="p-4 text-gray-400">{i + 1}</td>

                            {/* Topic */}
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                  value={editData.topic ?? t.topic}
                                  onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))}
                                />
                              ) : (
                                <span className="font-bold text-gray-800">{t.topic}</span>
                              )}
                            </td>

                            {/* Description */}
                            <td className="p-4">
                              {isEditing ? (
                                <textarea
                                  className="w-full border rounded px-2 py-1 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                  value={editData.description ?? t.description}
                                  onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                />
                              ) : (
                                <span className="text-gray-500 block max-w-[180px] truncate">{t.description}</span>
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
                              <span className={`status-pill ${t.status.toLowerCase().replace(' ', '-')}`}>
                                {t.status}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="p-4 text-gray-600 font-mono italic">
                              {t.trainingDate ? new Date(t.trainingDate).toLocaleDateString() : 'TBD'}
                            </td>

                            {/* Priority */}
                            <td className="p-4">
                              {isEditing ? (
                                <select
                                  className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8b2e]"
                                  value={editData.priority ?? t.priority}
                                  onChange={e => setEditData(prev => ({ ...prev, priority: e.target.value as any }))}
                                >
                                  <option value="P3">P3</option>
                                  <option value="P2">P2</option>
                                  <option value="P1">P1</option>
                                </select>
                              ) : (
                                <span className={`priority-text ${t.priority.toLowerCase()}`}>{t.priority}</span>
                              )}
                            </td>

                            {/* Remark */}
                            <td className="p-4 text-center text-gray-400 italic font-medium">
                              {t.remark || '--'}
                            </td>

                            {/* Actions */}
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
                      })}
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
                            <span className={`priority-text ${t.priority.toLowerCase()}`}>
                              {t.priority}
                            </span>
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

          {/* Scorecard & Employee Feedback */}
          {currentTab === 'scorecard' && (
            <div className="text-center py-20 text-gray-500 italic text-lg">
              Scorecard View Coming Soon...
            </div>
          )}

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

      {/* Attendance Checkbox */}
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

{/* ─── SUGGESTION POPUP MODAL ─── */}
{/* Suggestion Modal – appears after successful feedback */}
{showSuggestionModal && (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
      {/* Header */}
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

      {/* Body */}
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

      {/* Footer */}
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
              // You can add real save logic here later
              // await axios.post(`${API_BASE}/suggestions`, { topic: nextTopicSuggestion.trim() });
              alert('Thank you! Your suggestion has been recorded.');
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




          {/* ─── REJECTION REASON MODAL ─── */}
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
          {currentTab === 'hr' && isCreateModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
      `}</style>
    </div>
  );
}

function setIsSuggestionModalOpen(arg0: boolean): void {
  throw new Error('Function not implemented.');
}
function setIsSuggestionPopupOpen(arg0: boolean) {
  throw new Error('Function not implemented.');
}
