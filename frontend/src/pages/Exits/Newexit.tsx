import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import Select from "react-select";
import {
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

// "Type of Exit" — the reason the employee is exiting, distinct from
// exitStatus (which tracks the operational stage: notice period/left/etc).
const EXIT_TYPE_OPTIONS = [
  "Resignation",
  "Completion of Tenure",
  "Retirement",
  "Demise",
  "Termination",
  "Asked to Leave",
  "Absconded",
];

// "Type of Employment" — auto-filled from the matched Onboarding record's
// employeeCategory (see mapEmployeeCategoryToEmploymentType below), shown
// here in HR-facing wording rather than Onboarding's internal enum values.
const EMPLOYMENT_TYPE_OPTIONS = [
  "Full Time Employment",
  "Contract",
  "Internship",
  "Part Time",
  "Temporary Staffing",
  "Consultant",
];

const mapEmployeeCategoryToEmploymentType = (category?: string): string => {
  switch (category) {
    case "Employee":
      return "Full Time Employment";
    case "Contract Based":
      return "Contract";
    case "Intern":
      return "Internship";
    case "Part Time":
      return "Part Time";
    case "Temporary Staffing":
      return "Temporary Staffing";
    case "Consultant":
      return "Consultant";
    default:
      return "";
  }
};

// Confidential — never referenced by any email template/trigger. Shown to
// HR only when Type of Exit is "Asked to Leave".
const REASON_ASKED_TO_LEAVE_OPTIONS = [
  "Attitude (Refused to take ownership)",
  "Conduct",
  "Performance",
  "Role Redundancy",
];

const schema = z
  .object({
    name: z.string().min(1, "Employee name is required"),
    gender: z.string().min(1, "Gender is required"),
    mobile: z.string().min(1, "Mobile is required"),
    persEmail: z.string().email("Invalid email"),
    officialEmail: z.string().optional(),
    dept: z.string().min(1, "Department is required"),
    designation: z.string().min(1, "Designation is required"),
    employmentType: z.string().optional(),
    noticePeriod: z.string().min(1, "Notice period is required"),
    transferKnowledge: z.string().min(1, "Select who knowledge will be transferred to"),
    exitStatus: z.enum(["Serving Notice Period", "Already Left", "Left", "Not Exiting", "Exit Cancelled"]),
    exitType: z.string().min(1, "Type of Exit is required"),
    reasonAskedToLeave: z.string().optional(),
    reasonAskedToLeaveDetail: z.string().optional(),
    remarks: z.string().optional(),

    autoExitEmail: z.boolean().optional(),
    autoExitEmailDept: z.boolean().optional(),
    autoReminderEmail: z.boolean().optional(),
    autoInstructionsToAllEmail: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.exitType === "Asked to Leave" && !data.reasonAskedToLeave) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonAskedToLeave"],
        message: "Reason is required when Type of Exit is Asked to Leave",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

// WHO exists — sourced entirely from Onboarding (the employee master).
// Includes both current and exited employees; is_current flags who can
// actually be selected as "exiting".
type MasterEmployee = {
  employee_id: string;
  full_name: string;
  gender?: string;
  department: string;
  designation: string;
  official_email: string;
  personal_email?: string;
  email: string;
  mobile?: string;
  joining_date?: string | null;
  employee_category?: string;
  management_level?: string;
  reporting_head?: string;
  is_current: boolean;
  is_exited: boolean;
};

type EmployeeMasterData = {
  employees: MasterEmployee[];
};

// WHAT departments/designations exist — sourced from the actual Dept &
// Designation Master, NOT derived from Onboarding. A new department can
// legitimately exist with zero employees in it yet (e.g. before the first
// hire), so this list must come from its own dedicated master, independent
// of who currently holds any given role.
type DeptRecord = {
  dept_id: number | string;
  department: string;
  dept_page_link?: string;
};

type DesigRecord = {
  desig_id: number | string;
  designation: string;
  department: string;
  Department?: string;
  Designation?: string;
  role_document_link?: string;
};

type DeptDesigMasterData = {
  departments: DeptRecord[];
  designations: DesigRecord[];
};


const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || "http://localhost:5000/api";

// ─── Checklist definitions (must match backend order exactly) ───────────────
const CHECKLIST_DEFS = [
  {
    name: "PRE-EXIT TASKS",
    color: "bg-red-50 border-red-200",
    accent: "#dc2626",
    items: [
      "Exit Email Done?",
      "Reminder Email Done?",
      "Take a Printout of Exit Email Done?",
      "Exit Email to All Dept Cc Done?",
      "Get a Handing Over Done from Employee?",
      "Conducting Exit Interview with Mgmt Done?",
    ],
  },
  {
    name: "EXIT-DAY TASKS",
    color: "bg-amber-50 border-amber-200",
    accent: "#d97706",
    items: [
      "Sign Exit Form Done?",
      "Sign No Dues Certificate Done?",
      "Ensure All Assets Are Returned Done?",
      "Name Deleted from Employee List Done?",
      "Tea Party Done?",
      "SIM Returned Done?",
    ],
  },
  {
    name: "POST-EXIT TASKS",
    color: "bg-slate-50 border-slate-200",
    accent: "#475569",
    items: [
      "Close the Contract on Odoo Done?",
      "Reassign Assets Done?",
      "Sent an Approval Mail to Mgmt Done?",
      "Issue FnF Salary Done?",
      "Issue Experience Letter Done?",
      "Reallotment of Delegation & Checklist Task Done?",
      "Remove Email from Google Drive Done?",
      "Remove Biometric Access Done?",
      "Change S2ndLife Password Done?",
      "Remove ERP Password Done?",
      "Archive Employee Profile Done?",
      "Remove the Access from Shared Contacts Done?",
      "Delete Email from BO Domain Done?",
      "Remove Employee from BO WhatsApp Gp Done?",
    ],
  },
];

const TOTAL_TASKS = CHECKLIST_DEFS.reduce((s, l) => s + l.items.length, 0);

// ─── Component ───────────────────────────────────────────────────────────────
const NewExit: React.FC = () => {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      autoExitEmail: false,
      autoExitEmailDept: false,
      autoReminderEmail: false,
      autoInstructionsToAllEmail: false,
    },
  });

  const [resignationDate, setResignationDate] = useState<Dayjs | null>(null);
  const [plannedExitDate, setPlannedExitDate] = useState<Dayjs | null>(null);
  const [leftDate, setLeftDate] = useState<Dayjs | null>(null);
  const [joiningDate, setJoiningDate] = useState<Dayjs | null>(null);
  const [employeesInCc, setEmployeesInCc] = useState<string[]>([]);
  const [master, setMaster] = useState<EmployeeMasterData>({ employees: [] });
  const [deptDesig, setDeptDesig] = useState<DeptDesigMasterData>({
    departments: [],
    designations: [],
  });

  const [checkStates, setCheckStates] = useState<boolean[][]>(
    CHECKLIST_DEFS.map((l) => l.items.map(() => false))
  );

  // Thank-you screen: shows a brief loader, then a confirmation message —
  // same pattern already used on New Onboarding, so the form doesn't just
  // silently reset with only a toast to notice.
  const [showThankYou, setShowThankYou] = useState(false);
  const [thankYouLoading, setThankYouLoading] = useState(true);

  const exitStatus = watch("exitStatus");
  const exitType = watch("exitType");
  const selectedDept = watch("dept");
  const selectedName = watch("name");

  const totalChecked = checkStates.flat().filter(Boolean).length;
  const progress = Math.round((totalChecked / TOTAL_TASKS) * 100);

  // WHO exists comes from Onboarding (the employee master). WHAT
  // departments/designations exist comes from the actual Dept &
  // Designation Master — kept separate on purpose, since a new department
  // can be created there before anyone is ever hired into it.
  useEffect(() => {
    axios
      .get(`${API_BASE}/onboarding/employee-master`)
      .then((res) => setMaster(res.data?.data ?? { employees: [] }))
      .catch(() => toast.error("Failed to load employee master data"));

    axios
      .get(`${API_BASE}/rolemaster/all`)
      .then((res) => setDeptDesig({
        departments: res.data?.data?.departments ?? [],
        designations: res.data?.data?.designations ?? [],
      }))
      .catch(() => toast.error("Failed to load department/designation master"));
  }, []);

  const currentEmployees = useMemo(
    () => master.employees.filter((e) => e.is_current),
    [master.employees]
  );

  useEffect(() => {
    setValue("designation", "");
  }, [selectedDept, setValue]);

  // Auto-fill employee basic details, official data, and joining data from
  // the matched Onboarding record when picking an existing employee.
  useEffect(() => {
    const match = currentEmployees.find((e) => e.full_name === selectedName);
    if (match) {
      // Basic details
      if (match.gender) setValue("gender", match.gender);
      if (match.mobile) setValue("mobile", match.mobile);
      if (match.personal_email) setValue("persEmail", match.personal_email);
      setValue("officialEmail", match.official_email || match.email || "");

      // Official data
      if (match.department) setValue("dept", match.department);
      if (match.designation) setValue("designation", match.designation);
      const mappedEmploymentType = mapEmployeeCategoryToEmploymentType(match.employee_category);
      if (mappedEmploymentType) setValue("employmentType", mappedEmploymentType);

      // Joining data
      setJoiningDate(match.joining_date ? dayjs(match.joining_date) : null);
    } else {
      setJoiningDate(null);
    }
  }, [selectedName, currentEmployees, setValue]);

  const filteredDesignations = useMemo(
    () =>
      deptDesig.designations.filter((item) => {
        const dept = (item.department || (item as any).Department || "").trim().toLowerCase();
        return dept === (selectedDept || "").trim().toLowerCase();
      }),
    [deptDesig.designations, selectedDept]
  );

  // CC and "transfer knowledge to" should only offer currently employed
  // people — not exited employees, and not the old stale sheet's roster.
  const ccOptions = currentEmployees
    .filter((employee) => employee.official_email)
    .map((employee) => ({
      value: employee.official_email,
      label: employee.full_name,
    }));

  const toggleCheck = (listIdx: number, itemIdx: number) => {
    setCheckStates((prev) => {
      const next = prev.map((l) => [...l]);
      next[listIdx][itemIdx] = !next[listIdx][itemIdx];
      return next;
    });
  };

  const resetFormState = () => {
    reset();
    setCheckStates(CHECKLIST_DEFS.map((l) => l.items.map(() => false)));
    setResignationDate(null);
    setPlannedExitDate(null);
    setLeftDate(null);
    setJoiningDate(null);
    setEmployeesInCc([]);
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      const payload = {
        ...data,
        resignationDate: resignationDate?.toISOString(),
        plannedExitDate: plannedExitDate?.toISOString(),
        leftDate: leftDate?.toISOString(),
        joiningDate: joiningDate?.toISOString(),
        employeesInCc,
        checkLists: CHECKLIST_DEFS.map((listDef, listIdx) => ({
          name: listDef.name,
          items: listDef.items.map((_, itemIdx) => ({
            checked: checkStates[listIdx][itemIdx],
            name: "new",
          })),
        })),
      };

      await axios.post(`${API_BASE}/exit`, payload);

      // Show the thank-you screen (loader first, then confirmation)
      // instead of resetting the form immediately.
      setShowThankYou(true);
      setThankYouLoading(true);
      setTimeout(() => setThankYouLoading(false), 1200);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Submission failed");
    }
  };

  const handleThankYouDone = () => {
    setShowThankYou(false);
    resetFormState();
  };

  // ─── Field helpers ──────────────────────────────────────────────────────
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide";
  const errorClass = "text-red-500 text-xs mt-0.5";

  const sectionTitle = (title: string, subtitle?: string) => (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );

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
                  <h1 className="text-xl font-bold text-slate-900">New Exit</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Enter new exit details</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Tasks completed</p>
                    <p className="text-sm font-bold text-red-600">
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
                        "& .MuiLinearProgress-bar": { backgroundColor: "#dc2626" },
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
                  <div className="md:col-span-2">
                    <label className={labelClass}>Name of Exiting Employee *</label>
                    <select {...register("name")} className={inputClass}>
                      <option value="">Select employee</option>
                      {currentEmployees.map((employee) => (
                        <option key={employee.employee_id || employee.full_name} value={employee.full_name}>
                          {employee.full_name}
                        </option>
                      ))}
                    </select>
                    {errors.name && <p className={errorClass}>{errors.name.message}</p>}
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
                    <select {...register("dept")} className={inputClass}>
                      <option value="">Select department</option>
                      {deptDesig.departments.map((dept) => (
                        <option key={`${dept.dept_id}-${dept.department}`} value={dept.department}>
                          {dept.department}
                        </option>
                      ))}
                    </select>
                    {errors.dept && <p className={errorClass}>{errors.dept.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Designation *</label>
                    <select {...register("designation")} className={inputClass} disabled={!selectedDept}>
                      <option value="">
                        {selectedDept ? "Select designation" : "Select department first"}
                      </option>
                      {filteredDesignations.map((designation) => (
                        <option
                          key={`${designation.department}-${designation.desig_id}-${designation.designation}`}
                          value={designation.designation}
                        >
                          {designation.designation}
                        </option>
                      ))}
                    </select>
                    {errors.designation && <p className={errorClass}>{errors.designation.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Notice Period *</label>
                    <input {...register("noticePeriod")} className={inputClass} placeholder="e.g. 30 Days" />
                    {errors.noticePeriod && <p className={errorClass}>{errors.noticePeriod.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>You Will Transfer Knowledge To *</label>
                    <select {...register("transferKnowledge")} className={inputClass}>
                      <option value="">Select employee</option>
                      {currentEmployees.map((employee) => (
                        <option key={employee.employee_id || employee.full_name} value={employee.full_name}>
                          {employee.full_name}
                        </option>
                      ))}
                    </select>
                    {errors.transferKnowledge && <p className={errorClass}>{errors.transferKnowledge.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Type of Employment</label>
                    <select {...register("employmentType")} className={inputClass}>
                      <option value="">Select employment type</option>
                      {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Auto-filled from Onboarding; override if needed.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Date of Joining</label>
                    <DatePicker
                      value={joiningDate}
                      onChange={setJoiningDate}
                      disabled
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </div>
                </div>
              </section>

              {/* Exit Timeline */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Exit Timeline")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Employee / Company Submitted Resignation Mail On
                    </label>
                    <DatePicker
                      value={resignationDate}
                      onChange={setResignationDate}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Exit Status *</label>
                    <select {...register("exitStatus")} className={inputClass}>
                      <option value="">Select Exit Status</option>
                      <option value="Serving Notice Period">Serving Notice Period</option>
                      <option value="Already Left">Already Left</option>
                      <option value="Left">Left</option>
                      <option value="Not Exiting">Not Exiting</option>
                      <option value="Exit Cancelled">Exit Cancelled</option>
                    </select>
                    {errors.exitStatus && <p className={errorClass}>{errors.exitStatus.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Type of Exit *</label>
                    <select {...register("exitType")} className={inputClass}>
                      <option value="">Select Type of Exit</option>
                      {EXIT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {errors.exitType && <p className={errorClass}>{errors.exitType.message}</p>}
                  </div>
                  {exitStatus === "Serving Notice Period" && (
                    <div>
                      <label className={labelClass}>Planned Exit Date</label>
                      <DatePicker
                        value={plannedExitDate}
                        onChange={setPlannedExitDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                  {["Already Left", "Left"].includes(exitStatus || "") && (
                    <div>
                      <label className={labelClass}>Left Date</label>
                      <DatePicker
                        value={leftDate}
                        onChange={setLeftDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                </div>

                {exitType === "Asked to Leave" && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                      Confidential — never included in any exit email
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Reason Would Have Been Asked to Leave (Confidential) *</label>
                        <select {...register("reasonAskedToLeave")} className={inputClass}>
                          <option value="">Select reason</option>
                          {REASON_ASKED_TO_LEAVE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {errors.reasonAskedToLeave && (
                          <p className={errorClass}>{errors.reasonAskedToLeave.message}</p>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Reasons (in Detail) (Confidential)</label>
                        <input
                          {...register("reasonAskedToLeaveDetail")}
                          className={inputClass}
                          placeholder="Add confidential detail..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Remarks & CC */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Remarks & Email CC")}
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Remarks</label>
                    <input {...register("remarks")} className={inputClass} placeholder="Any additional notes..." />
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                    This email will be sent including <span className="font-semibold">MD, CEO, COO, HR, Accounts &amp; DME</span>. Select others to keep in CC.
                  </div>
                  <div>
                    <label className={labelClass}>Keep in Email CC</label>
                    <Select
                      isMulti
                      options={ccOptions}
                      onChange={(selected) => setEmployeesInCc(selected.map((s) => s.value))}
                      placeholder="Select employees..."
                      classNamePrefix="react-select"
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderColor: "#e2e8f0",
                          borderRadius: "0.5rem",
                          minHeight: "42px",
                          boxShadow: "none",
                          "&:hover": { borderColor: "#dc2626" },
                        }),
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Auto Emails */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Automated Emails", "Tick to send auto-emails on form submission")}
                <div className="space-y-2">
                  {[
                    { id: "autoExitEmail" as const, label: "Send Auto Resignation Acceptance Email to Employee?" },
                    { id: "autoExitEmailDept" as const, label: "Send Auto Resignation Info to All Departments?" },
                    { id: "autoReminderEmail" as const, label: "Send Auto Reminder Email Before Last Date?" },
                    { id: "autoInstructionsToAllEmail" as const, label: "Send Auto-Instructions to All Departments?" },
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
                              sx={{ color: "#dc2626", "&.Mui-checked": { color: "#dc2626" } }}
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
                {sectionTitle("Exit Checklists", "Tick tasks as they are completed")}

                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-4">
                  <div className="flex-1">
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#fecaca",
                        "& .MuiLinearProgress-bar": { backgroundColor: "#dc2626" },
                      }}
                    />
                  </div>
                  <Chip
                    label={`${progress}%`}
                    size="small"
                    sx={{ backgroundColor: "#dc2626", color: "#fff", fontWeight: 700 }}
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
                          <span className="font-semibold text-slate-700 text-sm">{listDef.name}</span>
                          <span className="ml-auto text-xs text-slate-400">
                            {checkStates[listIdx].filter(Boolean).length} / {listDef.items.length}
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
                                className="w-4 h-4 rounded accent-red-600 cursor-pointer"
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
                  className="px-8 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Exit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </LocalizationProvider>

        {/* Thank-you overlay: brief loader, then confirmation */}
        {showThankYou && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
              {thankYouLoading ? (
                <>
                  <div className="w-14 h-14 mx-auto mb-5 border-4 border-red-100 border-t-red-600 rounded-full animate-spin" />
                  <h2 className="text-lg font-bold text-slate-700">Submitting Exit…</h2>
                  <p className="text-sm text-slate-400 mt-1">Just a moment</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h2>
                  <p className="text-sm text-slate-500 mb-6">Exit entry has been submitted successfully.</p>
                  <button
                    onClick={handleThankYouDone}
                    className="px-8 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow transition"
                  >
                    Add Another Exit Entry
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Box>
    </Box>
  );
};

export default NewExit;