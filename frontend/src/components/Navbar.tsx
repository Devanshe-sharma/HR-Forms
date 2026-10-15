import { AppBar, Toolbar, Typography, Tabs, Tab, Box, Button, IconButton, Avatar, Menu, MenuItem, ListItemIcon, Divider } from '@mui/material';

import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { hasAnyRole, trainingTabVisibility, defaultTrainingTab } from '../config/rbac';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const buildProfilePictureThumbnailUrl = (driveFileId: string) =>
  `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w96`;

import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LockResetIcon from '@mui/icons-material/LockReset';




const drawerWidth = 260;



const pageTitles: Record<string, string> = {

  '/hr-dashboard':         'Dashboard',

  '/employees':            'Employees List',

  '/candidates':           'Candidates',

  '/dept-designation-master': 'Dept & Designation Master',

  '/salary-revision':      'Salary revision',

  '/employee-letters':     'Employee Letters',

  '/escalations':          'Escalations',
  '/grievances':           'Grievances',

  '/recruitment':          'All Requisitions',

  '/applicants':           'All Applicants',

  '/scoring':              'Recruitment Scoring',

  '/onboarding':           'Onboarding',

  '/training-page':        'Trainings',

  '/outing':               'Outing / Event',

  '/attendance':           'Hygiene Factors',

  '/checklist-delegation': 'Check List & Delegation',

  '/requisition':          'Requisition',

  '/confirmations':        'Confirmations',

  '/salary-sheet':         'Salary Sheet',

  '/pms':                  'Performance Management System',

  '/exits':                'Exit Dashboard',

  '/exits/dashboard':      'Exit Dashboard',

  '/new-exit':             'New Exit',

  '/exits/update':         'Update Exit',

  '/company-orientation':  'Company Orientation',

  '/dept-orientation':     'Department Orientation',

  '/profile':              'Profile',

  '/configuration':             'Configruation',

};



// ─── Tab definitions ──────────────────────────────────────────────────────────



const OUTING_TABS = [

  { label: 'HR',                value: 'HR' },

  { label: 'Management Approvals', value: 'management' },

  { label: 'Scheduled & Completed', value: 'outings-view' },

  { label: 'Employee Feedback', value: 'employee-feedback' },

  { label: 'Scorecard',         value: 'scorecard' },

];



const TRAINING_TABS = [

  { label: 'HR',                  value: 'HR' },

  // Manager Evaluation & Skill Gap tabs removed from nav per request (2026-10-13) — keep commented, not deleted.
  // { label: 'Manager Evaluation',  value: 'manager' },

  // { label: 'Skill Gap',           value: 'skillgap' },

  { label: 'Management', value: 'management' },

  { label: 'Employee',            value: 'employee' },

  { label: 'Training Delivery',   value: 'delivery' },

  { label: 'Scorecard',           value: 'scorecard' },

];



const TRAINING_HR_SUBTABS = [

  { label: 'Capability',  value: 'capability' },

  { label: 'Topics',      value: 'topics' },

  { label: 'Scheduling',  value: 'scheduling' },

];



const TRAINING_EMP_SUBTABS = [

  { label: 'Assessment', value: 'assessment' },

  { label: 'Feedback',   value: 'feedback' },

];



const PMS_TABS = [

  { label: 'KPI & Targets',     value: 'kpi' },

  { label: 'Hygiene Factors',   value: 'hygiene' },

  { label: 'Growth',            value: 'growth' },

  { label: 'Final Performance', value: 'summary' },

];



// ─── Styles ───────────────────────────────────────────────────────────────────



const BLUE_TAB_STYLES = {

  minHeight: 40,

  '& .MuiTab-root': {

    color: 'rgba(255,255,255,0.7)',

    fontWeight: 600,

    fontSize: '0.78rem',

    textTransform: 'none' as const,

    minHeight: 40,

    px: 2.5,

    '&.Mui-selected': { color: '#ffffff' },

  },

};



const WHITE_TAB_STYLES = {

  minHeight: 40,

  '& .MuiTab-root': {

    color: 'rgba(0,0,0,0.45)',

    fontWeight: 600,

    fontSize: '0.78rem',

    textTransform: 'none' as const,

    minHeight: 40,

    px: 2.5,

    '&.Mui-selected': { color: '#1d1d1d' },

  },

};



const TOOLBAR_H  = 56;

const TAB_ROW_H  = 40;



// ─── Component ────────────────────────────────────────────────────────────────



export default function Navbar() {

  const nav = useNavigate();

  const loc = useLocation();

  const { darkMode, toggleDarkMode } = useTheme();

  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    nav('/login', { replace: true });
  };

  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const profileMenuOpen = Boolean(profileMenuAnchor);
  const closeProfileMenu = () => setProfileMenuAnchor(null);
  const initials = (user?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  // Same self-service DP (profile picture) the Profile page's avatar shows —
  // fetched independently here since the Navbar is mounted on every page and
  // AuthUser (the login session) never carries it, only the Onboarding record
  // does. Best-effort: a missing/failed lookup just falls back to initials.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.email) { setAvatarUrl(null); return; }
    let cancelled = false;
    axios.get(`${API_URL}/onboarding/by-email`, { params: { email: user.email } })
      .then((res) => {
        if (cancelled) return;
        const pic = res.data?.data?.profilePicture;
        setAvatarUrl(pic?.driveFileId ? buildProfilePictureThumbnailUrl(pic.driveFileId) : null);
      })
      .catch(() => { if (!cancelled) setAvatarUrl(null); });
    return () => { cancelled = true; };
  }, [user?.email]);



  const sp           = new URLSearchParams(loc.search);

  const activeTab    = sp.get('tab')    || '';

  const activeHrSub  = sp.get('hrSub')  || 'capability';

  const activeEmpSub = sp.get('empSub') || 'assessment';



  const isOutingPage   = loc.pathname === '/outing';

  const isTrainingPage = loc.pathname === '/training-page';

  const isPmsPage      = loc.pathname === '/pms';



  const showTrainingHrSub  = isTrainingPage && activeTab === 'HR';

  const showTrainingEmpSub = isTrainingPage && activeTab === 'employee';



  const pageTitle = pageTitles[loc.pathname] || 'HR Portal';



  // Blue tab row — inside AppBar (only outing/pms still blue)

  const renderBlueTabRow = (

    tabs: { label: string; value: string }[],

    activeValue: string,

    onChange: (v: string) => void,

  ) => (

    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.2)', px: 2 }}>

      <Tabs

        value={activeValue || tabs[0].value}

        onChange={(_, v: string) => onChange(v)}

        textColor="inherit"

        TabIndicatorProps={{ style: { backgroundColor: '#ffffff', height: 3 } }}

        sx={BLUE_TAB_STYLES}

      >

        {tabs.map(t => <Tab key={t.value} label={t.label} value={t.value} />)}

      </Tabs>

    </Box>

  );



  // White tab row — fixed strip outside AppBar

  const renderWhiteTabRow = (

    tabs: { label: string; value: string }[],

    activeValue: string,

    onChange: (v: string) => void,

    topOffset: number,

  ) => (

    <Box sx={{

      position: 'fixed', top: topOffset, left: drawerWidth, right: 0, zIndex: 1099,

      backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb',

      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', px: 2,

    }}>

      <Tabs

        value={activeValue || tabs[0].value}

        onChange={(_, v: string) => onChange(v)}

        textColor="inherit"

        TabIndicatorProps={{ style: { backgroundColor: '#4A6427', height: 3 } }}

        sx={WHITE_TAB_STYLES}

      >

        {tabs.map(t => <Tab key={t.value} label={t.label} value={t.value} />)}

      </Tabs>

    </Box>

  );



  const row1Top = TOOLBAR_H;

  const row2Top = TOOLBAR_H + TAB_ROW_H;



  return (

    <>

      {/* Blue AppBar — title only */}

      <AppBar position="fixed" sx={{

        width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px`,

        backgroundColor: '#4A6427', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',

        height: TOOLBAR_H,

      }}>

        <Toolbar sx={{ px: 4, minHeight: `${TOOLBAR_H}px !important`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          <Typography variant="h6" fontWeight={700} color="white">{pageTitle}</Typography>

          <Box
            onClick={toggleDarkMode}
            sx={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center',
              gap: 1,
              padding: '4px 8px',
              borderRadius: '4px',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
          >
            {darkMode ? (
              <Brightness7Icon sx={{ color: 'white', fontSize: 20 }} />
            ) : (
              <Brightness4Icon sx={{ color: 'white', fontSize: 20 }} />
            )}
          </Box>

          <IconButton
            onClick={(e) => setProfileMenuAnchor(e.currentTarget)}
            title={user ? user.name : 'Account'}
            sx={{ p: 0.5 }}
          >
            <Avatar
              src={avatarUrl || undefined}
              sx={{
                width: 34, height: 34, fontSize: 13, fontWeight: 700,
                bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
              }}>
              {initials}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={profileMenuAnchor}
            open={profileMenuOpen}
            onClose={closeProfileMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {user && (
              <Box sx={{ px: 2, py: 1, minWidth: 180 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{user.name}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{user.email}</Typography>
              </Box>
            )}
            <Divider />
            <MenuItem onClick={() => { closeProfileMenu(); nav('/profile'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => { closeProfileMenu(); nav('/configuration'); }}>
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
              Configuration
            </MenuItem>
            <MenuItem onClick={() => { closeProfileMenu(); nav('/configuration?openPassword=1'); }}>
              <ListItemIcon><LockResetIcon fontSize="small" /></ListItemIcon>
              Change Password
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { closeProfileMenu(); handleLogout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>

        </Toolbar>

      </AppBar>



      {/* Outing white row — "Management Approvals" is HR/Admin/Management only;
          everyone else only ever sees their own department's outings, so a
          company-wide approvals queue wouldn't mean anything to them anyway. */}

      {isOutingPage && renderWhiteTabRow(

        hasAnyRole(['Admin', 'HR', 'Management']) ? OUTING_TABS : OUTING_TABS.filter(t => t.value !== 'management'),
        activeTab || 'HR', v => nav(`/outing?tab=${v}`), row1Top,

      )}



      {/* Training main white row — each tab hides itself from roles that
          can't use it, so no one can click into (or land on) a tab whose
          endpoints their role would get a 403 from. */}

      {isTrainingPage && renderWhiteTabRow(

        TRAINING_TABS.filter(t => {
          const v = trainingTabVisibility();
          return t.value === 'HR' ? v.hr : v[t.value as 'management' | 'employee' | 'delivery' | 'scorecard'];
        }),
        activeTab || defaultTrainingTab(), v => nav(`/training-page?tab=${v}`), row1Top,

      )}



      {/* Training HR sub-tab white row */}

      {showTrainingHrSub && renderWhiteTabRow(

        TRAINING_HR_SUBTABS, activeHrSub, v => nav(`/training-page?tab=HR&hrSub=${v}`), row2Top,

      )}



      {/* Training Employee sub-tab white row */}

      {showTrainingEmpSub && renderWhiteTabRow(

        TRAINING_EMP_SUBTABS, activeEmpSub, v => nav(`/training-page?tab=employee&empSub=${v}`), row2Top,

      )}



      {/* PMS white row */}

      {isPmsPage && renderWhiteTabRow(

        PMS_TABS, activeTab || 'kpi', v => nav(`/pms?tab=${v}`), row1Top,

      )}

    </>

  );

}