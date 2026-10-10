// pages/Recruitment/OfferJoiningPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Top-level page (mockup's vOffer) — a candidate list + picker, with the
// Offer Management / Joining Management panels (OfferPlacementTab) shown for
// whichever candidate is selected. Separate from the per-candidate popup now,
// matching the mockup's layout instead of living as a modal tab.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import OfferPlacementTab from './OfferPlacementTab';
import { hasAnyRole } from '../../config/rbac';
import { ApplicantRecord, API_BASE, hasPassedRound, DECISION_COLORS } from './applicantTypes';

export const OfferJoiningTab: React.FC = () => {
  const [records, setRecords] = useState<ApplicantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canSeeFinancials = hasAnyRole(['Admin', 'HR', 'Management']);

  useEffect(() => {
    fetch(`${API_BASE}/applicant-records`)
      .then((r) => r.json())
      .then((res) => {
        const eligible = (res.data ?? []).filter((r: ApplicantRecord) => hasPassedRound(r.interviewRounds, 'mgmt'));
        setRecords(eligible);
        if (eligible.length) setSelectedId(eligible[0]._id);
        setLoading(false);
      })
      .catch(() => { toast.error('Failed to load candidates'); setLoading(false); });
  }, []);

  const selected = records.find((r) => r._id === selectedId) || null;

  const handleUpdate = (updated: ApplicantRecord) => {
    setRecords((prev) => prev.map((r) => r._id === updated._id ? updated : r));
  };

  return (
    <>
      <Toaster position="top-right" />
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Offer &amp; Joining</h1>

          {loading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-10 text-center text-gray-400">
              No candidates have reached the selection stage yet.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b font-semibold text-gray-600">
                    <tr>
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Position</th>
                      <th className="p-3">Offer Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((r) => (
                      <tr key={r._id} className={r._id === selectedId ? 'bg-lime-50/60' : 'hover:bg-gray-50'}>
                        <td className="p-3 font-semibold text-gray-800">{r.full_name}</td>
                        <td className="p-3 text-gray-500">{r.designation}</td>
                        <td className="p-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DECISION_COLORS[r.finalDecision?.decision || 'Pending']}`}>
                            {r.finalDecision?.decision || 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedId(r._id)}
                            className="text-xs font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 px-3 py-1.5 rounded-lg transition"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected && (
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <p className="text-sm font-bold text-gray-800 mb-4">{selected.full_name} — {selected.designation}</p>
                  <OfferPlacementTab record={selected} onUpdate={handleUpdate} canSeeFinancials={canSeeFinancials} />
                </div>
              )}
            </>
          )}
        </div>
    </>
  );
};

const OfferJoiningPage: React.FC = () => {
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
          <OfferJoiningTab />
        </main>
      </div>
    </div>
  );
};

export default OfferJoiningPage;
