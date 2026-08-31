import React, { useEffect, useState } from 'react';
import { Mail, Phone, ExternalLink, Search } from 'lucide-react';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const STATUS_OPTIONS = ['New', 'Reviewed', 'Contacted', 'Converted', 'Rejected'] as const;
type Status = typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<Status, string> = {
  New:       'bg-blue-100 text-blue-700',
  Reviewed:  'bg-amber-100 text-amber-700',
  Contacted: 'bg-purple-100 text-purple-700',
  Converted: 'bg-green-100 text-green-700',
  Rejected:  'bg-red-100 text-red-700',
};

type Referral = {
  _id: string;
  serial_no?: number;
  designation: string;
  hiring_dept: string;
  referrerName: string;
  referrerEmail: string;
  candidateName: string;
  candidatePhone: string;
  candidateEmail: string;
  relationship?: string;
  resume: string;
  status: Status;
  createdAt: string;
};

export default function ReferralsTab() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`${API_BASE}/referrals?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => setReferrals(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setReferrals([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const updateStatus = async (id: string, status: Status) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE}/referrals/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setReferrals((prev) => prev.map((r) => (r._id === id ? { ...r, status } : r)));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Employee Referrals</h1>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate, referrer, role…"
                className="pl-9 pr-3 py-2 border rounded-lg text-sm w-72"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg text-sm px-3 py-2"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Referred By</th>
                  <th className="px-4 py-3">Resume</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Referred On</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
                )}
                {!loading && referrals.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No referrals yet.</td></tr>
                )}
                {referrals.map((r) => (
                  <tr key={r._id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{r.candidateName}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{r.candidateEmail}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{r.candidatePhone}</div>
                      {r.relationship && <div className="text-xs text-gray-400 mt-0.5">Relationship: {r.relationship}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.designation}</div>
                      <div className="text-xs text-gray-500">{r.hiring_dept}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{r.referrerName}</div>
                      <div className="text-xs text-gray-500">{r.referrerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={r.resume} target="_blank" rel="noreferrer" className="text-indigo-600 flex items-center gap-1 hover:underline">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        disabled={busyId === r._id}
                        onChange={(e) => updateStatus(r._id, e.target.value as Status)}
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${STATUS_COLORS[r.status]}`}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </div>
  );
}
