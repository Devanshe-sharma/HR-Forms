import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Autocomplete, Stack, IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  WorkOff as WorkOffIcon,
  Today as TodayIcon,
  BeachAccess as BeachAccessIcon,
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
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: '1px solid #e2e8f0' };

const informedColor = (s: OutOfOfficeRecord['informedStatus']) => (s === 'advance' ? '#2563eb' : '#dc2626');

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

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2 }}>{msg}</Alert>
    </Box>
  );
}

// ─── Out of Office: dashboard ──────────────────────────────────────────────────

function OutOfOfficeDashboard({ records, loading, onAdd }: {
  records: OutOfOfficeRecord[]; loading: boolean; onAdd: () => void;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Out of Office</Typography>
          <Typography fontSize={12} color="text.secondary">Advance notice of employees working out of office</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          Log Out of Office
        </Button>
      </Box>

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box> : (
          <TableContainer sx={{ maxHeight: 520, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Person</TableCell>
                  <TableCell>Timing</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Kept in Cc</TableCell>
                  <TableCell>Informed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                    No out-of-office records logged yet
                  </TableCell></TableRow>
                )}
                {records.map(r => (
                  <TableRow key={r._id} sx={{ borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={{ fontSize: 12 }}>{fmtDate(r.startDateTime)}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{r.person.name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{fmtTime24(r.startDateTime)} – {r.upToTime}</TableCell>
                    <TableCell sx={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{r.ccEmployees?.length ? r.ccEmployees.map(c => c.name).join(', ') : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.informedLabel} sx={{ fontSize: 10, height: 20, bgcolor: '#f8fafc', color: informedColor(r.informedStatus), border: `1px solid ${informedColor(r.informedStatus)}30` }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

// ─── Out of Office: form ────────────────────────────────────────────────────────

function OutOfOfficeForm({ employees, onDone, onBack, showToast }: {
  employees: Employee[]; onDone: () => void; onBack: () => void; showToast: (m: string, t: 'success' | 'error') => void;
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

  const [person, setPerson] = useState<Employee | null>(null);
  const [oooDate, setOooDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [upToTime, setUpToTime] = useState('');
  const [reason, setReason] = useState('');
  const [ccEmployees, setCcEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!person) { setError('Select the person out of office.'); return; }
    if (!oooDate || !startTime) { setError('Enter the out of office date and start time.'); return; }
    if (!upToTime) { setError('Enter the time up to.'); return; }
    if (!reason.trim()) { setError('Enter a reason.'); return; }

    const startDateTime = new Date(`${oooDate}T${startTime}:00`);
    if (Number.isNaN(startDateTime.getTime())) { setError('Invalid date/time.'); return; }

    setBusy(true);
    try {
      const payload = {
        submittedByEmail: submitter?.official_email || submitter?.email || user?.email || '',
        submittedByName: submitter?.full_name || '',
        person: { employeeId: person.employee_id, name: person.full_name, email: person.official_email || person.email },
        startDateTime: startDateTime.toISOString(),
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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Log Out of Office</Typography>
          <Typography fontSize={12} color="text.secondary">Notifies HR, the person, and anyone kept in cc</Typography>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, maxWidth: 640 }}>
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

          <TextField type="time" size="small" value={upToTime} onChange={e => setUpToTime(e.target.value)}
            InputLabelProps={{ shrink: true }} inputProps={{ step: 300 }}
            label="Time Up To *" helperText="24-hour format" />

          <TextField label="Reason *" multiline rows={3} size="small" value={reason}
            onChange={e => setReason(e.target.value)} fullWidth />

          <Autocomplete multiple options={employees} getOptionLabel={e => `${e.full_name} (${e.department})`}
            value={ccEmployees} onChange={(_, v) => setCcEmployees(v)}
            renderInput={p => <TextField {...p} size="small" label="Keep in Cc" placeholder="Search name or department…" />} />

          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
            <Button variant="contained" onClick={submit} disabled={busy}
              sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, textTransform: 'none', fontWeight: 600 }}>
              {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Submit'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Out of Office: tab root ────────────────────────────────────────────────────

function OutOfOfficeTab() {
  const [records, setRecords] = useState<OutOfOfficeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rRes, eRes] = await Promise.all([axios.get(API), axios.get(EMP_API)]);
      setRecords(Array.isArray(rRes.data) ? rRes.data : rRes.data?.data || []);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : eRes.data?.data || []);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {view === 'dashboard' && (
        <OutOfOfficeDashboard records={records} loading={loading} onAdd={() => setView('form')} />
      )}

      {view === 'form' && (
        <OutOfOfficeForm employees={employees}
          onBack={() => setView('dashboard')}
          onDone={() => { setView('dashboard'); loadData(); }}
          showToast={showToast} />
      )}
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
