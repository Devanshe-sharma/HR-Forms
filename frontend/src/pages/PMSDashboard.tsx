import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, CircularProgress, Stack, Grid,
  Avatar, LinearProgress, Card, CardContent,
} from '@mui/material';
import {
  TrendingUp, People, AccessTime, EmojiEvents,
  AutoGraph, HealthAndSafety,
} from '@mui/icons-material';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';
const BRAND    = '#3B82F6';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
  _id: string;
  full_name: string;
  department: string;
  designation: string;
  official_email: string;
  score?: number;
}

interface Department {
  _id: string;
  department: string;
}

interface KPIData {
  _id: string;
  name: string;
  targetValue: number;
  achievedValue: number;
  score: number;
  type?: 'department' | 'role';
  department?: string;
  role?: string;
  employeeId?: string;
}

interface HygieneData {
  _id: string;
  employeeId: string;
  attendance: { present: number; total: number; percentage: number };
  lateMarks: number;
  leaves: { taken: number; allowed: number; remaining: number };
  outOfOffice: number;
  score: number;
}

interface GrowthData {
  _id: string;
  employeeId: string;
  trainingDelivered: number;
  trainingAttended: number;
  investmentInitiatives: number;
  innovation: { ideasSubmitted: number; ideasImplemented: number; score: number };
  score: number;
}

interface PerformanceScore {
  kpiScore: number;
  targetScore: number;
  hygieneScore: number;
  growthScore: number;
  overallScore: number;
  rating: string;
}

type TabId = 'kpi' | 'hygiene' | 'growth' | 'summary';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => {
  if (s >= 90) return '#16a34a';
  if (s >= 75) return '#2563eb';
  if (s >= 60) return '#d97706';
  return '#dc2626';
};

const scoreBg = (s: number) => {
  if (s >= 90) return '#dcfce7';
  if (s >= 75) return '#dbeafe';
  if (s >= 60) return '#fef3c7';
  return '#fee2e2';
};

const ratingColor = (r: string) => {
  const m: Record<string, string> = {
    Outstanding: '#16a34a', Excellent: '#2563eb',
    Good: '#7c3aed', Average: '#d97706', 'Needs Improvement': '#dc2626',
  };
  return m[r] || '#64748b';
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────
interface FilterBarProps {
  departments: Department[];
  employees: Employee[];
  selDept: string;
  selEmp: string;
  onDeptChange: (v: string) => void;
  onEmpChange: (v: string) => void;
  showEmpFilter?: boolean;
}
const FilterBar: React.FC<FilterBarProps> = ({
  departments, employees, selDept, selEmp,
  onDeptChange, onEmpChange, showEmpFilter = false,
}) => {
  const filteredEmps = selDept ? employees.filter(e => e.department === selDept) : employees;
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ px: 2, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 1 }}
    >
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Department</InputLabel>
        <Select value={selDept} label="Department" onChange={e => onDeptChange(e.target.value as string)}>
          <MenuItem value=""><em>All Departments</em></MenuItem>
          {departments.map(d => (
            <MenuItem key={d._id} value={d.department}>{d.department}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {showEmpFilter && (
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>Employee</InputLabel>
          <Select value={selEmp} label="Employee" onChange={e => onEmpChange(e.target.value as string)}>
            <MenuItem value=""><em>All Employees</em></MenuItem>
            {filteredEmps.map(e => (
              <MenuItem key={e._id} value={e._id}>{e.full_name} — {e.designation}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Stack>
  );
};

// ─── KPI Table ────────────────────────────────────────────────────────────────
interface KPITableProps {
  data: KPIData[];
  title: string;
  accent: string;
  departments: Department[];
  employees: Employee[];
  showEmpFilter?: boolean;
}
const KPITable: React.FC<KPITableProps> = ({
  data, title, accent, departments, employees, showEmpFilter = false,
}) => {
  const [selDept, setSelDept] = useState('');
  const [selEmp,  setSelEmp]  = useState('');

  const filtered = data.filter(item => {
    if (showEmpFilter && selEmp) {
      const emp    = employees.find(e => e._id === selEmp);
      const deptOk = !selDept || item.department === selDept;
      if (emp) return deptOk && (item.employeeId === selEmp || item.role === emp.designation);
      return deptOk;
    }
    return (!selDept || item.department === selDept);
  });

  const totTarget   = filtered.reduce((s, x) => s + x.targetValue, 0);
  const totAchieved = filtered.reduce((s, x) => s + x.achievedValue, 0);
  const avgScore    = filtered.length ? filtered.reduce((s, x) => s + x.score, 0) / filtered.length : 0;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
        bgcolor: '#fff', borderBottom: `2px solid ${accent}`,
      }}>
        <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: accent, flexShrink: 0 }} />
        <Typography fontSize={14} fontWeight={700} color="text.primary">{title}</Typography>
        <Chip
          label={`${filtered.length} items`}
          size="small"
          sx={{ ml: 'auto', bgcolor: accent + '15', color: accent, fontWeight: 600, fontSize: 11 }}
        />
      </Box>

      <FilterBar
        departments={departments} employees={employees}
        selDept={selDept} selEmp={selEmp}
        onDeptChange={v => { setSelDept(v); setSelEmp(''); }}
        onEmpChange={setSelEmp}
        showEmpFilter={showEmpFilter}
      />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f1f5f9' }}>
              {['KPI / Target Name', 'Target', 'Achieved', 'Score', 'Progress'].map(h => (
                <TableCell
                  key={h}
                  sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', py: 1.2, whiteSpace: 'nowrap' }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5, color: '#94a3b8', fontSize: 13 }}>
                  No data matches the selected filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(item => {
                const pct = item.targetValue > 0 ? Math.min((item.achievedValue / item.targetValue) * 100, 100) : 0;
                return (
                  <TableRow key={item._id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell sx={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{item.name}</TableCell>
                    <TableCell sx={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>{item.targetValue}</TableCell>
                    <TableCell sx={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>{item.achievedValue}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.score}
                        size="small"
                        sx={{ bgcolor: scoreBg(item.score), color: scoreColor(item.score), fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{ height: 7, borderRadius: 99, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: accent, borderRadius: 99 } }}
                        />
                        <Typography fontSize={10} color="text.disabled" mt={0.3}>{pct.toFixed(0)}%</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}

            {filtered.length > 0 && (
              <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total / Avg</TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{totTarget}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{totAchieved}</TableCell>
                <TableCell>
                  <Chip
                    label={avgScore.toFixed(1)}
                    size="small"
                    sx={{ bgcolor: scoreBg(avgScore), color: scoreColor(avgScore), fontWeight: 800, fontSize: 12 }}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 170 }}>
                  <LinearProgress
                    variant="determinate"
                    value={totTarget > 0 ? Math.min((totAchieved / totTarget) * 100, 100) : 0}
                    sx={{ height: 7, borderRadius: 99, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: accent } }}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  progress?: { achieved: number; target: number };
}
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, color, progress }) => (
  <Card
    variant="outlined"
    sx={{ borderRadius: 2, transition: 'all .2s', '&:hover': { borderColor: color, boxShadow: `0 0 0 3px ${color}18` } }}
  >
    <CardContent sx={{ pb: '16px !important' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
        <Box>
          <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".08em" mb={0.5}>
            {label}
          </Typography>
          <Typography fontSize={30} fontWeight={800} color="text.primary" lineHeight={1} fontFamily="monospace">
            {value}
          </Typography>
          {sub && <Typography fontSize={12} color="text.disabled" mt={0.5}>{sub}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: color + '18', width: 44, height: 44 }}>
          {React.cloneElement(icon as React.ReactElement, { sx: { color, fontSize: 22 } })}
        </Avatar>
      </Stack>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={progress.target > 0 ? Math.min((progress.achieved / progress.target) * 100, 100) : 0}
          sx={{ height: 5, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: color } }}
        />
      )}
    </CardContent>
  </Card>
);

// ─── Gauge ────────────────────────────────────────────────────────────────────
const Gauge: React.FC<{ score: number; size?: number }> = ({ score, size = 130 }) => {
  const r  = size / 2 - 14;
  const col = scoreColor(score);
  const cx  = size / 2;
  const cy  = size / 2;
  return (
    <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={col} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={Math.PI * r}
        strokeDashoffset={Math.PI * r * (1 - Math.min(score / 100, 1))}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }}
      />
      <text
        x={cx} y={cy + 12} textAnchor="middle" fill={col}
        fontSize={size * 0.18} fontWeight="800" fontFamily="monospace"
      >
        {score.toFixed(1)}
      </text>
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PMSDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sp        = new URLSearchParams(location.search);
  const activeTab = (sp.get('tab') || 'kpi') as TabId;

  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  const [deptKPI,     setDeptKPI]     = useState<KPIData[]>([]);
  const [roleKPI,     setRoleKPI]     = useState<KPIData[]>([]);
  const [deptTargets, setDeptTargets] = useState<KPIData[]>([]);
  const [roleTargets, setRoleTargets] = useState<KPIData[]>([]);
  const [hygieneData, setHygieneData] = useState<HygieneData[]>([]);
  const [growthData,  setGrowthData]  = useState<GrowthData[]>([]);
  const [perfScore,   setPerfScore]   = useState<PerformanceScore | null>(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchKPIData();
  }, []);

  useEffect(() => {
    if (selectedEmp) calculateScore();
  }, [selectedEmp, deptKPI, roleKPI, deptTargets, roleTargets, hygieneData, growthData]);

  const fetchEmployees = async () => {
    try {
      const res  = await axios.get(`${API_BASE}/employees`, { params: { lightweight: true } });
      const raw  = res.data.data || res.data;
      const list: Employee[] = raw.map((e: any) => ({
        _id:            e._id            || '',
        full_name:      e.full_name      || e.name  || '',
        department:     e.department     || e.dept  || '',
        designation:    e.designation    || e.desig || '',
        official_email: e.official_email || e.email || '',
        score:          e.score          || 0,
      }));
      setEmployees(list);
      if (list.length > 0) setSelectedEmp(list[0]._id);
    } catch (err) { console.error('fetchEmployees:', err); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/departments`);
      setDepartments(res.data.data || res.data);
    } catch (err) { console.error('fetchDepartments:', err); }
  };

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      const [dkR, rkR, dtR, rtR, hR, gR] = await Promise.all([
        axios.get(`${API_BASE}/dept-kpi`),
        axios.get(`${API_BASE}/role-kpi`),
        axios.get(`${API_BASE}/dept-targets`),
        axios.get(`${API_BASE}/role-targets`),
        axios.get(`${API_BASE}/hygiene`),
        axios.get(`${API_BASE}/growth`),
      ]);
      setDeptKPI(dkR.data.data     || dkR.data);
      setRoleKPI(rkR.data.data     || rkR.data);
      setDeptTargets(dtR.data.data || dtR.data);
      setRoleTargets(rtR.data.data || rtR.data);
      setHygieneData(hR.data.data  || hR.data);
      setGrowthData(gR.data.data   || gR.data);
    } catch (err) { console.error('fetchKPIData:', err); }
    finally { setLoading(false); }
  };

  const calculateScore = () => {
    const emp = employees.find(e => e._id === selectedEmp);
    if (!emp) return;

    const avg = (arr: KPIData[]) =>
      arr.length ? arr.reduce((s, x) => s + (x.score || 0), 0) / arr.length : 0;

    const eDK = deptKPI.filter(k => k.department === emp.department);
    const eRK = roleKPI.filter(k => k.role === emp.designation || k.employeeId === selectedEmp);
    const eDT = deptTargets.filter(k => k.department === emp.department);
    const eRT = roleTargets.filter(k => k.role === emp.designation || k.employeeId === selectedEmp);

    const kpiScore     = avg([...eDK, ...eRK]);
    const targetScore  = avg([...eDT, ...eRT]);
    const hygiene      = hygieneData.find(h => h.employeeId === selectedEmp);
    const growth       = growthData.find(g => g.employeeId === selectedEmp);
    const hygieneScore = hygiene?.score || 0;
    const growthScore  = growth?.score  || 0;
    const overallScore = kpiScore * 0.4 + targetScore * 0.3 + hygieneScore * 0.2 + growthScore * 0.1;

    let rating = 'Needs Improvement';
    if (overallScore >= 90)      rating = 'Outstanding';
    else if (overallScore >= 80) rating = 'Excellent';
    else if (overallScore >= 70) rating = 'Good';
    else if (overallScore >= 60) rating = 'Average';

    setPerfScore({ kpiScore, targetScore, hygieneScore, growthScore, overallScore, rating });
  };

  const emp     = employees.find(e => e._id === selectedEmp);
  const hygiene = hygieneData.find(h => h.employeeId === selectedEmp);
  const growth  = growthData.find(g => g.employeeId === selectedEmp);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <Box sx={{ bgcolor: '#f8fafc', minHeight: '100%', mt: '56px' }}>

      {/* ── Employee selector bar ── */}
      <Box sx={{
        bgcolor: '#fff', borderBottom: '1px solid #e2e8f0',
        px: 3, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Typography fontSize={13} fontWeight={600} color="text.secondary" flexShrink={0}>Employee</Typography>

        <FormControl size="small" sx={{ minWidth: 280 }}>
          <Select
            value={selectedEmp}
            onChange={e => setSelectedEmp(e.target.value as string)}
            displayEmpty
            renderValue={val => {
              if (!val) return <Typography color="text.disabled" fontSize={13}>Select an employee…</Typography>;
              const e = employees.find(x => x._id === val);
              return <Typography fontSize={13} fontWeight={600}>{e?.full_name}</Typography>;
            }}
          >
            <MenuItem value=""><em>Select an employee…</em></MenuItem>
            {employees.map(e => (
              <MenuItem key={e._id} value={e._id}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: BRAND }}>{e.full_name?.[0]}</Avatar>
                  <Box>
                    <Typography fontSize={13} fontWeight={600} lineHeight={1.2}>{e.full_name}</Typography>
                    <Typography fontSize={11} color="text.disabled">{e.department} · {e.designation}</Typography>
                  </Box>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {emp && (
          <Stack direction="row" gap={1}>
            <Chip label={emp.department}  size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }} />
            <Chip label={emp.designation} size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600 }} />
          </Stack>
        )}

        {perfScore && (
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ ml: 'auto' }}>
            <Typography fontSize={12} color="text.disabled">Overall</Typography>
            <Chip
              label={perfScore.overallScore.toFixed(1)}
              sx={{ bgcolor: scoreBg(perfScore.overallScore), color: scoreColor(perfScore.overallScore), fontWeight: 800, fontSize: 14, height: 30 }}
            />
            <Chip
              label={perfScore.rating}
              sx={{ bgcolor: ratingColor(perfScore.rating) + '18', color: ratingColor(perfScore.rating), fontWeight: 700 }}
            />
          </Stack>
        )}
      </Box>

      {/* ── Content ── */}
      <Box sx={{ p: 3 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={300}>
            <CircularProgress size={36} />
          </Box>
        ) : (
          <>
            {/* ═══════════════ KPI & TARGETS ═══════════════ */}
            {activeTab === 'kpi' && (
              <Box display="flex" flexDirection="column" gap={3}>
                <Box>
                  <Typography variant="h6" fontWeight={800} color="text.primary">KPI & Targets</Typography>
                  <Typography fontSize={13} color="text.secondary" mt={0.3}>
                    Use the filters in each section to drill down by department or individual employee
                  </Typography>
                </Box>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, xl: 6 }}>
                    <KPITable data={deptKPI}     title="Department KPI"           accent="#3b82f6" departments={departments} employees={employees} />
                  </Grid>
                  <Grid size={{ xs: 12, xl: 6 }}>
                    <KPITable data={deptTargets} title="Department Targets"        accent="#8b5cf6" departments={departments} employees={employees} />
                  </Grid>
                  <Grid size={{ xs: 12, xl: 6 }}>
                    <KPITable data={roleKPI}     title="Individual / Role KPI"     accent="#0891b2" departments={departments} employees={employees} showEmpFilter />
                  </Grid>
                  <Grid size={{ xs: 12, xl: 6 }}>
                    <KPITable data={roleTargets} title="Individual / Role Targets" accent="#d97706" departments={departments} employees={employees} showEmpFilter />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* ═══════════════ HYGIENE FACTORS ═══════════════ */}
            {activeTab === 'hygiene' && (
              <Box display="flex" flexDirection="column" gap={3}>
                <Box>
                  <Typography variant="h6" fontWeight={800} color="text.primary">Hygiene Factors</Typography>
                  <Typography fontSize={13} color="text.secondary" mt={0.3}>
                    Attendance & conduct metrics for <strong>{emp?.full_name || '—'}</strong>
                  </Typography>
                </Box>

                {hygiene ? (
                  <>
                    {/* ── Stat Cards ── */}
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Attendance"
                          value={`${hygiene.attendance.percentage.toFixed(1)}%`}
                          sub={`${hygiene.attendance.present} / ${hygiene.attendance.total} days`}
                          icon={<People />}
                          color="#16a34a"
                          progress={{ achieved: hygiene.attendance.percentage, target: 100 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Late Marks"
                          value={hygiene.lateMarks}
                          sub="This period"
                          icon={<AccessTime />}
                          color={hygiene.lateMarks <= 1 ? '#d97706' : '#dc2626'}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Leaves Taken"
                          value={hygiene.leaves.taken}
                          sub={`${hygiene.leaves.remaining} remaining of ${hygiene.leaves.allowed}`}
                          icon={<HealthAndSafety />}
                          color="#2563eb"
                          progress={{ achieved: hygiene.leaves.taken, target: hygiene.leaves.allowed }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Out of Office"
                          value={hygiene.outOfOffice}
                          sub="Days"
                          icon={<TrendingUp />}
                          color="#7c3aed"
                        />
                      </Grid>
                    </Grid>

                    {/* ── Detail Table ── */}
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '2px solid #16a34a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: '#16a34a' }} />
                        <Typography fontSize={14} fontWeight={700}>Detailed Hygiene Report</Typography>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                              {['Metric', 'Value', 'Target', 'Score', 'Progress'].map(h => (
                                <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                  {h}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {([
                              {
                                metric: 'Attendance',
                                value:  `${hygiene.attendance.percentage}%`,
                                target: '≥ 95%',
                                score:  Math.min(100, (hygiene.attendance.percentage / 95) * 100),
                                ach:    hygiene.attendance.percentage,
                                tot:    100,
                                color:  '#16a34a',
                              },
                              {
                                metric: 'Late Marks',
                                value:  `${hygiene.lateMarks}`,
                                target: '0',
                                score:  Math.max(0, 100 - hygiene.lateMarks * 12),
                                ach:    Math.max(0, 5 - hygiene.lateMarks),
                                tot:    5,
                                color:  '#d97706',
                              },
                              {
                                metric: 'Leave Usage',
                                value:  `${hygiene.leaves.taken} / ${hygiene.leaves.allowed}`,
                                target: '≤ 80% usage',
                                score:  (hygiene.leaves.allowed - hygiene.leaves.taken) / hygiene.leaves.allowed * 100,
                                ach:    hygiene.leaves.remaining,
                                tot:    hygiene.leaves.allowed,
                                color:  '#2563eb',
                              },
                              {
                                metric: 'Out of Office',
                                value:  `${hygiene.outOfOffice} days`,
                                target: '≤ 3',
                                score:  Math.max(0, 100 - hygiene.outOfOffice * 8),
                                ach:    Math.max(0, 5 - hygiene.outOfOffice),
                                tot:    5,
                                color:  '#7c3aed',
                              },
                            ] as const).map(row => (
                              <TableRow key={row.metric} hover>
                                <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>{row.metric}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{row.value}</TableCell>
                                <TableCell sx={{ fontSize: 12, color: '#64748b' }}>{row.target}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={row.score.toFixed(1)}
                                    size="small"
                                    sx={{ bgcolor: scoreBg(row.score), color: scoreColor(row.score), fontWeight: 700, fontFamily: 'monospace' }}
                                  />
                                </TableCell>
                                <TableCell sx={{ minWidth: 160 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={row.tot > 0 ? Math.min((row.ach / row.tot) * 100, 100) : 0}
                                    sx={{ height: 6, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: row.color } }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', textTransform: 'uppercase' }}>
                                Total Hygiene Score
                              </TableCell>
                              <TableCell colSpan={2} />
                              <TableCell>
                                <Chip
                                  label={hygiene.score}
                                  size="small"
                                  sx={{ bgcolor: scoreBg(hygiene.score), color: scoreColor(hygiene.score), fontWeight: 800, fontSize: 13 }}
                                />
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </>
                ) : (
                  <Typography color="text.secondary" fontSize={14}>No hygiene data for the selected employee.</Typography>
                )}
              </Box>
            )}

            {/* ═══════════════ GROWTH ═══════════════ */}
            {activeTab === 'growth' && (
              <Box display="flex" flexDirection="column" gap={3}>
                <Box>
                  <Typography variant="h6" fontWeight={800} color="text.primary">Growth Metrics</Typography>
                  <Typography fontSize={13} color="text.secondary" mt={0.3}>
                    Learning, innovation & investment for <strong>{emp?.full_name || '—'}</strong>
                  </Typography>
                </Box>

                {growth ? (
                  <>
                    {/* ── Stat Cards ── */}
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Training Delivered"
                          value={growth.trainingDelivered}
                          sub="Sessions conducted"
                          icon={<AutoGraph />}
                          color="#6366f1"
                          progress={{ achieved: growth.trainingDelivered, target: 10 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Training Attended"
                          value={`${growth.trainingAttended}h`}
                          sub="Hours completed"
                          icon={<People />}
                          color="#16a34a"
                          progress={{ achieved: growth.trainingAttended, target: 40 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Investment Initiatives"
                          value={growth.investmentInitiatives}
                          sub="Active projects"
                          icon={<TrendingUp />}
                          color="#2563eb"
                          progress={{ achieved: growth.investmentInitiatives, target: 5 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                          label="Innovation Score"
                          value={growth.innovation.score}
                          sub={`${growth.innovation.ideasImplemented} / ${growth.innovation.ideasSubmitted} ideas`}
                          icon={<EmojiEvents />}
                          color="#d97706"
                          progress={{ achieved: growth.innovation.ideasImplemented, target: growth.innovation.ideasSubmitted }}
                        />
                      </Grid>
                    </Grid>

                    {/* ── Breakdown Panels ── */}
                    <Grid container spacing={2.5}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                          <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={2}>Training Breakdown</Typography>
                          {[
                            { label: 'Training Delivered', val: growth.trainingDelivered, max: 10, color: '#6366f1', suffix: ' sessions' },
                            { label: 'Training Attended',  val: growth.trainingAttended,  max: 40, color: '#16a34a', suffix: ' hrs' },
                          ].map(item => (
                            <Box key={item.label} mb={2.5}>
                              <Stack direction="row" justifyContent="space-between" mb={0.8}>
                                <Typography fontSize={12} color="text.secondary">{item.label}</Typography>
                                <Typography fontSize={12} fontWeight={700} color={item.color} fontFamily="monospace">{item.val}{item.suffix}</Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min((item.val / item.max) * 100, 100)}
                                sx={{ height: 8, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: item.color } }}
                              />
                            </Box>
                          ))}
                        </Paper>
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                          <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={2}>Innovation & Investment</Typography>
                          {[
                            { label: 'Investment Initiatives', val: growth.investmentInitiatives,       max: 5,                               color: '#2563eb', suffix: ' projects' },
                            { label: 'Ideas Implemented',      val: growth.innovation.ideasImplemented, max: growth.innovation.ideasSubmitted, color: '#d97706', suffix: ` / ${growth.innovation.ideasSubmitted}` },
                          ].map(item => (
                            <Box key={item.label} mb={2.5}>
                              <Stack direction="row" justifyContent="space-between" mb={0.8}>
                                <Typography fontSize={12} color="text.secondary">{item.label}</Typography>
                                <Typography fontSize={12} fontWeight={700} color={item.color} fontFamily="monospace">{item.val}{item.suffix}</Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={item.max > 0 ? Math.min((item.val / item.max) * 100, 100) : 0}
                                sx={{ height: 8, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: item.color } }}
                              />
                            </Box>
                          ))}
                        </Paper>
                      </Grid>
                    </Grid>
                  </>
                ) : (
                  <Typography color="text.secondary" fontSize={14}>No growth data for the selected employee.</Typography>
                )}
              </Box>
            )}

            {/* ═══════════════ FINAL PERFORMANCE SUMMARY ═══════════════ */}
            {activeTab === 'summary' && perfScore && (
              <Box display="flex" flexDirection="column" gap={3}>
                <Box>
                  <Typography variant="h6" fontWeight={800} color="text.primary">Final Performance Summary</Typography>
                  <Typography fontSize={13} color="text.secondary" mt={0.3}>
                    Weighted composite score for <strong>{emp?.full_name || '—'}</strong>
                  </Typography>
                </Box>

                {/* Hero card */}
                <Paper variant="outlined" sx={{
                  borderRadius: 3, p: { xs: 2.5, md: 4 },
                  display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                  borderColor: ratingColor(perfScore.rating) + '44',
                  boxShadow: `0 0 0 1px ${ratingColor(perfScore.rating)}22`,
                }}>
                  <Box textAlign="center" flexShrink={0}>
                    <Gauge score={perfScore.overallScore} size={170} />
                    <Typography fontSize={11} color="text.disabled" textTransform="uppercase" letterSpacing=".1em" mt={1}>
                      Overall Score
                    </Typography>
                  </Box>

                  <Box flex={1} minWidth={240}>
                    <Typography fontSize={11} color="text.disabled" textTransform="uppercase" letterSpacing=".1em" mb={0.5}>
                      Performance Rating
                    </Typography>
                    <Typography fontSize={44} fontWeight={900} color={ratingColor(perfScore.rating)} lineHeight={1} mb={1.5}>
                      {perfScore.rating}
                    </Typography>
                    <Stack direction="row" gap={0.5} mb={3}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Typography key={s} fontSize={24}
                          color={s <= Math.ceil(perfScore.overallScore / 20) ? '#fbbf24' : '#e2e8f0'}>★</Typography>
                      ))}
                    </Stack>

                    {([
                      { label: 'KPI Score',     val: perfScore.kpiScore,     weight: '40%', color: '#3b82f6' },
                      { label: 'Target Score',  val: perfScore.targetScore,  weight: '30%', color: '#8b5cf6' },
                      { label: 'Hygiene Score', val: perfScore.hygieneScore, weight: '20%', color: '#16a34a' },
                      { label: 'Growth Score',  val: perfScore.growthScore,  weight: '10%', color: '#d97706' },
                    ] as const).map(item => (
                      <Stack key={item.label} direction="row" alignItems="center" gap={1.5} mb={1.2}>
                        <Typography fontSize={11} color="text.disabled" width={100} flexShrink={0}>{item.label}</Typography>
                        <Box flex={1}>
                          <LinearProgress
                            variant="determinate"
                            value={item.val}
                            sx={{ height: 7, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: item.color } }}
                          />
                        </Box>
                        <Typography fontSize={12} fontWeight={700} color={item.color} fontFamily="monospace" width={32} flexShrink={0}>
                          {item.val.toFixed(0)}
                        </Typography>
                        <Chip
                          label={item.weight}
                          size="small"
                          sx={{ bgcolor: item.color + '18', color: item.color, fontWeight: 700, fontSize: 10, height: 20 }}
                        />
                      </Stack>
                    ))}
                  </Box>
                </Paper>

                {/* Individual gauge grid */}
                <Grid container spacing={2}>
                  {([
                    { label: 'KPI Score',     score: perfScore.kpiScore,     weight: 'Weight: 40%', color: '#3b82f6' },
                    { label: 'Target Score',  score: perfScore.targetScore,  weight: 'Weight: 30%', color: '#8b5cf6' },
                    { label: 'Hygiene Score', score: perfScore.hygieneScore, weight: 'Weight: 20%', color: '#16a34a' },
                    { label: 'Growth Score',  score: perfScore.growthScore,  weight: 'Weight: 10%', color: '#d97706' },
                  ] as const).map(item => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.label}>
                      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, textAlign: 'center' }}>
                        <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".08em" mb={0.5}>
                          {item.label}
                        </Typography>
                        <Chip label={item.weight} size="small" sx={{ bgcolor: item.color + '18', color: item.color, fontWeight: 700, mb: 1.5 }} />
                        <Gauge score={item.score} size={120} />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Score formula */}
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".1em" flexShrink={0}>
                    Formula
                  </Typography>
                  <Typography fontSize={12} fontFamily="monospace" color="text.secondary">
                    Overall = (KPI × 0.4) + (Targets × 0.3) + (Hygiene × 0.2) + (Growth × 0.1) =&nbsp;
                    <Box component="span" sx={{ color: ratingColor(perfScore.rating), fontWeight: 700 }}>
                      {perfScore.kpiScore.toFixed(1)}×0.4 + {perfScore.targetScore.toFixed(1)}×0.3 + {perfScore.hygieneScore.toFixed(1)}×0.2 + {perfScore.growthScore.toFixed(1)}×0.1 = {perfScore.overallScore.toFixed(2)}
                    </Box>
                  </Typography>
                </Paper>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
      </div>
    </div>
  );
};

export default PMSDashboard;