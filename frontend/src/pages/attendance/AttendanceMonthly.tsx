import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Stack, Autocomplete,
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

interface SummaryRow extends Summary {
  employeeCode: string;
  employeeName: string;
  buffersRemaining: number[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtBuf = (b: number) => (b >= 60 ? `${b / 60}h` : `${b}m`);
const fmtDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });

export function AttendanceMonthly({ initialCode }: { initialCode: string | null }) {
  const [month, setMonth] = useState(istToday().slice(0, 7));
  const [code, setCode] = useState<string | null>(initialCode);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setCode(initialCode); }, [initialCode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sum = await axios.get(`${API_URL}/attendance/monthly-summary`, { params: { month } });
      setSummary(sum.data.rows || []);
      if (code) {
        const res = await axios.get(`${API_URL}/attendance/monthly`, { params: { month, code } });
        setReport(res.data);
      } else {
        setReport(null);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load monthly report');
    } finally {
      setLoading(false);
    }
  }, [month, code]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => summary.find(s => s.employeeCode === code) || null, [summary, code]);

  const exportCsv = () => {
    if (report) {
      downloadCsv(`attendance_${report.employeeCode}_${report.month}.csv`, [
        ['Date', 'Day', 'Punch In', 'Punch Out', 'Hours', 'Late (min)', 'Early Out (min)', 'Status', 'Note'],
        ...report.days.map(d => [d.date, WEEKDAYS[d.weekday], fmtTime(d.punchIn), fmtTime(d.punchOut), fmtMins(d.workedMin), d.lateMin, d.earlyMin, d.status, d.note]),
      ]);
    } else {
      downloadCsv(`attendance_summary_${month}.csv`, [
        ['Employee Code', 'Employee Name', ...STATUSES, 'Hours Worked', 'Buffers Left'],
        ...summary.map(s => [s.employeeCode, s.employeeName, ...STATUSES.map(st => s.counts[st]), fmtMins(s.workedMin), s.buffersRemaining.map(fmtBuf).join(' + ') || 'none']),
      ]);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField size="small" type="month" label="Month" value={month}
          onChange={e => e.target.value && setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Autocomplete size="small" sx={{ width: 280 }} options={summary} value={selected}
          getOptionLabel={o => `${o.employeeCode} — ${o.employeeName || 'Unknown'}`}
          isOptionEqualToValue={(a, b) => a.employeeCode === b.employeeCode}
          onChange={(_, v) => setCode(v ? v.employeeCode : null)}
          renderInput={params => <TextField {...params} label="Employee (blank = everyone)" />} />
        <Button startIcon={<RestartAltIcon />} onClick={load} sx={{ textTransform: 'none', color: ACCENT }}>Refresh</Button>
        <Button onClick={exportCsv} disabled={loading} sx={{ textTransform: 'none', color: ACCENT }}>Download CSV</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>}

      {!loading && report && (
        <>
          <Typography fontSize={15} fontWeight={700} mb={1}>{report.employeeName || 'Unknown'} · {report.employeeCode}</Typography>
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

      {!loading && !report && (
        <TableContainer sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Employee Code', 'Employee Name', ...STATUSES, 'Hours', 'Buffers Left'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.map(s => (
                <TableRow key={s.employeeCode} hover sx={{ cursor: 'pointer' }} onClick={() => setCode(s.employeeCode)}>
                  <TableCell sx={{ fontSize: 13 }}>{s.employeeCode}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{s.employeeName || '—'}</TableCell>
                  {STATUSES.map(st => <TableCell key={st} sx={{ fontSize: 13 }}>{s.counts[st] || '—'}</TableCell>)}
                  <TableCell sx={{ fontSize: 13 }}>{fmtMins(s.workedMin)}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{s.buffersRemaining.length ? s.buffersRemaining.map(fmtBuf).join(' + ') : 'none'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
