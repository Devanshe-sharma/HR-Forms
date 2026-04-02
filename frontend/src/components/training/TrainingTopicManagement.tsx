import { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { Plus, X, Edit, Trash2, Save, Eye, Calendar } from 'lucide-react';
import { getRole, can } from '../../config/rbac';

const API_BASE = process.env.API_BASE_URL || 'http://3.109.132.204:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS = [
  { value: '1', label: '1 — Strategic' },
  { value: '2', label: '2 — Sr Management' },
  { value: '3', label: '3 — Middle Management' },
  { value: '4', label: '4 — Junior Management' },
  { value: '5', label: '5 — Staff' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapabilityArea {
  _id: string;
  capabilityAreaId: string;
  capabilityArea: string;
}

interface CapabilitySkill {
  _id: string;
  capabilityId: string;
  capabilitySkill: string;
  isGeneric: boolean;
  capabilityArea: string;
}

interface Department {
  _id: string;
  department: string; // field name from Department model
}

interface Designation {
  _id: string;
  designation: string; // field name from Designation model
}

interface Employee {
  name: string;
  dept: string;
  desig: string;
  email: string;
  score: number;
}

interface TrainingTopic {
  _id: string;
  trainingId: string;
  trainingName: string;
  trainerName: string;
  capabilityArea: string;
  capabilitySkill: string;
  type: 'Generic' | 'Dept Specific' | 'Level Specific' | 'Role Specific';
  isGeneric: boolean;
  proposedScheduleDate: string;
  targetLevels?: string[];
  targetRoles?: string[];       // stores designation _ids
  targetDepartments?: string[]; // stores department _ids
  status: 'Draft' | 'Pending Approval';
  createdAt: string;
  createdBy: string;
}

type TrainingTopicForm = {
  trainingId: string;
  trainingName: string;
  trainerName: string;
  capabilityAreaId: string;
  capabilitySkillId: string;
  type: 'Generic' | 'Dept Specific' | 'Level Specific' | 'Role Specific';
  isGeneric: boolean;
  proposedScheduleDate: string;
  targetLevels: string[];
  targetRoles: string[];       // designation _ids
  targetDepartments: string[]; // department _ids
  status: 'Draft' | 'Pending Approval';
};

const initialTrainingTopicForm: TrainingTopicForm = {
  trainingId: '',
  trainingName: '',
  trainerName: '',
  capabilityAreaId: '',
  capabilitySkillId: '',
  type: 'Generic',
  isGeneric: true,
  proposedScheduleDate: '',
  targetLevels: [],
  targetRoles: [],
  targetDepartments: [],
  status: 'Draft',
};

// ─── Shared react-select styles ───────────────────────────────────────────────

const multiSelectStyles = {
  control: (base: any) => ({
    ...base,
    borderColor: '#d1d5db',
    boxShadow: 'none',
    fontSize: '0.875rem',
    '&:hover': { borderColor: '#3b82f6' },
  }),
  multiValue: (base: any) => ({ ...base, backgroundColor: '#eff6ff' }),
  multiValueLabel: (base: any) => ({ ...base, color: '#1d4ed8', fontSize: '0.75rem' }),
  multiValueRemove: (base: any) => ({
    ...base, color: '#3b82f6',
    '&:hover': { backgroundColor: '#bfdbfe', color: '#1e40af' },
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainingTopicManagement() {
  const [trainingTopics, setTrainingTopics]     = useState<TrainingTopic[]>([]);
  const [capabilityAreas, setCapabilityAreas]   = useState<CapabilityArea[]>([]);
  const [capabilitySkills, setCapabilitySkills] = useState<CapabilitySkill[]>([]);
  const [departments, setDepartments]           = useState<Department[]>([]);
  const [designations, setDesignations]         = useState<Designation[]>([]);
  const [employees, setEmployees]               = useState<Employee[]>([]);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState('');

  const [trainingTopicForm, setTrainingTopicForm]     = useState<TrainingTopicForm>(initialTrainingTopicForm);
  const [isModalOpen, setIsModalOpen]                 = useState(false);
  const [editingTopic, setEditingTopic]               = useState<TrainingTopic | null>(null);
  const [viewingTopic, setViewingTopic]               = useState<TrainingTopic | null>(null);
  const [generatedTrainingId, setGeneratedTrainingId] = useState('');

  const canCreate = can('trainingSuggestions', 'create') || can('training', 'create');
  const canEdit   = can('trainingSuggestions', 'update') || can('training', 'update');
  const canDelete = can('trainingSuggestions', 'delete') || can('training', 'delete');

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadTrainingTopics = async () => {
    try {
      const res = await api.get('/training-topics');
      setTrainingTopics(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load training topics');
    }
  };

  const loadCapabilityAreas = async () => {
    try {
      const res = await api.get('/capability-areas');
      setCapabilityAreas(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load capability areas');
    }
  };

  const loadCapabilitySkills = async () => {
    try {
      const res = await api.get('/capability-skills');
      setCapabilitySkills(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load capability skills');
    }
  };

  const loadDepartments = async () => {
    try {
      // GET /departments → { success, data: [{ _id, department, ... }] }
      const res = await api.get('/departments');
      setDepartments(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadDesignations = async () => {
    try {
      // GET /designations → { success, data: [{ _id, designation, ... }] }
      const res = await api.get('/designations');
      setDesignations(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load designations:', err);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees?lightweight=true');
      if (res.data?.success) setEmployees(res.data.data || []);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    }
  };

  useEffect(() => {
    loadTrainingTopics();
    loadCapabilityAreas();
    loadCapabilitySkills();
    loadDepartments();
    loadDesignations();
    loadEmployees();
  }, []);

  // ── Modal ─────────────────────────────────────────────────────────────────────

  const generateTrainingId = (): string =>
    String(trainingTopics.length + 1).padStart(3, '0');

  const openModal = (topic?: TrainingTopic) => {
    if (topic) {
      setEditingTopic(topic);
      setGeneratedTrainingId(String(topic.trainingId));
      setTrainingTopicForm({
        trainingId:           String(topic.trainingId),
        trainingName:         topic.trainingName,
        trainerName:          topic.trainerName,
        capabilityAreaId:     capabilityAreas.find(ca => ca.capabilityArea === topic.capabilityArea)?._id || '',
        capabilitySkillId:    capabilitySkills.find(cs => cs.capabilitySkill === topic.capabilitySkill)?._id || '',
        type:                 topic.type,
        isGeneric:            topic.isGeneric,
        proposedScheduleDate: topic.proposedScheduleDate,
        targetLevels:         topic.targetLevels      || [],
        targetRoles:          topic.targetRoles       || [],
        targetDepartments:    topic.targetDepartments || [],
        status:               topic.status,
      });
    } else {
      setEditingTopic(null);
      const newId = generateTrainingId();
      setGeneratedTrainingId(newId);
      setTrainingTopicForm({ ...initialTrainingTopicForm, trainingId: newId });
    }
    setIsModalOpen(true);
    setError('');
  };

  const handleTypeChange = (newType: TrainingTopicForm['type']) => {
    setTrainingTopicForm(prev => ({
      ...prev,
      type:              newType,
      isGeneric:         newType === 'Generic',
      targetLevels:      [],
      targetRoles:       [],
      targetDepartments: [],
    }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveTrainingTopic = async () => {
    if (!trainingTopicForm.trainingName.trim())  return setError('Training Name is required');
    if (!trainingTopicForm.trainerName.trim())   return setError('Trainer Name is required');
    if (!trainingTopicForm.capabilityAreaId)     return setError('Please select a capability area');
    if (!trainingTopicForm.capabilitySkillId)    return setError('Please select a capability skill');
    if (!trainingTopicForm.proposedScheduleDate) return setError('Proposed Schedule Date is required');
    if (trainingTopicForm.type === 'Level Specific' && !trainingTopicForm.targetLevels.length)
      return setError('Please select at least one level');
    if (trainingTopicForm.type === 'Role Specific' && !trainingTopicForm.targetRoles.length)
      return setError('Please select at least one designation');
    if (trainingTopicForm.type === 'Dept Specific' && !trainingTopicForm.targetDepartments.length)
      return setError('Please select at least one department');

    setLoading(true);
    try {
      const selectedArea  = capabilityAreas.find(ca => ca._id === trainingTopicForm.capabilityAreaId);
      const selectedSkill = capabilitySkills.find(cs => cs._id === trainingTopicForm.capabilitySkillId);

      const payload: any = {
        trainingName:         trainingTopicForm.trainingName.trim(),
        trainerName:          trainingTopicForm.trainerName.trim(),
        capabilityArea:       selectedArea?.capabilityArea   || '',
        capabilitySkill:      selectedSkill?.capabilitySkill || '',
        type:                 trainingTopicForm.type,
        isGeneric:            trainingTopicForm.isGeneric,
        proposedScheduleDate: trainingTopicForm.proposedScheduleDate,
        status:               trainingTopicForm.status,
        // Send only the relevant targeting array; backend clears the others
        targetLevels:         trainingTopicForm.type === 'Level Specific' ? trainingTopicForm.targetLevels      : [],
        targetRoles:          trainingTopicForm.type === 'Role Specific'  ? trainingTopicForm.targetRoles       : [],
        targetDepartments:    trainingTopicForm.type === 'Dept Specific'  ? trainingTopicForm.targetDepartments : [],
      };

      if (editingTopic) {
        await api.patch(`/training-topics/${editingTopic._id}`, payload);
      } else {
        await api.post('/training-topics', payload);
      }

      await loadTrainingTopics();
      setIsModalOpen(false);
      setTrainingTopicForm(initialTrainingTopicForm);
      setEditingTopic(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save training topic');
    } finally {
      setLoading(false);
    }
  };

  // ── Other actions ─────────────────────────────────────────────────────────────

  const deleteTrainingTopic = async (id: string) => {
    if (!confirm('Are you sure you want to delete this training topic?')) return;
    try {
      await api.delete(`/training-topics/${id}`);
      await loadTrainingTopics();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete training topic');
    }
  };

  const submitForApproval = async (id: string) => {
    if (!confirm('Submit this training topic for approval?')) return;
    try {
      await api.patch(`/training-topics/${id}/submit-for-approval`);
      await loadTrainingTopics();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit for approval');
    }
  };

  // ── Computed helpers ──────────────────────────────────────────────────────────

  const filteredSkills = capabilitySkills.filter(
    s => s.capabilityId === trainingTopicForm.capabilityAreaId
  );

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Draft':            return 'bg-gray-100 text-gray-800';
      case 'Pending Approval': return 'bg-yellow-100 text-yellow-800';
      default:                 return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'Generic':        return 'bg-green-100 text-green-800';
      case 'Dept Specific':  return 'bg-blue-100 text-blue-800';
      case 'Level Specific': return 'bg-purple-100 text-purple-800';
      case 'Role Specific':  return 'bg-orange-100 text-orange-800';
      default:               return 'bg-gray-100 text-gray-800';
    }
  };

  // ── react-select option arrays ────────────────────────────────────────────────

  const trainerOptions = employees.map(e => ({
    value: e.name,
    label: `${e.name}${e.desig ? ` — ${e.desig}` : ''}${e.dept ? ` (${e.dept})` : ''}`,
  }));

  // Department options: value = _id, label = department name
  const departmentOptions = departments.map(d => ({
    value: d._id,
    label: d.department,
  }));

  // Role options built from designations: value = _id, label = designation name
  const roleOptions = designations.map(d => ({
    value: d._id,
    label: d.designation,
  }));

  // Controlled values for react-select
  const selectedTrainer     = trainerOptions.find(o => o.value === trainingTopicForm.trainerName) || null;
  const selectedLevels      = LEVELS.filter(l => trainingTopicForm.targetLevels.includes(l.value));
  const selectedDepartments = departmentOptions.filter(d => trainingTopicForm.targetDepartments.includes(d.value));
  const selectedRoles       = roleOptions.filter(r => trainingTopicForm.targetRoles.includes(r.value));

  // Human-readable targeting summary for table + view modal
  const targetingLabel = (topic: TrainingTopic): string => {
    if (topic.type === 'Generic') return 'All employees';

    if (topic.type === 'Level Specific' && topic.targetLevels?.length)
      return topic.targetLevels
        .map(v => LEVELS.find(l => l.value === v)?.label || `Level ${v}`)
        .join(', ');

    if (topic.type === 'Role Specific' && topic.targetRoles?.length)
      return topic.targetRoles
        .map(v => designations.find(d => d._id === v)?.designation || v)
        .join(', ');

    if (topic.type === 'Dept Specific' && topic.targetDepartments?.length)
      return topic.targetDepartments
        .map(v => departments.find(d => d._id === v)?.department || v)
        .join(', ');

    return '—';
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-2">Training Topic Management</h2>
        <p className="text-gray-400 text-sm">Create and manage training topics before approval</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
      )}

      <div className="mb-4">
        {canCreate && (
          <button onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
            <Plus className="w-4 h-4" /> Create Training Topic
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['ID', 'Training Name', 'Capability Skill', 'Type', 'Target', 'Proposed Date', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trainingTopics.map(topic => (
              <tr key={topic._id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-500 font-mono">{topic.trainingId}</td>
                <td className="px-5 py-4 text-sm text-gray-900">{topic.trainingName}</td>
                <td className="px-5 py-4 text-sm text-gray-700">{topic.capabilitySkill}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(topic.type)}`}>{topic.type}</span>
                </td>
                <td className="px-5 py-4 text-xs text-gray-500 max-w-[160px] truncate" title={targetingLabel(topic)}>
                  {targetingLabel(topic)}
                </td>
                <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(topic.proposedScheduleDate).toLocaleDateString()}
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(topic.status)}`}>{topic.status}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => setViewingTopic(topic)} className="text-blue-600 hover:text-blue-800" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && topic.status === 'Draft' && (
                      <button onClick={() => openModal(topic)} className="text-green-600 hover:text-green-800" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && topic.status === 'Draft' && (
                      <button onClick={() => deleteTrainingTopic(topic._id)} className="text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {canCreate && topic.status === 'Draft' && (
                      <button onClick={() => submitForApproval(topic._id)} className="text-purple-600 hover:text-purple-800" title="Submit for Approval">
                        <Calendar className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {trainingTopics.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-gray-400 text-sm">
                  No training topics yet. Click "Create Training Topic" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mt-20 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingTopic ? 'Edit Training Topic' : 'Create Training Topic'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Training ID (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training ID</label>
                <div className="relative">
                  <input type="text" value={generatedTrainingId} readOnly
                    className={`w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-700 cursor-not-allowed font-mono text-sm
                      ${editingTopic ? 'border-gray-300' : 'border-indigo-200 bg-indigo-50/30'}`} />
                  {!editingTopic && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-500 font-medium">
                      auto-generated
                    </span>
                  )}
                </div>
              </div>

              {/* Training Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training Name *</label>
                <input type="text" value={trainingTopicForm.trainingName}
                  onChange={e => setTrainingTopicForm(p => ({ ...p, trainingName: e.target.value }))}
                  placeholder="e.g., Advanced Leadership Skills"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* Trainer (from employees) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trainer *</label>
                <Select
                  options={trainerOptions}
                  value={selectedTrainer}
                  onChange={o => setTrainingTopicForm(p => ({ ...p, trainerName: o?.value || '' }))}
                  placeholder="Search or select trainer..."
                  isSearchable isClearable
                  styles={multiSelectStyles}
                  classNamePrefix="react-select"
                />
              </div>

              {/* Capability Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capability Area *</label>
                <select value={trainingTopicForm.capabilityAreaId}
                  onChange={e => setTrainingTopicForm(p => ({ ...p, capabilityAreaId: e.target.value, capabilitySkillId: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">Select a capability area</option>
                  {capabilityAreas.map(a => (
                    <option key={a._id} value={a._id}>{a.capabilityArea}</option>
                  ))}
                </select>
              </div>

              {/* Capability Skill */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capability Skill *</label>
                <select value={trainingTopicForm.capabilitySkillId}
                  onChange={e => setTrainingTopicForm(p => ({ ...p, capabilitySkillId: e.target.value }))}
                  disabled={!trainingTopicForm.capabilityAreaId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Select a capability skill</option>
                  {filteredSkills.map(s => (
                    <option key={s._id} value={s._id}>{s.capabilitySkill}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select value={trainingTopicForm.type}
                  onChange={e => handleTypeChange(e.target.value as TrainingTopicForm['type'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="Generic">Generic</option>
                  <option value="Dept Specific">Dept Specific</option>
                  <option value="Level Specific">Level Specific</option>
                  <option value="Role Specific">Role Specific</option>
                </select>
              </div>

              {/* Proposed Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Schedule Date *</label>
                <input type="date" value={trainingTopicForm.proposedScheduleDate}
                  onChange={e => setTrainingTopicForm(p => ({ ...p, proposedScheduleDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={trainingTopicForm.status}
                  onChange={e => setTrainingTopicForm(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="Draft">Draft</option>
                  <option value="Pending Approval">Pending Approval</option>
                </select>
              </div>
            </div>

            {/* ── Conditional targeting — full width, shown below the 2-col grid ── */}

            {/* Level Specific */}
            {trainingTopicForm.type === 'Level Specific' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Levels *
                  <span className="ml-1 text-xs font-normal text-gray-400">(select one or more)</span>
                </label>
                <Select
                  isMulti
                  options={LEVELS}
                  value={selectedLevels}
                  onChange={opts =>
                    setTrainingTopicForm(p => ({ ...p, targetLevels: (opts as typeof LEVELS).map(o => o.value) }))
                  }
                  placeholder="Select levels..."
                  styles={multiSelectStyles}
                  classNamePrefix="react-select"
                />
                <p className="text-xs text-gray-400 mt-1">
                  1 — Strategic · 2 — Sr Management · 3 — Middle Management · 4 — Junior Management · 5 — Staff
                </p>
              </div>
            )}

            {/* Dept Specific — options from /departments (field: department) */}
            {trainingTopicForm.type === 'Dept Specific' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Departments *
                  <span className="ml-1 text-xs font-normal text-gray-400">(select one or more)</span>
                </label>
                <Select
                  isMulti
                  options={departmentOptions}
                  value={selectedDepartments}
                  onChange={opts =>
                    setTrainingTopicForm(p => ({ ...p, targetDepartments: (opts as typeof departmentOptions).map(o => o.value) }))
                  }
                  placeholder="Select departments..."
                  styles={multiSelectStyles}
                  classNamePrefix="react-select"
                />
              </div>
            )}

            {/* Role Specific — options from /designations (field: designation) */}
            {trainingTopicForm.type === 'Role Specific' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Designations *
                  <span className="ml-1 text-xs font-normal text-gray-400">(select one or more)</span>
                </label>
                <Select
                  isMulti
                  options={roleOptions}
                  value={selectedRoles}
                  onChange={opts =>
                    setTrainingTopicForm(p => ({ ...p, targetRoles: (opts as typeof roleOptions).map(o => o.value) }))
                  }
                  placeholder="Select designations..."
                  styles={multiSelectStyles}
                  classNamePrefix="react-select"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={saveTrainingTopic} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {viewingTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Training Topic Details</h3>
              <button onClick={() => setViewingTopic(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Training ID</p>
                  <p className="text-sm text-gray-900 font-mono">{viewingTopic.trainingId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Status</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(viewingTopic.status)}`}>
                    {viewingTopic.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Training Name</p>
                <p className="text-sm text-gray-900">{viewingTopic.trainingName}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Trainer</p>
                <p className="text-sm text-gray-900">{viewingTopic.trainerName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Capability Area</p>
                  <p className="text-sm text-gray-900">{viewingTopic.capabilityArea}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Capability Skill</p>
                  <p className="text-sm text-gray-900">{viewingTopic.capabilitySkill}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Type</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(viewingTopic.type)}`}>
                    {viewingTopic.type}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Proposed Date</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingTopic.proposedScheduleDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Targeting tags — shown only when not Generic */}
              {viewingTopic.type !== 'Generic' && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                    {viewingTopic.type === 'Level Specific'
                      ? 'Target Levels'
                      : viewingTopic.type === 'Dept Specific'
                      ? 'Target Departments'
                      : 'Target Designations'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {targetingLabel(viewingTopic)
                      .split(', ')
                      .map((tag, i) => (
                        <span key={i}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Created By</p>
                  <p className="text-sm text-gray-900">{viewingTopic.createdBy}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Created At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingTopic.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setViewingTopic(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}