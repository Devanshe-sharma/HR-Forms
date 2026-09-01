import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Autocomplete, Stack, IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  WorkOff as WorkOffIcon,
  Today as TodayIcon,
  BeachAccess as BeachAccessIcon,
  Search as SearchIcon,
  RestartAlt as RestartAltIcon,
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
  createdAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API = `${API_URL}/out-of-office`;
const EMP_API = `${API_URL}/onboarding/eligible-employees`;

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
                  <TableCell sx={{ width: '20%' }}>Out of Office</TableCell>
                  <TableCell sx={{ width: '20%' }}>Reason</TableCell>
                  <TableCell sx={{ width: '12%' }}>Informed</TableCell>
                  <TableCell sx={{ width: '8%' }}>Cc</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
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
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 12, fontWeight: 600 }}>{fmtDate(r.startDateTime)}</Typography>
                      <Typography component="span" sx={{ ...ELLIPSIS, fontSize: 11, color: 'text.secondary' }}>{fmtTime24(r.startDateTime)} – {fmtUpTo(r.upToTime, r.upToDate)}</Typography>
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the form and stamp the "logged at" time fresh each time the popup opens.
  useEffect(() => {
    if (!open) return;
    setLoggedAt(new Date());
    setPerson(null); setOooDate(''); setStartTime(''); setUpToDate(''); setUpToTime('');
    setReason(''); setCcEmployees([]); setError(null);
  }, [open]);

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
      };
      const { data } = await axios.post(API, payload);
      if (data.success) { showToast('Out of office logged — HR has been notified', 'success'); onDone(); }
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
            {activeTab === 'attendance' && <ComingSoonTab icon={<TodayIcon sx={{ fontSize: 40 }} />} title="Attendance" />}
            {activeTab === 'leaves' && <ComingSoonTab icon={<BeachAccessIcon sx={{ fontSize: 40 }} />} title="Leaves" />}
          </Box>
        </main>
      </div>
    </div>
  );
}
