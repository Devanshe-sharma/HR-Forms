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
} from '@mui/material';
import { format, addDays } from 'date-fns';

// ────────────────────────────────────────────────────────────────
// Zod Schema (complete)
// ────────────────────────────────────────────────────────────────
const schema = z.object({
  requisitioner_name: z.string().min(1, 'Requisitioner is required'),
  requisitioner_email: z.string().email('Invalid email').optional(),
  hiring_dept: z.string().min(1, 'Hiring Department is required'),
  hiring_dept_email: z.string().email('Invalid email').optional(),
  designation: z.string().min(1, 'Designation is required'),
  request_date: z.string().optional(),
  select_joining_days: z.string().min(1, 'Please select joining days'),
  plan_start_sharing_cvs: z.string().optional(),
  planned_interviews_started: z.string().optional(),
  planned_offer_accepted: z.string().optional(),
  planned_joined: z.string().optional(),
  special_instructions: z.string().optional(),
  hiring_status: z.string().min(1, 'Hiring status is required'),
  employees_in_cc: z.array(z.string()).optional(),
  role_n_jd_exist: z.enum(['Yes', 'No']).refine(val => val !== undefined, { message: 'Required' }),
  role_n_jd_read: z.enum(['Yes', 'No']).refine(val => val !== undefined, { message: 'Required' }),
  role_n_jd_good: z.enum(['Yes', 'No']).refine(val => val !== undefined, { message: 'Required' }),
  days_well_thought: z.enum(['Yes', 'No']).refine(val => val !== undefined, { message: 'Required' }),
});

type FormData = z.infer<typeof schema>;

// Types for API data
type Employee = { id: number; full_name: string; official_email: string };
type Department = { id: number; name: string; dept_head_email?: string };

export default function NewRequisitionForm() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
      designation: '',
      select_joining_days: '',
      employees_in_cc: [],
      role_n_jd_exist: 'Yes',
      role_n_jd_read: 'Yes',
      role_n_jd_good: 'Yes',
      days_well_thought: 'Yes',
    },
  });

  const requisitionerName = watch('requisitioner_name');
  const hiringDept = watch('hiring_dept');
  const selectJoiningDays = watch('select_joining_days');

  // Fetch employees and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch('https://hr-forms.onrender.com/api/employees'),
          fetch('https://hr-forms.onrender.com/api/departments'),
        ]);

        const empData = await empRes.json();
        const deptData = await deptRes.json();

        setEmployees(empData);
        setDepartments(deptData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data from server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-fill requisitioner email
  useEffect(() => {
    if (requisitionerName) {
      const emp = employees.find(e => e.full_name === requisitionerName);
      setValue('requisitioner_email', emp?.official_email || '');
    }
  }, [requisitionerName, employees, setValue]);

  // Auto-fill department email
  useEffect(() => {
    if (hiringDept) {
      const dept = departments.find(d => d.name === hiringDept);
      setValue('hiring_dept_email', dept?.dept_head_email || '');
    }
  }, [hiringDept, departments, setValue]);

  // Auto-fill today's date
  useEffect(() => {
    setValue('request_date', format(new Date(), 'dd-MM-yyyy'));
  }, [setValue]);

  // Auto-calculate Hiring Plan dates
  useEffect(() => {
    if (!selectJoiningDays) return;

    const daysMatch = selectJoiningDays.match(/\d+/);
    if (!daysMatch) return;

    const totalDays = parseInt(daysMatch[0], 10);
    const today = new Date();

    const startSharing = addDays(today, 3);
    const startInterviews = addDays(today, 8);
    const offerAccepted = addDays(today, totalDays - 15);
    const joiningDate = addDays(today, totalDays);

    setValue('plan_start_sharing_cvs', format(startSharing, 'dd-MM-yyyy'));
    setValue('planned_interviews_started', format(startInterviews, 'dd-MM-yyyy'));
    setValue('planned_offer_accepted', format(offerAccepted, 'dd-MM-yyyy'));
    setValue('planned_joined', format(joiningDate, 'dd-MM-yyyy'));
  }, [selectJoiningDays, setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitLoading(true);
    setSuccess(null);
    setError(null);

    try {
      console.log('Submitting new hiring:', data);
      // Replace with real API call
      // await fetch('https://hr-forms.onrender.com/api/hiring-requisitions', { ... });

      setSuccess('Hiring requisition submitted successfully! HR has been notified.');
    } catch (err) {
      setError('Failed to submit. Please try again.');
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
      {/* Heading + Instructions */}
      <Typography variant="h4" gutterBottom>
        Enter a New Hiring Requisition
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Any Department wanting to hire a new Employee fills this form, as follows:
      </Typography>

      <ol className="list-decimal pl-6 mb-6 text-gray-700">
        <li>Fill a separate form per person needed (for example, if 2 employees are needed to be hired, then fill this form twice).</li>
        <li>Be practical while selecting the period within which you want the new employee to join. Recruitment takes time, especially when hiring experienced employees.</li>
        <li>On submitting this form, an auto-email will be sent to all concerned including to you.</li>
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
              <InputLabel shrink>Hiring Serial No (auto-filled)</InputLabel>
              <TextField fullWidth value="Auto-generated" disabled variant="standard" />
            </Box>

            <Box sx={{ flex: 1, minWidth: 280 }}>
              <InputLabel shrink>Request Date (auto-filled)</InputLabel>
              <TextField fullWidth value={watch('request_date') || ''} disabled variant="standard" />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Requisition raised by</InputLabel>
            <FormControl fullWidth error={!!errors.requisitioner_name}>
              <Controller
                name="requisitioner_name"
                control={control}
                render={({ field }) => (
                  <Select {...field} displayEmpty>
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
            <InputLabel shrink>Requisitioner's Email</InputLabel>
            <TextField fullWidth value={watch('requisitioner_email') || ''} disabled variant="standard" />
          </Box>
        </Box>

        {/* Position to Hire */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Position to Hire
          </Typography>

          <Box sx={{ mb: 3 }}>
            <InputLabel shrink>Hiring Dept</InputLabel>
            <FormControl fullWidth error={!!errors.hiring_dept}>
              <Controller
                name="hiring_dept"
                control={control}
                render={({ field }) => (
                  <Select {...field} displayEmpty>
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

          <Box sx={{ mb: 4 }}>
            <InputLabel shrink>Hiring Dept Email (autofilled)</InputLabel>
            <TextField fullWidth value={watch('hiring_dept_email') || ''} disabled variant="standard" />
          </Box>
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
                  <Select {...field} displayEmpty>
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
                    <Select {...field} displayEmpty>
                      <MenuItem value="" disabled>Select hiring status</MenuItem>
                      <MenuItem value="Urgent">Urgent</MenuItem>
                      <MenuItem value="Regular">Regular</MenuItem>
                      <MenuItem value="Future Planning">Future Planning</MenuItem>
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
                    renderValue={(selected: string[]) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map(value => <Chip key={value} label={value} size="small" />)}
                      </Box>
                    )}
                  >
                    {employees.map(emp => (
                      <MenuItem key={emp.id} value={emp.full_name}>
                        {emp.full_name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Box>
        </Box>

        {/* CHECKLIST FOR HR WHILE HIRING (FOR INFO) */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            CHECKLIST FOR HR DEPT (ONLY FOR INFO OF HIRING DEPT)
          </Typography>

          {/* Shortlist CVs Checklist */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Shortlist CVs Checklist
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Role And JD Checked Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Asked for Reference Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Checked Internal References Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Checked Internal Candidates Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Thanked All Applicants Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Emailed Shortlisted Candidates Done?"
              />
            </FormGroup>
          </Box>

          {/* Interviews Checklist */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Interviews Checklist
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="All Interviews Logged Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Asked Interviewers To Use Role Doc Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Asked Interviewers To Use Tests Done?"
              />
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Asked Interviewers Hire Only Best Done?"
              />
            </FormGroup>
          </Box>

          {/* Offer Letter Checklist */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Offer Letter Checklist
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Asked Confirmation In 2 Days Done?"
              />
            </FormGroup>
          </Box>

          {/* General Feedback */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              General Feedback
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox disabled checked />}
                label="Kept All Needed In Cc Done?"
              />
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
    </Box>
  );
}


// function register(arg0: string): import("react/jsx-runtime").JSX.IntrinsicAttributes & { variant?: import("@mui/material").TextFieldVariants | undefined; } & Omit<import("@mui/material").OutlinedTextFieldProps | import("@mui/material").FilledTextFieldProps | import("@mui/material").StandardTextFieldProps, "variant"> {
//   throw new Error('Function not implemented.');
// }
