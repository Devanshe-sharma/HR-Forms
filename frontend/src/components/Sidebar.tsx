'use client';

import { useState, Fragment } from "react";
import {
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    // Toolbar,
    Avatar,
    Typography,
    Box,
    Divider,
    Collapse
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
    MonetizationOn,  // ← Better icon for Salary Revision
    ExpandLess,
    ExpandMore,
} from "@mui/icons-material";

import { NavLink, useLocation } from "react-router-dom";  // ← useLocation for active check

const drawerWidth = 240;

export default function Sidebar() {
    const [openRecruitment, setOpenRecruitment] = useState(false);
    const location = useLocation();  // ← To detect current path

    const handleRecruitmentClick = () => {
        setOpenRecruitment(prev => !prev);
    };

    const menuItems = [
        { to: "/hr-dashboard", text: "Dashboard", icon: <Dashboard /> },
        { to: "/employees", text: "Employees", icon: <People /> },
        { to: "/candidates", text: "Candidates", icon: <PersonSearch /> },

        // 💰 Salary Revision - Properly added
        {
            to: "/salary-revision",
            text: "Employee Letters",
            icon: <MonetizationOn />,
        },

        // Recruitment submenu
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
                    mt: 8, // below fixed navbar
                },
            }}
        >
            {/* <Toolbar /> */}

            {/* Profile Section */}
            <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center" }}>
                <NavLink to="/profile">
                    <Avatar sx={{ width: 56, height: 56, mr: 2 }} src="/avatar.png" />
                </NavLink>
                <Box>
                    <NavLink to="/profile" style={{ textDecoration: "none", color: "inherit" }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                            Diksha
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            HR Manager
                        </Typography>
                    </NavLink>
                </Box>
            </Box>

            <Divider sx={{ mx: 2 }} />

            {/* Menu */}
            <List sx={{ px: 1 }}>
                {menuItems.map((item) => {
                    if ("subItems" in item) {
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
                                        {item.subItems && item.subItems.map((sub) => (
                                            <ListItemButton
                                                key={sub.to}
                                                component={NavLink}
                                                to={sub.to}
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
                            component={NavLink}
                            to={item.to}
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