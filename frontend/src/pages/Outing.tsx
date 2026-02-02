'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Plus, X, CheckCircle, XCircle, Edit, Trash2, Save } from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────
type Employee = {
  name: string;
  dept: string;
  desig: string;
  email: string;
};

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
  const currentTab = searchParams.get('tab') || 'hr';

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
    priority: 'P3' as 'P1' | 'P2' | 'P3',
  });

  // Employee Feedback
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
  const approveOuting = async (id: string) => {
    if (!window.confirm('Approve this outing proposal?')) return;

    try {
      await axios.patch(`${API_BASE}/outing/${id}`, { status: 'Approved' });
      alert('Outing approved!');
      refreshData();
    } catch (err: any) {
      alert('Approve failed: ' + (err.response?.data?.error || err.message));
    }
  };

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

  // ─── HR: CREATE PROPOSAL ─────────────────────────────────
  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      topic: formData.topic.trim(),
      description: formData.description.trim(),
      tentativePlace: formData.tentativePlace.trim(),
      tentativeBudget: Number(formData.tentativeBudget) || 0,
      tentativeDate: formData.tentativeDate ? new Date(formData.tentativeDate).toISOString() : undefined,
      proposedByRole: 'HR',
      proposedByName: 'HR Admin',
      status: 'Under Review',
      priority: formData.priority,
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
      await axios.patch(`${API_BASE}/outing/${editingId}`, editData);
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

    const payload = {
      topic: suggestForm.topic.trim(),
      description: suggestForm.description.trim(),
      tentativePlace: suggestForm.tentativePlace.trim(),
      tentativeBudget: Number(suggestForm.tentativeBudget) || 0,
      tentativeDate: suggestForm.tentativeDate ? new Date(suggestForm.tentativeDate).toISOString() : undefined,
      reason: suggestForm.reason.trim(),
      priority: suggestForm.priority,
      proposedByRole: 'Management',
      proposedByName: 'Management User',
      status: 'Proposed',
    };

    try {
      const res = await axios.post(`${API_BASE}/outing/suggest`, payload);
      if (res.data.success) {
        alert('Outing suggestion submitted!');
        setIsSuggestModalOpen(false);
        setSuggestForm({ topic: '', description: '', tentativePlace: '', tentativeBudget: '', tentativeDate: '', reason: '', priority: 'P3' });
        refreshData();
      }
    } catch (err: any) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[10px]">
        <Navbar />

        <main className="p-8 max-w-7xl mx-auto w-full relative">
          {/* Floating + Button - HR tab */}
          {currentTab === 'hr' && (
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
              className="fixed top-24 right-8 z-40 bg-indigo-600 text-white rounded-full p-5 shadow-2xl hover:bg-indigo-700"
              title="Suggest New Outing"
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
          {currentTab === 'hr' && (
            <div className="space-y-8">
              {/* Filters */}
              <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    placeholder="Filter by Outing Name"
                    className="border rounded px-4 py-2"
                    onChange={(e) => {/* add filter logic */}}
                  />
                  <select className="border rounded px-4 py-2">
                    <option>Filter by Quarter</option>
                    <option>Q1</option>
                    <option>Q2</option>
                    <option>Q3</option>
                    <option>Q4</option>
                  </select>
                  <select className="border rounded px-4 py-2">
                    <option>Financial Year</option>
                    {/* populate dynamically */}
                  </select>
                  <select className="border rounded px-4 py-2">
                    <option>Archived</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
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
                        <th className="p-4 text-center">Action</th>
                        <th className="p-4 text-center">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {outingList.map((o, i) => {
                        const isEditing = editingId === o._id;

                        return (
                          <tr key={o._id} className="hover:bg-gray-50/50 transition group">
                            <td className="p-4 text-gray-400">{i + 1}</td>

                            {/* Topic */}
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  className="w-full border rounded px-2 py-1 text-sm"
                                  value={editData.topic ?? o.topic}
                                  onChange={e => setEditData(prev => ({ ...prev, topic: e.target.value }))}
                                />
                              ) : (
                                <span className="font-bold text-gray-800">{o.topic}</span>
                              )}
                            </td>

                            {/* Description */}
                            <td className="p-4">
                              {isEditing ? (
                                <textarea
                                  className="w-full border rounded px-2 py-1 text-sm h-20"
                                  value={editData.description ?? o.description}
                                  onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                />
                              ) : (
                                <span className="text-gray-500 block max-w-[180px] truncate">{o.description}</span>
                              )}
                            </td>

                            {/* Tentative Place */}
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  className="w-full border rounded px-2 py-1 text-sm"
                                  value={editData.tentativePlace ?? o.tentativePlace}
                                  onChange={e => setEditData(prev => ({ ...prev, tentativePlace: e.target.value }))}
                                />
                              ) : (
                                o.tentativePlace || '—'
                              )}
                            </td>

                            {/* Tentative Budget */}
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="w-full border rounded px-2 py-1 text-sm"
                                  value={editData.tentativeBudget ?? o.tentativeBudget}
                                  onChange={e => setEditData(prev => ({ ...prev, tentativeBudget: Number(e.target.value) }))}
                                />
                              ) : (
                                o.tentativeBudget ? `₹${o.tentativeBudget}` : '—'
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-4">
                              <span className={`status-pill ${o.status.toLowerCase().replace(' ', '-')}`}>
                                {o.status}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="p-4 text-gray-600 font-mono italic">
                              {o.tentativeDate ? new Date(o.tentativeDate).toLocaleDateString() : 'TBD'}
                            </td>

                            {/* Actions */}
                            <td className="p-4 text-center">
                              <div className="flex justify-center gap-3">
                                {isEditing ? (
                                  <>
                                    <button onClick={saveEdit} className="p-2 bg-green-600 text-white rounded">
                                      <Save size={16} />
                                    </button>
                                    <button onClick={cancelEditing} className="p-2 bg-gray-600 text-white rounded">
                                      <X size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEditing(o)} className="p-2 hover:bg-blue-50 text-blue-600 rounded">
                                      <Edit size={16} />
                                    </button>
                                    <button onClick={() => {/* delete logic */}} className="p-2 hover:bg-red-50 text-red-600 rounded">
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Remark */}
                            <td className="p-4 text-center text-gray-400 italic">
                              {o.remark || '—'}
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
            <div className="space-y-8">
              {/* Pending Proposals */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">
                    Pending Outing Proposals
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
                        <th className="p-4 text-center">Action</th>
                        <th className="p-4 text-center">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-gray-100">
                      {outingList
                        .filter(o => o.status === 'Proposed' || o.status === 'Under Review')
                        .map((o, i) => (
                          <tr key={o._id} className="hover:bg-gray-50/50">
                            <td className="p-4 text-gray-400">{i + 1}</td>
                            <td className="p-4 font-bold">{o.topic}</td>
                            <td className="p-4 text-gray-500 max-w-[180px] truncate">{o.description}</td>
                            <td className="p-4">{o.tentativePlace || '—'}</td>
                            <td className="p-4">{o.tentativeBudget ? `₹${o.tentativeBudget}` : '—'}</td>
                            <td className="p-4 text-center">
                              <button onClick={() => approveOuting(o._id!)} className="bg-green-600 text-white px-3 py-1 rounded text-xs">
                                Approve
                              </button>
                              <button onClick={() => openRejectModal(o._id!)} className="bg-red-600 text-white px-3 py-1 rounded text-xs ml-2">
                                Reject
                              </button>
                            </td>
                            <td className="p-4 text-center">
                              <select
                                className="border rounded px-2 py-1 text-sm"
                                value={o.priority || 'P3'}
                                onChange={/* update priority */ () => {}}
                              >
                                <option>P1</option>
                                <option>P2</option>
                                <option>P3</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ─── EMPLOYEE FEEDBACK TAB ─── */}
          {currentTab === 'employee-feedback' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-8 text-center">
                Outing / Event Feedback
              </h3>

              <form onSubmit={(e) => { e.preventDefault(); /* TODO: implement feedback submission */ }} className="space-y-6">
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

                {/* Outing */}
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
                      .filter(o => o.status === 'Completed') // or Scheduled/Completed
                      .map(o => (
                        <option key={o._id} value={o._id}>
                          {o.topic} ({o.tentativeDate ? new Date(o.tentativeDate).toLocaleDateString() : 'TBD'})
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

                {/* Ratings & Feedback */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Overall Rating *</label>
                  <select
                    required
                    value={feedbackForm.overallRating}
                    onChange={e => setFeedbackForm({ ...feedbackForm, overallRating: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3"
                  >
                    <option value="">--Select--</option>
                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
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
                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">What was missing?</label>
                  <textarea
                    value={feedbackForm.whatWasMissing}
                    onChange={e => setFeedbackForm({ ...feedbackForm, whatWasMissing: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 h-24"
                    placeholder="Topics, activities, or arrangements not covered..."
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

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingFeedback || !feedbackForm.attended}
                    className={`px-10 py-3 rounded-xl font-bold text-white ${
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

          {/* Create Modal (HR) */}
          {currentTab === 'hr' && isCreateModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center">
                  <h3 className="text-xl font-bold">Propose New Outing / Event</h3>
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

          {/* Management Suggestion Modal */}
          {currentTab === 'management' && isSuggestModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center">
                  <h3 className="text-xl font-bold">Suggest New Outing / Event</h3>
                  <button onClick={() => setIsSuggestModalOpen(false)}>
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={submitSuggestion} className="p-8 space-y-6">
                  {/* Similar fields as HR create */}
                  {/* ... copy form fields from above ... */}
                  <div className="md:col-span-2 flex justify-end gap-4 pt-6 border-t">
                    <button type="button" onClick={() => setIsSuggestModalOpen(false)} className="px-8 py-3 text-gray-600">
                      Cancel
                    </button>
                    <button type="submit" className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold">
                      Submit Suggestion
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}