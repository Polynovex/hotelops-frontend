import React, { useEffect, useState } from 'react';
import { Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CloudDoneRounded, CloudOffRounded, ErrorOutlineRounded, SyncRounded } from '@mui/icons-material';
import { desktopBridge } from '../services/desktopBridge';

const DesktopOfflineIndicator: React.FC = () => {
  const theme = useTheme();
  const [state, setState] = useState<{ online: boolean; pending: number; failed?: number } | null>(null);
  const [failures, setFailures] = useState<Array<{ id: string; resource: string; reason: string; createdAt: number }> | null>(null);

  useEffect(() => {
    if (!desktopBridge) return;
    let mounted = true;
    void desktopBridge
      .status()
      .then((s) => mounted && setState(s))
      .catch(() => {});
    const unsubscribe = desktopBridge.onSyncStatus((s) => {
      if (mounted) setState({ online: s.online, pending: s.pending, failed: s.failed });
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  if (!desktopBridge || !state) return null;
  const bridge = desktopBridge;
  const failed = state.failed ?? 0;
  /*
   * Refused replays come first: an offline payment the server turned away
   * (already paid on another till, cash not accepted) needs a person, and
   * "Synced" would hide that.
   */
  const tone = failed > 0
    ? { bg: alpha(theme.palette.error.main, 0.14), fg: theme.palette.error.dark, label: `${failed} need attention` }
    : !state.online
    ? { bg: alpha(theme.palette.warning.main, 0.14), fg: theme.palette.warning.dark, label: 'Offline' }
    : state.pending > 0
      ? { bg: alpha(theme.palette.info.main, 0.14), fg: theme.palette.info.dark, label: `${state.pending} pending` }
      : { bg: alpha(theme.palette.success.main, 0.14), fg: theme.palette.success.dark, label: 'Synced' };

  const Icon = failed > 0 ? ErrorOutlineRounded : !state.online ? CloudOffRounded : state.pending > 0 ? SyncRounded : CloudDoneRounded;

  const openFailures = async () => {
    setFailures((await bridge.failedItems?.().catch(() => [])) ?? []);
  };

  return (
    <Box sx={{ position: 'fixed', bottom: 18, right: 18, zIndex: 1400 }}>
      <Chip
        icon={<Icon fontSize="small" />}
        label={tone.label}
        onClick={() => void (failed > 0 ? openFailures() : bridge.syncNow())}
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
      <Dialog open={Boolean(failures)} onClose={() => setFailures(null)} fullWidth maxWidth="sm">
        <DialogTitle>Changes the server refused</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These were saved while offline and refused when they synced. Redo them on the current screen if still needed.
          </Typography>
          {(failures ?? []).map((item) => (
            <Box key={item.id} sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>{item.resource}</Typography>
              <Typography variant="body2" color="error.main">{item.reason}</Typography>
              <Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString()}</Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFailures(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DesktopOfflineIndicator;
