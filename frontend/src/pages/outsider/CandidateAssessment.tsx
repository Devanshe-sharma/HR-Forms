'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type ExcelQuestion = {
  qNo: number;
  type: 'mcq' | 'practical';
  question: string;
  options?: { A: string; B: string; C: string; D: string };
  sampleData?: string;
};

type ExcelContext = {
  full_name: string;
  questions: ExcelQuestion[];
  status: string;
  answers: { qNo: number; selectedOption?: string; answer?: string }[];
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
  const [excelAnswers, setExcelAnswers] = useState<Record<number, string>>({});
  const [discAnswers, setDiscAnswers]   = useState<string[]>([]);
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
          const init: Record<number, string> = {};
          (res.data as ExcelContext).questions.forEach((q) => { init[q.qNo] = ''; });
          setExcelAnswers(init);
        } else {
          setDiscAnswers(new Array((res.data as DiscContext).questions.length).fill(''));
        }
        setLoading(false);
      })
      .catch(() => { setError('Something went wrong loading this assessment.'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, kind, sig]);

  const handleSubmit = async () => {
    if (kind === 'excel') {
      const questions = (context as ExcelContext).questions;
      if (questions.some((q) => !excelAnswers[q.qNo]?.trim())) {
        setError('Please answer every question before submitting.');
        return;
      }
    } else {
      if (discAnswers.some((a) => !a)) {
        setError('Please answer every question before submitting.');
        return;
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const body = kind === 'excel'
        ? {
            answers: (context as ExcelContext).questions.map((q) => (
              q.type === 'mcq'
                ? { qNo: q.qNo, selectedOption: excelAnswers[q.qNo] }
                : { qNo: q.qNo, answer: excelAnswers[q.qNo] }
            )),
          }
        : { answers: discAnswers };

      const res = await fetch(`${API_BASE}/applicant-records/${recordId}/assessments/${kind}/submit?sig=${encodeURIComponent(sig)}`, {
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

  if (!isValidKind || (error && !context)) {
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

  const title = kind === 'excel' ? 'Basic Excel Skills Test' : 'DISC Assessment';

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      <nav className="bg-lime-600 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">{title}</h1>
          {context?.full_name && <p className="text-lime-100 text-sm mt-1">Hi {context.full_name}, please complete the assessment below.</p>}
          {kind === 'excel' && (
            <p className="text-lime-100 text-xs mt-2">
              20 multiple-choice questions, then 10 practical tasks — write the actual formula or describe the steps, don't just name the feature.
            </p>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-2xl">
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          {kind === 'excel'
            ? (context as ExcelContext).questions.map((q) => (
                <div key={q.qNo}>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    {q.qNo}. {q.question}
                  </label>
                  {q.sampleData && (
                    <p className="text-xs text-gray-500 mb-2">Sample data: {q.sampleData}</p>
                  )}
                  {q.type === 'mcq' && q.options ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {(Object.keys(q.options) as ('A' | 'B' | 'C' | 'D')[]).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setExcelAnswers((prev) => ({ ...prev, [q.qNo]: opt }))}
                          className={`border rounded-lg px-3 py-2 text-sm text-left transition ${
                            excelAnswers[q.qNo] === opt ? 'border-lime-500 bg-lime-50 text-lime-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-bold mr-1">{opt}.</span>{q.options![opt]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={excelAnswers[q.qNo] || ''}
                      onChange={(e) => setExcelAnswers((prev) => ({ ...prev, [q.qNo]: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono mt-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
                      placeholder="Write the actual formula, or describe the steps..."
                    />
                  )}
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
                        onClick={() => setDiscAnswers((prev) => prev.map((a, idx) => idx === i ? trait : a))}
                        className={`border rounded-lg px-3 py-2 text-sm text-left transition ${
                          discAnswers[i] === trait ? 'border-lime-500 bg-lime-50 text-lime-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
