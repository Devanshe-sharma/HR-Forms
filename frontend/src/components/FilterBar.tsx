// Reusable Odoo-style "Filters / Group By / Favorites" toolbar — the
// pattern is: the page keeps its own filter state (search text, dropdown
// values, date ranges, whatever it already had), and just hands this
// component (a) the controls to show inside the Filters popover, (b) a
// list of fields it can group by, and (c) a plain-object snapshot of its
// current filter state so a user can name and re-apply it later. Nothing
// here knows what a "department" or "designation" is — that's entirely up
// to the page using it, which keeps this usable on any list page.
//
// Favorites persist to localStorage only (no backend) — scoped per page via
// the caller's own `storageKey`, so two pages never collide.
import React, { useEffect, useState } from 'react';
import {
  Box, Button, Popover, Menu, MenuItem, Stack, Typography, TextField, IconButton, Divider,
} from '@mui/material';
import {
  FilterListOutlined as FilterIcon,
  ArrowDropDown as ArrowDropDownIcon,
  StarBorderOutlined as StarBorderIcon,
  Star as StarIcon,
  DeleteOutline as DeleteIcon,
  Add as AddIcon,
  WorkspacesOutlined as GroupByIcon,
} from '@mui/icons-material';

const toolbarButtonSx = {
  textTransform: 'none' as const, fontWeight: 600, fontSize: '0.78rem', borderRadius: '8px',
  px: 1.3, py: 0.55,
};

// ── Filters ────────────────────────────────────────────────────────────────
// A popover shell around whatever filter controls the page passes in as
// children — this is what turns "three dropdowns always sitting on the
// page" into "one Filters button that reveals them."
export function FiltersMenuButton({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        size="small" variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
        sx={{ ...toolbarButtonSx, borderColor: activeCount > 0 ? 'primary.main' : undefined, color: activeCount > 0 ? 'primary.main' : 'text.secondary' }}
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </Button>
      <Popover
        open={!!anchorEl} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
          <Stack spacing={1.5}>{children}</Stack>
        </Box>
      </Popover>
    </>
  );
}

// ── Group By ───────────────────────────────────────────────────────────────
export interface GroupByOption { key: string; label: string; }

export function GroupByMenuButton({ options, value, onChange }: {
  options: GroupByOption[];
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const activeLabel = options.find(o => o.key === value)?.label;
  return (
    <>
      <Button
        size="small" variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<GroupByIcon sx={{ fontSize: 16 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
        sx={{ ...toolbarButtonSx, borderColor: value ? 'primary.main' : undefined, color: value ? 'primary.main' : 'text.secondary' }}
      >
        {activeLabel ? `Group By: ${activeLabel}` : 'Group By'}
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem selected={!value} onClick={() => { onChange(null); setAnchorEl(null); }} sx={{ fontSize: '0.8rem' }}>
          None
        </MenuItem>
        <Divider />
        {options.map(o => (
          <MenuItem key={o.key} selected={value === o.key} onClick={() => { onChange(o.key); setAnchorEl(null); }} sx={{ fontSize: '0.8rem' }}>
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// ── Favorites ──────────────────────────────────────────────────────────────
interface SavedFilter<T> { id: string; name: string; state: T; }

function useFavorites<T>(storageKey: string) {
  const [favorites, setFavorites] = useState<SavedFilter<T>[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      // Corrupt/blocked storage — just start empty, not worth surfacing.
    }
  }, [storageKey]);

  const persist = (next: SavedFilter<T>[]) => {
    setFavorites(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage may be blocked (private tab) — favorite just won't survive a reload */ }
  };

  const save = (name: string, state: T) => persist([...favorites, { id: `${Date.now()}`, name, state }]);
  const remove = (id: string) => persist(favorites.filter(f => f.id !== id));

  return { favorites, save, remove };
}

export function FavoritesMenuButton<T>({ storageKey, currentState, onApply, activeName }: {
  // Scope key for localStorage — pass something unique per page, e.g. 'filters:employees-list'.
  storageKey: string;
  // Opaque snapshot of the page's current filter/group-by state — stored
  // verbatim and handed back to onApply when the favorite is selected.
  currentState: T;
  onApply: (state: T) => void;
  // If the page knows the current state matches a saved favorite (e.g. it
  // was just applied and nothing's changed since), pass its name here so
  // the button shows it instead of the generic label.
  activeName?: string | null;
}) {
  const { favorites, save, remove } = useFavorites<T>(storageKey);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const close = () => { setAnchorEl(null); setSaving(false); setName(''); };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save(trimmed, currentState);
    close();
  };

  return (
    <>
      <Button
        size="small" variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={activeName ? <StarIcon sx={{ fontSize: 16, color: '#F59E0B' }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
        sx={{ ...toolbarButtonSx, color: activeName ? 'primary.main' : 'text.secondary', borderColor: activeName ? 'primary.main' : undefined }}
      >
        {activeName || 'Favorites'}
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={close}>
        {favorites.length === 0 && (
          <MenuItem disabled sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>No saved filters yet</MenuItem>
        )}
        {favorites.map(f => (
          <MenuItem key={f.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: '0.8rem' }}
            onClick={() => { onApply(f.state); setAnchorEl(null); }}>
            <span>{f.name}</span>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); remove(f.id); }}>
              <DeleteIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </MenuItem>
        ))}
        <Divider />
        {saving ? (
          <Box sx={{ p: 1, display: 'flex', gap: 0.75, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <TextField
              size="small" autoFocus placeholder="Name this filter" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.78rem', py: 0.6 } }}
            />
            <Button size="small" variant="contained" onClick={handleSave} disabled={!name.trim()}
              sx={{ textTransform: 'none', fontSize: '0.76rem' }}>
              Save
            </Button>
          </Box>
        ) : (
          <MenuItem onClick={(e) => { e.stopPropagation(); setSaving(true); }} sx={{ fontSize: '0.78rem', color: 'primary.main' }}>
            <AddIcon sx={{ fontSize: 16, mr: 0.6 }} /> Save current search
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
