import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Slider, Autocomplete, Switch, FormControlLabel,
  Checkbox, InputAdornment, Popover,
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
  Edit           as EditIcon,
  Delete         as DeleteIcon,
  Settings       as SettingsIcon,
  Save           as SaveIcon,
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
  newContractStartDate: string | null;
  newContractEndDate  : string | null;
  // Only set for PPO / intern-to-full-time conversions — see fullTimeSince
  // on SalaryRevision below.
  fullTimeSince: string | null;
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
  contractStartDate : string | null;
  contractEndDate   : string | null;
  newContractStartDate: string | null;
  newContractEndDate  : string | null;
  category          : string;
  applicableDate    : string | null;
  previousCtc       : number;
  newCtc            : number | null;
  finalIncrementPct : number | null;
  // Set when this revision was a PPO/intern-to-full-time conversion — the
  // date the employee actually became full-time. Used to anchor next
  // year's annual review instead of the original (internship) joining
  // date. Not set for normal annual/mid-term revisions.
  fullTimeSince     : string | null;
  pmsScores         : PmsScore[];
  stage             : RevisionStage;
  managerDecision   : ManagerDecision;
  managementDecision: ManagementDecision;
  hrDecision        : HrDecision;
  reviewDate        : string | null;
  pipOutcome        : 'improved' | 'not_improved' | null;
  pipOutcomeReason  : string;
  pipOutcomeDate    : string | null;
  createdAt         : string;
  designationChanged    : boolean;
  previousDesignation   : string;
  newDesignation        : string | null;
  reportingHeadChanged  : boolean;
  previousReportingHead : string;
  newReportingHead      : string | null;
  categoryChanged       : boolean;
  previousCategory      : string;
  newCategory           : string | null;
  _periodStart      : Date | null;
  _periodEnd        : Date | null;
}

function formatIncrementPct(revision: SalaryRevision): string | null {
  if (revision.finalIncrementPct != null) {
    return `${revision.finalIncrementPct >= 0 ? '+' : ''}${revision.finalIncrementPct.toFixed(2).replace(/\.00$/, '')}%`;
  }

  const prev = revision.previousCtc ?? 0;
  const next = revision.newCtc ?? 0;
  if (!prev || !next) return null;

  const pct = ((next - prev) / prev) * 100;
  if (!Number.isFinite(pct)) return null;
  return `${pct >= 0 ? '+' : ''}${Math.round(pct * 100) / 100}%`;
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
  contract_start_date?: string | null;
  contract_end_date?  : string | null;
  contract_history?   : { start_date: string | null; end_date: string | null }[];
}

// CTC Components — shared across this page AND the Employee Letters page,
// both reading/writing the same backend collection, so a change made here
// is automatically visible everywhere else that fetches the same endpoint.
interface CTCComponentType {
  _id?: string;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
  show_in_documents: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API      = `${API_URL}/salary-revisions`;
// Employees now come from Onboarding — the single source of truth — instead
// of a separate Employee collection.
const EMP_API  = `${API_URL}/onboarding/eligible-employees`;
// Same endpoint the Employee Letters page reads from — one source of
// truth for CTC component definitions, edited from either place.
const CTC_API  = `${API_URL}/ctc-components/`;

const ACCENT = '#4f46e5';
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: '1px solid #e2e8f0' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (n: string) => n.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

const fmtDate = (d?: string|Date|null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }); }
  catch { return String(d); }
};

const fmtCurrency = (n?: number|null) => {
  if (n==null||isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN',{ style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
};

const get11MonthDate = (j: string): Date => {
  const d = new Date(j);
  return new Date(d.getFullYear(), d.getMonth()+11, d.getDate());
};

const anniversaryDateForYear = (j: string, year: number): Date => {
  const first = get11MonthDate(j);
  return new Date(year, first.getMonth(), first.getDate());
};

const isDueIn = (j: string, m: number, y: number) => {
  const first = get11MonthDate(j);
  if (m !== first.getMonth()) return false;
  const selDate   = new Date(y, m, 1);
  const firstDate = new Date(first.getFullYear(), first.getMonth(), 1);
  return selDate >= firstDate;
};

const isEligible = (j: string) => {
  const now=new Date(), joined=new Date(j);
  const months=(now.getFullYear()-joined.getFullYear())*12+(now.getMonth()-joined.getMonth());
  return months>=11;
};

// The annual review "clock" doesn't always run from the original joining
// date. Two things reset it:
//   1. A completed revision landing in the currently-expected due month
//      (an on-time annual review) — the next cycle then runs from THAT
//      revision's date, not the original joining date.
//   2. A PPO/intern-to-full-time conversion (fullTimeSince) — this always
//      resets the anchor regardless of timing, since that's genuinely
//      when the employee's real annual cycle starts.
// A revision landing outside the expected month (a mid-term/off-cycle
// adjustment) is skipped — it must NOT push next year's due date.
const computeAnchorDate = (joiningDate: string, revisions: SalaryRevision[]): Date => {
  const completed = revisions
    .filter(r => r.stage === 'completed')
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let anchor = new Date(joiningDate);

  for (const rev of completed) {
    if (rev.fullTimeSince) {
      anchor = new Date(rev.fullTimeSince);
      continue;
    }

    const revDate = rev.applicableDate ? new Date(rev.applicableDate) : new Date(rev.createdAt);
    const expectedMonth = get11MonthDate(anchor.toISOString()).getMonth();

    if (revDate.getMonth() === expectedMonth) {
      anchor = revDate;
    }
  }

  return anchor;
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

// Bidirectional %-to-amount conversion for the increment inputs — editing
// either the percentage slider or the target CTC amount field keeps the
// other one in sync, both derived off the same previous-CTC baseline.
const amountFromPct = (pct: number, base: number): number =>
  Math.round(base * (1 + pct / 100));

const pctFromAmount = (amount: number, base: number): number =>
  base > 0 ? Math.round(((amount - base) / base) * 1000) / 10 : 0;

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

function AddRevisionModal({ open, onClose, onAdded, showToast, employees, records }: {
  open:boolean; onClose:()=>void; onAdded:(r:SalaryRevision)=>void;
  showToast:(m:string,t:'success'|'error')=>void; employees:Employee[]; records:SalaryRevision[];
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
        contractStartDate:sel.contract_start_date||null, contractEndDate:sel.contract_end_date||null,
        category:cat, applicableDate:appDate||null,
        previousCtc:sel.annual_ctc||0,
        previousDesignation:sel.designation,
        previousReportingHead:sel.reporting_head||'',
        previousCategory:sel.employee_category||'Employee',
        pmsScores:pms.filter(p=>p.period.trim()),
      });
      if (data.success||data._id||data.data){ showToast('Revision created','success'); onAdded(data.data||data); onClose(); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Request failed','error'); }
    finally { setSaving(false); }
  };

  const due = sel?.joining_date
    ? get11MonthDate(computeAnchorDate(sel.joining_date, records.filter(r=>r.employeeCode===sel.employee_id)).toISOString())
    : null;

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
                    ['Due Date (11m)',fmtDate(due?.toISOString())],
                    ['Contract Start',fmtDate(sel.contract_start_date)],['Contract End',fmtDate(sel.contract_end_date)]
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

// ─── CTC Components View ───────────────────────────────────────────────────────
// Manages the same collection the Employee Letters page reads from — a
// change saved here shows up there (and anywhere else that fetches the
// same endpoint) immediately, since there's only ever one copy of this
// data. Restyled to match this page's own compact, MUI-based look
// instead of the old standalone dashboard's styling.

function CtcComponentsView({ onBack, showToast }: {
  onBack: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [components, setComponents] = useState<CTCComponentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<CTCComponentType>({
    name: '', code: '', formula: '0', order: 0, is_active: true, show_in_documents: true,
  });

  const fetchComponents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(CTC_API);
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setComponents(data.sort((a: CTCComponentType, b: CTCComponentType) => a.order - b.order));
    } catch (err) {
      showToast('Failed to load CTC components', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchComponents(); }, [fetchComponents]);

  const resetForm = () => {
    setEditingId(null);
    setFormOpen(false);
    setFormData({ name: '', code: '', formula: '0', order: components.length + 1, is_active: true, show_in_documents: true });
  };

  const startAdd = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', formula: '0', order: components.length + 1, is_active: true, show_in_documents: true });
    setFormOpen(true);
  };

  const startEdit = (comp: CTCComponentType) => {
    if (!comp._id) return;
    setEditingId(comp._id);
    setFormData(comp);
    setFormOpen(true);
  };

  const saveComponent = async () => {
    if (saving) return;
    if (!formData.name.trim() || !formData.code.trim()) {
      showToast('Name and Code are required', 'error');
      return;
    }
    if (!editingId && components.some(c => c.code.toUpperCase() === formData.code.toUpperCase())) {
      showToast('This code already exists — choose a unique one', 'error');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editingId;
      const method = isNew ? 'post' : 'patch';
      const url = isNew ? CTC_API : `${CTC_API}${editingId}/`;
      const payload = { ...formData, code: formData.code.toUpperCase().trim(), order: formData.order || components.length + 1 };

      const res = await (axios as any)[method](url, payload);
      const saved = res.data;

      if (isNew) setComponents(prev => [...prev, saved].sort((a, b) => a.order - b.order));
      else setComponents(prev => prev.map(c => (c._id === editingId ? saved : c)));

      showToast(isNew ? 'Component added' : 'Component updated', 'success');
      resetForm();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error saving component', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteComponent = async (id: string) => {
    if (!window.confirm('Delete this component permanently?')) return;
    try {
      await axios.delete(`${CTC_API}${id}/`);
      setComponents(prev => prev.filter(c => c._id !== id));
      showToast('Component deleted', 'success');
    } catch {
      showToast('Error deleting component', 'error');
    }
  };

  return (
    <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box flex={1}>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">CTC Components</Typography>
          <Typography fontSize={12} color="text.secondary">
            Shared across salary revisions, employee letters and payslips
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={startAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          Add Component
        </Button>
      </Box>

      {formOpen && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, mb: 2.5, outline: `2px solid ${ACCENT}` }}>
          <Typography fontWeight={700} fontSize={13} mb={2}>
            {editingId ? 'Edit Component' : 'New Component'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField size="small" label="Name" value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Internet Allowance" sx={{ flex: '1 1 200px' }} />
            <TextField size="small" label="Code (unique)" value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. INTERNET" helperText="Uppercase, no spaces" sx={{ flex: '1 1 180px' }} />
            <TextField size="small" label="Formula" value={formData.formula}
              onChange={e => setFormData({ ...formData, formula: e.target.value })}
              placeholder="e.g. BASIC * 0.4" sx={{ flex: '1 1 220px' }} />
            <TextField size="small" label="Order" type="number" value={formData.order}
              onChange={e => setFormData({ ...formData, order: Number(e.target.value) || 0 })}
              sx={{ flex: '0 1 100px' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                sx={{ color: ACCENT, '&.Mui-checked': { color: ACCENT } }} />}
              label={<Typography fontSize={12}>Active</Typography>} />
            <FormControlLabel
              control={<Checkbox size="small" checked={formData.show_in_documents}
                onChange={e => setFormData({ ...formData, show_in_documents: e.target.checked })}
                sx={{ color: ACCENT, '&.Mui-checked': { color: ACCENT } }} />}
              label={<Typography fontSize={12}>Show in Documents</Typography>} />
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={resetForm} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SaveIcon sx={{ fontSize: 15 }} />}
              onClick={saveComponent} disabled={saving}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 600 }}>
              {editingId ? 'Update' : 'Add'}
            </Button>
          </Box>
        </Paper>
      )}

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box>
        ) : components.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
            No components yet. Add one to get started.
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Order</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Formula</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">In Docs</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {components.map(comp => (
                  <TableRow key={comp._id} sx={{ '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={{ fontSize: 12 }}>{comp.order}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{comp.name}</TableCell>
                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary' }}>{comp.code}</TableCell>
                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comp.formula || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={comp.is_active ? 'Active' : 'Inactive'}
                        sx={{ fontSize: 10, height: 20, bgcolor: comp.is_active ? '#f0fdf4' : '#fef2f2', color: comp.is_active ? '#059669' : '#dc2626' }} />
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: 13 }}>{comp.show_in_documents ? '✓' : '—'}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center" spacing={0.5}>
                        <IconButton size="small" onClick={() => startEdit(comp)} sx={{ color: ACCENT }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => comp._id && deleteComponent(comp._id)} sx={{ color: '#dc2626' }}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Typography fontSize={11} color="text.secondary" mt={2} textAlign="center">
        Changes here apply immediately to salary revisions, employee letters and any other page reading this same data.
      </Typography>
    </Box>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, employees, loading, onSelect, onAdd, onManageCtc }: {
  records:SalaryRevision[]; employees:Employee[]; loading:boolean;
  onSelect:(emp:Employee,rec?:SalaryRevision)=>void; onAdd:()=>void; onManageCtc:()=>void;
}) {
  const now=new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [showAll,  setShowAll]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [dept,     setDept]     = useState('All');
  const [stage,    setStage]    = useState('All');
  const [historyAnchor, setHistoryAnchor] = useState<{ el:HTMLElement; emp:Employee }|null>(null);

  // Every revision an employee has ever had, newest first (records already
  // arrive sorted that way) — NOT collapsed to just the latest, because a
  // "completed" revision from a past cycle must not shadow a new cycle
  // that's now due (e.g. last year's completed revision shouldn't make an
  // employee whose annual review is due again this year look "done").
  const revisionMap = useMemo(()=>{
    const m=new Map<string,SalaryRevision[]>();
    records.forEach(r=>{
      const arr=m.get(r.employeeCode)||[];
      arr.push(r);
      m.set(r.employeeCode, arr);
    });
    return m;
  },[records]);

  // The revision (if any) that belongs to a given due-cycle year, identified
  // by when it was created. If an employee's only revision is from an
  // earlier year than the cycle being viewed, this returns undefined —
  // which the UI already renders as "No Record" / "Pending", correctly
  // prompting a fresh revision instead of showing the stale old one.
  const revisionForYear = useCallback((employeeId:string, year:number): SalaryRevision|undefined => {
    const list = revisionMap.get(employeeId) || [];
    return list.find(r => new Date(r.createdAt).getFullYear() === year);
  }, [revisionMap]);

  // Per-employee "cycle anchor" — normally the joining date, but reset by
  // an on-time annual revision or a PPO conversion (see computeAnchorDate).
  // Every "due"/"eligible"/"pending" check below reads this instead of the
  // raw joining date, so mid-term adjustments and intern→full-time
  // conversions no longer get misjudged against the original DOJ.
  const anchorDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    employees.forEach(e => {
      if (!e.joining_date) return;
      const revs = revisionMap.get(e.employee_id) || [];
      map.set(e.employee_id, computeAnchorDate(e.joining_date, revs));
    });
    return map;
  }, [employees, revisionMap]);

  const eligibleEmps = useMemo(()=>employees.filter(e=>{
    // Interns aren't gated by the 11-month annual-review cadence — a PPO
    // decision can come up at any point during an internship, well
    // before 11 months, so hiding them until then would block HR from
    // ever starting that conversion.
    if (e.employee_category === 'Intern') return true;
    if (!e.joining_date) return false;
    // "Eligible as of TODAY" only matters for the Show All view. When
    // browsing a specific month/year, isDueIn (applied below in
    // `filtered`) already correctly checks whether that employee's due
    // month has been reached BY THE SELECTED month/year — including
    // months later this year that haven't happened yet. Gating on
    // "today" here would wrongly hide someone due in an upcoming month
    // just because today hasn't reached their 11-month mark yet.
    if (!showAll) return true;
    const anchor = anchorDateMap.get(e.employee_id);
    return anchor && isEligible(anchor.toISOString());
  }),[employees, anchorDateMap, showAll]);

  const allEmps = eligibleEmps;
  const depts=['All',...Array.from(new Set(allEmps.map(e=>e.department).filter(Boolean)))];

  const cycleYear = showAll ? now.getFullYear() : selYear;

  const filtered=useMemo(()=>allEmps.filter(e=>{
    if (!e.joining_date) return false;
    const rec=revisionForYear(e.employee_id, cycleYear);
    const anchor=anchorDateMap.get(e.employee_id);
    // Interns bypass the due-month filter too — same reasoning as the
    // eligibility gate above, they need to be findable for a PPO decision
    // regardless of which month is currently selected.
    const monthOk=showAll||e.employee_category==='Intern'||(!!anchor&&isDueIn(anchor.toISOString(),selMonth,selYear));
    const searchOk=!search||e.full_name.toLowerCase().includes(search.toLowerCase());
    const deptOk=dept==='All'||e.department===dept;
    const stageOk=stage==='All'?true:stage==='no_record'?!rec:rec?.stage===stage;
    return monthOk&&searchOk&&deptOk&&stageOk;
  }),[allEmps,showAll,selMonth,selYear,search,dept,stage,cycleYear,revisionForYear,anchorDateMap]);

  const stats={
    due:filtered.length,
    noRec:filtered.filter(e=>!revisionForYear(e.employee_id, cycleYear)).length,
    pending:filtered.filter(e=>{ const r=revisionForYear(e.employee_id, cycleYear); return r&&r.stage!=='completed'; }).length,
    completed:filtered.filter(e=>revisionForYear(e.employee_id, cycleYear)?.stage==='completed').length,
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
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<SettingsIcon sx={{ fontSize: 16 }} />} onClick={onManageCtc} size="small"
            sx={{ textTransform:'none', fontWeight:600, borderRadius: 1.5, borderColor: '#e2e8f0', color: '#475569' }}>
            CTC Components
          </Button>
          <Button variant="contained" startIcon={<AddIcon/>} onClick={onAdd} size="small"
            sx={{ bgcolor:ACCENT, textTransform:'none', fontWeight:600, borderRadius: 1.5, '&:hover':{ bgcolor:'#4338ca' } }}>
            Add Revision
          </Button>
        </Stack>
      </Box>

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
                  <TableCell>Contract</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length===0&&(
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py:6, color:'text.secondary', fontSize:13 }}>
                    {showAll?'No eligible employees found':`No employees due in ${MONTHS[selMonth]} ${selYear}`}
                  </TableCell></TableRow>
                )}
                {filtered.map(emp=>{
                  const rec=revisionForYear(emp.employee_id, cycleYear);
                  const anchor=anchorDateMap.get(emp.employee_id);
                  const anchorIso=anchor?anchor.toISOString():emp.joining_date!;
                  const dueDate=showAll
                    ? anniversaryDateForYear(anchorIso, now.getFullYear())
                    : anniversaryDateForYear(anchorIso, selYear);
                  const isThisMonth=isDueIn(anchorIso,now.getMonth(),now.getFullYear());
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
                        {emp.employee_category==='Intern' ? (
                          <Chip label="PPO Review" size="small" sx={{ bgcolor:'#eef2ff', color:ACCENT, fontSize:10 }}/>
                        ) : (
                          <Typography component="span" fontSize={12} fontWeight={isThisMonth?700:400} color={isThisMonth?'#d97706':'inherit'}>
                            {fmtDate(dueDate.toISOString())}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize:12 }}>{fmtCurrency(rec?.previousCtc ?? emp.annual_ctc)}</TableCell>
                      <TableCell>
                        {rec?<DecisionChip decision={rec.managerDecision?.decision}/>
                          :<Chip label="No Record" size="small" sx={{ bgcolor:'#fef2f2', color:'#dc2626', fontSize:10 }}/>}
                      </TableCell>
                      <TableCell sx={{ fontSize:12, fontWeight:600, color:'#059669' }}>{rec?fmtCurrency(rec.newCtc):'—'}</TableCell>
                      <TableCell>
                        {rec?<StageChip stage={rec.stage}/>
                          :<Chip label="Pending" size="small" sx={{ bgcolor:'#fffbeb', color:'#d97706', fontSize:10 }}/>}
                      </TableCell>
                      <TableCell sx={{ fontSize:12 }}>
                        {emp.contract_start_date ? (
                          <>
                            {fmtDate(emp.contract_start_date)} → {emp.contract_end_date?fmtDate(emp.contract_end_date):'Ongoing'}
                            {(emp.contract_history?.length||0)>1 && (
                              <Typography component="span" onClick={(e)=>{ e.stopPropagation(); setHistoryAnchor({ el:e.currentTarget, emp }); }}
                                sx={{ display:'block', fontSize:11, color:ACCENT, cursor:'pointer', fontWeight:600, '&:hover':{ textDecoration:'underline' } }}>
                                Previous Contract
                              </Typography>
                            )}
                          </>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Popover
        open={!!historyAnchor}
        anchorEl={historyAnchor?.el}
        onClose={()=>setHistoryAnchor(null)}
        anchorOrigin={{ vertical:'bottom', horizontal:'left' }}
        onClick={(e)=>e.stopPropagation()}
      >
        <Box sx={{ p:2, minWidth:260, maxWidth:340 }}>
          <Typography fontSize={12} fontWeight={700} mb={1}>
            {historyAnchor?.emp.full_name} — Contract History
          </Typography>
          <Stack spacing={0.75}>
            {(historyAnchor?.emp.contract_history||[]).map((p,i,arr)=>{
              const isLatest=i===arr.length-1;
              return (
                <Box key={i} sx={{ display:'flex', justifyContent:'space-between', gap:2, p:0.75,
                  bgcolor:isLatest?'#f0fdf4':'#f8fafc', borderRadius:1 }}>
                  <Typography fontSize={11} color={isLatest?'#059669':'text.secondary'} fontWeight={isLatest?600:400}>
                    Contract {i+1}{isLatest?' (current)':''}
                  </Typography>
                  <Typography fontSize={11} fontWeight={500} textAlign="right">
                    {fmtDate(p.start_date)} → {p.end_date?fmtDate(p.end_date):'Ongoing'}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({ employeeCode }: { employeeCode: string }) {
  const [history, setHistory] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<SalaryRevision | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<any>({
    applicableDate: '',
    previousCtc: '',
    newCtc: '',
    finalIncrementPct: '',
    stage: 'pending_manager',
    designationChanged: false,
    previousDesignation: '',
    newDesignation: '',
    reportingHeadChanged: false,
    previousReportingHead: '',
    newReportingHead: '',
    managerDecision: {
      decision: 'increment',
      recommendedPct: '',
      reason: '',
      pipDurationMonths: '',
      pipNewDueDate: '',
    },
    managementDecision: {
      finalPct: '',
      reason: '',
      pipApproved: true,
    },
    hrDecision: {
      newContractStartDate: '',
      newContractEndDate: '',
      notes: '',
    },
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!selectedRevision) return;
    setEditMode(false);
    setEditError(null);
    setEditValues({
      applicableDate: selectedRevision.applicableDate ? new Date(selectedRevision.applicableDate).toISOString().split('T')[0] : '',
      previousCtc: selectedRevision.previousCtc != null ? String(selectedRevision.previousCtc) : '',
      newCtc: selectedRevision.newCtc != null ? String(selectedRevision.newCtc) : '',
      finalIncrementPct: selectedRevision.finalIncrementPct != null ? String(selectedRevision.finalIncrementPct) : '',
      stage: selectedRevision.stage,
      designationChanged: selectedRevision.designationChanged,
      previousDesignation: selectedRevision.previousDesignation || '',
      newDesignation: selectedRevision.newDesignation || '',
      reportingHeadChanged: selectedRevision.reportingHeadChanged,
      previousReportingHead: selectedRevision.previousReportingHead || '',
      newReportingHead: selectedRevision.newReportingHead || '',
      managerDecision: {
        decision: selectedRevision.managerDecision?.decision || 'increment',
        recommendedPct: selectedRevision.managerDecision?.recommendedPct != null ? String(selectedRevision.managerDecision.recommendedPct) : '',
        reason: selectedRevision.managerDecision?.reason || '',
        pipDurationMonths: selectedRevision.managerDecision?.pipDurationMonths != null ? String(selectedRevision.managerDecision.pipDurationMonths) : '',
        pipNewDueDate: selectedRevision.managerDecision?.pipNewDueDate ? new Date(selectedRevision.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '',
      },
      managementDecision: {
        finalPct: selectedRevision.managementDecision?.finalPct != null ? String(selectedRevision.managementDecision.finalPct) : '',
        reason: selectedRevision.managementDecision?.reason || '',
        pipApproved: selectedRevision.managementDecision?.pipApproved ?? true,
      },
      hrDecision: {
        newContractStartDate: selectedRevision.hrDecision?.newContractStartDate ? new Date(selectedRevision.hrDecision.newContractStartDate).toISOString().split('T')[0] : '',
        newContractEndDate: selectedRevision.hrDecision?.newContractEndDate ? new Date(selectedRevision.hrDecision.newContractEndDate).toISOString().split('T')[0] : '',
        notes: selectedRevision.hrDecision?.notes || '',
      },
    });
  }, [selectedRevision]);

  // Add this as a NEW useEffect, after the existing one


  const savePastIncrement = async () => {
    if (!selectedRevision) return;
    setEditError(null);
    const payload: any = {
      applicableDate: editValues.applicableDate || null,
      previousCtc: editValues.previousCtc !== '' ? Number(editValues.previousCtc) : undefined,
      newCtc: editValues.newCtc !== '' ? Number(editValues.newCtc) : undefined,
      finalIncrementPct: editValues.finalIncrementPct !== '' ? Number(editValues.finalIncrementPct) : undefined,
      stage: editValues.stage,
      designationChanged: editValues.designationChanged,
      previousDesignation: editValues.previousDesignation,
      newDesignation: editValues.newDesignation,
      reportingHeadChanged: editValues.reportingHeadChanged,
      previousReportingHead: editValues.previousReportingHead,
      newReportingHead: editValues.newReportingHead,
      managerDecision: {
        decision: editValues.managerDecision.decision,
        recommendedPct: editValues.managerDecision.recommendedPct !== '' ? Number(editValues.managerDecision.recommendedPct) : null,
        reason: editValues.managerDecision.reason,
        pipDurationMonths: editValues.managerDecision.pipDurationMonths !== '' ? Number(editValues.managerDecision.pipDurationMonths) : null,
        pipNewDueDate: editValues.managerDecision.pipNewDueDate || null,
      },
      managementDecision: {
        finalPct: editValues.managementDecision.finalPct !== '' ? Number(editValues.managementDecision.finalPct) : null,
        reason: editValues.managementDecision.reason,
        pipApproved: editValues.managementDecision.pipApproved,
      },
      hrDecision: {
        newContractStartDate: editValues.hrDecision.newContractStartDate || null,
        newContractEndDate: editValues.hrDecision.newContractEndDate || null,
        notes: editValues.hrDecision.notes || '',
      },
    };

    if (payload.previousCtc != null && Number.isNaN(payload.previousCtc)) {
      setEditError('Enter a valid previous CTC amount.');
      return;
    }
    if (payload.newCtc != null && Number.isNaN(payload.newCtc)) {
      setEditError('Enter a valid new CTC amount.');
      return;
    }
    if (payload.finalIncrementPct != null && Number.isNaN(payload.finalIncrementPct)) {
      setEditError('Enter a valid increment percentage.');
      return;
    }
    if (payload.managerDecision.recommendedPct != null && Number.isNaN(payload.managerDecision.recommendedPct)) {
      setEditError('Enter a valid manager recommended percentage.');
      return;
    }
    if (payload.managementDecision.finalPct != null && Number.isNaN(payload.managementDecision.finalPct)) {
      setEditError('Enter a valid management final percentage.');
      return;
    }

    setSaveBusy(true);
    try {
      const { data } = await axios.put(`${API}/${selectedRevision._id}`, payload);
      if (!data.success) {
        throw new Error(data.message || 'Save failed');
      }

      const updatedRevision = { ...selectedRevision, ...data.data } as SalaryRevision;
      setSelectedRevision(updatedRevision);
      setHistory((prev) => prev.map((item) => item._id === updatedRevision._id ? updatedRevision : item));
      setEditMode(false);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    if (selectedRevision) {
      setEditValues((prev: any) => ({
        ...prev,
        applicableDate: selectedRevision.applicableDate ? new Date(selectedRevision.applicableDate).toISOString().split('T')[0] : '',
        previousCtc: selectedRevision.previousCtc != null ? String(selectedRevision.previousCtc) : '',
        newCtc: selectedRevision.newCtc != null ? String(selectedRevision.newCtc) : '',
        finalIncrementPct: selectedRevision.finalIncrementPct != null ? String(selectedRevision.finalIncrementPct) : '',
        stage: selectedRevision.stage,
        designationChanged: selectedRevision.designationChanged,
        previousDesignation: selectedRevision.previousDesignation || '',
        newDesignation: selectedRevision.newDesignation || '',
        reportingHeadChanged: selectedRevision.reportingHeadChanged,
        previousReportingHead: selectedRevision.previousReportingHead || '',
        newReportingHead: selectedRevision.newReportingHead || '',
        managerDecision: {
          decision: selectedRevision.managerDecision?.decision || 'increment',
          recommendedPct: selectedRevision.managerDecision?.recommendedPct != null ? String(selectedRevision.managerDecision.recommendedPct) : '',
          reason: selectedRevision.managerDecision?.reason || '',
          pipDurationMonths: selectedRevision.managerDecision?.pipDurationMonths != null ? String(selectedRevision.managerDecision.pipDurationMonths) : '',
          pipNewDueDate: selectedRevision.managerDecision?.pipNewDueDate ? new Date(selectedRevision.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '',
        },
        managementDecision: {
          finalPct: selectedRevision.managementDecision?.finalPct != null ? String(selectedRevision.managementDecision.finalPct) : '',
          reason: selectedRevision.managementDecision?.reason || '',
          pipApproved: selectedRevision.managementDecision?.pipApproved ?? true,
        },
        hrDecision: {
          newContractStartDate: selectedRevision.hrDecision?.newContractStartDate ? new Date(selectedRevision.hrDecision.newContractStartDate).toISOString().split('T')[0] : '',
          newContractEndDate: selectedRevision.hrDecision?.newContractEndDate ? new Date(selectedRevision.hrDecision.newContractEndDate).toISOString().split('T')[0] : '',
          notes: selectedRevision.hrDecision?.notes || '',
        },
      }));
      setEditError(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    // Fetch revisions and the onboarding record so we can compute the
    // effective contract period for each revision. We prefer HR-finalised
    // dates, then any revision-level dates, then fall back to the
    // onboarding `contractHistory` entry that covered the revision's
    // `createdAt` timestamp. Finally sort by that effective start date
    // descending so the newest contract period appears first.
    Promise.all([
      axios.get(`${API}/history/${employeeCode}`),
      axios.get(`${API_URL}/onboarding/${employeeCode}`),
    ])
      .then(([revRes, onbRes]) => {
        const items = revRes.data?.data ?? [];
        const onb = onbRes.data?.data || null;
        const hist = Array.isArray(onb?.contractHistory) ? onb.contractHistory.map((p: any) => ({
          start: p.startDate ? new Date(p.startDate) : null,
          end: p.endDate ? new Date(p.endDate) : null,
        })) : [];

        const findHistoryForDate = (d: Date | null) => {
          if (!d) return null;
          for (let i = hist.length - 1; i >= 0; i--) {
            const entry = hist[i];
            if (!entry.start) continue;
            if (entry.start <= d && (!entry.end || entry.end >= d)) return entry;
          }
          return hist[hist.length - 1] ?? null;
        };

        const enriched = items.map((it: any) => {
          const created = it.createdAt ? new Date(it.createdAt) : null;
          const hrStart = it.hrDecision?.newContractStartDate ? new Date(it.hrDecision.newContractStartDate) : null;
          const hrEnd   = it.hrDecision?.newContractEndDate ? new Date(it.hrDecision.newContractEndDate) : null;
          const revStart = it.newContractStartDate ? new Date(it.newContractStartDate) : (it.contractStartDate ? new Date(it.contractStartDate) : null);
          const revEnd   = it.newContractEndDate ? new Date(it.newContractEndDate) : (it.contractEndDate ? new Date(it.contractEndDate) : null);

          const histMatch = findHistoryForDate(created);
          const periodStart = hrStart || revStart || histMatch?.start || (it.applicableDate ? new Date(it.applicableDate) : null) || created;
          const periodEnd   = hrEnd   || revEnd   || histMatch?.end || null;

          return { ...it, _periodStart: periodStart, _periodEnd: periodEnd };
        });

        enriched.sort((a: any, b: any) => {
          const aT = a._periodStart ? new Date(a._periodStart).getTime() : 0;
          const bT = b._periodStart ? new Date(b._periodStart).getTime() : 0;
          return bT - aT;
        });

        setHistory(enriched as SalaryRevision[]);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [employeeCode]);

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24}/></Box>;
  if (!history.length) return <Typography fontSize={12} color="text.secondary">No past revisions for this employee.</Typography>;

  return (
    <>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': TH }}>
                <TableCell>Contract Period</TableCell>
                <TableCell>Decision</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Reporting Head</TableCell>
                <TableCell>CTC</TableCell>
                <TableCell>Stage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h, i) => {
                const contractStart = h._periodStart || (h.newContractStartDate ? new Date(h.newContractStartDate) : (h.contractStartDate ? new Date(h.contractStartDate) : null));
                const contractEnd = h._periodEnd || (h.newContractEndDate ? new Date(h.newContractEndDate) : (h.contractEndDate ? new Date(h.contractEndDate) : null));
                return (
                  <TableRow key={h._id}
                    onClick={() => setSelectedRevision(h)}
                    sx={{ cursor: 'pointer', bgcolor: i === 0 ? '#f8fafc' : 'transparent', '&:hover': { bgcolor: '#eef2ff' } }}>
                    <TableCell sx={{ fontSize: 12 }}>
                      {contractStart
                        ? <>{fmtDate(contractStart)} → {contractEnd ? fmtDate(contractEnd) : 'Ongoing'}</>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                      {i === 0 && <Chip label="Latest" size="small" sx={{ ml: 0.7, fontSize: 9, height: 16, bgcolor: '#eef2ff', color: ACCENT }}/> }
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
                    {formatIncrementPct(h) && (
                      <Typography component="span" sx={{ display: 'block', fontSize: 11, color: '#475569', mt: 0.3 }}>
                        {formatIncrementPct(h)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><StageChip stage={h.stage}/></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Modal open={!!selectedRevision} onClose={() => setSelectedRevision(null)}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:{ xs:'95vw', sm:640 }, maxHeight:'85vh', overflowY:'auto', bgcolor:'white', borderRadius:2, p:3, outline:'none' }}>
          <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2 }}>
            <Box>
              <Typography fontSize={16} fontWeight={700}>Past Contract Details</Typography>
              <Typography fontSize={12} color="text.secondary">Click outside or the close button to dismiss.</Typography>
            </Box>
            <IconButton size="small" onClick={() => setSelectedRevision(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          {selectedRevision && (
            <Stack spacing={1.25}>
              <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.5, mb:1 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Contract Period</Typography>
                  <Typography fontSize={13} fontWeight={600}>
                    {selectedRevision._periodStart ? fmtDate(selectedRevision._periodStart as any as string) : '—'} → {selectedRevision._periodEnd ? fmtDate(selectedRevision._periodEnd as any as string) : 'Ongoing'}
                  </Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Applicable Date</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtDate(selectedRevision.applicableDate)}</Typography>
                </Box>
              </Box>

              <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Previous CTC</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtCurrency(selectedRevision.previousCtc)}</Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">New CTC</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtCurrency(selectedRevision.newCtc)}</Typography>
                </Box>
              </Box>

              {editMode ? (
                <Box sx={{ mt: 1, display: 'grid', gap: 1 }}> 
                  <TextField
                    label="Applicable Date"
                    size="small"
                    type="date"
                    value={editValues.applicableDate}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, applicableDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Previous CTC"
                    size="small"
                    value={editValues.previousCtc}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, previousCtc: e.target.value }))}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <TextField
                    label="New CTC"
                    size="small"
                    value={editValues.newCtc}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, newCtc: e.target.value }))}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <TextField
                    label="Increment %"
                    size="small"
                    value={editValues.finalIncrementPct}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, finalIncrementPct: e.target.value }))}
                    inputProps={{ inputMode: 'decimal' }}
                  />
                  <TextField
                    label="New Designation"
                    size="small"
                    value={editValues.newDesignation}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, newDesignation: e.target.value, designationChanged: true }))}
                  />
                  <TextField
                    label="New Reporting Head"
                    size="small"
                    value={editValues.newReportingHead}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, newReportingHead: e.target.value, reportingHeadChanged: true }))}
                  />
                  <TextField
                    label="HR Contract Start"
                    size="small"
                    type="date"
                    value={editValues.hrDecision.newContractStartDate}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, hrDecision: { ...prev.hrDecision, newContractStartDate: e.target.value } }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="HR Contract End"
                    size="small"
                    type="date"
                    value={editValues.hrDecision.newContractEndDate}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, hrDecision: { ...prev.hrDecision, newContractEndDate: e.target.value } }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="HR Notes"
                    size="small"
                    multiline
                    rows={3}
                    value={editValues.hrDecision.notes}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, hrDecision: { ...prev.hrDecision, notes: e.target.value } }))}
                  />
                  {editError && <Typography fontSize={12} color="error">{editError}</Typography>}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="contained" onClick={savePastIncrement} disabled={saveBusy}>
                      Save
                    </Button>
                    <Button size="small" variant="outlined" onClick={cancelEdit} disabled={saveBusy}>
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                formatIncrementPct(selectedRevision) && (
                  <Box sx={{ mt: 1 }}>
                    <Typography fontSize={11} color="text.secondary">Increment %</Typography>
                    <Typography fontSize={13} fontWeight={600} color="#059669">
                      {formatIncrementPct(selectedRevision)}
                    </Typography>
                  </Box>
                )
              )}

              <Divider />

              <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', alignItems:'center' }}>
                <Typography fontSize={11} color="text.secondary">Decision</Typography>
                <Typography fontSize={13} fontWeight={600}>{selectedRevision.managerDecision?.decision ? selectedRevision.managerDecision.decision.toUpperCase() : 'Pending'}</Typography>
                <Button size="small" variant="outlined" onClick={() => setEditMode(true)}>
                  Edit Increment
                </Button>
              </Box>
              {selectedRevision.managerDecision?.reason && (
                <Typography fontSize={12} color="text.secondary">Reason: {selectedRevision.managerDecision.reason}</Typography>
              )}

              <Box>
                <Typography fontSize={11} color="text.secondary">Stage</Typography>
                <StageChip stage={selectedRevision.stage} />
              </Box>

              <Divider />

              <Box>
                <Typography fontSize={11} color="text.secondary">Designation Change</Typography>
                {selectedRevision.designationChanged ? (
                  <Typography fontSize={13} fontWeight={600}>{selectedRevision.previousDesignation || '—'} → {selectedRevision.newDesignation || '—'}</Typography>
                ) : (
                  <Typography fontSize={12} color="text.secondary">No change</Typography>
                )}
              </Box>

              <Box>
                <Typography fontSize={11} color="text.secondary">Reporting Head Change</Typography>
                {selectedRevision.reportingHeadChanged ? (
                  <Typography fontSize={13} fontWeight={600}>{selectedRevision.previousReportingHead || '—'} → {selectedRevision.newReportingHead || '—'}</Typography>
                ) : (
                  <Typography fontSize={12} color="text.secondary">No change</Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography fontSize={11} color="text.secondary">HR Contract Dates</Typography>
                <Typography fontSize={13} fontWeight={600}>Start: {fmtDate(selectedRevision.hrDecision?.newContractStartDate)}</Typography>
                <Typography fontSize={13} fontWeight={600}>End: {fmtDate(selectedRevision.hrDecision?.newContractEndDate)}</Typography>
              </Box>

              <Box>
                <Typography fontSize={11} color="text.secondary">HR Notes</Typography>
                <Typography fontSize={12} color="text.secondary">{selectedRevision.hrDecision?.notes || '—'}</Typography>
              </Box>

              <Box>
                <Typography fontSize={11} color="text.secondary">Created On</Typography>
                <Typography fontSize={13} fontWeight={600}>{fmtDate(selectedRevision.createdAt)}</Typography>
              </Box>
            </Stack>
          )}
        </Box>
      </Modal>
    </>
  );
}

// ─── Revision Detail / Action View ───────────────────────────────────────────────────────────

function RevisionDetailView({ emp, rec, onBack, onRecordChange, showToast }: {
  emp          : Employee;
  rec          : SalaryRevision | undefined;
  onBack       : () => void;
  onRecordChange:(r: SalaryRevision) => void;
  showToast    : (m:string,t:'success'|'error')=>void;
}) {
  const [tab, setTab] = useState(0);

  // Computed once up front — both the % and $ increment inputs below need
  // this same baseline to stay in sync with each other.
  const prevCtc = rec?.previousCtc ?? emp.annual_ctc ?? 0;

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

  // Target CTC amount — a second, equally-editable way to express the same
  // increment as mgrPct/mgmtPct. Editing either one recalculates the
  // other off the same previous-CTC baseline; the percentage remains the
  // single value actually sent to the backend (recommendedPct/finalPct),
  // this amount field is purely a convenience alternative for entering it.
  const [mgrAmount, setMgrAmount] = useState<number>(
    amountFromPct(rec?.managerDecision?.recommendedPct ?? mgrPct, prevCtc)
  );

  const handleMgrPctChange = (pct: number) => {
    setMgrPct(pct);
    setMgrAmount(amountFromPct(pct, prevCtc));
  };
  const handleMgrAmountChange = (amount: number) => {
    setMgrAmount(amount);
    setMgrPct(pctFromAmount(amount, prevCtc));
  };

  const [changeDesignation, setChangeDesignation] = useState(rec?.designationChanged ?? false);
  const [newDesignation,    setNewDesignation]    = useState(rec?.newDesignation || '');

  const [changeHead, setChangeHead] = useState(rec?.reportingHeadChanged ?? false);
  const [newHead,    setNewHead]    = useState(rec?.newReportingHead || '');

  const [mgmtPct,       setMgmtPct]       = useState(rec?.managementDecision?.finalPct??mgrPct);
  const [mgmtReason,    setMgmtReason]    = useState(rec?.managementDecision?.reason||'');
  const [pipApproved,   setPipApproved]   = useState(rec?.managementDecision?.pipApproved??true);

  const [mgmtAmount, setMgmtAmount] = useState<number>(
    amountFromPct(rec?.managementDecision?.finalPct ?? mgmtPct, prevCtc)
  );

  const handleMgmtPctChange = (pct: number) => {
    setMgmtPct(pct);
    setMgmtAmount(amountFromPct(pct, prevCtc));
  };
  const handleMgmtAmountChange = (amount: number) => {
    setMgmtAmount(amount);
    setMgmtPct(pctFromAmount(amount, prevCtc));
  };

  const [hrNotes,       setHrNotes]       = useState(rec?.hrDecision?.notes||'');
  const [hrAppDate,     setHrAppDate]     = useState(
    rec?.hrDecision?.applicableDate
      ? new Date(rec.hrDecision.applicableDate).toISOString().split('T')[0]
      : applicableDate);
  const [hrNewContractStart, setHrNewContractStart] = useState(
    rec?.hrDecision?.newContractStartDate
      ? new Date(rec.hrDecision.newContractStartDate).toISOString().split('T')[0]
      : '');
  const [hrNewContractEnd,   setHrNewContractEnd]   = useState(
    rec?.hrDecision?.newContractEndDate
      ? new Date(rec.hrDecision.newContractEndDate).toISOString().split('T')[0]
      : '');
  const [hrFullTimeSince,    setHrFullTimeSince]     = useState(
    rec?.hrDecision?.fullTimeSince
      ? new Date(rec.hrDecision.fullTimeSince).toISOString().split('T')[0]
      : '');

  // Only relevant when this revision is a PPO / intern-to-full-time
  // conversion — i.e. the category actually changed and the new category
  // is a full-time Employee, converting from Intern/Contract Based.
  const isPpoConversion = !!rec?.categoryChanged && rec?.newCategory === 'Employee'
    && ['Intern', 'Contract Based'].includes(rec?.previousCategory || '');

  const [pipOutcomeChoice, setPipOutcomeChoice] = useState<'improved'|'not_improved'>('improved');
  const [pipOutcomeReason, setPipOutcomeReason] = useState('');

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
          contractStartDate: emp.contract_start_date||null,
          contractEndDate  : emp.contract_end_date||null,
          category,
          applicableDate: applicableDate || null,
          previousCtc   : emp.annual_ctc || 0,
          previousDesignation: emp.designation,
          previousReportingHead: (emp as any).reporting_head || '',
          previousCategory: emp.employee_category || 'Employee',
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
      const payload={
        notes:hrNotes, applicableDate:hrAppDate||null, newCtc,
        newContractStartDate:hrNewContractStart||null, newContractEndDate:hrNewContractEnd||null,
        fullTimeSince: isPpoConversion ? (hrFullTimeSince||null) : null,
      };
      const { data }=await axios.put(`${API}/${rec._id}/hr`,payload);
      if (data.success){ showToast('HR decision saved — revision completed, Onboarding updated','success'); onRecordChange(data.data); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Failed','error'); }
    finally { setBusy(false); }
  };

  // Lets HR kick off an additional revision for this same employee even
  // though a completed one already exists for this cycle — needed when an
  // off-cycle/contract-linked increment comes up separately from the
  // annual review that's already been finalised. The old completed
  // revision stays exactly as-is in History; this just creates a new one.
  const startNewRevision = async () => {
    if (!window.confirm('Start a new salary revision for this employee? The completed one stays in history.')) return;
    setBusy(true);
    try {
      const { data } = await axios.post(API, {
        onboardingId: emp._id,
        employeeCode: emp.employee_id,
        employeeName: emp.full_name,
        department: emp.department,
        designation: emp.designation,
        email: emp.official_email,
        joiningDate: emp.joining_date,
        contractStartDate: emp.contract_start_date || null,
        contractEndDate: emp.contract_end_date || null,
        category: emp.employee_category || 'Employee',
        applicableDate: null,
        previousCtc: emp.annual_ctc || 0,
        previousDesignation: emp.designation,
        previousReportingHead: (emp as any).reporting_head || '',
        previousCategory: emp.employee_category || 'Employee',
        pmsScores: [],
      });
      const created = data?.data || data;
      if (created?._id) { showToast('New revision started', 'success'); onRecordChange(created); }
      else showToast(data.message || 'Failed to start new revision', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const postPipOutcome = async () => {
    if (!pipOutcomeReason.trim()) return showToast('Provide a reason', 'error');
    if (!rec) return;
    setBusy(true);
    try {
      const { data } = await axios.put(`${API}/${rec._id}/pip-outcome`, {
        outcome: pipOutcomeChoice, reason: pipOutcomeReason,
      });
      if (data.success) { showToast('PIP outcome recorded', 'success'); onRecordChange(data.data); }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const FlowBanner=()=>{
    if (isCompleted && rec?.pipOutcome) {
      return (
        <Alert severity={rec.pipOutcome==='improved'?'success':'error'} sx={{ mb:2, fontSize:12 }}>
          PIP closed out — {rec.pipOutcome==='improved'?'employee improved':'employee did not improve'}
          {rec.pipOutcomeDate?` on ${fmtDate(rec.pipOutcomeDate)}`:''}.
        </Alert>
      );
    }
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
        {isCompleted&&(
          <Button size="small" variant="outlined" onClick={startNewRevision} disabled={busy}
            sx={{ textTransform:'none', fontWeight:600, borderColor: ACCENT, color: ACCENT }}>
            {busy?<CircularProgress size={16}/>:'Start New Revision'}
          </Button>
        )}
      </Box>

      <FlowBanner/>

      {isOnHold && (
        <Paper variant="outlined" sx={{ borderRadius:2, p:2.5, mb:2.5, borderColor:'#fde68a', bgcolor:'#fffbeb' }}>
          <Typography fontWeight={700} fontSize={13} mb={1.5}>Close Out PIP</Typography>
          <Stack spacing={1.5}>
            <Box sx={{ display:'flex', gap:1.5 }}>
              <Button variant={pipOutcomeChoice==='improved'?'contained':'outlined'} size="small"
                onClick={()=>setPipOutcomeChoice('improved')}
                sx={{ textTransform:'none', bgcolor:pipOutcomeChoice==='improved'?'#059669':'transparent',
                  color:pipOutcomeChoice==='improved'?'white':'#059669', borderColor:'#059669' }}>Improved</Button>
              <Button variant={pipOutcomeChoice==='not_improved'?'contained':'outlined'} size="small"
                onClick={()=>setPipOutcomeChoice('not_improved')}
                sx={{ textTransform:'none', bgcolor:pipOutcomeChoice==='not_improved'?'#dc2626':'transparent',
                  color:pipOutcomeChoice==='not_improved'?'white':'#dc2626', borderColor:'#dc2626' }}>Not Improved</Button>
            </Box>
            <TextField label="Reason / Comments *" multiline rows={2} size="small"
              value={pipOutcomeReason} onChange={e=>setPipOutcomeReason(e.target.value)} fullWidth/>
            <Box>
              <Button variant="contained" onClick={postPipOutcome} disabled={busy||!pipOutcomeReason.trim()}
                sx={{ bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none', fontWeight:600 }}>
                {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit PIP Outcome'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

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
                ['Contract Start', fmtDate(emp.contract_start_date||rec?.contractStartDate)],
                ['Contract End',   fmtDate(emp.contract_end_date||rec?.contractEndDate)],
              ].map(([l,v])=>(
                <Box key={l} sx={{ display:'flex', justifyContent:'space-between', gap:2 }}>
                  <Typography fontSize={12} color="text.secondary">{l}</Typography>
                  <Typography fontSize={12} fontWeight={500} textAlign="right">{v}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Contract History</Typography>
            {(emp.contract_history && emp.contract_history.length>0) ? (
              <Stack spacing={1}>
                {emp.contract_history.map((p,i)=>{
                  const isLatest = i===emp.contract_history!.length-1;
                  return (
                    <Box key={i} sx={{ display:'flex', justifyContent:'space-between', gap:2, p:0.75,
                      bgcolor: isLatest?'#f0fdf4':'#f8fafc', borderRadius:1 }}>
                      <Typography fontSize={12} color={isLatest?'#059669':'text.secondary'} fontWeight={isLatest?600:400}>
                        Contract {i+1}{isLatest?' (current)':''}
                      </Typography>
                      <Typography fontSize={12} fontWeight={500} textAlign="right">
                        {fmtDate(p.start_date)} → {p.end_date?fmtDate(p.end_date):'Ongoing'}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Typography fontSize={12} color="text.secondary">No contract history on record.</Typography>
            )}
          </Paper>

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
                  {['Employee','Consultant','Intern','Contract Based','Part Time','Temporary Staffing'].map(c=>(
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Box>
      )}

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
                    <>
                      <Slider value={mgrPct} onChange={(_,v)=>handleMgrPctChange(v as number)}
                        min={0} max={50} step={0.5} valueLabelDisplay="auto"
                        valueLabelFormat={v=>`${v}%`} sx={{ color:'#059669', maxWidth:340 }}/>
                      <TextField
                        size="small" label="Or enter New CTC Amount" type="number"
                        value={mgrAmount}
                        onChange={e=>handleMgrAmountChange(Number(e.target.value)||0)}
                        sx={{ mt: 1.5, maxWidth: 220 }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>
                        From {fmtCurrency(prevCtc)} to {fmtCurrency(mgrAmount)}
                      </Typography>
                    </>
                  ):(
                    <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                      <Typography fontSize={12} color="#059669" fontWeight={600}>
                        {rec?.managerDecision?.recommendedPct??mgrPct}% increment recommended
                        {' '}({fmtCurrency(amountFromPct(rec?.managerDecision?.recommendedPct??mgrPct, prevCtc))})
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
                      <>
                        <Slider value={mgmtPct} onChange={(_,v)=>handleMgmtPctChange(v as number)}
                          min={0} max={50} step={0.5} valueLabelDisplay="auto"
                          valueLabelFormat={v=>`${v}%`} sx={{ color:ACCENT, maxWidth:340 }}/>
                        <TextField
                          size="small" label="Or enter New CTC Amount" type="number"
                          value={mgmtAmount}
                          onChange={e=>handleMgmtAmountChange(Number(e.target.value)||0)}
                          sx={{ mt: 1.5, maxWidth: 220 }}
                          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                        />
                        <Typography fontSize={11} color="text.secondary" mt={0.5}>
                          From {fmtCurrency(prevCtc)} to {fmtCurrency(mgmtAmount)}
                        </Typography>
                      </>
                    ):(
                      <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                        <Typography fontSize={12} color={ACCENT} fontWeight={600}>
                          {rec?.managementDecision?.finalPct??mgmtPct}% — final management decision
                          {' '}({fmtCurrency(amountFromPct(rec?.managementDecision?.finalPct??mgmtPct, prevCtc))})
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

                <TextField label="New Contract Start Date" type="date" size="small"
                  value={hrNewContractStart} onChange={e=>setHrNewContractStart(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                <TextField label="New Contract End Date" type="date" size="small"
                  value={hrNewContractEnd} onChange={e=>setHrNewContractEnd(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                {isPpoConversion&&(
                  <TextField label="Full-Time Since (PPO conversion)" type="date" size="small"
                    value={hrFullTimeSince} onChange={e=>setHrFullTimeSince(e.target.value)}
                    helperText="Date this intern/contract employee actually became full-time — next year's review is anchored from here, not their original joining date."
                    InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>
                )}

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
                    {rec?.hrDecision?.newContractStartDate&&(
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>
                        New contract: {fmtDate(rec?.hrDecision?.newContractStartDate)} – {fmtDate(rec?.hrDecision?.newContractEndDate)}
                      </Typography>
                    )}
                    {rec?.hrDecision?.fullTimeSince&&(
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>
                        Full-time since: {fmtDate(rec?.hrDecision?.fullTimeSince)} — next annual review anchored from here.
                      </Typography>
                    )}
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

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

      {tab===3&&<HistoryPanel employeeCode={emp.employee_id}/>}
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail' | 'ctc';


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
  const [contact, setContact] = useState<{
  official_email: string;
  personal_email: string;
  mobile:         string;
  reporting_manager: string;
} | null>(null);

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
                onSelect={handleSelect} onAdd={()=>setShowAdd(true)} onManageCtc={()=>setView('ctc')}/>
            )}

            {view==='detail'&&selEmp&&(
              <RevisionDetailView
                key={`${selEmp._id}_${selRec?._id||'new'}`}
                emp={selEmp}
                rec={selRec}
                onBack={()=>{ setView('dashboard'); setSelEmp(null); setSelRec(undefined); loadData(); }}
                onRecordChange={handleRecordChange}
                showToast={showToast}/>
            )}

            {view==='ctc'&&(
              <CtcComponentsView onBack={()=>setView('dashboard')} showToast={showToast}/>
            )}
          </Box>
        </main>
      </div>

      <AddRevisionModal open={showAdd} onClose={()=>setShowAdd(false)}
        onAdded={handleAdded} showToast={showToast} employees={employees} records={records}/>
    </div>
  );
}
