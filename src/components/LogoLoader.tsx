import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';

/**
 * Premium brand-aware loading state.
 *
 *  <LogoLoader />                       // full-page centered loader
 *  <LogoLoader inline />                // compact inline loader (cards, dialogs)
 *  <LogoLoader label="Loading shifts" /> // custom caption
 *
 * Visual: HotelOpX building mark, gold halo pulsing behind it, three dots beneath.
 * Uses brand tokens so it matches both light and dark themes automatically.
 */

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
`;

const haloPulse = keyframes`
  0%, 100% { transform: scale(1);   opacity: 0.65; }
  50%      { transform: scale(1.18); opacity: 0.25; }
`;

const dot = keyframes`
  0%, 80%, 100% { opacity: 0.18; transform: scale(0.85); }
  40%           { opacity: 1;    transform: scale(1); }
`;

interface LogoLoaderProps {
  label?: string;
  inline?: boolean;
  minHeight?: number | string;
  size?: number;
}

const LogoLoader: React.FC<LogoLoaderProps> = ({
  label = 'Loading',
  inline = false,
  minHeight,
  size = 72
}) => {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const navy = theme.palette.primary.main;

  const haloSize = size * 1.65;

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        width: '100%',
        minHeight: minHeight ?? (inline ? 140 : '60vh'),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        color: theme.palette.text.secondary
      }}
    >
      <Box sx={{ position: 'relative', width: haloSize, height: haloSize }}>
        {/* Gold halo */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(gold, 0.32)} 0%, transparent 65%)`,
            animation: `${haloPulse} 2.2s ease-in-out infinite`
          }}
        />
        {/* Logo mark — uses brand SVG so it scales crisp */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            animation: `${float} 2.2s ease-in-out infinite`
          }}
        >
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: size * 0.22,
              display: 'grid',
              placeItems: 'center',
              background: `linear-gradient(135deg, ${navy} 0%, ${theme.palette.primary.light} 100%)`,
              boxShadow: `0 18px 36px ${alpha(navy, 0.32)}`,
              color: gold
            }}
          >
            {/* Stylized HotelOpX building mark — pure SVG, no PNG dependency */}
            <svg
              viewBox="0 0 64 64"
              width={size * 0.62}
              height={size * 0.62}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              {/* Stars */}
              <path d="M16 11 L17.4 14.8 L21.5 14.8 L18.2 17.2 L19.5 21 L16 18.6 L12.5 21 L13.8 17.2 L10.5 14.8 L14.6 14.8 Z" fill="currentColor" />
              <path d="M32 9  L33.4 12.8 L37.5 12.8 L34.2 15.2 L35.5 19 L32 16.6 L28.5 19 L29.8 15.2 L26.5 12.8 L30.6 12.8 Z" fill="currentColor" />
              <path d="M48 11 L49.4 14.8 L53.5 14.8 L50.2 17.2 L51.5 21 L48 18.6 L44.5 21 L45.8 17.2 L42.5 14.8 L46.6 14.8 Z" fill="currentColor" />
              {/* Building */}
              <path
                d="M14 56 V28 H26 V22 L32 18 L38 22 V28 H50 V56 H40 V46 H36 V56 H28 V46 H24 V56 Z"
                fill="#FFFFFF"
                fillOpacity="0.96"
              />
              {/* Window grid */}
              <g fill={navy} fillOpacity="0.85">
                <rect x="16.5" y="31" width="3.2" height="3.2" rx="0.6" />
                <rect x="21.5" y="31" width="3.2" height="3.2" rx="0.6" />
                <rect x="16.5" y="36" width="3.2" height="3.2" rx="0.6" />
                <rect x="21.5" y="36" width="3.2" height="3.2" rx="0.6" />
                <rect x="16.5" y="41" width="3.2" height="3.2" rx="0.6" />
                <rect x="21.5" y="41" width="3.2" height="3.2" rx="0.6" />

                <rect x="30.5" y="25" width="3" height="3" rx="0.6" />
                <rect x="30.5" y="30" width="3" height="3" rx="0.6" />
                <rect x="30.5" y="35" width="3" height="3" rx="0.6" />
                <rect x="30.5" y="40" width="3" height="3" rx="0.6" />

                <rect x="40.5" y="31" width="3.2" height="3.2" rx="0.6" />
                <rect x="45.5" y="31" width="3.2" height="3.2" rx="0.6" />
                <rect x="40.5" y="36" width="3.2" height="3.2" rx="0.6" />
                <rect x="45.5" y="36" width="3.2" height="3.2" rx="0.6" />
                <rect x="40.5" y="41" width="3.2" height="3.2" rx="0.6" />
                <rect x="45.5" y="41" width="3.2" height="3.2" rx="0.6" />
              </g>
              {/* Door */}
              <rect x="30.2" y="48" width="3.6" height="8" rx="0.6" fill={navy} />
            </svg>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: theme.palette.text.secondary
          }}
        >
          {label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: gold,
                animation: `${dot} 1.4s ease-in-out ${i * 0.16}s infinite`
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default LogoLoader;
