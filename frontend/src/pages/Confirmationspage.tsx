import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Collapse,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Divider, Stack, IconButton,
} from '@mui/material';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import axios              from 'axios';

// ─── Layout components ───────────────────────────────────────────────────────
import Sidebar from '../components/Sidebar';   // ← adjust path if needed
import Navbar   from '../components/Navbar';   // ← adjust path if needed

// ─── Types ────────────────────────────────────────────────────────────────────

type CurrentStatus = 'probation' | 'confirmed' | 'extended' | 'not_confirmed';
type Stage         = 'pending_manager' | 'pending_management' | 'completed' | 'on_hold';

interface HistoryEntry {
  status        : CurrentStatus;
  reason        : string;
  monthsExtended: number | null;
  changedBy     : string;
  changedByName : string;
  date          : string;
}

interface Decision {
  status        : CurrentStatus | null;
  reason        : string;
  monthsExtended: number | null;
  submittedAt   : string | null;
}

interface Confirmation {
  _id               : string;
  employeeCode      : string;
  employeeName      : string;
  department        : string;
  designation       : string;
  joiningDate       : string;
  level             : number;
  email             : string;
  reportingManager  : string;
  pmsScore          : number | null;
  currentStatus     : CurrentStatus;
  stage             : Stage;
  managerDecision   : Decision;
  managementDecision: Decision;
  history           : HistoryEntry[];
  extendedMonths    : number | null;
  extendedTill      : string | null;
  reviewDate        : string | null;
  createdAt         : string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.REACT_APP_API_URL || 'http://13.235.0.127:5000/api';
const API      = API_BASE + '/confirmations';

const STATUS_CFG: Record<CurrentStatus, { label: string; color: string; bg: string }> = {
  probation    : { label: 'Probation',     color: '#6B7280', bg: '#F3F4F6' },
  confirmed    : { label: 'Confirmed',     color: '#059669', bg: '#ECFDF5' },
  extended     : { label: 'Extended',      color: '#D97706', bg: '#FFFBEB' },
  not_confirmed: { label: 'Not Confirmed', color: '#DC2626', bg: '#FEF2F2' },
};

const STAGE_CFG: Record<Stage, { label: string }> = {
  pending_manager    : { label: 'Pending Manager'    },
  pending_management : { label: 'Pending Management' },
  completed          : { label: 'Completed'          },
  on_hold            : { label: 'On Hold'            },
};

const STATUS_OPTIONS: { value: CurrentStatus; label: string }[] = [
  { value: 'probation',     label: 'Continue Probation' },
  { value: 'confirmed',     label: 'Confirm'            },
  { value: 'extended',      label: 'Extend Probation'   },
  { value: 'not_confirmed', label: 'Not Confirmed'      },
];

const TH = { fontWeight: 700, fontSize: 12, color: 'text.secondary', bgcolor: '#f9fafb', whiteSpace: 'nowrap' as const };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const calculateReviewDate = (joiningDate?: string | null) => {
  if (!joiningDate) return null;
  try {
    const joined = new Date(joiningDate);
    if (isNaN(joined.getTime())) return null;
    const reviewDate = new Date(joined);
    reviewDate.setMonth(reviewDate.getMonth() + 6);
    return reviewDate;
  } catch {
    return null;
  }
};

// ─── Status / Stage chips ─────────────────────────────────────────────────────

function StatusChip({ status }: { status: CurrentStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.probation;
  return (
    <Chip size="small" label={c.label}
      sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11, border: `1px solid ${c.color}30` }} />
  );
}

function StageChip({ stage }: { stage: Stage }) {
  const done = stage === 'completed';
  const onHold = stage === 'on_hold';
  return (
    <Chip
      size="small"
      icon={done ? <CheckCircleIcon fontSize="small" /> : <HourglassEmptyIcon fontSize="small" />}
      label={STAGE_CFG[stage]?.label ?? stage}
      sx={{
        bgcolor : done ? '#ECFDF5' : onHold ? '#FEF3C7' : '#EFF6FF',
        color   : done ? '#059669' : onHold ? '#D97706' : '#2563EB',
        fontWeight: 600, fontSize: 11,
        border  : `1px solid ${done ? '#6EE7B7' : onHold ? '#FCD34D' : '#BFDBFE'}`,
        '& .MuiChip-icon': { color: 'inherit', ml: '6px' },
      }}
    />
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        {msg}
      </Alert>
    </Box>
  );
}

// ─── Dashboard View ─────────────────────────────────────────────────────────--

function DashboardView({ records, loading, onSelect }: {
  records : Confirmation[];
  loading : boolean;
  onSelect: (r: Confirmation) => void;
}) {
  // Filter states
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showAllProbation, setShowAllProbation] = useState(false); // Toggle state
  
  // Get current date info
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Helper function to check if employee is within first 6 months (on probation)
  const isOnProbation = (joiningDate: string) => {
    const joined = new Date(joiningDate);
    const sixMonthsLater = new Date(joined);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    return currentDate <= sixMonthsLater;
  };
  
  // Filter records - based on toggle state
  const filteredRecords = records.filter(record => {
    const recordDate = new Date(record.joiningDate);
    const recordMonth = recordDate.getMonth();
    const recordYear = recordDate.getFullYear();
    
    // Calculate review date (6 months after joining)
    const reviewDate = new Date(recordDate);
    reviewDate.setMonth(reviewDate.getMonth() + 6);
    const reviewMonth = reviewDate.getMonth();
    const reviewYear = reviewDate.getFullYear();
    
    // Check if confirmation is pending this month
    const isPendingThisMonth = reviewMonth === currentMonth && 
                              reviewYear === currentYear && 
                              (record.stage === 'pending_manager' || 
                               record.stage === 'pending_management' ||
                               record.stage === 'on_hold');
    
    // Show all probation employees (within first 6 months) or only pending this month
    const shouldShow = showAllProbation 
      ? isOnProbation(record.joiningDate) // All employees within first 6 months
      : isPendingThisMonth; // Only pending this month
    
    const matchesSearch = !employeeSearch || 
      record.employeeName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      record.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase());
    
    return shouldShow && matchesSearch;
  });

  const counts = {
    total       : filteredRecords.length,
    probation   : filteredRecords.filter(r => isOnProbation(r.joiningDate)).length,
    confirmed   : filteredRecords.filter(r => r.currentStatus === 'confirmed').length,
    extended    : filteredRecords.filter(r => r.currentStatus === 'extended').length,
    notConfirmed: filteredRecords.filter(r => r.currentStatus === 'not_confirmed').length,
    onHold      : filteredRecords.filter(r => r.stage === 'on_hold').length,
  };

  const STATS = [
    { 
      label: showAllProbation ? 'All Probation' : 'Pending This Month', 
      value: counts.total,        
      color: '#3B82F6', 
      bg: '#EFF6FF' 
    },
    { label: 'On Probation',  value: counts.probation,    color: '#6B7280', bg: '#F3F4F6' },
    { label: 'Confirmed',     value: counts.confirmed,    color: '#059669', bg: '#ECFDF5' },
    { label: 'Extended',      value: counts.extended,     color: '#D97706', bg: '#FFFBEB' },
    { label: 'Not Confirmed', value: counts.notConfirmed, color: '#DC2626', bg: '#FEF2F2' },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3, color: '#1F2937' }}>
        Probation Confirmations - {showAllProbation ? 'All Employees' : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </Typography>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <Box key={s.label} sx={{ 
            flex: '1 1 140px', 
            p: 2, 
            borderRadius: 2, 
            bgcolor: s.bg, 
            border: `1px solid ${s.color}30`,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }
          }}>
            <Typography fontSize={28} fontWeight={800} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography fontSize={12} color="text.secondary" mt={0.5}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Filters */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        mb: 3, 
        flexWrap: 'wrap',
        p: 2,
        bgcolor: 'white',
        borderRadius: 2,
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        alignItems: 'center',
      }}>
        <TextField
          size="small"
          placeholder="Search employee..."
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
          sx={{ minWidth: 200 }}
          InputProps={{
            sx: { fontSize: 14 }
          }}
        />

        {/* Toggle Button */}
        <Button
          variant={showAllProbation ? "contained" : "outlined"}
          size="small"
          onClick={() => setShowAllProbation(!showAllProbation)}
          sx={{ 
            fontSize: 14, 
            textTransform: 'none',
            bgcolor: showAllProbation ? '#3B82F6' : 'transparent',
            color: showAllProbation ? 'white' : '#3B82F6',
            borderColor: '#3B82F6',
            '&:hover': {
              bgcolor: showAllProbation ? '#2563EB' : '#EFF6FF',
            }
          }}
        >
          {showAllProbation ? 'Show This Month Only' : 'Show All Probation'}
        </Button>

        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setEmployeeSearch('');
            setShowAllProbation(false);
          }}
          sx={{ fontSize: 14, textTransform: 'none' }}
        >
          Reset All
        </Button>
      </Box>

      {/* Info Banner */}
      {!showAllProbation && (
        <Box sx={{ 
          mb: 3,
          p: 2,
          bgcolor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 2,
          fontSize: 13,
          color: '#1E40AF',
        }}>
          <strong>Current View:</strong> Showing employees whose probation confirmation is pending for {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. 
          Click "Show All Probation" to view all employees currently on probation (within first 6 months of joining).
        </Box>
      )}

      {showAllProbation && (
        <Box sx={{ 
          mb: 3,
          p: 2,
          bgcolor: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: 2,
          fontSize: 13,
          color: '#166534',
        }}>
          <strong>Current View:</strong> Showing all employees currently on probation (within their first 6 months of employment). 
          Click "Show This Month Only" to view only pending confirmations for {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </Box>
      )}

      {/* Table Container */}
      <Box sx={{ 
        bgcolor: 'white', 
        borderRadius: 2, 
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        maxHeight: '600px', // Fixed height for scrollable table
        display: 'flex',
        flexDirection: 'column',
      }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={10}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 550, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Designation</TableCell>
                  <TableCell>Reporting Manager</TableCell>
                  <TableCell>Joining Date</TableCell>
                  <TableCell>PMS Score</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Review Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8, color: 'text.secondary', fontSize: 14 }}>
                      {showAllProbation 
                        ? 'No employees found on probation (within first 6 months)'
                        : `No pending confirmations found for ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                      }
                    </TableCell>
                  </TableRow>
                )}
                {filteredRecords.map(r => (
                  <TableRow 
                    key={r._id} 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      '&:hover': {
                        bgcolor: '#E0F2FE', // Pastel blue
                        transform: 'translateX(2px)',
                        '& td': {
                          color: '#0C4A6E',
                        }
                      },
                      '& td': {
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                      }
                    }} 
                    onClick={() => onSelect(r)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: '#3B82F6', 
                          fontSize: 12, 
                          fontWeight: 700,
                          transition: 'all 0.3s ease',
                        }}>
                          {initials(r.employeeName)}
                        </Avatar>
                        <Box>
                          <Typography fontSize={13} fontWeight={600}>{r.employeeName}</Typography>
                          <Typography fontSize={11} color="text.secondary">{r.employeeCode}</Typography>
                        </Box>
                        {/* Click to proceed overlay */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(2, 132, 199, 0.95)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 600,
                            opacity: 0,
                            visibility: 'hidden',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: 'scale(0.9)',
                            borderRadius: 1,
                            zIndex: 10,
                            pointerEvents: 'none',
                            '&::before': {
                              content: '"Click to proceed"',
                            }
                          }}
                          className="hover-overlay"
                        />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{r.department   || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{r.designation  || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{r.reportingManager || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtDate(r.joiningDate)}</TableCell>
                    <TableCell>
                      {r.pmsScore != null
                        ? <Chip label={r.pmsScore} size="small" sx={{ fontWeight: 700, bgcolor: '#EFF6FF', color: '#2563EB' }} />
                        : '—'}
                    </TableCell>
                    <TableCell><StatusChip status={r.currentStatus} /></TableCell>
                    <TableCell><StageChip  stage={r.stage} /></TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {r.stage === 'on_hold' && r.reviewDate
                        ? fmtDate(r.reviewDate)
                        : fmtDate(calculateReviewDate(r.joiningDate)?.toISOString())
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({ record, onBack, onChangeStatus }: {
  record          : Confirmation;
  onBack          : () => void;
  onChangeStatus  : () => void;
}) {
  const INFO = [
    ['Employee Code',     record.employeeCode      || '—'],
    ['Email',             record.email             || '—'],
    ['Department',        record.department        || '—'],
    ['Designation',       record.designation       || '—'],
    ['Level',             `L${record.level || 1}`        ],
    ['Joining Date',      fmtDate(record.joiningDate)    ],
    ['Review Due',        record.stage === 'on_hold' && record.reviewDate 
                          ? fmtDate(record.reviewDate) 
                          : fmtDate(calculateReviewDate(record.joiningDate)?.toISOString())],
    ['Reporting Manager', record.reportingManager  || '—'],
    ['PMS Score',         record.pmsScore != null ? String(record.pmsScore) : '—'],
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#F3F4F6', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Avatar sx={{ width: 48, height: 48, bgcolor: '#3B82F6', fontWeight: 700, fontSize: 18 }}>
          {initials(record.employeeName)}
        </Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="1.1rem">{record.employeeName}</Typography>
          <Typography fontSize={13} color="text.secondary">{record.designation} · {record.department}</Typography>
        </Box>
        <StatusChip status={record.currentStatus} />
        <StageChip  stage={record.stage} />
        {record.stage !== 'completed' && record.stage !== 'on_hold' && (
          <Button variant="contained" size="small" onClick={onChangeStatus}
            sx={{ bgcolor: '#2563EB', textTransform: 'none', fontWeight: 600, px: 3 }}>
            Update Status
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Paper variant="outlined" sx={{ flex: '1 1 280px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Employee Information</Typography>
          <Stack spacing={1.4}>
            {INFO.map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography fontSize={13} color="text.secondary">{label}</Typography>
                <Typography fontSize={13} fontWeight={500} textAlign="right">{value}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ flex: '1 1 260px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Final Decision </Typography>

          <Stack spacing={2}>
            <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Manager Decision</Typography>
              {record.managerDecision?.status ? (
                <>
                  <StatusChip status={record.managerDecision.status} />
                  <Typography fontSize={13} mt={1}>{record.managerDecision.reason}</Typography>
                  {record.managerDecision.monthsExtended && (
                    <Chip label={`Extended by ${record.managerDecision.monthsExtended} months`}
                      size="small" sx={{ mt: 1, bgcolor: '#FFFBEB', color: '#D97706' }} />
                  )}
                </>
              ) : (
                <Typography fontSize={13} color="text.disabled">Pending</Typography>
              )}
            </Box>

            <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>Management Decision</Typography>
              {record.managementDecision?.status ? (
                <>
                  <StatusChip status={record.managementDecision.status} />
                  <Typography fontSize={13} mt={1}>{record.managementDecision.reason}</Typography>
                  {record.managementDecision.monthsExtended && (
                    <Chip label={`Extended by ${record.managementDecision.monthsExtended} months`}
                      size="small" sx={{ mt: 1, bgcolor: '#FFFBEB', color: '#D97706' }} />
                  )}
                </>
              ) : (
                <Typography fontSize={13} color="text.disabled">
                  {record.stage === 'pending_manager' ? 'Waiting for manager' : 'Pending'}
                </Typography>
              )}
            </Box>
          </Stack>

          {record.stage === 'on_hold' && record.extendedMonths && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#FEF3C7', borderRadius: 1.5, border: '1px solid #FCD34D' }}>
              <Typography fontSize={11} fontWeight={700} color="#D97706" mb={1}>Extension Details</Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontSize={12} color="text.secondary">Extended Till:</Typography>
                  <Typography fontSize={12} fontWeight={600}>{fmtDate(record.extendedTill)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontSize={12} color="text.secondary">Review Due:</Typography>
                  <Typography fontSize={12} fontWeight={600}>{fmtDate(record.reviewDate)}</Typography>
                </Box>
              </Stack>
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ flex: '2 1 380px', borderRadius: 2, p: 3 }}>
          <Typography fontWeight={700} mb={2}>Change History</Typography>
          {record.history.length === 0 ? (
            <Typography color="text.disabled" fontSize={13}>No history recorded yet.</Typography>
          ) : (
            <Stack spacing={2.5}>
              {[...record.history].reverse().map((h, i) => (
                <Box key={i} sx={{ borderLeft: `4px solid ${STATUS_CFG[h.status]?.color || '#9CA3AF'}`, pl: 2, py: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <StatusChip status={h.status} />
                    {h.monthsExtended && (
                      <Chip label={`Extended for ${h.monthsExtended} months`} size="small" sx={{ bgcolor: '#FFFBEB', color: '#D97706' }} />
                    )}
                  </Box>
                  <Typography fontSize={13} mt={0.8}>{h.reason || '—'}</Typography>
                  <Typography fontSize={12} color="text.secondary" mt={0.5}>
                    {h.changedByName || h.changedBy} · {fmtDate(h.date)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

// ─── Status Change View ───────────────────────────────────────────────────────

function StatusChangeView({ record, onBack, onSuccess, showToast }: {
  record    : Confirmation;
  onBack    : () => void;
  onSuccess : (updated: Confirmation) => void;
  showToast : (msg: string, type: 'success' | 'error') => void;
}) {
  const isManagerTurn    = record.stage === 'pending_manager';
  const isManagementTurn = record.stage === 'pending_management';
  const isOnHold         = record.stage === 'on_hold';
  const endpoint         = isManagerTurn ? 'manager' : 'management';
  const roleLabel        = isManagerTurn ? 'Manager' : 'Management';

  const [status,         setStatus]         = useState<CurrentStatus>('probation');
  const [reason,         setReason]         = useState('');
  const [monthsExtended, setMonthsExtended] = useState(3);
  const [submitting,     setSubmitting]     = useState(false);

  if (isOnHold) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
          <Typography variant="h6">On Hold</Typography>
        </Box>
        <Alert severity="warning">
          This probation confirmation is currently on hold due to extension. It will automatically re-open for re-evaluation on <strong>{fmtDate(record.reviewDate)}</strong>.
        </Alert>
      </Box>
    );
  }

  if (!isManagerTurn && !isManagementTurn) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
          <Typography variant="h6">Confirmation Completed</Typography>
        </Box>
        <Alert severity="info">
          This employee's probation confirmation process is already completed.
        </Alert>
      </Box>
    );
  }

  const submit = async () => {
    if (!reason.trim()) return showToast('Please provide a reason', 'error');

    try {
      setSubmitting(true);
      const payload: any = { status, reason };
      if (status === 'extended') payload.monthsExtended = monthsExtended;

      const { data } = await axios.put(`${API}/${record._id}/${endpoint}`, payload);
      if (data.success) {
        showToast('Decision submitted successfully', 'success');
        onSuccess(data.data);
      } else {
        showToast(data.message || 'Failed to submit', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Request failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={onBack} sx={{ bgcolor: '#f1f5f9' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h6">{roleLabel} Decision</Typography>
          <Typography variant="body2" color="text.secondary">
            {record.employeeName} — {record.designation}
          </Typography>
        </Box>
      </Box>

      {isManagementTurn && record.managerDecision?.status && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Manager recommended: <strong>{STATUS_CFG[record.managerDecision.status].label}</strong>
          {record.managerDecision.monthsExtended ? ` (+${record.managerDecision.monthsExtended} months)` : ''}
          {' — '}{record.managerDecision.reason}
        </Alert>
      )}

      <Paper sx={{ p: 4, maxWidth: 560, borderRadius: 2 }} variant="outlined">
        <Stack spacing={3}>
          <FormControl fullWidth>
            <InputLabel>Decision</InputLabel>
            <Select
              value={status}
              label="Decision"
              onChange={e => setStatus(e.target.value as CurrentStatus)}
            >
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {status === 'extended' && (
            <TextField
              label="Extend by (months)"
              type="number"
              value={monthsExtended}
              onChange={e => {
                const v = Number(e.target.value);
                setMonthsExtended(Math.max(1, Math.min(12, v || 1)));
              }}
              inputProps={{ min: 1, max: 12 }}
              fullWidth
              helperText="1–12 months"
            />
          )}

          <TextField
            label="Reason / Comments *"
            multiline
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            fullWidth
            placeholder="Please explain your decision..."
          />

          <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
            <Button
              variant="contained"
              onClick={submit}
              disabled={submitting || !reason.trim()}
              sx={{ minWidth: 140 }}
            >
              {submitting ? <CircularProgress size={24} /> : `Submit ${roleLabel} Decision`}
            </Button>
            <Button variant="outlined" onClick={onBack}>
              Cancel
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail' | 'status-change';

export default function ConfirmationsPage() {
  const [records,  setRecords]  = useState<Confirmation[]>([]);
  const [selected, setSelected] = useState<Confirmation | null>(null);
  const [view,     setView]     = useState<View>('dashboard');
  const [loading,  setLoading]  = useState(true);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ msg, type });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(API);
      const data = res.data;
      setRecords(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      showToast('Failed to load confirmation records', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = (record: Confirmation) => {
    setSelected(record);
    setView('detail');
  };

  const handleBack = () => {
    if (view === 'status-change') {
      setView('detail');
    } else {
      setView('dashboard');
      setSelected(null);
    }
  };

  const handleStatusUpdate = (updatedRecord: Confirmation) => {
    setRecords(prev => prev.map(r => r._id === updatedRecord._id ? updatedRecord : r));
    setSelected(updatedRecord);
    setView('detail');
  };

  if (loading && view === 'dashboard') {
    return (
      <div className="flex min-h-screen bg-gray-50/70">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 flex items-center justify-center pt-16 md:pt-20">
            <CircularProgress size={64} thickness={4} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">

        {/* Navbar */}
        <Navbar />

        {/* Fixed height content area - no page scroll */}
        <main className="flex-1 overflow-hidden pt-16 md:pt-20">

          <Box sx={{ maxWidth: 1400, mx: "auto", width: "100%", height: "100%", overflow: "hidden" }}>

            {/* Toast */}
            {toastMsg && (
              <Toast
                msg={toastMsg.msg}
                type={toastMsg.type}
                onClose={() => setToastMsg(null)}
              />
            )}

            {/* Active view - takes full height */}
            {view === 'dashboard' && (
              <DashboardView
                records={records}
                loading={loading}
                onSelect={handleSelect}
              />
            )}

            {view === 'detail' && selected && (
              <DetailView
                record={selected}
                onBack={handleBack}
                onChangeStatus={() => setView('status-change')}
              />
            )}

            {view === 'status-change' && selected && (
              <StatusChangeView
                record={selected}
                onBack={handleBack}
                onSuccess={handleStatusUpdate}
                showToast={showToast}
              />
            )}

          </Box>
        </main>
      </div>
    </div>
  );
}