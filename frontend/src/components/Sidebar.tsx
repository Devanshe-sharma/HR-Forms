'use client';

import { useState } from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Collapse,
  Avatar,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ScoreIcon from '@mui/icons-material/Score';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChecklistIcon from '@mui/icons-material/Checklist';
import SchoolIcon from '@mui/icons-material/School';
import { NavLink, useLocation } from 'react-router-dom';

const drawerWidth = 240;

type MenuItem = {
  to?: string;
  text: string;
  icon: React.ReactNode;
  onClick?: () => void;
  open?: boolean;
  subItems?: MenuItem[];
};

export default function Sidebar() {
  const location = useLocation();
  const [openRecruitment, setOpenRecruitment] = useState(false);

  const handleRecruitmentClick = () => {
    setOpenRecruitment((prev) => !prev);
  };

  // Check if current route is active
  const isActive = (path: string) => location.pathname === path;

  // Menu items
  const menuItems: MenuItem[] = [
    { to: '/hr-dashboard', text: 'HR Dashboard', icon: <DashboardIcon /> },
    { to: '/employees', text: 'Employees', icon: <PeopleIcon /> },
    { to: '/candidates', text: 'Candidates', icon: <PersonSearchIcon /> },
    { to: '/salary-revision', text: 'Employee Letters', icon: <ExitToAppIcon /> },

    {
      text: 'Recruitment',
      icon: <GroupAddIcon />,
      onClick: handleRecruitmentClick,
      open: openRecruitment,
      subItems: [
        { to: '/recruitment', text: 'All Requisitions', icon: <ListAltIcon /> },
        { to: '/applicants', text: 'All Applicants', icon: <AssignmentIcon /> },
        { to: '/scoring', text: 'Recruitment Scoring', icon: <ScoreIcon /> },
      ],
    },

    { to: '/onboarding', text: 'Onboardings', icon: <BusinessCenterIcon /> },
    { to: '/exits', text: 'Exits', icon: <ExitToAppIcon /> },

    // ✅ TRAINING PAGE (kept)
    { to: '/training-page', text: 'Trainings', icon: <SchoolIcon /> },

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
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e0e0e0',
          overflowX: 'hidden',
          mt: 8, // space below app bar if you have one
        },
      }}
    >
      {/* Profile / Header Section (optional) */}
      <Box sx={{ px: 3, py: 2, display: 'flex', backgroundColor: '#3B82F6', alignItems: 'center' }}>
        <NavLink to="/profile">
          <Avatar sx={{ width: 56, height: 56, mr: 2 }} src="/avatar.png" />
        </NavLink>
        <Box>
          <Typography variant="subtitle1" fontWeight={600} color="white">
            HR Portal
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* Main Menu */}
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => {
          if (item.subItems && item.subItems.length > 0) {
            return (
              <div key={item.text}>
                <ListItemButton
                  onClick={item.onClick}
                  sx={{
                    borderRadius: 2,
                    my: 0.5,
                    bgcolor:
                      location.pathname.startsWith('/recruitment') || location.pathname === '/applicants'
                        ? '#f3e8ff'
                        : 'transparent',
                    '&:hover': { bgcolor: '#ede7f6' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.primary' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 600 }} />
                  {item.open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>

                <Collapse in={item.open} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.subItems.map((sub) => (
                      <ListItemButton
                        key={sub.to}
                        component={NavLink}
                        to={sub.to!}
                        sx={{
                          pl: 7,
                          borderRadius: 2,
                          my: 0.3,
                          bgcolor: isActive(sub.to!) ? '#e8f5e9' : 'transparent',
                          '&:hover': { bgcolor: '#f1f8e9' },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 36,
                            color: isActive(sub.to!) ? '#2e7d32' : 'text.secondary',
                          }}
                        >
                          {sub.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={sub.text}
                          primaryTypographyProps={{
                            fontSize: '0.9rem',
                            color: isActive(sub.to!) ? '#2e7d32' : 'text.primary',
                            fontWeight: isActive(sub.to!) ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </div>
            );
          }

          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to!}
              sx={{
                borderRadius: 2,
                my: 0.5,
                bgcolor: isActive(item.to!) ? '#f3e8ff' : 'transparent',
                '&:hover': { bgcolor: '#ede7f6' },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive(item.to!) ? '#673ab7' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '0.95rem',
                  fontWeight: isActive(item.to!) ? 600 : 500,
                  color: isActive(item.to!) ? '#673ab7' : 'text.primary',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}
