import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip
} from '@mui/material';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import PauseCircleRounded from '@mui/icons-material/PauseCircleOutlineRounded';
import PlayCircleRounded from '@mui/icons-material/PlayCircleOutlineRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded';

interface BusinessLike {
  id: string;
  name: string;
  status?: string;
}

interface Props {
  business: BusinessLike;
  onManageModules: () => void;
  onToggleStatus: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onPurge: (confirmName: string) => Promise<void>;
}

/**
 * Every action for one business, behind a single icon.
 *
 * These were laid out as buttons in a 280px column that grew with each new
 * action and still had no room for delete. A menu costs one column of width
 * and has room for the whole set — and it puts the destructive entries below a
 * divider, where they are reached deliberately rather than sitting a stray
 * click away from "Suspend".
 */
export function BusinessActionsMenu({
  business,
  onManageModules,
  onToggleStatus,
  onDelete,
  onPurge
}: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const live = business.status === 'ACTIVE' || business.status === 'TRIAL';
  const close = () => setAnchor(null);

  const run = (action: () => Promise<void> | void) => async () => {
    close();
    await action();
  };

  const purge = async () => {
    setBusy(true);
    setError('');
    try {
      await onPurge(typedName.trim());
      setConfirmPurge(false);
      setTypedName('');
    } catch (err: any) {
      setError(
        err?.response?.data?.message
          ?? 'Could not delete this business. Nothing has been removed.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip title={`Actions for ${business.name}`}>
        <IconButton
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label={`Actions for ${business.name}`}
        >
          <MoreVertRounded />
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem onClick={run(onManageModules)}>
          <ListItemIcon><SettingsRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Manage modules</ListItemText>
        </MenuItem>

        <MenuItem onClick={run(onToggleStatus)}>
          <ListItemIcon>
            {live ? <PauseCircleRounded fontSize="small" /> : <PlayCircleRounded fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{live ? 'Suspend' : 'Activate'}</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={run(onDelete)}>
          <ListItemIcon><DeleteOutlineRounded fontSize="small" color="warning" /></ListItemIcon>
          {/* Reversible: the record is flagged, every row is kept. */}
          <ListItemText primary="Delete" secondary="Can be undone" />
        </MenuItem>

        <MenuItem
          onClick={() => {
            close();
            setConfirmPurge(true);
          }}
        >
          <ListItemIcon><DeleteForeverRounded fontSize="small" color="error" /></ListItemIcon>
          <ListItemText
            primary="Delete permanently"
            secondary="Removes all data"
            primaryTypographyProps={{ color: 'error.main' }}
          />
        </MenuItem>
      </Menu>

      <Dialog open={confirmPurge} onClose={() => !busy && setConfirmPurge(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: 'error.main' }}>Delete {business.name} permanently?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This removes the property and everything belonging to it — guests,
            bookings, folios, staff records, orders, the ledger and its audit
            history. It cannot be undone.
          </DialogContentText>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/*
            Typing the name is the whole point of this dialog. Suspend, delete
            and permanent delete sit in one menu, and only this one is final.
          */}
          <TextField
            fullWidth
            label="Type the business name to confirm"
            placeholder={business.name}
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPurge(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void purge()}
            disabled={busy || typedName.trim() !== business.name}
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
