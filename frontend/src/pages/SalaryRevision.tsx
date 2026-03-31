import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Slider,
} from '@mui/material';
import {
  ArrowBack         as ArrowBackIcon,
  CheckCircle       as CheckCircleIcon,
  HourglassEmpty    as HourglassEmptyIcon,
  BarChart          as TrendingUpIcon,
  PauseCircleOutline as PauseCircleIcon,
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
  decision       : RevisionDecision;
  recommendedPct : number | null;
  pipDurationMonths: number | null;
  pipNewDueDate  : string | null;
  reason         : string;
  submittedAt    : string | null;
}

interface ManagementDecision {
  finalPct       : number | null;
  pipApproved    : boolean | null;
  reason         : string;
  submittedAt    : string | null;
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

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.REACT_APP_API_URL || 'http://13.235.0.127:5000/api';
const API      = API_BASE + '/salary-revisions';

const TH = {
  fontWeight : 700,
  fontSize   : 12,
  color      : 'text.secondary',
  bgcolor    : '#f9fafb',
  whiteSpace : 'nowrap' as const,
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
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
};

/** Month number when this employee hits their annual review (joining month + 11) */
const reviewMonth = (joiningDate: string) => {
  const d = new Date(joiningDate);
  return (d.getMonth() + 11) % 12;   // 11 months later
};

/** True if this record's review falls in the given month/year */
const isDueIn = (joiningDate: string, targetMonth: number, targetYear: number) => {
  const joined   = new Date(joiningDate);
  const dueMonth = (joined.getMonth() + 11) % 12;
  const dueYear  = joined.getFullYear() + (joined.getMonth() + 11 >= 12 ? 1 : 0);
  return dueMonth === targetMonth && dueYear === targetYear;
};

/** True if employee joined in last 12 months (eligible for revision cycle) */
const isEligible = (joiningDate: string) => {
  const joined   = new Date(joiningDate);
  const now      = new Date();
  const diff     = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  return diff >= 0 && diff <= 12;
};

const avgPms = (scores: PmsScore[]) => {
  if (!scores.length) return null;
  return Math.round(scores.reduce((s, p) => s + p.score, 0) / scores.length * 10) / 10;
};

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: RevisionStage }) {
  const done   = stage === 'completed';
  const onHold = stage === 'on_hold';
  return (
    <Chip
      size="small"
      icon={done ? <CheckCircleIcon fontSize="small" /> : <HourglassEmptyIcon fontSize="small" />}
      label={
        done ? 'Completed' :
        onHold ? 'On Hold (PIP)' :
        stage === 'pending_manager' ? 'Pending Manager' : 'Pending Management'
      }
      sx={{
        bgcolor    : done ? '#ECFDF5' : onHold ? '#FEF3C7' : '#EFF6FF',
        color      : done ? '#059669' : onHold ? '#D97706' : '#2563EB',
        fontWeight : 600, fontSize: 11,
        border     : `1px solid ${done ? '#6EE7B7' : onHold ? '#FCD34D' : '#BFDBFE'}`,
        '& .MuiChip-icon': { color: 'inherit', ml: '6px' },
      }}
    />
  );
}

function DecisionChip({ decision }: { decision: RevisionDecision }) {
  if (!decision) return <Chip size="small" label="Pending" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontSize: 11 }} />;
  return (
    <Chip
      size="small"
      icon={decision === 'increment' ? <TrendingUpIcon fontSize="small" /> : <PauseCircleIcon fontSize="small" />}
      label={decision === 'increment' ? 'Increment' : 'PIP'}
      sx={{
        bgcolor    : decision === 'increment' ? '#ECFDF5' : '#FEF2F2',
        color      : decision === 'increment' ? '#059669' : '#DC2626',
        fontWeight : 700, fontSize: 11,
        border     : `1px solid ${decision === 'increment' ? '#6EE7B7' : '#FECACA'}`,
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

// ─── Month picker strip ───────────────────────────────────────────────────────

function MonthStrip({
  selectedMonth, selectedYear,
  onChange,
}: {
  selectedMonth: number;
  selectedYear : number;
  onChange     : (month: number, year: number) => void;
}) {
  const now = new Date();

  // Build last 12 month slots
  const months: { month: number; year: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear(), label: MONTHS_SHORT[d.getMonth()] });
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {months.map(m => {
        const active = m.month === selectedMonth && m.year === selectedYear;
        return (
          <Button
            key={`${m.year}-${m.month}`}
            size="small"
            variant={active ? 'contained' : 'outlined'}
            onClick={() => onChange(m.month, m.year)}
            sx={{
              minWidth: 56, fontSize: 12, textTransform: 'none', py: 0.5,
              bgcolor    : active ? '#2563EB' : 'transparent',
              borderColor: active ? '#2563EB' : '#D1D5DB',
              color      : active ? 'white'   : '#6B7280',
              '&:hover'  : { bgcolor: active ? '#1D4ED8' : '#F3F4F6', borderColor: '#2563EB' },
            }}
          >
            {m.label}<br />
            <span style={{ fontSize: 10 }}>{m.year}</span>
          </Button>
        );
      })}
    </Box>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, loading, onSelect }: {
  records : SalaryRevision[];
  loading : boolean;
  onSelect: (r: SalaryRevision) => void;
}) {
  const now           = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [showAll,  setShowAll]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [deptFilter,  setDeptFilter]  = useState('All');
  const [desgFilter,  setDesgFilter]  = useState('All');

  const depts = ['All', ...Array.from(new Set(records.map(r => r.department).filter(Boolean)))];
  const desgs = ['All', ...Array.from(new Set(records.map(r => r.designation).filter(Boolean)))];

  const filtered = records.filter(r => {
    if (!isEligible(r.joiningDate)) return false;
    const monthMatch = showAll || isDueIn(r.joiningDate, selMonth, selYear);
    const searchMatch =
      !search ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(search.toLowerCase());
    const deptMatch = deptFilter === 'All' || r.department === deptFilter;
    const desgMatch = desgFilter === 'All' || r.designation === desgFilter;
    return monthMatch && searchMatch && deptMatch && desgMatch;
  });

  const counts = {
    total      : filtered.length,
    pending    : filtered.filter(r => r.stage !== 'completed').length,
    increment  : filtered.filter(r => r.managerDecision?.decision === 'increment').length,
    pip        : filtered.filter(r => r.managerDecision?.decision === 'pip').length,
    completed  : filtered.filter(r => r.stage === 'completed').length,
  };

  const STATS = [
    { label: 'Total',      value: counts.total,     color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Pending',    value: counts.pending,   color: '#D97706', bg: '#FFFBEB' },
    { label: 'Increment',  value: counts.increment, color: '#059669', bg: '#ECFDF5' },
    { label: 'PIP',        value: counts.pip,       color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Completed',  value: counts.completed, color: '#7C3AED', bg: '#F5F3FF' },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3, color: '#1F2937' }}>
        Salary Revision — {showAll ? 'All Eligible Employees' : `${MONTHS_SHORT[selMonth]} ${selYear}`}
      </Typography>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <Box key={s.label} sx={{
            flex: '1 1 120px', p: 2, borderRadius: 2,
            bgcolor: s.bg, border: `1px solid ${s.color}30`,
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
          }}>
            <Typography fontSize={28} fontWeight={800} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography fontSize={12} color="text.secondary" mt={0.5}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Month strip */}
      {!showAll && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={1}>
            Select month to view upcoming salary revisions
          </Typography>
          <MonthStrip
            selectedMonth={selMonth}
            selectedYear={selYear}
            onChange={(m, y) => { setSelMonth(m); setSelYear(y); }}
          />
        </Box>
      )}

      {/* Filters */}
      <Box sx={{
        display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', p: 2,
        bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB',
        alignItems: 'center',
      }}>
        <TextField
          size="small" placeholder="Search employee..." value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }}
          InputProps={{ sx: { fontSize: 14 } }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 13 }}>Department</InputLabel>
          <Select value={deptFilter} label="Department" onChange={e => setDeptFilter(e.target.value)} sx={{ fontSize: 13 }}>
            {depts.map(d => <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 13 }}>Designation</InputLabel>
          <Select value={desgFilter} label="Designation" onChange={e => setDesgFilter(e.target.value)} sx={{ fontSize: 13 }}>
            {desgs.map(d => <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        <Button
          variant={showAll ? 'contained' : 'outlined'} size="small"
          onClick={() => setShowAll(!showAll)}
          sx={{
            fontSize: 13, textTransform: 'none',
            bgcolor: showAll ? '#2563EB' : 'transparent',
            color: showAll ? 'white' : '#2563EB', borderColor: '#2563EB',
          }}
        >
          {showAll ? 'Show Selected Month' : 'Show All Eligible'}
        </Button>

        <Button
          variant="outlined" size="small"
          onClick={() => { setSearch(''); setDeptFilter('All'); setDesgFilter('All'); setShowAll(false); }}
          sx={{ fontSize: 13, textTransform: 'none' }}
        >
          Reset
        </Button>
      </Box>

      {/* Info banner */}
      <Box sx={{ mb: 3, p: 2, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 2, fontSize: 13, color: '#1E40AF' }}>
        <strong>How it works:</strong> Employees who joined 11 months ago have their salary revision due this month.
        Each month strip shows who's coming up. Click an employee to begin the revision process.
      </Box>

      {/* Table */}
      <Box sx={{
        bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB',
        overflow: 'hidden', maxHeight: '560px', display: 'flex', flexDirection: 'column',
      }}>
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
                  <TableCell>Review Due</TableCell>
                  <TableCell>Prev. CTC</TableCell>
                  <TableCell>Avg PMS</TableCell>
                  <TableCell>Decision</TableCell>
                  <TableCell>Final Incr %</TableCell>
                  <TableCell>New CTC</TableCell>
                  <TableCell>Stage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 8, color: 'text.secondary', fontSize: 14 }}>
                      No salary revisions found for this period
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map(r => {
                  const joined   = new Date(r.joiningDate);
                  const dueDate  = new Date(joined.getFullYear(), joined.getMonth() + 11, joined.getDate());
                  const avg      = avgPms(r.pmsScores);
                  return (
                    <TableRow
                      key={r._id}
                      onClick={() => onSelect(r)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#E0F2FE', '& td': { color: '#0C4A6E' } },
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#7C3AED', fontSize: 12, fontWeight: 700 }}>
                            {initials(r.employeeName)}
                          </Avatar>
                          <Box>
                            <Typography fontSize={13} fontWeight={600}>{r.employeeName}</Typography>
                            <Typography fontSize={11} color="text.secondary">{r.employeeCode}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{r.department   || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{r.designation  || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{fmtDate(r.joiningDate)}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{fmtDate(dueDate.toISOString())}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{fmtCurrency(r.previousCtc)}</TableCell>
                      <TableCell>
                        {avg != null
                          ? <Chip label={avg} size="small" sx={{ fontWeight: 700, bgcolor: '#F5F3FF', color: '#7C3AED' }} />
                          : '—'}
                      </TableCell>
                      <TableCell><DecisionChip decision={r.managerDecision?.decision} /></TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {r.finalIncrementPct != null
                          ? <Chip label={`${r.finalIncrementPct}%`} size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 700 }} />
                          : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                        {fmtCurrency(r.newCtc)}
                      </TableCell>
                      <TableCell><StageChip stage={r.stage} /></TableCell>
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

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({ record, onBack, onAction }: {
  record  : SalaryRevision;
  onBack  : () => void;
  onAction: () => void;
}) {
  const avg = avgPms(record.pmsScores);
  const joined   = new Date(record.joiningDate);
  const dueDate  = new Date(joined.getFullYear(), joined.getMonth() + 11, joined.getDate());

  const INFO = [
    ['Employee Code',     record.employeeCode   || '—'],
    ['Email',             record.email          || '—'],
    ['Department',        record.department     || '—'],
    ['Designation',       record.designation    || '—'],
    ['Category',          record.category       || '—'],
    ['Joining Date',      fmtDate(record.joiningDate)],
    ['Review Due',        fmtDate(dueDate.toISOString())],
    ['Applicable Date',   fmtDate(record.applicableDate)],
    ['Previous CTC',      fmtCurrency(record.previousCtc)],
    ['New CTC',           fmtCurrency(record.newCtc)],
    ['Final Increment %', record.finalIncrementPct != null ? `${record.finalIncrementPct}%` : '—'],
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#F3F4F6', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Avatar sx={{ width: 48, height: 48, bgcolor: '#7C3AED', fontWeight: 700, fontSize: 18 }}>
          {initials(record.employeeName)}
        </Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="1.1rem">{record.employeeName}</Typography>
          <Typography fontSize={13} color="text.secondary">{record.designation} · {record.department}</Typography>
        </Box>
        <DecisionChip decision={record.managerDecision?.decision} />
        <StageChip stage={record.stage} />
        {record.stage !== 'completed' && record.stage !== 'on_hold' && (
          <Button variant="contained" size="small" onClick={onAction}
            sx={{ bgcolor: '#7C3AED', textTransform: 'none', fontWeight: 600, px: 3, '&:hover': { bgcolor: '#6D28D9' } }}>
            {record.stage === 'pending_manager' ? 'Manager Action' : 'Management Action'}
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>

        {/* Employee info */}
        <Paper variant="outlined" sx={{ flex: '1 1 260px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Employee Information</Typography>
          <Stack spacing={1.4}>
            {INFO.map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography fontSize={13} color="text.secondary">{label}</Typography>
                <Typography fontSize={13} fontWeight={500} textAlign="right">{value}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        {/* PMS Scores */}
        <Paper variant="outlined" sx={{ flex: '1 1 220px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>PMS Scores</Typography>
          {record.pmsScores.length === 0 ? (
            <Typography fontSize={13} color="text.disabled">No PMS scores recorded</Typography>
          ) : (
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
                <Chip label={avg ?? '—'} size="small" sx={{ bgcolor: '#7C3AED', color: 'white', fontWeight: 700 }} />
              </Box>
            </Stack>
          )}
        </Paper>

        {/* Decisions */}
        <Paper variant="outlined" sx={{ flex: '1 1 300px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Decision Summary</Typography>
          <Stack spacing={2}>

            {/* Manager */}
            <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Manager Decision</Typography>
              {record.managerDecision?.decision ? (
                <>
                  <DecisionChip decision={record.managerDecision.decision} />
                  {record.managerDecision.decision === 'increment' && record.managerDecision.recommendedPct != null && (
                    <Chip label={`Recommended: ${record.managerDecision.recommendedPct}%`}
                      size="small" sx={{ mt: 1, ml: 0.5, bgcolor: '#ECFDF5', color: '#059669' }} />
                  )}
                  {record.managerDecision.decision === 'pip' && (
                    <>
                      {record.managerDecision.pipDurationMonths != null && (
                        <Chip label={`Duration: ${record.managerDecision.pipDurationMonths} months`}
                          size="small" sx={{ mt: 1, ml: 0.5, bgcolor: '#FEF2F2', color: '#DC2626' }} />
                      )}
                      {record.managerDecision.pipNewDueDate && (
                        <Typography fontSize={12} mt={0.5} color="text.secondary">
                          New due: {fmtDate(record.managerDecision.pipNewDueDate)}
                        </Typography>
                      )}
                    </>
                  )}
                  <Typography fontSize={13} mt={1}>{record.managerDecision.reason}</Typography>
                </>
              ) : (
                <Typography fontSize={13} color="text.disabled">Pending</Typography>
              )}
            </Box>

            {/* Management */}
            <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Management Decision</Typography>
              {record.managementDecision?.finalPct != null || record.managementDecision?.pipApproved != null ? (
                <>
                  {record.managementDecision.finalPct != null && (
                    <Chip label={`Final: ${record.managementDecision.finalPct}%`}
                      size="small" sx={{ bgcolor: '#7C3AED', color: 'white', fontWeight: 700 }} />
                  )}
                  {record.managementDecision.pipApproved != null && (
                    <Chip
                      label={record.managementDecision.pipApproved ? 'PIP Approved' : 'PIP Not Approved'}
                      size="small"
                      sx={{
                        bgcolor: record.managementDecision.pipApproved ? '#FEF2F2' : '#ECFDF5',
                        color  : record.managementDecision.pipApproved ? '#DC2626' : '#059669',
                        fontWeight: 700,
                      }}
                    />
                  )}
                  <Typography fontSize={13} mt={1}>{record.managementDecision.reason}</Typography>
                </>
              ) : (
                <Typography fontSize={13} color="text.disabled">
                  {record.stage === 'pending_manager' ? 'Waiting for manager' : 'Pending'}
                </Typography>
              )}
            </Box>

            {/* Final CTC block */}
            {record.newCtc != null && (
              <Box sx={{ p: 2, bgcolor: '#ECFDF5', borderRadius: 1.5, border: '1px solid #6EE7B7' }}>
                <Typography fontSize={11} fontWeight={700} color="#059669" mb={1}>Final Salary</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontSize={13} color="text.secondary">Previous CTC</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtCurrency(record.previousCtc)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography fontSize={13} color="text.secondary">Increment</Typography>
                  <Typography fontSize={13} fontWeight={600} color="#059669">+{record.finalIncrementPct}%</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontSize={14} fontWeight={700}>New CTC</Typography>
                  <Typography fontSize={14} fontWeight={700} color="#059669">{fmtCurrency(record.newCtc)}</Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </Paper>
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

  // Shared
  const [reason,    setReason]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Manager-specific
  const [decision,    setDecision]    = useState<'increment' | 'pip'>('increment');
  const [recommendPct, setRecommendPct] = useState<number>(10);
  const [pipMonths,   setPipMonths]   = useState<number>(3);
  const [pipDueDate,  setPipDueDate]  = useState('');
  const [applicableDate, setApplicableDate] = useState(
    record.applicableDate ? new Date(record.applicableDate).toISOString().split('T')[0] : ''
  );
  const [category, setCategory] = useState(record.category || 'Employee');

  // Management-specific
  const [mgmtPct, setMgmtPct] = useState<number>(
    record.managerDecision?.recommendedPct ?? 10
  );
  const [pipApproved, setPipApproved] = useState<boolean>(true);

  // Derived: new CTC preview
  const prevCtc    = record.previousCtc || 0;
  const previewCtc = decision === 'increment' && isManagerTurn
    ? Math.round(prevCtc * (1 + recommendPct / 100))
    : isManagementTurn && record.managerDecision?.decision === 'increment'
    ? Math.round(prevCtc * (1 + mgmtPct / 100))
    : null;

  // Auto-calc PIP new due date when months change
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
          This employee is currently on a PIP. The revision will re-open on{' '}
          <strong>{fmtDate(record.reviewDate)}</strong>.
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
      let payload: any = { reason, applicableDate: applicableDate || null, category };

      if (isManagerTurn) {
        payload.decision = decision;
        if (decision === 'increment') {
          payload.recommendedPct = recommendPct;
        } else {
          payload.pipDurationMonths = pipMonths;
          payload.pipNewDueDate     = pipDueDate || null;
        }
      } else {
        if (record.managerDecision?.decision === 'increment') {
          payload.finalPct = mgmtPct;
        } else {
          payload.pipApproved = pipApproved;
        }
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

      {/* Manager recommendation preview (for management turn) */}
      {isManagementTurn && record.managerDecision?.decision && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Manager recommended:{' '}
          <strong>{record.managerDecision.decision === 'increment'
            ? `${record.managerDecision.recommendedPct}% increment`
            : `PIP — ${record.managerDecision.pipDurationMonths} months`}
          </strong>
          {' — '}{record.managerDecision.reason}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 2 }} variant="outlined">
        <Stack spacing={3}>

          {/* Employee editable info */}
          <Box>
            <Typography fontSize={13} fontWeight={700} mb={2} color="text.secondary">EMPLOYEE DETAILS</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Applicable Date" type="date" size="small"
                value={applicableDate}
                onChange={e => setApplicableDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Date from which increment is effective"
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

          {/* Auto-fetched info */}
          <Box>
            <Typography fontSize={13} fontWeight={700} mb={2} color="text.secondary">AUTO-FETCHED INFO</Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {[
                ['Dept.',        record.department  || '—'],
                ['Designation',  record.designation || '—'],
                ['Email',        record.email       || '—'],
                ['Previous CTC', fmtCurrency(record.previousCtc)],
                ['Avg PMS',      avgPms(record.pmsScores) != null ? String(avgPms(record.pmsScores)) : '—'],
              ].map(([l, v]) => (
                <Box key={l} sx={{ px: 2, py: 1.5, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB', minWidth: 120 }}>
                  <Typography fontSize={11} color="text.secondary">{l}</Typography>
                  <Typography fontSize={13} fontWeight={600}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Divider />

          {/* Decision */}
          {isManagerTurn && (
            <Box>
              <Typography fontSize={13} fontWeight={700} mb={2} color="text.secondary">DECISION</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                {(['increment', 'pip'] as const).map(opt => (
                  <Button
                    key={opt}
                    variant={decision === opt ? 'contained' : 'outlined'}
                    startIcon={opt === 'increment' ? <TrendingUpIcon /> : <PauseCircleIcon />}
                    onClick={() => setDecision(opt)}
                    sx={{
                      textTransform: 'none', fontWeight: 600,
                      bgcolor: decision === opt
                        ? (opt === 'increment' ? '#059669' : '#DC2626')
                        : 'transparent',
                      borderColor: opt === 'increment' ? '#059669' : '#DC2626',
                      color: decision === opt ? 'white' : (opt === 'increment' ? '#059669' : '#DC2626'),
                      '&:hover': {
                        bgcolor: opt === 'increment' ? '#047857' : '#B91C1C',
                        color: 'white',
                      },
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
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#ECFDF5', borderRadius: 1.5, border: '1px solid #6EE7B7', maxWidth: 400 }}>
                      <Typography fontSize={12} color="text.secondary">New CTC preview</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'center' }}>
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

          {/* Management-specific controls */}
          {isManagementTurn && (
            <Box>
              <Typography fontSize={13} fontWeight={700} mb={2} color="text.secondary">MANAGEMENT RECOMMENDATION</Typography>

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
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#F5F3FF', borderRadius: 1.5, border: '1px solid #DDD6FE', maxWidth: 400 }}>
                      <Typography fontSize={12} color="text.secondary">Final CTC</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'center' }}>
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
                  <Typography fontSize={13} mb={1}>Approve PIP?</Typography>
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

          {/* Reason */}
          <TextField
            label="Reason / Comments *" multiline rows={4}
            value={reason} onChange={e => setReason(e.target.value)}
            fullWidth placeholder="Please explain your decision..."
          />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
            <Button
              variant="contained" onClick={submit}
              disabled={submitting || !reason.trim()}
              sx={{ minWidth: 180, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
            >
              {submitting ? <CircularProgress size={22} /> : `Submit ${roleLabel} Decision`}
            </Button>
            <Button variant="outlined" onClick={onBack}>Cancel</Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail' | 'action';

export default function SalaryRevisionPage() {
  const [records,  setRecords]  = useState<SalaryRevision[]>([]);
  const [selected, setSelected] = useState<SalaryRevision | null>(null);
  const [view,     setView]     = useState<View>('dashboard');
  const [loading,  setLoading]  = useState(true);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') =>
    setToastMsg({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await axios.get(API);
      const data = res.data;
      setRecords(Array.isArray(data) ? data : data?.data || []);
    } catch {
      showToast('Failed to load salary revision records', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelect = (r: SalaryRevision) => { setSelected(r); setView('detail'); };

  const handleBack = () => {
    if (view === 'action') { setView('detail'); }
    else { setView('dashboard'); setSelected(null); }
  };

  const handleSuccess = (updated: SalaryRevision) => {
    setRecords(prev => prev.map(r => r._id === updated._id ? updated : r));
    setSelected(updated);
    setView('detail');
  };

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
              <DashboardView records={records} loading={loading} onSelect={handleSelect} />
            )}

            {view === 'detail' && selected && (
              <DetailView record={selected} onBack={handleBack} onAction={() => setView('action')} />
            )}

            {view === 'action' && selected && (
              <DecisionFormView
                record={selected}
                onBack={handleBack}
                onSuccess={handleSuccess}
                showToast={showToast}
              />
            )}

          </Box>
        </main>
      </div>
    </div>
  );
}