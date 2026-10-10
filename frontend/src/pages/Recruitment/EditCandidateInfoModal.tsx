// pages/Recruitment/EditCandidateInfoModal.tsx
import React, { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditField, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE } from './applicantTypes';

// All the fields the old inline-edit form on CandidateInformationTab used to
// hold — moved here behind the "Edit Information" button in the modal
// header, matching the mockup's separate edit popup instead of an always-
// editable form mixed into the read-only view.
const EditCandidateInfoModal = ({
  record, onClose, onSave,
}: {
  record: ApplicantRecord;
  onClose: () => void;
  onSave: (updated: ApplicantRecord) => void;
}) => {
  const [draft, setDraft] = useState<ApplicantRecord>(record);
  const [saving, setSaving] = useState(false);

  const handleChange = (name: string, value: string) =>
    setDraft((p) => ({ ...p, [name]: value } as ApplicantRecord));

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
      onClose();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0">
          <p className="text-sm font-bold text-gray-800">Edit Information — {record.full_name}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <EditField label="Full Name" name="full_name" value={draft.full_name} onChange={handleChange} />
              <EditField label="Email"     name="email"     value={draft.email}     onChange={handleChange} type="email" />
              <EditField label="Phone"     name="phone"     value={draft.phone}     onChange={handleChange} />
              <EditField label="DOB"       name="dob"       value={draft.dob}       onChange={handleChange} type="date" />
              <EditField label="Country"   name="country"   value={draft.country}   onChange={handleChange} />
              <EditField label="LinkedIn"  name="linkedin"  value={draft.linkedin}  onChange={handleChange} type="url" />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Location</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <EditField  label="State"      name="state"      value={draft.state}      onChange={handleChange} />
              <EditField  label="City"       name="city"       value={draft.city}       onChange={handleChange} />
              <EditField  label="Pin Code"   name="pin_code"   value={draft.pin_code}   onChange={handleChange} />
              <EditSelect label="Relocation" name="relocation" value={draft.relocation} options={['Yes', 'No']} onChange={handleChange} />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Professional</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <EditField  label="Designation"      name="designation"           value={draft.designation}           onChange={handleChange} />
              <EditField  label="Qualification"    name="highest_qualification" value={draft.highest_qualification} onChange={handleChange} />
              <EditSelect label="Experience"       name="experience"            value={draft.experience}            options={['Yes', 'No']}  onChange={handleChange} />
              <EditField  label="Total Exp (yrs)"  name="total_experience"      value={draft.total_experience}      onChange={handleChange} />
              <EditField  label="Current CTC"      name="current_ctc"           value={draft.current_ctc}           onChange={handleChange} />
              <EditField  label="Notice Period"    name="notice_period"         value={draft.notice_period}         onChange={handleChange} />
              <EditField  label="Expected CTC"     name="expected_monthly_ctc"  value={draft.expected_monthly_ctc}  onChange={handleChange} />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resume Link (override)</p>
            <EditField label="Paste a URL (Google Drive, etc.)" name="resume" value={draft.resume} onChange={handleChange} type="url" />
          </section>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCandidateInfoModal;
