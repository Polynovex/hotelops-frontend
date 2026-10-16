import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import { roomOpsService } from '../../services/operations';
import { ROOM_ISSUE_LABEL, roomIssueService, type RoomIssue, type RoomIssueCategory } from '../../services/housekeeping.service';
import { getApiErrorMessage } from '../../utils/apiError';

/** Report a problem found in a room; housekeeping managers are notified. */
const ReportIssueDialog: React.FC<{ open: boolean; onClose: () => void; onReported: (message: string) => void }> = ({ open, onClose, onReported }) => {
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; status: string }>>([]);
  const [roomId, setRoomId] = useState('');
  const [category, setCategory] = useState<RoomIssueCategory>('PLUMBING');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<RoomIssue['priority']>('MEDIUM');
  const [outOfOrder, setOutOfOrder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRoomId('');
    setCategory('PLUMBING');
    setDescription('');
    setPriority('MEDIUM');
    setOutOfOrder(false);
    setError('');
    roomOpsService
      .listRooms()
      .then((rows) => setRooms([...rows].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))))
      .catch(() => setRooms([]));
  }, [open]);

  const room = rooms.find((r) => r.id === roomId);
  const occupied = room?.status === 'OCCUPIED';

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await roomIssueService.report({ roomId, category, description: description.trim(), priority, outOfOrder });
      onReported(result.note ?? `Issue reported for room ${result.roomNumber}${result.outOfOrder ? ' — room taken out of order' : ''}. Your manager has been told.`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not report the issue'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Report an issue</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} fullWidth>
            {rooms.map((r) => (
              <MenuItem key={r.id} value={r.id}>Room {r.roomNumber} · {r.status.toLowerCase()}</MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="What is wrong" value={category} onChange={(e) => setCategory(e.target.value as RoomIssueCategory)} fullWidth>
              {(Object.keys(ROOM_ISSUE_LABEL) as RoomIssueCategory[]).map((key) => (
                <MenuItem key={key} value={key}>{ROOM_ISSUE_LABEL[key]}</MenuItem>
              ))}
            </TextField>
            <TextField select label="How urgent" value={priority} onChange={(e) => setPriority(e.target.value as RoomIssue['priority'])} sx={{ minWidth: 160 }}>
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="URGENT">Urgent</MenuItem>
            </TextField>
          </Stack>
          <TextField label="Describe the problem" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={3} fullWidth />
          <FormControlLabel
            control={<Switch checked={outOfOrder} onChange={(e) => setOutOfOrder(e.target.checked)} />}
            label="Take the room out of order until it is fixed"
          />
          {outOfOrder && occupied && <Alert severity="info">A guest is in this room, so it stays in use; the front desk will be needed to move them.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving || !roomId || description.trim().length < 3}>
          {saving ? 'Sending…' : 'Report issue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportIssueDialog;
