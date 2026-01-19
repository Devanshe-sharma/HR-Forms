'use client';

import { useState, useEffect, Fragment } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Collapse,
  Alert,
  Avatar,
} from "@mui/material";

import {
  Dashboard,
  People,
  PersonSearch,
  BusinessCenter,
  GroupAdd,
  ExitToApp,
  AccountCircle,
  Settings,
  ListAlt,
  Assignment,
  Score as ScoreIcon,
  School,
  Event,
  Checklist,
  MonetizationOn,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";

import { NavLink, useLocation, useNavigate } from "react-router-dom";

const drawerWidth = 240;

// Pages that actually exist (add more as you implement them)
const existingPages = [
  "/hr-dashboard",
  "/employees",
  "/candidates",
  "/salary-revision",
  "/recruitment",
  "/applicants",
  "/scoring",
  "/onboarding",
  "/exits",
  "/trainings",
  "/outings-events",
  "/confirmations",
  "/profile",
  "/settings",
  "/ctc-components",
  "/letter",
];

export default function Sidebar() {
  const [openRecruitment, setOpenRecruitment] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-hide alert after 5 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  const handleRecruitmentClick = () => {
    setOpenRecruitment((prev) => !prev);
  };

  // Safe navigation: check if page exists, else show alert
  const handleNavClick = (path: string) => {
    if (existingPages.includes(path)) {
      navigate(path);
      setAlertMessage(null);
    } else {
      setAlertMessage(`This page (${path}) is under development and will be available soon.`);
    }
  };

  const menuItems = [
    { to: "/hr-dashboard", text: "Dashboard", icon: <Dashboard /> },
    { to: "/employees", text: "Employees", icon: <People /> },
    { to: "/candidates", text: "Candidates", icon: <PersonSearch /> },
    { to: "/salary-revision", text: "Employee Letters", icon: <MonetizationOn /> },

    {
      text: "Recruitment",
      icon: <GroupAdd />,
      onClick: handleRecruitmentClick,
      open: openRecruitment,
      subItems: [
        { to: "/recruitment", text: "All Requisitions", icon: <ListAlt /> },
        { to: "/applicants", text: "All Applicants", icon: <Assignment /> },
        { to: "/scoring", text: "Recruitment Scoring", icon: <ScoreIcon /> },
      ],
    },

    { to: "/onboarding", text: "Onboardings", icon: <BusinessCenter /> },
    { to: "/exits", text: "Exits", icon: <ExitToApp /> },
    { to: "/trainings", text: "Trainings", icon: <School /> },
    { to: "/outings-events", text: "Outings & Events", icon: <Event /> },
    { to: "/confirmations", text: "Confirmations", icon: <Checklist /> },

    { to: "/profile", text: "Profile", icon: <AccountCircle /> },
    { to: "/settings", text: "Settings", icon: <Settings /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: "border-box",
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e0e0e0",
          overflowX: "hidden",
          mt: 8,
        },
      }}
    >
      {/* Profile Section */}
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center" }}>
        <NavLink to="/profile">
          <Avatar sx={{ width: 56, height: 56, mr: 2 }} src="/avatar.png" />
        </NavLink>
        <Box>
          {/* Optional profile info */}
        </Box>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* Alert for unimplemented pages */}
      {alertMessage && (
        <Alert
          severity="info"
          onClose={() => setAlertMessage(null)}
          sx={{ mx: 2, my: 1, borderRadius: 2 }}
        >
          {alertMessage}
        </Alert>
      )}

      {/* Menu */}
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => {
          // Type guard for submenu items
          if ("subItems" in item && item.subItems) {
            return (
              <Fragment key={item.text}>
                <ListItemButton onClick={item.onClick} sx={{ borderRadius: 2, my: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 40, color: "text.primary" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: "0.95rem", fontWeight: 600 }}
                  />
                  {item.open ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>

                <Collapse in={item.open} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.subItems.map((sub) => (
                      <ListItemButton
                        key={sub.to}
                        onClick={() => handleNavClick(sub.to)}
                        sx={{
                          pl: 7,
                          borderRadius: 2,
                          my: 0.3,
                          bgcolor: isActive(sub.to) ? "#e8f5e9" : "transparent",
                          "&:hover": { bgcolor: "#f1f8e9" },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: isActive(sub.to) ? "#2e7d32" : "text.secondary" }}>
                          {sub.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={sub.text}
                          primaryTypographyProps={{
                            fontSize: "0.9rem",
                            color: isActive(sub.to) ? "#2e7d32" : "text.primary",
                            fontWeight: isActive(sub.to) ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Fragment>
            );
          }

          return (
            <ListItemButton
              key={item.to}
              onClick={() => handleNavClick(item.to)}
              sx={{
                borderRadius: 2,
                my: 0.5,
                bgcolor: isActive(item.to) ? "#f3e8ff" : "transparent",
                "&:hover": { bgcolor: "#ede7f6" },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive(item.to) ? "#673ab7" : "text.secondary",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: "0.95rem",
                  fontWeight: isActive(item.to) ? 600 : 500,
                  color: isActive(item.to) ? "#673ab7" : "text.primary",
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}