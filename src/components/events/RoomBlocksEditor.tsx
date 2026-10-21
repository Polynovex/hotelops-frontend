import React from 'react';
import { Button, Grid, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { formatCurrency } from '../../utils/formatters';
import type { AccommodationInput } from '../../services/events';

/** One room-type line of an event's accommodation, as the form holds it. */
export type RoomBlock = {
  key: string;
  roomTypeCode: string;
  rooms: string;
  guests: string;
  checkIn: string;
  checkOut: string;
  rate: string;
};

const newKey = () => Math.random().toString(36).slice(2);

export const newRoomBlock = (checkIn: string, checkOut: string): RoomBlock => ({
  key: newKey(),
  roomTypeCode: '',
  rooms: '1',
  guests: '1',
  checkIn,
  checkOut,
  rate: ''
});

/** Saved accommodation (a list, or one object from older events) back into form lines. */
export const roomBlocksFrom = (saved: unknown): RoomBlock[] => {
  const list = saved == null ? [] : Array.isArray(saved) ? saved : [saved];
  const ymd = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return (list as AccommodationInput[]).map((a) => ({
    key: newKey(),
    roomTypeCode: a.roomTypeCode,
    rooms: String(a.rooms),
    guests: String(a.guests),
    checkIn: ymd(a.checkIn),
    checkOut: ymd(a.checkOut),
    rate: a.rate != null ? String(a.rate) : ''
  }));
};

/** Form lines to the API shape; lines without a room type are left out. */
export const toAccommodation = (blocks: RoomBlock[]): AccommodationInput[] =>
  blocks
    .filter((b) => b.roomTypeCode)
    .map((b) => ({
      roomTypeCode: b.roomTypeCode,
      rooms: Number(b.rooms) || 1,
      guests: Number(b.guests) || 1,
      checkIn: new Date(`${b.checkIn}T14:00`).toISOString(),
      checkOut: new Date(`${b.checkOut}T12:00`).toISOString(),
      rate: b.rate.trim() === '' ? null : Number(b.rate)
    }));

/**
 * Rooms from one or more room types. Rates default to the room type's
 * standard rate; changing one needs event pricing permission.
 */
const RoomBlocksEditor: React.FC<{
  blocks: RoomBlock[];
  onChange: (blocks: RoomBlock[]) => void;
  roomTypes: Array<{ code: string; name: string; baseRate: number }>;
  canPrice: boolean;
  defaultCheckIn: string;
  defaultCheckOut: string;
}> = ({ blocks, onChange, roomTypes, canPrice, defaultCheckIn, defaultCheckOut }) => {
  const update = (key: string, patch: Partial<RoomBlock>) => onChange(blocks.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  return (
    <Stack spacing={1.5}>
      {blocks.map((block) => (
        <Paper key={block.key} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField select fullWidth size="small" label="Room type" value={block.roomTypeCode} onChange={(e) => update(block.key, { roomTypeCode: e.target.value })}>
                {roomTypes.map((r) => (
                  <MenuItem key={r.code} value={r.code}>{r.name}{r.baseRate ? ` · ${formatCurrency(r.baseRate)}` : ''}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Number of rooms" value={block.rooms} onChange={(e) => update(block.key, { rooms: e.target.value })} /></Grid>
            <Grid item xs={6} md={3}><TextField fullWidth size="small" type="number" label="Guests staying" value={block.guests} onChange={(e) => update(block.key, { guests: e.target.value })} /></Grid>
            <Grid item xs={12} md={1} sx={{ textAlign: 'right' }}>
              <Tooltip title="Remove this room type">
                <IconButton size="small" onClick={() => onChange(blocks.filter((b) => b.key !== block.key))} aria-label="Remove room type"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Grid>
            <Grid item xs={6} md={4}><TextField fullWidth size="small" type="date" label="Check-in" InputLabelProps={{ shrink: true }} value={block.checkIn} onChange={(e) => update(block.key, { checkIn: e.target.value })} /></Grid>
            <Grid item xs={6} md={4}><TextField fullWidth size="small" type="date" label="Check-out" InputLabelProps={{ shrink: true }} inputProps={{ min: block.checkIn }} value={block.checkOut} onChange={(e) => update(block.key, { checkOut: e.target.value })} /></Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" type="number" label="Room rate" value={block.rate}
                placeholder={String(roomTypes.find((r) => r.code === block.roomTypeCode)?.baseRate || '')}
                onChange={(e) => update(block.key, { rate: e.target.value })} disabled={!canPrice} helperText={canPrice ? 'Blank = standard rate' : 'Standard rate'} />
            </Grid>
          </Grid>
        </Paper>
      ))}
      <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => onChange([...blocks, newRoomBlock(defaultCheckIn, defaultCheckOut)])} sx={{ alignSelf: 'flex-start' }}>
        Add a room type
      </Button>
      <Typography variant="caption" color="text.secondary">
        The rooms are booked as reservations linked to this event and billed on its invoice, so the desk only collects extras at check-out. They show on the
        waitlist as event room blocks and cannot be given to other guests.
      </Typography>
    </Stack>
  );
};

export default RoomBlocksEditor;
