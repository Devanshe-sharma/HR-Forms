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

const API_BASE = 'http://3.109.132.204:5000/api';
const BRAND    = '#3B82F6';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Employee {
  _id:         string;  // MongoDB ObjectId — matches employeeId in hygienes/growths/rolekpis
  name:        string;  // display only
  email:       string;  // official_email — React unique key
  department:  string;
  designation: string;
}

interface Department { _id: string; department: string; }

interface KPIData {
  _id: string; name: string; targetValue: number; achievedValue: number; score: number;
  type?: 'department' | 'role'; dept?: string; department?: string; role?: string; employeeId?: string;
}

interface HygieneData {
  _id: string; employeeId: string; // = Employee._id (ObjectId as string)
  attendance: { present: number; total: number; percentage: number };
  lateMarks: number; leaves: { taken: number; allowed: number; remaining: number };
  outOfOffice: number; score: number;
}

interface GrowthData {
  _id: string; employeeId: string; // = Employee._id (ObjectId as string)
  trainingDelivered: number; trainingAttended: number; investmentInitiatives: number;
  innovation: { ideasSubmitted: number; ideasImplemented: number; score: number };
  score: number;
}

interface PerformanceScore {
  kpiScore: number; targetScore: number; hygieneScore: number;
  growthScore: number; overallScore: number; rating: string;
}

type TabId = 'kpi' | 'hygiene' | 'growth' | 'summary';


// ─── Animations ───────────────────────────────────────────────────────────────
const fadeSlideIn = {
  '@keyframes fadeSlideIn': {
    from: { opacity: 0, transform: 'translateY(12px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  animation: 'fadeSlideIn 0.35s cubic-bezier(0.22,1,0.36,1)',
};
const fadeIn = {
  '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
  animation: 'fadeIn 0.3s ease',
};
const scaleIn = {
  '@keyframes scaleIn': {
    from: { opacity: 0, transform: 'scale(0.96)' },
    to:   { opacity: 1, transform: 'scale(1)' },
  },
  animation: 'scaleIn 0.3s cubic-bezier(0.22,1,0.36,1)',
};

// ─── Score helpers ────────────────────────────────────────────────────────────
const scoreColor  = (s: number) => s >= 0 ? '#15803d' : s >= -10 ? '#1d4ed8' : s >= -25 ? '#b45309' : '#b91c1c';
const scoreBg     = (s: number) => s >= 0 ? '#bbf7d0' : s >= -10 ? '#bfdbfe' : s >= -25 ? '#fde68a' : '#fecaca';
const ratingColor = (r: string) => ({'On Target':'#16a34a','Good':'#2563eb','Average':'#d97706','Below Target':'#dc2626'}[r] || '#64748b');
const scoreLabel  = (s: number) => s === 0 ? '0' : s.toFixed(1);
const progressPct = (a: number, t: number) => t <= 0 ? 100 : Math.min(100, Math.max(0, (a / t) * 100));

// ─── Safe array extractor — handles {data:[...]}, [...], {docs:[...]} ─────────
function extractArray<T>(res: any): T[] {
  if (!res) return [];
  const d = res.data ?? res;
  if (Array.isArray(d))       return d as T[];
  if (Array.isArray(d.data))  return d.data  as T[];
  if (Array.isArray(d.docs))  return d.docs  as T[];
  if (Array.isArray(d.items)) return d.items as T[];
  return [];
}

// ─── KPI Table ────────────────────────────────────────────────────────────────
interface KPITableProps {
  data: KPIData[]; title: string; accent: string;
  departments: Department[]; employees: Employee[]; showEmpFilter?: boolean;
}

const KPITable: React.FC<KPITableProps> = ({ data, title, accent, departments, employees, showEmpFilter = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [selDept,  setSelDept]  = useState('');
  const [selEmp,   setSelEmp]   = useState(''); // email (unique key)
  const [filterBy, setFilterBy] = useState<'person' | 'role'>('person');
  const [search,   setSearch]   = useState('');

  const filteredEmps = selDept ? employees.filter(e => e.department === selDept) : employees;

  const filtered = data.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchDept   = !selDept || (item.dept || item.department) === selDept;

    if (showEmpFilter && selEmp) {
      const emp = employees.find(e => e.email === selEmp);
      if (emp) {
        if (filterBy === 'person') {
          // match by employee's MongoDB _id OR by role/designation
          return matchSearch && (
            String(item.employeeId) === String(emp._id) ||
            item.role === emp.designation
          );
        } else {
          // all people with same designation (role)
          return matchSearch && item.role === emp.designation;
        }
      }
    }
    return matchDept && matchSearch;
  });

  const avgScore    = filtered.length ? filtered.reduce((s, x) => s + x.score, 0) / filtered.length : 0;
  const totTarget   = filtered.reduce((s, x) => s + x.targetValue, 0);
  const totAchieved = filtered.reduce((s, x) => s + x.achievedValue, 0);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 20px rgba(99,102,241,0.10)', border: '1px solid #e0e7ff', transition: 'box-shadow 0.25s ease, transform 0.25s ease', '&:hover': { boxShadow: '0 8px 32px rgba(99,102,241,0.16)', transform: 'translateY(-1px)' }, ...fadeSlideIn }}>
      <Box onClick={() => setExpanded(p => !p)} sx={{
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff',
        borderBottom: expanded ? `2px solid ${accent}` : '1px solid #e0e7ff',
        cursor: 'pointer', userSelect: 'none', transition: 'background-color 0.2s', '&:hover': { bgcolor: '#eef2ff' },
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
        <Stack direction="row" sx={{ px: 2, py: 1.5, bgcolor: '#f5f3ff', borderBottom: '1px solid #ddd6fe', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField size="small" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 180, bgcolor: '#faf5ff' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: '#94a3b8' }} /></InputAdornment> }} />

          {!showEmpFilter && (
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#faf5ff' }}>
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
                sx={{ bgcolor: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 1 }}>
                <ToggleButton value="person" sx={{ px: 1.5, fontSize: 11, fontWeight: 600, gap: 0.5 }}>
                  <Person sx={{ fontSize: 14 }} /> Person
                </ToggleButton>
                <ToggleButton value="role" sx={{ px: 1.5, fontSize: 11, fontWeight: 600, gap: 0.5 }}>
                  <Group sx={{ fontSize: 14 }} /> Role
                </ToggleButton>
              </ToggleButtonGroup>

              <FormControl size="small" sx={{ minWidth: 230, bgcolor: '#faf5ff' }}>
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
                const e = employees.find(x => x.email === selEmp);
                return e ? <Chip label={`Role: ${e.designation}`} size="small" sx={{ bgcolor: '#bbf7d0', color: '#166534', fontWeight: 600, alignSelf: 'center' }} /> : null;
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
              <TableRow sx={{ bgcolor: '#ede9fe' }}>
                {['KPI / Target Name', 'Dept / Role', 'Target', 'Achieved', 'Gap', 'Score', 'Progress'].map(h => (
                  <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.06em', py: 1.2, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: '#94a3b8', fontSize: 13 }}>No data matches filters</TableCell>
                </TableRow>
              ) : filtered.map(item => {
                const gap = item.targetValue - item.achievedValue;
                const pct = progressPct(item.achievedValue, item.targetValue);
                return (
                  <TableRow key={item._id} hover sx={{ transition: 'background-color 0.15s', '&:hover': { bgcolor: '#eef2ff' } }}>
                    <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>{item.name}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#64748b' }}>
                      {item.dept || item.department || item.role || '—'}
                    </TableCell>
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
                        sx={{ height: 7, borderRadius: 99, bgcolor: '#ddd6fe', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(item.score) } }} />
                      <Typography fontSize={10} color="text.disabled" mt={0.3}>{pct.toFixed(0)}%</Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length > 0 && (
                <TableRow sx={{ bgcolor: '#f0f4ff', borderTop: '2px solid #c4b5fd' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', textTransform: 'uppercase' }}>Total / Avg</TableCell>
                  <TableCell />
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
                      sx={{ height: 7, borderRadius: 99, bgcolor: '#ddd6fe', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(avgScore) } }} />
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string | number; sub?: string;
  icon: React.ReactElement; color: string; progress?: { achieved: number; target: number };
}
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, color, progress }) => (
  <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 16px rgba(99,102,241,0.10)', border: '1px solid #e0e7ff', transition: 'box-shadow 0.25s ease, transform 0.25s ease, border-color 0.2s', '&:hover': { borderColor: color, boxShadow: `0 8px 28px ${color}30`, transform: 'translateY(-2px)' }, ...scaleIn }}>
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
        sx={{ height: 5, borderRadius: 99, bgcolor: '#ddd6fe', '& .MuiLinearProgress-bar': { bgcolor: color } }} />}
    </CardContent>
  </Card>
);

// ─── Gauge ────────────────────────────────────────────────────────────────────
const Gauge: React.FC<{ score: number; size?: number; worstCase?: number }> = ({ score, size = 130, worstCase = -100 }) => {
  const r = size / 2 - 14, col = scoreColor(score), cx = size / 2, cy = size / 2;
  const fraction = score >= 0 ? 1 : Math.max(0, 1 - Math.abs(score) / Math.abs(worstCase));
  return (
    <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#ddd6fe" strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={Math.PI * r} strokeDashoffset={Math.PI * r * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
      <text x={cx} y={cy+10} textAnchor="middle" fill={col} fontSize={size*0.16} fontWeight="800" fontFamily="monospace">{scoreLabel(score)}</text>
      <text x={cx} y={cy+22} textAnchor="middle" fill="#7c3aed" fontSize={size*0.08}>{score >= 0 ? 'On Target' : 'Gap'}</text>
    </svg>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const PMSDashboard: React.FC = () => {
  const location  = useLocation();
  const activeTab = (new URLSearchParams(location.search).get('tab') || 'kpi') as TabId;

  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>(''); // stores email (unique key)
  const [deptKPI,     setDeptKPI]     = useState<KPIData[]>([]);
  const [roleKPI,     setRoleKPI]     = useState<KPIData[]>([]);
  const [deptTargets, setDeptTargets] = useState<KPIData[]>([]);
  const [roleTargets, setRoleTargets] = useState<KPIData[]>([]);
  const [hygieneData, setHygieneData] = useState<HygieneData[]>([]);
  const [growthData,  setGrowthData]  = useState<GrowthData[]>([]);
  const [perfScore,   setPerfScore]   = useState<PerformanceScore | null>(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => { void fetchEmployees(); void fetchDepartments(); void fetchKPIData(); }, []);

  // ─── Score calculation ─────────────────────────────────────────────────────
  const calculateScore = useCallback((): void => {
    const emp = employees.find(e => e.email === selectedEmp);
    if (!emp) return;
    const avg = (arr: KPIData[]) => arr.length ? arr.reduce((s, x) => s + x.score, 0) / arr.length : 0;

    // Match roleKPI/roleTargets by employee's MongoDB _id OR designation
    const eDK = deptKPI.filter(k => k.department === emp.department);
    const eRK = roleKPI.filter(k => String(k.employeeId) === String(emp._id) || k.role === emp.designation);
    const eDT = deptTargets.filter(k => k.department === emp.department);
    const eRT = roleTargets.filter(k => String(k.employeeId) === String(emp._id) || k.role === emp.designation);

    const kpiScore    = avg([...eDK, ...eRK]);
    const targetScore = avg([...eDT, ...eRT]);
    // Hygiene/Growth store Employee._id as employeeId (ObjectId string)
    const hygiene      = hygieneData.find(h => String(h.employeeId) === String(emp._id));
    const growth       = growthData.find(g => String(g.employeeId) === String(emp._id));
    const hygieneScore = hygiene?.score ?? 0;
    const growthScore  = growth?.score  ?? 0;
    const overallScore = kpiScore * 0.4 + targetScore * 0.3 + hygieneScore * 0.2 + growthScore * 0.1;
    const rating = overallScore >= 0 ? 'On Target' : overallScore >= -10 ? 'Good' : overallScore >= -25 ? 'Average' : 'Below Target';
    setPerfScore({ kpiScore, targetScore, hygieneScore, growthScore, overallScore, rating });
  }, [selectedEmp, employees, deptKPI, roleKPI, deptTargets, roleTargets, hygieneData, growthData]);

  useEffect(() => { if (selectedEmp) calculateScore(); }, [selectedEmp, calculateScore]);

  // ─── Fetchers ──────────────────────────────────────────────────────────────

  // Employee route (lightweight) returns:
  //   { _id, name, department, designation, email, score }
  // We ALSO need _id for matching hygiene/growth/roleKPI.
  // Solution: fetch full list but only pick needed fields, OR add _id to lightweight response.
  // Since we can't change the backend right now, fetch without lightweight flag and pick fields.
  const fetchEmployees = async () => {
    try {
      // First try lightweight (if backend returns _id in it)
      const res = await axios.get(`${API_BASE}/employees`, { params: { lightweight: true } });
      const raw = extractArray<any>(res);

      const list: Employee[] = raw.map((e: any) => ({
        _id:         String(e._id         || ''),
        name:        String(e.name        || e.full_name   || ''),
        email:       String(e.email       || e.official_email || String(e._id) || ''),
        department:  String(e.department  || e.dept        || ''),
        designation: String(e.designation || e.desig       || ''),
      }));

      // If _id is empty (backend doesn't expose it), fetch full list to get it
      if (list.length > 0 && !list[0]._id) {
        await fetchEmployeesFull();
        return;
      }

      console.log('✅ employees:', list.length, 'sample _id:', list[0]?._id);
      setEmployees(list);
      if (list.length > 0) setSelectedEmp(list[0].email);
    } catch (err) { console.error('fetchEmployees:', err); }
  };

  const fetchEmployeesFull = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees`);
      const raw = extractArray<any>(res);
      const list: Employee[] = raw.map((e: any) => ({
        _id:         String(e._id            || ''),
        name:        String(e.name           || e.full_name   || ''),
        email:       String(e.official_email || e.email       || String(e._id) || ''),
        department:  String(e.department     || e.dept        || ''),
        designation: String(e.designation    || e.desig       || ''),
      }));
      console.log('✅ employees (full):', list.length, 'sample _id:', list[0]?._id);
      setEmployees(list);
      if (list.length > 0) setSelectedEmp(list[0].email);
    } catch (err) { console.error('fetchEmployeesFull:', err); }
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
          console.log(`✅ ${label}: ${arr.length} records`, arr[0] ? JSON.stringify(arr[0]).slice(0, 120) : '(empty)');
          return arr;
        }
        console.error(`❌ ${label} FAILED:`, (r as PromiseRejectedResult).reason?.message);
        return [];
      };

      setDeptKPI(    safe(dkR, 'dept-kpi')     as KPIData[]);
      setRoleKPI(    safe(rkR, 'role-kpi')     as KPIData[]);
      setDeptTargets(safe(dtR, 'dept-targets') as KPIData[]);
      setRoleTargets(safe(rtR, 'role-targets') as KPIData[]);
      setHygieneData(safe(hR,  'hygiene')      as HygieneData[]);
      setGrowthData( safe(gR,  'growth')       as GrowthData[]);
    } catch (err) { console.error('fetchKPIData outer:', err); }
    finally { setLoading(false); }
  };

  const emp     = employees.find(e => e.email === selectedEmp);
  const hygiene = emp ? hygieneData.find(h => String(h.employeeId) === String(emp._id)) : undefined;
  const growth  = emp ? growthData.find(g => String(g.employeeId) === String(emp._id))  : undefined;

  return (
    <div className="flex min-h-screen bg-[#f0f4ff]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <Box sx={{ bgcolor: '#f0f4ff', minHeight: '100%', mt: '56px' }}>

          {/* ── Employee selector bar ── */}
          <Box sx={{
            bgcolor: '#ffffff', borderBottom: '1px solid #e0e7ff', boxShadow: '0 2px 8px rgba(99,102,241,0.07)', px: 3, py: 1.5, mt: 8,
            display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
            position: 'sticky', top: 56, zIndex: 10,
          }}>
            <Typography fontSize={13} fontWeight={600} color="text.secondary" flexShrink={0}>Employee</Typography>
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <Select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value as string)} displayEmpty
                renderValue={val => {
                  if (!val) return <Typography color="text.disabled" fontSize={13}>Select an employee…</Typography>;
                  const f = employees.find(x => x.email === val);
                  return <Typography fontSize={13} fontWeight={600}>{f?.name ?? ''}</Typography>;
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
                <Chip label={emp.department}  size="small" sx={{ bgcolor: '#bfdbfe', color: '#1e40af', fontWeight: 600 }} />
                <Chip label={emp.designation} size="small" sx={{ bgcolor: '#bbf7d0', color: '#166534', fontWeight: 600 }} />
              </Stack>
            )}

            {perfScore && (
              <Stack direction="row" alignItems="center" gap={1.5} sx={{ ml: 'auto' }}>
                <Typography fontSize={12} color="text.disabled">Overall</Typography>
                <Chip label={scoreLabel(perfScore.overallScore)}
                  sx={{ bgcolor: scoreBg(perfScore.overallScore), color: scoreColor(perfScore.overallScore), fontWeight: 800, fontSize: 14, height: 30, transition: 'all 0.3s ease' }} />
                <Chip label={perfScore.rating}
                  sx={{ bgcolor: ratingColor(perfScore.rating) + '18', color: ratingColor(perfScore.rating), fontWeight: 700 }} />
              </Stack>
            )}
          </Box>

          <Box sx={{ p: 3 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height={300}><CircularProgress size={36} /></Box>
            ) : (
              <>
                {/* ══ KPI & TARGETS ══ */}
                {activeTab === 'kpi' && (
                  <Box display="flex" flexDirection="column" gap={3} sx={fadeSlideIn}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>KPI & Targets</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3}>Score = 0 on target · Negative = gap · Click to expand</Typography>
                    </Box>
                    {(deptKPI.length === 0 && deptTargets.length === 0) && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff7ed', borderColor: '#f97316', boxShadow: '0 2px 8px rgba(249,115,22,0.10)', borderRadius: 2 }}>
                        <Typography fontSize={12} color="#c2410c" fontWeight={600}>
                          ⚠️ No KPI data loaded. Open browser console to see API errors.
                          Common cause: the <code>deptTargets</code> collection name mismatch — check pmsModels.js collection name.
                        </Typography>
                      </Paper>
                    )}
                    <Grid container spacing={2.5}>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={deptKPI}     title={`Department KPI (${deptKPI.length})`}               accent="#3b82f6" departments={departments} employees={employees} />
                      </Grid>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={deptTargets} title={`Department Targets (${deptTargets.length})`}        accent="#8b5cf6" departments={departments} employees={employees} />
                      </Grid>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={roleKPI}     title={`Individual / Role KPI (${roleKPI.length})`}         accent="#0891b2" departments={departments} employees={employees} showEmpFilter />
                      </Grid>
                      <Grid size={{ xs: 12, xl: 6 }}>
                        <KPITable data={roleTargets} title={`Individual / Role Targets (${roleTargets.length})`} accent="#d97706" departments={departments} employees={employees} showEmpFilter />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* ══ HYGIENE ══ */}
                {activeTab === 'hygiene' && (
                  <Box display="flex" flexDirection="column" gap={3} sx={fadeSlideIn}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Hygiene Factors</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3}>All employees' attendance & conduct</Typography>
                    </Box>

                    {hygieneData.length === 0 && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff7ed', borderColor: '#f97316', boxShadow: '0 2px 8px rgba(249,115,22,0.10)', borderRadius: 2 }}>
                        <Typography fontSize={12} color="#c2410c" fontWeight={600}>
                          ⚠️ No hygiene records loaded. Check browser console for API errors.
                        </Typography>
                      </Paper>
                    )}

                    {hygiene && emp && (
                      <Paper
                        variant="outlined"
                        sx={{
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          boxShadow: '0 2px 10px rgba(99,102,241,0.08)',
                          border: '1px solid #e0e7ff',
                          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                          '&:hover': {
                            boxShadow: '0 4px 18px rgba(99,102,241,0.14)',
                            transform: 'translateY(-1px)'
                          },
                          ...fadeSlideIn
                        }}
                      >
                        <Box
                          sx={{
                            px: 1.5,
                            py: 1,
                            borderBottom: '1px solid #3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <Box sx={{ width: 3, height: 16, borderRadius: 1, bgcolor: '#3b82f6' }} />

                          <Typography fontSize={13} fontWeight={700}>
                            {emp.name}
                          </Typography>

                          <Chip
                            label={emp.department}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              bgcolor: '#bfdbfe',
                              color: '#1e40af',
                              fontWeight: 600
                            }}
                          />

                          <Chip
                            label={scoreLabel(hygiene.score)}
                            size="small"
                            sx={{
                              ml: 'auto',
                              height: 20,
                              fontSize: 10,
                              bgcolor: scoreBg(hygiene.score),
                              color: scoreColor(hygiene.score),
                              fontWeight: 700
                            }}
                          />
                        </Box>

                        <Box sx={{ p: 1.5 }}>
                          <Grid container spacing={1}>
                            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                              <StatCard
                                label="Attendance"
                                value={`${hygiene.attendance.percentage.toFixed(1)}%`}
                                sub={`${hygiene.attendance.present}/${hygiene.attendance.total}`}
                                icon={<People fontSize="small" />}
                                color="#16a34a"
                                progress={{
                                  achieved: hygiene.attendance.percentage,
                                  target: 100
                                }}
                              />
                            </Grid>

                            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                              <StatCard
                                label="Late Marks"
                                value={hygiene.lateMarks}
                                sub="This period"
                                icon={<AccessTime fontSize="small" />}
                                color={hygiene.lateMarks <= 1 ? '#16a34a' : '#dc2626'}
                              />
                            </Grid>

                            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                              <StatCard
                                label="Leaves Taken"
                                value={hygiene.leaves.taken}
                                sub={`${hygiene.leaves.remaining}/${hygiene.leaves.allowed}`}
                                icon={<HealthAndSafety fontSize="small" />}
                                color="#2563eb"
                                progress={{
                                  achieved: hygiene.leaves.taken,
                                  target: hygiene.leaves.allowed
                                }}
                              />
                            </Grid>

                            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                              <StatCard
                                label="Out of Office"
                                value={hygiene.outOfOffice}
                                sub="Days"
                                icon={<TrendingUp fontSize="small" />}
                                color={hygiene.outOfOffice <= 3 ? '#16a34a' : '#dc2626'}
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      </Paper>
                    )}

                    {hygieneData.length > 0 && (
                      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 20px rgba(99,102,241,0.10)', border: '1px solid #e0e7ff', transition: 'box-shadow 0.25s ease, transform 0.25s ease', '&:hover': { boxShadow: '0 8px 32px rgba(99,102,241,0.16)', transform: 'translateY(-1px)' }, ...fadeSlideIn }}>
                        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '2px solid #16a34a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: '#16a34a' }} />
                          <Typography fontSize={14} fontWeight={700}>All Employees Hygiene</Typography>
                          <Chip label={`${hygieneData.length} records`} size="small" sx={{ ml: 'auto', bgcolor: '#bbf7d0', color: '#166534', fontWeight: 700 }} />
                        </Box>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: '#ede9fe' }}>
                                {['Employee', 'Attendance', 'Late Marks', 'Leaves Taken', 'Out of Office', 'Score'].map(h => (
                                  <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.06em', py: 1.2 }}>{h}</TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {hygieneData.map(h => {
                                const e = employees.find(x => String(x._id) === String(h.employeeId));
                                return (
                                  <TableRow key={h._id} hover sx={{ transition: 'background-color 0.15s', '&:hover': { bgcolor: '#eef2ff' } }}>
                                    <TableCell>
                                      <Stack direction="row" gap={1} alignItems="center">
                                        <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: BRAND }}>{e?.name?.[0]?.toUpperCase() ?? '?'}</Avatar>
                                        <Box>
                                          <Typography fontSize={12} fontWeight={600}>{e?.name ?? <em style={{ color: '#94a3b8' }}>ID: {h.employeeId}</em>}</Typography>
                                          {e && <Typography fontSize={10} color="text.disabled">{e.department}</Typography>}
                                        </Box>
                                      </Stack>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                                      {h.attendance.percentage.toFixed(1)}%
                                      <Typography fontSize={10} color="text.disabled">{h.attendance.present}/{h.attendance.total} days</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={h.lateMarks} size="small"
                                        sx={{ bgcolor: h.lateMarks <= 1 ? '#bbf7d0' : '#fecaca', color: h.lateMarks <= 1 ? '#166534' : '#b91c1c', fontWeight: 700 }} />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                                      {h.leaves.taken}/{h.leaves.allowed}
                                      <Typography fontSize={10} color="text.disabled">{h.leaves.remaining} remaining</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={`${h.outOfOffice}d`} size="small"
                                        sx={{ bgcolor: h.outOfOffice <= 3 ? '#bbf7d0' : '#fecaca', color: h.outOfOffice <= 3 ? '#166534' : '#b91c1c', fontWeight: 700 }} />
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={scoreLabel(h.score)} size="small"
                                        sx={{ bgcolor: scoreBg(h.score), color: scoreColor(h.score), fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }} />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    )}

                    {/* Selected employee detail */}
                    
                  </Box>
                )}

                {/* ══ GROWTH ══ */}
                {activeTab === 'growth' && (
                  <Box display="flex" flexDirection="column" gap={3} sx={fadeSlideIn}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Growth Metrics</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3} component="span">
                        Learning, innovation & investment for <strong>{emp?.name || '—'}</strong>
                        {emp && <Chip label={emp.designation} size="small" sx={{ bgcolor: '#bbf7d0', color: '#166534', fontWeight: 600, ml: 1, verticalAlign: 'middle' }} />}
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
                            <StatCard label="Training Attended" value={`${growth.trainingAttended}h`}
                              sub={`Target: 40h · Gap: ${Math.max(0, 40 - growth.trainingAttended)}h`}
                              icon={<People />} color={scoreColor(growth.trainingAttended >= 40 ? 0 : -(40 - growth.trainingAttended))}
                              progress={{ achieved: growth.trainingAttended, target: 40 }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Investment Initiatives" value={growth.investmentInitiatives}
                              sub={`Target: 5 · Gap: ${Math.max(0, 5 - growth.investmentInitiatives)}`}
                              icon={<TrendingUp />} color={scoreColor(growth.investmentInitiatives >= 5 ? 0 : -(5 - growth.investmentInitiatives))}
                              progress={{ achieved: growth.investmentInitiatives, target: 5 }} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <StatCard label="Innovation Score" value={scoreLabel(growth.innovation.score)}
                              sub={`${growth.innovation.ideasImplemented}/${growth.innovation.ideasSubmitted} ideas`}
                              icon={<EmojiEvents />} color={scoreColor(growth.innovation.score)}
                              progress={{ achieved: growth.innovation.ideasImplemented, target: growth.innovation.ideasSubmitted }} />
                          </Grid>
                        </Grid>
                        <Grid container spacing={2.5}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, boxShadow: '0 4px 16px rgba(99,102,241,0.09)', border: '1px solid #e0e7ff', transition: 'box-shadow 0.25s ease, transform 0.25s ease', '&:hover': { boxShadow: '0 8px 28px rgba(99,102,241,0.15)', transform: 'translateY(-1px)' }, ...fadeSlideIn }}>
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
                                      sx={{ height: 8, borderRadius: 99, bgcolor: '#ddd6fe', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(sc) } }} />
                                  </Box>
                                );
                              })}
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, boxShadow: '0 4px 16px rgba(99,102,241,0.09)', border: '1px solid #e0e7ff', transition: 'box-shadow 0.25s ease, transform 0.25s ease', '&:hover': { boxShadow: '0 8px 28px rgba(99,102,241,0.15)', transform: 'translateY(-1px)' }, ...fadeSlideIn }}>
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
                                      sx={{ height: 8, borderRadius: 99, bgcolor: '#ddd6fe', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(sc) } }} />
                                  </Box>
                                );
                              })}
                            </Paper>
                          </Grid>
                        </Grid>
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, bgcolor: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 10px rgba(99,102,241,0.08)', border: '1px solid #e0e7ff' }}>
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
                  <Box display="flex" flexDirection="column" gap={3} sx={fadeSlideIn}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Final Performance Summary</Typography>
                      <Typography fontSize={13} color="text.secondary" mt={0.3}>
                        Weighted composite for <strong>{emp?.name || '—'}</strong>
                        {emp && <> · {emp.department} · {emp.designation}</>}
                      </Typography>
                    </Box>
                    <Paper variant="outlined" sx={{
                      borderRadius: 3, p: { xs: 2.5, md: 4 },
                      boxShadow: `0 6px 32px rgba(99,102,241,0.13), 0 0 0 1px ${ratingColor(perfScore.rating)}22`,
                      transition: 'box-shadow 0.3s ease', '&:hover': { boxShadow: `0 12px 48px rgba(99,102,241,0.18), 0 0 0 1px ${ratingColor(perfScore.rating)}44` },
                      display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                      borderColor: ratingColor(perfScore.rating) + '44',
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
                                sx={{ height: 7, borderRadius: 99, bgcolor: '#ddd6fe', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(item.val) } }} />
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
                          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, textAlign: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.10)', border: '1px solid #e0e7ff', transition: 'box-shadow 0.25s ease, transform 0.25s ease', '&:hover': { boxShadow: '0 8px 28px rgba(99,102,241,0.16)', transform: 'translateY(-2px)' }, ...scaleIn }}>
                            <Typography fontSize={11} fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing=".08em" mb={0.5}>{item.label}</Typography>
                            <Chip label={item.weight} size="small" sx={{ bgcolor: item.color + '18', color: item.color, fontWeight: 700, mb: 1.5 }} />
                            <Gauge score={item.score} size={120} />
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, bgcolor: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', boxShadow: '0 2px 10px rgba(99,102,241,0.08)', border: '1px solid #e0e7ff' }}>
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