// pages/Recruitment/ScreenerRoundTab.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Edit2, Save, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, API_BASE, SCREENER_STATUS_OPTIONS, SCREENER_STATUS_COLORS } from './applicantTypes';
import { TemplateModal } from './FeedbackTemplate';

// Screener name list is sourced from Onboarding's HR department employees —
// the single source of truth for current staff — instead of a separate
// Employee collection.
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
  const [hrNames, setHrNames] = useState<string[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Edit / Save bar */}
      <div className="flex justify-end gap-2">
        {mode === 'view' ? (
          <button
            onClick={() => setMode('edit')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-lg transition"
          >
            <Edit2 size={13} /> Edit Screener Round
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

      {record.screenerStatus && mode === 'view' && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
          <UserCheck size={20} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Screener Decision</p>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${SCREENER_STATUS_COLORS[record.screenerStatus] || 'bg-gray-100 text-gray-600'}`}>
              {record.screenerStatus}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mode === 'view' ? (
          <>
            <Field label="Screener Name" value={draft.screenerName} />
            <Field label="Status"        value={draft.screenerStatus} />
          </>
        ) : (
          <>
            <EditSelect label="Screener Name" name="screenerName" value={draft.screenerName} options={screenerOptions} onChange={handleChange} />
            <EditSelect label="Status"         name="screenerStatus" value={draft.screenerStatus} options={SCREENER_STATUS_OPTIONS} onChange={handleChange} />
          </>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Detailed Feedback</p>
        {mode === 'edit' && (
          <div className="flex justify-end mb-1.5">
            <button
              onClick={() => setTemplateOpen(true)}
              className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
            >
              {draft.screenerNotes ? 'Edit via template' : 'Use template'}
            </button>
          </div>
        )}
        <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 min-h-[60px] font-mono">
          {draft.screenerNotes || '—'}
        </p>
      </div>

      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onInsert={(text: string) => handleChange('screenerNotes', text)}
        screenerName={draft.screenerName}
        existingText={draft.screenerNotes}
        defaultRound="Screener Round"
      />
    </div>
  );
};

export default ScreenerRoundTab;