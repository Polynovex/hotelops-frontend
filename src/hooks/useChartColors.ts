import { useTheme } from '@mui/material/styles';

/** Chart colours from the theme, so charts follow the business's colours and dark mode. */
export const useChartColors = () => {
  const { palette } = useTheme();
  return {
    primary: palette.primary.main,
    accent: palette.secondary.main,
    success: palette.success.main,
    error: palette.error.main,
    muted: palette.text.disabled,
    grid: palette.card.border
  };
};
