'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

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
  referrerName: string;
  referrerEmail: string;
  candidateName: string;
  candidatePhone: string;
  candidateEmail: string;
  relationship: string;
};

const EMPTY_FORM: FormState = {
  referrerName: '', referrerEmail: '',
  candidateName: '', candidatePhone: '', candidateEmail: '',
  relationship: '',
};

export default function ReferCandidate() {
  const { requisitionId } = useParams<{ requisitionId: string }>();

  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);

  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resume) { setError("Please attach the candidate's resume (PDF)."); return; }
    setSubmitting(true);
    setError('');

    try {
      const body = new FormData();
      body.append('requisitionId', requisitionId || '');
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append('resume', resume);

      const res = await fetch(`${API_BASE}/referrals`, { method: 'POST', body });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">Refer a Candidate</h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-xl">
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

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Your details</h3>
            <div className="space-y-3">
              <input name="referrerName" value={form.referrerName} onChange={handleChange} required
                placeholder="Your full name" className="w-full border rounded-lg px-3 py-2" />
              <input name="referrerEmail" type="email" value={form.referrerEmail} onChange={handleChange} required
                placeholder="Your email" className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>

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
      </div>
    </div>
  );
}
