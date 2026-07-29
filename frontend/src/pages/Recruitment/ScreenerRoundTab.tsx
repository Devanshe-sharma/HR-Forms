// pages/Recruitment/ScreenerRoundTab.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Edit2, Save, UserCheck, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE, SCREENER_STATUS_OPTIONS, SCREENER_STATUS_COLORS } from './applicantTypes';
import { TemplateModal } from './FeedbackTemplate';

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

  useEffect(() => {
    setDraft({
      screenerName:   record.screenerName   || '',
      screenerStatus: record.screenerStatus || '',
      screenerNotes:  record.screenerNotes  || '',
    });
  }, [record]);

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
      <div className="flex justify-end gap-2">
        {mode === 'view' ? (
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
        )}
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
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono">
                {draft.screenerNotes}
              </p>
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
    </div>
  );
};

export default ScreenerRoundTab;