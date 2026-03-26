import { useState, useEffect, useRef } from 'react';
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
  LinearProgress,
  InputAdornment,
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
  KeyboardArrowDown as ArrowDownIcon,
  Article as ArticleIcon,
  VerifiedUser as JDIcon,
  Apartment as ApartmentIcon,
  Work as WorkIcon,
  Quiz as QuizIcon,
  Assignment as AssignmentIcon,
  Person,
  Upload as UploadIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

const API_BASE = process.env.REACT_APP_API_URL || 'http://3.109.132.204:5000/api';
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
  content?: string;
  link?: string;
  attachment?: string;
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
  postFormData: async function <T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
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
  upload: async function <T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
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

// ── System Name Generator ─────────────────────────────────────────────────────
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function generateSystemName(
  dept: string,
  type: 'onboarding_ppt' | 'master_ppt' | 'review_ppt' | 'recruitment_test' | 'onboarding_test' | 'jd' | 'role_doc',
  opts?: { fy?: string; quarter?: string; designation?: string }
): string {
  const deptSlug = slugify(dept);
  if (type === 'review_ppt' && opts?.fy && opts?.quarter) {
    const fySlug = opts.fy.toLowerCase().replace('-', '_');
    return `${deptSlug}_review_ppt_${fySlug}_${opts.quarter.toLowerCase()}`;
  }
  if ((type === 'jd' || type === 'role_doc') && opts?.designation) {
    const desigSlug = slugify(opts.designation);
    return `${deptSlug}_${desigSlug}_${type}`;
  }
  return `${deptSlug}_${type}`;
}

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

// ── Dept Label Colors (Notion-style) ──────────────────────────────────────────
const NOTION_LABEL_STYLES: Array<{ bg: string; color: string; border: string }> = [
  { bg: '#EEF2FF', color: '#4F46E5', border: '#C7D2FE' },
  { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  { bg: '#FDF4FF', color: '#9333EA', border: '#E9D5FF' },
  { bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' },
  { bg: '#F0F9FF', color: '#0284C7', border: '#BAE6FD' },
  { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  { bg: '#F0FDFA', color: '#0D9488', border: '#99F6E4' },
  { bg: '#FFF5F5', color: '#DC2626', border: '#FCA5A5' },
  { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  { bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC' },
];
const _notionStyleCache: Record<string, { bg: string; color: string; border: string }> = {};
function getNotionStyle(name: string) {
  if (!_notionStyleCache[name]) {
    _notionStyleCache[name] = NOTION_LABEL_STYLES[Object.keys(_notionStyleCache).length % NOTION_LABEL_STYLES.length];
  }
  return _notionStyleCache[name];
}

// ── Shared Components ─────────────────────────────────────────────────────────
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center', color: '#9CA3AF', bgcolor: '#F9FAFB', borderRadius: '12px', border: '1px dashed #E5E7EB' }}>
      <Box sx={{ mb: 0.5, opacity: 0.35 }}>{icon}</Box>
      <Typography fontSize="0.83rem">{text}</Typography>
    </Box>
  );
}

// ── SystemNameBadge ───────────────────────────────────────────────────────────
function SystemNameBadge({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Click to copy system name'}>
      <Box onClick={copy} sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.6,
        px: 1, py: 0.3, borderRadius: '6px',
        bgcolor: '#F1F5F9', border: '1px solid #E2E8F0',
        cursor: 'pointer', transition: 'all 0.15s',
        '&:hover': { bgcolor: '#E2E8F0' },
      }}>
        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748B', letterSpacing: 0.2 }}>
          {name}
        </Typography>
        {copied
          ? <CheckIcon sx={{ fontSize: 11, color: '#10B981' }} />
          : <CopyIcon sx={{ fontSize: 11, color: '#94A3B8' }} />
        }
      </Box>
    </Tooltip>
  );
}

// ── FileUploadButton ──────────────────────────────────────────────────────────
function FileUploadButton({
  accentColor,
  onUploaded,
  uploadPath,
}: {
  accentColor: string;
  onUploaded: (url: string) => void;
  uploadPath: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(20);

    // Simulate progress for UX while uploading
    const interval = setInterval(() => setProgress(p => Math.min(p + 15, 85)), 300);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload<{ url: string }>(uploadPath, fd);
      clearInterval(interval);
      setProgress(100);
      if (res.success && res.data?.url) {
        onUploaded(res.data.url);
      }
    } catch {
      clearInterval(interval);
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); }, 600);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Box>
      <input ref={inputRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" style={{ display: 'none' }} onChange={handleFile} />
      <Button
        size="small"
        startIcon={uploading ? <CircularProgress size={11} color="inherit" /> : <UploadIcon sx={{ fontSize: 13 }} />}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        sx={{
          textTransform: 'none', color: accentColor, fontSize: '0.78rem',
          bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}25`,
          borderRadius: '8px', px: 1.5, py: 0.5,
          '&:hover': { bgcolor: `${accentColor}20` },
        }}
      >
        {uploading ? 'Uploading…' : 'Upload file'}
      </Button>
      {uploading && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mt: 0.6, borderRadius: 4, height: 3, bgcolor: `${accentColor}15`,
            '& .MuiLinearProgress-bar': { bgcolor: accentColor } }}
        />
      )}
    </Box>
  );
}

// ── LinkEditor (with upload + edit + system name) ─────────────────────────────
function LinkEditor({
  currentUrl, systemName, accentColor, onSave, uploadPath, placeholder = 'Google Drive URL',
}: {
  currentUrl: string;
  systemName: string;
  accentColor: string;
  onSave: (name: string, url: string) => Promise<void>;
  uploadPath: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(currentUrl);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setUrl(currentUrl); }, [currentUrl]);

  const save = async () => {
    if (!url.trim()) return;
    setSaving(true);
    await onSave(systemName, url);
    setSaving(false);
    setEditing(false);
  };

  const handleUploaded = (uploadedUrl: string) => {
    setUrl(uploadedUrl);
    setEditing(true); // open edit panel to confirm
  };

  if (!editing) return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={0.8}>
      {isHR && (
        <Button
          size="small"
          startIcon={<EditIcon sx={{ fontSize: 13 }} />}
          onClick={() => setEditing(true)}
          sx={{
            textTransform: 'none', color: accentColor, fontSize: '0.78rem',
            bgcolor: `${accentColor}10`, border: `1px solid ${accentColor}25`,
            borderRadius: '8px', px: 1.5, py: 0.5,
          }}
        >
          {currentUrl ? 'Edit link' : 'Add link'}
        </Button>
      )}
      {isHR && (
        <FileUploadButton
          accentColor={accentColor}
          onUploaded={handleUploaded}
          uploadPath={uploadPath}
        />
      )}
    </Stack>
  );

  return (
    <Stack spacing={0.8} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.95)', borderRadius: '10px', border: '1px solid #E5E7EB', mt: 0.8 }}>
      {/* System name display - read only */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography fontSize="0.72rem" color="#9CA3AF">System name:</Typography>
        <SystemNameBadge name={systemName} />
      </Box>
      <TextField
        size="small"
        placeholder={placeholder}
        value={url}
        onChange={e => setUrl(e.target.value)}
        label="URL"
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' } }}
      />
      <Stack direction="row" spacing={0.8} alignItems="center">
        <Button
          size="small" variant="contained" onClick={save} disabled={saving || !url.trim()}
          startIcon={saving ? <CircularProgress size={11} color="inherit" /> : <SaveIcon sx={{ fontSize: 13 }} />}
          sx={{ bgcolor: accentColor, borderRadius: '7px', textTransform: 'none', fontSize: '0.78rem', px: 2,
            '&:hover': { bgcolor: accentColor, opacity: 0.9 } }}
        >
          Save
        </Button>
        <Button size="small" onClick={() => setEditing(false)} sx={{ textTransform: 'none', fontSize: '0.78rem', color: '#9CA3AF' }}>
          Cancel
        </Button>
        {/* Also allow upload from within edit panel */}
        <FileUploadButton accentColor={accentColor} onUploaded={u => setUrl(u)} uploadPath={uploadPath} />
      </Stack>
    </Stack>
  );
}

// ── LinkDisplay (with open, download, copy URL) ───────────────────────────────
function LinkDisplay({
  link, accentColor, systemName,
}: {
  link: LinkItem | null; accentColor: string; systemName: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!link?.url) return (
    <Typography fontSize="0.82rem" color="#9CA3AF" sx={{ py: 0.5, fontStyle: 'italic' }}>
      No file added yet.
    </Typography>
  );

  const copyUrl = () => {
    navigator.clipboard.writeText(link.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.2, p: 1.2,
      bgcolor: 'white', borderRadius: '10px',
      border: `1px solid ${accentColor}20`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '8px', bgcolor: `${accentColor}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <PdfIcon sx={{ color: accentColor, fontSize: 17 }} />
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937" noWrap>
          {link.name || systemName}
        </Typography>
        <SystemNameBadge name={systemName} />
      </Box>
      {/* Open */}
      <Tooltip title="Open in new tab">
        <IconButton size="small" href={link.url} target="_blank"
          sx={{ color: accentColor, bgcolor: `${accentColor}12`, borderRadius: '7px', width: 30, height: 30 }}>
          <OpenInNewIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      {/* Download */}
      <Tooltip title="Download">
        <IconButton size="small" component="a" href={link.url} download={systemName}
          sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 30, height: 30 }}>
          <DownloadIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      {/* Copy URL */}
      <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
        <IconButton size="small" onClick={copyUrl}
          sx={{ color: copied ? '#10B981' : '#6B7280', bgcolor: copied ? '#F0FDF4' : '#F3F4F6', borderRadius: '7px', width: 30, height: 30 }}>
          {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <CopyIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Accordion Section Card ────────────────────────────────────────────────────
function SectionCard({ num, label, icon, children }: {
  num: number; label: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{
      borderRadius: '16px', border: `1px solid ${open ? '#CBD5E1' : '#E5E7EB'}`, bgcolor: 'white',
      overflow: 'hidden', boxShadow: open ? '0 4px 20px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'all 0.2s',
    }}>
      <Box onClick={() => setOpen(o => !o)} sx={{
        display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2.2, cursor: 'pointer',
        bgcolor: open ? '#F8FAFC' : 'white', borderBottom: open ? '1px solid #F1F5F9' : 'none',
        '&:hover': { bgcolor: '#F8FAFC' },
      }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '11px', bgcolor: open ? '#E0E7FF' : '#F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#4F46E5' : '#6B7280', transition: 'all 0.2s', flexShrink: 0,
        }}>{icon}</Box>
        <Box flex={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Typography fontSize="0.7rem" fontWeight={800} color="#CBD5E1" letterSpacing={1.2} textTransform="uppercase">
              {String(num).padStart(2, '0')}
            </Typography>
            <Typography fontSize="1rem" fontWeight={700} color="#0F172A">{label}</Typography>
          </Box>
        </Box>
        <ExpandMoreIcon sx={{
          fontSize: 20, color: '#94A3B8',
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s',
        }} />
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ px: 3, py: 3 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Presentations
// ════════════════════════════════════════════════════════════════════════════
function DeptPresentations({ dept, dd, c, onUpdate }: {
  dept: string; dd: DeptData | undefined; c: string;
  onUpdate: (name: string, d: Partial<DeptData>) => void;
}) {
  const [tab, setTab] = useState(0);
  const [fy, setFY] = useState(getCurrentFY());
  const [q, setQ] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'all'>('all');
  const [addDlg, setAddDlg] = useState(false);
  const [saving, setSaving] = useState(false);

  type NewPPT = { fy: string; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; url: string };
  const [newP, setNewP] = useState<NewPPT>({ fy: getCurrentFY(), quarter: 'Q1', url: '' });

  const onboardingSystemName = generateSystemName(dept, 'onboarding_ppt');
  const masterSystemName = generateSystemName(dept, 'master_ppt');

  const saveOnboarding = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/onboarding-ppt`, { name, url });
    if (r.success) onUpdate(dept, { onboardingPPT: { id: 'ppt', name, url } });
  };
  const saveMaster = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/master-ppt`, { name, url });
    if (r.success) onUpdate(dept, { masterPPT: { id: 'master', name, url } });
  };
  const addReview = async () => {
    if (!newP.url) return;
    const sysName = generateSystemName(dept, 'review_ppt', { fy: newP.fy, quarter: newP.quarter });
    setSaving(true);
    const r = await api.post<QuarterPPT>(`/dept-orientation/${dd?.id}/review-ppts`, {
      ...newP,
      name: sysName,
    });
    if (r.success && r.data) onUpdate(dept, { reviewPPTs: [...(dd?.reviewPPTs || []), r.data] });
    setSaving(false);
    setAddDlg(false);
    setNewP({ fy: getCurrentFY(), quarter: 'Q1', url: '' });
  };
  const delReview = async (id: string) => {
    await api.del(`/dept-orientation/${dd?.id}/review-ppts/${id}`);
    onUpdate(dept, { reviewPPTs: dd?.reviewPPTs?.filter(p => p.id !== id) || [] });
  };

  const filtered = (dd?.reviewPPTs || []).filter(p => p.fy === fy && (q === 'all' || p.quarter === q));

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, p: 0.5, bgcolor: '#F1F5F9', borderRadius: '10px', width: 'fit-content' }}>
        {['Onboarding PPT', 'Review PPTs', 'Master PPT'].map((t, i) => (
          <Button key={i} size="small" onClick={() => setTab(i)}
            sx={{
              textTransform: 'none', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', px: 1.8, py: 0.5, minHeight: 32,
              bgcolor: tab === i ? 'white' : 'transparent', boxShadow: tab === i ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              color: tab === i ? c : '#6B7280', transition: 'all 0.15s',
            }}>
            {t}
          </Button>
        ))}
      </Box>

      {tab === 0 && (
        <Stack spacing={1.2}>
          <LinkDisplay link={dd?.onboardingPPT || null} accentColor={c} systemName={onboardingSystemName} />
          <LinkEditor
            currentUrl={dd?.onboardingPPT?.url || ''}
            systemName={onboardingSystemName}
            accentColor={c}
            onSave={saveOnboarding}
            uploadPath={`/dept-orientation/${dd?.id}/upload`}
            placeholder="Google Drive PPT link"
          />
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
            : filtered.map(p => {
              const sysName = generateSystemName(dept, 'review_ppt', { fy: p.fy, quarter: p.quarter });
              return (
                <Box key={p.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'white',
                  borderRadius: '10px', border: `1px solid ${c}20`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <SlideshowIcon sx={{ color: c, fontSize: 17 }} />
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937" noWrap>{p.name || sysName}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Typography fontSize="0.72rem" color="#9CA3AF">{p.fy} · {p.quarter}</Typography>
                      <SystemNameBadge name={sysName} />
                    </Box>
                  </Box>
                  <Tooltip title="Open">
                    <IconButton size="small" href={p.url} target="_blank" sx={{ color: c, bgcolor: `${c}12`, borderRadius: '7px', width: 30, height: 30 }}>
                      <OpenInNewIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
                    <IconButton size="small" component="a" href={p.url} download={sysName} sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 30, height: 30 }}>
                      <DownloadIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  {isHR && (
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => delReview(p.id)} sx={{ color: '#EF4444', bgcolor: '#FEF2F2', borderRadius: '7px', width: 28, height: 28 }}>
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              );
            })
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

                {/* System name preview */}
                <Box sx={{ p: 1.2, bgcolor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <Typography fontSize="0.72rem" color="#94A3B8" mb={0.4}>Auto-generated system name:</Typography>
                  <SystemNameBadge name={generateSystemName(dept, 'review_ppt', { fy: newP.fy, quarter: newP.quarter })} />
                </Box>

                <TextField size="small" label="Google Drive URL" fullWidth value={newP.url} onChange={e => setNewP(p => ({ ...p, url: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontSize="0.78rem" color="#6B7280">or</Typography>
                  <FileUploadButton
                    accentColor={c}
                    onUploaded={url => setNewP(p => ({ ...p, url }))}
                    uploadPath={`/dept-orientation/${dd?.id}/upload`}
                  />
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setAddDlg(false)} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
              <Button variant="contained" onClick={addReview} disabled={saving || !newP.url} sx={{ bgcolor: c, borderRadius: '8px', textTransform: 'none', px: 3 }}>
                {saving ? <CircularProgress size={14} color="inherit" /> : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={1.2}>
          <LinkDisplay link={dd?.masterPPT || null} accentColor={c} systemName={masterSystemName} />
          <LinkEditor
            currentUrl={dd?.masterPPT?.url || ''}
            systemName={masterSystemName}
            accentColor={c}
            onSave={saveMaster}
            uploadPath={`/dept-orientation/${dd?.id}/upload`}
            placeholder="Google Drive Master PPT link"
          />
        </Stack>
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — JD & Role Documents (pre-filled from designation model)
// ════════════════════════════════════════════════════════════════════════════
function JDRoleDocs({ dept, c, designations }: { dept: string; c: string; designations: Designation[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [uploadDialog, setUploadDialog] = useState<{ 
    open: boolean; 
    type: 'jd' | 'role_doc'; 
    designation: Designation | null 
  }>({ 
    open: false, 
    type: 'jd', 
    designation: null 
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [driveLink, setDriveLink] = useState('');
  const [uploadType, setUploadType] = useState<'file' | 'drive'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const roles = designations.filter(d => d.department === dept);

  // Generate auto name for JD/Role Doc
  const generateDocName = (type: 'jd' | 'role_doc', designation: string) => {
    const deptSlug = slugify(dept);
    const desigSlug = slugify(designation);
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    return `${deptSlug}_${desigSlug}_${type}_${timestamp}`;
  };

  const handleFileUpload = async () => {
    if (!uploadDialog.designation) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('department', dept);
    formData.append('designation', uploadDialog.designation.designation);
    formData.append('type', uploadDialog.type);
    formData.append('systemName', generateDocName(uploadDialog.type, uploadDialog.designation.designation));
    
    if (uploadType === 'file' && selectedFile) {
      formData.append('file', selectedFile);
    } else if (uploadType === 'drive' && driveLink) {
      formData.append('driveLink', driveLink);
    }
    
    try {
      const response = await api.postFormData<{ success: boolean }>(`/upload-designation-doc`, formData);
      if (response.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setUploadDialog({ open: false, type: 'jd', designation: null });
      setSelectedFile(null);
      setDriveLink('');
      setUploadType('file');
    }
  };

  return (
    <Box>
      {roles.length === 0 ? (
        <EmptyState icon={<WorkIcon sx={{ fontSize: 36 }} />} text={`No roles found for ${dept}`} />
      ) : (
        <Stack spacing={0.8}>
          {roles.map(r => {
            const jdSystemName = generateSystemName(dept, 'jd', { designation: r.designation });
            const roleDocSystemName = generateSystemName(dept, 'role_doc', { designation: r.designation });
            const hasJD = !!(r.jd_link);
            const hasRoleDoc = !!(r.role_document_link || r.role_document);

            return (
              <Box key={r._id}>
                <Box
                  onClick={() => setActive(a => (a === r._id ? null : r._id))}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, p: 1.3,
                    bgcolor: active === r._id ? `${c}08` : 'white', borderRadius: '10px',
                    border: `1px solid ${active === r._id ? c + '35' : '#E5E7EB'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { bgcolor: `${c}05`, borderColor: `${c}25` },
                  }}
                >
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Person sx={{ fontSize: 16, color: c }} />
                  </Box>
                  <Box flex={1}>
                    <Typography fontSize="0.88rem" fontWeight={700} color="#1F2937">{r.designation}</Typography>
                    {r.remarks && <Typography fontSize="0.72rem" color="#9CA3AF">{r.remarks}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    {hasJD && <Chip label="JD" size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: `${c}12`, color: c, fontWeight: 700 }} />}
                    {hasRoleDoc && <Chip label="Role Doc" size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 700 }} />}
                  </Stack>
                  <ExpandMoreIcon sx={{ fontSize: 18, color: '#9CA3AF', transform: active === r._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </Box>

                <Collapse in={active === r._id} timeout="auto">
                  <Box sx={{ mx: 1, mt: 0.5, mb: 0.5, p: 2, bgcolor: '#F8FAFC', borderRadius: '10px', border: `1px solid ${c}15` }}>
                    <Typography fontSize="0.72rem" color="#94A3B8" fontWeight={700} textTransform="uppercase" letterSpacing={0.8} mb={1.5}>
                      Documents
                    </Typography>

                    <Stack spacing={1.5}>
                      {/* JD row */}
                      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: '10px', border: `1px solid ${c}20` }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <JDIcon sx={{ fontSize: 16, color: c }} />
                          <Typography fontSize="0.82rem" fontWeight={700} color="#1F2937">Job Description</Typography>
                          <SystemNameBadge name={jdSystemName} />
                        </Box>
                        {hasJD ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                              href={r.jd_link} target="_blank"
                              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.82rem', color: 'white', bgcolor: c, borderRadius: '8px', px: 2, py: 0.7, '&:hover': { bgcolor: c, opacity: 0.88 } }}
                            >
                              Open
                            </Button>
                            <Tooltip title="Download JD">
                              <IconButton component="a" href={r.jd_link} download={jdSystemName} sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 32, height: 32 }}>
                                <DownloadIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            {isHR && (
                              <Tooltip title="Upload New JD">
                                <IconButton 
                                  onClick={() => setUploadDialog({ open: true, type: 'jd', designation: r })}
                                  sx={{ color: c, bgcolor: `${c}10`, borderRadius: '7px', width: 32, height: 32, '&:hover': { bgcolor: `${c}20` } }}
                                >
                                  <UploadIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontSize="0.78rem" color="#9CA3AF" fontStyle="italic" flex={1}>
                              No JD linked in designation record.
                            </Typography>
                            {isHR && (
                              <Button
                                size="small"
                                startIcon={<UploadIcon sx={{ fontSize: 14 }} />}
                                onClick={() => setUploadDialog({ open: true, type: 'jd', designation: r })}
                                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: c, bgcolor: `${c}10`, border: `1px solid ${c}30`, borderRadius: '6px', px: 1.5, py: 0.5, '&:hover': { bgcolor: `${c}20` } }}
                              >
                                Upload
                              </Button>
                            )}
                          </Stack>
                        )}
                      </Box>

                      {/* Role Doc row */}
                      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ArticleIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                          <Typography fontSize="0.82rem" fontWeight={700} color="#1F2937">Role Document</Typography>
                          <SystemNameBadge name={roleDocSystemName} />
                        </Box>
                        {hasRoleDoc ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                              href={r.role_document_link || r.role_document} target="_blank"
                              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.82rem', color: c, bgcolor: `${c}12`, border: `1px solid ${c}30`, borderRadius: '8px', px: 2, py: 0.7, '&:hover': { bgcolor: `${c}20` } }}
                            >
                              Open
                            </Button>
                            <Tooltip title="Download Role Doc">
                              <IconButton component="a" href={r.role_document_link || r.role_document} download={roleDocSystemName} sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 32, height: 32 }}>
                                <DownloadIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            {isHR && (
                              <Tooltip title="Upload New Role Doc">
                                <IconButton 
                                  onClick={() => setUploadDialog({ open: true, type: 'role_doc', designation: r })}
                                  sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 32, height: 32, '&:hover': { bgcolor: '#E5E7EB' } }}
                                >
                                  <UploadIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontSize="0.78rem" color="#9CA3AF" fontStyle="italic" flex={1}>
                              No role document linked in designation record.
                            </Typography>
                            {isHR && (
                              <Button
                                size="small"
                                startIcon={<UploadIcon sx={{ fontSize: 14 }} />}
                                onClick={() => setUploadDialog({ open: true, type: 'role_doc', designation: r })}
                                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: '#6B7280', bgcolor: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', px: 1.5, py: 0.5, '&:hover': { bgcolor: '#E5E7EB' } }}
                              >
                                Upload
                              </Button>
                            )}
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}
      
      {/* Upload Dialog */}
      <Dialog open={uploadDialog.open} onClose={() => setUploadDialog({ open: false, type: 'jd', designation: null })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          Upload {uploadDialog.type === 'jd' ? 'Job Description' : 'Role Document'} — {uploadDialog.designation?.designation}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            {/* Auto-generated Name */}
            {uploadDialog.designation && (
              <Box sx={{ p: 1.5, bgcolor: '#F0F9FF', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
                <Typography fontSize="0.75rem" color="#0369A1" fontWeight={600}>
                  System Name: {generateDocName(uploadDialog.type, uploadDialog.designation.designation)}
                </Typography>
              </Box>
            )}
            
            {/* Upload Type Selection */}
            <Stack direction="row" spacing={1}>
              <Button
                variant={uploadType === 'file' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUploadType('file')}
                sx={{ 
                  borderRadius: '8px', 
                  textTransform: 'none',
                  bgcolor: uploadType === 'file' ? c : 'transparent',
                  color: uploadType === 'file' ? 'white' : c,
                  borderColor: c
                }}
              >
                Upload File
              </Button>
              <Button
                variant={uploadType === 'drive' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUploadType('drive')}
                sx={{ 
                  borderRadius: '8px', 
                  textTransform: 'none',
                  bgcolor: uploadType === 'drive' ? c : 'transparent',
                  color: uploadType === 'drive' ? 'white' : c,
                  borderColor: c
                }}
              >
                Google Drive Link
              </Button>
            </Stack>

            {uploadType === 'file' ? (
              <>
                <TextField
                  size="small"
                  label="Select File"
                  fullWidth
                  value={selectedFile?.name || ''}
                  onClick={() => fileInputRef.current?.click()}
                  InputProps={{
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="start">
                        <UploadIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ 
                    cursor: 'pointer',
                    '& .MuiOutlinedInput-root': { borderRadius: '10px' },
                    '&:hover .MuiOutlinedInput-root': { borderColor: c }
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                {selectedFile && (
                  <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <Typography fontSize="0.78rem" color="#64748B">
                      Selected: <span style={{ fontWeight: 600, color: '#334155' }}>{selectedFile.name}</span>
                    </Typography>
                    <Typography fontSize="0.72rem" color="#94A3B8">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <TextField
                size="small"
                label="Google Drive Link"
                fullWidth
                value={driveLink}
                onChange={e => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setUploadDialog({ open: false, type: 'jd', designation: null })} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleFileUpload} 
            disabled={uploading || (uploadType === 'file' ? !selectedFile : !driveLink)}
            sx={{ bgcolor: c, borderRadius: '8px', textTransform: 'none', px: 3 }}
          >
            {uploading ? <CircularProgress size={14} color="inherit" /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Department Notes
// ════════════════════════════════════════════════════════════════════════════
function DeptNotes({ dept, c, dd, onUpdate }: {
  dept: string; c: string; dd: DeptData | undefined;
  onUpdate: (n: string, d: Partial<DeptData>) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [addDlg, setAddDlg] = useState(false);
  const [form, setForm] = useState({ link: '' });
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate system name for note (auto-generated, not editable)
  const generateNoteSystemName = () => {
    const deptSlug = slugify(dept);
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const randomId = Math.random().toString(36).substring(2, 8);
    return `${deptSlug}_note_${timestamp}_${randomId}`;
  };

  const addNote = async () => {
    setSaving(true);
    
    const formData = new FormData();
    formData.append('title', generateNoteSystemName());
    formData.append('department', dept);
    formData.append('systemName', generateNoteSystemName());
    
    if (selectedFile) {
      formData.append('file', selectedFile);
    } else if (form.link) {
      formData.append('link', form.link);
    }
    
    const r = await api.postFormData<DeptNote>(`/dept-orientation/${dd?.id}/notes`, formData);
    if (r.success && r.data) onUpdate(dept, { notes: [...(dd?.notes || []), r.data] });
    setSaving(false);
    setAddDlg(false);
    setForm({ link: '' });
    setSelectedFile(null);
  };
  
  const delNote = async (id: string) => {
    await api.del(`/dept-orientation/${dd?.id}/notes/${id}`);
    onUpdate(dept, { notes: dd?.notes?.filter(n => n.id !== id) || [] });
  };

  return (
    <Box>
      {isHR && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setAddDlg(true)}
            sx={{ textTransform: 'none', color: c, bgcolor: `${c}10`, border: `1px dashed ${c}40`, borderRadius: '8px', px: 1.5, py: 0.5 }}>
            Add Note
          </Button>
        </Box>
      )}

      {(!dd?.notes || dd.notes.length === 0) ? (
        <EmptyState icon={<NotesIcon sx={{ fontSize: 36 }} />} text={`No notes for ${dept}`} />
      ) : (
        <Stack spacing={0.8}>
          {dd.notes.map(note => {
            return (
            <Box key={note.id} sx={{ borderRadius: '10px', border: `1px solid ${open === note.id ? c + '40' : '#E5E7EB'}`, overflow: 'hidden', bgcolor: 'white' }}>
              <Box onClick={() => setOpen(o => (o === note.id ? null : note.id))}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.8, py: 1.3, cursor: 'pointer', bgcolor: open === note.id ? `${c}06` : 'white', '&:hover': { bgcolor: `${c}04` } }}>
                <NotesIcon sx={{ fontSize: 17, color: c, flexShrink: 0 }} />
                <Typography fontSize="0.88rem" fontWeight={600} color="#1F2937" flex={1}>{note.title}</Typography>
                <SystemNameBadge name={note.title} />
                <Typography fontSize="0.72rem" color="#9CA3AF">{note.updatedAt}</Typography>
                {isHR && (
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); delNote(note.id); }} sx={{ color: '#EF4444', p: 0.3 }}>
                      <DeleteIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <ExpandMoreIcon sx={{ fontSize: 18, color: '#9CA3AF', transform: open === note.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', ml: 0.5 }} />
              </Box>
              <Collapse in={open === note.id}>
                <Box sx={{ px: 2.5, py: 2, bgcolor: '#FAFAFA', borderTop: `1px solid ${c}12` }}>
                  {note.link ? (
                    <Stack spacing={1.5}>
                      <Typography fontSize="0.82rem" fontWeight={600} color="#1F2937">External Link</Typography>
                      <Button
                        href={note.link}
                        target="_blank"
                        startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', color: 'white', bgcolor: c, borderRadius: '8px', px: 2, py: 0.7, '&:hover': { bgcolor: c, opacity: 0.88 } }}
                      >
                        Open Link
                      </Button>
                    </Stack>
                  ) : note.attachment ? (
                    <Stack spacing={1.5}>
                      <Typography fontSize="0.82rem" fontWeight={600} color="#1F2937">Attached File</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          href={note.attachment}
                          target="_blank"
                          startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', color: 'white', bgcolor: c, borderRadius: '8px', px: 2, py: 0.7, '&:hover': { bgcolor: c, opacity: 0.88 } }}
                        >
                          Open File
                        </Button>
                        <Tooltip title="Download File">
                          <IconButton component="a" href={note.attachment} download={note.title} sx={{ color: '#6B7280', bgcolor: '#F3F4F6', borderRadius: '7px', width: 32, height: 32 }}>
                            <DownloadIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography fontSize="0.84rem" color="#374151" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>
                      No content available
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
            );
          })}
        </Stack>
      )}

      <Dialog open={addDlg} onClose={() => setAddDlg(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Add Note — {dept}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            {/* Auto-generated Name */}
            <Box sx={{ p: 1.5, bgcolor: '#F0F9FF', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
              <Typography fontSize="0.75rem" color="#0369A1" fontWeight={600} mb={0.5}>
                Auto-generated Name:
              </Typography>
              <Typography fontSize="0.82rem" color="#1E40AF" fontFamily="monospace">
                {generateNoteSystemName()}
              </Typography>
            </Box>
            
            <TextField
              size="small"
              label="Link (Optional)"
              fullWidth
              value={form.link}
              onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
              placeholder="https://example.com/resource"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.85rem' } }}
            />
            
            <Typography textAlign="center" sx={{ fontSize: '0.78rem', color: '#6B7280', my: 1 }}>
              OR
            </Typography>
            
            <TextField
              size="small"
              label="Upload File (Optional)"
              fullWidth
              value={selectedFile?.name || ''}
              onClick={() => fileInputRef.current?.click()}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <UploadIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                cursor: 'pointer',
                '& .MuiOutlinedInput-root': { borderRadius: '10px' },
                '&:hover .MuiOutlinedInput-root': { borderColor: c }
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            {selectedFile && (
              <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <Typography fontSize="0.78rem" color="#64748B">
                  File: <span style={{ fontWeight: 600, color: '#334155' }}>{selectedFile.name}</span>
                </Typography>
                <Typography fontSize="0.72rem" color="#94A3B8">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddDlg(false)} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
          <Button variant="contained" onClick={addNote} disabled={saving || (!form.link && !selectedFile)} sx={{ bgcolor: c, borderRadius: '8px', textTransform: 'none', px: 3 }}>
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
function DeptTests({ dept, c, dd, onUpdate }: {
  dept: string; c: string; dd: DeptData | undefined;
  onUpdate: (n: string, d: Partial<DeptData>) => void;
}) {
  const recSystemName = generateSystemName(dept, 'recruitment_test');
  const onbSystemName = generateSystemName(dept, 'onboarding_test');

  const saveRec = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/tests/recruitment`, { name, url });
    if (r.success) onUpdate(dept, { recruitmentTest: { id: 'rec', name, url } });
  };
  const saveOnb = async (name: string, url: string) => {
    const r = await api.put(`/dept-orientation/${dd?.id}/tests/onboarding`, { name, url });
    if (r.success) onUpdate(dept, { onboardingTest: { id: 'onb', name, url } });
  };

  return (
    <Stack spacing={1.5}>
      <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'white', border: `1px solid ${c}20`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '9px', bgcolor: `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AssignmentIcon sx={{ fontSize: 19, color: c }} />
          </Box>
          <Box flex={1}>
            <Typography fontSize="0.9rem" fontWeight={700} color="#1F2937">Recruitment Test</Typography>
            <Typography fontSize="0.73rem" color="#9CA3AF">For candidates applying to {dept}</Typography>
          </Box>
          <Chip label="Candidates" size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: `${c}12`, color: c, fontWeight: 700 }} />
        </Box>
        <LinkDisplay link={dd?.recruitmentTest || null} accentColor={c} systemName={recSystemName} />
        <Box mt={1.2}>
          <LinkEditor
            currentUrl={dd?.recruitmentTest?.url || ''}
            systemName={recSystemName}
            accentColor={c}
            onSave={saveRec}
            uploadPath={`/dept-orientation/${dd?.id}/upload`}
          />
        </Box>
      </Box>

      <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'white', border: '1px solid #10B98120', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '9px', bgcolor: '#10B98112', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QuizIcon sx={{ fontSize: 19, color: '#10B981' }} />
          </Box>
          <Box flex={1}>
            <Typography fontSize="0.9rem" fontWeight={700} color="#1F2937">Dept. Onboarding Test</Typography>
            <Typography fontSize="0.73rem" color="#9CA3AF">For new joiners in {dept}</Typography>
          </Box>
          <Chip label="New Joiners" size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 700 }} />
        </Box>
        <LinkDisplay link={dd?.onboardingTest || null} accentColor="#10B981" systemName={onbSystemName} />
        <Box mt={1.2}>
          <LinkEditor
            currentUrl={dd?.onboardingTest?.url || ''}
            systemName={onbSystemName}
            accentColor="#10B981"
            onSave={saveOnb}
            uploadPath={`/dept-orientation/${dd?.id}/upload`}
          />
        </Box>
      </Box>
    </Stack>
  );
}

// ── Notion-style Department Label Select ──────────────────────────────────────
function NotionDeptSelect({
  departments,
  value,
  onChange,
}: {
  departments: string[];
  value: string;
  onChange: (dept: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const activeStyle = value ? getNotionStyle(value) : { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Trigger — Notion pill */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.55,
          bgcolor: activeStyle.bg, border: `1.5px solid ${activeStyle.border}`,
          borderRadius: '8px', cursor: 'pointer', userSelect: 'none',
          transition: 'all 0.15s',
          '&:hover': { filter: 'brightness(0.96)' },
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: activeStyle.color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: activeStyle.color, lineHeight: 1.3 }}>
          {value || 'Select Department'}
        </Typography>
        <ArrowDownIcon sx={{
          fontSize: 16, color: activeStyle.color, opacity: 0.7,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
        }} />
      </Box>

      {/* Dropdown */}
      <Collapse in={open} timeout={160}>
        <Box sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1200,
          minWidth: 220, maxHeight: 280, overflowY: 'auto',
          bgcolor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          py: 0.6,
        }}>
          {departments.map(d => {
            const s = getNotionStyle(d);
            const isActive = d === value;
            return (
              <Box
                key={d}
                onClick={() => { onChange(d); setOpen(false); }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  px: 1.5, py: 0.9, cursor: 'pointer',
                  bgcolor: isActive ? '#F8FAFC' : 'transparent',
                  '&:hover': { bgcolor: '#F8FAFC' },
                }}
              >
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.7, px: 1, py: 0.25,
                  bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px',
                }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: s.color }}>{d}</Typography>
                </Box>
                {isActive && <CheckIcon sx={{ fontSize: 14, color: '#64748B', ml: 'auto' }} />}
              </Box>
            );
          })}
        </Box>
      </Collapse>

      {/* Backdrop to close */}
      {open && (
        <Box
          onClick={() => setOpen(false)}
          sx={{ position: 'fixed', inset: 0, zIndex: 1199 }}
        />
      )}
    </Box>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DeptOrientationPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [deptDataMap, setDeptDataMap] = useState<Record<string, DeptData>>({});
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState('');
  const [toast, setToast] = useState<{ open: boolean; msg: string; type: 'success' | 'error' }>({
    open: false, msg: '', type: 'success',
  });

  useEffect(() => {
    let isMounted = true;
    Promise.all([api.get<Designation[]>('/designations'), api.get<DeptData[]>('/dept-orientation')])
      .then(([desRes, deptRes]) => {
        if (!isMounted) return;
        if (desRes?.success && Array.isArray(desRes.data)) setDesignations(desRes.data as Designation[]);
        if (deptRes?.success && Array.isArray(deptRes.data)) {
          const deptList = deptRes.data as DeptData[];
          const map: Record<string, DeptData> = {};
          deptList.forEach(d => {
            const name = d?.name?.trim();
            if (!name) return;
            map[name] = { ...d, id: (d as any).id || (d as any)._id?.toString() || '' };
          });

          // Also seed departments from designation data so JD-only depts appear
          if (desRes?.success && Array.isArray(desRes.data)) {
            (desRes.data as Designation[]).forEach(des => {
              const dn = des.department?.trim();
              if (dn && !map[dn]) {
                map[dn] = { id: '', name: dn, onboardingPPT: null, reviewPPTs: [], masterPPT: null, notes: [], recruitmentTest: null, onboardingTest: null };
              }
            });
          }

          setDeptDataMap(map);
          const sorted = Object.keys(map).sort();
          setDepartments(sorted);
          // Don't auto-select first department - let user choose
          // if (sorted.length > 0) setActiveDept(sorted[0]);
        }
      })
      .catch(err => {
        console.error('Failed to load initial data:', err);
        if (isMounted) setToast({ open: true, msg: 'Could not load data', type: 'error' });
      })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const updateDeptData = (deptName: string, partial: Partial<DeptData>) => {
    setDeptDataMap(prev => ({ ...prev, [deptName]: { ...prev[deptName], ...partial } }));
    setToast({ open: true, msg: 'Saved successfully', type: 'success' });
  };

  const deptColor = activeDept ? getDeptColor(activeDept) : '#6366F1';
  const dd = deptDataMap[activeDept];

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main style={{ padding: '24px', paddingTop: '88px' }}>

          {/* Hero Banner */}
          <Box sx={{
            mb: 3, p: 3.5, borderRadius: '20px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 65%, #334155 100%)',
            color: 'white', position: 'relative', overflow: 'hidden',
          }}>
            <Box sx={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ApartmentIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box flex={1}>
                <Typography fontWeight={800} fontSize="1.5rem" lineHeight={1.2}>Department Orientation</Typography>
                <Typography fontSize="0.85rem" sx={{ opacity: 0.6, mt: 0.3 }}>PPTs · JDs · Notes · Tests — organized by department</Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {loading && <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.6)' }} />}
                <Chip label={`${departments.length} Departments`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 700, border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.75rem' }} />
                {isHR && <Chip label="HR · Edit Mode" size="small" sx={{ bgcolor: 'rgba(134,239,172,0.15)', color: '#86EFAC', fontWeight: 700, border: '1px solid rgba(134,239,172,0.3)', fontSize: '0.75rem' }} />}
              </Stack>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>
          ) : (
            <Stack spacing={2}>

              {/* ── Notion-style department selector ── */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 2,
                px: 2.5, py: 1.8, bgcolor: 'white', borderRadius: '14px',
                border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <Typography fontSize="0.82rem" fontWeight={700} color="#6B7280" whiteSpace="nowrap">
                  Department
                </Typography>
                <NotionDeptSelect
                  departments={departments}
                  value={activeDept}
                  onChange={setActiveDept}
                />
              </Box>

              {/* ── 4 sections ── */}
              <SectionCard num={1} label="Presentations" icon={<SlideshowIcon sx={{ fontSize: 21 }} />}>
                <DeptPresentations dept={activeDept} dd={dd} c={deptColor} onUpdate={updateDeptData} />
              </SectionCard>

              <SectionCard num={2} label="JD & Role Documents" icon={<WorkIcon sx={{ fontSize: 21 }} />}>
                <JDRoleDocs dept={activeDept} c={deptColor} designations={designations} />
              </SectionCard>

              <SectionCard num={3} label="Department Notes" icon={<NotesIcon sx={{ fontSize: 21 }} />}>
                <DeptNotes dept={activeDept} c={deptColor} dd={dd} onUpdate={updateDeptData} />
              </SectionCard>

              <SectionCard num={4} label="Department Tests" icon={<QuizIcon sx={{ fontSize: 21 }} />}>
                <DeptTests dept={activeDept} c={deptColor} dd={dd} onUpdate={updateDeptData} />
              </SectionCard>

            </Stack>
          )}
        </main>
      </div>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.type} onClose={() => setToast(t => ({ ...t, open: false }))} sx={{ borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}