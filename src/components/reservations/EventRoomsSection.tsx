import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography
} from '@mui/material';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import DataTable from '../common/DataTable';
import LogoLoader from '../LogoLoader';
import { reservationOpsService, roomOpsService, type AwaitingEventRoom } from '../../services/operations';
import { getApiErrorMessage } from '../../utils/apiError';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Event rooms waiting for a room number, kept apart from ordinary
 * reservations. One row per room, with its own block dates. Every event room
 * is booked under the organiser, so assigning a room also asks who is
 * actually staying in it.
 */
const EventRoomsSection = ({ refreshKey, onChanged }: { refreshKey?: unknown; onChanged?: () => void }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AwaitingEventRoom[] | null>(null);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState<AwaitingEventRoom | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await reservationOpsService.listAwaitingEventRooms());
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load event rooms'));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <CelebrationRoundedIcon color="secondary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Event rooms awaiting a room</Typography>
        {rows && <Chip size="small" label={rows.length} />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Rooms booked as part of an event. They are paid on the event, not on the room.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!rows ? (
        <LogoLoader inline minHeight={100} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={5}
          emptyText="No event rooms are waiting for a room."
          columns={[
            { key: 'checkIn', label: 'Date', minWidth: 170, render: (row) => `${fmt(row.checkIn)} – ${fmt(row.checkOut)}` },
            {
              key: 'event',
              label: 'Event',
              minWidth: 220,
              render: (row) => (
                <Box>
                  <Button size="small" sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 700 }} onClick={() => row.event && navigate(`/business/events/${row.event.id}`)}>
                    {row.event?.eventName ?? 'Event'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.event?.reference}{row.event?.organization ? ` · ${row.event.organization}` : ''}
                  </Typography>
                </Box>
              )
            },
            { key: 'roomTypeName', label: 'Room type', minWidth: 150, render: (row) => row.roomTypeName ?? 'Any' },
            {
              key: 'action',
              label: 'Action',
              minWidth: 220,
              render: (row) => (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button size="small" variant="contained" onClick={() => setAssigning(row)}>Assign room</Button>
                  <Typography variant="caption" color="text.secondary">{row.guestName} · {row.guests} guest{row.guests === 1 ? '' : 's'}</Typography>
                </Stack>
              )
            }
          ]}
        />
      )}
      <AssignEventRoomDialog
        row={assigning}
        onClose={() => setAssigning(null)}
        onDone={() => {
          setAssigning(null);
          void load();
          onChanged?.();
        }}
      />
    </Paper>
  );
};

const AssignEventRoomDialog = ({ row, onClose, onDone }: { row: AwaitingEventRoom | null; onClose: () => void; onDone: () => void }) => {
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; roomType: string; status: string }>>([]);
  const [roomId, setRoomId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    // The organiser's name is the starting point; the desk replaces it with the real guest.
    setGuestName(row.event && row.guestName === row.event.contactName ? '' : row.guestName);
    setPhone('');
    setError('');
    roomOpsService
      .listAvailableRooms(row.checkIn, row.checkOut)
      .then((all) => {
        const sameType = row.roomTypeCode ? all.filter((room) => room.roomType === row.roomTypeCode) : all;
        setRooms(sameType);
        setRoomId(sameType[0]?.id ?? '');
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load available rooms')));
  }, [row]);

  const submit = async () => {
    if (!row) return;
    setBusy(true);
    setError('');
    try {
      await reservationOpsService.setEventRoomGuest(row.id, { guestName: guestName.trim(), phone: phone.trim() || undefined });
      await reservationOpsService.assignRoom(row.id, roomId);
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not assign the room'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(row)} onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Assign event room</DialogTitle>
      <DialogContent>
        {row && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              {row.event?.eventName} ({row.event?.reference}) · {row.roomTypeName ?? 'Any type'} · {fmt(row.checkIn)} – {fmt(row.checkOut)}. Booked by {row.event?.contactName}.
            </Alert>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField autoFocus label="Guest staying in this room *" value={guestName} onChange={(e) => setGuestName(e.target.value)} helperText="The person who will check in, not the event organiser" fullWidth />
            <TextField label="Guest phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
            <TextField select label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} fullWidth disabled={!rooms.length}>
              {rooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>{room.roomNumber} · {room.status.toLowerCase()}</MenuItem>
              ))}
            </TextField>
            {!rooms.length && !error && <Alert severity="warning">No {row.roomTypeName ?? ''} rooms are free for these dates.</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || guestName.trim().length < 2 || !roomId}>
          {busy ? 'Assigning…' : 'Assign room'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventRoomsSection;
