import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Autocomplete,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type EscalationMode = 'Employee' | 'External' | 'BO';

interface TargetPerson {
  employeeId  : string;
  name        : string;
  department  : string;
  designation : string;
  email       : string;
}

interface Escalation {
  _id            : string;
  caseNumber     : string;
  createdBy      : { employeeId: string; name: string; email: string; mobile: string; department: string; designation: string };
  escalationFor  : EscalationMode;
  targetEmployees: TargetPerson[];
  department     : string;
  reportedBy     : string;
  company        : string;
  project        : string;
  event          : string;
  category       : string;
  description    : string;
  dateOccurred   : string;
  cc             : string[];
  createdAt      : string;
}

interface Employee {
  _id             : string;
  employee_id     : string;
  full_name       : string;
  department      : string;
  designation     : string;
  email           : string;
  official_email  : string;
  mobile          : string;
  escalation_score: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API     = `${API_URL}/escalations`;
const EMP_API = `${API_URL}/onboarding/eligible-employees`;

const ACCENT = '#4f46e5';
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: '1px solid #e2e8f0' };

const MODE_OPTIONS: { value: EscalationMode; label: string }[] = [
  { value: 'Employee', label: 'For Employees' },
  { value: 'External', label: 'Logged on Behalf of External Parties' },
  { value: 'BO', label: 'For BO Members / Clients / Vendors / Referrers, etc.' },
];
const modeLabel = (m: EscalationMode) => MODE_OPTIONS.find(o => o.value === m)?.label || m;

// Universal category list — same across all three modes. Kept in sync with
// the backend's Escalation model enum.
const CATEGORIES = [
  { code: 'T', name: 'Timeliness-Reliability' },
  { code: 'Q', name: 'Quality' },
  { code: 'C', name: 'Profit-Economy-CashFlow' },
  { code: 'P', name: 'Process-Reporting-Data' },
  { code: 'H', name: 'Honesty-Ethics' },
  { code: 'Ext', name: 'External Escalation' },
  { code: 'Culture', name: 'Culture-Leadership Behaviour' },
  { code: 'POSH', name: 'POSH Case' },
  { code: 'Ext Factors', name: 'External Factors Log' },
  { code: 'Other', name: 'Any Other' },
];
const categoryName = (code: string) => CATEGORIES.find(c => c.code === code)?.name || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (n: string) => n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
};

const fmtDateTime = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(d); }
};

const targetSummary = (rec: Pick<Escalation, 'targetEmployees' | 'escalationFor' | 'reportedBy'>) => {
  if (rec.targetEmployees.length) return rec.targetEmployees.map(t => t.name).join(', ');
  if (rec.escalationFor === 'External' && rec.reportedBy) return `Reported by ${rec.reportedBy}`;
  return '—';
};

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2 }}>{msg}</Alert>
    </Box>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, employees, loading, onAdd, onSelect }: {
  records: Escalation[]; employees: Employee[]; loading: boolean; onAdd: () => void; onSelect: (r: Escalation) => void;
}) {
  const scoreById = useMemo(() => {
    const m = new Map<string, number>();
    employees.forEach(e => m.set(e.employee_id, e.escalation_score ?? 0));
    return m;
  }, [employees]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [mode, setMode] = useState('All');

  const filtered = useMemo(() => records.filter(r => {
    const searchOk = !search
      || r.caseNumber?.toLowerCase().includes(search.toLowerCase())
      || r.createdBy.name.toLowerCase().includes(search.toLowerCase())
      || r.targetEmployees.some(t => t.name.toLowerCase().includes(search.toLowerCase()))
      || r.description.toLowerCase().includes(search.toLowerCase());
    const categoryOk = category === 'All' || r.category === category;
    const modeOk = mode === 'All' || r.escalationFor === mode;
    return searchOk && categoryOk && modeOk;
  }), [records, search, category, mode]);

  const kpis = useMemo(() => {
    const isThisMonth = (d?: string) => {
      if (!d) return false;
      const dt = new Date(d); const n = new Date();
      return dt.getFullYear() === n.getFullYear() && dt.getMonth() === n.getMonth();
    };
    return {
      thisMonth: records.filter(r => isThisMonth(r.createdAt)).length,
      employee: records.filter(r => r.escalationFor === 'Employee').length,
      externalOrBo: records.filter(r => r.escalationFor === 'External' || r.escalationFor === 'BO').length,
      posh: records.filter(r => r.category === 'POSH').length,
    };
  }, [records]);

  return (
    <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Escalations</Typography>
          <Typography fontSize={12} color="text.secondary">Employees, external parties, or BO members / clients / vendors / referrers</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          Log Escalation
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { label: 'Logged this month', value: kpis.thisMonth },
          { label: 'For employees', value: kpis.employee },
          { label: 'External / BO', value: kpis.externalOrBo },
          { label: 'POSH cases', value: kpis.posh, crit: true },
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
        <TextField size="small" placeholder="Search case #, name, or description…" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} InputProps={{ sx: { fontSize: 13 } }} />
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel sx={{ fontSize: 12 }}>Mode</InputLabel>
          <Select value={mode} label="Mode" onChange={e => setMode(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {MODE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ fontSize: 12 }}>Category</InputLabel>
          <Select value={category} label="Category" onChange={e => setCategory(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c.code} value={c.code} sx={{ fontSize: 12 }}>{c.code} — {c.name}</MenuItem>)}
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
                  <TableCell>Logged</TableCell>
                  <TableCell>Logged By</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Concerning</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                    No escalations logged yet
                  </TableCell></TableRow>
                )}
                {filtered.map(r => {
                  const score = r.targetEmployees.length ? scoreById.get(r.targetEmployees[0].employeeId) : undefined;
                  return (
                  <TableRow key={r._id} onClick={() => onSelect(r)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={{ fontSize: 12, fontFamily: 'monospace', color: ACCENT, fontWeight: 600 }}>{r.caseNumber || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: ACCENT, fontSize: 10, fontWeight: 700 }}>{initials(r.createdBy.name)}</Avatar>
                        <Typography fontSize={12} fontWeight={600}>{r.createdBy.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Chip size="small" label={r.escalationFor} sx={{ fontSize: 10, height: 20, bgcolor: '#eef2ff', color: ACCENT }} /></TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{targetSummary(r)}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{r.department || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 700, color: score !== undefined && score < 0 ? '#dc2626' : '#0f172a' }}>
                      {score !== undefined ? score : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{r.category} — {categoryName(r.category)}</TableCell>
                    <TableCell sx={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</TableCell>
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

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ record, onClose, onEdit }: { record: Escalation | null; onClose: () => void; onEdit: (r: Escalation) => void }) {
  return (
    <Modal open={!!record} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: { xs: '95vw', sm: 560 }, maxHeight: '85vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 2, p: 3, outline: 'none' }}>
        {record && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography fontSize={10} fontWeight={700} letterSpacing={0.5} color={ACCENT} sx={{ fontFamily: 'monospace' }}>{record.caseNumber}</Typography>
                <Typography fontSize={16} fontWeight={700}>Escalation Details</Typography>
                <Typography fontSize={12} color="text.secondary">Logged on {fmtDateTime(record.createdAt)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" onClick={() => onEdit(record)} sx={{ textTransform: 'none', fontWeight: 600 }}>Edit</Button>
                <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Logged By</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.createdBy.name}</Typography>
                  <Typography fontSize={11} color="text.secondary">{record.createdBy.department} · {record.createdBy.designation}</Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Mode</Typography>
                  <Typography fontSize={13} fontWeight={600}>{modeLabel(record.escalationFor)}</Typography>
                </Box>
              </Box>
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Concerning</Typography>
                  <Typography fontSize={13} fontWeight={600}>{targetSummary(record)}</Typography>
                  {record.escalationFor === 'External' && record.company && (
                    <Typography fontSize={11} color="text.secondary">{record.company}</Typography>
                  )}
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Department</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.department || '—'}</Typography>
                </Box>
              </Box>
              {(record.project || record.event) && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box>
                    <Typography fontSize={11} color="text.secondary">Project</Typography>
                    <Typography fontSize={13} fontWeight={600}>{record.project || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography fontSize={11} color="text.secondary">Event</Typography>
                    <Typography fontSize={13} fontWeight={600}>{record.event || '—'}</Typography>
                  </Box>
                </Box>
              )}
              <Divider />
              <Box>
                <Typography fontSize={11} color="text.secondary">Category</Typography>
                <Typography fontSize={13} fontWeight={600}>{record.category} — {categoryName(record.category)}</Typography>
              </Box>
              <Divider />
              <Box>
                <Typography fontSize={11} color="text.secondary">Description</Typography>
                <Typography fontSize={13} sx={{ whiteSpace: 'pre-wrap' }}>{record.description}</Typography>
              </Box>
              {record.cc?.length > 0 && (
                <Box>
                  <Typography fontSize={11} color="text.secondary">Notified by email</Typography>
                  <Typography fontSize={12}>{record.cc.join(', ')}</Typography>
                </Box>
              )}
            </Stack>
          </>
        )}
      </Box>
    </Modal>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateEscalationForm({ employees, onDone, onBack, showToast }: {
  employees: Employee[]; onDone: () => void; onBack: () => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const { user } = useAuth();

  // Prefer the explicit employeeId link (User.employeeId → Onboarding _id),
  // but plenty of accounts — especially HR/Admin logins created directly —
  // never get that link set. Fall back to matching the logged-in email
  // against the employee's official/personal email so those accounts can
  // still log an escalation without a manual data-linking step first.
  const creator = useMemo(() => {
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

  const departments = useMemo(() =>
    Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort(), [employees]);

  const [mode, setMode] = useState<EscalationMode>('Employee');
  const [department, setDepartment] = useState('');
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [reportedBy, setReportedBy] = useState('');
  const [company, setCompany] = useState('');
  const [project, setProject] = useState('');
  const [event, setEvent] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  // Management and the concerned employee are always notified server-side —
  // this is purely for optionally notifying anyone else too.
  const [ccList, setCcList] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Escalation | null>(null);

  const employeesInDept = useMemo(() =>
    department ? employees.filter(e => e.department === department) : [], [employees, department]);

  const changeMode = (m: EscalationMode) => {
    setMode(m); setDepartment(''); setTargetEmployee(null);
    setReportedBy(''); setCompany(''); setProject(''); setEvent('');
    setCategory(''); setDescription(''); setCcList([]); setError(null);
  };

  const canSubmit = () => {
    const hasCore = !!category && !!department && description.trim().length > 0;
    if (mode === 'Employee') return hasCore && !!targetEmployee;
    if (mode === 'External') return hasCore && !!targetEmployee && reportedBy.trim().length > 0;
    return hasCore; // BO
  };

  const resetAll = () => {
    setMode('Employee'); setDepartment(''); setTargetEmployee(null);
    setReportedBy(''); setCompany(''); setProject(''); setEvent('');
    setCategory(''); setDescription(''); setCcList([]); setError(null); setSubmitted(null);
  };

  const submit = async () => {
    setError(null);
    if (!creator) { setError("Your account isn't linked to an employee record — contact HR before logging an escalation."); return; }
    if (!canSubmit()) { setError('Fill in all required fields.'); return; }

    setBusy(true);
    try {
      const payload = {
        createdBy: {
          employeeId: creator.employee_id, name: creator.full_name,
          email: creator.official_email || creator.email, mobile: creator.mobile,
          department: creator.department, designation: creator.designation,
        },
        escalationFor: mode,
        targetEmployees: targetEmployee
          ? [{ employeeId: targetEmployee.employee_id, name: targetEmployee.full_name, department: targetEmployee.department, designation: targetEmployee.designation, email: targetEmployee.official_email || targetEmployee.email }]
          : [],
        department,
        reportedBy: mode === 'External' ? reportedBy.trim() : '',
        company: mode === 'External' ? company.trim() : '',
        project: project.trim(),
        event: event.trim(),
        category,
        description,
        dateOccurred: todayStr(),
        cc: ccList.map(e => e.official_email || e.email).filter(Boolean),
      };
      const { data } = await axios.post(API, payload);
      if (data.success) { setSubmitted(data.data); onDone(); }
      else setError(data.message || 'Failed to submit.');
    } catch (e: any) { setError(e?.response?.data?.message || 'Failed to submit.'); }
    finally { setBusy(false); }
  };

  if (submitted) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#ecfdf5', display: 'flex',
          alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
          <CheckCircleIcon sx={{ color: '#047857', fontSize: 30 }} />
        </Box>
        <Typography fontSize={17} fontWeight={700} mb={0.5}>Escalation submitted</Typography>
        <Typography fontSize={13} color="text.secondary" mb={0.5}>{submitted.caseNumber}</Typography>
        <Typography fontSize={13} color="text.secondary" mb={2.5}>
          {modeLabel(submitted.escalationFor)} · {submitted.category} — {categoryName(submitted.category)}
        </Typography>
        <Button onClick={resetAll} sx={{ textTransform: 'none', fontWeight: 600 }}>Log another escalation</Button>
      </Box>
    );
  }

  const categoryField = (
    <FormControl size="small" fullWidth>
      <InputLabel>Category</InputLabel>
      <Select value={category} label="Category" onChange={e => setCategory(e.target.value)}>
        {CATEGORIES.map(c => <MenuItem key={c.code} value={c.code}>{c.code} — {c.name}</MenuItem>)}
      </Select>
    </FormControl>
  );
  const departmentField = (resetEmployee: boolean) => (
    <FormControl size="small" fullWidth>
      <InputLabel>Department</InputLabel>
      <Select value={department} label="Department"
        onChange={e => { setDepartment(e.target.value); if (resetEmployee) setTargetEmployee(null); }}>
        {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
      </Select>
    </FormControl>
  );
  const employeeField = (label: string) => (
    <Autocomplete options={employeesInDept} getOptionLabel={e => e.full_name}
      isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
      disabled={!department} value={targetEmployee} onChange={(_, v) => setTargetEmployee(v)}
      renderInput={p => <TextField {...p} size="small" label={label} placeholder={department ? 'Select employee' : 'Select department first'} />} />
  );
  const projectEventRow = (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
      <TextField label="Project (if any)" size="small" value={project} onChange={e => setProject(e.target.value)} fullWidth />
      <TextField label="Event (if any)" size="small" value={event} onChange={e => setEvent(e.target.value)} fullWidth />
    </Box>
  );
  const descriptionField = (
    <TextField label="Description *" multiline rows={4} size="small" value={description}
      placeholder="Describe what happened…" onChange={e => setDescription(e.target.value)} fullWidth />
  );
  const autoTilesRow = (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
      <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, p: '10px 14px' }}>
        <Typography fontSize={11} color="text.secondary">Logged By</Typography>
        <Typography fontSize={13} fontWeight={700}>{creator?.full_name || '—'}</Typography>
      </Box>
      <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, p: '10px 14px' }}>
        <Typography fontSize={11} color="text.secondary">Logged Date</Typography>
        <Typography fontSize={13} fontWeight={700}>{fmtDate(new Date())}</Typography>
      </Box>
    </Box>
  );
  const ccField = (
    <Box>
      <Autocomplete multiple options={employees} getOptionLabel={e => `${e.full_name} (${e.department})`}
        isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
        value={ccList} onChange={(_, v) => setCcList(v)}
        renderInput={p => <TextField {...p} size="small" label="Also notify (optional)" placeholder="Search by name or department…" />} />
      <Typography fontSize={11} color="text.secondary" mt={0.5}>
        Management and the concerned employee are always notified. Add anyone else you'd also like to notify.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography fontSize={20} fontWeight={700} color="#0f172a">Log Escalation</Typography>
      </Box>
      <Typography fontSize={13} color="text.secondary" sx={{ mb: 2.5, ml: 6 }}>
        Employees, external parties, or BO members / clients / vendors / referrers
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25, mb: 3 }}>
        {MODE_OPTIONS.map(o => (
          <Button key={o.value} onClick={() => changeMode(o.value)}
            sx={{
              border: `1px solid ${mode === o.value ? ACCENT : '#c7d2fe'}`, borderRadius: 2, py: 1.25, px: 1,
              fontWeight: 700, fontSize: 13, lineHeight: 1.3, textTransform: 'none',
              bgcolor: mode === o.value ? ACCENT : 'white', color: mode === o.value ? 'white' : ACCENT,
              '&:hover': { bgcolor: mode === o.value ? '#4338ca' : '#eef2ff' },
            }}>
            {o.label}
          </Button>
        ))}
      </Box>

      <Stack spacing={2}>
        {mode === 'Employee' && (
          <>
            {categoryField}
            {departmentField(true)}
            {employeeField('Escalation Logged For (Employee Name)')}
            {projectEventRow}
            {descriptionField}
            {autoTilesRow}
            {ccField}
          </>
        )}

        {mode === 'External' && (
          <>
            {categoryField}
            {departmentField(true)}
            {employeeField('Escalation Logged For (Employee Name)')}
            <TextField label="Reported By (Contact Name) *" size="small" value={reportedBy}
              onChange={e => setReportedBy(e.target.value)} fullWidth />
            <TextField label="Company (if applicable)" size="small" value={company}
              onChange={e => setCompany(e.target.value)} fullWidth />
            {descriptionField}
            {projectEventRow}
            {autoTilesRow}
            {ccField}
          </>
        )}

        {mode === 'BO' && (
          <>
            {categoryField}
            {projectEventRow}
            {departmentField(false)}
            {descriptionField}
            {autoTilesRow}
            {ccField}
          </>
        )}

        {!creator && (
          <Alert severity="warning" sx={{ fontSize: 12 }}>
            Your account isn't linked to an employee record — contact HR before logging an escalation.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
          <Button variant="contained" onClick={submit} disabled={busy || !canSubmit()}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 700, px: 3 }}>
            {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Submit escalation'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

function EditEscalationForm({ record, employees, onDone, onCancel, showToast }: {
  record: Escalation; employees: Employee[]; onDone: () => void; onCancel: () => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const departments = useMemo(() =>
    Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort(), [employees]);

  const [mode, setMode] = useState<EscalationMode>(record.escalationFor);
  const [department, setDepartment] = useState(record.department || '');
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(() =>
    employees.find(e => e.employee_id === record.targetEmployees[0]?.employeeId) || null);
  const [reportedBy, setReportedBy] = useState(record.reportedBy || '');
  const [company, setCompany] = useState(record.company || '');
  const [project, setProject] = useState(record.project || '');
  const [event, setEvent] = useState(record.event || '');
  const [category, setCategory] = useState(record.category);
  const [description, setDescription] = useState(record.description);
  const [ccList, setCcList] = useState<Employee[]>(() =>
    employees.filter(e => (record.cc || []).includes(e.official_email) || (record.cc || []).includes(e.email)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeesInDept = useMemo(() =>
    department ? employees.filter(e => e.department === department) : [], [employees, department]);

  const canSubmit = () => {
    const hasCore = !!category && !!department && description.trim().length > 0;
    if (mode === 'Employee') return hasCore && !!targetEmployee;
    if (mode === 'External') return hasCore && !!targetEmployee && reportedBy.trim().length > 0;
    return hasCore; // BO
  };

  const submit = async () => {
    setError(null);
    if (!canSubmit()) { setError('Fill in all required fields.'); return; }

    setBusy(true);
    try {
      const payload = {
        escalationFor: mode,
        targetEmployees: targetEmployee
          ? [{ employeeId: targetEmployee.employee_id, name: targetEmployee.full_name, department: targetEmployee.department, designation: targetEmployee.designation, email: targetEmployee.official_email || targetEmployee.email }]
          : [],
        department,
        reportedBy: mode === 'External' ? reportedBy.trim() : '',
        company: mode === 'External' ? company.trim() : '',
        project: project.trim(),
        event: event.trim(),
        category, description,
        dateOccurred: record.dateOccurred,
        cc: ccList.map(e => e.official_email || e.email).filter(Boolean),
      };
      const { data } = await axios.put(`${API}/${record._id}`, payload);
      if (data.success) { showToast(`Escalation ${record.caseNumber} updated`, 'success'); onDone(); }
      else setError(data.message || 'Failed to save.');
    } catch (e: any) { setError(e?.response?.data?.message || 'Failed to save.'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <IconButton onClick={onCancel} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Edit Escalation</Typography>
          <Typography fontSize={12} color="text.secondary">{record.caseNumber}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25, mb: 3 }}>
        {MODE_OPTIONS.map(o => (
          <Button key={o.value} onClick={() => setMode(o.value)}
            sx={{
              border: `1px solid ${mode === o.value ? ACCENT : '#c7d2fe'}`, borderRadius: 2, py: 1.25, px: 1,
              fontWeight: 700, fontSize: 13, lineHeight: 1.3, textTransform: 'none',
              bgcolor: mode === o.value ? ACCENT : 'white', color: mode === o.value ? 'white' : ACCENT,
              '&:hover': { bgcolor: mode === o.value ? '#4338ca' : '#eef2ff' },
            }}>
            {o.label}
          </Button>
        ))}
      </Box>

      <Stack spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel>Category</InputLabel>
          <Select value={category} label="Category" onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <MenuItem key={c.code} value={c.code}>{c.code} — {c.name}</MenuItem>)}
          </Select>
        </FormControl>

        {mode !== 'BO' && (
          <>
            <FormControl size="small" fullWidth>
              <InputLabel>Department</InputLabel>
              <Select value={department} label="Department"
                onChange={e => { setDepartment(e.target.value); setTargetEmployee(null); }}>
                {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
            <Autocomplete options={employeesInDept} getOptionLabel={e => e.full_name}
              isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
              disabled={!department} value={targetEmployee} onChange={(_, v) => setTargetEmployee(v)}
              renderInput={p => <TextField {...p} size="small" label="Escalation Logged For (Employee Name)" placeholder={department ? 'Select employee' : 'Select department first'} />} />
          </>
        )}

        {mode === 'External' && (
          <>
            <TextField label="Reported By (Contact Name) *" size="small" value={reportedBy}
              onChange={e => setReportedBy(e.target.value)} fullWidth />
            <TextField label="Company (if applicable)" size="small" value={company}
              onChange={e => setCompany(e.target.value)} fullWidth />
          </>
        )}

        {mode === 'BO' && (
          <FormControl size="small" fullWidth>
            <InputLabel>Department</InputLabel>
            <Select value={department} label="Department" onChange={e => setDepartment(e.target.value)}>
              {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField label="Project (if any)" size="small" value={project} onChange={e => setProject(e.target.value)} fullWidth />
          <TextField label="Event (if any)" size="small" value={event} onChange={e => setEvent(e.target.value)} fullWidth />
        </Box>

        <TextField label="Description *" multiline rows={4} size="small" value={description}
          onChange={e => setDescription(e.target.value)} fullWidth />

        <Box>
          <Autocomplete multiple options={employees} getOptionLabel={e => `${e.full_name} (${e.department})`}
            isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
            value={ccList} onChange={(_, v) => setCcList(v)}
            renderInput={p => <TextField {...p} size="small" label="Also notify (optional)" placeholder="Search by name or department…" />} />
          <Typography fontSize={11} color="text.secondary" mt={0.5}>
            Management and the concerned employee are always notified. Editing does not send a new email.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={onCancel} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={busy || !canSubmit()}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 600 }}>
            {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Save changes'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'create';

export default function Escalationspage() {
  const [records, setRecords] = useState<Escalation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selected, setSelected] = useState<Escalation | null>(null);
  const [editing, setEditing] = useState<Escalation | null>(null);

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

            <DashboardView records={records} employees={employees} loading={loading} onAdd={() => setView('create')} onSelect={setSelected} />

            <Modal open={view === 'create'} onClose={() => setView('dashboard')}>
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: { xs: '95vw', sm: 720 }, maxHeight: '90vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 3, outline: 'none', boxShadow: 24 }}>
                <CreateEscalationForm employees={employees}
                  onBack={() => setView('dashboard')}
                  onDone={() => loadData()}
                  showToast={showToast} />
              </Box>
            </Modal>

            <DetailModal record={selected} onClose={() => setSelected(null)}
              onEdit={r => { setSelected(null); setEditing(r); }} />

            <Modal open={!!editing} onClose={() => setEditing(null)}>
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: { xs: '95vw', sm: 720 }, maxHeight: '90vh', overflowY: 'auto', bgcolor: 'white', borderRadius: 3, outline: 'none', boxShadow: 24 }}>
                {editing && (
                  <EditEscalationForm record={editing} employees={employees}
                    onCancel={() => setEditing(null)}
                    onDone={() => { setEditing(null); loadData(); }}
                    showToast={showToast} />
                )}
              </Box>
            </Modal>
          </Box>
        </main>
      </div>
    </div>
  );
}
