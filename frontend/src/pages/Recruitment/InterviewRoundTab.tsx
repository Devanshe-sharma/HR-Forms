// pages/Recruitment/InterviewRoundTab.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, Edit2, Save, Plus, Trash2, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditField, EditSelect } from './ApplicantFieldComponents';
import {
  ApplicantRecord, InterviewRound, API_BASE,
  STAGE_OPTIONS, MODE_OPTIONS, RESULT_OPTIONS, RESULT_COLORS,
} from './applicantTypes';
import { TemplateModal } from './FeedbackTemplate';

const emptyRound = (): Omit<InterviewRound, '_id'> => ({
  roundNumber:   1,
  stage:         'HR Round',
  customStage:   '',
  scheduledDate: '',
  interviewer:   '',
  mode:          'Not decided',
  feedback:      '',
  result:        'Pending',
});

const RoundForm = ({
  data, onChange, onSave, onCancel, saving,
}: {
  data: Partial<InterviewRound>;
  onChange: (f: string, v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [templateOpen, setTemplateOpen] = useState(false);
  const roundLabel = data.stage === 'Other' ? (data.customStage || 'Interview Round') : (data.stage || 'Interview Round');

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <EditSelect label="Stage"        name="stage"         value={data.stage || ''}         options={STAGE_OPTIONS}  onChange={(_, v) => onChange('stage', v)} />
      {data.stage === 'Other' && (
        <EditField  label="Custom Stage" name="customStage"  value={data.customStage || ''}  onChange={(_, v) => onChange('customStage', v)} />
      )}
      <EditField  label="Interview Date"   name="scheduledDate" value={data.scheduledDate || ''} onChange={(_, v) => onChange('scheduledDate', v)} type="date" />
      <EditField  label="Interviewer Name" name="interviewer"   value={data.interviewer || ''}   onChange={(_, v) => onChange('interviewer', v)} />
      <EditSelect label="Interview Type"  name="mode"          value={data.mode || ''}          options={MODE_OPTIONS}   onChange={(_, v) => onChange('mode', v)} />
      <EditSelect label="Result"          name="result"        value={data.result || ''}        options={RESULT_OPTIONS} onChange={(_, v) => onChange('result', v)} />
      <div className="col-span-2 md:col-span-3">
        <div className="flex items-center justify-between mb-0.5">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block">Remarks</label>
          <button
            onClick={() => setTemplateOpen(true)}
            className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
          >
            {data.feedback ? 'Edit via template' : 'Use template'}
          </button>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white border border-gray-200 rounded-lg px-3 py-2 min-h-[50px] font-mono">
          {data.feedback || '—'}
        </p>
        <TemplateModal
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
          onInsert={(text: string) => onChange('feedback', text)}
          screenerName={data.interviewer || ''}
          existingText={data.feedback || ''}
          defaultRound={roundLabel}
          title="Interview Feedback Template"
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
};

const InterviewRoundTab = ({
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
                  {r.stage === 'Other' ? r.customStage || 'Other' : r.stage === 'HR Screening' ? 'HR Round' : r.stage}
                </p>
                <div className="mt-1 space-y-1 text-sm">
                  <p className="font-semibold text-gray-700 text-base">
                    {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}
                  </p>
                  {r.interviewer && <p className="font-semibold text-gray-700 text-base">{r.interviewer}</p>}
                  {r.mode && r.mode !== 'Not decided' && <p className="text-sm text-gray-500">{r.mode}</p>}
                </div>
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
            <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{r.feedback}</p>
          )}

          {editingId === r._id && (
            <RoundForm
              data={drafts[r._id] || r}
              onChange={(f, v) => handleDraftChange(r._id, f, v)}
              onSave={() => saveRound(r._id)}
              onCancel={() => setEditingId(null)}
              saving={saving}
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
            saving={saving}
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

export default InterviewRoundTab;