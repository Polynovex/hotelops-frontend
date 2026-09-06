import React from 'react';
import { Box, Card, Stack, SvgIconProps, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brand } from '../../theme/theme';

export interface QuickAction {
  label: string;
  /** What it does, in the user's words — not the route name. */
  hint?: string;
  icon: React.ComponentType<SvgIconProps>;
  onClick: () => void;
  /** Marks the one action this role reaches for most. */
  primary?: boolean;
}

/**
 * The handful of things this role does dozens of times a shift.
 *
 * Deliberately short. A receptionist checking someone in should not be hunting
 * through a twenty-item sidebar for it, but a grid of fifteen "shortcuts" is
 * just the sidebar again with bigger targets — so each dashboard offers four to
 * six, and exactly one is marked primary.
 */
const QuickActions = ({ actions }: { actions: QuickAction[] }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: `repeat(${Math.min(actions.length, 6)}, 1fr)` },
        gap: 1.5
      }}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Card
            key={action.label}
            elevation={0}
            role="button"
            tabIndex={0}
            onClick={action.onClick}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                action.onClick();
              }
            }}
            sx={{
              p: 2,
              cursor: 'pointer',
              borderRadius: 3,
              minHeight: 108,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              border: '1px solid',
              borderColor: action.primary
                ? alpha(brand.gold, isDark ? 0.45 : 0.4)
                : theme.palette.divider,
              background: action.primary
                ? alpha(brand.gold, isDark ? 0.14 : 0.08)
                : theme.palette.background.paper,
              transition: 'transform .18s ease, box-shadow .18s ease',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.shadows[2] },
              '&:focus-visible': {
                outline: `2px solid ${brand.gold}`,
                outlineOffset: 2
              },
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
                '&:hover': { transform: 'none' }
              }
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: action.primary ? brand.goldDark : theme.palette.text.secondary,
                background: alpha(
                  action.primary ? brand.gold : theme.palette.text.primary,
                  isDark ? 0.16 : 0.06
                )
              }}
            >
              <Icon sx={{ fontSize: 19 }} />
            </Box>
            <Stack spacing={0.25}>
              <Typography sx={{ fontSize: 14, fontWeight: 650, lineHeight: 1.25 }}>
                {action.label}
              </Typography>
              {action.hint ? (
                <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.35 }}>
                  {action.hint}
                </Typography>
              ) : null}
            </Stack>
          </Card>
        );
      })}
    </Box>
  );
};

export default QuickActions;
