// pages/Recruitment/OfferPlacementTab.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, Save, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditField, EditSelect } from './ApplicantFieldComponents';
import { ApplicantRecord, FinalDecision, API_BASE, DECISION_OPTIONS, DECISION_COLORS } from './applicantTypes';

const OfferPlacementTab = ({
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
      toast.success('Offer & Placement saved');
    } catch {
      toast.error('Failed to save');
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

export default OfferPlacementTab;