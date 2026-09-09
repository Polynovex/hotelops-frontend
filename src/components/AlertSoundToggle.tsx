import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRounded from '@mui/icons-material/VolumeOffRounded';
import { isChimeEnabled, setChimeEnabled, playChime } from '../utils/alertChime';

/**
 * Turns alert sounds on and off.
 *
 * A kitchen wants the chime; a manager sitting next to the kitchen does not
 * want it twice. The preference is per device rather than per account, because
 * it belongs to where the screen is — the same person moving from the pass to
 * the office wants a different answer in each place.
 *
 * Switching it on plays the tone once, so the setting confirms itself instead
 * of leaving someone to wonder whether it worked.
 */
export function AlertSoundToggle() {
  const [enabled, setEnabled] = useState(isChimeEnabled);

  const toggle = () => {
    const next = !enabled;
    setChimeEnabled(next);
    setEnabled(next);

    // Doubles as the user gesture browsers require before audio may play.
    if (next) playChime('soft');
  };

  return (
    <Tooltip title={enabled ? 'Alert sounds on — click to mute' : 'Alert sounds muted — click to turn on'}>
      <IconButton
        onClick={toggle}
        size="small"
        aria-label={enabled ? 'Mute alert sounds' : 'Turn on alert sounds'}
        aria-pressed={enabled}
        color={enabled ? 'primary' : 'default'}
      >
        {enabled ? <VolumeUpRounded fontSize="small" /> : <VolumeOffRounded fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
