import React, { useState, useEffect } from 'react';
import {
  ExternalLink, Video, Mail, Phone, Loader2,
  Eye, X, Edit2, Save, Plus, Trash2, ChevronDown,
  User, ClipboardList, CheckSquare, StickyNote,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type StatusType = 'New' | 'Reviewed' | 'Shortlisted' | 'Rejected' | 'Hired';

interface InterviewRound {
  _id:           string;
  roundNumber:   number;
  stage:         string;
  customStage:   string;
  scheduledDate: string;
  interviewer:   string;
  mode:          string;
  feedback:      string;
  result:        string;
}

interface FinalDecision {
  decision:     string;
  offeredCTC:   string;
  joiningDate:  string;
  decisionDate: string;
  notes:        string;
}

interface ApplicantRecord {
  _id:                   string;
  applicationRef:        string;
  full_name:             string;
  email:                 string;
  phone:                 string;
  whatsapp_same:         boolean;
  dob:                   string;
  country:               string;
  state:                 string;
  city:                  string;
  pin_code:              string;
  relocation:            string;
  designation:           string;
  designation_id?:       number;
  highest_qualification: string;
  experience:            'Yes' | 'No';
  total_experience:      string;
  current_ctc:           string;
  notice_period:         string;
  expected_monthly_ctc:  string;
  hindi_read:    string; hindi_write:   string; hindi_speak:   string;
  english_read:  string; english_write: string; english_speak: string;
  facebookLink:    string;
  linkedin:        string;
  short_video_url: string;
  internalNotes:   string;
  status:          StatusType;
  interviewRounds: InterviewRound[];
  finalDecision:   FinalDecision;
  createdAt:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: StatusType[] = ['New', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'];

const STATUS_COLORS: Record<string, string> = {
  New:         'bg-blue-100   text-blue-700',
  Reviewed:    'bg-slate-100  text-slate-700',
  Shortlisted: 'bg-yellow-100 text-yellow-700',
  Rejected:    'bg-red-100    text-red-700',
  Hired:       'bg-green-100  text-green-700',
};

const STAGE_OPTIONS = [
  'HR Screening', 'Technical Round 1', 'Technical Round 2',
  'Manager Round', 'Director Round', 'Assignment / Task',
  'Culture Fit', 'Final Round', 'Other',
];

const RESULT_OPTIONS  = ['Pending', 'Pass', 'Fail', 'No Show', 'Rescheduled'];
const MODE_OPTIONS    = ['Online', 'Offline', 'Phone', 'Not decided'];
const DECISION_OPTIONS = ['Pending', 'Offer Made', 'Rejected', 'On Hold', 'Candidate Withdrew'];

const RESULT_COLORS: Record<string, string> = {
  Pending:     'bg-gray-100    text-gray-600',
  Pass:        'bg-green-100   text-green-700',
  Fail:        'bg-red-100     text-red-700',
  'No Show':   'bg-orange-100  text-orange-700',
  Rescheduled: 'bg-purple-100  text-purple-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable field components
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ label, value }: { label: string; value?: string | boolean }) => (
  <div>
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
    <p className="text-sm text-gray-800 font-medium">
      {value === true ? 'Yes' : value === false ? 'No' : value || '—'}
    </p>
  </div>
);

const EditField = ({
  label, name, value, onChange, type = 'text',
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void; type?: string;
}) => (
  <div>
    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
    />
  </div>
);

const EditSelect = ({
  label, name, value, options, onChange,
}: {
  label: string; name: string; value: string;
  options: string[]; onChange: (n: string, v: string) => void;
}) => (
  <div>
    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">{label}</label>
    <select
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — Candidate Details
// ─────────────────────────────────────────────────────────────────────────────
const CandidateDetailsTab = ({
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

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — Interview Rounds
// ─────────────────────────────────────────────────────────────────────────────
const emptyRound = (): Omit<InterviewRound, '_id'> => ({
  roundNumber:   1,
  stage:         'HR Screening',
  customStage:   '',
  scheduledDate: '',
  interviewer:   '',
  mode:          'Not decided',
  feedback:      '',
  result:        'Pending',
});

const InterviewTab = ({
  record,
  onUpdate,
}: {
  record: ApplicantRecord;
  onUpdate: (updated: ApplicantRecord) => void;
}) => {
  const [rounds,    setRounds]    = useState<InterviewRound[]>(record.interviewRounds ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts,    setDrafts]    = useState<Record<string, Partial<InterviewRound>>>({});
  const [adding,    setAdding]    = useState(false);
  const [newRound,  setNewRound]  = useState(emptyRound());
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { setRounds(record.interviewRounds ?? []); }, [record]);

  const startEdit = (r: InterviewRound) => {
    setEditingId(r._id);
    setDrafts((p) => ({ ...p, [r._id]: { ...r } }));
  };

  const handleDraftChange = (id: string, field: string, value: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));

  const saveRound = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(drafts[id]),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      setEditingId(null);
      toast.success('Round updated');
    } catch {
      toast.error('Failed to save round');
    } finally {
      setSaving(false);
    }
  };

  const deleteRound = async (id: string) => {
    if (!window.confirm('Delete this round?')) return;
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      toast.success('Round deleted');
    } catch {
      toast.error('Failed to delete round');
    }
  };

  const addRound = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/interview-rounds`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newRound),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRounds(json.data.interviewRounds);
      onUpdate(json.data);
      setAdding(false);
      setNewRound(emptyRound());
      toast.success('Round added');
    } catch {
      toast.error('Failed to add round');
    } finally {
      setSaving(false);
    }
  };

  const RoundForm = ({
    data, onChange, onSave, onCancel,
  }: {
    data: Partial<InterviewRound>;
    onChange: (f: string, v: string) => void;
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <EditSelect label="Stage"        name="stage"         value={data.stage || ''}         options={STAGE_OPTIONS}  onChange={(_, v) => onChange('stage', v)} />
      {data.stage === 'Other' && (
        <EditField  label="Custom Stage" name="customStage"  value={data.customStage || ''}  onChange={(_, v) => onChange('customStage', v)} />
      )}
      <EditField  label="Date"         name="scheduledDate" value={data.scheduledDate || ''} onChange={(_, v) => onChange('scheduledDate', v)} type="date" />
      <EditField  label="Interviewer"  name="interviewer"   value={data.interviewer || ''}   onChange={(_, v) => onChange('interviewer', v)} />
      <EditSelect label="Mode"         name="mode"          value={data.mode || ''}          options={MODE_OPTIONS}   onChange={(_, v) => onChange('mode', v)} />
      <EditSelect label="Result"       name="result"        value={data.result || ''}        options={RESULT_OPTIONS} onChange={(_, v) => onChange('result', v)} />
      <div className="col-span-2 md:col-span-3">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Feedback / Notes</label>
        <textarea
          value={data.feedback || ''}
          onChange={(e) => onChange('feedback', e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
        />
      </div>
      <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Round cards */}
      {rounds.length === 0 && !adding && (
        <div className="text-center py-12 text-gray-400">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No interview rounds yet.</p>
        </div>
      )}

      {rounds.map((r) => (
        <div key={r._id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-lime-100 text-lime-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {r.roundNumber}
              </span>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  {r.stage === 'Other' ? r.customStage || 'Other' : r.stage}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}
                  {r.interviewer && ` · ${r.interviewer}`}
                  {r.mode && r.mode !== 'Not decided' && ` · ${r.mode}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RESULT_COLORS[r.result] || 'bg-gray-100 text-gray-600'}`}>
                {r.result}
              </span>
              {editingId !== r._id && (
                <>
                  <button onClick={() => startEdit(r)}   className="p-1 text-gray-400 hover:text-lime-600 hover:bg-lime-50 rounded transition"><Edit2 size={13} /></button>
                  <button onClick={() => deleteRound(r._id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </div>

          {r.feedback && editingId !== r._id && (
            <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{r.feedback}</p>
          )}

          {editingId === r._id && (
            <RoundForm
              data={drafts[r._id] || r}
              onChange={(f, v) => handleDraftChange(r._id, f, v)}
              onSave={() => saveRound(r._id)}
              onCancel={() => setEditingId(null)}
            />
          )}
        </div>
      ))}

      {/* Add round form */}
      {adding && (
        <div className="border border-lime-200 rounded-xl p-4 bg-lime-50/40">
          <p className="text-sm font-bold text-gray-700 mb-1">New Round — #{rounds.length + 1}</p>
          <RoundForm
            data={newRound}
            onChange={(f, v) => setNewRound((p) => ({ ...p, [f]: v }))}
            onSave={addRound}
            onCancel={() => { setAdding(false); setNewRound(emptyRound()); }}
          />
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 hover:border-lime-400 hover:text-lime-600 rounded-xl text-sm text-gray-400 transition"
        >
          <Plus size={15} /> Add Interview Round
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3 — Final Decision
// ─────────────────────────────────────────────────────────────────────────────
const DECISION_COLORS: Record<string, string> = {
  Pending:              'bg-gray-100    text-gray-600',
  'Offer Made':         'bg-green-100   text-green-700',
  Rejected:             'bg-red-100     text-red-700',
  'On Hold':            'bg-yellow-100  text-yellow-700',
  'Candidate Withdrew': 'bg-orange-100  text-orange-700',
};

const FinalDecisionTab = ({
  record,
  onUpdate,
}: {
  record: ApplicantRecord;
  onUpdate: (updated: ApplicantRecord) => void;
}) => {
  const [draft,  setDraft]  = useState<FinalDecision>(record.finalDecision ?? {} as FinalDecision);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(record.finalDecision ?? {} as FinalDecision); }, [record]);

  const handleChange = (field: string, value: string) =>
    setDraft((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/final-decision`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onUpdate(json.data);
      toast.success('Final decision saved');
    } catch {
      toast.error('Failed to save decision');
    } finally {
      setSaving(false);
    }
  };

  const currentDecision = draft.decision || 'Pending';

  return (
    <div className="space-y-6">
      {/* Decision badge */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
        <CheckSquare size={20} className="text-gray-400" />
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Current Decision</p>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${DECISION_COLORS[currentDecision]}`}>
            {currentDecision}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EditSelect
          label="Decision *"
          name="decision"
          value={draft.decision || 'Pending'}
          options={DECISION_OPTIONS}
          onChange={(_, v) => handleChange('decision', v)}
        />
        <EditField
          label="Offered CTC (₹)"
          name="offeredCTC"
          value={draft.offeredCTC || ''}
          onChange={(_, v) => handleChange('offeredCTC', v)}
        />
        <EditField
          label="Joining Date"
          name="joiningDate"
          value={draft.joiningDate ? draft.joiningDate.split('T')[0] : ''}
          onChange={(_, v) => handleChange('joiningDate', v)}
          type="date"
        />
        <EditField
          label="Decision Date"
          name="decisionDate"
          value={draft.decisionDate ? draft.decisionDate.split('T')[0] : ''}
          onChange={(_, v) => handleChange('decisionDate', v)}
          type="date"
        />
      </div>

      <div>
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Notes</label>
        <textarea
          value={draft.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          placeholder="Any additional notes about the hiring decision..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-xl transition"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Decision
        </button>
      </div>

      {/* Summary card when decision is made */}
      {currentDecision !== 'Pending' && (
        <div className={`mt-4 p-4 rounded-xl border ${
          currentDecision === 'Offer Made'  ? 'bg-green-50  border-green-200' :
          currentDecision === 'Rejected'    ? 'bg-red-50    border-red-200'   :
          currentDecision === 'On Hold'     ? 'bg-yellow-50 border-yellow-200' :
                                              'bg-orange-50 border-orange-200'
        }`}>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Decision Summary</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {draft.offeredCTC  && <div><span className="text-gray-400">Offered CTC:</span> <strong>{draft.offeredCTC}</strong></div>}
            {draft.joiningDate && <div><span className="text-gray-400">Joining:</span> <strong>{new Date(draft.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>}
            {draft.decisionDate && <div><span className="text-gray-400">Decided on:</span> <strong>{new Date(draft.decisionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>}
          </div>
          {draft.notes && <p className="mt-2 text-xs text-gray-600 italic">"{draft.notes}"</p>}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell — tabs + shared status selector
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'details',   label: 'Candidate Details', icon: User },
  { id: 'interview', label: 'Interview',          icon: ClipboardList },
  { id: 'decision',  label: 'Final Decision',     icon: CheckSquare },
] as const;

type TabId = typeof TABS[number]['id'];

const ApplicantModal = ({
  record,
  onClose,
  onUpdate,
  initialTab = 'details',
}: {
  record:      ApplicantRecord;
  onClose:     () => void;
  onUpdate:    (updated: ApplicantRecord) => void;
  initialTab?: TabId;
}) => {
  const [activeTab,  setActiveTab]  = useState<TabId>(initialTab);
  const [editMode,   setEditMode]   = useState<'view' | 'edit'>('view');
  const [localRec,   setLocalRec]   = useState<ApplicantRecord>(record);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => { setLocalRec(record); setActiveTab(initialTab); }, [record, initialTab]);

  const handleRecordUpdate = (updated: ApplicantRecord) => {
    setLocalRec(updated);
    onUpdate(updated);
  };

  const handleStatusChange = async (newStatus: StatusType) => {
    setStatusBusy(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${localRec._id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      handleRecordUpdate(json.data);
      toast.success(`Status → ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Interview round count badge
  const roundCount = localRec.interviewRounds?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* ── Modal header ── */}
        <div className="flex items-start justify-between px-6 py-4 border-b gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{localRec.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Applied {new Date(localRec.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              &nbsp;·&nbsp;{localRec.designation || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status dropdown */}
            <div className="relative flex items-center gap-1">
              {statusBusy && <Loader2 size={12} className="animate-spin text-gray-400" />}
              <select
                value={localRec.status}
                onChange={(e) => handleStatusChange(e.target.value as StatusType)}
                disabled={statusBusy}
                className={`text-xs font-bold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-lime-400 ${STATUS_COLORS[localRec.status]}`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b px-6 gap-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
                activeTab === id
                  ? 'border-lime-500 text-lime-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'interview' && roundCount > 0 && (
                <span className="ml-1 bg-lime-100 text-lime-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {roundCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content — scrollable ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === 'details' && (
            <CandidateDetailsTab
              record={localRec}
              mode={editMode}
              setMode={setEditMode}
              onSave={handleRecordUpdate}
            />
          )}
          {activeTab === 'interview' && (
            <InterviewTab record={localRec} onUpdate={handleRecordUpdate} />
          )}
          {activeTab === 'decision' && (
            <FinalDecisionTab record={localRec} onUpdate={handleRecordUpdate} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page — Applicant Records table
// ─────────────────────────────────────────────────────────────────────────────
const AllApplicants: React.FC = () => {
  const [records,    setRecords]    = useState<ApplicantRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<ApplicantRecord | null>(null);
  const [initialTab, setInitialTab] = useState<TabId>('details');

  useEffect(() => {
    fetch(`${API_BASE}/applicant-records`)
      .then((r) => r.json())
      .then((res) => { setRecords(res.data ?? []); setLoading(false); })
      .catch(() => { toast.error('Failed to load records'); setLoading(false); });
  }, []);

  const handleUpdate = (updated: ApplicantRecord) => {
    setRecords((prev) => prev.map((r) => r._id === updated._id ? updated : r));
    setSelected(updated);
  };

  const openModal = (record: ApplicantRecord, tab: TabId = 'details') => {
    setInitialTab(tab);
    setSelected(record);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Toaster position="top-right" />

      {selected && (
        <ApplicantModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          initialTab={initialTab}
        />
      )}

      <div className="w-64 flex-shrink-0 z-10 bg-white border-r">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white shadow-sm z-20 flex items-center px-4">
          <Navbar />
        </div>

        <main className="flex-1 overflow-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Recruitment Tracker</h1>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
              {records.length} Applicants
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center mt-20">
              <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center mt-20 text-gray-400">No applications yet.</div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b font-semibold text-gray-600">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Designation</th>
                    <th className="p-4">Current CTC</th>
                    <th className="p-4">Expected CTC</th>
                    <th className="p-4">Exp</th>
                    <th className="p-4">Location</th>
                    <th className="p-4 text-center">Interviews</th>
                    <th className="p-4 text-center">Profiles</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{r.full_name}</td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2 text-gray-600"><Mail size={14} />{r.email}</div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs"><Phone size={14} />{r.phone}</div>
                      </td>
                      <td className="p-4 text-gray-600 text-xs">{r.designation || '—'}</td>
                      <td className="p-4 font-medium">{r.current_ctc || 'N/A'}</td>
                      <td className="p-4 font-medium">{r.expected_monthly_ctc || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.experience === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {r.experience === 'Yes' ? 'EXP' : 'FRESH'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{[r.city, r.state].filter(Boolean).join(', ')}</td>
                      <td className="p-4 text-center">
                        {(r.interviewRounds?.length ?? 0) > 0 ? (
                          <button
                            onClick={() => openModal(r, 'interview')}
                            className="inline-flex items-center gap-1 text-xs text-lime-700 bg-lime-50 hover:bg-lime-100 px-2 py-0.5 rounded-full transition"
                          >
                            <ClipboardList size={11} />
                            {r.interviewRounds.length} round{r.interviewRounds.length !== 1 ? 's' : ''}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-3">
                          {r.linkedin        && <a href={r.linkedin}        target="_blank" rel="noreferrer" className="text-blue-500 hover:scale-110 transition-transform"><ExternalLink size={16} /></a>}
                          {r.short_video_url && <a href={r.short_video_url} target="_blank" rel="noreferrer" className="text-red-500  hover:scale-110 transition-transform"><Video size={16} /></a>}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(r, 'details')}
                            className="p-1.5 text-gray-400 hover:text-lime-600 hover:bg-lime-50 rounded-lg transition"
                            title="View / Edit"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => openModal(r, 'interview')}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Interview rounds"
                          >
                            <ClipboardList size={15} />
                          </button>
                          <button
                            onClick={() => openModal(r, 'decision')}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            title="Final decision"
                          >
                            <CheckSquare size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AllApplicants;