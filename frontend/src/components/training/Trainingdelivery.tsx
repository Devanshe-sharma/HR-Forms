import { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, X, FileText, Video, FileCheck } from 'lucide-react';
import { getRole } from '../../config/rbac';

const API_BASE = process.env.API_BASE_URL || 'http://3.109.132.204:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

interface CompletedTraining {
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
  // flat targeting arrays (inherited from topic)
  targetLevels:      string[];
  targetRoles:       string[];
  targetDepartments: string[];
  attendanceRequired: boolean;
  maxAttempts: number;
  feedbackWindow: number;
  status: 'Completed';
  contentPdfLink?: string;
  videoLink?: string;
  assessmentLink?: string;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  '1': 'Strategic', '2': 'Sr Management', '3': 'Middle Management',
  '4': 'Junior Management', '5': 'Staff',
};

function audienceText(t: CompletedTraining): string {
  if (t.type === 'Generic') return 'All Employees';
  if (t.type === 'Level Specific' && t.targetLevels?.length)
    return t.targetLevels.map(v => LEVEL_LABELS[v] || `Level ${v}`).join(', ');
  if (t.type === 'Dept Specific' && t.targetDepartments?.length)
    return `${t.targetDepartments.length} Dept(s)`;
  if (t.type === 'Role Specific' && t.targetRoles?.length)
    return `${t.targetRoles.length} Role(s)`;
  return t.type;
}

export default function TrainingDelivery() {
  const [trainings, setTrainings]           = useState<CompletedTraining[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [search, setSearch]                 = useState('');
  const [filterType, setFilterType]         = useState('');
  const [viewingTraining, setViewingTraining] = useState<CompletedTraining | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-schedules?status=Completed');
      setTrainings(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load completed trainings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Generic':        return 'bg-green-100 text-green-800';
      case 'Dept Specific':  return 'bg-blue-100 text-blue-800';
      case 'Level Specific': return 'bg-purple-100 text-purple-800';
      case 'Role Specific':  return 'bg-orange-100 text-orange-800';
      default:               return 'bg-gray-100 text-gray-800';
    }
  };

  const filtered = trainings.filter(t => {
    const matchSearch =
      t.trainingName.toLowerCase().includes(search.toLowerCase()) ||
      t.capabilitySkill.toLowerCase().includes(search.toLowerCase()) ||
      t.trainerName.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType ? t.type === filterType : true;
    return matchSearch && matchType;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-1">Training Delivery</h2>
        <p className="text-gray-400 text-sm">All successfully completed training sessions</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Completed', value: trainings.length,                                         color: 'bg-blue-50 text-blue-700 border-blue-100' },
          { label: 'Generic',         value: trainings.filter(t => t.type === 'Generic').length,        color: 'bg-green-50 text-green-700 border-green-100' },
          { label: 'Dept Specific',   value: trainings.filter(t => t.type === 'Dept Specific').length,  color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
          { label: 'Role / Level',    value: trainings.filter(t => t.type === 'Role Specific' || t.type === 'Level Specific').length, color: 'bg-orange-50 text-orange-700 border-orange-100' },
        ].map(card => (
          <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs mt-1 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, skill, or trainer…"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          <option value="Generic">Generic</option>
          <option value="Dept Specific">Dept Specific</option>
          <option value="Level Specific">Level Specific</option>
          <option value="Role Specific">Role Specific</option>
        </select>
        {(search || filterType) && (
          <button onClick={() => { setSearch(''); setFilterType(''); }}
            className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🎓</div>
          <p className="font-medium">{trainings.length === 0 ? 'No completed trainings yet' : 'No results match your filters'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Training ID', 'Training Name', 'Capability Skill', 'Trainer', 'Type', 'Date', 'Time', 'Audience', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(t => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 text-sm text-gray-500 font-mono">{t.trainingId}</td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900 max-w-[180px] truncate">{t.trainingName}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{t.capabilitySkill}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{t.trainerName}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(t.type)}`}>{t.type}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(t.trainingDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{t.startTime} – {t.endTime}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">{audienceText(t)}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => setViewingTraining(t)} className="text-blue-600 hover:text-blue-800" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewingTraining && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{viewingTraining.trainingName}</h3>
                <span className="text-xs text-gray-400 font-mono">{viewingTraining.trainingId}</span>
              </div>
              <button onClick={() => setViewingTraining(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">✓ Completed</span>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Capability Area</p><p className="text-sm text-gray-900">{viewingTraining.capabilityArea}</p></div>
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Capability Skill</p><p className="text-sm text-gray-900">{viewingTraining.capabilitySkill}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Trainer</p><p className="text-sm text-gray-900">{viewingTraining.trainerName}</p></div>
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Type</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(viewingTraining.type)}`}>{viewingTraining.type}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Date</p><p className="text-sm text-gray-900">{new Date(viewingTraining.trainingDate).toLocaleDateString()}</p></div>
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Time</p><p className="text-sm text-gray-900">{viewingTraining.startTime} – {viewingTraining.endTime}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Venue</p><p className="text-sm text-gray-900">{viewingTraining.venue || 'N/A'}</p></div>
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Online Link</p>
                  {viewingTraining.onlineLink
                    ? <a href={viewingTraining.onlineLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm">Join Online</a>
                    : <p className="text-sm text-gray-500">N/A</p>}
                </div>
              </div>
              <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Target Audience</p><p className="text-sm text-gray-900">{audienceText(viewingTraining)}</p></div>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Attendance</p><p className="text-sm text-gray-900">{viewingTraining.attendanceRequired ? 'Required' : 'Optional'}</p></div>
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Max Attempts</p><p className="text-sm text-gray-900">{viewingTraining.maxAttempts}</p></div>
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Feedback Window</p><p className="text-sm text-gray-900">{viewingTraining.feedbackWindow}h</p></div>
              </div>
              {(viewingTraining.contentPdfLink || viewingTraining.videoLink || viewingTraining.assessmentLink) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Content</p>
                  <div className="flex flex-wrap gap-4">
                    {viewingTraining.contentPdfLink && (
                      <a href={viewingTraining.contentPdfLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm">
                        <FileText className="w-4 h-4" /> Content PDF
                      </a>
                    )}
                    {viewingTraining.videoLink && (
                      <a href={viewingTraining.videoLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm">
                        <Video className="w-4 h-4" /> Video
                      </a>
                    )}
                    {viewingTraining.assessmentLink && (
                      <a href={viewingTraining.assessmentLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm">
                        <FileCheck className="w-4 h-4" /> Assessment
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Created By</p><p className="text-sm text-gray-900">{viewingTraining.createdBy}</p></div>
                {viewingTraining.approvedBy && (
                  <div><p className="text-xs font-medium text-gray-500 uppercase mb-1">Approved By</p><p className="text-sm text-gray-900">{viewingTraining.approvedBy}</p></div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setViewingTraining(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}