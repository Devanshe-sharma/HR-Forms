import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const HIRING_STATUS_OPTIONS = [
  'New', 'No Change in Status', 'CVs Shortlisting Started', 'Interviews Started',
  'Offer Sent', 'Offer Accepted', 'Joined', 'Not Accepted', 'Not Joined',
  'On Hold', 'Cancelled', 'Filled Internally', 'Filled Externally',
];

const SHOW_SHORTLISTED_DATE = new Set(['CVs Shortlisting Started', 'Interviews Started', 'Offer Sent', 'Offer Accepted', 'Joined', 'Filled Internally', 'Filled Externally']);
const SHOW_INTERVIEWS_DATE  = new Set(['Interviews Started', 'Offer Sent', 'Offer Accepted', 'Joined', 'Filled Internally', 'Filled Externally']);
const SHOW_OFFER_SENT_DATE  = new Set(['Offer Sent', 'Offer Accepted', 'Joined', 'Filled Internally', 'Filled Externally']);
const SHOW_OFFER_ACCEPTED   = new Set(['Offer Accepted', 'Joined', 'Filled Internally', 'Filled Externally']);
const SHOW_JOINED_DATE      = new Set(['Joined', 'Filled Internally', 'Filled Externally']);
const SHOW_NOT_ACCEPTED     = new Set(['Not Accepted', 'Not Joined', 'Cancelled']);
const SHOW_CLOSED_REASON    = new Set(['Cancelled', 'Filled Internally', 'Filled Externally']);

const updateSchema = z.object({
  hiring_status:                   z.string().min(1, 'Required'),
  fmsStatus:                       z.enum(['Open', 'Closed']),
  hr_remarks:                      z.string().min(1, 'HR remarks are required'),
  shortlisted_cvs_sharing_started: z.string().optional(),
  interviews_started_date:         z.string().optional(),
  offer_sent_date:                 z.string().optional(),
  offer_accepted_date:             z.string().optional(),
  not_accepted_joined_reason:      z.string().optional(),
  hiring_closed_reason:            z.string().optional(),
  employees_in_cc:                 z.array(z.string()).optional(),
});

type UpdateFormData = z.infer<typeof updateSchema>;
type Requisition = Record<string, any>;
type Employee    = { emp_id: string; full_name: string; official_email: string };

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  id?:        string;       // pass from modal; falls back to useParams
  asModal?:   boolean;
  onSuccess?: () => void;
  onClose?:   () => void;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const errCls   = 'text-xs text-red-600 mt-1';

const toDateInput = (v: string | null | undefined): string =>
  v ? new Date(v).toISOString().slice(0, 10) : '';

function ROField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function UpdateRequisition({ id: propId, asModal = false, onSuccess, onClose }: Props) {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate        = useNavigate();
  const id              = propId ?? paramId;

  const [doc,     setDoc]     = useState<Requisition | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control, register, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      hiring_status: '', fmsStatus: 'Open', hr_remarks: '',
      shortlisted_cvs_sharing_started: '', interviews_started_date: '',
      offer_sent_date: '', offer_accepted_date: '',
      not_accepted_joined_reason: '', hiring_closed_reason: '',
      employees_in_cc: [],
    },
  });

  const watchedStatus = watch('hiring_status');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API_BASE}/hiringrequisitions/${id}`).then(r => r.json()),
      fetch(`${API_BASE}/rolemaster/all`).then(r => r.json()),
    ])
      .then(([reqJson, roleJson]) => {
        if (!reqJson.success) throw new Error(reqJson.error || 'Not found');
        const d = reqJson.data;
        setDoc(d);
        setEmployees(roleJson.data?.employees ?? []);
        reset({
          hiring_status:                   d.hiring_status               || '',
          fmsStatus:                       d.fmsStatus                   || 'Open',
          hr_remarks:                      d.hr_remarks                  || '',
          shortlisted_cvs_sharing_started: toDateInput(d.shortlisted_cvs_sharing_started),
          interviews_started_date:         toDateInput(d.interviews_started_date),
          offer_sent_date:                 toDateInput(d.offer_sent_date),
          offer_accepted_date:             toDateInput(d.offer_accepted_date),
          not_accepted_joined_reason:      d.not_accepted_joined_reason  || '',
          hiring_closed_reason:            d.hiring_closed_reason        || '',
          employees_in_cc:                 d.employees_in_cc             || [],
        });
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: UpdateFormData) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hiringrequisitions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setDoc(json.data);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (asModal && onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (asModal && onClose) onClose();
    else navigate('/recruitment');
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md mb-3">
          Requisition not found.
        </div>
        <button onClick={handleBack} className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Form content ──────────────────────────────────────────────────────────
  const formContent = (
    <div className={asModal ? '' : 'p-4 md:p-6 mt-10 max-w-5xl mx-auto'}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <ArrowLeft size={15} /> {asModal ? 'Close' : 'Back'}
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Update Hiring #{doc.serial_no}</h1>
          <p className="text-sm text-gray-400">{doc.designation} — {doc.hiring_dept}</p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.fmsStatus === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
          {doc.fmsStatus}
        </span>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-md mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-4 hover:text-red-900">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-md mb-4">
          Updated successfully!
        </div>
      )}

      {/* Current Details */}
      <Accordion title="Current Details (Read-only)" defaultOpen>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ROField label="Serial No"          value={String(doc.serial_no)} />
          <ROField label="Request Date"        value={doc.request_date} />
          <ROField label="Requisitioner"       value={doc.requisitioner_name} />
          <ROField label="Requisitioner Email" value={doc.requisitioner_email} />
        </div>
        <hr className="my-4 border-gray-100" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ROField label="Hiring Dept"      value={doc.hiring_dept} />
          <ROField label="Dept Email"       value={doc.hiring_dept_email} />
          <ROField label="Designation"      value={doc.designation} />
          <ROField label="Experience Level" value={doc.candidate_experience_level} />
          <ROField label="Role Link"        value={doc.role_link} />
          <ROField label="JD Link"          value={doc.jd_link} />
        </div>
        <hr className="my-4 border-gray-100" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ROField label="Joining Days"             value={doc.select_joining_days} />
          <ROField label="Planned CVs Start"        value={doc.plan_start_sharing_cvs} />
          <ROField label="Planned Interviews Start" value={doc.planned_interviews_started} />
          <ROField label="Planned Offer Accepted"   value={doc.planned_offer_accepted} />
          <ROField label="Planned Joining"          value={doc.planned_joined} />
        </div>
        <hr className="my-4 border-gray-100" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ROField label="Actual CVs Started"        value={doc.shortlisted_cvs_sharing_started} />
          <ROField label="Actual Interviews Started" value={doc.interviews_started_date} />
          <ROField label="Offer Sent Date"           value={doc.offer_sent_date} />
          <ROField label="Offer Accepted Date"       value={doc.offer_accepted_date} />
        </div>
        <hr className="my-4 border-gray-100" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ROField label="Role & JD Exist?"   value={doc.role_n_jd_exist} />
          <ROField label="Read Role & JD?"    value={doc.role_n_jd_read} />
          <ROField label="Role & JD Good?"    value={doc.role_n_jd_good} />
          <ROField label="Days Well Thought?" value={doc.days_well_thought} />
        </div>
        <hr className="my-4 border-gray-100" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ROField label="Special Instructions"       value={doc.special_instructions} />
          <ROField label="Employees in CC"            value={(doc.employees_in_cc || []).join(', ')} />
          <ROField label="Not Accepted/Joined Reason" value={doc.not_accepted_joined_reason} />
          <ROField label="Closed Reason"              value={doc.hiring_closed_reason} />
          <div className="md:col-span-2">
            <ROField label="HR Remarks" value={doc.hr_remarks} />
          </div>
        </div>
      </Accordion>

      {/* Update Form */}
      <div className="border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-5">Update Entry</h2>

        <form onSubmit={handleSubmit(onSubmit, e => console.log('ERRORS', e))} noValidate>
          <div className="space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Hiring Status *</label>
                <Controller
                  name="hiring_status"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${inputCls} ${errors.hiring_status ? 'border-red-400' : ''}`}>
                      <option value="" disabled>Select status</option>
                      {HIRING_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                />
                {errors.hiring_status && <p className={errCls}>{errors.hiring_status.message}</p>}
              </div>
              <div>
                <label className={labelCls}>FMS Status</label>
                <Controller
                  name="fmsStatus"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={inputCls}>
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  )}
                />
              </div>
            </div>

            {SHOW_SHORTLISTED_DATE.has(watchedStatus) && (
              <div>
                <label className={labelCls}>Shortlisted CVs Sharing Started Date</label>
                <input type="date" {...register('shortlisted_cvs_sharing_started')} className={inputCls} />
              </div>
            )}

            {SHOW_INTERVIEWS_DATE.has(watchedStatus) && (
              <div>
                <label className={labelCls}>Interviews Started Date</label>
                <input type="date" {...register('interviews_started_date')} className={inputCls} />
              </div>
            )}

            {SHOW_OFFER_SENT_DATE.has(watchedStatus) && (
              <div>
                <label className={labelCls}>Offer Sent Date</label>
                <input type="date" {...register('offer_sent_date')} className={inputCls} />
              </div>
            )}

            {SHOW_OFFER_ACCEPTED.has(watchedStatus) && (
              <div>
                <label className={labelCls}>Offer Accepted Date</label>
                <input type="date" {...register('offer_accepted_date')} className={inputCls} />
              </div>
            )}

            {SHOW_JOINED_DATE.has(watchedStatus) && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2.5 rounded-md">
                Mark actual joining in the Onboarding section once the candidate joins.
              </div>
            )}

            {SHOW_NOT_ACCEPTED.has(watchedStatus) && (
              <div>
                <label className={labelCls}>Reason Not Accepted / Not Joined</label>
                <textarea {...register('not_accepted_joined_reason')} rows={2} className={inputCls} />
              </div>
            )}

            {SHOW_CLOSED_REASON.has(watchedStatus) && (
              <div>
                <label className={labelCls}>Reason Hiring Closed</label>
                <textarea {...register('hiring_closed_reason')} rows={2} className={inputCls} />
              </div>
            )}

            {/* CC recipients */}
            <div>
              <label className={labelCls}>Update CC List (optional)</label>
              <Controller
                name="employees_in_cc"
                control={control}
                render={({ field }) => (
                  <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {employees.length === 0 && (
                      <p className="text-xs text-gray-400 px-3 py-2">No employees found</p>
                    )}
                    {employees.map(emp => {
                      const checked = (field.value ?? []).includes(emp.official_email);
                      return (
                        <label key={emp.emp_id || emp.full_name} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current = field.value ?? [];
                              field.onChange(checked ? current.filter(e => e !== emp.official_email) : [...current, emp.official_email]);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{emp.full_name}</span>
                          <span className="text-xs text-gray-400 ml-auto">{emp.official_email}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              <Controller
                name="employees_in_cc"
                control={control}
                render={({ field }) => (
                  <div className={`flex flex-wrap gap-1.5 mt-2 ${(field.value ?? []).length === 0 ? 'hidden' : ''}`}>
                    {(field.value ?? []).map(email => {
                      const emp = employees.find(e => e.official_email === email);
                      return (
                        <span key={email} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {emp?.full_name ?? email}
                          <button type="button" onClick={() => field.onChange((field.value ?? []).filter(e => e !== email))} className="hover:text-blue-900 leading-none">×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* HR Remarks */}
            <div>
              <label className={labelCls}>HR Remarks *</label>
              <textarea
                {...register('hr_remarks')}
                rows={3}
                className={`${inputCls} ${errors.hr_remarks ? 'border-red-400' : ''}`}
              />
              {errors.hr_remarks
                ? <p className={errCls}>{errors.hr_remarks.message}</p>
                : <p className="text-xs text-gray-400 mt-1">Summarise what has happened / changed since last update</p>
              }
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save Update'}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );

  // ── Modal mode ─────────────────────────────────────────────────────────────
  if (asModal) return formContent;

  // ── Page mode ──────────────────────────────────────────────────────────────
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