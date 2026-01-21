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
  FormGroup,
  Chip,
  RadioGroup,
  Radio,
  FormLabel,
  Backdrop,
} from '@mui/material';
import { format, addDays } from 'date-fns';

// ────────────────────────────────────────────────────────────────
// Zod Schema
// ────────────────────────────────────────────────────────────────
const schema = z.object({
  requisitioner_name: z.string().min(1, 'Requisitioner is required'),
  requisitioner_email: z.string().email('Invalid email').optional(),
  hiring_dept: z.string().min(1, 'Hiring Department is required'),
  hiring_dept_email: z.string().email('Invalid email').optional(),
  dept_group_email: z.string().email('Invalid email').optional(),
  designation_type: z.enum(['existing', 'new']).refine(
    val => val === 'existing' || val === 'new',
    { message: 'Please select existing or new designation' }
  ),
  designation_existing: z.string().optional(),
  designation_new: z.string().optional(),
  request_date: z.string().optional(),
  select_joining_days: z.string().min(1, 'Please select joining days'),
  plan_start_sharing_cvs: z.string().optional(),
  planned_interviews_started: z.string().optional(),
  planned_offer_accepted: z.string().optional(),
  planned_joined: z.string().optional(),
  special_instructions: z.string().optional(),
  hiring_status: z.string().min(1, 'Hiring status is required'),
  employees_in_cc: z.array(z.string()).optional(),
  role_n_jd_exist: z.enum(['Yes', 'No']),
  role_n_jd_read: z.enum(['Yes', 'No']),
  role_n_jd_good: z.enum(['Yes', 'No']),
  days_well_thought: z.enum(['Yes', 'No']),
  role_link: z.string().optional(),
  jd_link: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Employee = { id: number; full_name: string; official_email: string };
type Department = { id: number; name: string; dept_head_email?: string; dept_group_email?: string };
type Designation = { id: number; name: string; role_document_link?: string; jd_link?: string };

export default function NewRequisitionForm() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      designation_type: 'existing',
      designation_existing: '',
      designation_new: '',
      employees_in_cc: [],
      role_n_jd_exist: 'Yes',
      role_n_jd_read: 'Yes',
      role_n_jd_good: 'Yes',
      days_well_thought: 'Yes',
      role_link: '',
      jd_link: '',
      hiring_status: '',
      dept_group_email: '',
    },
  });

  const requisitionerName = watch('requisitioner_name');
  const hiringDept = watch('hiring_dept');
  const designationType = watch('designation_type');
  const designationExisting = watch('designation_existing');
  const selectJoiningDays = watch('select_joining_days');

  // Fetch employees and departments
  useEffect(() => {
    console.log('[FETCH] Starting to load employees & departments...');
    const fetchData = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch('https://hr-forms.onrender.com/api/employees/'),
          fetch('https://hr-forms.onrender.com/api/departments/'),
        ]);

        console.log('[FETCH] Employees status:', empRes.status);
        console.log('[FETCH] Departments status:', deptRes.status);

        if (!empRes.ok || !deptRes.ok) {
          throw new Error('Failed to fetch initial data');
        }

        const empData = await empRes.json();
        const deptData = await deptRes.json();

        console.log('[FETCH] Employees count:', empData.length);
        console.log('[FETCH] Departments count:', deptData.length);
        console.log('[FETCH] Sample department:', deptData[0] || 'No data');

        setEmployees(empData);
        setDepartments(deptData);
      } catch (err) {
        console.error('[FETCH ERROR]', err);
        setError('Failed to load data from server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch designations when department changes
  useEffect(() => {
    if (!hiringDept) return;

    console.log('[DESIGNATION] Department selected:', hiringDept);

    const fetchDesignations = async () => {
      try {
        const dept = departments.find(d => d.name === hiringDept);
        if (!dept?.id) {
          console.warn('[DESIGNATION] No ID found for department');
          return;
        }

        const url = `https://hr-forms.onrender.com/api/designations/?department=${dept.id}`;
        console.log('[DESIGNATION] Fetching from:', url);

        const res = await fetch(url);
        console.log('[DESIGNATION] Status:', res.status);

        if (!res.ok) throw new Error('Designations fetch failed');

        const data = await res.json();
        console.log('[DESIGNATION] Loaded:', data.length, 'items');
        setDesignations(data);
      } catch (err) {
        console.error('[DESIGNATION ERROR]', err);
      }
    };

    fetchDesignations();
  }, [hiringDept, departments]);

  // Auto-fill requisitioner email
  useEffect(() => {
    if (requisitionerName) {
      const emp = employees.find(e => e.full_name === requisitionerName);
      setValue('requisitioner_email', emp?.official_email || '');
      console.log('[AUTO] Requisitioner email set to:', emp?.official_email);
    }
  }, [requisitionerName, employees, setValue]);

  // Auto-fill department emails
  useEffect(() => {
    if (hiringDept) {
      const dept = departments.find(d => d.name === hiringDept);
      if (dept) {
        setValue('hiring_dept_email', dept.dept_head_email || '');
        setValue('dept_group_email', dept.dept_group_email || '');
        console.log('[AUTO] Dept head email:', dept.dept_head_email);
        console.log('[AUTO] Dept group email:', dept.dept_group_email);
      }
    }
  }, [hiringDept, departments, setValue]);

  // Auto-fill today's date
  useEffect(() => {
    const today = format(new Date(), 'dd-MM-yyyy');
    setValue('request_date', today);
  }, [setValue]);

  // Auto-fill role & JD links
  useEffect(() => {
    if (designationType === 'existing' && designationExisting) {
      const des = designations.find(d => d.name === designationExisting);
      if (des) {
        setValue('role_link', des.role_document_link || '');
        setValue('jd_link', des.jd_link || '');
      }
    } else {
      setValue('role_link', '');
      setValue('jd_link', '');
    }
  }, [designationType, designationExisting, designations, setValue]);

  // Auto-calculate plan dates
  useEffect(() => {
    if (!selectJoiningDays) return;

    const daysMatch = selectJoiningDays.match(/\d+/);
    if (!daysMatch) return;

    const totalDays = parseInt(daysMatch[0], 10);
    const today = new Date();

    setValue('plan_start_sharing_cvs', format(addDays(today, 3), 'dd-MM-yyyy'));
    setValue('planned_interviews_started', format(addDays(today, 8), 'dd-MM-yyyy'));
    setValue('planned_offer_accepted', format(addDays(today, totalDays - 15), 'dd-MM-yyyy'));
    setValue('planned_joined', format(addDays(today, totalDays), 'dd-MM-yyyy'));
  }, [selectJoiningDays, setValue]);

  const onSubmit = async (data: FormData) => {
    console.log('[SUBMIT] Form submit triggered');
    console.log('[SUBMIT] Raw form data:', data);

    setSubmitLoading(true);
    setSuccess(null);
    setError(null);

    try {
      // Convert dates to YYYY-MM-DD (ISO format expected by Django)
      const convertDate = (dateStr: string | undefined) => {
        if (!dateStr) return null;
        // Input is dd-MM-yyyy → parse and convert to YYYY-MM-DD
        const [day, month, year] = dateStr.split('-');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      const submitData = {
        ...data,  // Send ALL fields as-is
        designation_status: data.designation_type,  // Rename to match backend
        designation: data.designation_type === 'existing' ? data.designation_existing : data.designation_new,
        // Convert dates
        request_date: convertDate(data.request_date),
        plan_start_sharing_cvs: convertDate(data.plan_start_sharing_cvs),
        planned_interviews_started: convertDate(data.planned_interviews_started),
        planned_offer_accepted: convertDate(data.planned_offer_accepted),
        planned_joined: convertDate(data.planned_joined),
        // Ensure optional fields are null instead of empty string if backend prefers
        dept_group_email: data.dept_group_email || null,
        role_link: data.role_link || null,
        jd_link: data.jd_link || null,
        special_instructions: data.special_instructions || null,
      };

      console.log('[SUBMIT] Final payload being sent:', submitData);

      const response = await fetch('https://hr-forms.onrender.com/api/hiring-requisitions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      console.log('[SUBMIT] Response status:', response.status);

      if (!response.ok) {
        const errData = await response.json();
        console.error('[SUBMIT ERROR] Backend returned:', errData);
        throw new Error(JSON.stringify(errData));
      }

      const result = await response.json();
      console.log('[SUBMIT SUCCESS] Backend response:', result);

      setSuccess('Thank you! Your requisition has been submitted successfully. Redirecting to dashboard...');

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
    } catch (err: any) {
      console.error('[SUBMIT CRASH]', err);
      setError(err.message || 'Failed to submit. Check console for details.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Enter a New Hiring Requisition
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Any Department wanting to hire a new Employee fills this form, as follows:
      </Typography>

      <ol className="list-decimal pl-6 mb-6 text-gray-700">
        <li>Fill a separate form per person needed.</li>
        <li>Be practical with joining timeline.</li>
        <li>Auto-email will be sent on submit.</li>
      </ol>

      <Divider sx={{ my: 4 }} />

      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Requester Details */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Requester Details (auto-filled, view only)
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <InputLabel shrink htmlFor="serial-no">Hiring Serial No (auto-filled)</InputLabel>
              <TextField id="serial-no" name="serial-no" fullWidth value="Auto-generated" disabled variant="standard" />
            </Box>

            <Box sx={{ flex: 1, minWidth: 280 }}>
              <InputLabel shrink htmlFor="request-date">Request Date (auto-filled)</InputLabel>
              <TextField id="request-date" name="request-date" fullWidth value={watch('request_date') || ''} disabled variant="standard" />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink htmlFor="requisitioner-name">Requisition raised by</InputLabel>
            <FormControl fullWidth error={!!errors.requisitioner_name}>
              <Controller
                name="requisitioner_name"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="requisitioner-name"
                    name="requisitioner_name"
                    value={field.value || ''}
                    displayEmpty
                  >
                    <MenuItem value="" disabled>Requisition raised by</MenuItem>
                    {employees.map(emp => (
                      <MenuItem key={emp.id} value={emp.full_name}>{emp.full_name}</MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.requisitioner_name && <FormHelperText>{errors.requisitioner_name.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink htmlFor="requisitioner-email">Requisitioner's Email</InputLabel>
            <TextField id="requisitioner-email" name="requisitioner_email" fullWidth value={watch('requisitioner_email') || ''} disabled variant="standard" />
          </Box>
        </Box>

        {/* Position to Hire */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Position to Hire
          </Typography>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink htmlFor="hiring-dept">Hiring Dept</InputLabel>
            <FormControl fullWidth error={!!errors.hiring_dept}>
              <Controller
                name="hiring_dept"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="hiring-dept"
                    name="hiring_dept"
                    value={field.value || ''}
                    displayEmpty
                  >
                    <MenuItem value="" disabled>Hiring Dept</MenuItem>
                    {departments.map(dept => (
                      <MenuItem key={dept.id} value={dept.name}>{dept.name}</MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.hiring_dept && <FormHelperText>{errors.hiring_dept.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 2 }}>
            <InputLabel shrink htmlFor="hiring-dept-email">Dept Head Email (autofilled)</InputLabel>
            <TextField id="hiring-dept-email" name="hiring_dept_email" fullWidth value={watch('hiring_dept_email') || ''} disabled variant="standard" />
          </Box>

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink htmlFor="dept-group-email">Dept Group Email (autofilled)</InputLabel>
            <TextField id="dept-group-email" name="dept_group_email" fullWidth value={watch('dept_group_email') || ''} disabled variant="standard" />
          </Box>

          {/* Designation Section */}
          {hiringDept && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Designation
              </Typography>

              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend">Is this an existing designation or a new one?</FormLabel>
                <Controller
                  name="designation_type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup row {...field}>
                      <FormControlLabel value="existing" control={<Radio />} label="Existing" />
                      <FormControlLabel value="new" control={<Radio />} label="New" />
                    </RadioGroup>
                  )}
                />
                {errors.designation_type && <FormHelperText error>{errors.designation_type.message}</FormHelperText>}
              </FormControl>

              {designationType === 'existing' && (
                <FormControl fullWidth error={!!errors.designation_existing} sx={{ mb: 2 }}>
                  <InputLabel id="designation-existing-label">Select Existing Designation</InputLabel>
                  <Controller
                    name="designation_existing"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        labelId="designation-existing-label"
                        value={field.value || ''}
                      >
                        <MenuItem value="" disabled>Select Designation</MenuItem>
                        {designations.map(des => (
                          <MenuItem key={des.id} value={des.name}>
                            {des.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.designation_existing && <FormHelperText>{errors.designation_existing.message}</FormHelperText>}
                </FormControl>
              )}

              {designationType === 'new' && (
                <FormControl fullWidth error={!!errors.designation_new} sx={{ mb: 2 }}>
                  <InputLabel htmlFor="designation-new"></InputLabel>
                  <Controller
                    name="designation_new"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        id="designation-new"
                        value={field.value || ''}
                        placeholder="Enter new designation"
                      />
                    )}
                  />
                  {errors.designation_new && <FormHelperText>{errors.designation_new.message}</FormHelperText>}
                </FormControl>
              )}

              {designationType === 'existing' && designationExisting && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Link to Role (autofilled)"
                    value={watch('role_link') || ''}
                    disabled
                    variant="standard"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Link to JD (autofilled)"
                    value={watch('jd_link') || ''}
                    disabled
                    variant="standard"
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>


        {/* Days to Fulfil Requirement */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Days to fulfil the requirement (from today)?
          </Typography>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Select joining days</InputLabel>
            <FormControl fullWidth error={!!errors.select_joining_days}>
              <Controller
                name="select_joining_days"
                control={control}
                render={({ field }) => (
                  <Select {...field} value={field.value || ''} displayEmpty>
                    <MenuItem value="" disabled>Days within which the candidate must join</MenuItem>
                    <MenuItem value="20 days">20 days = joining at 0 days notice</MenuItem>
                    <MenuItem value="35 days">35 days = joining at 15-days notice</MenuItem>
                    <MenuItem value="50 days">50 days = joining at 30-days notice</MenuItem>
                    <MenuItem value="80 days">80 days = joining at 60-days notice</MenuItem>
                  </Select>
                )}
              />
              {errors.select_joining_days && <FormHelperText>{errors.select_joining_days.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ pl: 2, color: 'green', fontSize: '0.95rem' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Days within which the candidate must join:</Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              20 days = joining at 0 days notice = 8 days(shortlist), 8(interview), 4(accept offer), 0(notice to old employer)
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              35 days = joining at 15-days notice = 8,8,15
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              50 days = joining at 30-days notice = 8,8,4,30
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              80 days = joining at 60-days notice = 8,8,4,60
            </Typography>
          </Box>
        </Box>

        {/* Hiring Plan (Auto-Calculated) */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Hiring Plan (Auto-Calculated)
          </Typography>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Start Sharing Shortlisted CVs (within max 72 hours)</InputLabel>
            <TextField fullWidth value={watch('plan_start_sharing_cvs') || ''} disabled variant="standard" />
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Start Interviews (Latest by 8th Day)</InputLabel>
            <TextField fullWidth value={watch('planned_interviews_started') || ''} disabled variant="standard" />
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Get offer accepted by</InputLabel>
            <TextField fullWidth value={watch('planned_offer_accepted') || ''} disabled variant="standard" />
          </Box>

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink>Get joining done by</InputLabel>
            <TextField fullWidth value={watch('planned_joined') || ''} disabled variant="standard" />
          </Box>
        </Box>

        {/* Special Instructions + Hiring Status */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Enter Special Instructions to the HR Dept
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Clearly mention for which role you need the new employee; plus any other special requirements that you have.
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
            <Box sx={{ flex: '2 1 60%', minWidth: 300 }}>
              <InputLabel shrink>Enter Special Instructions to the HR Dept</InputLabel>
              <TextField
                fullWidth
                multiline
                rows={3}
                {...register('special_instructions')}
                variant="standard"
                sx={{ borderBottom: '1px solid #000' }}
              />
            </Box>

            <Box sx={{ flex: '1 1 35%', minWidth: 250 }}>
              <InputLabel shrink>Hiring Status</InputLabel>
              <FormControl fullWidth error={!!errors.hiring_status}>
                <Controller
                  name="hiring_status"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} displayEmpty value={field.value || ''}>
                      <MenuItem value="" disabled>Select hiring status</MenuItem>
                      <MenuItem value="No Change in Status">No Change in Status</MenuItem>
                      <MenuItem value="New">New</MenuItem>
                      <MenuItem value="CVs Shortlisting Started">CVs Shortlisting Started</MenuItem>
                      <MenuItem value="Interviews Started">Interviews Started</MenuItem>
                      <MenuItem value="Offer Letter Sent">Offer Letter Sent</MenuItem>
                      <MenuItem value="Offer Letter Accepted">Offer Letter Accepted</MenuItem>
                      <MenuItem value="Offer Not Accepted, interviews restarted">Offer Not Accepted, interviews restarted</MenuItem>
                      <MenuItem value="Offer Not Accepted, next Offer Sent">Offer Not Accepted, next Offer Sent</MenuItem>
                      <MenuItem value="Joined">Joined</MenuItem>
                      <MenuItem value="Not Joined, interviews restarted">Not Joined, interviews restarted</MenuItem>
                      <MenuItem value="Not Joined, next Offer Sent">Not Joined, next Offer Sent</MenuItem>
                      <MenuItem value="Hiring Stopped">Hiring Stopped</MenuItem>
                    </Select>
                  )}
                />
                {errors.hiring_status && <FormHelperText>{errors.hiring_status.message}</FormHelperText>}
              </FormControl>
            </Box>
          </Box>
        </Box>

        {/* Email Details */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Email Details
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Select all whom you would like to keep in Cc:
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Note: The following are automatically included in Cc, so you do not need to add them again:
          </Typography>

          <ul className="list-disc pl-6 mb-2 text-gray-700">
            <li>MD & CEO</li>
            <li>Head Ops Dept & Deputy Ops Dept</li>
            <li>HR, Admin, Accts Dept, and DME</li>
          </ul>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Persons to Keep in Cc (MD, CEO, COO, HR, ACCTS & DME are already in Cc)</InputLabel>
            <FormControl fullWidth>
              <Controller
                name="employees_in_cc"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    multiple
                    displayEmpty
                    value={field.value || []}
                    renderValue={(selected: string[]) =>
                      selected.length === 0 ? (
                        <em>Select people</em>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map(email => {
                            const emp = employees.find(e => e.official_email === email);
                            return (
                              <Chip
                                key={email}
                                label={emp?.full_name || email}
                                size="small"
                              />
                            );
                          })}
                        </Box>
                      )
                    }
                  >
                    {employees.map(emp => (
                      <MenuItem key={emp.id} value={emp.official_email}>
                        <Checkbox checked={field.value?.includes(emp.official_email)} />
                        <Typography>{emp.full_name}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Box>
        </Box>

        {/* CHECKLIST FOR DEPT RAISING THE HIRING REQUISITION */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            CHECKLIST FOR DEPT RAISING THE HIRING REQUISITION
          </Typography>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Do the Role & JD Documents exist?</InputLabel>
            <FormControl fullWidth error={!!errors.role_n_jd_exist}>
              <Controller
                name="role_n_jd_exist"
                control={control}
                render={({ field }) => (
                  <Select {...field} displayEmpty value={field.value || ''}>
                    <MenuItem value="" disabled>Select</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                )}
              />
              {errors.role_n_jd_exist && <FormHelperText>{errors.role_n_jd_exist.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Have you read the Role & JD?</InputLabel>
            <FormControl fullWidth error={!!errors.role_n_jd_read}>
              <Controller
                name="role_n_jd_read"
                control={control}
                render={({ field }) => (
                  <Select {...field} displayEmpty value={field.value || ''}>
                    <MenuItem value="" disabled>Select</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                )}
              />
              {errors.role_n_jd_read && <FormHelperText>{errors.role_n_jd_read.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Are the Role & JD suitable & well made?</InputLabel>
            <FormControl fullWidth error={!!errors.role_n_jd_good}>
              <Controller
                name="role_n_jd_good"
                control={control}
                render={({ field }) => (
                  <Select {...field} displayEmpty value={field.value || ''}>
                    <MenuItem value="" disabled>Select</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                )}
              />
              {errors.role_n_jd_good && <FormHelperText>{errors.role_n_jd_good.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink>Are the days to fulfil the requirement practical and realistic?</InputLabel>
            <FormControl fullWidth error={!!errors.days_well_thought}>
              <Controller
                name="days_well_thought"
                control={control}
                render={({ field }) => (
                  <Select {...field} displayEmpty value={field.value || ''}>
                    <MenuItem value="" disabled>Select</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                )}
              />
              {errors.days_well_thought && <FormHelperText>{errors.days_well_thought.message}</FormHelperText>}
            </FormControl>
          </Box>
        </Box>


        {/* HR CHECKLIST (INFO ONLY) */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            CHECKLIST FOR HR DEPT (ONLY FOR INFO OF HIRING DEPT)
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Shortlist CVs Checklist
            </Typography>
            <FormGroup>
              <FormControlLabel control={<Checkbox disabled checked />} label="Role And JD Checked Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Asked for Reference Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Checked Internal References Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Checked Internal Candidates Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Thanked All Applicants Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Emailed Shortlisted Candidates Done?" />
            </FormGroup>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Interviews Checklist
            </Typography>
            <FormGroup>
              <FormControlLabel control={<Checkbox disabled checked />} label="All Interviews Logged Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Asked Interviewers To Use Role Doc Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Asked Interviewers To Use Tests Done?" />
              <FormControlLabel control={<Checkbox disabled checked />} label="Asked Interviewers Hire Only Best Done?" />
            </FormGroup>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Offer Letter Checklist
            </Typography>
            <FormGroup>
              <FormControlLabel control={<Checkbox disabled checked />} label="Asked Confirmation In 2 Days Done?" />
            </FormGroup>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              General Feedback
            </Typography>
            <FormGroup>
              <FormControlLabel control={<Checkbox disabled checked />} label="Kept All Needed In Cc Done?" />
            </FormGroup>
          </Box>
        </Box>


        {/* Submit Button */}
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            {submitLoading ? 'Submitting...' : 'Submit Requisition'}
          </Button>
        </Box>
      </form>

      {/* Full-page loader overlay */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={submitLoading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
}