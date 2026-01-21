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
  designation_type: z.enum(['existing', 'new']).refine(val => val === 'existing' || val === 'new',{ message: 'Please select existing or new designation' }),
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
type Department = { id: number; name: string; dept_head_email?: string };
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
    },
  });

  const requisitionerName = watch('requisitioner_name');
  const hiringDept = watch('hiring_dept');
  const designationType = watch('designation_type');
  const designationExisting = watch('designation_existing');
  const selectJoiningDays = watch('select_joining_days');

  // Fetch employees and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch('https://hr-forms.onrender.com/api/employees/'),
          fetch('https://hr-forms.onrender.com/api/departments/'),
        ]);

        if (!empRes.ok || !deptRes.ok) throw new Error('Failed to fetch');

        setEmployees(await empRes.json());
        setDepartments(await deptRes.json());
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data from server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch designations when department is selected
  useEffect(() => {
    if (!hiringDept) {
      setDesignations([]);
      setValue('designation_existing', '');
      setValue('role_link', '');
      setValue('jd_link', '');
      return;
    }

    const fetchDesignations = async () => {
      try {
        const dept = departments.find(d => d.name === hiringDept);
        if (!dept?.id) return;

        const res = await fetch(`https://hr-forms.onrender.com/api/designations/?department=${dept.id}`);
        if (!res.ok) throw new Error('Failed to fetch designations');

        const data = await res.json();
        setDesignations(data);
      } catch (err) {
        console.error('Failed to fetch designations:', err);
        setError('Failed to load designations');
      }
    };

    fetchDesignations();
  }, [hiringDept, departments, setValue]);

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

  // Auto-fill role & JD links when existing designation is selected
  useEffect(() => {
    if (designationType === 'existing' && designationExisting) {
      const des = designations.find(d => d.name === designationExisting);
      setValue('role_link', des?.role_document_link || '');
      setValue('jd_link', des?.jd_link || '');
    } else {
      setValue('role_link', '');
      setValue('jd_link', '');
    }
  }, [designationType, designationExisting, designations, setValue]);

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
      // Prepare data - use correct designation field
      const submitData = {
        ...data,
        designation: data.designation_type === 'existing' ? data.designation_existing : data.designation_new,
      };

      const response = await fetch('https://hr-forms.onrender.com/api/hiring-requisitions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `Server error: ${response.status}`);
      }

      setSuccess('Thank you! Your requisition has been submitted successfully. Redirecting to dashboard...');

      // Redirect after 3 seconds
      setTimeout(() => {
        window.location.href = '/dashboard'; // ← Change this to your actual dashboard route
      }, 3000);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to submit. Please try again.');
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
                  <Select {...field} value={field.value || ''} displayEmpty>
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
                  <Select {...field} value={field.value || ''} displayEmpty>
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

          {/* Designation Section - only show after dept selected */}
          {hiringDept && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Designation
              </Typography>

              {/* Existing or New */}
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

              {/* Existing Designation Dropdown */}
              {designationType === 'existing' && (
                <FormControl fullWidth error={!!errors.designation_existing} sx={{ mb: 2 }}>
                  <InputLabel>Select Existing Designation</InputLabel>
                  <Controller
                    name="designation_existing"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} value={field.value || ''}>
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

              {/* New Designation Text Field */}
              {designationType === 'new' && (
                <FormControl fullWidth error={!!errors.designation_new} sx={{ mb: 2 }}>
                  <InputLabel>New Designation Name</InputLabel>
                  <Controller
                    name="designation_new"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} value={field.value || ''} placeholder="Enter new designation" />
                    )}
                  />
                  {errors.designation_new && <FormHelperText>{errors.designation_new.message}</FormHelperText>}
                </FormControl>
              )}

              {/* Autofilled Links (only for existing) */}
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
    </Box>
  );
}