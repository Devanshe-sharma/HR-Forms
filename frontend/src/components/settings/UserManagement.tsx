/**
 * UserManagement.tsx
 * Admin-only panel inside Configuration → System → User Management.
 * Lets Admin create login accounts, change roles/active status, and reset passwords.
 * The backend (/api/users) enforces Admin-only access independently of this UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import axios from 'axios';
import { ROLES, Role } from '../../config/rbac';

const API_URL = process.env.REACT_APP_API_URL || '/api';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
}

// A current employee, sourced live from Onboarding (the same "actually
// joined, not exited" definition Salary Revision/Confirmations use) — not
// a separate/cached employee list, so a new joiner, a name change, or an
// exit in Onboarding shows up here the next time this dialog is opened.
interface OnboardingEmployee {
  employee_id: string;
  emp_id: string | null;
  full_name: string;
  department: string;
  designation: string;
  official_email: string;
  email: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Employee');
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState<OnboardingEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<OnboardingEmployee | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Current employees, read fresh from Onboarding every time this panel
  // loads — the same source (and "actually joined, not exited" definition)
  // Salary Revision/Confirmations use, so this never drifts into its own
  // stale copy of who's actually employed.
  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await axios.get(`${API_URL}/onboarding/eligible-employees`);
      setEmployees(res.data?.data || []);
    } catch {
      // Non-fatal — the create dialog just falls back to manual name/email entry.
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadEmployees();
  }, [loadUsers, loadEmployees]);

  // Employees who don't already have a login account — the only ones worth
  // offering in the picker, and the same "already had one" check the
  // bulk-create script uses (matched by email).
  const existingUserEmails = new Set(users.map(u => u.email.trim().toLowerCase()));
  const availableEmployees = employees.filter(e => {
    const em = (e.official_email || e.email || '').trim().toLowerCase();
    return em && !existingUserEmails.has(em);
  });

  // Onboarding's empId is NOT reliably unique — several current employees
  // share the same empId (e.g. "175" belongs to three different people at
  // once, a pre-existing data problem upstream in Onboarding). Matching a
  // user's employeeId against empId is therefore only trustworthy when
  // exactly one current employee has that id; a Mongo _id match is always
  // safe since that's a real unique key. Guessing on an ambiguous id is
  // exactly what silently attached the wrong account to the wrong employee
  // before, so an ambiguous id resolves to "no match" rather than a guess.
  const officialEmailFor = (u: AppUser): string | null => {
    if (!u.employeeId) return null;
    const matches = employees.filter(e => e.employee_id === u.employeeId || e.emp_id === u.employeeId);
    if (matches.length !== 1) return null;
    const officialEmail = (matches[0].official_email || matches[0].email || '').trim();
    return officialEmail || null;
  };
  const isEmailOutOfSync = (u: AppUser): string | null => {
    const officialEmail = officialEmailFor(u);
    if (!officialEmail) return null;
    return officialEmail.toLowerCase() !== u.email.trim().toLowerCase() ? officialEmail : null;
  };

  // Auto-sync: whenever Onboarding's official email for a linked account
  // drifts from its login email, push the update automatically — no
  // manual step. syncingRef stops this from re-firing on every render and
  // from retrying an id that just failed (e.g. a genuine email collision)
  // until the next full reload.
  const syncingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || loadingEmployees) return;
    const toSync = users
      .map(u => ({ u, newEmail: isEmailOutOfSync(u) }))
      .filter((x): x is { u: AppUser; newEmail: string } => !!x.newEmail && !syncingRef.current.has(x.u.id));
    if (toSync.length === 0) return;

    (async () => {
      let synced = 0;
      for (const { u, newEmail } of toSync) {
        syncingRef.current.add(u.id);
        try {
          await axios.patch(`${API_URL}/users/${u.id}`, { email: newEmail });
          synced++;
        } catch {
          // Leave it flagged as attempted — a genuine collision needs a
          // human to resolve, not a retry loop.
        }
      }
      if (synced > 0) {
        setToast(`Synced ${synced} login email${synced > 1 ? 's' : ''} from Onboarding`);
        loadUsers();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, employees, loading, loadingEmployees]);

  // The single source of truth for "does this employee have a login" and
  // "which account is it". An id match is only trusted when it resolves to
  // exactly one user — several onboarding empIds are shared by 2-3 current
  // employees at once, and matching a non-unique id previously attached the
  // wrong account to this employee (that's what produced the wrong email
  // showing under the right name). Email is unique per current employee in
  // practice (the ambiguous-empId cases above each still have distinct
  // official emails), so it's a safe, always-available fallback.
  const findUserForEmployee = (emp: OnboardingEmployee): AppUser | undefined => {
    const idMatches = users.filter(u => u.employeeId && (u.employeeId === emp.employee_id || u.employeeId === emp.emp_id));
    if (idMatches.length === 1) return idMatches[0];
    const emailKey = (emp.official_email || emp.email || '').trim().toLowerCase();
    return users.find(u => !!emailKey && u.email.trim().toLowerCase() === emailKey);
  };

  const handleSelectEmployee = (emp: OnboardingEmployee | null) => {
    setSelectedEmployee(emp);
    if (emp) {
      setName(emp.full_name);
      setEmail(emp.official_email || emp.email || '');
      // Always link by the Onboarding record's own Mongo _id, never empId —
      // empId isn't reliably unique (see findUserForEmployee above), and an
      // id-based link that isn't guaranteed unique is what caused this bug.
      setEmployeeId(emp.employee_id);
    } else {
      setEmployeeId(null);
    }
  };

  const resetCreateForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('Employee');
    setSelectedEmployee(null);
    setEmployeeId(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/users`, { name, email, password, role, employeeId });
      setCreateOpen(false);
      resetCreateForm();
      setToast('User created successfully');
      loadUsers();
      loadEmployees();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    try {
      await axios.patch(`${API_URL}/users/${u.id}`, { isActive: !u.isActive });
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update user');
    }
  };

  const handleRoleChange = async (u: AppUser, newRole: Role) => {
    try {
      await axios.patch(`${API_URL}/users/${u.id}`, { role: newRole });
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update role');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/users/${resetTarget.id}/reset-password`, { newPassword: resetPassword });
      setResetTarget(null);
      setResetPassword('');
      setToast('Password reset successfully');
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  // Shared account-management cells (Role / Active / Password / Last Login
  // / Reset Password) — used for both an employee's linked account and for
  // the "Other accounts" rows below, so the two tables manage accounts
  // identically instead of duplicating this markup.
  const renderAccountCells = (u: AppUser) => (
    <>
      <TableCell>
        <TextField
          select
          size="small"
          value={u.role}
          onChange={(e) => handleRoleChange(u, e.target.value as Role)}
          sx={{ minWidth: 160 }}
        >
          {ROLES.map((r) => (
            <MenuItem key={r} value={r}>{r}</MenuItem>
          ))}
        </TextField>
      </TableCell>
      <TableCell>
        <Switch checked={u.isActive} onChange={() => handleToggleActive(u)} size="small" />
        {!u.isActive && <Chip label="Disabled" size="small" color="default" />}
      </TableCell>
      <TableCell>
        {u.mustChangePassword ? (
          <Chip label="Reset pending" size="small" color="warning" />
        ) : u.passwordChangedAt ? (
          <Chip label="Changed" size="small" color="success" variant="outlined" />
        ) : (
          <Chip label="Original" size="small" variant="outlined" />
        )}
        <Typography variant="caption" display="block" color="text.secondary">
          {u.passwordChangedAt ? new Date(u.passwordChangedAt).toLocaleString() : 'Never changed'}
        </Typography>
      </TableCell>
      <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</TableCell>
      <TableCell align="right">
        <Button size="small" onClick={() => setResetTarget(u)}>Reset Password</Button>
      </TableCell>
    </>
  );

  const sortedEmployees = [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Employees</Typography>
          <Typography variant="caption" color="text.secondary">
            {employees.length} current — live from Onboarding
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading || loadingEmployees ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Paper variant="outlined">
          <Table
            size="small"
            sx={{
              '& .MuiTableCell-root': { fontSize: '0.72rem', py: 0.5, px: 1 },
              '& .MuiTableCell-head': { fontWeight: 700 },
              '& .MuiChip-root': { fontSize: '0.65rem', height: 20 },
              '& .MuiButton-root': { fontSize: '0.72rem' },
              '& .MuiInputBase-input': { fontSize: '0.72rem' },
              '& .MuiTypography-caption': { fontSize: '0.65rem' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Password</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedEmployees.map((emp) => {
                const u = findUserForEmployee(emp);
                return (
                  <TableRow key={emp.employee_id}>
                    <TableCell>{emp.full_name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.designation}</TableCell>
                    <TableCell>{u ? u.email : (emp.official_email || emp.email || '—')}</TableCell>
                    {u ? renderAccountCells(u) : (
                      <>
                        <TableCell colSpan={3}>
                          <Chip label="No login yet" size="small" color="default" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => { handleSelectEmployee(emp); setCreateOpen(true); }}>
                            Create Account
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">No current employees found in Onboarding.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); resetCreateForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle>New User</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={availableEmployees}
            loading={loadingEmployees}
            value={selectedEmployee}
            onChange={(_, v) => handleSelectEmployee(v)}
            getOptionLabel={(e) => `${e.full_name} (${e.department})`}
            isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
            renderInput={(params) => (
              <TextField {...params} margin="dense" label="Link to Employee (from Onboarding)"
                helperText="Pick a current employee to auto-fill Name/Email, or leave blank for a non-employee account"
                fullWidth sx={{ mb: 2 }} />
            )}
          />
          <TextField autoFocus margin="dense" label="Name" fullWidth value={name}
            onChange={(e) => setName(e.target.value)} disabled={!!selectedEmployee} sx={{ mb: 2 }} />
          <TextField margin="dense" label="Email" type="email" fullWidth value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={!!selectedEmployee} sx={{ mb: 2 }} />
          <TextField margin="dense" label="Temporary Password" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} helperText="At least 8 characters" sx={{ mb: 2 }} />
          <TextField select margin="dense" label="Role" fullWidth value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={saving || !name || !email || !password}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onClose={() => setResetTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password{resetTarget ? ` — ${resetTarget.name}` : ''}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            helperText="At least 8 characters"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTarget(null)}>Cancel</Button>
          <Button onClick={handleResetPassword} variant="contained" disabled={saving || resetPassword.length < 8}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
