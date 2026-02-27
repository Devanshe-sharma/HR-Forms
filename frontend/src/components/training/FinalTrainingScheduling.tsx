import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, Edit, Trash2, Save, Eye, Calendar, Clock, MapPin, Users, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { getRole, can } from '../../config/rbac';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

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
  trainingTopicId: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  onlineLink: string;
  targetAudienceType: 'all' | 'departments' | 'levels' | 'roles';
  targetDepartments: string[];
  targetLevels: number[];
  targetRoles: string[];
  attendanceRequired: boolean;
  maxAttempts: number;
  feedbackWindow: number;
};

const initialScheduleForm: ScheduleForm = {
  trainingTopicId: '',
  trainingDate: '',
  startTime: '',
  endTime: '',
  venue: '',
  onlineLink: '',
  targetAudienceType: 'all',
  targetDepartments: [],
  targetLevels: [],
  targetRoles: [],
  attendanceRequired: true,
  maxAttempts: 2,
  feedbackWindow: 5,
};

export default function FinalTrainingScheduling() {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([]);
  const [approvedTopics, setApprovedTopics] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(initialScheduleForm);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TrainingSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<TrainingSchedule | null>(null);

  // Permissions
  const canCreate = can('trainingSchedule', 'create');
  const canEdit = can('trainingSchedule', 'update');
  const canDelete = can('trainingSchedule', 'delete');

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

  const openModal = (schedule?: TrainingSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({
        trainingTopicId: schedule.trainingId,
        trainingDate: schedule.trainingDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        venue: schedule.venue,
        onlineLink: schedule.onlineLink,
        targetAudienceType: schedule.targetAudience.type,
        targetDepartments: schedule.targetAudience.departments || [],
        targetLevels: schedule.targetAudience.levels || [],
        targetRoles: schedule.targetAudience.roles || [],
        attendanceRequired: schedule.attendanceRequired,
        maxAttempts: schedule.maxAttempts,
        feedbackWindow: schedule.feedbackWindow,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm(initialScheduleForm);
    }
    setIsModalOpen(true);
    setError('');
  };

  const openViewModal = (schedule: TrainingSchedule) => {
    setViewingSchedule(schedule);
  };

  const saveSchedule = async () => {
    if (!scheduleForm.trainingTopicId) {
      return setError('Please select a training topic');
    }
    if (!scheduleForm.trainingDate) {
      return setError('Training date is required');
    }
    if (!scheduleForm.startTime) {
      return setError('Start time is required');
    }
    if (!scheduleForm.endTime) {
      return setError('End time is required');
    }
    if (!scheduleForm.venue.trim() && !scheduleForm.onlineLink.trim()) {
      return setError('Either venue or online link is required');
    }

    setLoading(true);
    try {
      const selectedTopic = approvedTopics.find(t => t._id === scheduleForm.trainingTopicId);
      
      const payload = {
        trainingId: selectedTopic?.trainingId || '',
        trainingName: selectedTopic?.trainingName || '',
        capabilityArea: selectedTopic?.capabilityArea || '',
        capabilitySkill: selectedTopic?.capabilitySkill || '',
        trainerName: selectedTopic?.trainerName || '',
        type: selectedTopic?.type || 'Generic',
        trainingDate: scheduleForm.trainingDate,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        venue: scheduleForm.venue.trim(),
        onlineLink: scheduleForm.onlineLink.trim(),
        targetAudience: {
          type: scheduleForm.targetAudienceType,
          departments: scheduleForm.targetAudienceType === 'departments' ? scheduleForm.targetDepartments : [],
          levels: scheduleForm.targetAudienceType === 'levels' ? scheduleForm.targetLevels : [],
          roles: scheduleForm.targetAudienceType === 'roles' ? scheduleForm.targetRoles : [],
        },
        attendanceRequired: scheduleForm.attendanceRequired,
        maxAttempts: scheduleForm.maxAttempts,
        feedbackWindow: scheduleForm.feedbackWindow,
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

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this training schedule?')) {
      return;
    }

    try {
      await api.delete(`/training-schedules/${id}`);
      await loadSchedules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete training schedule');
    }
  };

  const updateScheduleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/training-schedules/${id}/status`, { status });
      await loadSchedules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update schedule status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'Rescheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Generic':
        return 'bg-green-100 text-green-800';
      case 'Dept Specific':
        return 'bg-blue-100 text-blue-800';
      case 'Level Specific':
        return 'bg-purple-100 text-purple-800';
      case 'Role Specific':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTargetAudienceText = (audience: any) => {
    switch (audience.type) {
      case 'all':
        return 'All Employees';
      case 'departments':
        return `${audience.departments?.length || 0} Department(s)`;
      case 'levels':
        return `Level ${audience.levels?.join(', ') || ''}`;
      case 'roles':
        return `${audience.roles?.length || 0} Role(s)`;
      default:
        return 'Not specified';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Final Training Scheduling</h2>
        <p className="text-gray-600">Schedule approved training topics with detailed logistics</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4">
        {canCreate && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Training
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Training Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capability Skill
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target Audience
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedules.map((schedule) => (
              <tr key={schedule._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {schedule.trainingName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {schedule.capabilitySkill}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(schedule.type)}`}>
                    {schedule.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    {new Date(schedule.trainingDate).toLocaleDateString()}
                    <div className="text-xs text-gray-400">
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getTargetAudienceText(schedule.targetAudience)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(schedule.status)}`}>
                    {schedule.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openViewModal(schedule)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => openModal(schedule)}
                        className="text-green-600 hover:text-green-800"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteSchedule(schedule._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && schedule.status === 'Scheduled' && (
                      <button
                        onClick={() => updateScheduleStatus(schedule._id, 'Rescheduled')}
                        className="text-yellow-600 hover:text-yellow-800"
                        title="Reschedule"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && schedule.status === 'Scheduled' && (
                      <button
                        onClick={() => updateScheduleStatus(schedule._id, 'Cancelled')}
                        className="text-red-600 hover:text-red-800"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && schedule.status !== 'Completed' && (
                      <button
                        onClick={() => updateScheduleStatus(schedule._id, 'Completed')}
                        className="text-green-600 hover:text-green-800"
                        title="Mark as Completed"
                      >
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

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingSchedule ? 'Edit Training Schedule' : 'Schedule Training'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Topic *
                </label>
                <select
                  value={scheduleForm.trainingTopicId}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, trainingTopicId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an approved training topic</option>
                  {approvedTopics.map((topic) => (
                    <option key={topic._id} value={topic._id}>
                      {topic.trainingName} - {topic.capabilitySkill}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Date *
                </label>
                <input
                  type="date"
                  value={scheduleForm.trainingDate}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, trainingDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={scheduleForm.venue}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, venue: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Conference Room A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Online Link
                </label>
                <input
                  type="url"
                  value={scheduleForm.onlineLink}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, onlineLink: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://zoom.us/meeting/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Audience Type *
                </label>
                <select
                  value={scheduleForm.targetAudienceType}
                  onChange={(e) => setScheduleForm(prev => ({ 
                    ...prev, 
                    targetAudienceType: e.target.value as any,
                    targetDepartments: [],
                    targetLevels: [],
                    targetRoles: []
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Employees</option>
                  <option value="departments">Specific Departments</option>
                  <option value="levels">Specific Levels</option>
                  <option value="roles">Specific Roles</option>
                </select>
              </div>
              {scheduleForm.targetAudienceType === 'departments' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Departments *
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                    {departments.map((dept) => (
                      <label key={dept._id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={scheduleForm.targetDepartments.includes(dept._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScheduleForm(prev => ({ 
                                ...prev, 
                                targetDepartments: [...prev.targetDepartments, dept._id] 
                              }));
                            } else {
                              setScheduleForm(prev => ({ 
                                ...prev, 
                                targetDepartments: prev.targetDepartments.filter(id => id !== dept._id) 
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {scheduleForm.targetAudienceType === 'levels' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Levels *
                  </label>
                  <div className="space-y-2">
                    {[1, 2, 3].map((level) => (
                      <label key={level} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={scheduleForm.targetLevels.includes(level)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScheduleForm(prev => ({ 
                                ...prev, 
                                targetLevels: [...prev.targetLevels, level] 
                              }));
                            } else {
                              setScheduleForm(prev => ({ 
                                ...prev, 
                                targetLevels: prev.targetLevels.filter(l => l !== level) 
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">Level {level}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attendance Required
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scheduleForm.attendanceRequired}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, attendanceRequired: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Yes</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={scheduleForm.maxAttempts}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, maxAttempts: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feedback Window (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={scheduleForm.feedbackWindow}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, feedbackWindow: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSchedule}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
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
              <button
                onClick={() => setViewingSchedule(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Training Name</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.trainingName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(viewingSchedule.status)}`}>
                    {viewingSchedule.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Capability Area</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.capabilityArea}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Capability Skill</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.capabilitySkill}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Trainer</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.trainerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(viewingSchedule.type)}`}>
                    {viewingSchedule.type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Training Date</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingSchedule.trainingDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Time</p>
                  <p className="text-sm text-gray-900">
                    {viewingSchedule.startTime} - {viewingSchedule.endTime}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Venue</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.venue || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Online Link</p>
                  {viewingSchedule.onlineLink ? (
                    <a
                      href={viewingSchedule.onlineLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Join Online
                    </a>
                  ) : (
                    <p className="text-sm text-gray-900">N/A</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Target Audience</p>
                <p className="text-sm text-gray-900">{getTargetAudienceText(viewingSchedule.targetAudience)}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Attendance Required</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.attendanceRequired ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Max Attempts</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.maxAttempts}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Feedback Window</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.feedbackWindow} hours</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Created By</p>
                  <p className="text-sm text-gray-900">{viewingSchedule.createdBy}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Created At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingSchedule.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {viewingSchedule.approvedBy && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Approved By</p>
                    <p className="text-sm text-gray-900">{viewingSchedule.approvedBy}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Approved At</p>
                    <p className="text-sm text-gray-900">
                      {viewingSchedule.approvedAt ? new Date(viewingSchedule.approvedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingSchedule(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
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
