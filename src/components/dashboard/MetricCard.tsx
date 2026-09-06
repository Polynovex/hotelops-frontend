import React from 'react';
import { Box, Card, Skeleton, Stack, SvgIconProps, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brand } from '../../theme/theme';

export type MetricTone = 'neutral' | 'good' | 'attention' | 'critical' | 'primary';

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  /** Sits under the value: the denominator, the comparison, the unit. */
  caption?: string;
  icon?: React.ComponentType<SvgIconProps>;
  tone?: MetricTone;
  loading?: boolean;
  onClick?: () => void;
}

/**
 * A single figure, and what it means.
 *
 * Two rules this enforces, both of which the dashboard was previously getting
 * wrong:
 *
 * Tone is semantic, never decorative. The old KPI strip alternated dark navy
 * and white cards for visual rhythm, so a healthy occupancy figure and an
 * overdue-checkout count looked equally urgent. Emphasis is spent here only on
 * the figure that actually needs a person to act.
 *
 * Figures are set in the UI face with tabular numerals, never in the display
 * serif. Cormorant Garamond has no naira glyph, so a currency figure set in it
 * would fall back mid-string and render inconsistently — and proportional
 * digits make a column of amounts jitter as the values change. Pinning the
 * family here means a heading-variant change can never quietly affect data.
 */
const MetricCard = ({
  label,
  value,
  caption,
  icon: Icon,
  tone = 'neutral',
  loading = false,
  onClick
}: MetricCardProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const toneColor: Record<MetricTone, string> = {
    neutral: isDark ? brand.smokeSoft : brand.smoke,
    good: brand.emerald,
    attention: brand.amber,
    critical: brand.wine,
    primary: isDark ? brand.goldLight : brand.navyTint
  };

  const accent = toneColor[tone];
  // Only a figure that wants attention gets a tinted ground; the rest stay
  // quiet so the emphasis means something.
  const emphasised = tone === 'attention' || tone === 'critical';

  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        borderRadius: 3,
        border: '1px solid',
        borderColor: emphasised ? alpha(accent, isDark ? 0.35 : 0.28) : theme.palette.divider,
        background: emphasised
          ? alpha(accent, isDark ? 0.12 : 0.06)
          : theme.palette.background.paper,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[2],
              borderColor: alpha(accent, 0.45)
            }
          : undefined,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } }
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.09em',
            textTransform: 'uppercase',
            color: 'text.secondary'
          }}
        >
          {label}
        </Typography>
        {Icon ? (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              background: alpha(accent, isDark ? 0.18 : 0.1),
              color: accent
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        ) : null}
      </Stack>

      {loading ? (
        <Skeleton variant="text" width="60%" height={42} />
      ) : (
        <Typography
          sx={{
            // Pinned, not inherited — see the note above the component.
            fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
            fontSize: { xs: 26, sm: 30 },
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-.02em',
            color: emphasised ? accent : 'text.primary'
          }}
        >
          {value}
        </Typography>
      )}

      {caption ? (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 'auto' }}>
          {caption}
        </Typography>
      ) : null}
    </Card>
  );
};

export default MetricCard;
