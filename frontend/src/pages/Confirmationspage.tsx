import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, 
  DialogActions, RadioGroup, FormControlLabel, Radio,
} from '@mui/material';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import FilterListIcon     from '@mui/icons-material/FilterList';
import axios              from 'axios';

import Sidebar from '../components/Sidebar';
import Navbar   from '../components/Navbar';

// ─── Types ─────────────────────────────────────────────────────────────────────

type CurrentStatus   = 'probation' | 'confirmed' | 'extended' | 'not_confirmed' | 'pip';
type Stage           = 'hr_pending' | 'pending_manager' | 'pending_management' | 'completed' | 'closed';
type ProbationStatus = 'probation' | 'confirmed' | 'not_applicable' | null;
type UserRole        = 'hr' | 'manager' | 'management' | 'admin';

interface HistoryEntry {
  stage         : Stage;
  status        : CurrentStatus;
  reason        : string;
  monthsExtended: number | null;
  newReviewDate : string | null;
  changedBy     : string;
  changedByName : string;
  changedByRole : UserRole;
  date          : string;
}

interface Decision {
  stage         : Stage;
  status        : CurrentStatus | null;
  reason        : string;
  monthsExtended: number | null;
  newReviewDate : string | null;
  submittedAt   : string | null;
  submittedBy   : string;
  submittedByRole: UserRole;
}

interface PIPDetails {
  duration      : number; // months
  startDate     : string;
  endDate       : string;
  reviewDate    : string;
  reason        : string;
}

interface Confirmation {
  _id               : string;
  employeeCode      : string;
  employeeName      : string;
  department        : string;
  designation       : string;
  joiningDate       : string;
  level             : number;
  email             : string;
  reportingManager  : string;
  currentStatus     : CurrentStatus;
  stage             : Stage;
  hrDecision        : Decision | null;
  managerDecision   : Decision | null;
  managementDecision: Decision | null;
  history           : HistoryEntry[];
  pipDetails        : PIPDetails | null;
  extendedMonths    : number | null;
  extendedTill      : string | null;
  reviewDate        : string | null;
  createdAt         : string;
  updatedAt         : string;
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
  level            : number;
  reporting_manager: string;
  probation_status : ProbationStatus;
}

// Role Master interface for fetching reporting managers
interface RoleMaster {
  _id              : string;
  dept_id          : number;
  department       : string;
  desig_id         : number;
  designation      : string;
  reporting_manager: string;
  // ... other fields
}

// ─── Config ────────────────────────────────────────────────────────────────────

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const API      = API_BASE + '/confirmations';
const EMP_API  = API_BASE + '/employees';
const ROLES_API = API_BASE + '/roles';

const STATUS_CFG: Record<CurrentStatus, { label: string; color: string; bg: string }> = {
  probation     : { label: 'On Probation'      , color: '#D97706', bg: '#FEF3C7' },
  confirmed     : { label: 'Confirmed'        , color: '#059669', bg: '#ECFDF5' },
  extended      : { label: 'Extended'         , color: '#2563EB', bg: '#EFF6FF' },
  not_confirmed : { label: 'Not Confirmed'    , color: '#DC2626', bg: '#FEF2F2' },
  pip           : { label: 'On PIP'           , color: '#7C3AED', bg: '#F3E8FF' },
};

const STAGE_CFG: Record<Stage, { label: string }> = {
  hr_pending         : { label: 'HR Pending'         },
  pending_manager    : { label: 'Pending Manager'    },
  pending_management : { label: 'Pending Management' },
  completed          : { label: 'Completed'          },
  closed             : { label: 'Closed'             },
};

const STATUS_OPTIONS: { value: CurrentStatus; label: string }[] = [
  { value: 'probation',     label: 'Continue Probation' },
  { value: 'confirmed',     label: 'Confirm'            },
  { value: 'extended',      label: 'Extend Probation'   },
  { value: 'not_confirmed', label: 'Not Confirmed'      },
];

const TH = {
  fontWeight: 700, fontSize: 12, color: 'text.secondary',
  bgcolor: '#f9fafb', whiteSpace: 'nowrap' as const,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

/** Full months between joining date and today. Negative = future joiner. */
const monthsAgo = (joiningDate: string): number => {
  const joined = new Date(joiningDate);
  const now    = new Date();
  return (now.getFullYear() - joined.getFullYear()) * 12
       + (now.getMonth()    - joined.getMonth());
};

const calculateReviewDate = (joiningDate?: string | null) => {
  if (!joiningDate) return null;
  try {
    const d = new Date(joiningDate);
    if (isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + 6);
    return d;
  } catch { return null; }
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: CurrentStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.probation;
  return (
    <Chip size="small" label={c.label}
      sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11, border: `1px solid ${c.color}30` }} />
  );
}

function StageChip({ stage }: { stage: Stage }) {
  const done   = stage === 'completed';
  const closed = stage === 'closed';
  return (
    <Chip
      size="small"
      label={STAGE_CFG[stage]?.label || stage}
      sx={{
        bgcolor   : done ? '#ECFDF5' : closed ? '#F3F4F6' : '#EFF6FF',
        color     : done ? '#059669' : closed ? '#6B7280' : '#2563EB',
        fontWeight: 600, fontSize: 11,
        border    : `1px solid ${done ? '#6EE7B7' : closed ? '#D1D5DB' : '#BFDBFE'}`,
        '& .MuiChip-icon': { color: 'inherit', ml: '6px' },
      }}
    />
  );
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        {msg}
      </Alert>
    </Box>
  );
}

// ─── Probation Confirmation Dialog ────────────────────────────────────────────

function HRDecisionDialog({ 
  employee, 
  open, 
  onClose, 
  onConfirm 
}: {
  employee: Employee | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (isOnProbation: boolean, reason: string) => void;
}) {
  const [selection, setSelection] = useState<'yes' | 'no' | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selection) return;
    
    setSubmitting(true);
    try {
      await onConfirm(selection === 'yes', reason);
      onClose();
    } catch (error) {
      console.error('Error updating probation status:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
        HR Probation Decision
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography sx={{ mb: 3, fontSize: '0.95rem' }}>
            Is <strong>{employee.full_name}</strong> ({employee.designation}) currently on probation?
          </Typography>
          
          <RadioGroup value={selection} onChange={(e) => setSelection(e.target.value as 'yes' | 'no')}>
            <FormControlLabel 
              value="yes" 
              control={<Radio />} 
              label="Yes, employee is on probation (joined in last 6 months)" 
              sx={{ mb: 1 }}
            />
            <FormControlLabel 
              value="no" 
              control={<Radio />} 
              label="No, employee is not on probation" 
            />
          </RadioGroup>

          <TextField
            fullWidth
            label="Reason/Notes"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Provide reason for this decision..."
          />

          {selection === 'no' && (
            <Alert severity="info" sx={{ mt: 2, fontSize: '0.85rem' }}>
              This employee's confirmation entry will be closed and marked as non-editable.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }} disabled={submitting}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleConfirm} 
          disabled={!selection || submitting}
          sx={{ textTransform: 'none', px: 3 }}
        >
          {submitting ? <CircularProgress size={20} /> : 'Submit Decision'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Dashboard View ────────────────────────────────────────────────────────────

function DashboardView({ 
  records, 
  employees, 
  roles,
  loading, 
  onSelect 
}: {
  records  : Confirmation[];
  employees: Employee[];
  roles    : RoleMaster[];
  loading  : boolean;
  onSelect : (emp: Employee) => void;
}) {
  const [search, setSearch] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('current'); // 'current' | 'all'

  // Get reporting manager from role master based on designation
  const getReportingManager = (designation: string): string => {
    const role = roles.find(r => r.designation === designation);
    return role?.reporting_manager || '—';
  };

  /**
   * Unified employee list: merge /employees with any confirmation records
   * that don't have a matching employee document (legacy data).
   */
  const allEmployees = React.useMemo(() => {
    const map = new Map();
    
    // First add all employees
    employees.forEach(e => {
      map.set(e._id, e);
    });
    
    // Then add confirmation records that don't have matching employees
    records.forEach(r => {
      if (!map.has(r._id)) {
        map.set(r._id, {
          _id: r._id, 
          employee_id: r.employeeCode, 
          full_name: r.employeeName,
          department: r.department, 
          designation: r.designation, 
          email: r.email,
          joining_date: r.joiningDate, 
          employee_category: '', 
          level: r.level,
          reporting_manager: r.reportingManager,
          probation_status: null,
        } as Employee);
      }
    });
    
    // Convert to array and deduplicate by employee_id
    const result = Array.from(map.values());
    
    // Strong deduplication: keep first occurrence of each employee_id
    const deduplicated = result.filter((emp, index) => 
      result.findIndex(e => e.employee_id === emp.employee_id) === index
    );
    
    // Debug logging
    if (deduplicated.length < result.length) {
      console.log('DEBUG: Removed duplicates:', {
        original: result.length,
        deduplicated: deduplicated.length,
        duplicates: result.length - deduplicated.length
      });
    }
    
    return deduplicated;
  }, [employees, records]);

  /** Apply filters - only show current quarter (0-6 months) or all */
  const filtered = React.useMemo(() => {
    console.log('DEBUG: Filtering employees - total employees:', allEmployees.length, 'total records:', records.length);
      console.log('DEBUG: Records details:', records.map(r => ({ 
        name: r.employeeName, 
        status: r.currentStatus, 
        stage: r.stage,
        employeeCode: r.employeeCode 
      })));
      console.log('DEBUG: Employees with confirmed status:', allEmployees.filter(e => e.probation_status === 'confirmed').map(e => e.full_name));
    
    const result = allEmployees.filter(emp => {
      if (!emp.joining_date) return false;

      // Only exclude employees that have completed the HR stage and are in active workflow
      const hasActiveWorkflow = records.some(r => 
        (r._id === emp._id || r.employeeCode === emp.employee_id) &&
        r.stage !== 'hr_pending' && 
        r.stage !== 'closed' &&
        r.stage !== 'completed'
      );
      if (hasActiveWorkflow) {
        console.log('DEBUG: Employee excluded - has active workflow:', emp.full_name, 'stage:', records.find(r => (r._id === emp._id || r.employeeCode === emp.employee_id))?.stage);
        return false;
      }

      const mo = monthsAgo(emp.joining_date);
      if (mo < 0) return false; // skip future joiners

      // Quarter filter: current quarter = 0-6 months ago (all employees in last 6 months)
      if (quarterFilter === 'current') {
        if (mo < 0 || mo > 6) return false;
      }

      // Text search
      const q = search.toLowerCase();
      if (q && !emp.full_name.toLowerCase().includes(q) && !emp.employee_id.toLowerCase().includes(q))
        return false;

      return true;
    }).sort((a, b) => {
      // Sort by joining date ascending (oldest first = probation due first)
      const dateA = a.joining_date ? new Date(a.joining_date).getTime() : 0;
      const dateB = b.joining_date ? new Date(b.joining_date).getTime() : 0;
      return dateA - dateB;
    });
    
    console.log('DEBUG: Filtered result:', result.length, 'employees');
    return result;
  }, [allEmployees, quarterFilter, search, records]);

  const counts = React.useMemo(() => ({
    total       : filtered.length,
    confirmed   : records.filter(r => r.currentStatus === 'confirmed').length,
    extended    : records.filter(r => r.currentStatus === 'extended').length,
    notConfirmed: records.filter(r => r.currentStatus === 'not_confirmed').length,
    pending     : filtered.length - records.filter(r => 
      r.currentStatus === 'confirmed' || 
      r.currentStatus === 'not_confirmed'
    ).length,
  }), [filtered, records]);

  const STATS = [
    { label: 'Total Employees', value: counts.total,        color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Pending Review',  value: counts.pending,      color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Confirmed',       value: counts.confirmed,    color: '#059669', bg: '#ECFDF5' },
    { label: 'Extended',        value: counts.extended,     color: '#D97706', bg: '#FFFBEB' },
    { label: 'Not Confirmed',   value: counts.notConfirmed, color: '#DC2626', bg: '#FEF2F2' },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1F2937">Probation Confirmations</Typography>
        <Typography fontSize={13} color="text.secondary" mt={0.5}>
          {quarterFilter === 'current' 
            ? 'Employees who joined in the last 6 months' 
            : 'All employees'}
        </Typography>
      </Box>

      {/* ── Stats ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <Box key={s.label} sx={{
            flex: '1 1 130px', p: 2, borderRadius: 2, bgcolor: s.bg,
            border: `1px solid ${s.color}30`,
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.09)' },
          }}>
            <Typography fontSize={28} fontWeight={800} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography fontSize={12} color="text.secondary" mt={0.5}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* ── Filters ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ fontSize: 13 }}>Time Filter</InputLabel>
          <Select
            value={quarterFilter}
            label="Time Filter"
            onChange={e => setQuarterFilter(e.target.value)}
            sx={{ fontSize: 13 }}
          >
            <MenuItem value="current" sx={{ fontSize: 13 }}>Last 6 Months</MenuItem>
            <MenuItem value="all" sx={{ fontSize: 13 }}>All Employees</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Search by name or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
          InputProps={{ sx: { fontSize: 13 } }}
        />

        <Button
          size="small"
          variant="text"
          onClick={() => {
            setSearch('');
            setQuarterFilter('current');
          }}
          sx={{ fontSize: 13, textTransform: 'none' }}
        >
          Reset Filters
        </Button>
      </Box>

      {/* ── Table ── */}
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={10}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 560, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Designation</TableCell>
                  <TableCell>Reporting Manager</TableCell>
                  <TableCell>Joining Date</TableCell>
                  <TableCell>Months In</TableCell>
                  <TableCell>Confirmation Status</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Review Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.disabled', fontSize: 13 }}>
                      No employees match the current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(emp => {
                    const confirmationRecord = records.find(r => r._id === emp._id);
                    const mo = emp.joining_date ? monthsAgo(emp.joining_date) : null;
                    // Highlight rows where confirmation is imminent (5-7 months in)
                    const isDue = mo !== null && mo >= 5 && mo <= 7;

                    return (
                      <TableRow
                        key={emp._id}
                        hover
                        onClick={() => onSelect(emp)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: isDue ? '#FEF9C3' : 'inherit',
                          '&:hover': { bgcolor: isDue ? '#FEF08A' : '#F0F9FF' },
                        }}
                      >
                        {/* Employee name + ID */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 30, height: 30, bgcolor: '#E0E7FF', color: '#4338CA', fontSize: 11, fontWeight: 700 }}>
                              {initials(emp.full_name)}
                            </Avatar>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                                  {emp.full_name}
                                </Typography>
                                {emp.probation_status === 'confirmed' && (
                                  <Chip size="small" label="Confirmed"
                                    sx={{ bgcolor: '#059669', color: '#fff', fontWeight: 700, fontSize: 10,
                                          height: 18, '& .MuiChip-label': { px: 0.8 } }} />
                                )}
                                {isDue && (
                                  <Chip size="small" label="Due"
                                    sx={{ bgcolor: '#F59E0B', color: '#fff', fontWeight: 700, fontSize: 10,
                                          height: 18, '& .MuiChip-label': { px: 0.8 } }} />
                                )}
                              </Box>
                              <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>{emp.employee_id}</Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>{emp.department}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>{emp.designation}</TableCell>
                        
                        {/* Reporting Manager from Role Master */}
                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>
                          {getReportingManager(emp.designation)}
                        </TableCell>

                        {/* Joining Date */}
                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>
                          {emp.joining_date ? fmtDate(emp.joining_date) : '—'}
                        </TableCell>

                        {/* Months In — colour-coded by urgency */}
                        <TableCell>
                          {mo !== null ? (
                            <Box sx={{
                              display: 'inline-block', px: 1, py: 0.3,
                              bgcolor: mo >= 6 ? '#FEF2F2' : mo >= 5 ? '#FEF9C3' : '#F0FDF4',
                              color  : mo >= 6 ? '#DC2626' : mo >= 5 ? '#CA8A04' : '#16A34A',
                              borderRadius: 1, fontSize: 12, fontWeight: 600,
                            }}>
                              {mo} mo
                            </Box>
                          ) : '—'}
                        </TableCell>

                        {/* Confirmation workflow status */}
                        <TableCell>
                          {confirmationRecord
                            ? <StatusChip status={confirmationRecord.currentStatus} />
                            : <Chip size="small" label="Not Started"
                                sx={{ bgcolor: '#F9FAFB', color: '#6B7280', fontWeight: 600, fontSize: 11, border: '1px solid #E5E7EB' }} />
                          }
                        </TableCell>

                        {/* Stage */}
                        <TableCell>
                          {confirmationRecord ? <StageChip stage={confirmationRecord.stage} /> : '—'}
                        </TableCell>

                        {/* Review Due */}
                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>
                          {confirmationRecord?.reviewDate
                            ? fmtDate(confirmationRecord.reviewDate)
                            : emp.joining_date
                              ? fmtDate(calculateReviewDate(emp.joining_date)?.toISOString())
                              : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

// ─── Detail View ───────────────────────────────────────────────────────────────

function DetailView({ record, onBack, onChangeStatus }: {
  record        : Confirmation;
  onBack        : () => void;
  onChangeStatus: () => void;
}) {
  const INFO = [
    ['Employee Code',     record.employeeCode      || '—'],
    ['Email',             record.email             || '—'],
    ['Department',        record.department        || '—'],
    ['Designation',       record.designation       || '—'],
    ['Level',             `L${record.level || 1}`        ],
    ['Joining Date',      fmtDate(record.joiningDate)    ],
    ['Review Due',        record.stage === 'completed' && record.reviewDate
                            ? fmtDate(record.reviewDate)
                            : fmtDate(calculateReviewDate(record.joiningDate)?.toISOString())],
    ['Reporting Manager', record.reportingManager  || '—'],
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#F3F4F6', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Avatar sx={{ width: 48, height: 48, bgcolor: '#3B82F6', fontWeight: 700, fontSize: 18 }}>
          {initials(record.employeeName)}
        </Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="1.1rem">{record.employeeName}</Typography>
          <Typography fontSize={13} color="text.secondary">{record.designation} · {record.department}</Typography>
        </Box>
        <StatusChip status={record.currentStatus} />
        <StageChip  stage={record.stage} />
        {record.stage !== 'completed' && record.stage !== 'closed' && (
          <Button variant="contained" size="small" onClick={onChangeStatus}
            sx={{ bgcolor: '#2563EB', textTransform: 'none', fontWeight: 600, px: 3 }}>
            Update Status
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Paper variant="outlined" sx={{ flex: '1 1 280px', borderRadius: 2, p: 3 }}>
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

        <Paper variant="outlined" sx={{ flex: '1 1 260px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Final Decision</Typography>
          <Stack spacing={2}>
            <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Manager Decision</Typography>
              {record.managerDecision?.status ? (
                <>
                  <StatusChip status={record.managerDecision.status} />
                  <Typography fontSize={13} mt={1}>{record.managerDecision.reason}</Typography>
                  {record.managerDecision.monthsExtended && (
                    <Chip label={`Extended by ${record.managerDecision.monthsExtended} months`}
                      size="small" sx={{ mt: 1, bgcolor: '#FFFBEB', color: '#D97706' }} />
                  )}
                </>
              ) : (
                <Typography fontSize={13} color="text.disabled">Pending</Typography>
              )}
            </Box>

            <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Management Decision</Typography>
              {record.managementDecision?.status ? (
                <>
                  <StatusChip status={record.managementDecision.status} />
                  <Typography fontSize={13} mt={1}>{record.managementDecision.reason}</Typography>
                  {record.managementDecision.monthsExtended && (
                    <Chip label={`Extended by ${record.managementDecision.monthsExtended} months`}
                      size="small" sx={{ mt: 1, bgcolor: '#FFFBEB', color: '#D97706' }} />
                  )}
                </>
              ) : (
                <Typography fontSize={13} color="text.disabled">
                  {record.stage === 'pending_manager' ? 'Waiting for manager' : 'Pending'}
                </Typography>
              )}
            </Box>
          </Stack>

          {record.stage === 'completed' && record.extendedMonths && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#FEF3C7', borderRadius: 1.5, border: '1px solid #FCD34D' }}>
              <Typography fontSize={11} fontWeight={700} color="#D97706" mb={1}>Extension Details</Typography>
              <Stack spacing={1}>
                <Typography fontSize={11} color="#92400E">Extended for {record.extendedMonths} months</Typography>
                {record.extendedTill && <Typography fontSize={11} color="#92400E">Till {fmtDate(record.extendedTill)}</Typography>}
              </Stack>
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ flex: '2 1 380px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Change History</Typography>
          {record.history.length === 0 ? (
            <Typography color="text.disabled" fontSize={13}>No history recorded yet.</Typography>
          ) : (
            <Stack spacing={2.5}>
              {[...record.history].reverse().map((h, i) => (
                <Box key={i} sx={{ borderLeft: `4px solid ${STATUS_CFG[h.status]?.color || '#9CA3AF'}`, pl: 2, py: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <StatusChip status={h.status} />
                    {h.monthsExtended && (
                      <Chip label={`Extended for ${h.monthsExtended} months`} size="small"
                        sx={{ bgcolor: '#FFFBEB', color: '#D97706' }} />
                    )}
                  </Box>
                  <Typography fontSize={13} mt={0.8}>{h.reason || '—'}</Typography>
                  <Typography fontSize={12} color="text.secondary" mt={0.5}>
                    {h.changedByName || h.changedBy} · {fmtDate(h.date)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

// ─── Status Change View ────────────────────────────────────────────────────────

function StatusChangeView({ record, onBack, onSuccess, showToast }: {
  record   : Confirmation;
  onBack   : () => void;
  onSuccess: (updated: Confirmation) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const isManagerTurn    = record.stage === 'pending_manager';
  const isManagementTurn = record.stage === 'pending_management';
  const isHrPending     = record.stage === 'hr_pending';
  const endpoint         = isManagerTurn ? 'manager' : 'management';
  const roleLabel        = isManagerTurn ? 'Manager' : 'Management';

  const [status,         setStatus]         = useState<CurrentStatus>('probation');
  const [reason,         setReason]         = useState('');
  const [monthsExtended, setMonthsExtended] = useState(3);
  const [submitting,     setSubmitting]     = useState(false);

  if (isHrPending) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" mb={2}>This confirmation is pending HR decision.</Typography>
        <Button variant="outlined" onClick={onBack}>Back</Button>
      </Box>
    );
  }

  if (!isManagerTurn && !isManagementTurn) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
          <Typography variant="h6">Confirmation Completed</Typography>
        </Box>
        <Alert severity="info">This employee's probation confirmation process is already completed.</Alert>
      </Box>
    );
  }

  const submit = async () => {
    if (!reason.trim()) return showToast('Please provide a reason', 'error');
    try {
      setSubmitting(true);
      const payload: any = { status, reason };
      if (status === 'extended') payload.monthsExtended = monthsExtended;
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={onBack} sx={{ bgcolor: '#f1f5f9' }}><ArrowBackIcon /></IconButton>
        <Box>
          <Typography variant="h6">{roleLabel} Decision</Typography>
          <Typography variant="body2" color="text.secondary">
            {record.employeeName} — {record.designation}
          </Typography>
        </Box>
      </Box>

      {isManagementTurn && record.managerDecision?.status && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Manager recommended: <strong>{STATUS_CFG[record.managerDecision.status].label}</strong>
          {record.managerDecision.monthsExtended ? ` (+${record.managerDecision.monthsExtended} months)` : ''}
          {' — '}{record.managerDecision.reason}
        </Alert>
      )}

      <Paper sx={{ p: 4, maxWidth: 560, borderRadius: 2 }} variant="outlined">
        <Stack spacing={3}>
          <FormControl fullWidth>
            <InputLabel>Decision</InputLabel>
            <Select value={status} label="Decision" onChange={e => setStatus(e.target.value as CurrentStatus)}>
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {status === 'extended' && (
            <TextField
              label="Extend by (months)" type="number"
              value={monthsExtended}
              onChange={e => setMonthsExtended(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              inputProps={{ min: 1, max: 12 }}
              fullWidth helperText="1–12 months"
            />
          )}

          <TextField
            label="Reason / Comments *" multiline rows={4}
            value={reason} onChange={e => setReason(e.target.value)}
            fullWidth placeholder="Please explain your decision…"
          />

          <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
            <Button variant="contained" onClick={submit} disabled={submitting || !reason.trim()} sx={{ minWidth: 140 }}>
              {submitting ? <CircularProgress size={24} /> : `Submit ${roleLabel} Decision`}
            </Button>
            <Button variant="outlined" onClick={onBack}>Cancel</Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail' | 'status-change';

export default function ConfirmationsPage() {
  const [records,   setRecords]   = useState<Confirmation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles,     setRoles]     = useState<RoleMaster[]>([]);
  const [selected,  setSelected]  = useState<Confirmation | null>(null);
  const [view,      setView]      = useState<View>('dashboard');
  const [loading,   setLoading]   = useState(true);
  const [toastMsg,  setToastMsg]  = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // HR decision dialog state
  const [hrDialog, setHrDialog] = useState<{
    open: boolean;
    employee: Employee | null;
  }>({ open: false, employee: null });

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToastMsg({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Test localStorage functionality
      try {
        localStorage.setItem('test', 'test');
        const testResult = localStorage.getItem('test');
        console.log('DEBUG: localStorage test passed:', testResult === 'test');
        localStorage.removeItem('test');
        
        // Check if confirmed employees are in localStorage
        const confirmedEmployeesStr = localStorage.getItem('confirmedEmployees');
        console.log('DEBUG: Confirmed employees in localStorage:', confirmedEmployeesStr);
        const confirmedEmployees = confirmedEmployeesStr ? JSON.parse(confirmedEmployeesStr) : [];
        console.log('DEBUG: Parsed confirmed employees:', confirmedEmployees);
      } catch (e) {
        console.error('DEBUG: localStorage test failed:', e);
      }
      
      // Fetch employees (excluding archived), roles, and confirmation records in parallel
      const [empRes, rolesRes, confRes] = await Promise.all([
        axios.get(EMP_API + '?archived=false'),
        axios.get(ROLES_API),
        axios.get(API),
      ]);
      const empData   = empRes.data;
      const rolesData = rolesRes.data;
      const confData  = confRes.data;
      
      const apiRecords = Array.isArray(confData)  ? confData  : confData?.data  || [];
      console.log('DEBUG: API records loaded:', apiRecords.length);
      
      // Load local confirmation records from localStorage
      const localRecordsStr = localStorage.getItem('localConfirmationRecords');
      console.log('DEBUG: localStorage raw data:', localRecordsStr);
      const localRecords = localRecordsStr ? JSON.parse(localRecordsStr) : [];
      console.log('DEBUG: Local records parsed:', localRecords.length);
      
      // Merge API records with local records (local records take precedence)
      const allRecords = [...apiRecords, ...localRecords];
      console.log('DEBUG: Total records after merge:', allRecords.length);
      
      const apiEmployees = Array.isArray(empData)   ? empData   : empData?.data   || [];
      
      // Restore confirmed employees from localStorage
      const confirmedEmployeesStr = localStorage.getItem('confirmedEmployees');
      const confirmedEmployees = confirmedEmployeesStr ? JSON.parse(confirmedEmployeesStr) : [];
      
      // Merge API employees with confirmed status updates
      const allEmployees = apiEmployees.map((emp: Employee) => {
        const confirmed = confirmedEmployees.find((c: Employee) => c._id === emp._id || c.employee_id === emp.employee_id);
        return confirmed ? { ...emp, probation_status: 'confirmed' as ProbationStatus } : emp;
      });
      
      console.log('DEBUG: Restored confirmed employees:', confirmedEmployees.length);
      
      setEmployees(allEmployees);
      setRoles    (Array.isArray(rolesData) ? rolesData : rolesData?.data || []);
      setRecords  (allRecords);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEmployeeSelect = (employee: Employee) => {
    // Check if employee is already confirmed
    if (employee.probation_status === 'confirmed') {
      showToast(`${employee.full_name} is already confirmed`, 'info');
      return;
    }
    
    // Check if employee already has confirmation record
    const existingRecord = records.find(r => r._id === employee._id || r.employeeCode === employee.employee_id);
    if (existingRecord) {
      setSelected(existingRecord);
      setView('detail');
      return;
    }
    
    // Open HR decision dialog
    setHrDialog({ open: true, employee });
  };

  const handleHRDecision = async (isOnProbation: boolean, reason: string) => {
    const employee = hrDialog.employee;
    setHrDialog({ open: false, employee: null });
    
    if (!employee) return;
    
    try {
      if (isOnProbation) {
        // Employee is on probation - create confirmation record and proceed to manager stage
        const newRecord = {
          _id: employee._id,
          employeeCode: employee.employee_id,
          employeeName: employee.full_name,
          department: employee.department,
          designation: employee.designation,
          email: employee.email,
          joiningDate: employee.joining_date || new Date().toISOString(),
          level: employee.level,
          reportingManager: employee.reporting_manager,
          currentStatus: 'probation' as CurrentStatus,
          stage: 'pending_manager' as Stage,
          hrDecision: {
            stage: 'hr_pending' as Stage,
            status: 'probation' as CurrentStatus,
            reason: reason,
            monthsExtended: null,
            newReviewDate: null,
            submittedAt: new Date().toISOString(),
            submittedBy: 'HR User',
            submittedByRole: 'hr' as UserRole,
          },
          managerDecision: null,
          managementDecision: null,
          history: [{
            stage: 'hr_pending' as Stage,
            status: 'probation' as CurrentStatus,
            reason: reason,
            monthsExtended: null,
            newReviewDate: null,
            changedBy: 'HR User',
            changedByName: 'HR User',
            changedByRole: 'hr' as UserRole,
            date: new Date().toISOString(),
          }],
          pipDetails: null,
          reviewDate: calculateReviewDate(employee.joining_date)?.toISOString() || null,
          extendedMonths: null,
          extendedTill: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Try to create the confirmation record via API
        try {
          const { data } = await axios.post(API, newRecord);
          if (data.success) {
            const confirmationRecord = data.data;
            setRecords(prev => [...prev, confirmationRecord]);
            setSelected(confirmationRecord);
            setView('detail');
            showToast('Employee marked as on probation - sent to manager for decision', 'success');
          } else {
            throw new Error('Failed to create confirmation record');
          }
        } catch (apiError) {
          console.warn('API not available, creating local record:', apiError);
          // Fallback: Create local confirmation record without backend
          setRecords(prev => [...prev, newRecord]);
          setSelected(newRecord);
          setView('detail');
          
          // Save to localStorage for persistence
          const existingLocalStr = localStorage.getItem('localConfirmationRecords');
          const existingLocal = existingLocalStr ? JSON.parse(existingLocalStr) : [];
          const updatedLocal = [...existingLocal, newRecord];
          localStorage.setItem('localConfirmationRecords', JSON.stringify(updatedLocal));
          
          showToast('Employee marked as on probation - sent to manager for decision (local)', 'info');
        }
        
      } else {
        // Employee is not on probation - close the entry
        const newRecord = {
          _id: employee._id,
          employeeCode: employee.employee_id,
          employeeName: employee.full_name,
          department: employee.department,
          designation: employee.designation,
          email: employee.email,
          joiningDate: employee.joining_date || new Date().toISOString(),
          level: employee.level,
          reportingManager: employee.reporting_manager,
          currentStatus: 'not_confirmed' as CurrentStatus,
          stage: 'closed' as Stage,
          hrDecision: {
            stage: 'hr_pending' as Stage,
            status: 'not_confirmed' as CurrentStatus,
            reason: reason,
            monthsExtended: null,
            newReviewDate: null,
            submittedAt: new Date().toISOString(),
            submittedBy: 'HR User',
            submittedByRole: 'hr' as UserRole,
          },
          managerDecision: null,
          managementDecision: null,
          history: [{
            stage: 'hr_pending' as Stage,
            status: 'not_confirmed' as CurrentStatus,
            reason: reason,
            monthsExtended: null,
            newReviewDate: null,
            changedBy: 'HR User',
            changedByName: 'HR User',
            changedByRole: 'hr' as UserRole,
            date: new Date().toISOString(),
          }],
          pipDetails: null,
          reviewDate: null,
          extendedMonths: null,
          extendedTill: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Try to create the confirmation record via API
        try {
          const { data } = await axios.post(API, newRecord);
          if (data.success) {
            setRecords(prev => [...prev, data.data]);
            showToast('Employee marked as not on probation - entry closed', 'success');
          } else {
            throw new Error('Failed to create confirmation record');
          }
        } catch (apiError) {
          console.warn('API not available, creating local record:', apiError);
          // Fallback: Create local confirmation record without backend
          setRecords(prev => [...prev, newRecord]);
          
          // Save to localStorage for persistence
          const existingLocalStr = localStorage.getItem('localConfirmationRecords');
          const existingLocal = existingLocalStr ? JSON.parse(existingLocalStr) : [];
          const updatedLocal = [...existingLocal, newRecord];
          localStorage.setItem('localConfirmationRecords', JSON.stringify(updatedLocal));
          
          showToast('Employee marked as not on probation - entry closed (local)', 'info');
        }
      }
    } catch (error) {
      console.error('Error in HR decision:', error);
      showToast('Failed to process HR decision', 'error');
    }
  };

  const handleBack = () => {
    if (view === 'status-change') setView('detail');
    else { setView('dashboard'); setSelected(null); }
  };

  const handleStatusUpdate = (updated: Confirmation) => {
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
          <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%', height: '100%', overflow: 'hidden' }}>

            {toastMsg && (
              <Toast msg={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />
            )}

            {/* HR Decision Dialog */}
            <HRDecisionDialog
              employee={hrDialog.employee}
              open={hrDialog.open}
              onClose={() => setHrDialog({ open: false, employee: null })}
              onConfirm={handleHRDecision}
            />

            {view === 'dashboard' && (
              <DashboardView
                records={records}
                employees={employees}
                roles={roles}
                loading={loading}
                onSelect={handleEmployeeSelect}
              />
            )}

            {view === 'detail' && selected && (
              <DetailView record={selected} onBack={handleBack} onChangeStatus={() => setView('status-change')} />
            )}

            {view === 'status-change' && selected && (
              <StatusChangeView record={selected} onBack={handleBack} onSuccess={handleStatusUpdate} showToast={showToast} />
            )}

          </Box>
        </main>
      </div>
    </div>
  );
}