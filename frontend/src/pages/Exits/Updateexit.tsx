import React, { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
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

interface ExitListItem {
  _id: string;
  name: string;
  dept: string;
  exitStatus: string;
  fmsStatus: string;
}

interface CheckItemState {
  doneDate?: string;
  score?: number;
  status?: string;
  daysLeft?: number | string;
}

interface CheckListState {
  name: string;
  planDate?: string;
  itemsList: CheckItemState[];
}

interface ExitDetail {
  _id: string;
  name: string;
  persEmail?: string;
  mobile?: string;
  gender?: string;
  officialEmail?: string;
  dept?: string;
  designation?: string;
  noticePeriod?: string;
  transferKnowledge?: string;
  employeesInCc?: string[];
  resignationDate?: string;
  plannedExitDate?: string;
  leftDate?: string;
  exitStatus?: string;
  remarks?: string;
  fmsStatus?: string;
  checkLists: CheckListState[];
  totalTasks?: number;
  doneInTime?: number;
  doneButDelayed?: number;
  tasksOverdue?: number;
  tasksDue?: number;
  notYetDue?: number;
  fmsScore?: number;
  autoExitEmail?: boolean; autoExitEmailSentAt?: string;
  autoExitEmailDept?: boolean; autoExitEmailDeptSentAt?: string;
  autoReminderEmail?: boolean; autoReminderEmailSentAt?: string;
  autoInstructionsToAllEmail?: boolean; autoInstructionsToAllEmailSentAt?: string;
}

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  statusChange: z.enum(["No Change In Status", "Planned Exit Date Changed", "Left", "Not Exiting"]).optional(),
  officialEmail: z.string().optional(),
  newRemarks: z.string().optional(),
  autoExitEmail: z.boolean().optional(),
  autoExitEmailDept: z.boolean().optional(),
  autoReminderEmail: z.boolean().optional(),
  autoInstructionsToAllEmail: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Checklist definitions (same order as backend) ──────────────────────────
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

const STATUS_BADGE: Record<string, string> = {
  "DONE": "bg-green-100 text-green-700",
  "DONE (DELAYED)": "bg-blue-100 text-blue-700",
  "OVERDUE": "bg-red-100 text-red-700",
  "PENDING": "bg-yellow-100 text-yellow-700",
  "NOT YET DUE": "bg-slate-100 text-slate-500",
};

const EXIT_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Serving Notice Period": { bg: "bg-amber-100", text: "text-amber-700" },
  "Already Left": { bg: "bg-slate-100", text: "text-slate-700" },
  "Left": { bg: "bg-green-100", text: "text-green-700" },
  "Not Exiting": { bg: "bg-red-100", text: "text-red-700" },
  "Exit Cancelled": { bg: "bg-red-100", text: "text-red-700" },
};

const FMS_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Open": { bg: "bg-amber-100", text: "text-amber-700" },
  "Closed": { bg: "bg-green-100", text: "text-green-700" },
};

// ─── Component ───────────────────────────────────────────────────────────────
const UpdateExit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const API = process.env.REACT_APP_REACT_APP_API_BASE_URL ?? "";

  const [exitList, setExitList] = useState<ExitListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(id ?? "");
  const [loadingExit, setLoadingExit] = useState(false);
  const [detail, setDetail] = useState<ExitDetail | null>(null);

  const [newTicks, setNewTicks] = useState<boolean[][]>([]);

  const [newPlannedExitDate, setNewPlannedExitDate] = useState<Dayjs | null>(null);
  const [newLeftDate, setNewLeftDate] = useState<Dayjs | null>(null);
  const [employeesInCc, setEmployeesInCc] = useState<string[]>([]);

  // Thank-you screen: shows a brief loader, then a confirmation message —
  // same pattern used on New Exit / New Onboarding, instead of the update
  // just silently clearing with only a toast to notice.
  const [showThankYou, setShowThankYou] = useState(false);
  const [thankYouLoading, setThankYouLoading] = useState(true);

  const {
    register, control, handleSubmit, reset, watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      autoExitEmail: false, autoExitEmailDept: false,
      autoReminderEmail: false, autoInstructionsToAllEmail: false,
    },
  });

  const statusChange = watch("statusChange");

  useEffect(() => {
    axios.get<{ data: ExitListItem[] }>(`${API}/exit`)
      .then((r) => setExitList(r.data.data))
      .catch(() => toast.error("Failed to load exit list"));
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingExit(true);
    axios.get<{ data: ExitDetail }>(`${API}/exit/${selectedId}`)
      .then((r) => {
        const d = r.data.data;
        setDetail(d);

        reset({
          officialEmail: d.officialEmail ?? "",
          newRemarks: "",
          autoExitEmail: false, autoExitEmailDept: false,
          autoReminderEmail: false, autoInstructionsToAllEmail: false,
        });

        setNewPlannedExitDate(d.plannedExitDate ? dayjs(d.plannedExitDate) : null);
        setNewLeftDate(d.leftDate ? dayjs(d.leftDate) : null);
        setEmployeesInCc(
          (d.employeesInCc ?? []).flatMap((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
        );

        setNewTicks(CHECKLIST_DEFS.map((l) => l.items.map(() => false)));
      })
      .catch(() => toast.error("Failed to load exit details"))
      .finally(() => setLoadingExit(false));
  }, [selectedId]);

  const getItemState = (listIdx: number, itemIdx: number): CheckItemState | undefined =>
    detail?.checkLists?.[listIdx]?.itemsList?.[itemIdx];

  const isAlreadyDone = (listIdx: number, itemIdx: number) =>
    !!getItemState(listIdx, itemIdx)?.doneDate;

  const totalNewlyTicked = newTicks.flat().filter(Boolean).length;
  const totalAlreadyDone = detail?.checkLists
    .flatMap((l) => l.itemsList)
    .filter((it) => !!it.doneDate).length ?? 0;
  const progress = Math.round(((totalAlreadyDone + totalNewlyTicked) / TOTAL_TASKS) * 100);

  const toggleNewTick = (listIdx: number, itemIdx: number) => {
    if (isAlreadyDone(listIdx, itemIdx)) return;
    setNewTicks((prev) => {
      const next = prev.map((l) => [...l]);
      next[listIdx][itemIdx] = !next[listIdx][itemIdx];
      return next;
    });
  };

  const fmtDate = (d?: string) => (d ? dayjs(d).format("DD MMM YYYY") : "—");

  const clearSelection = () => {
    setSelectedId("");
    setDetail(null);
    reset();
    setNewTicks([]);
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (!selectedId || !detail) {
      toast.error("Please select an exit entry first");
      return;
    }

    let exitStatus = detail.exitStatus ?? "";
    if (data.statusChange === "Planned Exit Date Changed") exitStatus = "Serving Notice Period";
    else if (data.statusChange === "Left") exitStatus = "Left";
    else if (data.statusChange === "Not Exiting") exitStatus = "Not Exiting";

    const payload = {
      ...data,
      officialEmail: data.officialEmail || detail.officialEmail,
      remarks: data.newRemarks || detail.remarks || "",
      exitStatus,
      resignationDate: detail.resignationDate,
      plannedExitDate: newPlannedExitDate?.toISOString(),
      leftDate: newLeftDate?.toISOString(),
      employeesInCc,
      checkLists: CHECKLIST_DEFS.map((listDef, listIdx) => ({
        name: listDef.name,
        items: listDef.items.map((_, itemIdx) => ({
          checked: isAlreadyDone(listIdx, itemIdx) ? false : newTicks[listIdx]?.[itemIdx] ?? false,
          name: isAlreadyDone(listIdx, itemIdx) ? "old" : "new",
        })),
      })),
    };

    try {
      await axios.put(`${API}/exit/${selectedId}`, payload);

      // Show the thank-you screen (loader first, then confirmation)
      // instead of clearing the selection immediately.
      setShowThankYou(true);
      setThankYouLoading(true);
      setTimeout(() => setThankYouLoading(false), 1200);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Update failed");
    }
  };

  const handleThankYouDone = () => {
    setShowThankYou(false);
    clearSelection();
  };

  // ── Style helpers ───────────────────────────────────────────────────────
  const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition";
  const disabledInputClass = "w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide";

  const sectionTitle = (title: string, subtitle?: string) => (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="min-h-screen bg-slate-50">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Update Exit</h1>
              <p className="text-xs text-slate-500 mt-0.5">Select an exit entry to update its progress</p>
            </div>
            {detail && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Tasks completed</p>
                  <p className="text-sm font-bold text-red-600">
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
                      "& .MuiLinearProgress-bar": { backgroundColor: "#dc2626" },
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

          {/* Status banner */}
          {detail && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{detail.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {detail.designation || "—"} · {detail.dept || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    EXIT_STATUS_STYLE[detail.exitStatus ?? ""]?.bg ?? "bg-slate-100"
                  } ${EXIT_STATUS_STYLE[detail.exitStatus ?? ""]?.text ?? "text-slate-600"}`}
                >
                  {detail.exitStatus ?? "—"}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    FMS_STATUS_STYLE[detail.fmsStatus ?? ""]?.bg ?? "bg-slate-100"
                  } ${FMS_STATUS_STYLE[detail.fmsStatus ?? ""]?.text ?? "text-slate-600"}`}
                >
                  FMS: {detail.fmsStatus ?? "—"}
                </span>
                {(detail.fmsScore ?? 0) !== 0 && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      (detail.fmsScore ?? 0) < 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    Score: {detail.fmsScore}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Selector */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {sectionTitle("Select Exit Entry")}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className={labelClass}>Exiting Employee *</label>
                <select
                  className={inputClass}
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">— Select an exit entry —</option>
                  {exitList.map((j) => (
                    <option key={j._id} value={j._id}>
                      {j.name} — {j.dept} ({j.exitStatus})
                    </option>
                  ))}
                </select>
              </div>
              {loadingExit && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <CircularProgress size={18} sx={{ color: "#dc2626" }} />
                  Loading details…
                </div>
              )}
            </div>

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

          {detail && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

              {/* Read-only basic data */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Employee Data")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Personal Email</label>
                    <div className={disabledInputClass}>{detail.persEmail || "—"}</div>
                  </div>
                  <div>
                    <label className={labelClass}>Mobile</label>
                    <div className={disabledInputClass}>{detail.mobile || "—"}</div>
                  </div>
                  <div>
                    <label className={labelClass}>Department</label>
                    <div className={disabledInputClass}>{detail.dept || "—"}</div>
                  </div>
                  <div>
                    <label className={labelClass}>Designation</label>
                    <div className={disabledInputClass}>{detail.designation || "—"}</div>
                  </div>
                  <div>
                    <label className={labelClass}>Notice Period</label>
                    <div className={disabledInputClass}>{detail.noticePeriod || "—"}</div>
                  </div>
                  <div>
                    <label className={labelClass}>Transfer Knowledge To</label>
                    <div className={disabledInputClass}>{detail.transferKnowledge || "—"}</div>
                  </div>
                  <div>
                    <label className={labelClass}>Official Email, if Allotted</label>
                    <input {...register("officialEmail")} className={inputClass} />
                  </div>
                </div>
              </section>

              {/* Status change */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Exit Status")}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Resignation Date</label>
                      <div className={disabledInputClass}>{fmtDate(detail.resignationDate)}</div>
                    </div>
                    <div>
                      <label className={labelClass}>Current Exit Status</label>
                      <div className={disabledInputClass}>{detail.exitStatus || "—"}</div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Change in Exiting Status</label>
                    <select {...register("statusChange")} className={inputClass}>
                      <option value="No Change In Status">No Change In Status</option>
                      <option value="Planned Exit Date Changed">Planned Exit Date Changed</option>
                      <option value="Left">Left</option>
                      <option value="Not Exiting">Not Exiting</option>
                    </select>
                  </div>

                  {statusChange === "Planned Exit Date Changed" && (
                    <div>
                      <label className={labelClass}>Change in Planned Exit Date</label>
                      <DatePicker
                        value={newPlannedExitDate}
                        onChange={setNewPlannedExitDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                  {statusChange === "Left" && (
                    <div>
                      <label className={labelClass}>Left Date</label>
                      <DatePicker
                        value={newLeftDate}
                        onChange={setNewLeftDate}
                        slotProps={{ textField: { size: "small", fullWidth: true } }}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Remarks & CC */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Remarks")}
                <input
                  {...register("newRemarks")}
                  className={inputClass}
                  placeholder={detail.remarks || "Update remarks..."}
                />
              </section>

              {/* Auto Emails */}
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {sectionTitle("Automated Emails", "One-time sends — once sent, they stay marked Done")}
                <div className="space-y-1">
                  {[
                    { id: "autoExitEmail" as const, sentAt: detail.autoExitEmailSentAt, label: "Send Auto Exit Email to Employee (Accepting Relieving Letter)?" },
                    { id: "autoExitEmailDept" as const, sentAt: detail.autoExitEmailDeptSentAt, label: "Send Auto Exit Email to All Departments?" },
                    { id: "autoReminderEmail" as const, sentAt: detail.autoReminderEmailSentAt, label: "Send Auto Reminder Email (1 day before exiting)?" },
                    { id: "autoInstructionsToAllEmail" as const, sentAt: detail.autoInstructionsToAllEmailSentAt, label: "Send Auto-Instructions to All Departments?" },
                  ].map(({ id, sentAt, label }) => {
                    const sent = !!sentAt;
                    return (
                      <div key={id} className={`flex items-center justify-between gap-3 rounded-lg px-1 ${sent ? "bg-green-50/60" : ""}`}>
                        <Controller name={id} control={control} render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={sent || !!field.value}
                                disabled={sent}
                                onChange={field.onChange}
                                sx={{
                                  color: "#dc2626",
                                  "&.Mui-checked": { color: sent ? "#15803d" : "#dc2626" },
                                  "&.Mui-disabled": { color: sent ? "#15803d" : undefined },
                                }}
                              />
                            }
                            label={
                              <span className={`text-sm ${sent ? "text-slate-400 line-through" : "text-slate-700"}`}>
                                {label}
                              </span>
                            }
                          />
                        )} />
                        {sent && (
                          <span className="text-xs text-green-600 font-semibold flex-shrink-0 pr-2">
                            Sent {fmtDate(sentAt)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Checklists */}
              {statusChange !== "Not Exiting" && (
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  {sectionTitle("Exit Checklists", "Green = already done (locked). Tick red items to mark as done today.")}

                  <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-4">
                    <div className="flex-1">
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 10, borderRadius: 5,
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
                                      done ? "bg-green-50/60 cursor-not-allowed" : "hover:bg-white/70 cursor-pointer"
                                    }`}
                                    onClick={() => !done && toggleNewTick(listIdx, itemIdx)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={done || pendingTick}
                                      disabled={done}
                                      onChange={() => !done && toggleNewTick(listIdx, itemIdx)}
                                      className="w-4 h-4 rounded accent-red-600 cursor-pointer flex-shrink-0"
                                    />
                                    <span className={`text-sm flex-1 ${done ? "line-through text-slate-400" : pendingTick ? "text-red-700 font-medium" : "text-slate-700"}`}>
                                      {itemLabel}
                                    </span>
                                    {itemState?.status && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_BADGE[itemState.status] ?? "bg-slate-100 text-slate-500"}`}>
                                        {itemState.status}
                                      </span>
                                    )}
                                    {done && itemState?.doneDate && (
                                      <span className="text-xs text-green-600 flex-shrink-0">{fmtDate(itemState.doneDate)}</span>
                                    )}
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

              {/* Submit */}
              <div className="flex justify-end gap-3 pb-8">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating…
                    </>
                  ) : "Update Exit"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Thank-you overlay: brief loader, then confirmation */}
        {showThankYou && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
              {thankYouLoading ? (
                <>
                  <div className="w-14 h-14 mx-auto mb-5 border-4 border-red-100 border-t-red-600 rounded-full animate-spin" />
                  <h2 className="text-lg font-bold text-slate-700">Updating Exit…</h2>
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
                  <p className="text-sm text-slate-500 mb-6">Exit entry has been updated successfully.</p>
                  <button
                    onClick={handleThankYouDone}
                    className="px-8 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow transition"
                  >
                    Update Another Entry
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </LocalizationProvider>
  );
};

export default UpdateExit;