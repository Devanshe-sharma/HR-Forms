import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  Group as UserManagementIcon,
  Backup as BackupIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';
import { getRole, hasAnyRole } from '../config/rbac';
import { useTheme } from '../contexts/ThemeContext';

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
      id={`configruation-tabpanel-${index}`}
      aria-labelledby={`configruation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Configruation() {
  const [tabValue, setTabValue] = useState(0);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [language, setLanguage] = useState('english');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { darkMode, toggleDarkMode } = useTheme();
  const currentRole = getRole();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    console.log('Password change requested');
    setPasswordDialogOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    alert('Password changed successfully!');
  };

  const handleSaveSettings = () => {
    console.log('Configruation saved:', {
      emailNotifications,
      language,
    });
    alert('Configruation saved successfully!');
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Configruation
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Configruation tabs"
        >
          <Tab label="General" icon={<SettingsIcon />} />
          <Tab label="Security" icon={<SecurityIcon />} />
          {hasAnyRole(['Admin', 'HR']) && (
            <Tab label="System" icon={<AdminIcon />} />
          )}
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Appearance</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><PaletteIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Dark Mode" 
                    secondary="Toggle dark/light theme" 
                  />
                  <Switch
                    checked={darkMode}
                    onChange={toggleDarkMode}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><LanguageIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Language" 
                    secondary="Choose your preferred language" 
                  />
                  <TextField
                    select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    size="small"
                    sx={{ minWidth: 120 }}
                  >
                    <option value="english">English</option>
                    <option value="hindi">हिंदी</option>
                  </TextField>
                </ListItem>
              </List>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notifications</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><NotificationsIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Email Notifications" 
                    secondary="Receive email updates" 
                  />
                  <Switch
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                  />
                </ListItem>
              </List>
              <Box sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={handleSaveSettings}
                  sx={{ mr: 2 }}
                >
                  Save Configruation
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Security</Typography>
            <List>
              <ListItem>
                <ListItemIcon><SecurityIcon color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Change Password" 
                  secondary="Update your account password" 
                />
                <Button 
                  variant="outlined" 
                  onClick={() => setPasswordDialogOpen(true)}
                  sx={{ ml: 2 }}
                >
                  Change
                </Button>
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Change Password</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Current Password"
              type="password"
              fullWidth
              variant="outlined"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="New Password"
              type="password"
              fullWidth
              variant="outlined"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Confirm New Password"
              type="password"
              fullWidth
              variant="outlined"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} variant="contained">Change Password</Button>
          </DialogActions>
        </Dialog>
      </TabPanel>

      {hasAnyRole(['Admin', 'HR']) && (
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>User Management</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><UserManagementIcon color="primary" /></ListItemIcon>
                    <ListItemText 
                      primary="Manage Users" 
                      secondary="Add, edit, or remove user accounts" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><AdminIcon color="primary" /></ListItemIcon>
                    <ListItemText 
                      primary="Role Management" 
                      secondary="Assign roles and permissions" 
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>System Administration</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><BackupIcon color="primary" /></ListItemIcon>
                    <ListItemText 
                      primary="Backup & Restore" 
                      secondary="System backup and recovery" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><ReportIcon color="primary" /></ListItemIcon>
                    <ListItemText 
                      primary="Audit Logs" 
                      secondary="View system activity logs" 
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          Some configruation may require administrator approval. Contact your HR department for assistance.
        </Typography>
      </Alert>
    </Box>
  );
}
