import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Box, Typography, CircularProgress, Tooltip as MuiTooltip } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

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
}

interface GenderOverall {
  gender: string;
  count: number;
}

interface GenderByDeptRow {
  department: string;
  [gender: string]: string | number;
}

interface GenderResponse {
  success: boolean;
  total: number;
  genders: string[];
  overall: GenderOverall[];
  byDepartment: GenderByDeptRow[];
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

const StatCard: React.FC<{ label: string; value: React.ReactNode; color: string; bg: string; hint?: string }> = ({
  label, value, color, bg, hint,
}) => (
  <Box sx={{
    flex: "1 1 140px", bgcolor: bg, border: `1px solid ${color}25`, borderRadius: "12px",
    p: "14px 18px", display: "flex", flexDirection: "column", gap: 0.3,
    transition: "transform 0.2s ease", "&:hover": { transform: "translateY(-2px)" },
  }}>
    <Typography fontSize="0.68rem" fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.06em">
      {label}
    </Typography>
    <Typography fontSize="1.6rem" fontWeight={800} sx={{ color, lineHeight: 1.2 }}>
      {value}
    </Typography>
    {hint && <Typography fontSize="0.65rem" color="#94a3b8">{hint}</Typography>}
  </Box>
);

// ─── Teeth-to-Tail widget ───────────────────────────────────────────────────

const TeethToTailWidget: React.FC = () => {
  const [data, setData] = useState<TeethToTailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarterFocus, setQuarterFocus] = useState<string>("All");

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

  const quarterOptions = [
    { key: "All", label: "All Quarters" },
    { key: "Q1", label: "Q1" },
    { key: "Q2", label: "Q2" },
    { key: "Q3", label: "Q3" },
    { key: "Q4", label: "Q4" },
  ];

  const focusedQuarter: QuarterData | undefined =
    quarterFocus === "All"
      ? data?.quarters[data.quarters.length - 1]
      : data?.quarters.find((q) => q.quarter === quarterFocus);

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

          {/* Charts */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {/* Quarterly trend bar chart */}
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 320 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Quarterly Trend — {year}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data.quarters} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="teeth" name="Teeth (Delivery)" fill={TEETH_COLOR} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tail" name="Tail (Support)" fill={TAIL_COLOR} radius={[4, 4, 0, 0]} />
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

          {/* Department breakdown — shows exactly which departments drive
              the Uncategorized count, instead of leaving it a mystery number */}
          {(data.departmentBreakdown ?? []).length > 0 && (
            <Box sx={{ mt: 3 }}>
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
        </>
      )}
    </Box>
  );
};

// ─── Gender Distribution widget ─────────────────────────────────────────────

const GenderDistributionWidget: React.FC = () => {
  const [data, setData] = useState<GenderResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/onboarding/analytics/gender`, { params: { _t: Date.now() } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load gender distribution"))
      .finally(() => setLoading(false));
  }, []);

  const colorFor = (gender: string, idx: number) =>
    GENDER_COLORS[gender] ?? GENDER_FALLBACK_COLORS[idx % GENDER_FALLBACK_COLORS.length];

  const pieData = data?.overall.map((o, i) => ({
    name: o.gender,
    value: o.count,
    color: colorFor(o.gender, i),
  })) ?? [];

  const femaleCount = data?.overall.find((o) => o.gender === "Female")?.count ?? 0;
  const femalePct = data && data.total > 0 ? Math.round((femaleCount / data.total) * 1000) / 10 : 0;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
          Gender Distribution
        </Typography>
        <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
          Current employees only (excludes exited)
        </Typography>
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <>
          {/* Stat cards */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <StatCard label="Total Employees" value={data.total} color={ACCENT} bg="#eef2ff" />
            {data.overall.map((o, i) => (
              <StatCard
                key={o.gender}
                label={o.gender}
                value={o.count}
                color={colorFor(o.gender, i)}
                bg={`${colorFor(o.gender, i)}12`}
              />
            ))}
            <StatCard label="% Female" value={`${femalePct}%`} color="#db2777" bg="#fdf2f8" />
          </Box>

          {/* Charts */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {/* Overall split pie */}
            <Box sx={{ flex: "1 1 260px", minWidth: 240, height: 300 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Overall Split
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>

            {/* By department stacked bar */}
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 300 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                By Department
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
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.genders.map((g, i) => (
                    <Bar key={g} dataKey={g} stackId="gender" name={g} fill={colorFor(g, i)} />
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

// ─── Root page ──────────────────────────────────────────────────────────────

const HRAnalyticsDashboard: React.FC = () => {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        <Navbar />
        <Box sx={{ p: 2.5, pt: "76px" }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h5" fontWeight={700} color="#0f172a" lineHeight={1.2}>
              HR Analytics Dashboard
            </Typography>
            <Typography variant="caption" color="#94a3b8">
              Workforce composition and structural metrics
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 1300 }}>
            <TeethToTailWidget />
            <GenderDistributionWidget />
            {/* More metric widgets can be added here as separate cards,
                following the same pattern as the widgets above. */}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default HRAnalyticsDashboard;