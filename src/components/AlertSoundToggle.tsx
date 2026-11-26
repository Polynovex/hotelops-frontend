import { useState } from 'react';
import { Box, Button, FormControlLabel, IconButton, Popover, Slider, Stack, Switch, Tooltip, Typography } from '@mui/material';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRounded from '@mui/icons-material/VolumeOffRounded';
import { getChimeVolume, isChimeEnabled, playChime, setChimeEnabled, setChimeVolume } from '../utils/alertChime';

/**
 * Alert sound settings: on/off, volume (0–100) and a test sound.
 *
 * Per device rather than per account, because the right answer belongs to
 * where the screen is — the kitchen pass wants it loud, the office quiet.
 * Changing anything plays the tone once, so the setting confirms itself, and
 * that click is also the gesture browsers require before audio may play.
 */
export function AlertSoundToggle() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(isChimeEnabled);
  const [volume, setVolume] = useState(getChimeVolume);

  const toggle = (next: boolean) => {
    setChimeEnabled(next);
    setEnabled(next);
    if (next) playChime('order');
  };

  const muted = !enabled || volume === 0;

  return (
    <>
      <Tooltip title="Alert sound settings">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          aria-label="Alert sound settings"
          color={muted ? 'default' : 'primary'}
        >
          {muted ? <VolumeOffRounded fontSize="small" /> : <VolumeUpRounded fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>Alert sounds</Typography>
          <FormControlLabel control={<Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} />} label={enabled ? 'On' : 'Muted'} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Volume</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Slider
              value={volume}
              min={0}
              max={100}
              step={5}
              disabled={!enabled}
              aria-label="Notification volume"
              onChange={(_e, value) => setVolume(value as number)}
              onChangeCommitted={(_e, value) => {
                setChimeVolume(value as number);
                playChime('order');
              }}
            />
            <Typography variant="body2" sx={{ minWidth: 32, textAlign: 'right' }}>{volume}</Typography>
          </Stack>
          <Button fullWidth variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => playChime('urgent', { force: true })}>
            Play test sound
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Saved on this device. Your device’s own volume still applies.
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
