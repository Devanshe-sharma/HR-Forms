import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Autocomplete, Stack, IconButton,
  Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
  Avatar, Tooltip, Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  WorkOff as WorkOffIcon,
  Today as TodayIcon,
  BeachAccess as BeachAccessIcon,
  Search as SearchIcon,
  RestartAlt as RestartAltIcon,
  Check as CheckIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  _id: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  email: string;
  official_email: string;
}

interface CcEmployee { employeeId: string; name: string; email: string }

interface OutOfOfficeRecord {
  _id: string;
  submittedByEmail: string;
  submittedByName: string;
  person: { employeeId?: string; name: string; email: string };
  startDateTime: string;
  upToDate?: string;
  upToTime: string;
  reason: string;
  ccEmployees: CcEmployee[];
  informedStatus: 'advance' | 'late_before_start' | 'late_after_start';
  informedLabel: string;
  plannedStatus: '' | 'Planned' | 'Not Planned';
  lateReason: string;
  unplannedKnownAt?: string;
  createdAt: string;
}

interface LeaveType {
  _id: string;
  name: string;
  code: string;
  color: string;
  approvalMode: 'none' | 'manager' | 'hr' | 'manager_then_hr';
  requiresAllocation: boolean;
  isPaid: boolean;
  allowNegativeBalance: boolean;
  requiresDocument: boolean;
  maxDaysPerRequest: number | null;
  isActive: boolean;
}

interface LeaveBalanceRow {
  leaveTypeId: string;
  name: string;
  code: string;
  color: string;
  isPaid: boolean;
  allowNegativeBalance: boolean;
  requiresDocument: boolean;
  requiresAllocation: boolean;
  maxDaysPerRequest: number | null;
  approvalMode: LeaveType['approvalMode'];
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

type LeaveStatus = 'draft' | 'to_approve' | 'second_approval' | 'approved' | 'refused' | 'cancelled';

interface LeaveDecision { by: string; at: string | null; comment: string }
interface LeaveAuditEntry { action: string; by: string; at: string; fromStatus: string; toStatus: string; note: string }
interface LeaveAllowedActions { canApprove: boolean; canRefuse: boolean; canCancel: boolean }

interface LeaveRequestRecord {
  _id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation?: string;
  leaveTypeId: string;
  dateFrom: string;
  dateTo: string;
  halfDay: { enabled: boolean; session: 'first_half' | 'second_half' | null };
  durationDays: number;
  reason: string;
  document?: { fileName: string; driveLink: string; uploadedAt: string };
  status: LeaveStatus;
  managerDecision?: LeaveDecision;
  hrDecision?: LeaveDecision;
  refusalReason?: string;
  auditLog: LeaveAuditEntry[];
  allowedActions: LeaveAllowedActions;
  mails?: Partial<Record<LeaveMailType, LeaveMailRecord>>;
  mailAction: { type: LeaveMailType; canSend: boolean } | null;
  source?: 'app' | 'odoo_import';
  importBatch?: string;
  createdAt: string;
}

type LeaveMailType = 'submitted' | 'managerApproved' | 'approved' | 'refused' | 'cancelled';
interface LeaveMailRecord { sentAt: string | null; sentBy: string; to: string; cc: string; bcc: string; subject: string }

interface ApprovalsSummary {
  pending: number;
  approvedThisMonth: number;
  refused: number;
  onLeaveToday: number;
  canApprove: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API = `${API_URL}/out-of-office`;
const EMP_API = `${API_URL}/onboarding/eligible-employees`;
const LEAVE_API = `${API_URL}/leave-management`;

const ACCENT = '#4f46e5';
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '10px', borderBottom: '1px solid #e2e8f0' };
const TD = { fontSize: 12, py: '10px', verticalAlign: 'top' as const };
const ELLIPSIS = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' as const };

const informedColor = (s: OutOfOfficeRecord['informedStatus']) => (s === 'advance' ? '#2563eb' : '#dc2626');
const informedShortLabel = (s: OutOfOfficeRecord['informedStatus']) =>
  s === 'advance' ? 'On time' : s === 'late_before_start' ? 'Late (<24h)' : 'Late (after start)';

const fmtDate = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
};

const fmtTime24 = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return String(d); }
};

const fmtDateTime24 = (d?: string | Date | null) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${fmtDate(dt)}, ${fmtTime24(dt)}`;
  } catch { return String(d); }
};

// upToDate is only set when the OOO runs past the start day — same-day
// records (the common case, and every pre-existing one) just show the time.
const fmtUpTo = (upToTime: string, upToDate?: string | null) =>
  upToDate ? `${fmtDate(upToDate)}, ${upToTime}` : upToTime;

const fmtDayMonth = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return String(d); }
};

// Table date column: single date for same-day entries, "start – end" range
// (year only on the end) when upToDate pushes the OOO past the start day —
// the time itself is shown separately, on its own line, in the row below.
const fmtOooDateRange = (startDateTime: string, upToDate?: string | null) => {
  if (!upToDate) return fmtDate(startDateTime);
  const start = new Date(startDateTime);
  const end = new Date(upToDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fmtDate(startDateTime);
  const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  if (sameDay) return fmtDate(startDateTime);
  return `${fmtDayMonth(start)} – ${fmtDate(end)}`;
};

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2 }}>{msg}</Alert>
    </Box>
  );
}

// ─── Out of Office: detail modal ────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography fontSize={11} color="text.secondary">{label}</Typography>
      <Typography fontSize={13} fontWeight={600} sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}

function OutOfOfficeDetailModal({ record, onClose }: { record: OutOfOfficeRecord | null; onClose: () => void }) {
  return (
    <Modal open={!!record} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '92vw', sm: 480 }, maxHeight: '85vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 2, p: 3, outline: 'none' }}>
        {record && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography fontSize={16} fontWeight={700}>Out of Office Details</Typography>
                <Typography fontSize={12} color="text.secondary">Logged {fmtDateTime24(record.createdAt)}</Typography>
              </Box>
              <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <DetailRow label="Person Name" value={record.person.name} />
              <DetailRow label="Person Email" value={record.person.email} />
              <DetailRow label="Out of Office Date" value={fmtDate(record.startDateTime)} />
              <DetailRow label="Start Time – Time Up To" value={`${fmtTime24(record.startDateTime)} – ${fmtUpTo(record.upToTime, record.upToDate)}`} />
            </Box>

            {record.submittedByName && record.submittedByEmail?.toLowerCase() !== record.person.email?.toLowerCase() && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <DetailRow label="Logged By (on behalf of)" value={`${record.submittedByName} <${record.submittedByEmail}>`} />
              </>
            )}

            <Divider sx={{ my: 1.5 }} />
            <DetailRow label="Reason" value={record.reason} />

            <Divider sx={{ my: 1.5 }} />
            <DetailRow label="Informed Before or After Event?" value={
              <Chip size="small" label={record.informedLabel} sx={{ fontSize: 11, height: 'auto', py: 0.5, whiteSpace: 'normal',
                bgcolor: '#f8fafc', color: informedColor(record.informedStatus), border: `1px solid ${informedColor(record.informedStatus)}30` }} />
            } />

            {record.plannedStatus && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <DetailRow label="Planned in Advance?" value={
                  <Chip size="small" label={record.plannedStatus} sx={{ fontSize: 11, height: 20,
                    bgcolor: record.plannedStatus === 'Planned' ? '#fef2f2' : '#f8fafc',
                    color: record.plannedStatus === 'Planned' ? '#dc2626' : '#0f172a' }} />
                } />
                {record.plannedStatus === 'Planned' && (
                  <Typography fontSize={11.5} color="text.secondary" mt={0.5}>
                    A Timeliness escalation was raised automatically for this late filing.
                  </Typography>
                )}
                {record.plannedStatus === 'Not Planned' && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
                    <DetailRow label="Why filed late" value={record.lateReason || '—'} />
                    <DetailRow label="When it was decided" value={fmtDateTime24(record.unplannedKnownAt)} />
                  </Box>
                )}
              </>
            )}

            <Divider sx={{ my: 1.5 }} />
            <DetailRow label="Keep in Cc?" value={
              record.ccEmployees?.length ? record.ccEmployees.map(c => `${c.name} <${c.email}>`).join(', ') : '—'
            } />
          </>
        )}
      </Box>
    </Modal>
  );
}

// ─── Out of Office: dashboard ──────────────────────────────────────────────────

function OutOfOfficeDashboard({ records, loading, onAdd }: {
  records: OutOfOfficeRecord[]; loading: boolean; onAdd: () => void;
}) {
  const [selected, setSelected] = useState<OutOfOfficeRecord | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Local-date key (yyyy-mm-dd) so the <input type="date"> filter compares
  // against the same calendar day the table displays, not a UTC-shifted one.
  const dateKey = (d?: string | Date | null) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter(r => {
      const matchesSearch = !term ||
        r.person.name?.toLowerCase().includes(term) ||
        r.person.email?.toLowerCase().includes(term) ||
        r.reason?.toLowerCase().includes(term) ||
        r.submittedByName?.toLowerCase().includes(term);
      const key = dateKey(r.startDateTime);
      const matchesDate = (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo);
      return matchesSearch && matchesDate;
    });
  }, [records, search, dateFrom, dateTo]);

  const hasActiveFilters = !!(search || dateFrom || dateTo);
  const resetFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Out of Office</Typography>
          <Typography fontSize={12} color="text.secondary">Advance notice of employees working out of office — click a row for full details</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          Log Out of Office
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search name, email, reason…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.75 }} /> }}
          sx={{ minWidth: 240, bgcolor: 'white' }}
        />
        <TextField
          type="date"
          size="small"
          label="From"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: dateTo || undefined }}
          sx={{ bgcolor: 'white' }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: dateFrom || undefined }}
          sx={{ bgcolor: 'white' }}
        />
        {hasActiveFilters && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={resetFilters}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}>
            Reset
          </Button>
        )}
      </Box>

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box> : (
          <TableContainer sx={{ maxHeight: 520, overflowY: 'auto', overflowX: 'hidden' }}>
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell sx={{ width: '16%' }}>Logged</TableCell>
                  <TableCell sx={{ width: '24%' }}>Person</TableCell>
                  <TableCell sx={{ width: '20%' }}>Out of Office Date</TableCell>
                  <TableCell sx={{ width: '20%' }}>Reason</TableCell>
                  <TableCell sx={{ width: '12%' }}>Informed</TableCell>
                  <TableCell sx={{ width: '8%' }}>Cc</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                    {records.length === 0 ? 'No out-of-office records logged yet' : 'No records match the current filters'}
                  </TableCell></TableRow>
                )}
                {filteredRecords.map(r => (
                  <TableRow key={r._id} onClick={() => setSelected(r)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={TD}>{fmtDateTime24(r.createdAt)}</TableCell>
                    <TableCell sx={TD}>
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 12, fontWeight: 600 }}>{r.person.name}</Typography>
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 11, color: 'text.secondary' }}>{r.person.email}</Typography>
                    </TableCell>
                    <TableCell sx={TD}>
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 12, fontWeight: 600 }}>{fmtOooDateRange(r.startDateTime, r.upToDate)}</Typography>
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 11, color: 'text.secondary' }}>{fmtTime24(r.startDateTime)} – {r.upToTime}</Typography>
                    </TableCell>
                    <TableCell sx={TD}>
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 12 }}>{r.reason}</Typography>
                    </TableCell>
                    <TableCell sx={TD}>
                      <Chip size="small" label={informedShortLabel(r.informedStatus)} sx={{ fontSize: 10, height: 20, bgcolor: '#f8fafc', color: informedColor(r.informedStatus), border: `1px solid ${informedColor(r.informedStatus)}30` }} />
                    </TableCell>
                    <TableCell sx={TD}>
                      <Typography fontSize={12}>{r.ccEmployees?.length || '—'}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <OutOfOfficeDetailModal record={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}

// ─── Out of Office: form (popup) ────────────────────────────────────────────────

function OutOfOfficeFormModal({ open, employees, onDone, onClose, showToast }: {
  open: boolean; employees: Employee[]; onDone: () => void; onClose: () => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const { user } = useAuth();

  const submitter = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return employees.find(e =>
      (user?.employeeId && e.employee_id === user.employeeId) ||
      e.official_email?.toLowerCase() === email || e.email?.toLowerCase() === email
    ) || null;
  }, [employees, user]);

  const [loggedAt, setLoggedAt] = useState<Date | null>(null);
  const [person, setPerson] = useState<Employee | null>(null);
  const [oooDate, setOooDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [upToDate, setUpToDate] = useState('');
  const [upToTime, setUpToTime] = useState('');
  const [reason, setReason] = useState('');
  const [ccEmployees, setCcEmployees] = useState<Employee[]>([]);
  // Only asked when the entry is late (< 24h before start, or after start) —
  // mirrors the backend's own informedStatus check in routes/outOfOffice.js.
  const [plannedStatus, setPlannedStatus] = useState<'' | 'Planned' | 'Not Planned'>('');
  const [lateReason, setLateReason] = useState('');
  const [unplannedKnownAt, setUnplannedKnownAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLate = useMemo(() => {
    if (!oooDate || !startTime) return false;
    const start = new Date(`${oooDate}T${startTime}:00`);
    if (Number.isNaN(start.getTime())) return false;
    const diffDays = (start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays < 1;
  }, [oooDate, startTime]);

  // Reset the form and stamp the "logged at" time fresh each time the popup opens.
  useEffect(() => {
    if (!open) return;
    setLoggedAt(new Date());
    setPerson(null); setOooDate(''); setStartTime(''); setUpToDate(''); setUpToTime('');
    setReason(''); setCcEmployees([]); setPlannedStatus(''); setLateReason(''); setUnplannedKnownAt(''); setError(null);
  }, [open]);

  // If editing the date/time turns a late entry back into an on-time one,
  // drop the now-irrelevant planned/not-planned answers rather than silently
  // submitting stale ones.
  useEffect(() => {
    if (!isLate) { setPlannedStatus(''); setLateReason(''); setUnplannedKnownAt(''); }
  }, [isLate]);

  // "Up to" date defaults to the out-of-office date so single-day entries
  // (the common case) need no extra input — only touched if the user hasn't
  // picked one of their own yet, so it never overwrites a multi-day choice.
  useEffect(() => {
    if (oooDate && !upToDate) setUpToDate(oooDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oooDate]);

  const submit = async () => {
    setError(null);
    if (!person) { setError('Select the person out of office.'); return; }
    if (!oooDate || !startTime) { setError('Enter the out of office date and start time.'); return; }
    if (!upToTime) { setError('Enter the time up to.'); return; }
    if (!reason.trim()) { setError('Enter a reason.'); return; }
    if (isLate && !plannedStatus) { setError('This is being filed late — select whether it was planned or not.'); return; }
    if (isLate && plannedStatus === 'Not Planned') {
      if (!lateReason.trim()) { setError('Enter why this was filed late.'); return; }
      if (!unplannedKnownAt) { setError('Enter when this was decided.'); return; }
    }

    const startDateTime = new Date(`${oooDate}T${startTime}:00`);
    if (Number.isNaN(startDateTime.getTime())) { setError('Invalid date/time.'); return; }

    const effectiveUpToDate = upToDate || oooDate;
    if (effectiveUpToDate < oooDate) { setError('Time up to date cannot be before the out of office date.'); return; }
    const upToDateTime = new Date(`${effectiveUpToDate}T${upToTime}:00`);
    if (Number.isNaN(upToDateTime.getTime())) { setError('Invalid time up to date/time.'); return; }
    if (upToDateTime <= startDateTime) { setError('Time up to must be after the start date and time.'); return; }

    setBusy(true);
    try {
      const payload = {
        submittedByEmail: submitter?.official_email || submitter?.email || user?.email || '',
        submittedByName: submitter?.full_name || '',
        person: { employeeId: person.employee_id, name: person.full_name, email: person.official_email || person.email },
        startDateTime: startDateTime.toISOString(),
        // Only sent when it differs from the OOO date — keeps same-day
        // entries (still the vast majority) identical to before.
        upToDate: effectiveUpToDate !== oooDate ? effectiveUpToDate : '',
        upToTime,
        reason: reason.trim(),
        ccEmployees: ccEmployees.map(e => ({ employeeId: e.employee_id, name: e.full_name, email: e.official_email || e.email })),
        ...(isLate ? {
          plannedStatus,
          ...(plannedStatus === 'Not Planned' ? {
            lateReason: lateReason.trim(),
            unplannedKnownAt: new Date(unplannedKnownAt).toISOString(),
          } : {}),
        } : {}),
      };
      const { data } = await axios.post(API, payload);
      if (data.success) {
        showToast(
          plannedStatus === 'Planned'
            ? 'Out of office logged — filed late, an escalation has been raised'
            : 'Out of office logged — HR has been notified',
          'success'
        );
        onDone();
      }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed to submit', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '92vw', sm: 560 }, maxHeight: '85vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 2, p: 3, outline: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography fontSize={16} fontWeight={700}>Log Out of Office</Typography>
            <Typography fontSize={12} color="text.secondary">Notifies HR, plus anyone kept in cc</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {loggedAt && (
          <Box sx={{ bgcolor: '#eef2ff', border: '1px solid #e0e7ff', borderRadius: 1.5, px: 1.5, py: 1, mb: 2.5 }}>
            <Typography fontSize={12} color="#4338ca">
              This entry will be logged at <b>{fmtDateTime24(loggedAt)}</b>
              {submitter && <> by <b>{submitter.full_name}</b></>}
              {person && submitter && person.official_email !== submitter.official_email && person.email !== submitter.email && (
                <> on behalf of <b>{person.full_name}</b></>
              )}
            </Typography>
          </Box>
        )}

        <Stack spacing={2.5}>
          <Autocomplete options={employees} getOptionLabel={e => `${e.full_name} (${e.department})`}
            value={person} onChange={(_, v) => setPerson(v)}
            renderInput={p => <TextField {...p} size="small" label="Person out of office *" placeholder="Search name or department…" />} />

          <Box>
            <Typography fontSize={12} color="text.secondary" mb={0.75}>
              Out of Office Date and Start Time * — 24-hour format, e.g. 28 May 2024, 14:00
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField type="date" size="small" fullWidth value={oooDate}
                onChange={e => setOooDate(e.target.value)} InputLabelProps={{ shrink: true }} label="Date" />
              <TextField type="time" size="small" fullWidth value={startTime}
                onChange={e => setStartTime(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }} label="Start Time" />
            </Box>
          </Box>

          <Box>
            <Typography fontSize={12} color="text.secondary" mb={0.75}>
              Time Up To *
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField type="date" size="small" fullWidth value={upToDate}
                onChange={e => setUpToDate(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ min: oooDate || undefined }} label="Date" />
              <TextField type="time" size="small" fullWidth value={upToTime}
                onChange={e => setUpToTime(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }} label="Time" />
            </Box>
          </Box>

          {isLate && (
            <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 1.5, p: 1.75 }}>
              <Typography fontSize={12.5} fontWeight={700} color="#92400e" mb={1}>
                This is being filed late (less than 24 hours before start, or after it's already started).
              </Typography>
              <FormControl size="small" fullWidth sx={{ mb: plannedStatus ? 1.5 : 0, bgcolor: 'white' }}>
                <InputLabel>Was this planned in advance? *</InputLabel>
                <Select value={plannedStatus} label="Was this planned in advance? *"
                  onChange={e => setPlannedStatus(e.target.value as 'Planned' | 'Not Planned')}>
                  <MenuItem value="Planned">Planned</MenuItem>
                  <MenuItem value="Not Planned">Not Planned</MenuItem>
                </Select>
              </FormControl>

              {plannedStatus === 'Planned' && (
                <Typography fontSize={11.5} color="#92400e">
                  This will be marked as filed late, and a Timeliness escalation will be raised automatically against {person?.full_name || 'this person'}.
                </Typography>
              )}

              {plannedStatus === 'Not Planned' && (
                <Stack spacing={1.5}>
                  <TextField label="Why did you file this late? *" multiline rows={2} size="small" value={lateReason}
                    onChange={e => setLateReason(e.target.value)} fullWidth sx={{ bgcolor: 'white' }} />
                  <TextField type="datetime-local" size="small" fullWidth value={unplannedKnownAt}
                    onChange={e => setUnplannedKnownAt(e.target.value)} InputLabelProps={{ shrink: true }}
                    label="When was it decided? *" sx={{ bgcolor: 'white' }} />
                </Stack>
              )}
            </Box>
          )}

          <TextField label="Reason *" multiline rows={3} size="small" value={reason}
            onChange={e => setReason(e.target.value)} fullWidth />

          <Autocomplete multiple options={employees} getOptionLabel={e => `${e.full_name} (${e.department})`}
            value={ccEmployees} onChange={(_, v) => setCcEmployees(v)}
            renderInput={p => <TextField {...p} size="small" label="Keep in Cc" placeholder="Search name or department…" />} />

          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
            <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
            <Button variant="contained" onClick={submit} disabled={busy}
              sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, textTransform: 'none', fontWeight: 600 }}>
              {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Submit'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Modal>
  );
}

// ─── Out of Office: tab root ────────────────────────────────────────────────────

function OutOfOfficeTab() {
  const [records, setRecords] = useState<OutOfOfficeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rRes, eRes] = await Promise.all([axios.get(API), axios.get(EMP_API)]);
      setRecords(Array.isArray(rRes.data) ? rRes.data : rRes.data?.data || []);
      const employeeList: Employee[] = Array.isArray(eRes.data) ? eRes.data : eRes.data?.data || [];
      setEmployees([...employeeList].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <OutOfOfficeDashboard records={records} loading={loading} onAdd={() => setFormOpen(true)} />

      <OutOfOfficeFormModal open={formOpen} employees={employees}
        onClose={() => setFormOpen(false)}
        onDone={() => { setFormOpen(false); loadData(); }}
        showToast={showToast} />
    </Box>
  );
}

// ─── Leaves: shared status styling ─────────────────────────────────────────────
// Per the Leave Management spec: only the Status chip gets a tinted fill,
// everything else in a row stays plain text.

const LEAVE_STATUS_STYLE: Record<LeaveStatus, { label: string; bg: string; color: string }> = {
  draft:           { label: 'Draft',           bg: '#f1f5f9', color: '#64748b' },
  to_approve:      { label: 'To Approve',      bg: '#fef9c3', color: '#854d0e' },
  second_approval: { label: 'Second Approval', bg: '#fef3c7', color: '#92400e' },
  approved:        { label: 'Approved',        bg: '#dcfce7', color: '#166534' },
  refused:         { label: 'Refused',         bg: '#fee2e2', color: '#991b1b' },
  cancelled:       { label: 'Cancelled',       bg: '#f1f5f9', color: '#64748b' },
};

const fmtDuration = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`;

const fmtDateTime = (d?: string | null) => {
  if (!d) return '—';
  try { return `${fmtDate(d)}, ${new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`; }
  catch { return String(d); }
};

// ─── Leaves: balance cards ──────────────────────────────────────────────────────

function LeaveBalanceCards({ balance, loading }: { balance: LeaveBalanceRow[]; loading: boolean }) {
  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>;
  if (!balance.length) {
    return (
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', p: 3, textAlign: 'center' }}>
        <Typography fontSize={13} color="text.secondary">No leave types configured yet.</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
      {balance.map(b => (
        <Box key={b.leaveTypeId} sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0',
          borderLeft: `3px solid ${b.color}`, p: 1.75 }}>
          <Typography fontSize={24} fontWeight={700} color="#0f172a">{b.requiresAllocation ? b.available : '—'}</Typography>
          <Typography fontSize={11} color="text.secondary">days available</Typography>
          <Typography fontSize={12} fontWeight={600} mt={1}>{b.name}</Typography>
          <Typography fontSize={11} color="text.secondary">{b.used} used · {b.pending} pending</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Leaves: my requests table ──────────────────────────────────────────────────

type SourceFilterValue = 'all' | 'app' | 'odoo_import';

function SourceFilterSelect({ value, onChange }: { value: SourceFilterValue; onChange: (v: SourceFilterValue) => void }) {
  return (
    <TextField select size="small" label="Source" value={value} onChange={e => onChange(e.target.value as SourceFilterValue)}
      sx={{ minWidth: 140, bgcolor: 'white' }}>
      <MenuItem value="all">All</MenuItem>
      <MenuItem value="app">Logged in app</MenuItem>
      <MenuItem value="odoo_import">Imported</MenuItem>
    </TextField>
  );
}

const matchesSource = (r: LeaveRequestRecord, filter: SourceFilterValue) =>
  filter === 'all' || (r.source || 'app') === filter;

function MyRequestsTable({ requests, leaveTypes, loading, onSelect }: {
  requests: LeaveRequestRecord[]; leaveTypes: LeaveType[]; loading: boolean; onSelect: (r: LeaveRequestRecord) => void;
}) {
  const typeById = useMemo(() => new Map(leaveTypes.map(t => [t._id, t])), [leaveTypes]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>('all');
  const filteredRequests = useMemo(() => requests.filter(r => matchesSource(r, sourceFilter)), [requests, sourceFilter]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <SourceFilterSelect value={sourceFilter} onChange={setSourceFilter} />
      </Box>
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box> : (
        <TableContainer sx={{ maxHeight: 520, overflowY: 'auto' }}>
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow sx={{ '& th': TH }}>
                <TableCell sx={{ width: '22%' }}>Leave Type</TableCell>
                <TableCell sx={{ width: '16%' }}>From</TableCell>
                <TableCell sx={{ width: '16%' }}>To</TableCell>
                <TableCell sx={{ width: '14%' }}>Duration</TableCell>
                <TableCell sx={{ width: '18%' }}>Status</TableCell>
                <TableCell sx={{ width: '14%' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                  {requests.length === 0 ? 'No time off yet. Create your first request.' : 'No requests match this filter.'}
                </TableCell></TableRow>
              )}
              {filteredRequests.map(r => {
                const s = LEAVE_STATUS_STYLE[r.status];
                const type = typeById.get(r.leaveTypeId);
                return (
                  <TableRow key={r._id} onClick={() => onSelect(r)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={TD}>{type?.name || '—'}</TableCell>
                    <TableCell sx={TD}>{fmtDate(r.dateFrom)}</TableCell>
                    <TableCell sx={TD}>{fmtDate(r.dateTo)}</TableCell>
                    <TableCell sx={TD}>{fmtDuration(r.durationDays)}</TableCell>
                    <TableCell sx={TD}>
                      <Chip size="small" label={s.label} sx={{ fontSize: 10, height: 20, bgcolor: s.bg, color: s.color, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={TD} onClick={e => e.stopPropagation()}>
                      {r.allowedActions?.canCancel ? (
                        <Button size="small" color="error" onClick={() => onSelect(r)}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: 11, p: 0, minWidth: 0 }}>
                          View / Cancel
                        </Button>
                      ) : (
                        <Button size="small" onClick={() => onSelect(r)}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: 11, p: 0, minWidth: 0, color: 'text.secondary' }}>
                          View
                        </Button>
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

// ─── Leaves: statusbar ──────────────────────────────────────────────────────────
// Same 18px-circle + label + 1px-connecting-line idiom as the Salary
// Revision detail stepper. 'none'-approval types never touch to_approve, so
// their track skips straight from Draft to Approved.

const LEAVE_STEP_ORDER: Record<string, LeaveStatus[]> = {
  none: ['draft', 'approved'],
  manager: ['draft', 'to_approve', 'approved'],
  hr: ['draft', 'to_approve', 'approved'],
  manager_then_hr: ['draft', 'to_approve', 'second_approval', 'approved'],
};

const LEAVE_STEP_LABEL: Record<string, string> = {
  draft: 'Draft', to_approve: 'To Approve', second_approval: 'Second Approval',
  approved: 'Approved', refused: 'Refused', cancelled: 'Cancelled',
};

function pendingNextStepLabel(status: LeaveStatus, approvalMode?: string): string | null {
  if (status === 'to_approve') return approvalMode === 'hr' ? 'HR' : 'Manager';
  if (status === 'second_approval') return 'HR';
  return null;
}

function LeaveStatusBar({ leaveType, status, auditLog }: { leaveType?: LeaveType; status: LeaveStatus; auditLog: LeaveAuditEntry[] }) {
  const steps = LEAVE_STEP_ORDER[leaveType?.approvalMode || 'manager'];
  const isTerminal = status === 'refused' || status === 'cancelled';
  const terminalEntry = isTerminal ? [...auditLog].reverse().find(a => a.toStatus === status) : null;
  const reachedStatus = (isTerminal ? terminalEntry?.fromStatus : status) as LeaveStatus | undefined;
  const reachedIndex = Math.max(0, steps.indexOf(reachedStatus || 'draft'));

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 220 }}>
      {steps.map((step, i) => {
        const passed = i <= reachedIndex;
        const isCurrent = !isTerminal && i === reachedIndex;
        const circleBg = isTerminal ? (passed ? '#059669' : '#cbd5e1') : (isCurrent ? ACCENT : passed && i < reachedIndex ? '#059669' : i < reachedIndex ? '#059669' : '#cbd5e1');
        return (
          <React.Fragment key={step}>
            {i > 0 && <Box sx={{ flex: 1, height: 1, bgcolor: i <= reachedIndex ? '#059669' : '#e2e8f0', mt: '9px' }} />}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 64 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: circleBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!isCurrent && (passed && i < reachedIndex || (isTerminal && passed)) && <CheckCircleIcon sx={{ fontSize: 14, color: 'white' }} />}
              </Box>
              <Typography fontSize={10} fontWeight={600} color={isCurrent ? ACCENT : 'text.secondary'} textAlign="center">
                {LEAVE_STEP_LABEL[step]}
              </Typography>
            </Box>
          </React.Fragment>
        );
      })}
      {isTerminal && (
        <>
          <Box sx={{ flex: 1, height: 1, bgcolor: status === 'refused' ? '#dc2626' : '#94a3b8', mt: '9px' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 64 }}>
            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: status === 'refused' ? '#dc2626' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CloseIcon sx={{ fontSize: 12, color: 'white' }} />
            </Box>
            <Typography fontSize={10} fontWeight={600} color={status === 'refused' ? '#dc2626' : '#64748b'}>
              {LEAVE_STEP_LABEL[status]}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}

// ─── Leaves: timeline (chatter-style, newest first) ─────────────────────────────

function auditIcon(action: string) {
  if (action === 'approved') return <CheckCircleIcon sx={{ fontSize: 16, color: '#059669' }} />;
  if (action === 'refused') return <BlockIcon sx={{ fontSize: 16, color: '#dc2626' }} />;
  if (action === 'cancelled') return <CloseIcon sx={{ fontSize: 16, color: '#64748b' }} />;
  return <SendIcon sx={{ fontSize: 16, color: ACCENT }} />;
}

const AUDIT_VERB: Record<string, string> = {
  draft_created: 'Saved as draft', submitted: 'Submitted', approved: 'Approved', refused: 'Refused', cancelled: 'Cancelled',
};

const MAIL_SENT_VERB: Record<LeaveMailType, string> = {
  submitted: 'Mail sent to approver', managerApproved: 'Mail sent to HR',
  approved: 'Approval mail sent', refused: 'Refusal mail sent', cancelled: 'Cancellation mail sent',
};

function auditVerb(action: string): string {
  if (action.startsWith('mail_sent_')) {
    const type = action.replace('mail_sent_', '') as LeaveMailType;
    return MAIL_SENT_VERB[type] || 'Mail sent';
  }
  return AUDIT_VERB[action] || action;
}

function LeaveTimeline({ auditLog, nextStepLabel }: { auditLog: LeaveAuditEntry[]; nextStepLabel: string | null }) {
  const sorted = [...auditLog].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <Box>
      {nextStepLabel && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5, opacity: 0.65 }}>
          <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '1px dashed #94a3b8', flexShrink: 0, mt: 0.25 }} />
          <Typography fontSize={12} color="text.secondary" fontStyle="italic">Waiting for {nextStepLabel}</Typography>
        </Box>
      )}
      {sorted.map((a, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ mt: 0.25 }}>{auditIcon(a.action)}</Box>
          <Box>
            <Typography fontSize={12} fontWeight={600}>
              {auditVerb(a.action)}{a.by ? ` by ${a.by}` : ''}
            </Typography>
            {a.note && <Typography fontSize={12} color="text.secondary" fontStyle="italic">"{a.note}"</Typography>}
            <Typography fontSize={10} color="text.secondary">{fmtDateTime(a.at)}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ─── Leaves: refuse-reason dialog ───────────────────────────────────────────────

function RefuseReasonDialog({ open, busy, onClose, onConfirm }: {
  open: boolean; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '90vw', sm: 380 }, bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', p: 2.5, outline: 'none' }}>
        <Typography fontSize={15} fontWeight={700} mb={1.5}>Refuse Request</Typography>
        <TextField label="Reason" multiline minRows={3} fullWidth size="small" value={reason}
          onChange={e => setReason(e.target.value)} autoFocus />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {busy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Refuse'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

// ─── Leaves: mail composer (shared pattern — no reusable component existed
// elsewhere in the codebase; Salary Revision's equivalent is private inline
// JSX in SalaryRevisionNew.tsx, not an importable component, so this
// replicates that same Modal + TextFields + contentEditable + single
// combined Send approach rather than importing anything) ───────────────────

const MAIL_BUTTON_LABEL: Record<LeaveMailType, (approvalMode?: string) => string> = {
  submitted: (mode) => mode === 'hr' ? 'Send mail to HR' : 'Send mail to Manager',
  managerApproved: () => 'Send mail to HR',
  approved: () => 'Send approval mail to Employee',
  refused: () => 'Send refusal mail to Employee',
  cancelled: () => 'Send mail to Manager',
};

function MailComposerDialog({ open, requestId, mailType, onClose, onSent, showToast }: {
  open: boolean; requestId: string | null; mailType: LeaveMailType | null;
  onClose: () => void; onSent: (updated: LeaveRequestRecord) => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !requestId || !mailType) return;
    setLoading(true); setError(null); setWarning(null);
    axios.get(`${LEAVE_API}/requests/${requestId}/mail/${mailType}/draft`)
      .then(res => {
        const d = res.data?.data || {};
        setTo(d.to || ''); setCc(d.cc || ''); setBcc(d.bcc || ''); setSubject(d.subject || ''); setHtml(d.html || '');
        setWarning(d.warning || null);
      })
      .catch(e => setError(e?.response?.data?.message || 'Failed to load mail draft'))
      .finally(() => setLoading(false));
  }, [open, requestId, mailType]);

  const handleSend = async () => {
    if (!requestId || !mailType || sending) return;
    setError(null);
    if (!to.trim()) { setError('At least one To address is required'); return; }
    setSending(true);
    try {
      const res = await axios.post(`${LEAVE_API}/requests/${requestId}/mail/${mailType}/send`, {
        to, cc, bcc, subject, html: bodyRef.current?.innerHTML ?? html,
      });
      showToast('Mail sent', 'success');
      onSent(res.data?.data);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to send mail');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!sending) onClose(); }}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '94vw', sm: 640 }, maxHeight: '90vh', overflowY: 'auto',
        bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', outline: 'none' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2,
          borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, bgcolor: 'white', zIndex: 1 }}>
          <Typography fontSize={16} fontWeight={700}>Compose Mail</Typography>
          <IconButton size="small" onClick={onClose} disabled={sending}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box>
        ) : (
          <Box sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              {warning && <Alert severity="warning" sx={{ fontSize: 12 }}>{warning}</Alert>}
              <TextField label="To" size="small" value={to} onChange={e => setTo(e.target.value)} disabled={sending} fullWidth />
              <TextField label="Cc" size="small" value={cc} onChange={e => setCc(e.target.value)} disabled={sending} fullWidth />
              <TextField label="Bcc" size="small" value={bcc} onChange={e => setBcc(e.target.value)} disabled={sending} fullWidth />
              <TextField label="Subject" size="small" value={subject} onChange={e => setSubject(e.target.value)} disabled={sending} fullWidth />
              <Box>
                <Typography fontSize={11} color="text.secondary" mb={0.5}>Body</Typography>
                <Box
                  ref={bodyRef}
                  contentEditable={!sending}
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: html }}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5, minHeight: 180, fontSize: 13,
                    bgcolor: sending ? '#f8fafc' : 'white', '&:focus': { outline: `1px solid ${ACCENT}` } }}
                />
              </Box>

              {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button onClick={onClose} disabled={sending} sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
                <Button variant="contained" onClick={handleSend} disabled={sending}
                  sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 600 }}>
                  {sending ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Send'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </Box>
    </Modal>
  );
}

// ─── Leaves: request detail dialog ──────────────────────────────────────────────

function LeaveRequestDetailDialog({ record, leaveTypes, onClose, onApprove, onRefuse, onCancel, onMailSent, showToast }: {
  record: LeaveRequestRecord | null;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onRefuse: (id: string, reason: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onMailSent: (updated: LeaveRequestRecord) => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const type = leaveTypes.find(t => t._id === record?.leaveTypeId);
  const [busyAction, setBusyAction] = useState<'approve' | 'refuse' | 'cancel' | null>(null);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [balanceRow, setBalanceRow] = useState<LeaveBalanceRow | null>(null);

  useEffect(() => {
    setBalanceRow(null);
    if (!record) return;
    axios.get(`${LEAVE_API}/balance/${record.employeeId}`)
      .then(res => {
        const rows: LeaveBalanceRow[] = res.data?.data || [];
        setBalanceRow(rows.find(b => b.leaveTypeId === record.leaveTypeId) || null);
      })
      .catch(() => {});
  }, [record?._id, record?.employeeId, record?.leaveTypeId]);

  const handleApprove = async () => {
    if (!record) return;
    setBusyAction('approve');
    try { await onApprove(record._id); } finally { setBusyAction(null); }
  };
  const handleRefuseConfirm = async (reason: string) => {
    if (!record) return;
    setBusyAction('refuse');
    try { await onRefuse(record._id, reason); setRefuseOpen(false); } finally { setBusyAction(null); }
  };
  const handleCancel = async () => {
    if (!record) return;
    setBusyAction('cancel');
    try { await onCancel(record._id); } finally { setBusyAction(null); }
  };

  const counted = !!record && ['to_approve', 'second_approval', 'approved'].includes(record.status);
  const before = record && balanceRow ? balanceRow.available + (counted ? record.durationDays : 0) : null;
  const after = before != null && record ? before - record.durationDays : null;
  const nextStep = record ? pendingNextStepLabel(record.status, type?.approvalMode) : null;

  return (
    <>
      <Modal open={!!record} onClose={onClose}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: { xs: '94vw', sm: 620 }, maxHeight: '90vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 2, outline: 'none' }}>
          {record && (
            <>
              <Box sx={{ p: 3, pb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: ACCENT, width: 40, height: 40, fontSize: 14, fontWeight: 700 }}>
                      {record.employeeName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                    </Avatar>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography fontSize={15} fontWeight={700}>{record.employeeName}</Typography>
                        {record.source === 'odoo_import' && (
                          <Typography fontSize={10} color="text.secondary" sx={{ bgcolor: '#f1f5f9', px: 0.75, py: 0.125, borderRadius: 0.75 }}>
                            Imported
                          </Typography>
                        )}
                      </Box>
                      <Typography fontSize={12} color="text.secondary">{record.department}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: type?.color || '#94a3b8' }} />
                        <Typography fontSize={12} fontWeight={600}>{type?.name || 'Leave'}</Typography>
                      </Box>
                    </Box>
                  </Box>
                  <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                  <LeaveStatusBar leaveType={type} status={record.status} auditLog={record.auditLog} />
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    {record.allowedActions.canApprove && (
                      <Button size="small" variant="contained" disabled={!!busyAction} onClick={handleApprove}
                        sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, textTransform: 'none', fontWeight: 600 }}>
                        {busyAction === 'approve' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Approve'}
                      </Button>
                    )}
                    {record.allowedActions.canRefuse && (
                      <Button size="small" variant="contained" color="error" disabled={!!busyAction} onClick={() => setRefuseOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Refuse
                      </Button>
                    )}
                    {record.allowedActions.canCancel && (
                      <Button size="small" variant="outlined" color="error" disabled={!!busyAction} onClick={handleCancel}
                        sx={{ textTransform: 'none', fontWeight: 600 }}>
                        {busyAction === 'cancel' ? <CircularProgress size={16} /> : 'Cancel'}
                      </Button>
                    )}
                    {record.mailAction?.canSend && (
                      <Button size="small" variant="outlined" startIcon={<SendIcon sx={{ fontSize: 14 }} />}
                        disabled={!!busyAction} onClick={() => setMailOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 600, borderColor: ACCENT, color: ACCENT }}>
                        {MAIL_BUTTON_LABEL[record.mailAction.type](type?.approvalMode)}
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Box>

              <Divider />

              <Box sx={{ p: 3, pt: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <DetailRow label="From" value={fmtDate(record.dateFrom)} />
                  <DetailRow label="To" value={fmtDate(record.dateTo)} />
                  <DetailRow label="Duration" value={fmtDuration(record.durationDays)} />
                  <DetailRow label="Half Day" value={record.halfDay.enabled ? (record.halfDay.session === 'first_half' ? 'First half' : 'Second half') : '—'} />
                  {type?.requiresAllocation && (
                    <DetailRow label="Balance Before → After" value={before != null && after != null ? `${before} → ${after} days` : '—'} />
                  )}
                </Box>

                <Divider sx={{ my: 1.5 }} />
                <DetailRow label="Reason" value={record.reason || '—'} />

                {record.document?.driveLink && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <DetailRow label="Document" value={
                      <a href={record.document.driveLink} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>{record.document.fileName}</a>
                    } />
                  </>
                )}

                {record.status !== 'refused' && (record.managerDecision?.comment || record.hrDecision?.comment) && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    {record.managerDecision?.comment && <DetailRow label="Manager's Note" value={record.managerDecision.comment} />}
                    {record.hrDecision?.comment && <DetailRow label="HR's Note" value={record.hrDecision.comment} />}
                  </>
                )}

                {record.status === 'refused' && record.refusalReason && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <DetailRow label="Refusal Reason" value={record.refusalReason} />
                  </>
                )}

                <Divider sx={{ my: 2 }} />
                <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5}>History</Typography>
                <LeaveTimeline auditLog={record.auditLog} nextStepLabel={nextStep} />
              </Box>
            </>
          )}
        </Box>
      </Modal>

      <RefuseReasonDialog open={refuseOpen} busy={busyAction === 'refuse'}
        onClose={() => setRefuseOpen(false)} onConfirm={handleRefuseConfirm} />

      <MailComposerDialog open={mailOpen} requestId={record?._id || null} mailType={record?.mailAction?.type || null}
        onClose={() => setMailOpen(false)}
        onSent={(updated) => { setMailOpen(false); onMailSent(updated); }}
        showToast={showToast} />
    </>
  );
}

// ─── Leaves: New Time Off modal ─────────────────────────────────────────────────

function NewTimeOffModal({ open, leaveTypes, balance, onClose, onDone, showToast }: {
  open: boolean; leaveTypes: LeaveType[]; balance: LeaveBalanceRow[];
  onClose: () => void; onDone: () => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [halfDayEnabled, setHalfDayEnabled] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<'first_half' | 'second_half'>('first_half');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [durationLoading, setDurationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'submit' | 'draft' | null>(null);

  useEffect(() => {
    if (!open) return;
    setLeaveTypeId(''); setDateFrom(''); setDateTo(''); setHalfDayEnabled(false);
    setHalfDaySession('first_half'); setReason(''); setFile(null); setDuration(null); setError(null); setBusy(null);
  }, [open]);

  // A half-day request is always a single day.
  useEffect(() => {
    if (halfDayEnabled && dateFrom) setDateTo(dateFrom);
  }, [halfDayEnabled, dateFrom]);

  useEffect(() => {
    if (!dateFrom || !dateTo) { setDuration(null); return; }
    let active = true;
    setDurationLoading(true);
    axios.get(`${LEAVE_API}/duration-preview`, { params: { dateFrom, dateTo, halfDay: halfDayEnabled } })
      .then(res => { if (active) setDuration(res.data?.data?.durationDays ?? null); })
      .catch(() => { if (active) setDuration(null); })
      .finally(() => { if (active) setDurationLoading(false); });
    return () => { active = false; };
  }, [dateFrom, dateTo, halfDayEnabled]);

  const selectedType = leaveTypes.find(t => t._id === leaveTypeId) || null;

  const submitRequest = async (asDraft: boolean) => {
    setError(null);
    if (!leaveTypeId) { setError('Select a leave type'); return; }
    if (!dateFrom || !dateTo) { setError('Select the date range'); return; }
    if (!asDraft && selectedType?.requiresDocument && !file) {
      setError('A supporting document is required for this leave type');
      return;
    }

    setBusy(asDraft ? 'draft' : 'submit');
    try {
      const createRes = await axios.post(`${LEAVE_API}/requests`, {
        leaveTypeId, dateFrom, dateTo,
        halfDay: { enabled: halfDayEnabled, session: halfDaySession },
        reason, submit: false,
      });
      const id = createRes.data?.data?._id;

      if (file && id) {
        const fd = new FormData();
        fd.append('file', file);
        await axios.post(`${LEAVE_API}/requests/${id}/upload-document`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (!asDraft) {
        await axios.put(`${LEAVE_API}/requests/${id}/submit`);
        showToast('Leave request submitted', 'success');
      } else {
        showToast('Saved as draft', 'success');
      }
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '92vw', md: 520 }, maxHeight: '88vh', overflow: 'auto',
        bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', outline: 'none' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2,
          borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, bgcolor: 'white', zIndex: 1 }}>
          <Typography fontSize={16} fontWeight={700}>New Time Off</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2.5}>
            <Autocomplete
              options={leaveTypes}
              getOptionLabel={(t) => t.name}
              value={selectedType}
              onChange={(_, v) => setLeaveTypeId(v?._id || '')}
              renderOption={(props, t) => {
                const b = balance.find(x => x.leaveTypeId === t._id);
                return (
                  <li {...props} key={t._id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>{t.name}</span>
                      {t.requiresAllocation && <span style={{ color: '#64748b', fontSize: 12 }}>{b?.available ?? 0} available</span>}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label="Leave Type" size="small" />}
            />

            <Stack direction="row" spacing={1.5}>
              <TextField type="date" label="From" size="small" fullWidth value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField type="date" label="To" size="small" fullWidth value={dateTo}
                onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }}
                disabled={halfDayEnabled} inputProps={{ min: dateFrom || undefined }} />
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1.5}>
              <FormControlLabel
                control={<Switch checked={halfDayEnabled} onChange={e => setHalfDayEnabled(e.target.checked)} />}
                label={<Typography fontSize={13}>Half day</Typography>} />
              {halfDayEnabled && (
                <TextField select size="small" value={halfDaySession}
                  onChange={e => setHalfDaySession(e.target.value as 'first_half' | 'second_half')} sx={{ minWidth: 160 }}>
                  <MenuItem value="first_half">First half</MenuItem>
                  <MenuItem value="second_half">Second half</MenuItem>
                </TextField>
              )}
            </Stack>

            <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, px: 1.5, py: 1 }}>
              <Typography fontSize={11} color="text.secondary">Duration</Typography>
              <Typography fontSize={14} fontWeight={700}>
                {durationLoading ? <CircularProgress size={14} /> : duration != null ? fmtDuration(duration) : '—'}
              </Typography>
            </Box>

            <TextField label="Reason" multiline minRows={3} size="small" value={reason} onChange={e => setReason(e.target.value)} />

            {selectedType?.requiresDocument && (
              <Box>
                <Typography fontSize={12} fontWeight={600} mb={0.5}>Supporting Document (required)</Typography>
                <Button variant="outlined" component="label" size="small" sx={{ textTransform: 'none' }}>
                  {file ? file.name : 'Choose file'}
                  <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
                </Button>
              </Box>
            )}

            {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" fullWidth disabled={!!busy} onClick={() => submitRequest(true)}
                sx={{ textTransform: 'none', fontWeight: 600 }}>
                {busy === 'draft' ? <CircularProgress size={18} /> : 'Save as draft'}
              </Button>
              <Button variant="contained" fullWidth disabled={!!busy} onClick={() => submitRequest(false)}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 600 }}>
                {busy === 'submit' ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Submit request'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}

// ─── Leaves: approvals tab ───────────────────────────────────────────────────────
// Default view is always "waiting on the current user" — the backend's
// scope=pending_my_action already returns exactly that, so there's no
// separate all/team toggle here; the search box just filters what's loaded.

function ApprovalsTab({ requests, leaveTypes, summary, loading, onSelect, onApprove, onRefuse }: {
  requests: LeaveRequestRecord[]; leaveTypes: LeaveType[]; summary: ApprovalsSummary | null; loading: boolean;
  onSelect: (r: LeaveRequestRecord) => void;
  onApprove: (id: string) => Promise<void>;
  onRefuse: (id: string, reason: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<LeaveRequestRecord | null>(null);
  const typeById = useMemo(() => new Map(leaveTypes.map(t => [t._id, t])), [leaveTypes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter(r => {
      if (!matchesSource(r, sourceFilter)) return false;
      if (!term) return true;
      const type = typeById.get(r.leaveTypeId);
      return r.employeeName.toLowerCase().includes(term) ||
        (type?.name || '').toLowerCase().includes(term) ||
        LEAVE_STATUS_STYLE[r.status].label.toLowerCase().includes(term);
    });
  }, [requests, search, sourceFilter, typeById]);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try { await onApprove(id); } finally { setBusyId(null); }
  };
  const handleRefuseConfirm = async (reason: string) => {
    if (!refuseTarget) return;
    const id = refuseTarget._id;
    setBusyId(id);
    try { await onRefuse(id, reason); setRefuseTarget(null); } finally { setBusyId(null); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, mb: 2, px: 0.5, flexWrap: 'wrap' }}>
        {([
          ['Pending', summary?.pending ?? 0],
          ['Approved this month', summary?.approvedThisMonth ?? 0],
          ['Refused', summary?.refused ?? 0],
          ['On leave today', summary?.onLeaveToday ?? 0],
        ] as const).map(([label, value]) => (
          <Box key={label}>
            <Typography fontSize={20} fontWeight={700} color="#0f172a">{value}</Typography>
            <Typography fontSize={11} color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.25, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Search name, leave type, status…" value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.75 }} /> }}
          sx={{ minWidth: 260, bgcolor: 'white' }} />
        <SourceFilterSelect value={sourceFilter} onChange={setSourceFilter} />
      </Box>

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box> : (
          <TableContainer sx={{ maxHeight: 520, overflowY: 'auto' }}>
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell sx={{ width: '22%' }}>Employee</TableCell>
                  <TableCell sx={{ width: '18%' }}>Leave Type</TableCell>
                  <TableCell sx={{ width: '20%' }}>Dates</TableCell>
                  <TableCell sx={{ width: '12%' }}>Duration</TableCell>
                  <TableCell sx={{ width: '14%' }}>Status</TableCell>
                  <TableCell sx={{ width: '14%' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                    You're all caught up. Nothing is waiting for your approval.
                  </TableCell></TableRow>
                )}
                {filtered.map(r => {
                  const type = typeById.get(r.leaveTypeId);
                  const s = LEAVE_STATUS_STYLE[r.status];
                  const rowBusy = busyId === r._id;
                  return (
                    <TableRow key={r._id} onClick={() => onSelect(r)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                      <TableCell sx={TD}>{r.employeeName}</TableCell>
                      <TableCell sx={TD}>{type?.name || '—'}</TableCell>
                      <TableCell sx={TD}>{fmtDate(r.dateFrom)} – {fmtDate(r.dateTo)}</TableCell>
                      <TableCell sx={TD}>{fmtDuration(r.durationDays)}</TableCell>
                      <TableCell sx={TD}>
                        <Chip size="small" label={s.label} sx={{ fontSize: 10, height: 20, bgcolor: s.bg, color: s.color, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={TD} onClick={e => e.stopPropagation()}>
                        {rowBusy ? <CircularProgress size={16} /> : (
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Approve">
                              <IconButton size="small" onClick={() => handleApprove(r._id)}
                                sx={{ color: '#059669', border: '1px solid #bbf7d0', borderRadius: 1 }}>
                                <CheckIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Refuse">
                              <IconButton size="small" onClick={() => setRefuseTarget(r)}
                                sx={{ color: '#dc2626', border: '1px solid #fecaca', borderRadius: 1 }}>
                                <CloseIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
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

      <RefuseReasonDialog open={!!refuseTarget} busy={busyId === refuseTarget?._id}
        onClose={() => setRefuseTarget(null)} onConfirm={handleRefuseConfirm} />
    </Box>
  );
}

// ─── Leaves: tab root ────────────────────────────────────────────────────────────

function LeavesTab() {
  const [balance, setBalance] = useState<LeaveBalanceRow[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequestRecord[]>([]);
  const [summary, setSummary] = useState<ApprovalsSummary | null>(null);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [subTab, setSubTab] = useState<'requests' | 'calendar' | 'approvals'>('requests');
  const [selected, setSelected] = useState<LeaveRequestRecord | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bRes, rRes, tRes] = await Promise.all([
        axios.get(`${LEAVE_API}/balance`),
        axios.get(`${LEAVE_API}/requests`, { params: { scope: 'mine' } }),
        axios.get(`${LEAVE_API}/types`),
      ]);
      setBalance(bRes.data?.data || []);
      setRequests(rRes.data?.data || []);
      setLeaveTypes(tRes.data?.data || []);
    } catch { showToast('Failed to load leave data', 'error'); }
    finally { setLoading(false); }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${LEAVE_API}/approvals/summary`);
      setSummary(res.data?.data || null);
    } catch { /* non-fatal — Approvals tab just stays hidden */ }
  }, []);

  const loadApprovals = useCallback(async () => {
    try {
      setApprovalsLoading(true);
      const res = await axios.get(`${LEAVE_API}/requests`, { params: { scope: 'pending_my_action' } });
      setApprovalRequests(res.data?.data || []);
    } catch { showToast('Failed to load approvals', 'error'); }
    finally { setApprovalsLoading(false); }
  }, []);

  useEffect(() => { loadData(); loadSummary(); }, [loadData, loadSummary]);
  useEffect(() => { if (summary?.canApprove) loadApprovals(); }, [summary?.canApprove, loadApprovals]);

  // Updates (or, if it dropped off the relevant scope, removes) a request in
  // both lists in place — no full reload after an approve/refuse/cancel.
  const patchRequestInLists = useCallback((updated: LeaveRequestRecord) => {
    setRequests(prev => prev.some(r => r._id === updated._id) ? prev.map(r => r._id === updated._id ? updated : r) : prev);
    setApprovalRequests(prev => {
      if (!prev.some(r => r._id === updated._id)) return prev;
      const stillPending = ['to_approve', 'second_approval'].includes(updated.status);
      return stillPending ? prev.map(r => r._id === updated._id ? updated : r) : prev.filter(r => r._id !== updated._id);
    });
    setSelected(prev => (prev && prev._id === updated._id ? updated : prev));
    loadSummary();
  }, [loadSummary]);

  const handleCancel = async (id: string) => {
    try {
      const res = await axios.put(`${LEAVE_API}/requests/${id}/cancel`);
      showToast('Request cancelled');
      patchRequestInLists(res.data?.data);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to cancel', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await axios.put(`${LEAVE_API}/requests/${id}/approve`);
      showToast('Request approved');
      patchRequestInLists(res.data?.data);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to approve', 'error');
    }
  };

  const handleRefuse = async (id: string, reason: string) => {
    try {
      const res = await axios.put(`${LEAVE_API}/requests/${id}/refuse`, { reason });
      showToast('Request refused');
      patchRequestInLists(res.data?.data);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to refuse', 'error');
    }
  };

  const tabs: { id: 'requests' | 'calendar' | 'approvals'; label: string }[] = [
    { id: 'requests', label: 'My Requests' },
    { id: 'calendar', label: 'Calendar' },
    ...(summary?.canApprove ? [{ id: 'approvals' as const, label: 'Approvals' }] : []),
  ];

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Time Off</Typography>
          <Typography fontSize={12} color="text.secondary">Your leave balances and requests</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          New Time Off
        </Button>
      </Box>

      <LeaveBalanceCards balance={balance} loading={loading} />

      <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 3 }}>
        {tabs.map(t => (
          <Button key={t.id} size="small" variant={subTab === t.id ? 'contained' : 'outlined'} onClick={() => setSubTab(t.id)}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5,
              bgcolor: subTab === t.id ? ACCENT : 'transparent', borderColor: ACCENT,
              color: subTab === t.id ? 'white' : ACCENT, '&:hover': { bgcolor: subTab === t.id ? '#4338ca' : '#eef2ff' } }}>
            {t.id === 'approvals' && summary && summary.pending > 0 ? (
              <Badge badgeContent={summary.pending} color="error" sx={{ '& .MuiBadge-badge': { right: -10, top: 2 } }}>
                {t.label}
              </Badge>
            ) : t.label}
          </Button>
        ))}
      </Box>

      {subTab === 'requests' && (
        <MyRequestsTable requests={requests} leaveTypes={leaveTypes} loading={loading} onSelect={setSelected} />
      )}
      {subTab === 'calendar' && (
        // Team/overview calendar grid is Phase 3, alongside Team Calendar — a
        // personal month view here would duplicate that work twice over.
        <ComingSoonTab icon={<BeachAccessIcon sx={{ fontSize: 40 }} />} title="Calendar view" />
      )}
      {subTab === 'approvals' && (
        <ApprovalsTab requests={approvalRequests} leaveTypes={leaveTypes} summary={summary} loading={approvalsLoading}
          onSelect={setSelected} onApprove={handleApprove} onRefuse={handleRefuse} />
      )}

      <NewTimeOffModal open={formOpen} leaveTypes={leaveTypes} balance={balance}
        onClose={() => setFormOpen(false)}
        onDone={() => { setFormOpen(false); loadData(); }}
        showToast={showToast} />

      <LeaveRequestDetailDialog record={selected} leaveTypes={leaveTypes}
        onClose={() => setSelected(null)} onApprove={handleApprove} onRefuse={handleRefuse} onCancel={handleCancel}
        onMailSent={patchRequestInLists} showToast={showToast} />
    </Box>
  );
}

// ─── Attendance tab ─────────────────────────────────────────────────────────────

interface AttendanceDay {
  employeeCode: string;
  employeeName?: string;
  day: string;
  onboardingId: string | null;
  punchIn: string;
  punchOut: string | null;
  punchCount: number;
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';

const fmtHours = (inIso: string, outIso: string | null) => {
  if (!outIso) return '—';
  const mins = Math.round((new Date(outIso).getTime() - new Date(inIso).getTime()) / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
};

function AttendanceTab() {
  // Dates are IST calendar days, regardless of the browser's own time zone.
  const toInput = (d: Date) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => toInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => toInput(new Date()));
  const [empId, setEmpId] = useState('');
  const [rows, setRows] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (empId.trim()) params.empId = empId.trim();
      if (from) params.from = new Date(`${from}T00:00:00+05:30`).toISOString();
      if (to) params.to = new Date(`${to}T23:59:59.999+05:30`).toISOString();
      const res = await axios.get(`${API_URL}/attendance/daily`, { params });
      setRows(res.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [from, to, empId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Employee Code" value={empId} onChange={e => setEmpId(e.target.value)} sx={{ width: 160 }} />
        <TextField size="small" type="date" label="From" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="To" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button startIcon={<RestartAltIcon />} onClick={load} sx={{ textTransform: 'none', color: ACCENT }}>Refresh</Button>
        <Typography fontSize={12} color="text.secondary">{rows.length} day record{rows.length === 1 ? '' : 's'}</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Date', 'Employee Name', 'Employee Code', 'Punch In', 'Punch Out', 'Hours', 'Punches'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={22} /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: 13 }}>No attendance records for this range.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={`${r.employeeCode}-${r.day}`} hover>
                <TableCell sx={{ fontSize: 13 }}>
                  {new Date(`${r.day}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                </TableCell>
                <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{r.employeeName || '—'}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{r.employeeCode}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{fmtTime(r.punchIn)}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>
                  {r.punchOut ? fmtTime(r.punchOut) : <Chip size="small" label="No out punch" sx={{ fontSize: 11 }} />}
                </TableCell>
                <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{fmtHours(r.punchIn, r.punchOut)}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{r.punchCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Placeholder tabs ────────────────────────────────────────────────────────────

function ComingSoonTab({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, color: 'text.secondary' }}>
      {icon}
      <Typography fontSize={16} fontWeight={700} color="#0f172a" mt={1.5}>{title}</Typography>
      <Typography fontSize={12} mt={0.5}>This feature is cooking. Check back soon.</Typography>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type TabId = 'out-of-office' | 'attendance' | 'leaves';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'out-of-office', label: 'Out of Office', icon: <WorkOffIcon fontSize="small" /> },
  { id: 'attendance', label: 'Attendance', icon: <TodayIcon fontSize="small" /> },
  { id: 'leaves', label: 'Leaves', icon: <BeachAccessIcon fontSize="small" /> },
];

export default function AttendancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = (new URLSearchParams(location.search).get('tab') || 'out-of-office') as TabId;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-auto pt-16 md:pt-20">
          <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
              {TABS.map(t => (
                <Button key={t.id} startIcon={t.icon} onClick={() => navigate(`/attendance?tab=${t.id}`)}
                  variant={activeTab === t.id ? 'contained' : 'outlined'}
                  sx={{
                    textTransform: 'none', fontWeight: 600, borderRadius: 1.5,
                    bgcolor: activeTab === t.id ? ACCENT : 'transparent', borderColor: ACCENT,
                    color: activeTab === t.id ? 'white' : ACCENT,
                    '&:hover': { bgcolor: activeTab === t.id ? '#4338ca' : '#eef2ff' },
                  }}>
                  {t.label}
                </Button>
              ))}
            </Box>

            {activeTab === 'out-of-office' && <OutOfOfficeTab />}
            {activeTab === 'attendance' && <AttendanceTab />}
            {activeTab === 'leaves' && <LeavesTab />}
          </Box>
        </main>
      </div>
    </div>
  );
}
