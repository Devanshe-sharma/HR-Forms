import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ChecklistTask = {
  task: string;
  plan: string | null;
  done: string | null;
  score: number | null;
  status: string;
  daysLeft: number | null;
};

type RequisitionDoc = {
  _id: string;
  serial_no: number;
  requisitioner_name: string;
  requisitioner_email: string;
  hiring_dept: string;
  hiring_dept_email?: string;
  dept_group_email?: string;
  designation: string;
  designation_status?: string;
  candidate_experience_level?: string;
  request_date: string;
  select_joining_days: string;
  plan_start_sharing_cvs?: string;
  planned_interviews_started?: string;
  planned_offer_accepted?: string;
  planned_joined?: string;
  special_instructions?: string;
  hiring_status: string;
  fmsStatus: 'Open' | 'Closed';
  hr_approved_at?: string | null;
  employees_in_cc: string[];
  role_link?: string;
  jd_link?: string;
  reporting_manager?: string;
  budget?: number;
  hr_remarks?: string;
  checklist_tasks: ChecklistTask[];
  total_tasks?: number;
  done_in_time?: number;
  done_but_delayed?: number;
  tasks_due?: number;
  tasks_overdue?: number;
  not_yet_due?: number;
  fms_score?: number;
};

// Sourced from Onboarding (current employees only) — same pattern as
// NewRequisitionForm's requisitioner/CC picker, not RoleMaster.
type CurrentEmployee = { full_name: string; official_email: string };

// Just enough of the Dept & Designation Master's shape to fall back on,
// when this requisition's OWN jd_link is empty — e.g. the requisition
// was created before this designation had a JD on file, or predates
// the Master being updated. The requisition's own stored value is
// always preferred first; this is purely a recovery path.
//
// RoleMaster has a known mix of legacy PascalCase-keyed documents and
// properly schema-shaped lowercase ones (same issue already found and
// worked around in onboardingroutes.js's getDepartmentTypeMap()) — so
// every field here is checked under both casings, not just the
// schema's own lowercase names.
type DesigRecord = {
  department?: string;
  Department?: string;
  designation?: string;
  Designation?: string;
  jd_link?: string;
  JD_Link?: string;
  ['JD Link']?: string;
};

interface Props {
  id?:        string;
  asModal?:   boolean;
  onSuccess?: () => void;
  onClose?:   () => void;
  // Pure view mode — disables every editable field (status, remarks, CC,
  // checklist ticking) and hides the Update button entirely, leaving
  // only a Close action. Used when a row is clicked for a quick look,
  // as opposed to the deliberate Edit action which opens this same
  // component with viewOnly left off.
  viewOnly?: boolean;
}

// Full status vocabulary for an ongoing requisition — richer than the
// 6-option list New Requisition uses at creation time, matching what
// RequisitionDashboard.tsx's own quick-status dropdown already offers.
const HIRING_STATUS_OPTIONS = [
  'New', 'No Change in Status', 'CVs Shortlisting Started', 'Interviews Started',
  'Offer Sent', 'Offer Accepted', 'Joined', 'Not Accepted', 'Not Joined',
  'On Hold', 'Cancelled', 'Filled Internally', 'Filled Externally',
];

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const inputCls   = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400';
const labelCls   = 'block text-xs font-medium text-gray-600 mb-1';
const errCls     = 'text-xs text-red-600 mt-1';
const sectionCls = 'text-sm font-bold text-gray-800 mt-6 mb-3';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={sectionCls}>{children}</h2>;
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} value={value == null || value === '' ? '—' : String(value)} disabled readOnly />
    </div>
  );
}

const STATUS_ROW_STYLE: Record<string, string> = {
  'Overdue':          'text-red-600 font-semibold',
  'Done':             'text-green-700',
  'Done (Delayed)':   'text-amber-700',
  'Pending':          'text-gray-700',
  'Not Yet Due':      'text-gray-400',
  'On Hold':          'text-blue-600',
  'Awaiting Approval': 'text-gray-400 italic',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function UpdateRequisition({ id: idProp, asModal = false, onSuccess, onClose, viewOnly = false }: Props) {
  const navigate = useNavigate();
  const { id: idParam } = useParams<{ id: string }>();

  // Modal usage (RequisitionDashboard.tsx) passes id as a prop. The
  // standalone /recruitment/update/:id route renders this with no props
  // at all, relying on React Router's URL param instead — this resolves
  // whichever source actually has it.
  const id = idProp || idParam;

  const [doc,             setDoc]             = useState<RequisitionDoc | null>(null);
  const [currentEmployees, setCurrentEmployees] = useState<CurrentEmployee[]>([]);
  const [designations,    setDesignations]    = useState<DesigRecord[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [submitLoading,   setSubmitLoading]   = useState(false);
  const [approveLoading,  setApproveLoading]  = useState(false);
  const [successOpen,     setSuccessOpen]     = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // ── Editable state ──────────────────────────────────────────────────────
  const [hiringStatus,   setHiringStatus]   = useState('');
  const [reportingManager, setReportingManager] = useState('');
  const [budget,          setBudget]          = useState<string>('');
  const [hrRemarks,      setHrRemarks]      = useState('');
  const [employeesInCc,  setEmployeesInCc]  = useState<string[]>([]);
  // Local working copy of checklist_tasks — ticking a not-yet-done task
  // just marks it done=now in this array; nothing is sent to the server
  // until Submit. Already-done tasks (done !== null on load) are shown
  // as fixed/disabled — this form only ever ADDS a done date, it never
  // un-ticks or edits an already-completed task or its plan date.
  const [checklistTasks, setChecklistTasks] = useState<ChecklistTask[]>([]);

  const fetchAll = useCallback(async () => {
    if (!id) {
      setError('No requisition ID provided.');
      setLoading(false);
      return;
    }
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

      setDoc(reqJson.data);
      setHiringStatus(reqJson.data.hiring_status || '');
      setReportingManager(reqJson.data.reporting_manager || '');
      setBudget(reqJson.data.budget != null ? String(reqJson.data.budget) : '');
      setHrRemarks(reqJson.data.hr_remarks || '');
      setEmployeesInCc(reqJson.data.employees_in_cc || []);
      setChecklistTasks(reqJson.data.checklist_tasks || []);
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

  // Fallback source only — the requisition's own jd_link is always
  // preferred first (see resolvedJdLink below). Non-critical if this
  // fails; it just means the fallback path silently isn't available.
  useEffect(() => {
    fetch(`${API_BASE}/rolemaster/all`)
      .then((r) => r.json())
      .then((json) => setDesignations(json?.data?.designations ?? []))
      .catch(() => {});
  }, []);

  const resolvedJdLink = useMemo(() => {
    if (doc?.jd_link) return doc.jd_link;
    if (!doc) return undefined;

    const norm = (s?: string) => (s || '').trim().toLowerCase();
    const targetDept = norm(doc.hiring_dept);
    const targetDesig = norm(doc.designation);

    const match = designations.find((d) => {
      const dept = norm(d.department ?? d.Department);
      const desig = norm(d.designation ?? d.Designation);
      return dept === targetDept && desig === targetDesig;
    });

    // TEMPORARY — remove once JD matching is confirmed working. Shows
    // the actual raw shape of whatever record we're comparing against,
    // in case the real field names turn out to be something other than
    // the variants already being checked above.
    if (!match) {
      console.log('DEBUG JD lookup — no match. Looking for:', { targetDept, targetDesig });
      console.log('DEBUG JD lookup — first few designation records:', designations.slice(0, 3));
    }

    return match?.jd_link || match?.JD_Link || match?.['JD Link'];
  }, [doc, designations]);

  const toggleTaskDone = (taskName: string) => {
    if (viewOnly) return;
    setChecklistTasks(prev => prev.map(t => {
      if (t.task !== taskName) return t;
      if (t.done) return t; // already done — this form never un-ticks a completed task
      return { ...t, done: new Date().toISOString() };
    }));
  };

  const handleSubmit = async () => {
    if (viewOnly) return;
    if (!id) {
      setError('No requisition ID provided — cannot update.');
      return;
    }
    if (!hiringStatus) {
      setError('Please select a Hiring Status before submitting.');
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      const payload = {
        hiring_status:     hiringStatus,
        hr_remarks:        hrRemarks,
        employees_in_cc:   employeesInCc,
        checklist_tasks:   checklistTasks,
        reporting_manager: reportingManager,
        budget:            budget === '' ? null : Number(budget),
      };
      const res = await fetch(`${API_BASE}/hiringrequisitions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Update failed');
      setSuccessOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update requisition');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id || !doc) return;
    setApproveLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hiringrequisitions/${id}/approve`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to approve requisition');
      await fetchAll(); // refetch — checklist tasks now have real plan dates instead of "Awaiting Approval"
    } catch (err: any) {
      setError(err.message || 'Failed to approve requisition');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReturnToDashboard = () => {
    if (asModal && onSuccess) {
      onSuccess();
    } else {
      navigate('/recruitment');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className={asModal ? '' : 'p-4 md:p-8 mt-10 max-w-3xl mx-auto'}>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
          {error || 'Requisition not found.'}
        </div>
      </div>
    );
  }

  const pendingTasks   = checklistTasks.filter(t => !t.done);
  const completedTasks = checklistTasks.filter(t => t.done);

  const formContent = (
    <div className={asModal ? '' : 'p-4 md:p-8 mt-10 max-w-3xl mx-auto'}>
      {!asModal && (
        <>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewOnly ? 'View' : 'Update'} Hiring Requisition #{doc.serial_no}
          </h1>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {viewOnly ? 'Read-only view of this requisition.' : 'Review progress and update status, remarks, and checklist tasks.'}
          </p>
          <hr className="border-gray-200 mb-4" />
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md mb-4">{error}</div>
      )}

      {/* ── Read-only original details ──────────────────────────────────── */}
      <SectionTitle>Requisition Details</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <ReadOnlyField label="Hiring Serial No" value={doc.serial_no} />
        <ReadOnlyField label="Request Date" value={fmtDate(doc.request_date)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <ReadOnlyField label="Requisitioner" value={doc.requisitioner_name} />
        <ReadOnlyField label="Requisitioner Email" value={doc.requisitioner_email} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <ReadOnlyField label="Hiring Department" value={doc.hiring_dept} />
        <ReadOnlyField label="Designation" value={doc.designation} />
      </div>
      {/* JD — prefers this requisition's own stored jd_link (captured at
          creation time); falls back to a live Dept & Designation Master
          lookup only when that's empty, recovering cases like a
          requisition created before its designation had a JD on file. */}
      <div className="mb-4">
        <label className={labelCls}>Job Description (JD)</label>
        {resolvedJdLink ? (
          <a
            href={resolvedJdLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            View JD →
          </a>
        ) : (
          <p className="text-sm text-gray-400">No JD on file for this designation.</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <ReadOnlyField label="Candidate Experience Level" value={doc.candidate_experience_level} />
        <ReadOnlyField label="Joining Days Selected" value={doc.select_joining_days} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <ReadOnlyField label="Plan: Start Sharing CVs" value={fmtDate(doc.plan_start_sharing_cvs)} />
        <ReadOnlyField label="Plan: Interviews Start" value={fmtDate(doc.planned_interviews_started)} />
        <ReadOnlyField label="Plan: Offer Accepted" value={fmtDate(doc.planned_offer_accepted)} />
        <ReadOnlyField label="Plan: Joining" value={fmtDate(doc.planned_joined)} />
      </div>
      {doc.special_instructions && (
        <div className="mb-4">
          <label className={labelCls}>Special Instructions to HR</label>
          <textarea className={inputCls} value={doc.special_instructions} disabled readOnly rows={2} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <ReadOnlyField label="Current Hiring Status" value={doc.hiring_status} />
        <ReadOnlyField label="FMS Status" value={doc.fmsStatus} />
      </div>

      {/* HR Approval — gates when checklist scoring actually starts.
          Every task sits at "Awaiting Approval" (no plan date, no
          score) until this happens. The 3-day figure here is a target
          for HR, not a hard block — approving late still works, it just
          means the milestone dates get shifted forward by however many
          days it actually took (see the backend's PATCH /:id/approve),
          so HR's own delay doesn't unfairly eat into the timeline. */}
      {(() => {
        const requestDate = doc.request_date ? new Date(doc.request_date) : null;
        if (requestDate) requestDate.setHours(0, 0, 0, 0);
        const deadline = requestDate ? new Date(requestDate.getTime() + 3 * 24 * 60 * 60 * 1000) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysOverdue = (!doc.hr_approved_at && deadline && today > deadline)
          ? Math.round((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return (
          <div className={`mb-4 rounded-lg border p-4 ${
            doc.hr_approved_at
              ? 'bg-green-50 border-green-200'
              : daysOverdue > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
          }`}>
            {doc.hr_approved_at ? (
              <p className="text-sm text-green-800">
                ✅ Approved on <b>{fmtDate(doc.hr_approved_at)}</b> — checklist scoring is active.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className={`text-sm ${daysOverdue > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                  ⏳ <b>Awaiting HR Approval</b> — target: within 3 days of filing (by {deadline ? fmtDate(deadline) : '—'}).
                  {daysOverdue > 0 && <> <b>{daysOverdue} day{daysOverdue === 1 ? '' : 's'} overdue.</b></>}
                  {' '}Checklist scoring hasn't started yet.
                </p>
                {!viewOnly && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approveLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {approveLoading && <Loader2 size={14} className="animate-spin" />}
                    {approveLoading ? 'Approving...' : 'Approve Requisition'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── FMS score summary ───────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-4 text-sm">
        <div><span className="text-gray-500">FMS Score:</span>{' '}
          <span className={`font-semibold ${(doc.fms_score ?? 0) < 0 ? 'text-red-600' : 'text-gray-800'}`}>{doc.fms_score ?? 0}</span>
        </div>
        <div><span className="text-gray-500">Total Tasks:</span> <span className="font-semibold">{doc.total_tasks ?? 0}</span></div>
        <div><span className="text-gray-500">Done in Time:</span> <span className="font-semibold text-green-700">{doc.done_in_time ?? 0}</span></div>
        <div><span className="text-gray-500">Done Delayed:</span> <span className="font-semibold text-amber-700">{doc.done_but_delayed ?? 0}</span></div>
        <div><span className="text-gray-500">Pending:</span> <span className="font-semibold">{doc.tasks_due ?? 0}</span></div>
        <div><span className="text-gray-500">Overdue:</span> <span className="font-semibold text-red-600">{doc.tasks_overdue ?? 0}</span></div>
        <div><span className="text-gray-500">Not Yet Due:</span> <span className="font-semibold text-gray-400">{doc.not_yet_due ?? 0}</span></div>
      </div>

      <hr className="border-gray-200 my-5" />

      {/* ── Editable update section — disabled entirely in viewOnly mode ─ */}
      <SectionTitle>{viewOnly ? 'Status & Remarks' : 'Update This Requisition'}</SectionTitle>

      <div className="mb-4">
        <label className={labelCls}>Hiring Status {!viewOnly && '*'}</label>
        <select
          value={hiringStatus}
          onChange={e => setHiringStatus(e.target.value)}
          disabled={viewOnly}
          className={inputCls}
        >
          <option value="" disabled>Select status</option>
          {HIRING_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>Reporting Manager</label>
          <input
            value={reportingManager}
            onChange={e => setReportingManager(e.target.value)}
            disabled={viewOnly}
            placeholder={viewOnly ? undefined : 'Name of reporting manager'}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Budget (₹)</label>
          <input
            type="number"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            disabled={viewOnly}
            placeholder={viewOnly ? undefined : 'Annual budget for this position'}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className={labelCls}>HR Remarks</label>
        <textarea
          value={hrRemarks}
          onChange={e => setHrRemarks(e.target.value)}
          disabled={viewOnly}
          rows={3}
          placeholder={viewOnly ? undefined : "Latest update, reason for status change, etc."}
          className={inputCls}
        />
      </div>

      <hr className="border-gray-200 my-5" />
      <SectionTitle>People to Keep in CC</SectionTitle>
      {!viewOnly && (
        <p className="text-sm text-gray-500 mb-3">
          The following are automatically included in CC — no need to add them again:
          MD &amp; CEO, Head Ops, Deputy Ops, HR, Admin, Accounts, and DME.
        </p>
      )}
      <div className="mb-4">
        {!viewOnly && <label className={labelCls}>Select additional CC recipients</label>}
        {viewOnly ? (
          employeesInCc.length === 0 ? (
            <p className="text-sm text-gray-400">No additional CC recipients.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {employeesInCc.map(email => {
                const emp = currentEmployees.find(e => e.official_email === email);
                return (
                  <span key={email} className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    {emp?.full_name ?? email}
                  </span>
                );
              })}
            </div>
          )
        ) : (
          <>
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
            <div className={`flex flex-wrap gap-1.5 mt-2 ${employeesInCc.length === 0 ? 'hidden' : ''}`}>
              {employeesInCc.map(email => {
                const emp = currentEmployees.find(e => e.official_email === email);
                return (
                  <span key={email} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                    {emp?.full_name ?? email}
                    <button type="button" onClick={() => setEmployeesInCc(prev => prev.filter(e => e !== email))} className="hover:text-blue-900 leading-none">×</button>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      <hr className="border-gray-200 my-5" />
      <SectionTitle>Checklist{viewOnly ? '' : " — Tick Tasks as They're Completed"}</SectionTitle>
      {!viewOnly && (
        <p className="text-sm text-gray-500 mb-3">
          Already-completed tasks are shown for reference and can't be un-ticked here.
        </p>
      )}

      <div className="space-y-1.5 mb-4">
        {pendingTasks.map(t => (
          <label
            key={t.task}
            className={`flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-md ${viewOnly ? '' : 'hover:bg-gray-50 cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={false}
              disabled={viewOnly}
              onChange={() => toggleTaskDone(t.task)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 flex-1">{t.task}</span>
            {/* Plan date shown regardless of status — including "Not
                Yet Due", which previously showed no date info at all
                even when a plan date genuinely existed. */}
            <span className="text-xs text-gray-400 whitespace-nowrap">
              Plan: {fmtDate(t.plan)}
            </span>
            <span className={`text-xs font-medium ${STATUS_ROW_STYLE[t.status] || 'text-gray-500'}`}>
              {t.status || '—'}
              {t.status === 'Overdue' && t.daysLeft != null ? ` (${Math.abs(t.daysLeft)}d late)` : ''}
              {t.status === 'Pending' && t.daysLeft != null ? ` (${t.daysLeft}d left)` : ''}
            </span>
          </label>
        ))}
        {completedTasks.map(t => (
          <div key={t.task} className="flex items-center gap-2.5 px-3 py-2 border border-gray-100 bg-gray-50 rounded-md opacity-70">
            <input type="checkbox" checked disabled className="rounded border-gray-300" />
            <span className="text-sm text-gray-500 flex-1 line-through">{t.task}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              Plan: {fmtDate(t.plan)}
            </span>
            <span className={`text-xs font-medium ${STATUS_ROW_STYLE[t.status] || 'text-gray-500'}`}>
              {t.status || 'Done'}
            </span>
          </div>
        ))}
        {checklistTasks.length === 0 && (
          <p className="text-sm text-gray-400">No checklist tasks found on this requisition.</p>
        )}
      </div>

      {/* Footer — viewOnly just gets a Close button, nothing else */}
      <div className={`mt-6 ${asModal ? 'flex justify-end gap-2' : 'text-center'}`}>
        {viewOnly ? (
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Close
          </button>
        ) : (
          <>
            {asModal && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitLoading}
              className="inline-flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition min-w-[180px] justify-center"
            >
              {submitLoading && <Loader2 size={16} className="animate-spin" />}
              {submitLoading ? 'Updating...' : 'Update Requisition'}
            </button>
          </>
        )}
      </div>

      {/* Full-screen loading backdrop */}
      {submitLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
          <Loader2 size={40} className="animate-spin text-white" />
        </div>
      )}

      {/* Success Dialog */}
      {successOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">✅ Requisition Updated!</h2>
            <p className="text-sm text-gray-700 mb-2">
              A progress email has been sent to the requisitioner, with all concerned in CC.
            </p>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={handleReturnToDashboard}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Modal mode: return just the form content ─────────────────────────────
  if (asModal) return formContent;

  // ── Page mode: wrap with Sidebar + Navbar ───────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        {formContent}
      </div>
    </div>
  );
}