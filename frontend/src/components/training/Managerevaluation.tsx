import { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { Plus, X, Save } from 'lucide-react'; // removed Edit, Trash2, Eye since we use text now
import { getRole, can } from '../../config/rbac';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

// ─── Types ───────────────────

interface Employee {
  _id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
}

interface ReviewPeriodEmployee {
  _id: string;
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  joining_date: string;
  months_in_service: number;
  level: number;
  review_status: string;
}

interface CapabilitySkill {
  _id: string;
  capabilitySkill: string;
  capabilityArea: string;
  capabilityId: string;
}

interface Evaluation {
  _id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  capabilitySkillId: string;
  capabilitySkill: string;
  capabilityArea: string;
  requiredScore: number;
  actualScore: number;
  scoreReason: string;
  isMandatory: boolean;
  mandatoryReason: string;
  gap: number;
  evaluatedBy: string;
  evaluatedAt: string;
  createdAt: string;
}

type EvaluationForm = {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  capabilitySkillId: string;
  requiredScore: number;
  actualScore: number;
  scoreReason: string;
  isMandatory: boolean;
  mandatoryReason: string;
};

const initialForm: EvaluationForm = {
  employeeId: '',
  employeeName: '',
  employeeRole: '',
  capabilitySkillId: '',
  requiredScore: 5,
  actualScore: 0,
  scoreReason: '',
  isMandatory: false,
  mandatoryReason: '',
};

const selectStyles = {
  control: (base: any) => ({
    ...base,
    borderColor: '#d1d5db',
    boxShadow: 'none',
    fontSize: '0.875rem',
    '&:hover': { borderColor: '#3b82f6' },
  }),
};

export default function ManagerEvaluation() {
  console.log('🚀 ManagerEvaluation component is mounting!');
  
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reviewPeriodEmployees, setReviewPeriodEmployees] = useState<ReviewPeriodEmployee[]>([]);
  const [skills, setSkills] = useState<CapabilitySkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<EvaluationForm>(initialForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEval, setEditingEval] = useState<Evaluation | null>(null);
  const [viewingEval, setViewingEval] = useState<Evaluation | null>(null);

  const canCreate = can('capabilityEvaluation', 'create');
  const canEdit   = can('capabilityEvaluation', 'update');
  const canDelete = can('capabilityEvaluation', 'delete');

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/capability-evaluations');
      setEvaluations(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      console.log('=== Loading employees...');
      const res = await api.get('/employees?lightweight=true');
      console.log('Employees API response:', res);
      if (res.data?.success) {
        console.log('Employees loaded:', res.data.data?.length || 0);
        setEmployees(res.data.data || []);
      } else {
        console.error('Employees API failed:', res.data);
      }
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    }
  };

  const loadReviewPeriodEmployees = async () => {
    try {
      const res = await api.get('/employees/review-period');
      if (res.data?.success) setReviewPeriodEmployees(res.data.data || []);
    } catch (err: any) {
      console.error('Failed to load review period employees:', err);
    }
  };

  const loadSkills = async () => {
    try {
      const res = await api.get('/capability-skills');
      setSkills(res.data?.data || []);
    } catch (err: any) {
      setError('Failed to load capability skills');
    }
  };

  useEffect(() => {
    console.log('=== Component mounting ===');
    console.log('Current role:', getRole());
    console.log('Can create:', canCreate);
    console.log('Can edit:', canEdit);
    console.log('Can delete:', canDelete);
    
    loadEvaluations();
    loadEmployees();
    loadReviewPeriodEmployees();
    loadSkills();
  }, []);

  const openModal = (ev?: Evaluation) => {
    if (ev) {
      setEditingEval(ev);
      setForm({
        employeeId: ev.employeeId,
        employeeName: ev.employeeName,
        employeeRole: ev.employeeRole,
        capabilitySkillId: ev.capabilitySkillId,
        requiredScore: ev.requiredScore,
        actualScore: ev.actualScore,
        scoreReason: ev.scoreReason || '',
        isMandatory: ev.isMandatory,
        mandatoryReason: ev.mandatoryReason || '',
      });
    } else {
      setEditingEval(null);
      setForm(initialForm);
    }
    setIsModalOpen(true);
    setError('');
  };

  const saveEvaluation = async () => {
    if (!form.employeeId)         return setError('Please select an employee');
    if (!form.capabilitySkillId)  return setError('Please select a capability skill');
    if (form.requiredScore < 1 || form.requiredScore > 10)
      return setError('Required score must be between 1 and 10');
    if (form.actualScore < 0 || form.actualScore > 10)
      return setError('Actual score must be between 0 and 10');
    if (!form.scoreReason.trim())
      return setError('Please provide a reason / basis for the actual score');
    if (form.isMandatory && !form.mandatoryReason.trim())
      return setError('Please explain why this skill is mandatory for the employee\'s role');

    setLoading(true);
    setError('');

    try {
      const selectedSkill = skills.find((s) => s._id === form.capabilitySkillId);
      const selectedEmp   = employees.find((e) => e._id === form.employeeId);

      const payload = {
        employeeId: form.employeeId,
        employeeName: selectedEmp?.name || form.employeeName || 'Unknown Employee',
        employeeRole: selectedEmp?.designation || form.employeeRole || 'Not Specified',
        capabilitySkillId: form.capabilitySkillId,
        capabilitySkill: selectedSkill?.capabilitySkill || '',
        capabilityArea: selectedSkill?.capabilityArea || '',
        requiredScore: form.requiredScore,
        actualScore: form.actualScore,
        scoreReason: form.scoreReason.trim(),
        isMandatory: form.isMandatory,
        mandatoryReason: form.isMandatory ? form.mandatoryReason.trim() : '',
        gap: form.actualScore - form.requiredScore,
      };

      if (editingEval) {
        await api.patch(`/capability-evaluations/${editingEval._id}`, payload);
      } else {
        await api.post('/capability-evaluations', payload);
      }

      await loadEvaluations();
      setIsModalOpen(false);
      setForm(initialForm);
      setEditingEval(null);
    } catch (err: any) {
      console.error('Save failed:', err.response?.data || err.message);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to save evaluation'
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteEvaluation = async (id: string) => {
    if (!window.confirm('Delete this evaluation?')) return;
    try {
      await api.patch(`/capability-evaluations/${id}`, { deleted: true });
      await loadEvaluations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete evaluation');
    }
  };

  // ── Options ───────────────────────────────────────────────────────────────────

  const employeeOptions = employees.map((e) => ({
    value: e._id,
    label: `${e.name}${e.designation ? ` — ${e.designation}` : ''}${e.department ? ` (${e.department})` : ''}`,
    name: e.name,
    designation: e.designation || '',
  }));

  const skillOptions = skills.map((s) => ({
    value: s._id,
    label: `${s.capabilitySkill} · ${s.capabilityArea}`,
  }));

  const selectedEmp   = employeeOptions.find((o) => o.value === form.employeeId)   || null;
  const selectedSkill = skillOptions.find((o) => o.value === form.capabilitySkillId) || null;

  // Debugging
  console.log('=== Component State ===');
  console.log('Employees count:', employees.length);
  console.log('Employee options count:', employeeOptions.length);
  console.log('Review period employees count:', reviewPeriodEmployees.length);
  console.log('Skills count:', skills.length);
  console.log('Evaluations count:', evaluations.length);
  console.log('Can create:', canCreate);

  const getGapColor = (gap: number) => {
  if (gap >= 0) {
    return 'bg-green-100 text-green-800';
  }
  return 'bg-red-100 text-red-800';
};

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-1">Manager Evaluation</h2>
        <p className="text-gray-400 text-sm">Evaluate employees on capability skills to identify skill gaps</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Review Period Employees Section */}
      {reviewPeriodEmployees.length > 0 && (
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              Employees in Review Period (Less than 6 months)
            </h3>
            <p className="text-blue-700 text-sm mb-4">
              These employees joined recently and are in their evaluation review period. Consider prioritizing their capability evaluations.
            </p>
            <div className="bg-white rounded-md border border-blue-200 overflow-hidden">
              <table className="min-w-full divide-y divide-blue-200">
                <thead className="bg-blue-50">
                  <tr>
                    {['Employee', 'Department', 'Designation', 'Joining Date', 'Months in Service', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-blue-100">
                  {reviewPeriodEmployees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-blue-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                          {emp.name}
                        </div>
                        <div className="text-xs text-gray-500">{emp.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{emp.department || 'Not specified'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{emp.designation || 'Not specified'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{emp.joining_date || 'Not specified'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full font-medium">
                          {emp.months_in_service} months
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                          {emp.review_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        {canCreate && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Evaluation
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Employee', 'Role', 'Capability Skill', 'Required', 'Actual', 'Gap', 'Mandatory', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {evaluations.map((ev) => (
              <tr key={ev._id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm font-medium text-gray-900">{ev.employeeName}</td>
                <td className="px-5 py-4 text-sm text-gray-500">{ev.employeeRole}</td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <div>{ev.capabilitySkill}</div>
                  <div className="text-xs text-gray-400">{ev.capabilityArea}</div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-900 text-center font-medium">{ev.requiredScore}</td>
                <td className="px-5 py-4 text-sm text-gray-900 text-center font-medium">{ev.actualScore}</td>
                <td className="px-5 py-4 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getGapColor(ev.gap)}`}>
                    {ev.gap >= 0 ? 'Met' : `Gap ${ev.gap}`}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  {ev.isMandatory ? (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Yes</span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">No</span>
                  )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewingEval(ev)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => openModal(ev)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => deleteEvaluation(ev._id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {evaluations.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-gray-400 text-sm">
                  No evaluations yet. Click "Add Evaluation" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mt-10 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingEval ? 'Edit Evaluation' : 'Add Evaluation'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <Select
                  options={employeeOptions}
                  value={selectedEmp}
                  onChange={(option: any) => {
                    setForm((p) => ({
                      ...p,
                      employeeId: option?.value || '',
                      employeeName: option?.name || '',
                      employeeRole: option?.designation || '',
                    }));
                  }}
                  placeholder="Search employee..."
                  isSearchable
                  isClearable
                  styles={selectStyles}
                  classNamePrefix="react-select"
                />
              </div>

              {/* Capability Skill */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capability Skill *</label>
                <Select
                  options={skillOptions}
                  value={selectedSkill}
                  onChange={(o) => setForm((p) => ({ ...p, capabilitySkillId: o?.value || '' }))}
                  placeholder="Search skill..."
                  isSearchable
                  isClearable
                  styles={selectStyles}
                  classNamePrefix="react-select"
                />
              </div>

              {/* Scores */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Score * <span className="text-xs text-gray-400">(1–10)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.requiredScore}
                    onChange={(e) => setForm((p) => ({ ...p, requiredScore: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Actual Score * <span className="text-xs text-gray-400">(0–10)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.actualScore}
                    onChange={(e) => setForm((p) => ({ ...p, actualScore: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Gap preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-500">Skill Gap:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getGapColor(form.actualScore - form.requiredScore)}`}>
                  {(form.actualScore - form.requiredScore) >= 0 ? 'Met' : `Gap ${form.actualScore - form.requiredScore}`}
                </span>
              </div>

              {/* Score Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Basis for Score *
                  <span className="ml-1 text-xs font-normal text-gray-400">(what observations / evidence support this score?)</span>
                </label>
                <textarea
                  value={form.scoreReason}
                  onChange={(e) => setForm((p) => ({ ...p, scoreReason: e.target.value }))}
                  rows={3}
                  placeholder="e.g., Employee demonstrated strong presentation skills in Q3 client meeting but struggled with data analysis tasks..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>

              {/* Mandatory */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isMandatory}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        isMandatory: e.target.checked,
                        mandatoryReason: e.target.checked ? p.mandatoryReason : '',
                      }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Mark as Mandatory</span>
                </label>
                <p className="text-xs text-gray-400 ml-5">
                  Flag this skill as mandatory for the employee's role. A reason is required.
                </p>

                {form.isMandatory && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Why is this skill mandatory? *
                    </label>
                    <textarea
                      value={form.mandatoryReason}
                      onChange={(e) => setForm((p) => ({ ...p, mandatoryReason: e.target.value }))}
                      rows={3}
                      placeholder="e.g., This skill is a core competency required for promotion..."
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm resize-none bg-orange-50/30"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveEvaluation}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingEval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mt-12 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Evaluation Details</h3>
              <button onClick={() => setViewingEval(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Employee</p>
                  <p className="text-sm text-gray-900">{viewingEval.employeeName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Role</p>
                  <p className="text-sm text-gray-900">{viewingEval.employeeRole}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Capability Skill</p>
                <p className="text-sm text-gray-900">{viewingEval.capabilitySkill}</p>
                <p className="text-xs text-gray-400">{viewingEval.capabilityArea}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xl font-bold text-blue-700">{viewingEval.requiredScore}</p>
                  <p className="text-xs text-blue-500">Required</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-700">{viewingEval.actualScore}</p>
                  <p className="text-xs text-gray-500">Actual</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${(viewingEval.gap >= 0) ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-xl font-bold ${(viewingEval.gap >= 0) ? 'text-green-700' : 'text-red-700'}`}>
                    {viewingEval.gap >= 0 ? 'Met' : viewingEval.gap}
                  </p>
                  <p className={`text-xs ${(viewingEval.gap >= 0) ? 'text-green-600' : 'text-red-600'}`}>
                    {viewingEval.gap >= 0 ? 'Gap closed' : 'needs improvement'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Basis for Score</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 leading-relaxed">
                  {viewingEval.scoreReason || <span className="text-gray-400 italic">No reason provided</span>}
                </p>
              </div>

              <div className={`rounded-lg p-3 ${viewingEval.isMandatory ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      viewingEval.isMandatory ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {viewingEval.isMandatory ? 'Mandatory' : 'Not Mandatory'}
                  </span>
                </div>
                {viewingEval.isMandatory && viewingEval.mandatoryReason && (
                  <>
                    <p className="text-xs font-medium text-orange-700 uppercase mb-1 mt-2">Why Mandatory</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{viewingEval.mandatoryReason}</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Evaluated By</p>
                  <p className="text-sm text-gray-900">{viewingEval.evaluatedBy}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Date</p>
                  <p className="text-sm text-gray-900">
                    {viewingEval.evaluatedAt
                      ? new Date(viewingEval.evaluatedAt).toLocaleDateString()
                      : new Date(viewingEval.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setViewingEval(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}