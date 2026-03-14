import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Plus, X, Edit, Trash2, Save, Eye,
  RotateCcw, CheckCircle, XCircle,
} from 'lucide-react';
import { getRole, can } from '../../config/rbac';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  _id: string;
  name: string;
}

interface TrainingSchedule {
  _id: string;
  trainingId: string;
  trainingName: string;
  capabilityArea: string;
  capabilitySkill: string;
  trainerName: string;
  type: 'Generic' | 'Dept Specific' | 'Level Specific' | 'Role Specific';
  trainingDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  onlineLink: string;
  targetAudience: {
    type: 'all' | 'departments' | 'levels' | 'roles';
    departments?: string[];
    levels?: number[];
    roles?: string[];
  };
  attendanceRequired: boolean;
  maxAttempts: number;
  feedbackWindow: number;
  status: 'Scheduled' | 'Rescheduled' | 'Cancelled' | 'Completed';
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

type ScheduleForm = {
  trainingTopicId:    string;
  trainingDate:       string;
  startTime:          string;
  endTime:            string;
  venue:              string;
  onlineLink:         string;
  targetAudienceType: 'all' | 'departments' | 'levels' | 'roles';
  targetDepartments:  string[];
  targetLevels:       number[];
  targetRoles:        string[];
  attendanceRequired: boolean;
  maxAttempts:        number;
  feedbackWindow:     number;
};

const initialScheduleForm: ScheduleForm = {
  trainingTopicId:    '',
  trainingDate:       '',
  startTime:          '',
  endTime:            '',
  venue:              '',
  onlineLink:         '',
  targetAudienceType: 'all',
  targetDepartments:  [],
  targetLevels:       [],
  targetRoles:        [],
  attendanceRequired: true,
  maxAttempts:        2,
  feedbackWindow:     5,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinalTrainingScheduling() {
  const [schedules, setSchedules]           = useState<TrainingSchedule[]>([]);
  const [approvedTopics, setApprovedTopics] = useState<any[]>([]);
  const [departments, setDepartments]       = useState<Department[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');

  const [scheduleForm, setScheduleForm]       = useState<ScheduleForm>(initialScheduleForm);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TrainingSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<TrainingSchedule | null>(null);

  const canCreate = can('trainingSchedule', 'create');
  const canEdit   = can('trainingSchedule', 'update');
  const canDelete = can('trainingSchedule', 'delete');

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-schedules');
      setSchedules(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load training schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovedTopics = async () => {
    try {
      const res = await api.get('/training-topics?status=Approved');
      setApprovedTopics(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load approved topics');
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load departments');
    }
  };

  useEffect(() => {
    loadSchedules();
    loadApprovedTopics();
    loadDepartments();
  }, []);

  // ── Modal ────────────────────────────────────────────────────────────────────

  const openModal = (schedule?: TrainingSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({
        trainingTopicId:    schedule.trainingId,
        trainingDate:       schedule.trainingDate,
        startTime:          schedule.startTime,
        endTime:            schedule.endTime,
        venue:              schedule.venue,
        onlineLink:         schedule.onlineLink,
        targetAudienceType: schedule.targetAudience.type,
        targetDepartments:  schedule.targetAudience.departments || [],
        targetLevels:       schedule.targetAudience.levels || [],
        targetRoles:        schedule.targetAudience.roles || [],
        attendanceRequired: schedule.attendanceRequired,
        maxAttempts:        schedule.maxAttempts,
        feedbackWindow:     schedule.feedbackWindow,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm(initialScheduleForm);
    }
    setIsModalOpen(true);
    setError('');
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const saveSchedule = async () => {
    if (!scheduleForm.trainingTopicId)                         return setError('Please select a training topic');
    if (!scheduleForm.trainingDate)                            return setError('Training date is required');
    if (!scheduleForm.startTime)                               return setError('Start time is required');
    if (!scheduleForm.endTime)                                 return setError('End time is required');
    if (!scheduleForm.venue.trim() && !scheduleForm.onlineLink.trim())
      return setError('Either venue or online link is required');

    setLoading(true);
    try {
      const selectedTopic = approvedTopics.find(t => t._id === scheduleForm.trainingTopicId);

      const payload = {
        trainingId:      selectedTopic?.trainingId   || '',
        trainingName:    selectedTopic?.trainingName || '',
        capabilityArea:  selectedTopic?.capabilityArea || '',
        capabilitySkill: selectedTopic?.capabilitySkill || '',
        trainerName:     selectedTopic?.trainerName  || '',
        type:            selectedTopic?.type         || 'Generic',
        trainingDate:    scheduleForm.trainingDate,
        startTime:       scheduleForm.startTime,
        endTime:         scheduleForm.endTime,
        venue:           scheduleForm.venue.trim(),
        onlineLink:      scheduleForm.onlineLink.trim(),
        targetAudience: {
          type:        scheduleForm.targetAudienceType,
          departments: scheduleForm.targetAudienceType === 'departments' ? scheduleForm.targetDepartments : [],
          levels:      scheduleForm.targetAudienceType === 'levels'      ? scheduleForm.targetLevels      : [],
          roles:       scheduleForm.targetAudienceType === 'roles'       ? scheduleForm.targetRoles       : [],
        },
        attendanceRequired: scheduleForm.attendanceRequired,
        maxAttempts:        scheduleForm.maxAttempts,
        feedbackWindow:     scheduleForm.feedbackWindow,
      };

      if (editingSchedule) {
        await api.patch(`/training-schedules/${editingSchedule._id}`, payload);
      } else {
        await api.post('/training-schedules', payload);
      }

      await loadSchedules();
      setIsModalOpen(false);
      setScheduleForm(initialScheduleForm);
      setEditingSchedule(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save training schedule');
    } finally {
      setLoading(false);
    }
  };

  // ── Delete / status ──────────────────────────────────────────────────────────

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this training schedule?')) return;
    try {
      await api.delete(`/training-schedules/${id}`);
      await loadSchedules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete training schedule');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/training-schedules/${id}/status`, { status });
      await loadSchedules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Scheduled':   return 'bg-blue-100 text-blue-800';
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800';
      case 'Cancelled':   return 'bg-red-100 text-red-800';
      case 'Completed':   return 'bg-green-100 text-green-800';
      default:            return 'bg-gray-100 text-gray-800';
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

  const getAudienceText = (a: TrainingSchedule['targetAudience']) => {
    switch (a.type) {
      case 'all':         return 'All Employees';
      case 'departments': return `${a.departments?.length || 0} Department(s)`;
      case 'levels':      return `Level ${a.levels?.join(', ') || ''}`;
      case 'roles':       return `${a.roles?.length || 0} Role(s)`;
      default:            return 'Not specified';
    }
  };

  const set = <K extends keyof ScheduleForm>(k: K, v: ScheduleForm[K]) =>
    setScheduleForm(p => ({ ...p, [k]: v }));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-2">Final Training Scheduling</h2>
        <p className="text-gray-400 text-sm">Schedule approved training topics with logistics</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>
      )}

      <div className="mb-4">
        {canCreate && (
          <button onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
            <Plus className="w-4 h-4" /> Schedule Training
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Training Name', 'Capability Skill', 'Type', 'Scheduled Date', 'Target Audience', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedules.map(s => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-900">{s.trainingName}</td>
                <td className="px-5 py-4 text-sm text-gray-900">{s.capabilitySkill}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(s.type)}`}>{s.type}</span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">
                  <div>{new Date(s.trainingDate).toLocaleDateString()}</div>
                  <div className="text-xs text-gray-400">{s.startTime} – {s.endTime}</div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">{getAudienceText(s.targetAudience)}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(s.status)}`}>{s.status}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => setViewingSchedule(s)} className="text-blue-600 hover:text-blue-800" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => openModal(s)} className="text-green-600 hover:text-green-800" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteSchedule(s._id)} className="text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && s.status === 'Scheduled' && (
                      <button onClick={() => updateStatus(s._id, 'Rescheduled')} className="text-yellow-600 hover:text-yellow-800" title="Reschedule">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && s.status === 'Scheduled' && (
                      <button onClick={() => updateStatus(s._id, 'Cancelled')} className="text-red-600 hover:text-red-800" title="Cancel">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && s.status !== 'Completed' && (
                      <button onClick={() => updateStatus(s._id, 'Completed')} className="text-green-600 hover:text-green-800" title="Mark Completed">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full mt-40 max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">
                {editingSchedule ? 'Edit Training Schedule' : 'Schedule Training'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training Topic *</label>
                <select value={scheduleForm.trainingTopicId} onChange={e => set('trainingTopicId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">Select an approved topic</option>
                  {approvedTopics.map(t => (
                    <option key={t._id} value={t._id}>{t.trainingName} — {t.capabilitySkill}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training Date *</label>
                <input type="date" value={scheduleForm.trainingDate} onChange={e => set('trainingDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                <input type="time" value={scheduleForm.startTime} onChange={e => set('startTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                <input type="time" value={scheduleForm.endTime} onChange={e => set('endTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input type="text" value={scheduleForm.venue} onChange={e => set('venue', e.target.value)}
                  placeholder="e.g., Conference Room A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Online Link</label>
                <input type="url" value={scheduleForm.onlineLink} onChange={e => set('onlineLink', e.target.value)}
                  placeholder="https://zoom.us/meeting/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience *</label>
                <select value={scheduleForm.targetAudienceType}
                  onChange={e => setScheduleForm(p => ({
                    ...p, targetAudienceType: e.target.value as any,
                    targetDepartments: [], targetLevels: [], targetRoles: [],
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="all">All Employees</option>
                  <option value="departments">Specific Departments</option>
                  <option value="levels">Specific Levels</option>
                  <option value="roles">Specific Roles</option>
                </select>
              </div>

              {scheduleForm.targetAudienceType === 'departments' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departments *</label>
                  <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                    {departments.map(dept => (
                      <label key={dept._id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox"
                          checked={scheduleForm.targetDepartments.includes(dept._id)}
                          onChange={e => set('targetDepartments',
                            e.target.checked
                              ? [...scheduleForm.targetDepartments, dept._id]
                              : scheduleForm.targetDepartments.filter(id => id !== dept._id)
                          )}
                          className="rounded border-gray-300 text-blue-600" />
                        {dept.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {scheduleForm.targetAudienceType === 'levels' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Levels *</label>
                  <div className="flex gap-4 p-2">
                    {[1, 2, 3].map(level => (
                      <label key={level} className="flex items-center gap-2 text-sm">
                        <input type="checkbox"
                          checked={scheduleForm.targetLevels.includes(level)}
                          onChange={e => set('targetLevels',
                            e.target.checked
                              ? [...scheduleForm.targetLevels, level]
                              : scheduleForm.targetLevels.filter(l => l !== level)
                          )}
                          className="rounded border-gray-300 text-blue-600" />
                        Level {level}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attendance Required</label>
                <label className="flex items-center gap-2 text-sm mt-2">
                  <input type="checkbox" checked={scheduleForm.attendanceRequired}
                    onChange={e => set('attendanceRequired', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600" />
                  Yes
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
                <input type="number" min={1} max={5} value={scheduleForm.maxAttempts}
                  onChange={e => set('maxAttempts', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Window (Hours)</label>
                <input type="number" min={1} max={168} value={scheduleForm.feedbackWindow}
                  onChange={e => set('feedbackWindow', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={saveSchedule} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Training Schedule Details</h3>
              <button onClick={() => setViewingSchedule(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Training Name</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.trainingName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Status</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(viewingSchedule.status)}`}>{viewingSchedule.status}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Capability Area</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.capabilityArea}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Capability Skill</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.capabilitySkill}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Trainer</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.trainerName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Type</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(viewingSchedule.type)}`}>{viewingSchedule.type}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Date</p>
                  <p className="text-sm text-gray-900">{new Date(viewingSchedule.trainingDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Time</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.startTime} – {viewingSchedule.endTime}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Venue</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.venue || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Online Link</p>
                  {viewingSchedule.onlineLink
                    ? <a href={viewingSchedule.onlineLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm">Join Online</a>
                    : <p className="text-sm text-gray-500">N/A</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Audience</p>
                  <p className="text-sm text-gray-900">{getAudienceText(viewingSchedule.targetAudience)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Max Attempts</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.maxAttempts}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Feedback Window</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.feedbackWindow}h</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Created By</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.createdBy}</p>
                </div>
                {viewingSchedule.approvedBy && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Approved By</p>
                    <p className="text-sm text-gray-900">{viewingSchedule.approvedBy}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setViewingSchedule(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}