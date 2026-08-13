import { Box, Chip, LinearProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { gradients } from '../../theme/theme';

/**
 * Shared premium surfaces (Part 5).
 *
 * These exist so every page expresses the same visual language without each
 * one hand-rolling borders, radii, and shadows. Import these instead of
 * restyling Paper inline.
 */

// ---------------------------------------------------------------------------
// PremiumCard
// ---------------------------------------------------------------------------

export interface PremiumCardProps {
  children: React.ReactNode;
  /** 'plain' near-white, 'tinted' subtle cool gradient, 'navy' dark anchor. */
  variant?: 'plain' | 'tinted' | 'navy';
  interactive?: boolean;
  sx?: SxProps<Theme>;
}

export const PremiumCard = ({ children, variant = 'plain', interactive, sx }: PremiumCardProps) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2.5,
      borderRadius: 2.5,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 200ms ease, box-shadow 200ms ease',
      ...(variant === 'navy'
        ? { background: gradients.premiumBlue, color: '#FFFFFF', borderColor: 'transparent' }
        : variant === 'tinted'
          ? { background: (t: Theme) => (t.palette.mode === 'dark' ? undefined : gradients.cardCool) }
          : {}),
      ...(interactive
        ? {
            cursor: 'pointer',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 35px rgba(15, 34, 57, 0.10)'
            }
          }
        : {}),
      ...sx
    }}
  >
    {children}
  </Paper>
);

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

export interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ReactNode;
  /** Signed change, rendered as a coloured delta. */
  changePercent?: number | null;
  variant?: PremiumCardProps['variant'];
  loading?: boolean;
  onClick?: () => void;
}

export const MetricCard = ({
  label,
  value,
  detail,
  icon,
  changePercent,
  variant = 'plain',
  loading,
  onClick
}: MetricCardProps) => {
  const onNavy = variant === 'navy';

  if (loading) {
    return (
      <PremiumCard variant={variant}>
        <Skeleton variant="text" width="55%" height={20} />
        <Skeleton variant="text" width="40%" height={44} sx={{ my: 0.5 }} />
        <Skeleton variant="text" width="70%" height={16} />
      </PremiumCard>
    );
  }

  return (
    <PremiumCard variant={variant} interactive={Boolean(onClick)} sx={onClick ? { '&:active': { transform: 'translateY(0)' } } : undefined}>
      <Box onClick={onClick} sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          {icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: onNavy ? alpha('#FFFFFF', 0.14) : (t: Theme) => alpha(t.palette.primary.main, 0.08),
                color: onNavy ? '#FFFFFF' : 'primary.main'
              }}
            >
              {icon}
            </Box>
          )}
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ color: onNavy ? alpha('#FFFFFF', 0.78) : 'text.secondary' }}
          >
            {label}
          </Typography>
        </Stack>

        <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, color: onNavy ? '#FFFFFF' : 'text.primary' }}>
          {value}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          {typeof changePercent === 'number' && (
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                color: onNavy
                  ? alpha('#FFFFFF', 0.9)
                  : changePercent >= 0
                    ? 'success.main'
                    : 'error.main'
              }}
            >
              {changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(1)}%
            </Typography>
          )}
          {detail && (
            <Typography
              variant="caption"
              sx={{ color: onNavy ? alpha('#FFFFFF', 0.68) : 'text.secondary' }}
            >
              {detail}
            </Typography>
          )}
        </Stack>
      </Box>
    </PremiumCard>
  );
};

// ---------------------------------------------------------------------------
// StatusIndicator / StatusBadge
// ---------------------------------------------------------------------------

export type StatusTone = 'healthy' | 'warning' | 'error' | 'inactive' | 'info';

const TONE_COLOR: Record<StatusTone, string> = {
  healthy: '#16876A',
  warning: '#E1A33B',
  error: '#B14040',
  inactive: '#94A1A8',
  info: '#2563EB'
};

/**
 * Status is conveyed by dot colour AND text label — never colour alone, so it
 * stays readable for colour-blind users (WCAG 1.4.1).
 */
export const StatusIndicator = ({
  tone,
  label,
  size = 8
}: {
  tone: StatusTone;
  label: string;
  size?: number;
}) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: TONE_COLOR[tone],
        flexShrink: 0,
        boxShadow: `0 0 0 3px ${alpha(TONE_COLOR[tone], 0.18)}`
      }}
    />
    <Typography variant="body2" fontWeight={600}>
      {label}
    </Typography>
  </Stack>
);

export const StatusBadge = ({ tone, label }: { tone: StatusTone; label: string }) => (
  <Chip
    size="small"
    label={label}
    sx={{
      fontWeight: 700,
      color: TONE_COLOR[tone],
      bgcolor: alpha(TONE_COLOR[tone], 0.12),
      border: `1px solid ${alpha(TONE_COLOR[tone], 0.28)}`
    }}
  />
);

// ---------------------------------------------------------------------------
// PageHeader / SectionHeader
// ---------------------------------------------------------------------------

export const PageHeader = ({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    justifyContent="space-between"
    alignItems={{ sm: 'center' }}
    spacing={2}
    sx={{ mb: 3 }}
  >
    <Box>
      <Typography variant="h4" fontWeight={700}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Box>
    {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
  </Stack>
);

export const SectionHeader = ({
  title,
  count,
  action
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
    <Typography variant="subtitle1" fontWeight={700}>
      {title}
    </Typography>
    {typeof count === 'number' && <Chip size="small" label={count} />}
    <Box sx={{ flexGrow: 1 }} />
    {action}
  </Stack>
);

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export const EmptyState = ({
  icon,
  title,
  description,
  action
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <Box sx={{ py: 8, textAlign: 'center' }}>
    {icon && <Box sx={{ color: 'text.disabled', mb: 1, '& svg': { fontSize: 48 } }}>{icon}</Box>}
    <Typography variant="subtitle1" fontWeight={600}>
      {title}
    </Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 380, mx: 'auto' }}>
        {description}
      </Typography>
    )}
    {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
  </Box>
);

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

export const TableSkeleton = ({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) => (
  <Box sx={{ p: 2 }}>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Stack key={rowIndex} direction="row" spacing={2} sx={{ py: 1.2 }}>
        {Array.from({ length: columns }).map((__, colIndex) => (
          <Skeleton
            key={colIndex}
            variant="text"
            height={20}
            sx={{ flex: colIndex === 0 ? 2 : 1 }}
          />
        ))}
      </Stack>
    ))}
  </Box>
);

/** Usage meter with a colour ramp that warns before a limit is hit. */
export const UsageMeter = ({ used, limit }: { used: number; limit: number | null }) => {
  if (limit == null || limit <= 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Unlimited
      </Typography>
    );
  }

  const percent = Math.min(Math.round((used / limit) * 100), 100);

  return (
    <>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={percent >= 90 ? 'error' : percent >= 75 ? 'warning' : 'primary'}
        sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
      />
      <Typography variant="caption" color={percent >= 90 ? 'error' : 'text.secondary'}>
        {used} of {limit} used
      </Typography>
    </>
  );
};
