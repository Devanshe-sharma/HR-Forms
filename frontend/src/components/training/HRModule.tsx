import { useEffect, useState } from 'react';
import {
  List, Plus, X, Edit, Trash2, CheckCircle, FileText, Map, Lightbulb, Calendar,
} from 'lucide-react';
import axios from 'axios';
import { can, getRole, hrSubTabVisibility } from '../../config/rbac';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getApi() {
  const api = axios.create({ baseURL: API_BASE });
  api.interceptors.request.use((config) => {
    const role = getRole();
    if (role) config.headers['x-user-role'] = role;
    return config;
  });
  return api;
}

const api = getApi();

type HRSubTab = 'capabilityList' | 'capabilityAssessment' | 'capabilityRoleMap' | 'trainingSuggestion' | 'trainingSchedule';

interface Capability {
  _id: string;
  capabilityName: string;
  capabilityDescription: string;
  isGeneric: boolean;
  createdAt?: string;
}

interface CapabilityAssessmentRow {
  _id: string;
  capabilityId: { _id: string; capabilityName: string } | string;
  roleId: { _id: string; full_name: string; department?: string; designation?: string } | string; // employee ref
  departmentId: string; // department name
  departmentHead?: string;
  managementLevel?: number;
  requiredScore: number;
  maximumScore: number;
  scoreAchieved?: number | null;
  mandatory: boolean;
  assessmentLink: string;
  trainingMandatoryAfterTest?: boolean;
}

interface TrainingSuggestionRow {
  _id: string;
  capabilityId: { _id: string; capabilityName: string } | string;
  roleIds: any[]; // populated employees
  departmentIds: string[];
  trainingType: string;
  level: number;
  mandatory: boolean;
  scoreAchieved?: number | null;
  topicSuggestions?: string[];
  selectedTopics?: string[];
}

interface TrainingScheduleRow {
  _id: string;
  trainingSuggestionId: { _id: string; capabilityId?: { capabilityName: string } } | string;
  startDate: string;
  endDate: string;
  trainerId?: { full_name: string } | string | null;
  assignedEmployees?: { full_name: string }[];
  status: string;
  approvalStatus: string;
}

const MANAGEMENT_LEVELS = [
  { value: 1, label: '1 – Management' },
  { value: 2, label: '2 – Dept Head' },
  { value: 3, label: '3 – Department Manager' },
  { value: 4, label: '4 – Executive' },
];

const SUB_TABS: { key: HRSubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'capabilityList', label: 'Capability List', icon: <List size={16} /> },
  { key: 'capabilityAssessment', label: 'Capability Assessment', icon: <FileText size={16} /> },
  { key: 'capabilityRoleMap', label: 'Capability Role Map', icon: <Map size={16} /> },
  { key: 'trainingSuggestion', label: 'Training Suggestion', icon: <Lightbulb size={16} /> },
  { key: 'trainingSchedule', label: 'Training Schedule', icon: <Calendar size={16} /> },
];

export default function HRModule() {
  const visibility = hrSubTabVisibility();
  const firstVisible = SUB_TABS.find(t => visibility[t.key])?.key || 'capabilityRoleMap';
  const [hrSubTab, setHrSubTab] = useState<HRSubTab>(firstVisible);

  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [assessments, setAssessments] = useState<CapabilityAssessmentRow[]>([]);
  const [roleMapRows, setRoleMapRows] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<TrainingSuggestionRow[]>([]);
  const [schedules, setSchedules] = useState<TrainingScheduleRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [capForm, setCapForm] = useState({ capabilityName: '', capabilityDescription: '', isGeneric: false });
  const [capModalOpen, setCapModalOpen] = useState(false);
  const [capEditId, setCapEditId] = useState<string | null>(null);

  // ── Enhanced Assessment Form ──────────────────────────────────────────────
  const defaultAssessForm = {
    capabilityId: '',
    roleId: '',
    departmentId: '',
    departmentHead: '',       // auto-filled when role selected
    managementLevel: '' as number | '',
    requiredScore: 70,
    maximumScore: 100,
    scoreAchieved: '' as number | '',
    mandatory: false,
    assessmentLink: '',
    trainingMandatoryAfterTest: false,
  };
  const [assessForm, setAssessForm] = useState(defaultAssessForm);
  const [assessModalOpen, setAssessModalOpen] = useState(false);
  const [assessEditId, setAssessEditId] = useState<string | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const [suggestionForm, setSuggestionForm] = useState({
    capabilityId: '',
    // Primary "role" (single) per your spec
    roleId: '',
    scoreAchieved: '' as number | '',
    mandatory: false,
    trainingType: 'Generic' as 'Generic' | 'Department' | 'Level' | 'MultiDept',
    // Conditional selections based on training type
    roleIds: [] as string[], // for Department/MultiDept multi-role select (employeeIds)
    departmentId: '',
    departmentIds: [] as string[],
    level: 1,
    topicSuggestions: [] as string[],
    selectedTopics: [] as string[],
    topicInput: '',
  });
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [suggestionEditId, setSuggestionEditId] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    trainingSuggestionId: '',
    topics: [] as string[],
    startDate: '',
    endDate: '',
    trainerId: '',
    assignedEmployees: [] as string[],
  });
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const [departments, setDepartments] = useState<{ _id: string; department?: string; name?: string; dept_head_email?: string }[]>([]);
  const [designations, setDesignations] = useState<{ _id: string; designation?: string; name?: string; department?: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; full_name: string; designation?: string; department?: string; role?: string }[]>([]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadCapabilities = async () => {
    try { const res = await api.get('/capabilities'); setCapabilities(res.data?.data ?? []); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load capabilities'); }
  };
  const loadAssessments = async () => {
    try { const res = await api.get('/capability-assessment'); setAssessments(res.data?.data ?? []); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load assessments'); }
  };
  const loadRoleMap = async () => {
    try { const res = await api.get('/capability-role-map'); setRoleMapRows(res.data?.data ?? []); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load role map'); }
  };
  const loadSuggestions = async () => {
    try { const res = await api.get('/training-suggestions'); setSuggestions(res.data?.data ?? []); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load suggestions'); }
  };
  const loadSchedules = async () => {
    try { const res = await api.get('/training-schedule'); setSchedules(res.data?.data ?? []); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load schedules'); }
  };
  const loadDepartmentsDesignationsEmployees = async () => {
    try {
      const [dR, dsR, eR] = await Promise.all([api.get('/departments'), api.get('/designations'), api.get('/employees')]);
      setDepartments(dR.data?.data ?? []);
      setDesignations(dsR.data?.data ?? []);
      setEmployees(eR.data?.data ?? []);
    } catch (_) {}
  };

  useEffect(() => { loadDepartmentsDesignationsEmployees(); }, []);

  useEffect(() => {
    if (hrSubTab === 'capabilityList') loadCapabilities();
    if (hrSubTab === 'capabilityAssessment') { loadCapabilities(); loadAssessments(); }
    if (hrSubTab === 'capabilityRoleMap') loadRoleMap();
    if (hrSubTab === 'trainingSuggestion') { loadCapabilities(); loadAssessments(); loadSuggestions(); }
    if (hrSubTab === 'trainingSchedule') loadSchedules();
  }, [hrSubTab]);

  // ── Auto-fill dept head when roleId changes ───────────────────────────────
  const handleAssessRoleChange = (employeeId: string) => {
    const emp = employees.find(e => e._id === employeeId);
    const deptName = String(emp?.department || '').trim();
    const dept = deptName ? departments.find(d => (d.department ?? d.name ?? '') === deptName) : undefined;
    setAssessForm(prev => ({
      ...prev,
      roleId: employeeId,
      departmentId: deptName || prev.departmentId,
      departmentHead: (dept?.dept_head_email || prev.departmentHead || '').trim(),
    }));
  };

  const handleAssessDepartmentChange = (deptName: string) => {
    const dept = departments.find(d => (d.department ?? d.name ?? '') === deptName);
    setAssessForm(prev => ({
      ...prev,
      departmentId: deptName,
      departmentHead: String(dept?.dept_head_email || prev.departmentHead || '').trim(),
    }));
  };

  // ── Submit handlers ───────────────────────────────────────────────────────
  const submitCapability = async () => {
    if (!capForm.capabilityName.trim()) return setError('Capability name is required');
    setLoading(true); setError('');
    try {
      if (capEditId) { await api.patch(`/capabilities/${capEditId}`, capForm); }
      else { await api.post('/capabilities', capForm); }
      setCapModalOpen(false); setCapEditId(null);
      setCapForm({ capabilityName: '', capabilityDescription: '', isGeneric: false });
      loadCapabilities();
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  const submitAssessment = async () => {
    if (!assessForm.capabilityId || !assessForm.roleId || !assessForm.departmentId) return setError('Capability, Role, Department required');
    setLoading(true); setError('');
    try {
      const payload = {
        ...assessForm,
        managementLevel: assessForm.managementLevel === '' ? undefined : assessForm.managementLevel,
        scoreAchieved: assessForm.scoreAchieved === '' ? undefined : assessForm.scoreAchieved,
      };
      if (assessEditId) { await api.patch(`/capability-assessment/${assessEditId}`, payload); }
      else { await api.post('/capability-assessment', payload); }
      setAssessModalOpen(false); setAssessEditId(null);
      setAssessForm(defaultAssessForm);
      loadAssessments();
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  const submitSuggestion = async () => {
    if (!suggestionForm.capabilityId) return setError('Capability is required');
    setLoading(true); setError('');
    try {
      const payload: any = {
        capabilityId: suggestionForm.capabilityId,
        mandatory: Boolean(suggestionForm.mandatory),
        trainingType: suggestionForm.trainingType,
        level: suggestionForm.trainingType === 'Level' ? suggestionForm.level : undefined,
        topicSuggestions: suggestionForm.topicSuggestions,
        selectedTopics: suggestionForm.selectedTopics,
      };

      // role + score achieved
      if (suggestionForm.roleId) payload.roleIds = [suggestionForm.roleId];

      // conditional selectors
      if (suggestionForm.trainingType === 'Department') {
        payload.departmentIds = suggestionForm.departmentId ? [suggestionForm.departmentId] : [];
        payload.roleIds = suggestionForm.roleIds; // multi role select
      }
      if (suggestionForm.trainingType === 'MultiDept') {
        payload.departmentIds = suggestionForm.departmentIds;
        payload.roleIds = suggestionForm.roleIds;
      }
      if (suggestionForm.trainingType === 'Generic') {
        payload.departmentIds = [];
        payload.roleIds = [];
      }

      if (suggestionEditId) { await api.patch(`/training-suggestions/${suggestionEditId}`, payload); }
      else { await api.post('/training-suggestions', payload); }
      setSuggestionModalOpen(false); setSuggestionEditId(null);
      setSuggestionForm({
        capabilityId: '',
        roleId: '',
        scoreAchieved: '',
        mandatory: false,
        trainingType: 'Generic',
        roleIds: [],
        departmentId: '',
        departmentIds: [],
        level: 1,
        topicSuggestions: [],
        selectedTopics: [],
        topicInput: '',
      });
      loadSuggestions();
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  const submitSchedule = async () => {
    if (!scheduleForm.trainingSuggestionId || !scheduleForm.startDate || !scheduleForm.endDate) return setError('Suggestion, Start date, End date required');
    setLoading(true); setError('');
    try {
      await api.post('/training-schedule', { ...scheduleForm, trainerId: scheduleForm.trainerId || undefined, assignedEmployees: scheduleForm.assignedEmployees });
      setScheduleModalOpen(false);
      setScheduleForm({ trainingSuggestionId: '', topics: [], startDate: '', endDate: '', trainerId: '', assignedEmployees: [] });
      loadSchedules();
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  const canCapabilityCRUD = can('capabilities', 'create');
  const canAssessmentCRUD = can('capabilityAssessment', 'create');
  const canSuggestionCRUD = can('trainingSuggestions', 'create');
  const canScheduleCRUD = can('trainingSchedule', 'create');

  // ── Helper to resolve capability name from ID ─────────────────────────────
  const resolveCapabilityName = (id: string) => capabilities.find(c => c._id === id)?.capabilityName ?? id;

  // Resolve department head name from stored email (fallback to raw string)
  const resolveDeptHeadName = (deptHead: string | undefined | null) => {
    const value = (deptHead || '').trim();
    if (!value) return '—';
    const emp = employees.find(e => (e as any).official_email === value || (e as any).email === value);
    return emp?.full_name || value;
  };

  // For training suggestion: roles lacking a given capability (gap > 0)
  const lackingRolesForCapability = (capabilityId: string) => {
    if (!capabilityId) return [] as { roleId: string; label: string; scoreAchieved: number | null }[];
    const byRole: Record<string, { roleId: string; label: string; scoreAchieved: number | null }> = {};
    assessments.forEach(a => {
      const capId = String((a.capabilityId as any)?._id || a.capabilityId);
      if (capId !== String(capabilityId)) return;
      const required = Number(a.requiredScore ?? 0);
      const achieved = a.scoreAchieved != null ? Number(a.scoreAchieved) : null;
      if (achieved == null || achieved >= required) return;
      const roleId = String((a.roleId as any)?._id || a.roleId);
      const emp = employees.find(e => e._id === roleId);
      const name = emp?.full_name || roleId;
      const label = `${name} – Score ${achieved}/${required}`;
      byRole[roleId] = { roleId, label, scoreAchieved: achieved };
    });
    return Object.values(byRole);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {SUB_TABS.filter(t => visibility[t.key]).map((t) => (
          <button
            key={t.key}
            onClick={() => setHrSubTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hrSubTab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r text-sm">{error}</div>}

      {/* ── 1. Capability List ── */}
      {hrSubTab === 'capabilityList' && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">All Capability List (HR Only)</h2>
            {canCapabilityCRUD && (
              <button onClick={() => { setCapEditId(null); setCapForm({ capabilityName: '', capabilityDescription: '', isGeneric: false }); setCapModalOpen(true); }}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={16} /> Add Capability
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Capability Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Generic</th>
                  {canCapabilityCRUD && <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {capabilities.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{c.capabilityName}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{c.capabilityDescription || '—'}</td>
                    <td className="px-4 py-3">{c.isGeneric ? 'Yes' : 'No'}</td>
                    {canCapabilityCRUD && (
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => { setCapEditId(c._id); setCapForm({ capabilityName: c.capabilityName, capabilityDescription: c.capabilityDescription || '', isGeneric: c.isGeneric }); setCapModalOpen(true); }} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={async () => { try { await api.delete(`/capabilities/${c._id}`); loadCapabilities(); } catch (e: any) { setError(e.response?.data?.error || 'Delete failed'); } }} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 2. Capability Assessment ── */}
      {hrSubTab === 'capabilityAssessment' && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Capability Assessment (Head of Department)</h2>
            {canAssessmentCRUD && (
              <button onClick={() => { setAssessEditId(null); setAssessForm(defaultAssessForm); setAssessModalOpen(true); }}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={16} /> Add Assessment
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Capability</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Dept Head</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Mgmt Level</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Required</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Max</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Achieved</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Assessment</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Training Mandatory</th>
                  {canAssessmentCRUD && <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {assessments.map((a) => (
                  <tr key={a._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{typeof a.capabilityId === 'object' && a.capabilityId ? (a.capabilityId as any).capabilityName : resolveCapabilityName(a.capabilityId as string)}</td>
                    <td className="px-4 py-3">
                      {typeof a.roleId === 'object' && a.roleId
                        ? (a.roleId as any).full_name
                        : (() => {
                            const emp = employees.find(e => e._id === (a.roleId as string));
                            return emp?.full_name || (a.roleId as string);
                          })()}
                    </td>
                    <td className="px-4 py-3">{a.departmentId}</td>
                    <td className="px-4 py-3">{resolveDeptHeadName(a.departmentHead)}</td>
                    <td className="px-4 py-3">{a.managementLevel ? MANAGEMENT_LEVELS.find(m => m.value === a.managementLevel)?.label ?? a.managementLevel : '—'}</td>
                    <td className="px-4 py-3">{a.requiredScore}</td>
                    <td className="px-4 py-3">{a.maximumScore}</td>
                    <td className="px-4 py-3">{a.scoreAchieved != null ? a.scoreAchieved : '—'}</td>
                    <td className="px-4 py-3">
                      {a.assessmentLink
                        ? <a href={a.assessmentLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Open Form ↗</a>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.trainingMandatoryAfterTest ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {a.trainingMandatoryAfterTest ? 'Yes' : 'No'}
                      </span>
                    </td>
                    {canAssessmentCRUD && (
                      <td className="px-4 py-3 flex gap-2">
                        <button
                          onClick={() => {
                            setAssessEditId(a._id);
                            setAssessForm({
                              capabilityId: (a.capabilityId as any)?._id || a.capabilityId as string,
                              roleId: (a.roleId as any)?._id || (a.roleId as string),
                              departmentId: a.departmentId,
                              departmentHead: a.departmentHead ?? '',
                              managementLevel: a.managementLevel ?? '',
                              requiredScore: a.requiredScore,
                              maximumScore: a.maximumScore,
                              scoreAchieved: a.scoreAchieved ?? '',
                              mandatory: a.mandatory,
                              assessmentLink: a.assessmentLink || '',
                              trainingMandatoryAfterTest: a.trainingMandatoryAfterTest ?? false,
                            });
                            setAssessModalOpen(true);
                          }}
                          className="text-blue-600 hover:underline"
                        >Edit</button>
                        <button onClick={async () => { try { await api.delete(`/capability-assessment/${a._id}`); loadAssessments(); } catch (e: any) { setError(e.response?.data?.error || 'Delete failed'); } }} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 3. Capability Role Map ── */}
      {hrSubTab === 'capabilityRoleMap' && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Capability Role Map (View Only)</h2>
            <p className="text-xs text-gray-500 mt-1">Capability, Department, Dept Head, Mgmt Level, Required/Achieved/Gap, Training Required</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Capability</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Dept Head</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Mgmt Level</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Required Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Achieved</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Gap</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Training required?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roleMapRows.map((r, i) => (
                  <tr key={r._id || i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.capability}</td>
                    <td className="px-4 py-3">
                      {r.roleName ||
                        (() => {
                          const emp = employees.find(e => e._id === r.roleId);
                          return emp?.full_name || r.roleId || '—';
                        })()}
                    </td>
                    <td className="px-4 py-3">{r.department}</td>
                    <td className="px-4 py-3">{resolveDeptHeadName(r.deptHead)}</td>
                    <td className="px-4 py-3">{r.managementLevel ? MANAGEMENT_LEVELS.find(m => m.value === r.managementLevel)?.label ?? r.managementLevel : '—'}</td>
                    <td className="px-4 py-3">{r.requiredScore}</td>
                    <td className="px-4 py-3">{r.achievedScore ?? '—'}</td>
                    <td className="px-4 py-3">{r.gap ?? '—'}</td>
                    <td className="px-4 py-3">{r.trainingRequired || (r.mandatory ? 'Yes' : 'No')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 4. Training Suggestion ── */}
      {hrSubTab === 'trainingSuggestion' && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Training Suggestion (HR + HOD)</h2>
            {canSuggestionCRUD && (
              <button onClick={() => {
                setSuggestionEditId(null);
                setSuggestionForm({
                  capabilityId: '',
                  roleId: '',
                  scoreAchieved: '',
                  mandatory: false,
                  trainingType: 'Generic',
                  roleIds: [],
                  departmentId: '',
                  departmentIds: [],
                  level: 1,
                  topicSuggestions: [],
                  selectedTopics: [],
                  topicInput: '',
                });
                setSuggestionModalOpen(true);
              }}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={16} /> Add Suggestion
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Capability</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Score achieved</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Mandatory</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Departments</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Selected topics</th>
                  {canSuggestionCRUD && <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {suggestions.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{typeof s.capabilityId === 'object' && s.capabilityId ? (s.capabilityId as any).capabilityName : resolveCapabilityName(s.capabilityId as string)}</td>
                    <td className="px-4 py-3">
                      {Array.isArray(s.roleIds) && s.roleIds.length > 0
                        ? (() => {
                            const first = s.roleIds[0] as any;
                            if (first && typeof first === 'object' && first.full_name) return first.full_name;
                            const id = String(first);
                            const emp = employees.find(e => e._id === id);
                            return emp?.full_name || id;
                          })()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{s.scoreAchieved != null ? s.scoreAchieved : '—'}</td>
                    <td className="px-4 py-3">{s.mandatory ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">{s.trainingType}</td>
                    <td className="px-4 py-3">{(s.departmentIds || []).join(', ') || '—'}</td>
                    <td className="px-4 py-3">{Array.isArray(s.selectedTopics) ? s.selectedTopics.length : 0}</td>
                    {canSuggestionCRUD && (
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => {
                          setSuggestionEditId(s._id);
                          const roleIds = Array.isArray(s.roleIds) ? s.roleIds.map((r: any) => (r?._id ? String(r._id) : String(r))) : [];
                          setSuggestionForm({
                            capabilityId: (s.capabilityId as any)?._id || (s.capabilityId as string),
                            roleId: roleIds[0] || '',
                            scoreAchieved: (s.scoreAchieved ?? '') as any,
                            mandatory: Boolean(s.mandatory),
                            trainingType: (s.trainingType as any) || 'Generic',
                            roleIds,
                            departmentId: (Array.isArray(s.departmentIds) && s.departmentIds.length === 1) ? s.departmentIds[0] : '',
                            departmentIds: Array.isArray(s.departmentIds) ? s.departmentIds : [],
                            level: s.level || 1,
                            topicSuggestions: Array.isArray(s.topicSuggestions) ? s.topicSuggestions : [],
                            selectedTopics: Array.isArray(s.selectedTopics) ? s.selectedTopics : [],
                            topicInput: '',
                          });
                          setSuggestionModalOpen(true);
                        }} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={async () => { try { await api.delete(`/training-suggestions/${s._id}`); loadSuggestions(); } catch (e: any) { setError(e.response?.data?.error || 'Delete failed'); } }} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 5. Training Schedule ── */}
      {hrSubTab === 'trainingSchedule' && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Training Schedule (HR + HOD)</h2>
            {canScheduleCRUD && (
              <button onClick={() => { setScheduleForm({ trainingSuggestionId: '', topics: [], startDate: '', endDate: '', trainerId: '', assignedEmployees: [] }); setScheduleModalOpen(true); }}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={16} /> Add Schedule
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Suggestion</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">End</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Trainer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schedules.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{typeof s.trainingSuggestionId === 'object' && (s.trainingSuggestionId as any)?.capabilityId ? (s.trainingSuggestionId as any).capabilityId?.capabilityName : (s.trainingSuggestionId as any)?.capabilityId || '—'}</td>
                    <td className="px-4 py-3">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">{typeof s.trainerId === 'object' && s.trainerId ? (s.trainerId as any).full_name : s.trainerId || '—'}</td>
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3">{s.approvalStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* Capability Modal */}
      {capModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{capEditId ? 'Edit Capability' : 'Add Capability'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capability Name</label>
              <input value={capForm.capabilityName} onChange={e => setCapForm(prev => ({ ...prev, capabilityName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={capForm.capabilityDescription} onChange={e => setCapForm(prev => ({ ...prev, capabilityDescription: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Description" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={capForm.isGeneric} onChange={e => setCapForm(prev => ({ ...prev, isGeneric: e.target.checked }))} className="rounded border-gray-300 text-blue-600" />
              <label className="text-sm text-gray-700">Generic (Y/N)</label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCapModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitCapability} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assessment Modal (Enhanced) ── */}
      {assessModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{assessEditId ? 'Edit Assessment' : 'Add Assessment'}</h3>
              <button onClick={() => setAssessModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* ── Section: Identity ── */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Capability & Role</p>

              {/* Capability – auto from capability list */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability <span className="text-gray-400 font-normal text-xs">(from Capability List)</span>
                </label>
                <select
                  value={assessForm.capabilityId}
                  onChange={e => setAssessForm(prev => ({ ...prev, capabilityId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Capability</option>
                  {capabilities.map(c => <option key={c._id} value={c._id}>{c.capabilityName}</option>)}
                </select>
              </div>

              {/* Role – from employee master */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  role_id <span className="text-gray-400 font-normal text-xs">(from Employee Master)</span>
                </label>
                <select
                  value={assessForm.roleId}
                  onChange={e => handleAssessRoleChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Employee (role_id)</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.full_name}{emp.designation ? ` — ${emp.designation}` : ''}{emp.department ? ` · ${emp.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={assessForm.departmentId}
                  onChange={e => handleAssessDepartmentChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d._id} value={d.department ?? d.name ?? d._id}>{d.department ?? d.name ?? d._id}</option>)}
                </select>
              </div>

              {/* Department Head – auto-filled */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Head <span className="text-gray-400 font-normal text-xs">(auto-filled)</span>
                </label>
                <input
                  value={assessForm.departmentHead}
                  onChange={e => setAssessForm(prev => ({ ...prev, departmentHead: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-100 focus:bg-white focus:border-gray-300 transition"
                  placeholder="Auto-filled from department master…"
                />
              </div>

              {/* Management Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Management Level of Role</label>
                <select
                  value={assessForm.managementLevel}
                  onChange={e => setAssessForm(prev => ({ ...prev, managementLevel: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Level</option>
                  {MANAGEMENT_LEVELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {/* ── Section: Scores ── */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scores</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required Score</label>
                  <input
                    type="number" min={0}
                    value={assessForm.requiredScore}
                    onChange={e => setAssessForm(prev => ({ ...prev, requiredScore: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Score</label>
                  <input
                    type="number" min={0}
                    value={assessForm.maximumScore}
                    onChange={e => setAssessForm(prev => ({ ...prev, maximumScore: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Score Achieved</label>
                  <input
                    type="number" min={0}
                    value={assessForm.scoreAchieved}
                    onChange={e => setAssessForm(prev => ({ ...prev, scoreAchieved: e.target.value === '' ? '' : Number(e.target.value) }))}
                    placeholder="—"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ── Section: Assessment & Training ── */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessment & Training</p>

              {/* Google Form link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability Assessment Link
                  <span className="text-gray-400 font-normal text-xs ml-1">(Google Form URL)</span>
                </label>
                <input
                  value={assessForm.assessmentLink}
                  onChange={e => setAssessForm(prev => ({ ...prev, assessmentLink: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="https://forms.google.com/…"
                />
              </div>

              {/* Training mandatory after test */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Training Mandatory After Test?</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="trainingMandatory"
                      checked={assessForm.trainingMandatoryAfterTest === true}
                      onChange={() => setAssessForm(prev => ({ ...prev, trainingMandatoryAfterTest: true }))}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="trainingMandatory"
                      checked={assessForm.trainingMandatoryAfterTest === false}
                      onChange={() => setAssessForm(prev => ({ ...prev, trainingMandatoryAfterTest: false }))}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAssessModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitAssessment} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Modal */}
      {suggestionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">{suggestionEditId ? 'Edit Suggestion' : 'Add Suggestion'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capability</label>
              <select
                value={suggestionForm.capabilityId}
                onChange={e => {
                  const capabilityId = e.target.value;
                  const lacking = lackingRolesForCapability(capabilityId);
                  const first = lacking[0];
                  setSuggestionForm(prev => ({
                    ...prev,
                    capabilityId,
                    roleId: first?.roleId || '',
                    scoreAchieved: first?.scoreAchieved != null ? first.scoreAchieved : '',
                    // If there is at least one role with a gap, mark this suggestion as mandatory
                    mandatory: first ? true : prev.mandatory,
                  }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select Capability</option>
                {capabilities.map(c => <option key={c._id} value={c._id}>{c.capabilityName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role (all)</label>
              <select
                value={suggestionForm.roleId}
                onChange={e => {
                  const roleId = e.target.value;
                  // auto fetch score achieved from existing capability assessments (only for roles lacking this capability)
                  const assess = assessments.find(a =>
                    String((a.capabilityId as any)?._id || a.capabilityId) === String(suggestionForm.capabilityId) &&
                    String((a.roleId as any)?._id || a.roleId) === String(roleId)
                  );
                  setSuggestionForm(prev => ({
                    ...prev,
                    roleId,
                    scoreAchieved: assess?.scoreAchieved != null ? Number(assess.scoreAchieved) : '',
                    // mandatory yes when achieved < required for this role/capability
                    mandatory: assess && assess.scoreAchieved != null && assess.requiredScore != null
                      ? Number(assess.scoreAchieved) < Number(assess.requiredScore) || prev.mandatory
                      : prev.mandatory,
                  }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select Employee (lacking capability)</option>
                {lackingRolesForCapability(suggestionForm.capabilityId).map(opt => (
                  <option key={opt.roleId} value={opt.roleId}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score Achieved (fetch)</label>
              <input
                value={suggestionForm.scoreAchieved}
                readOnly
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-100"
                placeholder="Auto from capability assessment…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Training Type</label>
              <select
                value={suggestionForm.trainingType}
                onChange={e => {
                  const v = e.target.value as any;
                  setSuggestionForm(prev => ({
                    ...prev,
                    trainingType: v,
                    departmentId: v === 'Department' ? prev.departmentId : '',
                    departmentIds: v === 'MultiDept' ? prev.departmentIds : [],
                    roleIds: (v === 'Department' || v === 'MultiDept') ? prev.roleIds : [],
                  }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Generic">Generic (all dept)</option>
                <option value="Department">Department (one dept, multi role)</option>
                <option value="Level">Level (1–4)</option>
                <option value="MultiDept">Multi Dept (multi dept, multi role)</option>
              </select>
            </div>
            {suggestionForm.trainingType === 'Level' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <select value={suggestionForm.level} onChange={e => setSuggestionForm(prev => ({ ...prev, level: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>Level {n}</option>)}
                </select>
              </div>
            )}
            {suggestionForm.trainingType === 'Department' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department (one)</label>
                  <select value={suggestionForm.departmentId} onChange={e => setSuggestionForm(prev => ({ ...prev, departmentId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d._id} value={d.department ?? d.name ?? d._id}>{d.department ?? d.name ?? d._id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role (multi select)</label>
                  <select multiple value={suggestionForm.roleIds} onChange={e => setSuggestionForm(prev => ({ ...prev, roleIds: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.full_name}</option>)}
                  </select>
                </div>
              </>
            )}
            {suggestionForm.trainingType === 'MultiDept' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departments (multi)</label>
                  <select multiple value={suggestionForm.departmentIds} onChange={e => setSuggestionForm(prev => ({ ...prev, departmentIds: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {departments.map(d => <option key={d._id} value={d.department ?? d.name ?? d._id}>{d.department ?? d.name ?? d._id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roles (multi)</label>
                  <select multiple value={suggestionForm.roleIds} onChange={e => setSuggestionForm(prev => ({ ...prev, roleIds: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.full_name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={suggestionForm.mandatory} onChange={e => setSuggestionForm(prev => ({ ...prev, mandatory: e.target.checked }))} className="rounded border-gray-300 text-blue-600" />
              <label className="text-sm text-gray-700">Mandatory (Yes/No)</label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Training Topic Suggestions</label>
              <div className="flex gap-2">
                <input
                  value={suggestionForm.topicInput}
                  onChange={e => setSuggestionForm(prev => ({ ...prev, topicInput: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Add a topic suggestion"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = suggestionForm.topicInput.trim();
                    if (!v) return;
                    setSuggestionForm(prev => ({
                      ...prev,
                      topicSuggestions: Array.from(new Set([...(prev.topicSuggestions || []), v])),
                      topicInput: '',
                    }));
                  }}
                  className="px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(suggestionForm.topicSuggestions || []).map((t, idx) => (
                  <span key={idx} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs inline-flex items-center gap-1">
                    {t}
                    <button
                      type="button"
                      onClick={() => setSuggestionForm(prev => ({ ...prev, topicSuggestions: prev.topicSuggestions.filter((_, i) => i !== idx) }))}
                      className="text-emerald-700/70 hover:text-emerald-900"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Topic (multi)</label>
              <select
                multiple
                value={suggestionForm.selectedTopics}
                onChange={e => setSuggestionForm(prev => ({ ...prev, selectedTopics: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {(suggestionForm.topicSuggestions || []).map((t, idx) => (
                  <option key={idx} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setSuggestionModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitSuggestion} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Add Training Schedule</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Training Suggestion</label>
              <select
                value={scheduleForm.trainingSuggestionId}
                onChange={e => {
                  const id = e.target.value;
                  const s = suggestions.find(x => x._id === id);
                  setScheduleForm(prev => ({
                    ...prev,
                    trainingSuggestionId: id,
                    topics: Array.isArray((s as any)?.selectedTopics) ? (s as any).selectedTopics : [],
                  }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select Suggestion</option>
                {suggestions.map(s => (
                  <option key={s._id} value={s._id}>
                    {typeof s.capabilityId === 'object' && s.capabilityId ? (s.capabilityId as any).capabilityName : s.capabilityId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule topics (multi)</label>
              <select
                multiple
                value={scheduleForm.topics}
                onChange={e => setScheduleForm(prev => ({ ...prev, topics: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={!scheduleForm.trainingSuggestionId}
              >
                {(suggestions.find(x => x._id === scheduleForm.trainingSuggestionId) as any)?.selectedTopics?.map((t: string, i: number) => (
                  <option key={i} value={t}>{t}</option>
                )) || null}
              </select>
              <p className="text-xs text-gray-500 mt-1">Defaults from “Select Topic (multi)” in Training Suggestion.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trainer</label>
              <select value={scheduleForm.trainerId} onChange={e => setScheduleForm(prev => ({ ...prev, trainerId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select Trainer</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Employees (multi)</label>
              <select multiple value={scheduleForm.assignedEmployees} onChange={e => setScheduleForm(prev => ({ ...prev, assignedEmployees: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {employees.map(e => <option key={e._id} value={e._id}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={scheduleForm.startDate} onChange={e => setScheduleForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={scheduleForm.endDate} onChange={e => setScheduleForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setScheduleModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={submitSchedule} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}