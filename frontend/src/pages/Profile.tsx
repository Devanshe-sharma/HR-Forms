import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Grid,
  Chip,
  Divider,
  Button,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Link,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  Badge as BadgeIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Description as DocumentIcon,
  School as TrainingIcon,
  Assessment as EvaluationIcon,
  Group as TeamIcon,
  ArrowForward as ArrowForwardIcon,
  Dashboard as DashboardIcon,
  ExitToApp as ExitIcon,
} from '@mui/icons-material';
import { getRole, hasAnyRole } from '../config/rbac';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

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
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

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

export default function Profile() {
  const [tabValue, setTabValue] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const currentRole = getRole();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      // Get current user's email from localStorage or another source
      const userEmail = localStorage.getItem('userEmail') || '';
      
      // If we have a user endpoint, use it. Otherwise, use mock data for now
      if (userEmail) {
        const response = await axios.get(`${API_BASE}/employees?email=${userEmail}`);
        if (response.data.success && response.data.data.length > 0) {
          setUserProfile(response.data.data[0]);
        }
      } else {
        // Mock data for demonstration
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
      console.error('Error fetching user profile:', err);
      setError('Failed to load profile');
      // Set mock data on error
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
    const roleColors: Record<string, string> = {
      'Admin': '#ef4444',
      'HR': '#3b82f6',
      'Manager': '#10b981',
      'HeadOfDepartment': '#f59e0b',
      'Trainer': '#8b5cf6',
      'Management': '#6366f1',
      'Employee': '#6b7280',
    };
    return roleColors[role || ''] || '#6b7280';
  };

  const getPermissionsForRole = (role: string | null) => {
    const permissionMap: Record<string, string[]> = {
      'Admin': ['Full system access', 'User management', 'All modules', 'System configuration'],
      'HR': ['Employee management', 'Training setup', 'Recruitment', 'Onboarding'],
      'Manager': ['Team management', 'Performance reviews', 'Training assignments'],
      'HeadOfDepartment': ['Department oversight', 'Team management', 'Training suggestions'],
      'Trainer': ['Content creation', 'Training delivery', 'Material management'],
      'Management': ['Approvals', 'Reports', 'Strategic oversight'],
      'Employee': ['Personal data', 'Training access', 'Feedback submission'],
    };
    return permissionMap[role || ''] || [];
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography>Loading profile...</Typography>
      </Box>
    );
  }

  if (error && !userProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Quick Navigation Bar */}
      <Paper sx={{ mb: 3, p: 2, bgcolor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">Quick Navigation:</Typography>
          <Button
            size="small"
            startIcon={<DashboardIcon />}
            onClick={() => navigate('/hr-dashboard')}
            sx={{ textTransform: 'none' }}
          >
            Dashboard
          </Button>
          <Button
            size="small"
            startIcon={<SettingsIcon />}
            onClick={() => navigate('/settings')}
            sx={{ textTransform: 'none' }}
          >
            Settings
          </Button>
          <Button
            size="small"
            startIcon={<ExitIcon />}
            onClick={() => navigate('/logout')}
            sx={{ textTransform: 'none' }}
          >
            Logout
          </Button>
        </Box>
      </Paper>

      <Typography variant="h4" fontWeight="bold" gutterBottom>
        My Profile
      </Typography>

      {/* Profile Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid>
              <Avatar
                sx={{ width: 100, height: 100, bgcolor: getRoleColor(currentRole) }}
                src={userProfile?.photo}
              >
                {userProfile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </Avatar>
            </Grid>
            <Grid>
              <Typography variant="h4" fontWeight="bold">
                {userProfile?.full_name || 'Unknown User'}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                {userProfile?.designation} • {userProfile?.department}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={currentRole || 'No Role'}
                  sx={{
                    backgroundColor: getRoleColor(currentRole),
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Profile tabs"
        >
          <Tab label="Personal Information" icon={<PersonIcon />} />
          <Tab label="Permissions" icon={<BadgeIcon />} />
          <Tab label="My Documents" icon={<DocumentIcon />} />
          {hasAnyRole(['Manager', 'HeadOfDepartment']) && (
            <Tab label="Team" icon={<TeamIcon />} />
          )}
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><PersonIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Full Name" secondary={userProfile?.full_name || '—'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><BadgeIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Employee ID" secondary={userProfile?.employee_id || '—'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><EmailIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Official Email" secondary={userProfile?.official_email || '—'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CalendarIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Joining Date" secondary={userProfile?.joining_date || '—'} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Work Information</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><BusinessIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Department" secondary={userProfile?.department || '—'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><WorkIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Designation" secondary={userProfile?.designation || '—'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><BadgeIcon color="primary" /></ListItemIcon>
                    <ListItemText primary="Level" secondary={`L${userProfile?.level || 1}`} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Role & Permissions</Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Current Role: <strong>{currentRole}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on your role, you have access to the following:
              </Typography>
            </Box>
            <List>
              {getPermissionsForRole(currentRole).map((permission, index) => (
                <ListItem key={index}>
                  <ListItemIcon><BadgeIcon color="primary" /></ListItemIcon>
                  <ListItemText primary={permission} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>My Documents</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Access your personal documents and letters here.
            </Typography>
            <List>
              <ListItem component={Link} href="/employee-letters" sx={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemIcon><DocumentIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Employee Letters" secondary="View salary revision, confirmation letters" />
                <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
              </ListItem>
              <ListItem component={Link} href="/training-page?tab=employee" sx={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemIcon><TrainingIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Training Certificates" secondary="View completed training certificates" />
                <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
              </ListItem>
              <ListItem component={Link} href="/pms?tab=summary" sx={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemIcon><EvaluationIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Performance Reports" secondary="View your performance evaluations" />
                <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
              </ListItem>
              <ListItem component={Link} href="/attendance?tab=leaves" sx={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemIcon><CalendarIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Leave History" secondary="View your leave balance and history" />
                <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </TabPanel>

      {hasAnyRole(['Manager', 'HeadOfDepartment']) && (
        <TabPanel value={tabValue} index={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Team Information</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Manage your team members and their activities.
              </Typography>
              <List>
                <ListItem component={Link} href="/employees" sx={{ textDecoration: 'none', color: 'inherit' }}>
                  <ListItemIcon><TeamIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Team Members" secondary="View and manage your team" />
                  <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
                </ListItem>
                <ListItem component={Link} href="/pms?tab=kpi" sx={{ textDecoration: 'none', color: 'inherit' }}>
                  <ListItemIcon><EvaluationIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Team Performance" secondary="Review team evaluations" />
                  <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
                </ListItem>
                <ListItem component={Link} href="/training-page?tab=manager" sx={{ textDecoration: 'none', color: 'inherit' }}>
                  <ListItemIcon><TrainingIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Team Training" secondary="Assign and track team training" />
                  <ArrowForwardIcon color="action" sx={{ ml: 'auto' }} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </TabPanel>
      )}
    </Box>
  );
}
