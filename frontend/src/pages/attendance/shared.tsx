import React, { useEffect } from 'react';
import {
  Box, Typography, Alert,
} from '@mui/material';

export interface Employee {
  _id: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  email: string;
  official_email: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
export const API = `${API_URL}/out-of-office`;
export const EMP_API = `${API_URL}/onboarding/eligible-employees`;
export const LEAVE_API = `${API_URL}/leave-management`;

export const ACCENT = '#4f46e5';
export const TH = { fontWeight: 600, fontSize: 11, color: '#64748b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' as const, py: '10px', borderBottom: '1px solid #e2e8f0' };
export const TD = { fontSize: 12, py: '10px', verticalAlign: 'top' as const };
export const ELLIPSIS = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' as const };


export const fmtDate = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
};

export const fmtTime24 = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return String(d); }
};

export const fmtDateTime24 = (d?: string | Date | null) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${fmtDate(dt)}, ${fmtTime24(dt)}`;
  } catch { return String(d); }
};

export const fmtDayMonth = (d?: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return String(d); }
};

export function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2 }}>{msg}</Alert>
    </Box>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography fontSize={11} color="text.secondary">{label}</Typography>
      <Typography fontSize={13} fontWeight={600} sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}

// ─── Placeholder tabs ────────────────────────────────────────────────────────────

export function ComingSoonTab({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, color: 'text.secondary' }}>
      {icon}
      <Typography fontSize={16} fontWeight={700} color="#0f172a" mt={1.5}>{title}</Typography>
      <Typography fontSize={12} mt={0.5}>This feature is cooking. Check back soon.</Typography>
    </Box>
  );
}
