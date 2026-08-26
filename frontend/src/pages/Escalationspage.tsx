import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Autocomplete,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Close as CloseIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type EscalationFor = 'BO Employee' | 'General';
type Rating = 'Good' | 'Bad' | 'Neutral';

interface TargetPerson {
  employeeId  : string;
  name        : string;
  department  : string;
  designation : string;
}

interface Escalation {
  _id            : string;
  caseNumber     : string;
  createdBy      : { employeeId: string; name: string; email: string; mobile: string; department: string; designation: string };
  escalationFor  : EscalationFor;
  targetEmployees: TargetPerson[];
  rating         : Rating | null;
  category       : string;
  mode           : string;
  subject        : string;
  message        : string;
  attachmentUrl  : string;
  attachmentName : string;
  createdAt      : string;
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
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API     = `${API_URL}/escalations`;
const EMP_API = `${API_URL}/onboarding/eligible-employees`;

const ACCENT = '#4f46e5';
const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: '1px solid #e2e8f0' };

const ESCALATION_FOR_OPTIONS: EscalationFor[] = ['BO Employee', 'General'];
const RATING_OPTIONS: Rating[] = ['Good', 'Bad', 'Neutral'];
const CATEGORY_OPTIONS = [
  'Reminder', 'POSH', 'Misbehaviour', 'Absent from Work', 'Refused Offer',
  'Refused to Join', 'Blacklisted', 'Good Work', 'Provided a Reference', 'Other',
];
const MODE_OPTIONS = ['Call', 'Video Call', 'Email', 'Face to Face', 'WhatsApp', 'Physical Letter', 'Other'];

const STEP_TITLES = ['Creator', 'This is for whom?', 'Classification', 'Details', 'Review & submit'];

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

const ratingColor = (r: Rating | null) => r === 'Good' ? '#059669' : r === 'Bad' ? '#dc2626' : '#64748b';

const targetSummary = (rec: Pick<Escalation, 'escalationFor' | 'targetEmployees'>) => {
  if (rec.escalationFor === 'General') return 'General';
  if (!rec.targetEmployees.length) return '—';
  return rec.targetEmployees.map(t => t.name).join(', ');
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

function DashboardView({ records, loading, onAdd, onSelect }: {
  records: Escalation[]; loading: boolean; onAdd: () => void; onSelect: (r: Escalation) => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [mode, setMode] = useState('All');
  const [escalationFor, setEscalationFor] = useState('All');

  const filtered = useMemo(() => records.filter(r => {
    const searchOk = !search
      || r.caseNumber?.toLowerCase().includes(search.toLowerCase())
      || r.createdBy.name.toLowerCase().includes(search.toLowerCase())
      || r.targetEmployees.some(t => t.name.toLowerCase().includes(search.toLowerCase()))
      || r.subject.toLowerCase().includes(search.toLowerCase());
    const categoryOk = category === 'All' || r.category === category;
    const modeOk = mode === 'All' || r.mode === mode;
    const forOk = escalationFor === 'All' || r.escalationFor === escalationFor;
    return searchOk && categoryOk && modeOk && forOk;
  }), [records, search, category, mode, escalationFor]);

  const kpis = useMemo(() => {
    const isThisMonth = (d?: string) => {
      if (!d) return false;
      const dt = new Date(d); const n = new Date();
      return dt.getFullYear() === n.getFullYear() && dt.getMonth() === n.getMonth();
    };
    return {
      thisMonth: records.filter(r => isThisMonth(r.createdAt)).length,
      boEmployee: records.filter(r => r.escalationFor === 'BO Employee').length,
      general: records.filter(r => r.escalationFor === 'General').length,
      bad: records.filter(r => r.rating === 'Bad').length,
    };
  }, [records]);

  return (
    <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Escalations</Typography>
          <Typography fontSize={12} color="text.secondary">Inter-department interaction log — BO to BO</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          Log Escalation
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { label: 'Logged this month', value: kpis.thisMonth },
          { label: 'BO Employee', value: kpis.boEmployee },
          { label: 'General', value: kpis.general },
          { label: 'Rated Bad', value: kpis.bad, crit: true },
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
        <TextField size="small" placeholder="Search case #, name, or subject…" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} InputProps={{ sx: { fontSize: 13 } }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 12 }}>For Whom</InputLabel>
          <Select value={escalationFor} label="For Whom" onChange={e => setEscalationFor(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {ESCALATION_FOR_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel sx={{ fontSize: 12 }}>Category</InputLabel>
          <Select value={category} label="Category" onChange={e => setCategory(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {CATEGORY_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 12 }}>Mode</InputLabel>
          <Select value={mode} label="Mode" onChange={e => setMode(e.target.value)} sx={{ fontSize: 12 }}>
            <MenuItem value="All" sx={{ fontSize: 12 }}>All</MenuItem>
            {MODE_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
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
                  <TableCell>Creator</TableCell>
                  <TableCell>For Whom</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Rating</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Subject</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: 13 }}>
                    No escalations logged yet
                  </TableCell></TableRow>
                )}
                {filtered.map(r => (
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
                    <TableCell sx={{ fontSize: 12 }}>{targetSummary(r)}</TableCell>
                    <TableCell><Chip size="small" label={r.category} sx={{ fontSize: 10, height: 20, bgcolor: '#eef2ff', color: ACCENT }} /></TableCell>
                    <TableCell>
                      {r.rating
                        ? <Chip size="small" label={r.rating} sx={{ fontSize: 10, height: 20, bgcolor: '#f8fafc', color: ratingColor(r.rating), border: `1px solid ${ratingColor(r.rating)}30` }} />
                        : <Typography fontSize={12} color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{r.mode}</TableCell>
                    <TableCell sx={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject || '—'}</TableCell>
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

function DetailModal({ record, onClose }: { record: Escalation | null; onClose: () => void }) {
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
              <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
            </Box>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Creator</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.createdBy.name}</Typography>
                  <Typography fontSize={11} color="text.secondary">{record.createdBy.department} · {record.createdBy.designation}</Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">This is for whom</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.escalationFor}</Typography>
                  <Typography fontSize={11} color="text.secondary">{targetSummary(record)}</Typography>
                </Box>
              </Box>
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Category</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.category}</Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Rating</Typography>
                  <Typography fontSize={13} fontWeight={600} color={record.rating ? ratingColor(record.rating) : 'inherit'}>{record.rating || '—'}</Typography>
                </Box>
              </Box>
              <Divider />
              <Box>
                <Typography fontSize={11} color="text.secondary">Mode</Typography>
                <Typography fontSize={13} fontWeight={600}>{record.mode}</Typography>
              </Box>
              {record.subject && (
                <Box>
                  <Typography fontSize={11} color="text.secondary">Subject</Typography>
                  <Typography fontSize={13} fontWeight={600}>{record.subject}</Typography>
                </Box>
              )}
              <Box>
                <Typography fontSize={11} color="text.secondary">Message</Typography>
                <Typography fontSize={13}>{record.message}</Typography>
              </Box>
              {record.attachmentUrl && (
                <Box>
                  <Typography fontSize={11} color="text.secondary">Attachment</Typography>
                  <a href={record.attachmentUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: ACCENT, fontWeight: 600 }}>
                    {record.attachmentName || 'View attachment'}
                  </a>
                </Box>
              )}
            </Stack>
          </>
        )}
      </Box>
    </Modal>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function EscalationWizard({ employees, onDone, onBack, showToast }: {
  employees: Employee[]; onDone: () => void; onBack: () => void; showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const [escalationFor, setEscalationFor] = useState<EscalationFor | ''>('');
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);

  const [rating, setRating] = useState<Rating | ''>('');
  const [category, setCategory] = useState('');

  const [mode, setMode] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  const goNext = () => {
    setStepError(null);
    if (step === 0 && !creator) {
      setStepError("Your account isn't linked to an employee record — contact HR before logging an escalation.");
      return;
    }
    if (step === 1) {
      if (!escalationFor) { setStepError('Select who this is for.'); return; }
      if (escalationFor === 'BO Employee' && !targetEmployee) { setStepError('Select the BO employee.'); return; }
    }
    if (step === 2) {
      if (!rating) { setStepError('Select a rating.'); return; }
      if (!category) { setStepError('Select a category.'); return; }
    }
    if (step === 3) {
      if (!mode) { setStepError('Select the interaction mode.'); return; }
      if (!message.trim()) { setStepError('Enter a message.'); return; }
    }
    setStep(s => Math.min(s + 1, STEP_TITLES.length - 1));
  };
  const goBack = () => { setStepError(null); setStep(s => Math.max(s - 1, 0)); };

  const targetEmployeesPayload: TargetPerson[] = escalationFor === 'BO Employee' && targetEmployee
    ? [{ employeeId: targetEmployee.employee_id, name: targetEmployee.full_name, department: targetEmployee.department, designation: targetEmployee.designation }]
    : [];

  const submit = async () => {
    if (!creator) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('createdBy', JSON.stringify({
        employeeId: creator.employee_id, name: creator.full_name,
        email: creator.official_email || creator.email, mobile: creator.mobile,
        department: creator.department, designation: creator.designation,
      }));
      fd.append('targetEmployees', JSON.stringify(targetEmployeesPayload));
      fd.append('escalationFor', escalationFor);
      fd.append('rating', rating);
      fd.append('category', category);
      fd.append('mode', mode);
      fd.append('subject', subject);
      fd.append('message', message);
      if (attachment) fd.append('attachment', attachment);

      const { data } = await axios.post(API, fd);
      if (data.success) { showToast('Escalation logged', 'success'); onDone(); }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed to submit', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ p: 2.5, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">Log Inter-Dept Interaction</Typography>
          <Typography fontSize={12} color="text.secondary">BO to BO only</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        {STEP_TITLES.map((t, i) => (
          <Box key={t} sx={{ flex: 1, textAlign: 'center', py: 1, borderRadius: 1.5,
            bgcolor: i === step ? ACCENT : i < step ? '#f0fdf4' : '#f8fafc',
            color: i === step ? 'white' : i < step ? '#059669' : '#94a3b8' }}>
            <Typography fontSize={11} fontWeight={600}>{i + 1}. {t}</Typography>
          </Box>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
        {step === 0 && (
          <Box>
            <Typography fontWeight={700} fontSize={13} mb={0.5}>Creator</Typography>
            <Typography fontSize={12} color="text.secondary" mb={2}>Pulled from your account — no action needed.</Typography>
            {creator ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  ['Name', creator.full_name], ['Employee ID', creator.employee_id],
                  ['Email', creator.official_email || creator.email || '—'], ['Mobile', creator.mobile || '—'],
                  ['Department', creator.department || '—'], ['Designation', creator.designation || '—'],
                ].map(([l, v]) => (
                  <Box key={l} sx={{ p: 1.25, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography fontSize={10} color="text.secondary">{l}</Typography>
                    <Typography fontSize={13} fontWeight={600}>{v}</Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="warning" sx={{ fontSize: 12 }}>
                Your account isn't linked to an employee record — contact HR before logging an escalation.
              </Alert>
            )}
          </Box>
        )}

        {step === 1 && (
          <Box>
            <Typography fontWeight={700} fontSize={13} mb={0.5}>This is for whom?</Typography>
            <Typography fontSize={12} color="text.secondary" mb={2}>Who this escalation concerns.</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              {ESCALATION_FOR_OPTIONS.map(o => (
                <Button key={o} variant={escalationFor === o ? 'contained' : 'outlined'}
                  onClick={() => { setEscalationFor(o); setTargetEmployee(null); }}
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 600,
                    bgcolor: escalationFor === o ? ACCENT : 'transparent', borderColor: ACCENT,
                    color: escalationFor === o ? 'white' : ACCENT, '&:hover': { bgcolor: escalationFor === o ? '#4338ca' : '#eef2ff' } }}>
                  {o}
                </Button>
              ))}
            </Box>
            {escalationFor === 'BO Employee' && (
              <Autocomplete options={employees} getOptionLabel={e => `${e.full_name} (${e.department})`}
                value={targetEmployee} onChange={(_, v) => setTargetEmployee(v)}
                renderInput={p => <TextField {...p} size="small" label="Select BO employee" placeholder="Search name or department…" />} />
            )}
          </Box>
        )}

        {step === 2 && (
          <Box>
            <Typography fontWeight={700} fontSize={13} mb={0.5}>Classification</Typography>
            <Typography fontSize={12} color="text.secondary" mb={2}>Rate the interaction and pick a category.</Typography>

            <Box sx={{ mb: 2.5 }}>
              <Typography fontSize={12} color="text.secondary" mb={1}>Good, bad, or neutral</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {RATING_OPTIONS.map(o => (
                  <Chip key={o} label={o} onClick={() => setRating(o)}
                    sx={{ fontWeight: 600, bgcolor: rating === o ? ratingColor(o) : '#f8fafc',
                      color: rating === o ? 'white' : ratingColor(o), border: `1px solid ${ratingColor(o)}30` }} />
                ))}
              </Box>
            </Box>

            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={category} label="Category" onChange={e => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        )}

        {step === 3 && (
          <Box>
            <Typography fontWeight={700} fontSize={13} mb={0.5}>Details</Typography>
            <Typography fontSize={12} color="text.secondary" mb={2}>How the interaction happened, and what was said.</Typography>
            <Stack spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Mode</InputLabel>
                <Select value={mode} label="Mode" onChange={e => setMode(e.target.value)}>
                  {MODE_OPTIONS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Subject" size="small" value={subject} onChange={e => setSubject(e.target.value)} fullWidth />
              <TextField label="Message *" multiline rows={4} size="small" value={message}
                onChange={e => setMessage(e.target.value)} fullWidth />
              <Box>
                <Button component="label" variant="outlined" size="small" startIcon={<AttachFileIcon />}
                  sx={{ textTransform: 'none' }}>
                  {attachment ? attachment.name : 'Attach a file (optional)'}
                  <input type="file" hidden onChange={e => setAttachment(e.target.files?.[0] || null)} />
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {step === 4 && (
          <Box>
            <Typography fontWeight={700} fontSize={13} mb={0.5}>Review & submit</Typography>
            <Typography fontSize={12} color="text.secondary" mb={2}>Confirm the details below, then submit.</Typography>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              {[
                ['Creator', creator?.full_name || '—'],
                ['For whom', escalationFor],
                ['Target(s)', targetEmployeesPayload.map(t => t.name).join(', ') || '—'],
                ['Rating', rating || '—'],
                ['Category', category],
                ['Mode', mode],
                ['Subject', subject || '—'],
              ].map(([l, v], i) => (
                <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.25, fontSize: 13,
                  borderBottom: i < 6 ? '1px solid #f1f5f9' : 'none' }}>
                  <Typography fontSize={13} color="text.secondary">{l}</Typography>
                  <Typography fontSize={13} fontWeight={600}>{v}</Typography>
                </Box>
              ))}
            </Box>
            <Typography fontSize={12} color="text.secondary" mt={1.5}>{message}</Typography>
          </Box>
        )}

        {stepError && <Alert severity="error" sx={{ mt: 2, fontSize: 12 }}>{stepError}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, pt: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={goBack} disabled={step === 0} sx={{ textTransform: 'none', visibility: step === 0 ? 'hidden' : 'visible' }}>
            Back
          </Button>
          {step < STEP_TITLES.length - 1 ? (
            <Button variant="contained" onClick={goNext}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 600 }}>
              Continue
            </Button>
          ) : (
            <Button variant="contained" onClick={submit} disabled={busy}
              sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, textTransform: 'none', fontWeight: 600 }}>
              {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Submit'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'wizard';

export default function Escalationspage() {
  const [records, setRecords] = useState<Escalation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selected, setSelected] = useState<Escalation | null>(null);

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
              <DashboardView records={records} loading={loading} onAdd={() => setView('wizard')} onSelect={setSelected} />
            )}

            {view === 'wizard' && (
              <EscalationWizard employees={employees}
                onBack={() => setView('dashboard')}
                onDone={() => { setView('dashboard'); loadData(); }}
                showToast={showToast} />
            )}

            <DetailModal record={selected} onClose={() => setSelected(null)} />
          </Box>
        </main>
      </div>
    </div>
  );
}
