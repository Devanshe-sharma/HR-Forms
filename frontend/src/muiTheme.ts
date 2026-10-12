// muiTheme.ts
// ─────────────────────────────────────────────────────────────────────────────
// No MUI theme existed before this — every `useTheme()`/`theme.palette.primary`
// call in the app was silently resolving to MUI's default blue. This gives the
// whole app the brand's actual green palette (#597e37 mid / #3d5420 dark /
// #2b3d14 darkest — the same three shades already used for Sidebar/Navbar and
// the Company/Dept Orientation hero banners) so any component reading
// `theme.palette.primary.*` picks up green instead of MUI's default blue.
// ─────────────────────────────────────────────────────────────────────────────
import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    primary: {
      light: '#597e37',
      main:  '#597e37',
      dark:  '#3d5420',
      contrastText: '#ffffff',
    },
  },
});
