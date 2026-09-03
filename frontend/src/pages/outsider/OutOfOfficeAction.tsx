'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type Context = {
  personName: string;
  startDateTime: string;
  upToDate?: string;
  upToTime: string;
  reason: string;
  managerName: string;
  approvalStatus: string;
  actionable: boolean;
};

export default function OutOfOfficeAction() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';

  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);

  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!id || !sig) { setError('This link is invalid.'); setLoading(false); return; }
    fetch(`${API_BASE}/out-of-office/${id}/mail-action?sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.message || 'This link could not be verified.'); setLoading(false); return; }
        setContext(res.data);
        setLoading(false);
      })
      .catch(() => { setError('Something went wrong loading this form.'); setLoading(false); });
  }, [id, sig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (decision === 'rejected' && !reason.trim()) { setError('Please provide a reason for rejecting.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/out-of-office/${id}/mail-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sig, decision, reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to submit.');
        setSubmitting(false);
        return;
      }
      setSubmitted(decision);
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
      <div className={`min-h-screen flex items-center justify-center text-center px-4 ${submitted === 'approved' ? 'bg-lime-50' : 'bg-red-50'}`}>
        <div>
          <h2 className={`text-2xl font-bold mb-2 ${submitted === 'approved' ? 'text-lime-800' : 'text-red-800'}`}>
            {submitted === 'approved' ? 'Approved' : 'Rejected'}
          </h2>
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
            This request has already been {context.approvalStatus} — no action is needed from this link.
          </p>
        </div>
      </div>
    );
  }

  const upToLabel = context?.upToDate
    ? `${new Date(context.upToDate).toLocaleDateString('en-IN')}, ${context?.upToTime}`
    : context?.upToTime;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="bg-slate-800 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">Out of Office — Manager Approval</h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-xl">
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-1.5">
          <p className="text-sm text-gray-500">Person</p>
          <p className="text-xl font-bold text-slate-800">{context?.personName}</p>
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-semibold text-gray-500">Date:</span>{' '}
            {context?.startDateTime && new Date(context.startDateTime).toLocaleDateString('en-IN')}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-500">Timing:</span>{' '}
            {context?.startDateTime && new Date(context.startDateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })} – {upToLabel}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-500">Reason:</span> {context?.reason}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Decision</label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as 'approved' | 'rejected')}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Reason{decision === 'rejected' ? ' (required)' : ' (optional)'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder={decision === 'rejected' ? 'Explain why this is being rejected…' : 'Any remarks…'}
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
