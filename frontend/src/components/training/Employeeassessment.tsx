import { useEffect, useState } from 'react';
import axios from 'axios';
import { getRole } from '../../config/rbac';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

interface AssessmentRecord {
  _id: string;
  trainingId: string;
  trainingName: string;
  employeeName: string;
  employeeId: string;
  score: number;
  maxScore: number;
  attemptNumber: number;
  submittedAt: string;
  status: 'Pass' | 'Fail';
}

export default function EmployeeAssessment() {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-assessments');
      setAssessments(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAssessments(); }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-2">Employee Assessments</h2>
        <p className="text-gray-400 text-sm">View assessment results for completed trainings</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📝</div>
          <p className="font-medium">No assessment records yet</p>
          <p className="text-sm mt-1">Assessment results will appear here once employees complete their trainings.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Training', 'Employee', 'Score', 'Attempt', 'Status', 'Submitted'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assessments.map(a => (
                <tr key={a._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{a.trainingName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{a.employeeName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{a.score} / {a.maxScore}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.attemptNumber}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${a.status === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(a.submittedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}