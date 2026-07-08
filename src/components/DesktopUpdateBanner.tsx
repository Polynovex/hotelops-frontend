import { useEffect, useState } from 'react';
import { Alert, Button, Collapse } from '@mui/material';
import { SystemUpdateAltRounded } from '@mui/icons-material';
import { desktopBridge } from '../services/desktopBridge';

const DesktopUpdateBanner = () => {
  const [state, setState] = useState<'idle' | 'available' | 'ready'>('idle');

  useEffect(() => {
    if (!desktopBridge) return;
    const unAvailable = desktopBridge.onUpdateAvailable(() => setState('available'));
    const unReady = desktopBridge.onUpdateReady(() => setState('ready'));
    return () => { unAvailable(); unReady(); };
  }, []);

  if (state === 'idle' || !desktopBridge) return null;

  return (
    <Collapse in>
      <Alert
        severity={state === 'ready' ? 'success' : 'info'}
        icon={<SystemUpdateAltRounded />}
        action={
          state === 'ready' ? (
            <Button
              size="small"
              color="inherit"
              onClick={() => void desktopBridge?.installUpdate()}
            >
              Restart & Install
            </Button>
          ) : null
        }
        onClose={() => setState('idle')}
        sx={{ mb: 1, borderRadius: 2 }}
      >
        {state === 'ready'
          ? 'HotelOpX update downloaded — restart to install.'
          : 'A new version of HotelOpX is downloading in the background.'}
      </Alert>
    </Collapse>
  );
};

export default DesktopUpdateBanner;
