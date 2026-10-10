'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type ExcelContext = {
  full_name: string;
  questions: string[];
  status: string;
  answers: { question: string; answer: string }[];
};

type DiscContext = {
  full_name: string;
  questions: { D: string; I: string; S: string; C: string }[];
  status: string;
};

export default function CandidateAssessment() {
  const { recordId, kind } = useParams<{ recordId: string; kind: 'excel' | 'disc' }>();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';

  const [context, setContext] = useState<ExcelContext | DiscContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const isValidKind = kind === 'excel' || kind === 'disc';

  useEffect(() => {
    if (!recordId || !isValidKind || !sig) { setError('This link is invalid.'); setLoading(false); return; }
    fetch(`${API_BASE}/applicant-records/${recordId}/assessments/${kind}/context?sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.message || 'This link could not be verified.'); setLoading(false); return; }
        setContext(res.data);
        if (kind === 'excel') {
          setAnswers(new Array((res.data as ExcelContext).questions.length).fill(''));
        } else {
          setAnswers(new Array((res.data as DiscContext).questions.length).fill(''));
        }
        setLoading(false);
      })
      .catch(() => { setError('Something went wrong loading this assessment.'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, kind, sig]);

  const handleSubmit = async () => {
    if (answers.some((a) => !a)) { setError('Please answer every question before submitting.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${recordId}/assessments/${kind}/submit?sig=${encodeURIComponent(sig)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
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

  if (!isValidKind || error && !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <p className="text-gray-600">{error || 'This link is invalid.'}</p>
      </div>
    );
  }

  if (submitted || (context && (kind === 'excel' ? (context as ExcelContext).status === 'Submitted' || (context as ExcelContext).status === 'Graded' : (context as DiscContext).status === 'Completed'))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lime-50 text-center px-4">
        <div>
          <h2 className="text-2xl font-bold text-lime-800 mb-2">Thank you!</h2>
          <p className="text-gray-700">Your {kind === 'excel' ? 'Excel Test' : 'DISC Assessment'} has been submitted.</p>
        </div>
      </div>
    );
  }

  const title = kind === 'excel' ? 'Excel Test' : 'DISC Assessment';

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">{title}</h1>
          {context?.full_name && <p className="text-lime-100 text-sm mt-1">Hi {context.full_name}, please complete the assessment below.</p>}
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-2xl">
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          {kind === 'excel'
            ? (context as ExcelContext).questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">{i + 1}. {q}</label>
                  <textarea
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers((prev) => prev.map((a, idx) => idx === i ? e.target.value : a))}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                    placeholder="Describe your approach..."
                  />
                </div>
              ))
            : (context as DiscContext).questions.map((q, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-gray-800 mb-2">{i + 1}. Which word best describes you?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(q) as ('D' | 'I' | 'S' | 'C')[]).map((trait) => (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => setAnswers((prev) => prev.map((a, idx) => idx === i ? trait : a))}
                        className={`border rounded-lg px-3 py-2 text-sm text-left transition ${
                          answers[i] === trait ? 'border-lime-500 bg-lime-50 text-lime-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {q[trait]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
