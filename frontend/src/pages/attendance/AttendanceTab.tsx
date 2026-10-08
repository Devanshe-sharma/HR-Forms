import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { ACCENT } from './shared';
import { AttendanceDaily } from './AttendanceDaily';
import { AttendanceMonthly } from './AttendanceMonthly';

type View = 'daily' | 'monthly';

export function AttendanceTab() {
  const [view, setView] = useState<View>('daily');
  const [monthlyCode, setMonthlyCode] = useState<string | null>(null);

  const openMonthly = (code: string | null) => { setMonthlyCode(code); setView('monthly'); };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {(['daily', 'monthly'] as View[]).map(v => (
          <Button key={v} size="small" variant={view === v ? 'contained' : 'outlined'}
            onClick={() => (v === 'monthly' ? openMonthly(null) : setView('daily'))}
            sx={{
              textTransform: 'none', fontWeight: 600, borderRadius: 1.5, borderColor: ACCENT,
              bgcolor: view === v ? ACCENT : 'transparent', color: view === v ? 'white' : ACCENT,
              '&:hover': { bgcolor: view === v ? '#4338ca' : '#eef2ff' },
            }}>
            {v === 'daily' ? 'Daily' : 'Monthly'}
          </Button>
        ))}
      </Box>

      {view === 'daily'
        ? <AttendanceDaily onOpenMonthly={openMonthly} />
        : <AttendanceMonthly initialCode={monthlyCode} />}
    </Box>
  );
}
