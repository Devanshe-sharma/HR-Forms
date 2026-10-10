'use client';

import React, { useState, useEffect } from 'react';
import briskOliveLogo from '../assets/Brisk-Olive-Logo.png';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Collapse, Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  BusinessCenter as BusinessCenterIcon,
  ExitToApp as ExitToAppIcon,
  AccountCircle as AccountCircleIcon,
  Settings as SettingsIcon,
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
  GpsFixed as KpiIcon,
  HealthAndSafety as HygieneIcon,
  AutoGraph as GrowthIcon,
  Leaderboard as SummaryIcon,
  MonetizationOn as MonetizationOnIcon,
  ReportProblem as ReportProblemIcon,
  Gavel as GavelIcon,
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';
import { usePageVisibility } from '../contexts/PageVisibilityContext';

const drawerWidth = 260;
const BRAND_BLUE = '#2b3d14';

// ─── Types ─────────────────────────────────────
interface SubItem {
  to: string;
  text: string;
  icon: React.ReactNode;
  pageKey?: string;
}

interface ParentItem {
  text: string;
  icon: React.ReactNode;
  onClick: () => void;
  open: boolean;
  subItems: SubItem[];
  pageKey?: string;
}

interface LeafItem {
  to: string;
  text: string;
  icon: React.ReactNode;
  pageKey?: string;
}

type MenuItem = ParentItem | LeafItem;

// ─── Component ─────────────────────────────────
export default function Sidebar() {
  const location = useLocation();

  const [openPMS, setOpenPMS] = useState(false);
  const [openEscalations, setOpenEscalations] = useState(false);
  const [openRecruitment, setOpenRecruitment] = useState(false);

  const isActive = (path: string): boolean => {
    const current = location.pathname + location.search;
    return current === path || current.startsWith(path + '&');
  };

  // Auto-expand parent menus if any sub-item is active
  useEffect(() => {
    // Check if any PMS sub-item is active
    const pmsActive = [
      '/pms?tab=kpi',
      '/pms?tab=hygiene',
      '/pms?tab=growth',
      '/pms?tab=summary'
    ].some(path => isActive(path));
    
    // Check if any escalations/grievances sub-item is active
    const escalationsActive = ['/escalations', '/grievances'].some(path => isActive(path));

    // Check if any Recruitment sub-item is active
    const recruitmentActive = [
      '/recruitment', '/applicants', '/referrals', '/offer-joining', '/timeline-history',
    ].some(path => isActive(path));

    setOpenPMS(pmsActive);
    setOpenEscalations(escalationsActive);
    setOpenRecruitment(recruitmentActive);
  }, [location.pathname, location.search]);

  const { canViewKey } = usePageVisibility();

  const menuItems: MenuItem[] = [
    { to: '/company-orientation', text: 'Company Orientation', icon: <CorporateFareIcon />, pageKey: 'companyOrientation' },
    { to: '/dept-orientation', text: 'Department Orientation', icon: <ApartmentIcon />, pageKey: 'deptOrientation' },
    { to: '/hr-dashboard', text: 'Dashboard', icon: <DashboardIcon />, pageKey: 'dashboard' },
    { to: '/employees', text: 'Employees List', icon: <PeopleIcon />, pageKey: 'employees' },
    {
      text: 'Recruitment',
      icon: <RequestPageIcon />,
      onClick: () => setOpenRecruitment(p => !p),
      open: openRecruitment,
      pageKey: 'recruitment.dashboard',
      subItems: [
        { to: '/recruitment', text: 'Recruitment Dashboard', icon: <RequestPageIcon />, pageKey: 'recruitment.dashboard' },
        { to: '/applicants', text: 'Candidate Management', icon: <PeopleIcon />, pageKey: 'recruitment.candidates' },
      ],
    },
    { to: '/onboarding/dashboard', text: 'Onboarding', icon: <BusinessCenterIcon />, pageKey: 'onboarding.dashboard' },
    { to: '/exits', text: 'Exit', icon: <ExitToAppIcon />, pageKey: 'exit.dashboard' },
    { to: '/dept-designation-master', text: 'Dept & Designation Master', icon: <BusinessCenterIcon />, pageKey: 'deptDesignationMaster' },



    { to: '/training-page?tab=HR', text: 'Trainings', icon: <SchoolIcon />, pageKey: 'trainings' },
    { to: '/outing?tab=HR', text: 'Outings / Events', icon: <EventIcon />, pageKey: 'outings' },

    { to: '/confirmations', text: 'Confirmations', icon: <CheckCircleIcon />, pageKey: 'confirmations' },
    { to: '/salary-revision', text: 'Salary Revision', icon: <MonetizationOnIcon />, pageKey: 'salaryRevision' },
    { to: '/employee-letters', text: 'Employee Letters', icon: <MailIcon />, pageKey: 'employeeLetters' },
    {
      text: 'Escalations / Grievances',
      icon: <ReportProblemIcon />,
      onClick: () => setOpenEscalations(p => !p),
      open: openEscalations,
      pageKey: 'escalations',
      subItems: [
        { to: '/escalations', text: 'Escalations', icon: <ReportProblemIcon />, pageKey: 'escalations.list' },
        { to: '/grievances', text: 'Grievances', icon: <GavelIcon />, pageKey: 'escalations.grievances' },
      ],
    },
    // { to: '/salary-sheet', text: 'Salary Sheet', icon: <PaymentsIcon /> },

    // PMS — commented out per request, not deleted (restore by uncommenting).
    // {
    //   text: 'PMS',
    //   icon: <TrendingUpIcon />,
    //   onClick: () => setOpenPMS(p => !p),
    //   open: openPMS,
    //   pageKey: 'pms',
    //   subItems: [
    //     { to: '/pms?tab=kpi', text: 'KPI & Targets', icon: <KpiIcon />, pageKey: 'pms.kpi' },
    //     { to: '/pms?tab=hygiene', text: 'Attendance', icon: <HygieneIcon />, pageKey: 'pms.hygiene' },
    //     { to: '/pms?tab=growth', text: 'Growth', icon: <GrowthIcon />, pageKey: 'pms.growth' },
    //     { to: '/pms?tab=summary', text: 'Final Performance', icon: <SummaryIcon />, pageKey: 'pms.summary' },
    //   ],
    // },

    

    { to: '/attendance?tab=out-of-office', text: 'Attendance', icon: <AccessTimeIcon />, pageKey: 'hygieneFactors' },

    // { to: '/checklist-delegation', text: 'Check List & Delegation', icon: <AssignmentTurnedInIcon /> },
    
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
          bgcolor: BRAND_BLUE,
          borderRight: '1px solid rgba(255,255,255,0.08)',
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
        <Box
          component="img"
          src={briskOliveLogo}
          alt="Brisk Olive"
          sx={{
            height: 36,
            mx: 'auto',
            mb: 1.5,
            display: 'block',
            borderRadius: '6px',
          }}
        />
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
            bgcolor: 'rgba(255,255,255,0.18)',
            borderRadius: '4px',
            transition: 'all 0.3s ease',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.3)',
            },
          },
        }}
      >
        {menuItems.filter(item => !item.pageKey || canViewKey(item.pageKey)).map(item => {
          if ('subItems' in item) {
            const visibleSubItems = item.subItems.filter(sub => !sub.pageKey || canViewKey(sub.pageKey));
            const isParentActive = visibleSubItems.some(sub => isActive(sub.to));
            return (
              <Box key={item.text} sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={item.onClick}
                  sx={{
                    borderRadius: '8px',
                    bgcolor: isParentActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: 'white',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: 'translateX(0)',
                    '&:hover': {
                      bgcolor: isParentActive ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.08)',
                      transform: 'translateX(2px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
                    {visibleSubItems.map((sub, index) => {
                      const active = isActive(sub.to);
                      return (
                        <ListItemButton
                          key={sub.to}
                          component={NavLink}
                          to={sub.to}
                          sx={{
                            pl: 6,
                            borderRadius: '6px',
                            bgcolor: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                            color: 'white',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: 'translateX(0)',
                            opacity: 1,
                            animation: active ? 'slideIn 0.3s ease' : 'none',
                            '&:hover': {
                              bgcolor: active ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.08)',
                              transform: 'translateX(4px)',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
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

          // Pathname-only match — so an item linking to one tab of a
          // multi-tab page (e.g. Trainings -> /training-page?tab=HR) stays
          // highlighted while on any of that page's other tabs too.
          const active = location.pathname === item.to.split('?')[0];
          return (
            <ListItemButton
              key={item.text}
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: '8px',
                bgcolor: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: 'white',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'translateX(0)',
                '&:hover': {
                  bgcolor: active ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.08)',
                  transform: 'translateX(2px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
