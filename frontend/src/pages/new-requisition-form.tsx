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
  designation_type: z.enum(['existing', 'new']),
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

const API_BASE = 'http://localhost:5000/api'; // change to production later

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

  // Fetch employees, departments
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch(`${API_BASE}/employees/`),
          fetch(`${API_BASE}/departments/`),
        ]);

        if (!empRes.ok || !deptRes.ok) {
          throw new Error('Failed to fetch initial data');
        }

        const empData = await empRes.json();
        const deptData = await deptRes.json();

        // Handle possible wrapped response { data: [...] }
        const employeesList = Array.isArray(empData) ? empData : (empData.data || []);
        const departmentsList = Array.isArray(deptData) ? deptData : (deptData.data || []);

        setEmployees(employeesList);
        setDepartments(departmentsList);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load employees/departments');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch designations when department changes
  useEffect(() => {
    if (!hiringDept) return;

    const dept = departments.find(d => d.name === hiringDept);
    if (!dept?.id) return;

    const fetchDesignations = async () => {
      try {
        const res = await fetch(`${API_BASE}/designations/?department=${dept.id}`);
        if (!res.ok) throw new Error('Failed to fetch designations');

        const data = await res.json();
        const desList = Array.isArray(data) ? data : (data.data || []);
        setDesignations(desList);
      } catch (err) {
        console.error('Designations fetch error:', err);
      }
    };

    fetchDesignations();
  }, [hiringDept, departments]);

  // Auto-fill requisitioner email
  useEffect(() => {
    if (requisitionerName) {
      const emp = employees.find(e => e.full_name === requisitionerName);
      if (emp?.official_email) {
        setValue('requisitioner_email', emp.official_email);
      }
    }
  }, [requisitionerName, employees, setValue]);

  // Auto-fill department emails
  useEffect(() => {
    if (hiringDept) {
      const dept = departments.find(d => d.name === hiringDept);
      if (dept) {
        setValue('hiring_dept_email', dept.dept_head_email || '');
        setValue('dept_group_email', dept.dept_group_email || '');
      }
    }
  }, [hiringDept, departments, setValue]);

  // Auto-fill today's date
  useEffect(() => {
    const today = format(new Date(), 'dd-MM-yyyy');
    setValue('request_date', today);
  }, [setValue]);

  // Auto-fill role & JD links when existing designation selected
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

  // Auto-calculate planned dates based on joining days
  useEffect(() => {
    if (!selectJoiningDays) return;

    const daysMatch = selectJoiningDays.match(/\d+/);
    if (!daysMatch) return;

    const totalDays = parseInt(daysMatch[0], 10);
    const todayDate = new Date();

    setValue('plan_start_sharing_cvs', format(addDays(todayDate, 3), 'dd-MM-yyyy'));
    setValue('planned_interviews_started', format(addDays(todayDate, 8), 'dd-MM-yyyy'));
    setValue('planned_offer_accepted', format(addDays(todayDate, totalDays - 15), 'dd-MM-yyyy'));
    setValue('planned_joined', format(addDays(todayDate, totalDays), 'dd-MM-yyyy'));
  }, [selectJoiningDays, setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitLoading(true);
    setSuccess(null);
    setError(null);

    try {
      // Convert dd-MM-yyyy to YYYY-MM-DD for backend
      const convertDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('-');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      const submitData = {
        ...data,
        designation_status: data.designation_type,
        designation: data.designation_type === 'existing' ? data.designation_existing : data.designation_new,
        request_date: convertDate(data.request_date),
        plan_start_sharing_cvs: convertDate(data.plan_start_sharing_cvs),
        planned_interviews_started: convertDate(data.planned_interviews_started),
        planned_offer_accepted: convertDate(data.planned_offer_accepted),
        planned_joined: convertDate(data.planned_joined),
        dept_group_email: data.dept_group_email || null,
        role_link: data.role_link || null,
        jd_link: data.jd_link || null,
        special_instructions: data.special_instructions || null,
      };

      const response = await fetch(`${API_BASE}/hiringrequisitions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Submission failed');
      }

      setSuccess('Requisition submitted successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = '/dashboard'; // or your dashboard route
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit requisition');
      console.error(err);
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
        Fill a separate form per person needed. Be practical with timelines.
      </Typography>

      <Divider sx={{ my: 4 }} />

      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Requester Details */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Requester Details
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <InputLabel shrink>Request Date (auto-filled)</InputLabel>
              <TextField fullWidth value={watch('request_date') || ''} disabled variant="outlined" size="small" />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Requisition raised by *</InputLabel>
            <FormControl fullWidth error={!!errors.requisitioner_name}>
              <Controller
                name="requisitioner_name"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    value={field.value || ''}
                    displayEmpty
                  >
                    <MenuItem value="" disabled>Select Requisitioner</MenuItem>
                    {employees.map(emp => (
                      <MenuItem key={emp.id} value={emp.full_name}>
                        {emp.full_name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.requisitioner_name && <FormHelperText>{errors.requisitioner_name.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink>Requisitioner's Email (auto-filled)</InputLabel>
            <TextField fullWidth value={watch('requisitioner_email') || ''} disabled variant="outlined" size="small" />
          </Box>
        </Box>

        {/* Position to Hire */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Position to Hire
          </Typography>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Hiring Dept *</InputLabel>
            <FormControl fullWidth error={!!errors.hiring_dept}>
              <Controller
                name="hiring_dept"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    value={field.value || ''}
                    displayEmpty
                  >
                    <MenuItem value="" disabled>Select Department</MenuItem>
                    {departments.map(dept => (
                      <MenuItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.hiring_dept && <FormHelperText>{errors.hiring_dept.message}</FormHelperText>}
            </FormControl>
          </Box>

          <Box sx={{ mb: 2 }}>
            <InputLabel shrink>Dept Head Email (auto-filled)</InputLabel>
            <TextField fullWidth value={watch('hiring_dept_email') || ''} disabled variant="outlined" size="small" />
          </Box>

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink>Dept Group Email (auto-filled)</InputLabel>
            <TextField fullWidth value={watch('dept_group_email') || ''} disabled variant="outlined" size="small" />
          </Box>

          {/* Designation */}
          {hiringDept && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
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
                      <FormControlLabel value="new" control={<Radio />} label="New" />
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
                      <Select {...field} value={field.value || ''}>
                        <MenuItem value="" disabled>Select</MenuItem>
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
                  <TextField
                    label="New Designation Name"
                    {...register('designation_new')}
                    error={!!errors.designation_new}
                    helperText={errors.designation_new?.message}
                  />
                </FormControl>
              )}

              {designationType === 'existing' && designationExisting && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Link to Role (auto-filled)"
                    value={watch('role_link') || ''}
                    disabled
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Link to JD (auto-filled)"
                    value={watch('jd_link') || ''}
                    disabled
                    variant="outlined"
                    size="small"
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Joining Timeline */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Days to Fulfil Requirement (from today)
          </Typography>

          <FormControl fullWidth error={!!errors.select_joining_days} sx={{ mb: 3 }}>
            <InputLabel>Select joining days</InputLabel>
            <Controller
              name="select_joining_days"
              control={control}
              render={({ field }) => (
                <Select {...field} value={field.value || ''}>
                  <MenuItem value="" disabled>Select</MenuItem>
                  <MenuItem value="20 days">20 days = joining at 0 days notice</MenuItem>
                  <MenuItem value="35 days">35 days = joining at 15-days notice</MenuItem>
                  <MenuItem value="50 days">50 days = joining at 30-days notice</MenuItem>
                  <MenuItem value="80 days">80 days = joining at 60-days notice</MenuItem>
                </Select>
              )}
            />
            {errors.select_joining_days && <FormHelperText>{errors.select_joining_days.message}</FormHelperText>}
          </FormControl>

          <Box sx={{ color: 'green', fontSize: '0.95rem', pl: 2 }}>
            <Typography variant="body2">Planned timeline:</Typography>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>Start sharing CVs: {watch('plan_start_sharing_cvs') || '—'}</li>
              <li>Interviews start: {watch('planned_interviews_started') || '—'}</li>
              <li>Offer accepted by: {watch('planned_offer_accepted') || '—'}</li>
              <li>Joining by: {watch('planned_joined') || '—'}</li>
            </ul>
          </Box>
        </Box>

        {/* Special Instructions & Status */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Special Instructions to HR
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            {...register('special_instructions')}
            variant="outlined"
            placeholder="Any special requirements or notes..."
            sx={{ mb: 3 }}
          />

          <FormControl fullWidth error={!!errors.hiring_status}>
            <InputLabel>Hiring Status *</InputLabel>
            <Controller
              name="hiring_status"
              control={control}
              render={({ field }) => (
                <Select {...field} value={field.value || ''}>
                  <MenuItem value="" disabled>Select status</MenuItem>
                  <MenuItem value="No Change in Status">No Change in Status</MenuItem>
                  <MenuItem value="New">New</MenuItem>
                  {/* ... add other options */}
                </Select>
              )}
            />
            {errors.hiring_status && <FormHelperText>{errors.hiring_status.message}</FormHelperText>}
          </FormControl>
        </Box>

        {/* CC Emails */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            People to Keep in CC
          </Typography>
          <FormControl fullWidth>
            <Controller
              name="employees_in_cc"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  multiple
                  value={field.value || []}
                  renderValue={(selected: string[]) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map(email => {
                        const emp = employees.find(e => e.official_email === email);
                        return <Chip key={email} label={emp?.full_name || email} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {employees.map(emp => (
                    <MenuItem key={emp.id} value={emp.official_email}>
                      <Checkbox checked={field.value?.includes(emp.official_email)} />
                      {emp.full_name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>
        </Box>

        {/* Checklist */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Checklist for Dept Raising Requisition
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Do Role & JD documents exist?</InputLabel>
            <Controller
              name="role_n_jd_exist"
              control={control}
              render={({ field }) => (
                <Select {...field} value={field.value || ''}>
                  <MenuItem value="Yes">Yes</MenuItem>
                  <MenuItem value="No">No</MenuItem>
                </Select>
              )}
            />
          </FormControl>

          {/* Add other checklist fields similarly */}
        </Box>

        {/* Submit */}
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

      <Backdrop open={submitLoading} sx={{ zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
}