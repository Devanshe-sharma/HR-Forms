/**
 * PermissionManager.tsx
 * HR-only panel inside Settings → System tab.
 * Lets HR grant/revoke resource permissions for Manager and Employee roles,
 * and control which sidebar pages Employee/HR/Manager can each see.
 * HR-locked permissions (architecturally required) are read-only.
 *
 * Usage: drop inside your existing Configuration.tsx System TabPanel.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Switch,
  Checkbox,
  Button,
  Alert,
  Snackbar,
  Tooltip,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  CheckCircleOutline as SavedIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { PAGES, VISIBILITY_ROLES, VisibilityRole } from '../../config/pageVisibility';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Action = 'create' | 'read' | 'update' | 'delete';
type ManagedRole = 'Manager' | 'Employee';

interface ResourceDef {
  key: string;
  label: string;
  description: string;
  group: string;
  availableActions: Action[];
}

interface RolePermissions {
  [resource: string]: Action[];
}

interface PermissionState {
  Manager: RolePermissions;
  Employee: RolePermissions;
}

type PageVisibilityState = Record<VisibilityRole, Record<string, boolean>>;

// ─── Resource catalogue ───────────────────────────────────────────────────────

const RESOURCES: ResourceDef[] = [
  // Training group
  {
    key: 'training',
    label: 'Training plans',
    description: 'View and manage training programs',
    group: 'Training',
    availableActions: ['create', 'read', 'update', 'delete'],
  },
  {
    key: 'trainingSchedule',
    label: 'Training schedule',
    description: 'View or edit scheduled training sessions',
    group: 'Training',
    availableActions: ['create', 'read', 'update', 'delete'],
  },
  {
    key: 'trainingMaterials',
    label: 'Training materials',
    description: 'Upload or read training content and PDFs',
    group: 'Training',
    availableActions: ['create', 'read', 'update', 'delete'],
  },
  {
    key: 'trainingFeedback',
    label: 'Training feedback',
    description: 'Submit or view post-training feedback',
    group: 'Training',
    availableActions: ['create', 'read'],
  },
  {
    key: 'trainingSuggestions',
    label: 'Training suggestions',
    description: 'Propose or manage training topics',
    group: 'Training',
    availableActions: ['create', 'read', 'update', 'delete'],
  },
  // Capabilities group
  {
    key: 'capabilityEvaluation',
    label: 'Capability evaluation',
    description: 'Evaluate team member capabilities',
    group: 'Capabilities',
    availableActions: ['create', 'read', 'update', 'delete'],
  },
  {
    key: 'capabilityAssessment',
    label: 'Capability assessment',
    description: 'Run capability assessment forms',
    group: 'Capabilities',
    availableActions: ['create', 'read', 'update', 'delete'],
  },
  {
    key: 'capabilityRoleMap',
    label: 'Role capability map',
    description: 'View role-to-capability mapping',
    group: 'Capabilities',
    availableActions: ['read'],
  },
  // Reporting group
  {
    key: 'skillGap',
    label: 'Skill gap report',
    description: 'View skill gap analysis (backend filters by team)',
    group: 'Reporting',
    availableActions: ['read'],
  },
  {
    key: 'employeeScores',
    label: 'Employee scores',
    description: 'View employee performance scores',
    group: 'Reporting',
    availableActions: ['read'],
  },
];

const GROUPS = ['Training', 'Capabilities', 'Reporting'];

// ─── Locked permissions (cannot be changed by HR) ─────────────────────────────
// These mirror the minimum permissions each role MUST have for the system to work.

const HR_LOCKED: Record<ManagedRole, Record<string, Action[]>> = {
  Manager: {
    capabilityEvaluation: ['create', 'read', 'update', 'delete'],
    capabilityRoleMap: ['read'],
    skillGap: ['read'],
    employeeScores: ['read'],
  },
  Employee: {
    trainingSchedule: ['read'],
    trainingMaterials: ['read'],
    trainingFeedback: ['create', 'read'],
    capabilityRoleMap: ['read'],
    skillGap: ['read'],
  },
};

// ─── Default state (mirrors your current RBAC config) ────────────────────────

const DEFAULT_PERMISSIONS: PermissionState = {
  Manager: {
    training: ['read'],
    trainingSchedule: ['read'],
    trainingMaterials: [],
    trainingFeedback: [],
    trainingSuggestions: ['read'],
    capabilityEvaluation: ['create', 'read', 'update', 'delete'],
    capabilityAssessment: [],
    capabilityRoleMap: ['read'],
    skillGap: ['read'],
    employeeScores: ['read'],
  },
  Employee: {
    training: [],
    trainingSchedule: ['read'],
    trainingMaterials: ['read'],
    trainingFeedback: ['create', 'read'],
    trainingSuggestions: [],
    capabilityEvaluation: [],
    capabilityAssessment: [],
    capabilityRoleMap: ['read'],
    skillGap: ['read'],
    employeeScores: [],
  },
};

function defaultPageVisibility(): PageVisibilityState {
  const state = {} as PageVisibilityState;
  for (const role of VISIBILITY_ROLES) {
    state[role] = {};
    for (const page of PAGES) {
      state[role][page.key] = true;
    }
  }
  return state;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLocked(role: ManagedRole, resource: string, action: Action): boolean {
  return !!(HR_LOCKED[role]?.[resource]?.includes(action));
}

function hasResourceLocks(role: ManagedRole, resource: string): boolean {
  return !!(HR_LOCKED[role]?.[resource]?.length);
}

const ACTION_COLOR: Record<Action, string> = {
  create: '#1D9E75',
  read: '#185FA5',
  update: '#BA7517',
  delete: '#A32D2D',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionToggleProps {
  action: Action;
  checked: boolean;
  locked: boolean;
  onChange: () => void;
}

function ActionToggle({ action, checked, locked, onChange }: ActionToggleProps) {
  const color = ACTION_COLOR[action];

  const toggle = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 64,
      }}
    >
      <Switch
        size="small"
        checked={checked}
        onChange={onChange}
        disabled={locked}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked': { color },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
            backgroundColor: color,
          },
          opacity: locked ? 0.45 : 1,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          fontSize: '10px',
          fontWeight: 500,
          color: checked && !locked ? color : 'text.disabled',
          textTransform: 'capitalize',
          letterSpacing: '0.03em',
        }}
      >
        {action}
      </Typography>
    </Box>
  );

  if (locked) {
    return (
      <Tooltip title="Locked by system policy" placement="top" arrow>
        <Box sx={{ cursor: 'not-allowed' }}>{toggle}</Box>
      </Tooltip>
    );
  }
  return toggle;
}

interface ResourceRowProps {
  resource: ResourceDef;
  role: ManagedRole;
  permissions: Action[];
  onToggle: (action: Action) => void;
}

function ResourceRow({ resource, role, permissions, onToggle }: ResourceRowProps) {
  const hasLocks = hasResourceLocks(role, resource.key);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2.5,
        py: 1.5,
        gap: 2,
        borderBottom: '0.5px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'background-color 0.15s',
      }}
    >
      {/* Resource info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '13px' }}>
            {resource.label}
          </Typography>
          {hasLocks && (
            <Chip
              icon={<LockIcon sx={{ fontSize: '10px !important' }} />}
              label="System locked"
              size="small"
              sx={{
                height: 18,
                fontSize: '10px',
                bgcolor: 'action.selected',
                color: 'text.secondary',
                '& .MuiChip-icon': { color: 'text.disabled' },
              }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
          {resource.description}
        </Typography>
      </Box>

      {/* Action toggles */}
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        {resource.availableActions.map((action) => {
          const locked = isLocked(role, resource.key, action);
          const checked = permissions.includes(action);
          return (
            <ActionToggle
              key={action}
              action={action}
              checked={checked}
              locked={locked}
              onChange={() => !locked && onToggle(action)}
            />
          );
        })}
        {/* Pad missing actions so columns align */}
        {(['create', 'read', 'update', 'delete'] as Action[])
          .filter((a) => !resource.availableActions.includes(a))
          .map((a) => (
            <Box key={a} sx={{ minWidth: 64 }} />
          ))}
      </Box>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PermissionManager() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [permissions, setPermissions] = useState<PermissionState>(DEFAULT_PERMISSIONS);
  const [pageVisibility, setPageVisibility] = useState<PageVisibilityState>(defaultPageVisibility());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const activeRole: ManagedRole = activeTab === 0 ? 'Manager' : 'Employee';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      axios.get(`${API_URL}/rbac/permissions`),
      axios.get(`${API_URL}/rbac/page-visibility`),
    ])
      .then(([permsRes, visRes]) => {
        if (cancelled) return;
        const loadedPerms = permsRes.data?.data;
        if (loadedPerms?.Manager && loadedPerms?.Employee) {
          setPermissions(loadedPerms);
        }
        const loadedVis = visRes.data?.data;
        if (loadedVis) {
          setPageVisibility((prev) => ({ ...prev, ...loadedVis }));
        }
      })
      .catch(() => {
        // Keep defaults if either fetch fails — panel stays usable.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    (resource: string, action: Action) => {
      setPermissions((prev) => {
        const current = prev[activeRole][resource] ?? [];
        const next = current.includes(action)
          ? current.filter((a) => a !== action)
          : [...current, action];
        return {
          ...prev,
          [activeRole]: { ...prev[activeRole], [resource]: next },
        };
      });
    },
    [activeRole]
  );

  const handleToggleVisibility = useCallback((role: VisibilityRole, pageKey: string) => {
    setPageVisibility((prev) => ({
      ...prev,
      [role]: { ...prev[role], [pageKey]: !prev[role][pageKey] },
    }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        axios.put(`${API_URL}/rbac/permissions`, { permissions }),
        axios.put(`${API_URL}/rbac/page-visibility`, { pageVisibility }),
      ]);
      setSnackbar({ open: true, message: 'Permissions saved successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to save — please try again', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPermissions(DEFAULT_PERMISSIONS);
    setPageVisibility(defaultPageVisibility());
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Permission Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grant or restrict resource access, and control which sidebar pages each role can see.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={handleReset} sx={{ textTransform: 'none' }}>
            Reset to defaults
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SavedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', minWidth: 130 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Box>
      </Box>

      {/* Info alert */}
      <Alert
        icon={<InfoIcon fontSize="small" />}
        severity="info"
        sx={{ mb: 2.5, fontSize: '12px' }}
      >
        Permissions marked <strong>System locked</strong> are required for core system functionality and cannot be changed.
        All other permissions can be freely adjusted per role.
      </Alert>

      {/* Role tabs */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          <Tab label="Manager" sx={{ textTransform: 'none', fontSize: '13px' }} />
          <Tab label="Employee" sx={{ textTransform: 'none', fontSize: '13px' }} />
        </Tabs>

        {/* Column headers */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2.5,
            py: 1,
            bgcolor: 'action.hover',
            borderBottom: '0.5px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.disabled" sx={{ flex: 1, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Resource
          </Typography>
          {(['create', 'read', 'update', 'delete'] as Action[]).map((a) => (
            <Typography
              key={a}
              variant="caption"
              color="text.disabled"
              sx={{ minWidth: 64, textAlign: 'center', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {a}
            </Typography>
          ))}
        </Box>

        {/* Resources by group */}
        {GROUPS.map((group) => {
          const items = RESOURCES.filter((r) => r.group === group);
          return (
            <Box key={group}>
              <Box sx={{ px: 2.5, py: 0.75, bgcolor: 'background.default' }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.disabled',
                  }}
                >
                  {group}
                </Typography>
              </Box>
              {items.map((resource) => (
                <ResourceRow
                  key={resource.key}
                  resource={resource}
                  role={activeRole}
                  permissions={permissions[activeRole][resource.key] ?? []}
                  onToggle={(action) => handleToggle(resource.key, action)}
                />
              ))}
              <Divider />
            </Box>
          );
        })}
      </Paper>

      {/* Page Visibility matrix */}
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Page Visibility
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Controls which sidebar pages Employee, HR, and Manager can each see. Admin always sees
        everything. Profile and Configuration always stay visible for every role.
      </Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'text.disabled' }}>
                Page
              </TableCell>
              {VISIBILITY_ROLES.map((role) => (
                <TableCell
                  key={role}
                  align="center"
                  sx={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'text.disabled' }}
                >
                  {role}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {PAGES.map((page) => (
              <TableRow key={page.key} hover>
                <TableCell sx={{ fontSize: '13px' }}>{page.label}</TableCell>
                {VISIBILITY_ROLES.map((role) => (
                  <TableCell key={role} align="center">
                    <Checkbox
                      size="small"
                      checked={pageVisibility[role]?.[page.key] ?? true}
                      onChange={() => handleToggleVisibility(role, page.key)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
