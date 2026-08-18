import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

export type DesignationLinksTarget = {
  dept_id:            number | string | null;
  desig_id:           number | string | null;
  department:         string;
  designation:        string;
  role_document_link?: string;
  jd_link?:            string;
};

export type DesignationLinksResult = {
  role_document_link: string;
  jd_link:             string;
};

interface Props {
  open:    boolean;
  target:  DesignationLinksTarget | null;
  onClose: () => void;
  onSaved: (result: DesignationLinksResult) => void;
}

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const errCls   = 'text-xs text-red-600 mt-1';

// ─────────────────────────────────────────────────────────────────────────────
// Lets a requisitioner fill in (or correct) the Role Document / JD links for
// an EXISTING designation directly from the requisition form, instead of
// having to go find someone with Role Master access. Updates Role Master in
// place so every future requisition against this designation is pre-filled.
// ─────────────────────────────────────────────────────────────────────────────
export default function UpdateDesignationLinksModal({ open, target, onClose, onSaved }: Props) {
  const [roleDocLink, setRoleDocLink] = useState('');
  const [jdLink,       setJdLink]     = useState('');
  const [saving,       setSaving]     = useState(false);
  const [error,        setError]      = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && target) {
      setRoleDocLink(target.role_document_link ?? '');
      setJdLink(target.jd_link ?? '');
      setError(null);
      setFieldErrors({});
    }
  }, [open, target]);

  if (!open || !target) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!roleDocLink.trim()) errs.roleDocLink = 'Role Document link is required';
    if (!jdLink.trim())      errs.jdLink      = 'JD link is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/rolemaster/designation`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dept_id:            target.dept_id,
          desig_id:           target.desig_id,
          role_document_link: roleDocLink.trim(),
          jd_link:             jdLink.trim(),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || e.error || 'Failed to update Role Master');
      }
      onSaved({ role_document_link: roleDocLink.trim(), jd_link: jdLink.trim() });
    } catch (err: any) {
      setError(err.message || 'Failed to update Role Master');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Role Master</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">Add / Update Role &amp; JD Links</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-2.5 text-xs bg-blue-50 text-blue-700 border-b border-blue-100">
          <span className="font-medium">{target.designation}</span> · {target.department}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md mb-3">{error}</div>
          )}

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Role Document Link *</label>
              <input
                className={`${inputCls} ${fieldErrors.roleDocLink ? 'border-red-400' : ''}`}
                type="url"
                placeholder="https://docs.google.com/..."
                value={roleDocLink}
                onChange={e => setRoleDocLink(e.target.value)}
              />
              {fieldErrors.roleDocLink && <p className={errCls}>{fieldErrors.roleDocLink}</p>}
            </div>

            <div>
              <label className={labelCls}>JD Link *</label>
              <input
                className={`${inputCls} ${fieldErrors.jdLink ? 'border-red-400' : ''}`}
                type="url"
                placeholder="https://..."
                value={jdLink}
                onChange={e => setJdLink(e.target.value)}
              />
              {fieldErrors.jdLink && <p className={errCls}>{fieldErrors.jdLink}</p>}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
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
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
