import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { PaletteMode } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from './theme';
import { useAuthStore } from '../store/authStore';

const STORAGE_KEY = 'hotelopx-color-mode';

interface ColorModeValue {
  mode: PaletteMode;
  toggleColorMode: () => void;
  setColorMode: (mode: PaletteMode) => void;
}

const ColorModeContext = createContext<ColorModeValue | null>(null);

const getInitialMode = (): PaletteMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ColorModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  // The signed-in business's colours, like a browser theme. Super admins and
  // the sign-in screen keep the HotelOpX palette.
  const brandColors = useAuthStore((state) => (state.user?.role === 'SUPER_ADMIN' ? undefined : state.user?.brandColors));
  const primary = brandColors?.primary ?? null;
  const accent = brandColors?.accent ?? null;
  const theme = useMemo(() => createAppTheme(mode, { primary, accent }), [mode, primary, accent]);
  const value = useMemo<ColorModeValue>(
    () => ({
      mode,
      toggleColorMode: () => setMode((currentMode: PaletteMode) => (currentMode === 'light' ? 'dark' : 'light')),
      setColorMode: setMode
    }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export const useColorMode = () => {
  const context = useContext(ColorModeContext);

  if (!context) {
    throw new Error('useColorMode must be used within ColorModeProvider');
  }

  return context;
};
