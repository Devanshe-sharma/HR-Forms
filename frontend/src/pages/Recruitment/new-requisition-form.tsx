'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Checkbox,
  FormControlLabel,
  Chip,
  RadioGroup,
  Radio,
  FormLabel,
  Backdrop,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stack,
} from '@mui/material';
import { format, addDays } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schema
// ─────────────────────────────────────────────────────────────────────────────
const schema = z.object({
  serial_no:                z.number().optional(),
  requisitioner_name:       z.string().min(1, 'Requisitioner is required'),
  requisitioner_email:      z.string().email('Invalid email').optional().or(z.literal('')),
  hiring_dept:              z.string().min(1, 'Hiring Department is required'),
  hiring_dept_email:        z.string().optional(),
  dept_group_email:         z.string().optional(),
  designation_type:         z.enum(['existing', 'new']),
  designation_existing:     z.string().optional(),
  designation_new:          z.string().optional(),
  candidate_experience_level: z.enum(['Fresher', 'Experienced']).optional(),
  request_date:             z.string().optional(),
  select_joining_days:      z.string().min(1, 'Please select joining days'),
  plan_start_sharing_cvs:   z.string().optional(),
  planned_interviews_started: z.string().optional(),
  planned_offer_accepted:   z.string().optional(),
  planned_joined:           z.string().optional(),
  special_instructions:     z.string().optional(),
  hiring_status:            z.string().min(1, 'Hiring status is required'),
  employees_in_cc:          z.array(z.string()).optional(),
  // Dept checklist (form fields)
  role_n_jd_exist:          z.enum(['Yes', 'No'], { required_error: 'Required' }),
  role_n_jd_read:           z.enum(['Yes', 'No'], { required_error: 'Required' }),
  role_n_jd_good:           z.enum(['Yes', 'No'], { required_error: 'Required' }),
  days_well_thought:        z.enum(['Yes', 'No'], { required_error: 'Required' }),
  role_link:                z.string().optional(),
  jd_link:                  z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Employee = {
  emp_id: string;
  full_name: string;
  official_email: string;
};

type Department = {
  dept_id: number;
  department: string;
  dept_head_email?: string;
  dept_group_email?: string;
};

type Designation = {
  desig_id: number;
  designation: string;
  role_document_link?: string;
  jd_link?: string;
  department: string;
  dept_id: number;
};

type FormApiData = {
  next_serial: number;
  employees: Employee[];
  departments: Department[];
  designations: Designation[];
  joining_days_options: { value: string; label: string }[];
  hiring_status_options: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// HR Read-only checklists (shown for dept's info only)
// ─────────────────────────────────────────────────────────────────────────────
const HR_CHECKLISTS = [
  {
    title: 'Shortlist CVs Checklist',
    items: [
      'Role And JD Checked Done?',
      'Asked for Reference Done?',
      'Checked Internal References Done?',
      'Checked Internal Candidates Done?',
      'Thanked All Applicants Done?',
      'Emailed Shortlisted Candidates Done?',
    ],
  },
  {
    title: 'Interviews Checklist',
    items: [
      'All Interviews Logged Done?',
      'Asked Interviewers To Use Role Doc Done?',
      'Asked Interviewers To Use Tests Done?',
      'Asked Interviewers Hire Only Best Done?',
    ],
  },
  {
    title: 'Offer Letter Checklist',
    items: ['Asked Confirmation In 2 Days Done?'],
  },
  {
    title: 'General Feedback',
    items: ['Kept All Needed In Cc Done?'],
  },
];

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function NewRequisitionForm() {
  const [formData, setFormData] = useState<FormApiData | null>(null);
  const [filteredDesignations, setFilteredDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      designation_type:    'existing',
      designation_existing: '',
      designation_new:     '',
      employees_in_cc:     [],
      role_n_jd_exist:     undefined,
      role_n_jd_read:      undefined,
      role_n_jd_good:      undefined,
      days_well_thought:   undefined,
      role_link:           '',
      jd_link:             '',
      hiring_status:       '',
      dept_group_email:    '',
      candidate_experience_level: undefined,
    },
  });

  const requisitionerName       = watch('requisitioner_name');
  const hiringDept              = watch('hiring_dept');
  const designationType         = watch('designation_type');
  const designationExisting     = watch('designation_existing');
  const selectJoiningDays       = watch('select_joining_days');

  // ── Single fetch on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch(`${API_BASE}/hiring-form/all`);
        if (!res.ok) throw new Error('Failed to fetch form data');
        const json = await res.json();
        setFormData(json.data);
        setValue('serial_no', json.data.next_serial);
      } catch (err) {
        console.error(err);
        setError('Failed to load form data. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [setValue]);

  // ── Auto-fill today's date ─────────────────────────────────────────────────
  useEffect(() => {
    setValue('request_date', format(new Date(), 'dd-MM-yyyy'));
  }, [setValue]);

  // ── Auto-fill requisitioner email ─────────────────────────────────────────
  useEffect(() => {
    if (!requisitionerName || !formData) return;
    const emp = formData.employees.find(e => e.full_name === requisitionerName);
    setValue('requisitioner_email', emp?.official_email ?? '');
  }, [requisitionerName, formData, setValue]);

  // ── Auto-fill dept emails + filter designations ────────────────────────────
  useEffect(() => {
    if (!hiringDept || !formData) return;
    const dept = formData.departments.find(d => d.department === hiringDept);
    setValue('hiring_dept_email', dept?.dept_head_email ?? '');
    setValue('dept_group_email',  dept?.dept_group_email ?? '');

    // Filter designations by selected department
    const filtered = formData.designations.filter(d => d.department === hiringDept);
    setFilteredDesignations(filtered);

    // Clear previously selected designation
    setValue('designation_existing', '');
    setValue('role_link', '');
    setValue('jd_link', '');
  }, [hiringDept, formData, setValue]);

  // ── Auto-fill role & JD links ──────────────────────────────────────────────
  useEffect(() => {
    if (designationType === 'existing' && designationExisting && formData) {
      const des = formData.designations.find(d => d.designation === designationExisting);
      setValue('role_link', des?.role_document_link ?? '');
      setValue('jd_link',   des?.jd_link ?? '');
    } else if (designationType === 'new') {
      setValue('role_link', '');
      setValue('jd_link',   '');
    }
  }, [designationType, designationExisting, formData, setValue]);

  // ── Auto-calculate planned dates ───────────────────────────────────────────
  useEffect(() => {
    if (!selectJoiningDays) return;
    const match = selectJoiningDays.match(/\d+/);
    if (!match) return;
    const totalDays = parseInt(match[0], 10);
    const today = new Date();
    setValue('plan_start_sharing_cvs',      format(addDays(today, 3),            'dd-MM-yyyy'));
    setValue('planned_interviews_started',  format(addDays(today, 8),            'dd-MM-yyyy'));
    setValue('planned_offer_accepted',      format(addDays(today, totalDays - 15), 'dd-MM-yyyy'));
    setValue('planned_joined',              format(addDays(today, totalDays),     'dd-MM-yyyy'));
  }, [selectJoiningDays, setValue]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setSubmitLoading(true);
    setError(null);

    const convertDate = (dateStr?: string) => {
      if (!dateStr) return null;
      const [day, month, year] = dateStr.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    try {
      const submitData = {
        ...data,
        designation_status: data.designation_type,
        designation:
          data.designation_type === 'existing'
            ? data.designation_existing
            : data.designation_new,
        request_date:               convertDate(data.request_date),
        plan_start_sharing_cvs:     convertDate(data.plan_start_sharing_cvs),
        planned_interviews_started: convertDate(data.planned_interviews_started),
        planned_offer_accepted:     convertDate(data.planned_offer_accepted),
        planned_joined:             convertDate(data.planned_joined),
        dept_group_email:           data.dept_group_email  || null,
        role_link:                  data.role_link         || null,
        jd_link:                    data.jd_link           || null,
        special_instructions:       data.special_instructions || null,
      };

      const res = await fetch(`${API_BASE}/hiringrequisitions/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(submitData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Submission failed');
      }

      setSuccessOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit requisition');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: 'auto' }}>

      {/* ── Header ── */}
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Enter a New Hiring Requisition
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Fill a separate form per person needed. Be practical with timelines.
      </Typography>
      <Divider sx={{ my: 3 }} />

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 1 — Requester Details
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>Requester Details</SectionTitle>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 3 }}>
          <Box flex={1}>
            <InputLabel shrink>Hiring Serial No (auto-filled)</InputLabel>
            <TextField
              fullWidth
              value={watch('serial_no') ?? ''}
              disabled
              size="small"
            />
          </Box>
          <Box flex={1}>
            <InputLabel shrink>Request Date (auto-filled)</InputLabel>
            <TextField
              fullWidth
              value={watch('request_date') ?? ''}
              disabled
              size="small"
            />
          </Box>
        </Stack>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth error={!!errors.requisitioner_name}>
            <InputLabel>Requisition raised by *</InputLabel>
            <Controller
              name="requisitioner_name"
              control={control}
              render={({ field }) => (
                <Select {...field} value={field.value ?? ''} label="Requisition raised by *">
                  <MenuItem value="" disabled>Select Requisitioner</MenuItem>
                  {formData?.employees.map(emp => (
                    <MenuItem key={emp.emp_id} value={emp.full_name}>
                      {emp.full_name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.requisitioner_name && (
              <FormHelperText>{errors.requisitioner_name.message}</FormHelperText>
            )}
          </FormControl>
        </Box>

        <Box sx={{ mb: 4 }}>
          <InputLabel shrink>Requisitioner's Email (auto-filled)</InputLabel>
          <TextField fullWidth value={watch('requisitioner_email') ?? ''} disabled size="small" />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 2 — Position to Hire
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>Position to Hire</SectionTitle>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth error={!!errors.hiring_dept}>
            <InputLabel>Hiring Department *</InputLabel>
            <Controller
              name="hiring_dept"
              control={control}
              render={({ field }) => (
                <Select {...field} value={field.value ?? ''} label="Hiring Department *">
                  <MenuItem value="" disabled>Select Department</MenuItem>
                  {formData?.departments.map(dept => (
                    <MenuItem key={dept.dept_id} value={dept.department}>
                      {dept.department}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.hiring_dept && <FormHelperText>{errors.hiring_dept.message}</FormHelperText>}
          </FormControl>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
          <Box flex={1}>
            <InputLabel shrink>Dept Head Email (auto-filled)</InputLabel>
            <TextField fullWidth value={watch('hiring_dept_email') ?? ''} disabled size="small" />
          </Box>
          <Box flex={1}>
            <InputLabel shrink>Dept Group Email (auto-filled)</InputLabel>
            <TextField fullWidth value={watch('dept_group_email') ?? ''} disabled size="small" />
          </Box>
        </Stack>

        {/* ── Designation (shown only after dept selected) ── */}
        {hiringDept && (
          <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Designation
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">Existing or New?</FormLabel>
              <Controller
                name="designation_type"
                control={control}
                render={({ field }) => (
                  <RadioGroup row {...field}>
                    <FormControlLabel value="existing" control={<Radio />} label="Existing" />
                    <FormControlLabel value="new"      control={<Radio />} label="New" />
                  </RadioGroup>
                )}
              />
            </FormControl>

            {designationType === 'existing' && (
              <FormControl fullWidth error={!!errors.designation_existing} sx={{ mb: 2 }}>
                <InputLabel>Select Existing Designation</InputLabel>
                <Controller
                  name="designation_existing"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} value={field.value ?? ''} label="Select Existing Designation">
                      <MenuItem value="" disabled>Select</MenuItem>
                      {/* ✅ FIXED: use filteredDesignations, not all designations */}
                      {filteredDesignations.map(des => (
                        <MenuItem key={des.desig_id} value={des.designation}>
                          {des.designation}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.designation_existing && (
                  <FormHelperText>{errors.designation_existing.message}</FormHelperText>
                )}
              </FormControl>
            )}

            {designationType === 'new' && (
              <TextField
                fullWidth
                label="New Designation Name"
                {...register('designation_new')}
                error={!!errors.designation_new}
                helperText={errors.designation_new?.message}
                sx={{ mb: 2 }}
              />
            )}

            {/* Auto-filled links — shown when existing designation picked */}
            {designationType === 'existing' && designationExisting && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="Link to Role (auto-filled)"
                  value={watch('role_link') ?? ''}
                  disabled
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Link to JD (auto-filled)"
                  value={watch('jd_link') ?? ''}
                  disabled
                  size="small"
                />
              </Stack>
            )}

            {/* ✅ NEW: Candidate experience level — shown after designation selected */}
            {(designationExisting || watch('designation_new')) && (
              <FormControl fullWidth error={!!errors.candidate_experience_level} sx={{ mt: 2 }}>
                <InputLabel>Candidate Experience Level</InputLabel>
                <Controller
                  name="candidate_experience_level"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} value={field.value ?? ''} label="Candidate Experience Level">
                      <MenuItem value="" disabled>Select</MenuItem>
                      <MenuItem value="Fresher">Fresher</MenuItem>
                      <MenuItem value="Experienced">Experienced</MenuItem>
                    </Select>
                  )}
                />
                {errors.candidate_experience_level && (
                  <FormHelperText>{errors.candidate_experience_level.message}</FormHelperText>
                )}
              </FormControl>
            )}
          </Paper>
        )}

        <Divider sx={{ my: 3 }} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 3 — Joining Timeline
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>Days to Fulfil Requirement (from today)</SectionTitle>

        <FormControl fullWidth error={!!errors.select_joining_days} sx={{ mb: 3 }}>
          <InputLabel>Select joining days *</InputLabel>
          <Controller
            name="select_joining_days"
            control={control}
            render={({ field }) => (
              <Select {...field} value={field.value ?? ''} label="Select joining days *">
                <MenuItem value="" disabled>Select</MenuItem>
                {formData?.joining_days_options.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
          {errors.select_joining_days && (
            <FormHelperText>{errors.select_joining_days.message}</FormHelperText>
          )}
        </FormControl>

        {selectJoiningDays && (
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 4, bgcolor: 'success.50', borderColor: 'success.200' }}
          >
            <Typography variant="body2" fontWeight="bold" color="success.dark" gutterBottom>
              Hiring Plan (Auto-Calculated)
            </Typography>
            <Stack spacing={0.5}>
              {[
                { label: 'Start sharing CVs',   val: watch('plan_start_sharing_cvs') },
                { label: 'Interviews start',     val: watch('planned_interviews_started') },
                { label: 'Offer accepted by',    val: watch('planned_offer_accepted') },
                { label: 'Joining by',           val: watch('planned_joined') },
              ].map(({ label, val }) => (
                <Typography key={label} variant="body2" color="success.dark">
                  • {label}: <strong>{val || '—'}</strong>
                </Typography>
              ))}
            </Stack>
          </Paper>
        )}

        <Divider sx={{ my: 3 }} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 4 — Special Instructions & Status
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>Special Instructions to HR</SectionTitle>

        <TextField
          fullWidth
          multiline
          rows={4}
          {...register('special_instructions')}
          placeholder="Clearly mention the role and any special requirements..."
          sx={{ mb: 3 }}
        />

        <FormControl fullWidth error={!!errors.hiring_status} sx={{ mb: 4 }}>
          <InputLabel>Hiring Status *</InputLabel>
          <Controller
            name="hiring_status"
            control={control}
            render={({ field }) => (
              <Select {...field} value={field.value ?? ''} label="Hiring Status *">
                <MenuItem value="" disabled>Select status</MenuItem>
                {/* ✅ FIXED: full list from API */}
                {formData?.hiring_status_options.map(status => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            )}
          />
          {errors.hiring_status && <FormHelperText>{errors.hiring_status.message}</FormHelperText>}
        </FormControl>

        <Divider sx={{ my: 3 }} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 5 — People to CC
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>People to Keep in CC</SectionTitle>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          The following are automatically included in CC — no need to add them again:
          MD &amp; CEO, Head Ops, Deputy Ops, HR, Admin, Accounts, and DME.
        </Typography>

        <FormControl fullWidth sx={{ mb: 4 }}>
          <InputLabel>Select additional CC recipients</InputLabel>
          <Controller
            name="employees_in_cc"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                multiple
                value={field.value ?? []}
                label="Select additional CC recipients"
                renderValue={(selected: string[]) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map(email => {
                      const emp = formData?.employees.find(e => e.official_email === email);
                      return (
                        <Chip key={email} label={emp?.full_name ?? email} size="small" />
                      );
                    })}
                  </Box>
                )}
              >
                {formData?.employees.map(emp => (
                  <MenuItem key={emp.emp_id} value={emp.official_email}>
                    <Checkbox checked={field.value?.includes(emp.official_email)} />
                    {emp.full_name}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </FormControl>

        <Divider sx={{ my: 3 }} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 6 — Dept Checklist (required form fields)
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>Checklist for Dept Raising Requisition</SectionTitle>

        <Stack spacing={2} sx={{ mb: 4 }}>
          {(
            [
              { name: 'role_n_jd_exist',  label: 'Do the Role & JD Documents exist?' },
              { name: 'role_n_jd_read',   label: 'Have you read the Role & JD?' },
              { name: 'role_n_jd_good',   label: 'Are the Role & JD suitable & well made?' },
              { name: 'days_well_thought',label: 'Are the days to fulfil the requirement practical and realistic?' },
            ] as { name: keyof FormData; label: string }[]
          ).map(({ name, label }) => (
            <FormControl key={name} fullWidth error={!!errors[name]}>
              <InputLabel>{label} *</InputLabel>
              <Controller
                name={name as any}
                control={control}
                render={({ field }) => (
                  <Select {...field} value={field.value ?? ''} label={`${label} *`}>
                    <MenuItem value="" disabled>Select</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                )}
              />
              {errors[name] && (
                <FormHelperText>{(errors[name] as any)?.message ?? 'Required'}</FormHelperText>
              )}
            </FormControl>
          ))}
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 7 — HR Checklist (read-only / info only)
        ════════════════════════════════════════════════════════════════ */}
        <SectionTitle>HR Dept Checklist (For Dept's Info Only)</SectionTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These are the steps HR will follow. Shown here for your transparency.
        </Typography>

        <Stack spacing={2} sx={{ mb: 5 }}>
          {HR_CHECKLISTS.map(section => (
            <Paper key={section.title} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {section.title}
              </Typography>
              <Stack spacing={0.5}>
                {section.items.map(item => (
                  <FormControlLabel
                    key={item}
                    control={<Checkbox disabled size="small" />}
                    label={<Typography variant="body2">{item}</Typography>}
                  />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* ════════════════════════════════════════════════════════════════
            Submit Button
        ════════════════════════════════════════════════════════════════ */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ minWidth: 220 }}
          >
            {submitLoading ? 'Submitting...' : 'Submit Requisition'}
          </Button>
        </Box>
      </form>

      {/* ── Backdrop ── */}
      <Backdrop open={submitLoading} sx={{ zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* ════════════════════════════════════════════════════════════════
          Success Dialog  (replaces simple Alert + redirect)
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={successOpen} maxWidth="sm" fullWidth>
        <DialogTitle>🎉 Requisition Submitted!</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            A Hiring Requisition email has been sent to the HR Dept, with all concerned in CC.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            HR will update hiring progress to you over email. You can add another request or return to the dashboard.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setSuccessOpen(false);
              reset();
              // re-fetch serial number for next submission
              fetch(`${API_BASE}/hiring-form/all`)
                .then(r => r.json())
                .then(j => setValue('serial_no', j.data.next_serial))
                .catch(() => {});
            }}
          >
            Add Another Request
          </Button>
          <Button
            variant="contained"
            onClick={() => { window.location.href = '/dashboard'; }}
          >
            Return to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helper component for section headings
// ─────────────────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
      {children}
    </Typography>
  );
}