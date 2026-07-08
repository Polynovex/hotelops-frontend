import React, { useEffect, useState } from 'react';
import { Box, Chip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CloudDoneRounded, CloudOffRounded, SyncRounded } from '@mui/icons-material';
import { desktopBridge } from '../services/desktopBridge';

const DesktopOfflineIndicator: React.FC = () => {
  const theme = useTheme();
  const [state, setState] = useState<{ online: boolean; pending: number } | null>(null);

  useEffect(() => {
    if (!desktopBridge) return;
    let mounted = true;
    void desktopBridge
      .status()
      .then((s) => mounted && setState(s))
      .catch(() => {});
    const unsubscribe = desktopBridge.onSyncStatus((s) => {
      if (mounted) setState({ online: s.online, pending: s.pending });
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  if (!desktopBridge || !state) return null;
  const bridge = desktopBridge;
  const tone = !state.online
    ? { bg: alpha(theme.palette.warning.main, 0.14), fg: theme.palette.warning.dark, label: 'Offline' }
    : state.pending > 0
      ? { bg: alpha(theme.palette.info.main, 0.14), fg: theme.palette.info.dark, label: `${state.pending} pending` }
      : { bg: alpha(theme.palette.success.main, 0.14), fg: theme.palette.success.dark, label: 'Synced' };

  const Icon = !state.online ? CloudOffRounded : state.pending > 0 ? SyncRounded : CloudDoneRounded;

  return (
    <Box sx={{ position: 'fixed', bottom: 18, right: 18, zIndex: 1400 }}>
      <Chip
        icon={<Icon fontSize="small" />}
        label={tone.label}
        onClick={() => void bridge.syncNow()}
        sx={{
          bgcolor: tone.bg,
          color: tone.fg,
          fontWeight: 700,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 12px 28px rgba(15,27,35,0.16)',
          border: `1px solid ${alpha(tone.fg, 0.24)}`,
          cursor: 'pointer'
        }}
      />
    </Box>
  );
};

export default DesktopOfflineIndicator;
