// pages/Recruitment/TimelineHistoryTab.tsx
import React from 'react';
import { Clock, MessageSquare } from 'lucide-react';
import { ApplicantRecord, ROUND_TYPE_ORDER } from './applicantTypes';
import { FormattedFeedback } from './FeedbackTemplate';

// Chronological event log (events[]) + a feedback-history list, pulled
// together on one tab — the events array is append-only and stamped at the
// moment of each real transition (see backend utils/candidateEvents.js),
// so this tab just renders it, newest first.
const TimelineHistoryTab: React.FC<{ record: ApplicantRecord }> = ({ record }) => {
  const events = [...(record.events || [])].sort(
    (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
  );

  // Pipeline order (HR -> Technical -> Management) rather than raw
  // roundNumber, since roundNumber only counts instances within a type and
  // can't be compared directly across different round types.
  const pipelineRank = (r: { roundType: string; roundNumber: number }) =>
    ROUND_TYPE_ORDER.indexOf(r.roundType as any) * 1000 + (r.roundNumber ?? 0);
  const feedbackHistory = (record.interviewRounds || [])
    .filter((r) => r.feedback || r.interviewerFeedbackStatus)
    .sort((a, b) => pipelineRank(b) - pipelineRank(a));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Clock size={15} /> Timeline
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No activity recorded yet.</p>
        ) : (
          <div className="relative pl-5 border-l-2 border-gray-100 space-y-5">
            {events.map((ev, i) => (
              <div key={`${ev.key}-${i}`} className="relative">
                <span className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-lime-400 border-2 border-white" />
                <p className="text-sm font-semibold text-gray-800">{ev.label}</p>
                {ev.detail && <p className="text-xs text-gray-500 mt-0.5">{ev.detail}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {new Date(ev.when).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <MessageSquare size={15} /> Feedback History
        </h3>
        {feedbackHistory.length === 0 ? (
          <p className="text-sm text-gray-400">No feedback submitted yet.</p>
        ) : (
          feedbackHistory.map((r) => (
            <div key={r._id} className="mb-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                {r.stage || `Round ${r.roundNumber}`}{r.interviewer ? ` — ${r.interviewer}` : ''}
                {r.interviewerFeedbackStatus ? ` · ${r.interviewerFeedbackStatus}` : ''}
              </p>
              {r.feedback ? <FormattedFeedback text={r.feedback} /> : <p className="text-xs text-gray-400">No written feedback.</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TimelineHistoryTab;
