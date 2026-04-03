import { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, ChevronRight, Star } from 'lucide-react';
import { getRole } from '../../config/rbac';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const role = getRole();
  if (role) config.headers['x-user-role'] = role;
  return config;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompletedTraining {
  _id: string;
  trainingId: string;
  trainingName: string;
  capabilitySkill: string;
  trainerName: string;
  trainingDate: string;
  feedbackWindow: number; // hours after which feedback closes
}

interface FeedbackRecord {
  _id: string;
  trainingId: string;
  trainingName: string;
  employeeName: string;
  rating: number;
  trainerRating: number;
  contentRating: number;
  comments: string;
  improvements: string;
  wouldRecommend: boolean;
  submittedAt: string;
}

// ─── Dummy feedback questions ─────────────────────────────────────────────────

const FEEDBACK_QUESTIONS = [
  { id: 'rating',        label: 'Overall training rating',               type: 'star'    },
  { id: 'trainerRating', label: 'Trainer effectiveness',                 type: 'star'    },
  { id: 'contentRating', label: 'Quality of content / material',         type: 'star'    },
  { id: 'wouldRecommend',label: 'Would you recommend this to colleagues?',type: 'yesno'  },
  { id: 'comments',      label: 'What did you find most valuable?',       type: 'text'   },
  { id: 'improvements',  label: 'What could be improved?',               type: 'text'   },
] as const;

type FeedbackFormState = {
  rating:         number;
  trainerRating:  number;
  contentRating:  number;
  wouldRecommend: boolean | null;
  comments:       string;
  improvements:   string;
};

const initialForm: FeedbackFormState = {
  rating:         0,
  trainerRating:  0,
  contentRating:  0,
  wouldRecommend: null,
  comments:       '',
  improvements:   '',
};

// ─── Star picker ──────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="focus:outline-none">
          <Star className={`w-6 h-6 transition-colors ${
            n <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
          }`} />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-sm text-gray-500 self-center">{value}/5</span>
      )}
    </div>
  );
}

// ─── Display-only star row ────────────────────────────────────────────────────

function StarDisplay({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`w-4 h-4 ${n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
      ))}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeeFeedback() {
  const [trainings, setTrainings]   = useState<CompletedTraining[]>([]);
  const [feedbacks, setFeedbacks]   = useState<FeedbackRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [view, setView]             = useState<'list' | 'form' | 'submitted' | 'all-responses'>('list');
  const [selected, setSelected]     = useState<CompletedTraining | null>(null);
  const [form, setForm]             = useState<FeedbackFormState>(initialForm);
  const [saving, setSaving]         = useState(false);

  const loadTrainings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/training-schedules?status=Completed');
      setTrainings(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load trainings');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async () => {
    try {
      const res = await api.get('/training-feedback');
      setFeedbacks(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load feedbacks:', err);
    }
  };

  useEffect(() => { loadTrainings(); loadFeedbacks(); }, []);

  const myFeedback = (trainingId: string) =>
    feedbacks.find(f => f.trainingId === trainingId);

  const trainingFeedbacks = (trainingId: string) =>
    feedbacks.filter(f => f.trainingId === trainingId);

  const openForm = (t: CompletedTraining) => {
    setSelected(t);
    setForm(initialForm);
    setView('form');
    setError('');
  };

  const openAllResponses = (t: CompletedTraining) => {
    setSelected(t);
    setView('all-responses');
  };

  const isFormValid = form.rating > 0 && form.trainerRating > 0 &&
    form.contentRating > 0 && form.wouldRecommend !== null;

  const submitFeedback = async () => {
    if (!selected || !isFormValid) return;
    setSaving(true);
    try {
      await api.post('/training-feedback', {
        trainingId:    selected.trainingId,
        trainingName:  selected.trainingName,
        rating:        form.rating,
        trainerRating: form.trainerRating,
        contentRating: form.contentRating,
        wouldRecommend: form.wouldRecommend,
        comments:      form.comments.trim(),
        improvements:  form.improvements.trim(),
      });
      await loadFeedbacks();
      setView('submitted');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setSaving(false);
    }
  };

  // ── VIEW: All responses (HR / manager view) ────────────────────────────────
  if (view === 'all-responses' && selected) {
    const list = trainingFeedbacks(selected.trainingId);
    const avgRating = list.length ? (list.reduce((s, f) => s + f.rating, 0) / list.length).toFixed(1) : '—';

    return (
      <div className="p-6">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← Back
        </button>
        <h2 className="text-xl text-gray-700 mb-1">Feedback Responses</h2>
        <p className="text-gray-400 text-sm mb-4">{selected.trainingName}</p>

        <div className="flex gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{list.length}</p>
            <p className="text-xs text-blue-500 mt-0.5">Responses</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-5 py-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{avgRating}</p>
            <p className="text-xs text-yellow-500 mt-0.5">Avg Rating</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg px-5 py-3 text-center">
            <p className="text-2xl font-bold text-green-700">
              {list.length ? Math.round((list.filter(f => f.wouldRecommend).length / list.length) * 100) : 0}%
            </p>
            <p className="text-xs text-green-500 mt-0.5">Would Recommend</p>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No responses yet for this training.</div>
        ) : (
          <div className="space-y-4">
            {list.map(f => (
              <div key={f._id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{f.employeeName}</p>
                    <p className="text-xs text-gray-400">{new Date(f.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <StarDisplay value={f.rating} />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Trainer</p>
                    <StarDisplay value={f.trainerRating} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Content</p>
                    <StarDisplay value={f.contentRating} />
                  </div>
                </div>
                {f.comments && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Most valuable</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{f.comments}</p>
                  </div>
                )}
                {f.improvements && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Improvements</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{f.improvements}</p>
                  </div>
                )}
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${f.wouldRecommend ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {f.wouldRecommend ? '✓ Would recommend' : '✗ Would not recommend'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: Feedback submitted confirmation ──────────────────────────────────
  if (view === 'submitted') {
    return (
      <div className="p-6 max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Feedback Submitted!</h3>
        <p className="text-gray-500 text-sm mb-6">
          Thank you for your feedback on <strong>{selected?.trainingName}</strong>. Your response has been recorded.
        </p>
        <button onClick={() => setView('list')}
          className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
          Back to Trainings
        </button>
      </div>
    );
  }

  // ── VIEW: Feedback form ────────────────────────────────────────────────────
  if (view === 'form' && selected) {
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← Back
        </button>
        <h2 className="text-xl text-gray-700 mb-1">Training Feedback</h2>
        <p className="text-gray-400 text-sm mb-6">{selected.trainingName}</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>}

        <div className="space-y-6">

          {/* Overall rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Overall training rating <span className="text-red-500">*</span>
            </label>
            <StarPicker value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
          </div>

          {/* Trainer rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trainer effectiveness <span className="text-red-500">*</span>
            </label>
            <StarPicker value={form.trainerRating} onChange={v => setForm(p => ({ ...p, trainerRating: v }))} />
          </div>

          {/* Content rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality of content / material <span className="text-red-500">*</span>
            </label>
            <StarPicker value={form.contentRating} onChange={v => setForm(p => ({ ...p, contentRating: v }))} />
          </div>

          {/* Would recommend */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Would you recommend this to colleagues? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {[true, false].map(val => (
                <button key={String(val)} type="button"
                  onClick={() => setForm(p => ({ ...p, wouldRecommend: val }))}
                  className={`px-5 py-2 text-sm rounded-md border transition-colors ${
                    form.wouldRecommend === val
                      ? val ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {val ? '👍 Yes' : '👎 No'}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What did you find most valuable?
            </label>
            <textarea value={form.comments}
              onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
              rows={3} placeholder="Share what was most useful..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Improvements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What could be improved?
            </label>
            <textarea value={form.improvements}
              onChange={e => setForm(p => ({ ...p, improvements: e.target.value }))}
              rows={3} placeholder="Suggestions for improvement..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={() => setView('list')}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={submitFeedback} disabled={!isFormValid || saving}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            <CheckCircle className="w-4 h-4" />
            {saving ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    );
  }

  // ── VIEW: Training list ────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl text-gray-700 mb-1">Training Feedback</h2>
        <p className="text-gray-400 text-sm">Share your experience after attending a training session</p>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : trainings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">💬</div>
          <p className="font-medium">No completed trainings yet</p>
          <p className="text-sm mt-1">Feedback forms will appear here once trainings are completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {trainings.map(t => {
            const done     = myFeedback(t.trainingId);
            const resCount = trainingFeedbacks(t.trainingId).length;

            return (
              <div key={t._id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug">{t.trainingName}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.capabilitySkill}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{t.trainerName}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {new Date(t.trainingDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Already submitted badge */}
                {done && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full w-fit">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Feedback submitted · <StarDisplay value={done.rating} />
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                  {/* Employee: give feedback (only once) */}
                  {!done && (
                    <button onClick={() => openForm(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" /> Give Feedback
                    </button>
                  )}

                  {/* HR / manager: view all responses */}
                  <button onClick={() => openAllResponses(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
                    📊 {resCount} Response{resCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}