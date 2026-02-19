'use client';

import { useState } from 'react';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Divider, Collapse, Avatar, Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon, People as PeopleIcon, PersonSearch as PersonSearchIcon,
  BusinessCenter as BusinessCenterIcon, GroupAdd as GroupAddIcon, ExitToApp as ExitToAppIcon,
  AccountCircle as AccountCircleIcon, Settings as SettingsIcon, ListAlt as ListAltIcon,
  Assignment as AssignmentIcon, Score as ScoreIcon, ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon, Checklist as ChecklistIcon, School as SchoolIcon,
  Event as EventIcon
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';

const drawerWidth = 260;
const BRAND_BLUE = '#3B82F6';

export default function Sidebar() {
  const location = useLocation();
  const [openRecruitment, setOpenRecruitment] = useState(false);
  const [openTrainings, setOpenTrainings] = useState(false);
  const [openOuting, setOpenOuting] = useState(false);

  const isActive = (path: string) => {
    const currentPath = location.pathname + location.search;
    return currentPath === path;
  };

  const menuItems = [
    { to: '/hr-dashboard', text: 'HR Dashboard', icon: <DashboardIcon /> },
    { to: '/employees', text: 'Employees', icon: <PeopleIcon /> },
    { to: '/candidates', text: 'Candidates', icon: <PersonSearchIcon /> },
    { to: '/salary-revision', text: 'Employee Letters', icon: <ExitToAppIcon /> },
    {
      text: 'Recruitment',
      icon: <GroupAddIcon />,
      onClick: () => setOpenRecruitment(!openRecruitment),
      open: openRecruitment,
      subItems: [
        { to: '/recruitment', text: 'All Requisitions', icon: <ListAltIcon /> },
        { to: '/applicants', text: 'All Applicants', icon: <AssignmentIcon /> },
        { to: '/scoring', text: 'Recruitment Scoring', icon: <ScoreIcon /> },
      ],
    },
    { to: '/onboarding', text: 'Onboardings', icon: <BusinessCenterIcon /> },
    { to: '/exits', text: 'Exits', icon: <ExitToAppIcon /> },
    {
      text: 'Trainings',
      icon: <SchoolIcon />,
      onClick: () => setOpenTrainings(!openTrainings),
      open: openTrainings,
      subItems: [
        { to: '/training-page?tab=HR', text: 'HR Training', icon: <PeopleIcon /> },
        { to: '/training-page?tab=management', text: 'Management Training', icon: <BusinessCenterIcon /> },
        { to: '/training-page?tab=employee', text: 'Employee', icon: <AssignmentIcon /> },
        { to: '/training-page?tab=scorecard', text: 'Scorecard', icon: <ScoreIcon /> },
      ],
    },
    {
      text: 'Outings / Events',
      icon: <EventIcon />,
      onClick: () => setOpenOuting(!openOuting),
      open: openOuting,
      subItems: [
        { to: '/outing?tab=HR', text: 'HR Outing', icon: <PeopleIcon /> },
        { to: '/outing?tab=management', text: 'Management Outing', icon: <BusinessCenterIcon /> },
        { to: '/outing?tab=employee-feedback', text: 'Outing Feedback', icon: <AssignmentIcon /> },
        { to: '/outing?tab=scorecard', text: 'Outing Scorecard', icon: <ScoreIcon /> },
      ],
    },
    { to: '/confirmations', text: 'Confirmations', icon: <ChecklistIcon /> },
    { to: '/profile', text: 'Profile', icon: <AccountCircleIcon /> },
    { to: '/settings', text: 'Settings', icon: <SettingsIcon /> },
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
        },
      }}
    >
      <Box sx={{ bgcolor: BRAND_BLUE, color: 'white', p: 3, textAlign: 'center' }}>
        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 50, height: 50, mx: 'auto', mb: 1.5 }}>
          <DashboardIcon sx={{ fontSize: 30 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={700}>HR Portal</Typography>
        {/* <Typography variant="caption" sx={{ opacity: 0.8 }}>Lead to Revenue</Typography> */}
      </Box>

      <List sx={{ px: 2, mt: 2 }}>
        {menuItems.map((item) => {
          const isParentActive = item.subItems?.some(sub => isActive(sub.to));
          const active = isActive(item.to || '');

          if (item.subItems) {
            return (
              <Box key={item.text} sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={item.onClick}
                  sx={{
                    borderRadius: '8px',
                    bgcolor: isParentActive ? BRAND_BLUE : 'transparent',
                    color: isParentActive ? 'white' : '#212121',
                    '&:hover': { bgcolor: isParentActive ? BRAND_BLUE : '#f5f5f5' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                  {item.open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>
                <Collapse in={item.open} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    {item.subItems.map((sub) => {
                      const subActive = isActive(sub.to);
                      return (
                        <ListItemButton
                          key={sub.to}
                          component={NavLink}
                          to={sub.to}
                          sx={{
                            pl: 6, borderRadius: '8px', mt: 0.5,
                            bgcolor: subActive ? BRAND_BLUE : 'transparent',
                            color: subActive ? 'white' : '#212121',
                            '&:hover': { bgcolor: subActive ? BRAND_BLUE : '#f8fafc' }
                          }}
                        >
                          <ListItemText primary={sub.text} primaryTypographyProps={{ fontSize: '0.85rem' }} />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          }

          return (
            <ListItemButton
              key={item.text}
              component={NavLink}
              to={item.to!}
              sx={{
                mb: 0.5, borderRadius: '8px',
                bgcolor: active ? BRAND_BLUE : 'transparent',
                color: active ? 'white' : '#212121',
                '&:hover': { bgcolor: active ? BRAND_BLUE : '#f5f5f5' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{fontSize: '0.875rem' }} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}