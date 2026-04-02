import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Divider,
  Button, Tab, Tabs, List, ListItem, ListItemText, ListItemIcon,
  Paper, Link, Fade, IconButton, Stack, CircularProgress, LinearProgress,
  Grid, Alert
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
  Folder as FolderIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as EmptyCircleIcon,
  Edit as EditIcon,
  Article as LetterIcon,
  FolderOpen as OnboardingIcon,
} from '@mui/icons-material';
import { getRole } from '../config/rbac';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.API_BASE_URL || 'http://3.110.162.1:5000/api';

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
  employment_type?: string;
  work_location?: string;
  date_of_birth?: string;
  gender?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// ─── Smart Email Detector ─────────────────────────────────────────────────────
// Checks every common place a login page might store the user's email:
//   1. localStorage / sessionStorage keys (direct email strings)
//   2. JWT tokens (decodes payload → reads email claim)
//   3. JSON objects stored in storage (parses and extracts email field)
// Returns null if nothing found → demo profile is shown instead.
function detectLoggedInEmail(): string | null {
  const COMMON_KEYS = [
    'userEmail', 'email', 'user_email', 'userinfo',
    'user', 'authUser', 'currentUser', 'loggedInUser',
    'token', 'accessToken', 'access_token', 'authToken', 'id_token',
  ];

  const decodeJWT = (token: string): string | null => {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded.email || decoded.mail || decoded.preferred_username || null;
    } catch {
      return null;
    }
  };

  const isJWT = (val: string) => val.split('.').length === 3 && val.length > 20;
  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of COMMON_KEYS) {
      try {
        const val = storage.getItem(key);
        if (!val) continue;

        // 1. Direct email string
        if (isEmail(val)) return val;

        // 2. JWT token → decode
        if (isJWT(val)) {
          const email = decodeJWT(val);
          if (email) return email;
        }

        // 3. JSON object → extract email field
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            const direct =
              parsed.email || parsed.mail || parsed.official_email ||
              parsed.user_email || parsed.userEmail;
            if (direct && isEmail(direct)) return direct;

            // Nested: { user: { email } } or { data: { email } }
            if (parsed.user?.email && isEmail(parsed.user.email)) return parsed.user.email;
            if (parsed.data?.email && isEmail(parsed.data.email)) return parsed.data.email;

            // Token nested inside object
            const tokenVal = parsed.token || parsed.accessToken || parsed.access_token;
            if (tokenVal && isJWT(tokenVal)) {
              const email = decodeJWT(tokenVal);
              if (email) return email;
            }
          }
        } catch { /* not JSON */ }
      } catch { /* storage error */ }
    }
  }

  return null;
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
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const currentRole = getRole();

  useEffect(() => { fetchUserProfile(); }, []);

  const getDemoProfile = (): UserProfile => ({
    full_name: 'Demo User', employee_id: 'BRK-0000',
    official_email: 'demo@briskolive.com', personal_email: '',
    department: 'IT Department', designation: 'Software Developer',
    level: 3, joining_date: '2024-01-15', phone: '',
    manager: 'Tanisha Sharma', employment_type: 'Full Time',
    work_location: 'Office – Noida Sector 63',
  });

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // ── Detect email from browser storage ──────────────────────────────────
      const email = detectLoggedInEmail();
      setDetectedEmail(email);

      if (!email) {
        // No session found — show demo until login page is ready
        setIsDemo(true);
        setUserProfile(getDemoProfile());
        return;
      }

      // ── Fetch from your employee API ───────────────────────────────────────
      const res = await axios.get(`${API_BASE}/employees?email=${encodeURIComponent(email)}`);

      if (res.data.success && res.data.data?.length > 0) {
        setUserProfile(res.data.data[0]);
        setIsDemo(false);
      } else {
        setErrorMsg(`No employee record found for: ${email}`);
        setIsDemo(true);
        setUserProfile(getDemoProfile());
      }
    } catch (err: any) {
      setErrorMsg('Could not reach the server. Showing demo profile.');
      setIsDemo(true);
      setUserProfile(getDemoProfile());
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string | null) => {
    const map: Record<string, string> = { Admin: '#E53E3E', HR: '#3182CE', Manager: '#38A169', HeadOfDepartment: '#D69E2E', Employee: '#6B46C1' };
    return map[role || ''] || '#4A5568';
  };

  const tabs = [
    { icon: <InfoIcon sx={{ fontSize: 18 }} />, label: 'Profile' },
    { icon: <WorkIcon sx={{ fontSize: 18 }} />, label: 'Job' },
    { icon: <FolderIcon sx={{ fontSize: 18 }} />, label: 'Documents' },
    { icon: <AssetIcon sx={{ fontSize: 18 }} />, label: 'Assets' },
  ];

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F8F9FB', gap: 2 }}>
      <CircularProgress size={40} thickness={5} sx={{ color: '#3F6FE8' }} />
      <Typography color="#6B7280" fontSize="0.85rem">Detecting your session...</Typography>
    </Box>
  );

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
          {/* Show a green pill with the detected email — confirms whose profile is loaded */}
          {detectedEmail && !isDemo && (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#059669 !important' }} />}
              label={detectedEmail}
              size="small"
              sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600, fontSize: '0.72rem', border: '1px solid #A7F3D0' }}
            />
          )}
          <Button startIcon={<SettingsIcon />} size="small" onClick={() => navigate('/configuration')} sx={{ color: '#6B7280', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem' }}>Configuration</Button>
          <Button startIcon={<ExitIcon />} size="small" color="error" onClick={() => navigate('/logout')} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem' }}>Logout</Button>
        </Stack>
      </Box>

      {/* ── Status Banner ── */}
      {(errorMsg || isDemo) && (
        <Alert severity={errorMsg ? 'warning' : 'info'} sx={{ borderRadius: 0, fontSize: '0.82rem' }}>
          {errorMsg ?? 'No login session found. Showing demo profile — once the login page is live, your real data will load automatically.'}
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

            {/* ══ PROFILE ══ */}
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
                <Box>
                  <SectionCard title="Personal Details" icon={<PersonIcon sx={{ fontSize: 17 }} />} action={<Button size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#3F6FE8' }}>Edit</Button>}>
                    <FieldRow label="Full Name" value={userProfile?.full_name} />
                    <FieldRow label="Date of Birth" value={userProfile?.date_of_birth} />
                    <FieldRow label="Gender" value={userProfile?.gender} />
                    <FieldRow label="Employee ID" value={userProfile?.employee_id} />
                    <FieldRow label="Designation" value={userProfile?.designation} />
                    <FieldRow label="Department" value={userProfile?.department} />
                  </SectionCard>
                  <SectionCard title="Contact Details" icon={<PhoneIcon sx={{ fontSize: 17 }} />} action={<Button size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#3F6FE8' }}>Edit</Button>}>
                    <FieldRow label="Official Email" value={userProfile?.official_email} />
                    <FieldRow label="Personal Email" value={userProfile?.personal_email} />
                    <FieldRow label="Phone (Work)" value={userProfile?.phone || userProfile?.mobile} />
                    <FieldRow label="Work Location" value={userProfile?.work_location} />
                    <FieldRow label="Working Address" value="G 203, Sector 63, Noida 201301" />
                  </SectionCard>
                </Box>
              </Box>
            </TabPanel>

            {/* ══ JOB ══ */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                <Box>
                  <SectionCard title="Position Details" icon={<WorkIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Job Title" value={userProfile?.designation} />
                    <FieldRow label="Department" value={userProfile?.department} />
                    <FieldRow label="Manager" value={userProfile?.manager || userProfile?.reporting_to} />
                    <FieldRow label="Coach" value={undefined} />
                    <FieldRow label="Employment Type" value={userProfile?.employment_type || 'Full Time'} />
                    <FieldRow label="Work Location" value={userProfile?.work_location} />
                  </SectionCard>
                </Box>
                <Box>
                  <SectionCard title="Employment Timeline" icon={<CalendarIcon sx={{ fontSize: 17 }} />}>
                    <FieldRow label="Date of Joining" value={userProfile?.joining_date} />
                    <FieldRow label="Probation End Date" value="—" />
                    <FieldRow label="Confirmation Date" value="—" />
                    <FieldRow label="Notice Period" value="30 Days" />
                    <FieldRow label="Employee Level" value={userProfile?.level ? `Level ${userProfile.level}` : '—'} />
                  </SectionCard>
                  <SectionCard title="Reporting" icon={<TeamIcon sx={{ fontSize: 17 }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                      <Avatar sx={{ width: 40, height: 40, bgcolor: '#3F6FE8', fontSize: '0.9rem', fontWeight: 700 }}>
                        {(userProfile?.manager || userProfile?.reporting_to || 'M')[0]}
                      </Avatar>
                      <Box>
                        <Typography fontWeight="700" fontSize="0.85rem" color="#1A1F36">{userProfile?.manager || userProfile?.reporting_to || '—'}</Typography>
                        <Typography fontSize="0.75rem" color="#6B7280">Direct Manager</Typography>
                      </Box>
                    </Box>
                  </SectionCard>
                </Box>
              </Box>
            </TabPanel>

            {/* ══ DOCUMENTS ══ */}
            <TabPanel value={tabValue} index={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
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
            <TabPanel value={tabValue} index={3}>
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