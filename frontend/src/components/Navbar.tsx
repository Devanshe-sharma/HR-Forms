import { AppBar, Toolbar, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

const drawerWidth = 260;

const routeTitles: Record<string, string> = {
  '/hr-dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/candidates': 'Candidates',
  '/salary-revision': 'Salary Revision',
  '/employee-letters': 'Employee Letters',
  '/recruitment': 'All Requisitions',
  '/applicants': 'All Applicants',
  '/scoring': 'Recruitment Scoring',
  '/onboarding': 'Onboarding',
  '/training-page?tab=HR': 'HR Training',
  '/training-page?tab=management': 'Management Training',
  '/training-page?tab=employee': 'Employee Training',
  '/training-page?tab=scorecard': 'Training Scorecard',
  '/outing?tab=HR': 'HR Outing',
  '/outing?tab=management': 'Management Outing',
  '/outing?tab=employee-feedback': 'Outing Feedback',
  '/outing?tab=scorecard': 'Outing Scorecard',
  '/attendance': 'Attendance',
  '/attendance?tab=attendance': 'Attendance',
  '/attendance?tab=leaves': 'Leaves',
  '/attendance?tab=out-of-office': 'Out of Office',
  '/checklist-delegation': 'Check List & Delegation',
  '/requisition': 'Requisition',
  '/confirmations': 'Confirmation',
  '/salary-sheet': 'Salary Sheet',
  '/pms': 'Performance Management System',
  '/exits': 'Exit',
  '/company-orientation': 'Company Orientation',
  '/dept-orientation': 'Department Orientation',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

export default function Navbar() {
  const location = useLocation();

  const currentFullRoute = location.pathname + location.search;

  const pageTitle =
    routeTitles[currentFullRoute] ||
    routeTitles[location.pathname] ||
    "HR Portal";

  return (
    <AppBar
      position="fixed"
      sx={{
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