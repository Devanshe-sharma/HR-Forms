import React, { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingListItem {
  _id: string;
  name: string;
  dept: string;
  joiningStatus: string;
  fmsStatus: string;
}

interface CheckItemState {
  doneHeader: string;
  doneDate?: string; // ISO string if already done
  score?: number;
  status?: string;
  daysLeft?: number | string;
}

interface CheckListState {
  name: string;
  planDate?: string;
  items: CheckItemState[];
}

interface OnboardingDetail {
  _id: string;
  name: string;
  persEmail?: string;
  mobile?: string;
  gender?: string;
  officialEmail?: string;
  nameOfBuddy?: string;
  dept?: string;
  deptLink?: string;
  designation?: string;
  designationLink?: string;
  laptopPc?: string;
  employeeCategory?: string;
  employeesInCc?: string;
  offerAcceptedDate?: string;
  plannedJoiningDate?: string;
  joiningStatus?: string;
  joinedDate?: string;
  notJoinedReason?: string;
  remarks?: string;
  fmsStatus?: string;
  // Salary
  basicSal?: number; hraSal?: number; travelAllowance?: number;
  childrenEducationAllowance?: number; supplementaryAllowance?: number;
  grossMonthly?: number; empEpf?: number; empEsic?: number; monthlyCtc?: number;
  medicalReimbursement?: number; vehicleReimbursement?: number; driverReimbursement?: number;
  telephoneReimbursement?: number; mealsReimbursement?: number; uniformReimbursement?: number;
  leaveTravelAllowance?: number; annualBonus?: number; annualPerformanceIncentive?: number;
  gratuity?: number; medicalPremium?: number; annualCtc?: number;
  // Contract
  contractPeriod?: number; contractAmount?: number; equivalentMonthlyCtc?: number;
  // Probation & revision
  confirmationDueDate?: string;
  salSerialNo?: number; salApplicableFrom?: string;
  salReviewStatus?: string; reasonForSalReview?: string;
  salReviewType?: string; salRevisionDueDate?: string;
  // Checklists
  checkLists: CheckListState[];
  totalTasks?: number;
  doneInTime?: number; doneButDelayed?: number;
  tasksOverdue?: number; tasksDue?: number; notYetDue?: number;
  fmsScore?: number;
}

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  // Personal
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
  gender: z.string().optional(),
  newGender: z.string().optional(),
  mobile: z.string().min(1, "Mobile required"),
  persEmail: z.string().email("Invalid email"),
  officialEmail: z.string().optional(),
  nameOfBuddy: z.string().optional(),
  newBuddy: z.string().optional(),
  dept: z.string().optional(),
  newDept: z.string().optional(),
  designation: z.string().optional(),
  newDesignation: z.string().optional(),
  laptopPc: z.string().optional(),
  newLaptopPc: z.string().optional(),
  employeeCategory: z.string().optional(),
  newEmployeeCategory: z.string().optional(),
  // Status
  statusChange: z.enum(["No Change In Status", "Joining Date Changed", "Joined", "Not Joining"]).optional(),
  notJoinedReason: z.string().optional(),
  remarks: z.string().optional(),
  newRemarks: z.string().optional(),
  // Salary
  basicSal: z.coerce.number().optional(), hraSal: z.coerce.number().optional(),
  travelAllowance: z.coerce.number().optional(), childrenEducationAllowance: z.coerce.number().optional(),
  supplementaryAllowance: z.coerce.number().optional(), grossMonthly: z.coerce.number().optional(),
  empEpf: z.coerce.number().optional(), empEsic: z.coerce.number().optional(),
  monthlyCtc: z.coerce.number().optional(), medicalReimbursement: z.coerce.number().optional(),
  vehicleReimbursement: z.coerce.number().optional(), driverReimbursement: z.coerce.number().optional(),
  telephoneReimbursement: z.coerce.number().optional(), mealsReimbursement: z.coerce.number().optional(),
  uniformReimbursement: z.coerce.number().optional(), leaveTravelAllowance: z.coerce.number().optional(),
  annualBonus: z.coerce.number().optional(), annualPerformanceIncentive: z.coerce.number().optional(),
  gratuity: z.coerce.number().optional(), medicalPremium: z.coerce.number().optional(),
  annualCtc: z.coerce.number().optional(),
  contractPeriod: z.coerce.number().optional(), contractAmount: z.coerce.number().optional(),
  equivalentMonthlyCtc: z.coerce.number().optional(),
  // Salary revision
  salReviewStatus: z.string().optional(), reasonForSalReview: z.string().optional(),
  salReviewType: z.string().optional(),
  // Auto emails
  autoWelcomeEmail: z.boolean().optional(), autoReminderEmail: z.boolean().optional(),
  autoInstructionsToAllEmail: z.boolean().optional(), employeeConfirmationEmail: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Checklist definitions (same order as backend) ──────────────────────────
const CHECKLIST_DEFS = [
  {
    name: "PRE-JOINING TASKS",
    color: "bg-violet-50 border-violet-200",
    accent: "#7c3aed",
    items: [
      "Welcome Email Done?", "Reminder Email Done?", "Blood Gp Reminder Done?",
      "Photos Reminder Done?", "Photo Formal Dress Done?", "Reminder Email ToAll Done?",
      "Verification Of Document Done?",
    ],
  },
  {
    name: "JOINING-DAY TASKS",
    color: "bg-sky-50 border-sky-200",
    accent: "#0284c7",
    items: [
      "New BO Email Done?", "Odoo Profile Photo Done?", "Odoo Blood Gp Entry Done?",
      "Odoo Profile 100% Done?", "Odoo Salary/Contract Done?", "EFP Forms 2/11 Done?",
      "Employees List Done?", "Seating Done?", "System Issued if Applicable Done?",
      "BO Presentation Done?", "Employees Hullo Done?", "Employee PAN Card Done?",
    ],
  },
  {
    name: "POST-JOINING TASKS",
    color: "bg-emerald-50 border-emerald-200",
    accent: "#059669",
    items: [
      "T-Shirt Issue Done?", "Welcome Kit Issue Done?", "Odoo Eqpt Entry Done?",
      "Contract/Appt Issue Done?", "Employee File Done?", "Biometric Done?",
      "Dept Onboarding Done?", "Role Briefing Done?", "Amend LinkedIn Profile Done?",
      "Add Email for Google Contacts Sharing if Applicable Done?",
      "Taken Over from Exiting Employee, If Applicable Done?",
      "DME: Checklists/ Delegation Passwords Done?", "Dept: Allocate Checklist/ Delegation Done?",
      "Allocate Buddy Done?", "Employee Confirms All OK Done?", "Onboarding Test Done?",
      "Emailed All Clients New Member Has Joined if Applicable Done?",
      "Coffee With Directors Done?", "Check if UAN Applicable Done?",
      "UAN (PF) if applicable completed Done?", "KYC (PF) if applicable completed Done?",
    ],
  },
  {
    name: "FINAL-JOINING TASKS",
    color: "bg-amber-50 border-amber-200",
    accent: "#d97706",
    items: [
      "Medical Insurance Card Issued if Applicable Done?", "First Salary Transfer Done?",
    ],
  },
];

const TOTAL_TASKS = CHECKLIST_DEFS.reduce((s, l) => s + l.items.length, 0);

const STATUS_BADGE: Record<string, string> = {
  "DONE": "bg-green-100 text-green-700",
  "DONE (DELAYED)": "bg-blue-100 text-blue-700",
  "OVERDUE": "bg-red-100 text-red-700",
  "PENDING": "bg-yellow-100 text-yellow-700",
  "NOT YET DUE": "bg-slate-100 text-slate-500",
};

// ─── Component ───────────────────────────────────────────────────────────────
const UpdateOnboarding: React.FC = () => {
  const API = import.meta.env.VITE_API_URL ?? "";

  // ── State ──────────────────────────────────────────────────────────────────
  const [joineeList, setJoineeList] = useState<OnboardingListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingJoinee, setLoadingJoinee] = useState(false);
  const [detail, setDetail] = useState<OnboardingDetail | null>(null);

  // Newly ticked items (only "new" pending items can be ticked)
  // newTicks[listIdx][itemIdx] = true/false
  const [newTicks, setNewTicks] = useState<boolean[][]>([]);

  // Dates
  const [newPlannedJoiningDate, setNewPlannedJoiningDate] = useState<Dayjs | null>(null);
  const [newJoinedDate, setNewJoinedDate] = useState<Dayjs | null>(null);
  const [newConfirmationDueDate, setNewConfirmationDueDate] = useState<Dayjs | null>(null);
  const [newSalApplicableFrom, setNewSalApplicableFrom] = useState<Dayjs | null>(null);
  const [newSalRevisionDueDate, setNewSalRevisionDueDate] = useState<Dayjs | null>(null);
  const [employeesInCc, setEmployeesInCc] = useState<string[]>([]);

  const {
    register, control, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      autoWelcomeEmail: false, autoReminderEmail: false,
      autoInstructionsToAllEmail: false, employeeConfirmationEmail: false,
    },
  });

  const statusChange = watch("statusChange");

  // ── Load joinee list on mount ───────────────────────────────────────────
  useEffect(() => {
    axios.get<{ data: OnboardingListItem[] }>(`${API}/api/onboarding`)
      .then((r) => setJoineeList(r.data.data))
      .catch(() => toast.error("Failed to load joinee list"));
  }, []);

  // ── Load selected joinee detail ────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingJoinee(true);
    axios.get<{ data: OnboardingDetail }>(`${API}/api/onboarding/${selectedId}`)
      .then((r) => {
        const d = r.data.data;
        setDetail(d);

        // Pre-fill RHF with existing values
        const nameParts = d.name?.split(" ") ?? [];
        reset({
          firstName: nameParts[0] ?? "",
          lastName: nameParts.slice(1).join(" "),
          gender: d.gender ?? "",
          mobile: d.mobile ?? "",
          persEmail: d.persEmail ?? "",
          officialEmail: d.officialEmail ?? "",
          nameOfBuddy: d.nameOfBuddy ?? "",
          dept: d.dept ?? "",
          designation: d.designation ?? "",
          laptopPc: d.laptopPc ?? "",
          employeeCategory: d.employeeCategory ?? "",
          remarks: d.remarks ?? "",
          // Salary
          basicSal: d.basicSal, hraSal: d.hraSal,
          travelAllowance: d.travelAllowance, childrenEducationAllowance: d.childrenEducationAllowance,
          supplementaryAllowance: d.supplementaryAllowance, grossMonthly: d.grossMonthly,
          empEpf: d.empEpf, empEsic: d.empEsic, monthlyCtc: d.monthlyCtc,
          medicalReimbursement: d.medicalReimbursement, vehicleReimbursement: d.vehicleReimbursement,
          driverReimbursement: d.driverReimbursement, telephoneReimbursement: d.telephoneReimbursement,
          mealsReimbursement: d.mealsReimbursement, uniformReimbursement: d.uniformReimbursement,
          leaveTravelAllowance: d.leaveTravelAllowance, annualBonus: d.annualBonus,
          annualPerformanceIncentive: d.annualPerformanceIncentive, gratuity: d.gratuity,
          medicalPremium: d.medicalPremium, annualCtc: d.annualCtc,
          contractPeriod: d.contractPeriod, contractAmount: d.contractAmount,
          equivalentMonthlyCtc: d.equivalentMonthlyCtc,
          salReviewStatus: d.salReviewStatus ?? "",
          reasonForSalReview: d.reasonForSalReview ?? "",
          salReviewType: d.salReviewType ?? "",
          autoWelcomeEmail: false, autoReminderEmail: false,
          autoInstructionsToAllEmail: false, employeeConfirmationEmail: false,
        });

        // Pre-fill dates
        setNewPlannedJoiningDate(d.plannedJoiningDate ? dayjs(d.plannedJoiningDate) : null);
        setNewJoinedDate(d.joinedDate ? dayjs(d.joinedDate) : null);
        setNewConfirmationDueDate(d.confirmationDueDate ? dayjs(d.confirmationDueDate) : null);
        setNewSalApplicableFrom(d.salApplicableFrom ? dayjs(d.salApplicableFrom) : null);
        setNewSalRevisionDueDate(d.salRevisionDueDate ? dayjs(d.salRevisionDueDate) : null);
        setEmployeesInCc(d.employeesInCc?.split(",").filter(Boolean) ?? []);

        // Init newTicks — all false (only pending items can be ticked)
        setNewTicks(CHECKLIST_DEFS.map((l) => l.items.map(() => false)));
      })
      .catch(() => toast.error("Failed to load joinee details"))
      .finally(() => setLoadingJoinee(false));
  }, [selectedId]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const getItemState = (listIdx: number, itemIdx: number): CheckItemState | undefined =>
    detail?.checkLists?.[listIdx]?.items?.[itemIdx];

  const isAlreadyDone = (listIdx: number, itemIdx: number) =>
    !!getItemState(listIdx, itemIdx)?.doneDate;

  const totalNewlyTicked = newTicks.flat().filter(Boolean).length;
  const totalAlreadyDone = detail?.checkLists
    .flatMap((l) => l.items)
    .filter((it) => !!it.doneDate).length ?? 0;
  const progress = Math.round(((totalAlreadyDone + totalNewlyTicked) / TOTAL_TASKS) * 100);

  const toggleNewTick = (listIdx: number, itemIdx: number) => {
    if (isAlreadyDone(listIdx, itemIdx)) return; // cannot uncheck old items
    setNewTicks((prev) => {
      const next = prev.map((l) => [...l]);
      next[listIdx][itemIdx] = !next[listIdx][itemIdx];
      return next;
    });
  };

  const fmtDate = (d?: string) =>
    d ? dayjs(d).format("DD MMM YYYY") : "—";

  const ccOptions = [
    { value: "sunil.prem@briskolive.com", label: "Sunil Prem" },
    { value: "admin@briskolive.com", label: "Admin" },
    { value: "accounts@briskolive.com", label: "Accounts" },
    { value: "dme@briskolive.com", label: "DME" },
  ];

  // ── Submit ──────────────────────────────────────────────────────────────
  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (!selectedId || !detail) {
      toast.error("Please select a joinee first");
      return;
    }

    // Resolve "new overrides old" pattern (matching Apps Script logic)
    const resolvedGender = data.newGender || data.gender || "";
    const resolvedBuddy = data.newBuddy || data.nameOfBuddy || "";
    const resolvedDept = data.newDept ? data.newDept.split(" - ")[0] : (data.dept ?? "");
    const resolvedDesignation = data.newDesignation ? data.newDesignation.split(" - ")[0] : (data.designation ?? "");
    const resolvedLaptop = data.newLaptopPc || data.laptopPc || "";
    const resolvedCategory = data.newEmployeeCategory || data.employeeCategory || "";
    const resolvedRemarks = data.newRemarks || data.remarks || "";

    // Resolve joining status
    let joiningStatus = detail.joiningStatus ?? "";
    if (data.statusChange === "Joining Date Changed") joiningStatus = "Yet To Join Office";
    else if (data.statusChange === "Joined") joiningStatus = "Joined";
    else if (data.statusChange === "Not Joining") joiningStatus = "Not Joining";

    const payload = {
      ...data,
      name: [data.firstName, data.lastName].filter(Boolean).join(" "),
      gender: resolvedGender,
      nameOfBuddy: resolvedBuddy,
      dept: resolvedDept,
      designation: resolvedDesignation,
      laptopPc: resolvedLaptop,
      employeeCategory: resolvedCategory,
      remarks: resolvedRemarks,
      joiningStatus,
      offerAcceptedDate: detail.offerAcceptedDate,
      plannedJoiningDate: newPlannedJoiningDate?.toISOString(),
      joinedDate: newJoinedDate?.toISOString(),
      confirmationDueDate: newConfirmationDueDate?.toISOString(),
      salApplicableFrom: newSalApplicableFrom?.toISOString(),
      salRevisionDueDate: newSalRevisionDueDate?.toISOString(),
      employeesInCc: employeesInCc.join(","),
      // Checklists: send name + item state (checked + name "new"/"old")
      checkLists: CHECKLIST_DEFS.map((listDef, listIdx) => ({
        name: listDef.name,
        items: listDef.items.map((_, itemIdx) => ({
          checked: isAlreadyDone(listIdx, itemIdx)
            ? false // already done items: don't re-mark
            : newTicks[listIdx]?.[itemIdx] ?? false,
          name: isAlreadyDone(listIdx, itemIdx) ? "old" : "new",
        })),
      })),
    };

    try {
      await axios.put(`${API}/api/onboarding/${selectedId}`, payload);
      toast.success("Onboarding updated successfully!");
      setSelectedId("");
      setDetail(null);
      reset();
      setNewTicks([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Update failed");
    }
  };

  // ── Style helpers ───────────────────────────────────────────────────────
  const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition";
  const disabledInputClass = "w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide";
  const errorClass = "text-red-500 text-xs mt-0.5";

  const sectionTitle = (title: string, subtitle?: string) => (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );

  const fieldRow = (
    label: string,
    oldVal: React.ReactNode,
    newInput: React.ReactNode
  ) => (
    <div className="grid grid-cols-2 gap-3 items-end">
      <div>
        <label className={labelClass}>Current {label}</label>
        <div className={disabledInputClass}>{oldVal || "—"}</div>
      </div>
      <div>
        <label className={labelClass}>Update {label}</label>
        {newInput}
      </div>
    </div>
  );

  const numField = (id: keyof FormValues, label: string) => (
    <div key={id}>
      <label className={labelClass}>{label}</label>
      <input type="number" step="any" {...register(id)} className={inputClass} />
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="min-h-screen bg-slate-50">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Update Onboarding</h1>
              <p className="text-xs text-slate-500 mt-0.5">Select a joinee to update their onboarding progress</p>
            </div>
            {detail && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Tasks completed</p>
                  <p className="text-sm font-bold text-indigo-600">
                    {totalAlreadyDone + totalNewlyTicked} / {TOTAL_TASKS}
                  </p>
                </div>
                <div className="w-32">
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 8, borderRadius: 4,
                      backgroundColor: "#e2e8f0",
                      "& .MuiLinearProgress-bar": { backgroundColor: "#6366f1" },
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

          {/* ── Joinee Selector ─────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {sectionTitle("Select Joinee")}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className={labelClass}>Joinee *</label>
                <select
                  className={inputClass}
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">— Select a joinee —</option>
                  {joineeList.map((j) => (
                    <option key={j._id} value={j._id}>
                      {j.name} — {j.dept} ({j.joiningStatus})
                    </option>
                  ))}
                </select>
              </div>
              {loadingJoinee && (
                <div className="flex items-center gap-2 text-indigo-600 text-sm">
                  <CircularProgress size={18} sx={{ color: "#6366f1" }} />
                  Loading details…
                </div>
              )}
            </div>

            {/* FMS Score summary bar */}
            {detail && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "FMS Score", val: detail.fmsScore ?? 0, color: (detail.fmsScore ?? 0) < 0 ? "text-red-600" : "text-green-600" },
                  { label: "Overdue", val: detail.tasksOverdue ?? 0, color: "text-red-600" },
                  { label: "Pending", val: detail.tasksDue ?? 0, color: "text-amber-600" },
                  { label: "Done in Time", val: detail.doneInTime ?? 0, color: "text-green-600" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Only show rest of form once a joinee is loaded */}
          {detail && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

              {/* ── Personal Data ──────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Personal Data", "Current values shown on left — update on right if needed")}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>First Name *</label>
                      <input {...register("firstName")} className={inputClass} />
                      {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Last Name</label>
                      <input {...register("lastName")} className={inputClass} />
                    </div>
                  </div>

                  {fieldRow("Gender",
                    detail.gender,
                    <select {...register("newGender")} className={inputClass}>
                      <option value="">No change</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Mobile *</label>
                      <input {...register("mobile")} className={inputClass} />
                      {errors.mobile && <p className={errorClass}>{errors.mobile.message}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Personal Email *</label>
                      <input {...register("persEmail")} className={inputClass} />
                      {errors.persEmail && <p className={errorClass}>{errors.persEmail.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Official Email</label>
                    <input {...register("officialEmail")} className={inputClass} />
                  </div>
                </div>
              </section>

              {/* ── Official Data ──────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Official Data")}
                <div className="space-y-4">
                  {fieldRow("Buddy",
                    detail.nameOfBuddy,
                    <input {...register("newBuddy")} className={inputClass} placeholder="Update buddy name" />
                  )}
                  {fieldRow("Department",
                    detail.dept,
                    <input {...register("newDept")} className={inputClass} placeholder="Update dept" />
                  )}
                  {fieldRow("Designation",
                    detail.designation,
                    <input {...register("newDesignation")} className={inputClass} placeholder="Update designation" />
                  )}
                  {fieldRow("System Authorised",
                    detail.laptopPc,
                    <select {...register("newLaptopPc")} className={inputClass}>
                      <option value="">No change</option>
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  )}
                  {fieldRow("Employee Category",
                    detail.employeeCategory,
                    <select {...register("newEmployeeCategory")} className={inputClass}>
                      <option value="">No change</option>
                      <option value="Employee">Employee</option>
                      <option value="Consultant">Consultant</option>
                    </select>
                  )}
                </div>
              </section>

              {/* ── Joining Details ────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Joining Details")}
                <div className="space-y-4">
                  {/* Read-only current status */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 font-semibold uppercase">Current Status</span>
                    <span className="font-semibold text-slate-800">{detail.joiningStatus}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${detail.fmsStatus === "Open" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                      FMS: {detail.fmsStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Offer Accepted Date</label>
                      <div className={disabledInputClass}>{fmtDate(detail.offerAcceptedDate)}</div>
                    </div>
                    <div>
                      <label className={labelClass}>Current Joined Date</label>
                      <div className={disabledInputClass}>{fmtDate(detail.joinedDate)}</div>
                    </div>
                  </div>

                  {/* Status change */}
                  <div>
                    <label className={labelClass}>Change in Status</label>
                    <select {...register("statusChange")} className={inputClass}>
                      <option value="No Change In Status">No Change In Status</option>
                      <option value="Joining Date Changed">Joining Date Changed</option>
                      <option value="Joined">Joined</option>
                      <option value="Not Joining">Not Joining</option>
                    </select>
                  </div>

                  {/* Conditional date fields */}
                  {(statusChange === "Joining Date Changed" || statusChange === "No Change In Status") && (
                    <div>
                      <label className={labelClass}>Update Planned Joining Date</label>
                      <DatePicker
                        value={newPlannedJoiningDate}
                        onChange={setNewPlannedJoiningDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                  {statusChange === "Joined" && (
                    <div>
                      <label className={labelClass}>Joined Date *</label>
                      <DatePicker
                        value={newJoinedDate}
                        onChange={setNewJoinedDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                  {statusChange === "Not Joining" && (
                    <div>
                      <label className={labelClass}>Reason for Not Joining</label>
                      <input {...register("notJoinedReason")} className={inputClass} placeholder="Enter reason..." />
                    </div>
                  )}
                </div>
              </section>

              {/* ── Salary Details ─────────────────────────────────────── */}
              {(detail.employeeCategory === "Employee" || watch("newEmployeeCategory") === "Employee") && (
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  {sectionTitle("Salary Details")}

                  <div className="mb-4">
                    <label className={labelClass}>Sal Applicable From</label>
                    <DatePicker
                      value={newSalApplicableFrom}
                      onChange={setNewSalApplicableFrom}
                      slotProps={{ textField: { size: "small" } }}
                    />
                  </div>

                  <p className="text-xs font-bold text-slate-600 uppercase mb-3">Gross Monthly</p>
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

              {/* ── Contract Details ───────────────────────────────────── */}
              {(detail.employeeCategory === "Consultant" || watch("newEmployeeCategory") === "Consultant") && (
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  {sectionTitle("Contract Details")}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {numField("contractPeriod", "Contract Period (months)")}
                    {numField("contractAmount", "Contract Amount (₹)")}
                    {numField("equivalentMonthlyCtc", "Equivalent Monthly CTC")}
                  </div>
                </section>
              )}

              {/* ── Probation & Salary Revision ───────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Probation & Salary Revision")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fieldRow("Confirmation Due Date",
                    fmtDate(detail.confirmationDueDate),
                    <DatePicker
                      value={newConfirmationDueDate}
                      onChange={setNewConfirmationDueDate}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  )}
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
                      value={newSalRevisionDueDate}
                      onChange={setNewSalRevisionDueDate}
                      slotProps={{ textField: { size: "small", fullWidth: true } }}
                    />
                  </div>
                </div>
              </section>

              {/* ── Remarks & CC ──────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Remarks & Email CC")}
                <div className="space-y-4">
                  {fieldRow("Remarks",
                    detail.remarks || "—",
                    <textarea
                      {...register("newRemarks")}
                      rows={2}
                      className={`${inputClass} resize-none`}
                      placeholder="Update remarks..."
                    />
                  )}
                  <div>
                    <label className={labelClass}>Keep in Email CC</label>
                    <Select
                      isMulti
                      options={ccOptions}
                      value={ccOptions.filter((o) => employeesInCc.includes(o.value))}
                      onChange={(sel) => setEmployeesInCc(sel.map((s) => s.value))}
                      placeholder="Select employees..."
                      classNamePrefix="react-select"
                      styles={{
                        control: (base) => ({
                          ...base, borderColor: "#e2e8f0", borderRadius: "0.5rem",
                          minHeight: "42px", boxShadow: "none",
                          "&:hover": { borderColor: "#6366f1" },
                        }),
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* ── Auto Emails ────────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Automated Emails")}
                <div className="space-y-2">
                  {[
                    { id: "autoWelcomeEmail" as const, label: "Send Auto Welcome Email" },
                    { id: "autoInstructionsToAllEmail" as const, label: "Send Auto-Instructions to All" },
                    { id: "autoReminderEmail" as const, label: "Send Reminder Email (1 day before joining)" },
                    { id: "employeeConfirmationEmail" as const, label: "Email Joinee to fill Onboarding Feedback Form" },
                  ].map(({ id, label }) => (
                    <Controller key={id} name={id} control={control} render={({ field }) => (
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
                    )} />
                  ))}
                </div>
              </section>

              {/* ── Checklists ─────────────────────────────────────────── */}
              {statusChange !== "Not Joining" && (
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  {sectionTitle("Onboarding Checklists", "Green = already done (locked). Tick red items to mark as done today.")}

                  {/* Progress */}
                  <div className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center gap-4">
                    <div className="flex-1">
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 10, borderRadius: 5,
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
                    {CHECKLIST_DEFS.map((listDef, listIdx) => {
                      const listData = detail.checkLists[listIdx];
                      const planDate = listData?.planDate ? fmtDate(listData.planDate) : "—";
                      const doneCount = listDef.items.filter((_, ii) => isAlreadyDone(listIdx, ii)).length;
                      const newCount = newTicks[listIdx]?.filter(Boolean).length ?? 0;

                      return (
                        <Accordion
                          key={listDef.name}
                          defaultExpanded
                          sx={{
                            borderRadius: "12px !important", border: "1px solid #e2e8f0",
                            boxShadow: "none", "&:before": { display: "none" }, overflow: "hidden",
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <div className="flex items-center gap-3 w-full pr-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: listDef.accent }} />
                              <span className="font-semibold text-slate-700 text-sm">{listDef.name}</span>
                              <span className="text-xs text-slate-400 ml-1">Plan: {planDate}</span>
                              <span className="ml-auto text-xs text-slate-400">
                                {doneCount + newCount} / {listDef.items.length}
                              </span>
                            </div>
                          </AccordionSummary>

                          <AccordionDetails className={`${listDef.color} !pt-0`}>
                            <div className="pt-2 space-y-1">
                              {listDef.items.map((itemLabel, itemIdx) => {
                                const done = isAlreadyDone(listIdx, itemIdx);
                                const itemState = getItemState(listIdx, itemIdx);
                                const pendingTick = newTicks[listIdx]?.[itemIdx] ?? false;

                                return (
                                  <div
                                    key={itemIdx}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                      done
                                        ? "bg-green-50/60 cursor-not-allowed"
                                        : "hover:bg-white/70 cursor-pointer"
                                    }`}
                                    onClick={() => !done && toggleNewTick(listIdx, itemIdx)}
                                  >
                                    {/* Checkbox */}
                                    <input
                                      type="checkbox"
                                      checked={done || pendingTick}
                                      disabled={done}
                                      onChange={() => !done && toggleNewTick(listIdx, itemIdx)}
                                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
                                    />

                                    {/* Label */}
                                    <span className={`text-sm flex-1 ${done ? "line-through text-slate-400" : pendingTick ? "text-indigo-700 font-medium" : "text-slate-700"}`}>
                                      {itemLabel}
                                    </span>

                                    {/* Status badge */}
                                    {itemState?.status && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_BADGE[itemState.status] ?? "bg-slate-100 text-slate-500"}`}>
                                        {itemState.status}
                                      </span>
                                    )}

                                    {/* Done date */}
                                    {done && itemState?.doneDate && (
                                      <span className="text-xs text-green-600 flex-shrink-0">
                                        {fmtDate(itemState.doneDate)}
                                      </span>
                                    )}

                                    {/* Score */}
                                    {itemState?.score !== undefined && itemState.score !== 0 && (
                                      <span className={`text-xs flex-shrink-0 ${(itemState.score ?? 0) < 0 ? "text-red-500" : "text-green-600"}`}>
                                        {(itemState.score ?? 0) > 0 ? "+" : ""}{itemState.score}d
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── Submit ─────────────────────────────────────────────── */}
              <div className="flex justify-end gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => { setSelectedId(""); setDetail(null); reset(); setNewTicks([]); }}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating…
                    </>
                  ) : "Update Onboarding"}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </LocalizationProvider>
  );
};

export default UpdateOnboarding;