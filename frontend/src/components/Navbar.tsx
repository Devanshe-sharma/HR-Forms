import { AppBar, Toolbar, Typography, Tabs, Tab, Box } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

const drawerWidth = 260;

const pageTitles: Record<string, string> = {
  '/hr-dashboard':          'Dashboard',
  '/employees':             'Employees',
  '/candidates':            'Candidates',
  '/salary-revision':       'Salary Revision',
  '/employee-letters':      'Employee Letters',
  '/recruitment':           'All Requisitions',
  '/applicants':            'All Applicants',
  '/scoring':               'Recruitment Scoring',
  '/onboarding':            'Onboarding',
  '/training-page':         'Training Management',
  '/outing':                'Outing / Event',
  '/attendance':            'Attendance',
  '/checklist-delegation':  'Check List & Delegation',
  '/requisition':           'Requisition',
  '/confirmations':         'Confirmation',
  '/salary-sheet':          'Salary Sheet',
  '/pms':                   'Performance Management System',
  '/exits':                 'Exit',
  '/company-orientation':   'Company Orientation',
  '/dept-orientation':      'Department Orientation',
  '/profile':               'Profile',
  '/settings':              'Settings',
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const OUTING_TABS = [
  { label: 'HR',                value: 'HR' },
  { label: 'Management',        value: 'management' },
  { label: 'Employee Feedback', value: 'employee-feedback' },
  { label: 'Scorecard',         value: 'scorecard' },
];

const TRAINING_TABS = [
  { label: 'HR Training',         value: 'HR' },
  { label: 'Management Approval', value: 'management' },
  { label: 'Employee',            value: 'employee' },
  { label: 'Training Delivery',   value: 'delivery' },
  { label: 'Scorecard',           value: 'scorecard' },
];

const TRAINING_HR_SUBTABS = [
  { label: 'Capability',  value: 'capability' },
  { label: 'Topics',      value: 'topics' },
  { label: 'Scheduling',  value: 'scheduling' },
];

const TRAINING_EMP_SUBTABS = [
  { label: 'Assessment', value: 'assessment' },
  { label: 'Feedback',   value: 'feedback' },
];

const PMS_TABS = [
  { label: 'KPI & Targets',     value: 'kpi' },
  { label: 'Hygiene Factors',   value: 'hygiene' },
  { label: 'Growth',            value: 'growth' },
  { label: 'Final Performance', value: 'summary' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

// White-on-blue — used for main tab rows inside the blue AppBar
const BLUE_TAB_STYLES = {
  minHeight: 40,
  '& .MuiTab-root': {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'none' as const,
    minHeight: 40,
    px: 2.5,
    '&.Mui-selected': { color: '#ffffff' },
  },
};

// Dark-on-white — used for the sub-tab rows rendered below the AppBar
const WHITE_TAB_STYLES = {
  minHeight: 40,
  '& .MuiTab-root': {
    color: 'rgba(0,0,0,0.45)',
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'none' as const,
    minHeight: 40,
    px: 2.5,
    '&.Mui-selected': { color: '#1d1d1d' },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Navbar() {
  const nav = useNavigate();
  const loc = useLocation();

  const sp           = new URLSearchParams(loc.search);
  const activeTab    = sp.get('tab')    || '';
  const activeHrSub  = sp.get('hrSub')  || 'capability';
  const activeEmpSub = sp.get('empSub') || 'assessment';

  const isOutingPage   = loc.pathname === '/outing';
  const isTrainingPage = loc.pathname === '/training-page';
  const isPmsPage      = loc.pathname === '/pms';

  const showTrainingHrSub  = isTrainingPage && activeTab === 'HR';
  const showTrainingEmpSub = isTrainingPage && activeTab === 'employee';

  // AppBar stretches to fit its own content (toolbar + blue tab rows only)
  const hasTabRow = isOutingPage || isTrainingPage || isPmsPage;

  const pageTitle = pageTitles[loc.pathname] || 'HR Portal';

  // Blue tab row — rendered inside the AppBar
  const renderBlueTabRow = (
    tabs: { label: string; value: string }[],
    activeValue: string,
    onChange: (v: string) => void,
  ) => (
    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.2)', px: 2 }}>
      <Tabs
        value={activeValue || tabs[0].value}
        onChange={(_, v: string) => onChange(v)}
        textColor="inherit"
        TabIndicatorProps={{ style: { backgroundColor: '#ffffff', height: 3 } }}
        sx={BLUE_TAB_STYLES}
      >
        {tabs.map(t => <Tab key={t.value} label={t.label} value={t.value} />)}
      </Tabs>
    </Box>
  );

  // White sub-tab row — rendered OUTSIDE the AppBar (position:fixed strip below it)
  const renderWhiteSubTabRow = (
    tabs: { label: string; value: string }[],
    activeValue: string,
    onChange: (v: string) => void,
    topOffset: number, // px — how far below the top of the page
  ) => (
    <Box
      sx={{
        position: 'fixed',
        top: topOffset,
        left: drawerWidth,
        right: 0,
        zIndex: 1099, // just below AppBar (1100)
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        px: 2,
      }}
    >
      <Tabs
        value={activeValue || tabs[0].value}
        onChange={(_, v: string) => onChange(v)}
        textColor="inherit"
        TabIndicatorProps={{ style: { backgroundColor: '#3B82F6', height: 3 } }}
        sx={WHITE_TAB_STYLES}
      >
        {tabs.map(t => <Tab key={t.value} label={t.label} value={t.value} />)}
      </Tabs>
    </Box>
  );

  // AppBar height: toolbar(56) + blue tab row(40) when on training/outing/pms page
  const appBarBottom = hasTabRow ? 56 + 40 : 56;

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          backgroundColor: '#3B82F6',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          height: hasTabRow ? 'auto' : undefined,
        }}
      >
        <Toolbar sx={{ px: 4, minHeight: '56px !important' }}>
          <Typography variant="h6" fontWeight={700} color="white">
            {pageTitle}
          </Typography>
        </Toolbar>

        {/* Outing blue tabs */}
        {isOutingPage && renderBlueTabRow(
          OUTING_TABS,
          activeTab || 'HR',
          v => nav(`/outing?tab=${v}`),
        )}

        {/* Training main blue tabs */}
        {isTrainingPage && renderBlueTabRow(
          TRAINING_TABS,
          activeTab || 'HR',
          v => nav(`/training-page?tab=${v}`),
        )}

        {/* PMS blue tabs */}
        {isPmsPage && renderBlueTabRow(
          PMS_TABS,
          activeTab || 'kpi',
          v => nav(`/pms?tab=${v}`),
        )}
      </AppBar>

      {/* Training HR sub-tabs — white strip fixed just below the AppBar */}
      {showTrainingHrSub && renderWhiteSubTabRow(
        TRAINING_HR_SUBTABS,
        activeHrSub,
        v => nav(`/training-page?tab=HR&hrSub=${v}`),
        appBarBottom, // sits right below the blue AppBar
      )}

      {/* Training Employee sub-tabs — white strip fixed just below the AppBar */}
      {showTrainingEmpSub && renderWhiteSubTabRow(
        TRAINING_EMP_SUBTABS,
        activeEmpSub,
        v => nav(`/training-page?tab=employee&empSub=${v}`),
        appBarBottom,
      )}
    </>
  );
}