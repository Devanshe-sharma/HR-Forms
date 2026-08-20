import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Divider,
  Button, Tab, Tabs, List, ListItem, ListItemText, ListItemIcon,
  Paper, Link, Fade, IconButton, Stack, CircularProgress, LinearProgress,
  Grid, Alert, TextField, MenuItem
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  Badge as BadgeIcon,
  Settings as SettingsIcon,
  Description as DocumentIcon,
  Group as TeamIcon,
  Dashboard as DashboardIcon,
  Logout as ExitIcon,
  Info as InfoIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Computer as AssetIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as EmptyCircleIcon,
  Edit as EditIcon,
  Article as LetterIcon,
  FolderOpen as OnboardingIcon,
  Save as SaveIcon,
  Close as CancelIcon,
  ContactEmergency as EmergencyIcon,
  FamilyRestroom as FamilyIcon,
  AccountBalance as BankIcon,
  Flag as CitizenshipIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface UserProfile {
  _id?: string;
  full_name?: string;
  employee_id?: string;
  official_email?: string;
  personal_email?: string;
  department?: string;
  designation?: string;
  level?: number;
  joining_date?: string;
  photo?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  manager?: string;
  reporting_to?: string;
  reporting_manager?: string;
  employment_type?: string;
  work_location?: string;
  date_of_birth?: string;
  gender?: string;

  // ── Onboarding-sourced enrichment — Onboarding has a record for every
  // joinee, unlike the Employee collection (only created once someone's
  // status flips to "Joined"), so these fill in facts Employee never had.
  reporting_head?: string;
  employee_category?: string;
  joining_status?: string;
  exit_status?: string;
  notice_period?: string;
  confirmation_due_date?: string;
  probation_duration?: string;
  planned_exit_date?: string;
  next_performance_review_date?: string;
  offer_accepted_date?: string;
  planned_joining_date?: string;
  management_level_label?: string;

  // ── Personal info — self-service, editable from the Personal Info tab
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

const PERSONAL_INFO_FIELDS = [
  'citizenship', 'nationality', 'passportNo', 'passportValidUpto', 'passportIssuePlace',
  'bankName', 'bankAccountNo', 'ifscCode', 'panCard', 'aadhaarNo', 'uanNo', 'ePassbookLink',
  'birthday', 'bloodGroup', 'maritalStatus',
  'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone', 'emergencyContactPlace',
  'familyFather', 'familyMother', 'familySiblings', 'familySpouse', 'familyChildren',
] as const;

type PersonalInfoField = typeof PERSONAL_INFO_FIELDS[number];

// Maps a raw Onboarding doc (camelCase Mongoose field names) onto the subset
// of UserProfile it can fill in. Only truthy values are included, so merging
// this in never clobbers a field with blank/undefined.
function mapOnboardingToProfile(doc: any): Partial<UserProfile> {
  const mapped: Partial<UserProfile> = {
    full_name: doc.name || undefined,
    official_email: doc.officialEmail || undefined,
    personal_email: doc.persEmail || undefined,
    mobile: doc.mobile || undefined,
    department: doc.dept || undefined,
    designation: doc.designation || undefined,
    gender: doc.gender || undefined,
    joining_date: doc.joinedDate || undefined,
    employment_type: doc.employeeCategory || undefined,
    reporting_head: doc.reportingHead || undefined,
    employee_category: doc.employeeCategory || undefined,
    joining_status: doc.joiningStatus || undefined,
    exit_status: doc.exitStatus || undefined,
    notice_period: doc.noticePeriod || undefined,
    confirmation_due_date: doc.confirmationDueDate || undefined,
    probation_duration: doc.probationDuration != null ? String(doc.probationDuration) : undefined,
    planned_exit_date: doc.plannedExitDate || undefined,
    next_performance_review_date: doc.nextPerformanceReviewDate || undefined,
    offer_accepted_date: doc.offerAcceptedDate || undefined,
    planned_joining_date: doc.plannedJoiningDate || undefined,
    management_level_label: doc.managementLevel || undefined,
  };
  (Object.keys(mapped) as (keyof UserProfile)[]).forEach(key => {
    if (mapped[key] === undefined) delete mapped[key];
  });
  return mapped;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function SectionCard({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card sx={{ borderRadius: '12px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', mb: 2, overflow: 'visible' }}>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid #F0F2F5' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3F6FE8' }}>
              {icon}
            </Box>
            <Typography variant="subtitle1" fontWeight="700" sx={{ color: '#1A1F36', fontSize: '0.9rem' }}>{title}</Typography>
          </Stack>
          {action}
        </Box>
        <Box sx={{ px: 3, py: 2.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ display: 'flex', py: 1.2, borderBottom: '1px solid #F5F6F8', '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ width: '45%', color: '#6B7280', fontSize: '0.82rem', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ flex: 1, color: '#1A1F36', fontSize: '0.82rem', fontWeight: 600 }}>{value || '—'}</Typography>
    </Box>
  );
}

// ─── Personal Info tab (editable) ──────────────────────────────────────────────

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];

const toDateInputValue = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '');
const formatDateDisplay = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined;

function EditableFieldRow({ label, value, editing, onChange, type = 'text', options }: {
  label: string; value?: string | null; editing: boolean; onChange: (v: string) => void;
  type?: 'text' | 'date' | 'select'; options?: string[];
}) {
  if (!editing) return <FieldRow label={label} value={value} />;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 1.5, borderBottom: '1px solid #F5F6F8', '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ width: '45%', color: '#6B7280', fontSize: '0.82rem', fontWeight: 500, flexShrink: 0 }}>{label}</Typography>
      <TextField
        select={type === 'select'}
        size="small"
        fullWidth
        type={type === 'select' ? undefined : type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 } }}
      >
        {type === 'select' && [
          <MenuItem key="__empty" value="">—</MenuItem>,
          ...(options || []).map(o => <MenuItem key={o} value={o}>{o}</MenuItem>),
        ]}
      </TextField>
    </Box>
  );
}

type FieldSpec = { key: PersonalInfoField; label: string; type?: 'text' | 'date' | 'select'; options?: string[] };

const PERSONAL_DETAILS_FIELDS: FieldSpec[] = [
  { key: 'birthday', label: 'Birthday', type: 'date' },
  { key: 'bloodGroup', label: 'Blood Group', type: 'select', options: BLOOD_GROUPS },
  { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: MARITAL_STATUSES },
];

const CITIZENSHIP_FIELDS: FieldSpec[] = [
  { key: 'citizenship', label: 'Citizenship' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'passportNo', label: 'Passport No' },
  { key: 'passportValidUpto', label: 'Valid Upto', type: 'date' },
  { key: 'passportIssuePlace', label: 'Issue Place' },
];

const EMERGENCY_CONTACT_FIELDS: FieldSpec[] = [
  { key: 'emergencyContactName', label: 'Name' },
  { key: 'emergencyContactRelation', label: 'Relation' },
  { key: 'emergencyContactPhone', label: 'Phone' },
  { key: 'emergencyContactPlace', label: 'Place' },
];

const FAMILY_FIELDS: FieldSpec[] = [
  { key: 'familyFather', label: 'Father' },
  { key: 'familyMother', label: 'Mother' },
  { key: 'familySiblings', label: 'Siblings' },
  { key: 'familySpouse', label: 'Spouse' },
  { key: 'familyChildren', label: 'Children' },
];

const BANK_FIELDS: FieldSpec[] = [
  { key: 'bankName', label: 'Bank Name' },
  { key: 'bankAccountNo', label: 'Account No' },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'aadhaarNo', label: 'Aadhaar Card No' },
  { key: 'uanNo', label: 'UAN No' },
  { key: 'ePassbookLink', label: 'E-Passbook' },
];

// One self-contained editable card — its own Edit/Save/Cancel, scoped to just
// the fields it lists. Lets a tab mix read-only SectionCards (HR-managed
// facts) with editable ones (self-service fields) without one giant edit
// toggle forcing everything on the tab into edit mode at once.
function EditableSectionCard({ title, icon, fields, profile, employeeId, onSaved }: {
  title: string;
  icon: React.ReactNode;
  fields: { key: PersonalInfoField; label: string; type?: 'text' | 'date' | 'select'; options?: string[] }[];
  profile: UserProfile | null;
  employeeId?: string;
  onSaved: (patch: Partial<UserProfile>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<PersonalInfoField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    const initial: Partial<Record<PersonalInfoField, string>> = {};
    fields.forEach(f => {
      const raw = (profile as any)?.[f.key] ?? '';
      initial[f.key] = f.type === 'date' ? toDateInputValue(raw) : raw;
    });
    setDraft(initial);
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(null); };
  const setField = (key: PersonalInfoField, value: string) => setDraft(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!employeeId) { setError('No employee record is linked to this account yet — nothing to save against.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${API_URL}/employees/${employeeId}/personal-info`, draft);
      if (res.data?.success) {
        onSaved(res.data.data || draft);
        setEditing(false);
      } else {
        setError('Could not save changes.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const displayVal = (f: typeof fields[number]): string | undefined => {
    const raw = (profile as any)?.[f.key];
    return f.type === 'date' ? formatDateDisplay(raw) : raw;
  };
  const val = (f: typeof fields[number]) => editing ? (draft[f.key] ?? '') : displayVal(f);

  const action = !editing ? (
    <Button size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />} onClick={startEdit}
      sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: '#3F6FE8' }}>
      Edit
    </Button>
  ) : (
    <Stack direction="row" spacing={0.5}>
      <Button size="small" startIcon={<CancelIcon sx={{ fontSize: 14 }} />} onClick={cancelEdit} disabled={saving}
        sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: '#6B7280' }}>
        Cancel
      </Button>
      <Button
        size="small" variant="contained" onClick={save} disabled={saving}
        startIcon={saving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
        sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', bgcolor: '#3F6FE8', borderRadius: '8px', '&:hover': { bgcolor: '#3357C9' } }}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </Stack>
  );

  return (
    <SectionCard title={title} icon={icon} action={action}>
      {error && <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.76rem' }}>{error}</Alert>}
      {editing && !employeeId && (
        <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.76rem' }}>
          No employee master record is linked to this account yet — this can't be saved until one exists.
        </Alert>
      )}
      {fields.map(f => (
        <EditableFieldRow key={f.key} label={f.label} value={val(f)} editing={editing}
          type={f.type} options={f.options} onChange={v => setField(f.key, v)} />
      ))}
    </SectionCard>
  );
}

function DocumentItem({ title, subtitle, tag, tagColor = '#3F6FE8', href }: {
  title: string; subtitle: string; tag?: string; tagColor?: string; href?: string;
}) {
  return (
    <ListItem component={href ? Link : 'div'} href={href} sx={{
      px: 3, py: 2, textDecoration: 'none', color: 'inherit',
      borderBottom: '1px solid #F0F2F5', cursor: 'pointer',
      '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: '#F8F9FB' },
    }}>
      <ListItemIcon sx={{ minWidth: 44 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DocumentIcon sx={{ color: '#3F6FE8', fontSize: 18 }} />
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography fontWeight="700" fontSize="0.85rem" color="#1A1F36">{title}</Typography>
            {tag && <Chip label={tag} size="small" sx={{ bgcolor: `${tagColor}18`, color: tagColor, fontWeight: 700, fontSize: '0.7rem', height: 20, borderRadius: '4px' }} />}
          </Stack>
        }
        secondary={<Typography variant="caption" color="#6B7280">{subtitle}</Typography>}
      />
      <Button size="small" variant="outlined" sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, borderColor: '#E0E5EC', color: '#475467', '&:hover': { borderColor: '#3F6FE8', color: '#3F6FE8' } }}>
        View
      </Button>
    </ListItem>
  );
}

function AssetItem({ name, type, assignedDate, status }: { name: string; type: string; assignedDate: string; status: 'Active' | 'Returned' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2, px: 3, borderBottom: '1px solid #F0F2F5', '&:last-child': { borderBottom: 'none' } }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AssetIcon sx={{ color: '#3F6FE8', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography fontWeight="700" fontSize="0.85rem" color="#1A1F36">{name}</Typography>
          <Typography fontSize="0.75rem" color="#6B7280">{type} • Assigned {assignedDate}</Typography>
        </Box>
      </Stack>
      <Chip label={status} size="small" sx={{ bgcolor: status === 'Active' ? '#ECFDF5' : '#FEF3C7', color: status === 'Active' ? '#059669' : '#D97706', fontWeight: 700, fontSize: '0.72rem', borderRadius: '6px' }} />
    </Box>
  );
}

function ProfileCompletion({ profile }: { profile: UserProfile | null }) {
  const fields = [
    { label: 'Full Name', filled: !!profile?.full_name },
    { label: 'Official Email', filled: !!profile?.official_email },
    { label: 'Personal Email', filled: !!profile?.personal_email },
    { label: 'Phone', filled: !!(profile?.phone || profile?.mobile) },
    { label: 'Department', filled: !!profile?.department },
    { label: 'Designation', filled: !!profile?.designation },
    { label: 'Date of Birth', filled: !!profile?.date_of_birth },
    { label: 'Gender', filled: !!profile?.gender },
  ];
  const filled = fields.filter(f => f.filled).length;
  const pct = Math.round((filled / fields.length) * 100);
  return (
    <Card sx={{ borderRadius: '12px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', mb: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography fontWeight="700" fontSize="0.9rem" color="#1A1F36">Profile Completion</Typography>
          <Typography fontWeight="800" fontSize="1.1rem" color={pct === 100 ? '#059669' : '#3F6FE8'}>{pct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#E8ECF0', '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: pct === 100 ? '#059669' : '#3F6FE8' } }} />
        <Stack spacing={0.8}>
          {fields.map(f => (
            <Stack key={f.label} direction="row" spacing={1} alignItems="center">
              {f.filled ? <CheckCircleIcon sx={{ fontSize: 15, color: '#059669' }} /> : <EmptyCircleIcon sx={{ fontSize: 15, color: '#D1D5DB' }} />}
              <Typography fontSize="0.78rem" color={f.filled ? '#374151' : '#9CA3AF'} fontWeight={f.filled ? 600 : 400}>{f.label}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Profile() {
  const [tabValue, setTabValue] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const currentRole = user?.role ?? null;

  useEffect(() => { fetchUserProfile(); }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return; // ProtectedRoute guarantees a logged-in user reaches this page

    try {
      setLoading(true);
      setErrorMsg(null);

      // Start from the already-authenticated session fields immediately,
      // then enrich with fuller HR details.
      setUserProfile({
        full_name: user.name,
        official_email: user.email,
      });

      // Employee is the current-employee master, and the only source with an
      // _id the Personal Info edit endpoints can save against. Fetched first
      // so its own official_email — copied verbatim from Onboarding when the
      // Employee row is created, and not necessarily the same as the login
      // email — can be used to reliably find the matching Onboarding record
      // below (the login account's email can legitimately differ, e.g. a
      // personal recovery address or a corrected typo made after joining).
      let employeeRecord: any = null;
      try {
        const res = await axios.get(`${API_URL}/employees`, {
          params: { email: user.email },
        });
        if (res.data?.success && res.data.data?.length > 0) {
          employeeRecord = res.data.data[0];
        }
      } catch {
        // No Employee row for this login email — Onboarding lookup below still runs off the login email.
      }

      // Onboarding has a record for every joinee, so it's the broad
      // enrichment layer — this is what fills in Admin/HR-only accounts that
      // have no matching Employee row at all. Merged in before Employee so
      // Employee still wins wherever both have a value. A missing onboarding
      // record (404) is expected for some accounts, not an error.
      const onboardingLookupEmail = employeeRecord?.official_email || employeeRecord?.personal_email || user.email;
      try {
        const onboardingRes = await axios.get(`${API_URL}/onboarding/by-email`, {
          params: { email: onboardingLookupEmail },
        });
        if (onboardingRes.data?.success && onboardingRes.data.data) {
          setUserProfile((prev) => ({ ...prev, ...mapOnboardingToProfile(onboardingRes.data.data) }));
        }
      } catch {
        // No onboarding record found for this email either — fine, whatever Employee gave us still applies below.
      }

      if (employeeRecord) {
        setUserProfile((prev) => ({ ...prev, ...employeeRecord }));
      }
    } catch (err: any) {
      setErrorMsg('Could not load full profile details from the server — showing what was available.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getRoleColor = (role: string | null) => {
    const map: Record<string, string> = { Admin: '#E53E3E', HR: '#3182CE', Manager: '#38A169', HeadOfDepartment: '#D69E2E', Employee: '#6B46C1' };
    return map[role || ''] || '#4A5568';
  };

  const tabs = [
    { icon: <InfoIcon sx={{ fontSize: 18 }} />, label: 'Overview' },
    { icon: <WorkIcon sx={{ fontSize: 18 }} />, label: 'Work' },
    { icon: <PhoneIcon sx={{ fontSize: 18 }} />, label: 'Contact & Emergency' },
    { icon: <CitizenshipIcon sx={{ fontSize: 18 }} />, label: 'Personal & Family' },
    { icon: <BankIcon sx={{ fontSize: 18 }} />, label: 'Financial & Documents' },
    { icon: <AssetIcon sx={{ fontSize: 18 }} />, label: 'Assets' },
  ];

  const handlePersonalInfoSaved = (patch: Partial<UserProfile>) =>
    setUserProfile((prev) => prev ? { ...prev, ...patch } : prev);

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F8F9FB', gap: 2 }}>
      <CircularProgress size={40} thickness={5} sx={{ color: '#3F6FE8' }} />
      <Typography color="#6B7280" fontSize="0.85rem">Loading your profile...</Typography>
    </Box>
  );

  // ProtectedRoute already guarantees a logged-in user by the time this
  // page renders; this is just a defensive fallback for the brief instant
  // before that context settles.
  if (!user || !userProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F8F9FB' }}>
        <CircularProgress size={40} thickness={5} sx={{ color: '#3F6FE8' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F3F5F8', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Nav ── */}
      <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #E8ECF0', px: 4, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ bgcolor: '#3F6FE8', p: 0.7, borderRadius: '8px', display: 'flex' }}>
            <DashboardIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography fontWeight="800" fontSize="0.95rem" letterSpacing={0.5} color="#1A1F36">HR PORTAL</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Confirms whose logged-in session this is */}
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#059669 !important' }} />}
            label={user.email}
            size="small"
            sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600, fontSize: '0.72rem', border: '1px solid #A7F3D0' }}
          />
          <Button startIcon={<SettingsIcon />} size="small" onClick={() => navigate('/configuration')} sx={{ color: '#6B7280', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem' }}>Configuration</Button>
          <Button startIcon={<ExitIcon />} size="small" color="error" onClick={handleLogout} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem' }}>Logout</Button>
        </Stack>
      </Box>

      {/* ── Status Banner ── */}
      {errorMsg && (
        <Alert severity="warning" sx={{ borderRadius: 0, fontSize: '0.82rem' }}>
          {errorMsg}
        </Alert>
      )}

      {/* ── Hero ── */}
      <Box sx={{ background: `linear-gradient(135deg, ${getRoleColor(currentRole)} 0%, #0F172A 100%)`, px: { xs: 3, md: 5 }, pt: 4, pb: 0, position: 'relative' }}>
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <Stack direction="row" spacing={3} alignItems="flex-end">
          <Avatar sx={{ width: 88, height: 88, border: '4px solid rgba(255,255,255,0.9)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', bgcolor: '#CBD5E0', fontSize: '2rem', fontWeight: 800, mb: '-28px' }} src={userProfile?.photo}>
            {userProfile?.full_name?.[0]}
          </Avatar>
          <Box sx={{ pb: '32px' }}>
            <Typography variant="h6" fontWeight="800" color="white" sx={{ lineHeight: 1.2 }}>{userProfile?.full_name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
              <Chip label={currentRole} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 700, fontSize: '0.72rem', border: '1px solid rgba(255,255,255,0.3)' }} />
              <Typography fontSize="0.82rem" color="rgba(255,255,255,0.85)" fontWeight={500}>{userProfile?.designation} &bull; {userProfile?.department}</Typography>
              <Typography fontSize="0.78rem" color="rgba(255,255,255,0.6)">#{userProfile?.employee_id}</Typography>
            </Stack>
          </Box>
        </Stack>
        <Box sx={{ mt: 3, ml: '110px' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} TabIndicatorProps={{ style: { backgroundColor: '#fff', height: 3, borderRadius: '3px 3px 0 0' } }}
            sx={{ '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontWeight: 700, fontSize: '0.85rem', minWidth: 0, mr: 1, px: 1.5, '&:hover': { color: 'rgba(255,255,255,0.9)' } }, '& .Mui-selected': { color: '#fff !important' } }}>
            {tabs.map((t, i) => <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />)}
          </Tabs>
        </Box>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ maxWidth: 1100, mx: 'auto', width: '100%', px: { xs: 2, md: 4 }, pt: 4, pb: 6 }}>
        <Fade in key={tabValue} timeout={300}>
          <Box>

            {/* ══ OVERVIEW ══ */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <ProfileCompletion profile={userProfile} />
                  <Card sx={{ borderRadius: '12px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography fontWeight="700" fontSize="0.9rem" color="#1A1F36" mb={2}>Quick Info</Typography>
                      <Stack spacing={1.8}>
                        {[
                          { icon: <BadgeIcon sx={{ fontSize: 16, color: '#3F6FE8' }} />, label: userProfile?.employee_id || '—', sub: 'Employee ID' },
                          { icon: <CalendarIcon sx={{ fontSize: 16, color: '#3F6FE8' }} />, label: userProfile?.joining_date || '—', sub: 'Joining Date' },
                          { icon: <WorkIcon sx={{ fontSize: 16, color: '#3F6FE8' }} />, label: userProfile?.employment_type || 'Full Time', sub: 'Employment Type' },
                          { icon: <LocationIcon sx={{ fontSize: 16, color: '#3F6FE8' }} />, label: userProfile?.work_location || 'Office', sub: 'Work Location' },
                        ].map((item, i) => (
                          <Stack key={i} direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</Box>
                            <Box>
                              <Typography fontSize="0.82rem" fontWeight="700" color="#1A1F36">{item.label}</Typography>
                              <Typography fontSize="0.72rem" color="#6B7280">{item.sub}</Typography>
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ gridColumn: { md: 'span 2' } }}>
                  {/* Identity is HR-managed (set via Onboarding / Dept-Designation Master), so
                      no edit control here — the editable self-service fields live in the
                      Work / Contact & Emergency / Personal & Family tabs instead. */}
                  <SectionCard title="Identity" icon={<PersonIcon sx={{ fontSize: 17 }} />}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 4 }}>
                      <Box>
                        <FieldRow label="Full Name" value={userProfile?.full_name} />
                        <FieldRow label="Employee ID" value={userProfile?.employee_id} />
                        <FieldRow label="Gender" value={userProfile?.gender} />
                      </Box>
                      <Box>
                        <FieldRow label="Designation" value={userProfile?.designation} />
                        <FieldRow label="Department" value={userProfile?.department} />
                      </Box>
                    </Box>
                  </SectionCard>
                </Box>
              </Box>
            </TabPanel>

            {/* ══ WORK ══ */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <SectionCard title="Position Details" icon={<WorkIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Job Title" value={userProfile?.designation} />
                    <FieldRow label="Department" value={userProfile?.department} />
                    <FieldRow label="Manager" value={userProfile?.manager || userProfile?.reporting_to || userProfile?.reporting_manager || userProfile?.reporting_head} />
                    <FieldRow label="Employment Category" value={userProfile?.employee_category} />
                    <FieldRow
                      label="Employment Status"
                      value={(userProfile?.exit_status === 'Left' || userProfile?.exit_status === 'Already Left')
                        ? `Exited — ${userProfile.exit_status}`
                        : (userProfile?.exit_status || userProfile?.joining_status)}
                    />
                    <FieldRow label="Work Location" value={userProfile?.work_location} />
                  </SectionCard>
                </Box>
                <Box>
                  <SectionCard title="Employment Timeline" icon={<CalendarIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Date of Joining" value={userProfile?.joining_date} />
                    <FieldRow label="Probation Duration" value={userProfile?.probation_duration ? `${userProfile.probation_duration} month(s)` : undefined} />
                    <FieldRow label="Confirmation Due Date" value={userProfile?.confirmation_due_date} />
                    <FieldRow label="Notice Period" value={userProfile?.notice_period} />
                    <FieldRow label="Employee Level" value={userProfile?.level ? `Level ${userProfile.level}` : userProfile?.management_level_label} />
                  </SectionCard>
                  <SectionCard title="Reporting" icon={<TeamIcon sx={{ fontSize: 17 }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                      <Avatar sx={{ width: 40, height: 40, bgcolor: '#3F6FE8', fontSize: '0.9rem', fontWeight: 700 }}>
                        {(userProfile?.manager || userProfile?.reporting_to || userProfile?.reporting_manager || userProfile?.reporting_head || 'M')[0]}
                      </Avatar>
                      <Box>
                        <Typography fontWeight="700" fontSize="0.85rem" color="#1A1F36">{userProfile?.manager || userProfile?.reporting_to || userProfile?.reporting_manager || userProfile?.reporting_head || '—'}</Typography>
                        <Typography fontSize="0.75rem" color="#6B7280">Direct Manager</Typography>
                      </Box>
                    </Box>
                  </SectionCard>
                </Box>
              </Box>
            </TabPanel>

            {/* ══ CONTACT & EMERGENCY ══ */}
            <TabPanel value={tabValue} index={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                <Box>
                  {/* Official/personal email and phone come from the HR system of
                      record, not this form, so they stay read-only here. */}
                  <SectionCard title="Contact Details" icon={<PhoneIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Official Email" value={userProfile?.official_email} />
                    <FieldRow label="Personal Email" value={userProfile?.personal_email} />
                    <FieldRow label="Phone (Work)" value={userProfile?.phone || userProfile?.mobile} />
                    <FieldRow label="Work Location" value={userProfile?.work_location} />
                    <FieldRow label="Working Address" value="G 203, Sector 63, Noida 201301" />
                  </SectionCard>
                </Box>
                <Box>
                  <EditableSectionCard
                    title="Emergency Contact" icon={<EmergencyIcon sx={{ fontSize: 17 }} />}
                    fields={EMERGENCY_CONTACT_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
              </Box>
            </TabPanel>

            {/* ══ PERSONAL & FAMILY ══ */}
            <TabPanel value={tabValue} index={3}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <EditableSectionCard
                    title="Personal Details" icon={<PersonIcon sx={{ fontSize: 17 }} />}
                    fields={PERSONAL_DETAILS_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
                <Box>
                  <EditableSectionCard
                    title="Citizenship Details" icon={<CitizenshipIcon sx={{ fontSize: 17 }} />}
                    fields={CITIZENSHIP_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
                <Box>
                  <EditableSectionCard
                    title="Family Details" icon={<FamilyIcon sx={{ fontSize: 17 }} />}
                    fields={FAMILY_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
              </Box>
            </TabPanel>

            {/* ══ FINANCIAL & DOCUMENTS ══ */}
            <TabPanel value={tabValue} index={4}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <EditableSectionCard
                    title="Bank Details" icon={<BankIcon sx={{ fontSize: 17 }} />}
                    fields={BANK_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
                <Box>
                  <SectionCard title="Onboarding Documents" icon={<OnboardingIcon sx={{ fontSize: 17 }} />} action={<Button size="small" startIcon={<UploadIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#3F6FE8' }}>Upload</Button>}>
                    <List disablePadding sx={{ mx: -3, mb: -2.5 }}>
                      <DocumentItem title="10th Marksheet" subtitle="Class X board certificate" tag="Required" tagColor="#E53E3E" href="#" />
                      <DocumentItem title="12th Marksheet" subtitle="Class XII board certificate" tag="Required" tagColor="#E53E3E" href="#" />
                      <DocumentItem title="Graduation Marksheet" subtitle="Bachelor's degree transcripts" tag="Required" tagColor="#E53E3E" href="#" />
                      <DocumentItem title="Postgraduate Marksheet" subtitle="Master's / PG degree (if applicable)" tag="Optional" tagColor="#6B7280" href="#" />
                      <DocumentItem title="Aadhaar / PAN Card" subtitle="Government identity proof" tag="Required" tagColor="#E53E3E" href="#" />
                    </List>
                  </SectionCard>
                </Box>
                <Box>
                  <SectionCard title="My Documents" icon={<LetterIcon sx={{ fontSize: 17 }} />} action={<Button size="small" startIcon={<UploadIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#3F6FE8' }}>Upload</Button>}>
                    <List disablePadding sx={{ mx: -3, mb: -2.5 }}>
                      <DocumentItem title="Offer Letter" subtitle="Original employment offer document" tag="Issued" tagColor="#059669" href="/employee-letters" />
                      <DocumentItem title="Appointment Letter" subtitle="Formal appointment confirmation" tag="Issued" tagColor="#059669" href="/employee-letters" />
                      <DocumentItem title="Increment Letter" subtitle="Salary revision & increment details" tag="Issued" tagColor="#059669" href="/employee-letters" />
                      <DocumentItem title="Experience Letter" subtitle="For previous employment (if applicable)" tag="Optional" tagColor="#6B7280" href="#" />
                      <DocumentItem title="Payslips" subtitle="Monthly salary statements" tag="Auto-generated" tagColor="#3F6FE8" href="/employee-letters" />
                    </List>
                  </SectionCard>
                </Box>
              </Box>
            </TabPanel>

            {/* ══ ASSETS ══ */}
            <TabPanel value={tabValue} index={5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <SectionCard title="Assigned Assets" icon={<AssetIcon sx={{ fontSize: 17 }} />}>
                    <Box sx={{ mx: -3, mb: -2.5 }}>
                      <AssetItem name="Dell Latitude 5520" type="Laptop" assignedDate="Jan 15, 2024" status="Active" />
                      <AssetItem name="USB-C Docking Station" type="Peripheral" assignedDate="Jan 15, 2024" status="Active" />
                      <AssetItem name="Ergonomic Mouse" type="Peripheral" assignedDate="Jan 15, 2024" status="Active" />
                      <AssetItem name="24&quot; Monitor" type="Display" assignedDate="Feb 1, 2024" status="Active" />
                    </Box>
                  </SectionCard>
                </Box>
                <Box>
                  <Card sx={{ borderRadius: '12px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography fontWeight="700" fontSize="0.9rem" color="#1A1F36" mb={2}>Asset Summary</Typography>
                      {[{ label: 'Total Assets', val: '4', color: '#3F6FE8' }, { label: 'Active', val: '4', color: '#059669' }, { label: 'Returned', val: '0', color: '#6B7280' }].map((s, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: i < 2 ? '1px solid #F0F2F5' : 'none' }}>
                          <Typography fontSize="0.82rem" color="#6B7280" fontWeight={500}>{s.label}</Typography>
                          <Typography fontSize="1rem" fontWeight="800" color={s.color}>{s.val}</Typography>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                  <Card sx={{ borderRadius: '12px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', mt: 2 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography fontWeight="700" fontSize="0.9rem" color="#1A1F36" mb={1.5}>Need an Asset?</Typography>
                      <Typography fontSize="0.8rem" color="#6B7280" mb={2}>Raise a request for new hardware or peripherals from IT.</Typography>
                      <Button fullWidth variant="outlined" size="small" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', borderColor: '#3F6FE8', color: '#3F6FE8', '&:hover': { bgcolor: '#F0F4FF' } }}>
                        Raise Asset Request
                      </Button>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </TabPanel>

          </Box>
        </Fade>
      </Box>
    </Box>
  );
}