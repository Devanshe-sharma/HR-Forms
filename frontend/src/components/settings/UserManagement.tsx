/**
 * UserManagement.tsx
 * Admin-only panel inside Configuration → System → User Management.
 * Lets Admin create login accounts, change roles/active status, and reset passwords.
 * The backend (/api/users) enforces Admin-only access independently of this UI.
 */

import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import axios from 'axios';
import { ROLES, Role } from '../../config/rbac';

const API_URL = process.env.REACT_APP_API_URL || '/api';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/users`, { name, email, password, role });
      setCreateOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('Employee');
      setToast('User created successfully');
      loadUsers();
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">User Accounts</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
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
                  <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setResetTarget(u)}>Reset Password</Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No users yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New User</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Name" fullWidth value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
          <TextField margin="dense" label="Email" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField margin="dense" label="Temporary Password" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} helperText="At least 8 characters" sx={{ mb: 2 }} />
          <TextField select margin="dense" label="Role" fullWidth value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
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
