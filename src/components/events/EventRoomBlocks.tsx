import React, { useEffect, useState } from 'react';
import { usePlanStore } from '../../store/planStore';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { api } from '../../services/api';
import { EVENT_STATUS_LABEL, type EventStatus } from '../../services/events';
import { getApiErrorMessage } from '../../utils/apiError';

type Block = {
  eventId: string;
  reference: string;
  eventName: string;
  eventStatus: EventStatus;
  contact: string;
  roomTypeCode: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  assigned: number;
  checkedIn: number;
  roomNumbers: string[];
};

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Rooms held for banquets and events. They count against their room type, so
 * the desk cannot sell them to walk-ins while the event holds them.
 */
const EventRoomBlocks: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Block[]>([]);
  const [error, setError] = useState('');
  // Banquet & events is Enterprise only; without it there are no blocks to show.
  const hasEvents = usePlanStore((state) => state.has)('EVENTS');
  usePlanStore((state) => state.features);

  useEffect(() => {
    if (!hasEvents) return;
    api
      .get('/events/room-blocks')
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.response?.data?.error === 'FEATURE_DISABLED') return;
        setError(getApiErrorMessage(err, 'Could not load event room blocks'));
      });
  }, [hasEvents]);

  if (!hasEvents) return null;

  return (
    <Paper variant="outlined" sx={{ mt: 3, borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2 }}>
        <Typography fontWeight={800}>Event room blocks</Typography>
        <Typography variant="body2" color="text.secondary">
          Rooms reserved for banquets and events. They are not available to other guests for these dates.
        </Typography>
      </Box>
      {error && <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Event</TableCell>
              <TableCell>Room type</TableCell>
              <TableCell align="right">Rooms</TableCell>
              <TableCell>Check-in</TableCell>
              <TableCell>Check-out</TableCell>
              <TableCell>Assigned</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>No rooms are held for events.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${row.eventId}-${row.roomTypeCode}-${row.checkIn}`} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/business/events/${row.eventId}`)}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{row.eventName}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.reference} · {row.contact}</Typography>
                  </TableCell>
                  <TableCell>{row.roomTypeName}</TableCell>
                  <TableCell align="right">{row.rooms}</TableCell>
                  <TableCell>{day(row.checkIn)}</TableCell>
                  <TableCell>{day(row.checkOut)}</TableCell>
                  <TableCell>
                    {row.assigned}/{row.rooms}
                    {row.roomNumbers.length > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block">{row.roomNumbers.join(', ')}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={EVENT_STATUS_LABEL[row.eventStatus] ?? row.eventStatus} color={row.eventStatus === 'CONFIRMED' || row.eventStatus === 'IN_PROGRESS' ? 'success' : 'warning'} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

export default EventRoomBlocks;
