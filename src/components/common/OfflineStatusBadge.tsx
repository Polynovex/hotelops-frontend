import React, { useEffect, useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import { CloudDoneOutlined, CloudOffOutlined, SyncOutlined } from '@mui/icons-material';
import { desktopBridge, isDesktop } from '../../services/desktopBridge';

const OfflineStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<{ online: boolean; pending: number }>({
    online: true,
    pending: 0
  });

  useEffect(() => {
    if (!desktopBridge) return;
    let unsub: (() => void) | undefined;
    desktopBridge.status().then(setStatus).catch(() => undefined);
    unsub = desktopBridge.onSyncStatus(setStatus);
    return () => {
      unsub?.();
    };
  }, []);

  if (!isDesktop) return null;

  const offline = !status.online;
  const pending = status.pending > 0;

  if (!offline && !pending) {
    return (
      <Tooltip title="All changes synced">
        <Chip
          size="small"
          icon={<CloudDoneOutlined />}
          label="Synced"
          color="success"
          variant="outlined"
        />
      </Tooltip>
    );
  }

  if (offline) {
    return (
      <Tooltip title={`Offline — ${status.pending} change(s) queued`}>
        <Chip
          size="small"
          icon={<CloudOffOutlined />}
          label={`Offline · ${status.pending}`}
          color="warning"
          variant="outlined"
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`Syncing ${status.pending} change(s)`}>
      <Chip
        size="small"
        icon={<SyncOutlined />}
        label={`Syncing · ${status.pending}`}
        color="info"
        variant="outlined"
        onClick={() => desktopBridge?.syncNow()}
      />
    </Tooltip>
  );
};

export default OfflineStatusBadge;
