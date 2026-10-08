export type AttendanceStatus =
  | 'Present' | 'Late' | 'Half Day' | 'Absent' | 'On Leave'
  | 'Out of Office' | 'Holiday' | 'Incomplete';

export const STATUSES: AttendanceStatus[] = ['Present', 'Late', 'Half Day', 'Absent', 'On Leave', 'Out of Office', 'Holiday', 'Incomplete'];

export const STATUS_STYLE: Record<AttendanceStatus, { bg: string; color: string }> = {
  Present:         { bg: '#dcfce7', color: '#166534' },
  Late:            { bg: '#fef3c7', color: '#92400e' },
  'Half Day':      { bg: '#ffedd5', color: '#9a3412' },
  Absent:          { bg: '#fee2e2', color: '#991b1b' },
  'On Leave':      { bg: '#dbeafe', color: '#1e40af' },
  'Out of Office': { bg: '#ede9fe', color: '#5b21b6' },
  Holiday:         { bg: '#e2e8f0', color: '#334155' },
  Incomplete:      { bg: '#fef9c3', color: '#854d0e' },
};

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';

export const fmtMins = (m: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
export const fmtShort = (m: number) => (m > 0 ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`) : '—');

// Dates are IST calendar days, regardless of the browser's own time zone.
export const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

export const TH = { fontWeight: 700, fontSize: 12, color: '#475569' };

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
