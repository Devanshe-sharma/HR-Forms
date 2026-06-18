import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import dayjs from "dayjs";
import {
  Box, Typography, Button, TextField,
  InputAdornment, TablePagination, CircularProgress, Tooltip,
} from "@mui/material";
import {
  AddCircle, Search, Edit,
  PeopleAlt, AssignmentTurnedIn, PendingActions, Warning,
  KeyboardArrowDown, KeyboardArrowRight,
} from "@mui/icons-material";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckItem {
  name?: string;
  status?: string;
  planDate?: string;
  doneDate?: string;
  score?: number;
}

interface CheckList {
  name: string;
  planDate?: string;
  itemsList: CheckItem[];
}

interface OnboardingRow {
  _id: string;
  name: string;
  gender?: string;
  persEmail?: string;
  mobile?: string;
  officialEmail?: string;
  dept?: string;
  designation?: string;
  employeeCategory?: string;
  joiningStatus?: string;
  fmsStatus?: string;
  fmsScore?: number;
  totalTasks?: number;
  doneInTime?: number;
  tasksOverdue?: number;
  tasksDue?: number;
  offerAcceptedDate?: string;
  plannedJoiningDate?: string;
  joinedDate?: string;
  confirmationDueDate?: string;
  salRevisionDueDate?: string;
  nameOfBuddy?: string;
  laptopPc?: string;
  remarks?: string;
  annualCtc?: number;
  createdAt?: string;
  checkLists?: CheckList[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = process.env.REACT_APP_API_BASE_URL ?? "";
const fmt  = (d?: string | null) => d ? dayjs(d).format("DD MMM") : "—";
const fmtY = (d?: string | null) => d ? dayjs(d).format("DD MMM YY") : "—";

const STATUS_COLOR: Record<string, { bg: string; text: string; short: string }> = {
  "DONE":           { bg: "#f0fdf4", text: "#15803d", short: "DONE"  },
  "DONE (DELAYED)": { bg: "#eff6ff", text: "#1d4ed8", short: "DELAY" },
  "OVERDUE":        { bg: "#fef2f2", text: "#dc2626", short: "OVER"  },
  "PENDING":        { bg: "#fffbeb", text: "#d97706", short: "PEND"  },
  "NOT YET DUE":    { bg: "#f8fafc", text: "#94a3b8", short: "NYD"   },
};

const GROUP_COLORS = ["#7c3aed", "#0284c7", "#059669", "#d97706"];

// ─── Sticky column definitions ────────────────────────────────────────────────
// # (36) then sticky cols start at 36
const STICKY = [
  { key: "name",          label: "Name",           width: 140, left: 36  },
  { key: "gender",        label: "Gender",         width: 64,  left: 176 },
  { key: "persEmail",     label: "Personal Email", width: 170, left: 240 },
  { key: "mobile",        label: "Mobile",         width: 110, left: 410 },
  { key: "officialEmail", label: "Official Email", width: 170, left: 520 },
  { key: "dept",          label: "Dept",           width: 110, left: 690 },
  { key: "designation",   label: "Designation",    width: 130, left: 800 },
];

const SUMMARY_COLS = [
  { key: "employeeCategory",   label: "Category", width: 90  },
  { key: "joiningStatus",      label: "Status",   width: 120 },
  { key: "fmsStatus",          label: "FMS",      width: 68  },
  { key: "fmsScore",           label: "Score",    width: 55  },
  { key: "progress",           label: "Progress", width: 100 },
  { key: "offerAcceptedDate",  label: "Offer",    width: 78  },
  { key: "plannedJoiningDate", label: "Planned",  width: 78  },
  { key: "joinedDate",         label: "Joined",   width: 78  },
  { key: "confirmationDueDate",label: "Conf Due", width: 78  },
  { key: "salRevisionDueDate", label: "Sal Rev",  width: 78  },
  { key: "annualCtc",          label: "CTC",      width: 70  },
  { key: "nameOfBuddy",        label: "Buddy",    width: 110 },
  { key: "tasksOverdue",       label: "Over",     width: 46  },
  { key: "tasksDue",           label: "Pend",     width: 46  },
  { key: "doneInTime",         label: "Done✓",    width: 46  },
];

const TOTAL_COLS = 1 + STICKY.length + SUMMARY_COLS.length + 1;

// ─── Style helpers ────────────────────────────────────────────────────────────
const cell = (w: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: w, minWidth: w, maxWidth: w,
  padding: "3px 7px",
  fontSize: "0.7rem",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  verticalAlign: "middle",
  ...extra,
});

const stickyCell = (left: number, w: number, bg = "#fff"): React.CSSProperties => ({
  ...cell(w),
  position: "sticky",
  left,
  zIndex: 2,
  background: bg,
  boxShadow: "2px 0 5px -2px rgba(0,0,0,0.07)",
});

const headCell = (w: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  ...cell(w, extra),
  background: "#f1f5f9",
  fontWeight: 700,
  fontSize: "0.62rem",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "2px solid #e2e8f0",
});


// ─── Component ────────────────────────────────────────────────────────────────

const OnboardingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows]         = useState<OnboardingRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(0);
  const [rpp, setRpp]           = useState(25);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checkListData, setCheckListData] = useState<Record<string, CheckList[]>>({});
  const [loadingTasks, setLoadingTasks]   = useState<Set<string>>(new Set());
  const [modalRow, setModalRow] = useState<OnboardingRow | null>(null);

  const total   = rows.length;
  const open    = rows.filter(r => r.fmsStatus === "Open").length;
  const closed  = rows.filter(r => r.fmsStatus === "Closed").length;
  const overdue = rows.filter(r => r.fmsStatus === "Open" && (r.fmsScore ?? 0) < 0).length;

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setCheckListData({}); 
      const res = await axios.get(`${API}/onboarding`);
      if (!res.data?.success) throw new Error("Bad response");
      const data: OnboardingRow[] = res.data.data ?? [];
      setRows([...data]
        .filter(r => r.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      );

      // ← ADD THESE TWO LINES HERE
      console.log("Full row keys:", data[0] ? Object.keys(data[0]) : "no data");
      console.log("Full row sample:", JSON.stringify(data[0], null, 2));

    } catch {
      toast.error("Failed to load onboardings");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (id: string) => {
  setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!checkListData[id]) {
    setLoadingTasks(prev => new Set(prev).add(id));
    try {
      const res = await axios.get(`${API}/onboarding/${id}`);
      console.log("Detail response:", JSON.stringify(res.data, null, 2)); 
      const lists = res.data.data?.checkLists ?? [];
      console.log("checkLists structure:", JSON.stringify(lists, null, 2)); // ← HERE
      setCheckListData(prev => ({ ...prev, [id]: lists }));
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoadingTasks(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }
};



  const pct = (r: OnboardingRow) =>
    r.totalTasks ? Math.round(((r.doneInTime ?? 0) / r.totalTasks) * 100) : 0;

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q || [r.name, r.dept, r.designation, r.persEmail,
                  r.mobile, r.officialEmail, r.joiningStatus, r.fmsStatus]
      .some(v => v?.toLowerCase().includes(q));
  });
  const paginated = filtered.slice(page * rpp, page * rpp + rpp);

  // ── Summary cell renderer ─────────────────────────────────────────────────
  const renderSummary = (key: string, row: OnboardingRow) => {
    const val = (row as any)[key];
    switch (key) {
      case "joiningStatus": {
        const map: Record<string, [string, string]> = {
          "Joined":             ["#f0fdf4", "#15803d"],
          "Yet To Join Office": ["#eff6ff", "#1d4ed8"],
          "Not Joining":        ["#fef2f2", "#dc2626"],
        };
        const [bg, color] = map[val] ?? ["#f8fafc", "#64748b"];
        return <span style={{ fontSize: "0.61rem", fontWeight: 600, color, background: bg,
          padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>{val || "—"}</span>;
      }
      case "fmsStatus":
        return <span style={{ fontSize: "0.61rem", fontWeight: 700,
          color: val === "Closed" ? "#15803d" : "#d97706",
          background: val === "Closed" ? "#f0fdf4" : "#fffbeb",
          padding: "1px 5px", borderRadius: 4 }}>{val || "—"}</span>;
      case "fmsScore":
        return <span style={{ fontSize: "0.7rem", fontWeight: 700,
          color: (val ?? 0) < 0 ? "#dc2626" : "#15803d" }}>{val ?? 0}</span>;
      case "progress": {
        const p = pct(row);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ flexGrow: 1, height: 4, borderRadius: 2, bgcolor: "#e2e8f0", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${p}%`, borderRadius: 2,
                bgcolor: p === 100 ? "#15803d" : "#6366f1" }} />
            </Box>
            <span style={{ fontSize: "0.58rem", color: "#94a3b8", flexShrink: 0 }}>{p}%</span>
          </Box>
        );
      }
      case "tasksOverdue":
        return <span style={{ fontSize: "0.7rem", fontWeight: 700,
          color: (val ?? 0) > 0 ? "#dc2626" : "#94a3b8" }}>{val ?? 0}</span>;
      case "tasksDue":
        return <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#d97706" }}>{val ?? 0}</span>;
      case "doneInTime":
        return <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#15803d" }}>{val ?? 0}</span>;
      case "annualCtc":
        return <span style={{ fontSize: "0.68rem", color: "#475569" }}>
          {val ? `₹${(val / 100000).toFixed(1)}L` : "—"}
        </span>;
      case "offerAcceptedDate":
      case "plannedJoiningDate":
      case "joinedDate":
      case "confirmationDueDate":
      case "salRevisionDueDate":
        return <span style={{ fontSize: "0.68rem", color: "#475569" }}>{fmtY(val)}</span>;
      default:
        return <span style={{ fontSize: "0.7rem", color: "#475569" }}>{val || "—"}</span>;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        <Navbar />
        <Box sx={{ p: 2.5, pt: "76px" }}>

          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={700} color="#0f172a" lineHeight={1.2}>
                Onboarding Dashboard
              </Typography>
              <Typography variant="caption" color="#94a3b8">{total} records</Typography>
            </Box>
            <Button variant="contained" startIcon={<AddCircle />}
              onClick={() => navigate("/new-onboarding")}
              sx={{ bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" },
                borderRadius: "8px", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}>
              New Onboarding
            </Button>
          </Box>

          {/* Stats */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            {[
              { label: "Total",     value: total,   color: "#4f46e5", bg: "#eef2ff", Icon: PeopleAlt },
              { label: "Open",      value: open,    color: "#d97706", bg: "#fffbeb", Icon: PendingActions },
              { label: "Completed", value: closed,  color: "#15803d", bg: "#f0fdf4", Icon: AssignmentTurnedIn },
              { label: "Overdue",   value: overdue, color: "#dc2626", bg: "#fef2f2", Icon: Warning },
            ].map(({ label, value, color, bg, Icon }) => (
              <Box key={label} sx={{ flex: "1 1 120px", bgcolor: bg,
                border: `1px solid ${color}30`, borderRadius: "10px",
                p: "10px 14px", display: "flex", alignItems: "center", gap: 1 }}>
                <Icon sx={{ color, fontSize: 18 }} />
                <Box>
                  <Typography fontWeight={800} fontSize="1.1rem" sx={{ color, lineHeight: 1 }}>{value}</Typography>
                  <Typography fontSize="0.62rem" color="#64748b">{label}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Search */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="caption" color="#94a3b8">
              {filtered.length} records{filtered.length !== total ? ` of ${total}` : ""}
              {" · "}
              <span style={{ color: "#6366f1" }}>Click any row to expand tasks</span>
            </Typography>
            <TextField size="small" placeholder="Search…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <InputAdornment position="start">
                  <Search sx={{ fontSize: 14, color: "#94a3b8" }} />
                </InputAdornment>,
              }}
              sx={{ width: 220,
                "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "0.76rem",
                  "& fieldset": { borderColor: "#e2e8f0" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                },
                "& .MuiInputBase-input": { py: "5px" },
              }} />
          </Box>

          {/* Table */}
          <Box sx={{ bgcolor: "#fff", borderRadius: "12px",
            border: "1px solid #e2e8f0", overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={26} sx={{ color: "#4f46e5" }} />
              </Box>
            ) : (
              <>
                <Box sx={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>

                    {/* HEAD */}
                    <thead>
                      <tr>
                        <th style={{ ...headCell(36), position: "sticky", left: 0, zIndex: 5,
                          textAlign: "center" }}>#</th>

                        {STICKY.map(col => (
                          <th key={col.key} style={{
                            ...headCell(col.width),
                            position: "sticky", left: col.left, zIndex: 4,
                            background: "#f1f5f9",
                            boxShadow: col.key === "designation" ? "2px 0 5px -2px rgba(0,0,0,0.07)" : undefined,
                          }}>
                            {col.label}
                          </th>
                        ))}

                        {SUMMARY_COLS.map(col => (
                          <th key={col.key} style={headCell(col.width)}>{col.label}</th>
                        ))}

                        <th style={headCell(60)}>Action</th>
                      </tr>
                    </thead>

                    {/* BODY */}
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr>
                          <td colSpan={TOTAL_COLS} style={{ textAlign: "center",
                            padding: "48px 16px", color: "#94a3b8", fontSize: "0.82rem" }}>
                            {rows.length === 0 ? "No onboardings yet." : "No results match your search."}
                          </td>
                        </tr>
                      ) : paginated.map((row, idx) => {
                        const isExpanded = expanded.has(row._id);
                        const hasTasks = (row.totalTasks ?? 0) > 0;
                        const rowBg      = isExpanded ? "#fafbff" : "#fff";

                        return (
                          <React.Fragment key={row._id}>

                            {/* ── Main row ── */}
                            <tr
                              style={{ cursor: hasTasks ? "pointer" : "default",
                                background: rowBg, transition: "background 0.1s" }}
                              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#fafbff"; }}
                              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = rowBg; }}
                              onClick={e => {
                                e.stopPropagation();
                                if (hasTasks) {
                                  setModalRow(row);
                                  toggleExpand(row._id);
                                }
                              }}
                            >
                              {/* # + expand */}
                              <td style={{ ...cell(36), position: "sticky", left: 0, zIndex: 2,
                                background: rowBg, textAlign: "center" }}>
                                <div style={{ display: "flex", flexDirection: "column",
                                  alignItems: "center", gap: 0 }}>
                                  {hasTasks
                                    ? (isExpanded
                                        ? <KeyboardArrowDown sx={{ fontSize: 13, color: "#6366f1" }} />
                                        : <KeyboardArrowRight sx={{ fontSize: 13, color: "#94a3b8" }} />)
                                    : null}
                                  <span style={{ fontSize: "0.58rem", color: "#cbd5e1" }}>
                                    {page * rpp + idx + 1}
                                  </span>
                                </div>
                              </td>

                              {/* Sticky person cols */}
                              {STICKY.map(col => (
                                <td key={col.key} style={{
                                  ...stickyCell(col.left, col.width, rowBg),
                                  boxShadow: col.key === "designation"
                                    ? "2px 0 5px -2px rgba(0,0,0,0.07)" : undefined,
                                }}>
                                  <Tooltip title={String((row as any)[col.key] || "")} placement="top-start">
                                    <span style={{
                                      fontSize: col.key === "name" ? "0.72rem" : "0.7rem",
                                      fontWeight: col.key === "name" ? 600 : 400,
                                      color: col.key === "name" ? "#1e293b" : "#475569",
                                      display: "block", overflow: "hidden",
                                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}>
                                      {(row as any)[col.key] || "—"}
                                    </span>
                                  </Tooltip>
                                </td>
                              ))}

                              {/* Summary cols */}
                              {SUMMARY_COLS.map(col => (
                                <td key={col.key} style={cell(col.width)}>
                                  {renderSummary(col.key, row)}
                                </td>
                              ))}

                              {/* Action */}
                              <td style={cell(60)}
                                onClick={e => { e.stopPropagation(); navigate(`/onboarding/update/${row._id}`); }}>
                                <button style={{
                                  fontSize: "0.61rem", padding: "2px 7px",
                                  background: "#eef2ff", color: "#4f46e5",
                                  border: "none", borderRadius: 5, cursor: "pointer",
                                  fontWeight: 600, display: "flex", alignItems: "center", gap: 3,
                                }}>
                                  <Edit sx={{ fontSize: "11px !important" }} /> Edit
                                </button>
                              </td>
                            </tr>

                            {/* ── Expanded task panel ── */}
                            {/* ── Expanded task panel ── */}
                            

                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* ── Checklist Modal ── */}
                    {modalRow && (
                      <Box
                        onClick={() => setModalRow(null)}
                        sx={{
                          position: "fixed", inset: 0, zIndex: 1300,
                          bgcolor: "rgba(15,23,42,0.55)",
                          backdropFilter: "blur(4px)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          p: 2,
                        }}
                      >
                        <Box
                          onClick={e => e.stopPropagation()}
                          sx={{
                            bgcolor: "#fff", borderRadius: "16px",
                            width: "100%", maxWidth: 900,
                            maxHeight: "88vh", overflow: "hidden",
                            display: "flex", flexDirection: "column",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                          }}
                        >
                          {/* Modal header */}
                          <Box sx={{
                            px: 3, py: 2,
                            borderBottom: "1px solid #e2e8f0",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            flexShrink: 0,
                          }}>
                            <Box>
                              <Typography fontWeight={700} fontSize="1rem" color="#0f172a">
                                {modalRow.name}
                              </Typography>
                              <Typography fontSize="0.72rem" color="#94a3b8">
                                {modalRow.dept} · {modalRow.designation}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              {/* summary pills */}
                              {(checkListData[modalRow._id] ?? []).map((list, gi) => {
                                const done = list.itemsList.filter(it => it.doneDate).length;
                                const tot  = list.itemsList.length;
                                const pct  = tot ? Math.round((done / tot) * 100) : 0;
                                return (
                                  <Box key={gi} sx={{
                                    display: "flex", alignItems: "center", gap: 0.5,
                                    px: 1, py: 0.3,
                                    bgcolor: `${GROUP_COLORS[gi]}10`,
                                    borderLeft: `3px solid ${GROUP_COLORS[gi]}`,
                                    borderRadius: "4px",
                                  }}>
                                    <Typography fontSize="0.6rem" fontWeight={700} color={GROUP_COLORS[gi]}>
                                      {list.name.split(" ")[0]}
                                    </Typography>
                                    <Typography fontSize="0.58rem" color="#94a3b8">
                                      {done}/{tot} · {pct}%
                                    </Typography>
                                  </Box>
                                );
                              })}
                              <button
                                onClick={() => setModalRow(null)}
                                style={{
                                  background: "#f1f5f9", border: "none", borderRadius: "8px",
                                  width: 30, height: 30, cursor: "pointer",
                                  fontSize: "1rem", color: "#64748b",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >✕</button>
                            </Box>
                          </Box>

                          {/* Modal body */}
                          <Box sx={{ overflowY: "auto", p: 2.5 }}>
                            {loadingTasks.has(modalRow._id) ? (
                              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                                <CircularProgress size={24} sx={{ color: "#4f46e5" }} />
                              </Box>
                            ) : (
                              <Box sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
                                gap: 2,
                              }}>
                                {(checkListData[modalRow._id] ?? []).map((list, gi) => (
                                  <Box key={gi} sx={{
                                    bgcolor: "#fff",
                                    border: `1px solid ${GROUP_COLORS[gi]}25`,
                                    borderTop: `3px solid ${GROUP_COLORS[gi]}`,
                                    borderRadius: "10px", overflow: "hidden",
                                  }}>
                                    {/* group header */}
                                    <Box sx={{
                                      px: 1.5, py: 1,
                                      bgcolor: `${GROUP_COLORS[gi]}08`,
                                      borderBottom: `1px solid ${GROUP_COLORS[gi]}15`,
                                      display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                      <Typography fontSize="0.7rem" fontWeight={700} color={GROUP_COLORS[gi]}>
                                        {list.name}
                                      </Typography>
                                      {list.planDate && (
                                        <Typography fontSize="0.62rem" color="#94a3b8">
                                          Plan: <strong>{fmtY(list.planDate)}</strong>
                                        </Typography>
                                      )}
                                    </Box>
                                    {/* task table */}
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                      <thead>
                                        <tr style={{ background: "#f8fafc" }}>
                                          {["#", "Task", "Status", "Plan", "Done", "Score"].map(h => (
                                            <th key={h} style={{
                                              padding: "4px 8px", fontSize: "0.58rem", fontWeight: 700,
                                              color: "#94a3b8", textTransform: "uppercase",
                                              textAlign: h === "#" ? "center" : "left",
                                              borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap",
                                            }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {list.itemsList.map((item, ii) => {
                                          const sc     = STATUS_COLOR[item.status ?? ""] ?? { bg: "#f8fafc", text: "#94a3b8", short: "—" };
                                          const isDone = !!item.doneDate;
                                          return (
                                            <tr key={ii} style={{
                                              background: ii % 2 === 0 ? "#fff" : "#fafafa",
                                              borderBottom: "1px solid #f5f5f5",
                                            }}>
                                              <td style={{ padding: "3px 8px", fontSize: "0.6rem", color: "#cbd5e1", textAlign: "center", width: 22 }}>{ii + 1}</td>
                                              <td style={{ padding: "4px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                <Tooltip title={item.name || ""} placement="top-start">
                                                  <span style={{
                                                    fontSize: "0.7rem",
                                                    color: isDone ? "#94a3b8" : "#1e293b",
                                                    textDecoration: isDone ? "line-through" : "none",
                                                  }}>{item.name || "—"}</span>
                                                </Tooltip>
                                              </td>
                                              <td style={{ padding: "3px 8px", whiteSpace: "nowrap" }}>
                                                <span style={{ fontSize: "0.58rem", fontWeight: 700, color: sc.text, background: sc.bg, padding: "1px 6px", borderRadius: 3 }}>{sc.short}</span>
                                              </td>
                                              <td style={{ padding: "3px 8px", fontSize: "0.68rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmt(item.planDate)}</td>
                                              <td style={{ padding: "3px 8px", fontSize: "0.68rem", color: isDone ? "#15803d" : "#cbd5e1", fontWeight: isDone ? 600 : 400, whiteSpace: "nowrap" }}>{fmt(item.doneDate)}</td>
                                              <td style={{ padding: "3px 8px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                                                color: item.score && item.score < 0 ? "#dc2626" : "#cbd5e1" }}>
                                                {item.score && item.score < 0 ? `${item.score}d` : "—"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    )}
                </Box>

                <TablePagination
                  component="div"
                  count={filtered.length}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rpp}
                  onRowsPerPageChange={e => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  sx={{ borderTop: "1px solid #f1f5f9",
                    "& .MuiTablePagination-toolbar": { minHeight: 40 },
                    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                      { fontSize: "0.75rem" },
                  }}
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default OnboardingDashboard;