import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip,
  Button, Tab, Tabs, List, ListItem, ListItemText, ListItemIcon,
  Paper, Link, Fade, IconButton, Stack, CircularProgress, LinearProgress,
  Alert, TextField, MenuItem, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  Person as PersonIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  Description as DocumentIcon,
  Group as TeamIcon,
  Info as InfoIcon,
  Computer as AssetIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as EmptyCircleIcon,
  Edit as EditIcon,
  Article as LetterIcon,
  FolderOpen as OnboardingIcon,
  Save as SaveIcon,
  Close as CancelIcon,
  Add as AddIcon,
  ContactEmergency as EmergencyIcon,
  FamilyRestroom as FamilyIcon,
  AccountBalance as BankIcon,
  Flag as CitizenshipIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────
// Onboarding is now the single source of truth for everything on this page —
// both the HR-managed Work-tab facts AND the self-service editable fields.
// It's also exactly what the Employees List page's detail view reads, so a
// save here shows up there immediately with nothing else to keep in sync.
interface FamilyMember { name: string; occupation: string; }

interface OnboardingDocument {
  docType: string;
  fileName: string;
  driveLink: string;
  uploadedAt: string | null;
}

interface EmployeeSignature {
  fileName: string;
  driveLink: string;
  driveFileId: string;
  uploadedAt: string | null;
}

interface CompanyAssets {
  dateIssued?: string | null;
  laptop?: boolean;
  mouse?: boolean;
  charger?: boolean;
  simCard?: boolean;
}

interface UserProfile {
  _id?: string; // Onboarding record _id — target for every self-service save below
  empId?: string;
  full_name?: string;
  official_email?: string;
  personal_email?: string;
  mobile?: string;
  address?: string;
  gender?: string;

  department?: string;
  designation?: string;
  joining_date?: string;
  job_location?: string;
  reporting_head?: string;
  employee_category?: string;
  joining_status?: string;
  exit_status?: string;

  // ── Probation/confirmation — a separate collection, fetched separately.
  // No confirmation-date field — those were all bulk-backfilled during
  // migration and don't reflect a real confirmation date, so nothing here
  // should display one.
  confirmationStatus?: 'probation' | 'confirmed' | 'extended' | 'not_confirmed' | null;

  // ── Personal info — self-service, editable from Overview / Emergency &
  // Family / Documents & Bank tabs
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
  familyFatherOccupation?: string;
  familyMother?: string;
  familyMotherOccupation?: string;
  familySiblingsList?: FamilyMember[];
  familySpouse?: string;
  familySpouseOccupation?: string;
  familyNumberOfChildren?: number | null;

  documents?: OnboardingDocument[];
  companyAssets?: CompanyAssets;
  signature?: EmployeeSignature | null;

  // Used only to decide whether the Increment Letter is actually available
  // (see hasCompletedIncrement) — not displayed directly.
  salaryRevisions?: { stage?: string }[];
}

// Keys must match backend-node/utils/onboardingDocumentTypes.js exactly —
// this is what's sent as `docType` in the upload request.
function latestDocFor(documents: OnboardingDocument[] | undefined, docType: string): OnboardingDocument | undefined {
  return (documents || [])
    .filter(d => d.docType === docType)
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())[0];
}

type PersonalInfoField =
  | 'name' | 'persEmail' | 'mobile' | 'address'
  | 'citizenship' | 'nationality' | 'passportNo' | 'passportValidUpto' | 'passportIssuePlace'
  | 'bankName' | 'bankAccountNo' | 'ifscCode' | 'panCard' | 'aadhaarNo' | 'uanNo' | 'ePassbookLink'
  | 'birthday' | 'bloodGroup' | 'maritalStatus'
  | 'emergencyContactName' | 'emergencyContactRelation' | 'emergencyContactPhone' | 'emergencyContactPlace'
  | 'familyFather' | 'familyFatherOccupation' | 'familyMother' | 'familyMotherOccupation'
  | 'familySpouse' | 'familySpouseOccupation' | 'familyNumberOfChildren';

// Maps a raw Onboarding doc (camelCase Mongoose field names) onto UserProfile.
function buildProfileFromOnboarding(doc: any): UserProfile {
  return {
    _id: doc._id,
    empId: doc.empId || undefined,
    full_name: doc.name || '',
    official_email: doc.officialEmail || '',
    personal_email: doc.persEmail || '',
    mobile: doc.mobile || '',
    address: doc.address || '',
    gender: doc.gender || '',

    department: doc.dept || '',
    designation: doc.designation || '',
    joining_date: doc.joinedDate || '',
    job_location: doc.jobLocation || '',
    reporting_head: doc.reportingHead || '',
    employee_category: doc.employeeCategory || '',
    joining_status: doc.joiningStatus || '',
    exit_status: doc.exitStatus || '',

    citizenship: doc.citizenship || '',
    nationality: doc.nationality || '',
    passportNo: doc.passportNo || '',
    passportValidUpto: doc.passportValidUpto || null,
    passportIssuePlace: doc.passportIssuePlace || '',

    bankName: doc.bankName || '',
    bankAccountNo: doc.bankAccountNo || '',
    ifscCode: doc.ifscCode || '',
    panCard: doc.panCard || '',
    aadhaarNo: doc.aadhaarNo || '',
    uanNo: doc.uanNo || '',
    ePassbookLink: doc.ePassbookLink || '',

    birthday: doc.birthday || null,
    bloodGroup: doc.bloodGroup || '',
    maritalStatus: doc.maritalStatus || '',

    emergencyContactName: doc.emergencyContactName || '',
    emergencyContactRelation: doc.emergencyContactRelation || '',
    emergencyContactPhone: doc.emergencyContactPhone || '',
    emergencyContactPlace: doc.emergencyContactPlace || '',

    familyFather: doc.familyFather || '',
    familyFatherOccupation: doc.familyFatherOccupation || '',
    familyMother: doc.familyMother || '',
    familyMotherOccupation: doc.familyMotherOccupation || '',
    familySiblingsList: Array.isArray(doc.familySiblingsList) ? doc.familySiblingsList : [],
    familySpouse: doc.familySpouse || '',
    familySpouseOccupation: doc.familySpouseOccupation || '',
    familyNumberOfChildren: doc.familyNumberOfChildren ?? null,

    documents: Array.isArray(doc.documents) ? doc.documents : [],
    companyAssets: doc.companyAssets || {},
    signature: doc.signature && doc.signature.driveLink ? doc.signature : null,
  };
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

function FieldRow({ label, value, required }: { label: string; value?: string | null; required?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1.2, borderBottom: '1px solid #F5F6F8', '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ width: '45%', color: '#6B7280', fontSize: '0.82rem', fontWeight: 500 }}>
        {label}{required && <Typography component="span" sx={{ color: '#E53E3E', ml: 0.3 }}>*</Typography>}
      </Typography>
      <Typography sx={{ flex: 1, color: '#1A1F36', fontSize: '0.82rem', fontWeight: 600 }}>{value || '—'}</Typography>
    </Box>
  );
}

// ─── Editable field system ──────────────────────────────────────────────────

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];

const toDateInputValue = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '');
const formatDateDisplay = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined;

function EditableFieldRow({ label, value, editing, onChange, type = 'text', options, required, showError }: {
  label: string; value?: string | null; editing: boolean; onChange: (v: string) => void;
  type?: 'text' | 'date' | 'select' | 'number'; options?: string[]; required?: boolean; showError?: boolean;
}) {
  if (!editing) return <FieldRow label={label} value={value} required={required} />;
  const empty = required && !String(value || '').trim();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 1.5, borderBottom: '1px solid #F5F6F8', '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ width: '45%', color: '#6B7280', fontSize: '0.82rem', fontWeight: 500, flexShrink: 0 }}>
        {label}{required && <Typography component="span" sx={{ color: '#E53E3E', ml: 0.3 }}>*</Typography>}
      </Typography>
      <TextField
        select={type === 'select'}
        size="small"
        fullWidth
        required={required}
        error={!!showError && empty}
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

type FieldSpec = { key: PersonalInfoField; label: string; type?: 'text' | 'date' | 'select' | 'number'; options?: string[]; required?: boolean };

const OVERVIEW_FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Full Name', required: true },
  { key: 'nationality', label: 'Nationality', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'birthday', label: 'Date of Birth', type: 'date', required: true },
  { key: 'bloodGroup', label: 'Blood Group', type: 'select', options: BLOOD_GROUPS, required: true },
  { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: MARITAL_STATUSES, required: true },
  { key: 'persEmail', label: 'Personal Email ID', required: true },
  { key: 'mobile', label: 'Phone No', required: true },
];

// Citizenship/passport isn't in the new spec's tab list, but there's no data
// to lose by keeping it — it just doesn't have a spec-named home, so it
// stays here as a supplementary card.
const CITIZENSHIP_FIELDS: FieldSpec[] = [
  { key: 'citizenship', label: 'Citizenship' },
  { key: 'passportNo', label: 'Passport No' },
  { key: 'passportValidUpto', label: 'Valid Upto', type: 'date' },
  { key: 'passportIssuePlace', label: 'Issue Place' },
];

const EMERGENCY_CONTACT_FIELDS: FieldSpec[] = [
  { key: 'emergencyContactName', label: 'Name of the Contact', required: true },
  { key: 'emergencyContactRelation', label: 'Relation', required: true },
  { key: 'emergencyContactPhone', label: 'Phone No', required: true },
  { key: 'emergencyContactPlace', label: 'Place', required: true },
];

const BANK_FIELDS: FieldSpec[] = [
  { key: 'bankName', label: 'Bank Name' },
  { key: 'bankAccountNo', label: 'Account No' },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'mobile', label: 'Phone Number' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'aadhaarNo', label: 'Aadhaar Card No' },
  { key: 'uanNo', label: 'UAN No' },
  { key: 'ePassbookLink', label: 'E-Passbook' },
];

// One self-contained editable card — its own Edit/Save/Cancel, scoped to just
// the fields it lists. Lets a tab mix read-only SectionCards (HR-managed
// facts) with editable ones (self-service fields) without one giant edit
// toggle forcing everything on the tab into edit mode at once.
// `leadingField` renders one always-read-only row above the editable ones
// (e.g. Official Email — a login identifier, not safe to self-edit) so it
// doesn't need its own separate, nearly-empty card.
function EditableSectionCard({ title, icon, fields, profile, employeeId, onSaved, leadingField }: {
  title: string;
  icon: React.ReactNode;
  fields: FieldSpec[];
  leadingField?: { label: string; value?: string | null };
  profile: UserProfile | null;
  employeeId?: string;
  onSaved: (patch: Partial<UserProfile>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<PersonalInfoField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // profile's own key names sometimes differ from the PersonalInfoField the
  // API expects (full_name -> name), so field.key can't always index profile
  // directly — this maps the handful of exceptions.
  const profileValue = (key: PersonalInfoField): any => {
    if (key === 'name') return profile?.full_name;
    if (key === 'persEmail') return profile?.personal_email;
    return (profile as any)?.[key];
  };

  const startEdit = () => {
    const initial: Partial<Record<PersonalInfoField, string>> = {};
    fields.forEach(f => {
      const raw = profileValue(f.key) ?? '';
      initial[f.key] = f.type === 'date' ? toDateInputValue(raw) : String(raw);
    });
    setDraft(initial);
    setError(null);
    setShowErrors(false);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(null); setShowErrors(false); };
  const setField = (key: PersonalInfoField, value: string) => setDraft(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    const missing = fields.filter(f => f.required && !String(draft[f.key] || '').trim());
    if (missing.length) {
      setShowErrors(true);
      setError(`Please fill in all required fields: ${missing.map(f => f.label).join(', ')}.`);
      return;
    }
    if (!employeeId) { setError('No onboarding record is linked to this account yet — nothing to save against.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${API_URL}/onboarding/${employeeId}/personal-info`, draft);
      if (res.data?.success) {
        const saved = res.data.data;
        const patch: Partial<UserProfile> = saved ? {
          ...(('name' in draft) ? { full_name: saved.name } : {}),
          ...(('persEmail' in draft) ? { personal_email: saved.persEmail } : {}),
        } : {};
        fields.forEach(f => {
          if (f.key === 'name' || f.key === 'persEmail') return;
          (patch as any)[f.key] = saved ? saved[f.key] : draft[f.key];
        });
        onSaved(patch);
        setEditing(false);
      } else {
        setError('Could not save changes.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const displayVal = (f: FieldSpec): string | undefined => {
    const raw = profileValue(f.key);
    return f.type === 'date' ? formatDateDisplay(raw) : raw;
  };
  const val = (f: FieldSpec) => editing ? (draft[f.key] ?? '') : displayVal(f);

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
          No onboarding record is linked to this account yet — this can't be saved until one exists.
        </Alert>
      )}
      {leadingField && <FieldRow label={leadingField.label} value={leadingField.value} />}
      {fields.map(f => (
        <EditableFieldRow key={f.key} label={f.label} value={val(f)} editing={editing} required={f.required} showError={showErrors}
          type={f.type} options={f.options} onChange={v => setField(f.key, v)} />
      ))}
    </SectionCard>
  );
}

// ─── Family card — Father/Mother (+occupation), a real add/remove Siblings
// list, Spouse (+occupation, shown when married or already on file), and
// number of children. Bespoke because of the repeatable Siblings list; the
// rest of its fields ride the same personal-info save endpoint as every
// other editable card. ──────────────────────────────────────────────────────
function FamilyCard({ profile, employeeId, onSaved }: {
  profile: UserProfile | null;
  employeeId?: string;
  onSaved: (patch: Partial<UserProfile>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const [father, setFather] = useState('');
  const [fatherOcc, setFatherOcc] = useState('');
  const [mother, setMother] = useState('');
  const [motherOcc, setMotherOcc] = useState('');
  const [spouse, setSpouse] = useState('');
  const [spouseOcc, setSpouseOcc] = useState('');
  const [numChildren, setNumChildren] = useState('');
  const [siblings, setSiblings] = useState<FamilyMember[]>([]);

  const startEdit = () => {
    setFather(profile?.familyFather || '');
    setFatherOcc(profile?.familyFatherOccupation || '');
    setMother(profile?.familyMother || '');
    setMotherOcc(profile?.familyMotherOccupation || '');
    setSpouse(profile?.familySpouse || '');
    setSpouseOcc(profile?.familySpouseOccupation || '');
    setNumChildren(profile?.familyNumberOfChildren != null ? String(profile.familyNumberOfChildren) : '');
    setSiblings((profile?.familySiblingsList || []).map(s => ({ ...s })));
    setError(null);
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setError(null); setShowErrors(false); };

  const addSibling = () => setSiblings(prev => [...prev, { name: '', occupation: '' }]);
  const removeSibling = (i: number) => setSiblings(prev => prev.filter((_, idx) => idx !== i));
  const updateSibling = (i: number, field: 'name' | 'occupation', value: string) =>
    setSiblings(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  // Spouse fields are only mandatory for someone who's actually married —
  // showSpouse (below) is deliberately true for everyone while editing, so
  // it isn't the right signal for "must fill this in".
  const spouseRequired = profile?.maritalStatus === 'Married';

  const save = async () => {
    const missing: string[] = [];
    if (!father.trim()) missing.push("Father's Name");
    if (!fatherOcc.trim()) missing.push("Father's Occupation");
    if (!mother.trim()) missing.push("Mother's Name");
    if (!motherOcc.trim()) missing.push("Mother's Occupation");
    if (!numChildren.trim()) missing.push('No. of Children');
    if (spouseRequired) {
      if (!spouse.trim()) missing.push('Spouse Name');
      if (!spouseOcc.trim()) missing.push('Spouse Occupation');
    }
    if (missing.length) {
      setShowErrors(true);
      setError(`Please fill in all required fields: ${missing.join(', ')}.`);
      return;
    }
    if (!employeeId) { setError('No onboarding record is linked to this account yet — nothing to save against.'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      familyFather: father,
      familyFatherOccupation: fatherOcc,
      familyMother: mother,
      familyMotherOccupation: motherOcc,
      familySpouse: spouse,
      familySpouseOccupation: spouseOcc,
      familyNumberOfChildren: numChildren === '' ? null : Number(numChildren),
      familySiblingsList: siblings.filter(s => s.name.trim() || s.occupation.trim()),
    };
    try {
      const res = await axios.put(`${API_URL}/onboarding/${employeeId}/personal-info`, payload);
      if (res.data?.success) {
        onSaved(payload);
        setEditing(false);
      } else {
        setError('Could not save changes.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const showSpouse = editing || profile?.maritalStatus === 'Married' || !!profile?.familySpouse;
  const displaySiblings = profile?.familySiblingsList || [];

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
    <SectionCard title="Family" icon={<FamilyIcon sx={{ fontSize: 17 }} />} action={action}>
      {error && <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.76rem' }}>{error}</Alert>}
      {editing && !employeeId && (
        <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.76rem' }}>
          No onboarding record is linked to this account yet — this can't be saved until one exists.
        </Alert>
      )}

      <EditableFieldRow label="Father's Name" value={editing ? father : profile?.familyFather} editing={editing} onChange={setFather} required showError={showErrors} />
      <EditableFieldRow label="Father's Occupation" value={editing ? fatherOcc : profile?.familyFatherOccupation} editing={editing} onChange={setFatherOcc} required showError={showErrors} />
      <EditableFieldRow label="Mother's Name" value={editing ? mother : profile?.familyMother} editing={editing} onChange={setMother} required showError={showErrors} />
      <EditableFieldRow label="Mother's Occupation" value={editing ? motherOcc : profile?.familyMotherOccupation} editing={editing} onChange={setMotherOcc} required showError={showErrors} />

      {/* Siblings — repeatable add/remove list. Kept on the same 45%/55%
          label/value column layout as every other row in this card. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', py: 1.2, gap: 1.5, borderBottom: '1px solid #F5F6F8' }}>
        <Typography sx={{ width: '45%', color: '#6B7280', fontSize: '0.82rem', fontWeight: 500, flexShrink: 0, pt: editing ? 1 : 0 }}>
          Siblings
        </Typography>
        <Box sx={{ flex: 1 }}>
          {editing && (
            <Button size="small" onClick={addSibling} startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#3F6FE8', mb: 0.5 }}>
              Add
            </Button>
          )}

          {!editing && displaySiblings.length === 0 && (
            <Typography fontSize="0.82rem" color="#1A1F36" fontWeight={600}>—</Typography>
          )}
          {!editing && displaySiblings.map((s, i) => (
            <Typography key={i} fontSize="0.82rem" color="#1A1F36" fontWeight={600} sx={{ mb: 0.3 }}>
              {s.name}{s.occupation ? ` — ${s.occupation}` : ''}
            </Typography>
          ))}

          {editing && siblings.length === 0 && (
            <Typography fontSize="0.82rem" color="#9CA3AF" mb={0.5}>No siblings added yet.</Typography>
          )}
          {editing && siblings.map((s, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center" mb={1}>
              <TextField size="small" placeholder="Name" value={s.name} onChange={e => updateSibling(i, 'name', e.target.value)}
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 } }} />
              <TextField size="small" placeholder="Occupation" value={s.occupation} onChange={e => updateSibling(i, 'occupation', e.target.value)}
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 } }} />
              <IconButton size="small" onClick={() => removeSibling(i)}>
                <CancelIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
              </IconButton>
            </Stack>
          ))}
        </Box>
      </Box>

      {showSpouse && (
        <>
          <EditableFieldRow label="Spouse Name" value={editing ? spouse : profile?.familySpouse} editing={editing} onChange={setSpouse} required={spouseRequired} showError={showErrors} />
          <EditableFieldRow label="Spouse Occupation" value={editing ? spouseOcc : profile?.familySpouseOccupation} editing={editing} onChange={setSpouseOcc} required={spouseRequired} showError={showErrors} />
        </>
      )}
      <EditableFieldRow
        required showError={showErrors}
        label="No. of Children"
        value={editing ? numChildren : (profile?.familyNumberOfChildren != null ? String(profile.familyNumberOfChildren) : undefined)}
        editing={editing} type="number" onChange={setNumChildren}
      />
    </SectionCard>
  );
}

// A document row that's either system-issued (staticHref — links out, e.g.
// to /employee-letters, no upload control) or self-uploadable (docType +
// employeeId — shows a real Upload/Replace control and, once uploaded, a
// working View link straight to the Drive file).
function DocumentItem({ docType, title, subtitle, requiredTag, requiredTagColor = '#3F6FE8', doc, employeeId, onUploaded, staticHref }: {
  docType?: string;
  title: string;
  subtitle: string;
  requiredTag?: string;
  requiredTagColor?: string;
  doc?: OnboardingDocument;
  employeeId?: string;
  onUploaded?: (documents: OnboardingDocument[]) => void;
  staticHref?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploaded = !!doc;
  const tag = uploaded ? 'Uploaded' : requiredTag;
  const tagColor = uploaded ? '#059669' : requiredTagColor;
  const viewHref = doc?.driveLink || staticHref;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same filename be re-selected later
    if (!file || !employeeId || !docType) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      // No explicit Content-Type — axios/the browser must set it from the
      // FormData instance itself so the multipart boundary is included;
      // hardcoding 'multipart/form-data' here drops that boundary and the
      // server (multer) silently fails to parse the body at all.
      const res = await axios.post(`${API_URL}/onboarding/${employeeId}/upload-documents`, formData);
      if (res.data?.success) onUploaded?.(res.data.data || []);
      else setError('Upload failed.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ListItem sx={{
      px: 3, py: 2, borderBottom: '1px solid #F0F2F5', '&:last-child': { borderBottom: 'none' },
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
        secondary={
          <Typography variant="caption" color={error ? '#DC2626' : '#6B7280'}>
            {error || (uploaded ? `${doc!.fileName}${formatDateDisplay(doc!.uploadedAt) ? ` • ${formatDateDisplay(doc!.uploadedAt)}` : ''}` : subtitle)}
          </Typography>
        }
      />
      <Stack direction="row" spacing={1} alignItems="center">
        {viewHref && (
          <Button component={Link} href={viewHref} target="_blank" rel="noopener" size="small" variant="outlined"
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, borderColor: '#E0E5EC', color: '#475467', '&:hover': { borderColor: '#3F6FE8', color: '#3F6FE8' } }}>
            View
          </Button>
        )}
        {docType && employeeId && (
          <>
            <input ref={inputRef} type="file" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
            <Button
              size="small" variant="text" disabled={uploading} onClick={() => inputRef.current?.click()}
              startIcon={uploading ? <CircularProgress size={12} color="inherit" /> : <UploadIcon sx={{ fontSize: 14 }} />}
              sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700, color: '#3F6FE8' }}>
              {uploading ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
            </Button>
          </>
        )}
      </Stack>
    </ListItem>
  );
}

// Digital signature — a single current image (re-upload replaces it,
// unlike DocumentItem's append-and-keep-latest), shown as an inline
// thumbnail rather than a "View" link-out since the whole point is being
// visually inspectable at a glance (this Profile page + the Employee List).
function buildSignatureThumbnailUrl(driveFileId: string) {
  return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w320`;
}

function SignatureCard({ signature, employeeId, onUploaded }: {
  signature?: EmployeeSignature | null;
  employeeId?: string;
  onUploaded?: (signature: EmployeeSignature) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !employeeId) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_URL}/onboarding/${employeeId}/upload-signature`, formData);
      if (res.data?.success) onUploaded?.(res.data.data);
      else setError('Upload failed.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #E5E9F0', borderRadius: '14px', overflow: 'hidden' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EditIcon sx={{ color: '#3F6FE8', fontSize: 18 }} />
        </Box>
        <Typography fontWeight="700" fontSize="0.9rem" color="#1A1F36">Digital Signature</Typography>
        <Chip label="Visible on Employee List" size="small" sx={{ ml: 'auto', bgcolor: '#F0F4FF', color: '#3F6FE8', fontWeight: 600, fontSize: '0.68rem', height: 20, borderRadius: '4px' }} />
      </Box>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{
          width: 220, height: 100, borderRadius: '10px', border: '1px dashed #D0D5DD',
          bgcolor: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
        }}>
          {signature?.driveFileId ? (
            <img src={buildSignatureThumbnailUrl(signature.driveFileId)} alt="Your signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <Typography fontSize="0.75rem" color="#9CA3AF">No signature uploaded</Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color={error ? '#DC2626' : '#6B7280'} display="block" mb={1.5}>
            {error || (signature
              ? `${signature.fileName}${formatDateDisplay(signature.uploadedAt) ? ` • ${formatDateDisplay(signature.uploadedAt)}` : ''}`
              : 'Upload a clear image of your signature (JPG or PNG, max 3MB). HR will see it on the Employee List.')}
          </Typography>
          {!employeeId && (
            <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.76rem' }}>
              No onboarding record is linked to this account yet — uploads can't be saved until one exists.
            </Alert>
          )}
          <input ref={inputRef} type="file" hidden accept=".jpg,.jpeg,.png" onChange={handleFile} />
          <Button
            size="small" variant="outlined" disabled={uploading || !employeeId} onClick={() => inputRef.current?.click()}
            startIcon={uploading ? <CircularProgress size={12} color="inherit" /> : <UploadIcon sx={{ fontSize: 14 }} />}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', fontWeight: 700, borderColor: '#3F6FE8', color: '#3F6FE8' }}>
            {uploading ? 'Uploading…' : signature ? 'Replace Signature' : 'Upload Signature'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Company Assets — a received-it checklist, ticked off by the employee
// themselves. Each control saves immediately on change (no Edit/Save dance —
// a checklist reads more naturally as "tick it and it's done"). ───────────
function CompanyAssetsCard({ assets, employeeId, defaultDate, onSaved }: {
  assets?: CompanyAssets;
  employeeId?: string;
  defaultDate?: string;
  onSaved: (assets: CompanyAssets) => void;
}) {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Partial<CompanyAssets>, key: string) => {
    if (!employeeId) { setError('No onboarding record is linked to this account yet — nothing to save against.'); return; }
    setSavingKey(key);
    setError(null);
    try {
      const res = await axios.put(`${API_URL}/onboarding/${employeeId}/company-assets`, patch);
      if (res.data?.success) onSaved(res.data.data);
      else setError('Could not save changes.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save changes.');
    } finally {
      setSavingKey(null);
    }
  };

  const dateIssued = toDateInputValue(assets?.dateIssued || defaultDate || null);
  const items: { key: 'laptop' | 'mouse' | 'charger' | 'simCard'; label: string }[] = [
    { key: 'laptop', label: 'Laptop' },
    { key: 'mouse', label: 'Mouse' },
    { key: 'charger', label: 'Charger' },
    { key: 'simCard', label: 'SIM Card' },
  ];

  return (
    <SectionCard title="Company Assets" icon={<AssetIcon sx={{ fontSize: 17 }} />}>
      {error && <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.76rem' }}>{error}</Alert>}
      {!employeeId && (
        <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.76rem' }}>
          No onboarding record is linked to this account yet — this checklist can't be saved until one exists.
        </Alert>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', py: 1.2, gap: 1.5, borderBottom: '1px solid #F5F6F8' }}>
        <Typography sx={{ width: '45%', color: '#6B7280', fontSize: '0.82rem', fontWeight: 500 }}>Date Issued</Typography>
        <TextField
          type="date" size="small" fullWidth value={dateIssued} disabled={!!savingKey || !employeeId}
          onChange={e => save({ dateIssued: e.target.value }, 'dateIssued')}
          InputLabelProps={{ shrink: true }} sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 } }}
        />
      </Box>
      <Typography sx={{ color: '#6B7280', fontSize: '0.82rem', fontWeight: 500, mt: 2, mb: 0.5 }}>
        Items received on joining
      </Typography>
      <Stack spacing={0.3}>
        {items.map(item => (
          <FormControlLabel
            key={item.key}
            disabled={!!savingKey || !employeeId}
            control={
              <Checkbox
                size="small"
                checked={!!assets?.[item.key]}
                onChange={e => save({ [item.key]: e.target.checked }, item.key)}
              />
            }
            label={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography fontSize="0.85rem" fontWeight={600} color="#1A1F36">{item.label}</Typography>
                {savingKey === item.key && <CircularProgress size={10} />}
              </Stack>
            }
          />
        ))}
      </Stack>
    </SectionCard>
  );
}

function profileCompletionFields(profile: UserProfile | null) {
  return [
    { label: 'Full Name', filled: !!profile?.full_name },
    { label: 'Official Email', filled: !!profile?.official_email },
    { label: 'Personal Email', filled: !!profile?.personal_email },
    { label: 'Phone', filled: !!profile?.mobile },
    { label: 'Nationality', filled: !!profile?.nationality },
    { label: 'Address', filled: !!profile?.address },
    { label: 'Date of Birth', filled: !!profile?.birthday },
    { label: 'Blood Group', filled: !!profile?.bloodGroup },
    { label: 'Marital Status', filled: !!profile?.maritalStatus },
  ];
}
function profileCompletionPct(profile: UserProfile | null) {
  const fields = profileCompletionFields(profile);
  return Math.round((fields.filter(f => f.filled).length / fields.length) * 100);
}

// Compact ring badge shown top-right of the Hero, visible from every tab —
// the full checklist (which fields are still missing) stays on the
// Overview tab; this is just the at-a-glance number.
function ProfileProgressBadge({ profile }: { profile: UserProfile | null }) {
  const pct = profileCompletionPct(profile);
  const color = pct === 100 ? '#4ADE80' : '#fff';
  return (
    <Box sx={{ position: 'absolute', top: { xs: 12, md: 20 }, right: { xs: 12, md: 32 }, display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Profile
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem' }}>
          {pct === 100 ? 'Complete' : 'Strength'}
        </Typography>
      </Box>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={48} thickness={4.5} sx={{ color: 'rgba(255,255,255,0.18)' }} />
        <CircularProgress
          variant="determinate" value={pct} size={48} thickness={4.5}
          sx={{ color, position: 'absolute', left: 0, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
        />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.72rem' }}>{pct}%</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// Uses the same SectionCard shell (icon box, title, border-bottom header)
// as every other card on the page, with the percentage in the header's
// action slot — same spot Edit/Save buttons sit on the editable cards —
// instead of a bespoke header, so it reads as one consistent set of cards
// rather than a one-off.
function ProfileCompletion({ profile }: { profile: UserProfile | null }) {
  const fields = profileCompletionFields(profile);
  const pct = profileCompletionPct(profile);
  return (
    <SectionCard
      title="Profile Completion"
      icon={<InfoIcon sx={{ fontSize: 17 }} />}
      action={<Typography fontWeight="800" fontSize="1rem" color={pct === 100 ? '#059669' : '#3F6FE8'}>{pct}%</Typography>}
    >
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#E8ECF0', '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: pct === 100 ? '#059669' : '#3F6FE8' } }} />
      <Stack spacing={1}>
        {fields.map(f => (
          <Stack key={f.label} direction="row" spacing={1} alignItems="center">
            {f.filled ? <CheckCircleIcon sx={{ fontSize: 15, color: '#059669' }} /> : <EmptyCircleIcon sx={{ fontSize: 15, color: '#D1D5DB' }} />}
            <Typography fontSize="0.82rem" color={f.filled ? '#374151' : '#9CA3AF'} fontWeight={f.filled ? 600 : 500}>{f.label}</Typography>
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}

const confirmationStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'confirmed': return 'Confirmed';
    case 'probation': return 'On Probation';
    case 'extended': return 'On Probation (Extended)';
    case 'not_confirmed': return 'Not Confirmed';
    default: return undefined;
  }
};

const isExited = (p: UserProfile | null) => p?.exit_status === 'Left' || p?.exit_status === 'Already Left';
const isIntern = (p: UserProfile | null) => /intern/i.test(p?.employee_category || '');

// Every letter the generator (pages/EmployeeLetter.tsx → pages/LetterTemplate.tsx,
// route "/letter") can produce — kept in sync with EmployeesPage.tsx's own
// GENERATED_LETTER_TYPES list. Each one is only listed here (not just
// disabled) once it's actually true for this employee — an employee who's
// never had a completed revision shouldn't see an "Increment Letter" any
// more than one who's still on probation should see a "Confirmation
// Letter". `isAvailable` conditions are a best-effort mapping onto what
// data is actually available; adjust here if a rule doesn't match reality.
const OFFICIAL_LETTER_TYPES: {
  type: string;
  label: string;
  subtitle: string;
  directLink?: string;
  isAvailable: (p: UserProfile | null) => boolean;
}[] = [
  { type: 'offer-letter', label: 'Offer Letter', subtitle: 'Original employment offer document',
    isAvailable: (p) => !!p?._id },
  { type: 'Appointment-letter', label: 'Appointment Letter', subtitle: 'Appointment confirmation (includes Code of Ethics, Non-Disclosure & Non-Compete Agreements)',
    isAvailable: (p) => p?.joining_status === 'Joined' && !isIntern(p) },
  { type: 'salary-revision', label: 'Increment Letter', subtitle: 'Salary revision & increment details',
    isAvailable: (p) => !!p?.salaryRevisions?.some(r => r.stage === 'completed') },
  { type: 'confirmation', label: 'Confirmation Letter', subtitle: 'Confirmation of employment',
    isAvailable: (p) => p?.confirmationStatus === 'confirmed' },
  { type: 'consultant-contract', label: 'Consultant Contract', subtitle: 'Consultant / internship engagement agreement',
    isAvailable: (p) => /consult/i.test(p?.employee_category || '') || isIntern(p) },
  { type: 'salary-breakdown', label: 'Salary Breakdown', subtitle: 'CTC component breakdown',
    isAvailable: (p) => p?.joining_status === 'Joined' && !isIntern(p) },
  { type: 'internship-certificate', label: 'Internship Certificate', subtitle: 'For interns, issued on exit',
    isAvailable: (p) => isIntern(p) && isExited(p) },
  { type: 'experience-certificate', label: 'Experience Certificate', subtitle: 'Issued on exit',
    isAvailable: (p) => isExited(p) && !isIntern(p) },
  { type: 'exit-clearance', label: 'Exit Clearance Form', subtitle: 'Exit formalities',
    directLink: 'https://docs.google.com/document/d/1d8MFqQAISbuOwP0SGM3IWBWf2J2V9s1O/edit',
    isAvailable: isExited },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Profile() {
  const [tabValue, setTabValue] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { user, refreshProfileCompletion } = useAuth();
  const currentRole = user?.role ?? null;

  useEffect(() => { fetchUserProfile(); }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return; // ProtectedRoute guarantees a logged-in user reaches this page

    try {
      setLoading(true);
      setErrorMsg(null);

      // Start from the already-authenticated session fields immediately,
      // then load the real record.
      setUserProfile({ full_name: user.name, official_email: user.email });

      // Onboarding is the single employee master and the same record the
      // Employees List page's detail view reads — so every self-service
      // edit made here shows up there immediately, with no separate copy
      // to keep in sync.
      let profile: UserProfile | null = null;
      try {
        const res = await axios.get(`${API_URL}/onboarding/by-email`, { params: { email: user.email } });
        if (res.data?.success && res.data.data) {
          profile = buildProfileFromOnboarding(res.data.data);
          setUserProfile(profile);
        }
      } catch {
        setErrorMsg('No onboarding record was found for your account — some details may be missing.');
      }

      // Probation/confirmation status lives in a separate collection —
      // best-effort: a brand-new joiner may not have a record yet. Matched
      // by employeeId (this onboarding record's own _id, which
      // Confirmations.employeeId uniquely refs) rather than email — several
      // onboarding records share the same generic/reused email address, so
      // an email match could silently return a DIFFERENT employee's
      // confirmation status. Falls back to email only if there's no
      // onboarding record at all (shouldn't normally happen).
      try {
        const confRes = await axios.get(`${API_URL}/confirmations/by-employee`, {
          params: profile?._id ? { employeeId: profile._id } : { email: user.email },
        });
        if (confRes.data?.success && confRes.data.data) {
          setUserProfile((prev) => prev ? {
            ...prev,
            confirmationStatus: confRes.data.data.currentStatus,
          } : prev);
        }
      } catch {
        // No confirmation record yet — Work tab just shows nothing for those two fields.
      }

      // Salary revision history — only used to know whether an Increment
      // Letter actually exists to view (see hasCompletedIncrement below),
      // not displayed directly on this page.
      if (profile?._id) {
        try {
          const revRes = await axios.get(`${API_URL}/salary-revisions/history/${profile._id}`);
          if (revRes.data?.success) {
            setUserProfile((prev) => prev ? { ...prev, salaryRevisions: revRes.data.data || [] } : prev);
          }
        } catch {
          // No history, or not permitted — Increment Letter just stays hidden.
        }
      }
    } catch {
      setErrorMsg('Could not load full profile details from the server — showing what was available.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { icon: <InfoIcon sx={{ fontSize: 18 }} />, label: 'Overview' },
    { icon: <WorkIcon sx={{ fontSize: 18 }} />, label: 'Work' },
    { icon: <EmergencyIcon sx={{ fontSize: 18 }} />, label: 'Emergency Contact & Family' },
    { icon: <DocumentIcon sx={{ fontSize: 18 }} />, label: 'Documents' },
    { icon: <AssetIcon sx={{ fontSize: 18 }} />, label: 'Company Assets' },
  ];

  const handlePersonalInfoSaved = (patch: Partial<UserProfile>) => {
    setUserProfile((prev) => prev ? { ...prev, ...patch } : prev);
    refreshProfileCompletion();
  };

  const handleDocumentsUploaded = (documents: OnboardingDocument[]) =>
    setUserProfile((prev) => prev ? { ...prev, documents } : prev);

  const handleSignatureUploaded = (signature: EmployeeSignature) =>
    setUserProfile((prev) => prev ? { ...prev, signature } : prev);

  const handleAssetsSaved = (companyAssets: CompanyAssets) =>
    setUserProfile((prev) => prev ? { ...prev, companyAssets } : prev);

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center pt-16 md:pt-10">
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={40} thickness={5} sx={{ color: '#3F6FE8' }} />
            <Typography color="#6B7280" fontSize="0.85rem">Loading your profile...</Typography>
          </Box>
        </main>
      </div>
    </div>
  );

  // ProtectedRoute already guarantees a logged-in user by the time this
  // page renders; this is just a defensive fallback for the brief instant
  // before that context settles.
  if (!user || !userProfile) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 flex items-center justify-center pt-16 md:pt-20">
            <CircularProgress size={40} thickness={5} sx={{ color: '#3F6FE8' }} />
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
        <main className="flex-1 overflow-auto pt-20 md:pt-10">
        <Box sx={{ minHeight: '100%', bgcolor: '#F3F5F8', display: 'flex', flexDirection: 'column' }}>

      {/* ── Status Banner ── */}
      {errorMsg && (
        <Alert severity="warning" sx={{ borderRadius: 0, fontSize: '0.82rem' }}>
          {errorMsg}
        </Alert>
      )}

      {/* ── Hero ── */}
      <Box sx={{ background: 'linear-gradient(135deg, #3182CE 0%, #0F172A 100%)', px: { xs: 3, md: 5 }, pt: 4, pb: 0, position: 'relative' }}>
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <ProfileProgressBadge profile={userProfile} />
        <Stack direction="row" spacing={3} alignItems="flex-end">
          <Avatar sx={{ width: 88, height: 88, border: '4px solid rgba(255,255,255,0.9)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', bgcolor: '#CBD5E0', fontSize: '2rem', fontWeight: 800, mb: '-28px' }}>
            {userProfile?.full_name?.[0]}
          </Avatar>
          <Box sx={{ pb: '32px' }}>
            <Typography variant="h6" fontWeight="800" color="white" sx={{ lineHeight: 1.2 }}>{userProfile?.full_name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
              <Chip label={currentRole} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 700, fontSize: '0.72rem', border: '1px solid rgba(255,255,255,0.3)' }} />
              {userProfile?.empId && (
                <Chip label={`ID: ${userProfile.empId}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.72rem', border: '1px solid rgba(255,255,255,0.25)' }} />
              )}
              <Typography fontSize="0.82rem" color="rgba(255,255,255,0.85)" fontWeight={500}>{userProfile?.designation} &bull; {userProfile?.department}</Typography>
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

            {/* ══ 1. OVERVIEW (editable) ══ */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2.5, alignItems: 'start' }}>
                <ProfileCompletion profile={userProfile} />
                {/* Official Email is folded in here as a read-only leading
                    row, rather than its own near-empty card — it's the
                    account's login identifier, kept in sync with
                    Onboarding/Configuration elsewhere, so it isn't safe to
                    self-edit here. */}
                <EditableSectionCard
                  title="Personal Details" icon={<PersonIcon sx={{ fontSize: 17 }} />}
                  leadingField={{ label: 'Official Email ID', value: userProfile?.official_email }}
                  fields={OVERVIEW_FIELDS}
                  profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                />
              </Box>
            </TabPanel>

            {/* ══ 2. WORK (not editable — from Onboarding) ══ */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <SectionCard title="Position Details" icon={<WorkIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Date of Joining" value={formatDateDisplay(userProfile?.joining_date) || userProfile?.joining_date} />
                    <FieldRow label="Job Location" value={userProfile?.job_location} />
                    <FieldRow label="Department" value={userProfile?.department} />
                    <FieldRow label="Designation" value={userProfile?.designation} />
                    <FieldRow label="Reporting Manager" value={userProfile?.reporting_head} />
                    <FieldRow label="Employment Type" value={userProfile?.employee_category} />
                  </SectionCard>
                </Box>
                <Box>
                  <SectionCard title="Status" icon={<CalendarIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Employee Status" value={userProfile?.joining_status === 'Joined' ? 'Joined' : 'Not Joined'} />
                    <FieldRow label="Probation Period Status" value={confirmationStatusLabel(userProfile?.confirmationStatus)} />
                  </SectionCard>
                  <SectionCard title="Reporting" icon={<TeamIcon sx={{ fontSize: 17 }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                      <Avatar sx={{ width: 40, height: 40, bgcolor: '#3F6FE8', fontSize: '0.9rem', fontWeight: 700 }}>
                        {(userProfile?.reporting_head || 'M')[0]}
                      </Avatar>
                      <Box>
                        <Typography fontWeight="700" fontSize="0.85rem" color="#1A1F36">{userProfile?.reporting_head || '—'}</Typography>
                        <Typography fontSize="0.75rem" color="#6B7280">Reporting Manager</Typography>
                      </Box>
                    </Box>
                  </SectionCard>
                </Box>
              </Box>
            </TabPanel>

            {/* ══ 3. EMERGENCY CONTACT AND FAMILY (editable) ══ */}
            <TabPanel value={tabValue} index={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <EditableSectionCard
                    title="Emergency Contact" icon={<EmergencyIcon sx={{ fontSize: 17 }} />}
                    fields={EMERGENCY_CONTACT_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                  <EditableSectionCard
                    title="Citizenship Details" icon={<CitizenshipIcon sx={{ fontSize: 17 }} />}
                    fields={CITIZENSHIP_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
                <Box sx={{ gridColumn: { md: 'span 2' } }}>
                  <FamilyCard profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved} />
                </Box>
              </Box>
            </TabPanel>

            {/* ══ 4/5/6. DOCUMENTS — Personal Documents, Employment Documents, Bank (editable/uploadable) ══ */}
            <TabPanel value={tabValue} index={3}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <SectionCard title="Personal Documents" icon={<OnboardingIcon sx={{ fontSize: 17 }} />}>
                    {!userProfile?._id && (
                      <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.76rem' }}>
                        No onboarding record is linked to this account yet — uploads can't be saved until one exists.
                      </Alert>
                    )}
                    <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', mb: 1 }}>
                      Max file size: 10MB per document (PDF, DOC, DOCX, JPG, or PNG)
                    </Typography>
                    <List disablePadding sx={{ mx: -3, mb: -2.5 }}>
                      <DocumentItem docType="resume" title="Resume" subtitle="Your latest resume/CV" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'resume')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="personalPhoto" title="Personal Photograph" subtitle="Passport-size photo" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'personalPhoto')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="tenthMarksheet" title="10th Marksheet" subtitle="Class X board certificate" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'tenthMarksheet')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="twelfthMarksheet" title="12th Marksheet" subtitle="Class XII board certificate" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'twelfthMarksheet')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="graduationMarksheet" title="Graduation Marksheet" subtitle="Bachelor's degree transcripts" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'graduationMarksheet')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="pgMarksheet" title="Postgraduate Marksheet" subtitle="Master's / PG degree (if applicable)" requiredTag="Optional" requiredTagColor="#6B7280"
                        doc={latestDocFor(userProfile?.documents, 'pgMarksheet')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="aadhaarCard" title="Aadhaar Card" subtitle="Government identity proof" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'aadhaarCard')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="panCard" title="PAN Card" subtitle="Government identity proof" requiredTag="Required" requiredTagColor="#E53E3E"
                        doc={latestDocFor(userProfile?.documents, 'panCard')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem docType="uanCard" title="UAN Card" subtitle="Universal Account Number card" requiredTag="Optional" requiredTagColor="#6B7280"
                        doc={latestDocFor(userProfile?.documents, 'uanCard')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                    </List>
                  </SectionCard>
                </Box>
                <Box>
                  <SectionCard title="Employment Documents" icon={<LetterIcon sx={{ fontSize: 17 }} />}>
                    <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', mb: 1 }}>
                      Official letters are generated live from your record — only the ones that actually apply to you are listed. Experience Letter is a 10MB-max upload.
                    </Typography>
                    <List disablePadding sx={{ mx: -3, mb: -2.5 }}>
                      {OFFICIAL_LETTER_TYPES.filter(lt => lt.isAvailable(userProfile)).map(lt => (
                        <DocumentItem key={lt.type} title={lt.label} subtitle={lt.subtitle}
                          staticHref={lt.directLink || `/letter?type=${encodeURIComponent(lt.type)}&empId=${encodeURIComponent(userProfile?._id || '')}`} />
                      ))}
                      <DocumentItem docType="experienceLetter" title="Experience Letter" subtitle="For previous employment (if applicable)" requiredTag="Optional" requiredTagColor="#6B7280"
                        doc={latestDocFor(userProfile?.documents, 'experienceLetter')} employeeId={userProfile?._id} onUploaded={handleDocumentsUploaded} />
                      <DocumentItem title="Payslips" subtitle="Not set up yet" requiredTag="Not available" requiredTagColor="#9CA3AF" />
                    </List>
                  </SectionCard>
                  <SignatureCard
                    signature={userProfile?.signature}
                    employeeId={userProfile?._id}
                    onUploaded={handleSignatureUploaded}
                  />
                </Box>
                <Box>
                  <EditableSectionCard
                    title="Bank Details" icon={<BankIcon sx={{ fontSize: 17 }} />}
                    fields={BANK_FIELDS}
                    profile={userProfile} employeeId={userProfile?._id} onSaved={handlePersonalInfoSaved}
                  />
                </Box>
              </Box>
            </TabPanel>

            {/* ══ 7. COMPANY ASSETS (editable) ══ */}
            <TabPanel value={tabValue} index={4}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <CompanyAssetsCard
                    assets={userProfile?.companyAssets}
                    employeeId={userProfile?._id}
                    defaultDate={userProfile?.joining_date}
                    onSaved={handleAssetsSaved}
                  />
                </Box>
              </Box>
            </TabPanel>

          </Box>
        </Fade>
      </Box>
        </Box>
        </main>
      </div>
    </div>
  );
}
