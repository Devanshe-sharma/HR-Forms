import { AppBar, Toolbar, Typography, Tabs, Tab, Box } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const drawerWidth = 260;

const pageTitles: Record<string, string> = {
  '/hr-dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/candidates': 'Candidates',
  '/salary-revision': 'Salary Revision',
  '/employee-letters': 'Employee Letters',
  '/recruitment': 'All Requisitions',
  '/applicants': 'All Applicants',
  '/scoring': 'Recruitment Scoring',
  '/onboarding': 'Onboarding',
  '/training-page': 'Training Management',
  '/outing': 'Outing / Event',
  '/attendance': 'Attendance',
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

const OUTING_TABS = [
  { label: 'HR',               value: 'HR' },
  { label: 'Management',       value: 'management' },
  { label: 'Employee Feedback',value: 'employee-feedback' },
  { label: 'Scorecard',        value: 'scorecard' },
];

const TRAINING_TABS = [
  { label: 'HR Training',          value: 'HR' },
  { label: 'Management Approval',  value: 'management' },
  { label: 'Employee',             value: 'employee' },
  { label: 'Training Delivery',    value: 'delivery' },   // ← new
  { label: 'Scorecard',            value: 'scorecard' },
];

// Training HR sub-tabs
const TRAINING_HR_SUBTABS = [
  { label: 'Capability',  value: 'capability' },
  { label: 'Topics',      value: 'topics' },
  { label: 'Scheduling',  value: 'scheduling' },
];

// Training Employee sub-tabs
const TRAINING_EMP_SUBTABS = [
  { label: 'Assessment', value: 'assessment' },
  { label: 'Feedback',   value: 'feedback' },
];

const TAB_STYLES = {
  minHeight: 40,
  '& .MuiTab-root': {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'none',
    minHeight: 40,
    px: 2.5,
    '&.Mui-selected': { color: '#ffffff' },
  },
};

export default function Navbar() {
  const location = useLocation();
  const navigate  = useNavigate();

  const sp = new URLSearchParams(location.search);
  const activeTab    = sp.get('tab')    || '';
  const activeHrSub  = sp.get('hrSub')  || 'capability';
  const activeEmpSub = sp.get('empSub') || 'assessment';

  const isOutingPage   = location.pathname === '/outing';
  const isTrainingPage = location.pathname === '/training-page';

  // Sub-tab rows only appear for HR and employee main-tabs
  const showTrainingHrSub  = isTrainingPage && activeTab === 'HR';
  const showTrainingEmpSub = isTrainingPage && activeTab === 'employee';
  const hasSubTabs         = showTrainingHrSub || showTrainingEmpSub;
  const hasTabRow          = isOutingPage || isTrainingPage;

  const pageTitle = pageTitles[location.pathname] || "HR Portal";

  const renderTabRow = (
    tabs: { label: string; value: string }[],
    activeValue: string,
    onChange: (v: string) => void,
    borderTop = true,
  ) => (
    <Box sx={{ borderTop: borderTop ? '1px solid rgba(255,255,255,0.2)' : 'none', px: 2 }}>
      <Tabs
        value={activeValue || tabs[0].value}
        onChange={(_, v) => onChange(v)}
        textColor="inherit"
        TabIndicatorProps={{ style: { backgroundColor: '#ffffff', height: 3 } }}
        sx={TAB_STYLES}
      >
        {tabs.map(t => <Tab key={t.value} label={t.label} value={t.value} />)}
      </Tabs>
    </Box>
  );

  return (
    <AppBar
      position="fixed"
      sx={{
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
        backgroundColor: "#3B82F6",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        height: hasTabRow ? 'auto' : undefined,
      }}
    >
      <Toolbar sx={{ px: 4, minHeight: '56px !important' }}>
        <Typography variant="h6" fontWeight={700} color="white">
          {pageTitle}
        </Typography>
      </Toolbar>

      {/* Outing tabs */}
      {isOutingPage && renderTabRow(
        OUTING_TABS,
        activeTab || 'HR',
        v => navigate(`/outing?tab=${v}`),
      )}

      {/* Training main tabs */}
      {isTrainingPage && renderTabRow(
        TRAINING_TABS,
        activeTab || 'HR',
        v => navigate(`/training-page?tab=${v}`),
      )}

      {/* Training HR sub-tabs */}
      {showTrainingHrSub && renderTabRow(
        TRAINING_HR_SUBTABS,
        activeHrSub,
        v => navigate(`/training-page?tab=HR&hrSub=${v}`),
      )}

      {/* Training Employee sub-tabs */}
      {showTrainingEmpSub && renderTabRow(
        TRAINING_EMP_SUBTABS,
        activeEmpSub,
        v => navigate(`/training-page?tab=employee&empSub=${v}`),
      )}
    </AppBar>
  );
}