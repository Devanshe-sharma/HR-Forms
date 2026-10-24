'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, Star } from 'lucide-react';

// Standalone, login-free page opened from the "Send Feedback Mail" link —
// deliberately has no sidebar / navbar / dashboard, just this training's form.

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type TrainingInfo = {
  trainingName: string;
  trainerName: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  completed: boolean;
  feedbackClosesAt: string | null;
  open: boolean;
};

const fmtIst = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className="focus:outline-none"
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}>
          <Star className={`w-7 h-7 transition-colors ${n <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm text-gray-500 self-center">{value}/5</span>}
    </div>
  );
}

export default function TrainingFeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';

  const [training, setTraining] = useState<TrainingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [trainerRating, setTrainerRating] = useState(0);
  const [contentRating, setContentRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [improvements, setImprovements] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id || !sig) { setLoadError('This link is invalid.'); setLoading(false); return; }
    fetch(`${API_BASE}/training-feedback/public/${id}?sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) setLoadError(res.message || 'This link could not be verified.');
        else setTraining(res.data);
        setLoading(false);
      })
      .catch(() => { setLoadError('Something went wrong loading this form.'); setLoading(false); });
  }, [id, sig]);

  const valid = email.trim() && rating > 0 && trainerRating > 0 && contentRating > 0 && wouldRecommend !== null;

  const submit = async () => {
    if (!valid || !id) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const r = await fetch(`${API_BASE}/training-feedback/public/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sig, email: email.trim(), rating, trainerRating, contentRating, wouldRecommend, comments, improvements }),
      });
      const res = await r.json();
      if (!res.success) setSubmitError(res.message || 'Could not submit your feedback.');
      else setSubmitted(true);
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gray-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <p className="text-center text-sm font-semibold tracking-wide text-[#7a8b2e] mb-4">BRISK OLIVE · TRAINING FEEDBACK</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">{children}</div>
      </div>
    </div>
  );

  if (loading) return shell(<p className="text-center text-gray-400 py-8">Loading…</p>);
  if (loadError || !training) return shell(<p className="text-center text-red-600 py-8">{loadError || 'This link is invalid.'}</p>);

  if (submitted) {
    return shell(
      <div className="text-center py-6">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Thank you!</h2>
        <p className="text-sm text-gray-500">Your feedback on <strong>{training.trainingName}</strong> has been recorded. You can close this page.</p>
      </div>
    );
  }

  const header = (
    <div className="mb-5">
      <h1 className="text-lg font-semibold text-gray-800">{training.trainingName}</h1>
      <p className="text-sm text-gray-500 mt-0.5">
        {training.trainerName && <>Trainer: {training.trainerName} · </>}
        {training.trainingDate} · {training.startTime} – {training.endTime}
      </p>
    </div>
  );

  if (!training.open) {
    return shell(
      <>
        {header}
        <p className="text-center text-red-600 py-4">
          {!training.completed
            ? 'Feedback for this training is not open yet.'
            : `The feedback window for this training closed${training.feedbackClosesAt ? ` on ${fmtIst(training.feedbackClosesAt)} IST` : ''}.`}
        </p>
      </>
    );
  }

  return shell(
    <>
      {header}
      {training.feedbackClosesAt && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-5">
          Feedback is open until <strong>{fmtIst(training.feedbackClosesAt)} IST</strong>.
        </p>
      )}

      {submitError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{submitError}</div>}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your official email <span className="text-red-500">*</span></label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@briskolive.com"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Overall training rating <span className="text-red-500">*</span></label>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Trainer effectiveness <span className="text-red-500">*</span></label>
          <StarPicker value={trainerRating} onChange={setTrainerRating} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Quality of content / material <span className="text-red-500">*</span></label>
          <StarPicker value={contentRating} onChange={setContentRating} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Would you recommend this to colleagues? <span className="text-red-500">*</span></label>
          <div className="flex gap-3">
            {[true, false].map((val) => (
              <button key={String(val)} type="button" onClick={() => setWouldRecommend(val)}
                className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                  wouldRecommend === val
                    ? val ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>
                {val ? '👍 Yes' : '👎 No'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">What did you find most valuable?</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">What could be improved?</label>
          <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <button onClick={submit} disabled={!valid || submitting}
        className="mt-6 w-full px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
        {submitting ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </>
  );
}
