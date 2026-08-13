import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * White-label tenant logo (Part 5).
 *
 * This is a SaaS product: the branding slot must accept whatever a hotel,
 * restaurant group, or property company uploads. The contract is:
 *
 *   - NEVER crop        → object-fit is always `contain`, never `cover`
 *   - NEVER distort     → width/height are constrained, not forced
 *   - NEVER assume shape→ wide, square, and symbol-only marks all work
 *   - Preserve alpha    → transparent PNG/SVG keeps its transparency
 *
 * When a tenant has no logo, or the image fails to load, it degrades to a
 * readable wordmark rather than a broken-image icon or an empty gap.
 */

export interface TenantBranding {
  name?: string | null;
  /** Default logo, used when no surface-specific variant is provided. */
  logo?: string | null;
  /** Optimised for dark surfaces (sidebar, navy header). */
  logoDark?: string | null;
  /** Optimised for light surfaces (login card, printed payslip). */
  logoLight?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}

export interface TenantLogoProps {
  branding?: TenantBranding | null;
  /**
   * Surface the logo sits on. Picks the matching variant when the tenant has
   * supplied one; otherwise falls back to whichever single logo exists.
   */
  surface?: 'dark' | 'light';
  /** Height of the logo box in px. Width flexes to the logo's aspect ratio. */
  height?: number;
  maxWidth?: number;
  /**
   * Container backdrop. 'auto' adds a subtle plate only when a light-surface
   * logo has to sit on a dark background, which is the case that most often
   * renders a dark-ink logo invisible.
   */
  container?: 'transparent' | 'white' | 'dark' | 'auto';
  sx?: SxProps<Theme>;
}

const resolveSource = (branding: TenantBranding | null | undefined, surface: 'dark' | 'light') => {
  if (!branding) {
    return null;
  }

  const preferred = surface === 'dark' ? branding.logoDark : branding.logoLight;

  // Fall back through the other variants so a tenant that uploaded only one
  // logo still gets it rendered somewhere sensible.
  return preferred || branding.logo || branding.logoLight || branding.logoDark || null;
};

export const TenantLogo = ({
  branding,
  surface = 'light',
  height = 40,
  maxWidth = 220,
  container = 'auto',
  sx
}: TenantLogoProps) => {
  const [failed, setFailed] = useState(false);

  const source = resolveSource(branding, surface);
  const name = branding?.name?.trim() || 'HotelOpX';

  // Only pad behind the logo when a variant designed for the opposite surface
  // is being reused — otherwise transparency is preserved untouched.
  const usingMismatchedVariant =
    surface === 'dark' && !branding?.logoDark && Boolean(branding?.logoLight || branding?.logo);

  const backdrop =
    container === 'auto'
      ? usingMismatchedVariant
        ? 'rgba(255,255,255,0.92)'
        : 'transparent'
      : container === 'white'
        ? '#FFFFFF'
        : container === 'dark'
          ? 'rgba(11,34,57,0.92)'
          : 'transparent';

  if (!source || failed) {
    return (
      <Typography
        variant="h6"
        noWrap
        sx={{
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: surface === 'dark' ? '#FFFFFF' : 'text.primary',
          maxWidth,
          ...sx
        }}
      >
        {name}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height,
        maxWidth,
        width: 'auto',
        borderRadius: backdrop === 'transparent' ? 0 : 1,
        px: backdrop === 'transparent' ? 0 : 1,
        bgcolor: backdrop,
        overflow: 'hidden',
        ...sx
      }}
    >
      <Box
        component="img"
        src={source}
        alt={name}
        onError={() => setFailed(true)}
        sx={{
          // The whole contract in three lines: contain, and never exceed the
          // box in either axis. No cover, no fixed aspect ratio.
          objectFit: 'contain',
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
          display: 'block'
        }}
      />
    </Box>
  );
};

export default TenantLogo;
