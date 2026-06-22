import { useState } from 'react';
import { Loader2, X, ChevronLeft } from 'lucide-react';
import type { DeptResult } from '../Recruitment/Deptmodal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type NewDesignationResult = {
  desig_id:           number | string;
  designation:        string;
  dept_id:            number | string;
  department:         string;
  dept_head_email:    string;
  dept_group_email:   string;
  role_document_link: string;
  jd_link:            string;
  deptWasNew:         boolean;   // whether dept was freshly created in step 1
};

interface Props {
  open:    boolean;
  dept:    DeptResult | null;    // result from DeptModal (step 1)
  onClose: () => void;
  onBack:  () => void;           // go back to DeptModal
  onSaved: (result: NewDesignationResult) => void;
}

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const errCls   = 'text-xs text-red-600 mt-1';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function DesignationModal({ open, dept, onClose, onBack, onSaved }: Props) {
  const [desigId,           setDesigId]           = useState('');
  const [desigName,         setDesigName]         = useState('');
  const [roleDocLink,       setRoleDocLink]       = useState('');
  const [jdLink,            setJdLink]            = useState('');
  const [managementLevel,   setManagementLevel]   = useState('');
  const [reportingManager,  setReportingManager]  = useState('');
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState<string | null>(null);
  const [fieldErrors,       setFieldErrors]       = useState<Record<string, string>>({});

  if (!open || !dept) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!desigId.trim())   errs.desig_id   = 'Designation ID is required';
    if (!desigName.trim()) errs.designation = 'Designation name is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/rolemaster/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dept_id:            dept.dept_id,
            department:         dept.department,
            dept_head_email:    dept.dept_head_email,
            dept_group_email:   dept.dept_group_email  || null,
            desig_id:           Number(desigId),
            designation:        desigName.trim(),
            role_document_link: roleDocLink.trim()     || null,
            jd_link:            jdLink.trim()          || null,
            management_level:   managementLevel.trim() || null,
            reporting_manager:  reportingManager.trim() || null,
        }),
        });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || e.error || 'Failed to save designation');
      }
      onSaved({
        desig_id:           Number(desigId),
        designation:        desigName.trim(),
        dept_id:            dept.dept_id,
        department:         dept.department,
        dept_head_email:    dept.dept_head_email,
        dept_group_email:   dept.dept_group_email,
        role_document_link: roleDocLink.trim(),
        jd_link:            jdLink.trim(),
        deptWasNew:         dept.isNew,
      });
      // reset for next use
      setDesigId(''); setDesigName(''); setRoleDocLink('');
      setJdLink(''); setManagementLevel(''); setReportingManager('');
    } catch (err: any) {
      setError(err.message || 'Failed to save designation');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Step 2 of 2</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">New Designation</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Dept context banner */}
        <div className={`px-5 py-2.5 text-xs flex items-center gap-2 ${dept.isNew ? 'bg-amber-50 text-amber-700 border-b border-amber-100' : 'bg-blue-50 text-blue-700 border-b border-blue-100'}`}>
          <span className="font-medium">
            {dept.isNew ? '🆕 New dept:' : '🏢 Department:'}
          </span>
          <span>{dept.department}</span>
          {dept.dept_id && <span className="text-opacity-60">(ID: {dept.dept_id})</span>}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md mb-3">{error}</div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Designation ID (numeric) *</label>
                <input
                  className={`${inputCls} ${fieldErrors.desig_id ? 'border-red-400' : ''}`}
                  type="number"
                  placeholder="e.g. 45"
                  value={desigId}
                  onChange={e => setDesigId(e.target.value)}
                />
                {fieldErrors.desig_id && <p className={errCls}>{fieldErrors.desig_id}</p>}
              </div>
              <div>
                <label className={labelCls}>Management Level</label>
                <select
                  className={inputCls}
                  value={managementLevel}
                  onChange={e => setManagementLevel(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                  <option value="Manager">Manager</option>
                  <option value="Director">Director</option>
                  <option value="VP">VP</option>
                  <option value="C-Level">C-Level</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Designation Name *</label>
              <input
                className={`${inputCls} ${fieldErrors.designation ? 'border-red-400' : ''}`}
                placeholder="e.g. Senior Growth Manager"
                value={desigName}
                onChange={e => setDesigName(e.target.value)}
              />
              {fieldErrors.designation && <p className={errCls}>{fieldErrors.designation}</p>}
            </div>

            <div>
              <label className={labelCls}>Reporting Manager</label>
              <input
                className={inputCls}
                placeholder="e.g. Head of Marketing"
                value={reportingManager}
                onChange={e => setReportingManager(e.target.value)}
              />
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className={labelCls}>Role Document Link</label>
              <input
                className={inputCls}
                type="url"
                placeholder="https://docs.google.com/..."
                value={roleDocLink}
                onChange={e => setRoleDocLink(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>JD Link</label>
              <input
                className={inputCls}
                type="url"
                placeholder="https://..."
                value={jdLink}
                onChange={e => setJdLink(e.target.value)}
              />
            </div>

            {/* Read-only dept emails inherited from step 1 */}
            <hr className="border-gray-100" />
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Inherited from department</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Dept Head Email</label>
                <input className={inputCls} value={dept.dept_head_email} disabled readOnly />
              </div>
              <div>
                <label className={labelCls}>Dept Group Email</label>
                <input className={inputCls} value={dept.dept_group_email || '—'} disabled readOnly />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition"
          >
            <ChevronLeft size={15} />
            Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save & link to requisition'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}