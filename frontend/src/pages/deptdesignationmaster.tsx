'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, InputAdornment, Pagination, Alert, Snackbar,
  Card, CardContent, Tooltip, CircularProgress, Divider,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Close as CloseIcon,
  Edit as EditIcon, Refresh as RefreshIcon,
  Business as BusinessIcon, WorkOutline as WorkIcon,
  Groups as GroupsIcon, Category as CategoryIcon,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const BRAND_BLUE = '#1976d2';
const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const PAGE_SIZE  = 15;
const SIDEBAR_W  = 25;
const NAVBAR_H   = 56;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleMasterRow {
  _id?: string;
  dept_id: number | '';
  department: string;
  department_type: string;
  parent_department: string;
  department_head: string;
  department_deputy: string;
  dept_head_email: string;
  dept_group_email: string;
  desig_id: number | '';
  designation: string;
  management_level: string;
  reporting_manager: string;
  dept_page_link: string;
  role_document_link: string;
  jd_link: string;
  remarks: string;
  desig_email_id: string;
  emp_id: string;
  emp_name: string;
}

const EMPTY_FORM: RoleMasterRow = {
  dept_id: '', department: '', department_type: '', parent_department: '',
  department_head: '', department_deputy: '', dept_head_email: '',
  dept_group_email: '', desig_id: '', designation: '', management_level: '',
  reporting_manager: '', dept_page_link: '', role_document_link: '',
  jd_link: '', remarks: '', desig_email_id: '', emp_id: '', emp_name: '',
};

const DEPT_TYPES  = ['Delivery', 'Support'];
const MGMT_LEVELS = ['Senior Management', 'Middle Management', 'Junior Management', 'Staff'];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
      <CardContent sx={{ p: '14px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ color: BRAND_BLUE, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1} component="span" display="block">
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeptDesignationMaster() {
  const [rows,     setRows]     = useState<RoleMasterRow[]>([]);
  const [filtered, setFiltered] = useState<RoleMasterRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);

  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState<RoleMasterRow>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RoleMasterRow, string>>>({});

  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  // ─── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/rolemaster`);
      const json = await res.json();

      // Backend returns an array directly (route uses .lean() → plain snake_case objects)
      const raw: any[] = Array.isArray(json) ? json : (json.data || []);

      const mapped: RoleMasterRow[] = raw.map((item: any) => ({
        _id:               item._id                                          ?? '',
        dept_id:           item.dept_id            ?? item.Dept_Id           ?? '',
        department:        item.department         ?? item.Department         ?? '',
        department_type:   item.department_type    ?? item['Department Type (Delivery or Support)'] ?? '',
        parent_department: item.parent_department  ?? item['Parent Department']  ?? '',
        department_head:   item.department_head    ?? item['Department Head']    ?? '',
        department_deputy: item.department_deputy  ?? item['Department Deputy']  ?? '',
        dept_head_email:   item.dept_head_email    ?? item['Dept Head Email']    ?? '',
        dept_group_email:  item.dept_group_email   ?? item['Dept Group Email']   ?? '',
        desig_id:          item.desig_id           ?? item.Desig_id              ?? '',
        designation:       item.designation        ?? item.Designation           ?? '',
        management_level:  item.management_level   ?? item['Management Level']   ?? '',
        reporting_manager: item.reporting_manager  ?? item['Reporting Manager']  ?? '',
        dept_page_link:    item.dept_page_link     ?? item['Dept Page Link (BO Internal Site)'] ?? '',
        role_document_link:item.role_document_link ?? item['Role Document Link'] ?? '',
        jd_link:           item.jd_link            ?? item['JD Link']            ?? '',
        remarks:           item.remarks            ?? item.Remarks               ?? '',
        desig_email_id:    item.desig_email_id     ?? item['desig Email Id']     ?? '',
        emp_id:            item.emp_id             ?? item.Emp_id                ?? '',
        emp_name:          item.emp_name           ?? item.Emp_name              ?? '',
      }));

      setRows(mapped);
    } catch {
      showToast('Could not load data from server', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Filter ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = search.toLowerCase();
    const result = rows.filter(r => {
      const matchQ     = !q || [r.department, r.designation, r.reporting_manager, r.department_head, r.parent_department]
        .some(v => (v || '').toLowerCase().includes(q));
      const matchType  = !filterType  || r.department_type  === filterType;
      const matchLevel = !filterLevel || r.management_level === filterLevel;
      return matchQ && matchType && matchLevel;
    });
    setFiltered(result);
    setPage(1);
  }, [rows, search, filterType, filterLevel]);

  // ─── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    total:        rows.length,
    departments:  new Set(rows.map(r => r.dept_id).filter(Boolean)).size,
    designations: new Set(rows.map(r => r.desig_id).filter(Boolean)).size,
    filled:       rows.filter(r => r.desig_email_id).length,
  };

  // ─── Pagination ───────────────────────────────────────────────────────────────

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Form helpers ─────────────────────────────────────────────────────────────

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setOpen(true); };
  const openEdit = (row: RoleMasterRow) => { setForm({ ...row }); setEditId(row._id || null); setErrors({}); setOpen(true); };

  const handleField = (field: keyof RoleMasterRow, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof RoleMasterRow, string>> = {};
    if (!form.dept_id)            e.dept_id     = 'Required';
    if (!form.department.trim())  e.department  = 'Required';
    if (!form.desig_id)           e.desig_id    = 'Required';
    if (!form.designation.trim()) e.designation = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const method = editId ? 'PUT'  : 'POST';
      const url    = editId ? `${API_BASE}/rolemaster/${editId}` : `${API_BASE}/rolemaster`;
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save failed');
      showToast(editId ? 'Entry updated' : 'Entry added', 'success');
      setOpen(false);
      fetchData();
    } catch (e: any) {
      showToast(e.message || 'Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg: string, severity: 'success' | 'error') =>
    setToast({ open: true, msg, severity });

  // ─── Columns ──────────────────────────────────────────────────────────────────

  const columns: { key: keyof RoleMasterRow; label: string; minWidth?: number }[] = [
    { key: 'dept_id',           label: 'D-ID',       minWidth: 52  },
    { key: 'department',        label: 'Department',  minWidth: 120 },
    { key: 'department_type',   label: 'Type',        minWidth: 80  },
    { key: 'desig_id',          label: 'R-ID',        minWidth: 52  },
    { key: 'designation',       label: 'Designation', minWidth: 130 },
    { key: 'management_level',  label: 'Level',       minWidth: 110 },
    { key: 'reporting_manager', label: 'Reports to',  minWidth: 110 },
    { key: 'dept_head_email',   label: 'Head email',  minWidth: 140 },
  ];

  const typeColor = (t: string) =>
    t === 'Delivery' ? { bg: '#e3f2fd', color: '#0d47a1' }
    : t === 'Support' ? { bg: '#e8f5e9', color: '#1b5e20' }
    : { bg: '#f5f5f5', color: '#616161' };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f7fb', overflow: 'hidden' }}>

      <Sidebar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${SIDEBAR_W}px`,
          mt: `${NAVBAR_H}px`,
          width: `calc(100% - ${SIDEBAR_W}px)`,
          minWidth: 0,
          overflowX: 'hidden',
          p: { xs: 2, md: 3 },
        }}
      >
        <Navbar />

        {/* Page header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Department &amp; Designation Master</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Manage all departments, designations, and role metadata
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchData} size="small" sx={{ border: '1px solid #e0e0e0' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}
              sx={{ bgcolor: BRAND_BLUE, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
              Add new
            </Button>
          </Box>
        </Box>

        {/* Stat cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 2.5 }}>
          <StatCard icon={<BusinessIcon />} label="Total rows"   value={stats.total} />
          <StatCard icon={<CategoryIcon />} label="Departments"  value={stats.departments} />
          <StatCard icon={<WorkIcon />}     label="Designations" value={stats.designations} />
          <StatCard icon={<GroupsIcon />}   label="Filled roles" value={stats.filled} />
        </Box>

        {/* Filter row */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search department, designation, manager…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filterType} label="Type" onChange={e => setFilterType(e.target.value)}>
              <MenuItem value="">All types</MenuItem>
              {DEPT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Level</InputLabel>
            <Select value={filterLevel} label="Level" onChange={e => setFilterLevel(e.target.value)}>
              <MenuItem value="">All levels</MenuItem>
              {MGMT_LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {/* Table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
          <TableContainer sx={{ maxHeight: 500, overflowX: 'auto' }}>
            <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.73rem', width: 40 }}>#</TableCell>
                  {columns.map(col => (
                    <TableCell
                      key={col.key}
                      sx={{ bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.73rem', minWidth: col.minWidth, whiteSpace: 'nowrap' }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.73rem', width: 56 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} align="center"
                      sx={{ py: 4, color: 'text.secondary', fontSize: '0.85rem' }}>
                      No entries found
                    </TableCell>
                  </TableRow>
                ) : pageRows.map((row, i) => (
                  <TableRow key={row._id || i} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ color: 'text.disabled', fontSize: '0.73rem' }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </TableCell>

                    {columns.map(col => {
                      const val = row[col.key];

                      if (col.key === 'department_type') {
                        const c = typeColor(String(val || ''));
                        return (
                          <TableCell key={col.key} sx={{ py: 0.8 }}>
                            {val
                              ? <Chip label={val} size="small"
                                  sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, fontSize: '0.68rem', height: 20 }} />
                              : <span style={{ color: '#bbb' }}>—</span>}
                          </TableCell>
                        );
                      }

                      if (col.key === 'department') {
                        return (
                          <TableCell key={col.key}
                            sx={{ fontWeight: 600, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {val || '—'}
                          </TableCell>
                        );
                      }

                      if (col.key === 'designation') {
                        return (
                          <TableCell key={col.key}
                            sx={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {val || '—'}
                          </TableCell>
                        );
                      }

                      if (col.key === 'dept_id' || col.key === 'desig_id') {
                        return (
                          <TableCell key={col.key} sx={{ color: 'text.secondary', fontSize: '0.73rem' }}>
                            {val || '—'}
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={col.key}
                          sx={{ color: 'text.secondary', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={String(val || '')} placement="top">
                            <span>{val || '—'}</span>
                          </Tooltip>
                        </TableCell>
                      );
                    })}

                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(row)}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination footer */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="caption" color="text.secondary">
              {filtered.length === 0
                ? '0 results'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </Typography>
            <Pagination count={pageCount} page={page} onChange={(_, v) => setPage(v)} size="small" color="primary" />
          </Box>
        </Paper>

        {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}>

          <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
            <Typography variant="h6" fontWeight={700}>{editId ? 'Edit entry' : 'Add new entry'}</Typography>
            <IconButton onClick={() => setOpen(false)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ pt: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              <Typography variant="overline" color="text.secondary" fontWeight={600}
                sx={{ fontSize: '0.7rem', letterSpacing: 1 }}>Department info</Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr', gap: 2 }}>
                <TextField fullWidth size="small" label="Dept ID *" type="number"
                  value={form.dept_id}
                  onChange={e => handleField('dept_id', e.target.value ? Number(e.target.value) : '')}
                  error={!!errors.dept_id} helperText={errors.dept_id} />
                <TextField fullWidth size="small" label="Department *"
                  value={form.department} onChange={e => handleField('department', e.target.value)}
                  error={!!errors.department} helperText={errors.department} />
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select value={form.department_type} label="Type"
                    onChange={e => handleField('department_type', e.target.value)}>
                    <MenuItem value="">— none —</MenuItem>
                    {DEPT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                <TextField fullWidth size="small" label="Parent department"
                  value={form.parent_department} onChange={e => handleField('parent_department', e.target.value)} />
                <TextField fullWidth size="small" label="Department head"
                  value={form.department_head} onChange={e => handleField('department_head', e.target.value)} />
                <TextField fullWidth size="small" label="Department deputy"
                  value={form.department_deputy} onChange={e => handleField('department_deputy', e.target.value)} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField fullWidth size="small" label="Dept head email" type="email"
                  value={form.dept_head_email} onChange={e => handleField('dept_head_email', e.target.value)} />
                <TextField fullWidth size="small" label="Group email" type="email"
                  value={form.dept_group_email} onChange={e => handleField('dept_group_email', e.target.value)} />
              </Box>

              <Typography variant="overline" color="text.secondary" fontWeight={600}
                sx={{ fontSize: '0.7rem', letterSpacing: 1, mt: 1 }}>Designation info</Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr', gap: 2 }}>
                <TextField fullWidth size="small" label="Desig ID *" type="number"
                  value={form.desig_id}
                  onChange={e => handleField('desig_id', e.target.value ? Number(e.target.value) : '')}
                  error={!!errors.desig_id} helperText={errors.desig_id} />
                <TextField fullWidth size="small" label="Designation *"
                  value={form.designation} onChange={e => handleField('designation', e.target.value)}
                  error={!!errors.designation} helperText={errors.designation} />
                <FormControl fullWidth size="small">
                  <InputLabel>Management level</InputLabel>
                  <Select value={form.management_level} label="Management level"
                    onChange={e => handleField('management_level', e.target.value)}>
                    <MenuItem value="">— none —</MenuItem>
                    {MGMT_LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                <TextField fullWidth size="small" label="Reporting manager"
                  value={form.reporting_manager} onChange={e => handleField('reporting_manager', e.target.value)} />
                <TextField fullWidth size="small" label="Designation email"
                  value={form.desig_email_id}
                  onChange={e => handleField('desig_email_id', e.target.value)} />
                <TextField fullWidth size="small" label="Employee ID"
                  value={form.emp_id} onChange={e => handleField('emp_id', e.target.value)} />
              </Box>

              <TextField fullWidth size="small" label="Employee name"
                value={form.emp_name} onChange={e => handleField('emp_name', e.target.value)} />

              <Typography variant="overline" color="text.secondary" fontWeight={600}
                sx={{ fontSize: '0.7rem', letterSpacing: 1, mt: 1 }}>Links &amp; misc</Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                <TextField fullWidth size="small" label="Dept page link"
                  value={form.dept_page_link} onChange={e => handleField('dept_page_link', e.target.value)} />
                <TextField fullWidth size="small" label="Role document link"
                  value={form.role_document_link} onChange={e => handleField('role_document_link', e.target.value)} />
                <TextField fullWidth size="small" label="JD link"
                  value={form.jd_link} onChange={e => handleField('jd_link', e.target.value)} />
              </Box>

              <TextField fullWidth size="small" label="Remarks" multiline rows={2}
                value={form.remarks} onChange={e => handleField('remarks', e.target.value)} />

            </Box>
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={() => setOpen(false)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button onClick={handleSave} variant="contained" disabled={saving}
              sx={{ bgcolor: BRAND_BLUE, borderRadius: 2, textTransform: 'none', fontWeight: 600, minWidth: 110 }}>
              {saving ? <CircularProgress size={18} color="inherit" /> : (editId ? 'Save changes' : 'Add entry')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast */}
        <Snackbar open={toast.open} autoHideDuration={4000}
          onClose={() => setToast(p => ({ ...p, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={toast.severity} onClose={() => setToast(p => ({ ...p, open: false }))}
            sx={{ borderRadius: 2 }}>
            {toast.msg}
          </Alert>
        </Snackbar>

      </Box>
    </Box>
  );
}