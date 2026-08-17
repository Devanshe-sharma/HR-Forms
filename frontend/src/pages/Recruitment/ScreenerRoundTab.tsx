// pages/Recruitment/ScreenerRoundTab.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Edit2, Save, UserCheck, ChevronDown, Lock, Send, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE, SCREENER_STATUS_OPTIONS, SCREENER_STATUS_COLORS } from './applicantTypes';
import { TemplateModal, parseFormattedText, TEMPLATE_FIELDS, SECTIONS } from './FeedbackTemplate';

// Renders saved feedback with bold section/field headings and real spacing
// instead of dumping the raw template string as one flat monospace block.
// Falls back to the raw text when it wasn't built via the template (e.g.
// manually typed notes) — parseFormattedText only finds a round/screener
// header when the text actually matches the template's own format.
const FormattedFeedback = ({ text }: { text: string }) => {
  const parsed = parseFormattedText(text);

  if (!parsed?.__round) {
    return (
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono">
        {text}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-gray-800">
        {parsed.__round}
        {parsed.__screener && <span className="font-normal text-gray-500"> — {parsed.__screener}</span>}
      </p>
      {SECTIONS.map((section) => (
        <div key={section}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 pb-1 border-b border-gray-100">
            {section}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {TEMPLATE_FIELDS.filter((f) => f.section === section && f.id !== 'remarks').map((f) => (
              <p key={f.id} className={`text-sm text-black ${'full' in f && f.full ? 'sm:col-span-2' : ''}`}>
                <span className="font-bold text-gray-900">{f.label}: </span>
                {parsed[f.id] ? <span className="font-normal">{parsed[f.id]}</span> : <span className="font-normal text-gray-400 italic">—</span>}
              </p>
            ))}
          </div>
        </div>
      ))}

      {/* Remarks — free-form and usually longer than the other fields, so it
          gets its own boxed section instead of sitting in the Assessment grid. */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Remarks</p>
        <p className="text-sm font-normal text-black whitespace-pre-wrap">
          {parsed.remarks || <span className="text-gray-400 italic">—</span>}
        </p>
      </div>
    </div>
  );
};

const ScreenerRoundTab = ({
  record, mode, setMode, onSave,
}: {
  record: ApplicantRecord;
  mode: 'view' | 'edit';
  setMode: (m: 'view' | 'edit') => void;
  onSave: (updated: ApplicantRecord) => void;
}) => {
  const [draft, setDraft] = useState({
    screenerName:   record.screenerName   || '',
    screenerStatus: record.screenerStatus || '',
    screenerNotes:  record.screenerNotes  || '',
  });
  const [hrNames,       setHrNames]       = useState<string[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [templateOpen,  setTemplateOpen]  = useState(false);

  // Once the decision is Shortlisted or Rejected, it's final — no further
  // edits, enforced here and again server-side (PATCH /screener-round
  // rejects any change once one of these is already set).
  const isLocked = record.screenerStatus === 'Shortlisted' || record.screenerStatus === 'Rejected';

  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean; to: string; cc: string; subject: string; body: string;
    loading: boolean; sending: boolean; error: string;
  }>({ open: false, to: '', cc: '', subject: '', body: '', loading: false, sending: false, error: '' });

  useEffect(() => {
    setDraft({
      screenerName:   record.screenerName   || '',
      screenerStatus: record.screenerStatus || '',
      screenerNotes:  record.screenerNotes  || '',
    });
  }, [record]);

  useEffect(() => {
    if (isLocked && mode === 'edit') setMode('view');
  }, [isLocked, mode, setMode]);

  const openRejectionModal = async () => {
    setRejectionModal((m) => ({ ...m, open: true, loading: true, error: '' }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/rejection-mail/preview`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load rejection mail');
      setRejectionModal((m) => ({ ...m, loading: false, to: json.data.to, cc: '', subject: json.data.subject, body: json.data.body }));
    } catch (e: any) {
      setRejectionModal((m) => ({ ...m, loading: false, error: e.message || 'Failed to load rejection mail' }));
    }
  };

  const sendRejectionMail = async () => {
    setRejectionModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/rejection-mail/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to: rejectionModal.to.trim() || undefined,
          cc: rejectionModal.cc.trim() || undefined,
          subject: rejectionModal.subject,
          customBody: rejectionModal.body,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send rejection mail');
      toast.success(`Rejection mail sent to ${json.data.sentTo}`);
      if (json.data.record) onSave(json.data.record);
      setRejectionModal((m) => ({ ...m, open: false, sending: false }));
    } catch (e: any) {
      toast.error(e.message || 'Failed to send rejection mail');
      setRejectionModal((m) => ({ ...m, sending: false }));
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/onboarding/employee-master`)
      .then((res) => {
        const all = res.data?.data?.employees ?? [];
        const names = all
          .filter((e: any) => e.is_current && (e.department || '').toLowerCase().includes('human resources'))
          .map((e: any) => e.full_name?.trim())
          .filter(Boolean)
          .sort();
        setHrNames(names);
      })
      .catch((err: any) => console.error('Failed to fetch HR employees:', err));
  }, []);

  const handleChange = (name: string, value: string) =>
    setDraft((p) => ({ ...p, [name]: value }));

  const screenerOptions = Array.from(new Set([
    ...hrNames,
    ...(record.screenerName ? [record.screenerName] : []),
  ].filter(Boolean)));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/applicant-records/${record._id}/screener-round`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSave(json.data);
      toast.success('Screener round saved');
      setMode('view');
    } catch {
      toast.error('Failed to save screener round');
    } finally {
      setSaving(false);
    }
  };

  // Status color — falls back to a neutral style if no match
  const statusColor = draft.screenerStatus
    ? SCREENER_STATUS_COLORS[draft.screenerStatus] || 'bg-gray-100 text-gray-600'
    : null;

  return (
    <div className="space-y-5">

      {/* ── Edit / Save bar ── */}
      <div className="flex justify-between items-center gap-2">
        {isLocked ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Lock size={13} /> This decision is final and cannot be changed
          </div>
        ) : <div />}

        <div className="flex gap-2">
          {record.screenerStatus === 'Rejected' && (
            record.rejectionMailSentAt ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-100 rounded-lg">
                <Check size={13} /> Rejection mail sent {new Date(record.rejectionMailSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            ) : (
              <button
                onClick={openRejectionModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                <Send size={13} /> Send Rejection Mail
              </button>
            )
          )}
          {!isLocked && (mode === 'view' ? (
            <button
              onClick={() => setMode('edit')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-lg transition"
            >
              <Edit2 size={13} /> Edit
            </button>
          ) : (
          <>
            <button
              onClick={() => {
                setDraft({
                  screenerName:   record.screenerName   || '',
                  screenerStatus: record.screenerStatus || '',
                  screenerNotes:  record.screenerNotes  || '',
                });
                setMode('view');
              }}
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
          ))}
        </div>
      </div>

      {/* ── Decision banner — always visible, even when status is empty ── */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${
        draft.screenerStatus
          ? 'border-gray-100 bg-gray-50'
          : 'border-dashed border-gray-200 bg-gray-50/50'
      }`}>
        <UserCheck size={22} className={draft.screenerStatus ? 'text-gray-400' : 'text-gray-300'} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Screener Decision
          </p>
          {draft.screenerStatus ? (
            <span className={`inline-block text-sm font-bold px-2.5 py-0.5 rounded-full ${statusColor}`}>
              {draft.screenerStatus}
            </span>
          ) : (
            <span className="text-sm text-gray-400 italic">
              No decision recorded yet
            </span>
          )}
        </div>
        {draft.screenerName && (
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">By</p>
            <p className="text-sm font-semibold text-gray-700">{draft.screenerName}</p>
          </div>
        )}
      </div>

      {/* ── Screener fields ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mode === 'view' ? (
          <>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Screener Name
              </p>
              <p className="text-sm font-medium text-gray-800">
                {draft.screenerName || <span className="text-gray-400 italic">Not assigned</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Status
              </p>
              {draft.screenerStatus ? (
                <span className={`inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full ${statusColor}`}>
                  {draft.screenerStatus}
                </span>
              ) : (
                <p className="text-sm text-gray-400 italic">Not set</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Screener name dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Screener Name
              </label>
              <div className="relative">
                <select
                  value={draft.screenerName}
                  onChange={e => handleChange('screenerName', e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition"
                >
                  <option value="">— Select screener —</option>
                  {screenerOptions.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Status dropdown — default is blank "Select", NOT Shortlisted */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <div className="relative">
                <select
                  value={draft.screenerStatus}
                  onChange={e => handleChange('screenerStatus', e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition"
                >
                  {/* ← blank default — not Shortlisted */}
                  <option value="">— Select status —</option>
                  {SCREENER_STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Notes / Feedback ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Detailed Feedback
          </p>
          {mode === 'edit' && (
            <button
              onClick={() => setTemplateOpen(true)}
              className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
            >
              {draft.screenerNotes ? 'Edit via template' : 'Use template'}
            </button>
          )}
        </div>

        {mode === 'edit' ? (
          <textarea
            value={draft.screenerNotes}
            onChange={e => handleChange('screenerNotes', e.target.value)}
            rows={6}
            placeholder="Enter screener feedback…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 font-mono bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none transition"
          />
        ) : (
          <div className="bg-gray-50 rounded-xl px-4 py-3 min-h-[80px]">
            {draft.screenerNotes ? (
              <FormattedFeedback text={draft.screenerNotes} />
            ) : (
              <p className="text-sm text-gray-400 italic">No feedback recorded yet</p>
            )}
          </div>
        )}
      </div>

      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onInsert={(text: string) => handleChange('screenerNotes', text)}
        screenerName={draft.screenerName}
        existingText={draft.screenerNotes}
        defaultRound="HR Round"
        title="HR Feedback Template"
      />

      {/* ── Rejection mail — one-time send, disabled once rejectionMailSentAt is set ── */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectionModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b rounded-t-2xl bg-red-700">
              <p className="text-sm font-bold text-white">Send Rejection Mail</p>
              <button onClick={() => setRejectionModal((m) => ({ ...m, open: false }))} className="text-white/70 hover:text-white transition"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-2.5">
              {rejectionModal.loading ? (
                <p className="text-sm text-gray-400 italic">Loading…</p>
              ) : rejectionModal.error && !rejectionModal.subject ? (
                <p className="text-sm text-red-500">{rejectionModal.error}</p>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">To</label>
                    <input
                      value={rejectionModal.to}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, to: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">CC (optional)</label>
                    <input
                      value={rejectionModal.cc}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, cc: e.target.value }))}
                      placeholder="cc1@company.com, cc2@company.com"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Subject</label>
                    <input
                      value={rejectionModal.subject}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, subject: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 block">Body</label>
                    <textarea
                      value={rejectionModal.body}
                      onChange={(e) => setRejectionModal((m) => ({ ...m, body: e.target.value }))}
                      rows={10}
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setRejectionModal((m) => ({ ...m, open: false }))} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
              <button
                onClick={sendRejectionMail}
                disabled={rejectionModal.sending || rejectionModal.loading || !rejectionModal.subject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition"
              >
                {rejectionModal.sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenerRoundTab;