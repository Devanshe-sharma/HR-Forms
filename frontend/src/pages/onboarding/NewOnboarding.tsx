import React, { useState } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import Select from "react-select";
import {
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  LinearProgress,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";

// ─── Types ─────────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
  mobile: z.string().min(1, "Mobile is required"),
  persEmail: z.string().email("Invalid email"),
  officialEmail: z.string().optional(),
  nameOfBuddy: z.string().optional(),
  dept: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  laptopPc: z.string().optional(),
  joiningStatus: z.enum(["Yet To Join Office", "Joined", "Not Joining"]),
  employeeCategory: z.enum(["Employee", "Consultant"]).optional(),
  remarks: z.string().optional(),

  // Salary
  basicSal: z.coerce.number().optional(),
  hraSal: z.coerce.number().optional(),
  travelAllowance: z.coerce.number().optional(),
  childrenEducationAllowance: z.coerce.number().optional(),
  supplementaryAllowance: z.coerce.number().optional(),
  grossMonthly: z.coerce.number().optional(),
  empEpf: z.coerce.number().optional(),
  empEsic: z.coerce.number().optional(),
  monthlyCtc: z.coerce.number().optional(),
  leaveTravelAllowance: z.coerce.number().optional(),
  medicalReimbursement: z.coerce.number().optional(),
  vehicleReimbursement: z.coerce.number().optional(),
  driverReimbursement: z.coerce.number().optional(),
  telephoneReimbursement: z.coerce.number().optional(),
  mealsReimbursement: z.coerce.number().optional(),
  uniformReimbursement: z.coerce.number().optional(),
  annualBonus: z.coerce.number().optional(),
  annualPerformanceIncentive: z.coerce.number().optional(),
  gratuity: z.coerce.number().optional(),
  medicalPremium: z.coerce.number().optional(),
  annualCtc: z.coerce.number().optional(),

  // Contract
  contractPeriod: z.coerce.number().optional(),
  contractAmount: z.coerce.number().optional(),
  equivalentMonthlyCtc: z.coerce.number().optional(),

  // Salary revision
  salReviewStatus: z.string().optional(),
  reasonForSalReview: z.string().optional(),
  salReviewType: z.string().optional(),

  // Auto-emails
  autoWelcomeEmail: z.boolean().optional(),
  autoReminderEmail: z.boolean().optional(),
  autoInstructionsToAllEmail: z.boolean().optional(),
  employeeConfirmationEmail: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Checklist definitions (must match backend order exactly) ───────────────
const CHECKLIST_DEFS = [
  {
    name: "PRE-JOINING TASKS",
    color: "bg-violet-50 border-violet-200",
    accent: "#7c3aed",
    items: [
      "Welcome Email Done?",
      "Reminder Email Done?",
      "Blood Gp Reminder Done?",
      "Photos Reminder Done?",
      "Photo Formal Dress Done?",
      "Reminder Email ToAll Done?",
      "Verification Of Document Done?",
    ],
  },
  {
    name: "JOINING-DAY TASKS",
    color: "bg-sky-50 border-sky-200",
    accent: "#0284c7",
    items: [
      "New BO Email Done?",
      "Odoo Profile Photo Done?",
      "Odoo Blood Gp Entry Done?",
      "Odoo Profile 100% Done?",
      "Odoo Salary/Contract Done?",
      "EFP Forms 2/11 Done?",
      "Employees List Done?",
      "Seating Done?",
      "System Issued if Applicable Done?",
      "BO Presentation Done?",
      "Employees Hullo Done?",
      "Employee PAN Card Done?",
    ],
  },
  {
    name: "POST-JOINING TASKS",
    color: "bg-emerald-50 border-emerald-200",
    accent: "#059669",
    items: [
      "T-Shirt Issue Done?",
      "Welcome Kit Issue Done?",
      "Odoo Eqpt Entry Done?",
      "Contract/Appt Issue Done?",
      "Employee File Done?",
      "Biometric Done?",
      "Dept Onboarding Done?",
      "Role Briefing Done?",
      "Amend LinkedIn Profile Done?",
      "Add Email for Google Contacts Sharing if Applicable Done?",
      "Taken Over from Exiting Employee, If Applicable Done?",
      "DME: Checklists/ Delegation Passwords Done?",
      "Dept: Allocate Checklist/ Delegation Done?",
      "Allocate Buddy Done?",
      "Employee Confirms All OK Done?",
      "Onboarding Test Done?",
      "Emailed All Clients New Member Has Joined if Applicable Done?",
      "Coffee With Directors Done?",
      "Check if UAN Applicable Done?",
      "UAN (PF) if applicable completed Done?",
      "KYC (PF) if applicable completed Done?",
    ],
  },
  {
    name: "FINAL-JOINING TASKS",
    color: "bg-amber-50 border-amber-200",
    accent: "#d97706",
    items: [
      "Medical Insurance Card Issued if Applicable Done?",
      "First Salary Transfer Done?",
    ],
  },
];

const TOTAL_TASKS = CHECKLIST_DEFS.reduce((s, l) => s + l.items.length, 0);

// ─── Component ───────────────────────────────────────────────────────────────
const NewOnboarding: React.FC = () => {
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      autoWelcomeEmail: false,
      autoReminderEmail: false,
      autoInstructionsToAllEmail: false,
      employeeConfirmationEmail: false,
    },
  });

  // Date state (not in RHF schema – handled separately to keep types clean)
  const [offerAcceptedDate, setOfferAcceptedDate] = useState<Dayjs | null>(null);
  const [plannedJoiningDate, setPlannedJoiningDate] = useState<Dayjs | null>(null);
  const [joinedDate, setJoinedDate] = useState<Dayjs | null>(null);
  const [salApplicableFrom, setSalApplicableFrom] = useState<Dayjs | null>(null);
  const [confirmationDueDate, setConfirmationDueDate] = useState<Dayjs | null>(null);
  const [salRevisionDueDate, setSalRevisionDueDate] = useState<Dayjs | null>(null);
  const [employeesInCc, setEmployeesInCc] = useState<string[]>([]);

  // Checklist state: array of arrays of booleans
  const [checkStates, setCheckStates] = useState<boolean[][]>(
    CHECKLIST_DEFS.map((l) => l.items.map(() => false))
  );

  const joiningStatus = watch("joiningStatus");
  const employeeCategory = watch("employeeCategory");

  const totalChecked = checkStates.flat().filter(Boolean).length;
  const progress = Math.round((totalChecked / TOTAL_TASKS) * 100);

  // Dummy CC options – replace with real API data
  const ccOptions = [
    { value: "sunil.prem@briskolive.com", label: "Sunil Prem" },
    { value: "admin@briskolive.com", label: "Admin" },
    { value: "accounts@briskolive.com", label: "Accounts" },
    { value: "dme@briskolive.com", label: "DME" },
  ];

  const toggleCheck = (listIdx: number, itemIdx: number) => {
    setCheckStates((prev) => {
      const next = prev.map((l) => [...l]);
      next[listIdx][itemIdx] = !next[listIdx][itemIdx];
      return next;
    });
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      const payload = {
        ...data,
        name: [data.firstName, data.lastName].filter(Boolean).join(" "),
        offerAcceptedDate: offerAcceptedDate?.toISOString(),
        plannedJoiningDate: plannedJoiningDate?.toISOString(),
        joinedDate: joinedDate?.toISOString(),
        salApplicableFrom: salApplicableFrom?.toISOString(),
        confirmationDueDate: confirmationDueDate?.toISOString(),
        salRevisionDueDate: salRevisionDueDate?.toISOString(),
        employeesInCc: employeesInCc.join(","),
        checkLists: CHECKLIST_DEFS.map((listDef, listIdx) => ({
          name: listDef.name,
          items: listDef.items.map((_, itemIdx) => ({
            checked: checkStates[listIdx][itemIdx],
            name: "new",
          })),
        })),
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL ?? ""}/api/onboarding`,
        payload
      );
      toast.success("Onboarding created successfully!");
      reset();
      setCheckStates(CHECKLIST_DEFS.map((l) => l.items.map(() => false)));
      setOfferAcceptedDate(null);
      setPlannedJoiningDate(null);
      setJoinedDate(null);
      setSalApplicableFrom(null);
      setConfirmationDueDate(null);
      setSalRevisionDueDate(null);
      setEmployeesInCc([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Submission failed");
    }
  };

  // ─── Field helpers ──────────────────────────────────────────────────────
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide";
  const errorClass = "text-red-500 text-xs mt-0.5";

  const sectionTitle = (title: string, subtitle?: string) => (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );

  const numField = (id: keyof FormValues, label: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="number"
        step="any"
        {...register(id)}
        className={inputClass}
        placeholder="0"
      />
    </div>
  );

  // Render
  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1 }}>
        <Navbar />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <div className="min-h-screen bg-slate-50" style={{ marginTop: "56px" }}>
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
              <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">New Onboarding</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Complete all tasks within 5 days of offer / joining date
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Tasks completed</p>
                    <p className="text-sm font-bold text-indigo-600">
                      {totalChecked} / {TOTAL_TASKS}
                    </p>
                  </div>
                  <div className="w-32">
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#e2e8f0",
                        "& .MuiLinearProgress-bar": { backgroundColor: "#6366f1" },
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="max-w-5xl mx-auto px-6 py-8 space-y-8">
              {/* Employee Basic Data */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Employee Basic Data")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name *</label>
                    <input {...register("firstName")} className={inputClass} placeholder="Rahul" />
                    {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input {...register("lastName")} className={inputClass} placeholder="Sharma" />
                  </div>
                  <div>
                    <label className={labelClass}>Gender *</label>
                    <select {...register("gender")} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && <p className={errorClass}>{errors.gender.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Mobile *</label>
                    <input {...register("mobile")} className={inputClass} placeholder="+91 9999999999" />
                    {errors.mobile && <p className={errorClass}>{errors.mobile.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Personal Email *</label>
                    <input {...register("persEmail")} className={inputClass} placeholder="personal@gmail.com" />
                    {errors.persEmail && <p className={errorClass}>{errors.persEmail.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Official Email</label>
                    <input {...register("officialEmail")} className={inputClass} placeholder="name@company.com" />
                  </div>
                </div>
              </section>

              {/* Official Data */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Official Data")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Department *</label>
                    <input {...register("dept")} className={inputClass} placeholder="Engineering" />
                    {errors.dept && <p className={errorClass}>{errors.dept.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Designation *</label>
                    <input {...register("designation")} className={inputClass} placeholder="Software Engineer" />
                    {errors.designation && <p className={errorClass}>{errors.designation.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Name of Buddy</label>
                    <input {...register("nameOfBuddy")} className={inputClass} placeholder="Buddy Name" />
                  </div>
                  <div>
                    <label className={labelClass}>Authorised System</label>
                    <select {...register("laptopPc")} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Joining Details */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Joining Details")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Offer Accepted Date</label>
                    <DatePicker
                      value={offerAcceptedDate}
                      onChange={setOfferAcceptedDate}
                      slotProps={{
                        textField: { size: "small", fullWidth: true, className: "bg-white" },
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Planned Joining Date</label>
                    <DatePicker
                      value={plannedJoiningDate}
                      onChange={setPlannedJoiningDate}
                      slotProps={{
                        textField: { size: "small", fullWidth: true },
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Joining Status *</label>
                    <select {...register("joiningStatus")} className={inputClass}>
                      <option value="">Select Status</option>
                      <option value="Yet To Join Office">Yet To Join Office</option>
                      <option value="Joined">Joined</option>
                      <option value="Not Joining">Not Joining</option>
                    </select>
                    {errors.joiningStatus && (
                      <p className={errorClass}>{errors.joiningStatus.message}</p>
                    )}
                  </div>
                  {joiningStatus === "Joined" && (
                    <div>
                      <label className={labelClass}>Joined Date</label>
                      <DatePicker
                        value={joinedDate}
                        onChange={setJoinedDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Employee Category */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Employee Category")}
                <div className="grid grid-cols-2 gap-3">
                  {(["Employee", "Consultant"] as const).map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        employeeCategory === cat
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      <input
                        type="radio"
                        value={cat}
                        {...register("employeeCategory")}
                        className="accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-slate-700">{cat}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Salary Details (Employee) */}
              {employeeCategory === "Employee" && (
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  {sectionTitle("Salary Details", "All amounts in INR")}

                  <div className="mb-4">
                    <label className={labelClass}>Sal Applicable From</label>
                    <DatePicker
                      value={salApplicableFrom}
                      onChange={setSalApplicableFrom}
                      slotProps={{ textField: { size: "small" } }}
                    />
                  </div>

                  <p className="text-xs font-bold text-slate-600 uppercase mb-3 mt-4">Gross Monthly</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {numField("basicSal", "Basic Salary")}
                    {numField("hraSal", "HRA")}
                    {numField("travelAllowance", "Travel Allowance")}
                    {numField("childrenEducationAllowance", "Children's Education Allowance")}
                    {numField("supplementaryAllowance", "Supplementary Allowance")}
                    {numField("grossMonthly", "Gross Monthly")}
                  </div>

                  <p className="text-xs font-bold text-slate-600 uppercase mb-3 mt-6">Monthly CTC</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {numField("empEpf", "Employer PF")}
                    {numField("empEsic", "Employer ESI")}
                    {numField("monthlyCtc", "Monthly CTC")}
                  </div>

                  <p className="text-xs font-bold text-slate-600 uppercase mb-3 mt-6">Annual Components</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {numField("leaveTravelAllowance", "Leave Travel Allowance")}
                    {numField("medicalReimbursement", "Medical Reimbursement")}
                    {numField("vehicleReimbursement", "Vehicle Reimbursement")}
                    {numField("driverReimbursement", "Driver Reimbursement")}
                    {numField("telephoneReimbursement", "Telephone Reimbursement")}
                    {numField("mealsReimbursement", "Meals Reimbursement")}
                    {numField("uniformReimbursement", "Uniform Reimbursement")}
                    {numField("annualBonus", "Annual Bonus")}
                    {numField("annualPerformanceIncentive", "Annual Performance Incentive")}
                    {numField("gratuity", "Annual Gratuity")}
                    {numField("medicalPremium", "Annual Medical Premium")}
                    {numField("annualCtc", "Annual CTC")}
                  </div>
                </section>
              )}

              {/* Contract Details (Consultant) */}
              {employeeCategory === "Consultant" && (
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  {sectionTitle("Contract Details")}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {numField("contractPeriod", "Contract Period (months)")}
                    {numField("contractAmount", "Contract Amount (₹)")}
                    {numField("equivalentMonthlyCtc", "Equivalent Monthly CTC")}
                  </div>
                </section>
              )}

              {/* Probation & Salary Revision */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Probation & Salary Revision")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Confirmation Due Date</label>
                    <DatePicker
                      value={confirmationDueDate}
                      onChange={setConfirmationDueDate}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Salary Review Status</label>
                    <select {...register("salReviewStatus")} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Due">Due</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Reason (if Not Applicable)</label>
                    <input {...register("reasonForSalReview")} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Review Type</label>
                    <select {...register("salReviewType")} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Annual">Annual</option>
                      <option value="Promised">Promised</option>
                      <option value="Special">Special</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Revision Due Date</label>
                    <DatePicker
                      value={salRevisionDueDate}
                      onChange={setSalRevisionDueDate}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </div>
                </div>
              </section>

              {/* Remarks & CC */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Remarks & Email CC")}
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>HR Remarks</label>
                    <textarea
                      {...register("remarks")}
                      rows={3}
                      className={`${inputClass} resize-none`}
                      placeholder="Any additional notes..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Keep in Email CC</label>
                    <Select
                      isMulti
                      options={ccOptions}
                      onChange={(selected) =>
                        setEmployeesInCc(selected.map((s) => s.value))
                      }
                      placeholder="Select employees..."
                      classNamePrefix="react-select"
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderColor: "#e2e8f0",
                          borderRadius: "0.5rem",
                          minHeight: "42px",
                          boxShadow: "none",
                          "&:hover": { borderColor: "#6366f1" },
                        }),
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Auto Emails */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle(
                  "Automated Emails",
                  "Tick to send auto-emails on form submission"
                )}
                <div className="space-y-2">
                  {[
                    { id: "autoWelcomeEmail" as const, label: "Send Auto Welcome Email" },
                    { id: "autoInstructionsToAllEmail" as const, label: "Send Auto-Instructions to All" },
                    { id: "autoReminderEmail" as const, label: "Send Reminder Email (tick 1 day before joining)" },
                    { id: "employeeConfirmationEmail" as const, label: "Email Joinee to fill Onboarding Feedback Form" },
                  ].map(({ id, label }) => (
                    <Controller
                      key={id}
                      name={id}
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={!!field.value}
                              onChange={field.onChange}
                              sx={{ color: "#6366f1", "&.Mui-checked": { color: "#6366f1" } }}
                            />
                          }
                          label={<span className="text-sm text-slate-700">{label}</span>}
                        />
                      )}
                    />
                  ))}
                </div>
              </section>

              {/* Checklists */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle(
                  "Onboarding Checklists",
                  "Tick tasks as they are completed"
                )}

                {/* Progress bar */}
                <div className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center gap-4">
                  <div className="flex-1">
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#c7d2fe",
                        "& .MuiLinearProgress-bar": { backgroundColor: "#6366f1" },
                      }}
                    />
                  </div>
                  <Chip
                    label={`${progress}%`}
                    size="small"
                    sx={{ backgroundColor: "#6366f1", color: "#fff", fontWeight: 700 }}
                  />
                </div>

                <div className="space-y-3">
                  {CHECKLIST_DEFS.map((listDef, listIdx) => (
                    <Accordion
                      key={listDef.name}
                      defaultExpanded={listIdx === 0}
                      sx={{
                        borderRadius: "12px !important",
                        border: "1px solid #e2e8f0",
                        boxShadow: "none",
                        "&:before": { display: "none" },
                        overflow: "hidden",
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <div className="flex items-center gap-3 w-full pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: listDef.accent }}
                          />
                          <span className="font-semibold text-slate-700 text-sm">
                            {listDef.name}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">
                            {checkStates[listIdx].filter(Boolean).length} /{" "}
                            {listDef.items.length}
                          </span>
                        </div>
                      </AccordionSummary>
                      <AccordionDetails className={`${listDef.color} !pt-0`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pt-2">
                          {listDef.items.map((itemLabel, itemIdx) => (
                            <label
                              key={itemIdx}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/60 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checkStates[listIdx][itemIdx]}
                                onChange={() => toggleCheck(listIdx, itemIdx)}
                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                              />
                              <span
                                className={`text-sm ${
                                  checkStates[listIdx][itemIdx]
                                    ? "line-through text-slate-400"
                                    : "text-slate-700"
                                }`}
                              >
                                {itemLabel}
                              </span>
                            </label>
                          ))}
                        </div>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </div>
              </section>

              {/* Submit */}
              <div className="flex justify-end gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setCheckStates(CHECKLIST_DEFS.map((l) => l.items.map(() => false)));
                  }}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Onboarding"
                  )}
                </button>
              </div>
            </form>
          </div>
        </LocalizationProvider>
      </Box>
    </Box>
  );
}
export default NewOnboarding;