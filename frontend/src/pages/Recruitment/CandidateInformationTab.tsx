// pages/Recruitment/CandidateInformationTab.tsx
import React, { useState, useEffect } from 'react';
import { ExternalLink, Video, Loader2, Edit2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditField, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE } from './applicantTypes';

const CandidateInformationTab = ({
  record, mode, setMode, onSave,
}: {
  record: ApplicantRecord;
  mode: 'view' | 'edit';
  setMode: (m: 'view' | 'edit') => void;
  onSave: (updated: ApplicantRecord) => void;
}) => {
  const [draft,  setDraft]  = useState<ApplicantRecord>(record);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(record); }, [record]);

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