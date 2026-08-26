import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'Low' | 'Medium' | 'Critical';
type Status = 'Open' | 'In Progress' | 'Resolved';

interface TargetPerson {
  employeeId      : string;
  name            : string;
  department      : string;
  designation     : string;
  email           : string;
  reportingManager: string;
}

interface TimelineEntry {
  who         : string;
  note        : string;
  statusAtTime: string;
  when        : string;
}

interface Grievance {
  _id        : string;
  caseNumber : string;
  filedBy    : { employeeId: string; name: string; email: string; mobile: string; department: string; designation: string };
  concerning : TargetPerson[];
  category   : string;
  subcategory: string;
  description: string;
  severity   : Severity;
  status     : Status;
  timeline   : TimelineEntry[];
  createdAt  : string;
  updatedAt  : string;
}

interface Employee {
  _id           : string;
  employee_id   : string;
  full_name     : string;
  department    : string;
  designation   : string;
  email         : string;
  official_email: string;
  mobile        : string;
  reporting_head: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API     = `${API_URL}/grievances`;
const EMP_API = `${API_URL}/onboarding/eligible-employees`;

const ACCENT = '#166534';
const ACCENT_HOVER = '#14532d';
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: '1px solid #e2e8f0' };
const HR_ROLES = ['HR', 'Management', 'Admin'];

const CATEGORY_TAXONOMY: Record<string, string[]> = {
  'Harassment or misconduct': ['Verbal harassment', 'Physical harassment', 'Sexual harassment', 'Bullying / intimidation', 'Other'],
  'Workplace conflict': ['Conflict with colleague', 'Conflict with manager', 'Team dynamics', 'Other'],
  'Unfair treatment': ['Discrimination', 'Favoritism', 'Unequal workload', 'Denied opportunity', 'Other'],
  'Policy violation': ['Attendance policy', 'Code of conduct', 'Confidentiality / data', 'Safety violation', 'Other'],
  'Compensation & benefits': ['Salary discrepancy', 'Benefits issue', 'Reimbursement delay', 'Other'],
  'Other': ['Other'],
};

const SEVERITY_OPTIONS: { value: Severity; days: number }[] = [
  { value: 'Low', days: 2 },
  { value: 'Medium', days: 5 },
  { value: 'Critical', days: 7 },
];

const STATUS_OPTIONS: Status[] = ['Open', 'In Progress', 'Resolved'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (n: string) => n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const fmtDate = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
};

const fmtDateTime = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(d); }
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const addDays = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };
const fmtDueDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;

const severityColor = (s: Severity) => s === 'Low' ? '#059669' : s === 'Medium' ? '#b45309' : '#dc2626';
const severityBg    = (s: Severity) => s === 'Low' ? '#ecfdf5' : s === 'Medium' ? '#fffbeb' : '#fef2f2';
const statusColor   = (s: Status) => s === 'Open' ? '#dc2626' : s === 'In Progress' ? '#b45309' : '#059669';
const statusBg      = (s: Status) => s === 'Open' ? '#fef2f2' : s === 'In Progress' ? '#fffbeb' : '#ecfdf5';

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2 }}>{msg}</Alert>
    </Box>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, loading, isHr, onAdd, onSelect }: {
  records: Grievance[]; loading: boolean; isHr: boolean; onAdd: () => void; onSelect: (r: Grievance) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [severity, setSeverity] = useState('All');

  const filtered = useMemo(() => records.filter(r => {
    const searchOk = !search
      || r.caseNumber?.toLowerCase().includes(search.toLowerCase())
      || r.concerning.some(t => t.name.toLowerCase().includes(search.toLowerCase()))
      || r.category.toLowerCase().includes(search.toLowerCase());
    const statusOk = status === 'All' || r.status === status;
    const severityOk = severity === 'All' || r.severity === severity;
    return searchOk && statusOk && severityOk;
  }), [records, search, status, severity]);

  const kpis = useMemo(() => {
    const isThisMonth = (d?: string) => {
      if (!d) return false;
      const dt = new Date(d); const n = new Date();
      return dt.getFullYear() === n.getFullYear() && dt.getMonth() === n.getMonth();
    };
    return {
      open: records.filter(r => r.status === 'Open').length,
      inProgress: records.filter(r => r.status === 'In Progress').length,
      resolvedThisMonth: records.filter(r => r.status === 'Resolved' && isThisMonth(r.updatedAt)).length,
      criticalUnresolved: records.filter(r => r.severity === 'Critical' && r.status !== 'Resolved').length,
    };
  }, [records]);

  return (
    <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">{isHr ? 'Grievances' : 'My grievances'}</Typography>
          <Typography fontSize={12} color="text.secondary">
            {isHr ? 'Every grievance filed across the company — confidential to HR & Management.' : "Grievances you've filed confidentially with HR"}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: ACCENT_HOVER } }}>
          File grievance
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { label: 'Open', value: kpis.open },
          { label: 'In progress', value: kpis.inProgress },
          { label: 'Resolved this month', value: kpis.resolvedThisMonth },
          { label: 'Critical, unresolved', value: kpis.criticalUnresolved, crit: true },
        ].map(k => (
          <Box key={k.label} sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 2, p: '14px 16px' }}>
            <Typography sx={{ fontSize: 10.5, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 600 }}>
              {k.label}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700, mt: 0.5, color: k.crit ? '#dc2626' : '#0f172a' }}>
              {k.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search case #, name, or category…" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} InputProps={{ sx: { fontSize: 13 } }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 12 }}>Status</InputLabel>
          <Select value={status} label="Status" onChange={e => setStatus(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {STATUS_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 12 }}>Severity</InputLabel>
          <Select value={severity} label="Severity" onChange={e => setSeverity(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {SEVERITY_OPTIONS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.value}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box> : (
          <TableContainer sx={{ maxHeight: 520, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Case #</TableCell>
                  <TableCell>Date</TableCell>
                  {isHr && <TableCell>Filed By</TableCell>}
                  <TableCell>Concerning</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={isHr ? 7 : 6} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                    No grievances {isHr ? 'logged yet' : "you've filed yet"}
                  </TableCell></TableRow>
                )}
                {filtered.map(r => (
                  <TableRow key={r._id} onClick={() => onSelect(r)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={{ fontSize: 12, fontFamily: 'monospace', color: ACCENT, fontWeight: 600 }}>{r.caseNumber || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</TableCell>
                    {isHr && (
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: ACCENT, fontSize: 10, fontWeight: 700 }}>{initials(r.filedBy.name)}</Avatar>
                          <Typography fontSize={12} fontWeight={600}>{r.filedBy.name}</Typography>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell sx={{ fontSize: 12 }}>{r.concerning.map(t => t.name).join(', ') || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{r.category}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.severity} sx={{ fontSize: 10, height: 20, bgcolor: severityBg(r.severity), color: severityColor(r.severity), fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} sx={{ fontSize: 10, height: 20, bgcolor: statusBg(r.status), color: statusColor(r.status), fontWeight: 600 }} />
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

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ record, isHr, onClose, onUpdated, showToast }: {
  record: Grievance | null; isHr: boolean; onClose: () => void;
  onUpdated: (g: Grievance) => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [note, setNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNote(''); setNewStatus(''); }, [record?._id]);

  const submitUpdate = async () => {
    if (!record || !note.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/${record._id}/updates`, { note, status: newStatus || undefined });
      if (data.success) { onUpdated(data.data); setNote(''); setNewStatus(''); showToast('Update added', 'success'); }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed to add update', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={!!record} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '95vw', sm: 560 }, maxHeight: '85vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 2, p: 3, outline: 'none' }}>
        {record && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography fontSize={10} fontWeight={700} letterSpacing={0.5} color={ACCENT} sx={{ fontFamily: 'monospace' }}>{record.caseNumber}</Typography>
                <Typography fontSize={16} fontWeight={700}>Grievance Details</Typography>
                <Typography fontSize={12} color="text.secondary">Filed on {fmtDateTime(record.createdAt)}</Typography>
              </Box>
              <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
            </Box>

            <Stack spacing={1.5}>
              {isHr && (
                <Box>
                  <Typography fontSize={11} color="text.secondary">Filed By</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.filedBy.name}</Typography>
                  <Typography fontSize={11} color="text.secondary">{record.filedBy.department} · {record.filedBy.designation}</Typography>
                </Box>
              )}
              <Box>
                <Typography fontSize={11} color="text.secondary">This concerns</Typography>
                <Stack spacing={0.5} mt={0.5}>
                  {record.concerning.map((t, i) => (
                    <Box key={i} sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <Typography fontSize={13} fontWeight={600}>{t.name}</Typography>
                      <Typography fontSize={11} color="text.secondary">{t.designation} · {t.department} · Reports to {t.reportingManager || '—'}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Category</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.category}</Typography>
                  <Typography fontSize={11} color="text.secondary">{record.subcategory}</Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Severity</Typography>
                  <Chip size="small" label={record.severity} sx={{ fontSize: 10, height: 20, bgcolor: severityBg(record.severity), color: severityColor(record.severity), fontWeight: 600 }} />
                </Box>
              </Box>
              <Box>
                <Typography fontSize={11} color="text.secondary">Status</Typography>
                <Chip size="small" label={record.status} sx={{ fontSize: 10, height: 20, bgcolor: statusBg(record.status), color: statusColor(record.status), fontWeight: 600 }} />
              </Box>
              <Divider />
              <Box>
                <Typography fontSize={11} color="text.secondary">Description</Typography>
                <Typography fontSize={13} sx={{ whiteSpace: 'pre-wrap' }}>{record.description}</Typography>
              </Box>

              <Divider />
              <Box>
                <Typography fontSize={11} color="text.secondary" mb={1}>Action taken</Typography>
                <Stack spacing={1}>
                  {record.timeline.map((t, i) => (
                    <Box key={i} sx={{ pl: 1.5, borderLeft: '2px solid #e2e8f0' }}>
                      <Typography fontSize={12} fontWeight={600}>{t.who}</Typography>
                      <Typography fontSize={10} color="text.secondary">{fmtDateTime(t.when)}</Typography>
                      <Typography fontSize={12} color="#4b5563">{t.note}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {isHr ? (
                <Box sx={{ mt: 1 }}>
                  <TextField size="small" fullWidth multiline minRows={2} placeholder="Add an update — what was done, and by whom…"
                    value={note} onChange={e => setNote(e.target.value)} />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <Select displayEmpty value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                        <MenuItem value="">Keep status</MenuItem>
                        {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button variant="contained" disabled={busy || !note.trim()} onClick={submitUpdate}
                      sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT_HOVER }, textTransform: 'none', fontWeight: 600 }}>
                      {busy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Add update'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography fontSize={11} color="text.secondary" fontStyle="italic">
                  Only HR &amp; Management can add updates or change status.
                </Typography>
              )}
            </Stack>
          </>
        )}
      </Box>
    </Modal>
  );
}

// ─── Form (matches the reference layout) ───────────────────────────────────────

function GrievanceForm({ employees, onDone, onBack, showToast }: {
  employees: Employee[]; onDone: () => void; onBack: () => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const { user } = useAuth();

  const filer = useMemo(() => {
    if (user?.employeeId) {
      const byId = employees.find(e => e.employee_id === user.employeeId);
      if (byId) return byId;
    }
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return employees.find(e =>
      e.official_email?.toLowerCase() === email || e.email?.toLowerCase() === email
    ) || null;
  }, [employees, user]);

  const [concerning, setConcerning] = useState<Employee[]>([]);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearForm = () => {
    setConcerning([]); setCategory(''); setSubcategory('');
    setDescription(''); setSeverity('Medium'); setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!filer) { setError("Your account isn't linked to an employee record — contact HR before filing a grievance."); return; }
    if (concerning.length === 0) { setError('Select one or more employees this concerns.'); return; }
    if (!category) { setError('Select a category.'); return; }
    if (!description.trim()) { setError('Describe what happened.'); return; }

    setBusy(true);
    try {
      const payload = {
        filedBy: {
          employeeId: filer.employee_id, name: filer.full_name,
          email: filer.official_email || filer.email, mobile: filer.mobile,
          department: filer.department, designation: filer.designation,
        },
        concerning: concerning.map(e => ({
          employeeId: e.employee_id, name: e.full_name, department: e.department,
          designation: e.designation, email: e.official_email || e.email, reportingManager: e.reporting_head,
        })),
        category, subcategory, description, severity,
      };
      const { data } = await axios.post(API, payload);
      if (data.success) { showToast(`Grievance ${data.data.caseNumber} filed confidentially with HR & Management.`, 'success'); onDone(); }
      else setError(data.message || 'Failed to submit.');
    } catch (e: any) { setError(e?.response?.data?.message || 'Failed to submit.'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ p: 2.5, maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">File a grievance</Typography>
          <Typography fontSize={12} color="text.secondary">Confidential — only you and HR &amp; Management will see this.</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f3f0fa', color: '#4a3e70', borderRadius: 2, p: 1.5, mb: 2.5, fontSize: 12, lineHeight: 1.5 }}>
        <LockIcon sx={{ fontSize: 18, flexShrink: 0 }} />
        <span>Only you and HR &amp; Management can see this. The person(s) it concerns will not be notified or shown this record.</span>
      </Box>

      {/* Filed By */}
      <Box sx={{ mb: 2.5 }}>
        <Typography fontSize={13} fontWeight={700} mb={1}>Filed by</Typography>
        {filer ? (
          <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0', fontSize: 13 }}>
            {filer.full_name} · {filer.designation} · {filer.department} · {filer.official_email || filer.email}
          </Box>
        ) : (
          <Alert severity="warning" sx={{ fontSize: 12 }}>
            Your account isn't linked to an employee record — contact HR before filing a grievance.
          </Alert>
        )}
      </Box>

      {/* This concerns */}
      <Box sx={{ mb: 2.5 }}>
        <Typography fontSize={13} fontWeight={700} mb={0.5}>This concerns</Typography>
        <Typography fontSize={11.5} color="text.secondary" mb={1}>
          Select one or more employees. Their department, designation, email, and reporting manager will be pulled in automatically.
        </Typography>
        <Autocomplete
          multiple
          options={employees}
          getOptionLabel={e => `${e.full_name} (${e.department})`}
          isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
          value={concerning}
          onChange={(_, v) => setConcerning(v)}
          renderInput={p => <TextField {...p} size="small" placeholder="Search by name or department…" />}
        />
        {concerning.length > 0 && (
          <Stack spacing={0.75} mt={1}>
            {concerning.map(e => (
              <Box key={e.employee_id} sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Typography fontSize={12} fontWeight={600}>{e.full_name}</Typography>
                <Typography fontSize={11} color="text.secondary">
                  {e.designation} · {e.department} · {e.official_email || e.email} · Reports to {e.reporting_head || '—'}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Category / Subcategory */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
        <FormControl size="small" fullWidth>
          <Typography fontSize={13} fontWeight={700} mb={1}>Category</Typography>
          <Select displayEmpty value={category}
            onChange={e => { setCategory(e.target.value); setSubcategory(''); }}>
            <MenuItem value="" disabled>Select a category</MenuItem>
            {Object.keys(CATEGORY_TAXONOMY).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth disabled={!category}>
          <Typography fontSize={13} fontWeight={700} mb={1}>Subcategory</Typography>
          <Select displayEmpty value={subcategory} onChange={e => setSubcategory(e.target.value)}>
            <MenuItem value="" disabled>{category ? 'Select a subcategory' : 'Select a category first'}</MenuItem>
            {(CATEGORY_TAXONOMY[category] || []).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Description */}
      <Box sx={{ mb: 2.5 }}>
        <Typography fontSize={13} fontWeight={700} mb={0.5}>Describe what happened</Typography>
        <Typography fontSize={11.5} color="text.secondary" mb={1}>Include dates, specific incidents, and any prior steps you've taken.</Typography>
        <TextField fullWidth multiline minRows={5} placeholder="Describe the situation in as much detail as you can…"
          value={description} onChange={e => setDescription(e.target.value)} />
      </Box>

      {/* Severity */}
      <Box sx={{ mb: 3 }}>
        <Typography fontSize={13} fontWeight={700} mb={1}>Severity level</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
          {SEVERITY_OPTIONS.map(o => {
            const selected = severity === o.value;
            return (
              <Box key={o.value} onClick={() => setSeverity(o.value)}
                sx={{
                  cursor: 'pointer', textAlign: 'center', borderRadius: 2, py: 1.5, px: 1,
                  border: `1.5px solid ${selected ? severityColor(o.value) : '#e2e8f0'}`,
                  bgcolor: selected ? severityBg(o.value) : 'white',
                  transition: 'all 0.15s ease',
                }}>
                <Typography fontSize={13} fontWeight={700} color={selected ? severityColor(o.value) : '#0f172a'}>{o.value}</Typography>
                <Typography fontSize={11} color={selected ? severityColor(o.value) : 'text.secondary'} mt={0.25}>{o.days}-day resolution</Typography>
              </Box>
            );
          })}
        </Box>
        {(() => {
          const opt = SEVERITY_OPTIONS.find(o => o.value === severity)!;
          const due = fmtDueDate(addDays(new Date(), opt.days));
          return (
            <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, fontSize: 12, bgcolor: severityBg(severity), color: severityColor(severity) }}>
              <b>{severity} severity</b> — resolution due by {due} ({opt.days} days from filing).
            </Box>
          );
        })()}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={clearForm} sx={{ textTransform: 'none', color: 'text.secondary' }}>Clear form</Button>
        <Button variant="contained" onClick={submit} disabled={busy}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT_HOVER }, textTransform: 'none', fontWeight: 600, px: 3 }}>
          {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Submit grievance'}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'form';

export default function Grievancespage() {
  const { user } = useAuth();
  const isHr = HR_ROLES.includes(user?.role || '');

  const [records, setRecords] = useState<Grievance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selected, setSelected] = useState<Grievance | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rRes, eRes] = await Promise.all([axios.get(API), axios.get(EMP_API)]);
      setRecords(Array.isArray(rRes.data) ? rRes.data : rRes.data?.data || []);
      const empList: Employee[] = Array.isArray(eRes.data) ? eRes.data : eRes.data?.data || [];
      setEmployees([...empList].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && view === 'dashboard') return (
    <div className="flex min-h-screen bg-gray-50/70">
      <Sidebar /><div className="flex-1 flex flex-col"><Navbar />
        <main className="flex-1 flex items-center justify-center pt-16 md:pt-20">
          <CircularProgress size={40} />
        </main>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-hidden pt-16 md:pt-20">
          <Box sx={{ maxWidth: 1300, mx: 'auto', width: '100%', height: '100%', overflow: 'auto' }}>
            {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            {view === 'dashboard' && (
              <DashboardView records={records} loading={loading} isHr={isHr} onAdd={() => setView('form')} onSelect={setSelected} />
            )}

            {view === 'form' && (
              <GrievanceForm employees={employees}
                onBack={() => setView('dashboard')}
                onDone={() => { setView('dashboard'); loadData(); }}
                showToast={showToast} />
            )}

            <DetailModal record={selected} isHr={isHr} onClose={() => setSelected(null)}
              onUpdated={updated => { setSelected(updated); setRecords(rs => rs.map(r => r._id === updated._id ? updated : r)); }}
              showToast={showToast} />
          </Box>
        </main>
      </div>
    </div>
  );
}
