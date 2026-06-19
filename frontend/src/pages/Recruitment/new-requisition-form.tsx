import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schema
// ─────────────────────────────────────────────────────────────────────────────
const schema = z.object({
  serial_no:                  z.number().optional(),
  requisitioner_name:         z.string().min(1, 'Requisitioner is required'),
  requisitioner_email:        z.string().email('Invalid email').optional().or(z.literal('')),
  hiring_dept:                z.string().min(1, 'Hiring Department is required'),
  hiring_dept_email:          z.string().optional(),
  dept_group_email:           z.string().optional(),
  designation_type:           z.enum(['existing', 'new']),
  designation_existing:       z.string().optional(),
  designation_new:            z.string().optional(),
  candidate_experience_level: z.enum(['Fresher', 'Experienced']).optional(),
  request_date:               z.string().optional(),
  select_joining_days:        z.string().min(1, 'Please select joining days'),
  plan_start_sharing_cvs:     z.string().optional(),
  planned_interviews_started: z.string().optional(),
  planned_offer_accepted:     z.string().optional(),
  planned_joined:             z.string().optional(),
  special_instructions:       z.string().optional(),
  hiring_status:              z.string().min(1, 'Hiring status is required'),
  employees_in_cc:            z.array(z.string()).optional(),
  role_n_jd_exist:            z.enum(['Yes', 'No'], { required_error: 'Required' }),
  role_n_jd_read:             z.enum(['Yes', 'No'], { required_error: 'Required' }),
  role_n_jd_good:             z.enum(['Yes', 'No'], { required_error: 'Required' }),
  days_well_thought:          z.enum(['Yes', 'No'], { required_error: 'Required' }),
  role_link:                  z.string().optional(),
  jd_link:                    z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Employee    = { emp_id: string; full_name: string; official_email: string; department: string; designation: string };
type Department  = { dept_id: number | string | null; department: string; dept_head_email?: string; dept_group_email?: string };
type Designation = { dept_id: number | string | null; department: string; desig_id: number | string | null; designation: string; role_document_link?: string; jd_link?: string };
type RoleMasterData = { departments: Department[]; designations: Designation[]; employees: Employee[] };

// ─────────────────────────────────────────────────────────────────────────────
// Props — asModal=true strips Sidebar/Navbar and fires callbacks
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  asModal?:   boolean;
  onSuccess?: () => void;
  onClose?:   () => void;
}

const HR_CHECKLISTS = [
  { title: 'Shortlist CVs Checklist', items: ['Role And JD Checked Done?', 'Asked for Reference Done?', 'Checked Internal References Done?', 'Checked Internal Candidates Done?', 'Thanked All Applicants Done?', 'Emailed Shortlisted Candidates Done?'] },
  { title: 'Interviews Checklist',    items: ['All Interviews Logged Done?', 'Asked Interviewers To Use Role Doc Done?', 'Asked Interviewers To Use Tests Done?', 'Asked Interviewers Hire Only Best Done?'] },
  { title: 'Offer Letter Checklist',  items: ['Asked Confirmation In 2 Days Done?'] },
  { title: 'General Feedback',        items: ['Kept All Needed In Cc Done?'] },
];

const JOINING_DAYS_OPTIONS = [
  { value: '20 days', label: '20 days = joining at 0 days notice' },
  { value: '35 days', label: '35 days = joining at 15-days notice' },
  { value: '50 days', label: '50 days = joining at 30-days notice' },
  { value: '80 days', label: '80 days = joining at 60-days notice' },
];

const HIRING_STATUS_OPTIONS = ['New', 'No Change in Status', 'On Hold', 'Cancelled', 'Filled Internally', 'Filled Externally'];

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const inputCls   = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400';
const labelCls   = 'block text-xs font-medium text-gray-600 mb-1';
const errCls     = 'text-xs text-red-600 mt-1';
const sectionCls = 'text-sm font-bold text-gray-800 mt-6 mb-3';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={sectionCls}>{children}</h2>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function NewRequisitionForm({ asModal = false, onSuccess, onClose }: Props) {
  const navigate = useNavigate();

  const [roleData,             setRoleData]             = useState<RoleMasterData | null>(null);
  const [filteredDesignations, setFilteredDesignations] = useState<Designation[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [submitLoading,        setSubmitLoading]        = useState(false);
  const [successOpen,          setSuccessOpen]          = useState(false);
  const [error,                setError]                = useState<string | null>(null);

  const {
    control, watch, setValue, handleSubmit, register, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      designation_type:           'existing',
      designation_existing:       '',
      designation_new:            '',
      employees_in_cc:            [],
      role_n_jd_exist:            '' as any,
      role_n_jd_read:             '' as any,
      role_n_jd_good:             '' as any,
      days_well_thought:          '' as any,
      candidate_experience_level: '' as any,
      role_link:                  '',
      jd_link:                    '',
      hiring_status:              '',
      dept_group_email:           '',
    },
  });

  const requisitionerName   = watch('requisitioner_name');
  const hiringDept          = watch('hiring_dept');
  const designationType     = watch('designation_type');
  const designationExisting = watch('designation_existing');
  const selectJoiningDays   = watch('select_joining_days');

  const fetchNextSerial = () =>
    fetch(`${API_BASE}/hiringrequisitions/next-serial`)
      .then(r => r.json())
      .then(json => { if (json?.next_serial) setValue('serial_no', json.next_serial); })
      .catch(() => {});

  useEffect(() => {
    fetch(`${API_BASE}/rolemaster/all`)
      .then(r => r.json())
      .then(json => setRoleData(json.data))
      .catch(() => setError('Failed to load department/designation data. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchNextSerial(); }, [setValue]);
  useEffect(() => { setValue('request_date', format(new Date(), 'dd-MM-yyyy')); }, [setValue]);

  useEffect(() => {
    if (!requisitionerName || !roleData) return;
    const emp = roleData.employees.find(e => e.full_name === requisitionerName);
    setValue('requisitioner_email', emp?.official_email ?? '');
  }, [requisitionerName, roleData, setValue]);

  useEffect(() => {
    if (!hiringDept || !roleData) return;
    const dept = roleData.departments.find(d => d.department === hiringDept);
    setValue('hiring_dept_email', dept?.dept_head_email ?? '');
    setValue('dept_group_email',  dept?.dept_group_email ?? '');
    setFilteredDesignations(roleData.designations.filter(d => d.department === hiringDept));
    setValue('designation_existing', '');
    setValue('role_link', '');
    setValue('jd_link',   '');
  }, [hiringDept, roleData, setValue]);

  useEffect(() => {
    if (designationType === 'existing' && designationExisting && roleData) {
      const des = roleData.designations.find(d => d.designation === designationExisting);
      setValue('role_link', des?.role_document_link ?? '');
      setValue('jd_link',   des?.jd_link ?? '');
    } else if (designationType === 'new') {
      setValue('role_link', '');
      setValue('jd_link',   '');
    }
  }, [designationType, designationExisting, roleData, setValue]);

  useEffect(() => {
    if (!selectJoiningDays) return;
    const match = selectJoiningDays.match(/\d+/);
    if (!match) return;
    const totalDays = parseInt(match[0], 10);
    const today = new Date();
    setValue('plan_start_sharing_cvs',     format(addDays(today, 3),              'dd-MM-yyyy'));
    setValue('planned_interviews_started', format(addDays(today, 8),              'dd-MM-yyyy'));
    setValue('planned_offer_accepted',     format(addDays(today, totalDays - 15), 'dd-MM-yyyy'));
    setValue('planned_joined',             format(addDays(today, totalDays),      'dd-MM-yyyy'));
  }, [selectJoiningDays, setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitLoading(true);
    setError(null);
    const convertDate = (dateStr?: string) => {
      if (!dateStr) return null;
      const [day, month, year] = dateStr.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    try {
      const matchedDesig = data.designation_type === 'existing'
        ? roleData?.designations.find(d => d.designation === data.designation_existing)
        : null;
      const { serial_no, designation_type, designation_existing, designation_new, ...rest } = data;
      const payload = {
        ...rest,
        designation_status:         designation_type,
        designation:                designation_type === 'existing' ? designation_existing : designation_new,
        designation_id:             matchedDesig?.desig_id ?? null,
        request_date:               convertDate(data.request_date),
        plan_start_sharing_cvs:     convertDate(data.plan_start_sharing_cvs),
        planned_interviews_started: convertDate(data.planned_interviews_started),
        planned_offer_accepted:     convertDate(data.planned_offer_accepted),
        planned_joined:             convertDate(data.planned_joined),
        dept_group_email:           data.dept_group_email    || null,
        role_link:                  data.role_link           || null,
        jd_link:                    data.jd_link             || null,
        special_instructions:       data.special_instructions || null,
      };
      const res = await fetch(`${API_BASE}/hiringrequisitions/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error || 'Submission failed');
      }
      setSuccessOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit requisition');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAddAnother = () => {
    setSuccessOpen(false);
    reset();
    fetchNextSerial();
  };

  const handleReturnToDashboard = () => {
    if (asModal && onSuccess) {
      onSuccess();
    } else {
      navigate('/recruitment');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Form content (shared between modal and page) ───────────────────────────
  const formContent = (
    <div className={asModal ? '' : 'p-4 md:p-8 mt-10 max-w-3xl mx-auto'}>
      {!asModal && (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Enter a New Hiring Requisition</h1>
          <p className="text-sm text-gray-500 mt-1 mb-4">Fill a separate form per person needed. Be practical with timelines.</p>
          <hr className="border-gray-200 mb-4" />
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit, e => console.log('FORM ERRORS', e))} noValidate>

        <SectionTitle>Requester Details</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Hiring Serial No (auto-generated)</label>
            <input className={inputCls} value={watch('serial_no') ?? '—'} disabled readOnly />
          </div>
          <div>
            <label className={labelCls}>Request Date (auto-filled)</label>
            <input className={inputCls} value={watch('request_date') ?? ''} disabled readOnly />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}>Requisition raised by *</label>
          <Controller
            name="requisitioner_name"
            control={control}
            render={({ field }) => (
              <select {...field} className={`${inputCls} ${errors.requisitioner_name ? 'border-red-400' : ''}`}>
                <option value="" disabled>
                  {roleData?.employees.length ? 'Select Requisitioner' : 'No employees found in Role Master'}
                </option>
                {roleData?.employees.map(emp => (
                  <option key={emp.emp_id || emp.full_name} value={emp.full_name}>{emp.full_name}</option>
                ))}
              </select>
            )}
          />
          {errors.requisitioner_name && <p className={errCls}>{errors.requisitioner_name.message}</p>}
        </div>

        <div className="mb-4">
          <label className={labelCls}>Requisitioner's Email (auto-filled)</label>
          <input className={inputCls} value={watch('requisitioner_email') ?? ''} disabled readOnly />
        </div>

        <hr className="border-gray-200 my-5" />
        <SectionTitle>Position to Hire</SectionTitle>

        <div className="mb-4">
          <label className={labelCls}>Hiring Department *</label>
          <Controller
            name="hiring_dept"
            control={control}
            render={({ field }) => (
              <select {...field} className={`${inputCls} ${errors.hiring_dept ? 'border-red-400' : ''}`}>
                <option value="" disabled>Select Department</option>
                {roleData?.departments.map(dept => (
                  <option key={dept.dept_id ?? dept.department} value={dept.department}>{dept.department}</option>
                ))}
              </select>
            )}
          />
          {errors.hiring_dept && <p className={errCls}>{errors.hiring_dept.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Dept Head Email (auto-filled)</label>
            <input className={inputCls} value={watch('hiring_dept_email') ?? ''} disabled readOnly />
          </div>
          <div>
            <label className={labelCls}>Dept Group Email (auto-filled)</label>
            <input className={inputCls} value={watch('dept_group_email') ?? ''} disabled readOnly />
          </div>
        </div>

        {hiringDept && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Designation</p>

            <div className="mb-3">
              <p className={labelCls}>Existing or New?</p>
              <Controller
                name="designation_type"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-6">
                    {(['existing', 'new'] as const).map(val => (
                      <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          value={val}
                          checked={field.value === val}
                          onChange={() => field.onChange(val)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        {val.charAt(0).toUpperCase() + val.slice(1)}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {designationType === 'existing' && (
              <div className="mb-3">
                <label className={labelCls}>Select Existing Designation</label>
                <Controller
                  name="designation_existing"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${inputCls} ${errors.designation_existing ? 'border-red-400' : ''}`}>
                      <option value="" disabled>
                        {filteredDesignations.length ? 'Select' : 'No designations found for this department'}
                      </option>
                      {filteredDesignations.map(des => (
                        <option key={des.desig_id ?? des.designation} value={des.designation}>{des.designation}</option>
                      ))}
                    </select>
                  )}
                />
                {errors.designation_existing && <p className={errCls}>{errors.designation_existing.message}</p>}
              </div>
            )}

            {designationType === 'new' && (
              <div className="mb-3">
                <label className={labelCls}>New Designation Name</label>
                <input {...register('designation_new')} className={`${inputCls} ${errors.designation_new ? 'border-red-400' : ''}`} />
                {errors.designation_new && <p className={errCls}>{errors.designation_new.message}</p>}
              </div>
            )}

            {designationType === 'existing' && designationExisting && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>Link to Role (auto-filled)</label>
                  <input className={inputCls} value={watch('role_link') ?? ''} disabled readOnly />
                </div>
                <div>
                  <label className={labelCls}>Link to JD (auto-filled)</label>
                  <input className={inputCls} value={watch('jd_link') ?? ''} disabled readOnly />
                </div>
              </div>
            )}

            {(designationExisting || watch('designation_new')) && (
              <div>
                <label className={labelCls}>Candidate Experience Level</label>
                <Controller
                  name="candidate_experience_level"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${inputCls} ${errors.candidate_experience_level ? 'border-red-400' : ''}`}>
                      <option value="" disabled>Select</option>
                      <option value="Fresher">Fresher</option>
                      <option value="Experienced">Experienced</option>
                    </select>
                  )}
                />
                {errors.candidate_experience_level && <p className={errCls}>{errors.candidate_experience_level.message}</p>}
              </div>
            )}
          </div>
        )}

        <hr className="border-gray-200 my-5" />
        <SectionTitle>Days to Fulfil Requirement (from today)</SectionTitle>

        <div className="mb-4">
          <label className={labelCls}>Select joining days *</label>
          <Controller
            name="select_joining_days"
            control={control}
            render={({ field }) => (
              <select {...field} className={`${inputCls} ${errors.select_joining_days ? 'border-red-400' : ''}`}>
                <option value="" disabled>Select</option>
                {JOINING_DAYS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          />
          {errors.select_joining_days && <p className={errCls}>{errors.select_joining_days.message}</p>}
        </div>

        {selectJoiningDays && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-green-800 mb-2">Hiring Plan (Auto-Calculated)</p>
            <ul className="space-y-1">
              {[
                { label: 'Start sharing CVs', val: watch('plan_start_sharing_cvs') },
                { label: 'Interviews start',  val: watch('planned_interviews_started') },
                { label: 'Offer accepted by', val: watch('planned_offer_accepted') },
                { label: 'Joining by',        val: watch('planned_joined') },
              ].map(({ label, val }) => (
                <li key={label} className="text-sm text-green-700">• {label}: <strong>{val || '—'}</strong></li>
              ))}
            </ul>
          </div>
        )}

        <hr className="border-gray-200 my-5" />
        <SectionTitle>Special Instructions to HR</SectionTitle>

        <div className="mb-4">
          <textarea {...register('special_instructions')} rows={4} placeholder="Clearly mention the role and any special requirements..." className={inputCls} />
        </div>

        <div className="mb-4">
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

        <hr className="border-gray-200 my-5" />
        <SectionTitle>People to Keep in CC</SectionTitle>

        <p className="text-sm text-gray-500 mb-3">
          The following are automatically included in CC — no need to add them again:
          MD &amp; CEO, Head Ops, Deputy Ops, HR, Admin, Accounts, and DME.
        </p>

        <div className="mb-4">
          <label className={labelCls}>Select additional CC recipients</label>
          <Controller
            name="employees_in_cc"
            control={control}
            render={({ field }) => (
              <>
                <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {(roleData?.employees ?? []).map(emp => {
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
                <div className={`flex flex-wrap gap-1.5 mt-2 ${(field.value ?? []).length === 0 ? 'hidden' : ''}`}>
                  {(field.value ?? []).map(email => {
                    const emp = roleData?.employees.find(e => e.official_email === email);
                    return (
                      <span key={email} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {emp?.full_name ?? email}
                        <button type="button" onClick={() => field.onChange((field.value ?? []).filter(e => e !== email))} className="hover:text-blue-900 leading-none">×</button>
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          />
        </div>

        <hr className="border-gray-200 my-5" />
        <SectionTitle>Checklist for Dept Raising Requisition</SectionTitle>

        <div className="space-y-3 mb-4">
          {(
            [
              { name: 'role_n_jd_exist',   label: 'Do the Role & JD Documents exist?' },
              { name: 'role_n_jd_read',    label: 'Have you read the Role & JD?' },
              { name: 'role_n_jd_good',    label: 'Are the Role & JD suitable & well made?' },
              { name: 'days_well_thought', label: 'Are the days to fulfil the requirement practical and realistic?' },
            ] as { name: keyof FormData; label: string }[]
          ).map(({ name, label }) => (
            <div key={name}>
              <label className={labelCls}>{label} *</label>
              <Controller
                name={name as any}
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${inputCls} ${errors[name] ? 'border-red-400' : ''}`}>
                    <option value="" disabled>Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                )}
              />
              {errors[name] && <p className={errCls}>{(errors[name] as any)?.message ?? 'Required'}</p>}
            </div>
          ))}
        </div>

        <hr className="border-gray-200 my-5" />
        <SectionTitle>HR Dept Checklist (For Dept's Info Only)</SectionTitle>
        <p className="text-sm text-gray-500 mb-3">These are the steps HR will follow. Shown here for your transparency.</p>

        <div className="space-y-3 mb-6">
          {HR_CHECKLISTS.map(section => (
            <div key={section.title} className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">{section.title}</p>
              <ul className="space-y-1.5">
                {section.items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-500">
                    <input type="checkbox" disabled className="rounded border-gray-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className={`mt-6 ${asModal ? 'flex justify-end gap-2' : 'text-center'}`}>
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
            type="submit"
            disabled={submitLoading}
            className="inline-flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition min-w-[180px] justify-center"
          >
            {submitLoading && <Loader2 size={16} className="animate-spin" />}
            {submitLoading ? 'Submitting...' : 'Submit Requisition'}
          </button>
        </div>
      </form>

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
            <h2 className="text-lg font-bold text-gray-900 mb-2">🎉 Requisition Submitted!</h2>
            <p className="text-sm text-gray-700 mb-2">
              A Hiring Requisition email has been sent to the HR Dept, with all concerned in CC.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              HR will update hiring progress to you over email. You can add another request or return to the dashboard.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleAddAnother}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Add Another Request
              </button>
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

  // ── Modal mode: return just the form content ───────────────────────────────
  if (asModal) return formContent;

  // ── Page mode: wrap with Sidebar + Navbar ─────────────────────────────────
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