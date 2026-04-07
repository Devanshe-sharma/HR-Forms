import { useEffect, useState } from 'react';
import axios from 'axios';
import { getRole } from '../../config/rbac';

const API_BASE = process.env.API_BASE_URL;
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

interface ScorecardRow {
  employeeId: string;
  employeeName: string;
  dept: string;
  desig: string;
  trainingsAttended: number;
  trainingsCompleted: number;
  avgScore: number;         // assessment avg %
  avgFeedbackRating: number; // 1–5
  passRate: number;         // %
}

function RatingDot({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export default function TrainingScorecard() {
  const [rows, setRows] = useState<ScorecardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadScorecard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-scorecard');
      setRows(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScorecard(); }, []);

  const filtered = rows.filter(r =>
    r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    r.dept.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base text-gray-700 mb-2">Training Scorecard</h2>
          <p className="text-gray-400 text-sm">Consolidated training performance across all employees</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or dept…"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📊</div>
          <p className="font-medium">{rows.length === 0 ? 'No scorecard data yet' : 'No results match your search'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Employee', 'Department', 'Designation', 'Attended', 'Completed', 'Avg Score %', 'Pass Rate %', 'Feedback Rating'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(row => (
                <tr key={row.employeeId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-medium text-gray-900">{row.employeeName}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{row.dept}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{row.desig}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 text-center">{row.trainingsAttended}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 text-center">{row.trainingsCompleted}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 w-36">
                    <RatingDot value={row.avgScore} max={100} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-900 w-36">
                    <RatingDot value={row.passRate} max={100} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-900 w-36">
                    <RatingDot value={row.avgFeedbackRating} max={5} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}