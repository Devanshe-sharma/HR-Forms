import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, X, CheckCircle, XCircle, Edit, Trash2, Archive, UserCheck, Globe, Upload, FileText, Video, FileCheck, Calendar, Users, Award, TrendingUp } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRole, can, trainingTabVisibility } from '../config/rbac';
import HRModule from '../components/training/HRModule';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

const rolePermissions = {
  create: can('trainingSchedule', 'create') || can('trainingSuggestions', 'create'),
  edit: can('trainingSchedule', 'update') || can('trainingSuggestions', 'update'),
  approve: can('managementPending', 'approve') || can('trainingSchedule', 'approve'),
  reject: can('managementPending', 'reject') || can('trainingSchedule', 'reject'),
};

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
    category?: string;
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
    assessmentFields?: { type: string; question: string; options?: string[]; correctAnswer?: string; keywords?: string[] }[];
    requiredScore?: number | null;
    requiredScoreMatrix?: { department: string; level: number | null; requiredScore: number }[];
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
  level: '',
  capabilities: [],
  topicSuggestions: [],
  selectedTopic: '',
};

type AssessmentField = { type: 'text' | 'mcq' | 'checkbox' | 'paragraph'; question: string; options?: string[]; correctAnswer?: string; keywords?: string[] };

type RequiredScoreMatrixItem = { department: string; level: number | ''; requiredScore: number | '' };

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
  assessmentFields: AssessmentField[];
  requiredScore: number | '' | 'level';
  requiredScoreMatrix: RequiredScoreMatrixItem[];
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
  assessmentFields: [],
  requiredScore: 'level',
  requiredScoreMatrix: [],
};

type FeedbackForm = {
  trainingId: string;
  employeeId: string;
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
  employeeId: '',
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
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const tabParam = (search.get('tab') || 'HR') as 'HR' | 'management' | 'employee' | 'scorecard' | 'trainer';
  const activeTab = tabParam;

  useEffect(() => {
    const vis = trainingTabVisibility();
    const allowed = (t: string) => vis[t as keyof typeof vis];
    if (activeTab && !allowed(activeTab)) {
      const first = (['HR', 'management', 'trainer', 'employee', 'scorecard'] as const).find(t => allowed(t));
      if (first) navigate(`/training-page?tab=${first}`, { replace: true });
    }
  }, [activeTab, navigate]);
  
  // Current user (trainer) - in real app, get from auth context
  const [currentTrainerId, setCurrentTrainerId] = useState<string | null>(null);
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

  // Assessment submission modal (for employees)
  const [assessmentTrainingId, setAssessmentTrainingId] = useState<string | null>(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<number, string | string[]>>({});
  const [assessmentAttempts, setAssessmentAttempts] = useState<{ attemptNo: number; score: number; status: string; date: string }[]>([]);

  // Trainer content upload modal (simplified - only content, no assessment setup)
  const [trainerContentTrainingId, setTrainerContentTrainingId] = useState<string | null>(null);
  const [trainerContentForm, setTrainerContentForm] = useState({ contentPdfLink: '', videoLink: '', assessmentLink: '' });

  // New flow: training_schedule materials upload (assessment from pool)
  const [trainerSchedulesNew, setTrainerSchedulesNew] = useState<any[]>([]);
  const [trainerMaterialScheduleId, setTrainerMaterialScheduleId] = useState<string | null>(null);
  const [trainerMaterialForm, setTrainerMaterialForm] = useState({ contentFile: '', videoUrl: '', assessmentId: '' });
  const [capabilityAssessmentsList, setCapabilityAssessmentsList] = useState<any[]>([]);
  const [employeeSchedulesNew, setEmployeeSchedulesNew] = useState<any[]>([]);
  const [employeeMaterialsBySchedule, setEmployeeMaterialsBySchedule] = useState<Record<string, any[]>>({});
  const [feedbackCanSubmit, setFeedbackCanSubmit] = useState<Record<string, boolean>>({});
  const [employeeFeedbackScheduleId, setEmployeeFeedbackScheduleId] = useState<string | null>(null);
  const [employeeFeedbackRating, setEmployeeFeedbackRating] = useState<number>(5);
  const [employeeFeedbackComments, setEmployeeFeedbackComments] = useState('');

  // Phase 2 table filters — default: current quarter and year, not archived
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const currentYear = now.getFullYear();
  const [filterQuarter, setFilterQuarter] = useState<1 | 2 | 3 | 4 | 'all'>(currentQuarter as 1 | 2 | 3 | 4);
  const [filterYear, setFilterYear] = useState<number | 'all'>(currentYear);
  const [filterArchived, setFilterArchived] = useState<'no' | 'yes' | 'all'>('no');

  // Scorecard: employees list + selected employee drill-down
  const [scorecardEmployees, setScorecardEmployees] = useState<{ _id: string; employee_id?: string; full_name?: string; department?: string; designation?: string; level?: number }[]>([]);
  const [selectedScorecardEmpId, setSelectedScorecardEmpId] = useState<string | null>(null);
  const [scorecardRows, setScorecardRows] = useState<{
    emp_id: string; employee_name: string; training_name: string; attempt_no: number; score_achieved: number | null; required_score: number;
    status: string | null; assessment_date: string | null; retake: string; retake_score: number | null; retake_date: string | null; retake_status: string | null; final_status: string | null;
    feedback_given?: boolean; feedback_due_at?: string | null;
  }[]>([]);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);
  const [pendingSchedulesLoading, setPendingSchedulesLoading] = useState(false);
  const loadPendingSchedules = async () => {
    setPendingSchedulesLoading(true);
    try {
      const res = await api.get('/training-schedule/pending');
      setPendingSchedules(res.data?.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load pending schedules');
    } finally {
      setPendingSchedulesLoading(false);
    }
  };

  const loadScorecardEmployees = async () => {
    setScorecardLoading(true);
    try {
      const res = await api.get('/trainings/scorecard/employees');
      const data = res.data?.data ?? res.data;
      setScorecardEmployees(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load scorecard employees');
    } finally {
      setScorecardLoading(false);
    }
  };

  const loadScorecardForEmployee = async (employeeId: string) => {
    setSelectedScorecardEmpId(employeeId);
    setScorecardLoading(true);
    try {
      const res = await api.get(`/trainings/scorecard/employee/${employeeId}`);
      const data = res.data?.data ?? res.data;
      setScorecardRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load scorecard');
      setScorecardRows([]);
    } finally {
      setScorecardLoading(false);
    }
  };

  const loadAssessmentAttempts = async (trainingId: string) => {
    if (!feedbackForm.employeeId) {
      setError('Please select your employee name first');
      return;
    }
    try {
      const attemptsRes = await api.get(`/trainings/${trainingId}/attempts?employeeId=${feedbackForm.employeeId}`).catch(() => ({ data: { data: [] } }));
      setAssessmentAttempts(attemptsRes.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load attempts:', err);
      setAssessmentAttempts([]);
    }
  };

  const calculateAssessmentScore = (training: Training): number => {
    const fields = training.phase2?.assessmentFields || [];
    if (fields.length === 0) return 0;
    let correct = 0;
    fields.forEach((field, idx) => {
      const answer = assessmentAnswers[idx];
      if (!answer || (Array.isArray(answer) && answer.length === 0)) return;
      if (field.type === 'text') {
        if (String(answer).trim().toLowerCase() === String(field.correctAnswer || '').trim().toLowerCase()) correct++;
      } else if (field.type === 'mcq') {
        const selectedOptIdx = Number(answer);
        const correctOptIdx = field.options?.findIndex(opt => opt === field.correctAnswer) ?? -1;
        if (selectedOptIdx === correctOptIdx && correctOptIdx >= 0) correct++;
      } else if (field.type === 'checkbox') {
        const ansArr = Array.isArray(answer) ? answer.map(a => Number(a)) : [Number(answer)];
        const correctOpts = (field.options || []).map((opt, i) => opt === field.correctAnswer ? i : -1).filter(i => i >= 0);
        if (ansArr.length === correctOpts.length && ansArr.every(a => correctOpts.includes(a)) && correctOpts.every(c => ansArr.includes(c))) correct++;
      } else if (field.type === 'paragraph') {
        const ansText = String(answer).toLowerCase();
        const keywords = (field.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
        if (keywords.length > 0 && keywords.some(k => ansText.includes(k))) correct++;
      }
    });
    return Math.round((correct / fields.length) * 100);
  };

  const submitTrainerContent = async () => {
    if (!trainerContentTrainingId) return;
    setError('');
    setLoading(true);
    try {
      const training = trainings.find(t => t._id === trainerContentTrainingId);
      if (!training) {
        setError('Training not found');
        return;
      }
      const res = await api.post(`/trainings/${trainerContentTrainingId}/phase2`, {
        trainingTopic: training.phase2?.trainingTopic || training.phase1.selectedTopic,
        description: training.phase2?.description || '',
        priority: training.phase2?.priority || 'P3',
        trainerType: training.phase2?.trainerType || 'Internal Trainer',
        internalTrainer: training.phase2?.internalTrainer || null,
        externalTrainer: training.phase2?.externalTrainer || null,
        status: training.phase2?.status || 'Scheduled',
        contentPdfLink: trainerContentForm.contentPdfLink,
        videoLink: trainerContentForm.videoLink,
        assessmentLink: trainerContentForm.assessmentLink,
        assessmentFields: training.phase2?.assessmentFields || [],
        requiredScore: training.phase2?.requiredScore || null,
        requiredScoreMatrix: training.phase2?.requiredScoreMatrix || [],
      });
      const updated = res.data?.data ?? res.data;
      setTrainings(prev => prev.map(t => (t._id === updated._id ? updated : t)));
      setTrainerContentTrainingId(null);
      setTrainerContentForm({ contentPdfLink: '', videoLink: '', assessmentLink: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to upload content');
    } finally {
      setLoading(false);
    }
  };

  const submitTrainerMaterialNew = async () => {
    if (!trainerMaterialScheduleId) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/training-materials', {
        trainingScheduleId: trainerMaterialScheduleId,
        contentFile: trainerMaterialForm.contentFile,
        videoUrl: trainerMaterialForm.videoUrl,
        assessmentId: trainerMaterialForm.assessmentId || undefined,
      });
      setTrainerMaterialScheduleId(null);
      setTrainerMaterialForm({ contentFile: '', videoUrl: '', assessmentId: '' });
      if (currentTrainerId) {
        const res = await api.get('/training-schedule', { params: { trainerId: currentTrainerId } });
        setTrainerSchedulesNew(res.data?.data ?? []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to upload material');
    } finally {
      setLoading(false);
    }
  };

  const submitEmployeeFeedbackNew = async () => {
    if (!employeeFeedbackScheduleId || !feedbackForm.employeeId) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/training-feedback', {
        trainingScheduleId: employeeFeedbackScheduleId,
        employeeId: feedbackForm.employeeId,
        rating: employeeFeedbackRating,
        comments: employeeFeedbackComments,
      });
      setEmployeeFeedbackScheduleId(null);
      setEmployeeFeedbackRating(5);
      setEmployeeFeedbackComments('');
      if (feedbackForm.employeeId) {
        const res = await api.get('/training-schedule', { params: { employeeId: feedbackForm.employeeId } });
        const list = res.data?.data ?? [];
        setEmployeeSchedulesNew(list);
        const bySchedule: Record<string, any[]> = {};
        const canSubmit: Record<string, boolean> = {};
        for (const s of list) {
          try {
            const [matRes, canRes] = await Promise.all([
              api.get('/training-materials', { params: { trainingScheduleId: s._id } }),
              api.get(`/training-feedback/can-submit/${s._id}`),
            ]);
            bySchedule[s._id] = matRes.data?.data ?? [];
            canSubmit[s._id] = canRes.data?.canSubmit === true;
          } catch {
            bySchedule[s._id] = [];
            canSubmit[s._id] = false;
          }
        }
        setEmployeeMaterialsBySchedule(bySchedule);
        setFeedbackCanSubmit(canSubmit);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const submitAssessment = async () => {
    if (!assessmentTrainingId || !feedbackForm.employeeId) {
      setError('Please select your employee name first');
      return;
    }
    const training = trainings.find(t => t._id === assessmentTrainingId);
    if (!training) {
      setError('Training not found');
      return;
    }
    const fields = training.phase2?.assessmentFields || [];
    if (fields.length === 0) {
      setError('No assessment fields configured');
      return;
    }
    const score = calculateAssessmentScore(training);
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/trainings/${assessmentTrainingId}/assessment-attempt`, {
        employeeId: feedbackForm.employeeId,
        scoreAchieved: score,
      });
      const data = res.data?.data ?? res.data;
      setAssessmentAnswers({});
      await loadAssessmentAttempts(assessmentTrainingId);
      if (data.attemptsRemaining === 0) {
        setAssessmentTrainingId(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit assessment');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (activeTab === 'scorecard') loadScorecardEmployees();
    if (activeTab === 'management') loadPendingSchedules();
    if (activeTab === 'employee' && feedbackForm.employeeId) {
      api.get('/training-schedule', { params: { employeeId: feedbackForm.employeeId } })
        .then(async res => {
          const list = res.data?.data ?? [];
          setEmployeeSchedulesNew(list);
          const bySchedule: Record<string, any[]> = {};
          const canSubmit: Record<string, boolean> = {};
          for (const s of list) {
            try {
              const [matRes, canRes] = await Promise.all([
                api.get('/training-materials', { params: { trainingScheduleId: s._id } }),
                api.get(`/training-feedback/can-submit/${s._id}`),
              ]);
              bySchedule[s._id] = matRes.data?.data ?? [];
              canSubmit[s._id] = canRes.data?.canSubmit === true;
            } catch {
              bySchedule[s._id] = [];
              canSubmit[s._id] = false;
            }
          }
          setEmployeeMaterialsBySchedule(bySchedule);
          setFeedbackCanSubmit(canSubmit);
        })
        .catch(() => setEmployeeSchedulesNew([]));
    } else {
      setEmployeeSchedulesNew([]);
      setEmployeeMaterialsBySchedule({});
    }
    if (activeTab === 'trainer' && currentTrainerId) {
      api.get('/training-schedule', { params: { trainerId: currentTrainerId } })
        .then(res => setTrainerSchedulesNew(res.data?.data ?? []))
        .catch(() => setTrainerSchedulesNew([]));
    } else {
      setTrainerSchedulesNew([]);
    }
  }, [activeTab, currentTrainerId, feedbackForm.employeeId]);

  useEffect(() => {
    if (trainerMaterialScheduleId) {
      api.get('/capability-assessment').then(res => setCapabilityAssessmentsList(res.data?.data ?? [])).catch(() => setCapabilityAssessmentsList([]));
    }
  }, [trainerMaterialScheduleId]);

  const filteredDesignations = useMemo(() => {
    if (phase1Form.departments.length === 0) return designations;
    return designations.filter(d => phase1Form.departments.includes(d.department));
  }, [designations, phase1Form.departments]);

  const phase1Rows = useMemo(() => trainings, [trainings]);

  const getQuarter = (d: Date) => Math.floor(d.getMonth() / 3) + 1;
  const getYear = (d: Date) => d.getFullYear();
  const phase2Rows = useMemo(() => {
    let rows = trainings.filter(t => !!t.phase2?.trainingTopic);
    if (filterArchived === 'no') rows = rows.filter(t => t.workflowStatus !== 'Archived');
    else if (filterArchived === 'yes') rows = rows.filter(t => t.workflowStatus === 'Archived');
    if (filterQuarter !== 'all' || filterYear !== 'all') {
      rows = rows.filter(t => {
        const dateStr = t.scheduledDate;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const q = getQuarter(d);
        const y = getYear(d);
        if (filterQuarter !== 'all' && q !== filterQuarter) return false;
        if (filterYear !== 'all' && y !== filterYear) return false;
        return true;
      });
    }
    return rows;
  }, [trainings, filterQuarter, filterYear, filterArchived]);

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

  // Trainer's trainings (where current user is the internal trainer)
  const trainerTrainings = useMemo(
    () =>
      currentTrainerId
        ? trainings.filter(
            t =>
              t.phase2?.internalTrainer?.employeeId === currentTrainerId &&
              t.approval?.status === 'Approved'
          )
        : [],
    [trainings, currentTrainerId]
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
      assessmentFields: (t.phase2 as any)?.assessmentFields || [],
      requiredScore: (t.phase2 as any)?.requiredScore != null ? (t.phase2 as any).requiredScore : 'level',
      requiredScoreMatrix: Array.isArray((t.phase2 as any)?.requiredScoreMatrix) ? (t.phase2 as any).requiredScoreMatrix.map((m: any) => ({ department: m.department || '', level: m.level != null ? m.level : '', requiredScore: m.requiredScore || '' })) : [],
    });
    setIsPhase2Open(true);
  };

  const addAssessmentField = (type: AssessmentField['type']) => {
    setPhase2Form(prev => ({
      ...prev,
      assessmentFields: [...prev.assessmentFields, { type, question: '', options: type === 'mcq' || type === 'checkbox' ? [''] : undefined, correctAnswer: '', keywords: type === 'paragraph' ? [] : undefined }],
    }));
  };

  const updateAssessmentField = (idx: number, upd: Partial<AssessmentField>) => {
    setPhase2Form(prev => ({
      ...prev,
      assessmentFields: prev.assessmentFields.map((f, i) => (i === idx ? { ...f, ...upd } : f)),
    }));
  };

  const removeAssessmentField = (idx: number) => {
    setPhase2Form(prev => ({ ...prev, assessmentFields: prev.assessmentFields.filter((_, i) => i !== idx) }));
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
      assessmentFields: phase2Form.assessmentFields,
      requiredScore: phase2Form.requiredScore === 'level' ? null : (phase2Form.requiredScore === '' ? null : Number(phase2Form.requiredScore)),
      requiredScoreMatrix: phase2Form.requiredScoreMatrix
        .filter(m => m.department && m.level && m.requiredScore !== '')
        .map(m => ({ department: m.department, level: Number(m.level), requiredScore: Number(m.requiredScore) })),
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
    if (!feedbackForm.employeeId || !feedbackForm.name.trim()) return setError('Please select your name from the list');
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

  const formatDateDDMMMYYYY = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-6 md:p-8 mt-20 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Management</h1>
              {activeTab === 'HR' && (
                <p className="text-sm text-gray-500 mt-1">
                  
                </p>
              )}
              {activeTab === 'management' && (
                <p className="text-sm text-gray-500 mt-1">
                  Management: Pending training schedules — Approve / Reject.
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
              {activeTab === 'trainer' && (
                <p className="text-sm text-gray-500 mt-1">
                  Trainer view: upload content and set up assessments for your assigned trainings.
                </p>
              )}
            </div>
            {activeTab !== 'employee' && activeTab !== 'scorecard' && activeTab !== 'trainer' && activeTab !== 'HR' && (
              <div className="flex gap-2">
                {rolePermissions.create && (
                  <button
                    onClick={openNewPhase1}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    <Plus size={16} /> Topic Suggestion
                  </button>
                )}
                {rolePermissions.create && (
                  <button
                    onClick={openNewPhase2}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    <Plus size={16} /> Training Details
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg text-sm flex items-center gap-2 shadow-sm">
              <XCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Scorecard: employee list + drill-down table */}
          {activeTab === 'scorecard' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Training Scorecard</h2>
              <p className="text-xs text-gray-500 mt-1">Click an employee to see all trainings with attempt details, required score, and final status.</p>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-4">
              <div className="min-w-[280px]">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Employees</h3>
                {scorecardLoading && !selectedScorecardEmpId ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : (
                  <ul className="border border-gray-200 rounded-lg divide-y max-h-[400px] overflow-y-auto">
                    {scorecardEmployees.map(emp => (
                      <li key={emp._id}>
                        <button
                          type="button"
                          onClick={() => loadScorecardForEmployee(emp._id)}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 ${selectedScorecardEmpId === emp._id ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-700'}`}
                        >
                          {emp.full_name || emp.employee_id || emp._id} {emp.department ? ` · ${emp.department}` : ''}
                        </button>
                      </li>
                    ))}
                    {scorecardEmployees.length === 0 && !scorecardLoading && (
                      <li className="px-3 py-4 text-sm text-gray-400">No employees found.</li>
                    )}
                  </ul>
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-x-auto">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Training outcomes</h3>
                {scorecardLoading && selectedScorecardEmpId ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : scorecardRows.length === 0 && selectedScorecardEmpId ? (
                  <p className="text-sm text-gray-400">No training attempts for this employee.</p>
                ) : !selectedScorecardEmpId ? (
                  <p className="text-sm text-gray-400">Select an employee to view outcomes.</p>
                ) : (
                  <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        {['Emp_ID', 'Employee_Name', 'Training_Name', 'Attempt_No', 'Score_Achieved', 'Required_Score', 'Status', 'Assessment_Date', 'Retake', 'Retake_Score', 'Retake_Date', 'Retake_Status', 'Final_Status'].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scorecardRows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/60">
                          <td className="px-3 py-2 whitespace-nowrap">{row.emp_id ?? '—'}</td>
                          <td className="px-3 py-2">{row.employee_name ?? '—'}</td>
                          <td className="px-3 py-2">{row.training_name ?? '—'}</td>
                          <td className="px-3 py-2">{row.attempt_no ?? '—'}</td>
                          <td className="px-3 py-2">{row.score_achieved != null ? row.score_achieved : '—'}</td>
                          <td className="px-3 py-2">{row.required_score ?? '—'}</td>
                          <td className="px-3 py-2">{row.status ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.assessment_date ? formatDateDDMMMYYYY(row.assessment_date.split('T')[0]) : '—'}</td>
                          <td className="px-3 py-2">{row.retake ?? '—'}</td>
                          <td className="px-3 py-2">{row.retake_score != null ? row.retake_score : '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.retake_date ? formatDateDDMMMYYYY(row.retake_date.split('T')[0]) : '—'}</td>
                          <td className="px-3 py-2">{row.retake_status ?? '—'}</td>
                          <td className="px-3 py-2 font-medium">{row.final_status ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
          )}

          {/* HR Module: 5 sub-tabs (Capability List, Assessment, Role Map, Suggestion, Schedule) */}
          {activeTab === 'HR' && <HRModule />}

          {/* Management: Pending training schedules — Approve / Reject */}
          {activeTab === 'management' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Pending Training Schedules</h2>
              <p className="text-xs text-gray-500 mt-1">training_schedule where approvalStatus = Pending</p>
            </div>
            <div className="overflow-x-auto">
              {pendingSchedulesLoading ? (
                <p className="px-5 py-4 text-sm text-gray-500">Loading…</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Training ID</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Suggestion</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Department</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Trainer</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Dates</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingSchedules.map((s: any) => (
                      <tr key={s._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{s._id}</td>
                        <td className="px-4 py-3">{typeof s.trainingSuggestionId === 'object' && s.trainingSuggestionId?.capabilityId ? (s.trainingSuggestionId.capabilityId?.capabilityName || '—') : '—'}</td>
                        <td className="px-4 py-3">{(s.assignedEmployees || []).map((e: any) => e?.department).filter(Boolean)[0] || '—'}</td>
                        <td className="px-4 py-3">{typeof s.trainerId === 'object' && s.trainerId ? s.trainerId.full_name : s.trainerId || '—'}</td>
                        <td className="px-4 py-3">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'} – {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 flex gap-2">
                          {rolePermissions.approve && (
                            <>
                              <button onClick={async () => { try { await api.post(`/training-schedule/${s._id}/approve`); loadPendingSchedules(); } catch (err: any) { setError(err.response?.data?.error || 'Approve failed'); } }} className="text-green-600 hover:underline font-medium">Approve</button>
                              <button onClick={async () => { try { await api.post(`/training-schedule/${s._id}/reject`); loadPendingSchedules(); } catch (err: any) { setError(err.response?.data?.error || 'Reject failed'); } }} className="text-red-600 hover:underline font-medium">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!pendingSchedulesLoading && pendingSchedules.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-500">No pending schedules.</p>
              )}
            </div>
          </section>
          )}

          {/* Phase 1 Table (legacy – not shown for HR or Management) */}
          {activeTab !== 'employee' && activeTab !== 'scorecard' && activeTab !== 'trainer' && activeTab !== 'HR' && activeTab !== 'management' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Phase 1 — Capability Assignment & Topic Suggestion</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Assign capabilities and propose training topics</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">{phase1Rows.length} record(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    {['Training ID', 'Departments', 'Designation', 'Type', 'Level', 'Capabilities', 'Selected Topic', 'Approval', 'Actions'].map(h => (
                      <th key={h} className="text-left px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {phase1Rows.map(t => (
                    <tr key={t._id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{t.trainingId || '—'}</td>
                      <td className="px-4 py-3">{(t.phase1?.departments || []).join(', ') || 'All'}</td>
                      <td className="px-4 py-3">{t.phase1?.designation || '—'}</td>
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
                            <button onClick={() => openEditPhase1(t)} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors" title="Edit Phase 1">
                              <Edit size={16} />
                            </button>
                          )}
                          {rolePermissions.edit && t.approval?.status === 'Pending' && (
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
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                              title="Archive"
                            >
                              <Archive size={16} />
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
                    <tr><td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText size={32} className="text-gray-300" />
                        <span className="text-sm text-gray-400">{loading ? 'Loading…' : 'No Phase 1 requests yet.'}</span>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {/* Phase 2 Table (legacy – not shown for HR or Management) */}
          {activeTab !== 'employee' && activeTab !== 'scorecard' && activeTab !== 'trainer' && activeTab !== 'HR' && activeTab !== 'management' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Award size={20} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Phase 2 — Training Details</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Manage training content and assessment setup</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">{phase2Rows.length} record(s)</span>
            </div>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-gray-500" />
                <span className="font-semibold text-gray-700">Filters:</span>
              </div>
              <label className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-700 font-medium">Quarter</span>
                <select
                  value={filterQuarter}
                  onChange={e => setFilterQuarter(e.target.value === 'all' ? 'all' : Number(e.target.value) as 1 | 2 | 3 | 4)}
                  className="border-0 bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="1">Q1 (Jan–Mar)</option>
                  <option value="2">Q2 (Apr–Jun)</option>
                  <option value="3">Q3 (Jul–Sep)</option>
                  <option value="4">Q4 (Oct–Dec)</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-700 font-medium">Year</span>
                <select
                  value={filterYear}
                  onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="border-0 bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                  <option value="all">All</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-700 font-medium">Archived</span>
                <select
                  value={filterArchived}
                  onChange={e => setFilterArchived(e.target.value as 'no' | 'yes' | 'all')}
                  className="border-0 bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    {['Training ID', 'Training Topic', 'Type', 'Capabilities Covered', 'Description', 'Priority', 'Trainer', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {phase2Rows.map(t => (
                    <tr key={t._id} className="hover:bg-green-50/50 transition-colors border-b border-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{t.trainingId || '—'}</td>
                      <td className="px-6 py-4 font-medium text-gray-800">{t.phase2?.trainingTopic || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${typePill(t.phase2?.type || t.phase1.trainingType)}`}>
                          {t.phase2?.type || t.phase1.trainingType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {(t.phase2?.capabilitiesCovered || []).slice(0, 3).map((c, i) => (
                            <span key={i} className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-lg text-xs font-medium">{c}</span>
                          ))}
                          {(t.phase2?.capabilitiesCovered || []).length > 3 && <span className="text-xs text-gray-500 font-medium">+{(t.phase2?.capabilitiesCovered || []).length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-md truncate">{t.phase2?.description || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          t.phase2?.priority === 'P1' ? 'bg-red-100 text-red-800' :
                          t.phase2?.priority === 'P2' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {t.phase2?.priority || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{trainerDisplay(t)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          displayStatus(t) === 'Completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                          displayStatus(t) === 'Scheduled' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          displayStatus(t) === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          displayStatus(t) === 'Rejected' ? 'bg-red-100 text-red-800 border border-red-200' :
                          displayStatus(t) === 'Archived' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                          'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        }`}>
                          {displayStatus(t)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {rolePermissions.edit && (
                            <button onClick={() => openEditPhase2(t)} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors" title="Edit Phase 2">
                              <Edit size={16} />
                            </button>
                          )}
                          {rolePermissions.approve &&
                            t.approval?.status === 'Approved' &&
                            !t.scheduledDate && (
                              <button
                                onClick={() => { setScheduleId(t._id); setScheduleDate(''); }}
                                className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Calendar size={12} />
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
                    <tr><td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Award size={32} className="text-gray-300" />
                        <span className="text-sm text-gray-400">{loading ? 'Loading…' : 'No Phase 2 trainings yet.'}</span>
                      </div>
                    </td></tr>
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
                  View uploaded content for approved trainings and submit feedback after attending. Feedback must be submitted within 5 hours of the session (score impact: submitted = 0, not submitted = -1). Assessment is available in this phase; max 2 attempts per training.
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

            {/* My assigned trainings (new flow): training_schedule + materials + feedback (only when Completed & within 5h) */}
            {feedbackForm.employeeId && employeeSchedulesNew.length > 0 && (
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">My assigned trainings (schedule)</h3>
                <div className="space-y-3">
                  {employeeSchedulesNew.map((s: any) => {
                    const mats = employeeMaterialsBySchedule[s._id] || [];
                    const canSubmit = feedbackCanSubmit[s._id];
                    return (
                      <div key={s._id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">
                            {typeof s.trainingSuggestionId === 'object' && (s.trainingSuggestionId as any)?.capabilityId ? (s.trainingSuggestionId as any).capabilityId?.capabilityName : 'Training'}
                          </span>
                          <span className="text-xs text-gray-500">{s.startDate ? new Date(s.startDate).toLocaleDateString() : ''} – {s.endDate ? new Date(s.endDate).toLocaleDateString() : ''} · {s.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs mb-2">
                          {mats.map((m: any) => (
                            <span key={m._id}>
                              {m.contentFile && <a href={m.contentFile} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Content</a>}
                              {m.contentFile && m.videoUrl && ' · '}
                              {m.videoUrl && <a href={m.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Video</a>}
                              {m.assessmentId && ' · Assessment linked'}
                            </span>
                          ))}
                          {mats.length === 0 && <span className="text-gray-400">No materials yet.</span>}
                        </div>
                        {can('trainingFeedback', 'create') && (
                          <button
                            onClick={() => setEmployeeFeedbackScheduleId(s._id)}
                            disabled={!canSubmit}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${canSubmit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                          >
                            {canSubmit ? 'Submit feedback' : 'Feedback available only when training is Completed and within 5 hours of end'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                            <button
                              onClick={() => {
                                setAssessmentTrainingId(t._id);
                                setAssessmentAnswers({});
                                loadAssessmentAttempts(t._id);
                              }}
                              className="text-blue-600 hover:text-blue-800 underline text-xs"
                            >
                              Take Assessment
                            </button>
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
                                <button
                                  onClick={() => {
                                    setAssessmentTrainingId(t._id);
                                    setAssessmentAnswers({});
                                    loadAssessmentAttempts(t._id);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 underline text-xs"
                                >
                                  Take Assessment
                                </button>
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
                    <label className="block mb-1 font-medium text-gray-700">Employee Name</label>
                    <select
                      value={feedbackForm.employeeId}
                      onChange={e => {
                        const emp = employees.find(x => x._id === e.target.value);
                        setFeedbackForm(prev => ({
                          ...prev,
                          employeeId: emp ? emp._id : '',
                          name: emp ? emp.full_name : '',
                          department: emp ? emp.department : prev.department,
                        }));
                      }}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="">-- Select employee --</option>
                      {employees.map(emp => (
                        <option key={emp._id} value={emp._id}>
                          {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium text-gray-700">Training</label>
                    <select
                      value={feedbackForm.trainingId}
                      onChange={e => setFeedbackForm(prev => ({ ...prev, trainingId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="">-- Select training --</option>
                      {approvedForPhase2.map(t => (
                        <option key={t._id} value={t._id}>
                          {t.trainingId} — {t.phase2?.trainingTopic || t.phase1.selectedTopic}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Only approved trainings are listed here.
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

          {/* Trainer View: Content Upload Only */}
          {activeTab === 'trainer' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Upload size={20} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">My Trainings — Content Upload</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upload training content (PDF, Video, Assessment Link) for your assigned trainings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-500" />
                <select
                  value={currentTrainerId || ''}
                  onChange={e => setCurrentTrainerId(e.target.value || null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">-- Select trainer --</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-6">
              {!currentTrainerId ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Please select a trainer to view assigned trainings</p>
                </div>
              ) : trainerTrainings.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No trainings assigned to you yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trainerTrainings.map(t => (
                    <div key={t._id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-white">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 mb-1">{t.phase2?.trainingTopic || t.phase1.selectedTopic}</h3>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            <span className="px-2 py-0.5 bg-gray-100 rounded">ID: {t.trainingId}</span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded">{t.phase1.trainingType}</span>
                            {(t.phase1.departments || []).length > 0 && (
                              <span className="px-2 py-0.5 bg-gray-100 rounded">{(t.phase1.departments || []).join(', ')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs">
                          <FileText size={14} className={`${t.phase2?.contentPdfLink ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={t.phase2?.contentPdfLink ? 'text-green-700 font-medium' : 'text-gray-500'}>
                            {t.phase2?.contentPdfLink ? 'Content PDF uploaded' : 'Content PDF not uploaded'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Video size={14} className={`${t.phase2?.videoLink ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={t.phase2?.videoLink ? 'text-green-700 font-medium' : 'text-gray-500'}>
                            {t.phase2?.videoLink ? 'Video uploaded' : 'Video not uploaded'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <FileCheck size={14} className={`${t.phase2?.assessmentLink ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={t.phase2?.assessmentLink ? 'text-green-700 font-medium' : 'text-gray-500'}>
                            {t.phase2?.assessmentLink ? 'Assessment link added' : 'Assessment link not added'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setTrainerContentTrainingId(t._id);
                          setTrainerContentForm({
                            contentPdfLink: t.phase2?.contentPdfLink || '',
                            videoLink: t.phase2?.videoLink || '',
                            assessmentLink: t.phase2?.assessmentLink || '',
                          });
                        }}
                        className="w-full px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload size={16} />
                        Upload Content
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New flow: Training Schedule Materials — assessment from pool */}
              {can('trainingMaterials', 'create') && currentTrainerId && trainerSchedulesNew.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Training Schedule Materials (assessment from pool)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trainerSchedulesNew.map((s: any) => (
                      <div key={s._id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{typeof s.trainingSuggestionId === 'object' && (s.trainingSuggestionId as any)?.capabilityId ? (s.trainingSuggestionId as any).capabilityId?.capabilityName : 'Schedule'}</p>
                            <p className="text-xs text-gray-500">{s.startDate ? new Date(s.startDate).toLocaleDateString() : ''} – {s.endDate ? new Date(s.endDate).toLocaleDateString() : ''}</p>
                          </div>
                          <button
                            onClick={() => { setTrainerMaterialScheduleId(s._id); setTrainerMaterialForm({ contentFile: '', videoUrl: '', assessmentId: '' }); }}
                            className="px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >
                            Upload Material
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
          )}

          {/* Trainer: Upload Material modal (new flow — assessment from pool) */}
          {trainerMaterialScheduleId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Upload Training Material</h3>
                <p className="text-xs text-gray-500">Select assessment from existing pool. Content: PDF/doc link, Video URL.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content File (PDF/doc link)</label>
                  <input value={trainerMaterialForm.contentFile} onChange={e => setTrainerMaterialForm(prev => ({ ...prev, contentFile: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="URL or path" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                  <input value={trainerMaterialForm.videoUrl} onChange={e => setTrainerMaterialForm(prev => ({ ...prev, videoUrl: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assessment (from pool)</label>
                  <select value={trainerMaterialForm.assessmentId} onChange={e => setTrainerMaterialForm(prev => ({ ...prev, assessmentId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Select assessment —</option>
                    {capabilityAssessmentsList.map((a: any) => (
                      <option key={a._id} value={a._id}>
                        {(a.capabilityId?.capabilityName || a.capabilityId) || a._id} — {a.roleId} / {a.departmentId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setTrainerMaterialScheduleId(null); setTrainerMaterialForm({ contentFile: '', videoUrl: '', assessmentId: '' }); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={submitTrainerMaterialNew} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">Upload</button>
                </div>
              </div>
            </div>
          )}

          {/* Employee: Submit feedback modal (new flow) */}
          {employeeFeedbackScheduleId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Submit feedback</h3>
                <p className="text-xs text-gray-500">Only allowed when training status is Completed and within 5 hours of end time.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1–5)</label>
                  <select value={employeeFeedbackRating} onChange={e => setEmployeeFeedbackRating(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                  <textarea value={employeeFeedbackComments} onChange={e => setEmployeeFeedbackComments(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEmployeeFeedbackScheduleId(null); setEmployeeFeedbackRating(5); setEmployeeFeedbackComments(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={submitEmployeeFeedbackNew} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Submit</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

   
      {/* Phase 1 Modal */}
      {isPhase1Open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{phase1EditingId ? 'Edit Phase 1 Request' : 'New Phase 1 Request'}</h3>
              </div>
              <button onClick={() => setIsPhase1Open(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"><X size={20} /></button>
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
                      level: e.target.value !== 'Level Specific' ? '' : prev.level,
                      departments: (e.target.value === 'Generic' || e.target.value === 'Level Specific') ? [] : prev.departments,
                    }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="Generic">Generic (All departments)</option>
                    <option value="Dept Specific">Department specific</option>
                    <option value="Level Specific">Level specific</option>
                    <option value="Multi Dept">Multi department</option>
                  </select>
                </div>
              </div>
              {phase1Form.trainingType === 'Dept Specific' && (
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
              {phase1Form.trainingType === 'Level Specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    value={phase1Form.level}
                    onChange={e => setPhase1Form(prev => ({ ...prev, level: (e.target.value === '' ? '' : Number(e.target.value)) as 1 | 2 | 3 | '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="">-- Select level --</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                  </select>
                </div>
              )}
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
            <div className="px-6 py-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
              <button onClick={() => setIsPhase1Open(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Cancel</button>
              <button onClick={submitPhase1} disabled={loading} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
                {loading ? 'Saving…' : (
                  <>
                    <CheckCircle size={16} />
                    {phase1EditingId ? 'Update Phase 1' : 'Submit Phase 1'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 Modal */}
      {isPhase2Open && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200">
                <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Award size={20} className="text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{phase2EditingId ? 'Edit Phase 2 Training' : 'New Phase 2 Training'}</h3>
                  </div>
                  <button onClick={() => setIsPhase2Open(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"><X size={20} /></button>
                </div>
                <div className="px-6 py-6 space-y-5">
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
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Assessment Link (Google Form style)" />
                  </div>

                  {/* Phase 2 – Assessment Setup */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-800">Assessment Setup</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-gray-600">Add field:</span>
                      {(['text', 'mcq', 'checkbox', 'paragraph'] as const).map(typ => (
                        <button key={typ} type="button" onClick={() => addAssessmentField(typ)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-100 capitalize">
                          {typ}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {phase2Form.assessmentFields.map((f, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-600 capitalize">{f.type}</span>
                            <button type="button" onClick={() => removeAssessmentField(idx)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                          </div>
                          <input value={f.question} onChange={e => updateAssessmentField(idx, { question: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Question" />
                          {(f.type === 'mcq' || f.type === 'checkbox') && (
                            <div className="text-xs space-y-1.5">
                              <label className="font-medium text-gray-600 block">Options</label>
                              {(f.options || []).map((opt, optIdx) => (
                                <div key={optIdx} className="flex gap-1.5">
                                  <input value={opt} onChange={e => {
                                    const newOpts = [...(f.options || [])];
                                    newOpts[optIdx] = e.target.value;
                                    updateAssessmentField(idx, { options: newOpts });
                                  }} className="flex-1 border border-gray-300 rounded px-2 py-1" placeholder={`Option ${optIdx + 1}`} />
                                  <button type="button" onClick={() => {
                                    const newOpts = (f.options || []).filter((_, i) => i !== optIdx);
                                    updateAssessmentField(idx, { options: newOpts.length > 0 ? newOpts : [''] });
                                  }} className="text-red-500 hover:text-red-700 px-2">Remove</button>
                                </div>
                              ))}
                              <button type="button" onClick={() => updateAssessmentField(idx, { options: [...(f.options || []), ''] })} 
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Option</button>
                            </div>
                          )}
                          <input value={f.correctAnswer ?? ''} onChange={e => updateAssessmentField(idx, { correctAnswer: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Correct answer" />
                          {f.type === 'paragraph' && (
                            <div className="text-xs">
                              <label className="font-medium text-gray-600">Keywords (match any → correct)</label>
                              <input value={(f.keywords || []).join(', ')} onChange={e => updateAssessmentField(idx, { keywords: e.target.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean) })}
                                className="w-full border border-gray-300 rounded px-2 py-1 mt-0.5" placeholder="keyword1, keyword2" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Required score</label>
                      <select value={phase2Form.requiredScore === 'level' ? 'level' : (phase2Form.requiredScore === '' ? '' : String(phase2Form.requiredScore))} onChange={e => setPhase2Form(prev => ({ ...prev, requiredScore: e.target.value === 'level' ? 'level' : (e.target.value === '' ? '' : Number(e.target.value)) }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="level">Use level-based (from DB)</option>
                        {[60, 70, 75, 80, 85, 90, 100].map(n => (<option key={n} value={n}>{n}%</option>))}
                      </select>
                    </div>
                    
                    {/* Required Score Matrix for Multi-Dept/Level */}
                    {(() => {
                      const training = trainings.find(t => t._id === phase2Form.trainingMongoId);
                      const isMultiDept = training?.phase1.trainingType === 'Multi Dept';
                      const isLevelSpecific = training?.phase1.trainingType === 'Level Specific';
                      const trainingDepts = training?.phase1.departments || [];
                      const trainingLevel = training?.phase1.level;
                      const needsMatrix = isMultiDept || (isLevelSpecific && trainingDepts.length > 0);
                      
                      if (!needsMatrix) return null;
                      
                      return (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <h5 className="text-xs font-semibold text-purple-800 mb-2">Required Score Matrix (per Department/Level)</h5>
                          <div className="space-y-2">
                            {phase2Form.requiredScoreMatrix.map((matrix, idx) => (
                              <div key={idx} className="flex gap-2 items-center text-xs">
                                <select
                                  value={matrix.department}
                                  onChange={e => {
                                    const updated = [...phase2Form.requiredScoreMatrix];
                                    updated[idx] = { ...updated[idx], department: e.target.value };
                                    setPhase2Form(prev => ({ ...prev, requiredScoreMatrix: updated }));
                                  }}
                                  className="flex-1 border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="">-- Department --</option>
                                  {departments.map(d => (
                                    <option key={d._id} value={d.name}>{d.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={matrix.level}
                                  onChange={e => {
                                    const updated = [...phase2Form.requiredScoreMatrix];
                                    updated[idx] = { ...updated[idx], level: e.target.value === '' ? '' : Number(e.target.value) };
                                    setPhase2Form(prev => ({ ...prev, requiredScoreMatrix: updated }));
                                  }}
                                  className="w-24 border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="">-- Level --</option>
                                  <option value="1">Level 1</option>
                                  <option value="2">Level 2</option>
                                  <option value="3">Level 3</option>
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={matrix.requiredScore}
                                  onChange={e => {
                                    const updated = [...phase2Form.requiredScoreMatrix];
                                    updated[idx] = { ...updated[idx], requiredScore: e.target.value === '' ? '' : Number(e.target.value) };
                                    setPhase2Form(prev => ({ ...prev, requiredScoreMatrix: updated }));
                                  }}
                                  className="w-20 border border-gray-300 rounded px-2 py-1"
                                  placeholder="Score"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPhase2Form(prev => ({ ...prev, requiredScoreMatrix: prev.requiredScoreMatrix.filter((_, i) => i !== idx) }));
                                  }}
                                  className="text-red-500 hover:text-red-700 px-2"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setPhase2Form(prev => ({ ...prev, requiredScoreMatrix: [...prev.requiredScoreMatrix, { department: '', level: '', requiredScore: '' }] }));
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                            >
                              + Add Department/Level Score
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="px-6 py-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                  <button onClick={() => setIsPhase2Open(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Cancel</button>
                  <button onClick={submitPhase2} disabled={loading} className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
                    {loading ? 'Saving…' : (
                      <>
                        <CheckCircle size={16} />
                        {phase2EditingId ? 'Update Phase 2' : 'Submit Phase 2'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Schedule Modal — calendar with date format dd-mmm-yyyy */}
      {scheduleId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-purple-800">Schedule Training</h3>
            <p className="text-sm text-gray-600">Pick a date (format: dd-mmm-yyyy)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
              />
              {scheduleDate && (
                <p className="mt-2 text-sm text-gray-700 font-medium">
                  Selected: {formatDateDDMMMYYYY(scheduleDate)}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setScheduleId(null); setScheduleDate(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitSchedule}
                disabled={!scheduleDate || loading}
                className="px-5 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Submission Modal */}
      {assessmentTrainingId && (() => {
        const training = trainings.find(t => t._id === assessmentTrainingId);
        if (!training) return null;
        const fields = training.phase2?.assessmentFields || [];
        const latestAttempt = assessmentAttempts.length > 0 ? assessmentAttempts[assessmentAttempts.length - 1] : null;
        const canRetake = assessmentAttempts.length < 2 && (!latestAttempt || latestAttempt.status === 'Fail');
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto my-8">
              <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white z-10">
                <h3 className="text-lg font-bold text-gray-900">Assessment: {training.phase2?.trainingTopic || training.phase1.selectedTopic}</h3>
                <button onClick={() => { setAssessmentTrainingId(null); setAssessmentAnswers({}); }} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {!feedbackForm.employeeId ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">Please select your employee name in the feedback form first before taking the assessment.</p>
                  </div>
                ) : (
                  <>
                    {assessmentAttempts.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-1">Previous Attempts:</p>
                        {assessmentAttempts.map((att, i) => (
                          <p key={i} className="text-xs text-blue-700">
                            Attempt {att.attemptNo}: Score {att.score}% — {att.status} ({formatDateDDMMMYYYY(att.date.split('T')[0])})
                          </p>
                        ))}
                        {assessmentAttempts.length >= 2 && (
                          <p className="text-xs text-red-600 font-medium mt-2">Maximum 2 attempts reached. Final status: {latestAttempt?.status}</p>
                        )}
                      </div>
                    )}
                    {fields.length === 0 ? (
                      <p className="text-sm text-gray-500">No assessment fields configured for this training.</p>
                    ) : (
                  <>
                    {fields.map((field, idx) => (
                      <div key={idx} className="p-4 border border-gray-200 rounded-lg space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {idx + 1}. {field.question || `Question ${idx + 1}`}
                        </label>
                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={String(assessmentAnswers[idx] || '')}
                            onChange={e => setAssessmentAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Your answer"
                            disabled={assessmentAttempts.length >= 2}
                          />
                        )}
                        {field.type === 'mcq' && (
                          <div className="space-y-2">
                            {(field.options || []).map((opt, optIdx) => (
                              <label key={optIdx} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`q${idx}`}
                                  value={optIdx}
                                  checked={String(assessmentAnswers[idx]) === String(optIdx)}
                                  onChange={() => setAssessmentAnswers(prev => ({ ...prev, [idx]: String(optIdx) }))}
                                  disabled={assessmentAttempts.length >= 2}
                                  className="text-blue-600"
                                />
                                <span className="text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {field.type === 'checkbox' && (
                          <div className="space-y-2">
                            {(field.options || []).map((opt, optIdx) => (
                              <label key={optIdx} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Array.isArray(assessmentAnswers[idx]) ? assessmentAnswers[idx].includes(String(optIdx)) : false}
                                  onChange={e => {
                                    const current = Array.isArray(assessmentAnswers[idx]) ? assessmentAnswers[idx] : [];
                                    const updated = e.target.checked
                                      ? [...current, String(optIdx)]
                                      : current.filter(a => a !== String(optIdx));
                                    setAssessmentAnswers(prev => ({ ...prev, [idx]: updated }));
                                  }}
                                  disabled={assessmentAttempts.length >= 2}
                                  className="text-blue-600"
                                />
                                <span className="text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {field.type === 'paragraph' && (
                          <textarea
                            value={String(assessmentAnswers[idx] || '')}
                            onChange={e => setAssessmentAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Your answer"
                            disabled={assessmentAttempts.length >= 2}
                          />
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <button
                        onClick={() => { setAssessmentTrainingId(null); setAssessmentAnswers({}); }}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      {canRetake && (
                        <button
                          onClick={submitAssessment}
                          disabled={loading || fields.some((_, idx) => !assessmentAnswers[idx])}
                          className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                        >
                          {loading ? 'Submitting…' : assessmentAttempts.length === 0 ? 'Submit Assessment' : 'Retake Assessment'}
                        </button>
                      )}
                    </div>
                  </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Trainer Content Upload Modal (Simplified - Only Content) */}
      {trainerContentTrainingId && (() => {
        const training = trainings.find(t => t._id === trainerContentTrainingId);
        if (!training) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
              <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Upload size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Upload Content</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{training.phase2?.trainingTopic || training.phase1.selectedTopic}</p>
                  </div>
                </div>
                <button onClick={() => { setTrainerContentTrainingId(null); setTrainerContentForm({ contentPdfLink: '', videoLink: '', assessmentLink: '' }); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="px-6 py-6 space-y-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      Content PDF Link
                    </label>
                    <input
                      type="url"
                      value={trainerContentForm.contentPdfLink}
                      onChange={e => setTrainerContentForm(prev => ({ ...prev, contentPdfLink: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      placeholder="https://example.com/content.pdf"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Video size={16} className="text-red-600" />
                      Video Link
                    </label>
                    <input
                      type="url"
                      value={trainerContentForm.videoLink}
                      onChange={e => setTrainerContentForm(prev => ({ ...prev, videoLink: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FileCheck size={16} className="text-green-600" />
                      Assessment Link (Google Form style)
                    </label>
                    <input
                      type="url"
                      value={trainerContentForm.assessmentLink}
                      onChange={e => setTrainerContentForm(prev => ({ ...prev, assessmentLink: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      placeholder="https://forms.google.com/..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => { setTrainerContentTrainingId(null); setTrainerContentForm({ contentPdfLink: '', videoLink: '', assessmentLink: '' }); }}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitTrainerContent}
                    disabled={loading}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? 'Uploading…' : (
                      <>
                        <Upload size={16} />
                        Upload Content
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
