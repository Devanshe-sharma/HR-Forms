import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, Edit, Trash2, Save } from 'lucide-react';
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
  createdAt: string;
  createdBy: string;
}

interface CapabilitySkill {
  _id: string;
  capabilityId: string;
  capabilitySkill: string;
  isGeneric: boolean;
  capabilityArea: string;
  createdAt: string;
  createdBy: string;
}

type CapabilityForm = {
  capabilityAreaId: string;
  capabilityArea: string;
};

type SkillForm = {
  capabilityId: string;
  capabilitySkill: string;
  isGeneric: boolean;
};

const initialCapabilityForm: CapabilityForm = {
  capabilityAreaId: '',
  capabilityArea: '',
};

const initialSkillForm: SkillForm = {
  capabilityId: '',
  capabilitySkill: '',
  isGeneric: false,
};

export default function CapabilityManagement() {
  const [capabilityAreas, setCapabilityAreas] = useState<CapabilityArea[]>([]);
  const [capabilitySkills, setCapabilitySkills] = useState<CapabilitySkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forms
  const [capabilityForm, setCapabilityForm] = useState<CapabilityForm>(initialCapabilityForm);
  const [skillForm, setSkillForm] = useState<SkillForm>(initialSkillForm);
  
  // Modals
  const [isCapabilityModalOpen, setIsCapabilityModalOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingCapability, setEditingCapability] = useState<CapabilityArea | null>(null);
  const [editingSkill, setEditingSkill] = useState<CapabilitySkill | null>(null);

  // Permissions
  const canCreate = can('capability', 'create') || can('training', 'create');
  const canEdit = can('capability', 'update') || can('training', 'update');
  const canDelete = can('capability', 'delete') || can('training', 'delete');

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
    loadCapabilityAreas();
    loadCapabilitySkills();
  }, []);

  const openCapabilityModal = (capability?: CapabilityArea) => {
    if (capability) {
      setEditingCapability(capability);
      setCapabilityForm({
        capabilityAreaId: capability.capabilityAreaId,
        capabilityArea: capability.capabilityArea,
      });
    } else {
      setEditingCapability(null);
      setCapabilityForm(initialCapabilityForm);
    }
    setIsCapabilityModalOpen(true);
    setError('');
  };

  const openSkillModal = (skill?: CapabilitySkill) => {
    if (skill) {
      setEditingSkill(skill);
      setSkillForm({
        capabilityId: skill.capabilityId,
        capabilitySkill: skill.capabilitySkill,
        isGeneric: skill.isGeneric,
      });
    } else {
      setEditingSkill(null);
      setSkillForm(initialSkillForm);
    }
    setIsSkillModalOpen(true);
    setError('');
  };

  const generateCapabilityId = (area: string): string => {
    return 'CA' + area.toUpperCase().replace(/\s+/g, '_').substring(0, 10) + Date.now().toString().slice(-4);
  };

  const saveCapability = async () => {
    if (!capabilityForm.capabilityArea.trim()) {
      return setError('Capability Area is required');
    }

    setLoading(true);
    try {
      const payload = {
        capabilityAreaId: capabilityForm.capabilityAreaId || generateCapabilityId(capabilityForm.capabilityArea),
        capabilityArea: capabilityForm.capabilityArea.trim(),
      };

      if (editingCapability) {
        await api.patch(`/capability-areas/${editingCapability._id}`, payload);
      } else {
        await api.post('/capability-areas', payload);
      }

      await loadCapabilityAreas();
      setIsCapabilityModalOpen(false);
      setCapabilityForm(initialCapabilityForm);
      setEditingCapability(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save capability area');
    } finally {
      setLoading(false);
    }
  };

  const saveSkill = async () => {
    if (!skillForm.capabilityId) {
      return setError('Please select a capability area');
    }
    if (!skillForm.capabilitySkill.trim()) {
      return setError('Capability Skill is required');
    }

    setLoading(true);
    try {
      const selectedArea = capabilityAreas.find(ca => ca._id === skillForm.capabilityId);
      const payload = {
        capabilityId: skillForm.capabilityId,
        capabilitySkill: skillForm.capabilitySkill.trim(),
        isGeneric: skillForm.isGeneric,
        capabilityArea: selectedArea?.capabilityArea || '',
      };

      if (editingSkill) {
        await api.patch(`/capability-skills/${editingSkill._id}`, payload);
      } else {
        await api.post('/capability-skills', payload);
      }

      await loadCapabilitySkills();
      setIsSkillModalOpen(false);
      setSkillForm(initialSkillForm);
      setEditingSkill(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save capability skill');
    } finally {
      setLoading(false);
    }
  };

  const deleteCapability = async (id: string) => {
    if (!confirm('Are you sure you want to delete this capability area? This will also delete all associated skills.')) {
      return;
    }

    try {
      await api.delete(`/capability-areas/${id}`);
      await loadCapabilityAreas();
      await loadCapabilitySkills();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete capability area');
    }
  };

  const deleteSkill = async (id: string) => {
    if (!confirm('Are you sure you want to delete this capability skill?')) {
      return;
    }

    try {
      await api.delete(`/capability-skills/${id}`);
      await loadCapabilitySkills();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete capability skill');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Capability Management</h2>
        <p className="text-gray-600">Manage capability areas and skills for training mapping</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Capability Areas Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Capability Areas</h3>
          {canCreate && (
            <button
              onClick={() => openCapabilityModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Capability Area
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capability Area ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capability Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {capabilityAreas.map((area) => (
                <tr key={area._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {area.capabilityAreaId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {area.capabilityArea}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {area.createdBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => openCapabilityModal(area)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteCapability(area._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capability Skills Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Capability Skills</h3>
          {canCreate && (
            <button
              onClick={() => openSkillModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Capability Skill
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capability Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capability Skill
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Generic
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {capabilitySkills.map((skill) => (
                <tr key={skill._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {skill.capabilityArea}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {skill.capabilitySkill}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      skill.isGeneric 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {skill.isGeneric ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {skill.createdBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => openSkillModal(skill)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteSkill(skill._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capability Area Modal */}
      {isCapabilityModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingCapability ? 'Edit Capability Area' : 'Create Capability Area'}
              </h3>
              <button
                onClick={() => setIsCapabilityModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability Area ID
                </label>
                <input
                  type="text"
                  value={capabilityForm.capabilityAreaId}
                  onChange={(e) => setCapabilityForm(prev => ({ ...prev, capabilityAreaId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability Area *
                </label>
                <input
                  type="text"
                  value={capabilityForm.capabilityArea}
                  onChange={(e) => setCapabilityForm(prev => ({ ...prev, capabilityArea: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Leadership, Technical Skills, Communication"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsCapabilityModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCapability}
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

      {/* Capability Skill Modal */}
      {isSkillModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingSkill ? 'Edit Capability Skill' : 'Create Capability Skill'}
              </h3>
              <button
                onClick={() => setIsSkillModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capability Area *
                </label>
                <select
                  value={skillForm.capabilityId}
                  onChange={(e) => setSkillForm(prev => ({ ...prev, capabilityId: e.target.value }))}
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
                <input
                  type="text"
                  value={skillForm.capabilitySkill}
                  onChange={(e) => setSkillForm(prev => ({ ...prev, capabilitySkill: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Public Speaking, Project Management, Data Analysis"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={skillForm.isGeneric}
                    onChange={(e) => setSkillForm(prev => ({ ...prev, isGeneric: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Generic (Available for all roles)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  If checked, this skill will be available for all roles. If unchecked, it will be used for role-based mapping.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsSkillModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSkill}
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
    </div>
  );
}
