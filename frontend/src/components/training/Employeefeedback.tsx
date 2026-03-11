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

interface FeedbackRecord {
  _id: string;
  trainingId: string;
  trainingName: string;
  employeeName: string;
  rating: number; // 1–5
  comments: string;
  submittedAt: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={s <= rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  );
}

export default function EmployeeFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-feedback');
      setFeedbacks(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeedback(); }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-2">Employee Feedback</h2>
        <p className="text-gray-400 text-sm">Post-training feedback submitted by employees</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">💬</div>
          <p className="font-medium">No feedback submitted yet</p>
          <p className="text-sm mt-1">Employee feedback will appear here after trainings are completed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Training', 'Employee', 'Rating', 'Comments', 'Date'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {feedbacks.map(f => (
                <tr key={f._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{f.trainingName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{f.employeeName}</td>
                  <td className="px-6 py-4"><StarRating rating={f.rating} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{f.comments || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(f.submittedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}