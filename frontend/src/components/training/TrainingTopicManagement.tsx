import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, Edit, Trash2, Save, Eye, Calendar, FileText, Video, FileCheck } from 'lucide-react';
import { getRole, can } from '../../config/rbac';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

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
  contentPdfLink: string;
  videoLink: string;
  assessmentLink: string;
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
  contentPdfLink: string;
  videoLink: string;
  assessmentLink: string;
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
  contentPdfLink: '',
  videoLink: '',
  assessmentLink: '',
  status: 'Draft',
};

export default function TrainingTopicManagement() {
  const [trainingTopics, setTrainingTopics] = useState<TrainingTopic[]>([]);
  const [capabilityAreas, setCapabilityAreas] = useState<CapabilityArea[]>([]);
  const [capabilitySkills, setCapabilitySkills] = useState<CapabilitySkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [trainingTopicForm, setTrainingTopicForm] = useState<TrainingTopicForm>(initialTrainingTopicForm);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TrainingTopic | null>(null);
  const [viewingTopic, setViewingTopic] = useState<TrainingTopic | null>(null);

  // Permissions
  const canCreate = can('trainingSuggestions', 'create') || can('training', 'create');
  const canEdit = can('trainingSuggestions', 'update') || can('training', 'update');
  const canDelete = can('trainingSuggestions', 'delete') || can('training', 'delete');

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

  useEffect(() => {
    loadTrainingTopics();
    loadCapabilityAreas();
    loadCapabilitySkills();
  }, []);

  const generateTrainingId = (): string => {
    return 'TR' + Date.now().toString().slice(-8);
  };

  const openModal = (topic?: TrainingTopic) => {
    if (topic) {
      setEditingTopic(topic);
      setTrainingTopicForm({
        trainingId: topic.trainingId,
        trainingName: topic.trainingName,
        trainerName: topic.trainerName,
        capabilityAreaId: capabilityAreas.find(ca => ca.capabilityArea === topic.capabilityArea)?._id || '',
        capabilitySkillId: capabilitySkills.find(cs => cs.capabilitySkill === topic.capabilitySkill)?._id || '',
        type: topic.type,
        isGeneric: topic.isGeneric,
        proposedScheduleDate: topic.proposedScheduleDate,
        contentPdfLink: topic.contentPdfLink,
        videoLink: topic.videoLink,
        assessmentLink: topic.assessmentLink,
        status: topic.status,
      });
    } else {
      setEditingTopic(null);
      setTrainingTopicForm(initialTrainingTopicForm);
    }
    setIsModalOpen(true);
    setError('');
  };

  const openViewModal = (topic: TrainingTopic) => {
    setViewingTopic(topic);
  };

  const saveTrainingTopic = async () => {
    if (!trainingTopicForm.trainingName.trim()) {
      return setError('Training Name is required');
    }
    if (!trainingTopicForm.trainerName.trim()) {
      return setError('Trainer Name is required');
    }
    if (!trainingTopicForm.capabilityAreaId) {
      return setError('Please select a capability area');
    }
    if (!trainingTopicForm.capabilitySkillId) {
      return setError('Please select a capability skill');
    }
    if (!trainingTopicForm.proposedScheduleDate) {
      return setError('Proposed Schedule Date is required');
    }

    setLoading(true);
    try {
      const selectedArea = capabilityAreas.find(ca => ca._id === trainingTopicForm.capabilityAreaId);
      const selectedSkill = capabilitySkills.find(cs => cs._id === trainingTopicForm.capabilitySkillId);

      const payload = {
        trainingId: trainingTopicForm.trainingId || generateTrainingId(),
        trainingName: trainingTopicForm.trainingName.trim(),
        trainerName: trainingTopicForm.trainerName.trim(),
        capabilityArea: selectedArea?.capabilityArea || '',
        capabilitySkill: selectedSkill?.capabilitySkill || '',
        type: trainingTopicForm.type,
        isGeneric: trainingTopicForm.isGeneric,
        proposedScheduleDate: trainingTopicForm.proposedScheduleDate,
        contentPdfLink: trainingTopicForm.contentPdfLink.trim(),
        videoLink: trainingTopicForm.videoLink.trim(),
        assessmentLink: trainingTopicForm.assessmentLink.trim(),
        status: trainingTopicForm.status,
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

  const deleteTrainingTopic = async (id: string) => {
    if (!confirm('Are you sure you want to delete this training topic?')) {
      return;
    }

    try {
      await api.delete(`/training-topics/${id}`);
      await loadTrainingTopics();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete training topic');
    }
  };

  const submitForApproval = async (id: string) => {
    if (!confirm('Are you sure you want to submit this training topic for approval?')) {
      return;
    }

    try {
      await api.patch(`/training-topics/${id}/submit-for-approval`);
      await loadTrainingTopics();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit for approval');
    }
  };

  const filteredSkills = capabilitySkills.filter(
    skill => skill.capabilityId === trainingTopicForm.capabilityAreaId
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Pending Approval':
        return 'bg-yellow-100 text-yellow-800';
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Training Topic Management</h2>
        <p className="text-gray-600">Create and manage training topics before approval</p>
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
            Create Training Topic
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Training ID
              </th>
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
                Proposed Date
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
            {trainingTopics.map((topic) => (
              <tr key={topic._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {topic.trainingId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {topic.trainingName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {topic.capabilitySkill}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(topic.type)}`}>
                    {topic.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(topic.proposedScheduleDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(topic.status)}`}>
                    {topic.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openViewModal(topic)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && topic.status === 'Draft' && (
                      <button
                        onClick={() => openModal(topic)}
                        className="text-green-600 hover:text-green-800"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && topic.status === 'Draft' && (
                      <button
                        onClick={() => deleteTrainingTopic(topic._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {canCreate && topic.status === 'Draft' && (
                      <button
                        onClick={() => submitForApproval(topic._id)}
                        className="text-purple-600 hover:text-purple-800"
                        title="Submit for Approval"
                      >
                        <Calendar className="w-4 h-4" />
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
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingTopic ? 'Edit Training Topic' : 'Create Training Topic'}
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
                  Training ID
                </label>
                <input
                  type="text"
                  value={trainingTopicForm.trainingId}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, trainingId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Name *
                </label>
                <input
                  type="text"
                  value={trainingTopicForm.trainingName}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, trainingName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Advanced Leadership Skills"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trainer Name *
                </label>
                <input
                  type="text"
                  value={trainingTopicForm.trainerName}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, trainerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability Area *
                </label>
                <select
                  value={trainingTopicForm.capabilityAreaId}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, capabilityAreaId: e.target.value, capabilitySkillId: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a capability area</option>
                  {capabilityAreas.map((area) => (
                    <option key={area._id} value={area._id}>
                      {area.capabilityArea}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability Skill *
                </label>
                <select
                  value={trainingTopicForm.capabilitySkillId}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, capabilitySkillId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!trainingTopicForm.capabilityAreaId}
                >
                  <option value="">Select a capability skill</option>
                  {filteredSkills.map((skill) => (
                    <option key={skill._id} value={skill._id}>
                      {skill.capabilitySkill}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={trainingTopicForm.type}
                  onChange={(e) => setTrainingTopicForm(prev => ({ 
                    ...prev, 
                    type: e.target.value as any,
                    isGeneric: e.target.value === 'Generic'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Generic">Generic</option>
                  <option value="Dept Specific">Dept Specific</option>
                  <option value="Level Specific">Level Specific</option>
                  <option value="Role Specific">Role Specific</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proposed Schedule Date *
                </label>
                <input
                  type="date"
                  value={trainingTopicForm.proposedScheduleDate}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, proposedScheduleDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content PDF Link
                </label>
                <input
                  type="url"
                  value={trainingTopicForm.contentPdfLink}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, contentPdfLink: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/content.pdf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video Link
                </label>
                <input
                  type="url"
                  value={trainingTopicForm.videoLink}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, videoLink: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/video"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment Link
                </label>
                <input
                  type="url"
                  value={trainingTopicForm.assessmentLink}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, assessmentLink: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/assessment"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={trainingTopicForm.status}
                  onChange={(e) => setTrainingTopicForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending Approval">Pending Approval</option>
                </select>
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
                onClick={saveTrainingTopic}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Training Topic Details</h3>
              <button
                onClick={() => setViewingTopic(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Training ID</p>
                  <p className="text-sm text-gray-900">{viewingTopic.trainingId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(viewingTopic.status)}`}>
                    {viewingTopic.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Training Name</p>
                <p className="text-sm text-gray-900">{viewingTopic.trainingName}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Trainer Name</p>
                <p className="text-sm text-gray-900">{viewingTopic.trainerName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Capability Area</p>
                  <p className="text-sm text-gray-900">{viewingTopic.capabilityArea}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Capability Skill</p>
                  <p className="text-sm text-gray-900">{viewingTopic.capabilitySkill}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(viewingTopic.type)}`}>
                    {viewingTopic.type}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Proposed Schedule Date</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingTopic.proposedScheduleDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Content Links</p>
                  <div className="space-y-2">
                    {viewingTopic.contentPdfLink && (
                      <a
                        href={viewingTopic.contentPdfLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        Content PDF
                      </a>
                    )}
                    {viewingTopic.videoLink && (
                      <a
                        href={viewingTopic.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Video className="w-4 h-4" />
                        Video Content
                      </a>
                    )}
                    {viewingTopic.assessmentLink && (
                      <a
                        href={viewingTopic.assessmentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <FileCheck className="w-4 h-4" />
                        Assessment
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Created By</p>
                  <p className="text-sm text-gray-900">{viewingTopic.createdBy}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Created At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingTopic.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingTopic(null)}
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
