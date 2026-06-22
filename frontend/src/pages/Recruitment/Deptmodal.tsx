import { useState, useEffect } from 'react';
import { Loader2, X, Search, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type DeptResult = {
  dept_id:         number | string;
  department:      string;
  dept_head_email: string;
  dept_group_email: string;
  isNew:           boolean;   // true if created fresh in this modal
};

type ExistingDept = {
  dept_id:          number | string | null;
  department:       string;
  dept_head_email?: string;
  dept_group_email?: string;
};

interface Props {
  open:        boolean;
  prefillDept?: string;          // department already selected in the requisition form
  onClose:     () => void;
  onNext:      (dept: DeptResult) => void;
}

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const errCls   = 'text-xs text-red-600 mt-1';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function DeptModal({ open, prefillDept, onClose, onNext }: Props) {
  const [mode,           setMode]           = useState<'pick' | 'new'>('pick');
  const [departments,    setDepartments]    = useState<ExistingDept[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [search,         setSearch]         = useState(prefillDept ?? '');
  const [selected,       setSelected]       = useState<ExistingDept | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  // new dept form fields
  const [newDeptId,         setNewDeptId]         = useState('');
  const [newDeptName,       setNewDeptName]       = useState('');
  const [newDeptHeadEmail,  setNewDeptHeadEmail]  = useState('');
  const [newDeptGroupEmail, setNewDeptGroupEmail] = useState('');
  const [saving,            setSaving]            = useState(false);
  const [fieldErrors,       setFieldErrors]       = useState<Record<string, string>>({});

  // fetch dept list on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setSearch(prefillDept ?? '');
    setMode('pick');
    fetch(`${API_BASE}/rolemaster/all`)
      .then(r => r.json())
      .then(json => setDepartments(json.data?.departments ?? []))
      .catch(() => setError('Failed to load departments. Please refresh.'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = departments.filter(d =>
    d.department.toLowerCase().includes(search.toLowerCase())
  );

  // ── Pick existing dept ────────────────────────────────────────────────────
  const handlePickNext = () => {
    if (!selected) { setError('Please select a department.'); return; }
    onNext({
      dept_id:          selected.dept_id ?? '',
      department:       selected.department,
      dept_head_email:  selected.dept_head_email  ?? '',
      dept_group_email: selected.dept_group_email ?? '',
      isNew:            false,
    });
  };

  // ── Create new dept ───────────────────────────────────────────────────────
  const validateNew = () => {
    const errs: Record<string, string> = {};
    if (!newDeptId.trim())         errs.dept_id         = 'Dept ID is required';
    if (!newDeptName.trim())       errs.department      = 'Department name is required';
    if (!newDeptHeadEmail.trim())  errs.dept_head_email = 'Dept head email is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateDept = () => {
  if (!validateNew()) return;
  onNext({
    dept_id:          Number(newDeptId),
    department:       newDeptName.trim(),
    dept_head_email:  newDeptHeadEmail.trim(),
    dept_group_email: newDeptGroupEmail.trim(),
    isNew:            true,
  });
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
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Step 1 of 2</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">Department</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-gray-200">
          {(['pick', 'new'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-medium transition ${
                mode === m
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'pick' ? 'Use existing department' : 'Create new department'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md mb-3">{error}</div>
          )}

          {mode === 'pick' ? (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className={`${inputCls} pl-8`}
                      placeholder="Search department..."
                      value={search}
                      onChange={e => { setSearch(e.target.value); setSelected(null); }}
                    />
                  </div>

                  {/* List */}
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No departments found</p>
                    ) : (
                      filtered.map(dept => (
                        <button
                          key={dept.dept_id ?? dept.department}
                          onClick={() => { setSelected(dept); setError(null); }}
                          className={`w-full text-left px-3 py-2.5 transition text-sm flex items-center justify-between gap-2 ${
                            selected?.department === dept.department
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span>{dept.department}</span>
                          {dept.dept_id && (
                            <span className="text-xs text-gray-400 shrink-0">ID: {dept.dept_id}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {selected && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                      <p><span className="font-medium">Head email:</span> {selected.dept_head_email || '—'}</p>
                      <p><span className="font-medium">Group email:</span> {selected.dept_group_email || '—'}</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* ── New dept form ── */
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Dept ID (numeric) *</label>
                <input
                  className={`${inputCls} ${fieldErrors.dept_id ? 'border-red-400' : ''}`}
                  type="number"
                  placeholder="e.g. 12"
                  value={newDeptId}
                  onChange={e => setNewDeptId(e.target.value)}
                />
                {fieldErrors.dept_id && <p className={errCls}>{fieldErrors.dept_id}</p>}
              </div>
              <div>
                <label className={labelCls}>Department Name *</label>
                <input
                  className={`${inputCls} ${fieldErrors.department ? 'border-red-400' : ''}`}
                  placeholder="e.g. Growth Marketing"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                />
                {fieldErrors.department && <p className={errCls}>{fieldErrors.department}</p>}
              </div>
              <div>
                <label className={labelCls}>Dept Head Email *</label>
                <input
                  className={`${inputCls} ${fieldErrors.dept_head_email ? 'border-red-400' : ''}`}
                  type="email"
                  placeholder="head@company.com"
                  value={newDeptHeadEmail}
                  onChange={e => setNewDeptHeadEmail(e.target.value)}
                />
                {fieldErrors.dept_head_email && <p className={errCls}>{fieldErrors.dept_head_email}</p>}
              </div>
              <div>
                <label className={labelCls}>Dept Group Email (optional)</label>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="team@company.com"
                  value={newDeptGroupEmail}
                  onChange={e => setNewDeptGroupEmail(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'pick' ? handlePickNext : handleCreateDept}
            disabled={saving || (mode === 'pick' && !selected)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Next — Add Designation
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}