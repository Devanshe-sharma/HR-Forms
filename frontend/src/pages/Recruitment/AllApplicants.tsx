import React, { useState, useEffect } from 'react';
import {
  ExternalLink, Video, Mail, Phone, Loader2, CheckCircle2,
  Eye, X, Edit2, Save, ChevronDown,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

// ── Types ─────────────────────────────────────────────────────────────────────
type StatusType =
  | 'Applied' | 'Shortlisted' | 'Rejected' | '1st' | '2nd' | '3rd'
  | 'Final Interview Round' | 'Selected' | 'Offer Letter Sent'
  | 'Offer Letter Accepted' | 'Offer Letter Accepted But Not Joined' | 'Joined';

interface Candidate {
  _id:                   string;
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
  hindi_read:            string;
  hindi_write:           string;
  hindi_speak:           string;
  english_read:          string;
  english_write:         string;
  english_speak:         string;
  facebookLink:          string;
  linkedin:              string;
  short_video_url:       string;
  status:                StatusType;
  createdAt:             string;
}

const STATUS_OPTIONS: StatusType[] = [
  'Applied', 'Shortlisted', 'Rejected', '1st', '2nd', '3rd',
  'Final Interview Round', 'Selected', 'Offer Letter Sent',
  'Offer Letter Accepted', 'Offer Letter Accepted But Not Joined', 'Joined',
];

const STATUS_COLORS: Record<string, string> = {
  Applied:                            'bg-blue-100 text-blue-700',
  Shortlisted:                        'bg-yellow-100 text-yellow-700',
  Rejected:                           'bg-red-100 text-red-700',
  '1st':                              'bg-purple-100 text-purple-700',
  '2nd':                              'bg-purple-100 text-purple-700',
  '3rd':                              'bg-purple-100 text-purple-700',
  'Final Interview Round':            'bg-orange-100 text-orange-700',
  Selected:                           'bg-green-100 text-green-700',
  'Offer Letter Sent':                'bg-teal-100 text-teal-700',
  'Offer Letter Accepted':            'bg-emerald-100 text-emerald-700',
  'Offer Letter Accepted But Not Joined': 'bg-amber-100 text-amber-700',
  Joined:                             'bg-lime-100 text-lime-700',
};

// ── Field row for view mode ────────────────────────────────────────────────────
const Field = ({ label, value }: { label: string; value?: string | boolean }) => (
  <div>
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
    <p className="text-sm text-gray-800 font-medium">{value === true ? 'Yes' : value === false ? 'No' : value || '—'}</p>
  </div>
);

// ── Editable field ────────────────────────────────────────────────────────────
const EditField = ({
  label, name, value, onChange, type = 'text',
}: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string;
}) => (
  <div>
    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
    />
  </div>
);

// ── Candidate Detail Modal ────────────────────────────────────────────────────
const CandidateModal = ({
  candidate,
  onClose,
  onSave,
}: {
  candidate: Candidate;
  onClose: () => void;
  onSave: (updated: Candidate) => void;
}) => {
  const [mode,    setMode]    = useState<'view' | 'edit'>('view');
  const [draft,   setDraft]   = useState<Candidate>(candidate);
  const [saving,  setSaving]  = useState(false);

  const handleChange = (name: string, value: string) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/candidate-applications/${candidate._id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSave(updated.data ?? draft);
      toast.success('Candidate updated successfully');
      setMode('view');
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const proficiencyFields = [
    { lang: 'Hindi',   read: draft.hindi_read,   write: draft.hindi_write,   speak: draft.hindi_speak   },
    { lang: 'English', read: draft.english_read, write: draft.english_write, speak: draft.english_speak },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{candidate.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Applied {new Date(candidate.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              &nbsp;·&nbsp;
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[candidate.status] || 'bg-gray-100 text-gray-600'}`}>
                {candidate.status}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' ? (
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-lg transition"
              >
                <Edit2 size={14} /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setDraft(candidate); setMode('view'); }}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-lime-600 hover:bg-lime-700 disabled:opacity-60 rounded-lg transition"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Personal */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Personal</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mode === 'view' ? (
                <>
                  <Field label="Full Name"  value={draft.full_name} />
                  <Field label="Email"      value={draft.email} />
                  <Field label="Phone"      value={draft.phone} />
                  <Field label="WhatsApp"   value={draft.whatsapp_same ? 'Same as phone' : 'Different'} />
                  <Field label="DOB"        value={draft.dob} />
                </>
              ) : (
                <>
                  <EditField label="Full Name" name="full_name" value={draft.full_name} onChange={handleChange} />
                  <EditField label="Email"     name="email"     value={draft.email}     onChange={handleChange} type="email" />
                  <EditField label="Phone"     name="phone"     value={draft.phone}     onChange={handleChange} />
                  <EditField label="DOB"       name="dob"       value={draft.dob}       onChange={handleChange} type="date" />
                </>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
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
                  <EditField label="State"      name="state"      value={draft.state}      onChange={handleChange} />
                  <EditField label="City"       name="city"       value={draft.city}        onChange={handleChange} />
                  <EditField label="Pin Code"   name="pin_code"   value={draft.pin_code}    onChange={handleChange} />
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Relocation</label>
                    <select
                      value={draft.relocation}
                      onChange={(e) => handleChange('relocation', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Professional */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Professional</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mode === 'view' ? (
                <>
                  <Field label="Designation"    value={draft.designation} />
                  <Field label="Qualification"  value={draft.highest_qualification} />
                  <Field label="Experience"     value={draft.experience} />
                  <Field label="Total Exp"      value={draft.total_experience ? `${draft.total_experience} yrs` : undefined} />
                  <Field label="Current CTC"    value={draft.current_ctc} />
                  <Field label="Notice Period"  value={draft.notice_period ? `${draft.notice_period} days` : undefined} />
                  <Field label="Expected CTC"   value={draft.expected_monthly_ctc} />
                </>
              ) : (
                <>
                  <EditField label="Designation"   name="designation"           value={draft.designation}           onChange={handleChange} />
                  <EditField label="Qualification" name="highest_qualification" value={draft.highest_qualification} onChange={handleChange} />
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Experience</label>
                    <select
                      value={draft.experience}
                      onChange={(e) => handleChange('experience', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </div>
                  <EditField label="Total Exp (yrs)" name="total_experience"    value={draft.total_experience}    onChange={handleChange} />
                  <EditField label="Current CTC"     name="current_ctc"         value={draft.current_ctc}         onChange={handleChange} />
                  <EditField label="Notice Period"   name="notice_period"       value={draft.notice_period}       onChange={handleChange} />
                  <EditField label="Expected CTC"    name="expected_monthly_ctc" value={draft.expected_monthly_ctc} onChange={handleChange} />
                </>
              )}
            </div>
          </div>

          {/* Language */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Language Proficiency</p>
            <div className="grid grid-cols-2 gap-4">
              {proficiencyFields.map(({ lang, read, write, speak }) => (
                <div key={lang} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-gray-600 mb-2">{lang}</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {['Read', 'Write', 'Speak'].map((s, i) => {
                      const val = [read, write, speak][i];
                      return (
                        <div key={s}>
                          <p className="text-gray-400 mb-1">{s}</p>
                          <span className="bg-white border rounded px-1.5 py-0.5 font-medium text-gray-700">{val || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Application Status</p>
            <select
              value={draft.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-lime-400"
            >
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Links */}
          {(draft.linkedin || draft.facebookLink || draft.short_video_url) && (
            <div>
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
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── Main Table ────────────────────────────────────────────────────────────────
const CandidateTable: React.FC = () => {
  const [candidates,  setCandidates]  = useState<Candidate[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Candidate | null>(null);

  useEffect(() => {
    fetch('/api/candidate-applications')
      .then((r) => r.json())
      .then((res) => { setCandidates(res.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, newStatus: StatusType) => {
    setUpdatingId(id);
    const original = [...candidates];
    setCandidates((prev) => prev.map((c) => c._id === id ? { ...c, status: newStatus } : c));

    try {
      const res = await fetch(`/api/candidate-applications/${id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Status updated for ${original.find((c) => c._id === id)?.full_name}`);
    } catch {
      setCandidates(original);
      toast.error('Failed to sync with database.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleModalSave = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => c._id === updated._id ? updated : c));
    setSelected(updated);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Toaster position="top-right" />

      {selected && (
        <CandidateModal
          candidate={selected}
          onClose={() => setSelected(null)}
          onSave={handleModalSave}
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
              {candidates.length} Applicants
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center mt-20">
              <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
          ) : candidates.length === 0 ? (
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
                    <th className="p-4">Exp</th>
                    <th className="p-4">Location</th>
                    <th className="p-4 text-center">Profiles</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {candidates.map((c) => (
                    <tr
                      key={c._id}
                      className={`transition-colors duration-200 ${updatingId === c._id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="p-4 font-bold text-gray-900">{c.full_name}</td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2 text-gray-600"><Mail size={14} />{c.email}</div>
                        <div className="flex items-center gap-2 text-gray-400 text-xs"><Phone size={14} />{c.phone}</div>
                      </td>
                      <td className="p-4 text-gray-600 text-xs">{c.designation || '—'}</td>
                      <td className="p-4 font-medium">{c.current_ctc || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.experience === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.experience === 'Yes' ? 'EXP' : 'FRESH'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{[c.city, c.state].filter(Boolean).join(', ')}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-3">
                          {c.linkedin       && <a href={c.linkedin}       target="_blank" rel="noreferrer" className="text-blue-500 hover:scale-110 transition-transform"><ExternalLink size={16} /></a>}
                          {c.short_video_url && <a href={c.short_video_url} target="_blank" rel="noreferrer" className="text-red-500 hover:scale-110 transition-transform"><Video size={16} /></a>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select
                            disabled={updatingId === c._id}
                            value={c.status}
                            onChange={(e) => handleStatusChange(c._id, e.target.value as StatusType)}
                            className={`border rounded p-1 text-xs font-semibold bg-white cursor-pointer outline-none transition-all ${
                              updatingId === c._id ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'
                            }`}
                          >
                            {STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          {updatingId === c._id && <Loader2 className="animate-spin text-blue-500" size={16} />}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelected(c)}
                          className="p-1.5 text-gray-400 hover:text-lime-600 hover:bg-lime-50 rounded-lg transition"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
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

export default CandidateTable;