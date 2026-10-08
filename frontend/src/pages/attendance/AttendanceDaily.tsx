import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Stack, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { RestartAlt as RestartAltIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL, ACCENT } from './shared';
import { AttendanceStatus, STATUSES, STATUS_STYLE, fmtTime, fmtMins, fmtShort, istToday, TH } from './attendanceCommon';

interface AttendanceRow {
  employeeCode: string;
  employeeName: string;
  punchIn: string | null;
  punchOut: string | null;
  workedMin: number | null;
  lateMin: number;
  earlyMin: number;
  status: AttendanceStatus;
  note: string;
}

export function AttendanceDaily({ onOpenMonthly }: { onOpenMonthly: (code: string) => void }) {
  const [date, setDate] = useState(istToday);
  const [statusFilter, setStatusFilter] = useState<'All' | AttendanceStatus>('All');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [holidayLabel, setHolidayLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/attendance/report`, { params: { date } });
      setRows(res.data.rows || []);
      setHolidayLabel(res.data.holidayLabel || '');
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Partial<Record<AttendanceStatus, number>> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (statusFilter === 'All' || r.status === statusFilter) &&
      (!q || r.employeeCode.includes(q) || r.employeeName.toLowerCase().includes(q)));
  }, [rows, statusFilter, search]);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField size="small" type="date" label="Date" value={date}
          onChange={e => e.target.value && setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'All' | AttendanceStatus)}>
            <MenuItem value="All">All statuses</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s}{counts[s] ? ` (${counts[s]})` : ''}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Search name / code" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 190 }} />
        <Button startIcon={<RestartAltIcon />} onClick={load} sx={{ textTransform: 'none', color: ACCENT }}>Refresh</Button>
        <Typography fontSize={12} color="text.secondary">{visible.length} of {rows.length} employees</Typography>
      </Stack>

      {holidayLabel && <Alert severity="info" sx={{ mb: 2 }}>{holidayLabel} — not a working day.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Employee Code', 'Employee Name', 'Punch In', 'Punch Out', 'Hours', 'Late', 'Early Out', 'Status'].map(h => (
                <TableCell key={h} sx={TH}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={22} /></TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: 13 }}>No employees match.</TableCell></TableRow>
            ) : visible.map(r => (
              <TableRow key={r.employeeCode} hover>
                <TableCell sx={{ fontSize: 13 }}>{r.employeeCode}</TableCell>
                <TableCell sx={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', color: ACCENT }} onClick={() => onOpenMonthly(r.employeeCode)}>{r.employeeName || '—'}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{fmtTime(r.punchIn)}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{fmtTime(r.punchOut)}</TableCell>
                <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{fmtMins(r.workedMin)}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{fmtShort(r.lateMin)}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{fmtShort(r.earlyMin)}</TableCell>
                <TableCell>
                  <Chip size="small" label={r.status}
                    sx={{ fontSize: 11, fontWeight: 600, bgcolor: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].color }} />
                  {r.note && <Typography component="span" fontSize={11} color="text.secondary" sx={{ ml: 1 }}>{r.note}</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
