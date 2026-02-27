import { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Edit, RotateCcw, Eye, Save, X } from 'lucide-react';
import { getRole, can } from '../../config/rbac';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

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
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent Back';
  createdAt: string;
  createdBy: string;
  managementRemark?: string;
  approvedBy?: string;
  approvedAt?: string;
}

type ApprovalAction = 'approve' | 'reject' | 'sendBack';
type ApprovalForm = {
  managementRemark: string;
  action: ApprovalAction;
};

const initialApprovalForm: ApprovalForm = {
  managementRemark: '',
  action: 'approve',
};

export default function TrainingApproval() {
  const [trainingTopics, setTrainingTopics] = useState<TrainingTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Approval state
  const [selectedTopic, setSelectedTopic] = useState<TrainingTopic | null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>(initialApprovalForm);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [viewingTopic, setViewingTopic] = useState<TrainingTopic | null>(null);

  // Permissions
  const canApprove = can('managementPending', 'approve') || can('trainingSchedule', 'approve');
  const canReject = can('managementPending', 'reject') || can('trainingSchedule', 'reject');

  const loadTrainingTopics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-topics?status=Pending Approval');
      setTrainingTopics(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load training topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrainingTopics();
  }, []);

  const openApprovalModal = (topic: TrainingTopic, action: ApprovalAction) => {
    setSelectedTopic(topic);
    setApprovalForm({
      managementRemark: '',
      action,
    });
    setIsApprovalModalOpen(true);
    setError('');
  };

  const openViewModal = (topic: TrainingTopic) => {
    setViewingTopic(topic);
  };

  const submitApproval = async () => {
    if (!selectedTopic) return;

    if (approvalForm.action === 'reject' && !approvalForm.managementRemark.trim()) {
      return setError('Remarks are required for rejection');
    }

    if (approvalForm.action === 'sendBack' && !approvalForm.managementRemark.trim()) {
      return setError('Remarks are required for sending back');
    }

    setLoading(true);
    try {
      const endpoint = `/training-topics/${selectedTopic._id}/${approvalForm.action}`;
      const payload = {
        managementRemark: approvalForm.managementRemark.trim(),
      };

      await api.post(endpoint, payload);
      await loadTrainingTopics();
      setIsApprovalModalOpen(false);
      setSelectedTopic(null);
      setApprovalForm(initialApprovalForm);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process approval');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Pending Approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Sent Back':
        return 'bg-orange-100 text-orange-800';
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

  const getActionColor = (action: ApprovalAction) => {
    switch (action) {
      case 'approve':
        return 'bg-green-600 text-white hover:bg-green-700';
      case 'reject':
        return 'bg-red-600 text-white hover:bg-red-700';
      case 'sendBack':
        return 'bg-orange-600 text-white hover:bg-orange-700';
      default:
        return 'bg-gray-600 text-white hover:bg-gray-700';
    }
  };

  const getActionIcon = (action: ApprovalAction) => {
    switch (action) {
      case 'approve':
        return <CheckCircle className="w-4 h-4" />;
      case 'reject':
        return <XCircle className="w-4 h-4" />;
      case 'sendBack':
        return <RotateCcw className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getActionText = (action: ApprovalAction) => {
    switch (action) {
      case 'approve':
        return 'Approve';
      case 'reject':
        return 'Reject';
      case 'sendBack':
        return 'Send Back';
      default:
        return 'Action';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Training Approval</h2>
        <p className="text-gray-600">Review and approve training topic proposals</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : trainingTopics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No training topics pending approval</p>
        </div>
      ) : (
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
                  Created By
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
                    {topic.createdBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openViewModal(topic)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canApprove && (
                        <button
                          onClick={() => openApprovalModal(topic, 'approve')}
                          className="text-green-600 hover:text-green-800"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {canReject && (
                        <button
                          onClick={() => openApprovalModal(topic, 'reject')}
                          className="text-red-600 hover:text-red-800"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {(canApprove || canReject) && (
                        <button
                          onClick={() => openApprovalModal(topic, 'sendBack')}
                          className="text-orange-600 hover:text-orange-800"
                          title="Send Back"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approval Modal */}
      {isApprovalModalOpen && selectedTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {getActionText(approvalForm.action)} Training Topic
              </h3>
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium text-gray-900 mb-2">{selectedTopic.trainingName}</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Training ID:</span> {selectedTopic.trainingId}</p>
                  <p><span className="font-medium">Capability:</span> {selectedTopic.capabilityArea} - {selectedTopic.capabilitySkill}</p>
                  <p><span className="font-medium">Type:</span> {selectedTopic.type}</p>
                  <p><span className="font-medium">Trainer:</span> {selectedTopic.trainerName}</p>
                  <p><span className="font-medium">Proposed Date:</span> {new Date(selectedTopic.proposedScheduleDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Management Remark {approvalForm.action !== 'approve' && '*'}
              </label>
              <textarea
                value={approvalForm.managementRemark}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, managementRemark: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder={
                  approvalForm.action === 'approve' 
                    ? 'Optional remarks for approval...'
                    : 'Please provide reasons for this action...'
                }
              />
              {approvalForm.action !== 'approve' && (
                <p className="text-xs text-red-500 mt-1">Remarks are required for {approvalForm.action === 'reject' ? 'rejection' : 'sending back'}</p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitApproval}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${getActionColor(approvalForm.action)}`}
              >
                {getActionIcon(approvalForm.action)}
                {loading ? 'Processing...' : getActionText(approvalForm.action)}
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

              {viewingTopic.managementRemark && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Management Remark</p>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                    {viewingTopic.managementRemark}
                  </p>
                </div>
              )}

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

              {viewingTopic.approvedBy && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Approved By</p>
                    <p className="text-sm text-gray-900">{viewingTopic.approvedBy}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Approved At</p>
                    <p className="text-sm text-gray-900">
                      {viewingTopic.approvedAt ? new Date(viewingTopic.approvedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {(viewingTopic.contentPdfLink || viewingTopic.videoLink || viewingTopic.assessmentLink) && (
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
                        📄 Content PDF
                      </a>
                    )}
                    {viewingTopic.videoLink && (
                      <a
                        href={viewingTopic.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        🎥 Video Content
                      </a>
                    )}
                    {viewingTopic.assessmentLink && (
                      <a
                        href={viewingTopic.assessmentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        📝 Assessment
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {(canApprove || canReject) && viewingTopic.status === 'Pending Approval' && (
                <>
                  <button
                    onClick={() => {
                      setViewingTopic(null);
                      openApprovalModal(viewingTopic, 'approve');
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setViewingTopic(null);
                      openApprovalModal(viewingTopic, 'reject');
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setViewingTopic(null);
                      openApprovalModal(viewingTopic, 'sendBack');
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                  >
                    Send Back
                  </button>
                </>
              )}
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
