import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Avatar, Chip, Collapse, IconButton,
  Stack, Button, Tooltip, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Snackbar, Alert,
} from '@mui/material';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  Policy as PolicyIcon,
  AccountBalance as TaxIcon,
  BeachAccess as HolidayIcon,
  HealthAndSafety as InsuranceIcon,
  Slideshow as SlideshowIcon,
  Quiz as QuizIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Edit as EditIcon,
  CalendarToday as CalendarIcon,
  Event as EventIcon,
  MedicalServices as MedicalIcon,
  CreditCard as ECardIcon,
  AssignmentReturn as ClaimIcon,
  ContactPhone as ContactIcon,
  Domain as DomainIcon,
  Save as SaveIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const currentUserRole: 'hr' | 'management' | 'employee' = 'hr';
const isHR = currentUserRole === 'hr';
const isHRorMgmt = currentUserRole === 'hr' || currentUserRole === 'management';
const getToken = () => localStorage.getItem('token') || '';

interface FileItem { id: string; name: string; url: string; }
interface Holiday  { id: string; name: string; date: string; type: 'national' | 'optional'; }
interface WeekOff  { id: string; label: string; days: string; }
interface Insurance {
  policyUrl: string; policyName: string;
  claimFormUrl: string; claimFormName: string;
  eCardSteps: string[]; claimSteps: string[];
  representative: { name: string; phone: string; email: string };
}
interface OrientationData {
  onboardingPPT:  { name: string; url: string };
  onboardingTest: { name: string; url: string };
  policies:  FileItem[];
  taxForms:  FileItem[];
  holidays:  Holiday[];
  weekoffs:  WeekOff[];
  insurance: Insurance;
}

const api = {
  get:  (path: string) => fetch(`${API_BASE}/orientation${path}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
  put:  (path: string, body: object) => fetch(`${API_BASE}/orientation${path}`, { method: 'PUT',    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) }).then(r => r.json()),
  post: (path: string, body: object) => fetch(`${API_BASE}/orientation${path}`, { method: 'POST',   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) }).then(r => r.json()),
  del:  (path: string) =>              fetch(`${API_BASE}/orientation${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
};

// ── Card configs ──────────────────────────────────────────────────────────────
const CARD_CONFIGS = [
  { gradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '#BFDBFE', accent: '#3B82F6', headerBg: '#3B82F6' },
  { gradient: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', border: '#DDD6FE', accent: '#8B5CF6', headerBg: '#8B5CF6' },
  { gradient: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', border: '#BBF7D0', accent: '#10B981', headerBg: '#10B981' },
  { gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '#FDE68A', accent: '#F59E0B', headerBg: '#F59E0B' },
  { gradient: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)', border: '#FECDD3', accent: '#EC4899', headerBg: '#EC4899' },
  { gradient: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)', border: '#BAE6FD', accent: '#0EA5E9', headerBg: '#0EA5E9' },
];

// ── Shared components ─────────────────────────────────────────────────────────
function FileRow({ file, accentColor, onDelete }: { file: FileItem; accentColor: string; onDelete?: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)', mb: 0.8, '&:hover': { bgcolor: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, transition: 'all 0.15s' }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PdfIcon sx={{ color: '#EF4444', fontSize: 18 }} />
      </Box>
      <Typography fontSize="0.875rem" fontWeight={500} flex={1} color="#1F2937" noWrap>{file.name}</Typography>
      {file.url && file.url !== '#' && (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Open"><IconButton size="small" href={file.url} target="_blank" rel="noreferrer" sx={{ color: accentColor, bgcolor: `${accentColor}15`, borderRadius: '7px', width: 30, height: 30, '&:hover': { bgcolor: `${accentColor}25` } }}><OpenInNewIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
          <Tooltip title="Download"><IconButton size="small" href={file.url} download sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 30, height: 30, '&:hover': { bgcolor: '#E5E7EB' } }}><DownloadIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
        </Stack>
      )}
      {isHR && onDelete && <Tooltip title="Remove"><IconButton size="small" onClick={onDelete} sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: '7px', width: 28, height: 28, '&:hover': { bgcolor: '#FEE2E2' } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>}
    </Box>
  );
}

function Locked() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 2, borderRadius: '10px', bgcolor: 'rgba(148,163,184,0.08)', border: '1px dashed #CBD5E1' }}>
      <LockIcon sx={{ fontSize: 16, color: '#94A3B8' }} />
      <Typography fontSize="0.82rem" color="#94A3B8">Access restricted to HR only.</Typography>
    </Box>
  );
}

function LinkEditor({ currentUrl, currentName, accentColor, onSave, label = 'Google Drive / PDF link' }: {
  currentUrl: string; currentName: string; accentColor: string;
  onSave: (name: string, url: string) => Promise<void>; label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl]   = useState(currentUrl);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setUrl(currentUrl); setName(currentName); }, [currentUrl, currentName]);

  const handleSave = async () => {
    if (!url.trim()) return;
    setSaving(true);
    await onSave(name, url);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) return (
    <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 14 }} />} onClick={() => setEditing(true)}
      sx={{ textTransform: 'none', color: accentColor, fontSize: '0.8rem', px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}30`, '&:hover': { bgcolor: `${accentColor}20` }, mt: 0.5 }}>
      {currentUrl ? 'Edit link' : 'Add Google Drive link'}
    </Button>
  );

  return (
    <Stack spacing={1} mt={1} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)' }}>
      <TextField size="small" placeholder="Display name" value={name} onChange={e => setName(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white' } }} />
      <TextField size="small" placeholder={label} value={url} onChange={e => setUrl(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white' } }} />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
          onClick={handleSave} disabled={saving || !url.trim()}
          sx={{ bgcolor: accentColor, borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem', px: 2 }}>
          Save
        </Button>
        <Button size="small" onClick={() => setEditing(false)} sx={{ textTransform: 'none', fontSize: '0.8rem', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
      </Stack>
    </Stack>
  );
}

function AddLinkRow({ color, label, onAdd }: { color: string; label: string; onAdd: (name: string, url: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    await onAdd(name, url);
    setSaving(false);
    setName(''); setUrl(''); setOpen(false);
  };

  if (!open) return (
    <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setOpen(true)}
      sx={{ mt: 1, textTransform: 'none', color, fontSize: '0.8rem', px: 1.5, py: 0.6, borderRadius: '8px', bgcolor: `${color}10`, border: `1px dashed ${color}40`, '&:hover': { bgcolor: `${color}18` } }}>
      {label}
    </Button>
  );

  return (
    <Stack spacing={1} mt={1} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)' }}>
      <TextField size="small" placeholder="Name (e.g. Leave Policy)" value={name} onChange={e => setName(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white' } }} />
      <TextField size="small" placeholder="Google Drive / PDF URL" value={url} onChange={e => setUrl(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white' } }} />
      <Stack direction="row" spacing={0.8} alignItems="center">
        <Button size="small" variant="contained" onClick={handleAdd} disabled={saving || !name.trim() || !url.trim()}
          sx={{ bgcolor: color, borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem', px: 2 }}>
          {saving ? <CircularProgress size={12} color="inherit" /> : 'Add'}
        </Button>
        <IconButton size="small" onClick={() => { setOpen(false); setName(''); setUrl(''); }} sx={{ color: '#9CA3AF' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </Stack>
    </Stack>
  );
}

// ── Section content components ────────────────────────────────────────────────
function OnboardingPPT({ data, onUpdate }: { data: OrientationData['onboardingPPT']; onUpdate: (d: Partial<OrientationData>) => void }) {
  const save = async (name: string, url: string) => { const res = await api.put('/ppt', { name, url }); if (res.success) onUpdate({ onboardingPPT: res.data }); };
  return (
    <Stack spacing={1}>
      {data.url ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlideshowIcon sx={{ color: '#3B82F6', fontSize: 22 }} />
          </Box>
          <Box flex={1}>
            <Typography fontSize="0.875rem" fontWeight={600} color="#1F2937">{data.name}</Typography>
            <Typography fontSize="0.75rem" color="#6B7280">Onboarding Presentation</Typography>
          </Box>
          <Tooltip title="Download"><IconButton size="small" href={data.url} download sx={{ color: '#3B82F6', bgcolor: '#EFF6FF', borderRadius: '8px', width: 32, height: 32 }}><DownloadIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Open"><IconButton size="small" href={data.url} target="_blank" sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '8px', width: 32, height: 32 }}><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </Box>
      ) : <Typography fontSize="0.85rem" color="#9CA3AF" sx={{ py: 1 }}>No link added yet.</Typography>}
      {isHR ? <LinkEditor currentUrl={data.url} currentName={data.name} accentColor="#3B82F6" onSave={save} label="Google Drive PPT link" /> : !data.url && <Locked />}
    </Stack>
  );
}

function OnboardingTest({ data, onUpdate }: { data: OrientationData['onboardingTest']; onUpdate: (d: Partial<OrientationData>) => void }) {
  const save = async (name: string, url: string) => { const res = await api.put('/test', { name, url }); if (res.success) onUpdate({ onboardingTest: res.data }); };
  return (
    <Stack spacing={1}>
      {data.url ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: '10px', border: '1px solid #DDD6FE' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QuizIcon sx={{ color: '#8B5CF6', fontSize: 22 }} />
          </Box>
          <Box flex={1}>
            <Typography fontSize="0.875rem" fontWeight={600} color="#1F2937">{data.name}</Typography>
            <Typography fontSize="0.75rem" color="#6B7280">Assessment Document</Typography>
          </Box>
          <Tooltip title="Download"><IconButton size="small" href={data.url} download sx={{ color: '#8B5CF6', bgcolor: '#F5F3FF', borderRadius: '8px', width: 32, height: 32 }}><DownloadIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Open"><IconButton size="small" href={data.url} target="_blank" sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '8px', width: 32, height: 32 }}><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </Box>
      ) : <Typography fontSize="0.85rem" color="#9CA3AF" sx={{ py: 1 }}>No link added yet.</Typography>}
      {isHR ? <LinkEditor currentUrl={data.url} currentName={data.name} accentColor="#8B5CF6" onSave={save} label="Google Drive / PDF test link" /> : !data.url && <Locked />}
    </Stack>
  );
}

function PoliciesContent({ data, onUpdate }: { data: FileItem[]; onUpdate: (d: Partial<OrientationData>) => void }) {
  const add    = async (name: string, url: string) => { const res = await api.post('/policies', { name, url }); if (res.success) onUpdate({ policies: [...data, res.data] }); };
  const remove = async (id: string) => { const res = await api.del(`/policies/${id}`); if (res.success) onUpdate({ policies: data.filter(p => p.id !== id) }); };
  return (
    <Stack>
      {data.length === 0 && <Typography fontSize="0.85rem" color="#9CA3AF" sx={{ py: 1 }}>No policies added yet.</Typography>}
      {data.map(p => <FileRow key={p.id} file={p} accentColor="#10B981" onDelete={isHR ? () => remove(p.id) : undefined} />)}
      {isHR && <AddLinkRow color="#10B981" label="Add Policy Link" onAdd={add} />}
    </Stack>
  );
}

function TaxFormsContent({ data, onUpdate }: { data: FileItem[]; onUpdate: (d: Partial<OrientationData>) => void }) {
  const add    = async (name: string, url: string) => { const res = await api.post('/tax-forms', { name, url }); if (res.success) onUpdate({ taxForms: [...data, res.data] }); };
  const remove = async (id: string) => { const res = await api.del(`/tax-forms/${id}`); if (res.success) onUpdate({ taxForms: data.filter(f => f.id !== id) }); };
  return (
    <Stack>
      {data.length === 0 && <Typography fontSize="0.85rem" color="#9CA3AF" sx={{ py: 1 }}>No forms added yet.</Typography>}
      {data.map(f => <FileRow key={f.id} file={f} accentColor="#F59E0B" onDelete={isHR ? () => remove(f.id) : undefined} />)}
      {isHR && <AddLinkRow color="#F59E0B" label="Add Form Link" onAdd={add} />}
    </Stack>
  );
}

function HolidayContent({ data, weekoffs, onUpdate }: { data: Holiday[]; weekoffs: WeekOff[]; onUpdate: (d: Partial<OrientationData>) => void }) {
  const [tab, setTab]     = useState<'holiday' | 'weekoff'>('holiday');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm]   = useState({ name: '', date: '', type: 'national' as const });
  const [saving, setSaving] = useState(false);

  const exportCSV = () => {
    const blob = new Blob([`Name,Date,Type\n${data.map(h => `${h.name},${h.date},${h.type}`).join('\n')}`], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'holidays.csv'; a.click();
  };
  const addHoliday = async () => {
    if (!form.name || !form.date) return;
    setSaving(true);
    const res = await api.post('/holidays', form);
    if (res.success) onUpdate({ holidays: [...data, res.data] });
    setSaving(false); setForm({ name: '', date: '', type: 'national' }); setDlgOpen(false);
  };
  const removeHoliday = async (id: string) => { const res = await api.del(`/holidays/${id}`); if (res.success) onUpdate({ holidays: data.filter(h => h.id !== id) }); };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1}>
        {(['holiday', 'weekoff'] as const).map(t => (
          <Button key={t} size="small" onClick={() => setTab(t)}
            variant={tab === t ? 'contained' : 'outlined'}
            sx={{ textTransform: 'none', fontSize: '0.8rem', borderRadius: '8px', px: 2,
              ...(tab === t ? { bgcolor: '#EC4899', borderColor: '#EC4899', '&:hover': { bgcolor: '#DB2777' } } : { borderColor: '#FECDD3', color: '#EC4899' }) }}>
            {t === 'holiday' ? '🗓 Holidays' : '📅 Week Off'}
          </Button>
        ))}
      </Stack>

      {tab === 'holiday' && <>
        <Box sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
          {data.length === 0 && <Typography fontSize="0.85rem" color="#9CA3AF">No holidays added yet.</Typography>}
          {data.map(h => (
            <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, px: 1.2, borderRadius: '8px', mb: 0.5, bgcolor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' } }}>
              <CalendarIcon sx={{ fontSize: 14, color: '#EC4899', flexShrink: 0 }} />
              <Typography fontSize="0.82rem" fontWeight={500} flex={1} color="#374151">{h.name}</Typography>
              <Typography fontSize="0.75rem" color="#9CA3AF" sx={{ flexShrink: 0, mr: 0.5 }}>{h.date}</Typography>
              <Chip label={h.type} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: h.type === 'national' ? '#FCE7F3' : '#F0FDF4', color: h.type === 'national' ? '#BE185D' : '#15803D', fontWeight: 600 }} />
              {isHR && <Tooltip title="Remove"><IconButton size="small" onClick={() => removeHoliday(h.id)} sx={{ color: '#EF4444', p: 0.3, ml: 0.3 }}><DeleteIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>}
            </Box>
          ))}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} onClick={exportCSV}
            sx={{ textTransform: 'none', fontSize: '0.8rem', color: '#EC4899', bgcolor: '#FFF1F2', borderRadius: '8px', px: 1.5, '&:hover': { bgcolor: '#FFE4E6' } }}>Export CSV</Button>
          {isHRorMgmt && <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setDlgOpen(true)}
            sx={{ textTransform: 'none', fontSize: '0.8rem', color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '8px', px: 1.5, '&:hover': { bgcolor: '#E5E7EB' } }}>Add Holiday</Button>}
        </Stack>
        <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>Add Holiday</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={0.5}>
              <TextField label="Holiday Name" size="small" fullWidth value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              <TextField label="Date (e.g. 15 Aug 2025)" size="small" fullWidth value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setDlgOpen(false)} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
            <Button variant="contained" onClick={addHoliday} disabled={saving} sx={{ bgcolor: '#EC4899', borderRadius: '8px', textTransform: 'none', px: 3, '&:hover': { bgcolor: '#DB2777' } }}>
              {saving ? <CircularProgress size={14} color="inherit" /> : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </>}

      {tab === 'weekoff' && (
        <Stack spacing={0.8}>
          {weekoffs.length === 0 && <Typography fontSize="0.85rem" color="#9CA3AF">No week off rules yet.</Typography>}
          {weekoffs.map(w => (
            <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <EventIcon sx={{ fontSize: 18, color: '#EC4899' }} />
              <Box flex={1}>
                <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937">{w.label}</Typography>
                <Typography fontSize="0.75rem" color="#6B7280">{w.days}</Typography>
              </Box>
              {isHRorMgmt && <IconButton size="small" sx={{ color: '#D1D5DB', bgcolor: '#F9FAFB', borderRadius: '7px' }}><EditIcon sx={{ fontSize: 14 }} /></IconButton>}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function InsuranceContent({ data, onUpdate }: { data: Insurance; onUpdate: (d: Partial<OrientationData>) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const toggle = (k: string) => setActive(p => p === k ? null : k);
  const savePolicy    = async (name: string, url: string) => { const r = await api.put('/insurance/policy', { name, url }); if (r.success) onUpdate({ insurance: r.data }); };
  const saveClaimForm = async (name: string, url: string) => { const r = await api.put('/insurance/claim-form', { name, url }); if (r.success) onUpdate({ insurance: r.data }); };
  const saveContact   = async (contact: { name: string; phone: string; email: string }) => { const r = await api.put('/insurance/contact', contact); if (r.success) onUpdate({ insurance: { ...data, representative: r.data } }); };
  const [contact, setContact] = useState(data.representative);
  const [editContact, setEditContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  useEffect(() => { setContact(data.representative); }, [data.representative]);

  const items = [
    { key: 'policy', label: 'Insurance Policy PDF', icon: <MedicalIcon sx={{ fontSize: 16 }} />, color: '#0EA5E9',
      content: (
        <Stack spacing={0.8}>
          {data.policyUrl ? <FileRow file={{ id: 'policy', name: data.policyName, url: data.policyUrl }} accentColor="#0EA5E9" /> : <Typography fontSize="0.82rem" color="#9CA3AF">No link yet.</Typography>}
          {isHR && <LinkEditor currentUrl={data.policyUrl} currentName={data.policyName} accentColor="#0EA5E9" onSave={savePolicy} label="Google Drive / PDF link" />}
        </Stack>
      ),
    },
    { key: 'ecard', label: 'How to Download E-Card', icon: <ECardIcon sx={{ fontSize: 16 }} />, color: '#8B5CF6',
      content: (
        <Stack spacing={0.5} sx={{ bgcolor: 'rgba(255,255,255,0.7)', borderRadius: '10px', p: 1.5, border: '1px solid rgba(139,92,246,0.15)' }}>
          {data.eCardSteps.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#8B5CF6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, mt: 0.1 }}>{i + 1}</Box>
              <Typography fontSize="0.8rem" color="#374151">{s}</Typography>
            </Box>
          ))}
        </Stack>
      ),
    },
    { key: 'claim', label: 'Claim Process', icon: <ClaimIcon sx={{ fontSize: 16 }} />, color: '#10B981',
      content: (
        <Stack spacing={1}>
          <Stack spacing={0.5} sx={{ bgcolor: 'rgba(255,255,255,0.7)', borderRadius: '10px', p: 1.5, border: '1px solid rgba(16,185,129,0.15)' }}>
            {data.claimSteps.map((s, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, mt: 0.1 }}>{i + 1}</Box>
                <Typography fontSize="0.8rem" color="#374151">{s}</Typography>
              </Box>
            ))}
          </Stack>
          {data.claimFormUrl ? <FileRow file={{ id: 'claim', name: data.claimFormName, url: data.claimFormUrl }} accentColor="#10B981" /> : <Typography fontSize="0.82rem" color="#9CA3AF">No claim form link yet.</Typography>}
          {isHR && <LinkEditor currentUrl={data.claimFormUrl} currentName={data.claimFormName} accentColor="#10B981" onSave={saveClaimForm} label="Claim form link" />}
        </Stack>
      ),
    },
    { key: 'contact', label: 'Representative Contact', icon: <ContactIcon sx={{ fontSize: 16 }} />, color: '#F59E0B',
      content: (
        <Stack spacing={0.8}>
          {!editContact ? (
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Typography fontSize="0.875rem" fontWeight={700} color="#1F2937">{data.representative.name || '—'}</Typography>
              <Typography fontSize="0.8rem" color="#6B7280" mt={0.3}>📞 {data.representative.phone || '—'}</Typography>
              <Typography fontSize="0.8rem" color="#6B7280">✉️ {data.representative.email || '—'}</Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 13 }} />}
                  sx={{ textTransform: 'none', color: '#F59E0B', bgcolor: '#FFFBEB', borderRadius: '7px', fontSize: '0.78rem', px: 1.2, '&:hover': { bgcolor: '#FEF3C7' } }}
                  onClick={() => { const b = new Blob([`Name: ${data.representative.name}\nPhone: ${data.representative.phone}\nEmail: ${data.representative.email}`], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'contact.txt'; a.click(); }}>
                  Download
                </Button>
                {isHR && <Button size="small" startIcon={<EditIcon sx={{ fontSize: 13 }} />} onClick={() => setEditContact(true)} sx={{ textTransform: 'none', color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', fontSize: '0.78rem', px: 1.2 }}>Edit</Button>}
              </Stack>
            </Box>
          ) : (
            <Stack spacing={0.8}>
              {(['name', 'phone', 'email'] as const).map(f => (
                <TextField key={f} size="small" placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={contact[f]} onChange={e => setContact(p => ({ ...p, [f]: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white' } }} />
              ))}
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" disabled={savingContact} onClick={async () => { setSavingContact(true); await saveContact(contact); setSavingContact(false); setEditContact(false); }} sx={{ bgcolor: '#F59E0B', borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem', px: 2, '&:hover': { bgcolor: '#D97706' } }}>
                  {savingContact ? <CircularProgress size={12} color="inherit" /> : 'Save'}
                </Button>
                <Button size="small" onClick={() => setEditContact(false)} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={0.5}>
      {items.map(item => (
        <Box key={item.key} sx={{ borderRadius: '10px', border: `1px solid ${active === item.key ? item.color + '40' : 'rgba(0,0,0,0.06)'}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
          <Box onClick={() => toggle(item.key)} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 1, px: 1.5, cursor: 'pointer', bgcolor: active === item.key ? `${item.color}0A` : 'rgba(255,255,255,0.5)', '&:hover': { bgcolor: `${item.color}08` } }}>
            <Box sx={{ color: item.color }}>{item.icon}</Box>
            <Typography fontSize="0.85rem" fontWeight={600} flex={1} color="#1F2937">{item.label}</Typography>
            {active === item.key ? <ExpandLessIcon sx={{ fontSize: 16, color: '#9CA3AF' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />}
          </Box>
          <Collapse in={active === item.key} timeout="auto">
            <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>{item.content}</Box>
          </Collapse>
        </Box>
      ))}
    </Stack>
  );
}

// ── Enterprise card wrapper ───────────────────────────────────────────────────
function SectionCard({ label, icon, index, children }: { label: string; icon: React.ReactNode; index: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const cfg = CARD_CONFIGS[index % CARD_CONFIGS.length];

  return (
    <Box sx={{
      borderRadius: '16px',
      border: `1px solid ${open ? cfg.border : '#E5E7EB'}`,
      background: open ? cfg.gradient : '#FFFFFF',
      boxShadow: open ? '0 4px 24px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'all 0.25s ease',
      overflow: 'hidden',
      '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.10)', borderColor: cfg.border },
    }}>
      {/* Card header */}
      <Box onClick={() => setOpen(o => !o)} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2, cursor: 'pointer' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: `${cfg.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cfg.accent }}>
          {icon}
        </Box>
        <Box flex={1}>
          <Typography fontSize="0.95rem" fontWeight={700} color="#111827">{label}</Typography>
          <Typography fontSize="0.75rem" color="#9CA3AF" mt={0.2}>
            {open ? 'Click to collapse' : 'Click to expand'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: open ? cfg.accent : '#D1D5DB', transition: 'background 0.2s' }} />
          <Box sx={{ color: '#9CA3AF' }}>
            {open ? <ExpandLessIcon sx={{ fontSize: 20 }} /> : <ExpandMoreIcon sx={{ fontSize: 20 }} />}
          </Box>
        </Box>
      </Box>

      {/* Divider when open */}
      {open && <Box sx={{ height: '1px', bgcolor: cfg.border, mx: 2.5 }} />}

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// ── Empty default data ────────────────────────────────────────────────────────
const EMPTY: OrientationData = {
  onboardingPPT:  { name: 'Company_Onboarding_2025.pptx', url: '' },
  onboardingTest: { name: 'Onboarding_Test_Q&A.pdf', url: '' },
  policies: [], taxForms: [], holidays: [], weekoffs: [],
  insurance: {
    policyUrl: '', policyName: 'Group_Health_Policy_2025.pdf',
    claimFormUrl: '', claimFormName: 'Claim_Form.pdf',
    eCardSteps: ['Visit health.insurer.com', 'Login with Employee ID & DOB', 'Go to "My E-Card"', 'Click Download PDF'],
    claimSteps: ['Inform HR within 24 hrs', 'Fill Claim Form (attach bills)', 'Submit to HR for verification', 'HR forwards to TPA'],
    representative: { name: '', phone: '', email: '' },
  },
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CompanyOrientationPage() {
  const [data, setData]     = useState<OrientationData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]   = useState<{ open: boolean; msg: string; type: 'success' | 'error' }>({ open: false, msg: '', type: 'success' });

  const onUpdate = useCallback((partial: Partial<OrientationData>) => {
    setData(prev => ({ ...prev, ...partial }));
    setToast({ open: true, msg: 'Saved successfully', type: 'success' });
  }, []);

  useEffect(() => {
    api.get('/').then(res => { if (res.success && res.data) setData({ ...EMPTY, ...res.data }); })
      .catch(() => setToast({ open: true, msg: 'Could not load data', type: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const sections = [
    { label: 'Company Onboarding PPT',    icon: <SlideshowIcon sx={{ fontSize: 22 }} />, content: <OnboardingPPT data={data.onboardingPPT} onUpdate={onUpdate} /> },
    { label: 'Onboarding Test',           icon: <QuizIcon sx={{ fontSize: 22 }} />,      content: <OnboardingTest data={data.onboardingTest} onUpdate={onUpdate} /> },
    { label: 'Company Policies',          icon: <PolicyIcon sx={{ fontSize: 22 }} />,    content: <PoliciesContent data={data.policies} onUpdate={onUpdate} /> },
    { label: 'Tax & Statutory Forms',     icon: <TaxIcon sx={{ fontSize: 22 }} />,       content: <TaxFormsContent data={data.taxForms} onUpdate={onUpdate} /> },
    { label: 'Holiday & Week Off',        icon: <HolidayIcon sx={{ fontSize: 22 }} />,   content: <HolidayContent data={data.holidays} weekoffs={data.weekoffs} onUpdate={onUpdate} /> },
    { label: 'Medical & Health Insurance',icon: <InsuranceIcon sx={{ fontSize: 22 }} />, content: <InsuranceContent data={data.insurance} onUpdate={onUpdate} /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main style={{ padding: '24px', paddingTop: '88px' }}>

          {/* Hero header */}
          <Box sx={{ mb: 4, p: 3.5, borderRadius: '20px', background: 'linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Box sx={{ position: 'absolute', bottom: -40, right: 80, width: 100, height: 100, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DomainIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box flex={1}>
                <Typography fontWeight={800} fontSize="1.5rem" lineHeight={1.2}>Company Orientation</Typography>
                <Typography fontSize="0.85rem" sx={{ opacity: 0.75, mt: 0.3 }}>All resources, policies and guides in one place</Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {loading && <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.7)' }} />}
                <Chip label={`Role: ${currentUserRole.toUpperCase()}`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.3)' }} />
                {isHR && <Chip label="Edit Mode" size="small" icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#86EFAC !important' }} />}
                  sx={{ bgcolor: 'rgba(134,239,172,0.15)', color: '#86EFAC', fontWeight: 600, fontSize: '0.75rem', border: '1px solid rgba(134,239,172,0.3)' }} />}
              </Stack>
            </Box>
          </Box>

          {/* Stats row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
            {[
              { label: 'Policies', value: data.policies.length, color: '#10B981' },
              { label: 'Tax Forms', value: data.taxForms.length, color: '#F59E0B' },
              { label: 'Holidays', value: data.holidays.length, color: '#EC4899' },
              { label: 'Documents', value: (data.onboardingPPT.url ? 1 : 0) + (data.onboardingTest.url ? 1 : 0), color: '#3B82F6' },
            ].map(s => (
              <Box key={s.label} sx={{ p: 2, borderRadius: '14px', bgcolor: 'white', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <Typography fontSize="1.6rem" fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography fontSize="0.78rem" color="#6B7280" fontWeight={500}>{s.label}</Typography>
              </Box>
            ))}
          </Box>

          {/* Cards grid */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' }, gap: 2, alignItems: 'start' }}>
              {sections.map((s, i) => (
                <SectionCard key={s.label} label={s.label} icon={s.icon} index={i}>{s.content}</SectionCard>
              ))}
            </Box>
          )}
        </main>
      </div>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.type} onClose={() => setToast(t => ({ ...t, open: false }))} sx={{ borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>{toast.msg}</Alert>
      </Snackbar>
    </div>
  );
}