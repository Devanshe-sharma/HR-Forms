// pages/Recruitment/CandidateInformationTab.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, FileText, Send, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, FIELD_LABEL_CLASS } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE, ASSESSMENT_STATUS_COLORS, DISC_TRAIT_DESCRIPTIONS } from './applicantTypes';

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
  record, onSave, department,
}: {
  record: ApplicantRecordWithAI;
  onSave: (updated: ApplicantRecord) => void;
  department?: string;
}) => {
  // Native Place / Residing In aren't captured on the application form itself
  // — they're filled in by HR during the HR Round (hrBackground subform).
  // Surface them here read-only, once an HR round has recorded them, so this
  // tab reflects the same values the mockup shows without duplicating entry.
  const hrBackground = [...(record.interviewRounds || [])]
    .filter((r) => r.roundType === 'hr' && r.hrBackground)
    .map((r) => r.hrBackground!)
    .find((hb) => hb.nativePlace || hb.residingIn);
  const skills = [...(record.primarySkills || []), ...(record.secondarySkills || [])].join(', ');

  const [jdLink,    setJdLink]    = useState<string | null>(null);
  const [jdError,   setJdError]   = useState<string | null>(null);
  const [loadingJd, setLoadingJd] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [practicalMarks, setPracticalMarks] = useState<Record<number, boolean>>({});
  const [grading, setGrading] = useState(false);

  // Mail preview/send modal — shared by the Excel Test and DISC Assessment
  // "Send" buttons. Editable To/CC/Subject/Body before anything actually
  // goes out, same pattern as the interview round invite mail.
  const [mailModal, setMailModal] = useState<{
    open: boolean; kind: 'excel' | 'disc' | null;
    to: string; cc: string; subject: string; body: string;
    loading: boolean; sending: boolean; error: string;
  }>({ open: false, kind: null, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  useEffect(() => {
    const init: Record<number, boolean> = {};
    (record.excelTest?.answers || []).filter(a => a.type === 'practical').forEach(a => { init[a.qNo] = a.marks === 1; });
    setPracticalMarks(init);
  }, [record.excelTest]);

  const openMailModal = async (kind: 'excel' | 'disc') => {
    setMailModal({ open: true, kind, to: '', cc: '', subject: '', body: '', loading: true, sending: false, error: '' });
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/assessments/${kind}/preview-mail`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load preview');
      setMailModal(prev => ({ ...prev, loading: false, to: json.data.to || '', cc: json.data.cc || '', subject: json.data.subject || '', body: json.data.body || '' }));
    } catch (e: any) {
      setMailModal(prev => ({ ...prev, loading: false, error: e.message || 'Failed to load preview' }));
    }
  };

  const closeMailModal = () => setMailModal({ open: false, kind: null, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  const sendMailModal = async () => {
    if (!mailModal.kind) return;
    if (!mailModal.to.trim()) { setMailModal(prev => ({ ...prev, error: 'Recipient (To) is required' })); return; }
    setMailModal(prev => ({ ...prev, sending: true, error: '' }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/assessments/${mailModal.kind}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: mailModal.to, cc: mailModal.cc, subject: mailModal.subject, customBody: mailModal.body }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send');
      onSave(json.data);
      toast.success(`${mailModal.kind === 'excel' ? 'Excel Test' : 'DISC Assessment'} sent`);
      closeMailModal();
    } catch (e: any) {
      setMailModal(prev => ({ ...prev, sending: false, error: e.message || 'Failed to send' }));
    }
  };

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

  const gradeExcel = async () => {
    setGrading(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/assessments/excel/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practicalMarks }),
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
      <section className="bg-white border border-gray-100 rounded-xl p-4">
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
        <section className="bg-white border border-gray-100 rounded-xl p-4">
          <SectionLabel>Contact &amp; Personal</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Full Name"      value={record.full_name} />
            <Field label="Phone Number"   value={record.phone} />
            <Field label="Personal Email" value={record.email} />
            <div className="min-w-0">
              <p className={FIELD_LABEL_CLASS}>LinkedIn Profile</p>
              {record.linkedin ? (
                <a
                  href={/^https?:\/\//i.test(record.linkedin) ? record.linkedin : `https://${record.linkedin}`}
                  target="_blank"
                  rel="noreferrer"
                  title={record.linkedin}
                  className="text-sm text-blue-600 hover:underline font-medium truncate block"
                >
                  {record.linkedin.replace(/^https?:\/\//i, '')}
                </a>
              ) : (
                <p className="text-sm text-gray-800 font-medium">—</p>
              )}
            </div>
            <Field label="Current Location" value={[record.city, record.state].filter(Boolean).join(', ')} />
            <Field label="Native Place"     value={hrBackground?.nativePlace || undefined} />
            <Field label="Residing In"      value={hrBackground?.residingIn || record.city || undefined} />
            <Field label="Education"        value={record.highest_qualification} />
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-4">
          <SectionLabel>Professional</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Total Experience" value={record.total_experience ? `${record.total_experience} yrs` : undefined} />
            <Field label="Current Company"  value={record.current_company || undefined} />
            <Field label="Current CTC"      value={record.current_ctc} />
            <Field label="Expected CTC"     value={record.expected_monthly_ctc} />
            <Field label="Notice Period"    value={record.notice_period ? `${record.notice_period} days` : undefined} />
            <Field label="When Can Join"    value={record.expectedJoiningDate ? new Date(record.expectedJoiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined} />
            <div className="col-span-2 min-w-0">
              <Field label="Skills" value={skills || undefined} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Application — full width, read-only ── */}
      <section className="bg-white border border-gray-100 rounded-xl p-4">
        <SectionLabel>Application</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-4">
          <Field label="Position Applied For" value={record.designation} />
          <Field label="Department"           value={department} />
          <Field label="Application Source"   value={record.candidateSource} />
          <Field label="Application Date"     value={new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <Field label="ATS Score"            value={record.atsMatchScore != null ? `${record.atsMatchScore}%` : undefined} />
        </div>
        {record.resume && (
          <a href={resolveResumeUrl(record.resume)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-blue-700 underline">
            View Resume
          </a>
        )}
      </section>

      <p className="text-xs text-gray-400 -mt-2">
        Captured once from the application form and shared by every round. Updates here are visible to HR, Technical and Management interviewers.
      </p>

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

          <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">Excel Test</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ASSESSMENT_STATUS_COLORS[record.excelTest?.status || '']}`}>
                {record.excelTest?.status || 'Not Sent'}
              </span>
            </div>
            {!record.excelTest?.status && (
              <button
                onClick={() => openMailModal('excel')}
                disabled={!record.email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg transition"
              >
                <Send size={13} />
                Send Test
              </button>
            )}
            {(record.excelTest?.status === 'Submitted' || record.excelTest?.status === 'Graded') && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">MCQ — auto-graded ({record.excelTest.mcqScore ?? 0}/20)</p>
                {(record.excelTest.answers || []).filter(a => a.type === 'mcq').map((a) => (
                  <div key={a.qNo} className={`border rounded-lg p-2.5 ${a.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Q{a.qNo}. {a.question}</p>
                    <p className="text-sm text-gray-800">
                      Selected: <span className="font-bold">{a.selectedOption || '—'}</span>{' '}
                      {a.isCorrect ? <span className="text-green-700 font-semibold">✓ Correct</span> : <span className="text-red-700 font-semibold">✗ Incorrect</span>}
                    </p>
                  </div>
                ))}
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mt-3">Practical — for HR to check &amp; mark</p>
                {(record.excelTest.answers || []).filter(a => a.type === 'practical').map((a) => (
                  <div key={a.qNo} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Q{a.qNo}. {a.question}</p>
                    <p className="text-sm text-gray-800 mb-2 whitespace-pre-wrap font-mono">{a.answer || '—'}</p>
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={!!practicalMarks[a.qNo]}
                        disabled={record.excelTest?.status === 'Graded'}
                        onChange={(e) => setPracticalMarks((p) => ({ ...p, [a.qNo]: e.target.checked }))}
                      />
                      Correct
                    </label>
                  </div>
                ))}
                {record.excelTest.status === 'Submitted' ? (
                  <button
                    onClick={gradeExcel}
                    disabled={grading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#597e37] hover:bg-[#3d5420] disabled:opacity-60 rounded-lg transition"
                  >
                    {grading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Submit Grading
                  </button>
                ) : (
                  <p className="text-sm font-bold text-gray-700">
                    MCQ: {record.excelTest.mcqScore}/20 · Practical: {record.excelTest.practicalScore}/10 · Overall: {record.excelTest.score}%
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">DISC Assessment</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ASSESSMENT_STATUS_COLORS[record.discAssessment?.status || '']}`}>
                {record.discAssessment?.status || 'Not Sent'}
              </span>
            </div>
            {!record.discAssessment?.status && (
              <button
                onClick={() => openMailModal('disc')}
                disabled={!record.email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg transition"
              >
                <Send size={13} />
                Send Assessment
              </button>
            )}
            {record.discAssessment?.status === 'Completed' && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-700">
                  Primary trait: {DISC_TRAIT_DESCRIPTIONS[record.discAssessment.primary as 'D' | 'I' | 'S' | 'C']}
                </p>
                {(['D', 'I', 'S', 'C'] as const).map((t) => (
                  <div key={t}>
                    <p className="text-xs text-gray-600 mb-1">{DISC_TRAIT_DESCRIPTIONS[t]}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#eef3e6]0" style={{ width: `${record.discAssessment?.scores?.[t] ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{record.discAssessment?.scores?.[t] ?? 0}%</span>
                    </div>
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
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#7a9c56] focus:border-[#7a9c56] resize-none transition bg-white"
        />
      </section>

      {mailModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 1300 }} onClick={closeMailModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-indigo-50 rounded-t-2xl shrink-0">
              <h3 className="text-lg font-bold text-indigo-900">
                {mailModal.kind === 'excel' ? 'Excel Test Invite' : 'DISC Assessment Invite'}
              </h3>
              <button onClick={closeMailModal} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-600">✕</button>
            </div>
            <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
              {mailModal.loading ? (
                <p className="text-sm text-gray-500">Loading preview...</p>
              ) : (
                <>
                  {mailModal.error && <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg p-2">{mailModal.error}</p>}
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">To *</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={mailModal.to} onChange={(e) => setMailModal(prev => ({ ...prev, to: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">CC</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={mailModal.cc} onChange={(e) => setMailModal(prev => ({ ...prev, cc: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Subject *</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={mailModal.subject} onChange={(e) => setMailModal(prev => ({ ...prev, subject: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Body</label>
                    <div
                      key={mailModal.kind || ''}
                      contentEditable
                      suppressContentEditableWarning
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm h-48 overflow-y-auto bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      dangerouslySetInnerHTML={{ __html: mailModal.body }}
                      onBlur={(e) => setMailModal(prev => ({ ...prev, body: e.currentTarget.innerHTML }))}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button onClick={closeMailModal} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition text-sm">Cancel</button>
              <button
                onClick={sendMailModal}
                disabled={mailModal.loading || mailModal.sending || !mailModal.to.trim() || !mailModal.subject.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition text-sm ${(!mailModal.loading && !mailModal.sending && mailModal.to.trim() && mailModal.subject.trim()) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-white cursor-not-allowed'}`}
              >
                <Send size={14} /> {mailModal.sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CandidateInformationTab;
