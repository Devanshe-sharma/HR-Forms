import React from "react";
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export interface AiChartSpec {
  title: string;
  description?: string;
  chartType: "bar" | "line" | "pie" | "table" | "metric";
  collection: string;
  pipeline: string;
  xKey: string;
  yKeys: string[];
  data: Record<string, unknown>[];
}

const COLORS = ["#4f46e5", "#059669", "#db2777", "#d97706", "#0284c7", "#7c3aed", "#dc2626", "#0d9488"];

const fmt = (v: unknown) =>
  typeof v === "number" ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : v == null ? "—" : String(v);

// Aggregations often leave the label in _id (sometimes as an object).
function label(v: unknown): string {
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).map(fmt).join(" / ");
  return fmt(v);
}

function normalize(spec: AiChartSpec) {
  const rows = spec.data || [];
  const xKey = spec.xKey && rows.some((r) => spec.xKey in r) ? spec.xKey : "_id";
  const first = rows[0] || {};
  const yKeys = spec.yKeys?.length
    ? spec.yKeys
    : Object.keys(first).filter((k) => k !== xKey && typeof first[k] === "number");
  const data = rows.map((r) => {
    const out: Record<string, unknown> = { ...r, __label: label(r[xKey]) };
    yKeys.forEach((k) => { out[k] = typeof r[k] === "number" ? r[k] : Number(r[k]) || 0; });
    return out;
  });
  return { data, yKeys };
}

const AiChart: React.FC<{ spec: AiChartSpec; height?: number; dark?: boolean }> = ({ spec, height = 240, dark }) => {
  const text = dark ? "#e2e8f0" : "#334155";
  const grid = dark ? "#334155" : "#e2e8f0";

  if (!spec.data?.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>No data.</Typography>;
  }

  if (spec.chartType === "metric") {
    const row = spec.data[0];
    const key = spec.yKeys?.[0] || Object.keys(row).find((k) => typeof row[k] === "number") || Object.keys(row)[0];
    return (
      <Typography sx={{ fontSize: "2.4rem", fontWeight: 800, color: COLORS[0], py: 2, textAlign: "center" }}>
        {fmt(row[key])}
      </Typography>
    );
  }

  if (spec.chartType === "table") {
    const cols = Array.from(new Set(spec.data.flatMap((r) => Object.keys(r))));
    return (
      <Box sx={{ maxHeight: height + 60, overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>{cols.map((c) => <TableCell key={c} sx={{ fontWeight: 700 }}>{c === "_id" ? "" : c}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {spec.data.map((r, i) => (
              <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{label(r[c])}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  }

  const { data, yKeys } = normalize(spec);
  const tooltipStyle = { background: dark ? "#1e1e1e" : "#fff", border: `1px solid ${grid}`, color: text };

  return (
    <Box sx={{ width: "100%", height }}>
      <ResponsiveContainer>
        {spec.chartType === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey={yKeys[0]} nameKey="__label" outerRadius="75%" label={{ fill: text, fontSize: 11 }}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 11, color: text }} />
          </PieChart>
        ) : spec.chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="__label" tick={{ fill: text, fontSize: 11 }} />
            <YAxis tick={{ fill: text, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {yKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="__label" tick={{ fill: text, fontSize: 11 }} interval={0} angle={data.length > 6 ? -30 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
            <YAxis tick={{ fill: text, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
            {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {yKeys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
};

export default AiChart;
