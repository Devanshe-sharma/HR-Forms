// pages/Recruitment/CandidateInformationTab.tsx
import React, { useState, useEffect } from 'react';
import { ExternalLink, Video, Loader2, Edit2, Save, Sparkles, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditField, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE } from './applicantTypes';

// AI fit fields — kept as a local extension of ApplicantRecord rather
// than editing applicantTypes.ts directly, since these are optional
// additions that don't change any existing behavior.
type ApplicantRecordWithAI = ApplicantRecord & {
  ai_fit_score?: number | null;
  ai_fit_summary?: string;
};

// The resume field stores whatever the upload pipeline saved — a
// RELATIVE path like "/uploads/resumes/xyz.pdf", since that's what the
// backend's multer + static-file route actually returns. Rendered as-is
// in an <a href>, a relative path resolves against the FRONTEND's own
// domain (e.g. hr.briskolive.com), not the backend server that actually
// serves the file — a guaranteed 404 regardless of whether the upload
// itself worked correctly.
//
// This still supports the manual "paste a link" fallback this component
// already offered before the auto-upload pipeline existed — if someone
// pastes a full external URL directly (e.g. a Google Drive link), that's
// left completely untouched rather than getting double-prefixed.
function resolveResumeUrl(resume?: string): string {
  if (!resume) return '';
  if (/^https?:\/\//i.test(resume)) return resume; // already absolute — leave alone
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
  const [draft,  setDraft]  = useState<ApplicantRecordWithAI>(record);
  const [saving, setSaving] = useState(false);

  // JD link for this candidate's matching requisition — fetched once
  // per record, shown directly here rather than only surfacing on the
  // backend's own internal lookup. Analyzing from this tab sends this
  // exact value along with the request, so there's no way for the
  // score to end up based on a different JD than what's actually shown
  // on screen.
  const [jdLink,     setJdLink]     = useState<string | null>(null);
  const [jdError,    setJdError]    = useState<string | null>(null);
  const [loadingJd,  setLoadingJd]  = useState(true);
  const [analyzing,  setAnalyzing]  = useState(false);

  useEffect(() => { setDraft(record); }, [record]);

  useEffect(() => {
    setLoadingJd(true);
    setJdLink(null);
    setJdError(null);

    fetch(`${API_BASE}/applicant-records/${record._id}/jd-link`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setJdLink(json.data.jdLink);
        else setJdError(json.message || 'Could not fetch JD link');
      })
      .catch(() => setJdError('Could not fetch JD link'))
      .finally(() => setLoadingJd(false));
  }, [record._id]);

  const handleChange = (name: string, value: string) =>
    setDraft((p) => ({ ...p, [name]: value }));

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

  return (
    <div className="space-y-6">
      {/* Edit / Save bar */}
      <div className="flex justify-end gap-2">
        {mode === 'view' ? (
          <button
            onClick={() => setMode('edit')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-lg transition"
          >
            <Edit2 size={13} /> Edit Details
          </button>
        ) : (
          <>
            <button
              onClick={() => { setDraft(record); setMode('view'); }}
              className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </>
        )}
      </div>

      {/* JD + AI Fit — shown up top since it's the main context for
          reviewing whether this candidate is worth pursuing */}
      <section className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Job Description & Fit</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {loadingJd ? (
              <span className="flex items-center gap-1.5 text-sm text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Loading JD…
              </span>
            ) : jdLink ? (
              <a href={jdLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
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
              title={!jdLink ? 'No JD available to analyze against' : 'Analyze fit'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
            >
              {analyzing
                ? <Loader2 size={13} className="animate-spin" />
                : <Sparkles size={13} />}
              {draft.ai_fit_score != null ? 'Re-analyze' : 'Analyze Fit'}
            </button>
          </div>
        </div>
        {draft.ai_fit_summary && (
          <p className="text-sm text-gray-600 mt-3">{draft.ai_fit_summary}</p>
        )}
      </section>

      {/* Personal */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Personal</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Location */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Location</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {mode === 'view' ? (
            <>
              <Field label="State"      value={draft.state} />
              <Field label="City"       value={draft.city} />
              <Field label="Pin Code"   value={draft.pin_code} />
              <Field label="Relocation" value={draft.relocation} />
            </>
          ) : (
            <>
              <EditField label="State"    name="state"    value={draft.state}    onChange={handleChange} />
              <EditField label="City"     name="city"     value={draft.city}     onChange={handleChange} />
              <EditField label="Pin Code" name="pin_code" value={draft.pin_code} onChange={handleChange} />
              <EditSelect label="Relocation" name="relocation" value={draft.relocation} options={['Yes', 'No']} onChange={handleChange} />
            </>
          )}
        </div>
      </section>

      {/* Professional */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Professional</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              <EditField label="Designation"   name="designation"           value={draft.designation}           onChange={handleChange} />
              <EditField label="Qualification" name="highest_qualification" value={draft.highest_qualification} onChange={handleChange} />
              <EditSelect label="Experience"   name="experience"            value={draft.experience}            options={['Yes', 'No']} onChange={handleChange} />
              <EditField label="Total Exp (yrs)" name="total_experience"    value={draft.total_experience}      onChange={handleChange} />
              <EditField label="Current CTC"   name="current_ctc"          value={draft.current_ctc}           onChange={handleChange} />
              <EditField label="Notice Period" name="notice_period"        value={draft.notice_period}         onChange={handleChange} />
              <EditField label="Expected CTC"  name="expected_monthly_ctc" value={draft.expected_monthly_ctc}  onChange={handleChange} />
            </>
          )}
        </div>
      </section>

      {/* Language */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Language Proficiency</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { lang: 'Hindi',   r: draft.hindi_read,   w: draft.hindi_write,   s: draft.hindi_speak   },
            { lang: 'English', r: draft.english_read, w: draft.english_write, s: draft.english_speak },
          ].map(({ lang, r, w, s }) => (
            <div key={lang} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-600 mb-2">{lang}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[['Read', r], ['Write', w], ['Speak', s]].map(([label, val]) => (
                  <div key={label as string}>
                    <p className="text-gray-400 mb-1">{label}</p>
                    <span className="bg-white border rounded px-1.5 py-0.5 font-medium text-gray-700">{val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resume — the upload pipeline (multer + FormData on the
          application form) does actually save this now, as a relative
          path like "/uploads/resumes/xyz.pdf". resolveResumeUrl() turns
          that into a real absolute URL against the backend's own origin
          before it's ever used as a link — otherwise the browser tries
          to resolve it against the FRONTEND's domain instead, which
          404s regardless of whether the upload worked. The manual
          "paste a link" edit fallback below is left in place too, for
          anyone who wants to link an external resume (e.g. Google
          Drive) instead of relying on the upload. */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Resume</p>
        {mode === 'view' ? (
          draft.resume ? (
            <a href={resolveResumeUrl(draft.resume)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition">
              <ExternalLink size={12} /> View Resume
            </a>
          ) : (
            <p className="text-sm text-gray-400">No resume on file</p>
          )
        ) : (
          <EditField label="Resume Link" name="resume" value={draft.resume} onChange={handleChange} type="url" />
        )}
      </section>

      {/* Links */}
      {(draft.linkedin || draft.facebookLink || draft.short_video_url) && (
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Links</p>
          <div className="flex gap-3 flex-wrap">
            {draft.linkedin && (
              <a href={draft.linkedin} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                <ExternalLink size={12} /> LinkedIn
              </a>
            )}
            {draft.facebookLink && (
              <a href={draft.facebookLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">
                <ExternalLink size={12} /> Facebook
              </a>
            )}
            {draft.short_video_url && (
              <a href={draft.short_video_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                <Video size={12} /> Resume Video
              </a>
            )}
          </div>
        </section>
      )}

      {/* Internal notes */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Internal Notes</p>
        <textarea
          value={draft.internalNotes || ''}
          onChange={(e) => handleChange('internalNotes', e.target.value)}
          rows={3}
          placeholder="HR-only notes (not visible to the candidate)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
        />
        {mode === 'edit' && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
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