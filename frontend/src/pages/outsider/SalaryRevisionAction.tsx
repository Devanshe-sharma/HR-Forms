'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type ManagerDecision = {
  decision: string | null;
  recommendedPct: number | null;
  pipDurationMonths: number | null;
  pipNewDueDate: string | null;
  reason: string;
} | null;

type Context = {
  employeeName: string;
  department: string;
  designation: string;
  previousCtc: number;
  managerName: string;
  stage: string;
  actionable: boolean;
  managerDecision?: ManagerDecision;
};

export default function SalaryRevisionAction() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || '';
  const sig = searchParams.get('sig') || '';
  const isManagerRole = role === 'manager';

  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Manager form state
  const [decision, setDecision] = useState<'increment' | 'pip'>('increment');
  const [recommendedPct, setRecommendedPct] = useState('');
  const [pipDurationMonths, setPipDurationMonths] = useState('');
  const [pipNewDueDate, setPipNewDueDate] = useState('');

  // Management form state
  const [finalPct, setFinalPct] = useState('');
  const [pipApproved, setPipApproved] = useState(true);

  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!id || !role || !sig) { setError('This link is invalid.'); setLoading(false); return; }
    fetch(`${API_BASE}/salary-revisions/${id}/mail-action?role=${encodeURIComponent(role)}&sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.message || 'This link could not be verified.'); setLoading(false); return; }
        setContext(res.data);
        if (res.data.managerDecision?.recommendedPct != null) {
          setFinalPct(String(res.data.managerDecision.recommendedPct));
        }
        setLoading(false);
      })
      .catch(() => { setError('Something went wrong loading this form.'); setLoading(false); });
  }, [id, role, sig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = { role, sig, reason };
      if (isManagerRole) {
        body.decision = decision;
        if (decision === 'increment') {
          body.recommendedPct = Number(recommendedPct) || 0;
        } else {
          body.pipDurationMonths = Number(pipDurationMonths) || null;
          body.pipNewDueDate = pipNewDueDate || null;
        }
      } else if (context?.managerDecision?.decision === 'increment') {
        body.finalPct = Number(finalPct) || 0;
      } else {
        body.pipApproved = pipApproved;
      }

      const res = await fetch(`${API_BASE}/salary-revisions/${id}/mail-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to submit.');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  if (error && !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lime-50 text-center px-4">
        <div>
          <h2 className="text-2xl font-bold text-lime-800 mb-2">Thank you!</h2>
          <p className="text-gray-700">Your decision has been recorded.</p>
        </div>
      </div>
    );
  }

  if (context && !context.actionable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <div className="max-w-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Already handled</h2>
          <p className="text-gray-600">
            This request has already moved on (current stage: {context.stage}) — no action is needed from this link.
          </p>
        </div>
      </div>
    );
  }

  const mgrDecision = context?.managerDecision;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="bg-slate-800 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">
            Salary Revision — {isManagerRole ? 'Manager Recommendation' : 'Management Decision'}
          </h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-xl">
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-1.5">
          <p className="text-sm text-gray-500">Employee</p>
          <p className="text-xl font-bold text-slate-800">{context?.employeeName}</p>
          <p className="text-sm text-gray-600">{context?.designation} · {context?.department}</p>
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-semibold text-gray-500">Current CTC:</span> ₹{context?.previousCtc?.toLocaleString('en-IN')}
          </p>
          {!isManagerRole && (
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-500">Reporting Manager:</span> {context?.managerName || '—'}
            </p>
          )}
        </div>

        {!isManagerRole && mgrDecision && (
          <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-1.5">
            <p className="text-sm font-semibold text-gray-700 mb-1">Manager's Recommendation</p>
            {mgrDecision.decision === 'pip' ? (
              <>
                <p className="text-sm text-gray-600">Place on PIP — {mgrDecision.pipDurationMonths} month(s)</p>
                {mgrDecision.pipNewDueDate && (
                  <p className="text-sm text-gray-600">
                    Proposed review date: {new Date(mgrDecision.pipNewDueDate).toLocaleDateString('en-IN')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-600">Recommended Increment: {mgrDecision.recommendedPct}%</p>
            )}
            {mgrDecision.reason && <p className="text-sm text-gray-600 italic mt-1">"{mgrDecision.reason}"</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          {isManagerRole ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Decision</label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as 'increment' | 'pip')}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="increment">Recommend Increment</option>
                  <option value="pip">Place on PIP</option>
                </select>
              </div>
              {decision === 'increment' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Recommended Increment (%)</label>
                  <input
                    type="number" step="0.01" required
                    value={recommendedPct}
                    onChange={(e) => setRecommendedPct(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">PIP Duration (months)</label>
                    <input
                      type="number" required
                      value={pipDurationMonths}
                      onChange={(e) => setPipDurationMonths(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Proposed Review Date</label>
                    <input
                      type="date"
                      value={pipNewDueDate}
                      onChange={(e) => setPipNewDueDate(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}
            </>
          ) : mgrDecision?.decision === 'increment' ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Final Increment (%)</label>
              <input
                type="number" step="0.01" required
                value={finalPct}
                onChange={(e) => setFinalPct(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">PIP Decision</label>
              <select
                value={pipApproved ? 'yes' : 'no'}
                onChange={(e) => setPipApproved(e.target.value === 'yes')}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="yes">Approve PIP</option>
                <option value="no">Reject — send back to manager</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Remarks</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Share your remarks…"
              className="w-full border rounded-lg px-3 py-2 resize-y"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {submitting ? 'Submitting…' : 'Submit Decision'}
          </button>
        </form>
      </div>
    </div>
  );
}
