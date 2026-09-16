import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal,
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

type CurrentStatus   = 'probation' | 'confirmed' | 'extended' | 'not_confirmed';
// 'not_due' — every joiner starts here: on probation, but the review
// itself hasn't opened for manager/management action yet. The backend
// auto-advances this to 'pending_manager' once tenure hits 5 months —
// see advanceStageIfDue() in routes/confirmations.js. Matches the actual
// Mongoose schema enum exactly (this previously had 'hr_pending'/'closed'
// values that didn't exist in the backend enum at all).
// 'pending_hr' (added 2026-09-16) — Management decided confirmed/
// not_confirmed/probation, but HR still has to upload the confirmation/
// extension letter before this reaches 'completed'. An 'extended'
// decision skips this and goes straight to 'on_hold' as before.
type Stage           = 'not_due' | 'pending_manager' | 'pending_management' | 'pending_hr' | 'completed' | 'on_hold';
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

// HR final action (added 2026-09-16) — set once, the moment stage moves
// 'pending_hr' -> 'completed'.
interface HrAction {
  document    : { fileName: string; driveLink: string } | null;
  submittedAt : string | null;
}

interface Confirmation {
  _id               : string;
  employeeId        : string;
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
  hrAction          : HrAction | null;
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

// Sourced from Onboarding's employee master (/api/onboarding/eligible-employees)
// — the single source of truth for who's a current employee, replacing the
// old separate /api/employees + /api/roles lookup.
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
}

// ─── Config ────────────────────────────────────────────────────────────────────

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const API      = API_BASE + '/confirmations';
const ONBOARDING_EMPLOYEE_MASTER_API = API_BASE + '/onboarding/eligible-employees';

const STATUS_CFG: Record<CurrentStatus, { label: string; color: string; bg: string }> = {
  probation     : { label: 'On Probation'      , color: '#D97706', bg: '#FEF3C7' },
  confirmed     : { label: 'Confirmed'        , color: '#059669', bg: '#ECFDF5' },
  extended      : { label: 'Extended'         , color: '#2563EB', bg: '#EFF6FF' },
  not_confirmed : { label: 'Not Confirmed'    , color: '#DC2626', bg: '#FEF2F2' },
};

const STAGE_CFG: Record<Stage, { label: string }> = {
  not_due             : { label: 'Not Yet Due'       },
  pending_manager     : { label: 'Pending Manager'    },
  pending_management  : { label: 'Pending Management' },
  pending_hr          : { label: 'Pending HR'          },
  completed           : { label: 'Completed'          },
  on_hold             : { label: 'On Hold'            },
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
  const onHold = stage === 'on_hold';
  const notDue = stage === 'not_due';
  return (
    <Chip
      size="small"
      label={STAGE_CFG[stage]?.label || stage}
      sx={{
        bgcolor   : done ? '#ECFDF5' : onHold ? '#FEF3C7' : notDue ? '#F3F4F6' : '#EFF6FF',
        color     : done ? '#059669' : onHold ? '#D97706' : notDue ? '#6B7280' : '#2563EB',
        fontWeight: 600, fontSize: 11,
        border    : `1px solid ${done ? '#6EE7B7' : onHold ? '#FCD34D' : notDue ? '#D1D5DB' : '#BFDBFE'}`,
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

// ─── Confirmation Mail Queue ────────────────────────────────────────────────
// Every Confirmation mail (Manager/Management Request + Reminder, HR
// Notify, quarterly digest) lands as an editable draft instead of
// sending itself — mirrors Salary Revision's mail-queue architecture
// exactly (see SalaryRevisionNew.tsx's RevisionMailButtons for the same
// pattern). No global queue screen — each mail shows up inline on the
// exact card it belongs to, via ConfirmationMailButtons below.

const CONFIRMATION_MAIL_TYPE_LABEL: Record<string, string> = {
  managerRequest: 'Manager Request',
  managerReminder: 'Manager Reminder',
  managementRequest: 'Management Request',
  managementReminder: 'Management Reminder',
  hrNotify: 'HR Notify',
  quarterlyDigest: 'Quarterly Due Digest',
};

interface ConfirmationMailDraft {
  _id: string;
  confirmationId: string | null;
  mailType: string;
  employeeName: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  status: 'draft' | 'sent' | 'discarded';
  createdAt: string;
  sentAt: string | null;
  sentBy: string;
}

const CONFIRMATION_DRAFTS_API = `${API_BASE}/confirmation-mail-drafts`;

// Inline "Send Mail" control for one confirmation record's relevant mail
// types — used on the Manager Decision and Management Decision boxes,
// each passed only the mail type(s) that belong to that step. A draft
// shows a "Send Mail" button; once actually sent it flips to a plain
// "Sent" badge — no re-send path exists from here. Renders nothing for a
// non-Admin/HR viewer.
function ConfirmationMailButtons({ confirmationId, mailTypes }: { confirmationId?: string; mailTypes: string[] }) {
  const role = localStorage.getItem('role') || '';
  const canSeeMail = role === 'Admin' || role === 'HR';
  const mailTypesKey = mailTypes.join(',');

  const [drafts, setDrafts] = useState<ConfirmationMailDraft[]>([]);
  const [editing, setEditing] = useState<ConfirmationMailDraft | null>(null);
  const [editTo, setEditTo] = useState('');
  const [editCc, setEditCc] = useState('');
  const [editBcc, setEditBcc] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canSeeMail || !confirmationId) return;
    try {
      const { data } = await axios.get(`${CONFIRMATION_DRAFTS_API}?status=all&confirmationId=${confirmationId}`);
      const all: ConfirmationMailDraft[] = data.data || [];
      const wanted = mailTypesKey.split(',');
      setDrafts(all.filter(d => wanted.includes(d.mailType)).sort((a, b) => wanted.indexOf(a.mailType) - wanted.indexOf(b.mailType)));
    } catch { /* secondary panel — a failed load here shouldn't block the record UI */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmationId, canSeeMail, mailTypesKey]);

  useEffect(() => { load(); }, [load]);

  if (!canSeeMail || !confirmationId || !drafts.length) return null;

  const openEdit = (d: ConfirmationMailDraft) => {
    setEditing(d);
    setEditTo(d.to); setEditCc(d.cc || ''); setEditBcc(d.bcc || '');
    setEditSubject(d.subject); setEditHtml(d.html);
    setError('');
  };

  const sendMail = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const html = bodyEditorRef.current?.innerHTML ?? editHtml;
      const saveRes = await axios.put(`${CONFIRMATION_DRAFTS_API}/${editing._id}`, {
        to: editTo, cc: editCc, bcc: editBcc, subject: editSubject, html,
      });
      if (!saveRes.data.success) throw new Error(saveRes.data.message || 'Save failed');

      const sendRes = await axios.post(`${CONFIRMATION_DRAFTS_API}/${editing._id}/send`);
      if (!sendRes.data.success) throw new Error(sendRes.data.message || 'Send failed');

      setEditing(null);
      load();
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Send failed'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0' }}>
      <Stack spacing={0.75}>
        {drafts.map(d => (
          <Box key={d._id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography fontSize={11} color="text.secondary">{CONFIRMATION_MAIL_TYPE_LABEL[d.mailType] || d.mailType}</Typography>
            {d.status === 'draft' ? (
              <Button size="small" variant="outlined" onClick={() => openEdit(d)}
                sx={{ textTransform: 'none', fontSize: 11, py: 0.2, px: 1, minWidth: 0, borderColor: '#2563EB', color: '#2563EB' }}>
                Send Mail
              </Button>
            ) : d.status === 'sent' ? (
              <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
                label={`Sent${d.sentBy ? ` · ${d.sentBy}` : ''}`}
                sx={{ fontSize: 10, height: 20, bgcolor: '#ECFDF5', color: '#059669', '& .MuiChip-icon': { color: 'inherit' } }} />
            ) : (
              <Chip size="small" label="Discarded" sx={{ fontSize: 10, height: 20, bgcolor: '#F9FAFB', color: '#9CA3AF' }} />
            )}
          </Box>
        ))}
      </Stack>

      <Modal open={!!editing} onClose={() => { if (!busy) setEditing(null); }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: { xs: '95vw', md: 640 }, maxHeight: '85vh', overflow: 'auto',
          bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', outline: 'none', p: 2.5 }}>
          <Typography fontSize={14} fontWeight={700} mb={2}>
            {editing ? (CONFIRMATION_MAIL_TYPE_LABEL[editing.mailType] || editing.mailType) : ''}
          </Typography>
          {editing && (
            <Stack spacing={2}>
              {error && <Alert severity="error" sx={{ fontSize: 12 }} onClose={() => setError('')}>{error}</Alert>}
              <TextField label="To" size="small" fullWidth value={editTo} onChange={e => setEditTo(e.target.value)} disabled={busy} />
              <TextField label="Cc" size="small" fullWidth value={editCc} onChange={e => setEditCc(e.target.value)} disabled={busy} />
              <TextField label="Bcc" size="small" fullWidth value={editBcc} onChange={e => setEditBcc(e.target.value)} disabled={busy} />
              <TextField label="Subject" size="small" fullWidth value={editSubject} onChange={e => setEditSubject(e.target.value)} disabled={busy} />
              <Box>
                <Typography fontSize={12} color="text.secondary" mb={0.5}>Body</Typography>
                <Box
                  key={editing._id}
                  ref={bodyEditorRef}
                  contentEditable={!busy}
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: editHtml }}
                  sx={{
                    border: '1px solid #cbd5e1', borderRadius: 1, p: 1.5, minHeight: 200, maxHeight: 380,
                    overflow: 'auto', fontSize: 13, lineHeight: 1.6, bgcolor: busy ? '#f8fafc' : '#fff',
                    '&:focus': { outline: '2px solid #2563EB', outlineOffset: -1 },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button variant="contained" onClick={sendMail} disabled={busy}
                  sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, textTransform: 'none', fontWeight: 600 }}>
                  {busy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Send Mail'}
                </Button>
                <Button variant="outlined" onClick={() => setEditing(null)} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
              </Box>
            </Stack>
          )}
        </Box>
      </Modal>
    </Box>
  );
}

// Company-wide Confirmation mail (currently just the quarterly digest,
// confirmationId: null) has nowhere to show up on a per-record card —
// mirrors Salary Revision's CompanyMailButton exactly, including showing
// the next scheduled fire date even before a draft exists.
const CONFIRMATION_COMPANY_MAIL_SCHEDULE: { mailType: string; label: string; computeNext: (from: Date) => Date }[] = [
  {
    mailType: 'quarterlyDigest',
    label: 'Quarterly Due Digest',
    computeNext: (from) => {
      const fireMonths = [3, 6, 9, 0]; // Apr, Jul, Oct, Jan (0-indexed)
      const candidates: Date[] = [];
      for (const yr of [from.getFullYear(), from.getFullYear() + 1]) {
        for (const m of fireMonths) candidates.push(new Date(yr, m, 1, 9, 15, 0));
      }
      candidates.sort((a, b) => a.getTime() - b.getTime());
      return candidates.find(d => d > from)!;
    },
  },
];

function ConfirmationCompanyMailButton() {
  const role = localStorage.getItem('role') || '';
  const canSeeMail = role === 'Admin' || role === 'HR';

  const [drafts, setDrafts] = useState<ConfirmationMailDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConfirmationMailDraft | null>(null);
  const [editTo, setEditTo] = useState('');
  const [editCc, setEditCc] = useState('');
  const [editBcc, setEditBcc] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canSeeMail) return;
    try {
      const { data } = await axios.get(`${CONFIRMATION_DRAFTS_API}?unassigned=true&status=draft`);
      setDrafts(data.data || []);
    } catch { /* quiet — falls back to schedule-only rows */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeMail]);

  useEffect(() => { load(); }, [load]);

  if (!canSeeMail) return null;

  const openEdit = (d: ConfirmationMailDraft) => {
    setEditing(d);
    setEditTo(d.to); setEditCc(d.cc || ''); setEditBcc(d.bcc || '');
    setEditSubject(d.subject); setEditHtml(d.html);
    setError('');
  };

  const sendMail = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const html = bodyEditorRef.current?.innerHTML ?? editHtml;
      const saveRes = await axios.put(`${CONFIRMATION_DRAFTS_API}/${editing._id}`, {
        to: editTo, cc: editCc, bcc: editBcc, subject: editSubject, html,
      });
      if (!saveRes.data.success) throw new Error(saveRes.data.message || 'Save failed');
      const sendRes = await axios.post(`${CONFIRMATION_DRAFTS_API}/${editing._id}/send`);
      if (!sendRes.data.success) throw new Error(sendRes.data.message || 'Send failed');
      setEditing(null);
      load();
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Send failed'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpen(true)}
        sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12, borderRadius: 1.5 }}>
        Company Mail{drafts.length > 0 ? ` (${drafts.length})` : ''}
      </Button>

      <Modal open={open} onClose={() => { if (!busy) { setOpen(false); setEditing(null); } }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: { xs: '95vw', md: 640 }, maxHeight: '85vh', overflow: 'auto',
          bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', outline: 'none', p: 2.5 }}>
          {!editing ? (
            <>
              <Typography fontSize={14} fontWeight={700} mb={2}>Company-Wide Mail</Typography>
              <Stack spacing={1}>
                {CONFIRMATION_COMPANY_MAIL_SCHEDULE.map(sched => {
                  const draft = drafts.find(d => d.mailType === sched.mailType);
                  return (
                    <Box key={sched.mailType} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                      p: 1.25, border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                      <Box>
                        <Typography fontSize={12} fontWeight={600}>{CONFIRMATION_MAIL_TYPE_LABEL[sched.mailType] || sched.label}</Typography>
                        <Typography fontSize={11} color="text.secondary">
                          {draft ? draft.subject : `Not queued yet — next fires ${fmtDate(sched.computeNext(new Date()).toISOString())}`}
                        </Typography>
                      </Box>
                      {draft ? (
                        <Button size="small" variant="outlined" onClick={() => openEdit(draft)}
                          sx={{ textTransform: 'none', fontSize: 11, py: 0.2, px: 1, minWidth: 0, borderColor: '#2563EB', color: '#2563EB' }}>
                          Send Mail
                        </Button>
                      ) : (
                        <Chip size="small" label="Scheduled" sx={{ fontSize: 10, height: 20, bgcolor: '#F9FAFB', color: '#9CA3AF' }} />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </>
          ) : (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton size="small" onClick={() => setEditing(null)} disabled={busy}><ArrowBackIcon fontSize="small" /></IconButton>
                <Typography fontSize={14} fontWeight={700}>{CONFIRMATION_MAIL_TYPE_LABEL[editing.mailType] || editing.mailType}</Typography>
              </Box>
              {error && <Alert severity="error" sx={{ fontSize: 12 }} onClose={() => setError('')}>{error}</Alert>}
              <TextField label="To" size="small" fullWidth value={editTo} onChange={e => setEditTo(e.target.value)} disabled={busy} />
              <TextField label="Cc" size="small" fullWidth value={editCc} onChange={e => setEditCc(e.target.value)} disabled={busy} />
              <TextField label="Bcc" size="small" fullWidth value={editBcc} onChange={e => setEditBcc(e.target.value)} disabled={busy} />
              <TextField label="Subject" size="small" fullWidth value={editSubject} onChange={e => setEditSubject(e.target.value)} disabled={busy} />
              <Box>
                <Typography fontSize={12} color="text.secondary" mb={0.5}>Body</Typography>
                <Box
                  key={editing._id}
                  ref={bodyEditorRef}
                  contentEditable={!busy}
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: editHtml }}
                  sx={{
                    border: '1px solid #cbd5e1', borderRadius: 1, p: 1.5, minHeight: 200, maxHeight: 380,
                    overflow: 'auto', fontSize: 13, lineHeight: 1.6, bgcolor: busy ? '#f8fafc' : '#fff',
                    '&:focus': { outline: '2px solid #2563EB', outlineOffset: -1 },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button variant="contained" onClick={sendMail} disabled={busy}
                  sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, textTransform: 'none', fontWeight: 600 }}>
                  {busy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Send Mail'}
                </Button>
                <Button variant="outlined" onClick={() => setEditing(null)} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
              </Box>
            </Stack>
          )}
        </Box>
      </Modal>
    </>
  );
}

// ─── Probation Confirmation Dialog ────────────────────────────────────────────
// Fallback path only now — under the automatic flow every eligible
// employee already has a confirmation record by the time this page loads
// (created via /sync in 'not_due' the moment they appear in Onboarding).
// This dialog only matters for the rare case of acting on someone before
// the next sync has run.

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
  loading, 
  onSelect 
}: {
  records  : Confirmation[];
  employees: Employee[];
  loading  : boolean;
  onSelect : (emp: Employee) => void;
}) {
  const [search, setSearch] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('current'); // 'current' | 'all'

  // Onboarding is the only employee source now, so there's nothing to
  // merge/deduplicate here anymore — every employee already comes from
  // one place.
  const allEmployees = employees;

  /** Apply filters - only show current quarter (0-6 months) or all */
  const filtered = React.useMemo(() => {
    const result = allEmployees.filter(emp => {
      if (!emp.joining_date) return false;

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

    return result;
  }, [allEmployees, quarterFilter, search, records]);

  const counts = React.useMemo(() => {
    // Every stat card must reflect the SAME filtered set as "Total
    // Employees" (respecting the Time Filter) — otherwise subtracting a
    // global count from a filtered count produces nonsense like a negative
    // "Pending Review".
    const filteredRecords = filtered
      .map(emp => records.find(r => r.employeeId === emp._id || r.employeeCode === emp.employee_id))
      .filter((r): r is Confirmation => !!r);

    const confirmed    = filteredRecords.filter(r => r.currentStatus === 'confirmed').length;
    const extended     = filteredRecords.filter(r => r.currentStatus === 'extended').length;
    const notConfirmed = filteredRecords.filter(r => r.currentStatus === 'not_confirmed').length;

    return {
      total: filtered.length,
      confirmed,
      extended,
      notConfirmed,
      pending: filtered.length - confirmed - notConfirmed,
    };
  }, [filtered, records]);

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
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1F2937">Probation Confirmations</Typography>
          <Typography fontSize={13} color="text.secondary" mt={0.5}>
            {quarterFilter === 'current'
              ? 'Employees who joined in the last 6 months'
              : 'All employees'}
          </Typography>
        </Box>
        <ConfirmationCompanyMailButton />
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
                    const confirmationRecord = records.find(r => r.employeeId === emp._id || r.employeeCode === emp.employee_id);
                    const isConfirmed = confirmationRecord?.currentStatus === 'confirmed';
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
                        {/* Employee name */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 30, height: 30, bgcolor: '#E0E7FF', color: '#4338CA', fontSize: 11, fontWeight: 700 }}>
                              {initials(emp.full_name)}
                            </Avatar>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                                {emp.full_name}
                              </Typography>
                              {isConfirmed && (
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
                          </Box>
                        </TableCell>

                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>{emp.department}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>{emp.designation}</TableCell>

                        {/* Reporting manager — comes straight from this
                            person's own Onboarding record, not a
                            designation-based lookup */}
                        <TableCell sx={{ fontSize: 12, color: '#4B5563' }}>
                          {emp.reporting_manager || '—'}
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

function DetailView({ record, onBack, onChangeStatus, onRecordChange, showToast }: {
  record        : Confirmation;
  onBack        : () => void;
  onChangeStatus: () => void;
  onRecordChange: (updated: Confirmation) => void;
  showToast     : (msg: string, type: 'success' | 'error') => void;
}) {
  const [hrFile, setHrFile] = useState<File | null>(null);
  const [hrUploading, setHrUploading] = useState(false);

  const uploadHrDocument = async () => {
    if (!hrFile) return;
    setHrUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', hrFile);
      const { data } = await axios.put(`${API}/${record._id}/hr`, formData);
      if (!data.success) throw new Error(data.message || 'Upload failed');
      showToast('Document uploaded — confirmation completed', 'success');
      onRecordChange(data.data);
      setHrFile(null);
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || 'Upload failed', 'error');
    } finally {
      setHrUploading(false);
    }
  };

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
        {record.stage !== 'completed' && record.stage !== 'on_hold' && record.stage !== 'not_due' && record.stage !== 'pending_hr' && (
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
                <Typography fontSize={13} color="text.disabled">
                  {record.stage === 'not_due' ? 'Review not open yet' : 'Pending'}
                </Typography>
              )}
              <ConfirmationMailButtons confirmationId={record._id} mailTypes={['managerRequest', 'managerReminder']} />
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
                  {record.stage === 'not_due' ? 'Review not open yet'
                    : record.stage === 'pending_manager' ? 'Waiting for manager' : 'Pending'}
                </Typography>
              )}
              <ConfirmationMailButtons confirmationId={record._id} mailTypes={['managementRequest', 'managementReminder']} />
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

        {(record.stage === 'pending_hr' || (record.stage === 'completed' && record.hrAction?.document)) && (
          <Paper variant="outlined" sx={{ flex: '1 1 260px', borderRadius: 2, p: 3 }}>
            <Typography fontWeight={700} mb={2}>HR Final Action</Typography>
            <Stack spacing={2}>
              <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
                <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Management Decision</Typography>
                {record.managementDecision?.status && <StatusChip status={record.managementDecision.status} />}
              </Box>

              {record.stage === 'pending_hr' ? (
                <Box>
                  <Typography fontSize={12} fontWeight={600} mb={1}>Upload Confirmation/Extension Letter</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Button size="small" variant="outlined" component="label" sx={{ textTransform: 'none' }}>
                      Choose File
                      <input type="file" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={e => setHrFile(e.target.files?.[0] || null)} />
                    </Button>
                    {hrFile && <Typography fontSize={12} color="text.secondary">{hrFile.name}</Typography>}
                    <Button size="small" variant="contained" disabled={!hrFile || hrUploading} onClick={uploadHrDocument}
                      sx={{ bgcolor: '#2563EB', textTransform: 'none', fontWeight: 600 }}>
                      {hrUploading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Upload & Complete'}
                    </Button>
                  </Stack>
                  <ConfirmationMailButtons confirmationId={record._id} mailTypes={['hrNotify']} />
                </Box>
              ) : record.hrAction?.document && (
                <Box>
                  <Typography fontSize={12} fontWeight={600} mb={0.5}>Uploaded Document</Typography>
                  <Typography component="a" href={record.hrAction.document.driveLink} target="_blank" rel="noopener"
                    sx={{ fontSize: 12, color: '#2563EB', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                    📄 {record.hrAction.document.fileName}
                  </Typography>
                  {record.hrAction.submittedAt && (
                    <Typography fontSize={11} color="text.secondary" mt={0.5}>
                      Uploaded {fmtDate(record.hrAction.submittedAt)}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          </Paper>
        )}

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
  const isNotDue         = record.stage === 'not_due';
  const endpoint         = isManagerTurn ? 'manager' : 'management';
  const roleLabel        = isManagerTurn ? 'Manager' : 'Management';

  const [status,         setStatus]         = useState<CurrentStatus>('probation');
  const [reason,         setReason]         = useState('');
  const [monthsExtended, setMonthsExtended] = useState(3);
  const [submitting,     setSubmitting]     = useState(false);

  if (isNotDue) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" mb={2}>
          This employee's confirmation review isn't due yet — it opens automatically once they hit 5 months' tenure.
        </Typography>
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

  // Always fetches fresh from the server — no local caching of any kind.
  // Onboarding is the only employee source, and /api/confirmations is the
  // only source for confirmation records, so what's on screen always
  // reflects the actual current database state after every change.
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [empRes, confRes] = await Promise.all([
        axios.get(ONBOARDING_EMPLOYEE_MASTER_API),
        axios.get(API),
      ]);

      const empData  = empRes.data;
      const confData = confRes.data;

      const apiEmployees: any[] = Array.isArray(empData) ? empData : (empData?.data || []);
      const apiRecords: Confirmation[] = Array.isArray(confData) ? confData : (confData?.data || []);

      // Map Onboarding's eligible-employees shape onto what this page needs.
      // reporting_manager comes straight from that person's own
      // reportingHead field in Onboarding — not a designation-based lookup.
      const mappedEmployees: Employee[] = apiEmployees.map((e) => ({
        _id               : e._id || e.employee_id,
        employee_id       : e.employee_id,
        full_name         : e.full_name,
        department        : e.department,
        designation       : e.designation,
        email             : e.official_email || e.email || '',
        joining_date      : e.joining_date || null,
        employee_category : e.employee_category || '',
        level             : 1, // Onboarding doesn't track a numeric level today
        reporting_manager : e.reporting_head || '',
      }));

      setEmployees(mappedEmployees);
      setRecords(apiRecords);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEmployeeSelect = (employee: Employee) => {
    // Under the automatic flow every eligible employee should already
    // have a confirmation record by the time this runs (auto-created via
    // /sync, in 'not_due', the moment they appear in Onboarding) — so this
    // will almost always find one. The HR dialog fallback below only
    // matters for the edge case of clicking someone before the next sync
    // has run.
    const existingRecord = records.find(r => r.employeeId === employee._id || r.employeeCode === employee.employee_id);
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
    
    if (isOnProbation) {
      // Employee is on probation - create confirmation record in the same
      // 'not_due' starting stage the automatic sync uses, so this fallback
      // path behaves identically to the normal one.
      const newRecord = {
        employeeId: employee._id,
        employeeCode: employee.employee_id,
        employeeName: employee.full_name,
        department: employee.department,
        designation: employee.designation,
        email: employee.email,
        joiningDate: employee.joining_date || new Date().toISOString(),
        level: employee.level,
        reportingManager: employee.reporting_manager,
        currentStatus: 'probation' as CurrentStatus,
        stage: 'not_due' as Stage,
        history: [{
          stage: 'not_due' as Stage,
          status: 'probation' as CurrentStatus,
          reason: reason,
          monthsExtended: null,
          newReviewDate: null,
          changedBy: 'hr',
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

      try {
        const { data } = await axios.post(API, newRecord);
        if (!data.success) throw new Error(data.message || 'Failed to create confirmation record');
        setRecords(prev => [...prev, data.data]);
        setSelected(data.data);
        setView('detail');
        showToast('Employee marked as on probation', 'success');
      } catch (err: any) {
        // No local fallback — if the server didn't save it, the app
        // shouldn't pretend it did. Always trust the database, never a
        // client-side cache that can silently drift out of sync.
        showToast(err?.response?.data?.message || 'Failed to save probation decision — please try again', 'error');
      }

    } else {
      // Employee is not on probation - close the entry immediately as
      // 'completed'/'not_confirmed' — 'closed' isn't a valid stage in the
      // schema, so this uses the same terminal stage a real not_confirmed
      // decision from Management would land on.
      const newRecord = {
        employeeId: employee._id,
        employeeCode: employee.employee_id,
        employeeName: employee.full_name,
        department: employee.department,
        designation: employee.designation,
        email: employee.email,
        joiningDate: employee.joining_date || new Date().toISOString(),
        level: employee.level,
        reportingManager: employee.reporting_manager,
        currentStatus: 'not_confirmed' as CurrentStatus,
        stage: 'completed' as Stage,
        history: [{
          stage: 'completed' as Stage,
          status: 'not_confirmed' as CurrentStatus,
          reason: reason,
          monthsExtended: null,
          newReviewDate: null,
          changedBy: 'hr',
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

      try {
        const { data } = await axios.post(API, newRecord);
        if (!data.success) throw new Error(data.message || 'Failed to create confirmation record');
        setRecords(prev => [...prev, data.data]);
        showToast('Employee marked as not on probation - entry closed', 'success');
      } catch (err: any) {
        showToast(err?.response?.data?.message || 'Failed to save decision — please try again', 'error');
      }
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
                loading={loading}
                onSelect={handleEmployeeSelect}
              />
            )}

            {view === 'detail' && selected && (
              <DetailView record={selected} onBack={handleBack} onChangeStatus={() => setView('status-change')}
                onRecordChange={handleStatusUpdate} showToast={showToast} />
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