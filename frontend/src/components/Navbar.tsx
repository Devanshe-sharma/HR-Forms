import { AppBar, Toolbar, Box, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

const routeTitles: Record<string, string> = {
  '/home': 'Home',
  '/hr-dashboard': 'HR Dashboard',
  '/employees': 'Employees',
  '/candidates': 'Candidates',
  '/salary-revision': 'Employee Letters',
  '/recruitment': 'All Requisitions',
  '/applicants': 'All Applicants',
  '/scoring': 'Recruitment Scoring',
  '/onboarding': 'Onboardings',
  '/exits': 'Exits',
  '/trainings': 'Trainings',
  '/outings-events': 'Outings & Events',
  '/confirmations': 'Confirmations',
  '/profile': 'Profile',
  '/settings': 'Settings',
};


export default function Navbar() {
  const location = useLocation();
  const SIDEBAR_WIDTH = 10;

  const pageTitle =
    routeTitles[location.pathname] || "HR Portal";

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: 1400,
        backgroundColor: "#3B82F6",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      }}
    >
      <Toolbar sx={{ pl: `${SIDEBAR_WIDTH + 20}px` }}>

        {/* Logo stays visually aligned */}
        <Link to="/" style={{ textDecoration: "none" }}>
          <Box
            component="img"
            src="https://ik.imagekit.io/wovz8p4ck/Logo%20and%20navbar/image%201.png"
            alt="Company Logo"
            sx={{ height: 40 }}
          />
        </Link>

        {/* PAGE HEADING */}
        <Typography
          variant="h6"
          sx={{
            paddingLeft: 15,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          {pageTitle}
        </Typography>

        <Box />
      </Toolbar>
    </AppBar>
  );
}

