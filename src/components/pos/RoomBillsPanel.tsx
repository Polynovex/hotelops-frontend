import React, { useEffect, useState } from 'react';
import { Alert, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { formatNaira, posFlow, type RoomBill } from '../../services/posFlow';
import { getApiErrorMessage } from '../../utils/apiError';

/** Bills sent to rooms from the POS and QR menu: items, total, room, and whether settled. */
const RoomBillsPanel: React.FC = () => {
  const [status, setStatus] = useState<'' | 'PENDING' | 'SETTLED'>('');
  const [roomNumber, setRoomNumber] = useState('');
  const [rows, setRows] = useState<RoomBill[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      posFlow
        .roomBills({ ...(status ? { status } : {}), ...(roomNumber.trim() ? { roomNumber: roomNumber.trim() } : {}) })
        .then(setRows)
        .catch((err) => setError(getApiErrorMessage(err, 'Could not load room bills')));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [status, roomNumber]);

  const pending = rows.filter((row) => row.status === 'PENDING').reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
          <MenuItem value="SETTLED">Settled</MenuItem>
        </TextField>
        <TextField size="small" label="Room" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
        <Typography variant="body2" sx={{ ml: 'auto' }}>Pending on rooms: <strong>{formatNaira(pending)}</strong></Typography>
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Room</TableCell>
              <TableCell>Guest</TableCell>
              <TableCell>Items</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Posted</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell><strong>{row.roomNumber ?? '—'}</strong></TableCell>
                <TableCell>{row.guestName}<Typography variant="caption" color="text.secondary" display="block">{row.bookingNumber}</Typography></TableCell>
                <TableCell sx={{ maxWidth: 360 }}>
                  {row.items}
                  <Typography variant="caption" color="text.secondary" display="block">{[row.outlet, row.orderNumber].filter(Boolean).join(' · ')}</Typography>
                </TableCell>
                <TableCell align="right">{formatNaira(row.totalAmount)}</TableCell>
                <TableCell><Chip size="small" label={row.status === 'SETTLED' ? 'Settled' : 'Pending'} color={row.status === 'SETTLED' ? 'success' : 'warning'} /></TableCell>
                <TableCell>{new Date(row.postedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No bills sent to rooms in the last 30 days.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
};

export default RoomBillsPanel;
