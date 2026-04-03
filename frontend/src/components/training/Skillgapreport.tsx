import { useEffect, useState } from 'react';
import axios from 'axios';
import { getRole } from '../../config/rbac';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface GapRow {
  employeeId:       string;
  employeeName:     string;
  employeeRole:     string;
  dept:             string;
  capabilityArea:   string;
  capabilitySkill:  string;
  requiredScore:    number;
  actualScore:      number;
  gap:              number;
  isMandatory:      boolean;
  evaluatedBy:      string;
  evaluatedAt:      string;
}

interface Summary {
  totalEvaluated:  number;
  withGap:         number;
  mandatoryGaps:   number;
  avgGap:          number;
}

// ─── Gap severity ─────────────────────────────────────────────────────────────

function gapSeverity(gap: number): { label: string; cls: string } {
  if (gap >= 0) return { label: 'Met',      cls: 'bg-green-100 text-green-800' };
  if (gap >= 2) return { label: 'Minor',    cls: 'bg-yellow-100 text-yellow-800' };
  if (gap >= 4) return { label: 'Moderate', cls: 'bg-orange-100 text-orange-800' };
  return            { label: 'Critical',   cls: 'bg-red-100 text-red-800' };
}

function GapBar({ required, actual }: { required: number; actual: number }) {
  const pct = Math.min(100, Math.round((actual / required) * 100));
  const color = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1 min-w-[80px]">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{actual}/{required}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillGapReport() {
  const [rows, setRows]         = useState<GapRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterGap, setFilterGap]   = useState<'all' | 'gaps-only' | 'mandatory-gaps'>('all');

  const currentRole = getRole();
  const isEmployee  = currentRole === 'Employee';
  const isManager   = currentRole === 'Manager' || currentRole === 'HeadOfDepartment';

  const loadGaps = async () => {
    setLoading(true);
    try {
      // Backend returns rows filtered by role:
      // - HR / Management → all employees
      // - Manager / HOD   → their team only
      // - Employee        → their own rows only
      const res = await api.get('/capability-evaluations/skill-gaps');
      setRows(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load skill gap report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGaps(); }, []);

  // ── Derived data ───────────────────────────────────────────────────────────

  const areas = [...new Set(rows.map(r => r.capabilityArea))].sort();

  const filtered = rows.filter(r => {
    const matchSearch =
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.capabilitySkill.toLowerCase().includes(search.toLowerCase()) ||
      r.dept.toLowerCase().includes(search.toLowerCase());
    const matchArea = filterArea ? r.capabilityArea === filterArea : true;
    const matchGap  =
      filterGap === 'gaps-only'       ? r.gap > 0 :
      filterGap === 'mandatory-gaps'  ? r.gap > 0 && r.isMandatory :
      true;
    return matchSearch && matchArea && matchGap;
  });

  const summary: Summary = {
    totalEvaluated: rows.length,
    withGap:        rows.filter(r => r.gap > 0).length,
    mandatoryGaps:  rows.filter(r => r.gap > 0 && r.isMandatory).length,
    avgGap:         rows.length
      ? parseFloat((rows.reduce((s, r) => s + Math.max(0, r.gap), 0) / rows.length).toFixed(1))
      : 0,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6 ">
        <h2 className="text-xl text-gray-700 mb-1">Skill Gap Report</h2>
        <p className="text-gray-400 text-sm">
          {isEmployee
            ? 'Your personal skill assessment and gaps'
            : isManager
            ? 'Skill gap analysis for your team'
            : 'Company-wide skill gap analysis from manager evaluations'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
      )}

      {/* Summary cards — hidden for employee view */}
      {!isEmployee && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Evaluations', value: summary.totalEvaluated, color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Skills with Gap',   value: summary.withGap,        color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
            { label: 'Mandatory Gaps',    value: summary.mandatoryGaps,  color: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Avg Gap Score',     value: summary.avgGap,         color: 'bg-orange-50 text-orange-700 border-orange-100' },
          ].map(card => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs mt-1 opacity-80">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, skill, or dept…"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Capability Areas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterGap} onChange={e => setFilterGap(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Rows</option>
          <option value="gaps-only">Gaps Only</option>
          <option value="mandatory-gaps">Mandatory Gaps Only</option>
        </select>
        {(search || filterArea || filterGap !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterArea(''); setFilterGap('all'); }}
            className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📊</div>
          <p className="font-medium">{rows.length === 0 ? 'No evaluations yet' : 'No results match your filters'}</p>
          <p className="text-sm mt-1">
            {rows.length === 0
              ? 'Skill gap data will appear here once managers submit evaluations.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  ...(!isEmployee ? ['Employee', 'Dept', 'Role'] : []),
                  'Capability', 'Skill', 'Score', 'Severity', 'Mandatory', "Manager",
                ].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((r, i) => {
                const sev = gapSeverity(r.gap);
                return (
                  <tr key={i} className={`hover:bg-gray-50 ${r.gap > 0 && r.isMandatory ? 'bg-red-50/30' : ''}`}>
                    {!isEmployee && (
                      <>
                        <td className="px-3 py-2 text-xs font-medium text-gray-900">{r.employeeName}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{r.dept}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{r.employeeRole}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-xs text-gray-500">{r.capabilityArea}</td>
                    <td className="px-3 py-2 text-xs text-gray-900">{r.capabilitySkill}</td>
                    <td className="px-3 py-2">
                      <GapBar required={r.requiredScore} actual={r.actualScore} />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1 py-0.5 text-xs rounded-full font-medium ${sev.cls}`}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isMandatory
                        ? <span className="px-1 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Yes</span>
                        : <span className="px-1 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">No</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.evaluatedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}