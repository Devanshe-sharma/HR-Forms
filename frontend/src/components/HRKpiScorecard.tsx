import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Box, Typography, CircularProgress } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LabelList,
} from "recharts";

const API = process.env.REACT_APP_REACT_APP_API_BASE_URL ?? "";
const ON_TIME_COLOR = "#059669";
const DELAYED_COLOR = "#d97706";
const OVERDUE_COLOR = "#dc2626";
const PENDING_COLOR = "#94a3b8";

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuarterRow {
  quarter: string;
  onTime: number;
  delayed: number;
  overdue: number;
  pending: number;
  completed: number;
  pct: number | null;
}

interface QuarterResponse {
  success: boolean;
  year: number;
  availableYears: number[];
  quarters: QuarterRow[];
}

// "2025" -> "2025-26" (fiscal year display convention)
function fiscalLabel(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

// Exported so HRAnalyticsDashboard's landing grid can fetch each module's
// headline number independently, without duplicating the "All Quarters"
// combine logic that already lives in ModuleKpiRow below.
export const MODULES = [
  { key: "recruitment", label: "Recruitment" },
  { key: "onboarding", label: "Onboarding" },
  { key: "exit", label: "Exit" },
];

// ─── Small building block ───────────────────────────────────────────────────

const FilterPillRow: React.FC<{
  options: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
  color?: string;
}> = ({ options, active, onChange, color = "#4f46e5" }) => (
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

function pctColor(pct: number | null): string {
  if (pct === null) return "#94a3b8";
  if (pct >= 80) return "#059669";
  if (pct >= 50) return "#d97706";
  return "#dc2626";
}

// Renders "Name: value" directly beside each pie slice — always visible,
// not just on hover.
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

// Hides zero-value labels on stacked/grouped bars so empty categories
// don't clutter the chart with a bunch of "0"s.
const nonZeroLabel = (v: any) => (typeof v === "number" && v > 0 ? v : "");

// ─── One module's row (its own independent filters + charts) ──────────────
// Exported so HRAnalyticsDashboard can render a single module's full detail
// inside its own modal, rather than always getting all three bundled
// together via the default HRKpiScorecard export below.

export const ModuleKpiRow: React.FC<{ moduleKey: string; label: string }> = ({ moduleKey, label }) => {
  const [data, setData] = useState<QuarterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarterFocus, setQuarterFocus] = useState<string>("All");

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/kpi/scores-by-quarter`, {
      params: { module: moduleKey, year, _t: Date.now() },
    })
      .then((res) => setData(res.data))
      .catch(() => toast.error(`Failed to load ${label} KPI data`))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    if (data?.availableYears?.length && !data.availableYears.includes(year)) {
      setYear(data.availableYears[0]);
    }
  }, [data]);

  const yearOptions = useMemo(() => {
    const years = data?.availableYears?.length ? data.availableYears : [year];
    return years.map((y) => ({ key: String(y), label: fiscalLabel(y) }));
  }, [data, year]);

  const quarterOptions = [
    { key: "All", label: "All Quarters" },
    { key: "Q1", label: "Q1 (Apr-Jun)" },
    { key: "Q2", label: "Q2 (Jul-Sep)" },
    { key: "Q3", label: "Q3 (Oct-Dec)" },
    { key: "Q4", label: "Q4 (Jan-Mar)" },
  ];

  const focusedQuarter: QuarterRow | undefined = useMemo(() => {
    if (!data) return undefined;
    if (quarterFocus !== "All") {
      return data.quarters.find((q) => q.quarter === quarterFocus);
    }
    // "All Quarters" genuinely combines all 4, rather than silently
    // defaulting to whichever one happens to be last in the array.
    const onTime = data.quarters.reduce((s, q) => s + q.onTime, 0);
    const delayed = data.quarters.reduce((s, q) => s + q.delayed, 0);
    const overdue = data.quarters.reduce((s, q) => s + q.overdue, 0);
    const pending = data.quarters.reduce((s, q) => s + q.pending, 0);
    const completed = onTime + delayed;
    return {
      quarter: "All Quarters",
      onTime,
      delayed,
      overdue,
      pending,
      completed,
      pct: completed > 0 ? Math.round((onTime / completed) * 1000) / 10 : null,
    };
  }, [data, quarterFocus]);

  const pieData = focusedQuarter
    ? [
        { name: "On Time", value: focusedQuarter.onTime, color: ON_TIME_COLOR },
        { name: "Delayed", value: focusedQuarter.delayed, color: DELAYED_COLOR },
        { name: "Overdue", value: focusedQuarter.overdue, color: OVERDUE_COLOR },
        { name: "Pending", value: focusedQuarter.pending, color: PENDING_COLOR },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography fontSize="1.05rem" fontWeight={700} color="#0f172a">
            {label}
          </Typography>
          <Typography fontSize="0.75rem" color="#94a3b8" mt={0.3}>
            % of checklist tasks completed on time
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterPillRow options={yearOptions} active={String(year)} onChange={(k) => setYear(Number(k))} color="#0284c7" />
          <FilterPillRow options={quarterOptions} active={quarterFocus} onChange={setQuarterFocus} color="#059669" />
        </Box>
      </Box>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: "#4f46e5" }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <Box sx={{
              flex: "1 1 200px", bgcolor: `${pctColor(focusedQuarter?.pct ?? null)}12`,
              border: `1px solid ${pctColor(focusedQuarter?.pct ?? null)}30`, borderRadius: "12px",
              p: "14px 18px",
            }}>
              <Typography fontSize="0.68rem" fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.06em">
                On-Time % — {focusedQuarter?.quarter ?? "—"} {fiscalLabel(year)}
              </Typography>
              <Typography fontSize="1.8rem" fontWeight={800} sx={{ color: pctColor(focusedQuarter?.pct ?? null), lineHeight: 1.2 }}>
                {focusedQuarter?.pct === null || focusedQuarter?.pct === undefined ? "—" : `${focusedQuarter.pct}%`}
              </Typography>
              <Typography fontSize="0.68rem" color="#94a3b8">
                {focusedQuarter?.completed
                  ? `${focusedQuarter.onTime} of ${focusedQuarter.completed} completed tasks`
                  : "No completed tasks yet"}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "2 1 420px", minWidth: 320, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Quarterly Trend — {fiscalLabel(year)}
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data.quarters} barGap={4} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="onTime" name="On Time" fill={ON_TIME_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="onTime" position="top" formatter={nonZeroLabel} style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="delayed" name="Delayed" fill={DELAYED_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="delayed" position="top" formatter={nonZeroLabel} style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="overdue" name="Overdue" fill={OVERDUE_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="overdue" position="top" formatter={nonZeroLabel} style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                  <Bar dataKey="pending" name="Pending" fill={PENDING_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="pending" position="top" formatter={nonZeroLabel} style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>

            <Box sx={{ flex: "1 1 260px", minWidth: 240, height: 280 }}>
              <Typography fontSize="0.72rem" fontWeight={700} color="#64748b" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                Split — {focusedQuarter?.quarter ?? "—"} {fiscalLabel(year)}
              </Typography>
              {focusedQuarter && (focusedQuarter.onTime + focusedQuarter.delayed + focusedQuarter.overdue + focusedQuarter.pending) > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
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
                  No completed tasks this quarter
                </Box>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Root widget — one row per module ───────────────────────────────────────

const HRKpiScorecard: React.FC = () => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {MODULES.map((m) => (
        <ModuleKpiRow key={m.key} moduleKey={m.key} label={m.label} />
      ))}
    </Box>
  );
};

export default HRKpiScorecard;