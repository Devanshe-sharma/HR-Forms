'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  RoundType, HR_RECOMMENDATION_OPTIONS, TECH_RECOMMENDATION_OPTIONS, MGMT_RECOMMENDATION_OPTIONS,
} from '../Recruitment/applicantTypes';

const RECOMMENDATION_OPTIONS_BY_TYPE: Record<RoundType, string[]> = {
  hr: HR_RECOMMENDATION_OPTIONS, tech: TECH_RECOMMENDATION_OPTIONS, mgmt: MGMT_RECOMMENDATION_OPTIONS,
};
import { FormattedFeedback, TemplateModal } from '../Recruitment/FeedbackTemplate';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type HrBackground = Record<string, string>;

type PreviousRound = {
  stage: string;
  interviewer: string;
  interviewerFeedbackStatus: string;
  feedback: string;
  // Only present on the HR round's own entry.
  hrBackground?: HrBackground | null;
  communication?: string;
  stability?: string;
  attitude?: string;
  bond?: string;
};

type Context = {
  candidate: { name: string; designation: string; resume: string; linkedin: string };
  jdLink: string;
  round: { stage: string; roundType: RoundType; scheduledDate: string; scheduledTime: string; interviewer: string };
  interviewerFeedbackStatus: string;
  feedback: string;
  previousRounds: PreviousRound[];
  excelTest?: { status?: string; score?: number } | null;
};

// Same order/wording as the HR round's own form
// (frontend/src/pages/Recruitment/RoundPipelineTab.tsx's HR_BACKGROUND_FIELDS).
const HR_BACKGROUND_LABELS: Record<string, string> = {
  nativePlace: 'Native Place', residingIn: 'Residing In', commuteType: 'Commute Type',
  age: 'Age', maritalStatus: 'Marital Status', family: 'Family', education: 'Education',
  hobbies: 'Hobbies', experienceSummary: 'Experience', currentCtc: 'Current CTC',
  pfApplicable: 'PF Applicable', expectedCtc: 'Expected CTC', recommendedCtc: 'Recommended CTC',
  currentCompany: 'Current Company', noticePeriodSummary: 'Notice Period', whenCanJoin: 'When Can Join',
  reasonForLeaving: 'Reason for Leaving', skillsSummary: 'Skills',
};

const DISC_TRAIT_LABELS: Record<string, string> = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Conscientiousness' };

export default function InterviewFeedback() {
  const { recordId, roundId } = useParams<{ recordId: string; roundId: string }>();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';

  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [status, setStatus]     = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  useEffect(() => {
    if (!recordId || !roundId || !sig) { setError('This link is invalid.'); setLoading(false); return; }
    fetch(`${API_BASE}/applicant-records/${recordId}/interview-rounds/${roundId}/feedback-context?sig=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.message || 'This link could not be verified.'); setLoading(false); return; }
        setContext(res.data);
        setStatus(res.data.interviewerFeedbackStatus || '');
        setFeedback(res.data.feedback || '');
        setLoading(false);
      })
      .catch(() => { setError('Something went wrong loading this form.'); setLoading(false); });
  }, [recordId, roundId, sig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${recordId}/interview-rounds/${roundId}/feedback?sig=${encodeURIComponent(sig)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewerFeedbackStatus: status, feedback }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to submit feedback.');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Failed to submit feedback.');
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
          <p className="text-gray-700">Your feedback has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="bg-slate-800 shadow-xl">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold">Interview Feedback</h1>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10 max-w-5xl">
        {/* Candidate details + JD — for reference while writing feedback */}
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-1.5">
          <p className="text-sm text-gray-500">Candidate</p>
          <p className="text-xl font-bold text-slate-800">{context?.candidate.name}</p>
          <p className="text-sm text-gray-600 mb-2">{context?.candidate.designation}</p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-500">Round:</span> {context?.round.stage || '—'}
          </p>
          {context?.excelTest?.status && (
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-500">Excel Test:</span>{' '}
              {context.excelTest.status === 'Graded' ? `${context.excelTest.score}%` : context.excelTest.status}
            </p>
          )}
          <div className="flex flex-wrap gap-4 pt-2">
            {context?.candidate.resume && (
              <a href={context.candidate.resume} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                View Resume
              </a>
            )}
            {context?.jdLink && (
              <a href={context.jdLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                View Job Description
              </a>
            )}
          </div>
        </div>

        {/* Previous feedback — every earlier round in the HR -> Technical ->
            Management pipeline (HR included), so this interviewer isn't
            starting from zero. Hidden entirely when there's nothing to show. */}
        {(context?.previousRounds?.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
            <p className="text-sm font-bold text-slate-700">Previous Feedback</p>

            {context?.previousRounds.map((r, i) => {
              const bgEntries = r.hrBackground
                ? Object.entries(HR_BACKGROUND_LABELS)
                    .map(([key, label]) => [label, r.hrBackground?.[key]])
                    .filter(([, value]) => value && String(value).trim() !== '')
                : [];
              const evalEntries = r.hrBackground
                ? [
                    ['Communication', r.communication],
                    ['Stability', r.stability],
                    ['Attitude / DISC', r.attitude ? `${r.attitude} — ${DISC_TRAIT_LABELS[r.attitude] || ''}` : ''],
                    ['Bond', r.bond],
                  ].filter(([, value]) => value && String(value).trim() !== '')
                : [];

              return (
                <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {r.stage}{r.interviewer ? ` — ${r.interviewer}` : ''}
                    {r.interviewerFeedbackStatus ? ` (${r.interviewerFeedbackStatus})` : ''}
                  </p>
                  {r.feedback ? <FormattedFeedback text={r.feedback} /> : <p className="text-sm text-gray-400 italic">—</p>}

                  {bgEntries.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Candidate Background</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-700">
                        {bgEntries.map(([label, value]) => (
                          <p key={label}><span className="text-gray-400">{label}:</span> {value}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {evalEntries.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Evaluation</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-700">
                        {evalEntries.map(([label, value]) => (
                          <p key={label}><span className="text-gray-400">{label}:</span> {value}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Recommendation Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">— Select —</option>
              {(context?.round.roundType ? RECOMMENDATION_OPTIONS_BY_TYPE[context.round.roundType] : HR_RECOMMENDATION_OPTIONS).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-700">Feedback</label>
              <button
                type="button"
                onClick={() => setTemplateOpen(true)}
                className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                {feedback ? 'Edit via template' : 'Use template'}
              </button>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={8}
              placeholder="Share your assessment of the candidate…"
              className="w-full border rounded-lg px-3 py-2 resize-y"
            />
            <TemplateModal
              open={templateOpen}
              onClose={() => setTemplateOpen(false)}
              onInsert={(text: string) => setFeedback(text)}
              screenerName={context?.round.interviewer || ''}
              existingText={feedback}
              defaultRound={context?.round.stage || 'Interview Round'}
              title="Interview Feedback Template"
              defaultResume={context?.candidate.resume}
              defaultLinkedin={context?.candidate.linkedin}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={submitting || !status}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
