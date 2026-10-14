import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Stack, Autocomplete,
} from '@mui/material';
import { RestartAlt as RestartAltIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL, ACCENT } from './shared';
import { TH } from './attendanceCommon';

interface RosterOption { code: string; name: string; }

interface MappingRow {
  onboardingId: string;
  name: string;
  dept: string;
  designation: string;
  empId: string;
  attendanceCode: string;
  suggestedCode: string | null;
}

// HR-only admin view: links each active employee's Onboarding record to
// their attendance-machine employee code (Onboarding.empId is a different
// numbering system, never the machine code — see routes/attendance.js).
// Deliberately lives only here, not on the onboarding form, since it's an
// attendance-system concern HR manages separately and as needed, not a
// one-time onboarding step.
export function AttendanceCodeMapping() {
  const [roster, setRoster] = useState<RosterOption[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rosterRes, mappingRes] = await Promise.all([
        axios.get(`${API_URL}/attendance/roster`),
        axios.get(`${API_URL}/attendance/code-mapping`),
      ]);
      setRoster(rosterRes.data.data || []);
      setRows(mappingRes.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load employee codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (row: MappingRow, code: string) => {
    setSavingId(row.onboardingId);
    setError('');
    try {
      const res = await axios.patch(`${API_URL}/attendance/code-mapping/${row.onboardingId}`, { attendanceCode: code });
      setRows(prev => prev.map(r => r.onboardingId === row.onboardingId
        ? { ...r, attendanceCode: res.data.data.attendanceCode, suggestedCode: res.data.data.attendanceCode ? null : r.suggestedCode }
        : r));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not save that code');
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.dept.toLowerCase().includes(q) || r.empId.includes(q));
  }, [rows, search]);

  const unmatchedCount = rows.filter(r => !r.attendanceCode && !r.suggestedCode).length;

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Search name / department" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 240 }} />
        <Button startIcon={<RestartAltIcon />} onClick={load} sx={{ textTransform: 'none', color: ACCENT }}>Refresh</Button>
        {unmatchedCount > 0 && (
          <Chip size="small" color="warning" label={`${unmatchedCount} with no code and no name match`} />
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>}

      {!loading && (
        <TableContainer sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Employee', 'Department', 'Onboarding ID', 'Attendance Code'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(row => {
                const current = roster.find(o => o.code === row.attendanceCode) || null;
                const busy = savingId === row.onboardingId;
                return (
                  <TableRow key={row.onboardingId} hover>
                    <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{row.name || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{row.dept || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{row.empId || '—'}</TableCell>
                    <TableCell sx={{ minWidth: 260 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Autocomplete
                          size="small" sx={{ width: 220 }} options={roster} value={current}
                          loading={busy} disabled={busy}
                          getOptionLabel={o => `${o.code} — ${o.name}`}
                          isOptionEqualToValue={(a, b) => a.code === b.code}
                          onChange={(_, v) => save(row, v ? v.code : '')}
                          renderInput={params => <TextField {...params} placeholder="Assign a code…" />}
                        />
                        {!row.attendanceCode && row.suggestedCode && (
                          <Button size="small" disabled={busy} onClick={() => save(row, row.suggestedCode!)}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', color: ACCENT }}>
                            Use suggested ({row.suggestedCode})
                          </Button>
                        )}
                        {!row.attendanceCode && !row.suggestedCode && (
                          <Typography fontSize={12} color="text.secondary">No name match</Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
