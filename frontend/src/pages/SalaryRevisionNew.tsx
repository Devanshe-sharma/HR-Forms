import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Slider, Autocomplete,
} from '@mui/material';
import {
  ArrowBack      as ArrowBackIcon,
  CheckCircle    as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  BarChart       as TrendingUpIcon,
  Block          as PauseCircleIcon,
  Add            as AddIcon,
  Close          as CloseIcon,
  TableChart     as TableChartIcon,
  Edit           as EditIcon,
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
  basic            : string;
  hra              : string;
  gross_monthly    : string;
  employer_pf      : string;
  gratuity         : string;
  annual_bonus     : string;
  annual_performance_incentive: string;
  medical_premium  : string;
  travel_allowance : string;
  telephone_allowance: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.REACT_APP_API_URL || process.env.API_BASE_URL || 'http://3.110.162.1:5000/api';
const API      = `${API_BASE}/salary-revisions`;
const EMP_API  = `${API_BASE}/employees`;

const TH = { fontWeight:700, fontSize:11, color:'text.secondary', bgcolor:'#f9fafb', whiteSpace:'nowrap' as const, py:'6px' };
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

const isDueIn = (j: string, m: number, y: number) => {
  const d = get11MonthDate(j);
  return d.getMonth()===m && d.getFullYear()===y;
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

/**
 * Auto-generate salary structure from a new annual CTC.
 * Formulas mirror the letter automation logic.
 */
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
  s==='completed' ? { bg:'#ECFDF5', color:'#059669', border:'#6EE7B7' } :
  s==='on_hold'   ? { bg:'#FEF3C7', color:'#D97706', border:'#FCD34D' } :
  s==='pending_hr'? { bg:'#F5F3FF', color:'#7C3AED', border:'#DDD6FE' } :
                    { bg:'#EFF6FF', color:'#2563EB', border:'#BFDBFE' };

// ─── Small chips ──────────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: RevisionStage }) {
  const { bg, color, border } = stageColor(stage);
  const done = stage==='completed';
  return (
    <Chip size="small"
      icon={done ? <CheckCircleIcon fontSize="small"/> : <HourglassEmptyIcon fontSize="small"/>}
      label={stageLabel(stage)}
      sx={{ bgcolor:bg, color, fontWeight:600, fontSize:10, border:`1px solid ${border}`,
        '& .MuiChip-icon':{ color:'inherit', ml:'4px' } }}/>
  );
}

function DecisionChip({ decision }: { decision: RevisionDecision }) {
  if (!decision) return <Chip size="small" label="Pending" sx={{ bgcolor:'#F3F4F6', color:'#6B7280', fontSize:10 }}/>;
  return (
    <Chip size="small"
      icon={decision==='increment'?<TrendingUpIcon fontSize="small"/>:<PauseCircleIcon fontSize="small"/>}
      label={decision==='increment'?'Increment':'PIP'}
      sx={{ bgcolor:decision==='increment'?'#ECFDF5':'#FEF2F2',
        color:decision==='increment'?'#059669':'#DC2626', fontWeight:700, fontSize:10,
        border:`1px solid ${decision==='increment'?'#6EE7B7':'#FECACA'}`,
        '& .MuiChip-icon':{ color:'inherit', ml:'4px' } }}/>
  );
}

function Toast({ msg, type, onClose }: { msg:string; type:'success'|'error'; onClose:()=>void }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return ()=>clearTimeout(t); },[onClose]);
  return (
    <Box sx={{ position:'fixed', bottom:24, right:24, zIndex:9999, minWidth:280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius:2, boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>{msg}</Alert>
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
        const isCurr=m===now.getMonth()&&y===now.getFullYear();
        return (
          <Button key={`${y}-${m}`} size="small" variant={active?'contained':'outlined'}
            onClick={()=>onChange(m,y)}
            sx={{ minWidth:50, fontSize:11, textTransform:'none', py:0.4, lineHeight:1.4,
              bgcolor:active?'#7C3AED':'transparent',
              borderColor:active?'#7C3AED':isCurr?'#7C3AED':'#D1D5DB',
              color:active?'white':isCurr?'#7C3AED':'#6B7280',
              fontWeight:isCurr?700:400,
              '&:hover':{ bgcolor:active?'#6D28D9':'#F5F3FF', borderColor:'#7C3AED' } }}>
            {MONTHS[m]}<br/><span style={{ fontSize:9 }}>{y}</span>
          </Button>
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
        employeeCode:sel.employee_id, employeeName:sel.full_name,
        department:sel.department, designation:sel.designation,
        email:sel.email, joiningDate:sel.joining_date,
        category:cat, applicableDate:appDate||null,
        previousCtc:sel.annual_ctc||0,
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
        width:{ xs:'95vw', md:560 }, maxHeight:'88vh', overflow:'auto',
        bgcolor:'white', borderRadius:3, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', outline:'none' }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          p:2.5, borderBottom:'1px solid #E5E7EB', position:'sticky', top:0, bgcolor:'white', zIndex:1 }}>
          <Typography fontSize={15} fontWeight={700}>Add Salary Revision</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small"/></IconButton>
        </Box>
        <Box sx={{ p:2.5 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={0.75}>SELECT EMPLOYEE</Typography>
              <Autocomplete options={employees} getOptionLabel={e=>`${e.full_name} (${e.employee_id})`}
                value={sel} onChange={(_,v)=>{ setSel(v); if(v?.employee_category) setCat(v.employee_category); }}
                renderInput={p=><TextField {...p} size="small" placeholder="Search name or ID…"/>}
                renderOption={(props,e)=>(
                  <li {...props} key={e._id}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, py:0.5 }}>
                      <Avatar sx={{ width:26, height:26, bgcolor:'#7C3AED', fontSize:10, fontWeight:700 }}>{initials(e.full_name)}</Avatar>
                      <Box>
                        <Typography fontSize={13} fontWeight={600}>{e.full_name}</Typography>
                        <Typography fontSize={11} color="text.secondary">{e.employee_id} · {e.department}</Typography>
                      </Box>
                    </Box>
                  </li>
                )}/>
            </Box>
            {sel && (
              <Box sx={{ p:2, bgcolor:'#F5F3FF', borderRadius:2, border:'1px solid #DDD6FE' }}>
                <Typography fontSize={11} fontWeight={700} color="#7C3AED" mb={1}>AUTO-FETCHED</Typography>
                <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.2 }}>
                  {[['Department',sel.department||'—'],['Designation',sel.designation||'—'],
                    ['Email',sel.email||'—'],['Joining Date',fmtDate(sel.joining_date)],
                    ['Previous CTC',fmtCurrency(sel.annual_ctc)],['Due Date (11m)',fmtDate(due?.toISOString())]
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
                helperText="Effective date" sx={{ minWidth:180 }}/>
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
                <Typography fontSize={11} fontWeight={700} color="text.secondary">PMS SCORES</Typography>
                <Button size="small" startIcon={<AddIcon/>} onClick={()=>setPms(r=>[...r,{period:'',score:0}])}
                  sx={{ fontSize:11, textTransform:'none', color:'#7C3AED' }}>Add Period</Button>
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
                      sx={{ mt:0.5, color:'#DC2626' }}><CloseIcon fontSize="small"/></IconButton>}
                  </Box>
                ))}
              </Stack>
              {pms.some(r=>r.period.trim())&&(
                <Box sx={{ mt:1, p:1.5, bgcolor:'#F5F3FF', borderRadius:1.5, display:'inline-flex', gap:1.5, alignItems:'center' }}>
                  <Typography fontSize={11} color="text.secondary">Average PMS:</Typography>
                  <Typography fontSize={13} fontWeight={700} color="#7C3AED">{avgPms(pms.filter(r=>r.period.trim()))??'—'}</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display:'flex', gap:2 }}>
              <Button variant="contained" onClick={submit} disabled={saving||!sel}
                sx={{ flex:1, bgcolor:'#7C3AED', '&:hover':{ bgcolor:'#6D28D9' }, textTransform:'none', fontWeight:600 }}>
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
  const [desg,     setDesg]     = useState('All');
  const [stage,    setStage]    = useState('All');

  const revisionMap = useMemo(()=>{
    const m=new Map<string,SalaryRevision>();
    records.forEach(r=>m.set(r.employeeCode,r));
    return m;
  },[records]);

  const eligibleEmps = useMemo(()=>employees.filter(e=>e.joining_date&&isEligible(e.joining_date)),[employees]);

  // Employees from records not in the employees list
  const recordOnlyEmps: Employee[] = useMemo(()=>{
    const known=new Set(employees.map(e=>e.employee_id));
    return records.filter(r=>isEligible(r.joiningDate)&&!known.has(r.employeeCode)).map(r=>({
      _id:r._id, employee_id:r.employeeCode, full_name:r.employeeName,
      department:r.department, designation:r.designation, email:r.email, official_email:r.email,
      joining_date:r.joiningDate, employee_category:r.category, annual_ctc:r.previousCtc,
      basic:'',hra:'',gross_monthly:'',employer_pf:'',gratuity:'',annual_bonus:'',
      annual_performance_incentive:'',medical_premium:'',travel_allowance:'',telephone_allowance:'',
    }));
  },[employees,records]);

  const allEmps=[...eligibleEmps,...recordOnlyEmps];
  const depts=['All',...Array.from(new Set(allEmps.map(e=>e.department).filter(Boolean)))];
  const desgs=['All',...Array.from(new Set(allEmps.map(e=>e.designation).filter(Boolean)))];
  const stages=['All','no_record','pending_manager','pending_management','pending_hr','completed','on_hold'];

  const filtered=useMemo(()=>allEmps.filter(e=>{
    if (!e.joining_date) return false;
    const rec=revisionMap.get(e.employee_id);
    const monthOk=showAll||isDueIn(e.joining_date,selMonth,selYear);
    const searchOk=!search||e.full_name.toLowerCase().includes(search.toLowerCase())||e.employee_id.toLowerCase().includes(search.toLowerCase());
    const deptOk=dept==='All'||e.department===dept;
    const desgOk=desg==='All'||e.designation===desg;
    const stageOk=stage==='All'?true:stage==='no_record'?!rec:rec?.stage===stage;
    return monthOk&&searchOk&&deptOk&&desgOk&&stageOk;
  }),[allEmps,showAll,selMonth,selYear,search,dept,desg,stage,revisionMap]);

  const stats={
    due:filtered.length,
    noRec:filtered.filter(e=>!revisionMap.get(e.employee_id)).length,
    pending:filtered.filter(e=>{ const r=revisionMap.get(e.employee_id); return r&&r.stage!=='completed'; }).length,
    increment:filtered.filter(e=>revisionMap.get(e.employee_id)?.managerDecision?.decision==='increment').length,
    pip:filtered.filter(e=>revisionMap.get(e.employee_id)?.managerDecision?.decision==='pip').length,
    completed:filtered.filter(e=>revisionMap.get(e.employee_id)?.stage==='completed').length,
  };

  const STATS=[
    { label:showAll?'All Eligible':'Due', value:stats.due, color:'#7C3AED', bg:'#F5F3FF' },
    { label:'No Record', value:stats.noRec, color:'#DC2626', bg:'#FEF2F2' },
    { label:'Pending', value:stats.pending, color:'#D97706', bg:'#FFFBEB' },
    { label:'Increment', value:stats.increment, color:'#059669', bg:'#ECFDF5' },
    { label:'PIP', value:stats.pip, color:'#7C3AED', bg:'#F5F3FF' },
    { label:'Completed', value:stats.completed, color:'#2563EB', bg:'#EFF6FF' },
  ];

  return (
    <Box sx={{ p:2, maxWidth:1400, mx:'auto' }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5, flexWrap:'wrap', gap:1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={700} color="#1F2937">Salary Revision</Typography>
          <Typography fontSize={12} color="text.secondary">
            {showAll?'All employees past 11 months':`Employees due in ${MONTHS[selMonth]} ${selYear}`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon/>} onClick={onAdd} size="small"
          sx={{ bgcolor:'#7C3AED', textTransform:'none', fontWeight:600, '&:hover':{ bgcolor:'#6D28D9' } }}>
          Add Revision
        </Button>
      </Box>

      {/* Stats */}
      <Box sx={{ display:'flex', gap:1, mb:1.5, flexWrap:'wrap' }}>
        {STATS.map(s=>(
          <Box key={s.label} sx={{ flex:'1 1 90px', p:1.25, borderRadius:1.5,
            bgcolor:s.bg, border:`1px solid ${s.color}25`,
            '&:hover':{ transform:'translateY(-1px)', boxShadow:'0 3px 8px rgba(0,0,0,0.08)' }, transition:'all 0.15s' }}>
            <Typography fontSize={22} fontWeight={800} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography fontSize={10} color="text.secondary" mt={0.3}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Month strip */}
      {!showAll&&(
        <Box sx={{ mb:1.5, p:1.5, bgcolor:'white', borderRadius:2, border:'1px solid #E5E7EB' }}>
          <Typography fontSize={10} fontWeight={700} color="text.secondary" mb={1}>
            SELECT MONTH
          </Typography>
          <MonthStrip selMonth={selMonth} selYear={selYear} onChange={(m,y)=>{ setSelMonth(m); setSelYear(y); }}/>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display:'flex', gap:1, mb:1.5, flexWrap:'wrap', p:1.5,
        bgcolor:'white', borderRadius:2, border:'1px solid #E5E7EB', alignItems:'center' }}>
        <TextField size="small" placeholder="Search…" value={search}
          onChange={e=>setSearch(e.target.value)} sx={{ minWidth:180 }}
          InputProps={{ sx:{ fontSize:13 } }}/>
        <FormControl size="small" sx={{ minWidth:130 }}>
          <InputLabel sx={{ fontSize:12 }}>Department</InputLabel>
          <Select value={dept} label="Department" onChange={e=>setDept(e.target.value)} sx={{ fontSize:12 }}>
            {depts.map(d=><MenuItem key={d} value={d} sx={{ fontSize:12 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth:130 }}>
          <InputLabel sx={{ fontSize:12 }}>Designation</InputLabel>
          <Select value={desg} label="Designation" onChange={e=>setDesg(e.target.value)} sx={{ fontSize:12 }}>
            {desgs.map(d=><MenuItem key={d} value={d} sx={{ fontSize:12 }}>{d}</MenuItem>)}
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
        <Button variant={showAll?'contained':'outlined'} size="small" onClick={()=>setShowAll(!showAll)}
          sx={{ fontSize:12, textTransform:'none', bgcolor:showAll?'#7C3AED':'transparent',
            color:showAll?'white':'#7C3AED', borderColor:'#7C3AED',
            '&:hover':{ bgcolor:showAll?'#6D28D9':'#F5F3FF' } }}>
          {showAll?'By Month':'Show All'}
        </Button>
        <Button variant="outlined" size="small"
          onClick={()=>{ setSearch(''); setDept('All'); setDesg('All'); setStage('All'); setShowAll(false); }}
          sx={{ fontSize:12, textTransform:'none' }}>Reset</Button>
      </Box>

      {/* Table */}
      <Box sx={{ bgcolor:'white', borderRadius:2, border:'1px solid #E5E7EB', overflow:'hidden' }}>
        {loading?<Box display="flex" justifyContent="center" py={6}><CircularProgress size={32}/></Box>:(
          <TableContainer sx={{ maxHeight:440, overflow:'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th':TH }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Designation</TableCell>
                  <TableCell>Joining Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Prev. CTC</TableCell>
                  <TableCell>Avg PMS</TableCell>
                  <TableCell>Decision</TableCell>
                  <TableCell>Incr %</TableCell>
                  <TableCell>New CTC</TableCell>
                  <TableCell>Stage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length===0&&(
                  <TableRow><TableCell colSpan={11} align="center" sx={{ py:6, color:'text.secondary', fontSize:13 }}>
                    {showAll?'No eligible employees found':`No employees due in ${MONTHS[selMonth]} ${selYear}`}
                  </TableCell></TableRow>
                )}
                {filtered.map(emp=>{
                  const rec=revisionMap.get(emp.employee_id);
                  const dueDate=get11MonthDate(emp.joining_date!);
                  const isThisMonth=isDueIn(emp.joining_date!,now.getMonth(),now.getFullYear());
                  const avg=rec?avgPms(rec.pmsScores):null;
                  return (
                    <TableRow key={emp._id} onClick={()=>onSelect(emp,rec)}
                      sx={{ cursor:'pointer', bgcolor:isThisMonth?'#FEFCE8':'inherit',
                        '&:hover':{ bgcolor:'#EDE9FE','& td':{ color:'#4C1D95' } }, transition:'background 0.12s' }}>
                      <TableCell>
                        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                          <Avatar sx={{ width:28, height:28, bgcolor:'#7C3AED', fontSize:10, fontWeight:700 }}>{initials(emp.full_name)}</Avatar>
                          <Box>
                            <Typography fontSize={12} fontWeight={600}>{emp.full_name}</Typography>
                            <Typography fontSize={10} color="text.secondary">{emp.employee_id}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize:12 }}>{emp.department||'—'}</TableCell>
                      <TableCell sx={{ fontSize:12 }}>{emp.designation||'—'}</TableCell>
                      <TableCell sx={{ fontSize:12 }}>{fmtDate(emp.joining_date)}</TableCell>
                      <TableCell>
                        <Box sx={{ display:'flex', alignItems:'center', gap:0.5, flexWrap:'wrap' }}>
                          <Typography component="span" fontSize={12} fontWeight={isThisMonth?700:400} color={isThisMonth?'#D97706':'inherit'}>
                            {fmtDate(dueDate.toISOString())}
                          </Typography>
                          {isThisMonth&&<Chip label="Now" size="small" sx={{ fontSize:9, bgcolor:'#FEF3C7', color:'#D97706', height:16 }}/>}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize:12 }}>{fmtCurrency(emp.annual_ctc)}</TableCell>
                      <TableCell>
                        {avg!=null
                          ?<Chip label={avg} size="small" sx={{ fontWeight:700, bgcolor:'#F5F3FF', color:'#7C3AED', fontSize:10 }}/>
                          :<Typography fontSize={11} color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell>
                        {rec?<DecisionChip decision={rec.managerDecision?.decision}/>
                          :<Chip label="No Record" size="small" sx={{ bgcolor:'#FEF2F2', color:'#DC2626', fontSize:10 }}/>}
                      </TableCell>
                      <TableCell>
                        {rec?.finalIncrementPct!=null
                          ?<Chip label={`${rec.finalIncrementPct}%`} size="small" sx={{ bgcolor:'#ECFDF5', color:'#059669', fontWeight:700, fontSize:10 }}/>
                          :<Typography fontSize={11} color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontSize:12, fontWeight:600, color:'#059669' }}>{rec?fmtCurrency(rec.newCtc):'—'}</TableCell>
                      <TableCell>
                        {rec?<StageChip stage={rec.stage}/>
                          :<Chip label="Pending" size="small" sx={{ bgcolor:'#FEF3C7', color:'#D97706', fontSize:10 }}/>}
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

// ─── Revision Detail / Action View ───────────────────────────────────────────
// This is the main editable form. Shows all 4 sections and drives the workflow.

function RevisionDetailView({ emp, rec, allEmployees, onBack, onRecordChange, showToast }: {
  emp          : Employee;
  rec          : SalaryRevision | undefined;
  allEmployees : Employee[];
  onBack       : () => void;
  onRecordChange:(r: SalaryRevision) => void;
  showToast    : (m:string,t:'success'|'error')=>void;
}) {
  const [tab, setTab] = useState(0);

  // ── Section 1: Employee Details ──────────────────────────────────────────
  const [applicableDate, setApplicableDate] = useState(rec?.applicableDate
    ? new Date(rec.applicableDate).toISOString().split('T')[0] : '');
  const [category, setCategory] = useState(rec?.category||emp.employee_category||'Employee');
  const [pmsRows,  setPmsRows]  = useState<PmsScore[]>(
    rec?.pmsScores?.length ? rec.pmsScores : [{ period:'', score:0 }]
  );

  // ── Section 2 / 3: Manager Decision ─────────────────────────────────────
  const [mgrDecision,   setMgrDecision]   = useState<'increment'|'pip'>(rec?.managerDecision?.decision||'increment');
  const [mgrPct,        setMgrPct]        = useState(rec?.managerDecision?.recommendedPct??10);
  const [mgrReason,     setMgrReason]     = useState(rec?.managerDecision?.reason||'');
  const [pipMonths,     setPipMonths]     = useState(rec?.managerDecision?.pipDurationMonths??3);
  const [pipDueDate,    setPipDueDate]    = useState(
    rec?.managerDecision?.pipNewDueDate
      ? new Date(rec.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '');

  // ── Section 3: Management Decision ──────────────────────────────────────
  const [mgmtPct,       setMgmtPct]       = useState(rec?.managementDecision?.finalPct??mgrPct);
  const [mgmtReason,    setMgmtReason]    = useState(rec?.managementDecision?.reason||'');
  const [pipApproved,   setPipApproved]   = useState(rec?.managementDecision?.pipApproved??true);

  // ── Section 4: HR Final ──────────────────────────────────────────────────
  const [hrNotes,       setHrNotes]       = useState(rec?.hrDecision?.notes||'');
  const [hrAppDate,     setHrAppDate]     = useState(
    rec?.hrDecision?.applicableDate
      ? new Date(rec.hrDecision.applicableDate).toISOString().split('T')[0]
      : applicableDate);

  const [busy, setBusy] = useState(false);

  // Auto-calc PIP due date
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
  const finalPct    = isMgmt||isHr||isCompleted ? (rec?.managementDecision?.finalPct??mgmtPct) : mgrPct;
  const newCtc      = mgrDecision==='increment'
    ? Math.round(prevCtc*(1+(isHr||isCompleted?(rec?.managementDecision?.finalPct??mgmtPct):isMgmt?mgmtPct:mgrPct)/100))
    : prevCtc;
  const salStruct   = calcSalaryStructure(newCtc);
  const avg         = avgPms(pmsRows.filter(r=>r.period.trim()));

  // ── Submit helpers ────────────────────────────────────────────────────────

  const postManager = async () => {
    if (!mgrReason.trim()) return showToast('Provide a reason', 'error');
    setBusy(true);
    try {
      // Auto-create the revision record if the employee has none yet.
      // This lets the manager submit directly without a separate "Add Revision" step.
      let revisionId = rec?._id;
      if (!revisionId) {
        const createRes = await axios.post(API, {
          employeeCode  : emp.employee_id,
          employeeName  : emp.full_name,
          department    : emp.department,
          designation   : emp.designation,
          email         : emp.official_email,
          joiningDate   : emp.joining_date,
          category,
          applicableDate: applicableDate || null,
          previousCtc   : emp.annual_ctc || 0,
          pmsScores     : pmsRows.filter(r => r.period.trim()),
        });
        const created = createRes.data?.data || createRes.data;
        if (!created?._id) { showToast('Failed to initialise revision record', 'error'); return; }
        revisionId = created._id;
        onRecordChange(created); // surface it immediately so rest of UI knows
      }

      // Submit the manager decision
      const payload: any = {
        reason        : mgrReason,
        applicableDate: applicableDate || null,
        category,
        decision      : mgrDecision,
        pmsScores     : pmsRows.filter(r => r.period.trim()),
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
      if (data.success){ showToast('HR decision saved — revision completed','success'); onRecordChange(data.data); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Failed','error'); }
    finally { setBusy(false); }
  };

  // ── Flow status banner ────────────────────────────────────────────────────

  const FlowBanner=()=>{
    if (isCompleted) return <Alert severity="success" sx={{ mb:2, fontSize:12 }}>✅ Revision completed. Final CTC: {fmtCurrency(rec?.newCtc)}</Alert>;
    if (isOnHold)    return <Alert severity="warning" sx={{ mb:2, fontSize:12 }}>⏸ On hold (PIP). Review opens on {fmtDate(rec?.reviewDate)}.</Alert>;
    if (isMgr)       return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>📋 Step 1 of 3 — Awaiting <strong>Manager</strong> decision.</Alert>;
    if (isMgmt)      return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>📋 Step 2 of 3 — Awaiting <strong>Management</strong> decision.</Alert>;
    if (isHr)        return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>📋 Step 3 of 3 — Awaiting <strong>HR</strong> to finalise and generate letter.</Alert>;
    return null;
  };

  return (
    <Box sx={{ p:2.5, maxWidth:1400, mx:'auto' }}>
      {/* Header */}
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:2, flexWrap:'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor:'#F3F4F6', borderRadius:1.5 }}>
          <ArrowBackIcon fontSize="small"/>
        </IconButton>
        <Avatar sx={{ width:40, height:40, bgcolor:'#7C3AED', fontWeight:700, fontSize:15 }}>{initials(emp.full_name)}</Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="1rem">{emp.full_name}</Typography>
          <Typography fontSize={12} color="text.secondary">{emp.designation} · {emp.department} · {emp.employee_id}</Typography>
        </Box>
        {rec&&<DecisionChip decision={rec.managerDecision?.decision}/>}
        {rec&&<StageChip stage={rec.stage}/>}
        {!rec&&<Chip label="No revision record" size="small" sx={{ bgcolor:'#FEF2F2', color:'#DC2626' }}/>}
      </Box>

      <FlowBanner/>

      {/* Flow progress steps */}
      <Box sx={{ display:'flex', gap:0, mb:2.5, bgcolor:'white', borderRadius:2, border:'1px solid #E5E7EB', overflow:'hidden' }}>
        {[
          { label:'1. Manager', stage:'pending_manager', done:!isMgr },
          { label:'2. Management', stage:'pending_management', done:isHr||isCompleted },
          { label:'3. HR Final', stage:'pending_hr', done:isCompleted },
        ].map((step,i)=>{
          const isActive = stage===step.stage;
          const isDone   = step.done&&!isActive;
          return (
            <Box key={i} sx={{ flex:1, p:1.5, textAlign:'center',
              bgcolor:isActive?'#7C3AED':isDone?'#ECFDF5':'#F9FAFB',
              borderRight:i<2?'1px solid #E5E7EB':'none' }}>
              <Typography fontSize={12} fontWeight={700}
                color={isActive?'white':isDone?'#059669':'#9CA3AF'}>
                {isDone?'✓ ':''}{step.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Tab navigation */}
      <Box sx={{ borderBottom:'1px solid #E5E7EB', mb:2 }}>
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{
          '& .MuiTab-root':{ fontSize:12, textTransform:'none', minHeight:36, py:0 },
          '& .MuiTabs-indicator':{ bgcolor:'#7C3AED' },
          '& .Mui-selected':{ color:'#7C3AED !important', fontWeight:700 },
        }}>
          <Tab label="Employee Details" value={0}/>
          <Tab label="Decision" value={1}/>
          <Tab label="Salary Structure" value={2} disabled={mgrDecision!=='increment'}/>
          <Tab label="Output Table" value={3} icon={<TableChartIcon sx={{ fontSize:14 }}/>} iconPosition="end"/>
        </Tabs>
      </Box>

      {/* ── TAB 0: Employee Details ────────────────────────────────────────── */}
      {tab===0&&(
        <Box sx={{ display:'flex', gap:2.5, flexWrap:'wrap' }}>
          {/* Auto-fetched info */}
          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Auto-Fetched Info</Typography>
            <Stack spacing={1.2}>
              {[
                ['Employee Code', emp.employee_id],
                ['Full Name',     emp.full_name],
                ['Email',         emp.email||rec?.email||'—'],
                ['Department',    emp.department||rec?.department||'—'],
                ['Designation',   emp.designation||rec?.designation||'—'],
                ['Joining Date',  fmtDate(emp.joining_date||rec?.joiningDate)],
                ['Due Date (11m)',fmtDate(get11MonthDate(emp.joining_date||rec?.joiningDate||'').toISOString())],
                ['Previous CTC',  fmtCurrency(prevCtc)],
              ].map(([l,v])=>(
                <Box key={l} sx={{ display:'flex', justifyContent:'space-between', gap:2 }}>
                  <Typography fontSize={12} color="text.secondary">{l}</Typography>
                  <Typography fontSize={12} fontWeight={500} textAlign="right">{v}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* Editable + PMS */}
          <Paper variant="outlined" sx={{ flex:'1 1 280px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Editable Fields</Typography>
            <Stack spacing={2}>
              <TextField label="Applicable Date" type="date" size="small"
                value={applicableDate} onChange={e=>setApplicableDate(e.target.value)}
                InputLabelProps={{ shrink:true }} helperText="Date increment is effective from"
                disabled={!isMgr} fullWidth/>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={e=>setCategory(e.target.value)} disabled={!isMgr}>
                  {['Employee','Consultant','Intern','Temporary Staff','Contract Based'].map(c=>(
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider/>
              <Box>
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                  <Typography fontSize={12} fontWeight={700} color="text.secondary">PMS SCORES</Typography>
                  {isMgr&&<Button size="small" startIcon={<AddIcon/>}
                    onClick={()=>setPmsRows(r=>[...r,{period:'',score:0}])}
                    sx={{ fontSize:11, textTransform:'none', color:'#7C3AED' }}>Add</Button>}
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
                          sx={{ color:'#DC2626' }}><CloseIcon fontSize="small"/></IconButton>
                      )}
                    </Box>
                  ))}
                </Stack>
                {avg!=null&&(
                  <Box sx={{ mt:1, p:1.25, bgcolor:'#F5F3FF', borderRadius:1.5, display:'inline-flex', gap:1, alignItems:'center' }}>
                    <Typography fontSize={11} color="text.secondary">Avg PMS:</Typography>
                    <Typography fontSize={13} fontWeight={700} color="#7C3AED">{avg}</Typography>
                  </Box>
                )}
              </Box>
            </Stack>
          </Paper>
        </Box>
      )}

      {/* ── TAB 1: Decision ───────────────────────────────────────────────── */}
      {tab===1&&(
        <Box sx={{ display:'flex', gap:2.5, flexWrap:'wrap' }}>

          {/* Manager Decision */}
          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5,
            opacity:isMgr?1:0.92,
            outline:isMgr?'2px solid #7C3AED':'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:24, height:24, borderRadius:'50%', bgcolor:isMgr?'#7C3AED':!isMgr?'#059669':'#E5E7EB',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{!isMgr?'✓':'1'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>Manager Decision</Typography>
              {!isMgr&&rec?.managerDecision?.submittedAt&&(
                <Chip label="Submitted" size="small" sx={{ bgcolor:'#ECFDF5', color:'#059669', fontSize:10 }}/>
              )}
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
                        bgcolor:mgrDecision===opt?(opt==='increment'?'#059669':'#DC2626'):'transparent',
                        borderColor:opt==='increment'?'#059669':'#DC2626',
                        color:mgrDecision===opt?'white':(opt==='increment'?'#059669':'#DC2626'),
                        '&:hover':{ bgcolor:opt==='increment'?'#047857':'#B91C1C', color:'white' } }}>
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
                    <Box sx={{ p:1.5, bgcolor:'#ECFDF5', borderRadius:1.5, border:'1px solid #6EE7B7' }}>
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
                    inputProps={{ min:1, max:12 }} helperText="1–12 months"
                    disabled={!isMgr} sx={{ width:160 }}/>
                  <TextField label="New Due Date" type="date" size="small"
                    value={pipDueDate} onChange={e=>setPipDueDate(e.target.value)}
                    InputLabelProps={{ shrink:true }} helperText="Auto-calculated"
                    disabled={!isMgr} sx={{ width:180 }}/>
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

          {/* Management Decision */}
          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5,
            opacity:isMgmt?1:isMgr?0.5:0.92,
            outline:isMgmt?'2px solid #7C3AED':'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:24, height:24, borderRadius:'50%',
                bgcolor:isMgmt?'#7C3AED':(isHr||isCompleted)?'#059669':'#E5E7EB',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{(isHr||isCompleted)?'✓':'2'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>Management Decision</Typography>
              {(isHr||isCompleted)&&<Chip label="Submitted" size="small" sx={{ bgcolor:'#ECFDF5', color:'#059669', fontSize:10 }}/>}
            </Box>

            {isMgr&&<Alert severity="warning" sx={{ fontSize:11, mb:2 }}>Waiting for manager to submit first.</Alert>}

            {!isMgr&&(
              <Stack spacing={2}>
                {/* Show manager's decision as reference */}
                {rec?.managerDecision?.decision==='increment'&&(
                  <Box sx={{ p:1.5, bgcolor:'#F0FDF4', borderRadius:1.5, border:'1px solid #BBF7D0' }}>
                    <Typography fontSize={11} color="text.secondary">Manager recommended</Typography>
                    <Typography fontSize={13} fontWeight={700} color="#059669">
                      {rec.managerDecision.recommendedPct}% increment
                    </Typography>
                  </Box>
                )}

                {rec?.managerDecision?.decision==='increment'?(
                  <Box>
                    <Typography fontSize={12} fontWeight={600} mb={1}>
                      Management Final: <strong style={{ color:'#7C3AED' }}>{isMgmt?mgmtPct:(rec?.managementDecision?.finalPct??mgmtPct)}%</strong>
                      {rec?.managerDecision?.recommendedPct!=null&&(
                        <span style={{ fontSize:11, color:'#6B7280', marginLeft:8 }}>
                          (Mgr: {rec.managerDecision.recommendedPct}%)
                        </span>
                      )}
                    </Typography>
                    {isMgmt?(
                      <Slider value={mgmtPct} onChange={(_,v)=>setMgmtPct(v as number)}
                        min={0} max={50} step={0.5} valueLabelDisplay="auto"
                        valueLabelFormat={v=>`${v}%`} sx={{ color:'#7C3AED', maxWidth:340 }}/>
                    ):(
                      <Box sx={{ p:1.5, bgcolor:'#F5F3FF', borderRadius:1.5, border:'1px solid #DDD6FE' }}>
                        <Typography fontSize={12} color="#7C3AED" fontWeight={600}>
                          {rec?.managementDecision?.finalPct??mgmtPct}% — final management decision
                        </Typography>
                        <Typography fontSize={11} color="text.secondary" mt={0.5}>{rec?.managementDecision?.reason}</Typography>
                      </Box>
                    )}

                    {/* CTC Preview */}
                    {mgrDecision==='increment'&&(
                      <Box sx={{ mt:1.5, p:1.5, bgcolor:'#ECFDF5', borderRadius:1.5, border:'1px solid #6EE7B7' }}>
                        <Typography fontSize={11} color="text.secondary">New CTC Preview</Typography>
                        <Box sx={{ display:'flex', gap:2, mt:0.5, alignItems:'center', flexWrap:'wrap' }}>
                          <Typography fontSize={12}>{fmtCurrency(prevCtc)}</Typography>
                          <Typography fontSize={11} color="text.secondary">→</Typography>
                          <Typography fontSize={14} fontWeight={700} color="#059669">{fmtCurrency(newCtc)}</Typography>
                          <Chip label={`+${isMgmt?mgmtPct:(rec?.managementDecision?.finalPct??mgmtPct)}%`} size="small"
                            sx={{ bgcolor:'#059669', color:'white', fontWeight:700, fontSize:10 }}/>
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
                        sx={{ textTransform:'none', bgcolor:pipApproved?'#DC2626':'transparent',
                          color:pipApproved?'white':'#DC2626', borderColor:'#DC2626' }}>
                        Approve PIP</Button>
                      <Button variant={!pipApproved?'contained':'outlined'} size="small"
                        onClick={()=>isMgmt&&setPipApproved(false)} disabled={!isMgmt}
                        sx={{ textTransform:'none', bgcolor:!pipApproved?'#059669':'transparent',
                          color:!pipApproved?'white':'#059669', borderColor:'#059669' }}>
                        Re-evaluate</Button>
                    </Box>
                  </Box>
                )}

                <TextField label="Reason / Comments *" multiline rows={3} size="small"
                  value={mgmtReason} onChange={e=>setMgmtReason(e.target.value)}
                  placeholder="Management's reasoning…" disabled={!isMgmt} fullWidth/>

                {isMgmt&&(
                  <Button variant="contained" onClick={postManagement} disabled={busy||!mgmtReason.trim()}
                    sx={{ bgcolor:'#7C3AED', '&:hover':{ bgcolor:'#6D28D9' }, textTransform:'none', fontWeight:600 }}>
                    {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit Management Decision'}
                  </Button>
                )}
              </Stack>
            )}
          </Paper>

          {/* HR Final */}
          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5,
            opacity:isHr?1:isCompleted?0.92:0.5,
            outline:isHr?'2px solid #7C3AED':'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:24, height:24, borderRadius:'50%',
                bgcolor:isHr?'#7C3AED':isCompleted?'#059669':'#E5E7EB',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{isCompleted?'✓':'3'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>HR Final Action</Typography>
              {isCompleted&&<Chip label="Done" size="small" sx={{ bgcolor:'#ECFDF5', color:'#059669', fontSize:10 }}/>}
            </Box>

            {(isMgr||isMgmt)&&<Alert severity="warning" sx={{ fontSize:11, mb:2 }}>Waiting for manager & management first.</Alert>}

            {(isHr||isCompleted)&&(
              <Stack spacing={2}>
                <Box sx={{ p:1.5, bgcolor:'#F5F3FF', borderRadius:1.5, border:'1px solid #DDD6FE' }}>
                  <Typography fontSize={11} color="text.secondary">Management approved</Typography>
                  {rec?.managerDecision?.decision==='increment'?(
                    <Typography fontSize={13} fontWeight={700} color="#7C3AED">
                      {rec?.managementDecision?.finalPct}% increment → {fmtCurrency(newCtc)}
                    </Typography>
                  ):(
                    <Typography fontSize={13} fontWeight={700} color="#DC2626">PIP approved</Typography>
                  )}
                </Box>

                <TextField label="Applicable Date" type="date" size="small"
                  value={hrAppDate} onChange={e=>setHrAppDate(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                <TextField label="HR Notes" multiline rows={3} size="small"
                  value={hrNotes} onChange={e=>setHrNotes(e.target.value)}
                  placeholder="Notes for salary letter generation…" disabled={!isHr} fullWidth/>

                {isHr&&(
                  <Button variant="contained" onClick={postHr} disabled={busy}
                    sx={{ bgcolor:'#2563EB', '&:hover':{ bgcolor:'#1D4ED8' }, textTransform:'none', fontWeight:600 }}>
                    {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Finalise & Complete Revision'}
                  </Button>
                )}

                {isCompleted&&(
                  <Box sx={{ p:1.5, bgcolor:'#ECFDF5', borderRadius:1.5, border:'1px solid #6EE7B7' }}>
                    <Typography fontSize={12} fontWeight={700} color="#059669">✅ Revision Completed</Typography>
                    <Typography fontSize={11} color="text.secondary" mt={0.5}>
                      Applicable from {fmtDate(rec?.hrDecision?.applicableDate||rec?.applicableDate)}.
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
              ['Previous CTC', fmtCurrency(prevCtc), '#6B7280'],
              ['Increment %',  `+${isMgmt||isHr||isCompleted?(rec?.managementDecision?.finalPct??mgmtPct):mgrPct}%`, '#D97706'],
              ['New Annual CTC', fmtCurrency(newCtc), '#059669'],
              ['Monthly CTC',   fmtCurrency(salStruct.monthly), '#2563EB'],
            ].map(([l,v,c])=>(
              <Box key={l} sx={{ flex:'1 1 150px', p:2, bgcolor:'white', borderRadius:2, border:'1px solid #E5E7EB' }}>
                <Typography fontSize={11} color="text.secondary">{l}</Typography>
                <Typography fontSize={18} fontWeight={800} color={c}>{v}</Typography>
              </Box>
            ))}
          </Box>

          <Paper variant="outlined" sx={{ borderRadius:2, overflow:'hidden' }}>
            <Box sx={{ p:2, bgcolor:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
              <Typography fontWeight={700} fontSize={13}>Salary Structure (Auto-generated)</Typography>
              <Typography fontSize={11} color="text.secondary">Based on standard HR formulas applied to new CTC</Typography>
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
                    ['Special Allowance',     'Balance (Gross-Others)', salStruct.special,  salStruct.special*12],
                    ['Gross Monthly',         'Sum of above',           salStruct.gross,    salStruct.gross*12],
                    ['PF (Employer)',          '12% of Basic',           salStruct.pf,       salStruct.pf*12],
                    ['Gratuity',              '4.81% of Basic',         salStruct.gratuity, salStruct.gratuity*12],
                  ].map(([comp,formula,monthly,annual])=>(
                    <TableRow key={comp} sx={{ '&:hover':{ bgcolor:'#F9FAFB' } }}>
                      <TableCell sx={{ fontSize:12, fontWeight:500 }}>{comp}</TableCell>
                      <TableCell sx={{ fontSize:11, color:'text.secondary' }}>{formula}</TableCell>
                      <TableCell sx={{ fontSize:12, fontWeight:600, textAlign:'right' }}>{fmtCurrency(Number(monthly))}</TableCell>
                      <TableCell sx={{ fontSize:12, textAlign:'right', color:'text.secondary' }}>{fmtCurrency(Number(annual))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor:'#F5F3FF' }}>
                    <TableCell sx={{ fontSize:12, fontWeight:700 }} colSpan={2}>Total CTC</TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:700, textAlign:'right', color:'#7C3AED' }}>{fmtCurrency(salStruct.monthly)}</TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:700, textAlign:'right', color:'#7C3AED' }}>{fmtCurrency(newCtc)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ── TAB 3: Output Table ───────────────────────────────────────────── */}
      {tab===3&&(
        <Box>
          <Typography fontSize={12} color="text.secondary" mb={2}>
            Final review table for this employee's revision record.
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius:2, overflow:'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th':TH }}>
                    <TableCell>Employee</TableCell>
                    <TableCell>Dept</TableCell>
                    <TableCell>Designation</TableCell>
                    <TableCell>Avg PMS</TableCell>
                    <TableCell>Decision</TableCell>
                    <TableCell>PIP Duration</TableCell>
                    <TableCell>PIP Due Date</TableCell>
                    <TableCell>Mgr Rec %</TableCell>
                    <TableCell>Mgmt Final %</TableCell>
                    <TableCell>New CTC</TableCell>
                    <TableCell>Stage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                        <Avatar sx={{ width:26, height:26, bgcolor:'#7C3AED', fontSize:10, fontWeight:700 }}>{initials(emp.full_name)}</Avatar>
                        <Box>
                          <Typography fontSize={12} fontWeight={600}>{emp.full_name}</Typography>
                          <Typography fontSize={10} color="text.secondary">{emp.employee_id}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize:12 }}>{emp.department}</TableCell>
                    <TableCell sx={{ fontSize:12 }}>{emp.designation}</TableCell>
                    <TableCell>
                      {avg!=null?<Chip label={avg} size="small" sx={{ bgcolor:'#F5F3FF', color:'#7C3AED', fontWeight:700, fontSize:10 }}/>:'—'}
                    </TableCell>
                    <TableCell><DecisionChip decision={rec?.managerDecision?.decision??null}/></TableCell>
                    <TableCell sx={{ fontSize:12 }}>
                      {rec?.managerDecision?.decision==='pip'?`${rec.managerDecision.pipDurationMonths} mo`:'—'}
                    </TableCell>
                    <TableCell sx={{ fontSize:12 }}>
                      {rec?.managerDecision?.decision==='pip'?fmtDate(rec.managerDecision.pipNewDueDate):'—'}
                    </TableCell>
                    <TableCell>
                      {rec?.managerDecision?.recommendedPct!=null
                        ?<Chip label={`${rec.managerDecision.recommendedPct}%`} size="small" sx={{ bgcolor:'#ECFDF5', color:'#059669', fontWeight:700, fontSize:10 }}/>
                        :'—'}
                    </TableCell>
                    <TableCell>
                      {rec?.managementDecision?.finalPct!=null
                        ?<Chip label={`${rec.managementDecision.finalPct}%`} size="small" sx={{ bgcolor:'#7C3AED', color:'white', fontWeight:700, fontSize:10 }}/>
                        :'—'}
                    </TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:700, color:'#059669' }}>{fmtCurrency(rec?.newCtc)}</TableCell>
                    <TableCell>{rec?<StageChip stage={rec.stage}/>:<Chip label="No Record" size="small" sx={{ bgcolor:'#FEF2F2', color:'#DC2626', fontSize:10 }}/>}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
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
    setRecords(prev=>prev.map(r=>r._id===updated._id?updated:r));
    setSelRec(updated);
  };

  const handleAdded=(newRec:SalaryRevision)=>{
    setRecords(prev=>[newRec,...prev]);
    // auto-open it
    const matchedEmp=employees.find(e=>e.employee_id===newRec.employeeCode);
    if (matchedEmp){ setSelEmp(matchedEmp); setSelRec(newRec); setView('detail'); }
  };

  if (loading&&view==='dashboard') return (
    <div className="flex min-h-screen bg-gray-50/70">
      <Sidebar/><div className="flex-1 flex flex-col"><Navbar/>
        <main className="flex-1 flex items-center justify-center pt-16 md:pt-20">
          <CircularProgress size={56} thickness={4}/>
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
          <Box sx={{ maxWidth:1400, mx:'auto', width:'100%', height:'100%', overflow:'auto' }}>
            {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

            {view==='dashboard'&&(
              <DashboardView records={records} employees={employees} loading={loading}
                onSelect={handleSelect} onAdd={()=>setShowAdd(true)}/>
            )}

            {view==='detail'&&selEmp&&(
              <RevisionDetailView
                emp={selEmp}
                rec={selRec}
                allEmployees={employees}
                onBack={()=>{ setView('dashboard'); setSelEmp(null); setSelRec(undefined); }}
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