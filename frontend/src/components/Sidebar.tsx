'use client';

import { useState } from 'react';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Collapse, Avatar, Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  BusinessCenter as BusinessCenterIcon,
  ExitToApp as ExitToAppIcon,
  AccountCircle as AccountCircleIcon,
  Settings as SettingsIcon,
  Assignment as AssignmentIcon,
  Score as ScoreIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  School as SchoolIcon,
  Event as EventIcon,
  Domain as CorporateFareIcon,
  Apartment as ApartmentIcon,
  AccessTime as AccessTimeIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  RequestPage as RequestPageIcon,
  Payments as PaymentsIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Mail as MailIcon,
  TableChart as TableChartIcon,
  BeachAccess as BeachAccessIcon,
  WorkOff as WorkOffIcon,
  Today as TodayIcon,
  Approval as ApprovalIcon,
  EmojiEvents as EmojiEventsIcon,
  // PMS sub-icons
  GpsFixed as KpiIcon,
  HealthAndSafety as HygieneIcon,
  AutoGraph as GrowthIcon,
  Leaderboard as SummaryIcon,
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';

const drawerWidth = 260;
const BRAND_BLUE  = '#3B82F6';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubItem {
  to: string;
  text: string;
  icon: React.ReactNode;
}

interface ParentItem {
  text: string;
  icon: React.ReactNode;
  onClick: () => void;
  open: boolean;
  subItems: SubItem[];
  to?: never;
}

interface LeafItem {
  to: string;
  text: string;
  icon: React.ReactNode;
  onClick?: never;
  open?: never;
  subItems?: never;
}

type MenuItem = ParentItem | LeafItem;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const location = useLocation();

  const [openAttendance, setOpenAttendance] = useState(false);
  const [openTrainings,  setOpenTrainings]  = useState(false);
  const [openOuting,     setOpenOuting]     = useState(false);
  const [openPMS,        setOpenPMS]        = useState(false);

  const isActive = (path: string): boolean => {
    const current = location.pathname + location.search;
    return current === path || current.startsWith(path + '&');
  };

  const menuItems: MenuItem[] = [
    { to: '/company-orientation',  text: 'Company Orientation',     icon: <CorporateFareIcon /> },
    { to: '/dept-orientation',     text: 'Dept Orientation',        icon: <ApartmentIcon /> },
    { to: '/hr-dashboard',         text: 'Dashboard',               icon: <DashboardIcon /> },
    { to: '/employees',            text: 'Employees',               icon: <PeopleIcon /> },

    // ── Attendance ──────────────────────────────────────────────────────────
    {
      text: 'Attendance',
      icon: <AccessTimeIcon />,
      onClick: () => setOpenAttendance(p => !p),
      open: openAttendance,
      subItems: [
        { to: '/attendance?tab=attendance',    text: 'Attendance',    icon: <TodayIcon /> },
        { to: '/attendance?tab=leaves',        text: 'Leaves',        icon: <BeachAccessIcon /> },
        { to: '/attendance?tab=out-of-office', text: 'Out of Office', icon: <WorkOffIcon /> },
      ],
    },

    { to: '/checklist-delegation', text: 'Check List & Delegation', icon: <AssignmentTurnedInIcon /> },
    { to: '/requisition',          text: 'Requisition',             icon: <RequestPageIcon /> },
    { to: '/onboarding',           text: 'Onboarding',              icon: <BusinessCenterIcon /> },

    // ── Trainings ───────────────────────────────────────────────────────────
    {
      text: 'Trainings',
      icon: <SchoolIcon />,
      onClick: () => setOpenTrainings(p => !p),
      open: openTrainings,
      subItems: [
        { to: '/training-page?tab=HR',         text: 'HR Training',         icon: <PeopleIcon /> },
        { to: '/training-page?tab=manager',    text: 'Manager',             icon: <AssignmentIcon /> },
        { to: '/training-page?tab=management', text: 'Management Approval',  icon: <ApprovalIcon /> },
        { to: '/training-page?tab=employee',   text: 'Employee',            icon: <AssignmentIcon /> },
        { to: '/training-page?tab=scorecard',  text: 'Scorecard',           icon: <EmojiEventsIcon /> },
      ],
    },

    // ── Outings / Events ────────────────────────────────────────────────────
    {
      text: 'Outings / Events',
      icon: <EventIcon />,
      onClick: () => setOpenOuting(p => !p),
      open: openOuting,
      subItems: [
        { to: '/outing?tab=HR',               text: 'HR Outing',        icon: <PeopleIcon /> },
        
        { to: '/outing?tab=management',        text: 'Management Outing', icon: <BusinessCenterIcon /> },
        { to: '/outing?tab=employee-feedback', text: 'Outing Feedback',  icon: <AssignmentIcon /> },
        { to: '/outing?tab=scorecard',         text: 'Outing Scorecard', icon: <ScoreIcon /> },
      ],
    },

    { to: '/confirmations',    text: 'Confirmations',    icon: <CheckCircleIcon /> },
    { to: '/salary-revision',  text: 'Salary Revision', icon: <TableChartIcon /> },
    { to: '/employee-letters', text: 'Employee Letters',icon: <MailIcon /> },
    { to: '/salary-sheet',     text: 'Salary Sheet',    icon: <PaymentsIcon /> },

    // ── PMS ─────────────────────────────────────────────────────────────────
    {
      text: 'PMS',
      icon: <TrendingUpIcon />,
      onClick: () => setOpenPMS(p => !p),
      open: openPMS,
      subItems: [
        { to: '/pms?tab=kpi',     text: 'KPI & Targets',     icon: <KpiIcon /> },
        { to: '/pms?tab=hygiene', text: 'Hygiene Factors',   icon: <HygieneIcon /> },
        { to: '/pms?tab=growth',  text: 'Growth',            icon: <GrowthIcon /> },
        { to: '/pms?tab=summary', text: 'Final Performance', icon: <SummaryIcon /> },
      ],
    },
    // ────────────────────────────────────────────────────────────────────────

    { to: '/exits',   text: 'Exit',    icon: <ExitToAppIcon /> },
    { to: '/profile', text: 'Profile', icon: <AccountCircleIcon /> },
    { to: '/settings',text: 'Settings',icon: <SettingsIcon /> },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          height: '100vh',
          borderRight: '1px solid #e0e0e0',
          overflowY: 'auto',
          '&::-webkit-scrollbar':       { width: '4px' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#e0e0e0', borderRadius: '4px' },
        },
      }}
    >
      {/* Brand header */}
      <Box sx={{ bgcolor: BRAND_BLUE, color: 'white', p: 3, textAlign: 'center' }}>
        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 50, height: 50, mx: 'auto', mb: 1.5 }}>
          <DashboardIcon sx={{ fontSize: 30 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={700}>HR Portal</Typography>
      </Box>

      <List sx={{ px: 2, mt: 2 }}>
        {menuItems.map(item => {
          // ── Parent with sub-items ──
          if (item.subItems) {
            const isParentActive = item.subItems.some(sub => isActive(sub.to));
            return (
              <Box key={item.text} sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={item.onClick}
                  sx={{
                    borderRadius: '8px',
                    bgcolor: isParentActive ? BRAND_BLUE : 'transparent',
                    color:   isParentActive ? 'white' : '#212121',
                    '&:hover': { bgcolor: isParentActive ? BRAND_BLUE : '#f5f5f5' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                  {item.open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>

                <Collapse in={item.open} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    {item.subItems.map(sub => {
                      const subActive = isActive(sub.to);
                      return (
                        <ListItemButton
                          key={sub.to}
                          component={NavLink}
                          to={sub.to}
                          sx={{
                            pl: 6, borderRadius: '8px', mt: 0.5,
                            bgcolor: subActive ? BRAND_BLUE : 'transparent',
                            color:   subActive ? 'white' : '#212121',
                            '&:hover': { bgcolor: subActive ? BRAND_BLUE : '#f8fafc' },
                          }}
                        >
                          <ListItemIcon sx={{ color: 'inherit', minWidth: 36, fontSize: '1rem' }}>
                            {sub.icon}
                          </ListItemIcon>
                          <ListItemText primary={sub.text} primaryTypographyProps={{ fontSize: '0.85rem' }} />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          }

          // ── Leaf item ──
          const active = isActive(item.to);
          return (
            <ListItemButton
              key={item.text}
              component={NavLink}
              to={item.to}
              sx={{
                mb: 0.5, borderRadius: '8px',
                bgcolor: active ? BRAND_BLUE : 'transparent',
                color:   active ? 'white'    : '#212121',
                '&:hover': { bgcolor: active ? BRAND_BLUE : '#f5f5f5' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem' }} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}