import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

type CurrentEmployee = { full_name: string; official_email: string };

interface Props {
  id: string;
  onSuccess: () => void;
  onClose: () => void;
}

// Re-opens a past requisition as a brand-new one: same position details
// (department, designation, role/JD links, dept checklist answers, etc.)
// carried over as-is, but with a fresh HR remark and CC list, a reset
// hiring status of 'New', and today's request date. Posting to the same
// POST /hiringrequisitions/ route this new requisition goes through the
// exact same scoring/approval lifecycle as any manually-created one —
// nothing special-cased for it on the backend.
export default function ReopenRequisitionModal({ id, onSuccess, onClose }: Props) {
  const [sourceDoc, setSourceDoc]       = useState<any | null>(null);
  const [currentEmployees, setCurrentEmployees] = useState<CurrentEmployee[]>([]);
  const [loading, setLoading]           = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const [hrRemarks, setHrRemarks]       = useState('');
  const [employeesInCc, setEmployeesInCc] = useState<string[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/hiringrequisitions/${id}`),
        fetch(`${API_BASE}/onboarding/eligible-employees`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        }),
      ]);
      const reqJson = await reqRes.json();
      if (!reqRes.ok || !reqJson.success) throw new Error(reqJson.error || 'Failed to load requisition');

      const empJson = await empRes.json();
      const emps = Array.isArray(empJson?.data) ? empJson.data : [];

      setSourceDoc(reqJson.data);
      setEmployeesInCc(reqJson.data.employees_in_cc || []);
      setCurrentEmployees(
        emps.map((e: any) => ({
          full_name: e.full_name || '',
          official_email: e.official_email || e.email || '',
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load requisition');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async () => {
    if (!sourceDoc) return;
    setSubmitLoading(true);
    setError(null);
    try {
      const payload = {
        // ── Carried over from the source requisition ──────────────────
        requisitioner_name:  sourceDoc.requisitioner_name,
        requisitioner_email: sourceDoc.requisitioner_email,
        hiring_dept:         sourceDoc.hiring_dept,
        hiring_dept_email:   sourceDoc.hiring_dept_email,
        dept_group_email:    sourceDoc.dept_group_email,
        reporting_manager:   sourceDoc.reporting_manager,
        budget:              sourceDoc.budget,
        designation_status:  sourceDoc.designation_status,
        designation:         sourceDoc.designation,
        designation_id:      sourceDoc.designation_id,
        candidate_experience_level: sourceDoc.candidate_experience_level,
        role_link:           sourceDoc.role_link,
        jd_link:             sourceDoc.jd_link,
        required_skills:     sourceDoc.required_skills,
        role_category:       sourceDoc.role_category,
        remote_eligible:     sourceDoc.remote_eligible,
        base_location:       sourceDoc.base_location,
        screeningQuestions:  sourceDoc.screeningQuestions,
        select_joining_days: sourceDoc.select_joining_days,
        special_instructions: sourceDoc.special_instructions,
        role_n_jd_exist:     sourceDoc.role_n_jd_exist,
        role_n_jd_read:      sourceDoc.role_n_jd_read,
        role_n_jd_good:      sourceDoc.role_n_jd_good,
        days_well_thought:   sourceDoc.days_well_thought,
        is_sim_needed:       sourceDoc.is_sim_needed,
        sim_needed_reason:   sourceDoc.sim_needed_reason,
        is_sim_available_for_transfer: sourceDoc.is_sim_available_for_transfer,
        assigned_to:         sourceDoc.assigned_to,

        // ── Fresh for this re-opened requisition ───────────────────────
        request_date:   new Date().toISOString().slice(0, 10),
        hiring_status:  'New',
        hr_remarks:     hrRemarks,
        employees_in_cc: employeesInCc,
      };

      const res = await fetch(`${API_BASE}/hiringrequisitions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || json.error || 'Failed to create requisition');

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create requisition');
    } finally {
      setSubmitLoading(false);
    }
  };

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  if (error && !sourceDoc) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        This opens a brand-new requisition for <span className="font-semibold text-gray-700">{sourceDoc?.designation}</span> in{' '}
        <span className="font-semibold text-gray-700">{sourceDoc?.hiring_dept}</span>, carrying over the same position
        details. It starts fresh — a new serial number, status reset to "New", and its own scoring/approval cycle.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      <div className="mb-4">
        <label className={labelCls}>HR Remarks</label>
        <textarea
          value={hrRemarks}
          onChange={e => setHrRemarks(e.target.value)}
          rows={3}
          placeholder="HR remarks…"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="mb-4">
        <label className={labelCls}>CC recipients (defaults to the original requisition's CC list — adjust as needed)</label>
        <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-100">
          {currentEmployees.map(emp => {
            const checked = employeesInCc.includes(emp.official_email);
            return (
              <label key={emp.official_email || emp.full_name} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setEmployeesInCc(prev =>
                      checked ? prev.filter(e => e !== emp.official_email) : [...prev, emp.official_email]
                    );
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{emp.full_name}</span>
                <span className="text-xs text-gray-400 ml-auto">{emp.official_email}</span>
              </label>
            );
          })}
        </div>
        {employeesInCc.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {employeesInCc.map(email => {
              const emp = currentEmployees.find(e => e.official_email === email);
              return (
                <span key={email} className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                  {emp?.full_name ?? email}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          disabled={submitLoading}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#597e37] text-white text-sm font-medium rounded-md hover:bg-[#3d5420] transition disabled:opacity-50"
        >
          {submitLoading && <Loader2 className="animate-spin" size={14} />}
          Create New Requisition
        </button>
      </div>
    </div>
  );
}
