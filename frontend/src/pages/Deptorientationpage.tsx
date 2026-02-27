import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Chip,
} from '@mui/material';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  Slideshow as SlideshowIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  PictureAsPdf as PdfIcon,
  ExpandMore as ExpandMoreIcon,
  Notes as NotesIcon,
  Person as PersonIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Article as ArticleIcon,
  VerifiedUser as JDIcon,
  Apartment as ApartmentIcon,
  Work as WorkIcon,
  Quiz as QuizIcon,
  Assignment as AssignmentIcon,
  Person,
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const currentUserRole: 'hr' | 'management' | 'employee' = 'hr';
const isHR = currentUserRole === 'hr';
const getToken = () => localStorage.getItem('token') || '';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Designation {
  _id: string;
  department: string;
  designation: string;
  role_document_link: string;
  jd_link: string;
  remarks: string;
  role_document: string;
}

interface QuarterPPT {
  id: string;
  fy: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  name: string;
  url: string;
}

interface DeptNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface LinkItem {
  id: string;
  name: string;
  url: string;
}

interface DeptData {
  id: string;
  name: string;
  onboardingPPT: LinkItem | null;
  reviewPPTs: QuarterPPT[];
  masterPPT: LinkItem | null;
  notes: DeptNote[];
  recruitmentTest: LinkItem | null;
  onboardingTest: LinkItem | null;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// ── API Helpers ───────────────────────────────────────────────────────────────
const api = {
  get: async function <T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return (await response.json()) as ApiResponse<T>;
  },

  put: async function <T>(path: string, body: object): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ApiResponse<T>;
  },

  post: async function <T>(path: string, body: object): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ApiResponse<T>;
  },

  del: async function <T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ApiResponse<T>;
  },
} as const;

// ── FY Helpers ────────────────────────────────────────────────────────────────
function getCurrentFY() {
  const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return `FY${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

function getFYList() {
  const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return Array.from({ length: 4 }, (_, i) => `FY${String(y - i).slice(2)}-${String(y - i + 1).slice(2)}`);
}

const QUARTERS: Array<'Q1' | 'Q2' | 'Q3' | 'Q4'> = ['Q1', 'Q2', 'Q3', 'Q4'];

// ── Dept Colors ───────────────────────────────────────────────────────────────
const COLOR_POOL = [
  '#3B82F6','#10B981','#EC4899','#F59E0B','#8B5CF6','#0EA5E9',
  '#EF4444','#F97316','#14B8A6','#6366F1','#84CC16','#06B6D4',
];
const _colorCache: Record<string, string> = {};
function getDeptColor(name: string): string {
  if (!_colorCache[name]) _colorCache[name] = COLOR_POOL[Object.keys(_colorCache).length % COLOR_POOL.length];
  return _colorCache[name];
}

// ── Shared Components ─────────────────────────────────────────────────────────
function DeptSelect({ depts, value, onChange }: { depts: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <FormControl size="small" sx={{ minWidth: 210 }}>
      <InputLabel sx={{ fontSize: '0.82rem' }}>Select Department</InputLabel>
      <Select value={value} label="Select Department" onChange={e => onChange(e.target.value as string)}
        sx={{ borderRadius: '10px', fontSize: '0.85rem', bgcolor: 'white', fontWeight: 600 }} IconComponent={ArrowDownIcon}>
        {depts.map(d => (
          <MenuItem key={d} value={d} sx={{ fontSize: '0.85rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getDeptColor(d), flexShrink: 0 }} />
              {d}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center', color: '#9CA3AF', bgcolor: '#F9FAFB', borderRadius: '12px', border: '1px dashed #E5E7EB' }}>
      <Box sx={{ mb: 0.5, opacity: 0.35 }}>{icon}</Box>
      <Typography fontSize="0.83rem">{text}</Typography>
    </Box>
  );
}

function LinkEditor({ currentUrl, currentName, accentColor, onSave, placeholder = 'Google Drive URL' }: {
  currentUrl: string; currentName: string; accentColor: string;
  onSave: (name: string, url: string) => Promise<void>; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(currentUrl);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setUrl(currentUrl); setName(currentName); }, [currentUrl, currentName]);

  const save = async () => {
    if (!url.trim()) return;
    setSaving(true);
    await onSave(name, url);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) return (
    <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 13 }} />} onClick={() => setEditing(true)}
      sx={{ textTransform: 'none', color: accentColor, fontSize: '0.78rem', bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}25`, borderRadius: '8px', px: 1.5, py: 0.5 }}>
      {currentUrl ? 'Edit link' : 'Add link'}
    </Button>
  );

  return (
    <Stack spacing={0.8} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.95)', borderRadius: '10px', border: '1px solid #E5E7EB', mt: 0.8 }}>
      <TextField size="small" placeholder="Display name" value={name} onChange={e => setName(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' } }} />
      <TextField size="small" placeholder={placeholder} value={url} onChange={e => setUrl(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' } }} />
      <Stack direction="row" spacing={0.8}>
        <Button size="small" variant="contained" onClick={save} disabled={saving || !url.trim()}
          startIcon={saving ? <CircularProgress size={11} color="inherit" /> : <SaveIcon sx={{ fontSize: 13 }} />}
          sx={{ bgcolor: accentColor, borderRadius: '7px', textTransform: 'none', fontSize: '0.78rem', px: 2, '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}>Save</Button>
        <Button size="small" onClick={() => setEditing(false)} sx={{ textTransform: 'none', fontSize: '0.78rem', color: '#9CA3AF' }}>Cancel</Button>
      </Stack>
    </Stack>
  );
}

function LinkDisplay({ link, accentColor }: { link: LinkItem | null; accentColor: string }) {
  if (!link?.url) return <Typography fontSize="0.82rem" color="#9CA3AF" sx={{ py: 0.5, fontStyle: 'italic' }}>No link added yet.</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'white', borderRadius: '10px', border: `1px solid ${accentColor}20`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: `${accentColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PdfIcon sx={{ color: accentColor, fontSize: 17 }} />
      </Box>
      <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937" flex={1} noWrap>{link.name}</Typography>
      <Tooltip title="Open"><IconButton size="small" href={link.url} target="_blank" sx={{ color: accentColor, bgcolor: `${accentColor}12`, borderRadius: '7px', width: 30, height: 30 }}><OpenInNewIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
      <Tooltip title="Download"><IconButton size="small" href={link.url} download sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 30, height: 30 }}><DownloadIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
    </Box>
  );
}

// ── DeptPresentations Component ──────────────────────────────────────────────
function DeptPresentations({
  depts,
  deptDataMap,
  onUpdate,
}: {
  depts: string[];
  deptDataMap: Record<string, DeptData>;
  onUpdate: (name: string, d: Partial<DeptData>) => void;
}) {
  const [dept, setDept] = useState(depts[0] || '');
  const [tab, setTab] = useState(0);
  const [fy, setFY] = useState(getCurrentFY());
  const [q, setQ] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'all'>('all');
  const [addDlg, setAddDlg] = useState(false);
  const [saving, setSaving] = useState(false);

  // Correct place for newP state — inside the component
  type NewPPT = {
    fy: string;
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    name: string;
    url: string;
  };

  const [newP, setNewP] = useState<NewPPT>({
    fy: getCurrentFY(),
    quarter: 'Q1',
    name: '',
    url: '',
  });

  const dd = deptDataMap[dept];
  const c = getDeptColor(dept);

  const saveOnboarding = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/onboarding-ppt`, { name, url });
    if (r.success) onUpdate(dept, { onboardingPPT: { id: 'ppt', name, url } });
  };

  const saveMaster = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/master-ppt`, { name, url });
    if (r.success) onUpdate(dept, { masterPPT: { id: 'master', name, url } });
  };

  const addReview = async () => {
    if (!newP.name || !newP.url) return;
    setSaving(true);

    const r = await api.post<QuarterPPT>(`/dept-orientation/${dd?.id}/review-ppts`, newP);

    if (r.success && r.data) {
      onUpdate(dept, {
        reviewPPTs: [...(dd?.reviewPPTs || []), r.data],
      });
    }

    setSaving(false);
    setAddDlg(false);
    setNewP({ fy: getCurrentFY(), quarter: 'Q1', name: '', url: '' });
  };

  const delReview = async (id: string) => {
    await api.del(`/dept-orientation/${dd?.id}/review-ppts/${id}`);
    onUpdate(dept, { reviewPPTs: dd?.reviewPPTs?.filter(p => p.id !== id) || [] });
  };

  const filtered = (dd?.reviewPPTs || []).filter(p => p.fy === fy && (q === 'all' || p.quarter === q));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <DeptSelect depts={depts} value={dept} onChange={setDept} />
        {dept && <Chip label={dept} size="small" sx={{ bgcolor: `${c}12`, color: c, fontWeight: 700, border: `1px solid ${c}25` }} />}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, p: 0.5, bgcolor: '#F1F5F9', borderRadius: '10px', width: 'fit-content' }}>
        {['Onboarding PPT', 'Review PPTs', 'Master PPT'].map((t, i) => (
          <Button key={i} size="small" onClick={() => setTab(i)}
            sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', px: 1.8, py: 0.5, minHeight: 32,
              bgcolor: tab === i ? 'white' : 'transparent', boxShadow: tab === i ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              color: tab === i ? c : '#6B7280', transition: 'all 0.15s' }}>
            {t}
          </Button>
        ))}
      </Box>

      {tab === 0 && (
        <Stack spacing={1}>
          <LinkDisplay link={dd?.onboardingPPT || null} accentColor={c} />
          {isHR && <LinkEditor currentUrl={dd?.onboardingPPT?.url || ''} currentName={dd?.onboardingPPT?.name || ''} accentColor={c} onSave={saveOnboarding} placeholder="Google Drive PPT link" />}
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, bgcolor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E5E7EB', flexWrap: 'wrap' }}>
            <FilterIcon sx={{ fontSize: 16, color: '#94A3B8' }} />
            <FormControl size="small" sx={{ minWidth: 105 }}>
              <InputLabel sx={{ fontSize: '0.78rem' }}>FY</InputLabel>
              <Select value={fy} label="FY" onChange={e => setFY(e.target.value as string)} sx={{ fontSize: '0.8rem', borderRadius: '8px', bgcolor: 'white' }}>
                {getFYList().map(f => <MenuItem key={f} value={f} sx={{ fontSize: '0.8rem' }}>{f}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel sx={{ fontSize: '0.78rem' }}>Quarter</InputLabel>
              <Select value={q} label="Quarter" onChange={e => setQ(e.target.value as any)} sx={{ fontSize: '0.8rem', borderRadius: '8px', bgcolor: 'white' }}>
                <MenuItem value="all" sx={{ fontSize: '0.8rem' }}>All</MenuItem>
                {QUARTERS.map(qv => <MenuItem key={qv} value={qv} sx={{ fontSize: '0.8rem' }}>{qv}</MenuItem>)}
              </Select>
            </FormControl>
            <Chip label={`${fy}${q !== 'all' ? ' · ' + q : ''}`} size="small" sx={{ bgcolor: `${c}12`, color: c, fontWeight: 700, fontSize: '0.73rem' }} />
          </Box>

          {filtered.length === 0
            ? <EmptyState icon={<SlideshowIcon sx={{ fontSize: 36 }} />} text={`No PPTs for ${fy}${q !== 'all' ? ' · ' + q : ''}`} />
            : filtered.map(p => (
              <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'white', borderRadius: '10px', border: `1px solid ${c}20`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SlideshowIcon sx={{ color: c, fontSize: 17 }} />
                </Box>
                <Box flex={1}>
                  <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937">{p.name}</Typography>
                  <Typography fontSize="0.72rem" color="#9CA3AF">{p.fy} · {p.quarter}</Typography>
                </Box>
                <Tooltip title="Open"><IconButton size="small" href={p.url} target="_blank" sx={{ color: c, bgcolor: `${c}12`, borderRadius: '7px', width: 30, height: 30 }}><OpenInNewIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                <Tooltip title="Download"><IconButton size="small" href={p.url} download sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 30, height: 30 }}><DownloadIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                {isHR && <Tooltip title="Delete"><IconButton size="small" onClick={() => delReview(p.id)} sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: '7px', width: 28, height: 28 }}><DeleteIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>}
              </Box>
            ))
          }

          {isHR && (
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setAddDlg(true)}
              sx={{ textTransform: 'none', color: c, bgcolor: `${c}10`, border: `1px dashed ${c}40`, borderRadius: '8px', px: 2, py: 0.8, alignSelf: 'flex-start' }}>
              Add Review PPT
            </Button>
          )}

          <Dialog open={addDlg} onClose={() => setAddDlg(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
            <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Add Review PPT — {dept}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} mt={0.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Financial Year</InputLabel>
                  <Select value={newP.fy} label="Financial Year" onChange={e => setNewP(p => ({ ...p, fy: e.target.value as string }))} sx={{ borderRadius: '10px' }}>
                    {getFYList().map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Quarter</InputLabel>
                  <Select value={newP.quarter} label="Quarter" onChange={e => setNewP(p => ({ ...p, quarter: e.target.value as 'Q1'|'Q2'|'Q3'|'Q4' }))} sx={{ borderRadius: '10px' }}>
                    {QUARTERS.map(qv => <MenuItem key={qv} value={qv}>{qv}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label="Name" fullWidth value={newP.name} onChange={e => setNewP(p => ({ ...p, name: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                <TextField size="small" label="Google Drive URL" fullWidth value={newP.url} onChange={e => setNewP(p => ({ ...p, url: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setAddDlg(false)} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
              <Button variant="contained" onClick={addReview} disabled={saving || !newP.name || !newP.url} sx={{ bgcolor: c, borderRadius: '8px', textTransform: 'none', px: 3 }}>
                {saving ? <CircularProgress size={14} color="inherit" /> : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={1}>
          <LinkDisplay link={dd?.masterPPT || null} accentColor={c} />
          {isHR && <LinkEditor currentUrl={dd?.masterPPT?.url || ''} currentName={dd?.masterPPT?.name || ''} accentColor={c} onSave={saveMaster} placeholder="Google Drive Master PPT link" />}
        </Stack>
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — JD & Role Documents
// ════════════════════════════════════════════════════════════════════════════
function JDRoleDocs({ depts, designations }: { depts: string[]; designations: Designation[] }) {
  const [dept, setDept] = useState(depts[0] || '');
  const [active, setActive] = useState<string | null>(null);
  const c = getDeptColor(dept);
  const roles = designations.filter((d) => d.department === dept);

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <DeptSelect depts={depts} value={dept} onChange={(v) => { setDept(v); setActive(null); }} />
      </Box>

      {roles.length === 0 ? (
        <EmptyState icon={<WorkIcon sx={{ fontSize: 36 }} />} text={`No roles found for ${dept}`} />
      ) : (
        <Stack spacing={0.8}>
          {roles.map((r) => (
            <Box key={r._id}>
              <Box
                onClick={() => setActive((a) => (a === r._id ? null : r._id))}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.3,
                  bgcolor: active === r._id ? `${c}08` : 'white',
                  borderRadius: '10px',
                  border: `1px solid ${active === r._id ? c + '35' : '#E5E7EB'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: `${c}05`, borderColor: `${c}25` },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    bgcolor: `${c}12`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Person sx={{ fontSize: 16, color: c }} />
                </Box>
                <Box flex={1}>
                  <Typography fontSize="0.88rem" fontWeight={700} color="#1F2937">
                    {r.designation}
                  </Typography>
                  {r.remarks && <Typography fontSize="0.72rem" color="#9CA3AF">{r.remarks}</Typography>}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  {r.jd_link && <Chip label="JD" size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: `${c}12`, color: c, fontWeight: 700 }} />}
                  {(r.role_document_link || r.role_document) && (
                    <Chip label="Role Doc" size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 700 }} />
                  )}
                </Stack>
                <ExpandMoreIcon
                  sx={{
                    fontSize: 18,
                    color: '#9CA3AF',
                    transform: active === r._id ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </Box>

              <Collapse in={active === r._id} timeout="auto">
                <Box sx={{ mx: 1, mt: 0.5, mb: 0.5, p: 2, bgcolor: '#F8FAFC', borderRadius: '10px', border: `1px solid ${c}15` }}>
                  <Typography fontSize="0.72rem" color="#94A3B8" fontWeight={700} textTransform="uppercase" letterSpacing={0.8} mb={1.2}>
                    Select a document to open in PDF
                  </Typography>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" rowGap={1}>
                    <Button
                      href={r.jd_link || '#'}
                      target="_blank"
                      disabled={!r.jd_link}
                      startIcon={<JDIcon sx={{ fontSize: 17 }} />}
                      endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: 'white',
                        bgcolor: c,
                        borderRadius: '10px',
                        px: 2.5,
                        py: 1,
                        '&:hover': { bgcolor: c, opacity: 0.88 },
                        '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
                      }}
                    >
                      Job Description
                    </Button>
                    <Button
                      href={r.role_document_link || r.role_document || '#'}
                      target="_blank"
                      disabled={!r.role_document_link && !r.role_document}
                      startIcon={<ArticleIcon sx={{ fontSize: 17 }} />}
                      endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: c,
                        bgcolor: `${c}12`,
                        border: `1px solid ${c}30`,
                        borderRadius: '10px',
                        px: 2.5,
                        py: 1,
                        '&:hover': { bgcolor: `${c}20` },
                        '&.Mui-disabled': { bgcolor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' },
                      }}
                    >
                      Role Document
                    </Button>
                    {r.jd_link && (
                      <Tooltip title="Download JD PDF">
                        <IconButton
                          href={r.jd_link}
                          download
                          sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '8px', width: 40, height: 40, border: '1px solid #E5E7EB' }}
                        >
                          <DownloadIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Department Notes
// ════════════════════════════════════════════════════════════════════════════
function DeptNotes({
  depts,
  deptDataMap,
  onUpdate,
}: {
  depts: string[];
  deptDataMap: Record<string, DeptData>;
  onUpdate: (n: string, d: Partial<DeptData>) => void;
}) {
  const [dept, setDept] = useState(depts[0] || '');
  const [open, setOpen] = useState<string | null>(null);
  const [addDlg, setAddDlg] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const c = getDeptColor(dept);
  const dd = deptDataMap[dept];

  const addNote = async () => {
  if (!form.title || !form.content) return;
  setSaving(true);

  // ← Tell TS the new note is DeptNote
  const r = await api.post<DeptNote>(`/dept-orientation/${dd?.id}/notes`, form);

  if (r.success && r.data) {
    // Now r.data is DeptNote — safe
    onUpdate(dept, {
      notes: [...(dd?.notes || []), r.data],
    });
  }

  setSaving(false);
  setAddDlg(false);
  setForm({ title: '', content: '' });
};

  const delNote = async (id: string) => {
    await api.del(`/dept-orientation/${dd?.id}/notes/${id}`);
    onUpdate(dept, { notes: dd?.notes?.filter((n) => n.id !== id) || [] });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <DeptSelect depts={depts} value={dept} onChange={(v) => { setDept(v); setOpen(null); }} />
        {isHR && (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => setAddDlg(true)}
            sx={{
              ml: 'auto',
              textTransform: 'none',
              color: c,
              bgcolor: `${c}10`,
              border: `1px dashed ${c}40`,
              borderRadius: '8px',
              px: 1.5,
              py: 0.5,
            }}
          >
            Add Note
          </Button>
        )}
      </Box>

      {(!dd?.notes || dd.notes.length === 0) ? (
        <EmptyState icon={<NotesIcon sx={{ fontSize: 36 }} />} text={`No notes for ${dept}`} />
      ) : (
        <Stack spacing={0.8}>
          {dd.notes.map((note) => (
            <Box
              key={note.id}
              sx={{
                borderRadius: '10px',
                border: `1px solid ${open === note.id ? c + '40' : '#E5E7EB'}`,
                overflow: 'hidden',
                bgcolor: 'white',
              }}
            >
              <Box
                onClick={() => setOpen((o) => (o === note.id ? null : note.id))}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.8,
                  py: 1.3,
                  cursor: 'pointer',
                  bgcolor: open === note.id ? `${c}06` : 'white',
                  '&:hover': { bgcolor: `${c}04` },
                }}
              >
                <NotesIcon sx={{ fontSize: 17, color: c, flexShrink: 0 }} />
                <Typography fontSize="0.88rem" fontWeight={600} color="#1F2937" flex={1}>
                  {note.title}
                </Typography>
                <Typography fontSize="0.72rem" color="#9CA3AF">
                  {note.updatedAt}
                </Typography>
                {isHR && (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        delNote(note.id);
                      }}
                      sx={{ color: '#EF4444', p: 0.3 }}
                    >
                      <DeleteIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <ExpandMoreIcon
                  sx={{
                    fontSize: 18,
                    color: '#9CA3AF',
                    transform: open === note.id ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    ml: 0.5,
                  }}
                />
              </Box>
              <Collapse in={open === note.id}>
                <Box sx={{ px: 2.5, py: 2, bgcolor: '#FAFAFA', borderTop: `1px solid ${c}12` }}>
                  <Typography fontSize="0.84rem" color="#374151" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>
                    {note.content}
                  </Typography>
                </Box>
              </Collapse>
            </Box>
          ))}
        </Stack>
      )}

      <Dialog open={addDlg} onClose={() => setAddDlg(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Add Note — {dept}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField
              size="small"
              label="Title"
              fullWidth
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <TextField
              label="Content"
              fullWidth
              multiline
              rows={6}
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.85rem' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddDlg(false)} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={addNote}
            disabled={saving || !form.title || !form.content}
            sx={{ bgcolor: c, borderRadius: '8px', textTransform: 'none', px: 3 }}
          >
            {saving ? <CircularProgress size={14} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Department Tests
// ════════════════════════════════════════════════════════════════════════════
function DeptTests({
  depts,
  deptDataMap,
  onUpdate,
}: {
  depts: string[];
  deptDataMap: Record<string, DeptData>;
  onUpdate: (n: string, d: Partial<DeptData>) => void;
}) {
  const [dept, setDept] = useState(depts[0] || '');
  const c = getDeptColor(dept);
  const dd = deptDataMap[dept];

  const saveRec = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/tests/recruitment`, { name, url });
    if (r.success) onUpdate(dept, { recruitmentTest: { id: 'rec', name, url } });
  };

  const saveOnb = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/tests/onboarding`, { name, url });
    if (r.success) onUpdate(dept, { onboardingTest: { id: 'onb', name, url } });
  };

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <DeptSelect depts={depts} value={dept} onChange={setDept} />
      </Box>
      <Stack spacing={1.5}>
        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'white', border: `1px solid ${c}20`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '9px',
                bgcolor: `${c}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AssignmentIcon sx={{ fontSize: 19, color: c }} />
            </Box>
            <Box flex={1}>
              <Typography fontSize="0.9rem" fontWeight={700} color="#1F2937">
                Recruitment Test
              </Typography>
              <Typography fontSize="0.73rem" color="#9CA3AF">
                For candidates applying to {dept}
              </Typography>
            </Box>
            <Chip label="Candidates" size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: `${c}12`, color: c, fontWeight: 700 }} />
          </Box>
          <LinkDisplay link={dd?.recruitmentTest || null} accentColor={c} />
          {isHR && (
            <Box mt={1}>
              <LinkEditor
                currentUrl={dd?.recruitmentTest?.url || ''}
                currentName={dd?.recruitmentTest?.name || ''}
                accentColor={c}
                onSave={saveRec}
              />
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'white', border: '1px solid #10B98120', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '9px',
                bgcolor: '#10B98112',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QuizIcon sx={{ fontSize: 19, color: '#10B981' }} />
            </Box>
            <Box flex={1}>
              <Typography fontSize="0.9rem" fontWeight={700} color="#1F2937">
                Dept. Onboarding Test
              </Typography>
              <Typography fontSize="0.73rem" color="#9CA3AF">
                For new joiners in {dept}
              </Typography>
            </Box>
            <Chip label="New Joiners" size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 700 }} />
          </Box>
          <LinkDisplay link={dd?.onboardingTest || null} accentColor="#10B981" />
          {isHR && (
            <Box mt={1}>
              <LinkEditor
                currentUrl={dd?.onboardingTest?.url || ''}
                currentName={dd?.onboardingTest?.name || ''}
                accentColor="#10B981"
                onSave={saveOnb}
              />
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

// ── Accordion Section Card ────────────────────────────────────────────────────
function SectionCard({
  num,
  label,
  icon,
  children,
  defaultOpen = false,
}: {
  num: number;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box
      sx={{
        borderRadius: '16px',
        border: `1px solid ${open ? '#CBD5E1' : '#E5E7EB'}`,
        bgcolor: 'white',
        overflow: 'hidden',
        boxShadow: open ? '0 4px 20px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.2s',
      }}
    >
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 2.2,
          cursor: 'pointer',
          bgcolor: open ? '#F8FAFC' : 'white',
          borderBottom: open ? '1px solid #F1F5F9' : 'none',
          '&:hover': { bgcolor: '#F8FAFC' },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '11px',
            bgcolor: open ? '#E0E7FF' : '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: open ? '#4F46E5' : '#6B7280',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box flex={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Typography fontSize="0.7rem" fontWeight={800} color="#CBD5E1" letterSpacing={1.2} textTransform="uppercase">
              {String(num).padStart(2, '0')}
            </Typography>
            <Typography fontSize="1rem" fontWeight={700} color="#0F172A">
              {label}
            </Typography>
          </Box>
        </Box>
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: '#94A3B8',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.22s',
          }}
        />
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ px: 3, py: 3 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DeptOrientationPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [deptDataMap, setDeptDataMap] = useState<Record<string, DeptData>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; msg: string; type: 'success' | 'error' }>({
    open: false,
    msg: '',
    type: 'success',
  });

  useEffect(() => {
  let isMounted = true;

  Promise.all([
    api.get<Designation[]>('/designations'),
    api.get<DeptData[]>('/dept-orientation'),
  ])
    .then(([desRes, deptRes]) => {
      if (!isMounted) return;

      // Designations — only used by JDRoleDocs section
      if (desRes?.success && Array.isArray(desRes.data)) {
        setDesignations(desRes.data as Designation[]);
      }

      // Department orientation — full DeptData objects
      if (deptRes?.success && Array.isArray(deptRes.data)) {
  const deptList = deptRes.data as DeptData[];
  const map: Record<string, DeptData> = {};

        deptList.forEach((d) => {
          const name = d?.name?.trim();
          if (!name) return;                    // ← skip if name is missing/undefined
          map[name] = {
            ...d,
            id: (d as any).id || (d as any)._id?.toString() || '', // ← handle _id vs id
          };
        });

        setDeptDataMap(map);
        setDepartments(Object.keys(map).sort()); // ← derive names from the map, always safe
      }
    })
    .catch((err) => {
      console.error('Failed to load initial data:', err);
      if (isMounted) setToast({ open: true, msg: 'Could not load data', type: 'error' });
    })
    .finally(() => {
      if (isMounted) setLoading(false);
    });

  return () => { isMounted = false; };
}, []);


  const updateDeptData = (deptName: string, partial: Partial<DeptData>) => {
    setDeptDataMap((prev) => ({
      ...prev,
      [deptName]: { ...prev[deptName], ...partial },
    }));
    setToast({ open: true, msg: 'Saved successfully', type: 'success' });
  };

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main style={{ padding: '24px', paddingTop: '88px' }}>
          {/* Hero banner */}
          <Box
            sx={{
              mb: 4,
              p: 3.5,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 65%, #334155 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ApartmentIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box flex={1}>
                <Typography fontWeight={800} fontSize="1.5rem" lineHeight={1.2}>
                  Department Orientation
                </Typography>
                <Typography fontSize="0.85rem" sx={{ opacity: 0.6, mt: 0.3 }}>
                  PPTs · JDs · Notes · Tests — organized by department
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {loading && <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.6)' }} />}
                <Chip
                  label={`${departments.length} Departments`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '0.75rem',
                  }}
                />
                {isHR && (
                  <Chip
                    label="HR · Edit Mode"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(134,239,172,0.15)',
                      color: '#86EFAC',
                      fontWeight: 700,
                      border: '1px solid rgba(134,239,172,0.3)',
                      fontSize: '0.75rem',
                    }}
                  />
                )}
              </Stack>
            </Box>

            {departments.length > 0 && (
              <Box sx={{ mt: 2.5, display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {departments.map((d) => (
                  <Box
                    key={d}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.6,
                      px: 1.2,
                      py: 0.4,
                      borderRadius: '20px',
                      bgcolor: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: getDeptColor(d) }} />
                    <Typography fontSize="0.73rem" color="rgba(255,255,255,0.8)" fontWeight={600}>
                      {d}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2}>
              <SectionCard num={1} label="Department Presentations" icon={<SlideshowIcon sx={{ fontSize: 21 }} />} defaultOpen>
                <DeptPresentations depts={departments} deptDataMap={deptDataMap} onUpdate={updateDeptData} />
              </SectionCard>
              <SectionCard num={2} label="JD & Role Documents" icon={<WorkIcon sx={{ fontSize: 21 }} />}>
                <JDRoleDocs depts={departments} designations={designations} />
              </SectionCard>
              <SectionCard num={3} label="Department Notes" icon={<NotesIcon sx={{ fontSize: 21 }} />}>
                <DeptNotes depts={departments} deptDataMap={deptDataMap} onUpdate={updateDeptData} />
              </SectionCard>
              <SectionCard num={4} label="Department Tests" icon={<QuizIcon sx={{ fontSize: 21 }} />}>
                <DeptTests depts={departments} deptDataMap={deptDataMap} onUpdate={updateDeptData} />
              </SectionCard>
            </Stack>
          )}
        </main>
      </div>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}

function async<T>(path: any, string: any) {
    throw new Error('Function not implemented.');
}
