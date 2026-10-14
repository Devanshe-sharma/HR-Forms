import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { ACCENT } from './shared';
import { AttendanceDaily } from './AttendanceDaily';
import { AttendanceMonthly } from './AttendanceMonthly';
import { AttendanceCodeMapping } from './AttendanceCodeMapping';
import { MyAttendance } from './MyAttendance';
import { hasAnyRole } from '../../config/rbac';

type View = 'daily' | 'monthly' | 'codes';

const VIEW_LABEL: Record<View, string> = { daily: 'Daily', monthly: 'Monthly', codes: 'Employee Codes' };

// Admin/HR/Management get the full company-wide Daily/Monthly report (every
// employee) plus the Employee Codes admin tool; everyone else only ever has
// a self-service view of their own month — the backend enforces this too
// (GET /attendance/me/monthly can only ever return the caller's own
// records), this just picks the right UI.
export function AttendanceTab() {
  const canViewAll = hasAnyRole(['Admin', 'HR', 'Management']);
  const [view, setView] = useState<View>('daily');
  const [monthlyCode, setMonthlyCode] = useState<string | null>(null);

  const openMonthly = (code: string | null) => { setMonthlyCode(code); setView('monthly'); };

  if (!canViewAll) return <MyAttendance />;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {(['daily', 'monthly', 'codes'] as View[]).map(v => (
          <Button key={v} size="small" variant={view === v ? 'contained' : 'outlined'}
            onClick={() => (v === 'monthly' ? openMonthly(monthlyCode) : setView(v))}
            sx={{
              textTransform: 'none', fontWeight: 600, borderRadius: 1.5, borderColor: ACCENT,
              bgcolor: view === v ? ACCENT : 'transparent', color: view === v ? 'white' : ACCENT,
              '&:hover': { bgcolor: view === v ? '#1f2d0e' : '#eef1e4' },
            }}>
            {VIEW_LABEL[v]}
          </Button>
        ))}
      </Box>

      {view === 'daily' && <AttendanceDaily onOpenMonthly={openMonthly} />}
      {view === 'monthly' && <AttendanceMonthly initialCode={monthlyCode} />}
      {view === 'codes' && <AttendanceCodeMapping />}
    </Box>
  );
}
