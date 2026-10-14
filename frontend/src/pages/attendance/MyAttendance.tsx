import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Stack,
} from '@mui/material';
import { RestartAlt as RestartAltIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL, ACCENT } from './shared';
import {
  AttendanceStatus, STATUSES, STATUS_STYLE, fmtTime, fmtMins, fmtShort, istToday, downloadCsv, TH,
} from './attendanceCommon';

interface DayRow {
  date: string;
  weekday: number;
  punchIn: string | null;
  punchOut: string | null;
  workedMin: number | null;
  lateMin: number;
  earlyMin: number;
  status: AttendanceStatus;
  note: string;
}

interface Summary {
  counts: Record<AttendanceStatus, number>;
  workedMin: number;
  lateMin: number;
  earlyMin: number;
}

interface MonthlyReport {
  month: string;
  employeeCode: string;
  employeeName: string;
  days: DayRow[];
  summary: Summary;
  buffers: { total: number[]; remaining: number[] };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtBuf = (b: number) => (b >= 60 ? `${b / 60}h` : `${b}m`);
const fmtDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });

// Self-service "my attendance" for a regular employee — same day-table shape
// as AttendanceMonthly, but scoped server-side to the caller's own records
// (GET /attendance/me/monthly), with no employee picker and no company-wide
// summary table.
export function MyAttendance() {
  const [month, setMonth] = useState(istToday().slice(0, 7));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/attendance/me/monthly`, { params: { month } });
      setReport(res.data);
    } catch (e: any) {
      setReport(null);
      setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load your attendance');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`my_attendance_${report.month}.csv`, [
      ['Date', 'Day', 'Punch In', 'Punch Out', 'Hours', 'Late (min)', 'Early Out (min)', 'Status', 'Note'],
      ...report.days.map(d => [d.date, WEEKDAYS[d.weekday], fmtTime(d.punchIn), fmtTime(d.punchOut), fmtMins(d.workedMin), d.lateMin, d.earlyMin, d.status, d.note]),
    ]);
  };

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField size="small" type="month" label="Month" value={month}
          onChange={e => e.target.value && setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button startIcon={<RestartAltIcon />} onClick={load} sx={{ textTransform: 'none', color: ACCENT }}>Refresh</Button>
        <Button onClick={exportCsv} disabled={loading || !report} sx={{ textTransform: 'none', color: ACCENT }}>Download CSV</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>}

      {!loading && report && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            {STATUSES.filter(s => report.summary.counts[s] > 0).map(s => (
              <Chip key={s} size="small" label={`${s}: ${report.summary.counts[s]}`}
                sx={{ fontWeight: 600, bgcolor: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].color }} />
            ))}
            <Chip size="small" variant="outlined" label={`Hours worked: ${fmtMins(report.summary.workedMin)}`} />
          </Stack>
          <Typography fontSize={12} color="text.secondary" mb={2}>
            Buffers left: {report.buffers.remaining.length ? report.buffers.remaining.map(fmtBuf).join(' + ') : 'none'} of {report.buffers.total.map(fmtBuf).join(' + ')}
          </Typography>

          <TableContainer sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Date', 'Day', 'Punch In', 'Punch Out', 'Hours', 'Late', 'Early Out', 'Status'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {report.days.map(d => (
                  <TableRow key={d.date} hover>
                    <TableCell sx={{ fontSize: 13 }}>{fmtDay(d.date)}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{WEEKDAYS[d.weekday]}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtTime(d.punchIn)}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtTime(d.punchOut)}</TableCell>
                    <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{fmtMins(d.workedMin)}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtShort(d.lateMin)}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtShort(d.earlyMin)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={d.status}
                        sx={{ fontSize: 11, fontWeight: 600, bgcolor: STATUS_STYLE[d.status].bg, color: STATUS_STYLE[d.status].color }} />
                      {d.note && <Typography component="span" fontSize={11} color="text.secondary" sx={{ ml: 1 }}>{d.note}</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
