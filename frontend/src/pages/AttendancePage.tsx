import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import {
  WorkOff as WorkOffIcon,
  Today as TodayIcon,
  BeachAccess as BeachAccessIcon,
} from '@mui/icons-material';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { ACCENT } from './attendance/shared';
import { OutOfOfficeTab } from './attendance/OutOfOfficeTab';
import { AttendanceTab } from './attendance/AttendanceTab';
import { LeavesTab } from './attendance/LeavesTab';

// ─── Root ─────────────────────────────────────────────────────────────────────

type TabId = 'out-of-office' | 'attendance' | 'leaves';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'out-of-office', label: 'Out of Office', icon: <WorkOffIcon fontSize="small" /> },
  { id: 'attendance', label: 'Attendance', icon: <TodayIcon fontSize="small" /> },
  { id: 'leaves', label: 'Leaves', icon: <BeachAccessIcon fontSize="small" /> },
];

export default function AttendancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = (new URLSearchParams(location.search).get('tab') || 'out-of-office') as TabId;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-auto pt-16 md:pt-20">
          <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
              {TABS.map(t => (
                <Button key={t.id} startIcon={t.icon} onClick={() => navigate(`/attendance?tab=${t.id}`)}
                  variant={activeTab === t.id ? 'contained' : 'outlined'}
                  sx={{
                    textTransform: 'none', fontWeight: 600, borderRadius: 1.5,
                    bgcolor: activeTab === t.id ? ACCENT : 'transparent', borderColor: ACCENT,
                    color: activeTab === t.id ? 'white' : ACCENT,
                    '&:hover': { bgcolor: activeTab === t.id ? '#4338ca' : '#eef2ff' },
                  }}>
                  {t.label}
                </Button>
              ))}
            </Box>

            {activeTab === 'out-of-office' && <OutOfOfficeTab />}
            {activeTab === 'attendance' && <AttendanceTab />}
            {activeTab === 'leaves' && <LeavesTab />}
          </Box>
        </main>
      </div>
    </div>
  );
}
