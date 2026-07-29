// pages/Recruitment/CandidateInformationTab.tsx
import React, { useState, useEffect } from 'react';
import { ExternalLink, Video, Loader2, Edit2, Save, Sparkles, FileText, Linkedin } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditField, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE } from './applicantTypes';

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

const CandidateInformationTab = ({
  record, mode, setMode, onSave,
}: {
  record: ApplicantRecordWithAI;
  mode: 'view' | 'edit';
  setMode: (m: 'view' | 'edit') => void;
  onSave: (updated: ApplicantRecord) => void;
}) => {
  const [draft,     setDraft]     = useState<ApplicantRecordWithAI>(record);
  const [saving,    setSaving]    = useState(false);
  const [jdLink,    setJdLink]    = useState<string | null>(null);
  const [jdError,   setJdError]   = useState<string | null>(null);
  const [loadingJd, setLoadingJd] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { setDraft(record); }, [record]);

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

  const handleChange = (name: string, value: string) =>
    setDraft(p => ({ ...p, [name]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSave(json.data);
      toast.success('Candidate details saved');
      setMode('view');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
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
      toast.success(`Fit score: ${json.data.ai_fit_score}/10`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Section header helper ────────────────────────────────────────────────
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  );

  return (
    <div className="space-y-6">

      {/* ── Top action bar: Resume + LinkedIn + Edit/Save ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

        {/* Resume + LinkedIn links — always visible at top */}
        <div className="flex items-center flex-wrap gap-2">
          {draft.resume && (
            <a
              href={resolveResumeUrl(draft.resume)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              <ExternalLink size={13} />
              Resume
            </a>
          )}
          {draft.linkedin && (
            <a
              href={draft.linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              {/* Lucide doesn't have LinkedIn — ExternalLink with label works cleanly */}
              <ExternalLink size={13} />
              LinkedIn
            </a>
          )}
          {draft.short_video_url && (
            <a
              href={draft.short_video_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              <Video size={13} />
              Video
            </a>
          )}
        </div>

        {/* Edit / Save controls */}
        <div className="flex gap-2 flex-shrink-0">
          {mode === 'view' ? (
            <button
              onClick={() => setMode('edit')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-lg transition"
            >
              <Edit2 size={13} /> Edit Details
            </button>
          ) : (
            <>
              <button
                onClick={() => { setDraft(record); setMode('view'); }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── JD + AI Fit ── */}
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <SectionLabel>Job Description &amp; AI Fit</SectionLabel>
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
            {draft.ai_fit_score != null && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                draft.ai_fit_score >= 8 ? 'bg-green-100 text-green-700'
                  : draft.ai_fit_score >= 5 ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                Fit: {draft.ai_fit_score}/10
              </span>
            )}
            <button
              onClick={handleAnalyze}
              disabled={!jdLink || analyzing}
              title={!jdLink ? 'No JD available' : 'Analyze fit'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
            >
              {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {draft.ai_fit_score != null ? 'Re-analyze' : 'Analyze Fit'}
            </button>
          </div>
        </div>
        {draft.ai_fit_summary && (
          <p className="text-sm text-gray-600 leading-relaxed mt-3 border-t border-gray-200 pt-3">
            {draft.ai_fit_summary}
          </p>
        )}
      </section>

      {/* ── Personal ── */}
      <section>
        <SectionLabel>Personal</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          {mode === 'view' ? (
            <>
              <Field label="Full Name"  value={draft.full_name} />
              <Field label="Email"      value={draft.email} />
              <Field label="Phone"      value={draft.phone} />
              <Field label="WhatsApp"   value={draft.whatsapp_same ? 'Same as phone' : 'Different'} />
              <Field label="DOB"        value={draft.dob} />
              <Field label="Country"    value={draft.country} />
            </>
          ) : (
            <>
              <EditField label="Full Name" name="full_name" value={draft.full_name} onChange={handleChange} />
              <EditField label="Email"     name="email"     value={draft.email}     onChange={handleChange} type="email" />
              <EditField label="Phone"     name="phone"     value={draft.phone}     onChange={handleChange} />
              <EditField label="DOB"       name="dob"       value={draft.dob}       onChange={handleChange} type="date" />
              <EditField label="Country"   name="country"   value={draft.country}   onChange={handleChange} />
            </>
          )}
        </div>
      </section>

      {/* ── Location ── */}
      <section>
        <SectionLabel>Location</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          {mode === 'view' ? (
            <>
              <Field label="State"      value={draft.state} />
              <Field label="City"       value={draft.city} />
              <Field label="Pin Code"   value={draft.pin_code} />
              <Field label="Relocation" value={draft.relocation} />
            </>
          ) : (
            <>
              <EditField  label="State"      name="state"      value={draft.state}      onChange={handleChange} />
              <EditField  label="City"       name="city"       value={draft.city}       onChange={handleChange} />
              <EditField  label="Pin Code"   name="pin_code"   value={draft.pin_code}   onChange={handleChange} />
              <EditSelect label="Relocation" name="relocation" value={draft.relocation} options={['Yes', 'No']} onChange={handleChange} />
            </>
          )}
        </div>
      </section>

      {/* ── Professional ── */}
      <section>
        <SectionLabel>Professional</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          {mode === 'view' ? (
            <>
              <Field label="Designation"   value={draft.designation} />
              <Field label="Qualification" value={draft.highest_qualification} />
              <Field label="Experience"    value={draft.experience} />
              <Field label="Total Exp"     value={draft.total_experience ? `${draft.total_experience} yrs` : undefined} />
              <Field label="Current CTC"   value={draft.current_ctc} />
              <Field label="Notice Period" value={draft.notice_period ? `${draft.notice_period} days` : undefined} />
              <Field label="Expected CTC"  value={draft.expected_monthly_ctc} />
            </>
          ) : (
            <>
              <EditField  label="Designation"      name="designation"           value={draft.designation}           onChange={handleChange} />
              <EditField  label="Qualification"    name="highest_qualification" value={draft.highest_qualification} onChange={handleChange} />
              <EditSelect label="Experience"       name="experience"            value={draft.experience}            options={['Yes', 'No']}  onChange={handleChange} />
              <EditField  label="Total Exp (yrs)"  name="total_experience"      value={draft.total_experience}      onChange={handleChange} />
              <EditField  label="Current CTC"      name="current_ctc"           value={draft.current_ctc}           onChange={handleChange} />
              <EditField  label="Notice Period"    name="notice_period"         value={draft.notice_period}         onChange={handleChange} />
              <EditField  label="Expected CTC"     name="expected_monthly_ctc"  value={draft.expected_monthly_ctc}  onChange={handleChange} />
            </>
          )}
        </div>
      </section>

      {/* ── Language Proficiency ── */}
      <section>
        <SectionLabel>Language Proficiency</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { lang: 'Hindi',   r: draft.hindi_read,   w: draft.hindi_write,   s: draft.hindi_speak   },
            { lang: 'English', r: draft.english_read, w: draft.english_write, s: draft.english_speak },
          ].map(({ lang, r, w, s }) => (
            <div key={lang} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-600 mb-3">{lang}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Read', r], ['Write', w], ['Speak', s]].map(([label, val]) => (
                  <div key={label as string}>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
                    <span className="inline-block bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium text-gray-700">
                      {val || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Resume (edit fallback) ── */}
      {mode === 'edit' && (
        <section>
          <SectionLabel>Resume Link (override)</SectionLabel>
          <EditField label="Paste a URL (Google Drive, etc.)" name="resume" value={draft.resume} onChange={handleChange} type="url" />
        </section>
      )}

      {/* ── Social & Media links ── */}
      {(draft.linkedin || draft.facebookLink || draft.short_video_url) && mode === 'view' && (
        <section>
          <SectionLabel>Social &amp; Media</SectionLabel>
          <div className="flex gap-2 flex-wrap">
            {draft.linkedin && (
              <a href={draft.linkedin} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                <ExternalLink size={12} /> LinkedIn
              </a>
            )}
            {draft.facebookLink && (
              <a href={draft.facebookLink} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">
                <ExternalLink size={12} /> Facebook
              </a>
            )}
            {draft.short_video_url && (
              <a href={draft.short_video_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                <Video size={12} /> Resume Video
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── Internal Notes ── */}
      <section>
        <SectionLabel>Internal Notes</SectionLabel>
        <textarea
          value={draft.internalNotes || ''}
          onChange={e => handleChange('internalNotes', e.target.value)}
          rows={4}
          placeholder="HR-only notes — not visible to the candidate"
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 resize-none transition bg-white"
        />
        {mode === 'edit' && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Notes
            </button>
          </div>
        )}
      </section>

    </div>
  );
};

export default CandidateInformationTab;