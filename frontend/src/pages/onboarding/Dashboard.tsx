import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import dayjs from "dayjs";
import {
  Box, Typography, Button, TextField,
  InputAdornment, TablePagination, CircularProgress, Tooltip, Chip,
} from "@mui/material";
import {
  AddCircle, Search, Edit, Refresh,
  PeopleAlt, AssignmentTurnedIn, PendingActions, Warning,
  Close, Visibility, CalendarToday, Person, Email, Phone,
  Business, WorkOutline, AccountBalance,
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
  updatedAt?: string;
  checkLists?: CheckList[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = process.env.REACT_APP_REACT_APP_API_BASE_URL ?? "";
const fmt  = (d?: string | null) => d ? dayjs(d).format("DD MMM") : "—";
const fmtY = (d?: string | null) => d ? dayjs(d).format("DD MMM YY") : "—";

const GROUP_COLORS = ["#7c3aed", "#0284c7", "#059669", "#d97706"];

const STATUS_COLOR: Record<string, { bg: string; text: string; short: string }> = {
  "DONE":           { bg: "#f0fdf4", text: "#15803d", short: "DONE"  },
  "DONE (DELAYED)": { bg: "#eff6ff", text: "#1d4ed8", short: "DELAY" },
  "OVERDUE":        { bg: "#fef2f2", text: "#dc2626", short: "OVER"  },
  "PENDING":        { bg: "#fffbeb", text: "#d97706", short: "PEND"  },
  "NOT YET DUE":    { bg: "#f8fafc", text: "#94a3b8", short: "NYD"   },
};

const JOINING_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "Joined":             { bg: "#f0fdf4", color: "#15803d" },
  "Yet To Join Office": { bg: "#eff6ff", color: "#1d4ed8" },
  "Not Joining":        { bg: "#fef2f2", color: "#dc2626" },
};

// ─── Pill component ───────────────────────────────────────────────────────────

const Pill: React.FC<{ label: string; bg: string; color: string }> = ({ label, bg, color }) => (
  <span style={{
    fontSize: "0.6rem", fontWeight: 700, color, background: bg,
    padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-block",
  }}>{label}</span>
);

// ─── Progress bar ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 80 }}>
    <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: "#e2e8f0", overflow: "hidden" }}>
      <Box sx={{
        height: "100%", width: `${value}%`, borderRadius: 3,
        bgcolor: value === 100 ? "#15803d" : "#6366f1",
        transition: "width 0.4s ease",
      }} />
    </Box>
    <span style={{ fontSize: "0.62rem", color: "#94a3b8", minWidth: 26 }}>{value}%</span>
  </Box>
);

// ─── Detail field ─────────────────────────────────────────────────────────────

const DetailField: React.FC<{ label: string; value?: string | number | null; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
    <Typography fontSize="0.6rem" color="#94a3b8" textTransform="uppercase" letterSpacing="0.06em" fontWeight={600}>
      {icon && <span style={{ marginRight: 4, verticalAlign: "middle", opacity: 0.7 }}>{icon}</span>}
      {label}
    </Typography>
    <Typography fontSize="0.8rem" color="#1e293b" fontWeight={500}>
      {value || "—"}
    </Typography>
  </Box>
);

// ─── Component ────────────────────────────────────────────────────────────────

const OnboardingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows]           = useState<OnboardingRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [fmsFilter, setFmsFilter] = useState<"All" | "Open" | "Closed">("All");
  const [page, setPage]           = useState(0);
  const [rpp, setRpp]             = useState(25);
  const [viewModal, setViewModal] = useState<{ row: OnboardingRow; lists: CheckList[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const total   = rows.length;
  const open    = rows.filter(r => r.fmsStatus === "Open").length;
  const closed  = rows.filter(r => r.fmsStatus === "Closed").length;
  const overdue = rows.filter(r => r.fmsStatus === "Open" && (r.fmsScore ?? 0) < 0).length;

  useEffect(() => {
    load();

    // Refetch whenever the user comes back to this tab/window — covers the
    // common case of updating a record in another tab (or the Update
    // Onboarding page) and switching back here without a manual reload.
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") load(true);
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const res = await axios.get(`${API}/onboarding`, {
        params: { _t: Date.now() },
      });
      if (!res.data?.success) throw new Error("Bad response");
      const data: OnboardingRow[] = res.data.data ?? [];
      // Sort by the person's actual joining date — joinedDate if they've
      // joined, otherwise plannedJoiningDate for anyone still upcoming.
      // Records with neither sink to the bottom.
      const sortKey = (r: OnboardingRow) => {
        const d = r.joinedDate ?? r.plannedJoiningDate;
        return d ? new Date(d).getTime() : -Infinity;
      };
      setRows([...data].sort((a, b) => sortKey(b) - sortKey(a)));
    } catch {
      toast.error("Failed to load onboardings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openViewModal = async (row: OnboardingRow) => {
    setLoadingDetail(row._id);
    try {
      const res = await axios.get(`${API}/onboarding/${row._id}`, {
        params: { _t: Date.now() },
      });
      const lists: CheckList[] = res.data.data?.checkLists ?? [];
      setViewModal({ row, lists });
    } catch {
      toast.error("Failed to load details");
    } finally {
      setLoadingDetail(null);
    }
  };

  const pct = (r: OnboardingRow) =>
    r.totalTasks ? Math.round(((r.doneInTime ?? 0) / r.totalTasks) * 100) : 0;

  const filtered = rows.filter(r => {
    if (fmsFilter !== "All" && r.fmsStatus !== fmsFilter) return false;
    const q = search.toLowerCase();
    return !q || [r.name, r.dept, r.designation, r.persEmail,
                  r.mobile, r.officialEmail, r.joiningStatus, r.fmsStatus]
      .some(v => v?.toLowerCase().includes(q));
  });
  const paginated = filtered.slice(page * rpp, page * rpp + rpp);

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
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Tooltip title="Refresh data">
                <Button
                  variant="outlined"
                  onClick={() => load(true)}
                  disabled={refreshing || loading}
                  startIcon={refreshing
                    ? <CircularProgress size={14} sx={{ color: "#4f46e5" }} />
                    : <Refresh sx={{ fontSize: 16 }} />}
                  sx={{ borderColor: "#e2e8f0", color: "#475569",
                    borderRadius: "8px", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
                >
                  Refresh
                </Button>
              </Tooltip>
              <Button variant="contained" startIcon={<AddCircle />}
                onClick={() => navigate("/new-onboarding")}
                sx={{ bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" },
                  borderRadius: "8px", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}>
                New Onboarding
              </Button>
            </Box>
          </Box>

          {/* Stats */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
            {[
              { label: "Total",     value: total,   color: "#4f46e5", bg: "#eef2ff", Icon: PeopleAlt },
              { label: "Open",      value: open,    color: "#d97706", bg: "#fffbeb", Icon: PendingActions },
              { label: "Completed", value: closed,  color: "#15803d", bg: "#f0fdf4", Icon: AssignmentTurnedIn },
              { label: "Overdue",   value: overdue, color: "#dc2626", bg: "#fef2f2", Icon: Warning },
            ].map(({ label, value, color, bg, Icon }) => (
              <Box key={label} sx={{ flex: "1 1 110px", bgcolor: bg,
                border: `1px solid ${color}25`, borderRadius: "10px",
                p: "10px 14px", display: "flex", alignItems: "center", gap: 1 }}>
                <Icon sx={{ color, fontSize: 18 }} />
                <Box>
                  <Typography fontWeight={800} fontSize="1.1rem" sx={{ color, lineHeight: 1 }}>{value}</Typography>
                  <Typography fontSize="0.62rem" color="#64748b">{label}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Search + count */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="caption" color="#94a3b8">
              {filtered.length} records{filtered.length !== total ? ` of ${total}` : ""}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                {(["All", "Open", "Closed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFmsFilter(f); setPage(0); }}
                    style={{
                      border: "none", cursor: "pointer", padding: "6px 12px",
                      fontSize: "0.75rem", fontWeight: 600,
                      background: fmsFilter === f ? "#4f46e5" : "#fff",
                      color: fmsFilter === f ? "#fff" : "#64748b",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </Box>
              <TextField size="small" placeholder="Search name, dept, email…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">
                    <Search sx={{ fontSize: 14, color: "#94a3b8" }} />
                  </InputAdornment>,
                }}
                sx={{ width: 240,
                  "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "0.76rem",
                    "& fieldset": { borderColor: "#e2e8f0" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                  },
                  "& .MuiInputBase-input": { py: "5px" },
                }} />
            </Box>
          </Box>

          {/* Card list */}
          <Box sx={{ bgcolor: "#fff", borderRadius: "12px",
            border: "1px solid #e2e8f0", overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={26} sx={{ color: "#4f46e5" }} />
              </Box>
            ) : paginated.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8, color: "#94a3b8", fontSize: "0.85rem" }}>
                {rows.length === 0 ? "No onboardings yet. Add one to get started." : "No results match your search."}
              </Box>
            ) : (
              <>
                {/* Column header */}
                <Box sx={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 90px 120px 90px 90px",
                  gap: 1, px: 2, py: 1,
                  bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0",
                }}>
                  {["Employee", "Department", "Status", "FMS", "Progress", "Tasks", "Actions"].map(h => (
                    <Typography key={h} fontSize="0.6rem" fontWeight={700} color="#94a3b8"
                      textTransform="uppercase" letterSpacing="0.06em">{h}</Typography>
                  ))}
                </Box>

                {/* Rows */}
                {paginated.map((row, idx) => {
                  const jsStyle = JOINING_STATUS_STYLE[row.joiningStatus ?? ""] ?? { bg: "#f8fafc", color: "#64748b" };
                  const progress = pct(row);
                  const isLoadingThis = loadingDetail === row._id;
                  const isClosed = row.fmsStatus === "Closed";

                  return (
                    <Box
                      key={row._id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 90px 120px 90px 90px",
                        gap: 1, px: 2, py: 1.5,
                        borderBottom: idx < paginated.length - 1 ? "1px solid #f1f5f9" : "none",
                        alignItems: "center",
                        bgcolor: isClosed ? "#f8fafc" : "transparent",
                        opacity: isClosed ? 0.6 : 1,
                        "&:hover": { bgcolor: isClosed ? "#f1f5f9" : "#fafbff" },
                        transition: "background 0.1s",
                      }}
                    >
                      {/* Employee */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4, minWidth: 0 }}>
                        <Typography fontSize="0.8rem" fontWeight={600} color={isClosed ? "#64748b" : "#0f172a"}
                          noWrap sx={{ lineHeight: 1.3 }}>
                          {row.name}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                          <Typography fontSize="0.65rem" color="#64748b" noWrap>
                            {row.designation || "—"}
                          </Typography>
                          {row.employeeCategory && (
                            <Pill label={row.employeeCategory} bg="#f1f5f9" color="#475569" />
                          )}
                        </Box>
                        <Typography fontSize="0.62rem" color="#94a3b8" noWrap>
                          {row.persEmail || row.officialEmail || "—"}
                        </Typography>
                      </Box>

                      {/* Department */}
                      <Box>
                        <Typography fontSize="0.75rem" color={isClosed ? "#64748b" : "#334155"} noWrap fontWeight={500}>
                          {row.dept || "—"}
                        </Typography>
                        <Typography fontSize="0.62rem" color="#94a3b8" noWrap sx={{ mt: 0.2 }}>
                          {fmtY(row.plannedJoiningDate) !== "—"
                            ? `Joining: ${fmtY(row.plannedJoiningDate)}`
                            : row.joinedDate ? `Joined: ${fmtY(row.joinedDate)}` : ""}
                        </Typography>
                      </Box>

                      {/* Status */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Pill
                          label={row.joiningStatus || "—"}
                          bg={isClosed ? "#f1f5f9" : jsStyle.bg}
                          color={isClosed ? "#94a3b8" : jsStyle.color}
                        />
                        {(row.fmsScore ?? 0) !== 0 && (
                          <Typography fontSize="0.62rem"
                            color={isClosed ? "#94a3b8" : (row.fmsScore ?? 0) < 0 ? "#dc2626" : "#15803d"} fontWeight={700}>
                            Score: {row.fmsScore}
                          </Typography>
                        )}
                      </Box>

                      {/* FMS */}
                      <Box>
                        <Pill
                          label={row.fmsStatus || "—"}
                          bg={isClosed ? "#e2e8f0" : "#fffbeb"}
                          color={isClosed ? "#64748b" : "#d97706"}
                        />
                      </Box>

                      {/* Progress */}
                      <Box>
                        <ProgressBar value={progress} />
                        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                          {!isClosed && (row.tasksOverdue ?? 0) > 0 && (
                            <Typography fontSize="0.6rem" color="#dc2626" fontWeight={700}>
                              {row.tasksOverdue} overdue
                            </Typography>
                          )}
                          {!isClosed && (row.tasksDue ?? 0) > 0 && (
                            <Typography fontSize="0.6rem" color="#d97706" fontWeight={700}>
                              {row.tasksDue} pending
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {/* Task counts */}
                      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                        <Tooltip title="Done on time">
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center",
                            px: 0.8, py: 0.3, bgcolor: "#f0fdf4", borderRadius: 1 }}>
                            <Typography fontSize="0.72rem" fontWeight={800} color="#15803d">
                              {row.doneInTime ?? 0}
                            </Typography>
                            <Typography fontSize="0.52rem" color="#86efac">Done</Typography>
                          </Box>
                        </Tooltip>
                        <Tooltip title="Total tasks">
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center",
                            px: 0.8, py: 0.3, bgcolor: "#f8fafc", borderRadius: 1 }}>
                            <Typography fontSize="0.72rem" fontWeight={800} color="#64748b">
                              {row.totalTasks ?? 0}
                            </Typography>
                            <Typography fontSize="0.52rem" color="#94a3b8">Total</Typography>
                          </Box>
                        </Tooltip>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: "flex", gap: 0.7 }}>
                        <Tooltip title="View all details">
                          <button
                            onClick={() => openViewModal(row)}
                            disabled={isLoadingThis}
                            style={{
                              display: "flex", alignItems: "center", gap: 3,
                              fontSize: "0.61rem", padding: "4px 8px",
                              background: "#eef2ff", color: "#4f46e5",
                              border: "none", borderRadius: 6, cursor: "pointer",
                              fontWeight: 600, opacity: isLoadingThis ? 0.6 : 1,
                            }}
                          >
                            {isLoadingThis
                              ? <CircularProgress size={10} sx={{ color: "#4f46e5" }} />
                              : <Visibility sx={{ fontSize: "11px !important" }} />
                            }
                            View
                          </button>
                        </Tooltip>
                        <Tooltip title="Edit onboarding">
                          <button
                            onClick={() => navigate(`/onboarding/update/${row._id}`)}
                            style={{
                              display: "flex", alignItems: "center", gap: 3,
                              fontSize: "0.61rem", padding: "4px 8px",
                              background: "#f8fafc", color: "#64748b",
                              border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <Edit sx={{ fontSize: "11px !important" }} /> Edit
                          </button>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}

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

      {/* ── View Modal ─────────────────────────────────────────────────────────── */}
      {viewModal && (
        <Box
          onClick={() => setViewModal(null)}
          sx={{
            position: "fixed", inset: 0, zIndex: 1300,
            bgcolor: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            p: 2,
          }}
        >
          <Box
            onClick={e => e.stopPropagation()}
            sx={{
              bgcolor: "#fff", borderRadius: "16px",
              width: "100%", maxWidth: 860,
              maxHeight: "90vh", overflow: "hidden",
              display: "flex", flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            }}
          >
            {/* Modal header */}
            <Box sx={{
              px: 3, py: 2, flexShrink: 0,
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            }}>
              <Box>
                <Typography fontWeight={700} fontSize="1.1rem" color="#fff">
                  {viewModal.row.name}
                </Typography>
                <Typography fontSize="0.72rem" color="rgba(255,255,255,0.75)" sx={{ mt: 0.3 }}>
                  {viewModal.row.designation} · {viewModal.row.dept}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                  {viewModal.row.joiningStatus && (
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700,
                      background: "rgba(255,255,255,0.2)", color: "#fff",
                      padding: "2px 8px", borderRadius: 20, backdropFilter: "blur(4px)",
                    }}>{viewModal.row.joiningStatus}</span>
                  )}
                  {viewModal.row.fmsStatus && (
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700,
                      background: "rgba(255,255,255,0.2)", color: "#fff",
                      padding: "2px 8px", borderRadius: 20,
                    }}>FMS: {viewModal.row.fmsStatus}</span>
                  )}
                  {viewModal.row.employeeCategory && (
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700,
                      background: "rgba(255,255,255,0.15)", color: "#fff",
                      padding: "2px 8px", borderRadius: 20,
                    }}>{viewModal.row.employeeCategory}</span>
                  )}
                </Box>
              </Box>
              <button
                onClick={() => setViewModal(null)}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "none",
                  borderRadius: "8px", width: 30, height: 30,
                  cursor: "pointer", color: "#fff", fontSize: "1rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              ><Close fontSize="small" /></button>
            </Box>

            {/* Modal body */}
            <Box sx={{ overflowY: "auto", p: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>

              {/* Contact info */}
              <Box>
                <Typography fontSize="0.65rem" fontWeight={700} color="#94a3b8"
                  textTransform="uppercase" letterSpacing="0.08em" mb={1.2}>
                  Contact Information
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2 }}>
                  <DetailField label="Personal Email" value={viewModal.row.persEmail} />
                  <DetailField label="Official Email" value={viewModal.row.officialEmail} />
                  <DetailField label="Mobile" value={viewModal.row.mobile} />
                  <DetailField label="Gender" value={viewModal.row.gender} />
                </Box>
              </Box>

              <Box sx={{ height: 1, bgcolor: "#f1f5f9" }} />

              {/* Role & compensation */}
              <Box>
                <Typography fontSize="0.65rem" fontWeight={700} color="#94a3b8"
                  textTransform="uppercase" letterSpacing="0.08em" mb={1.2}>
                  Role & Compensation
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 2 }}>
                  <DetailField label="Department" value={viewModal.row.dept} />
                  <DetailField label="Designation" value={viewModal.row.designation} />
                  <DetailField label="Category" value={viewModal.row.employeeCategory} />
                  <DetailField label="Annual CTC"
                    value={viewModal.row.annualCtc
                      ? `₹${(viewModal.row.annualCtc / 100000).toFixed(2)}L`
                      : undefined} />
                  <DetailField label="Buddy" value={viewModal.row.nameOfBuddy} />
                  <DetailField label="Laptop / PC" value={viewModal.row.laptopPc} />
                </Box>
              </Box>

              <Box sx={{ height: 1, bgcolor: "#f1f5f9" }} />

              {/* Timeline */}
              <Box>
                <Typography fontSize="0.65rem" fontWeight={700} color="#94a3b8"
                  textTransform="uppercase" letterSpacing="0.08em" mb={1.2}>
                  Key Dates
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  {[
                    { label: "Offer Accepted",   value: viewModal.row.offerAcceptedDate },
                    { label: "Planned Joining",   value: viewModal.row.plannedJoiningDate },
                    { label: "Joined On",         value: viewModal.row.joinedDate },
                    { label: "Confirmation Due",  value: viewModal.row.confirmationDueDate },
                    { label: "Sal Revision Due",  value: viewModal.row.salRevisionDueDate },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{
                      px: 1.5, py: 1, bgcolor: "#f8fafc",
                      border: "1px solid #e2e8f0", borderRadius: "8px",
                      minWidth: 120,
                    }}>
                      <Typography fontSize="0.58rem" color="#94a3b8" textTransform="uppercase"
                        letterSpacing="0.06em" fontWeight={600}>{label}</Typography>
                      <Typography fontSize="0.8rem" color={value ? "#0f172a" : "#cbd5e1"} fontWeight={600} mt={0.3}>
                        {fmtY(value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* FMS Score + task summary */}
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                {[
                  { label: "FMS Score", value: viewModal.row.fmsScore ?? 0,
                    color: (viewModal.row.fmsScore ?? 0) < 0 ? "#dc2626" : "#15803d",
                    bg: (viewModal.row.fmsScore ?? 0) < 0 ? "#fef2f2" : "#f0fdf4" },
                  { label: "Done on Time", value: viewModal.row.doneInTime ?? 0, color: "#15803d", bg: "#f0fdf4" },
                  { label: "Overdue", value: viewModal.row.tasksOverdue ?? 0,
                    color: (viewModal.row.tasksOverdue ?? 0) > 0 ? "#dc2626" : "#94a3b8",
                    bg: (viewModal.row.tasksOverdue ?? 0) > 0 ? "#fef2f2" : "#f8fafc" },
                  { label: "Pending", value: viewModal.row.tasksDue ?? 0, color: "#d97706", bg: "#fffbeb" },
                  { label: "Total Tasks", value: viewModal.row.totalTasks ?? 0, color: "#4f46e5", bg: "#eef2ff" },
                ].map(({ label, value, color, bg }) => (
                  <Box key={label} sx={{ px: 1.5, py: 1, bgcolor: bg,
                    border: `1px solid ${color}25`, borderRadius: "8px", textAlign: "center", minWidth: 80 }}>
                    <Typography fontSize="1rem" fontWeight={800} color={color}>{value}</Typography>
                    <Typography fontSize="0.58rem" color="#64748b">{label}</Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1, px: 1.5, py: 1, bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex",
                  flexDirection: "column", justifyContent: "center", minWidth: 140 }}>
                  <Typography fontSize="0.58rem" color="#94a3b8" mb={0.5}>Overall Progress</Typography>
                  <ProgressBar value={pct(viewModal.row)} />
                </Box>
              </Box>

              {/* Remarks */}
              {viewModal.row.remarks && (
                <Box sx={{ p: 1.5, bgcolor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px" }}>
                  <Typography fontSize="0.6rem" fontWeight={700} color="#92400e"
                    textTransform="uppercase" letterSpacing="0.06em" mb={0.5}>Remarks</Typography>
                  <Typography fontSize="0.75rem" color="#78350f">{viewModal.row.remarks}</Typography>
                </Box>
              )}

              {/* Checklists */}
              {viewModal.lists.length > 0 && (
                <>
                  <Box sx={{ height: 1, bgcolor: "#f1f5f9" }} />
                  <Box>
                    <Typography fontSize="0.65rem" fontWeight={700} color="#94a3b8"
                      textTransform="uppercase" letterSpacing="0.08em" mb={1.5}>
                      Onboarding Checklists
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 2 }}>
                      {viewModal.lists.map((list, gi) => {
                        const done = list.itemsList.filter(it => it.doneDate).length;
                        const tot  = list.itemsList.length;
                        const listPct = tot ? Math.round((done / tot) * 100) : 0;
                        return (
                          <Box key={gi} sx={{
                            bgcolor: "#fff",
                            border: `1px solid ${GROUP_COLORS[gi]}20`,
                            borderTop: `3px solid ${GROUP_COLORS[gi]}`,
                            borderRadius: "10px", overflow: "hidden",
                          }}>
                            {/* group header */}
                            <Box sx={{
                              px: 1.5, py: 1,
                              bgcolor: `${GROUP_COLORS[gi]}06`,
                              borderBottom: `1px solid ${GROUP_COLORS[gi]}15`,
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                            }}>
                              <Typography fontSize="0.72rem" fontWeight={700} color={GROUP_COLORS[gi]}>
                                {list.name}
                              </Typography>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {list.planDate && (
                                  <Typography fontSize="0.6rem" color="#94a3b8">
                                    Plan: <strong>{fmtY(list.planDate)}</strong>
                                  </Typography>
                                )}
                                <Typography fontSize="0.62rem" fontWeight={700} color={GROUP_COLORS[gi]}>
                                  {done}/{tot} ({listPct}%)
                                </Typography>
                              </Box>
                            </Box>

                            {/* progress bar */}
                            <Box sx={{ px: 1.5, py: 0.8, borderBottom: `1px solid ${GROUP_COLORS[gi]}10` }}>
                              <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#e2e8f0", overflow: "hidden" }}>
                                <Box sx={{ height: "100%", width: `${listPct}%`, borderRadius: 2,
                                  bgcolor: GROUP_COLORS[gi], transition: "width 0.4s ease" }} />
                              </Box>
                            </Box>

                            {/* task table */}
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                  {["#", "Task", "Status", "Plan", "Done", "Δ"].map(h => (
                                    <th key={h} style={{
                                      padding: "4px 8px", fontSize: "0.56rem", fontWeight: 700,
                                      color: "#94a3b8", textTransform: "uppercase",
                                      textAlign: h === "#" || h === "Δ" ? "center" : "left",
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
                                      <td style={{ padding: "3px 8px", fontSize: "0.58rem", color: "#cbd5e1", textAlign: "center", width: 22 }}>{ii + 1}</td>
                                      <td style={{ padding: "4px 8px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        <Tooltip title={item.name || ""} placement="top-start">
                                          <span style={{
                                            fontSize: "0.7rem",
                                            color: isDone ? "#94a3b8" : "#1e293b",
                                            textDecoration: isDone ? "line-through" : "none",
                                          }}>{item.name || "—"}</span>
                                        </Tooltip>
                                      </td>
                                      <td style={{ padding: "3px 8px", whiteSpace: "nowrap" }}>
                                        <span style={{ fontSize: "0.57rem", fontWeight: 700, color: sc.text, background: sc.bg, padding: "1px 5px", borderRadius: 3 }}>{sc.short}</span>
                                      </td>
                                      <td style={{ padding: "3px 8px", fontSize: "0.66rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmt(item.planDate)}</td>
                                      <td style={{ padding: "3px 8px", fontSize: "0.66rem", color: isDone ? "#15803d" : "#cbd5e1", fontWeight: isDone ? 600 : 400, whiteSpace: "nowrap" }}>{fmt(item.doneDate)}</td>
                                      <td style={{ padding: "3px 8px", fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap", textAlign: "center",
                                        color: item.score && item.score < 0 ? "#dc2626" : "#cbd5e1" }}>
                                        {item.score && item.score < 0 ? `${item.score}d` : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default OnboardingDashboard;