import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, X, CheckCircle, XCircle, Edit, Trash2, UserCheck, Globe } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API_BASE });

type Role = 'hr' | 'management' | 'admin';
const CURRENT_ROLE: Role = 'management';

const permissions: Record<Role, { create: boolean; edit: boolean; approve: boolean; reject: boolean }> = {
  hr: { create: true, edit: true, approve: false, reject: false },
  management: { create: true, edit: true, approve: true, reject: true },
  admin: { create: true, edit: true, approve: true, reject: true },
};
const rolePermissions = permissions[CURRENT_ROLE];

type TrainingType = 'Generic' | 'Dept Specific' | 'Level Specific' | 'Multi Dept';

interface Department { _id: string; name: string; }
interface Designation { _id: string; name: string; department: string; category: string; }
interface Employee { _id: string; full_name: string; department: string; designation: string; official_email: string; }

interface Training {
  _id: string;
  trainingId: string;
  phase1: {
    departments: string[];
    designation: string;
    category: string;
    trainingType: TrainingType;
    level: number | null;
    capabilities: string[];
    topicSuggestions: string[];
    selectedTopic: string;
  };
  approval: { status: 'Pending' | 'Approved' | 'Rejected'; approvedBy: string; remarks: string; approvedAt?: string | null };
  workflowStatus: 'Proposed' | 'Approved' | 'Scheduled' | 'Completed' | 'Rejected' | 'Archived';
  phase2?: {
    trainingTopic: string;
    type: TrainingType;
    capabilitiesCovered: string[];
    description: string;
    priority: 'P1' | 'P2' | 'P3';
    trainerType: 'Internal Trainer' | 'External Consultant';
    internalTrainer?: { employeeId: string; name: string; department: string; designation: string };
    externalTrainer?: { source: string; trainerName: string; organisation: string; mobile: string; email: string };
    status: string;
    contentPdfLink: string;
    videoLink: string;
    assessmentLink: string;
  };
  feedback?: { participant: string; rating: number; comments: string }[];
  scoring?: { averageScore: number; finalEvaluation: string };
  scheduledDate?: string;
}

type Phase1Form = {
  trainingType: TrainingType;
  departments: string[];
  designation: string;
  designationId: string;
  category: string;
  level: 1 | 2 | 3 | '';
  capabilities: string[];
  topicSuggestions: string[];
  selectedTopic: string;
};

const initialPhase1: Phase1Form = {
  trainingType: 'Dept Specific',
  departments: [],
  designation: '',
  designationId: '',
  category: '',
  level: '',
  capabilities: [],
  topicSuggestions: [],
  selectedTopic: '',
};

type Phase2Form = {
  trainingMongoId: string;
  trainingTopic: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
  trainerType: 'Internal Trainer' | 'External Consultant';
  internalTrainer: { employeeId: string; name: string; department: string; designation: string } | null;
  externalSource: string;
  externalTrainerName: string;
  externalOrganisation: string;
  externalMobile: string;
  externalEmail: string;
  status: string;
  contentPdfLink: string;
  videoLink: string;
  assessmentLink: string;
};

const initialPhase2: Phase2Form = {
  trainingMongoId: '',
  trainingTopic: '',
  description: '',
  priority: 'P3',
  trainerType: 'Internal Trainer',
  internalTrainer: null,
  externalSource: '',
  externalTrainerName: '',
  externalOrganisation: '',
  externalMobile: '',
  externalEmail: '',
  status: 'Scheduled',
  contentPdfLink: '',
  videoLink: '',
  assessmentLink: '',
};

type FeedbackForm = {
  trainingId: string;
  name: string;
  department: string;
  level: string;
  overallRating: number | '';
  contentQuality: number | '';
  missing: string;
  helpful: string;
};

const initialFeedback: FeedbackForm = {
  trainingId: '',
  name: '',
  department: '',
  level: '',
  overallRating: '',
  contentQuality: '',
  missing: '',
  helpful: '',
};

export default function TrainingPageImpl() {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const tabParam = (search.get('tab') || 'HR') as 'HR' | 'management' | 'employee' | 'scorecard';
  const activeTab = tabParam;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isPhase1Open, setIsPhase1Open] = useState(false);
  const [phase1EditingId, setPhase1EditingId] = useState<string | null>(null);
  const [phase1Form, setPhase1Form] = useState<Phase1Form>(initialPhase1);
  const [capInput, setCapInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  const [isPhase2Open, setIsPhase2Open] = useState(false);
  const [phase2EditingId, setPhase2EditingId] = useState<string | null>(null);
  const [phase2Form, setPhase2Form] = useState<Phase2Form>(initialPhase2);

  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');

  // Phase 2 schedule (calendar) state
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');

  // Phase 3 feedback form
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(initialFeedback);
  const [activeEmployeeTab, setActiveEmployeeTab] = useState<'generic' | 'byDept'>('generic');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [dR, dsR, eR, tR] = await Promise.all([
        api.get('/departments'),
        api.get('/designations'),
        api.get('/employees'),
        api.get('/trainings'),
      ]);

      const deptRaw = dR.data?.data ?? dR.data;
      const desigRaw = dsR.data?.data ?? dsR.data;
      const empRaw = eR.data?.data ?? eR.data;
      const trainRaw = tR.data?.data ?? tR.data;

      setDepartments(Array.isArray(deptRaw) ? deptRaw.map((d: any) => ({ _id: d._id, name: d.department ?? d.name ?? '' })) : []);
      setDesignations(Array.isArray(desigRaw)
        ? desigRaw.map((d: any) => ({ _id: d._id, name: d.designation ?? d.name ?? '', department: d.department ?? '', category: d.category ?? d.remarks ?? '' }))
        : []);
      setEmployees(Array.isArray(empRaw)
        ? empRaw.map((e: any) => ({ _id: e._id, full_name: e.full_name ?? e.name ?? '', department: e.department ?? '', designation: e.designation ?? '', official_email: e.official_email ?? e.email ?? '' }))
        : []);
      setTrainings(Array.isArray(trainRaw) ? trainRaw : []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filteredDesignations = useMemo(() => {
    if (phase1Form.departments.length === 0) return designations;
    return designations.filter(d => phase1Form.departments.includes(d.department));
  }, [designations, phase1Form.departments]);

  const phase1Rows = useMemo(() => trainings, [trainings]);
  const phase2Rows = useMemo(() => trainings.filter(t => !!t.phase2?.trainingTopic), [trainings]);

  const approvedForPhase2 = useMemo(
    () => trainings.filter(t => t.approval?.status === 'Approved'),
    [trainings]
  );

  const selectedPhase2Training = useMemo(
    () => trainings.find(t => t._id === phase2Form.trainingMongoId) || null,
    [trainings, phase2Form.trainingMongoId]
  );

  const phase2TopicOptions = useMemo(() => {
    if (!selectedPhase2Training) return [];
    const base = [
      ...(selectedPhase2Training.phase1?.topicSuggestions || []),
      selectedPhase2Training.phase1?.selectedTopic,
    ].filter(Boolean) as string[];
    return Array.from(new Set(base));
  }, [selectedPhase2Training]);

  const approvedGenericTrainings = useMemo(
    () =>
      trainings.filter(
        t =>
          t.approval?.status === 'Approved' &&
          t.phase1.trainingType === 'Generic' &&
          t.phase2?.trainingTopic
      ),
    [trainings]
  );

  const addCapability = () => {
    const v = capInput.trim();
    if (!v) return;
    setPhase1Form(prev => ({ ...prev, capabilities: Array.from(new Set([...prev.capabilities, v])) }));
    setCapInput('');
  };

  const addTopicSuggestion = () => {
    const v = topicInput.trim();
    if (!v) return;
    setPhase1Form(prev => ({ ...prev, topicSuggestions: Array.from(new Set([...prev.topicSuggestions, v])) }));
    setTopicInput('');
  };

  const generateTopicSuggestions = () => {
    const caps = phase1Form.capabilities;
    const dept = phase1Form.departments[0] || 'Department';
    const desig = phase1Form.designation || 'Role';
    const seeds = [
      caps.length ? `Training on ${caps.join(', ')}` : 'Training on Core Capabilities',
      `Capability Development for ${desig}`,
      `Department Excellence – ${dept}`,
    ];
    setPhase1Form(prev => ({
      ...prev,
      topicSuggestions: Array.from(new Set([...(prev.topicSuggestions || []), ...seeds])),
    }));
  };

  const openNewPhase1 = () => {
    setError('');
    setPhase1EditingId(null);
    setPhase1Form(initialPhase1);
    setCapInput('');
    setTopicInput('');
    setIsPhase1Open(true);
  };

  const openEditPhase1 = (t: Training) => {
    setError('');
    setPhase1EditingId(t._id);
    setPhase1Form({
      trainingType: t.phase1.trainingType,
      departments: t.phase1.departments || [],
      designation: t.phase1.designation || '',
      designationId: '',
      category: t.phase1.category || '',
      level: (t.phase1.level as any) || '',
      capabilities: t.phase1.capabilities || [],
      topicSuggestions: t.phase1.topicSuggestions || [],
      selectedTopic: t.phase1.selectedTopic || '',
    });
    setCapInput('');
    setTopicInput('');
    setIsPhase1Open(true);
  };

  const submitPhase1 = async () => {
    setError('');
    const payload = {
      departments: phase1Form.departments,
      designation: phase1Form.designation,
      category: phase1Form.category,
      trainingType: phase1Form.trainingType,
      level: phase1Form.level === '' ? null : Number(phase1Form.level),
      capabilities: phase1Form.capabilities,
      topicSuggestions: phase1Form.topicSuggestions,
      selectedTopic: phase1Form.selectedTopic,
    };

    if (phase1Form.trainingType !== 'Generic' && payload.departments.length === 0) return setError('Please select department(s)');
    if (phase1Form.trainingType !== 'Generic' && !payload.designation.trim()) return setError('Please select designation');
    if (phase1Form.trainingType === 'Level Specific' && ![1, 2, 3].includes(Number(payload.level))) return setError('Please select level 1/2/3');
    if (!payload.selectedTopic.trim()) return setError('Please select/provide a training topic');

    setLoading(true);
    try {
      if (phase1EditingId) {
        const res = await api.patch(`/trainings/${phase1EditingId}`, { phase1: payload });
        const updated = res.data?.data ?? res.data;
        setTrainings(prev => prev.map(t => (t._id === phase1EditingId ? updated : t)));
      } else {
        const res = await api.post('/trainings/phase1', payload);
        const created = res.data?.data ?? res.data;
        setTrainings(prev => [created, ...prev]);
      }
      setIsPhase1Open(false);
      setPhase1Form(initialPhase1);
      setPhase1EditingId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save Phase 1');
    } finally {
      setLoading(false);
    }
  };

  const openNewPhase2 = () => {
    setError('');
    setPhase2EditingId(null);
    setPhase2Form(initialPhase2);
    setIsPhase2Open(true);
  };

  const openEditPhase2 = (t: Training) => {
    setError('');
    setPhase2EditingId(t._id);
    setPhase2Form({
      trainingMongoId: t._id,
      trainingTopic: t.phase2?.trainingTopic || '',
      description: t.phase2?.description || '',
      priority: (t.phase2?.priority as any) || 'P3',
      trainerType: (t.phase2?.trainerType as any) || 'Internal Trainer',
      internalTrainer: t.phase2?.internalTrainer?.employeeId ? {
        employeeId: t.phase2.internalTrainer.employeeId,
        name: t.phase2.internalTrainer.name,
        department: t.phase2.internalTrainer.department,
        designation: t.phase2.internalTrainer.designation,
      } : null,
      externalSource: t.phase2?.externalTrainer?.source || '',
      externalTrainerName: t.phase2?.externalTrainer?.trainerName || '',
      externalOrganisation: t.phase2?.externalTrainer?.organisation || '',
      externalMobile: t.phase2?.externalTrainer?.mobile || '',
      externalEmail: t.phase2?.externalTrainer?.email || '',
      status: t.phase2?.status || 'Draft',
      contentPdfLink: t.phase2?.contentPdfLink || '',
      videoLink: t.phase2?.videoLink || '',
      assessmentLink: t.phase2?.assessmentLink || '',
    });
    setIsPhase2Open(true);
  };

  const submitPhase2 = async () => {
    setError('');
    if (!phase2Form.trainingMongoId) return setError('Please select training_id');
    if (!phase2Form.trainingTopic.trim()) return setError('Please select a training topic');
    if (!phase2Form.description.trim()) return setError('Description is required');
    if (phase2Form.trainerType === 'Internal Trainer' && !phase2Form.internalTrainer) return setError('Please select internal trainer');
    if (phase2Form.trainerType === 'External Consultant' && !phase2Form.externalTrainerName.trim()) return setError('External trainer name is required');

    const payload = {
      trainingTopic: phase2Form.trainingTopic,
      description: phase2Form.description,
      priority: phase2Form.priority,
      trainerType: phase2Form.trainerType,
      internalTrainer: phase2Form.trainerType === 'Internal Trainer' ? phase2Form.internalTrainer : null,
      externalTrainer: phase2Form.trainerType === 'External Consultant' ? {
        source: phase2Form.externalSource,
        trainerName: phase2Form.externalTrainerName,
        organisation: phase2Form.externalOrganisation,
        mobile: phase2Form.externalMobile,
        email: phase2Form.externalEmail,
      } : null,
      status: phase2Form.status,
      contentPdfLink: phase2Form.contentPdfLink,
      videoLink: phase2Form.videoLink,
      assessmentLink: phase2Form.assessmentLink,
    };

    setLoading(true);
    try {
      const res = await api.post(`/trainings/${phase2Form.trainingMongoId}/phase2`, payload);
      const updated = res.data?.data ?? res.data;
      setTrainings(prev => prev.map(t => (t._id === updated._id ? updated : t)));
      setIsPhase2Open(false);
      setPhase2Form(initialPhase2);
      setPhase2EditingId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save Phase 2');
    } finally {
      setLoading(false);
    }
  };

  const submitSchedule = async () => {
    if (!scheduleId || !scheduleDate) {
      return setError('Please pick a date');
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.patch(`/trainings/${scheduleId}`, { scheduledDate: scheduleDate });
      const updated = res.data?.data ?? res.data;
      setTrainings(prev => prev.map(t => (t._id === scheduleId ? updated : t)));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setScheduleId(null);
      setScheduleDate('');
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackForm.trainingId) return setError('Please select a training');
    if (!feedbackForm.name.trim()) return setError('Please enter your name');
    if (!feedbackForm.overallRating) return setError('Please select overall rating');
    if (!feedbackForm.contentQuality) return setError('Please select content quality rating');

    setError('');
    setLoading(true);
    try {
      const payload = {
        name: feedbackForm.name,
        department: feedbackForm.department,
        level: feedbackForm.level,
        overallRating: Number(feedbackForm.overallRating),
        contentQuality: Number(feedbackForm.contentQuality),
        missing: feedbackForm.missing,
        helpful: feedbackForm.helpful,
      };
      const res = await api.post(`/trainings/${feedbackForm.trainingId}/feedback`, payload);
      const updated = res.data?.data ?? res.data;
      setTrainings(prev => prev.map(t => (t._id === updated._id ? updated : t)));
      setFeedbackForm(initialFeedback);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const deleteTraining = async (id: string) => {
    if (!confirm('Delete this training?')) return;
    setError('');
    try {
      await api.delete(`/trainings/${id}`);
      setTrainings(prev => prev.filter(t => t._id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const submitApproval = async () => {
    if (!approvalId || !approvalAction) return;
    if (approvalAction === 'reject' && !approvalRemarks.trim()) return setError('Remarks are required for rejection');
    setError('');
    try {
      const res = await api.post(`/trainings/${approvalId}/${approvalAction}`, { remarks: approvalRemarks });
      const updated = res.data?.data ?? res.data;
      setTrainings(prev => prev.map(t => (t._id === approvalId ? updated : t)));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setApprovalId(null);
      setApprovalAction(null);
      setApprovalRemarks('');
    }
  };

  const trainerDisplay = (t: Training) => {
    const p2 = t.phase2;
    if (!p2?.trainerType) return '—';
    return p2.trainerType === 'Internal Trainer'
      ? (p2.internalTrainer?.name || '—')
      : (p2.externalTrainer?.trainerName || '—');
  };

  const typePill = (type: TrainingType) => {
    const map: Record<TrainingType, string> = {
      Generic: 'bg-indigo-50 text-indigo-700',
      'Dept Specific': 'bg-blue-50 text-blue-700',
      'Level Specific': 'bg-purple-50 text-purple-700',
      'Multi Dept': 'bg-emerald-50 text-emerald-700',
    };
    return map[type] || 'bg-gray-100 text-gray-600';
  };

  const displayStatus = (t: Training) => {
    if (t.workflowStatus === 'Archived') return 'Archived';
    if (t.approval?.status === 'Rejected' || t.workflowStatus === 'Rejected') return 'Rejected';
    if (t.workflowStatus === 'Proposed') return 'Proposed';
    if (t.workflowStatus === 'Approved') return 'Approved';
    if (t.workflowStatus === 'Scheduled') {
      if (t.scheduledDate && new Date(t.scheduledDate) < new Date()) return 'Completed';
      return 'Scheduled';
    }
    if (t.workflowStatus === 'Completed') return 'Completed';
    return t.workflowStatus;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-16 space-y-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Training</h1>
              {activeTab === 'HR' && (
                <p className="text-sm text-gray-500 mt-1">
                  HR view: assign capabilities, propose topics, and manage Phase 1 requests.
                </p>
              )}
              {activeTab === 'management' && (
                <p className="text-sm text-gray-500 mt-1">
                  Management view: review proposals, approve/reject, schedule, and manage training details.
                </p>
              )}
              {activeTab === 'employee' && (
                <p className="text-sm text-gray-500 mt-1">
                  Employee view: browse approved trainings and submit feedback.
                </p>
              )}
              {activeTab === 'scorecard' && (
                <p className="text-sm text-gray-500 mt-1">
                  Scorecard view (to be configured for training outcomes).
                </p>
              )}
            </div>
            {activeTab !== 'employee' && activeTab !== 'scorecard' && (
              <div className="flex gap-2">
                {rolePermissions.create && (
                  <button
                    onClick={openNewPhase1}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    <Plus size={16} /> New Phase 1
                  </button>
                )}
                {rolePermissions.create && (
                  <button
                    onClick={openNewPhase2}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    <Plus size={16} /> New Phase 2
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Phase 1 Table (HR + Management) */}
          {activeTab !== 'employee' && activeTab !== 'scorecard' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Phase 1 — Capability Assignment & Topic Suggestion</h2>
              <span className="text-xs text-gray-500">{phase1Rows.length} record(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['Training ID', 'Departments', 'Designation', 'Category', 'Type', 'Level', 'Capabilities', 'Selected Topic', 'Approval', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {phase1Rows.map(t => (
                    <tr key={t._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{t.trainingId || '—'}</td>
                      <td className="px-4 py-3">{(t.phase1?.departments || []).join(', ') || 'All'}</td>
                      <td className="px-4 py-3">{t.phase1?.designation || '—'}</td>
                      <td className="px-4 py-3">{t.phase1?.category || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typePill(t.phase1.trainingType)}`}>{t.phase1.trainingType}</span>
                      </td>
                      <td className="px-4 py-3">{t.phase1.trainingType === 'Level Specific' ? (t.phase1.level ? `L${t.phase1.level}` : '—') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(t.phase1?.capabilities || []).slice(0, 6).map((c, i) => (
                            <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{c}</span>
                          ))}
                          {(t.phase1?.capabilities || []).length > 6 && <span className="text-xs text-gray-500">+{(t.phase1.capabilities.length - 6)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">{t.phase1?.selectedTopic || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          t.approval?.status === 'Approved'
                            ? 'bg-green-50 text-green-700'
                            : t.approval?.status === 'Rejected'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {t.approval?.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {rolePermissions.edit && (
                            <button onClick={() => openEditPhase1(t)} className="text-blue-600 hover:text-blue-800" title="Edit Phase 1">
                              <Edit size={15} />
                            </button>
                          )}
                          {rolePermissions.edit && t.approval?.status === 'Pending' && (
                            <button onClick={() => deleteTraining(t._id)} className="text-red-500 hover:text-red-700" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          )}
                          {rolePermissions.approve && t.approval?.status === 'Pending' && (
                            <>
                              <button onClick={() => { setApprovalId(t._id); setApprovalAction('approve'); }} className="text-green-600 hover:text-green-800" title="Approve">
                                <CheckCircle size={15} />
                              </button>
                              <button onClick={() => { setApprovalId(t._id); setApprovalAction('reject'); }} className="text-red-600 hover:text-red-800" title="Reject">
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {phase1Rows.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">{loading ? 'Loading…' : 'No Phase 1 requests yet.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {/* Phase 2 Table (Management focus, but visible to HR if needed) */}
          {activeTab !== 'employee' && activeTab !== 'scorecard' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Phase 2 — Training Details</h2>
              <span className="text-xs text-gray-500">{phase2Rows.length} record(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['Training ID', 'Training Topic', 'Type', 'Capabilities Covered', 'Description', 'Priority', 'Trainer', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {phase2Rows.map(t => (
                    <tr key={t._id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{t.trainingId || '—'}</td>
                      <td className="px-4 py-3">{t.phase2?.trainingTopic || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typePill(t.phase2?.type || t.phase1.trainingType)}`}>
                          {t.phase2?.type || t.phase1.trainingType}
                        </span>
                      </td>
                      <td className="px-4 py-3">{(t.phase2?.capabilitiesCovered || []).join(', ') || '—'}</td>
                      <td className="px-4 py-3">{t.phase2?.description || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{t.phase2?.priority || '—'}</td>
                      <td className="px-4 py-3">{trainerDisplay(t)}</td>
                      <td className="px-4 py-3">{displayStatus(t)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {rolePermissions.edit && (
                            <button onClick={() => openEditPhase2(t)} className="text-blue-600 hover:text-blue-800" title="Edit Phase 2">
                              <Edit size={15} />
                            </button>
                          )}
                          {rolePermissions.approve &&
                            t.approval?.status === 'Approved' &&
                            !t.scheduledDate && (
                              <button
                                onClick={() => setScheduleId(t._id)}
                                className="text-purple-600 hover:text-purple-800 text-xs font-medium"
                              >
                                Schedule
                              </button>
                            )}
                          {rolePermissions.approve &&
                            (displayStatus(t) === 'Completed' || displayStatus(t) === 'Rejected') && (
                              <button
                                onClick={async () => {
                                  setError('');
                                  try {
                                    const res = await api.post(`/trainings/${t._id}/archive`);
                                    const updated = res.data?.data ?? res.data;
                                    setTrainings(prev => prev.map(x => (x._id === t._id ? updated : x)));
                                  } catch (err: any) {
                                    setError(err.response?.data?.error || err.message || 'Failed to archive');
                                  }
                                }}
                                className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                              >
                                Archive
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {phase2Rows.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">{loading ? 'Loading…' : 'No Phase 2 trainings yet.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {/* Employee View: Approved trainings content + feedback */}
          {activeTab === 'employee' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Employee — Approved Training Content & Feedback</h2>
                <p className="text-xs text-gray-500 mt-1">
                  View uploaded content for approved trainings and submit feedback after attending.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                <button
                  className={`px-3 py-1.5 rounded-md ${
                    activeEmployeeTab === 'generic' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                  }`}
                  onClick={() => setActiveEmployeeTab('generic')}
                >
                  Generic trainings
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md ${
                    activeEmployeeTab === 'byDept' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                  }`}
                  onClick={() => setActiveEmployeeTab('byDept')}
                >
                  By department / level
                </button>
              </div>
            </div>

            <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Content list */}
              <div className="lg:col-span-2 border-r border-gray-100 pr-0 lg:pr-6">
                {activeEmployeeTab === 'generic' && (
                  <div className="space-y-3">
                    {approvedGenericTrainings.length === 0 && (
                      <p className="text-sm text-gray-400">No approved generic trainings with content yet.</p>
                    )}
                    {approvedGenericTrainings.map(t => (
                      <div key={t._id} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">
                            {t.phase2?.trainingTopic || t.phase1.selectedTopic}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${typePill(t.phase1.trainingType)}`}>
                            {t.phase1.trainingType}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Training ID: {t.trainingId} · Departments: {(t.phase1.departments || []).join(', ') || 'All'}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs">
                          {t.phase2?.contentPdfLink && (
                            <a
                              href={t.phase2.contentPdfLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              Content PDF
                            </a>
                          )}
                          {t.phase2?.videoLink && (
                            <a
                              href={t.phase2.videoLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              Video
                            </a>
                          )}
                          {t.phase2?.assessmentLink && (
                            <a
                              href={t.phase2.assessmentLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              Assessment
                            </a>
                          )}
                          {!t.phase2?.contentPdfLink && !t.phase2?.videoLink && !t.phase2?.assessmentLink && (
                            <span className="text-gray-400">No content uploaded yet.</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeEmployeeTab === 'byDept' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block mb-1 font-medium text-gray-700">Your Department</label>
                        <select
                          value={feedbackForm.department}
                          onChange={e => setFeedbackForm(prev => ({ ...prev, department: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                        >
                          <option value="">-- Any --</option>
                          {departments.map(d => (
                            <option key={d._id} value={d.name}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1 font-medium text-gray-700">Your Level</label>
                        <select
                          value={feedbackForm.level}
                          onChange={e => setFeedbackForm(prev => ({ ...prev, level: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                        >
                          <option value="">-- Any --</option>
                          <option value="1">Level 1</option>
                          <option value="2">Level 2</option>
                          <option value="3">Level 3</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {trainings
                        .filter(
                          t =>
                            t.approval?.status === 'Approved' &&
                            t.phase2?.trainingTopic &&
                            (feedbackForm.department
                              ? (t.phase1.departments || []).includes(feedbackForm.department)
                              : true) &&
                            (feedbackForm.level
                              ? String(t.phase1.level || '') === String(feedbackForm.level)
                              : true)
                        )
                        .map(t => (
                          <div key={t._id} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-gray-900">
                                {t.phase2?.trainingTopic || t.phase1.selectedTopic}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${typePill(
                                  t.phase1.trainingType
                                )}`}
                              >
                                {t.phase1.trainingType}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Training ID: {t.trainingId} · Departments: {(t.phase1.departments || []).join(', ') || 'All'}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs">
                              {t.phase2?.contentPdfLink && (
                                <a
                                  href={t.phase2.contentPdfLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  Content PDF
                                </a>
                              )}
                              {t.phase2?.videoLink && (
                                <a
                                  href={t.phase2.videoLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  Video
                                </a>
                              )}
                              {t.phase2?.assessmentLink && (
                                <a
                                  href={t.phase2.assessmentLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  Assessment
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback form */}
              <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Training Feedback (Attendance)</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block mb-1 font-medium text-gray-700">Your Name</label>
                    <input
                      value={feedbackForm.name}
                      onChange={e => setFeedbackForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-medium text-gray-700">Training</label>
                    <select
                      value={feedbackForm.trainingId}
                      onChange={e => setFeedbackForm(prev => ({ ...prev, trainingId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="">-- Select training --</option>
                      {approvedGenericTrainings.map(t => (
                        <option key={t._id} value={t._id}>
                          {t.trainingId} — {t.phase2?.trainingTopic || t.phase1.selectedTopic}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Only approved Generic trainings are listed here.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 font-medium text-gray-700">Overall Rating</label>
                      <select
                        value={feedbackForm.overallRating}
                        onChange={e =>
                          setFeedbackForm(prev => ({ ...prev, overallRating: e.target.value ? Number(e.target.value) : '' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                      >
                        <option value="">-- Select --</option>
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 font-medium text-gray-700">Content Quality</label>
                      <select
                        value={feedbackForm.contentQuality}
                        onChange={e =>
                          setFeedbackForm(prev => ({
                            ...prev,
                            contentQuality: e.target.value ? Number(e.target.value) : '',
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                      >
                        <option value="">-- Select --</option>
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium text-gray-700">What was missing?</label>
                    <textarea
                      value={feedbackForm.missing}
                      onChange={e => setFeedbackForm(prev => ({ ...prev, missing: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-medium text-gray-700">How was it helpful?</label>
                    <textarea
                      value={feedbackForm.helpful}
                      onChange={e => setFeedbackForm(prev => ({ ...prev, helpful: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={submitFeedback}
                      disabled={loading}
                      className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Submitting…' : 'Submit Feedback'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}
        </main>
      </div>

      {/* Phase 1 Modal */}
      {isPhase1Open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">{phase1EditingId ? 'Edit Phase 1 Request' : 'New Phase 1 Request'}</h3>
              <button onClick={() => setIsPhase1Open(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Training Type</label>
                  <select
                    value={phase1Form.trainingType}
                    onChange={e => setPhase1Form(prev => ({
                      ...prev,
                      trainingType: e.target.value as TrainingType,
                      level: e.target.value === 'Level Specific' ? prev.level : '',
                      departments: e.target.value === 'Generic' ? [] : prev.departments,
                    }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="Generic">Generic (All departments)</option>
                    <option value="Dept Specific">Department specific</option>
                    <option value="Level Specific">Level specific</option>
                    <option value="Multi Dept">Multi department</option>
                  </select>
                </div>

                {phase1Form.trainingType === 'Level Specific' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                    <select
                      value={phase1Form.level}
                      onChange={e => setPhase1Form(prev => ({ ...prev, level: (e.target.value as any) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value="">Select level</option>
                      <option value="1">Level 1</option>
                      <option value="2">Level 2</option>
                      <option value="3">Level 3</option>
                    </select>
                  </div>
                )}

                {phase1Form.trainingType !== 'Generic' && phase1Form.trainingType !== 'Multi Dept' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={phase1Form.departments[0] ?? ''}
                      onChange={e =>
                        setPhase1Form(prev => ({
                          ...prev,
                          departments: e.target.value ? [e.target.value] : [],
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => (
                        <option key={d._id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {phase1Form.trainingType === 'Multi Dept' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departments (multi)</label>
                    <div className="grid grid-cols-2 gap-2 border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                      {departments.map(d => {
                        const checked = phase1Form.departments.includes(d.name);
                        return (
                          <label key={d._id} className="inline-flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={checked}
                              onChange={e => {
                                setPhase1Form(prev => ({
                                  ...prev,
                                  departments: e.target.checked
                                    ? [...prev.departments, d.name]
                                    : prev.departments.filter(x => x !== d.name),
                                }));
                              }}
                            />
                            <span>{d.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {phase1Form.trainingType !== 'Generic' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                    <select
                      value={phase1Form.designationId}
                      onChange={e => {
                        const d = designations.find(x => x._id === e.target.value);
                        if (!d) return;
                        setPhase1Form(prev => ({ ...prev, designationId: d._id, designation: d.name, category: d.category }));
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value="">Select designation</option>
                      {filteredDesignations.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    value={phase1Form.category}
                    onChange={e => setPhase1Form(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Category"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capabilities</label>
                <div className="flex gap-2">
                  <input
                    value={capInput}
                    onChange={e => setCapInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCapability(); } }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Type capability and press Enter"
                  />
                  <button onClick={addCapability} className="bg-gray-900 text-white px-4 rounded-lg text-sm">Add</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {phase1Form.capabilities.map((c, i) => (
                    <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      {c}
                      <button onClick={() => setPhase1Form(prev => ({ ...prev, capabilities: prev.capabilities.filter((_, idx) => idx !== i) }))} className="text-blue-700/70 hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic Suggestions</label>
                  <div className="flex gap-2">
                    <input
                      value={topicInput}
                      onChange={e => setTopicInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopicSuggestion(); } }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                      placeholder="Add a suggested topic"
                    />
                    <button onClick={addTopicSuggestion} className="bg-gray-900 text-white px-4 rounded-lg text-sm">Add</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {phase1Form.topicSuggestions.map((t, i) => (
                      <span key={i} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                        {t}
                        <button onClick={() => setPhase1Form(prev => ({ ...prev, topicSuggestions: prev.topicSuggestions.filter((_, idx) => idx !== i) }))} className="text-emerald-700/70 hover:text-emerald-900">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2">
                    <button onClick={generateTopicSuggestions} className="text-xs font-medium text-blue-700 hover:text-blue-900">
                      Generate suggestions from capabilities
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selected Topic (submit to management)</label>
                  <input
                    value={phase1Form.selectedTopic}
                    onChange={e => setPhase1Form(prev => ({ ...prev, selectedTopic: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Pick from suggestions or type here"
                    list="phase1-topic-suggestions"
                  />
                  <datalist id="phase1-topic-suggestions">
                    {phase1Form.topicSuggestions.map((t, i) => <option key={i} value={t} />)}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">This topic goes for approval/rejection.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button onClick={() => setIsPhase1Open(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitPhase1} disabled={loading} className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50">
                {loading ? 'Saving…' : phase1EditingId ? 'Update Phase 1' : 'Submit Phase 1'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 Modal */}
      {isPhase2Open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">{phase2EditingId ? 'Edit Phase 2 Training' : 'New Phase 2 Training'}</h3>
              <button onClick={() => setIsPhase2Open(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Training ID</label>
                  <select
                    value={phase2Form.trainingMongoId}
                    onChange={e => {
                      const id = e.target.value;
                      const t = trainings.find(x => x._id === id);
                      setPhase2Form(prev => ({ ...prev, trainingMongoId: id, trainingTopic: '' }));
                      if (t && !phase2Form.description.trim()) {
                        setPhase2Form(prev => ({ ...prev, description: `Training for ${t.phase1.designation || 'role'} based on capabilities: ${(t.phase1.capabilities || []).join(', ')}` }));
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="">Select training_id (Approved Phase 1)</option>
                    {approvedForPhase2.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.trainingId} — {t.phase1.selectedTopic}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Training Topic</label>
                  <select
                    value={phase2Form.trainingTopic}
                    onChange={e => setPhase2Form(prev => ({ ...prev, trainingTopic: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    disabled={!phase2Form.trainingMongoId}
                  >
                    <option value="">{phase2Form.trainingMongoId ? 'Select topic' : 'Select training_id first'}</option>
                    {phase2TopicOptions.map((t, i) => <option key={i} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type (from Phase 1)</label>
                  <input
                    value={selectedPhase2Training?.phase1.trainingType || ''}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capabilities Covered (from Phase 1)</label>
                  <input
                    value={(selectedPhase2Training?.phase1.capabilities || []).join(', ')}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={phase2Form.description}
                  onChange={e => setPhase2Form(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={phase2Form.priority}
                    onChange={e => setPhase2Form(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="P1">P1 — High</option>
                    <option value="P2">P2 — Medium</option>
                    <option value="P3">P3 — Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <input
                    value={phase2Form.status}
                    onChange={e => setPhase2Form(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Draft / Active / Completed ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trainer Type</label>
                  <div className="flex gap-2">
                    {(['Internal Trainer', 'External Consultant'] as const).map(tt => (
                      <button
                        key={tt}
                        type="button"
                        onClick={() => setPhase2Form(prev => ({ ...prev, trainerType: tt }))}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                          phase2Form.trainerType === tt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {tt === 'Internal Trainer' ? <UserCheck size={15} /> : <Globe size={15} />}
                        {tt === 'Internal Trainer' ? 'Internal' : 'External'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {phase2Form.trainerType === 'Internal Trainer' && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                  <p className="text-xs font-semibold text-blue-800">Internal Trainer</p>
                  <select
                    value={phase2Form.internalTrainer?.employeeId ?? ''}
                    onChange={e => {
                      const emp = employees.find(x => x._id === e.target.value);
                      setPhase2Form(prev => ({
                        ...prev,
                        internalTrainer: emp ? { employeeId: emp._id, name: emp.full_name, department: emp.department, designation: emp.designation } : null,
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e._id} value={e._id}>{e.full_name} — {e.designation} ({e.department})</option>)}
                  </select>
                </div>
              )}

              {phase2Form.trainerType === 'External Consultant' && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-100 space-y-2">
                  <p className="text-xs font-semibold text-green-800">External Consultant</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={phase2Form.externalSource} onChange={e => setPhase2Form(prev => ({ ...prev, externalSource: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Source" />
                    <input value={phase2Form.externalTrainerName} onChange={e => setPhase2Form(prev => ({ ...prev, externalTrainerName: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Trainer name *" />
                    <input value={phase2Form.externalOrganisation} onChange={e => setPhase2Form(prev => ({ ...prev, externalOrganisation: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Organisation" />
                    <input value={phase2Form.externalMobile} onChange={e => setPhase2Form(prev => ({ ...prev, externalMobile: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Mobile" />
                    <input value={phase2Form.externalEmail} onChange={e => setPhase2Form(prev => ({ ...prev, externalEmail: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Email" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={phase2Form.contentPdfLink} onChange={e => setPhase2Form(prev => ({ ...prev, contentPdfLink: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Content PDF Link" />
                <input value={phase2Form.videoLink} onChange={e => setPhase2Form(prev => ({ ...prev, videoLink: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Video Link" />
                <input value={phase2Form.assessmentLink} onChange={e => setPhase2Form(prev => ({ ...prev, assessmentLink: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Assessment Link" />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button onClick={() => setIsPhase2Open(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitPhase2} disabled={loading} className="px-5 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50">
                {loading ? 'Saving…' : phase2EditingId ? 'Update Phase 2' : 'Submit Phase 2'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvalId && approvalAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className={`text-lg font-bold ${approvalAction === 'approve' ? 'text-green-700' : 'text-red-700'}`}>
              {approvalAction === 'approve' ? 'Approve Topic' : 'Reject Topic'}
            </h3>
            <textarea
              value={approvalRemarks}
              onChange={e => setApprovalRemarks(e.target.value)}
              rows={3}
              placeholder={approvalAction === 'reject' ? 'Reason for rejection (required)…' : 'Remarks (optional)…'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setApprovalId(null); setApprovalAction(null); setApprovalRemarks(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitApproval}
                className={`px-5 py-2 text-sm text-white rounded-lg font-medium ${approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

