import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Avatar, CircularProgress,
  Chip, TextField, InputAdornment, Stack, Button, MenuItem,
  Divider, useTheme, Tooltip, Dialog, DialogTitle, DialogContent,
  IconButton, Tabs, Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  PeopleAltOutlined as PeopleIcon,
  AccountTreeOutlined as DeptIcon,
  WorkOutlineOutlined as RoleIcon,
  SupervisorAccountOutlined as ManagerIcon,
  AlternateEmailOutlined as DesigEmailIcon,
  ManageAccountsOutlined as LevelIcon,
  BadgeOutlined as BadgeIcon,
  FilterListOutlined as FilterIcon,
  ArchiveOutlined as ArchiveIcon,
  ViewListOutlined as ViewListIcon,
  ViewKanbanOutlined as ViewKanbanIcon,
  CalendarMonthOutlined as CalendarIcon,
  DownloadOutlined as DownloadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { hasAnyRole } from '../config/rbac';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EmployeeEntry {
  _id: string;
  full_name: string;
  department: string;
  designation: string;
  official_email: string;
  personal_email: string;
  mobile: string;
  joining_date: string | null;
  employee_category: string;
  management_level: string;
  reporting_head: string;
  exit_status: string;
  is_current: boolean;
  is_exited: boolean;
}

type DateMode = 'all' | 'quarter' | 'year' | 'custom';

// Full onboarding record, fetched on demand when an employee card is
// clicked — the list view only carries the trimmed EmployeeEntry shape.
interface EmployeeFullRecord {
  companyName?: string;
  jobLocation?: string;
  citizenship?: string;
  nationality?: string;
  passportNo?: string;
  passportValidUpto?: string | null;
  passportIssuePlace?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  panCard?: string;
  aadhaarNo?: string;
  uanNo?: string;
  ePassbookLink?: string;
  birthday?: string | null;
  bloodGroup?: string;
  maritalStatus?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  emergencyContactPlace?: string;
  familyFather?: string;
  familyMother?: string;
  familySiblings?: string;
  familySpouse?: string;
  familyChildren?: string;
}

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Avatar helpers
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE: [string, string][] = [
  ['#DBEAFE', '#1D4ED8'], ['#FCE7F3', '#9D174D'], ['#D1FAE5', '#065F46'],
  ['#FEF3C7', '#92400E'], ['#EDE9FE', '#5B21B6'], ['#FFE4E6', '#9F1239'],
  ['#CCFBF1', '#134E4A'], ['#FEF9C3', '#713F12'], ['#E0F2FE', '#0369A1'],
  ['#FDF4FF', '#7E22CE'],
];

const avatarColors = (name: string): [string, string] =>
  AVATAR_PALETTE[(name?.charCodeAt(0) || 65) % AVATAR_PALETTE.length];

const initials = (name?: string) => {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

// ─────────────────────────────────────────────────────────────────────────────
// Date range helpers
// ─────────────────────────────────────────────────────────────────────────────

const getQuarterRange = (): [Date, Date] => {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  return [
    new Date(now.getFullYear(), q * 3, 1),
    new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59),
  ];
};

const getYearRange = (): [Date, Date] => {
  const now = new Date();
  return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31, 23, 59, 59)];
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV export helper
// ─────────────────────────────────────────────────────────────────────────────

const exportToCSV = (employees: EmployeeEntry[], filename = 'employees.csv') => {
  const headers = [
    'Full Name', 'Department', 'Designation', 'Management Level',
    'Reporting Head', 'Official Email', 'Personal Email', 'Mobile',
    'Joining Date', 'Employee Category', 'Exit Status',
  ];

  const escape = (val: string | null | undefined) => {
    const s = (val ?? '').toString().replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = employees.map(e => [
    escape(e.full_name),
    escape(e.department),
    escape(e.designation),
    escape(e.management_level),
    escape(e.reporting_head),
    escape(e.official_email),
    escape(e.personal_email),
    escape(e.mobile),
    escape(e.joining_date
      ? new Date(e.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : ''),
    escape(e.employee_category),
    escape(e.exit_status),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// Chip helpers
// ─────────────────────────────────────────────────────────────────────────────

type Palette = { bg: string; text: string; border: string };
type Preset  = { light: Palette; dark: Palette };

const P: Record<string, Preset> = {
  blue:  { light: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }, dark: { bg: '#1E3A8A', text: '#93C5FD', border: '#1E40AF' } },
  green: { light: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }, dark: { bg: '#14532D', text: '#86EFAC', border: '#166534' } },
  teal:  { light: { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }, dark: { bg: '#134E4A', text: '#5EEAD4', border: '#0F766E' } },
  rose:  { light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' }, dark: { bg: '#4C0519', text: '#FDA4AF', border: '#9F1239' } },
};

const chipSx = (preset: Preset, isLight: boolean) => ({
  bgcolor:      isLight ? preset.light.bg     : preset.dark.bg,
  color:        isLight ? preset.light.text   : preset.dark.text,
  border:       `1px solid ${isLight ? preset.light.border : preset.dark.border}`,
  fontSize:     '0.625rem', fontWeight: 500, height: '22px', borderRadius: '5px', maxWidth: '190px',
  '& .MuiChip-icon':  { color: isLight ? preset.light.text : preset.dark.text, fontSize: '11px', ml: '5px' },
  '& .MuiChip-label': { px: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ContactRow
// ─────────────────────────────────────────────────────────────────────────────

const ContactRow: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
    <Box sx={{ mt: '2px', flexShrink: 0 }}>{icon}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1.2, mb: '1px' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.73rem', color: 'text.primary', wordBreak: 'break-all', lineHeight: 1.3 }}>
        {value?.trim() || 'Not provided'}
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Employee detail dialog — Public Info / Personal Info / Client View tabs
// ─────────────────────────────────────────────────────────────────────────────

const formatDateOnly = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const InfoField: React.FC<{ label: string; value?: string; link?: boolean }> = ({ label, value, link }) => {
  const trimmed = value?.trim();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{
        fontSize: '0.65rem', color: 'text.disabled', textTransform: 'uppercase',
        letterSpacing: 0.4, lineHeight: 1.2, mb: '3px',
      }}>
        {label}
      </Typography>
      {link && trimmed ? (
        <Typography component="a" href={trimmed} target="_blank" rel="noreferrer" sx={{
          fontSize: '0.8rem', color: 'primary.main', wordBreak: 'break-all', textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}>
          {trimmed}
        </Typography>
      ) : (
        <Typography sx={{
          fontSize: '0.8rem', wordBreak: 'break-word',
          color: trimmed ? 'text.primary' : 'text.disabled',
        }}>
          {trimmed || 'Not provided'}
        </Typography>
      )}
    </Box>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" color="text.secondary" fontWeight={600}
    sx={{ fontSize: '0.68rem', letterSpacing: 1 }}>
    {children}
  </Typography>
);

const TabPanel: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) =>
  active ? <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>{children}</Box> : null;

const EmployeeDetailDialog: React.FC<{
  open: boolean;
  employee: EmployeeEntry | null;
  onClose: () => void;
}> = ({ open, employee, onClose }) => {
  const [tab, setTab] = useState(0);
  const [full, setFull] = useState<EmployeeFullRecord | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin/Management/HR only — everyone else never sees these tabs exist.
  const canViewPersonal   = hasAnyRole(['Admin', 'Management', 'HR']);
  const canViewClientView = hasAnyRole(['Admin', 'Management', 'HR']);

  useEffect(() => {
    if (!open || !employee) { setFull(null); setTab(0); return; }
    setTab(0);
    setLoading(true);
    fetch(`${API_BASE}/onboarding/${employee._id}`)
      .then(res => res.json())
      .then(json => setFull(json?.data || null))
      .catch(() => setFull(null))
      .finally(() => setLoading(false));
  }, [open, employee]);

  if (!employee) return null;
  const [bg, fg] = avatarColors(employee.full_name || 'A');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
        <Avatar sx={{ width: 44, height: 44, bgcolor: bg, color: fg, fontWeight: 700 }}>
          {initials(employee.full_name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} noWrap>{employee.full_name || 'Unnamed Employee'}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {[employee.designation, employee.department].filter(Boolean).join(' · ') || '—'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <Divider />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.8rem', fontWeight: 600 } }}>
        <Tab label="Public Info" />
        {canViewPersonal   && <Tab label="Personal Info" />}
        {canViewClientView && <Tab label="Client View" />}
      </Tabs>

      <DialogContent sx={{ pb: 3, flex: 1, overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={26} />
          </Box>
        )}

        {!loading && (
          <>
            <TabPanel active={tab === 0}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <InfoField label="Company Name" value={full?.companyName} />
                <InfoField label="Job Location" value={full?.jobLocation} />
                <InfoField label="Phone No" value={employee.mobile} />
                <InfoField label="Official Email ID" value={employee.official_email} />
                <InfoField label="Department" value={employee.department} />
                <InfoField label="Designation" value={employee.designation} />
                <InfoField label="Reporting Manager" value={employee.reporting_head} />
              </Box>
            </TabPanel>

            {canViewPersonal && (
              <TabPanel active={tab === 1}>
                <SectionLabel>Citizenship Details</SectionLabel>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <InfoField label="Citizenship" value={full?.citizenship} />
                  <InfoField label="Nationality" value={full?.nationality} />
                  <InfoField label="Passport No" value={full?.passportNo} />
                  <InfoField label="Valid Upto" value={formatDateOnly(full?.passportValidUpto)} />
                  <InfoField label="Issue Place" value={full?.passportIssuePlace} />
                </Box>

                <Divider />

                <SectionLabel>Bank Details</SectionLabel>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <InfoField label="Bank Name" value={full?.bankName} />
                  <InfoField label="Account No" value={full?.bankAccountNo} />
                  <InfoField label="IFSC Code" value={full?.ifscCode} />
                  <InfoField label="PAN Card" value={full?.panCard} />
                  <InfoField label="Aadhaar Card No" value={full?.aadhaarNo} />
                  <InfoField label="UAN No" value={full?.uanNo} />
                  <InfoField label="E-Passbook" value={full?.ePassbookLink} link />
                </Box>

                <Divider />

                <SectionLabel>Contact Details</SectionLabel>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <InfoField label="Name" value={employee.full_name} />
                  <InfoField label="Phone" value={employee.mobile} />
                  <InfoField label="Personal Email ID" value={employee.personal_email} />
                  <InfoField label="Birthday" value={formatDateOnly(full?.birthday)} />
                  <InfoField label="Blood Group" value={full?.bloodGroup} />
                  <InfoField label="Marital Status" value={full?.maritalStatus} />
                </Box>

                <Divider />

                <SectionLabel>Emergency Contact</SectionLabel>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
                  <InfoField label="Name" value={full?.emergencyContactName} />
                  <InfoField label="Relation" value={full?.emergencyContactRelation} />
                  <InfoField label="Phone" value={full?.emergencyContactPhone} />
                  <InfoField label="Place" value={full?.emergencyContactPlace} />
                </Box>

                <Divider />

                <SectionLabel>Family Details</SectionLabel>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <InfoField label="Father" value={full?.familyFather} />
                  <InfoField label="Mother" value={full?.familyMother} />
                  <InfoField label="Siblings" value={full?.familySiblings} />
                  <InfoField label="Spouse" value={full?.familySpouse} />
                  <InfoField label="Children" value={full?.familyChildren} />
                </Box>
              </TabPanel>
            )}

            {canViewClientView && (
              <TabPanel active={tab === 2}>
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <Typography color="text.secondary" fontWeight={600} mb={0.5}>Coming soon</Typography>
                  <Typography variant="body2" color="text.disabled">
                    Client view details haven't been defined yet.
                  </Typography>
                </Box>
              </TabPanel>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const EmployeesPage: React.FC = () => {
  const theme   = useTheme();
  const isLight = theme.palette.mode === 'light';
  const navigate = useNavigate();

  const [entries,  setEntries]  = useState<EmployeeEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [exporting, setExporting] = useState(false);

  const [search,      setSearch]      = useState('');
  const [filterDept,  setFilterDept]  = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [view,        setView]        = useState<'list' | 'kanban'>('list');

  const [dateMode,    setDateMode]    = useState<DateMode>('all');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  const [detailEmployee, setDetailEmployee] = useState<EmployeeEntry | null>(null);
  const openDetail  = (emp: EmployeeEntry) => setDetailEmployee(emp);
  const closeDetail = () => setDetailEmployee(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const res  = await fetch(`${API_BASE}/onboarding/employee-master`);
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        const data = await res.json();
        const all: EmployeeEntry[] = data?.data?.employees ?? [];
        setEntries(all.filter(e => e.is_current));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load employees');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const departments = useMemo(() =>
    [...new Set(entries.map(e => e.department).filter(Boolean))].sort(), [entries]);

  const designations = useMemo(() =>
    [...new Set(entries.filter(e => !filterDept || e.department === filterDept)
      .map(e => e.designation).filter(Boolean))].sort(),
    [entries, filterDept]);

  const activeDateRange = useMemo((): [Date | null, Date | null] => {
    if (dateMode === 'quarter') return getQuarterRange();
    if (dateMode === 'year')    return getYearRange();
    if (dateMode === 'custom')  return [
      customFrom ? new Date(customFrom) : null,
      customTo   ? new Date(`${customTo}T23:59:59`) : null,
    ];
    return [null, null];
  }, [dateMode, customFrom, customTo]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const [rangeFrom, rangeTo] = activeDateRange;
    return entries
      .filter(e => {
        const matchSearch = !q || [e.full_name, e.designation, e.department, e.official_email, e.personal_email, e.reporting_head].some(v => v?.toLowerCase().includes(q));
        const matchDept   = !filterDept  || e.department  === filterDept;
        const matchDesig  = !filterDesig || e.designation === filterDesig;
        let matchDate = true;
        if (rangeFrom || rangeTo) {
          if (!e.joining_date) { matchDate = false; }
          else {
            const joined = new Date(e.joining_date);
            if (rangeFrom && joined < rangeFrom) matchDate = false;
            if (rangeTo   && joined > rangeTo)   matchDate = false;
          }
        }
        return matchSearch && matchDept && matchDesig && matchDate;
      })
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [entries, search, filterDept, filterDesig, activeDateRange]);

  const byDepartment = useMemo(() => {
    const groups: Record<string, EmployeeEntry[]> = {};
    for (const e of filtered) {
      const dept = e.department || 'Unassigned';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(e);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const hasFilters = !!(search || filterDept || filterDesig || dateMode !== 'all');
  const clearAll   = () => { setSearch(''); setFilterDept(''); setFilterDesig(''); setDateMode('all'); setCustomFrom(''); setCustomTo(''); };

  // ── Export handler ──────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    setExporting(true);
    try {
      const now        = new Date();
      const dateStamp  = now.toISOString().slice(0, 10);
      const filterDesc = [
        filterDept  ? filterDept  : '',
        filterDesig ? filterDesig : '',
        dateMode !== 'all' ? dateMode : '',
      ].filter(Boolean).join('_') || 'all';
      exportToCSV(filtered, `employees_${filterDesc}_${dateStamp}.csv`);
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  }, [filtered, filterDept, filterDesig, dateMode]);

  // ── Shared styles ─────────────────────────────────────────────────────────
  const border   = isLight ? '#E2E8F0' : 'rgba(255,255,255,0.09)';
  const filterSx = {
    flex: '0 1 155px', minWidth: 130,
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px', fontSize: '0.78rem',
      backgroundColor: theme.palette.background.paper,
      '& fieldset': { borderColor: border },
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
    },
    '& .MuiInputBase-input': { py: '6.5px' },
    '& .MuiInputLabel-root': { fontSize: '0.76rem', top: '-3px' },
    '& .MuiInputLabel-shrink': { top: '0px' },
  };

  const dateModeOptions: { key: DateMode; label: string }[] = [
    { key: 'all',     label: 'All Time' },
    { key: 'quarter', label: 'This Quarter' },
    { key: 'year',    label: 'This Year' },
    { key: 'custom',  label: 'Custom Range' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: theme.palette.background.default }}>
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main style={{ padding: '24px', paddingTop: '76px' }}>

          {/* ── Page header ── */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            mb: 2.5, pb: 2,
            borderBottom: `1px solid ${isLight ? '#E9EEF5' : 'rgba(255,255,255,0.08)'}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark ?? theme.palette.primary.main})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
              }}>
                <PeopleIcon sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700} color="text.primary" lineHeight={1.2}>
                  Employees
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {loading ? '—' : `${entries.length} current members`}
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              {/* ── Export button ── */}
              <Tooltip title={`Export ${filtered.length} employee${filtered.length !== 1 ? 's' : ''} as CSV (opens in Excel / Google Sheets)`} arrow>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={exporting
                      ? <CircularProgress size={14} color="inherit" />
                      : <DownloadIcon sx={{ fontSize: 16 }} />}
                    onClick={handleExport}
                    disabled={exporting || filtered.length === 0}
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                      borderRadius: '8px',
                      borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)',
                      color: 'text.primary',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: `${theme.palette.primary.main}08`,
                      },
                    }}
                  >
                    {exporting ? 'Exporting…' : `Export${hasFilters ? ` (${filtered.length})` : ''}`}
                  </Button>
                </span>
              </Tooltip>

              {/* ── View toggle ── */}
              <Box sx={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${border}` }}>
                {(['list', 'kanban'] as const).map(v => (
                  <Button
                    key={v}
                    onClick={() => setView(v)}
                    startIcon={v === 'list' ? <ViewListIcon sx={{ fontSize: 16 }} /> : <ViewKanbanIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, borderRadius: 0,
                      px: 1.5, py: 0.6,
                      bgcolor: view === v ? theme.palette.primary.main : 'transparent',
                      color: view === v ? '#fff' : 'text.secondary',
                      '&:hover': { bgcolor: view === v ? theme.palette.primary.dark : 'action.hover' },
                    }}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Button>
                ))}
              </Box>

              <Button
                startIcon={<ArchiveIcon />}
                onClick={() => navigate('/employees/archive')}
                size="small"
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', color: 'text.secondary' }}
              >
                View Archive
              </Button>
            </Stack>
          </Box>

          {/* ── Filters ── */}
          <Box sx={{
            mb: 2.5, p: 1.5, borderRadius: '12px',
            border: `1px solid ${isLight ? '#E9EEF5' : 'rgba(255,255,255,0.08)'}`,
            backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
          }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                placeholder="Search name, designation, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: '1 1 220px', minWidth: 180,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px', fontSize: '0.78rem',
                    backgroundColor: theme.palette.background.paper,
                    '& fieldset': { borderColor: border },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                  },
                  '& .MuiInputBase-input': { py: '6.5px' },
                }}
              />

              <TextField select label="Department" size="small" value={filterDept}
                onChange={e => { setFilterDept(e.target.value); setFilterDesig(''); }} sx={filterSx}>
                <MenuItem value="" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>All Departments</MenuItem>
                {departments.map(d => <MenuItem key={d} value={d} sx={{ fontSize: '0.78rem' }}>{d}</MenuItem>)}
              </TextField>

              <TextField select label="Designation" size="small" value={filterDesig}
                onChange={e => setFilterDesig(e.target.value)} sx={filterSx}>
                <MenuItem value="" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>All Designations</MenuItem>
                {designations.map(d => <MenuItem key={d} value={d} sx={{ fontSize: '0.78rem' }}>{d}</MenuItem>)}
              </TextField>

              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ ml: { sm: 'auto' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FilterIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.71rem', whiteSpace: 'nowrap' }}>
                    {filtered.length} / {entries.length}
                  </Typography>
                </Box>
                {hasFilters && (
                  <Button variant="outlined" size="small" onClick={clearAll} sx={{
                    fontSize: '0.71rem', px: 1.2, py: '3px', minWidth: 'unset',
                    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)',
                    color: 'text.secondary', borderRadius: '6px',
                    '&:hover': { borderColor: 'error.main', color: 'error.main', bgcolor: 'transparent' },
                  }}>
                    Clear
                  </Button>
                )}
              </Stack>
            </Stack>

            {/* ── Joining-date filter row ── */}
            <Divider sx={{ my: 1.5, borderColor: isLight ? '#E9EEF5' : 'rgba(255,255,255,0.08)' }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
                <CalendarIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ fontSize: '0.71rem' }}>
                  Joining Date:
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${border}` }}>
                {dateModeOptions.map(({ key, label }) => (
                  <Button key={key} onClick={() => setDateMode(key)} sx={{
                    textTransform: 'none', fontSize: '0.74rem', fontWeight: 600, borderRadius: 0,
                    px: 1.4, py: 0.5,
                    bgcolor: dateMode === key ? theme.palette.primary.main : 'transparent',
                    color: dateMode === key ? '#fff' : 'text.secondary',
                    '&:hover': { bgcolor: dateMode === key ? theme.palette.primary.dark : 'action.hover' },
                  }}>
                    {label}
                  </Button>
                ))}
              </Box>

              {dateMode === 'custom' && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField type="date" size="small" label="From" value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ ...filterSx, flex: '0 1 150px' }} />
                  <Typography variant="caption" color="text.disabled">to</Typography>
                  <TextField type="date" size="small" label="To" value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ ...filterSx, flex: '0 1 150px' }} />
                </Stack>
              )}

              {dateMode === 'quarter' && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.71rem' }}>
                  {(() => {
                    const [from, to] = getQuarterRange();
                    return `${from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
                  })()}
                </Typography>
              )}
              {dateMode === 'year' && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.71rem' }}>
                  {new Date().getFullYear()}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* ── Loading ── */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography color="error.main" fontWeight={600} mb={0.5}>{error}</Typography>
              <Typography variant="caption" color="text.disabled">Check the console for details</Typography>
            </Box>
          )}

          {/* ── List view ── */}
          {!loading && !error && view === 'list' && filtered.length > 0 && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' },
              gap: 2,
            }}>
              {filtered.map(emp => {
                const [bg, fg] = avatarColors(emp.full_name || 'A');
                return (
                  <Card key={emp._id} onClick={() => openDetail(emp)} sx={{
                    height: '100%', borderRadius: '14px', cursor: 'pointer',
                    backgroundColor: theme.palette.background.paper,
                    border: `1.5px solid ${border}`,
                    boxShadow: isLight ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
                    transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: `0 6px 24px ${theme.palette.primary.main}20`,
                      transform: 'translateY(-2px)',
                    },
                  }}>
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
                        <Avatar sx={{
                          width: 48, height: 48, flexShrink: 0,
                          bgcolor: bg, color: fg, fontSize: '1rem', fontWeight: 700,
                          border: `2px solid ${border}`,
                        }}>
                          {initials(emp.full_name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography fontWeight={700} color="text.primary" noWrap
                            sx={{ fontSize: '0.9rem', lineHeight: 1.3, mb: 0.3 }}>
                            {emp.full_name || 'Unnamed Employee'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <BadgeIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                              {emp.joining_date
                                ? new Date(emp.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : 'Joining date unknown'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Stack direction="row" flexWrap="wrap" sx={{ gap: '5px', mb: 1.75 }}>
                        {emp.designation && (
                          <Tooltip title={`Designation: ${emp.designation}`} arrow>
                            <Chip icon={<RoleIcon />} label={emp.designation} size="small" sx={chipSx(P.blue, isLight)} />
                          </Tooltip>
                        )}
                        {emp.department && (
                          <Tooltip title={`Department: ${emp.department}`} arrow>
                            <Chip icon={<DeptIcon />} label={emp.department} size="small" sx={chipSx(P.green, isLight)} />
                          </Tooltip>
                        )}
                        {emp.management_level && (
                          <Tooltip title={`Management Level: ${emp.management_level}`} arrow>
                            <Chip icon={<LevelIcon />} label={emp.management_level} size="small" sx={chipSx(P.teal, isLight)} />
                          </Tooltip>
                        )}
                        {emp.reporting_head && (
                          <Tooltip title={`Reports to: ${emp.reporting_head}`} arrow>
                            <Chip icon={<ManagerIcon />} label={emp.reporting_head} size="small" sx={chipSx(P.rose, isLight)} />
                          </Tooltip>
                        )}
                      </Stack>

                      <Divider sx={{ mb: 1.75, borderColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)' }} />

                      <Stack spacing={1.1}>
                        <ContactRow
                          icon={<DesigEmailIcon sx={{ fontSize: 13, color: theme.palette.primary.main }} />}
                          label="Official email" value={emp.official_email} />
                        <ContactRow
                          icon={<EmailIcon sx={{ fontSize: 13, color: theme.palette.success.main }} />}
                          label="Personal email" value={emp.personal_email} />
                        <ContactRow
                          icon={<PhoneIcon sx={{ fontSize: 13, color: theme.palette.warning.main }} />}
                          label="Phone" value={emp.mobile} />
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* ── Kanban view ── */}
          {!loading && !error && view === 'kanban' && filtered.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
              {byDepartment.map(([dept, emps]) => (
                <Box key={dept} sx={{
                  flex: '0 0 280px', minWidth: 280,
                  bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
                  borderRadius: '12px', border: `1px solid ${border}`, p: 1.5,
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
                    <Typography fontWeight={700} fontSize="0.82rem" color="text.primary" noWrap>{dept}</Typography>
                    <Chip label={emps.length} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: theme.palette.primary.main, color: '#fff' }} />
                  </Box>
                  <Stack spacing={1}>
                    {emps.map(emp => {
                      const [bg, fg] = avatarColors(emp.full_name || 'A');
                      return (
                        <Card key={emp._id} onClick={() => openDetail(emp)} sx={{
                          borderRadius: '10px', border: `1px solid ${border}`, cursor: 'pointer',
                          boxShadow: 'none', bgcolor: theme.palette.background.paper,
                          '&:hover': { borderColor: theme.palette.primary.main },
                        }}>
                          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                              <Avatar sx={{ width: 30, height: 30, bgcolor: bg, color: fg, fontSize: '0.7rem', fontWeight: 700 }}>
                                {initials(emp.full_name)}
                              </Avatar>
                              <Typography fontWeight={600} fontSize="0.78rem" color="text.primary" noWrap sx={{ flex: 1 }}>
                                {emp.full_name || 'Unnamed'}
                              </Typography>
                            </Box>
                            {emp.designation && (
                              <Chip icon={<RoleIcon />} label={emp.designation} size="small" sx={chipSx(P.blue, isLight)} />
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </Box>
          )}

          {/* ── Empty state ── */}
          {!loading && !error && filtered.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 14, textAlign: 'center' }}>
              <Box sx={{
                width: 72, height: 72, borderRadius: '50%', mb: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                border: `2px dashed ${isLight ? '#CBD5E1' : 'rgba(255,255,255,0.15)'}`,
              }}>
                <PersonIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600} color="text.secondary" mb={0.5}>
                {entries.length === 0 ? 'No current employees found' : 'No results match your filters'}
              </Typography>
              <Typography variant="body2" color="text.disabled">
                {entries.length === 0
                  ? 'Check the browser console — API response shape may be unexpected'
                  : 'Try adjusting your search or filter criteria'}
              </Typography>
              {hasFilters && (
                <Button variant="outlined" size="small" onClick={clearAll}
                  sx={{ mt: 2, borderRadius: '8px', fontSize: '0.78rem' }}>
                  Clear all filters
                </Button>
              )}
            </Box>
          )}

        </main>
      </div>

      <EmployeeDetailDialog open={!!detailEmployee} employee={detailEmployee} onClose={closeDetail} />
    </div>
  );
};
export default EmployeesPage