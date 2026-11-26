import { useTheme } from '@mui/material/styles';

/**
 * Chart colours from the theme, so charts follow the business's colours and
 * dark mode. Light and dark mode have separate series palettes: colours tuned
 * for a white card wash out or glare on the dark one, so dark mode uses
 * lighter, less saturated tones (each at least 3:1 against the dark card).
 */
const SERIES_LIGHT = ['#0B4F6C', '#B57A12', '#1E7A4F', '#8E2C2C', '#4B5FA8', '#0F7C83', '#7A4E9C', '#5A6A73'];
const SERIES_DARK = ['#7FB8D6', '#F2C46B', '#6FCF97', '#F08A8A', '#A9B6F2', '#6ED3D8', '#C9A2E8', '#B8C2C8'];

export const useChartColors = () => {
  const { palette } = useTheme();
  const dark = palette.mode === 'dark';
  return {
    primary: palette.primary.main,
    accent: palette.secondary.main,
    success: palette.success.main,
    error: palette.error.main,
    warning: palette.warning.main,
    muted: palette.text.disabled,
    grid: palette.card.border,
    /** Ordered series colours for multi-series charts. */
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    /** Axis tick labels and lines. */
    axis: palette.text.secondary,
    /** Tooltip box, so it is not a white box on a dark page. */
    tooltip: {
      contentStyle: {
        backgroundColor: palette.background.paper,
        border: `1px solid ${palette.divider}`,
        borderRadius: 8,
        color: palette.text.primary
      },
      labelStyle: { color: palette.text.primary, fontWeight: 600 },
      itemStyle: { color: palette.text.primary }
    }
  };
};
