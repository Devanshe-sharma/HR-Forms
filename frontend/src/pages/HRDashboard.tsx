import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import HRKpiScorecard, { ModuleKpiRow, MODULES } from "../components/HRKpiScorecard";
import {
  Box, Typography, CircularProgress, Tooltip as MuiTooltip,
  Dialog, DialogContent, IconButton,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LabelList,
} from "recharts";
import CloseIcon from "@mui/icons-material/Close";
import BalanceIcon from "@mui/icons-material/BalanceOutlined";
import WcIcon from "@mui/icons-material/WcOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import WorkIcon from "@mui/icons-material/WorkOutline";
import HowToRegIcon from "@mui/icons-material/HowToRegOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToAppOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHorizOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUpOutlined";
import AssessmentIcon from "@mui/icons-material/AssessmentOutlined";
import GroupAddIcon from "@mui/icons-material/GroupAddOutlined";
import PaidIcon from "@mui/icons-material/PaidOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import PersonRemoveIcon from "@mui/icons-material/PersonRemoveOutlined";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import TimelineIcon from "@mui/icons-material/TimelineOutlined";
import TrendingDownIcon from "@mui/icons-material/TrendingDownOutlined";

// ─── Config ─────────────────────────────────────────────────────────────────

const API = process.env.REACT_APP_REACT_APP_API_BASE_URL ?? "";
const ACCENT = "#4f46e5";
const TEETH_COLOR = "#059669";
const TAIL_COLOR = "#d97706";
const UNCAT_COLOR = "#94a3b8";
const GENDER_COLORS: Record<string, string> = {
  Male: "#2563eb",
  Female: "#db2777",
  "Not Specified": "#94a3b8",
};
const GENDER_FALLBACK_COLORS = ["#0891b2", "#7c3aed", "#ea580c", "#65a30d"];
const INTERN_COLOR = "#7c3aed";
const NON_INTERN_COLOR = "#cbd5e1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuarterData {
  quarter: string;
  asOf: string;
  teeth: number;
  tail: number;
  uncategorized: number;
  total: number;
  ratio: number | null;
}

interface DepartmentBreakdownRow {
  department: string;
  category: "Teeth" | "Tail" | "Uncategorized";
  count: number;
}

interface TeethToTailResponse {
  success: boolean;
  year: number;
  quarters: QuarterData[];
  availableYears: number[];
  departmentBreakdown: DepartmentBreakdownRow[];
  missingJoinDateCount: number;
}

interface GenderOverall {
  gender: string;
  count: number;
}

interface GenderByDeptRow {
  department: string;
  [gender: string]: string | number;
}

interface GenderQuarterRow {
  quarter: string;
  asOf: string;
  total: number;
  genderCounts: Record<string, number>;
}

interface GenderResponse {
  success: boolean;
  year: number;
  availableYears: number[];
  quarters: GenderQuarterRow[];
  total: number;
  genders: string[];
  overall: GenderOverall[];
  byDepartment: GenderByDeptRow[];
  missingJoinDateCount: number;
}

interface AttritionQuarterRow {
  quarter: string;
  asOf: string;
  opening: number;
  closing: number;
  employeesLeft: number;
  avgHeadcount: number;
  attritionPct: number;
  retentionPct: number | null;
}
interface AttritionResponse {
  success: boolean;
  year: number;
  quarters: AttritionQuarterRow[];
  availableYears: number[];
}

interface InternDeptRow {
  department: string;
  interns: number;
  total: number;
  pct: number;
}

interface InternQuarterRow {
  quarter: string;
  asOf: string;
  total: number;
  internsCount: number;
  internPct: number;
}
interface InternsResponse {
  success: boolean;
  total: number;
  internsCount: number;
  internPct: number;
  nonInternsCount: number;
  departmentBreakdown: InternDeptRow[];
  year: number;
  quarters: InternQuarterRow[];
  availableYears: number[];
  missingJoinDateCount: number;
}

interface DaysToHireBucket { avgDays: number | null; count: number; }
interface DaysToHireQuarterRow {
  quarter: string;
  overall: DaysToHireBucket;
  fresher: DaysToHireBucket;
  experienced: DaysToHireBucket;
}
interface DaysToHireResponse {
  success: boolean;
  overall: DaysToHireBucket;
  fresher: DaysToHireBucket;
  experienced: DaysToHireBucket;
  excludedCount: number;
  year: number;
  quarters: DaysToHireQuarterRow[];
  availableYears: number[];
}

// Minimal shape needed just for the KPI summary cards — the full
// QuarterRow/QuarterResponse types live in HRKpiScorecard.tsx itself.
interface KpiQuarterRow {
  quarter: string;
  onTime: number;
  delayed: number;
  overdue: number;
  pending: number;
}
interface KpiQuarterResponse {
  quarters: KpiQuarterRow[];
}

interface IncrementRow {
  employeeName: string;
  department: string;
  designation: string;
  incrementPct: number;
  revisionCount: number;
}
interface IncrementQuarterRow {
  quarter: string;
  total: number;
  avgIncrementPct: number | null;
}
interface IncrementsResponse {
  success: boolean;
  year: number;
  availableYears: number[];
  total: number;
  avgIncrementPct: number | null;
  lowIncrementCount: number;
  lowIncrementList: IncrementRow[];
  highPerformerCount: number;
  highPerformerList: IncrementRow[];
  quarters: IncrementQuarterRow[];
}

interface InternConversionRow {
  name: string;
  department: string;
  previousCategory: string;
  conversionDate: string | null;
}
interface InternConversionDeptRow {
  department: string;
  count: number;
}
interface InternConversionQuarterRow {
  quarter: string;
  count: number;
}
interface InternConversionsResponse {
  success: boolean;
  total: number;
  conversions: InternConversionRow[];
  departmentBreakdown: InternConversionDeptRow[];
  year: number;
  quarters: InternConversionQuarterRow[];
  availableYears: number[];
}

// Aggregate-only — no employee names, same confidentiality rule as
// Asked-to-Leave.
interface PipQuarterRow {
  quarter: string;
  resolved: number;
  improved: number;
  improvedPct: number | null;
}
interface PipResponse {
  success: boolean;
  currentlyOnPip: number;
  totalCurrentEmployees: number;
  pipPct: number;
  totalResolved: number;
  totalImproved: number;
  performedAfterPipPct: number | null;
  year: number;
  quarters: PipQuarterRow[];
  availableYears: number[];
}

// Aggregate-only — the backend deliberately never returns names, the
// confidential reason fields, or a department breakdown for this
// endpoint (a small department's count is as identifying as a name), so
// there's nothing here to accidentally render either.
interface AskedToLeaveQuarterRow {
  quarter: string;
  totalExits: number;
  askedToLeaveCount: number;
  askedToLeavePct: number;
}
interface AskedToLeaveResponse {
  success: boolean;
  totalExits: number;
  askedToLeaveCount: number;
  askedToLeavePct: number;
  year: number;
  quarters: AskedToLeaveQuarterRow[];
  availableYears: number[];
}

// Aggregate-only — no names, no department breakdown, same confidentiality
// rule as Asked-to-Leave.
interface ReferredQuarterRow {
  quarter: string;
  total: number;
  referredCount: number;
  referredPct: number;
}
interface ReferredResponse {
  success: boolean;
  total: number;
  referredCount: number;
  referredPct: number;
  year: number;
  quarters: ReferredQuarterRow[];
  availableYears: number[];
}

// Aggregate-only, same confidentiality rule as the others above.
interface OfferDropoutQuarterRow {
  quarter: string;
  total: number;
  dropoutCount: number;
  dropoutPct: number;
}
interface OfferDropoutResponse {
  success: boolean;
  total: number;
  dropoutCount: number;
  dropoutPct: number;
  year: number;
  quarters: OfferDropoutQuarterRow[];
  availableYears: number[];
}

// ─── Small building blocks ─────────────────────────────────────────────────

const FilterPillRow: React.FC<{
  options: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
  color?: string;
}> = ({ options, active, onChange, color = ACCENT }) => (
  <Box sx={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
    {options.map(({ key, label }) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        style={{
          border: "none", cursor: "pointer", padding: "6px 14px",
          fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
          background: active === key ? color : "#fff",
          color: active === key ? "#fff" : "#64748b",
          transition: "background 0.15s ease, color 0.15s ease",
        }}
      >
        {label}
      </button>
    ))}
  </Box>
);

const StatCard: React.FC<{
  label: string; value: React.ReactNode; color: string; bg: string; hint?: string;
  onClick?: () => void; active?: boolean;
}> = ({
  label, value, color, bg, hint, onClick, active,
}) => (
  <Box
    onClick={onClick}
    sx={{
      flex: "1 1 140px", bgcolor: bg, border: `1px solid ${active ? color : `${color}25`}`, borderRadius: "12px",
      p: "14px 18px", display: "flex", flexDirection: "column", gap: 0.3,
      transition: "transform 0.2s ease, border-color 0.2s ease",
      cursor: onClick ? "pointer" : "default",
      "&:hover": { transform: "translateY(-2px)", borderColor: onClick ? color : undefined },
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography fontSize="0.68rem" fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.06em">
        {label}
      </Typography>
      {onClick && (
        <Typography fontSize="0.85rem" sx={{ color, transform: active ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
          ▾
        </Typography>
      )}
    </Box>
    <Typography fontSize="1.6rem" fontWeight={800} sx={{ color, lineHeight: 1.2 }}>
      {value}
    </Typography>
    {hint && <Typography fontSize="0.65rem" color="#94a3b8">{hint}</Typography>}
    {onClick && !hint && (
      <Typography fontSize="0.65rem" color="#94a3b8">
        {active ? "Click to hide breakdown" : "Click for department breakdown"}
      </Typography>
    )}
  </Box>
);

// Renders "Name: value" directly beside/inside each pie slice — always
// visible, not just on hover.
const renderPieLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, name, value } = props;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#0f172a" fontSize={11} fontWeight={700} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {`${name}: ${value}`}
    </text>
  );
};

// ─── Reusable pie breakdown chart ──────────────────────────────────────────
// Plain 2D pie — same style as Teeth-to-Tail/Gender/Interns (donut, in-chart
// labels, Legend, Tooltip) — for the simple two/three-way splits added to
// the other widgets.

const PieBreakdownChart: React.FC<{
  data: { name: string; value: number; color: string }[];
  height?: number;
}> = ({ data, height = 260 }) => {
  const filtered = data.filter((d) => d.value > 0);

  if (filtered.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height, color: "#94a3b8", fontSize: "0.8rem" }}>
        No data to show
      </Box>
    );
  }

  return (
    <Box sx={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            label={renderPieLabel}
            labelLine={{ stroke: "#cbd5e1" }}
          >
            {filtered.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

// ─── Teeth-to-Tail widget (unchanged — now shown inside a modal) ───────────

const TeethToTailWidget: React.FC = () => {
  const [data, setData] = useState<TeethToTailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarterFocus, setQuarterFocus] = useState<string>("All");
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/teeth-to-tail`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load Teeth-to-Tail data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears ?? [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  // Calendar quarters (matches the backend's own quarterEndDate: Q1=Jan-Mar,
  // Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec) — used to hide quarters that
  // haven't started yet, rather than showing them as if they have real
  // (zero) data.
  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const hasQuarterStarted = (quarter: string, y: number): boolean =>
    quarterStartDate(quarter, y) <= new Date();

  useEffect(() => {
    if (quarterFocus !== "All" && !hasQuarterStarted(quarterFocus, year)) {
      setQuarterFocus("All");
    }
  }, [year, quarterFocus]);

  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => hasQuarterStarted(q.quarter, year)),
    [data, year]
  );

  const quarterOptions = [
    { key: "All", label: "All Quarters" },
    ...["Q1", "Q2", "Q3", "Q4"]
      .filter((q) => hasQuarterStarted(q, year))
      .map((q) => ({ key: q, label: q })),
  ];

  const focusedQuarter: QuarterData | undefined =
    quarterFocus === "All"
      ? startedQuarters[startedQuarters.length - 1]
      : data?.quarters?.find((q) => q.quarter === quarterFocus);

  const pieData = focusedQuarter
    ? [
        { name: "Teeth (Delivery)", value: focusedQuarter.teeth, color: TEETH_COLOR },
        { name: "Tail (Support)", value: focusedQuarter.tail, color: TAIL_COLOR },
        ...(focusedQuarter.uncategorized > 0
          ? [{ name: "Uncategorized", value: focusedQuarter.uncategorized, color: UNCAT_COLOR }]
          : []),
      ]
    : [];

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Header + filters */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Teeth-to-Tail Ratio
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Delivery/support headcount split, reconstructed as of each quarter's end
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
          <FilterPillRow options={quarterOptions} active={quarterFocus} onChange={setQuarterFocus} color="#059669" />
        </Box>
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          {/* Stat cards for the focused quarter */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Teeth (Delivery)"
              value={focusedQuarter?.teeth ?? 0}
              color={TEETH_COLOR}
              bg="#f0fdf4"
              hint={quarterFocus === "All" ? `As of ${focusedQuarter?.quarter}` : undefined}
            />
            <StatCard
              label="Tail (Support)"
              value={focusedQuarter?.tail ?? 0}
              color={TAIL_COLOR}
              bg="#fffbeb"
            />
            <StatCard
              label="Ratio (Teeth : Tail)"
              value={(() => {
                const t = focusedQuarter?.teeth ?? 0;
                const s = focusedQuarter?.tail ?? 0;
                const total = t + s;
                if (total === 0) return "—";
                const teethPct = Math.round((t / total) * 1000) / 10;
                const tailPct = Math.round((s / total) * 1000) / 10;
                return `${teethPct.toFixed(1)} : ${tailPct.toFixed(1)}`;
              })()}
              color={ACCENT}
              bg="#eef2ff"
              onClick={() => setShowBreakdown((v) => !v)}
              active={showBreakdown}
            />
            {(focusedQuarter?.uncategorized ?? 0) > 0 && (
              <MuiTooltip title="Employees whose department isn't classified as Teeth or Tail yet — adjust the classification rules on the backend as department names evolve.">
                <Box>
                  <StatCard
                    label="Uncategorized"
                    value={focusedQuarter?.uncategorized ?? 0}
                    color={UNCAT_COLOR}
                    bg="#f8fafc"
                  />
                </Box>
              </MuiTooltip>
            )}
          </Box>

          {data.missingJoinDateCount > 0 && (
            <Typography fontSize="0.68rem" color="#94a3b8" mb={2}>
              {data.missingJoinDateCount} current employee{data.missingJoinDateCount === 1 ? "" : "s"} excluded from every quarter above — no join date recorded, so they can't be placed on the timeline.
            </Typography>
          )}

          {/* Department breakdown — hidden by default, revealed by clicking
              the Ratio stat card above, instead of always taking up space */}
          {showBreakdown && (data.departmentBreakdown ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Department Breakdown (current employees)
              </Typography>
              <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                {(data.departmentBreakdown ?? []).map((row, i) => {
                  const catColor =
                    row.category === "Teeth" ? TEETH_COLOR
                    : row.category === "Tail" ? TAIL_COLOR
                    : UNCAT_COLOR;
                  return (
                    <Box
                      key={row.department}
                      sx={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        px: 2, py: 1, bgcolor: row.category === "Uncategorized" ? "#f8fafc" : "#fff",
                        borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <Typography fontSize="0.8rem" color="#1e293b" fontWeight={500}>
                        {row.department}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, color: catColor,
                          background: `${catColor}15`, padding: "2px 8px", borderRadius: 20,
                        }}>
                          {row.category === "Uncategorized" ? "No Type set" : row.category}
                        </span>
                        <Typography fontSize="0.8rem" fontWeight={700} color="#334155" minWidth={24} textAlign="right">
                          {row.count}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              {(data.departmentBreakdown ?? []).some((r) => r.category === "Uncategorized") && (
                <Typography fontSize="0.68rem" color="#94a3b8" mt={1}>
                  Rows marked "No Type set" need a Delivery/Support Type chosen for that department in the Dept & Designation Master.
                </Typography>
              )}
            </Box>
          )}

          {/* Charts */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {/* Quarterly trend bar chart */}
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 320 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Quarterly Trend — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="teeth" name="Teeth (Delivery)" fill={TEETH_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="teeth" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="tail" name="Tail (Support)" fill={TAIL_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="tail" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>

            {/* Focused-quarter pie chart */}
            <Box sx={{ flex: "1 1 260px", minWidth: 240, height: 320 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {focusedQuarter?.quarter ?? "—"} {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    label={renderPieLabel}
                    labelLine={{ stroke: "#cbd5e1" }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Gender Distribution widget (unchanged — now shown inside a modal) ────

const GenderDistributionWidget: React.FC = () => {
  const [data, setData] = useState<GenderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarterFocus, setQuarterFocus] = useState<string>("All");

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/gender`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load gender distribution"))
      .finally(() => setLoading(false));
  }, [year]);

  const colorFor = (gender: string, idx: number) =>
    GENDER_COLORS[gender] ?? GENDER_FALLBACK_COLORS[idx % GENDER_FALLBACK_COLORS.length];

  // Same calendar-quarter convention as Teeth-to-Tail — hides quarters
  // that haven't started yet instead of showing them as empty/zero.
  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const hasQuarterStarted = (quarter: string, y: number): boolean =>
    quarterStartDate(quarter, y) <= new Date();

  useEffect(() => {
    if (quarterFocus !== "All" && !hasQuarterStarted(quarterFocus, year)) {
      setQuarterFocus("All");
    }
  }, [year, quarterFocus]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears ?? [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterOptions = [
    { key: "All", label: "All Quarters" },
    ...["Q1", "Q2", "Q3", "Q4"]
      .filter((q) => hasQuarterStarted(q, year))
      .map((q) => ({ key: q, label: q })),
  ];

  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => hasQuarterStarted(q.quarter, year)),
    [data, year]
  );

  const focusedQuarter: GenderQuarterRow | undefined =
    quarterFocus === "All"
      ? startedQuarters[startedQuarters.length - 1]
      : data?.quarters?.find((q) => q.quarter === quarterFocus);

  const focusedGenders = useMemo(
    () => Object.keys(focusedQuarter?.genderCounts ?? {}).sort(),
    [focusedQuarter]
  );

  // Zero-value slices collapse to the same point and their labels stack on
  // top of each other — filter them out, same fix as the KPI scorecard.
  const pieData = focusedGenders
    .map((g, i) => ({ name: g, value: focusedQuarter?.genderCounts[g] ?? 0, color: colorFor(g, i) }))
    .filter((d) => d.value > 0);

  const femaleCount = focusedQuarter?.genderCounts["Female"] ?? 0;
  const femalePct = focusedQuarter && focusedQuarter.total > 0
    ? Math.round((femaleCount / focusedQuarter.total) * 1000) / 10
    : 0;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Gender Distribution
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            By Department shows current employees only — the trend and split above reflect the selected quarter
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
          <FilterPillRow options={quarterOptions} active={quarterFocus} onChange={setQuarterFocus} color="#059669" />
        </Box>
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          {/* Stat cards — reflect the focused quarter, not just "current" */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Total Employees"
              value={focusedQuarter?.total ?? 0}
              color={ACCENT}
              bg="#eef2ff"
              hint={`As of ${focusedQuarter?.quarter ?? "—"} ${year}`}
            />
            {focusedGenders.map((g, i) => (
              <StatCard
                key={g}
                label={g}
                value={focusedQuarter?.genderCounts[g] ?? 0}
                color={colorFor(g, i)}
                bg={`${colorFor(g, i)}12`}
              />
            ))}
            <StatCard label="% Female" value={`${femalePct}%`} color="#db2777" bg="#fdf2f8" />
          </Box>

          {data.missingJoinDateCount > 0 && (
            <Typography fontSize="0.68rem" color="#94a3b8" mb={2}>
              {data.missingJoinDateCount} current employee{data.missingJoinDateCount === 1 ? "" : "s"} excluded from every quarter above — no join date recorded, so they can't be placed on the timeline.
            </Typography>
          )}

          {/* Charts */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {/* Overall split pie */}
            <Box sx={{ flex: "1 1 260px", minWidth: 240, height: 300 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {focusedQuarter?.quarter ?? "—"} {year}
              </Typography>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      label={renderPieLabel}
                      labelLine={{ stroke: "#cbd5e1" }}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "90%", color: "#94a3b8", fontSize: "0.8rem" }}>
                  No employees yet as of this quarter
                </Box>
              )}
            </Box>

            {/* By department stacked bar — current snapshot, height grows
                with department count so none get squeezed out */}
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 300 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                By Department (current)
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data.byDepartment} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="department"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={140}
                    interval={0}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.genders.map((g, i) => (
                    <Bar key={g} dataKey={g} stackId="gender" name={g} fill={colorFor(g, i)}>
                      <LabelList
                        dataKey={g}
                        position="inside"
                        style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}
                        formatter={(v: any) => (typeof v === "number" && v > 0 ? v : "")}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Attrition & Retention widget ──────────────────────────────────────────
// Attrition % = Employees Left ÷ Average Headcount (opening+closing / 2) ×
// 100. Retention % = (Opening − Left) ÷ Opening × 100. Same
// as-of-a-quarter reconstruction convention as Teeth-to-Tail/Gender/Interns
// — "Opening" is headcount the instant before the quarter starts,
// "Closing" is headcount as of the quarter's own end.

const AttritionWidget: React.FC = () => {
  const [data, setData] = useState<AttritionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarterFocus, setQuarterFocus] = useState<string>("All");

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/attrition`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load attrition data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears ?? [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const hasQuarterStarted = (quarter: string, y: number): boolean => quarterStartDate(quarter, y) <= new Date();

  useEffect(() => {
    if (quarterFocus !== "All" && !hasQuarterStarted(quarterFocus, year)) {
      setQuarterFocus("All");
    }
  }, [year, quarterFocus]);

  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => hasQuarterStarted(q.quarter, year)),
    [data, year]
  );

  const quarterOptions = [
    { key: "All", label: "All Quarters" },
    ...["Q1", "Q2", "Q3", "Q4"].filter((q) => hasQuarterStarted(q, year)).map((q) => ({ key: q, label: q })),
  ];

  const focusedQuarter: AttritionQuarterRow | undefined =
    quarterFocus === "All"
      ? startedQuarters[startedQuarters.length - 1]
      : data?.quarters?.find((q) => q.quarter === quarterFocus);

  const pieData = focusedQuarter && focusedQuarter.opening > 0
    ? [
        { name: "Retained", value: focusedQuarter.opening - focusedQuarter.employeesLeft, color: "#059669" },
        { name: "Left", value: focusedQuarter.employeesLeft, color: "#dc2626" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Attrition & Retention
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Opening/closing headcount reconstructed per quarter — same convention as Teeth-to-Tail
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
          <FilterPillRow options={quarterOptions} active={quarterFocus} onChange={setQuarterFocus} color="#dc2626" />
        </Box>
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Opening Headcount"
              value={focusedQuarter?.opening ?? 0}
              color={ACCENT}
              bg="#eef2ff"
              hint={`As of ${focusedQuarter?.quarter ?? "—"} ${year}`}
            />
            <StatCard label="Closing Headcount" value={focusedQuarter?.closing ?? 0} color={ACCENT} bg="#eef2ff" />
            <StatCard label="Employees Left" value={focusedQuarter?.employeesLeft ?? 0} color="#dc2626" bg="#fef2f2" />
            <StatCard label="Attrition %" value={`${focusedQuarter?.attritionPct ?? 0}%`} color="#dc2626" bg="#fef2f2" />
            <StatCard label="Retention %" value={focusedQuarter?.retentionPct != null ? `${focusedQuarter.retentionPct}%` : "—"} color="#059669" bg="#f0fdf4" />
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {focusedQuarter?.quarter ?? "—"} {year}
              </Typography>
              <PieBreakdownChart data={pieData} />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 300 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Attrition % vs Retention % by Quarter — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="attritionPct" name="Attrition %" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="attritionPct" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="retentionPct" name="Retention %" fill="#059669" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="retentionPct" position="top" formatter={(v: any) => (v != null ? `${v}%` : "")} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Interns widget (unchanged — now shown inside a modal) ────────────────

const InternsWidget: React.FC = () => {
  const [data, setData] = useState<InternsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarterFocus, setQuarterFocus] = useState<string>("All");

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/interns`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load intern data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears ?? [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const hasQuarterStarted = (quarter: string, y: number): boolean => quarterStartDate(quarter, y) <= new Date();
  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => hasQuarterStarted(q.quarter, year)),
    [data, year]
  );

  useEffect(() => {
    if (quarterFocus !== "All" && !hasQuarterStarted(quarterFocus, year)) {
      setQuarterFocus("All");
    }
  }, [year, quarterFocus]);

  const quarterOptions = [
    { key: "All", label: "All Quarters" },
    ...["Q1", "Q2", "Q3", "Q4"].filter((q) => hasQuarterStarted(q, year)).map((q) => ({ key: q, label: q })),
  ];

  // Stat cards and the pie chart both follow the year/quarter filters — the
  // "focused" quarter is either the one explicitly picked, or (for "All")
  // the latest quarter that's actually started this year, so switching the
  // year selector visibly changes these numbers instead of always showing
  // today's snapshot regardless of filter.
  const focusedQuarter: InternQuarterRow | undefined =
    quarterFocus === "All"
      ? startedQuarters[startedQuarters.length - 1]
      : data?.quarters?.find((q) => q.quarter === quarterFocus);

  const pieData = focusedQuarter && focusedQuarter.total > 0
    ? [
        { name: "Interns", value: focusedQuarter.internsCount, color: INTERN_COLOR },
        { name: "Other Employees", value: focusedQuarter.total - focusedQuarter.internsCount, color: NON_INTERN_COLOR },
      ].filter((d) => d.value > 0)
    : [];

  const deptRowsWithInterns = useMemo(
    () => (data?.departmentBreakdown ?? []).filter((r) => r.interns > 0),
    [data]
  );

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Interns
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Stat cards and pie reflect the quarter selected below; department breakdown is today's snapshot
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
          <FilterPillRow options={quarterOptions} active={quarterFocus} onChange={setQuarterFocus} color={INTERN_COLOR} />
        </Box>
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          {/* Stat cards */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Total Employees"
              value={focusedQuarter?.total ?? 0}
              color={ACCENT}
              bg="#eef2ff"
              hint={`As of ${focusedQuarter?.quarter ?? "—"} ${year}`}
            />
            <StatCard label="Interns" value={focusedQuarter?.internsCount ?? 0} color={INTERN_COLOR} bg="#f5f3ff" />
            <StatCard
              label="% Interns"
              value={`${focusedQuarter?.internPct ?? 0}%`}
              color={INTERN_COLOR}
              bg="#f5f3ff"
              onClick={() => setShowBreakdown((v) => !v)}
              active={showBreakdown}
            />
          </Box>

          {data.missingJoinDateCount > 0 && (
            <Typography fontSize="0.68rem" color="#94a3b8" mb={2}>
              {data.missingJoinDateCount} current employee{data.missingJoinDateCount === 1 ? "" : "s"} excluded from the figures above — no join date recorded, so they can't be placed in any quarter.
            </Typography>
          )}

          {/* Department breakdown — reveal on click, same pattern as
              Teeth-to-Tail. Only departments that actually have at least
              one intern are shown, so this doesn't turn into a full
              department listing. Always today's snapshot, regardless of
              the quarter filter above — a historical per-quarter
              department split isn't available from the backend. */}
          {showBreakdown && (
            <Box sx={{ mb: 3 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Departments With Interns — Today
              </Typography>
              {deptRowsWithInterns.length === 0 ? (
                <Typography fontSize="0.8rem" color="#94a3b8">
                  No department currently has any interns.
                </Typography>
              ) : (
                <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                  {deptRowsWithInterns.map((row, i) => (
                    <Box
                      key={row.department}
                      sx={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        px: 2, py: 1, bgcolor: "#fff",
                        borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <Typography fontSize="0.8rem" color="#1e293b" fontWeight={500}>
                        {row.department}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, color: INTERN_COLOR,
                          background: `${INTERN_COLOR}15`, padding: "2px 8px", borderRadius: 20,
                        }}>
                          {row.interns} of {row.total} ({row.pct}%)
                        </span>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Pie + quarterly trend */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <PieBreakdownChart data={pieData} />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Intern % Trend — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="internPct" name="% Interns" fill={INTERN_COLOR} radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList dataKey="internPct" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Intern Conversions widget ──────────────────────────────────────────────
// Employees who converted from Intern/Contract Based to full-time Employee
// — detected via Salary Revision history (see the backend route's own
// comment for exactly how and what it can/can't see). The list/department
// breakdown below is the running all-time total; the trend chart shows
// conversions by the quarter they actually happened in.

const InternConversionsWidget: React.FC = () => {
  const [data, setData] = useState<InternConversionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/intern-conversions`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load intern conversion data"))
      .finally(() => setLoading(false));
  }, [year]);

  const conversions = data?.conversions ?? [];
  const departmentBreakdown = data?.departmentBreakdown ?? [];

  const yearOptions = useMemo(() => {
    const years = data?.availableYears ?? [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => quarterStartDate(q.quarter, year) <= new Date()),
    [data, year]
  );

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Intern → Full-Time Conversions
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Detected from Salary Revision history — only captures conversions that went through at least one revision while still Intern/Contract Based
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Total Conversions"
              value={data.total}
              color={ACCENT}
              bg="#eef2ff"
              onClick={() => setShowList((v) => !v)}
              active={showList}
            />
          </Box>

          {showList && (
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
              <Box sx={{ flex: "2 1 380px", minWidth: 320 }}>
                <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                  Converted Employees
                </Typography>
                {conversions.length === 0 ? (
                  <Typography fontSize="0.8rem" color="#94a3b8">
                    No conversions recorded yet.
                  </Typography>
                ) : (
                  <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                    {conversions.map((c, i) => (
                      <Box
                        key={`${c.name}-${i}`}
                        sx={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          px: 2, py: 1, bgcolor: "#fff",
                          borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <Box>
                          <Typography fontSize="0.8rem" color="#1e293b" fontWeight={500}>{c.name}</Typography>
                          <Typography fontSize="0.68rem" color="#94a3b8">{c.department || "—"} · was {c.previousCategory}</Typography>
                        </Box>
                        <Typography fontSize="0.72rem" color="#64748b">
                          {c.conversionDate ? new Date(c.conversionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Box sx={{ flex: "1 1 220px", minWidth: 200 }}>
                <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                  By Department
                </Typography>
                {departmentBreakdown.length === 0 ? (
                  <Typography fontSize="0.8rem" color="#94a3b8">No data yet.</Typography>
                ) : (
                  <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                    {departmentBreakdown.map((row, i) => (
                      <Box
                        key={row.department}
                        sx={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          px: 2, py: 1, bgcolor: "#fff",
                          borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <Typography fontSize="0.8rem" color="#1e293b" fontWeight={500}>{row.department}</Typography>
                        <Typography fontSize="0.8rem" fontWeight={700} color={ACCENT}>{row.count}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                By Previous Category
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "Intern", value: conversions.filter((c) => c.previousCategory === "Intern").length, color: INTERN_COLOR },
                  { name: "Contract Based", value: conversions.filter((c) => c.previousCategory === "Contract Based").length, color: "#0284c7" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Conversions by Quarter — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="count" name="Conversions" fill={ACCENT} radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Salary Increment Analytics widget ─────────────────────────────────────
// Average increment %, low-increment count (<9%), and high-performer count
// (>20%) for completed Salary Revisions, one year at a time. "Year" is a
// revision's applicableDate (falling back to createdAt for older records).

const IncrementRowList: React.FC<{ rows: IncrementRow[]; color: string }> = ({ rows, color }) => (
  rows.length === 0 ? (
    <Typography fontSize="0.8rem" color="#94a3b8">None this year.</Typography>
  ) : (
    <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
      {rows.map((r, i) => (
        <Box
          key={`${r.employeeName}-${i}`}
          sx={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            px: 2, py: 1, bgcolor: "#fff",
            borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
          }}
        >
          <Box>
            <Typography fontSize="0.8rem" color="#1e293b" fontWeight={500}>{r.employeeName}</Typography>
            <Typography fontSize="0.68rem" color="#94a3b8">{r.designation || "—"} · {r.department || "—"}</Typography>
          </Box>
          <Box textAlign="right">
            <Typography fontSize="0.85rem" fontWeight={700} sx={{ color }}>+{r.incrementPct}%</Typography>
            <Typography fontSize="0.68rem" color="#94a3b8">
              {r.revisionCount > 1 ? `${r.revisionCount} revisions this year, combined` : "1 revision this year"}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
);

const IncrementAnalyticsWidget: React.FC = () => {
  const [data, setData] = useState<IncrementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showList, setShowList] = useState<"low" | "high" | null>(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/salary-revisions/analytics/increments`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load increment data"))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    if (!data?.availableYears?.length) return;
    if (!data.availableYears.includes(year)) {
      setYear(data.availableYears[0]);
    }
  }, [data, year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Salary Increment Analytics
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Completed Salary Revisions, by the year each increment became applicable
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Avg. Increment"
              value={data.avgIncrementPct != null ? `${data.avgIncrementPct}%` : "—"}
              color={ACCENT}
              bg="#eef2ff"
              hint={`Across ${data.total} completed revision${data.total === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Low Increment (<9%)"
              value={data.lowIncrementCount}
              color="#dc2626"
              bg="#fef2f2"
              onClick={() => setShowList((v) => (v === "low" ? null : "low"))}
              active={showList === "low"}
            />
            <StatCard
              label="High Performers (≥20%)"
              value={data.highPerformerCount}
              color="#059669"
              bg="#f0fdf4"
              onClick={() => setShowList((v) => (v === "high" ? null : "high"))}
              active={showList === "high"}
            />
          </Box>

          {showList === "low" && (
            <Box sx={{ mb: 1 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Low Increment — {year}
              </Typography>
              <IncrementRowList rows={data.lowIncrementList} color="#dc2626" />
            </Box>
          )}
          {showList === "high" && (
            <Box sx={{ mb: 1 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                High Performers — {year}
              </Typography>
              <IncrementRowList rows={data.highPerformerList} color="#059669" />
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 2 }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {year}
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "Low (<9%)", value: data.lowIncrementCount, color: "#dc2626" },
                  { name: "High (≥20%)", value: data.highPerformerCount, color: "#059669" },
                  { name: "Normal", value: Math.max(0, data.total - data.lowIncrementCount - data.highPerformerCount), color: "#94a3b8" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Avg. Increment % by Quarter — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data.quarters ?? []} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="avgIncrementPct" name="Avg Increment %" fill={ACCENT} radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList dataKey="avgIncrementPct" position="top" formatter={(v: any) => (v != null ? `${v}%` : "")} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Landing summary card ────────────────────────────────────────────────────
// Fetches just enough to show one headline number — independent of whatever
// full widget opens when clicked, so the widgets above stay completely
// untouched and this card's own tiny fetch has nothing to do with the
// filters/state inside them.

interface CardSummary { value: string; sublabel: string; }

const SummaryCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  fetchSummary: () => Promise<CardSummary>;
  onClick: () => void;
}> = ({ title, icon, color, bg, fetchSummary, onClick }) => {
  const [summary, setSummary] = useState<CardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSummary()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setSummary({ value: "—", sublabel: "Failed to load" }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px",
        p: 2.5, cursor: "pointer", display: "flex", flexDirection: "column",
        justifyContent: "space-between", height: "100%", minHeight: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        "&:hover": { transform: "translateY(-3px)", boxShadow: "0 10px 28px rgba(0,0,0,0.09)", borderColor: color },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: "10px", bgcolor: bg,
          display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Typography fontSize="0.9rem" fontWeight={700} color="#0f172a" sx={{ lineHeight: 1.2 }}>
          {title}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
          <CircularProgress size={22} sx={{ color }} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Typography fontSize="clamp(1.5rem, 3vw, 2.2rem)" fontWeight={800} sx={{ color, lineHeight: 1.1 }}>
            {summary?.value}
          </Typography>
          <Typography fontSize="0.72rem" color="#94a3b8" mt={0.5} sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {summary?.sublabel}
          </Typography>
        </Box>
      )}

      <Typography fontSize="0.65rem" color="#cbd5e1" mt={1.5}>
        Click for full breakdown →
      </Typography>
    </Box>
  );
};

// ─── PIP Analytics widget ───────────────────────────────────────────────────
// "Currently on PIP" comes from SalaryRevision (stage='on_hold', approved
// PIP) — the formal post-confirmation PIP HR means day-to-day. "% performed
// after PIP" also folds in Confirmations extended-probation outcomes (the
// same thing Onboarding labels "On PIP / Extended") — see the backend
// route's own comment for exactly how each source resolves.

const PipAnalyticsWidget: React.FC = () => {
  const [data, setData] = useState<PipResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/salary-revisions/analytics/pip`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load PIP data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => quarterStartDate(q.quarter, year) <= new Date()),
    [data, year]
  );

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Performance Improvement Plans (PIP)
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Combines formal PIPs (Salary Revision) and extended probation (Confirmations) — closed out via each record's own workflow
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color="#d97706" />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard
              label="Currently on PIP"
              value={data.currentlyOnPip}
              color="#d97706"
              bg="#fffbeb"
            />
            <StatCard
              label="% on PIP"
              value={`${data.pipPct}%`}
              color="#d97706"
              bg="#fffbeb"
              hint={`${data.currentlyOnPip} of ${data.totalCurrentEmployees} current employees`}
            />
            <StatCard
              label="% Performed After PIP"
              value={data.performedAfterPipPct != null ? `${data.performedAfterPipPct}%` : "—"}
              color="#059669"
              bg="#f0fdf4"
              hint={data.totalResolved > 0 ? `${data.totalImproved} of ${data.totalResolved} resolved cases improved` : "No PIP has been closed out yet"}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Currently on PIP — Split
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "On PIP", value: data.currentlyOnPip, color: "#d97706" },
                  { name: "Not on PIP", value: Math.max(0, data.totalCurrentEmployees - data.currentlyOnPip), color: "#94a3b8" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                PIP Resolutions by Quarter — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="resolved" name="Resolved" fill="#d97706" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="resolved" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="improved" name="Improved" fill="#059669" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="improved" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Asked to Leave widget ──────────────────────────────────────────────────
// Aggregate percentage only — deliberately no names, no reasons, no
// department breakdown, no per-employee detail anywhere in this widget or
// the endpoint it reads from. A small department's count would be as
// identifying as a name, so this stays a single organization-wide number.

const AskedToLeaveWidget: React.FC = () => {
  const [data, setData] = useState<AskedToLeaveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/exit/analytics/asked-to-leave`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load Asked to Leave data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => quarterStartDate(q.quarter, year) <= new Date()),
    [data, year]
  );

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Asked to Leave
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Share of all exits classified as "Asked to Leave" — a single aggregate number, no employee names, reasons, or department breakdown shown
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color="#dc2626" />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard label="Total Exits" value={data.totalExits} color={ACCENT} bg="#eef2ff" />
            <StatCard label="Asked to Leave" value={data.askedToLeaveCount} color="#dc2626" bg="#fef2f2" />
            <StatCard label="% Asked to Leave" value={`${data.askedToLeavePct}%`} color="#dc2626" bg="#fef2f2" />
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {year}
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "Asked to Leave", value: data.askedToLeaveCount, color: "#dc2626" },
                  { name: "Other Exits", value: Math.max(0, data.totalExits - data.askedToLeaveCount), color: "#94a3b8" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Exits by Quarter — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalExits" name="Total Exits" fill={ACCENT} radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="totalExits" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="askedToLeaveCount" name="Asked to Leave" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="askedToLeaveCount" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Referred Employees widget ──────────────────────────────────────────────
// Aggregate percentage only — no names, no department breakdown, same
// confidentiality rule as Asked to Leave.

const ReferredWidget: React.FC = () => {
  const [data, setData] = useState<ReferredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/referred`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load referred-employee data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => quarterStartDate(q.quarter, year) <= new Date()),
    [data, year]
  );

  // Stat cards follow the year selector — summed across this year's
  // started quarters — rather than always showing the all-time total
  // regardless of which year is picked.
  const yearTotal = startedQuarters.reduce((s, q) => s + q.total, 0);
  const yearReferred = startedQuarters.reduce((s, q) => s + q.referredCount, 0);
  const yearReferredPct = yearTotal > 0 ? Math.round((yearReferred / yearTotal) * 1000) / 10 : 0;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Referred Employees
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Everyone who joined in the selected year, and what share were referred
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color="#0284c7" />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard label="Joined This Year" value={yearTotal} color={ACCENT} bg="#eef2ff" hint={`All time: ${data.total} joined, ${data.referredCount} referred (${data.referredPct}%)`} />
            <StatCard label="Referred" value={yearReferred} color="#0284c7" bg="#eff6ff" />
            <StatCard label="% Referred" value={`${yearReferredPct}%`} color="#0284c7" bg="#eff6ff" />
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {year}
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "Referred", value: yearReferred, color: "#0284c7" },
                  { name: "Other", value: Math.max(0, yearTotal - yearReferred), color: "#94a3b8" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                % Referred by Joining Cohort — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="referredPct" name="% Referred" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList dataKey="referredPct" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Offer Dropout widget ────────────────────────────────────────────────
// Aggregate percentage only — no names, no department breakdown, same
// confidentiality rule as the widgets above.

const OfferDropoutWidget: React.FC = () => {
  const [data, setData] = useState<OfferDropoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/onboarding/analytics/offer-dropout`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load offer dropout data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const startedQuarters = useMemo(
    () => (data?.quarters ?? []).filter((q) => quarterStartDate(q.quarter, year) <= new Date()),
    [data, year]
  );

  // Stat cards follow the year selector — summed across this year's
  // started quarters — rather than always showing the all-time total
  // regardless of which year is picked.
  const yearTotal = startedQuarters.reduce((s, q) => s + q.total, 0);
  const yearDropout = startedQuarters.reduce((s, q) => s + q.dropoutCount, 0);
  const yearDropoutPct = yearTotal > 0 ? Math.round((yearDropout / yearTotal) * 1000) / 10 : 0;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Offer Dropout
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Onboarding records for the selected year (by join/offer-accepted date), and the share marked "Not Joining"
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color="#db2777" />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard label="Onboardings This Year" value={yearTotal} color={ACCENT} bg="#eef2ff" hint={`All time: ${data.total} onboardings, ${data.dropoutCount} not joining (${data.dropoutPct}%)`} />
            <StatCard label="Not Joining" value={yearDropout} color="#db2777" bg="#fdf2f8" />
            <StatCard label="% Dropout" value={`${yearDropoutPct}%`} color="#db2777" bg="#fdf2f8" />
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {year}
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "Not Joining", value: yearDropout, color: "#db2777" },
                  { name: "Other", value: Math.max(0, yearTotal - yearDropout), color: "#94a3b8" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                % Dropout by Quarter — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="dropoutPct" name="% Dropout" fill="#db2777" radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList dataKey="dropoutPct" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Average Days to Hire widget ────────────────────────────────────────────
// Calendar days between a requisition being raised and closed, split by
// candidate_experience_level — backed by HiringRequisition's createdAt and
// closed_at (see backend-node/routes/hiringRequisitions.js).

const DaysToHireWidget: React.FC = () => {
  const [data, setData] = useState<DaysToHireResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/hiringrequisitions/analytics/days-to-hire`, { params: { year, _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load days-to-hire data"))
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: String(y) }));
  }, [data, year]);

  const quarterStartDate = (quarter: string, y: number): Date => {
    const q = parseInt(quarter.replace("Q", ""), 10);
    return new Date(y, (q - 1) * 3, 1);
  };
  const startedQuartersRaw = useMemo(
    () => (data?.quarters ?? []).filter((q) => quarterStartDate(q.quarter, year) <= new Date()),
    [data, year]
  );
  const startedQuarters = useMemo(
    () => startedQuartersRaw.map((q) => ({
      quarter: q.quarter,
      overallDays: q.overall.avgDays,
      fresherDays: q.fresher.avgDays,
      experiencedDays: q.experienced.avgDays,
    })),
    [startedQuartersRaw]
  );

  // Stat cards follow the year selector — a count-weighted average across
  // this year's started quarters — rather than always showing the
  // all-time figure regardless of which year is picked.
  const yearBucket = (key: "overall" | "fresher" | "experienced"): DaysToHireBucket => {
    let totalDays = 0, totalCount = 0;
    for (const q of startedQuartersRaw) {
      const b = q[key];
      if (b.count > 0) { totalDays += b.avgDays! * b.count; totalCount += b.count; }
    }
    return { avgDays: totalCount > 0 ? Math.round((totalDays / totalCount) * 10) / 10 : null, count: totalCount };
  };
  const yearOverall = data ? yearBucket("overall") : { avgDays: null, count: 0 };
  const yearFresher = data ? yearBucket("fresher") : { avgDays: null, count: 0 };
  const yearExperienced = data ? yearBucket("experienced") : { avgDays: null, count: 0 };

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            Average Days to Hire
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            Calendar days from requisition raised to requisition closed — overall, and split by Fresher vs Experienced hires
          </Typography>
        </Box>
        <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color={ACCENT} />
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <StatCard
              label="Overall — Avg Days to Hire"
              value={yearOverall.avgDays != null ? `${yearOverall.avgDays}d` : "—"}
              color={ACCENT}
              bg="#eef2ff"
              hint={yearOverall.count > 0 ? `${yearOverall.count} closed in ${year} · all-time: ${data.overall.avgDays ?? "—"}d over ${data.overall.count}` : "No closed requisitions this year"}
            />
            <StatCard
              label="Fresher — Avg Days to Hire"
              value={yearFresher.avgDays != null ? `${yearFresher.avgDays}d` : "—"}
              color="#059669"
              bg="#f0fdf4"
              hint={yearFresher.count > 0 ? `${yearFresher.count} closed requisition${yearFresher.count === 1 ? "" : "s"} in ${year}` : "No closed Fresher requisitions this year"}
            />
            <StatCard
              label="Experienced — Avg Days to Hire"
              value={yearExperienced.avgDays != null ? `${yearExperienced.avgDays}d` : "—"}
              color="#d97706"
              bg="#fffbeb"
              hint={yearExperienced.count > 0 ? `${yearExperienced.count} closed requisition${yearExperienced.count === 1 ? "" : "s"} in ${year}` : "No closed Experienced requisitions this year"}
            />
          </Box>
          {data.excludedCount > 0 && (
            <Typography fontSize="0.68rem" color="#94a3b8" mt={2} mb={1}>
              {data.excludedCount} closed requisition{data.excludedCount === 1 ? "" : "s"} excluded (all time) — no reliable raised/closed date could be recovered.
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 2 }}>
            <Box sx={{ flex: "1 1 260px", minWidth: 240 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Closed Requisitions — {year}
              </Typography>
              <PieBreakdownChart
                data={[
                  { name: "Fresher", value: yearFresher.count, color: "#059669" },
                  { name: "Experienced", value: yearExperienced.count, color: "#d97706" },
                ]}
              />
            </Box>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 300 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Avg Days to Hire by Quarter (Closed Date) — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={startedQuarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit="d" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="fresherDays" name="Fresher" fill="#059669" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="fresherDays" position="top" formatter={(v: any) => (v != null ? `${v}d` : "")} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="experiencedDays" name="Experienced" fill="#d97706" radius={[4, 4, 0, 0]} barSize={24}>
                    <LabelList dataKey="experiencedDays" position="top" formatter={(v: any) => (v != null ? `${v}d` : "")} style={{ fontSize: 11, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Placeholder cards — KPIs not wired to data yet, shown as empty
// "coming soon" boxes so the dashboard reflects the full metric set the
// business wants tracked, ahead of the backend work to populate them. ─────

const PlaceholderCard: React.FC<{
  title: string; icon: React.ReactNode; color: string; bg: string;
}> = ({ title, icon, color, bg }) => (
  <Box
    sx={{
      bgcolor: "#fff", border: "1px dashed #cbd5e1", borderRadius: "16px",
      p: 2.5, display: "flex", flexDirection: "column",
      justifyContent: "space-between", height: "100%", minHeight: 0,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
      <Box sx={{
        width: 38, height: 38, borderRadius: "10px", bgcolor: bg,
        display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0, opacity: 0.7,
      }}>
        {icon}
      </Box>
      <Typography fontSize="0.9rem" fontWeight={700} color="#64748b" sx={{ lineHeight: 1.2 }}>
        {title}
      </Typography>
    </Box>

    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Typography fontSize="clamp(1.5rem, 3vw, 2.2rem)" fontWeight={800} sx={{ color: "#e2e8f0", lineHeight: 1.1 }}>
        —
      </Typography>
      <Typography fontSize="0.72rem" color="#94a3b8" mt={0.5}>
        Data coming soon
      </Typography>
    </Box>
  </Box>
);

interface UpcomingMetric {
  title: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const UPCOMING_METRICS: UpcomingMetric[] = [
  { title: "Salary Revision Timeliness Rate (%)", icon: <PaidIcon />, color: ACCENT, bg: "#eef2ff" },
  { title: "Trainings Conducted vs Planned", icon: <MenuBookIcon />, color: "#0d9488", bg: "#f0fdfa" },
  { title: "Employee Confirmation Timeliness Rate (%)", icon: <AssignmentTurnedInIcon />, color: "#2563eb", bg: "#eff6ff" },
];

// ─── Summary fetchers — each mirrors the "All Quarters, most recent" logic
// already used inside the corresponding full widget, just extracting one
// headline number instead of the whole dataset. ─────────────────────────────

async function fetchTeethToTailSummary(): Promise<CardSummary> {
  const now = new Date();
  const res = await axios.get(`${API}/onboarding/analytics/teeth-to-tail`, {
    params: { year: now.getFullYear(), _t: Date.now() },
  });
  const quarters: QuarterData[] = res.data?.quarters ?? [];
  const started = quarters.filter((q) => {
    const qNum = parseInt(q.quarter.replace("Q", ""), 10);
    return new Date(now.getFullYear(), (qNum - 1) * 3, 1) <= now;
  });
  const latest = started[started.length - 1];
  if (!latest || latest.teeth + latest.tail === 0) {
    return { value: "—", sublabel: "No categorized data yet" };
  }
  const total = latest.teeth + latest.tail;
  const teethPct = Math.round((latest.teeth / total) * 1000) / 10;
  const tailPct = Math.round((latest.tail / total) * 1000) / 10;
  return {
    value: `${teethPct.toFixed(1)} : ${tailPct.toFixed(1)}`,
    sublabel: `Teeth : Tail — ${latest.quarter} ${now.getFullYear()}`,
  };
}

async function fetchGenderSummary(): Promise<CardSummary> {
  const now = new Date();
  const res = await axios.get(`${API}/onboarding/analytics/gender`, {
    params: { year: now.getFullYear(), _t: Date.now() },
  });
  const total: number = res.data?.total ?? 0;
  const overall: GenderOverall[] = res.data?.overall ?? [];
  const female = overall.find((g) => g.gender === "Female")?.count ?? 0;
  if (total === 0) return { value: "—", sublabel: "No current employees" };
  const pct = Math.round((female / total) * 1000) / 10;
  return { value: `${pct}%`, sublabel: `${female} of ${total} current employees are Female` };
}

async function fetchInternsSummary(): Promise<CardSummary> {
  const res = await axios.get(`${API}/onboarding/analytics/interns`, { params: { _t: Date.now() } });
  const total = res.data?.total ?? 0;
  const internsCount = res.data?.internsCount ?? 0;
  const internPct = res.data?.internPct ?? 0;
  if (total === 0) return { value: "—", sublabel: "No current employees" };
  return { value: `${internPct}%`, sublabel: `${internsCount} of ${total} current employees` };
}

async function fetchKpiSummary(moduleKey: string): Promise<CardSummary> {
  const now = new Date();
  const res = await axios.get(`${API}/kpi/scores-by-quarter`, {
    params: { module: moduleKey, year: now.getFullYear(), _t: Date.now() },
  });
  const data: KpiQuarterResponse = res.data;
  const quarters = data?.quarters ?? [];
  const onTime = quarters.reduce((s, q) => s + q.onTime, 0);
  const delayed = quarters.reduce((s, q) => s + q.delayed, 0);
  const completed = onTime + delayed;
  if (completed === 0) return { value: "—", sublabel: "No completed tasks yet" };
  const pct = Math.round((onTime / completed) * 1000) / 10;
  return { value: `${pct}%`, sublabel: `${onTime} of ${completed} tasks on time this year` };
}

async function fetchIncrementSummary(): Promise<CardSummary> {
  const now = new Date();
  const res = await axios.get(`${API}/salary-revisions/analytics/increments`, {
    params: { year: now.getFullYear(), _t: Date.now() },
  });
  const total = res.data?.total ?? 0;
  const avg = res.data?.avgIncrementPct;
  const low = res.data?.lowIncrementCount ?? 0;
  const high = res.data?.highPerformerCount ?? 0;
  if (total === 0) return { value: "—", sublabel: "No completed revisions this year" };
  return { value: `${avg}%`, sublabel: `${low} low (<9%), ${high} high performers (≥20%)` };
}

async function fetchPipSummary(): Promise<CardSummary> {
  const res = await axios.get(`${API}/salary-revisions/analytics/pip`, { params: { _t: Date.now() } });
  const currentlyOnPip: number = res.data?.currentlyOnPip ?? 0;
  const totalCurrentEmployees: number = res.data?.totalCurrentEmployees ?? 0;
  const pipPct = res.data?.pipPct ?? 0;
  if (totalCurrentEmployees === 0) return { value: "—", sublabel: "No current employees" };
  return { value: `${pipPct}%`, sublabel: `${currentlyOnPip} of ${totalCurrentEmployees} current employees on PIP` };
}

async function fetchInternConversionsSummary(): Promise<CardSummary> {
  const res = await axios.get(`${API}/onboarding/analytics/intern-conversions`, { params: { _t: Date.now() } });
  const total = res.data?.total ?? 0;
  if (total === 0) return { value: "0", sublabel: "No conversions recorded yet via Salary Revision" };
  return { value: String(total), sublabel: `Intern/Contract Based → Employee, via Salary Revision` };
}

async function fetchAskedToLeaveSummary(): Promise<CardSummary> {
  const res = await axios.get(`${API}/exit/analytics/asked-to-leave`, { params: { _t: Date.now() } });
  const totalExits = res.data?.totalExits ?? 0;
  const askedToLeaveCount = res.data?.askedToLeaveCount ?? 0;
  const pct = res.data?.askedToLeavePct ?? 0;
  if (totalExits === 0) return { value: "—", sublabel: "No exits recorded yet" };
  return { value: `${pct}%`, sublabel: `${askedToLeaveCount} of ${totalExits} exits` };
}

async function fetchReferredSummary(): Promise<CardSummary> {
  const res = await axios.get(`${API}/onboarding/analytics/referred`, { params: { _t: Date.now() } });
  const total = res.data?.total ?? 0;
  const referredCount = res.data?.referredCount ?? 0;
  const pct = res.data?.referredPct ?? 0;
  if (total === 0) return { value: "—", sublabel: "No employees recorded yet" };
  return { value: `${pct}%`, sublabel: `${referredCount} of ${total} who ever joined` };
}

async function fetchDaysToHireSummary(level: "overall" | "fresher" | "experienced"): Promise<CardSummary> {
  const res = await axios.get(`${API}/hiringrequisitions/analytics/days-to-hire`, { params: { _t: Date.now() } });
  const data: DaysToHireResponse = res.data;
  const bucket = data?.[level];
  if (!bucket || bucket.count === 0) return { value: "—", sublabel: "No closed requisitions yet" };
  return { value: `${bucket.avgDays}d`, sublabel: `Avg over ${bucket.count} closed requisition${bucket.count === 1 ? "" : "s"}` };
}

async function fetchAttritionSummary(): Promise<CardSummary> {
  const now = new Date();
  const res = await axios.get(`${API}/onboarding/analytics/attrition`, {
    params: { year: now.getFullYear(), _t: Date.now() },
  });
  const quarters: AttritionQuarterRow[] = res.data?.quarters ?? [];
  const started = quarters.filter((q) => {
    const qNum = parseInt(q.quarter.replace("Q", ""), 10);
    return new Date(now.getFullYear(), (qNum - 1) * 3, 1) <= now;
  });
  const latest = started[started.length - 1];
  if (!latest) return { value: "—", sublabel: "No data yet" };
  return {
    value: `${latest.attritionPct}%`,
    sublabel: `Retention ${latest.retentionPct != null ? `${latest.retentionPct}%` : "—"} — ${latest.quarter} ${now.getFullYear()}`,
  };
}

async function fetchOfferDropoutSummary(): Promise<CardSummary> {
  const res = await axios.get(`${API}/onboarding/analytics/offer-dropout`, { params: { _t: Date.now() } });
  const total = res.data?.total ?? 0;
  const dropoutCount = res.data?.dropoutCount ?? 0;
  const pct = res.data?.dropoutPct ?? 0;
  if (total === 0) return { value: "—", sublabel: "No onboardings recorded yet" };
  return { value: `${pct}%`, sublabel: `${dropoutCount} of ${total} onboardings` };
}

// ─── Root page ──────────────────────────────────────────────────────────────
// Default view is a fixed 3x2 grid of equal-size summary cards — no
// scrolling. Clicking a card opens that area's full existing widget
// (unchanged from before) inside a modal.

type CardKey = "teeth" | "gender" | "interns" | "internConversions" | "increments" | "pip" | "askedToLeave" | "referred" | "offerDropout" | "attrition" | "daysToHireOverall" | "recruitment" | "onboarding" | "exit";

const HRAnalyticsDashboard: React.FC = () => {
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);

  const cards: {
    key: CardKey;
    title: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    fetchSummary: () => Promise<CardSummary>;
  }[] = [
    { key: "teeth", title: "Teeth-to-Tail Ratio", icon: <BalanceIcon />, color: ACCENT, bg: "#eef2ff", fetchSummary: fetchTeethToTailSummary },
    { key: "gender", title: "Gender Ratio", icon: <WcIcon />, color: "#db2777", bg: "#fdf2f8", fetchSummary: fetchGenderSummary },
    { key: "interns", title: "Interns (%)", icon: <SchoolIcon />, color: INTERN_COLOR, bg: "#f5f3ff", fetchSummary: fetchInternsSummary },
    { key: "internConversions", title: "Intern to Employee", icon: <SwapHorizIcon />, color: "#0d9488", bg: "#f0fdfa", fetchSummary: fetchInternConversionsSummary },
    { key: "increments", title: "Salary Increments (%)", icon: <TrendingUpIcon />, color: "#7c3aed", bg: "#f5f3ff", fetchSummary: fetchIncrementSummary },
    { key: "pip", title: "PIP (%)", icon: <AssessmentIcon />, color: "#d97706", bg: "#fffbeb", fetchSummary: fetchPipSummary },
    { key: "askedToLeave", title: "Asked to Leave (%)", icon: <PersonRemoveIcon />, color: "#dc2626", bg: "#fef2f2", fetchSummary: fetchAskedToLeaveSummary },
    { key: "referred", title: "Referred Employees (%)", icon: <GroupAddIcon />, color: "#0284c7", bg: "#eff6ff", fetchSummary: fetchReferredSummary },
    { key: "offerDropout", title: "Offer Dropout (%)", icon: <CancelIcon />, color: "#db2777", bg: "#fdf2f8", fetchSummary: fetchOfferDropoutSummary },
    { key: "attrition", title: "Attrition Rate (%)", icon: <TrendingDownIcon />, color: "#dc2626", bg: "#fef2f2", fetchSummary: fetchAttritionSummary },
    { key: "daysToHireOverall", title: "Avg Days to Hire", icon: <TimelineIcon />, color: ACCENT, bg: "#eef2ff", fetchSummary: () => fetchDaysToHireSummary("overall") },
    { key: "recruitment", title: "Recruitment On-Time (%)", icon: <WorkIcon />, color: "#0284c7", bg: "#eff6ff", fetchSummary: () => fetchKpiSummary("recruitment") },
    { key: "onboarding", title: "Onboarding On-Time (%)", icon: <HowToRegIcon />, color: "#059669", bg: "#f0fdf4", fetchSummary: () => fetchKpiSummary("onboarding") },
    { key: "exit", title: "Exit On-Time (%)", icon: <ExitToAppIcon />, color: "#d97706", bg: "#fffbeb", fetchSummary: () => fetchKpiSummary("exit") },
  ];

  const activeModuleLabel = MODULES.find((m) => m.key === activeCard)?.label;

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "#f8fafc", overflow: "hidden" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Navbar />
        <Box sx={{ p: 2.5, pt: "76px", flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minHeight: 0 }}>
          <Box sx={{ mb: 2, flexShrink: 0 }}>
            <Typography variant="h5" fontWeight={700} color="#0f172a" lineHeight={1.2}>
              HR Analytics Dashboard
            </Typography>
            <Typography variant="caption" color="#94a3b8">
              Workforce composition and structural metrics — click any card for the full breakdown
            </Typography>
          </Box>

          {/* Live metrics — 4x2 grid */}
          <Box sx={{
            flexShrink: 0,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            gridAutoRows: "minmax(140px, 1fr)",
            gap: 2,
          }}>
            {cards.map((c) => (
              <SummaryCard
                key={c.key}
                title={c.title}
                icon={c.icon}
                color={c.color}
                bg={c.bg}
                fetchSummary={c.fetchSummary}
                onClick={() => setActiveCard(c.key)}
              />
            ))}
          </Box>

          {/* Upcoming metrics — not wired to data yet */}
          <Box sx={{ mt: 3, mb: 1.5, flexShrink: 0 }}>
            <Typography fontSize="0.95rem" fontWeight={700} color="#0f172a">
              Upcoming Metrics
            </Typography>
            <Typography fontSize="0.75rem" color="#94a3b8">
              Tracked manually for now — will be wired to live data soon
            </Typography>
          </Box>
          <Box sx={{
            flexShrink: 0,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gridAutoRows: "minmax(130px, 1fr)",
            gap: 2,
            mb: 2,
          }}>
            {UPCOMING_METRICS.map((m) => (
              <PlaceholderCard key={m.title} title={m.title} icon={m.icon} color={m.color} bg={m.bg} />
            ))}
          </Box>
        </Box>
      </Box>

      {/* Detail modal — renders the SAME full widget component that used
          to sit inline in the old scrolling layout, completely unchanged. */}
      <Dialog
        open={!!activeCard}
        onClose={() => setActiveCard(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", maxHeight: "88vh" } }}
      >
        <DialogContent sx={{ p: 3, position: "relative", bgcolor: "#f8fafc" }}>
          <IconButton
            onClick={() => setActiveCard(null)}
            sx={{ position: "absolute", top: 12, right: 12, zIndex: 10, bgcolor: "#fff", border: "1px solid #e2e8f0", "&:hover": { bgcolor: "#f1f5f9" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          {activeCard === "teeth" && <TeethToTailWidget />}
          {activeCard === "gender" && <GenderDistributionWidget />}
          {activeCard === "interns" && <InternsWidget />}
          {activeCard === "internConversions" && <InternConversionsWidget />}
          {activeCard === "increments" && <IncrementAnalyticsWidget />}
          {activeCard === "pip" && <PipAnalyticsWidget />}
          {activeCard === "askedToLeave" && <AskedToLeaveWidget />}
          {activeCard === "referred" && <ReferredWidget />}
          {activeCard === "offerDropout" && <OfferDropoutWidget />}
          {activeCard === "attrition" && <AttritionWidget />}
          {activeCard === "daysToHireOverall" && <DaysToHireWidget />}
          {(activeCard === "recruitment" || activeCard === "onboarding" || activeCard === "exit") && activeModuleLabel && (
            <ModuleKpiRow moduleKey={activeCard} label={activeModuleLabel} />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default HRAnalyticsDashboard;