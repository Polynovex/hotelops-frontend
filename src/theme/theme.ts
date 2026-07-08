import { PaletteMode } from '@mui/material';
import { alpha, createTheme, ThemeOptions } from '@mui/material/styles';

// =====================================================================
// HotelOpX Brand System (v2) — shared across web, mobile, desktop
// =====================================================================
//
// Design intent: a premium PMS that feels both at-home in a 5-star
// hotel lobby AND in a back-office on a slow connection in Lagos.
// - Deep navy primary  → trust, enterprise, hospitality
// - Refined gold       → signature accent (CTAs, focus, premium chips)
// - Emerald success    → live status, sync-OK, payments
// - Wine error         → variance, voids, locked accounts
// - Warm parchment bg  → low-fatigue for 8-hour shifts
//
// Typography pairing:
// - Cormorant Garamond → display headings (h1–h3) — luxury hotel feel
// - Inter              → UI / body (already loaded)
// - JetBrains Mono     → usercodes, order numbers, references
//
// All tokens are exported as `brand` so plain CSS / Ionic can read them.

export const brand = {
  ink: '#0F1B23',
  inkSoft: '#1C2A33',
  navy: '#0F2A44',
  navyTint: '#1B4A78',
  smoke: '#5A6A73',
  smokeSoft: '#94A1A8',
  gold: '#C49355',
  goldLight: '#E0B879',
  goldDark: '#9C7236',
  emerald: '#16876A',
  emeraldLight: '#3DAA8C',
  emeraldDark: '#0D5E48',
  amber: '#E1A33B',
  wine: '#B14040',
  wineLight: '#D26F6F',
  parchment: '#F7F3EA',
  parchmentSoft: '#FBF8F1',
  cream: '#FFFCF6',
  surfaceDark: '#0E1418',
  surfaceDarkRaised: '#161E24',
  divider: 'rgba(15, 27, 35, 0.08)',
  dividerDark: 'rgba(246, 242, 234, 0.10)'
} as const;

const shadows = [
  'none',
  '0 6px 18px rgba(15, 27, 35, 0.04)',
  '0 10px 24px rgba(15, 27, 35, 0.06)',
  '0 14px 32px rgba(15, 27, 35, 0.08)',
  '0 20px 44px rgba(15, 27, 35, 0.10)',
  ...Array(20).fill('0 28px 60px rgba(15, 27, 35, 0.12)')
] as unknown as ThemeOptions['shadows'];

export const createAppTheme = (mode: PaletteMode) => {
  const isDark = mode === 'dark';

  const palette = {
    mode,
    primary: {
      main: brand.navy,
      light: brand.navyTint,
      dark: '#091B2E',
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: brand.gold,
      light: brand.goldLight,
      dark: brand.goldDark,
      contrastText: brand.ink
    },
    success: {
      main: brand.emerald,
      light: brand.emeraldLight,
      dark: brand.emeraldDark,
      contrastText: '#FFFFFF'
    },
    info: {
      main: brand.navyTint,
      light: '#3F70A1',
      dark: '#0F3556',
      contrastText: '#FFFFFF'
    },
    warning: {
      main: brand.amber,
      light: '#EFC066',
      dark: '#A77519',
      contrastText: brand.ink
    },
    error: {
      main: brand.wine,
      light: brand.wineLight,
      dark: '#7F2727',
      contrastText: '#FFFFFF'
    },
    background: isDark
      ? {
          default: brand.surfaceDark,
          paper: brand.surfaceDarkRaised
        }
      : {
          // Light mode: clean white surface for max content legibility.
          default: '#FFFFFF',
          paper: '#FFFFFF'
        },
    text: isDark
      ? {
          primary: '#F6F2EA',
          secondary: '#C7CFD4',
          disabled: '#8D979F'
        }
      : {
          primary: brand.ink,
          secondary: brand.smoke,
          disabled: brand.smokeSoft
        },
    divider: isDark ? brand.dividerDark : brand.divider
  } as ThemeOptions['palette'];

  return createTheme({
    palette,
    typography: {
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      h1: {
        fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
        fontWeight: 700,
        fontSize: '3rem',
        lineHeight: 1.0,
        letterSpacing: '-0.02em'
      },
      h2: {
        fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
        fontWeight: 700,
        fontSize: '2.4rem',
        lineHeight: 1.05,
        letterSpacing: '-0.015em'
      },
      h3: {
        fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
        fontWeight: 700,
        fontSize: '1.85rem',
        lineHeight: 1.1
      },
      h4: {
        fontWeight: 700,
        fontSize: '1.45rem',
        lineHeight: 1.2,
        letterSpacing: '-0.01em'
      },
      h5: {
        fontWeight: 700,
        fontSize: '1.15rem',
        letterSpacing: '-0.005em'
      },
      h6: {
        fontWeight: 700,
        fontSize: '0.98rem',
        letterSpacing: '-0.005em'
      },
      subtitle1: {
        fontSize: '0.98rem',
        fontWeight: 500,
        color: palette?.text?.secondary
      },
      subtitle2: {
        fontSize: '0.86rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase'
      },
      body1: {
        fontSize: '0.95rem',
        lineHeight: 1.6
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.55
      },
      caption: {
        fontSize: '0.74rem',
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: palette?.text?.secondary
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '-0.005em'
      },
      overline: {
        fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
        fontWeight: 600,
        fontSize: '0.7rem',
        letterSpacing: '0.12em'
      }
    },
    shape: {
      borderRadius: 10
    },
    shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: mode,
            // Brand tokens exposed as CSS variables — picked up by raw CSS / Ionic
            '--hox-navy': brand.navy,
            '--hox-navy-tint': brand.navyTint,
            '--hox-gold': brand.gold,
            '--hox-gold-light': brand.goldLight,
            '--hox-emerald': brand.emerald,
            '--hox-amber': brand.amber,
            '--hox-wine': brand.wine,
            '--hox-ink': brand.ink,
            '--hox-smoke': brand.smoke,
            '--hox-parchment': brand.parchment,
            '--hox-cream': brand.cream
          },
          body: {
            background: isDark ? brand.surfaceDark : '#FFFFFF',
            color: palette?.text?.primary,
            fontFeatureSettings: '"ss01", "cv11"'
          },
          '#root': { minHeight: '100vh' },
          '*::-webkit-scrollbar': { width: 9, height: 9 },
          '*::-webkit-scrollbar-thumb': {
            background: isDark ? alpha('#F6F2EA', 0.14) : alpha(brand.ink, 0.14),
            borderRadius: 10
          },
          '*::-webkit-scrollbar-thumb:hover': {
            background: isDark ? alpha('#F6F2EA', 0.22) : alpha(brand.ink, 0.22)
          },
          '.mono': {
            fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
            letterSpacing: '0.03em'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            color: palette?.text?.primary
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: `1px solid ${isDark ? brand.dividerDark : brand.divider}`,
            background: isDark
              ? `linear-gradient(180deg, ${alpha('#1A242B', 0.96)} 0%, ${alpha('#131A20', 0.92)} 100%)`
              : '#FFFFFF',
            color: palette?.text?.primary,
            boxShadow: isDark
              ? '0 24px 60px rgba(0, 0, 0, 0.32)'
              : '0 12px 32px rgba(15, 27, 35, 0.04)'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 18,
            minHeight: 42,
            fontSize: '0.9rem'
          },
          contained: {
            boxShadow: isDark
              ? '0 12px 24px rgba(0, 0, 0, 0.28)'
              : '0 14px 28px rgba(15, 42, 68, 0.18)',
            '&:hover': {
              boxShadow: isDark
                ? '0 18px 32px rgba(0, 0, 0, 0.36)'
                : '0 20px 36px rgba(15, 42, 68, 0.24)'
            }
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${brand.navy} 0%, ${brand.navyTint} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${brand.navyTint} 0%, #2E5C8E 100%)`
            }
          },
          containedSecondary: {
            background: `linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldLight} 100%)`,
            color: brand.ink,
            '&:hover': {
              background: `linear-gradient(135deg, ${brand.goldDark} 0%, ${brand.gold} 100%)`
            }
          },
          containedSuccess: {
            background: `linear-gradient(135deg, ${brand.emerald} 0%, ${brand.emeraldLight} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${brand.emeraldDark} 0%, ${brand.emerald} 100%)`
            }
          },
          outlined: {
            color: palette?.text?.primary,
            borderColor: isDark ? alpha('#F6F2EA', 0.16) : alpha(brand.ink, 0.14),
            backgroundColor: alpha(palette?.background?.paper || '#ffffff', isDark ? 0.6 : 0.6),
            '&:hover': {
              borderColor: isDark ? alpha('#F6F2EA', 0.28) : alpha(brand.ink, 0.24),
              backgroundColor: alpha(palette?.background?.paper || '#ffffff', isDark ? 0.85 : 0.9)
            }
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.78rem',
            color: palette?.text?.primary,
            '& .MuiChip-icon': { color: 'inherit' },
            ...(ownerState?.variant === 'filled' && ownerState?.color === 'success' && {
              backgroundColor: alpha(brand.emerald, 0.14),
              color: brand.emeraldDark,
              border: `1px solid ${alpha(brand.emerald, 0.24)}`
            }),
            ...(ownerState?.variant === 'filled' && ownerState?.color === 'warning' && {
              backgroundColor: alpha(brand.amber, 0.14),
              color: '#8C5C12',
              border: `1px solid ${alpha(brand.amber, 0.24)}`
            }),
            ...(ownerState?.variant === 'filled' && ownerState?.color === 'error' && {
              backgroundColor: alpha(brand.wine, 0.12),
              color: '#7F2727',
              border: `1px solid ${alpha(brand.wine, 0.22)}`
            })
          })
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: palette?.text?.secondary,
            borderRadius: 10,
            '&:hover': {
              backgroundColor: isDark ? alpha('#F6F2EA', 0.06) : alpha(brand.ink, 0.05)
            }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(palette?.background?.paper || '#ffffff', isDark ? 0.86 : 0.82),
            color: palette?.text?.primary,
            boxShadow: 'none',
            borderBottom: `1px solid ${palette?.divider}`,
            backdropFilter: 'blur(20px)'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: isDark
              ? '#111A22'
              : brand.navy,
            color: '#F8F4EC',
            borderRight: 'none'
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingBlock: 10,
            paddingInline: 14,
            color: alpha('#F8F4EC', 0.78),
            transition: 'background-color 120ms ease, color 120ms ease',
            '&:hover': {
              backgroundColor: alpha('#F8F4EC', 0.06),
              color: '#F8F4EC'
            },
            '&.Mui-selected': {
              backgroundColor: alpha(brand.gold, 0.18),
              color: brand.goldLight,
              boxShadow: `inset 3px 0 0 0 ${brand.gold}`,
              '&:hover': {
                backgroundColor: alpha(brand.gold, 0.24)
              }
            },
            '&.Mui-selected .MuiListItemIcon-root': {
              color: brand.goldLight
            }
          }
        }
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 38,
            color: 'inherit'
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: alpha(palette?.background?.paper || '#ffffff', isDark ? 0.82 : 0.95),
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            '& fieldset': {
              borderColor: isDark ? alpha('#F6F2EA', 0.12) : alpha(brand.ink, 0.14)
            },
            '&:hover fieldset': {
              borderColor: isDark ? alpha('#F6F2EA', 0.24) : alpha(brand.ink, 0.26)
            },
            '&.Mui-focused fieldset': {
              borderColor: brand.gold,
              boxShadow: `0 0 0 4px ${alpha(brand.gold, 0.12)}`
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: palette?.text?.secondary,
            fontWeight: 500,
            '&.Mui-focused': { color: palette?.text?.primary }
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: { root: { color: palette?.text?.secondary, marginLeft: 2 } }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${palette?.divider}`,
            background: isDark ? '#1A2228' : '#FFFFFF',
            color: palette?.text?.primary,
            boxShadow: isDark
              ? '0 20px 48px rgba(0, 0, 0, 0.32)'
              : '0 20px 48px rgba(15, 27, 35, 0.12)'
          }
        }
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            color: palette?.text?.primary,
            fontSize: '0.9rem',
            '&:hover': {
              backgroundColor: alpha(brand.gold, 0.08)
            }
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16 }
        }
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Cormorant Garamond", serif',
            fontWeight: 700,
            fontSize: '1.6rem',
            paddingBottom: 8
          }
        }
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: palette?.divider } }
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 8, overflow: 'hidden', height: 6 },
          bar: { borderRadius: 8 }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: palette?.divider,
            color: palette?.text?.primary
          }
        }
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 700,
              fontSize: '0.78rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: palette?.text?.secondary,
              backgroundColor: isDark ? alpha('#F6F2EA', 0.025) : alpha(brand.ink, 0.025)
            }
          }
        }
      },
      MuiTablePagination: {
        styleOverrides: {
          root: { color: palette?.text?.primary },
          toolbar: { color: palette?.text?.secondary },
          selectIcon: { color: palette?.text?.secondary }
        }
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: brand.gold,
            height: 3,
            borderRadius: 3
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            minHeight: 44,
            '&.Mui-selected': { color: brand.gold }
          }
        }
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 10,
            border: `1px solid ${isDark ? alpha('#F6F2EA', 0.14) : alpha(brand.ink, 0.14)}`,
            '&.Mui-selected': {
              backgroundColor: alpha(brand.gold, 0.16),
              color: brand.ink,
              borderColor: brand.gold
            }
          }
        }
      }
    }
  });
};
