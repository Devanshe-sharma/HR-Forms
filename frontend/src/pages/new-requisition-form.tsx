// 'use client';

// import { useState, useEffect } from 'react';
// import { useForm} from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import * as z from 'zod';
// import {
//   Box,
//   Typography,
//   TextField,
//   Select,
//   MenuItem,
//   FormControl,
//   InputLabel,
//   FormHelperText,
//   Button,
//   Grid,
//   CircularProgress,
//   Alert,
// } from '@mui/material';
// import { format} from 'date-fns';

// // Validation Schema
// const schema = z.object({
//   rrequest_date: z.string().optional(),
//   requisitioner_name: z.string().min(1, 'Requisitioner is required'),
//   requisitioner_email: z.string().optional(),
//   hiring_dept: z.string().min(1, 'Hiring Department is required'),
//   hiring_dept_email: z.string().optional(),
//   designation_status: z.enum(['Existing Designation', 'New Designation']),
//   hiring_designation: z.string().optional(),
//   new_designation: z.string().optional(),
//   select_joining_days: z.string().min(1, 'Joining days required'),
//   special_instructions: z.string().min(1, 'Special instructions required'),
//   hiring_status: z.string().min(1, 'Hiring status required'),
  
//   // ← Add these missing fields
//   request_date: z.string().optional(),           // auto-filled
//   plan_start_sharing_cvs: z.string().optional(), // auto-calculated
//   planned_interviews_started: z.string().optional(),
//   planned_offer_accepted: z.string().optional(),
//   planned_joined: z.string().optional(),
// });

// type FormData = z.infer<typeof schema>;

// // Types for API responses
// type Employee = { id: number; full_name: string; official_email: string };
// type Department = { id: number; name: string; dept_head_email?: string };

// export default function NewRequisitionForm() {
//   const [employees, setEmployees] = useState<Employee[]>([]);
//   const [departments, setDepartments] = useState<Department[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [submitLoading, setSubmitLoading] = useState(false);
//   const [success, setSuccess] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const {
//     register,
//     handleSubmit,
//     watch,
//     setValue,
//     formState: { errors },
//   } = useForm<FormData>({
//     resolver: zodResolver(schema),
//     defaultValues: {
//       designation_status: 'Existing Designation',
//     },
//   });

//   const requisitionerName = watch('requisitioner_name');
//   const hiringDept = watch('hiring_dept');

//   // Fetch employees (requisitioners)
//   useEffect(() => {
//     fetch('https://hr-forms.onrender.com/api/employees')
//       .then((res) => res.json())
//       .then((data: Employee[]) => {
//         setEmployees(data);
//         setLoading(false);
//       })
//       .catch((err) => {
//         console.error('Failed to fetch employees:', err);
//         setError('Failed to load employees');
//         setLoading(false);
//       });
//   }, []);

//   // Fetch departments
//   useEffect(() => {
//     fetch('https://hr-forms.onrender.com/api/departments')
//       .then((res) => res.json())
//       .then((data: Department[]) => {
//         setDepartments(data);
//       })
//       .catch((err) => console.error('Failed to fetch departments:', err));
//   }, []);

//   // Auto-fill requisitioner email
//   useEffect(() => {
//     if (requisitionerName) {
//       const selectedEmp = employees.find(
//         (emp) => emp.full_name === requisitionerName
//       );
//       if (selectedEmp) {
//         setValue('requisitioner_email', selectedEmp.official_email);
//       }
//     }
//   }, [requisitionerName, employees, setValue]);

//   // Auto-fill department email
//   useEffect(() => {
//     if (hiringDept) {
//       const selectedDept = departments.find(
//         (dept) => dept.name === hiringDept
//       );
//       if (selectedDept?.dept_head_email) {
//         setValue('hiring_dept_email', selectedDept.dept_head_email);
//       } else {
//         setValue('hiring_dept_email', '');
//       }
//     }
//   }, [hiringDept, departments, setValue]);

//   // Auto-fill today's date
//   useEffect(() => {
//     setValue('request_date', format(new Date(), 'dd-MM-yyyy'));
//   }, [setValue]);

//   const onSubmit = async (data: FormData) => {
//     setSubmitLoading(true);
//     setSuccess(null);
//     setError(null);

//     try {
//       console.log('Submitting:', data);
//       // Replace with your real API call
//       // const res = await fetch('https://hr-forms.onrender.com/api/hiring-requisitions', {
//       //   method: 'POST',
//       //   headers: { 'Content-Type': 'application/json' },
//       //   body: JSON.stringify(data),
//       // });
//       // if (!res.ok) throw new Error('Failed');

//       setSuccess('Hiring requisition submitted successfully! HR has been notified.');
//     } catch (err) {
//       setError('Failed to submit. Please try again.');
//     } finally {
//       setSubmitLoading(false);
//     }
//   };

//   if (loading) {
//     return (
//       <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   return (
//     <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto' }}>
//       <Typography variant="h4" gutterBottom color="primary">
//         Enter a New Hiring Requisition
//       </Typography>

//       {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
//       {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

//       <form onSubmit={handleSubmit(onSubmit)}>
//   <Grid container spacing={3}>
//     {/* Requester Details Section */}
//     <Grid item xs={12}>
//       <Typography variant="h6" gutterBottom>
//         Requester Details (auto-filled)
//       </Typography>
//     </Grid>

//     {/* Hiring Serial No */}
//     <Grid item xs={12} md={6}>
//       <TextField
//         fullWidth
//         label="Hiring Serial No"
//         disabled
//         value="Auto-generated"
//         variant="outlined"
//       />
//     </Grid>

//     {/* Request Date */}
//     <Grid item xs={12} md={6}>
//       <TextField
//         fullWidth
//         label="Request Date"
//         disabled
//         value={watch('request_date') || format(new Date(), 'dd-MM-yyyy')}
//         variant="outlined"
//       />
//     </Grid>

//     {/* Requisitioner */}
//     <Grid item xs={12} md={6}>
//       <FormControl fullWidth error={!!errors.requisitioner_name}>
//         <InputLabel id="requisitioner-label">Requisition raised by</InputLabel>
//         <Controller
//           name="requisitioner_name"
//           control={control}
//           render={({ field }) => (
//             <Select
//               {...field}
//               labelId="requisitioner-label"
//               label="Requisition raised by"
//             >
//               <MenuItem value="" disabled>
//                 Select Requisitioner
//               </MenuItem>
//               {employees.map((emp) => (
//                 <MenuItem key={emp.id} value={emp.full_name}>
//                   {emp.full_name}
//                 </MenuItem>
//               ))}
//             </Select>
//           )}
//         />
//         {errors.requisitioner_name && (
//           <FormHelperText>{errors.requisitioner_name.message}</FormHelperText>
//         )}
//       </FormControl>
//     </Grid>

//     {/* Requisitioner's Email */}
//     <Grid item xs={12} md={6}>
//       <TextField
//         fullWidth
//         label="Requisitioner's Email"
//         value={watch('requisitioner_email') || ''}
//         disabled
//         variant="outlined"
//       />
//     </Grid>

//     {/* Hiring Department */}
//     <Grid item xs={12} md={6}>
//       <FormControl fullWidth error={!!errors.hiring_dept}>
//         <InputLabel id="hiring-dept-label">Hiring Department</InputLabel>
//         <Controller
//           name="hiring_dept"
//           control={control}
//           render={({ field }) => (
//             <Select
//               {...field}
//               labelId="hiring-dept-label"
//               label="Hiring Department"
//             >
//               <MenuItem value="" disabled>
//                 Select Department
//               </MenuItem>
//               {departments.map((dept) => (
//                 <MenuItem key={dept.id} value={dept.name}>
//                   {dept.name}
//                 </MenuItem>
//               ))}
//             </Select>
//           )}
//         />
//         {errors.hiring_dept && (
//           <FormHelperText>{errors.hiring_dept.message}</FormHelperText>
//         )}
//       </FormControl>
//     </Grid>

//     {/* Hiring Dept Email */}
//     <Grid item xs={12} md={6}>
//       <TextField
//         fullWidth
//         label="Hiring Dept Email"
//         value={watch('hiring_dept_email') || ''}
//         disabled
//         variant="outlined"
//       />
//     </Grid>

//     {/* Submit Button */}
//     <Grid item xs={12} sx={{ textAlign: 'center', mt: 4 }}>
//       <Button
//         type="submit"
//         variant="contained"
//         color="primary"
//         size="large"
//         disabled={submitLoading}
//         startIcon={submitLoading ? <CircularProgress size={20} /> : null}
//       >
//         {submitLoading ? 'Submitting...' : 'Submit Requisition'}
//       </Button>
//     </Grid>
//   </Grid>
// </form>
//     </Box>
//   );
// }