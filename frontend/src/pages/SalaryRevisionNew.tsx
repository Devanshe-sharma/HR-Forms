import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Slider, Autocomplete, Switch, FormControlLabel,
} from '@mui/material';
import {
  ArrowBack      as ArrowBackIcon,
  CheckCircle    as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  BarChart       as TrendingUpIcon,
  Block          as PauseCircleIcon,
  Add            as AddIcon,
  Close          as CloseIcon,
  History        as HistoryIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────

type RevisionDecision = 'increment' | 'pip' | null;
type RevisionStage    = 'pending_manager' | 'pending_management' | 'pending_hr' | 'completed' | 'on_hold';

interface PmsScore { period: string; score: number; }

interface ManagerDecision {
  decision         : RevisionDecision;
  recommendedPct   : number | null;
  pipDurationMonths: number | null;
  pipNewDueDate    : string | null;
  reason           : string;
  submittedAt      : string | null;
}

interface ManagementDecision {
  finalPct    : number | null;
  pipApproved : boolean | null;
  reason      : string;
  submittedAt : string | null;
}

interface HrDecision {
  newCtc      : number | null;
  applicableDate: string | null;
  notes       : string;
  submittedAt : string | null;
}

interface SalaryRevision {
  _id               : string;
  onboardingId      : string | null;
  employeeCode      : string;
  employeeName      : string;
  department        : string;
  designation       : string;
  email             : string;
  joiningDate       : string;
  category          : string;
  applicableDate    : string | null;
  previousCtc       : number;
  newCtc            : number | null;
  finalIncrementPct : number | null;
  pmsScores         : PmsScore[];
  stage             : RevisionStage;
  managerDecision   : ManagerDecision;
  managementDecision: ManagementDecision;
  hrDecision        : HrDecision;
  reviewDate        : string | null;
  createdAt         : string;
  designationChanged    : boolean;
  previousDesignation   : string;
  newDesignation        : string | null;
  reportingHeadChanged  : boolean;
  previousReportingHead : string;
  newReportingHead      : string | null;
}

interface Employee {
  _id              : string;
  employee_id      : string;
  full_name        : string;
  department       : string;
  designation      : string;
  email            : string;
  official_email   : string;
  joining_date     : string | null;
  employee_category: string;
  annual_ctc       : number;
  reporting_head?  : string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://3.110.162.1:5000/api';
const API      = `${API_BASE}/salary-revisions`;
// Employees now come from Onboarding — the single source of truth — instead
// of a separate Employee collection.
const EMP_API  = `${API_BASE}/onboarding/eligible-employees`;

const ACCENT = '#4f46e5';
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: '1px solid #e2e8f0' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (n: string) => n.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

const fmtDate = (d?: string|null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }); }
  catch { return d; }
};

const fmtCurrency = (n?: number|null) => {
  if (n==null||isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN',{ style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
};

const get11MonthDate = (j: string): Date => {
  const d = new Date(j);
  return new Date(d.getFullYear(), d.getMonth()+11, d.getDate());
};

// The review recurs every year on the same month/day as the first
// anniversary — this gives the correct calendar date for whichever year
// is currently being browsed, not just the one year it first fell due.
const anniversaryDateForYear = (j: string, year: number): Date => {
  const first = get11MonthDate(j);
  return new Date(year, first.getMonth(), first.getDate());
};

const isDueIn = (j: string, m: number, y: number) => {
  const first = get11MonthDate(j);
  if (m !== first.getMonth()) return false;
  // Due every year in that month, starting from the year they first became
  // eligible — not just that one specific year.
  const selDate   = new Date(y, m, 1);
  const firstDate = new Date(first.getFullYear(), first.getMonth(), 1);
  return selDate >= firstDate;
};

const isEligible = (j: string) => {
  const now=new Date(), joined=new Date(j);
  const months=(now.getFullYear()-joined.getFullYear())*12+(now.getMonth()-joined.getMonth());
  return months>=11;
};

const avgPms = (scores?: PmsScore[]): number|null => {
  if (!scores?.length) return null;
  return Math.round(scores.reduce((s,p)=>s+p.score,0)/scores.length*10)/10;
};

const calcSalaryStructure = (annualCtc: number) => {
  const monthly  = Math.round(annualCtc / 12);
  const basic    = Math.round(monthly * 0.40);
  const hra      = Math.round(basic * 0.40);
  const convey   = 1600;
  const medical  = Math.round(monthly * 0.03);
  const special  = monthly - basic - hra - convey - medical;
  const pf       = Math.round(basic * 0.12);
  const gratuity = Math.round(basic * 0.0481);
  const gross    = basic + hra + convey + medical + Math.max(special, 0);
  return { basic, hra, convey, medical, special:Math.max(special,0), pf, gratuity, gross, monthly, annual:annualCtc };
};

// ─── Stage helpers ────────────────────────────────────────────────────────────

const stageLabel = (s: RevisionStage) =>
  s==='completed' ? 'Completed' :
  s==='on_hold'   ? 'On Hold' :
  s==='pending_manager' ? 'Pending Manager' :
  s==='pending_management' ? 'Pending Management' : 'Pending HR';

const stageColor = (s: RevisionStage) =>
  s==='completed' ? '#059669' :
  s==='on_hold'   ? '#d97706' :
  s==='pending_hr'? ACCENT :
                    '#64748b';

// ─── Small chips ──────────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: RevisionStage }) {
  const color = stageColor(stage);
  const done = stage==='completed';
  return (
    <Chip size="small"
      icon={done ? <CheckCircleIcon sx={{ fontSize: 13 }}/> : <HourglassEmptyIcon sx={{ fontSize: 13 }}/>}
      label={stageLabel(stage)}
      sx={{ bgcolor: '#f8fafc', color, fontWeight: 600, fontSize: 11, border: `1px solid ${color}30`,
        '& .MuiChip-icon':{ color:'inherit', ml:'4px' } }}/>
  );
}

function DecisionChip({ decision }: { decision: RevisionDecision }) {
  if (!decision) return <Chip size="small" label="Pending" sx={{ bgcolor:'#f8fafc', color:'#94a3b8', fontSize:11 }}/>;
  const color = decision==='increment' ? '#059669' : '#dc2626';
  return (
    <Chip size="small"
      icon={decision==='increment'?<TrendingUpIcon sx={{ fontSize: 13 }}/>:<PauseCircleIcon sx={{ fontSize: 13 }}/>}
      label={decision==='increment'?'Increment':'PIP'}
      sx={{ bgcolor:'#f8fafc', color, fontWeight:600, fontSize:11, border:`1px solid ${color}30`,
        '& .MuiChip-icon':{ color:'inherit', ml:'4px' } }}/>
  );
}

function Toast({ msg, type, onClose }: { msg:string; type:'success'|'error'; onClose:()=>void }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return ()=>clearTimeout(t); },[onClose]);
  return (
    <Box sx={{ position:'fixed', bottom:24, right:24, zIndex:9999, minWidth:280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius:2 }}>{msg}</Alert>
    </Box>
  );
}

// ─── Month Strip ──────────────────────────────────────────────────────────────

function MonthStrip({ selMonth, selYear, onChange }: {
  selMonth:number; selYear:number; onChange:(m:number,y:number)=>void;
}) {
  const now=new Date();
  const months=[];
  for (let i=-6;i<=5;i++) {
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    months.push({ m:d.getMonth(), y:d.getFullYear() });
  }
  return (
    <Box sx={{ display:'flex', gap:0.75, flexWrap:'wrap' }}>
      {months.map(({ m, y })=>{
        const active=m===selMonth&&y===selYear;
        return (
          <button key={`${y}-${m}`} onClick={()=>onChange(m,y)}
            style={{
              minWidth: 50, fontSize: 11, padding: '5px 8px', lineHeight: 1.3,
              border: `1px solid ${active ? ACCENT : '#e2e8f0'}`, borderRadius: 6,
              background: active ? ACCENT : 'transparent',
              color: active ? '#fff' : '#64748b', cursor: 'pointer',
            }}>
            {MONTHS[m]}<br/><span style={{ fontSize:9 }}>{y}</span>
          </button>
        );
      })}
    </Box>
  );
}

// ─── Add Revision Modal ───────────────────────────────────────────────────────

function AddRevisionModal({ open, onClose, onAdded, showToast, employees }: {
  open:boolean; onClose:()=>void; onAdded:(r:SalaryRevision)=>void;
  showToast:(m:string,t:'success'|'error')=>void; employees:Employee[];
}) {
  const [sel,     setSel]     = useState<Employee|null>(null);
  const [pms,     setPms]     = useState<PmsScore[]>([{ period:'', score:0 }]);
  const [appDate, setAppDate] = useState('');
  const [cat,     setCat]     = useState('Employee');
  const [saving,  setSaving]  = useState(false);

  useEffect(()=>{ if (!open){ setSel(null); setPms([{period:'',score:0}]); setAppDate(''); setCat('Employee'); } },[open]);

  const setRow=(i:number,f:keyof PmsScore,v:string|number)=>
    setPms(r=>r.map((row,idx)=>idx===i?{...row,[f]:v}:row));

  const submit=async()=>{
    if (!sel) return showToast('Select an employee','error');
    if (!sel.joining_date) return showToast('Employee has no joining date','error');
    try {
      setSaving(true);
      const { data }=await axios.post(API,{
        onboardingId:sel._id,
        employeeCode:sel.employee_id, employeeName:sel.full_name,
        department:sel.department, designation:sel.designation,
        email:sel.email, joiningDate:sel.joining_date,
        category:cat, applicableDate:appDate||null,
        previousCtc:sel.annual_ctc||0,
        previousDesignation:sel.designation,
        previousReportingHead:sel.reporting_head||'',
        pmsScores:pms.filter(p=>p.period.trim()),
      });
      if (data.success||data._id||data.data){ showToast('Revision created','success'); onAdded(data.data||data); onClose(); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Request failed','error'); }
    finally { setSaving(false); }
  };

  const due=sel?.joining_date?get11MonthDate(sel.joining_date):null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        width:{ xs:'95vw', md:520 }, maxHeight:'88vh', overflow:'auto',
        bgcolor:'white', borderRadius:2, border: '1px solid #e2e8f0', outline:'none' }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          p:2, borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, bgcolor:'white', zIndex:1 }}>
          <Typography fontSize={14} fontWeight={700}>Add Salary Revision</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small"/></IconButton>
        </Box>
        <Box sx={{ p:2.5 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography fontSize={11} fontWeight={600} color="text.secondary" mb={0.75}>SELECT EMPLOYEE</Typography>
              <Autocomplete options={employees} getOptionLabel={e=>`${e.full_name} (${e.department})`}
                value={sel} onChange={(_,v)=>{ setSel(v); if(v?.employee_category) setCat(v.employee_category); }}
                renderInput={p=><TextField {...p} size="small" placeholder="Search name or department…"/>}
                renderOption={(props,e)=>(
                  <li {...props} key={e._id}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, py:0.5 }}>
                      <Avatar sx={{ width:26, height:26, bgcolor:ACCENT, fontSize:10, fontWeight:700 }}>{initials(e.full_name)}</Avatar>
                      <Box>
                        <Typography fontSize={13} fontWeight={600}>{e.full_name}</Typography>
                        <Typography fontSize={11} color="text.secondary">{e.designation} · {e.department}</Typography>
                      </Box>
                    </Box>
                  </li>
                )}/>
            </Box>
            {sel && (
              <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                <Typography fontSize={10} fontWeight={700} color="text.secondary" mb={1}>AUTO-FETCHED</Typography>
                <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.2 }}>
                  {[['Designation',sel.designation||'—'],['Email',sel.email||'—'],
                    ['Joining Date',fmtDate(sel.joining_date)],['Previous CTC',fmtCurrency(sel.annual_ctc)],
                    ['Due Date (11m)',fmtDate(due?.toISOString())]
                  ].map(([l,v])=>(
                    <Box key={l}><Typography fontSize={10} color="text.secondary">{l}</Typography>
                      <Typography fontSize={12} fontWeight={600}>{v}</Typography></Box>
                  ))}
                </Box>
              </Box>
            )}
            <Box sx={{ display:'flex', gap:2, flexWrap:'wrap' }}>
              <TextField label="Applicable Date" type="date" size="small" value={appDate}
                onChange={e=>setAppDate(e.target.value)} InputLabelProps={{ shrink:true }}
                sx={{ minWidth:180 }}/>
              <FormControl size="small" sx={{ minWidth:150 }}>
                <InputLabel>Category</InputLabel>
                <Select value={cat} label="Category" onChange={e=>setCat(e.target.value)}>
                  {['Employee','Consultant','Intern','Temporary Staff','Contract Based'].map(c=>(
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                <Typography fontSize={11} fontWeight={600} color="text.secondary">PMS SCORES</Typography>
                <Button size="small" startIcon={<AddIcon/>} onClick={()=>setPms(r=>[...r,{period:'',score:0}])}
                  sx={{ fontSize:11, textTransform:'none', color:ACCENT }}>Add Period</Button>
              </Box>
              <Stack spacing={1}>
                {pms.map((row,i)=>(
                  <Box key={i} sx={{ display:'flex', gap:1.5, alignItems:'flex-start' }}>
                    <TextField size="small" label="Period" placeholder="e.g. Q1 2024"
                      value={row.period} onChange={e=>setRow(i,'period',e.target.value)} sx={{ flex:2 }}/>
                    <TextField size="small" label="Score" type="number" value={row.score}
                      onChange={e=>setRow(i,'score',Number(e.target.value))}
                      inputProps={{ min:0, max:10, step:0.1 }} sx={{ flex:1 }}/>
                    {pms.length>1&&<IconButton size="small" onClick={()=>setPms(r=>r.filter((_,idx)=>idx!==i))}
                      sx={{ mt:0.5, color:'#dc2626' }}><CloseIcon fontSize="small"/></IconButton>}
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box sx={{ display:'flex', gap:2 }}>
              <Button variant="contained" onClick={submit} disabled={saving||!sel}
                sx={{ flex:1, bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none', fontWeight:600 }}>
                {saving?<CircularProgress size={20} sx={{ color:'white' }}/>:'Create Revision'}
              </Button>
              <Button variant="outlined" onClick={onClose} sx={{ textTransform:'none' }}>Cancel</Button>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, employees, loading, onSelect, onAdd }: {
  records:SalaryRevision[]; employees:Employee[]; loading:boolean;
  onSelect:(emp:Employee,rec?:SalaryRevision)=>void; onAdd:()=>void;
}) {
  const now=new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [showAll,  setShowAll]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [dept,     setDept]     = useState('All');
  const [stage,    setStage]    = useState('All');

  // records is already sorted newest-first — keep only the FIRST (newest)
  // revision seen per employee so the dashboard shows current state, while
  // older ones remain reachable via each employee's History tab.
  const revisionMap = useMemo(()=>{
    const m=new Map<string,SalaryRevision>();
    records.forEach(r=>{ if (!m.has(r.employeeCode)) m.set(r.employeeCode, r); });
    return m;
  },[records]);

  const eligibleEmps = useMemo(()=>employees.filter(e=>e.joining_date&&isEligible(e.joining_date)),[employees]);

  const allEmps = eligibleEmps;
  const depts=['All',...Array.from(new Set(allEmps.map(e=>e.department).filter(Boolean)))];

  const filtered=useMemo(()=>allEmps.filter(e=>{
    if (!e.joining_date) return false;
    const rec=revisionMap.get(e.employee_id);
    const monthOk=showAll||isDueIn(e.joining_date,selMonth,selYear);
    const searchOk=!search||e.full_name.toLowerCase().includes(search.toLowerCase());
    const deptOk=dept==='All'||e.department===dept;
    const stageOk=stage==='All'?true:stage==='no_record'?!rec:rec?.stage===stage;
    return monthOk&&searchOk&&deptOk&&stageOk;
  }),[allEmps,showAll,selMonth,selYear,search,dept,stage,revisionMap]);

  const stats={
    due:filtered.length,
    noRec:filtered.filter(e=>!revisionMap.get(e.employee_id)).length,
    pending:filtered.filter(e=>{ const r=revisionMap.get(e.employee_id); return r&&r.stage!=='completed'; }).length,
    completed:filtered.filter(e=>revisionMap.get(e.employee_id)?.stage==='completed').length,
  };

  return (
    <Box sx={{ p:2.5, maxWidth:1300, mx:'auto' }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2, flexWrap:'wrap', gap:1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Salary Revision</Typography>
          <Typography fontSize={12} color="text.secondary">
            {showAll?'All eligible employees':`Due in ${MONTHS[selMonth]} ${selYear}`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon/>} onClick={onAdd} size="small"
          sx={{ bgcolor:ACCENT, textTransform:'none', fontWeight:600, borderRadius: 1.5, '&:hover':{ bgcolor:'#4338ca' } }}>
          Add Revision
        </Button>
      </Box>

      {/* Stats — plain, no heavy colored boxes */}
      <Box sx={{ display:'flex', gap:3, mb:2.5, flexWrap:'wrap', pb: 2, borderBottom: '1px solid #e2e8f0' }}>
        {[
          { label: showAll?'All Eligible':'Due', value: stats.due, color: '#0f172a' },
          { label: 'No Record', value: stats.noRec, color: '#dc2626' },
          { label: 'Pending', value: stats.pending, color: '#d97706' },
          { label: 'Completed', value: stats.completed, color: '#059669' },
        ].map(s=>(
          <Box key={s.label}>
            <Typography fontSize={20} fontWeight={700} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography fontSize={11} color="text.secondary" mt={0.3}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {!showAll&&(
        <Box sx={{ mb:2 }}>
          <Typography fontSize={10} fontWeight={600} color="text.secondary" mb={1}>SELECT MONTH</Typography>
          <MonthStrip selMonth={selMonth} selYear={selYear} onChange={(m,y)=>{ setSelMonth(m); setSelYear(y); }}/>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display:'flex', gap:1, mb:2, flexWrap:'wrap', alignItems:'center' }}>
        <TextField size="small" placeholder="Search name…" value={search}
          onChange={e=>setSearch(e.target.value)} sx={{ minWidth:180 }}
          InputProps={{ sx:{ fontSize:13 } }}/>
        <FormControl size="small" sx={{ minWidth:130 }}>
          <InputLabel sx={{ fontSize:12 }}>Department</InputLabel>
          <Select value={dept} label="Department" onChange={e=>setDept(e.target.value)} sx={{ fontSize:12 }}>
            {depts.map(d=><MenuItem key={d} value={d} sx={{ fontSize:12 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth:155 }}>
          <InputLabel sx={{ fontSize:12 }}>Stage</InputLabel>
          <Select value={stage} label="Stage" onChange={e=>setStage(e.target.value)} sx={{ fontSize:12 }}>
            {[['All','All'],['no_record','No Record'],['pending_manager','Pending Manager'],
              ['pending_management','Pending Mgmt'],['pending_hr','Pending HR'],
              ['completed','Completed'],['on_hold','On Hold']
            ].map(([v,l])=><MenuItem key={v} value={v} sx={{ fontSize:12 }}>{l}</MenuItem>)}
          </Select>
        </FormControl>
        <Button size="small" onClick={()=>setShowAll(!showAll)}
          sx={{ fontSize:12, textTransform:'none', color: ACCENT }}>
          {showAll?'By Month':'Show All'}
        </Button>
      </Box>

      {/* Table */}
      <Box sx={{ bgcolor:'white', borderRadius:2, border:'1px solid #e2e8f0', overflow:'hidden' }}>
        {loading?<Box display="flex" justifyContent="center" py={6}><CircularProgress size={28}/></Box>:(
          <TableContainer sx={{ maxHeight:460, overflow:'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th':TH }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Designation</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Prev. CTC</TableCell>
                  <TableCell>Decision</TableCell>
                  <TableCell>New CTC</TableCell>
                  <TableCell>Stage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length===0&&(
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py:6, color:'text.secondary', fontSize:13 }}>
                    {showAll?'No eligible employees found':`No employees due in ${MONTHS[selMonth]} ${selYear}`}
                  </TableCell></TableRow>
                )}
                {filtered.map(emp=>{
                  const rec=revisionMap.get(emp.employee_id);
                  const dueDate=showAll
                    ? anniversaryDateForYear(emp.joining_date!, now.getFullYear())
                    : anniversaryDateForYear(emp.joining_date!, selYear);
                  const isThisMonth=isDueIn(emp.joining_date!,now.getMonth(),now.getFullYear());
                  return (
                    <TableRow key={emp._id} onClick={()=>onSelect(emp,rec)}
                      sx={{ cursor:'pointer', '&:hover':{ bgcolor:'#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                      <TableCell>
                        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                          <Avatar sx={{ width:26, height:26, bgcolor:ACCENT, fontSize:10, fontWeight:700 }}>{initials(emp.full_name)}</Avatar>
                          <Typography fontSize={12} fontWeight={600}>{emp.full_name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize:12 }}>{emp.department||'—'}</TableCell>
                      <TableCell sx={{ fontSize:12 }}>
                        {emp.designation||'—'}
                        {rec?.designationChanged && <Chip label="changed" size="small" sx={{ ml: 0.7, fontSize: 9, height: 16, bgcolor: '#eef2ff', color: ACCENT }}/>}
                      </TableCell>
                      <TableCell>
                        <Typography component="span" fontSize={12} fontWeight={isThisMonth?700:400} color={isThisMonth?'#d97706':'inherit'}>
                          {fmtDate(dueDate.toISOString())}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize:12 }}>{fmtCurrency(emp.annual_ctc)}</TableCell>
                      <TableCell>
                        {rec?<DecisionChip decision={rec.managerDecision?.decision}/>
                          :<Chip label="No Record" size="small" sx={{ bgcolor:'#fef2f2', color:'#dc2626', fontSize:10 }}/>}
                      </TableCell>
                      <TableCell sx={{ fontSize:12, fontWeight:600, color:'#059669' }}>{rec?fmtCurrency(rec.newCtc):'—'}</TableCell>
                      <TableCell>
                        {rec?<StageChip stage={rec.stage}/>
                          :<Chip label="Pending" size="small" sx={{ bgcolor:'#fffbeb', color:'#d97706', fontSize:10 }}/>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────
// Every past revision for this employee, newest first. The Onboarding
// dashboard only ever shows the latest finalised values — this is where
// older revisions stay visible.

function HistoryPanel({ employeeCode }: { employeeCode: string }) {
  const [history, setHistory] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/history/${employeeCode}`)
      .then(r => setHistory(r.data?.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [employeeCode]);

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24}/></Box>;
  if (!history.length) return <Typography fontSize={12} color="text.secondary">No past revisions for this employee.</Typography>;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': TH }}>
              <TableCell>Date</TableCell>
              <TableCell>Decision</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Reporting Head</TableCell>
              <TableCell>CTC</TableCell>
              <TableCell>Stage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((h, i) => (
              <TableRow key={h._id} sx={{ bgcolor: i === 0 ? '#f8fafc' : 'transparent' }}>
                <TableCell sx={{ fontSize: 12 }}>
                  {fmtDate(h.createdAt)}
                  {i === 0 && <Chip label="Latest" size="small" sx={{ ml: 0.7, fontSize: 9, height: 16, bgcolor: '#eef2ff', color: ACCENT }}/>}
                </TableCell>
                <TableCell><DecisionChip decision={h.managerDecision?.decision}/></TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {h.designationChanged
                    ? <>{h.previousDesignation} → <strong>{h.newDesignation}</strong></>
                    : <span style={{ color: '#94a3b8' }}>No change</span>}
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {h.reportingHeadChanged
                    ? <>{h.previousReportingHead || '—'} → <strong>{h.newReportingHead}</strong></>
                    : <span style={{ color: '#94a3b8' }}>No change</span>}
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {fmtCurrency(h.previousCtc)} → <strong style={{ color: '#059669' }}>{fmtCurrency(h.newCtc)}</strong>
                </TableCell>
                <TableCell><StageChip stage={h.stage}/></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// ─── Revision Detail / Action View ───────────────────────────────────────────

function RevisionDetailView({ emp, rec, onBack, onRecordChange, showToast }: {
  emp          : Employee;
  rec          : SalaryRevision | undefined;
  onBack       : () => void;
  onRecordChange:(r: SalaryRevision) => void;
  showToast    : (m:string,t:'success'|'error')=>void;
}) {
  const [tab, setTab] = useState(0);

  const [applicableDate, setApplicableDate] = useState(rec?.applicableDate
    ? new Date(rec.applicableDate).toISOString().split('T')[0] : '');
  const [category, setCategory] = useState(rec?.category||emp.employee_category||'Employee');
  const [pmsRows,  setPmsRows]  = useState<PmsScore[]>(
    rec?.pmsScores?.length ? rec.pmsScores : [{ period:'', score:0 }]
  );

  const [mgrDecision,   setMgrDecision]   = useState<'increment'|'pip'>(rec?.managerDecision?.decision||'increment');
  const [mgrPct,        setMgrPct]        = useState(rec?.managerDecision?.recommendedPct??10);
  const [mgrReason,     setMgrReason]     = useState(rec?.managerDecision?.reason||'');
  const [pipMonths,     setPipMonths]     = useState(rec?.managerDecision?.pipDurationMonths??3);
  const [pipDueDate,    setPipDueDate]    = useState(
    rec?.managerDecision?.pipNewDueDate
      ? new Date(rec.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '');

  // Designation change — independent of salary decision
  const [changeDesignation, setChangeDesignation] = useState(rec?.designationChanged ?? false);
  const [newDesignation,    setNewDesignation]    = useState(rec?.newDesignation || '');

  // Reporting head change — independent of salary decision
  const [changeHead, setChangeHead] = useState(rec?.reportingHeadChanged ?? false);
  const [newHead,    setNewHead]    = useState(rec?.newReportingHead || '');

  const [mgmtPct,       setMgmtPct]       = useState(rec?.managementDecision?.finalPct??mgrPct);
  const [mgmtReason,    setMgmtReason]    = useState(rec?.managementDecision?.reason||'');
  const [pipApproved,   setPipApproved]   = useState(rec?.managementDecision?.pipApproved??true);

  const [hrNotes,       setHrNotes]       = useState(rec?.hrDecision?.notes||'');
  const [hrAppDate,     setHrAppDate]     = useState(
    rec?.hrDecision?.applicableDate
      ? new Date(rec.hrDecision.applicableDate).toISOString().split('T')[0]
      : applicableDate);

  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    if (mgrDecision==='pip') {
      const d=new Date(); d.setMonth(d.getMonth()+pipMonths);
      setPipDueDate(d.toISOString().split('T')[0]);
    }
  },[pipMonths,mgrDecision]);

  const stage       = rec?.stage || 'pending_manager';
  const isMgr       = stage==='pending_manager';
  const isMgmt      = stage==='pending_management';
  const isHr        = stage==='pending_hr';
  const isCompleted = stage==='completed';
  const isOnHold    = stage==='on_hold';

  const prevCtc     = emp.annual_ctc || rec?.previousCtc || 0;
  const newCtc      = mgrDecision==='increment'
    ? Math.round(prevCtc*(1+(isHr||isCompleted?(rec?.managementDecision?.finalPct??mgmtPct):isMgmt?mgmtPct:mgrPct)/100))
    : prevCtc;
  const salStruct   = calcSalaryStructure(newCtc);
  const avg         = avgPms(pmsRows.filter(r=>r.period.trim()));

  const postManager = async () => {
    if (!mgrReason.trim()) return showToast('Provide a reason', 'error');
    setBusy(true);
    try {
      let revisionId = rec?._id;
      if (!revisionId) {
        const createRes = await axios.post(API, {
          onboardingId  : emp._id,
          employeeCode  : emp.employee_id,
          employeeName  : emp.full_name,
          department    : emp.department,
          designation   : emp.designation,
          email         : emp.official_email,
          joiningDate   : emp.joining_date,
          category,
          applicableDate: applicableDate || null,
          previousCtc   : emp.annual_ctc || 0,
          previousDesignation: emp.designation,
          previousReportingHead: (emp as any).reporting_head || '',
          pmsScores     : pmsRows.filter(r => r.period.trim()),
        });
        const created = createRes.data?.data || createRes.data;
        if (!created?._id) { showToast('Failed to initialise revision record', 'error'); return; }
        revisionId = created._id;
        onRecordChange(created);
      }

      const payload: any = {
        reason        : mgrReason,
        applicableDate: applicableDate || null,
        category,
        decision      : mgrDecision,
        pmsScores     : pmsRows.filter(r => r.period.trim()),
        newDesignation: changeDesignation ? newDesignation : null,
        newReportingHead: changeHead ? newHead : null,
      };
      if (mgrDecision === 'increment') payload.recommendedPct = mgrPct;
      else { payload.pipDurationMonths = pipMonths; payload.pipNewDueDate = pipDueDate || null; }

      const { data } = await axios.put(`${API}/${revisionId}/manager`, payload);
      if (data.success) { showToast('Manager decision saved', 'success'); onRecordChange(data.data); }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const postManagement=async()=>{
    if (!mgmtReason.trim()) return showToast('Provide a reason','error');
    if (!rec) return;
    setBusy(true);
    try {
      const payload: any={ reason:mgmtReason };
      if (rec.managerDecision?.decision==='increment') payload.finalPct=mgmtPct;
      else payload.pipApproved=pipApproved;
      const { data }=await axios.put(`${API}/${rec._id}/management`,payload);
      if (data.success){ showToast('Management decision saved','success'); onRecordChange(data.data); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Failed','error'); }
    finally { setBusy(false); }
  };

  const postHr=async()=>{
    if (!rec) return;
    setBusy(true);
    try {
      const payload={ notes:hrNotes, applicableDate:hrAppDate||null, newCtc };
      const { data }=await axios.put(`${API}/${rec._id}/hr`,payload);
      if (data.success){ showToast('HR decision saved — revision completed, Onboarding updated','success'); onRecordChange(data.data); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Failed','error'); }
    finally { setBusy(false); }
  };

  const FlowBanner=()=>{
    if (isCompleted) return <Alert severity="success" sx={{ mb:2, fontSize:12 }}>Revision completed. Final CTC: {fmtCurrency(rec?.newCtc)}. Onboarding record updated.</Alert>;
    if (isOnHold)    return <Alert severity="warning" sx={{ mb:2, fontSize:12 }}>On hold (PIP). Review opens on {fmtDate(rec?.reviewDate)}.</Alert>;
    if (isMgr)       return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>Step 1 of 3 — awaiting Manager decision.</Alert>;
    if (isMgmt)      return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>Step 2 of 3 — awaiting Management decision.</Alert>;
    if (isHr)        return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>Step 3 of 3 — awaiting HR to finalise.</Alert>;
    return null;
  };

  return (
    <Box sx={{ p:2.5, maxWidth:1300, mx:'auto' }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:2, flexWrap:'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor:'#f8fafc', borderRadius:1.5 }}>
          <ArrowBackIcon fontSize="small"/>
        </IconButton>
        <Avatar sx={{ width:38, height:38, bgcolor:ACCENT, fontWeight:700, fontSize:14 }}>{initials(emp.full_name)}</Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="0.95rem">{emp.full_name}</Typography>
          <Typography fontSize={12} color="text.secondary">{emp.designation} · {emp.department}</Typography>
        </Box>
        {rec&&<DecisionChip decision={rec.managerDecision?.decision}/>}
        {rec&&<StageChip stage={rec.stage}/>}
        {!rec&&<Chip label="No revision record" size="small" sx={{ bgcolor:'#fef2f2', color:'#dc2626' }}/>}
      </Box>

      <FlowBanner/>

      <Box sx={{ display:'flex', mb:2.5, bgcolor:'white', borderRadius:1.5, border:'1px solid #e2e8f0', overflow:'hidden' }}>
        {[
          { label:'1. Manager', stage:'pending_manager', done:!isMgr },
          { label:'2. Management', stage:'pending_management', done:isHr||isCompleted },
          { label:'3. HR Final', stage:'pending_hr', done:isCompleted },
        ].map((step,i)=>{
          const isActive = stage===step.stage;
          const isDone   = step.done&&!isActive;
          return (
            <Box key={i} sx={{ flex:1, p:1.25, textAlign:'center',
              bgcolor:isActive?ACCENT:isDone?'#f0fdf4':'#f8fafc',
              borderRight:i<2?'1px solid #e2e8f0':'none' }}>
              <Typography fontSize={12} fontWeight={600}
                color={isActive?'white':isDone?'#059669':'#94a3b8'}>
                {isDone?'✓ ':''}{step.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ borderBottom:'1px solid #e2e8f0', mb:2 }}>
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{
          '& .MuiTab-root':{ fontSize:12, textTransform:'none', minHeight:36, py:0 },
          '& .MuiTabs-indicator':{ bgcolor:ACCENT },
          '& .Mui-selected':{ color:`${ACCENT} !important`, fontWeight:700 },
        }}>
          <Tab label="Employee Details" value={0}/>
          <Tab label="Decision" value={1}/>
          <Tab label="Salary Structure" value={2} disabled={mgrDecision!=='increment'}/>
          <Tab label="History" value={3} icon={<HistoryIcon sx={{ fontSize:14 }}/>} iconPosition="end"/>
        </Tabs>
      </Box>

      {/* ── TAB 0: Employee Details ────────────────────────────────────────── */}
      {tab===0&&(
        <Box sx={{ display:'flex', gap:2.5, flexWrap:'wrap' }}>
          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Auto-Fetched Info</Typography>
            <Stack spacing={1.2}>
              {[
                ['Employee Code', emp.employee_id],
                ['Full Name',     emp.full_name],
                ['Email',         emp.email||rec?.email||'—'],
                ['Department',    emp.department||rec?.department||'—'],
                ['Current Designation',   emp.designation||rec?.designation||'—'],
                ['Reporting Head', (emp as any).reporting_head || '—'],
                ['Joining Date',  fmtDate(emp.joining_date||rec?.joiningDate)],
                ['Previous CTC',  fmtCurrency(prevCtc)],
              ].map(([l,v])=>(
                <Box key={l} sx={{ display:'flex', justifyContent:'space-between', gap:2 }}>
                  <Typography fontSize={12} color="text.secondary">{l}</Typography>
                  <Typography fontSize={12} fontWeight={500} textAlign="right">{v}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* Designation & Reporting Head changes — independent of salary */}
          <Paper variant="outlined" sx={{ flex:'1 1 280px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Designation & Reporting Head</Typography>
            <Stack spacing={2}>
              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={changeDesignation}
                    onChange={e=>setChangeDesignation(e.target.checked)} disabled={!isMgr}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}/>}
                  label={<Typography fontSize={12} fontWeight={600}>Change Designation</Typography>}/>
                {changeDesignation && (
                  <TextField size="small" fullWidth placeholder={`Current: ${emp.designation}`}
                    value={newDesignation} onChange={e=>setNewDesignation(e.target.value)}
                    disabled={!isMgr} sx={{ mt: 1 }}/>
                )}
                {!isMgr && rec?.designationChanged && (
                  <Typography fontSize={12} color={ACCENT} mt={0.5}>
                    {rec.previousDesignation} → <strong>{rec.newDesignation}</strong>
                  </Typography>
                )}
              </Box>

              <Divider/>

              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={changeHead}
                    onChange={e=>setChangeHead(e.target.checked)} disabled={!isMgr}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}/>}
                  label={<Typography fontSize={12} fontWeight={600}>Change Reporting Head</Typography>}/>
                {changeHead && (
                  <TextField size="small" fullWidth placeholder={`Current: ${(emp as any).reporting_head || 'None set'}`}
                    value={newHead} onChange={e=>setNewHead(e.target.value)}
                    disabled={!isMgr} sx={{ mt: 1 }}/>
                )}
                {!isMgr && rec?.reportingHeadChanged && (
                  <Typography fontSize={12} color={ACCENT} mt={0.5}>
                    {rec.previousReportingHead || '—'} → <strong>{rec.newReportingHead}</strong>
                  </Typography>
                )}
              </Box>

              <Divider/>

              <Box>
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                  <Typography fontSize={12} fontWeight={700} color="text.secondary">PMS SCORES</Typography>
                  {isMgr&&<Button size="small" startIcon={<AddIcon/>}
                    onClick={()=>setPmsRows(r=>[...r,{period:'',score:0}])}
                    sx={{ fontSize:11, textTransform:'none', color:ACCENT }}>Add</Button>}
                </Box>
                <Stack spacing={1}>
                  {pmsRows.map((row,i)=>(
                    <Box key={i} sx={{ display:'flex', gap:1, alignItems:'center' }}>
                      <TextField size="small" label="Period" value={row.period}
                        onChange={e=>setPmsRows(r=>r.map((x,idx)=>idx===i?{...x,period:e.target.value}:x))}
                        disabled={!isMgr} sx={{ flex:2 }}/>
                      <TextField size="small" label="Score" type="number" value={row.score}
                        onChange={e=>setPmsRows(r=>r.map((x,idx)=>idx===i?{...x,score:Number(e.target.value)}:x))}
                        inputProps={{ min:0, max:10, step:0.1 }} disabled={!isMgr} sx={{ flex:1 }}/>
                      {isMgr&&pmsRows.length>1&&(
                        <IconButton size="small" onClick={()=>setPmsRows(r=>r.filter((_,idx)=>idx!==i))}
                          sx={{ color:'#dc2626' }}><CloseIcon fontSize="small"/></IconButton>
                      )}
                    </Box>
                  ))}
                </Stack>
                {avg!=null&&(
                  <Typography fontSize={12} color="text.secondary" mt={1}>Avg PMS: <strong>{avg}</strong></Typography>
                )}
              </Box>

              <TextField label="Applicable Date" type="date" size="small"
                value={applicableDate} onChange={e=>setApplicableDate(e.target.value)}
                InputLabelProps={{ shrink:true }} disabled={!isMgr} fullWidth/>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={e=>setCategory(e.target.value)} disabled={!isMgr}>
                  {['Employee','Consultant','Intern','Temporary Staff','Contract Based'].map(c=>(
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Box>
      )}

      {/* ── TAB 1: Decision ───────────────────────────────────────────────── */}
      {tab===1&&(
        <Box sx={{ display:'flex', gap:2.5, flexWrap:'wrap' }}>

          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5,
            outline:isMgr?`2px solid ${ACCENT}`:'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:22, height:22, borderRadius:'50%', bgcolor:isMgr?ACCENT:!isMgr?'#059669':'#e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{!isMgr?'✓':'1'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>Manager Decision</Typography>
            </Box>

            <Stack spacing={2}>
              <Box>
                <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>DECISION</Typography>
                <Box sx={{ display:'flex', gap:1.5 }}>
                  {(['increment','pip'] as const).map(opt=>(
                    <Button key={opt} variant={mgrDecision===opt?'contained':'outlined'}
                      startIcon={opt==='increment'?<TrendingUpIcon/>:<PauseCircleIcon/>}
                      onClick={()=>isMgr&&setMgrDecision(opt)}
                      disabled={!isMgr}
                      sx={{ textTransform:'none', fontWeight:600, fontSize:12,
                        bgcolor:mgrDecision===opt?(opt==='increment'?'#059669':'#dc2626'):'transparent',
                        borderColor:opt==='increment'?'#059669':'#dc2626',
                        color:mgrDecision===opt?'white':(opt==='increment'?'#059669':'#dc2626') }}>
                      {opt==='increment'?'Increment':'PIP'}
                    </Button>
                  ))}
                </Box>
              </Box>

              {mgrDecision==='increment'&&(
                <Box>
                  <Typography fontSize={12} fontWeight={600} mb={1}>
                    Manager Recommendation: <strong style={{ color:'#059669' }}>{isMgr?mgrPct:(rec?.managerDecision?.recommendedPct??mgrPct)}%</strong>
                  </Typography>
                  {isMgr?(
                    <Slider value={mgrPct} onChange={(_,v)=>setMgrPct(v as number)}
                      min={0} max={50} step={0.5} valueLabelDisplay="auto"
                      valueLabelFormat={v=>`${v}%`} sx={{ color:'#059669', maxWidth:340 }}/>
                  ):(
                    <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                      <Typography fontSize={12} color="#059669" fontWeight={600}>
                        {rec?.managerDecision?.recommendedPct??mgrPct}% increment recommended
                      </Typography>
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>{rec?.managerDecision?.reason}</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {mgrDecision==='pip'&&(
                <Box sx={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                  <TextField label="Duration (months)" type="number" size="small"
                    value={pipMonths} onChange={e=>setPipMonths(Math.max(1,Math.min(12,Number(e.target.value)||1)))}
                    inputProps={{ min:1, max:12 }} disabled={!isMgr} sx={{ width:160 }}/>
                  <TextField label="New Due Date" type="date" size="small"
                    value={pipDueDate} onChange={e=>setPipDueDate(e.target.value)}
                    InputLabelProps={{ shrink:true }} disabled={!isMgr} sx={{ width:180 }}/>
                </Box>
              )}

              <TextField label="Reason / Comments *" multiline rows={3} size="small"
                value={mgrReason} onChange={e=>setMgrReason(e.target.value)}
                placeholder="Manager's reasoning…" disabled={!isMgr} fullWidth/>

              {isMgr&&(
                <Button variant="contained" onClick={postManager} disabled={busy||!mgrReason.trim()}
                  sx={{ bgcolor:'#059669', '&:hover':{ bgcolor:'#047857' }, textTransform:'none', fontWeight:600 }}>
                  {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit Manager Decision'}
                </Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5,
            opacity:isMgr?0.5:1, outline:isMgmt?`2px solid ${ACCENT}`:'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:22, height:22, borderRadius:'50%',
                bgcolor:isMgmt?ACCENT:(isHr||isCompleted)?'#059669':'#e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{(isHr||isCompleted)?'✓':'2'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>Management Decision</Typography>
            </Box>

            {isMgr&&<Alert severity="warning" sx={{ fontSize:11, mb:2 }}>Waiting for manager to submit first.</Alert>}

            {!isMgr&&(
              <Stack spacing={2}>
                {rec?.managerDecision?.decision==='increment'?(
                  <Box>
                    <Typography fontSize={12} fontWeight={600} mb={1}>
                      Management Final: <strong style={{ color:ACCENT }}>{isMgmt?mgmtPct:(rec?.managementDecision?.finalPct??mgmtPct)}%</strong>
                      {rec?.managerDecision?.recommendedPct!=null&&(
                        <span style={{ fontSize:11, color:'#94a3b8', marginLeft:8 }}>(Mgr: {rec.managerDecision.recommendedPct}%)</span>
                      )}
                    </Typography>
                    {isMgmt?(
                      <Slider value={mgmtPct} onChange={(_,v)=>setMgmtPct(v as number)}
                        min={0} max={50} step={0.5} valueLabelDisplay="auto"
                        valueLabelFormat={v=>`${v}%`} sx={{ color:ACCENT, maxWidth:340 }}/>
                    ):(
                      <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                        <Typography fontSize={12} color={ACCENT} fontWeight={600}>
                          {rec?.managementDecision?.finalPct??mgmtPct}% — final management decision
                        </Typography>
                      </Box>
                    )}
                    {mgrDecision==='increment'&&(
                      <Box sx={{ mt:1.5, p:1.5, bgcolor:'#f0fdf4', borderRadius:1.5, border:'1px solid #bbf7d0' }}>
                        <Box sx={{ display:'flex', gap:2, alignItems:'center', flexWrap:'wrap' }}>
                          <Typography fontSize={12}>{fmtCurrency(prevCtc)}</Typography>
                          <Typography fontSize={11} color="text.secondary">→</Typography>
                          <Typography fontSize={14} fontWeight={700} color="#059669">{fmtCurrency(newCtc)}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                ):(
                  <Box>
                    <Typography fontSize={12} fontWeight={600} mb={1}>Approve PIP?</Typography>
                    <Box sx={{ display:'flex', gap:1.5 }}>
                      <Button variant={pipApproved?'contained':'outlined'} size="small"
                        onClick={()=>isMgmt&&setPipApproved(true)} disabled={!isMgmt}
                        sx={{ textTransform:'none', bgcolor:pipApproved?'#dc2626':'transparent',
                          color:pipApproved?'white':'#dc2626', borderColor:'#dc2626' }}>Approve PIP</Button>
                      <Button variant={!pipApproved?'contained':'outlined'} size="small"
                        onClick={()=>isMgmt&&setPipApproved(false)} disabled={!isMgmt}
                        sx={{ textTransform:'none', bgcolor:!pipApproved?'#059669':'transparent',
                          color:!pipApproved?'white':'#059669', borderColor:'#059669' }}>Re-evaluate</Button>
                    </Box>
                  </Box>
                )}

                <TextField label="Reason / Comments *" multiline rows={3} size="small"
                  value={mgmtReason} onChange={e=>setMgmtReason(e.target.value)}
                  disabled={!isMgmt} fullWidth/>

                {isMgmt&&(
                  <Button variant="contained" onClick={postManagement} disabled={busy||!mgmtReason.trim()}
                    sx={{ bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none', fontWeight:600 }}>
                    {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit Management Decision'}
                  </Button>
                )}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5,
            opacity:(isMgr||isMgmt)?0.5:1, outline:isHr?`2px solid ${ACCENT}`:'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:22, height:22, borderRadius:'50%',
                bgcolor:isHr?ACCENT:isCompleted?'#059669':'#e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{isCompleted?'✓':'3'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>HR Final Action</Typography>
            </Box>

            {(isMgr||isMgmt)&&<Alert severity="warning" sx={{ fontSize:11, mb:2 }}>Waiting for manager & management first.</Alert>}

            {(isHr||isCompleted)&&(
              <Stack spacing={2}>
                <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                  <Typography fontSize={11} color="text.secondary">Management approved</Typography>
                  {rec?.managerDecision?.decision==='increment'?(
                    <Typography fontSize={13} fontWeight={700} color={ACCENT}>
                      {rec?.managementDecision?.finalPct}% increment → {fmtCurrency(newCtc)}
                    </Typography>
                  ):(
                    <Typography fontSize={13} fontWeight={700} color="#dc2626">PIP approved</Typography>
                  )}
                </Box>

                <TextField label="Applicable Date" type="date" size="small"
                  value={hrAppDate} onChange={e=>setHrAppDate(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                <TextField label="HR Notes" multiline rows={3} size="small"
                  value={hrNotes} onChange={e=>setHrNotes(e.target.value)}
                  disabled={!isHr} fullWidth/>

                {isHr&&(
                  <Button variant="contained" onClick={postHr} disabled={busy}
                    sx={{ bgcolor:'#2563eb', '&:hover':{ bgcolor:'#1d4ed8' }, textTransform:'none', fontWeight:600 }}>
                    {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Finalise & Complete Revision'}
                  </Button>
                )}

                {isCompleted&&(
                  <Box sx={{ p:1.5, bgcolor:'#f0fdf4', borderRadius:1.5, border:'1px solid #bbf7d0' }}>
                    <Typography fontSize={12} fontWeight={700} color="#059669">Revision Completed</Typography>
                    <Typography fontSize={11} color="text.secondary" mt={0.5}>
                      Applicable from {fmtDate(rec?.hrDecision?.applicableDate||rec?.applicableDate)}. Onboarding record updated with latest values.
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

      {/* ── TAB 2: Salary Structure ───────────────────────────────────────── */}
      {tab===2&&mgrDecision==='increment'&&(
        <Box>
          <Box sx={{ display:'flex', gap:2, mb:3, flexWrap:'wrap' }}>
            {[
              ['Previous CTC', fmtCurrency(prevCtc), '#64748b'],
              ['Increment %',  `+${isMgmt||isHr||isCompleted?(rec?.managementDecision?.finalPct??mgmtPct):mgrPct}%`, '#d97706'],
              ['New Annual CTC', fmtCurrency(newCtc), '#059669'],
              ['Monthly CTC',   fmtCurrency(salStruct.monthly), ACCENT],
            ].map(([l,v,c])=>(
              <Box key={l} sx={{ flex:'1 1 150px', p:2, bgcolor:'white', borderRadius:2, border:'1px solid #e2e8f0' }}>
                <Typography fontSize={11} color="text.secondary">{l}</Typography>
                <Typography fontSize={17} fontWeight={700} color={c}>{v}</Typography>
              </Box>
            ))}
          </Box>

          <Paper variant="outlined" sx={{ borderRadius:2, overflow:'hidden' }}>
            <Box sx={{ p:2, bgcolor:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              <Typography fontWeight={700} fontSize={13}>Salary Structure (Auto-generated)</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th':TH }}>
                    <TableCell>Component</TableCell>
                    <TableCell>Formula</TableCell>
                    <TableCell align="right">Monthly (₹)</TableCell>
                    <TableCell align="right">Annual (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    ['Basic Salary',          '40% of Monthly CTC',     salStruct.basic,    salStruct.basic*12],
                    ['HRA',                   '40% of Basic',           salStruct.hra,      salStruct.hra*12],
                    ['Conveyance',            'Fixed ₹1,600',           salStruct.convey,   salStruct.convey*12],
                    ['Medical Allowance',     '3% of Monthly CTC',      salStruct.medical,  salStruct.medical*12],
                    ['Special Allowance',     'Balance',                salStruct.special,  salStruct.special*12],
                    ['Gross Monthly',         'Sum of above',           salStruct.gross,    salStruct.gross*12],
                    ['PF (Employer)',          '12% of Basic',           salStruct.pf,       salStruct.pf*12],
                    ['Gratuity',              '4.81% of Basic',         salStruct.gratuity, salStruct.gratuity*12],
                  ].map(([comp,formula,monthly,annual])=>(
                    <TableRow key={comp}>
                      <TableCell sx={{ fontSize:12, fontWeight:500 }}>{comp}</TableCell>
                      <TableCell sx={{ fontSize:11, color:'text.secondary' }}>{formula}</TableCell>
                      <TableCell sx={{ fontSize:12, fontWeight:600, textAlign:'right' }}>{fmtCurrency(Number(monthly))}</TableCell>
                      <TableCell sx={{ fontSize:12, textAlign:'right', color:'text.secondary' }}>{fmtCurrency(Number(annual))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor:'#f8fafc' }}>
                    <TableCell sx={{ fontSize:12, fontWeight:700 }} colSpan={2}>Total CTC</TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:700, textAlign:'right', color:ACCENT }}>{fmtCurrency(salStruct.monthly)}</TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:700, textAlign:'right', color:ACCENT }}>{fmtCurrency(newCtc)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ── TAB 3: History ────────────────────────────────────────────────── */}
      {tab===3&&<HistoryPanel employeeCode={emp.employee_id}/>}
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail';

export default function SalaryRevisionPage() {
  const [records,   setRecords]   = useState<SalaryRevision[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selEmp,    setSelEmp]    = useState<Employee|null>(null);
  const [selRec,    setSelRec]    = useState<SalaryRevision|undefined>(undefined);
  const [view,      setView]      = useState<View>('dashboard');
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [toast,     setToast]     = useState<{ msg:string; type:'success'|'error' }|null>(null);

  const showToast=(msg:string,type:'success'|'error'='success')=>setToast({ msg, type });

  const loadData=useCallback(async()=>{
    try {
      setLoading(true);
      const [rRes,eRes]=await Promise.all([axios.get(API),axios.get(EMP_API)]);
      const rData=Array.isArray(rRes.data)?rRes.data:rRes.data?.data||[];
      const eData=Array.isArray(eRes.data)?eRes.data:eRes.data?.data||[];
      setRecords(rData);
      setEmployees(eData);
    } catch { showToast('Failed to load data','error'); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ loadData(); },[loadData]);

  const handleSelect=(emp:Employee,rec?:SalaryRevision)=>{ setSelEmp(emp); setSelRec(rec); setView('detail'); };

  const handleRecordChange=(updated:SalaryRevision)=>{
    setRecords(prev=>{
      const exists = prev.some(r=>r._id===updated._id);
      return exists ? prev.map(r=>r._id===updated._id?updated:r) : [updated, ...prev];
    });
    setSelRec(updated);
  };

  const handleAdded=(newRec:SalaryRevision)=>{
    setRecords(prev=>[newRec,...prev]);
    const matchedEmp=employees.find(e=>e.employee_id===newRec.employeeCode);
    if (matchedEmp){ setSelEmp(matchedEmp); setSelRec(newRec); setView('detail'); }
  };

  if (loading&&view==='dashboard') return (
    <div className="flex min-h-screen bg-gray-50/70">
      <Sidebar/><div className="flex-1 flex flex-col"><Navbar/>
        <main className="flex-1 flex items-center justify-center pt-16 md:pt-20">
          <CircularProgress size={40}/>
        </main>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar/>
      <div className="flex-1 flex flex-col">
        <Navbar/>
        <main className="flex-1 overflow-hidden pt-16 md:pt-20">
          <Box sx={{ maxWidth:1300, mx:'auto', width:'100%', height:'100%', overflow:'auto' }}>
            {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

            {view==='dashboard'&&(
              <DashboardView records={records} employees={employees} loading={loading}
                onSelect={handleSelect} onAdd={()=>setShowAdd(true)}/>
            )}

            {view==='detail'&&selEmp&&(
              <RevisionDetailView
                emp={selEmp}
                rec={selRec}
                onBack={()=>{ setView('dashboard'); setSelEmp(null); setSelRec(undefined); loadData(); }}
                onRecordChange={handleRecordChange}
                showToast={showToast}/>
            )}
          </Box>
        </main>
      </div>

      <AddRevisionModal open={showAdd} onClose={()=>setShowAdd(false)}
        onAdded={handleAdded} showToast={showToast} employees={employees}/>
    </div>
  );
}