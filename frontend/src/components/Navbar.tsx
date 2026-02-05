import { AppBar, Toolbar, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

const drawerWidth = 250; 

const routeTitles: Record<string, string> = {
  '/hr-dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/candidates': 'Candidates',
  '/salary-revision': 'Employee Letters',
  '/recruitment': 'All Requisitions',
  '/applicants': 'All Applicants',
  '/onboarding': 'Onboardings',
  '/training-page?tab=HR': 'HR Training',
  '/training-page?tab=management': 'Management Training',
  '/outing?tab=HR': 'HR Outing',
  '/outing?tab=management': 'Management Outing',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

export default function Navbar() {
  const location = useLocation();
  
  // FIX: Define the missing variable here
  const currentFullRoute = location.pathname + location.search;

  const pageTitle = 
    routeTitles[currentFullRoute] || 
    routeTitles[location.pathname] || 
    "HR Portal";

  return (
    <AppBar
      position="fixed"
      sx={{
        // Standardizes width: Subtracts sidebar width from 100%
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
        backgroundColor: "#3B82F6", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <Toolbar sx={{ px: 4 }}>
        <Typography variant="h6" fontWeight={700} color="white">
          {pageTitle}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}