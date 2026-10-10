// pages/Recruitment/TimelineHistoryPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Top-level page (mockup's vTl) — a single candidate picker with the
// Timeline & History panel (TimelineHistoryTab) shown for whoever is
// selected. Separate from the per-candidate popup, matching the mockup.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import TimelineHistoryTab from './TimelineHistoryTab';
import { ApplicantRecord, API_BASE } from './applicantTypes';

export const TimelineHistoryDashboardTab: React.FC = () => {
  const [records, setRecords] = useState<ApplicantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    fetch(`${API_BASE}/applicant-records`)
      .then((r) => r.json())
      .then((res) => {
        const data: ApplicantRecord[] = res.data ?? [];
        setRecords(data);
        if (data.length) setSelectedId(data[0]._id);
        setLoading(false);
      })
      .catch(() => { toast.error('Failed to load candidates'); setLoading(false); });
  }, []);

  const selected = records.find((r) => r._id === selectedId) || null;

  return (
    <>
      <Toaster position="top-right" />
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Timeline &amp; History</h1>

          {loading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-10 text-center text-gray-400">
              No candidates yet.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-600">Candidate</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="min-w-[280px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                >
                  {records.map((r) => (
                    <option key={r._id} value={r._id}>{r.full_name} — {r.designation}</option>
                  ))}
                </select>
              </div>

              {selected && (
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <TimelineHistoryTab record={selected} />
                </div>
              )}
            </>
          )}
        </div>
    </>
  );
};

const TimelineHistoryPage: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="w-64 flex-shrink-0 z-10 bg-white border-r">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white shadow-sm z-20 flex items-center px-4">
          <Navbar />
        </div>

        <main className="flex-1 overflow-auto p-6">
          <TimelineHistoryDashboardTab />
        </main>
      </div>
    </div>
  );
};

export default TimelineHistoryPage;
