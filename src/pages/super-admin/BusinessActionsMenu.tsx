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
  /** Both deletes carry the super admin's password; the server re-checks it. */
  onDelete: (password: string) => Promise<void>;
  onPurge: (confirmName: string, password: string) => Promise<void>;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const live = business.status === 'ACTIVE' || business.status === 'TRIAL';
  const close = () => setAnchor(null);

  const run = (action: () => Promise<void> | void) => async () => {
    close();
    await action();
  };

  const closeDialogs = () => {
    setConfirmPurge(false);
    setConfirmDelete(false);
    setTypedName('');
    setPassword('');
    setError('');
  };

  const softDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await onDelete(password);
      closeDialogs();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not delete this business.');
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    setBusy(true);
    setError('');
    try {
      await onPurge(typedName.trim(), password);
      closeDialogs();
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

        <MenuItem
          onClick={() => {
            close();
            setConfirmDelete(true);
          }}
        >
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

      <Dialog open={confirmDelete} onClose={() => !busy && closeDialogs()} fullWidth maxWidth="xs">
        <DialogTitle>Delete {business.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            The business goes offline for all of its staff. Its data is kept and
            it can be restored later.
          </DialogContentText>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            type="password"
            label="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs} disabled={busy}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => void softDelete()}
            disabled={busy || !password}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmPurge} onClose={() => !busy && closeDialogs()} fullWidth maxWidth="sm">
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
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="password"
            label="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void purge()}
            disabled={busy || typedName.trim() !== business.name || !password}
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
