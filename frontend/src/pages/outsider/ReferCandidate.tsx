'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type Requisition = {
  _id: string;
  designation: string;
  hiring_dept: string;
  fmsStatus: 'Open' | 'Closed';
  jd_link?: string;
  role_link?: string;
};

type FormState = {
  candidateName: string;
  candidatePhone: string;
  candidateEmail: string;
  relationship: string;
};

const EMPTY_FORM: FormState = {
  candidateName: '', candidatePhone: '', candidateEmail: '',
  relationship: '',
};

type DuplicateInfo = {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  designation: string;
  status: string;
};

type MyReferral = {
  _id: string;
  candidateName: string;
  designation: string;
  status: string;
  createdAt: string;
};

export default function ReferCandidate() {
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const { user } = useAuth();

  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);

  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  const [showMine, setShowMine] = useState(false);
  const [mine, setMine] = useState<MyReferral[]>([]);
  const [mineLoading, setMineLoading] = useState(false);

  useEffect(() => {
    if (!requisitionId) { setNotFound(true); setLoading(false); return; }
    fetch(`${API_BASE}/hiringrequisitions/${requisitionId}/referral-info`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.data) setRequisition(res.data);
        else setNotFound(true);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [requisitionId]);

  const loadMine = async () => {
    setMineLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/referrals/mine`);
      setMine(res.data?.data ?? []);
    } catch {
      // best-effort — leave the list empty rather than block the page
    } finally {
      setMineLoading(false);
    }
  };

  const toggleMine = () => {
    const next = !showMine;
    setShowMine(next);
    if (next && mine.length === 0) loadMine();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.type !== 'application/pdf') {
      setError('Only PDF files are accepted for the resume.');
      setResume(null);
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Resume must be under 5MB.');
      setResume(null);
      return;
    }
    setError('');
    setResume(file);
  };

  const submitReferral = async (confirmDuplicate: boolean) => {
    if (!resume) { setError("Please attach the candidate's resume (PDF)."); return; }
    setSubmitting(true);
    setError('');

    try {
      const body = new FormData();
      body.append('requisitionId', requisitionId || '');
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append('resume', resume);
      if (confirmDuplicate) body.append('confirmDuplicate', 'true');

      const res = await axios.post(`${API_BASE}/referrals`, body);
      const data = res.data;

      if (!data.success) {
        setError(data.message || 'Something went wrong. Please try again.');
        return;
      }
      if (data.duplicate) {
        setDuplicate(data.existing);
        return;
      }

      setDuplicate(null);
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitReferral(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">This referral link is invalid or has expired.</p>
      </div>
    );
  }

  if (requisition && requisition.fmsStatus !== 'Open') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <p className="text-gray-600">
          The <b>{requisition.designation}</b> position is no longer open for referrals. Thank you for thinking of us!
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lime-50 text-center px-4">
        <div>
          <h2 className="text-2xl font-bold text-lime-800 mb-2">Thank you!</h2>
          <p className="text-gray-700">Your referral has been sent to HR. We'll be in touch with your candidate soon.</p>
          <button onClick={toggleMine} className="mt-4 text-sm text-lime-700 underline font-medium">
            View my referrals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">Refer a Candidate</h1>
          <button onClick={toggleMine} className="text-white text-sm font-semibold underline">
            {showMine ? 'Back to form' : 'My Referrals'}
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-xl">
        {user?.name && (
          <p className="text-sm text-gray-500 mb-4">Referring as <span className="font-semibold text-gray-700">{user.name}</span> ({user.email})</p>
        )}

        {showMine ? (
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-3">My Referrals</h3>
            {mineLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : mine.length === 0 ? (
              <p className="text-sm text-gray-400">You haven't referred anyone yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {mine.map((r) => (
                  <div key={r._id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{r.candidateName}</p>
                      <p className="text-xs text-gray-400">{r.designation}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-lime-100 text-lime-700">{r.status || 'Submitted'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <p className="text-sm text-gray-500">Hiring for</p>
              <p className="text-xl font-bold text-lime-800">{requisition?.designation}</p>
              <p className="text-sm text-gray-600">{requisition?.hiring_dept}</p>
              {(requisition?.jd_link || requisition?.role_link) && (
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
                  {requisition?.jd_link && (
                    <a href={requisition.jd_link} target="_blank" rel="noreferrer" className="text-sm text-lime-700 underline font-medium">
                      View Job Description
                    </a>
                  )}
                  {requisition?.role_link && (
                    <a href={requisition.role_link} target="_blank" rel="noreferrer" className="text-sm text-lime-700 underline font-medium">
                      View Role Details
                    </a>
                  )}
                </div>
              )}
            </div>

            {duplicate ? (
              <div className="bg-white rounded-xl shadow p-6 space-y-4">
                <h3 className="font-semibold text-amber-700">A matching candidate already exists</h3>
                <div className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p><b>{duplicate.full_name}</b> — {duplicate.designation || 'No role on file'}</p>
                  <p className="text-xs text-gray-500 mt-1">{duplicate.email} · {duplicate.phone}</p>
                  <p className="text-xs text-gray-500 mt-1">Current status: {duplicate.status || 'New'}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDuplicate(null)}
                    className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitReferral(true)}
                    disabled={submitting}
                    className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg"
                  >
                    {submitting ? 'Submitting…' : 'Refer Anyway'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Candidate details</h3>
                  <div className="space-y-3">
                    <input name="candidateName" value={form.candidateName} onChange={handleChange} required
                      placeholder="Candidate's full name" className="w-full border rounded-lg px-3 py-2" />
                    <input name="candidatePhone" value={form.candidatePhone} onChange={handleChange} required
                      placeholder="Candidate's phone number" className="w-full border rounded-lg px-3 py-2" />
                    <input name="candidateEmail" type="email" value={form.candidateEmail} onChange={handleChange} required
                      placeholder="Candidate's email" className="w-full border rounded-lg px-3 py-2" />
                    <input name="relationship" value={form.relationship} onChange={handleChange}
                      placeholder="How do you know them? (optional)" className="w-full border rounded-lg px-3 py-2" />
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Candidate's resume (PDF, max 5MB)</label>
                      <input type="file" accept="application/pdf" onChange={handleFile} required
                        className="w-full text-sm" />
                    </div>
                  </div>
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <button type="submit" disabled={submitting}
                  className="w-full bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
                  {submitting ? 'Submitting…' : 'Submit Referral'}
                </button>
              </form>
            )}
          </>
        )}

        <p className="text-center mt-6">
          <Link to="/hr-dashboard" className="text-xs text-gray-400 underline">Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
