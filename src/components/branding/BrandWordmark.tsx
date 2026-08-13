import { Box, Typography, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * The "HotelOpX" wordmark.
 *
 * Previously duplicated across five auth screens with hard-coded navy hex
 * values (#0F1D3D / #132349), which rendered as near-invisible dark-on-dark
 * once the dark theme was applied. Centralising it means the dark-mode fix
 * lives in one place, and the accent blue stays constant in both themes
 * because it has sufficient contrast either way.
 */
export const BrandWordmark = ({
  fontSize = '2.4rem',
  sx
}: {
  /** Accepts a plain size or an MUI responsive object, e.g. { xs, md }. */
  fontSize?: string | number | Record<string, string | number>;
  sx?: SxProps<Theme>;
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Navy on light, near-white on dark. The trailing "X" keeps its accent blue
  // in both, which passes contrast on either ground.
  const primary = isDark ? '#E8EEF5' : '#0F1D3D';
  const secondary = isDark ? '#C3D0DE' : '#132349';
  const accent = isDark ? '#60A5FA' : '#3B82F6';

  return (
    <Typography
      component="span"
      sx={{
        fontSize,
        fontWeight: 800,
        letterSpacing: '-0.05em',
        lineHeight: 1,
        ...sx
      }}
    >
      <Box component="span" sx={{ color: primary }}>
        Hotel
      </Box>
      <Box component="span" sx={{ color: secondary }}>
        Op
      </Box>
      <Box component="span" sx={{ color: accent }}>
        X
      </Box>
    </Typography>
  );
};

export default BrandWordmark;
