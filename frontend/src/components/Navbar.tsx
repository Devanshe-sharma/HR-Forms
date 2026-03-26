import { AppBar, Toolbar, Typography, Tabs, Tab, Box } from '@mui/material';

import { useLocation, useNavigate } from 'react-router-dom';

import { useTheme } from '../contexts/ThemeContext';

import Brightness4Icon from '@mui/icons-material/Brightness4';

import Brightness7Icon from '@mui/icons-material/Brightness7';



const drawerWidth = 260;



const pageTitles: Record<string, string> = {

  '/hr-dashboard':         'Dashboard',

  '/employees':            'Employees',

  '/candidates':           'Candidates',

  '/salary-revision':      'Salary revision',

  '/employee-letters':     'Employee Letters',

  '/recruitment':          'All Requisitions',

  '/applicants':           'All Applicants',

  '/scoring':              'Recruitment Scoring',

  '/onboarding':           'Onboarding',

  '/training-page':        'Training Management',

  '/outing':               'Outing / Event',

  '/attendance':           'Attendance',

  '/checklist-delegation': 'Check List & Delegation',

  '/requisition':          'Requisition',

  '/confirmations':        'Confirmations',

  '/salary-sheet':         'Salary Sheet',

  '/pms':                  'Performance Management System',

  '/exits':                'Exit',

  '/company-orientation':  'Company Orientation',

  '/dept-orientation':     'Department Orientation',

  '/profile':              'Profile',

  '/configuration':             'Configruation',

};



// ─── Tab definitions ──────────────────────────────────────────────────────────



const OUTING_TABS = [

  { label: 'HR',                value: 'HR' },

  { label: 'Management Approvals', value: 'management' },

  { label: 'Scheduled & Completed', value: 'outings-view' },

  { label: 'Employee Feedback', value: 'employee-feedback' },

  { label: 'Scorecard',         value: 'scorecard' },

];



const TRAINING_TABS = [

  { label: 'HR',                  value: 'HR' },

  { label: 'Manager Evaluation',  value: 'manager' },

  { label: 'Skill Gap',           value: 'skillgap' },

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



const TOOLBAR_H  = 56;

const TAB_ROW_H  = 40;



// ─── Component ────────────────────────────────────────────────────────────────



export default function Navbar() {

  const nav = useNavigate();

  const loc = useLocation();

  const { darkMode, toggleDarkMode } = useTheme();



  const sp           = new URLSearchParams(loc.search);

  const activeTab    = sp.get('tab')    || '';

  const activeHrSub  = sp.get('hrSub')  || 'capability';

  const activeEmpSub = sp.get('empSub') || 'assessment';



  const isOutingPage   = loc.pathname === '/outing';

  const isTrainingPage = loc.pathname === '/training-page';

  const isPmsPage      = loc.pathname === '/pms';



  const showTrainingHrSub  = isTrainingPage && activeTab === 'HR';

  const showTrainingEmpSub = isTrainingPage && activeTab === 'employee';



  const pageTitle = pageTitles[loc.pathname] || 'HR Portal';



  // Blue tab row — inside AppBar (only outing/pms still blue)

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



  // White tab row — fixed strip outside AppBar

  const renderWhiteTabRow = (

    tabs: { label: string; value: string }[],

    activeValue: string,

    onChange: (v: string) => void,

    topOffset: number,

  ) => (

    <Box sx={{

      position: 'fixed', top: topOffset, left: drawerWidth, right: 0, zIndex: 1099,

      backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb',

      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', px: 2,

    }}>

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



  const row1Top = TOOLBAR_H;

  const row2Top = TOOLBAR_H + TAB_ROW_H;



  return (

    <>

      {/* Blue AppBar — title only */}

      <AppBar position="fixed" sx={{

        width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px`,

        backgroundColor: '#3B82F6', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',

        height: TOOLBAR_H,

      }}>

        <Toolbar sx={{ px: 4, minHeight: `${TOOLBAR_H}px !important`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          <Typography variant="h6" fontWeight={700} color="white">{pageTitle}</Typography>

          <Box

            onClick={toggleDarkMode}

            sx={{ 

              cursor: 'pointer', 

              display: 'flex', 

              alignItems: 'center',

              gap: 1,

              padding: '4px 8px',

              borderRadius: '4px',

              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }

            }}

          >

            {darkMode ? (

              <Brightness7Icon sx={{ color: 'white', fontSize: 20 }} />

            ) : (

              <Brightness4Icon sx={{ color: 'white', fontSize: 20 }} />

            )}

          </Box>

        </Toolbar>

      </AppBar>



      {/* Outing white row */}

      {isOutingPage && renderWhiteTabRow(

        OUTING_TABS, activeTab || 'HR', v => nav(`/outing?tab=${v}`), row1Top,

      )}



      {/* Training main white row */}

      {isTrainingPage && renderWhiteTabRow(

        TRAINING_TABS, activeTab || 'HR', v => nav(`/training-page?tab=${v}`), row1Top,

      )}



      {/* Training HR sub-tab white row */}

      {showTrainingHrSub && renderWhiteTabRow(

        TRAINING_HR_SUBTABS, activeHrSub, v => nav(`/training-page?tab=HR&hrSub=${v}`), row2Top,

      )}



      {/* Training Employee sub-tab white row */}

      {showTrainingEmpSub && renderWhiteTabRow(

        TRAINING_EMP_SUBTABS, activeEmpSub, v => nav(`/training-page?tab=employee&empSub=${v}`), row2Top,

      )}



      {/* PMS white row */}

      {isPmsPage && renderWhiteTabRow(

        PMS_TABS, activeTab || 'kpi', v => nav(`/pms?tab=${v}`), row1Top,

      )}

    </>

  );

}