// pages/Recruitment/CandidateInformationTab.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, FileText, Send, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE, ASSESSMENT_STATUS_COLORS, DISC_TRAIT_LABELS } from './applicantTypes';

type ApplicantRecordWithAI = ApplicantRecord & {
  ai_fit_score?:   number | null;
  ai_fit_summary?: string;
};

function resolveResumeUrl(resume?: string): string {
  if (!resume) return '';
  if (/^https?:\/\//i.test(resume)) return resume;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${resume.startsWith('/') ? '' : '/'}${resume}`;
}

// Read-only two-column key-value cards (matches the mockup's Contact &
// Personal / Professional layout) — editing moved to EditCandidateInfoModal,
// opened via the "Edit Information" button in the modal header
// (AllApplicants.tsx), rather than an always-present inline edit form.
const CandidateInformationTab = ({
  record, onSave,
}: {
  record: ApplicantRecordWithAI;
  onSave: (updated: ApplicantRecord) => void;
}) => {
  const [jdLink,    setJdLink]    = useState<string | null>(null);
  const [jdError,   setJdError]   = useState<string | null>(null);
  const [loadingJd, setLoadingJd] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [sendingAssessment, setSendingAssessment] = useState<'excel' | 'disc' | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [grading, setGrading] = useState(false);

  useEffect(() => { setMarks(record.excelTest?.marks?.length ? record.excelTest.marks : (record.excelTest?.answers || []).map(() => true)); }, [record.excelTest]);

  useEffect(() => {
    setLoadingJd(true);
    setJdLink(null);
    setJdError(null);
    fetch(`${API_BASE}/applicant-records/${record._id}/jd-link`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setJdLink(json.data.jdLink);
        else setJdError(json.message || 'Could not fetch JD link');
      })
      .catch(() => setJdError('Could not fetch JD link'))
      .finally(() => setLoadingJd(false));
  }, [record._id]);

  const sendAssessment = async (kind: 'excel' | 'disc') => {
    setSendingAssessment(kind);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/assessments/${kind}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send assessment');
      onSave(json.data);
      toast.success(`${kind === 'excel' ? 'Excel Test' : 'DISC Assessment'} sent`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send assessment');
    } finally {
      setSendingAssessment(null);
    }
  };

  const gradeExcel = async () => {
    setGrading(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/assessments/excel/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to grade test');
      onSave(json.data);
      toast.success(`Graded — score ${json.data.excelTest?.score}%`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to grade test');
    } finally {
      setGrading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jdLink) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jdLink }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Analysis failed');
      onSave(json.data);
      toast.success(`ATS score: ${json.data.ai_fit_score}/10`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleNotesBlur = async (notes: string) => {
    if (notes === (record.internalNotes || '')) return;
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ internalNotes: notes }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSave(json.data);
    } catch {
      toast.error('Failed to save notes');
    }
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  );

  return (
    <div className="space-y-6">

      {/* ── JD + ATS Score ── */}
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <SectionLabel>Job Description &amp; ATS Score</SectionLabel>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {loadingJd ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Loading JD…
              </span>
            ) : jdLink ? (
              <a href={jdLink} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                <FileText size={14} /> View Job Description
              </a>
            ) : (
              <span className="text-sm text-gray-400">{jdError || 'No JD available'}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {record.ai_fit_score != null && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                record.ai_fit_score >= 8 ? 'bg-green-100 text-green-700'
                  : record.ai_fit_score >= 5 ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                ATS: {record.ai_fit_score}/10
              </span>
            )}
            <button
              onClick={handleAnalyze}
              disabled={!jdLink || analyzing}
              title={!jdLink ? 'No JD available' : 'Analyze ATS score'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
            >
              {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {record.ai_fit_score != null ? 'Re-analyze ATS Score' : 'Analyze ATS Score'}
            </button>
          </div>
        </div>
        {record.ai_fit_summary && (
          <p className="text-sm text-gray-600 leading-relaxed mt-3 border-t border-gray-200 pt-3">
            {record.ai_fit_summary}
          </p>
        )}
      </section>

      {/* ── Contact & Personal / Professional — two columns, read-only ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border border-gray-100 rounded-xl p-4">
          <SectionLabel>Contact &amp; Personal</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Full Name"  value={record.full_name} />
            <Field label="Phone"      value={record.phone} />
            <Field label="Email"      value={record.email} />
            <Field label="LinkedIn"   value={record.linkedin} />
            <Field label="Location"   value={[record.city, record.state].filter(Boolean).join(', ')} />
            <Field label="Country"    value={record.country} />
            <Field label="Pin Code"   value={record.pin_code} />
            <Field label="Relocation" value={record.relocation} />
            <Field label="Education"  value={record.highest_qualification} />
          </div>
        </section>

        <section className="border border-gray-100 rounded-xl p-4">
          <SectionLabel>Professional</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Designation"   value={record.designation} />
            <Field label="Experience"    value={record.experience} />
            <Field label="Total Exp"     value={record.total_experience ? `${record.total_experience} yrs` : undefined} />
            <Field label="Current CTC"   value={record.current_ctc} />
            <Field label="Expected CTC"  value={record.expected_monthly_ctc} />
            <Field label="Notice Period" value={record.notice_period ? `${record.notice_period} days` : undefined} />
          </div>
        </section>
      </div>

      {/* ── Application — full width, read-only ── */}
      <section className="border border-gray-100 rounded-xl p-4">
        <SectionLabel>Application</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
          <Field label="Position"  value={record.designation} />
          <Field label="Applied On" value={new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <Field label="Match Score" value={record.atsMatchScore != null ? `${record.atsMatchScore}%` : undefined} />
          <Field label="Resume" value={record.resume ? 'On file' : undefined} />
        </div>
        {record.resume && (
          <a href={resolveResumeUrl(record.resume)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-blue-700 underline">
            View Resume
          </a>
        )}
      </section>

      {/* ── Languages Known ── */}
      <section>
        <SectionLabel>Languages Known</SectionLabel>
        {(record.languagesKnown?.length || record.otherLanguage) ? (
          <div className="flex flex-wrap gap-2">
            {(record.languagesKnown || []).map((lang) => (
              <span key={lang} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700">
                {lang}
              </span>
            ))}
            {record.otherLanguage && (
              <span className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700">
                {record.otherLanguage}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Not specified</p>
        )}
      </section>

      {/* ── Assessments — Excel Test (HR-graded) + DISC ── */}
      <section>
        <SectionLabel>Assessments</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">Excel Test</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ASSESSMENT_STATUS_COLORS[record.excelTest?.status || '']}`}>
                {record.excelTest?.status || 'Not Sent'}
              </span>
            </div>
            {!record.excelTest?.status && (
              <button
                onClick={() => sendAssessment('excel')}
                disabled={sendingAssessment === 'excel' || !record.email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg transition"
              >
                {sendingAssessment === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send Test
              </button>
            )}
            {(record.excelTest?.status === 'Submitted' || record.excelTest?.status === 'Graded') && (
              <div className="space-y-2">
                {(record.excelTest.answers || []).map((a, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-gray-600 mb-1">{a.question}</p>
                    <p className="text-sm text-gray-800 mb-2">{a.answer || '—'}</p>
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={!!marks[i]}
                        disabled={record.excelTest?.status === 'Graded'}
                        onChange={(e) => setMarks((p) => p.map((m, idx) => idx === i ? e.target.checked : m))}
                      />
                      Correct
                    </label>
                  </div>
                ))}
                {record.excelTest.status === 'Submitted' ? (
                  <button
                    onClick={gradeExcel}
                    disabled={grading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
                  >
                    {grading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Submit Grading
                  </button>
                ) : (
                  <p className="text-sm font-bold text-gray-700">Score: {record.excelTest.score}%</p>
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">DISC Assessment</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ASSESSMENT_STATUS_COLORS[record.discAssessment?.status || '']}`}>
                {record.discAssessment?.status || 'Not Sent'}
              </span>
            </div>
            {!record.discAssessment?.status && (
              <button
                onClick={() => sendAssessment('disc')}
                disabled={sendingAssessment === 'disc' || !record.email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg transition"
              >
                {sendingAssessment === 'disc' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send Assessment
              </button>
            )}
            {record.discAssessment?.status === 'Completed' && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-700">
                  Primary trait: {DISC_TRAIT_LABELS[record.discAssessment.primary as 'D' | 'I' | 'S' | 'C']}
                </p>
                {(['D', 'I', 'S', 'C'] as const).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-6">{t}</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-lime-500" style={{ width: `${record.discAssessment?.scores?.[t] ?? 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{record.discAssessment?.scores?.[t] ?? 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Internal Notes — HR-only, kept simply editable (no separate
          view/edit mode now that profile fields moved to EditCandidateInfoModal) ── */}
      <section>
        <SectionLabel>Internal Notes</SectionLabel>
        <textarea
          defaultValue={record.internalNotes || ''}
          onBlur={(e) => handleNotesBlur(e.target.value)}
          rows={4}
          placeholder="HR-only notes — not visible to the candidate"
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 resize-none transition bg-white"
        />
      </section>

    </div>
  );
};

export default CandidateInformationTab;
