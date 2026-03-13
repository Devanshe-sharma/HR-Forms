import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, CircularProgress, Stack, Grid,
  Avatar, LinearProgress, Card, CardContent, Collapse,
  IconButton, TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  TrendingUp, People, AccessTime, EmojiEvents,
  AutoGraph, HealthAndSafety, ExpandMore, ExpandLess, Search,
  Person, Group,
} from '@mui/icons-material';

const API_BASE = 'http://localhost:5000/api';
const BRAND    = '#3B82F6';

interface Employee {
  _id: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
}

interface Department { _id: string; department: string; }

interface KPIData {
  _id: string; name: string; targetValue: number; achievedValue: number; score: number;
  type?: 'department' | 'role'; department?: string; role?: string; employeeId?: string;
}

interface HygieneData {
  _id: string; employeeId: string;
  attendance: { present: number; total: number; percentage: number };
  lateMarks: number; leaves: { taken: number; allowed: number; remaining: number };
  outOfOffice: number; score: number;
}

interface GrowthData {
  _id: string; employeeId: string; trainingDelivered: number; trainingAttended: number;
  investmentInitiatives: number;
  innovation: { ideasSubmitted: number; ideasImplemented: number; score: number };
  score: number;
}

interface PerformanceScore {
  kpiScore: number; targetScore: number; hygieneScore: number;
  growthScore: number; overallScore: number; rating: string;
}

type TabId = 'kpi' | 'hygiene' | 'growth' | 'summary';

const scoreColor = (s: number) => s >= 0 ? '#16a34a' : s >= -10 ? '#2563eb' : s >= -25 ? '#d97706' : '#dc2626';
const scoreBg    = (s: number) => s >= 0 ? '#dcfce7' : s >= -10 ? '#dbeafe' : s >= -25 ? '#fef3c7' : '#fee2e2';
const ratingColor = (r: string) => ({ 'On Target': '#16a34a', 'Good': '#2563eb', 'Average': '#d97706', 'Below Target': '#dc2626' }[r] || '#64748b');
const scoreLabel  = (s: number) => s === 0 ? '0' : s.toFixed(1);
const progressPct = (achieved: number, target: number) => target <= 0 ? 100 : Math.min(100, Math.max(0, (achieved / target) * 100));

// ─── Safe array extractor ────────────────────────────────────────────────────
function extractArray<T>(res: any): T[] {
  if (!res) return [];
  const d = res.data ?? res;
  if (Array.isArray(d))       return d as T[];
  if (Array.isArray(d.data))  return d.data  as T[];
  if (Array.isArray(d.docs))  return d.docs  as T[];
  if (Array.isArray(d.items)) return d.items as T[];
  return [];
}

// ─── KPI Table ───────────────────────────────────────────────────────────────
interface KPITableProps {
  data: KPIData[]; title: string; accent: string;
  departments: Department[]; employees: Employee[]; showEmpFilter?: boolean;
}

const KPITable: React.FC<KPITableProps> = ({ data, title, accent, departments, employees, showEmpFilter = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [selDept,  setSelDept]  = useState('');
  const [selEmp,   setSelEmp]   = useState(''); // stores email
  const [filterBy, setFilterBy] = useState<'person' | 'role'>('person');
  const [search,   setSearch]   = useState('');

  const filteredEmps = selDept ? employees.filter(e => e.department === selDept) : employees;

  const filtered = data.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchDept   = !selDept || item.department === selDept;

    if (showEmpFilter && selEmp) {
      const emp = employees.find(e => e.email === selEmp);
      if (emp) {
        if (filterBy === 'person') {
          return matchSearch && (item.employeeId === emp._id || item.role === emp.designation);
        } else {
          return matchSearch && item.role === emp.designation;
        }
      }
    }
    return matchDept && matchSearch;
  });

  const avgScore   = filtered.length ? filtered.reduce((s, x) => s + x.score, 0) / filtered.length : 0;
  const totTarget  = filtered.reduce((s, x) => s + x.targetValue, 0);
  const totAchieved = filtered.reduce((s, x) => s + x.achievedValue, 0);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box onClick={() => setExpanded(p => !p)} sx={{
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff',
        borderBottom: expanded ? `2px solid ${accent}` : '1px solid #f1f5f9',
        cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f8fafc' },
      }}>
        <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: accent, flexShrink: 0 }} />
        <Typography fontSize={14} fontWeight={700} flex={1}>{title}</Typography>
        <Stack direction="row" gap={0.8} alignItems="center">
          <Chip label={`${data.length} items`} size="small" sx={{ bgcolor: accent + '15', color: accent, fontWeight: 600, fontSize: 11 }} />
          <Chip label={`Avg: ${scoreLabel(avgScore)}`} size="small" sx={{ bgcolor: scoreBg(avgScore), color: scoreColor(avgScore), fontWeight: 700, fontSize: 11 }} />
        </Stack>
        <IconButton size="small" sx={{ ml: 0.5, color: '#94a3b8' }} onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Stack direction="row" sx={{ px: 2, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField size="small" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 180, bgcolor: '#fff' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: '#94a3b8' }} /></InputAdornment> }} />

          {!showEmpFilter && (
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
              <InputLabel>Department</InputLabel>
              <Select value={selDept} label="Department" onChange={e => { setSelDept(e.target.value as string); setSelEmp(''); }}>
                <MenuItem value=""><em>All</em></MenuItem>
                {departments.map(d => <MenuItem key={d._id} value={d.department}>{d.department}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {showEmpFilter && (
            <>
              <ToggleButtonGroup size="small" value={filterBy} exclusive
                onChange={(_, v) => { if (v) { setFilterBy(v); setSelEmp(''); } }}
                sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1 }}>
                <ToggleButton value="person" sx={{ px: 1.5, fontSize: 11, fontWeight: 600, gap: 0.5 }}>
                  <Person sx={{ fontSize: 14 }} /> Person
                </ToggleButton>
                <ToggleButton value="role" sx={{ px: 1.5, fontSize: 11, fontWeight: 600, gap: 0.5 }}>
                  <Group sx={{ fontSize: 14 }} /> Role
                </ToggleButton>
              </ToggleButtonGroup>

              <FormControl size="small" sx={{ minWidth: 230, bgcolor: '#fff' }}>
                <InputLabel>Select {filterBy === 'person' ? 'Person' : 'Role via Person'}</InputLabel>
                <Select value={selEmp} label={`Select ${filterBy === 'person' ? 'Person' : 'Role via Person'}`}
                  onChange={e => setSelEmp(e.target.value as string)}>
                  <MenuItem value=""><em>All</em></MenuItem>
                  {filteredEmps.map(e => (
                    <MenuItem key={e.email} value={e.email}>
                      <Stack direction="row" gap={1} alignItems="center">
                        <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: BRAND }}>{e.name?.[0]?.toUpperCase()}</Avatar>
                        <Box>
                          <Typography fontSize={12} fontWeight={600}>{e.name}</Typography>
                          {filterBy === 'role' && <Typography fontSize={10} color="text.disabled">{e.designation}</Typography>}
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selEmp && filterBy === 'role' && (() => {
                const emp = employees.find(e => e.email === selEmp);
                return emp ? <Chip label={`Role: ${emp.designation}`} size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, alignSelf: 'center' }} /> : null;
              })()}
            </>
          )}

          {(search || selDept || selEmp) && (
            <Chip label={`${filtered.length} / ${data.length} shown`} size="small"
              onDelete={() => { setSearch(''); setSelDept(''); setSelEmp(''); }}
              sx={{ alignSelf: 'center', bgcolor: accent + '15', color: accent, fontWeight: 600 }} />
          )}
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                {['KPI / Target Name', 'Target', 'Achieved', 'Gap', 'Score', 'Progress'].map(h => (
                  <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', py: 1.2 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#94a3b8', fontSize: 13 }}>No data matches filters</TableCell>
                </TableRow>
              ) : filtered.map(item => {
                const gap = item.targetValue - item.achievedValue;
                const pct = progressPct(item.achievedValue, item.targetValue);
                return (
                  <TableRow key={item._id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>{item.name}</TableCell>
                    <TableCell sx={{ fontSize: 13, fontFamily: 'monospace' }}>{item.targetValue}</TableCell>
                    <TableCell sx={{ fontSize: 13, fontFamily: 'monospace' }}>{item.achievedValue}</TableCell>
                    <TableCell>
                      <Typography fontSize={12} fontFamily="monospace" color={gap > 0 ? '#dc2626' : '#16a34a'} fontWeight={600}>
                        {gap > 0 ? `-${gap.toFixed(1)}` : '0'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={scoreLabel(item.score)} size="small"
                        sx={{ bgcolor: scoreBg(item.score), color: scoreColor(item.score), fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 7, borderRadius: 99, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(item.score) } }} />
                      <Typography fontSize={10} color="text.disabled" mt={0.3}>{pct.toFixed(0)}%</Typography>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filtered.length > 0 && (
                <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', textTransform: 'uppercase' }}>Total / Avg</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{totTarget.toFixed(1)}</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{totAchieved.toFixed(1)}</TableCell>
                  <TableCell>
                    <Typography fontSize={12} fontFamily="monospace" color={totTarget > totAchieved ? '#dc2626' : '#16a34a'} fontWeight={700}>
                      {totTarget > totAchieved ? `−${(totTarget - totAchieved).toFixed(1)}` : '0'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={scoreLabel(avgScore)} size="small"
                      sx={{ bgcolor: scoreBg(avgScore), color: scoreColor(avgScore), fontWeight: 800, fontSize: 12 }} />
                  </TableCell>
                  <TableCell>
                    <LinearProgress variant="determinate" value={progressPct(totAchieved, totTarget)}
                      sx={{ height: 7, borderRadius: 99, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(avgScore) } }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string | number; sub?: string;
  icon: React.ReactElement; color: string; progress?: { achieved: number; target: number };
}
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, color, progress }) => (
  <Card variant="outlined" sx={{ borderRadius: 2, '&:hover': { borderColor: color, boxShadow: `0 0 0 3px ${color}18` } }}>
    <CardContent sx={{ pb: '16px !important' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
        <Box>
          <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".08em" mb={0.5}>{label}</Typography>
          <Typography fontSize={30} fontWeight={800} lineHeight={1} fontFamily="monospace">{value}</Typography>
          {sub && <Typography fontSize={12} color="text.disabled" mt={0.5}>{sub}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: color + '18', width: 44, height: 44 }}>
          {React.cloneElement(icon, { sx: { color, fontSize: 22 } } as object)}
        </Avatar>
      </Stack>
      {progress && <LinearProgress variant="determinate" value={progressPct(progress.achieved, progress.target)}
        sx={{ height: 5, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: color } }} />}
    </CardContent>
  </Card>
);

// ─── Gauge ───────────────────────────────────────────────────────────────────
const Gauge: React.FC<{ score: number; size?: number; worstCase?: number }> = ({ score, size = 130, worstCase = -100 }) => {
  const r = size / 2 - 14, col = scoreColor(score), cx = size / 2, cy = size / 2;
  const fraction = score >= 0 ? 1 : Math.max(0, 1 - Math.abs(score) / Math.abs(worstCase));
  return (
    <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={Math.PI * r} strokeDashoffset={Math.PI * r * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
      <text x={cx} y={cy+10} textAnchor="middle" fill={col} fontSize={size*0.16} fontWeight="800" fontFamily="monospace">{scoreLabel(score)}</text>
      <text x={cx} y={cy+22} textAnchor="middle" fill="#94a3b8" fontSize={size*0.08}>{score >= 0 ? 'On Target' : 'Gap'}</text>
    </svg>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const PMSDashboard: React.FC = () => {
  const location  = useLocation();
  const activeTab = (new URLSearchParams(location.search).get('tab') || 'kpi') as TabId;

  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>(''); // stores email
  const [deptKPI,     setDeptKPI]     = useState<KPIData[]>([]);
  const [roleKPI,     setRoleKPI]     = useState<KPIData[]>([]);
  const [deptTargets, setDeptTargets] = useState<KPIData[]>([]);
  const [roleTargets, setRoleTargets] = useState<KPIData[]>([]);
  const [hygieneData, setHygieneData] = useState<HygieneData[]>([]);
  const [growthData,  setGrowthData]  = useState<GrowthData[]>([]);
  const [perfScore,   setPerfScore]   = useState<PerformanceScore | null>(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => { void fetchEmployees(); void fetchDepartments(); void fetchKPIData(); }, []);

  const calculateScore = useCallback((): void => {
    const emp = employees.find(e => e.email === selectedEmp);
    if (!emp) return;
    const avg = (arr: KPIData[]) => arr.length ? arr.reduce((s, x) => s + x.score, 0) / arr.length : 0;

    const eDK = deptKPI.filter(k => k.department === emp.department);
    const eRK = roleKPI.filter(k => k.employeeId === emp.employee_id || k.role === emp.designation);
    const eDT = deptTargets.filter(k => k.department === emp.department);
    const eRT = roleTargets.filter(k => k.employeeId === emp.employee_id || k.role === emp.designation);

    const kpiScore    = avg([...eDK, ...eRK]);
    const targetScore = avg([...eDT, ...eRT]);
    const hygiene     = hygieneData.find(h => String(h.employeeId) === String(emp.employee_id));
    const growth      = growthData.find(g => String(g.employeeId) === String(emp.employee_id));
    const hygieneScore = hygiene?.score ?? 0;
    const growthScore  = growth?.score  ?? 0;
    const overallScore = kpiScore * 0.4 + targetScore * 0.3 + hygieneScore * 0.2 + growthScore * 0.1;
    const rating = overallScore >= 0 ? 'On Target' : overallScore >= -10 ? 'Good' : overallScore >= -25 ? 'Average' : 'Below Target';
    setPerfScore({ kpiScore, targetScore, hygieneScore, growthScore, overallScore, rating });
  }, [selectedEmp, employees, deptKPI, roleKPI, deptTargets, roleTargets, hygieneData, growthData]);

  useEffect(() => { if (selectedEmp) calculateScore(); }, [selectedEmp, calculateScore]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees`, { params: { lightweight: true } });
      const raw = extractArray<any>(res);
      const list: Employee[] = raw.map((e: any) => ({
        _id:         String(e._id            || ''),
        employee_id:  String(e.employee_id    || e.employeeId || ''),
        name:        String(e.name           || e.full_name || ''),
        email:       String(e.official_email || e.email     || e._id || ''),
        department:  String(e.department     || e.dept      || ''),
        designation: String(e.designation    || e.desig     || ''),
      }));
      setEmployees(list);
      if (list.length > 0) setSelectedEmp(list[0].email);
    } catch (err) { console.error('fetchEmployees:', err); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/departments`);
      setDepartments(extractArray<Department>(res));
    } catch (err) { console.error('fetchDepartments:', err); }
  };

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      const [dkR, rkR, dtR, rtR, hR, gR] = await Promise.allSettled([
        axios.get(`${API_BASE}/dept-kpi`),
        axios.get(`${API_BASE}/role-kpi`),
        axios.get(`${API_BASE}/dept-targets`),
        axios.get(`${API_BASE}/role-targets`),
        axios.get(`${API_BASE}/hygiene`),
        axios.get(`${API_BASE}/growth`),
      ]);
      const safe = (r: PromiseSettledResult<any>, label: string): any[] => {
        if (r.status === 'fulfilled') {
          const arr = extractArray<any>(r.value);
          console.log(`✅ ${label}: ${arr.length} records`, arr[0] ?? '(empty)');
          return arr;
        }
        console.error(`❌ ${label} failed:`, (r as PromiseRejectedResult).reason?.message);
        return [];
      };
      setDeptKPI(    safe(dkR, 'dept-kpi')     as KPIData[]);
      setRoleKPI(    safe(rkR, 'role-kpi')     as KPIData[]);
      setDeptTargets(safe(dtR, 'dept-targets') as KPIData[]);
      setRoleTargets(safe(rtR, 'role-targets') as KPIData[]);
      setHygieneData(safe(hR,  'hygiene')      as HygieneData[]);
      setGrowthData( safe(gR,  'growth')       as GrowthData[]);
    } catch (err) { console.error('fetchKPIData:', err); }
    finally { setLoading(false); }
  };

  const emp     = employees.find(e => e.email === selectedEmp);
  const hygiene = emp ? hygieneData.find(h => String(h.employeeId) === String(emp.employee_id)) : undefined;
  const growth  = emp ? growthData.find(g => String(g.employeeId) === String(emp.employee_id))  : undefined;

  return (
    <div className="flex min-h-screen bg-[#f4f6f2]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <Box sx={{ bgcolor: '#f8fafc', minHeight: '100%', mt: '56px' }}>

          {/* ── Employee selector ── */}
          <Box sx={{
            bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', px: 3, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
            position: 'sticky', top: 0, zIndex: 10,
          }}>
            <Typography fontSize={13} fontWeight={600} color="text.secondary" flexShrink={0}>Employee</Typography>
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <Select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value as string)} displayEmpty
                renderValue={val => {
                  if (!val) return <Typography color="text.disabled" fontSize={13}>Select an employee…</Typography>;
                  const found = employees.find(x => x.email === val);
                  return <Typography fontSize={13} fontWeight={600}>{found?.name ?? ''}</Typography>;
                }}>
                <MenuItem value=""><em>Select an employee…</em></MenuItem>
                {employees.map(e => (
                  <MenuItem key={e.email} value={e.email}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: BRAND }}>{e.name?.[0]?.toUpperCase()}</Avatar>
                      <Box>
                        <Typography fontSize={13} fontWeight={600} lineHeight={1.2}>{e.name}</Typography>
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
                <Chip label={scoreLabel(perfScore.overallScore)}
                  sx={{ bgcolor: scoreBg(perfScore.overallScore), color: scoreColor(perfScore.overallScore), fontWeight: 800, fontSize: 14, height: 30 }} />
                <Chip label={perfScore.rating}
                  sx={{ bgcolor: ratingColor(perfScore.rating) + '18', color: ratingColor(perfScore.rating), fontWeight: 700 }} />
              </Stack>
            )}
          </Box>

          <Box sx={{ p: 3 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                <CircularProgress size={36} />
              </Box>
            ) : (
              <>
                {/* ══ KPI & TARGETS ══ */}
                {activeTab === 'kpi' && (
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>KPI & Targets</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3}>
                        Score = 0 on target · Negative = gap · Click to expand
                      </Typography>
                    </Box>

                    {deptKPI.length === 0 && deptTargets.length === 0 && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff7ed', borderColor: '#f97316' }}>
                        <Typography fontSize={12} color="#c2410c" fontWeight={600}>
                          ⚠️ No KPI data loaded. Check browser console for API errors. Make sure backend is running on port 5000 and collections are seeded.
                        </Typography>
                      </Paper>
                    )}

                    <Grid container spacing={2.5}>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={deptKPI}     title={`Department KPI (${deptKPI.length})`}                  accent="#3b82f6" departments={departments} employees={employees} />
                      </Grid>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={deptTargets} title={`Department Targets (${deptTargets.length})`}           accent="#8b5cf6" departments={departments} employees={employees} />
                      </Grid>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={roleKPI}     title={`Individual / Role KPI (${roleKPI.length})`}            accent="#0891b2" departments={departments} employees={employees} showEmpFilter />
                      </Grid>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={roleTargets} title={`Individual / Role Targets (${roleTargets.length})`}    accent="#d97706" departments={departments} employees={employees} showEmpFilter />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* ══ HYGIENE ══ */}
                {activeTab === 'hygiene' && (
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Hygiene Factors</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3} component="span">
                        Attendance & conduct for <strong>{emp?.name || '—'}</strong>
                        {emp && <Chip label={emp.department} size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600, ml: 1, verticalAlign: 'middle' }} />}
                      </Typography>
                    </Box>

                    {hygieneData.length === 0 && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff7ed', borderColor: '#f97316' }}>
                        <Typography fontSize={12} color="#c2410c" fontWeight={600}>
                          ⚠️ No hygiene records loaded ({hygieneData.length}). Check console for API errors.
                        </Typography>
                      </Paper>
                    )}
                    {hygieneData.length > 0 && !hygiene && emp && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fefce8', borderColor: '#facc15' }}>
                        <Typography fontSize={12} color="#854d0e" fontWeight={600}>
                          ⚠️ {hygieneData.length} hygiene records loaded but none matched employee employee_id "{emp.employee_id}".
                          Sample employeeIds: {hygieneData.slice(0, 3).map(h => h.employeeId).join(', ')}
                        </Typography>
                      </Paper>
                    )}

                    {hygiene ? (
                      <>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Attendance" value={`${hygiene.attendance.percentage.toFixed(1)}%`}
                              sub={`${hygiene.attendance.present} / ${hygiene.attendance.total} days`}
                              icon={<People />} color="#16a34a" progress={{ achieved: hygiene.attendance.percentage, target: 100 }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Late Marks" value={hygiene.lateMarks} sub="This period"
                              icon={<AccessTime />} color={hygiene.lateMarks <= 1 ? '#16a34a' : '#dc2626'} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Leaves Taken" value={hygiene.leaves.taken}
                              sub={`${hygiene.leaves.remaining} remaining of ${hygiene.leaves.allowed}`}
                              icon={<HealthAndSafety />} color="#2563eb"
                              progress={{ achieved: hygiene.leaves.taken, target: hygiene.leaves.allowed }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Out of Office" value={hygiene.outOfOffice} sub="Days"
                              icon={<TrendingUp />} color={hygiene.outOfOffice <= 3 ? '#16a34a' : '#dc2626'} />
                          </Grid>
                        </Grid>

                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                          <Box sx={{ px: 2.5, py: 1.5, borderBottom: '2px solid #16a34a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: '#16a34a' }} />
                            <Typography fontSize={14} fontWeight={700}>Detailed Hygiene Report</Typography>
                            <Chip label={`Score: ${scoreLabel(hygiene.score)}`} size="small"
                              sx={{ ml: 'auto', bgcolor: scoreBg(hygiene.score), color: scoreColor(hygiene.score), fontWeight: 700 }} />
                          </Box>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                                  {['Metric', 'Value', 'Target', 'Gap', 'Score', 'Progress'].map(h => (
                                    <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {([
                                  { metric: 'Attendance', value: `${hygiene.attendance.percentage}%`, target: '≥ 95%',
                                    gap: Math.max(0, 95 - hygiene.attendance.percentage),
                                    score: hygiene.attendance.percentage >= 95 ? 0 : -(95 - hygiene.attendance.percentage),
                                    ach: hygiene.attendance.percentage, tot: 100, color: '#16a34a' },
                                  { metric: 'Late Marks', value: `${hygiene.lateMarks}`, target: '0',
                                    gap: hygiene.lateMarks, score: -hygiene.lateMarks,
                                    ach: Math.max(0, 5 - hygiene.lateMarks), tot: 5, color: '#d97706' },
                                  { metric: 'Leave Usage', value: `${hygiene.leaves.taken} / ${hygiene.leaves.allowed}`, target: '≤ 80%',
                                    gap: Math.max(0, hygiene.leaves.taken - Math.floor(hygiene.leaves.allowed * 0.8)),
                                    score: hygiene.leaves.taken <= hygiene.leaves.allowed * 0.8 ? 0 : -(hygiene.leaves.taken - Math.floor(hygiene.leaves.allowed * 0.8)),
                                    ach: hygiene.leaves.remaining, tot: hygiene.leaves.allowed, color: '#2563eb' },
                                  { metric: 'Out of Office', value: `${hygiene.outOfOffice} days`, target: '≤ 3',
                                    gap: Math.max(0, hygiene.outOfOffice - 3),
                                    score: hygiene.outOfOffice <= 3 ? 0 : -(hygiene.outOfOffice - 3),
                                    ach: Math.max(0, 5 - hygiene.outOfOffice), tot: 5, color: '#7c3aed' },
                                ] as const).map(row => (
                                  <TableRow key={row.metric} hover>
                                    <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>{row.metric}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{row.value}</TableCell>
                                    <TableCell sx={{ fontSize: 12, color: '#64748b' }}>{row.target}</TableCell>
                                    <TableCell>
                                      <Typography fontSize={12} fontFamily="monospace" color={row.gap > 0 ? '#dc2626' : '#16a34a'} fontWeight={600}>
                                        {row.gap > 0 ? `-${row.gap.toFixed(1)}` : '0'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={scoreLabel(row.score)} size="small"
                                        sx={{ bgcolor: scoreBg(row.score), color: scoreColor(row.score), fontWeight: 700, fontFamily: 'monospace' }} />
                                    </TableCell>
                                    <TableCell sx={{ minWidth: 140 }}>
                                      <LinearProgress variant="determinate"
                                        value={row.tot > 0 ? Math.min(100, (row.ach / row.tot) * 100) : 0}
                                        sx={{ height: 6, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: row.color } }} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', textTransform: 'uppercase' }}>Total Hygiene Score</TableCell>
                                  <TableCell colSpan={3} />
                                  <TableCell>
                                    <Chip label={scoreLabel(hygiene.score)} size="small"
                                      sx={{ bgcolor: scoreBg(hygiene.score), color: scoreColor(hygiene.score), fontWeight: 800, fontSize: 13 }} />
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Paper>
                      </>
                    ) : hygieneData.length > 0 ? (
                      <Typography color="text.secondary" fontSize={14}>No hygiene data for this employee.</Typography>
                    ) : null}
                  </Box>
                )}

                {/* ══ GROWTH ══ */}
                {activeTab === 'growth' && (
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Growth Metrics</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3} component="span">
                        Learning, innovation & investment for <strong>{emp?.name || '—'}</strong>
                        {emp && <Chip label={emp.designation} size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, ml: 1, verticalAlign: 'middle' }} />}
                      </Typography>
                    </Box>

                    {growth ? (
                      <>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Training Delivered" value={growth.trainingDelivered} sub="Sessions"
                              icon={<AutoGraph />} color="#6366f1" progress={{ achieved: growth.trainingDelivered, target: 10 }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Training Attended" value={`${growth.trainingAttended}h`} sub={`Target: 40h · Gap: ${Math.max(0, 40 - growth.trainingAttended)}h`}
                              icon={<People />} color={scoreColor(growth.trainingAttended >= 40 ? 0 : -(40 - growth.trainingAttended))}
                              progress={{ achieved: growth.trainingAttended, target: 40 }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Investment Initiatives" value={growth.investmentInitiatives} sub={`Target: 5 · Gap: ${Math.max(0, 5 - growth.investmentInitiatives)}`}
                              icon={<TrendingUp />} color={scoreColor(growth.investmentInitiatives >= 5 ? 0 : -(5 - growth.investmentInitiatives))}
                              progress={{ achieved: growth.investmentInitiatives, target: 5 }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Innovation Score" value={scoreLabel(growth.innovation.score)}
                              sub={`${growth.innovation.ideasImplemented} / ${growth.innovation.ideasSubmitted} ideas`}
                              icon={<EmojiEvents />} color={scoreColor(growth.innovation.score)}
                              progress={{ achieved: growth.innovation.ideasImplemented, target: growth.innovation.ideasSubmitted }} />
                          </Grid>
                        </Grid>

                        <Grid container spacing={2.5}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                              <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={2}>Training Breakdown</Typography>
                              {[
                                { label: 'Training Delivered', val: growth.trainingDelivered, target: 10, color: '#6366f1', suffix: ' sessions' },
                                { label: 'Training Attended',  val: growth.trainingAttended,  target: 40, color: '#16a34a', suffix: ' hrs' },
                              ].map(item => {
                                const sc = item.val >= item.target ? 0 : -(item.target - item.val);
                                return (
                                  <Box key={item.label} mb={2.5}>
                                    <Stack direction="row" justifyContent="space-between" mb={0.8}>
                                      <Typography fontSize={12} color="text.secondary">{item.label}</Typography>
                                      <Stack direction="row" gap={1} alignItems="center">
                                        <Typography fontSize={12} fontWeight={700} color={item.color} fontFamily="monospace">{item.val}{item.suffix}</Typography>
                                        <Chip label={scoreLabel(sc)} size="small" sx={{ bgcolor: scoreBg(sc), color: scoreColor(sc), fontWeight: 700, fontSize: 10, height: 18 }} />
                                      </Stack>
                                    </Stack>
                                    <LinearProgress variant="determinate" value={progressPct(item.val, item.target)}
                                      sx={{ height: 8, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(sc) } }} />
                                  </Box>
                                );
                              })}
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                              <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={2}>Innovation & Investment</Typography>
                              {[
                                { label: 'Investment Initiatives', val: growth.investmentInitiatives, target: 5, color: '#2563eb', suffix: ' projects' },
                                { label: 'Ideas Implemented', val: growth.innovation.ideasImplemented, target: growth.innovation.ideasSubmitted, color: '#d97706', suffix: ` / ${growth.innovation.ideasSubmitted}` },
                              ].map(item => {
                                const sc = item.val >= item.target ? 0 : -(item.target - item.val);
                                return (
                                  <Box key={item.label} mb={2.5}>
                                    <Stack direction="row" justifyContent="space-between" mb={0.8}>
                                      <Typography fontSize={12} color="text.secondary">{item.label}</Typography>
                                      <Stack direction="row" gap={1} alignItems="center">
                                        <Typography fontSize={12} fontWeight={700} color={item.color} fontFamily="monospace">{item.val}{item.suffix}</Typography>
                                        <Chip label={scoreLabel(sc)} size="small" sx={{ bgcolor: scoreBg(sc), color: scoreColor(sc), fontWeight: 700, fontSize: 10, height: 18 }} />
                                      </Stack>
                                    </Stack>
                                    <LinearProgress variant="determinate" value={item.target > 0 ? progressPct(item.val, item.target) : 0}
                                      sx={{ height: 8, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(sc) } }} />
                                  </Box>
                                );
                              })}
                            </Paper>
                          </Grid>
                        </Grid>

                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".1em">Growth Score</Typography>
                          <Chip label={scoreLabel(growth.score)} sx={{ bgcolor: scoreBg(growth.score), color: scoreColor(growth.score), fontWeight: 800, fontSize: 14, height: 28 }} />
                          <Typography fontSize={12} color="text.secondary">= (Training×0.4) + (Investment×0.3) + (Innovation×0.3)</Typography>
                        </Paper>
                      </>
                    ) : (
                      <Typography color="text.secondary" fontSize={14}>No growth data for this employee.</Typography>
                    )}
                  </Box>
                )}

                {/* ══ SUMMARY ══ */}
                {activeTab === 'summary' && perfScore && (
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Final Performance Summary</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3}>
                        Weighted composite for <strong>{emp?.name || '—'}</strong>
                        {emp && <> · {emp.department} · {emp.designation}</>}
                      </Typography>
                    </Box>

                    <Paper variant="outlined" sx={{
                      borderRadius: 3, p: { xs: 2.5, md: 4 },
                      display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                      borderColor: ratingColor(perfScore.rating) + '44',
                      boxShadow: `0 0 0 1px ${ratingColor(perfScore.rating)}22`,
                    }}>
                      <Box textAlign="center" flexShrink={0}>
                        <Gauge score={perfScore.overallScore} size={170} />
                        <Typography fontSize={11} color="text.disabled" textTransform="uppercase" letterSpacing=".1em" mt={1}>Overall Score</Typography>
                      </Box>
                      <Box flex={1} minWidth={240}>
                        <Typography fontSize={11} color="text.disabled" textTransform="uppercase" letterSpacing=".1em" mb={0.5}>Performance Rating</Typography>
                        <Typography fontSize={44} fontWeight={900} color={ratingColor(perfScore.rating)} lineHeight={1} mb={2}>{perfScore.rating}</Typography>
                        <Stack direction="row" gap={1} mb={2.5} flexWrap="wrap">
                          {[{ l: '0 = On Target', c: '#16a34a' }, { l: '≥ −10 = Good', c: '#2563eb' }, { l: '≥ −25 = Average', c: '#d97706' }, { l: '< −25 = Below', c: '#dc2626' }].map(x => (
                            <Chip key={x.l} label={x.l} size="small" sx={{ bgcolor: x.c + '18', color: x.c, fontWeight: 600, fontSize: 10 }} />
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
                              <LinearProgress variant="determinate" value={item.val >= 0 ? 100 : Math.max(0, 100 + item.val)}
                                sx={{ height: 7, borderRadius: 99, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(item.val) } }} />
                            </Box>
                            <Chip label={scoreLabel(item.val)} size="small"
                              sx={{ bgcolor: scoreBg(item.val), color: scoreColor(item.val), fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }} />
                            <Chip label={item.weight} size="small"
                              sx={{ bgcolor: item.color + '18', color: item.color, fontWeight: 700, fontSize: 10, height: 20 }} />
                          </Stack>
                        ))}
                      </Box>
                    </Paper>

                    <Grid container spacing={2}>
                      {([
                        { label: 'KPI Score',     score: perfScore.kpiScore,     weight: 'Weight: 40%', color: '#3b82f6' },
                        { label: 'Target Score',  score: perfScore.targetScore,  weight: 'Weight: 30%', color: '#8b5cf6' },
                        { label: 'Hygiene Score', score: perfScore.hygieneScore, weight: 'Weight: 20%', color: '#16a34a' },
                        { label: 'Growth Score',  score: perfScore.growthScore,  weight: 'Weight: 10%', color: '#d97706' },
                      ] as const).map(item => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.label}>
                          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, textAlign: 'center' }}>
                            <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".08em" mb={0.5}>{item.label}</Typography>
                            <Chip label={item.weight} size="small" sx={{ bgcolor: item.color + '18', color: item.color, fontWeight: 700, mb: 1.5 }} />
                            <Gauge score={item.score} size={120} />
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".1em" flexShrink={0}>Formula</Typography>
                      <Typography fontSize={12} fontFamily="monospace" color="text.secondary">
                        Overall = (KPI×0.4) + (Targets×0.3) + (Hygiene×0.2) + (Growth×0.1) =&nbsp;
                        <Box component="span" sx={{ color: ratingColor(perfScore.rating), fontWeight: 700 }}>
                          {scoreLabel(perfScore.kpiScore)}×0.4 + {scoreLabel(perfScore.targetScore)}×0.3 + {scoreLabel(perfScore.hygieneScore)}×0.2 + {scoreLabel(perfScore.growthScore)}×0.1 = {scoreLabel(perfScore.overallScore)}
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