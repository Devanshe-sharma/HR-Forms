import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Slider, Autocomplete,
} from '@mui/material';
import {
  ArrowBack        as ArrowBackIcon,
  CheckCircle      as CheckCircleIcon,
  HourglassEmpty   as HourglassEmptyIcon,
  BarChart         as TrendingUpIcon,
  Block            as PauseCircleIcon,
  Add              as AddIcon,
  Close            as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';

import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────

type RevisionDecision = 'increment' | 'pip' | null;
type RevisionStage    = 'pending_manager' | 'pending_management' | 'completed' | 'on_hold';
type RevisionStatus   = 'pending' | 'increment_approved' | 'pip_active' | 're_evaluate';

interface PmsScore {
  period : string;
  score  : number;
}

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

interface EmployeeDetail {
  _id              : string;
  employee_id      : string;
  full_name        : string;
  department       : string;
  designation      : string;
  email            : string;
  joining_date     : string | null;
  employee_category: string;
  annual_ctc       : number;
  level            : number;
  reporting_manager : string;
}

interface SalaryStructure {
  basic: number;
  hra: number;
  special_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  lta: number;
  pf: number;
  gratuity: number;
  bonus: number;
  total: number;
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
  status            : RevisionStatus;
  managerDecision   : ManagerDecision;
  managementDecision: ManagementDecision;
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
  joining_date     : string | null;
  employee_category: string;
  annual_ctc       : number;
  level            : number;
  reporting_manager : string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.API_BASE_URL || 'http://3.110.162.1:5000/api';
const API      = API_BASE + '/salary-revisions';
const EMP_API  = API_BASE + '/employees';

const TH = {
  fontWeight: 700,
  fontSize  : 12,
  color     : 'text.secondary',
  bgcolor   : '#f9fafb',
  whiteSpace: 'nowrap' as const,
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtCurrency = (n?: number | null) => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
};

/**
 * Returns the exact date that is 11 months after joining.
 * e.g. joined 10-May-2024 → due 10-Apr-2025
 */
const get11MonthDate = (joiningDate: string): Date =>
  new Date(new Date(joiningDate).getFullYear(),
           new Date(joiningDate).getMonth() + 11,
           new Date(joiningDate).getDate());

/** True if this employee's 11-month due date falls in the given month + year */
const isDueIn = (joiningDate: string, targetMonth: number, targetYear: number): boolean => {
  const due = get11MonthDate(joiningDate);
  return due.getMonth() === targetMonth && due.getFullYear() === targetYear;
};

/**
 * Eligible for salary revision: joined 11+ months ago
 * Shows employees who are past their 11-month completion date
 */
const isEligible = (joiningDate: string): boolean => {
  const joined = new Date(joiningDate);
  const now    = new Date();
  const months = (now.getFullYear() - joined.getFullYear()) * 12
               + (now.getMonth()    - joined.getMonth());
  return months >= 11;
};

const avgPms = (scores: PmsScore[]): number | null => {
  if (!scores || !scores.length) return null;
  return Math.round(scores.reduce((s, p) => s + p.score, 0) / scores.length * 10) / 10;
};

/**
 * Calculate salary structure based on CTC
 * Formula: Basic = 40% of CTC, HRA = 40% of Basic, etc.
 */
const calculateSalaryStructure = (ctc: number): SalaryStructure => {
  const basic = Math.round(ctc * 0.4);
  const hra = Math.round(basic * 0.4);
  const special_allowance = Math.round(ctc * 0.1);
  const transport_allowance = Math.round(ctc * 0.05);
  const medical_allowance = Math.round(ctc * 0.03);
  const lta = Math.round(ctc * 0.02);
  const pf = Math.round(basic * 0.12);
  const gratuity = Math.round(basic * 0.0481);
  const bonus = Math.round(ctc * 0.0833);
  
  return {
    basic,
    hra,
    special_allowance,
    transport_allowance,
    medical_allowance,
    lta,
    pf,
    gratuity,
    bonus,
    total: basic + hra + special_allowance + transport_allowance + medical_allowance + lta + pf + gratuity + bonus
  };
};

// ─── Small chips ──────────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: RevisionStage }) {
  const done   = stage === 'completed';
  const onHold = stage === 'on_hold';
  return (
    <Chip
      size="small"
      icon={done ? <CheckCircleIcon fontSize="small" /> : <HourglassEmptyIcon fontSize="small" />}
      label={
        done    ? 'Completed' :
        onHold  ? 'On Hold (PIP)' :
        stage === 'pending_manager' ? 'Pending Manager' : 'Pending Mgmt'
      }
      sx={{
        bgcolor   : done ? '#ECFDF5' : onHold ? '#FEF3C7' : '#EFF6FF',
        color     : done ? '#059669' : onHold ? '#D97706' : '#2563EB',
        fontWeight: 600, fontSize: 11,
        border    : `1px solid ${done ? '#6EE7B7' : onHold ? '#FCD34D' : '#BFDBFE'}`,
        '& .MuiChip-icon': { color: 'inherit', ml: '6px' },
      }}
    />
  );
}

function DecisionChip({ decision }: { decision: RevisionDecision }) {
  if (!decision)
    return <Chip size="small" label="Pending" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontSize: 11 }} />;
  return (
    <Chip
      size="small"
      icon={decision === 'increment' ? <TrendingUpIcon fontSize="small" /> : <PauseCircleIcon fontSize="small" />}
      label={decision === 'increment' ? 'Increment' : 'PIP'}
      sx={{
        bgcolor   : decision === 'increment' ? '#ECFDF5' : '#FEF2F2',
        color     : decision === 'increment' ? '#059669' : '#DC2626',
        fontWeight: 700, fontSize: 11,
        border    : `1px solid ${decision === 'increment' ? '#6EE7B7' : '#FECACA'}`,
        '& .MuiChip-icon': { color: 'inherit', ml: '6px' },
      }}
    />
  );
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        {msg}
      </Alert>
    </Box>
  );
}

// ─── Month strip ──────────────────────────────────────────────────────────────

function MonthStrip({ selectedMonth, selectedYear, onChange, dueCounts }: {
  selectedMonth: number;
  selectedYear : number;
  onChange     : (month: number, year: number) => void;
  dueCounts    : Record<string, number>;
}) {
  const now    = new Date();
  const months = [];
  for (let i = -6; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear(), label: MONTHS_SHORT[d.getMonth()] });
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {months.map(m => {
        const active  = m.month === selectedMonth && m.year === selectedYear;
        const isCurr  = m.month === now.getMonth() && m.year === now.getFullYear();
        const key     = `${m.year}-${m.month}`;
        const cnt     = dueCounts[key] || 0;
        return (
          <Box key={key} sx={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <Button
              size="small"
              variant={active ? 'contained' : 'outlined'}
              onClick={() => onChange(m.month, m.year)}
              sx={{
                minWidth   : 58, fontSize: 12, textTransform: 'none', py: 0.5, lineHeight: 1.4,
                bgcolor    : active ? '#7C3AED' : 'transparent',
                borderColor: active ? '#7C3AED' : isCurr ? '#7C3AED' : '#D1D5DB',
                color      : active ? 'white' : isCurr ? '#7C3AED' : '#6B7280',
                fontWeight : isCurr ? 700 : 400,
                '&:hover'  : { bgcolor: active ? '#6D28D9' : '#F5F3FF', borderColor: '#7C3AED' },
              }}
            >
              {m.label}<br /><span style={{ fontSize: 10 }}>{m.year}</span>
            </Button>
            {cnt > 0 && (
              <Box sx={{
                position: 'absolute', top: -6, right: -6,
                bgcolor: '#DC2626', color: 'white', borderRadius: '50%',
                width: 16, height: 16, fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                {cnt}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Add Revision Modal ───────────────────────────────────────────────────────

function AddRevisionModal({ open, onClose, onAdded, showToast, employees }: {
  open     : boolean;
  onClose  : () => void;
  onAdded  : (r: SalaryRevision) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  employees: Employee[];
}) {
  const [selected,       setSelected]       = useState<Employee | null>(null);
  const [pmsRows,        setPmsRows]        = useState<PmsScore[]>([{ period: '', score: 0 }]);
  const [applicableDate, setApplicableDate] = useState('');
  const [category,       setCategory]       = useState('Employee');
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setPmsRows([{ period: '', score: 0 }]);
      setApplicableDate('');
      setCategory('Employee');
    }
  }, [open]);

  const addPmsRow    = () => setPmsRows(r => [...r, { period: '', score: 0 }]);
  const removePmsRow = (i: number) => setPmsRows(r => r.filter((_, idx) => idx !== i));
  const setPmsField  = (i: number, field: keyof PmsScore, val: string | number) =>
    setPmsRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSubmit = async () => {
    if (!selected)             return showToast('Please select an employee', 'error');
    if (!selected.joining_date) return showToast('Selected employee has no joining date', 'error');
    try {
      setSaving(true);
      const payload = {
        employeeCode  : selected.employee_id,
        employeeName  : selected.full_name,
        department    : selected.department,
        designation   : selected.designation,
        email         : selected.email,
        joiningDate   : selected.joining_date,
        category,
        applicableDate: applicableDate || null,
        previousCtc   : selected.annual_ctc || 0,
        pmsScores     : pmsRows.filter(p => p.period.trim()),
      };
      const { data } = await axios.post(API, payload);
      if (data.success || data._id || data.data) {
        showToast('Salary revision record created', 'success');
        onAdded(data.data || data);
        onClose();
      } else {
        showToast(data.message || 'Failed to create', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Request failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const dueDate = selected?.joining_date ? get11MonthDate(selected.joining_date) : null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position : 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width    : { xs: '95vw', md: 640 },
        maxHeight: '90vh', overflow: 'auto',
        bgcolor  : 'white', borderRadius: 3,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        outline  : 'none',
      }}>
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          p: 3, borderBottom: '1px solid #E5E7EB',
          position: 'sticky', top: 0, bgcolor: 'white', zIndex: 1,
        }}>
          <Typography fontSize={17} fontWeight={700}>Add Salary Revision</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ p: 3 }}>
          <Stack spacing={3}>

            {/* Employee search */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1}>SELECT EMPLOYEE</Typography>
              <Autocomplete
                options={employees}
                getOptionLabel={e => `${e.full_name} (${e.employee_id})`}
                value={selected}
                onChange={(_, val) => {
                  setSelected(val);
                  if (val?.employee_category) setCategory(val.employee_category);
                }}
                renderInput={params => (
                  <TextField {...params} size="small" placeholder="Search by name or ID…" />
                )}
                renderOption={(props, e) => (
                  <li {...props} key={e._id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#7C3AED', fontSize: 11, fontWeight: 700 }}>
                        {initials(e.full_name)}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13} fontWeight={600}>{e.full_name}</Typography>
                        <Typography fontSize={11} color="text.secondary">
                          {e.employee_id} · {e.department} · {e.designation}
                        </Typography>
                      </Box>
                    </Box>
                  </li>
                )}
              />
            </Box>

            {/* Auto-fetched info */}
            {selected && (
              <Box sx={{ p: 2, bgcolor: '#F5F3FF', borderRadius: 2, border: '1px solid #DDD6FE' }}>
                <Typography fontSize={12} fontWeight={700} color="#7C3AED" mb={1.5}>AUTO-FETCHED INFO</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  {[
                    ['Department',      selected.department  || '—'],
                    ['Designation',     selected.designation || '—'],
                    ['Email',           selected.email       || '—'],
                    ['Joining Date',    fmtDate(selected.joining_date)],
                    ['Previous CTC',    fmtCurrency(selected.annual_ctc)],
                    ['11-Month Due',    fmtDate(dueDate?.toISOString())],
                  ].map(([l, v]) => (
                    <Box key={l}>
                      <Typography fontSize={11} color="text.secondary">{l}</Typography>
                      <Typography fontSize={13} fontWeight={600}>{v}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Editable fields */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Applicable Date" type="date" size="small"
                value={applicableDate}
                onChange={e => setApplicableDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Effective date of revision"
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={e => setCategory(e.target.value)}>
                  {['Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'].map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* PMS scores */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography fontSize={12} fontWeight={700} color="text.secondary">PMS SCORES</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addPmsRow}
                  sx={{ fontSize: 12, textTransform: 'none', color: '#7C3AED' }}>
                  Add Period
                </Button>
              </Box>
              <Stack spacing={1.5}>
                {pmsRows.map((row, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <TextField
                      size="small" label="Period" placeholder="e.g. Q1 2024"
                      value={row.period}
                      onChange={e => setPmsField(i, 'period', e.target.value)}
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      size="small" label="Score" type="number"
                      value={row.score}
                      onChange={e => setPmsField(i, 'score', Number(e.target.value))}
                      inputProps={{ min: 0, max: 10, step: 0.1 }}
                      sx={{ flex: 1 }}
                    />
                    {pmsRows.length > 1 && (
                      <IconButton size="small" onClick={() => removePmsRow(i)}
                        sx={{ mt: 0.5, color: '#DC2626' }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Stack>
              {pmsRows.some(r => r.period.trim()) && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#F5F3FF', borderRadius: 1.5, display: 'inline-flex', gap: 1.5, alignItems: 'center' }}>
                  <Typography fontSize={12} color="text.secondary">Average PMS:</Typography>
                  <Typography fontSize={13} fontWeight={700} color="#7C3AED">
                    {avgPms(pmsRows.filter(r => r.period.trim())) ?? '—'}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
              <Button
                variant="contained" onClick={handleSubmit}
                disabled={saving || !selected}
                sx={{ flex: 1, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' }, textTransform: 'none', fontWeight: 600 }}
              >
                {saving
                  ? <CircularProgress size={22} sx={{ color: 'white' }} />
                  : 'Create Salary Revision'}
              </Button>
              <Button variant="outlined" onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
            </Box>

          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, employees, loading, onSelect, onAdd }: {
  records : SalaryRevision[];
  employees: Employee[];
  loading : boolean;
  onSelect: (emp: EmployeeDetail, record?: SalaryRevision) => void;
  onAdd   : () => void;
}) {
  const now = new Date();
  const [selMonth,    setSelMonth]    = useState(now.getMonth());
  const [selYear,     setSelYear]     = useState(now.getFullYear());
  const [showAll,     setShowAll]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [deptFilter,  setDeptFilter]  = useState('All');
  const [desgFilter,  setDesgFilter]  = useState('All');
  const [durationFilter, setDurationFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');

  // Create combined list of employees with existing revision records
  const allEmployeeData = React.useMemo(() => {
    const employeeMap = new Map(employees.map(emp => [emp._id, emp]));
    // Add employees from revision records
    records.forEach(record => {
      if (!employeeMap.has(record._id)) {
        employeeMap.set(record._id, {
          _id: record._id,
          employee_id: record.employeeCode,
          full_name: record.employeeName,
          department: record.department,
          designation: record.designation,
          email: record.email,
          joining_date: record.joiningDate,
          employee_category: record.category,
          annual_ctc: record.previousCtc
        } as Employee);
      }
    });
    // Convert map to array
    return Array.from(employeeMap.values());
  }, [employees, records]);

  // Get unique departments and designations
  const depts  = ['All', ...Array.from(new Set(allEmployeeData.map(e => e.department).filter(Boolean)))];
  const desgs  = ['All', ...Array.from(new Set(allEmployeeData.map(e => e.designation).filter(Boolean)))];
  const durations = ['All', '0-6 months', '6-12 months', '12-24 months', '24+ months'];
  const stages = ['All', 'pending_manager', 'pending_management', 'completed', 'on_hold'];

  // Count how many employees have their 11-month due in each month bucket
  const dueCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    allEmployeeData.forEach(emp => {
      if (!emp.joining_date || !isEligible(emp.joining_date)) return;
      const due = get11MonthDate(emp.joining_date);
      const key = `${due.getFullYear()}-${due.getMonth()}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [allEmployeeData]);

  // Filter employees based on duration
  const filterByDuration = (emp: EmployeeDetail) => {
    if (!emp.joining_date || !isEligible(emp.joining_date)) return false;
    const monthsElapsed = (now.getFullYear() - new Date(emp.joining_date).getFullYear()) * 12 + 
                        (now.getMonth() - new Date(emp.joining_date).getMonth());
    
    switch (durationFilter) {
      case '0-6 months': return monthsElapsed >= 0 && monthsElapsed < 6;
      case '6-12 months': return monthsElapsed >= 6 && monthsElapsed < 12;
      case '12-24 months': return monthsElapsed >= 12 && monthsElapsed < 24;
      case '24+ months': return monthsElapsed >= 24;
      default: return true;
    }
  };

  // Filter employees who are past 11 months from joining date
  const eligibleEmployees = React.useMemo(() => {
    return allEmployeeData.filter(emp => {
      if (!emp.joining_date || !isEligible(emp.joining_date)) return false;
      
      const passesDurationFilter = filterByDuration(emp);
      const monthMatch  = showAll || isDueIn(emp.joining_date, selMonth, selYear);
      const searchMatch = !search ||
        emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase());
      const deptMatch   = deptFilter  === 'All' || emp.department  === deptFilter;
      const desgMatch   = desgFilter  === 'All' || emp.designation === desgFilter;
      
      return passesDurationFilter && monthMatch && searchMatch && deptMatch && desgMatch;
    });
  }, [allEmployeeData, showAll, selMonth, selYear, search, deptFilter, desgFilter, durationFilter]);

  const filtered = records.filter(r => {
    if (!isEligible(r.joiningDate)) return false;
    const monthMatch  = showAll || isDueIn(r.joiningDate, selMonth, selYear);
    const searchMatch = !search ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(search.toLowerCase());
    const deptMatch   = deptFilter  === 'All' || r.department  === deptFilter;
    const desgMatch   = desgFilter  === 'All' || r.designation === desgFilter;
    const stageMatch  = stageFilter === 'All' || r.stage       === stageFilter;
    return monthMatch && searchMatch && deptMatch && desgMatch && stageMatch;
  });

  const counts = {
    total    : eligibleEmployees.length,
    pending  : filtered.filter(r => r.stage !== 'completed').length,
    increment: filtered.filter(r => r.managerDecision?.decision === 'increment').length,
    pip      : filtered.filter(r => r.managerDecision?.decision === 'pip').length,
    completed: filtered.filter(r => r.stage === 'completed').length,
  };

  const STATS = [
    { label: showAll ? 'All Eligible' : 'Due This Month', value: counts.total,     color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Pending',                                   value: counts.pending,   color: '#D97706', bg: '#FFFBEB' },
    { label: 'Increment',                                 value: counts.increment, color: '#059669', bg: '#ECFDF5' },
    { label: 'PIP',                                       value: counts.pip,       color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Completed',                                 value: counts.completed, color: '#2563EB', bg: '#EFF6FF' },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1F2937">Salary Revision</Typography>
          <Typography fontSize={13} color="text.secondary" mt={0.3}>
            {showAll
              ? 'All eligible employees (joined 9–24 months ago)'
              : `Employees whose joining date + 11 months = ${MONTHS_SHORT[selMonth]} ${selYear}`}
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<AddIcon />} onClick={onAdd}
          sx={{ bgcolor: '#7C3AED', textTransform: 'none', fontWeight: 600, px: 3, '&:hover': { bgcolor: '#6D28D9' } }}
        >
          Add Revision
        </Button>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <Box key={s.label} sx={{
            flex: '1 1 120px', p: 2, borderRadius: 2,
            bgcolor: s.bg, border: `1px solid ${s.color}30`,
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
          }}>
            <Typography fontSize={28} fontWeight={800} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography fontSize={12} color="text.secondary" mt={0.5}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Month strip — only shown when not in "all" mode */}
      {!showAll && (
        <Box sx={{ mb: 3, p: 2.5, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5}>
            SELECT MONTH — red badge = number of employees due that month
          </Typography>
          <MonthStrip
            selectedMonth={selMonth}
            selectedYear={selYear}
            onChange={(m, y) => { setSelMonth(m); setSelYear(y); }}
            dueCounts={dueCounts}
          />
        </Box>
      )}

      {/* Filters */}
      <Box sx={{
        display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', p: 2,
        bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB', alignItems: 'center',
      }}>
        <TextField
          size="small" placeholder="Search employee…" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }}
          InputProps={{ sx: { fontSize: 14 } }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: 13 }}>Department</InputLabel>
          <Select value={deptFilter} label="Department"
            onChange={e => setDeptFilter(e.target.value)} sx={{ fontSize: 13 }}>
            {depts.map(d => <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: 13 }}>Designation</InputLabel>
          <Select value={desgFilter} label="Designation"
            onChange={e => setDesgFilter(e.target.value)} sx={{ fontSize: 13 }}>
            {desgs.map(d => <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ fontSize: 13 }}>Duration</InputLabel>
          <Select value={durationFilter} label="Duration"
            onChange={e => setDurationFilter(e.target.value)} sx={{ fontSize: 13 }}>
            {durations.map(d => <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ fontSize: 13 }}>Stage</InputLabel>
          <Select value={stageFilter} label="Stage"
            onChange={e => setStageFilter(e.target.value)} sx={{ fontSize: 13 }}>
            {stages.map(s => (
              <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>
                {s === 'All'                  ? 'All Stages' :
                 s === 'pending_manager'      ? 'Pending Manager' :
                 s === 'pending_management'   ? 'Pending Management' :
                 s === 'completed'            ? 'Completed' : 'On Hold (PIP)'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant={showAll ? 'contained' : 'outlined'} size="small"
          onClick={() => setShowAll(!showAll)}
          sx={{
            fontSize: 13, textTransform: 'none',
            bgcolor    : showAll ? '#7C3AED' : 'transparent',
            color      : showAll ? 'white'   : '#7C3AED',
            borderColor: '#7C3AED',
            '&:hover'  : { bgcolor: showAll ? '#6D28D9' : '#F5F3FF' },
          }}
        >
          {showAll ? 'Show by Month' : 'Show All Eligible'}
        </Button>

        <Button
          variant="outlined" size="small"
          onClick={() => { setSearch(''); setDeptFilter('All'); setDesgFilter('All'); setStageFilter('All'); setShowAll(false); }}
          sx={{ fontSize: 13, textTransform: 'none' }}
        >
          Reset
        </Button>
      </Box>

      {/* Table */}
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={10}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 520, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Designation</TableCell>
                  <TableCell>Joining Date</TableCell>
                  <TableCell>11-Month Due</TableCell>
                  <TableCell>Prev. CTC</TableCell>
                  <TableCell>Avg PMS</TableCell>
                  <TableCell>Decision</TableCell>
                  <TableCell>Final Incr %</TableCell>
                  <TableCell>New CTC</TableCell>
                  <TableCell>Stage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibleEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 8, color: 'text.secondary', fontSize: 14 }}>
                      {showAll
                        ? 'No eligible employees found'
                        : `No employees due in ${MONTHS_SHORT[selMonth]} ${selYear}`}
                    </TableCell>
                  </TableRow>
                )}
                {eligibleEmployees.map(emp => {
                  const dueDate    = get11MonthDate(emp.joining_date!);
                  const isThisMonth = isDueIn(emp.joining_date!, now.getMonth(), now.getFullYear());
                  const existingRecord = records.find(r => r.employeeCode === emp.employee_id);
                  
                  return (
                    <TableRow
                      key={emp._id}
                      onClick={() => {
                        const existingRecord = records.find(r => r.employeeCode === emp.employee_id);
                        onSelect(emp, existingRecord || undefined);
                      }}
                      sx={{
                        cursor : existingRecord ? 'pointer' : 'default',
                        bgcolor: isThisMonth ? '#FEFCE8' : 'inherit',
                        '&:hover': existingRecord ? { bgcolor: '#EDE9FE', '& td': { color: '#4C1D95' } } : {},
                        transition: 'background 0.15s',
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#7C3AED', fontSize: 12, fontWeight: 700 }}>
                            {initials(emp.full_name)}
                          </Avatar>
                          <Box>
                            <Typography fontSize={13} fontWeight={600}>{emp.full_name}</Typography>
                            <Typography fontSize={11} color="text.secondary">{emp.employee_id}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{emp.department  || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{emp.designation || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{fmtDate(emp.joining_date)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography
                            fontSize={13}
                            fontWeight={isThisMonth ? 700 : 400}
                            color={isThisMonth ? '#D97706' : 'inherit'}
                          >
                            {fmtDate(dueDate.toISOString())}
                          </Typography>
                          {isThisMonth && (
                            <Chip label="Due now" size="small"
                              sx={{ fontSize: 10, bgcolor: '#FEF3C7', color: '#D97706', height: 18 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{fmtCurrency(emp.annual_ctc)}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {existingRecord ? (
                          avgPms(existingRecord.pmsScores) != null ? (
                            <Chip label={avgPms(existingRecord.pmsScores)} size="small" sx={{ fontWeight: 700, bgcolor: '#F5F3FF', color: '#7C3AED' }} />
                          ) : '—'
                        ) : (
                          <Chip label="No PMS" size="small" sx={{ fontSize: 11, bgcolor: '#F3F4F6', color: '#6B7280' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {existingRecord ? (
                          <DecisionChip decision={existingRecord.managerDecision?.decision} />
                        ) : (
                          <Chip label="No Record" size="small" sx={{ fontSize: 11, bgcolor: '#FEF2F2', color: '#DC2626' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {existingRecord?.finalIncrementPct != null ? (
                          <Chip label={`${existingRecord.finalIncrementPct}%`} size="small"
                            sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 700 }} />
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                        {existingRecord ? fmtCurrency(existingRecord.newCtc) : '—'}
                      </TableCell>
                      <TableCell>
                        {existingRecord ? (
                          <StageChip stage={existingRecord.stage} />
                        ) : (
                          <Chip label="Pending" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontSize: 11 }} />
                        )}
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

// ─── Employee Details View ──────────────────────────────────────────────────────

function EmployeeDetailsView({ employee, record, onBack, onSave, showToast }: {
  employee: EmployeeDetail;
  record?: SalaryRevision | null;
  onBack: () => void;
  onSave: (updatedData: any) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  // Form states
  const [applicableDate, setApplicableDate] = useState(record?.applicableDate || '');
  const [category, setCategory] = useState(employee.employee_category || 'Employee');
  const [decision, setDecision] = useState<RevisionDecision | null>(record?.managerDecision?.decision || null);
  const [managerRecommendation, setManagerRecommendation] = useState(record?.managerDecision?.recommendedPct || 0);
  const [managementRecommendation, setManagementRecommendation] = useState(record?.managementDecision?.finalPct || 0);
  const [finalIncrement, setFinalIncrement] = useState(record?.finalIncrementPct || 0);
  const [pipReason, setPipReason] = useState(record?.managerDecision?.reason || '');
  const [pipDuration, setPipDuration] = useState(record?.managerDecision?.pipDurationMonths || 3);
  const [saving, setSaving] = useState(false);

  // Check if it's manager turn or management turn
  const isManagerTurn = !record?.managementDecision?.submittedAt;
  const isManagementTurn = record?.managementDecision?.submittedAt && !record?.managementDecision?.finalPct;

  // Calculate new CTC based on increment
  const newCTC = decision === 'increment' && finalIncrement > 0 
    ? Math.round(employee.annual_ctc * (1 + finalIncrement / 100))
    : employee.annual_ctc;

  // Calculate salary structure
  const salaryStructure = calculateSalaryStructure(newCTC);

  // Calculate next PIP due date
  const pipDueDate = decision === 'pip' ? (() => {
    const date = new Date();
    date.setMonth(date.getMonth() + pipDuration);
    return date.toISOString().split('T')[0];
  })() : null;

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const payload = {
        employeeId: employee._id,
        employeeName: employee.full_name,
        department: employee.department,
        designation: employee.designation,
        applicableDate,
        category,
        decision,
        managerRecommendation,
        managementRecommendation: isManagementTurn ? managementRecommendation : null,
        finalIncrement: isManagementTurn ? finalIncrement : null,
        pipReason: decision === 'pip' ? pipReason : null,
        pipDuration: decision === 'pip' ? pipDuration : null,
        newCTC: decision === 'increment' && isManagementTurn ? newCTC : employee.annual_ctc,
        previousCTC: employee.annual_ctc,
        salaryStructure: decision === 'increment' && isManagementTurn ? salaryStructure : null
      };

      // Save to backend
      const response = await axios.post(`${API}/save-decision`, payload);
      
      if (response.data.success) {
        showToast('Decision saved successfully', 'success');
        onSave(response.data.data);
      } else {
        showToast(response.data.message || 'Failed to save', 'error');
      }
    } catch (error) {
      showToast('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#F3F4F6', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Avatar sx={{ width: 48, height: 48, bgcolor: '#7C3AED', fontWeight: 700, fontSize: 18 }}>
          {initials(employee.full_name)}
        </Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="1.1rem">{employee.full_name}</Typography>
          <Typography fontSize={13} color="text.secondary">
            {employee.designation} · {employee.department} · {employee.employee_id}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={saving}
          sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' }, mr: 1 }}
        >
          {saving ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Save Changes'}
        </Button>
        <Button 
          variant="outlined" 
          onClick={() => {
            // Navigate to output table view
            const event = new CustomEvent('navigateToOutput', { detail: { employee, record } });
            window.dispatchEvent(event);
          }}
          sx={{ ml: 1 }}
        >
          View Output Table
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
        
        {/* Employee Information */}
        <Paper variant="outlined" sx={{ flex: '1 1 350px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Employee Details</Typography>
          <Stack spacing={2}>
            <TextField
              label="Employee ID"
              value={employee.employee_id}
              disabled
              size="small"
              fullWidth
            />
            <TextField
              label="Full Name"
              value={employee.full_name}
              disabled
              size="small"
              fullWidth
            />
            <TextField
              label="Email ID"
              value={employee.email}
              disabled
              size="small"
              fullWidth
            />
            <TextField
              label="Department"
              value={employee.department}
              disabled
              size="small"
              fullWidth
            />
            <TextField
              label="Designation"
              value={employee.designation}
              disabled
              size="small"
              fullWidth
            />
            <TextField
              label="Previous CTC"
              value={fmtCurrency(employee.annual_ctc)}
              disabled
              size="small"
              fullWidth
            />
          </Stack>
        </Paper>

        {/* PMS Scores */}
        <Paper variant="outlined" sx={{ flex: '1 1 300px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>PMS Scores</Typography>
          {record?.pmsScores?.length ? (
            <Stack spacing={1.5}>
              {record.pmsScores.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography fontSize={13} color="text.secondary">{p.period}</Typography>
                  <Chip label={p.score} size="small" sx={{ bgcolor: '#F5F3FF', color: '#7C3AED', fontWeight: 700 }} />
                </Box>
              ))}
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontSize={13} fontWeight={700}>Average</Typography>
                <Chip label={avgPms(record.pmsScores) ?? '—'} size="small" sx={{ bgcolor: '#7C3AED', color: 'white', fontWeight: 700 }} />
              </Box>
            </Stack>
          ) : (
            <Typography fontSize={13} color="text.disabled">No PMS scores recorded</Typography>
          )}
        </Paper>

        {/* Decision Form */}
        <Paper variant="outlined" sx={{ flex: '1 1 400px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Decision Form</Typography>
          <Stack spacing={2}>
            
            <TextField
              label="Applicable Date"
              type="date"
              value={applicableDate}
              onChange={(e) => setApplicableDate(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={category} onChange={(e) => setCategory(e.target.value as string)} label="Category">
                <MenuItem value="Employee">Employee</MenuItem>
                <MenuItem value="Consultant">Consultant</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Decision</InputLabel>
              <Select value={decision || ''} onChange={(e) => setDecision(e.target.value as RevisionDecision)} label="Decision">
                <MenuItem value="increment">Increment</MenuItem>
                <MenuItem value="pip">PIP (Performance Improvement Plan)</MenuItem>
              </Select>
            </FormControl>

            {decision === 'pip' && (
              <>
                <TextField
                  label="PIP Reason"
                  value={pipReason}
                  onChange={(e) => setPipReason(e.target.value)}
                  multiline
                  rows={3}
                  size="small"
                  fullWidth
                  placeholder="Enter reason for PIP..."
                  disabled={!isManagerTurn}
                />
                <TextField
                  label="Duration (months)"
                  type="number"
                  value={pipDuration}
                  onChange={(e) => setPipDuration(Number(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 12 }}
                  disabled={!isManagerTurn}
                />
                {pipDueDate && (
                  <TextField
                    label="Next Due Date"
                    type="date"
                    value={pipDueDate}
                    disabled
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              </>
            )}

            {decision === 'increment' && (
              <>
                <Typography fontWeight={600} fontSize={14} sx={{ mb: 1 }}>Recommendation Structure</Typography>
                
                <TextField
                  label="Manager Recommendation %"
                  type="number"
                  value={managerRecommendation}
                  onChange={(e) => setManagerRecommendation(Number(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                />
                
                <TextField
                  label="Management Recommendation %"
                  type="number"
                  value={managementRecommendation}
                  onChange={(e) => setManagementRecommendation(Number(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                />
                
                <TextField
                  label="Final Increment %"
                  type="number"
                  value={finalIncrement}
                  onChange={(e) => setFinalIncrement(Number(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                />
              </>
            )}

          </Stack>
        </Paper>

      </Box>

      {/* Salary Structure (for increments) */}
      {decision === 'increment' && (
        <Paper variant="outlined" sx={{ mt: 3, borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Salary Structure (Auto-generated)</Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1}>Previous CTC</Typography>
              <Typography fontSize={16} fontWeight={600}>{fmtCurrency(employee.annual_ctc)}</Typography>
            </Box>
            
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1}>Increment</Typography>
              <Typography fontSize={16} fontWeight={600} color="#059669">+{finalIncrement}%</Typography>
            </Box>
            
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1}>New CTC</Typography>
              <Typography fontSize={16} fontWeight={700} color="#059669">{fmtCurrency(newCTC)}</Typography>
            </Box>
            
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {[
              ['Basic', salaryStructure.basic],
              ['HRA', salaryStructure.hra],
              ['Special Allowance', salaryStructure.special_allowance],
              ['Transport Allowance', salaryStructure.transport_allowance],
              ['Medical Allowance', salaryStructure.medical_allowance],
              ['LTA', salaryStructure.lta],
              ['PF', salaryStructure.pf],
              ['Gratuity', salaryStructure.gratuity],
              ['Bonus', salaryStructure.bonus],
              ['Total', salaryStructure.total],
            ].map(([label, value]) => (
              <Box key={label} sx={{ p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1 }}>
                <Typography fontSize={12} color="text.secondary">{label}</Typography>
                <Typography fontSize={14} fontWeight={600}>{fmtCurrency(Number(value))}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

    </Box>
  );
}

// ─── Output Table (Final Review Table) ──────────────────────────────────

function OutputTable({ records, employees }: {
  records: SalaryRevision[];
  employees: Employee[];
}) {
  // Combine employees with their decisions
  const reviewData = React.useMemo(() => {
    const employeeMap = new Map(employees.map(emp => [emp.employee_id, emp]));
    
    return records.map(record => {
      const employee = employeeMap.get(record.employeeCode);
      const avgScore = avgPms(record.pmsScores);
      
      return {
        employeeId: record.employeeCode,
        employeeName: record.employeeName,
        department: record.department,
        designation: record.designation,
        totalPerformanceScore: avgScore,
        decision: record.managerDecision?.decision || 'pending',
        pipDuration: record.managerDecision?.pipDurationMonths || null,
        pipDueDate: record.managerDecision?.pipNewDueDate || null,
        finalIncrementPct: record.finalIncrementPct || null,
        newCTC: record.newCtc || record.previousCtc
      };
    });
  }, [records, employees]);

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} mb={3}>Final Review Table</Typography>
      
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': TH }}>
                <TableCell>Employee ID</TableCell>
                <TableCell>Employee Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Total Performance Score</TableCell>
                <TableCell>Decision</TableCell>
                <TableCell>PIP Duration</TableCell>
                <TableCell>PIP Due Date</TableCell>
                <TableCell>Final Increment %</TableCell>
                <TableCell>New CTC</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviewData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 8, color: 'text.secondary', fontSize: 14 }}>
                    No review data available
                  </TableCell>
                </TableRow>
              ) : (
                reviewData.map((data, index) => (
                  <TableRow key={data.employeeId}>
                    <TableCell sx={{ fontSize: 13 }}>{data.employeeId}</TableCell>
                    <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{data.employeeName}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{data.department}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{data.designation}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {data.totalPerformanceScore != null ? (
                        <Chip label={data.totalPerformanceScore} size="small" sx={{ bgcolor: '#F5F3FF', color: '#7C3AED', fontWeight: 700 }} />
                      ) : (
                        <Typography color="text.disabled" fontSize={12}>No Score</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {data.decision === 'increment' && (
                        <Chip label="Increment" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669' }} />
                      )}
                      {data.decision === 'pip' && (
                        <Chip label="PIP" size="small" sx={{ bgcolor: '#FEF2F2', color: '#DC2626' }} />
                      )}
                      {data.decision === 'pending' && (
                        <Chip label="Pending" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706' }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {data.pipDuration ? `${data.pipDuration} months` : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {data.pipDueDate ? fmtDate(data.pipDueDate) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                      {data.finalIncrementPct != null ? `${data.finalIncrementPct}%` : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
                      {fmtCurrency(data.newCTC)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}

// ─── Decision Form ────────────────────────────────────────────────────────────

function DecisionFormView({ record, onBack, onSuccess, showToast }: {
  record   : SalaryRevision;
  onBack   : () => void;
  onSuccess: (updated: SalaryRevision) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const isManagerTurn    = record.stage === 'pending_manager';
  const isManagementTurn = record.stage === 'pending_management';
  const roleLabel        = isManagerTurn ? 'Manager' : 'Management';

  const [reason,         setReason]         = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [decision,       setDecision]       = useState<'increment' | 'pip'>('increment');
  const [recommendPct,   setRecommendPct]   = useState<number>(10);
  const [pipMonths,      setPipMonths]      = useState<number>(3);
  const [pipDueDate,     setPipDueDate]     = useState('');
  const [applicableDate, setApplicableDate] = useState(
    record.applicableDate ? new Date(record.applicableDate).toISOString().split('T')[0] : ''
  );
  const [category,    setCategory]    = useState(record.category || 'Employee');
  const [mgmtPct,     setMgmtPct]     = useState<number>(record.managerDecision?.recommendedPct ?? 10);
  const [pipApproved, setPipApproved] = useState<boolean>(true);

  const prevCtc    = record.previousCtc || 0;
  const previewCtc = decision === 'increment' && isManagerTurn
    ? Math.round(prevCtc * (1 + recommendPct / 100))
    : isManagementTurn && record.managerDecision?.decision === 'increment'
    ? Math.round(prevCtc * (1 + mgmtPct / 100))
    : null;

  useEffect(() => {
    if (decision === 'pip') {
      const base = new Date();
      base.setMonth(base.getMonth() + pipMonths);
      setPipDueDate(base.toISOString().split('T')[0]);
    }
  }, [pipMonths, decision]);

  if (record.stage === 'on_hold') {
    return (
      <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
          <Typography variant="h6">On Hold — PIP Active</Typography>
        </Box>
        <Alert severity="warning">
          This employee is on a PIP. Revision re-opens on <strong>{fmtDate(record.reviewDate)}</strong>.
        </Alert>
      </Box>
    );
  }

  if (!isManagerTurn && !isManagementTurn) {
    return (
      <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
          <Typography variant="h6">Revision Completed</Typography>
        </Box>
        <Alert severity="info">This salary revision process is already completed.</Alert>
      </Box>
    );
  }

  const submit = async () => {
    if (!reason.trim()) return showToast('Please provide a reason', 'error');
    try {
      setSubmitting(true);
      const payload: any = { reason, applicableDate: applicableDate || null, category };
      if (isManagerTurn) {
        payload.decision = decision;
        if (decision === 'increment') { payload.recommendedPct = recommendPct; }
        else { payload.pipDurationMonths = pipMonths; payload.pipNewDueDate = pipDueDate || null; }
      } else {
        if (record.managerDecision?.decision === 'increment') { payload.finalPct = mgmtPct; }
        else { payload.pipApproved = pipApproved; }
      }
      const endpoint = isManagerTurn ? 'manager' : 'management';
      const { data } = await axios.put(`${API}/${record._id}/${endpoint}`, payload);
      if (data.success) {
        showToast('Decision submitted successfully', 'success');
        onSuccess(data.data);
      } else {
        showToast(data.message || 'Failed to submit', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Request failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={onBack} sx={{ bgcolor: '#f1f5f9' }}><ArrowBackIcon /></IconButton>
        <Box>
          <Typography variant="h6">{roleLabel} Decision</Typography>
          <Typography variant="body2" color="text.secondary">
            {record.employeeName} — {record.designation}
          </Typography>
        </Box>
      </Box>

      {isManagementTurn && record.managerDecision?.decision && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Manager recommended:{' '}
          <strong>
            {record.managerDecision.decision === 'increment'
              ? `${record.managerDecision.recommendedPct}% increment`
              : `PIP — ${record.managerDecision.pipDurationMonths} months`}
          </strong>
          {' — '}{record.managerDecision.reason}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 2 }} variant="outlined">
        <Stack spacing={3}>

          <Box>
            <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5}>EMPLOYEE DETAILS</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Applicable Date" type="date" size="small"
                value={applicableDate}
                onChange={e => setApplicableDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Effective date of increment"
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={e => setCategory(e.target.value)}>
                  {['Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'].map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5}>AUTO-FETCHED INFO</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {[
                ['Dept.',        record.department  || '—'],
                ['Designation',  record.designation || '—'],
                ['Email',        record.email       || '—'],
                ['Previous CTC', fmtCurrency(record.previousCtc)],
                ['Avg PMS',      avgPms(record.pmsScores) != null ? String(avgPms(record.pmsScores)) : '—'],
                ['11-Month Due', fmtDate(get11MonthDate(record.joiningDate).toISOString())],
              ].map(([l, v]) => (
                <Box key={l} sx={{ px: 2, py: 1.5, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB', minWidth: 110 }}>
                  <Typography fontSize={11} color="text.secondary">{l}</Typography>
                  <Typography fontSize={13} fontWeight={600}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Divider />

          {isManagerTurn && (
            <Box>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5}>DECISION</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                {(['increment', 'pip'] as const).map(opt => (
                  <Button
                    key={opt}
                    variant={decision === opt ? 'contained' : 'outlined'}
                    startIcon={opt === 'increment' ? <TrendingUpIcon /> : <PauseCircleIcon />}
                    onClick={() => setDecision(opt)}
                    sx={{
                      textTransform: 'none', fontWeight: 600,
                      bgcolor    : decision === opt ? (opt === 'increment' ? '#059669' : '#DC2626') : 'transparent',
                      borderColor: opt === 'increment' ? '#059669' : '#DC2626',
                      color      : decision === opt ? 'white' : (opt === 'increment' ? '#059669' : '#DC2626'),
                      '&:hover'  : { bgcolor: opt === 'increment' ? '#047857' : '#B91C1C', color: 'white' },
                    }}
                  >
                    {opt === 'increment' ? 'Increment' : 'PIP'}
                  </Button>
                ))}
              </Box>

              {decision === 'increment' && (
                <Box>
                  <Typography fontSize={13} fontWeight={600} mb={1}>
                    Recommended Increment: <strong style={{ color: '#059669' }}>{recommendPct}%</strong>
                  </Typography>
                  <Slider
                    value={recommendPct}
                    onChange={(_, v) => setRecommendPct(v as number)}
                    min={0} max={50} step={0.5}
                    valueLabelDisplay="auto"
                    valueLabelFormat={v => `${v}%`}
                    sx={{ color: '#059669', maxWidth: 400 }}
                  />
                  {previewCtc != null && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#ECFDF5', borderRadius: 1.5, border: '1px solid #6EE7B7', maxWidth: 420 }}>
                      <Typography fontSize={12} color="text.secondary">New CTC preview</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography fontSize={13}>{fmtCurrency(prevCtc)}</Typography>
                        <Typography fontSize={12} color="text.secondary">→</Typography>
                        <Typography fontSize={15} fontWeight={700} color="#059669">{fmtCurrency(previewCtc)}</Typography>
                        <Chip label={`+${recommendPct}%`} size="small" sx={{ bgcolor: '#059669', color: 'white', fontWeight: 700 }} />
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {decision === 'pip' && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="PIP Duration (months)" type="number" size="small"
                    value={pipMonths}
                    onChange={e => setPipMonths(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    inputProps={{ min: 1, max: 12 }}
                    helperText="1–12 months"
                    sx={{ width: 180 }}
                  />
                  <TextField
                    label="New Due Date" type="date" size="small"
                    value={pipDueDate}
                    onChange={e => setPipDueDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    helperText="Auto-calculated from duration"
                    sx={{ width: 200 }}
                  />
                </Box>
              )}
            </Box>
          )}

          {isManagementTurn && (
            <Box>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5}>MANAGEMENT RECOMMENDATION</Typography>
              {record.managerDecision?.decision === 'increment' ? (
                <Box>
                  <Typography fontSize={13} fontWeight={600} mb={1}>
                    Final Increment: <strong style={{ color: '#7C3AED' }}>{mgmtPct}%</strong>
                    {record.managerDecision.recommendedPct != null && (
                      <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>
                        (Manager recommended {record.managerDecision.recommendedPct}%)
                      </span>
                    )}
                  </Typography>
                  <Slider
                    value={mgmtPct}
                    onChange={(_, v) => setMgmtPct(v as number)}
                    min={0} max={50} step={0.5}
                    valueLabelDisplay="auto"
                    valueLabelFormat={v => `${v}%`}
                    sx={{ color: '#7C3AED', maxWidth: 400 }}
                  />
                  {previewCtc != null && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#F5F3FF', borderRadius: 1.5, border: '1px solid #DDD6FE', maxWidth: 420 }}>
                      <Typography fontSize={12} color="text.secondary">Final CTC</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography fontSize={13}>{fmtCurrency(prevCtc)}</Typography>
                        <Typography fontSize={12} color="text.secondary">→</Typography>
                        <Typography fontSize={15} fontWeight={700} color="#7C3AED">{fmtCurrency(previewCtc)}</Typography>
                        <Chip label={`+${mgmtPct}%`} size="small" sx={{ bgcolor: '#7C3AED', color: 'white', fontWeight: 700 }} />
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography fontSize={13} mb={1.5}>Approve PIP recommended by manager?</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant={pipApproved ? 'contained' : 'outlined'}
                      onClick={() => setPipApproved(true)}
                      sx={{ textTransform: 'none', bgcolor: pipApproved ? '#DC2626' : 'transparent', color: pipApproved ? 'white' : '#DC2626', borderColor: '#DC2626' }}
                    >
                      Approve PIP
                    </Button>
                    <Button
                      variant={!pipApproved ? 'contained' : 'outlined'}
                      onClick={() => setPipApproved(false)}
                      sx={{ textTransform: 'none', bgcolor: !pipApproved ? '#059669' : 'transparent', color: !pipApproved ? 'white' : '#059669', borderColor: '#059669' }}
                    >
                      Re-evaluate
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          <Divider />

          <TextField
            label="Reason / Comments *" multiline rows={4}
            value={reason} onChange={e => setReason(e.target.value)}
            fullWidth placeholder="Please explain your decision…"
          />

          <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
            <Button
              variant="contained" onClick={submit}
              disabled={submitting || !reason.trim()}
              sx={{ minWidth: 200, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' }, textTransform: 'none', fontWeight: 600 }}
            >
              {submitting
                ? <CircularProgress size={22} sx={{ color: 'white' }} />
                : `Submit ${roleLabel} Decision`}
            </Button>
            <Button variant="outlined" onClick={onBack} sx={{ textTransform: 'none' }}>Cancel</Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail' | 'action' | 'output';

export default function SalaryRevisionPage() {
  const [records,      setRecords]      = useState<SalaryRevision[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [selected,     setSelected]     = useState<SalaryRevision | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
  const [view,         setView]         = useState<View>('dashboard');
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMsg,     setToastMsg]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') =>
    setToastMsg({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [revisionRes, empRes] = await Promise.all([
        axios.get(API),
        axios.get(EMP_API)
      ]);
      
      const revisionData = Array.isArray(revisionRes.data) ? revisionRes.data : revisionRes.data?.data || [];
      const employeeData = Array.isArray(empRes.data) ? empRes.data : empRes.data?.data || [];
      
      setRecords(revisionData);
      setEmployees(employeeData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelect  = (emp: EmployeeDetail, record?: SalaryRevision) => {
    setSelectedEmployee(emp);
    if (record) {
      setSelected(record);
    }
    setView('detail');
  };

  const handleBack    = () => {
    if (view === 'action') setView('detail');
    else { setView('dashboard'); setSelected(null); setSelectedEmployee(null); }
  };
  
  const handleSuccess = (updated: SalaryRevision) => {
    setRecords(prev => prev.map(r => r._id === updated._id ? updated : r));
    setSelected(updated);
    setView('detail');
  };
  
  const handleAdded   = (newRecord: SalaryRevision) => {
    setRecords(prev => [newRecord, ...prev]);
  };

  const handleEmployeeSave = (updatedData: any) => {
    // Refresh data after save
    loadData();
    if (updatedData) {
      // Update the selected record if it exists
      const updatedRecord = records.find(r => r.employeeCode === selectedEmployee?.employee_id);
      if (updatedRecord) {
        setSelected(updatedRecord);
      }
    }
  };

  // Handle navigation to output table
  useEffect(() => {
    const handleNavigateToOutput = (event: any) => {
      if (event.detail) {
        setView('output');
      }
    };

    window.addEventListener('navigateToOutput', handleNavigateToOutput);
    
    return () => {
      window.removeEventListener('navigateToOutput', handleNavigateToOutput);
    };
  }, [selectedEmployee, records]);

  if (loading && view === 'dashboard') {
    return (
      <div className="flex min-h-screen bg-gray-50/70">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 flex items-center justify-center pt-16 md:pt-20">
            <CircularProgress size={64} thickness={4} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-hidden pt-16 md:pt-20">
          <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%', height: '100%', overflow: 'auto' }}>

            {toastMsg && (
              <Toast msg={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />
            )}

            {view === 'dashboard' && (
              <DashboardView
                records={records}
                employees={employees}
                loading={loading}
                onSelect={handleSelect}
                onAdd={() => setShowAddModal(true)}
              />
            )}

            {view === 'detail' && selectedEmployee && (
              <EmployeeDetailsView
                employee={selectedEmployee}
                record={selected}
                onBack={handleBack}
                onSave={handleEmployeeSave}
                showToast={showToast}
              />
            )}

            {view === 'action' && selected && (
              <DecisionFormView
                record={selected}
                onBack={handleBack}
                onSuccess={handleSuccess}
                showToast={showToast}
              />
            )}

            {view === 'output' && (
              <OutputTable
                key="output-table"
                records={records}
                employees={employees}
              />
            )}

          </Box>
        </main>
      </div>

      <AddRevisionModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleAdded}
        showToast={showToast}
        employees={employees}
      />
    </div>
  );
}