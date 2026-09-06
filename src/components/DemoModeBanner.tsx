import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ScienceRounded from '@mui/icons-material/ScienceRounded';
import { brand } from '../theme/theme';

/**
 * Marks a session that is running on bundled sample data.
 *
 * Previously written with Tailwind utility classes — `bg-yellow-50`, `flex`,
 * `gap-2` — which this application does not load, so none of them resolved:
 * the banner rendered as unstyled run-together text above a default browser
 * button. Rebuilt on the same MUI theme as the rest of the app.
 *
 * It stays deliberately prominent. Someone who does not realise the figures
 * in front of them are samples may act on them, so this is one of the few
 * places where being visually loud is the correct choice.
 */
export const DemoModeBanner = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const token = localStorage.getItem('auth-storage');
  const isDemo = token?.includes('demo-token');

  if (!isDemo) return null;

  return (
    <Box
      role="status"
      sx={{
        px: { xs: 2, sm: 3 },
        py: 1.15,
        borderBottom: '1px solid',
        borderColor: alpha(brand.amber, isDark ? 0.4 : 0.32),
        background: alpha(brand.amber, isDark ? 0.14 : 0.1)
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ maxWidth: 1400, mx: 'auto' }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
          <ScienceRounded sx={{ fontSize: 19, color: brand.amber, flexShrink: 0 }} />
          <Typography
            sx={{ fontSize: 13.5, fontWeight: 700, color: 'text.primary', flexShrink: 0 }}
          >
            Demo data
          </Typography>
          <Typography
            sx={{
              fontSize: 13,
              color: 'text.secondary',
              display: { xs: 'none', sm: 'block' }
            }}
            noWrap
          >
            Sample figures for a fictional property — nothing here is your hotel’s data.
          </Typography>
        </Stack>

        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
          sx={{ flexShrink: 0, minHeight: 34, borderColor: alpha(brand.amber, 0.5) }}
        >
          Exit demo
        </Button>
      </Stack>
    </Box>
  );
};

export default DemoModeBanner;
