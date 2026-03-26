'use client';

import React, { useState, useEffect } from 'react';
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
  BeachAccess as BeachAccessIcon,
  WorkOff as WorkOffIcon,
  Today as TodayIcon,
  Approval as ApprovalIcon,
  EmojiEvents as EmojiEventsIcon,
  GpsFixed as KpiIcon,
  HealthAndSafety as HygieneIcon,
  AutoGraph as GrowthIcon,
  Leaderboard as SummaryIcon,
  MonetizationOn as MonetizationOnIcon,
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';

const drawerWidth = 260;
const BRAND_BLUE = '#3B82F6';

// ─── Types ─────────────────────────────────────
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
}

interface LeafItem {
  to: string;
  text: string;
  icon: React.ReactNode;
}

type MenuItem = ParentItem | LeafItem;

// ─── Component ─────────────────────────────────
export default function Sidebar() {
  const location = useLocation();

  const [openAttendance, setOpenAttendance] = useState(false);
  const [openTrainings, setOpenTrainings] = useState(false);
  const [openOuting, setOpenOuting] = useState(false);
  const [openPMS, setOpenPMS] = useState(false);

  const isActive = (path: string): boolean => {
    const current = location.pathname + location.search;
    return current === path || current.startsWith(path + '&');
  };

  // Auto-expand parent menus if any sub-item is active
  useEffect(() => {
    // Check if any attendance sub-item is active
    const attendanceActive = [
      '/attendance?tab=attendance',
      '/attendance?tab=leaves', 
      '/attendance?tab=out-of-office'
    ].some(path => isActive(path));
    
    // Check if any training sub-item is active
    const trainingActive = [
      '/training-page?tab=HR',
      '/training-page?tab=manager',
      '/training-page?tab=management', 
      '/training-page?tab=employee',
      '/training-page?tab=scorecard'
    ].some(path => isActive(path));
    
    // Check if any outing sub-item is active
    const outingActive = [
      '/outing?tab=HR',
      '/outing?tab=management',
      '/outing?tab=outings-view',
      '/outing?tab=employee-feedback',
      '/outing?tab=scorecard'
    ].some(path => isActive(path));
    
    // Check if any PMS sub-item is active
    const pmsActive = [
      '/pms?tab=kpi',
      '/pms?tab=hygiene',
      '/pms?tab=growth',
      '/pms?tab=summary'
    ].some(path => isActive(path));

    setOpenAttendance(attendanceActive);
    setOpenTrainings(trainingActive);
    setOpenOuting(outingActive);
    setOpenPMS(pmsActive);
  }, [location.pathname, location.search]);

  const menuItems: MenuItem[] = [
    { to: '/company-orientation', text: 'Company Orientation', icon: <CorporateFareIcon /> },
    { to: '/dept-orientation', text: 'Dept Orientation', icon: <ApartmentIcon /> },
    { to: '/hr-dashboard', text: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/employees', text: 'Employees', icon: <PeopleIcon /> },

    {
      text: 'Attendance',
      icon: <AccessTimeIcon />,
      onClick: () => setOpenAttendance(p => !p),
      open: openAttendance,
      subItems: [
        { to: '/attendance?tab=attendance', text: 'Attendance', icon: <TodayIcon /> },
        { to: '/attendance?tab=leaves', text: 'Leaves', icon: <BeachAccessIcon /> },
        { to: '/attendance?tab=out-of-office', text: 'Out of Office', icon: <WorkOffIcon /> },
      ],
    },

    { to: '/checklist-delegation', text: 'Check List & Delegation', icon: <AssignmentTurnedInIcon /> },
    { to: '/requisition', text: 'Requisition', icon: <RequestPageIcon /> },
    { to: '/onboarding', text: 'Onboarding', icon: <BusinessCenterIcon /> },

    {
      text: 'Trainings',
      icon: <SchoolIcon />,
      onClick: () => setOpenTrainings(p => !p),
      open: openTrainings,
      subItems: [
        { to: '/training-page?tab=HR', text: 'HR Training', icon: <PeopleIcon /> },
        { to: '/training-page?tab=manager', text: 'Manager', icon: <AssignmentIcon /> },
        { to: '/training-page?tab=management', text: 'Management Approval', icon: <ApprovalIcon /> },
        { to: '/training-page?tab=employee', text: 'Employee', icon: <AssignmentIcon /> },
        { to: '/training-page?tab=scorecard', text: 'Scorecard', icon: <EmojiEventsIcon /> },
      ],
    },

    {
      text: 'Outings / Events',
      icon: <EventIcon />,
      onClick: () => setOpenOuting(p => !p),
      open: openOuting,
      subItems: [
        { to: '/outing?tab=HR', text: 'HR Outing', icon: <PeopleIcon /> },
        { to: '/outing?tab=management', text: 'Management Approvals', icon: <BusinessCenterIcon /> },
        { to: '/outing?tab=outings-view', text: 'Scheduled & Completed', icon: <EventIcon /> },
        { to: '/outing?tab=employee-feedback', text: 'Outing Feedback', icon: <AssignmentIcon /> },
        { to: '/outing?tab=scorecard', text: 'Outing Scorecard', icon: <ScoreIcon /> },
      ],
    },

    { to: '/confirmations', text: 'Confirmations', icon: <CheckCircleIcon /> },
    { to: '/salary-revision', text: 'Salary Revision', icon: <MonetizationOnIcon /> },
    { to: '/employee-letters', text: 'Employee Letters', icon: <MailIcon /> },
    { to: '/salary-sheet', text: 'Salary Sheet', icon: <PaymentsIcon /> },

    {
      text: 'PMS',
      icon: <TrendingUpIcon />,
      onClick: () => setOpenPMS(p => !p),
      open: openPMS,
      subItems: [
        { to: '/pms?tab=kpi', text: 'KPI & Targets', icon: <KpiIcon /> },
        { to: '/pms?tab=hygiene', text: 'Hygiene Factors', icon: <HygieneIcon /> },
        { to: '/pms?tab=growth', text: 'Growth', icon: <GrowthIcon /> },
        { to: '/pms?tab=summary', text: 'Final Performance', icon: <SummaryIcon /> },
      ],
    },

    { to: '/exits', text: 'Exit', icon: <ExitToAppIcon /> },
    { to: '/profile', text: 'Profile', icon: <AccountCircleIcon /> },
    { to: '/configuration', text: 'Configuration', icon: <SettingsIcon /> },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e0e0e0',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }}
    >
      {/* 🔥 Sticky Header */}
      <Box
        sx={{
          bgcolor: BRAND_BLUE,
          color: 'white',
          p: 3,
          textAlign: 'center',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          transition: 'all 0.3s ease',
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'rgba(255,255,255,0.2)',
            width: 50,
            height: 50,
            mx: 'auto',
            mb: 1.5,
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            '&:hover': {
              transform: 'scale(1.05)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          }}
        >
          <DashboardIcon sx={{ fontSize: 30 }} />
        </Avatar>
        <Typography 
          variant="h6" 
          fontWeight={700}
          sx={{
            fontSize: '1.1rem',
            transition: 'all 0.3s ease',
          }}
        >
          HR Portal
        </Typography>
      </Box>

      {/* 🔥 Scrollable Menu */}
      <List
        sx={{
          px: 2,
          mt: 2,
          flex: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { 
            width: '4px',
            transition: 'all 0.3s ease',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: '#e0e0e0',
            borderRadius: '4px',
            transition: 'all 0.3s ease',
            '&:hover': {
              bgcolor: '#d0d0d0',
            },
          },
        }}
      >
        {menuItems.map(item => {
          if ('subItems' in item) {
            const isParentActive = item.subItems.some(sub => isActive(sub.to));
            return (
              <Box key={item.text} sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={item.onClick}
                  sx={{
                    borderRadius: '8px',
                    bgcolor: isParentActive ? BRAND_BLUE : 'transparent',
                    color: isParentActive ? 'white' : '#212121',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: 'translateX(0)',
                    '&:hover': {
                      bgcolor: isParentActive ? '#2563eb' : '#f8fafc',
                      transform: 'translateX(2px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    },
                    '&:active': {
                      transform: 'translateX(1px)',
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      color: 'inherit', 
                      minWidth: 40,
                      transition: 'transform 0.3s ease',
                      '.MuiListItemButton-root:hover &': {
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        transition: 'all 0.3s ease',
                      },
                    }}
                  />
                  {item.open ? (
                    <ExpandLessIcon 
                      sx={{
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  ) : (
                    <ExpandMoreIcon 
                      sx={{
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  )}
                </ListItemButton>

                <Collapse 
                  in={item.open}
                  timeout={300}
                  easing="cubic-bezier(0.4, 0, 0.2, 1)"
                >
                  <List disablePadding>
                    {item.subItems.map((sub, index) => {
                      const active = isActive(sub.to);
                      return (
                        <ListItemButton
                          key={sub.to}
                          component={NavLink}
                          to={sub.to}
                          sx={{
                            pl: 6,
                            borderRadius: '6px',
                            bgcolor: active ? BRAND_BLUE : 'transparent',
                            color: active ? 'white' : '#4b5563',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: 'translateX(0)',
                            opacity: 1,
                            animation: active ? 'slideIn 0.3s ease' : 'none',
                            '&:hover': {
                              bgcolor: active ? '#2563eb' : '#f1f5f9',
                              transform: 'translateX(4px)',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            },
                            '&:active': {
                              transform: 'translateX(2px)',
                            },
                          }}
                          style={{
                            animationDelay: `${index * 50}ms`,
                          }}
                        >
                          <ListItemIcon 
                            sx={{ 
                              color: 'inherit', 
                              minWidth: 36,
                              fontSize: '0.85rem',
                              transition: 'transform 0.3s ease',
                              '.MuiListItemButton-root:hover &': {
                                transform: 'scale(1.1)',
                              },
                            }}
                          >
                            {sub.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={sub.text}
                            sx={{
                              '& .MuiListItemText-primary': {
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                transition: 'all 0.3s ease',
                              },
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          }

          const active = isActive(item.to);
          return (
            <ListItemButton
              key={item.text}
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: '8px',
                bgcolor: active ? BRAND_BLUE : 'transparent',
                color: active ? 'white' : '#212121',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'translateX(0)',
                '&:hover': {
                  bgcolor: active ? '#2563eb' : '#f8fafc',
                  transform: 'translateX(2px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                },
                '&:active': {
                  transform: 'translateX(1px)',
                },
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: 'inherit', 
                  minWidth: 40,
                  transition: 'transform 0.3s ease',
                  '.MuiListItemButton-root:hover &': {
                    transform: 'scale(1.1)',
                  },
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'all 0.3s ease',
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}