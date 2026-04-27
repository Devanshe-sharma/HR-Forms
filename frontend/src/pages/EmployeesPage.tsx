import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Avatar, CircularProgress,
  Chip, TextField, InputAdornment, Stack, Button, MenuItem,
  Divider, useTheme, Tooltip,
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
  SubdirectoryArrowRightOutlined as ParentDeptIcon,
  AlternateEmailOutlined as DesigEmailIcon,
  ManageAccountsOutlined as LevelIcon,
  BadgeOutlined as BadgeIcon,
  FilterListOutlined as FilterIcon,
} from '@mui/icons-material';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrors role_master Mongoose schema (snake_case)
// ─────────────────────────────────────────────────────────────────────────────

interface RoleEntry {
  _id:                string;
  dept_id:            number | string;
  department:         string;
  parent_department:  string;
  department_type:    string;
  department_head:    string;
  desig_id:           number | string;
  designation:        string;
  emp_id:             string;
  emp_name:           string;
  desig_email_id:     string;
  jd_link:            string;
  management_level:   string;
  reporting_manager:  string;
  personal_email?:    string;
  mobile?:            string;
}

const API_BASE = process.env.API_BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Avatar helpers
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE: [string, string][] = [
  ['#DBEAFE', '#1D4ED8'],
  ['#FCE7F3', '#9D174D'],
  ['#D1FAE5', '#065F46'],
  ['#FEF3C7', '#92400E'],
  ['#EDE9FE', '#5B21B6'],
  ['#FFE4E6', '#9F1239'],
  ['#CCFBF1', '#134E4A'],
  ['#FEF9C3', '#713F12'],
  ['#E0F2FE', '#0369A1'],
  ['#FDF4FF', '#7E22CE'],
];

const avatarColors = (name: string): [string, string] =>
  AVATAR_PALETTE[(name?.charCodeAt(0) || 65) % AVATAR_PALETTE.length];

const initials = (name?: string) => {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

// ─────────────────────────────────────────────────────────────────────────────
// Chip helpers
// ─────────────────────────────────────────────────────────────────────────────

type Palette = { bg: string; text: string; border: string };
type Preset  = { light: Palette; dark: Palette };

const P: Record<string, Preset> = {
  blue:   { light: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }, dark: { bg: '#1E3A8A', text: '#93C5FD', border: '#1E40AF' } },
  green:  { light: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }, dark: { bg: '#14532D', text: '#86EFAC', border: '#166534' } },
  purple: { light: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }, dark: { bg: '#3B0764', text: '#C4B5FD', border: '#5B21B6' } },
  rose:   { light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' }, dark: { bg: '#4C0519', text: '#FDA4AF', border: '#9F1239' } },
  teal:   { light: { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }, dark: { bg: '#134E4A', text: '#5EEAD4', border: '#0F766E' } },
};

const chipSx = (preset: Preset, isLight: boolean) => ({
  bgcolor:      isLight ? preset.light.bg     : preset.dark.bg,
  color:        isLight ? preset.light.text   : preset.dark.text,
  border:       `1px solid ${isLight ? preset.light.border : preset.dark.border}`,
  fontSize:     '0.625rem',
  fontWeight:   500,
  height:       '22px',
  borderRadius: '5px',
  maxWidth:     '190px',
  '& .MuiChip-icon':  { color: isLight ? preset.light.text : preset.dark.text, fontSize: '11px', ml: '5px' },
  '& .MuiChip-label': { px: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ContactRow sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface ContactRowProps {
  icon:   React.ReactNode;
  label:  string;
  value?: string;
}

const ContactRow: React.FC<ContactRowProps> = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
    <Box sx={{ mt: '2px', flexShrink: 0 }}>{icon}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1.2, mb: '1px' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.73rem', color: 'text.primary', wordBreak: 'break-all', lineHeight: 1.3 }}>
        {value?.trim() || 'Not provided'}
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract the rows array from any response shape the controller sends
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractRows = (data: any): Record<string, any>[] => {
  // Plain array
  if (Array.isArray(data)) return data;

  // { success, data: [...] }   ← original expectation
  if (data?.success === true && Array.isArray(data.data))   return data.data;

  // { data: [...] }            ← success flag missing
  if (Array.isArray(data?.data))    return data.data;

  // { roles: [...] }
  if (Array.isArray(data?.roles))   return data.roles;

  // { employees: [...] }
  if (Array.isArray(data?.employees)) return data.employees;

  // { result: [...] }
  if (Array.isArray(data?.result))  return data.result;

  // Give up
  console.warn('[EmployeesPage] Unexpected API shape — could not extract rows:', data);
  return [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const EmployeesPage: React.FC = () => {
  const theme   = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [entries, setEntries] = useState<RoleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [search,           setSearch]           = useState('');
  const [filterParentDept, setFilterParentDept] = useState('');
  const [filterDept,       setFilterDept]       = useState('');
  const [filterDesig,      setFilterDesig]      = useState('');

  // ── Fetch all role_master rows ────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token') || '';
        const res   = await fetch(`${API_BASE}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

        const data = await res.json();

        // ── DEBUG: remove once confirmed working ──────────────────────────
        console.log('[EmployeesPage] raw API response:', data);
        // ─────────────────────────────────────────────────────────────────

        const rows = extractRows(data);

        // ── Field resolver: tries snake_case first, then every known variant ──
        // MongoDB documents may have been inserted with PascalCase / mixed-case
        // field names that don't match the Mongoose schema definitions.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = (row: any, ...keys: string[]): any => {
          for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
          return undefined;
        };

        const employees = rows.map((r): RoleEntry => ({
          _id:               String(f(r, '_id') ?? ''),
          dept_id:           f(r, 'dept_id',           'Dept_Id',           'DeptId')           ?? '',
          department:        f(r, 'department',         'Department')                            ?? '',
          parent_department: f(r, 'parent_department',  'Parent_Department', 'Parent Department','ParentDepartment') ?? '',
          department_type:   f(r, 'department_type',    'Department_Type',   'Department Type',  'DepartmentType')  ?? '',
          department_head:   f(r, 'department_head',    'Department_Head',   'Department Head',  'DepartmentHead')  ?? '',
          desig_id:          f(r, 'desig_id',           'Desig_id',          'Desig_Id',         'DesigId')         ?? '',
          designation:       f(r, 'designation',        'Designation')                           ?? '',
          // emp_id stored as number (79) or string ("79") — normalise
          emp_id:            String(f(r, 'emp_id', 'Emp_id', 'Emp_Id', 'EmpId') ?? '').trim(),
          emp_name:          f(r, 'emp_name',           'Emp_name',          'Emp_Name',         'EmpName')         ?? '',
          desig_email_id:    f(r, 'desig_email_id',     'desig Email Id',    'Desig_Email_Id',   'DesigEmailId',    'desigEmailId') ?? '',
          jd_link:           f(r, 'jd_link',            'JD_Link',           'JD Link',          'JdLink')          ?? '',
          management_level:  f(r, 'management_level',   'Management_Level',  'Management Level', 'ManagementLevel') ?? '',
          reporting_manager: f(r, 'reporting_manager',  'Reporting_Manager', 'Reporting Manager','ReportingManager') ?? '',
          personal_email:    f(r, 'personal_email',     'Personal_Email',    'Personal Email',   'PersonalEmail')   ?? '',
          mobile:            f(r, 'mobile',             'Mobile',            'Phone',            'phone')           ?? '',
        }));

        console.log(`[EmployeesPage] total rows: ${rows.length}, with emp_id: ${employees.filter(e => e.emp_id).length}`);

        setEntries(employees);          // ← show ALL rows, filter in UI if needed
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load employees';
        console.error('[EmployeesPage] fetch error:', err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Derived filter options ─────────────────────────────────────────────────

  const parentDepartments = useMemo(() =>
    [...new Set(entries.map(e => e.parent_department).filter(Boolean))].sort(),
    [entries]
  );

  // When a parent dept is selected, scope dept options to that parent
  const departments = useMemo(() =>
    [...new Set(
      entries
        .filter(e => !filterParentDept || e.parent_department === filterParentDept)
        .map(e => e.department)
        .filter(Boolean)
    )].sort(),
    [entries, filterParentDept]
  );

  // When a dept is selected, scope designation options to that dept
  const designations = useMemo(() =>
    [...new Set(
      entries
        .filter(e => (!filterParentDept || e.parent_department === filterParentDept)
                  && (!filterDept       || e.department        === filterDept))
        .map(e => e.designation)
        .filter(Boolean)
    )].sort(),
    [entries, filterParentDept, filterDept]
  );

  // ── Filtered + sorted list ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entries
      .filter(e => {
        const matchSearch = !q || [
          e.emp_name, e.emp_id, e.designation,
          e.department, e.parent_department, e.desig_email_id, e.reporting_manager,
        ].some(v => v?.toLowerCase().includes(q));
        const matchParent = !filterParentDept || e.parent_department === filterParentDept;
        const matchDept   = !filterDept       || e.department        === filterDept;
        const matchDesig  = !filterDesig      || e.designation       === filterDesig;
        return matchSearch && matchParent && matchDept && matchDesig;
      })
      .sort((a, b) => (a.emp_name || '').localeCompare(b.emp_name || ''));
  }, [entries, search, filterParentDept, filterDept, filterDesig]);

  const hasFilters = !!(search || filterParentDept || filterDept || filterDesig);
  const clearAll   = () => {
    setSearch(''); setFilterParentDept(''); setFilterDept(''); setFilterDesig('');
  };

  // ── Shared styles ──────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: theme.palette.background.default }}>
      <Sidebar />
      <div className="lg:pl-64">
        <Navbar />
        <main style={{ padding: '24px', paddingTop: '76px' }}>

          {/* ── Page header ── */}
          <Box sx={{
            display: 'flex', alignItems: 'center',
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
                  {loading ? '—' : `${entries.length} members`}
                </Typography>
              </Box>
            </Box>
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
                placeholder="Search name, ID, designation, email…"
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

              <TextField select label="Parent Dept" size="small"
                value={filterParentDept}
                onChange={e => { setFilterParentDept(e.target.value); setFilterDept(''); setFilterDesig(''); }}
                sx={filterSx}
              >
                <MenuItem value="" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>All Parent Depts</MenuItem>
                {parentDepartments.map(p => (
                  <MenuItem key={p} value={p} sx={{ fontSize: '0.78rem' }}>{p}</MenuItem>
                ))}
              </TextField>

              <TextField select label="Department" size="small"
                value={filterDept}
                onChange={e => { setFilterDept(e.target.value); setFilterDesig(''); }}
                sx={filterSx}
              >
                <MenuItem value="" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>All Departments</MenuItem>
                {departments.map(d => (
                  <MenuItem key={d} value={d} sx={{ fontSize: '0.78rem' }}>{d}</MenuItem>
                ))}
              </TextField>

              <TextField select label="Designation" size="small"
                value={filterDesig} onChange={e => setFilterDesig(e.target.value)}
                sx={filterSx}
              >
                <MenuItem value="" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>All Designations</MenuItem>
                {designations.map(d => (
                  <MenuItem key={d} value={d} sx={{ fontSize: '0.78rem' }}>{d}</MenuItem>
                ))}
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

          {/* ── Card grid ── */}
          {!loading && !error && filtered.length > 0 && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' },
              gap: 2,
            }}>
              {filtered.map(emp => {
                const [bg, fg] = avatarColors(emp.emp_name || 'A');

                return (
                  <Card key={emp._id} sx={{
                    height: '100%',
                    borderRadius: '14px',
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

                      {/* ── Avatar + Name + Emp ID ── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
                        <Avatar sx={{
                          width: 48, height: 48, flexShrink: 0,
                          bgcolor: bg, color: fg,
                          fontSize: '1rem', fontWeight: 700,
                          border: `2px solid ${border}`,
                        }}>
                          {initials(emp.emp_name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography fontWeight={700} color="text.primary" noWrap
                            sx={{ fontSize: '0.9rem', lineHeight: 1.3, mb: 0.3 }}>
                            {emp.emp_name || 'Unnamed Employee'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <BadgeIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontFamily: 'monospace' }}>
                              {emp.emp_id || '—'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* ── Chips ── */}
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

                        {emp.parent_department && (
                          <Tooltip title={`Parent Department: ${emp.parent_department}`} arrow>
                            <Chip icon={<ParentDeptIcon />} label={emp.parent_department} size="small" sx={chipSx(P.purple, isLight)} />
                          </Tooltip>
                        )}

                        {emp.management_level && (
                          <Tooltip title={`Management Level: ${emp.management_level}`} arrow>
                            <Chip icon={<LevelIcon />} label={emp.management_level} size="small" sx={chipSx(P.teal, isLight)} />
                          </Tooltip>
                        )}

                        {emp.reporting_manager && (
                          <Tooltip title={`Reports to: ${emp.reporting_manager}`} arrow>
                            <Chip icon={<ManagerIcon />} label={emp.reporting_manager} size="small" sx={chipSx(P.rose, isLight)} />
                          </Tooltip>
                        )}

                      </Stack>

                      <Divider sx={{ mb: 1.75, borderColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)' }} />

                      {/* ── Contact rows ── */}
                      <Stack spacing={1.1}>
                        <ContactRow
                          icon={<DesigEmailIcon sx={{ fontSize: 13, color: theme.palette.primary.main }} />}
                          label="Designation email"
                          value={emp.desig_email_id}
                        />
                        <ContactRow
                          icon={<EmailIcon sx={{ fontSize: 13, color: theme.palette.success.main }} />}
                          label="Personal email"
                          value={emp.personal_email}
                        />
                        <ContactRow
                          icon={<PhoneIcon sx={{ fontSize: 13, color: theme.palette.warning.main }} />}
                          label="Phone"
                          value={emp.mobile}
                        />
                      </Stack>

                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* ── Empty state ── */}
          {!loading && !error && filtered.length === 0 && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', py: 14, textAlign: 'center',
            }}>
              <Box sx={{
                width: 72, height: 72, borderRadius: '50%', mb: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                border: `2px dashed ${isLight ? '#CBD5E1' : 'rgba(255,255,255,0.15)'}`,
              }}>
                <PersonIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600} color="text.secondary" mb={0.5}>
                {entries.length === 0
                  ? 'No employees found in role master'
                  : 'No results match your filters'}
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
    </div>
  );
};

export default EmployeesPage;