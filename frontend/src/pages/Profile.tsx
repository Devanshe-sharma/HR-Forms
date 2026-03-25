import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Grid, Chip, Divider,
  Button, Tab, Tabs, List, ListItem, ListItemText, ListItemIcon,
  Paper, Link, Fade, IconButton, Stack, CircularProgress
} from '@mui/material';
import {
  Person as PersonIcon, Email as EmailIcon, Business as BusinessIcon,
  Work as WorkIcon, CalendarToday as CalendarIcon, Badge as BadgeIcon,
  Settings as SettingsIcon, Description as DocumentIcon, School as TrainingIcon,
  Assessment as EvaluationIcon, Group as TeamIcon, ChevronRight as ArrowIcon,
  Dashboard as DashboardIcon, Logout as ExitIcon, VerifiedUser as ShieldIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { getRole, hasAnyRole } from '../config/rbac';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_URL || 'http://13.235.0.127:5000/api';

// Add CSS keyframes for gradient animation
const gradientAnimation = `
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

// --- Interfaces ---
interface UserProfile {
  _id?: string;
  full_name: string;
  employee_id?: string;
  official_email: string;
  department: string;
  designation: string;
  level?: number;
  joining_date?: string;
  photo?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// --- Helper Components ---
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 1 }}>{children}</Box>}
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <Card sx={{ 
      borderRadius: 4, 
      border: '1px solid rgba(226, 232, 240, 0.8)', 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', 
      mb: 2,
      backdropFilter: 'blur(8px)',
      background: 'rgba(255, 255, 255, 0.9)'
    }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
          <Typography variant="h6" fontWeight="700" color="text.primary">{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string, value: any }) {
  return (
    <Box sx={{ flex: { xs: '1 1 100%', sm: '0 0 45%' }, mb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight="600" sx={{ mt: 0.5, color: '#1e293b' }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function DocumentListItem({ title, subtitle, href }: { title: string, subtitle: string, href: string }) {
  return (
    <ListItem 
      component={Link} 
      href={href} 
      sx={{ 
        py: 2.5, px: 3, textDecoration: 'none', color: 'inherit',
        transition: 'all 0.2s',
        '&:hover': { bgcolor: 'rgba(241, 245, 249, 0.5)', transform: 'translateX(4px)' }
      }}
    >
      <ListItemIcon>
        <Box sx={{ p: 1.2, bgcolor: '#eff6ff', borderRadius: 2, display: 'flex' }}>
          <DocumentIcon color="primary" fontSize="small" />
        </Box>
      </ListItemIcon>
      <ListItemText 
        primary={<Typography fontWeight="700" variant="body1">{title}</Typography>} 
        secondary={<Typography variant="body2" color="text.secondary">{subtitle}</Typography>} 
      />
      <IconButton size="small" sx={{ bgcolor: '#f8fafc' }}><ArrowIcon fontSize="small" /></IconButton>
    </ListItem>
  );
}

// --- Main Component ---
export default function Profile() {
  const [tabValue, setTabValue] = useState(0);
  const [detailTabValue, setDetailTabValue] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentRole = getRole();

  useEffect(() => {
    fetchUserProfile();
    
    // Inject gradient animation CSS
    const styleElement = document.createElement('style');
    styleElement.textContent = gradientAnimation;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const userEmail = localStorage.getItem('userEmail') || '';
      
      if (userEmail) {
        const response = await axios.get(`${API_BASE}/employees?email=${userEmail}`);
        if (response.data.success && response.data.data.length > 0) {
          setUserProfile(response.data.data[0]);
        }
      } else {
        setUserProfile({
          full_name: 'Demo User',
          official_email: 'demo@company.com',
          department: 'IT Department',
          designation: 'Software Engineer',
          level: 3,
          joining_date: '2024-01-15',
        });
      }
    } catch (err) {
      setUserProfile({
        full_name: 'Demo User',
        official_email: 'demo@company.com',
        department: 'IT Department',
        designation: 'Software Engineer',
        level: 3,
        joining_date: '2024-01-15',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string | null) => {
    const colors: Record<string, string> = {
      'Admin': '#f43f5e', 'HR': '#3b82f6', 'Manager': '#10b981',
      'HeadOfDepartment': '#f59e0b', 'Employee': '#6366f1'
    };
    return colors[role || ''] || '#64748b';
  };

  const getPermissionsForRole = (role: string | null) => {
    const permissionMap: Record<string, string[]> = {
      'Admin': ['Full system access', 'User management', 'All modules'],
      'HR': ['Employee management', 'Training setup', 'Onboarding'],
      'Manager': ['Team management', 'Performance reviews'],
      'Employee': ['Personal data', 'Training access'],
    };
    return permissionMap[role || ''] || [];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#f8fafc' }}>
        <CircularProgress thickness={5} size={50} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      overflow: 'hidden',
      // Enhanced full-page background gradient
      background: `
        linear-gradient(135deg, #667eea 0%, #764ba2 25% , #4facfe 100%),
        radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
      `,
      backgroundSize: '400% 400%',
      backgroundAttachment: 'fixed',
      animation: 'gradientShift 15s ease infinite',
      bgcolor: '#f8fafc',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(1px)',
        zIndex: -1
      }
    }}>
      {/* 1. Sleek Navigation Header */}
      <Box sx={{ 
        bgcolor: 'rgba(255, 255, 255, 0.8)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0', 
        px: { xs: 2, md: 4 }, py: 1.5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 1000,
        flexShrink: 0
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ bgcolor: 'primary.main', p: 0.8, borderRadius: 1.5, display: 'flex' }}>
            <DashboardIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography variant="subtitle1" fontWeight="800" sx={{ letterSpacing: -0.5 }}>HR PORTAL</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<SettingsIcon />} size="small" onClick={() => navigate('/configuration')} sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}>Configuration</Button>
          <Button startIcon={<ExitIcon />} size="small" color="error" onClick={() => navigate('/logout')} sx={{ textTransform: 'none', fontWeight: 600 }}>Logout</Button>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 1150, mx: 'auto', px: 3, flex: 1, overflow: 'hidden' }}>
        {/* 2. Hero Profile Section */}
        <Box sx={{ 
          position: 'relative', mb: 4, borderRadius: 5, height: 100,
          background: `linear-gradient(135deg, ${getRoleColor(currentRole)} 0%, #0f172a 100%)`,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }}>
          <Box sx={{ position: 'absolute', bottom: -30, left: { xs: 20, md: 40 }, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            <Avatar
              sx={{ 
                width: { xs: 60, md: 80 }, height: { xs: 60, md: 80 }, 
                border: '6px solid #fff', 
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', 
                bgcolor: '#cbd5e1', fontSize: '1.5rem', fontWeight: 700
              }}
              src={userProfile?.photo}
            >
              {userProfile?.full_name?.[0]}
            </Avatar>
            <Box sx={{ pb: 1 }}>
              <Typography variant="h6" fontWeight="900" sx={{ color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.3)', lineHeight: 1.2 }}>
                {userProfile?.full_name}
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
                <Chip 
                  label={currentRole} 
                  size="small" 
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }} 
                />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {userProfile?.designation} • {userProfile?.department}
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Box>

        {/* 3. Main Content Grid */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 28%' } }}>
            <Paper sx={{ 
              borderRadius: 4, overflow: 'hidden', border: '1px solid #e2e8f0', 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', bgcolor: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(8px)'
            }}>
              <Tabs
                orientation="vertical"
                value={tabValue}
                onChange={(e, v) => setTabValue(v)}
                sx={{
                  '& .MuiTab-root': {
                    alignItems: 'flex-start', py: 2.5, px: 3, textTransform: 'none', fontWeight: 700,
                    color: 'text.secondary', transition: 'all 0.2s',
                    minWidth: 120,
                    flex: 1,
                    '&:hover': { bgcolor: '#f1f5f9' }
                  },
                  '& .Mui-selected': { bgcolor: '#eff6ff', color: 'primary.main !important' },
                  '& .MuiTabs-indicator': { width: 4, borderRadius: '0 4px 4px 0' }
                }}
              >
                <Tab icon={<InfoIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Public Information" />
                <Tab icon={<PersonIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Personal Information" />
                <Tab icon={<SettingsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="HR Configuration" />
                {hasAnyRole(['Manager', 'HeadOfDepartment']) && (
                  <Tab icon={<TeamIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="My Team" />
                )}
              </Tabs>
            </Paper>
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 68%' } }}>
            <Fade in={true} timeout={600}>
              <Box>
                <TabPanel value={tabValue} index={0}>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                    {/* Contact Information Section */}
                    <Box sx={{ flex: 1 }}>
                      <Card sx={{ 
                        borderRadius: 2, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
                        mb: 1,
                        bgcolor: 'background.paper'
                      }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="h6" fontWeight="600" sx={{ mb: 2, color: 'text.primary' }}>
                            Contact Information
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Working Address
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                Brisk Olive Business Solutions Pvt Ltd G 203 (Second Floor) Sector 63, Noida 201301
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Work Mobile
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                9319022243
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Work Location
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                Office
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Work Email
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                software.engineeringintern@briskolive.com
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Work Phone
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                9319022243
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>

                    {/* Position Section */}
                    <Box sx={{ flex: 1 }}>
                      <Card sx={{ 
                        borderRadius: 2, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
                        mb: 1,
                        bgcolor: 'background.paper'
                      }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="h6" fontWeight="600" sx={{ mb: 2, color: 'text.primary' }}>
                            Position
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Department
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                Management / Data Analytics and Automation
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Job Title
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                Software Developer
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Manager
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                Tanisha Sharma
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Coach
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                —
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                                Is a Manager
                              </Typography>
                              <Box sx={{ 
                                width: 16, height: 16, 
                                border: '2px solid #d1d5db', 
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}>
                              </Box>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                  <InfoCard title="Role & Permissions" icon={<ShieldIcon />}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                      Your account is assigned the <Chip label={currentRole} size="small" sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }} /> role. This grants you the following workspace capabilities:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {getPermissionsForRole(currentRole).map((p, i) => (
                        <Box key={i} sx={{ flex: { xs: '1 1 100%', sm: '0 0 45%' } }}>
                          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, boxShadow: 'none' }}>
                            <BadgeIcon fontSize="small" color="primary" />
                            <Typography variant="body2" fontWeight="600">{p}</Typography>
                          </Paper>
                        </Box>
                      ))}
                    </Box>
                  </InfoCard>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                   <Card sx={{ borderRadius: 4, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                     <List disablePadding>
                        <DocumentListItem title="Salary & Revision Letters" subtitle="Official compensation and increment documents" href="/employee-letters" />
                        <Divider sx={{ opacity: 0.6 }} />
                        <DocumentListItem title="Learning Portfolio" subtitle="Course completion certificates and progress" href="/training-page?tab=employee" />
                        <Divider sx={{ opacity: 0.6 }} />
                        <DocumentListItem title="Performance Appraisals" subtitle="Quarterly and annual historical reviews" href="/pms?tab=summary" />
                     </List>
                   </Card>
                </TabPanel>
              </Box>
            </Fade>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}