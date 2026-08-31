import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';
import { useWebSocket } from '../../../hooks/useWebSocket';
import GuestKycForm from '../../../components/forms/GuestKycForm';
import guestService, { guestFullName, type Guest } from '../../../services/guest.service';
import {
  QRoomRecord,
  ReservationRecord,
  StayViewPayload,
  profileOpsService,
  reservationOpsService,
  roomOpsService
} from '../../../services/operations';

const statusColor = (status: string) => {
  if (status === 'CHECKED_IN') return 'success';
  if (status === 'CHECKED_OUT') return 'default';
  if (status === 'CANCELLED') return 'error';
  if (status === 'NO_SHOW') return 'warning';
  return 'info';
};

const todayDate = () => new Date().toISOString().slice(0, 10);
const tomorrowDate = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const ReservationTable = ({
  rows,
  onCheckIn,
  onCheckOut,
  onView
}: {
  rows: ReservationRecord[];
  onCheckIn?: (reservationId: string) => void;
  onCheckOut?: (reservationId: string) => void;
  onView?: (reservationId: string) => void;
}) => {
  return (
    <DataTable
      rows={rows}
      rowKey={(reservation) => reservation.id}
      defaultRowsPerPage={10}
      emptyText="No reservations found."
      columns={[
        { key: 'bookingNumber', label: 'Booking #', minWidth: 140 },
        { key: 'guestName', label: 'Guest', minWidth: 170 },
        { key: 'roomNumber', label: 'Room', minWidth: 120 },
        {
          key: 'checkIn',
          label: 'Check In',
          minWidth: 140,
          render: (reservation) => new Date(reservation.checkIn).toLocaleDateString()
        },
        {
          key: 'checkOut',
          label: 'Check Out',
          minWidth: 140,
          render: (reservation) => new Date(reservation.checkOut).toLocaleDateString()
        },
        {
          key: 'status',
          label: 'Status',
          minWidth: 140,
          render: (reservation) => (
            <Chip size="small" label={reservation.status} color={statusColor(reservation.status) as 'default'} />
          )
        },
        {
          key: 'totalAmount',
          label: 'Total',
          minWidth: 130,
          render: (reservation) => `₦${reservation.totalAmount.toLocaleString()}`
        },
        {
          key: 'actions',
          label: 'Action',
          minWidth: 220,
          render: (reservation) => (
            <Stack direction="row" spacing={1}>
              {onView && <Button size="small" onClick={() => onView(reservation.id)}>View</Button>}
              {onCheckIn && reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && (
                <Button size="small" color="success" onClick={() => onCheckIn(reservation.id)}>Check In</Button>
              )}
              {onCheckOut && reservation.status === 'CHECKED_IN' && (
                <Button size="small" color="warning" onClick={() => onCheckOut(reservation.id)}>Check Out</Button>
              )}
            </Stack>
          )
        }
      ]}
    />
  );
};

const StaySummaryCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card>
    <CardContent>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

const RoomAssignmentDialog = ({
  open,
  reservation,
  title,
  onClose,
  onAssign
}: {
  open: boolean;
  reservation: ReservationRecord | null;
  title: string;
  onClose: () => void;
  onAssign: (roomId: string, reason?: string) => Promise<void>;
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; roomType: string; status: string }>>([]);
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');

  const isMove = !!reservation?.roomId;

  useEffect(() => {
    if (!open || !reservation) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await roomOpsService.listAvailableRooms(reservation.checkIn, reservation.checkOut);
        setRooms(rows);
        setRoomId(rows[0]?.id || '');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load available rooms');
      } finally {
        setLoading(false);
      }
    };
    void load();
    setReason('');
  }, [open, reservation]);

  const submit = async () => {
    if (!roomId) { setError('Select a room to continue'); return; }
    if (isMove && !reason.trim()) { setError('Reason for room change is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onAssign(roomId, reason.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign room');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {loading && <LogoLoader inline minHeight={140} label="Loading rooms" />}
          {error && <Alert severity="error">{error}</Alert>}
          {reservation && (
            <Typography variant="body2" color="text.secondary">
              {reservation.guestName} · {new Date(reservation.checkIn).toLocaleDateString()} to{' '}
              {new Date(reservation.checkOut).toLocaleDateString()}
            </Typography>
          )}
          <TextField
            select
            label="Available Room"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            fullWidth
            disabled={loading || rooms.length === 0}
          >
            {rooms.map((room) => (
              <MenuItem key={room.id} value={room.id}>
                {room.roomNumber} · {room.roomType} · {room.status}
              </MenuItem>
            ))}
          </TextField>
          {isMove && (
            <TextField
              label="Reason for Room Change *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={2}
              placeholder="e.g. Guest request, maintenance issue…"
              helperText="Required for all room moves. This is logged in the audit trail."
            />
          )}
          {!loading && rooms.length === 0 && (
            <Alert severity="warning">No rooms are currently available for the selected stay window.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void submit()} variant="contained" disabled={saving || !roomId || (isMove && !reason.trim())}>
          {isMove ? 'Change Room' : 'Assign Room'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ReservationListCore = ({
  title,
  subtitle,
  loader
}: {
  title: string;
  subtitle: string;
  loader: (targetDate: string) => Promise<ReservationRecord[]>;
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetDate, setTargetDate] = useState(todayDate());
  const [rows, setRows] = useState<ReservationRecord[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await loader(targetDate));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  const checkIn = async (reservationId: string) => {
    await reservationOpsService.checkIn(reservationId);
    await load();
  };

  const checkOut = async (reservationId: string) => {
    await reservationOpsService.checkOut(reservationId);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4, overflowX: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} size="small" />
            <Button variant="outlined" onClick={() => void load()} disabled={loading}>Refresh</Button>
            <Button variant="contained" onClick={() => navigate('/business/reservations/create')}>New Reservation</Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <ReservationTable
          rows={rows}
          onCheckIn={(reservationId) => void checkIn(reservationId)}
          onCheckOut={(reservationId) => void checkOut(reservationId)}
          onView={(reservationId) => navigate(`/business/reservations/${reservationId}`)}
        />
      </Container>
    </Layout>
  );
};

export const ReservationListPage = () => (
  <ReservationListCore
    title="Reservations"
    subtitle="Reservation pipeline with direct check-in/check-out actions."
    loader={() => reservationOpsService.listReservations()}
  />
);

export const ArrivalsPage = () => (
  <ReservationListCore
    title="Arrivals"
    subtitle="Guests expected today with quick front-desk actions."
    loader={(targetDate) => reservationOpsService.listArrivals(targetDate)}
  />
);

export const DeparturesPage = () => (
  <ReservationListCore
    title="Departures"
    subtitle="Guests expected to check out on selected date."
    loader={(targetDate) => reservationOpsService.listDepartures(targetDate)}
  />
);

export const InHousePage = () => (
  <ReservationListCore
    title="In-House Guests"
    subtitle="Currently checked-in guests for operations tracking."
    loader={(targetDate) => reservationOpsService.listInHouse(targetDate)}
  />
);

export const CreateReservationPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [guestOptions, setGuestOptions] = useState<Guest[]>([]);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestSearching, setGuestSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; status: string; roomType?: string }>>([]);
  const [kycOpen, setKycOpen] = useState(false);

  const [guestId, setGuestId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState(todayDate());
  const [checkOut, setCheckOut] = useState(tomorrowDate());
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [requestedRoomType, setRequestedRoomType] = useState('');

  useEffect(() => {
    const load = async () => {
      const roomRows = await roomOpsService.listRooms();
      setRooms(roomRows);
      // Deliberately no default guest. Pre-selecting whoever happened to sort
      // first made it far too easy to book a room against the wrong person.
      if (roomRows[0]) {
        setRoomId(roomRows[0].id);
        setRequestedRoomType((roomRows[0] as any).roomType ?? '');
      }
    };
    void load();
  }, []);

  /**
   * Search the guest book as the receptionist types. Debounced so a name is one
   * request rather than one per keystroke, and the in-flight request is marked
   * stale on unmount so a slow response cannot overwrite a newer one.
   */
  useEffect(() => {
    const term = guestQuery.trim();
    if (term.length < 2) {
      setGuestOptions([]);
      setGuestSearching(false);
      return;
    }

    let active = true;
    setGuestSearching(true);

    const timer = setTimeout(() => {
      guestService
        .search(term)
        .then((rows) => {
          if (active) {
            setGuestOptions(rows);
          }
        })
        .catch(() => {
          if (active) {
            setGuestOptions([]);
          }
        })
        .finally(() => {
          if (active) {
            setGuestSearching(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [guestQuery]);

  const handleGuestSelect = (guest: Guest | null) => {
    setSelectedGuest(guest);
    setGuestId(guest?.id ?? '');
    setGuestName(guest ? guestFullName(guest) : '');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guestId) { setError('Please select a guest profile.'); return; }
    setSaving(true);
    setError('');
    try {
      const reservation = await reservationOpsService.createReservation({
        guestId,
        ...(roomId ? { roomId } : {}),
        ...(requestedRoomType ? { requestedRoomType } : {}),
        checkIn,
        checkOut,
        adults,
        children,
        totalAmount
      });
      navigate(`/business/reservations/${reservation.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create reservation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Create Reservation</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Guest name is pulled from the selected guest profile — no free-text entry.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 3 }}>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
                <Autocomplete
                  fullWidth
                  options={guestOptions}
                  value={selectedGuest}
                  onChange={(_e, value) => handleGuestSelect(value)}
                  onInputChange={(_e, value, reason) => {
                    // Ignore the input change that fires when a value is picked,
                    // otherwise selecting a guest kicks off another search.
                    if (reason === 'input') {
                      setGuestQuery(value);
                    }
                  }}
                  loading={guestSearching}
                  // The server already ranks and caps the results; re-filtering
                  // locally would hide matches it deliberately returned.
                  filterOptions={(options) => options}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => guestFullName(option)}
                  noOptionsText={
                    guestQuery.trim().length < 2
                      ? 'Type at least 2 characters to search'
                      : 'No matching guest — use + New Guest'
                  }
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Stack sx={{ width: '100%' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={600}>
                            {guestFullName(option)}
                          </Typography>
                          {option.isBlacklisted && (
                            <Chip size="small" color="error" label="Blacklisted" />
                          )}
                          {option.guestType === 'REGULAR' && !option.isBlacklisted && (
                            <Chip size="small" color="success" label="Regular" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {[option.phone, option.email].filter(Boolean).join(' · ')}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Guest Profile *"
                      required
                      placeholder="Search by name, phone, or email"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {guestSearching && <CircularProgress color="inherit" size={18} />}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                />
                <Button variant="outlined" onClick={() => setKycOpen(true)} sx={{ whiteSpace: 'nowrap', minWidth: 140 }}>
                  + New Guest
                </Button>
              </Stack>

              {selectedGuest?.isBlacklisted && (
                <Alert severity="error">
                  <strong>{guestName}</strong> is blacklisted.
                  {selectedGuest.blacklistReason
                    ? ` Reason: ${selectedGuest.blacklistReason}`
                    : ''}{' '}
                  Check with a manager before taking this booking.
                </Alert>
              )}

              {guestName && !selectedGuest?.isBlacklisted && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Guest: <strong>{guestName}</strong>
                  {selectedGuest?.guestType === 'REGULAR'
                    ? ` · Regular guest, ${selectedGuest.stayCount} previous stay${selectedGuest.stayCount === 1 ? '' : 's'}`
                    : ''}
                </Alert>
              )}

              <TextField select label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <MenuItem value="">Unassigned</MenuItem>
                {rooms.map((room) => (
                  <MenuItem key={room.id} value={room.id}>{room.roomNumber} ({room.status})</MenuItem>
                ))}
              </TextField>

              <TextField
                label="Requested Room Type"
                value={requestedRoomType}
                onChange={(e) => setRequestedRoomType(e.target.value)}
                placeholder="Standard / Deluxe / Suite"
                required={!roomId}
              />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Check In" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Check Out" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Adults" type="number" value={adults} onChange={(e) => setAdults(Number(e.target.value))} fullWidth />
                <TextField label="Children" type="number" value={children} onChange={(e) => setChildren(Number(e.target.value))} fullWidth />
                <TextField label="Total (NGN)" type="number" value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} fullWidth />
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button variant="outlined" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={saving}>Create Reservation</Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>

        <GuestKycForm
          open={kycOpen}
          onClose={() => setKycOpen(false)}
          onCreated={(g) => {
            // A guest created here is brand new, so they are a one-time guest
            // with no stays and no blacklist history until proven otherwise.
            const created = {
              ...(g as Partial<Guest>),
              id: g.id,
              firstName: g.firstName,
              lastName: g.lastName,
              guestType: 'ONE_TIME',
              stayCount: 0,
              isBlacklisted: false
            } as Guest;

            setGuestOptions((prev) => [created, ...prev]);
            handleGuestSelect(created);
            setKycOpen(false);
          }}
        />
      </Container>
    </Layout>
  );
};

export const ReservationDetailPage = () => {
  const { id } = useParams();
  const { on } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<ReservationRecord | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [guestPhotoUrl, setGuestPhotoUrl] = useState<string | null>(null);

  /**
   * `background` skips the full-page spinner. Realtime events refresh this page
   * frequently, and flipping `loading` on every one made it look as though the
   * page never finished loading.
   */
  const load = async (background = false) => {
    if (!id) {
      setError('Reservation ID missing');
      setLoading(false);
      return;
    }

    if (!background) {
      setLoading(true);
    }
    setError('');
    try {
      const result = await reservationOpsService.getReservation(id);
      if (!result) {
        throw new Error('Reservation not found');
      }
      setReservation(result);
      if (result.guestId) {
        try {
          const docs = await profileOpsService.listDocuments(result.guestId);
          const photo = docs.find((d) =>
            d.fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(d.fileName)
          );
          if (photo) setGuestPhotoUrl(`/api/profiles/${result.guestId}/documents/${photo.id}`);
        } catch (_) { /* photo optional */ }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reservation');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win || !reservation) return;
    const photoHtml = guestPhotoUrl
      ? `<img src="${guestPhotoUrl}" alt="Guest Photo" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid #ccc;" />`
      : '';
    win.document.write(`<!DOCTYPE html><html><head><title>Reservation ${reservation.bookingNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;max-width:600px;margin:auto}h2{margin-bottom:4px}.meta{color:#666;font-size:13px;margin-bottom:20px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}.label{font-weight:600}.photo-row{display:flex;gap:16px;align-items:flex-start;margin-bottom:20px}</style>
      </head><body>
      <h2>Reservation &#8212; ${reservation.bookingNumber}</h2>
      <p class="meta">Printed ${new Date().toLocaleString()}</p>
      <div class="photo-row">${photoHtml}<div style="flex:1">
        <div class="row"><span class="label">Guest</span><span>${reservation.guestName}</span></div>
        <div class="row"><span class="label">Room</span><span>${reservation.roomNumber}</span></div>
        <div class="row"><span class="label">Status</span><span>${reservation.status}</span></div>
      </div></div>
      <div class="row"><span class="label">Check In</span><span>${new Date(reservation.checkIn).toLocaleDateString()}</span></div>
      <div class="row"><span class="label">Check Out</span><span>${new Date(reservation.checkOut).toLocaleDateString()}</span></div>
      <div class="row"><span class="label">Room Type</span><span>${reservation.requestedRoomType || '&#8212;'}</span></div>
      <div class="row"><span class="label">Adults</span><span>${reservation.adults}</span></div>
      <div class="row"><span class="label">Children</span><span>${reservation.children}</span></div>
      <div class="row"><span class="label">Total</span><span>&#8358;${reservation.totalAmount.toLocaleString()}</span></div>
      <div class="row"><span class="label">Balance</span><span>&#8358;${reservation.balance.toLocaleString()}</span></div>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const unsubscribers = [
      on('hotel.reservation.updated', () => void load(true)),
      on('hotel.reservation.checked_in', () => void load(true)),
      on('hotel.reservation.checked_out', () => void load(true)),
      on('hotel.room.updated', () => void load(true))
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, id]);

  const performCheckIn = async () => {
    if (!id) return;
    await reservationOpsService.checkIn(id);
    await load();
  };

  const performCheckOut = async () => {
    if (!id) return;
    await reservationOpsService.checkOut(id);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {reservation && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>{reservation.bookingNumber}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Reservation detail with live room assignment, Q-room, and front-desk actions.
            </Typography>

            <Stack spacing={1.5}>
              <Typography><strong>Guest:</strong> {reservation.guestName}</Typography>
              <Typography><strong>Room:</strong> {reservation.roomNumber}</Typography>
              <Typography><strong>Requested Type:</strong> {reservation.requestedRoomType || '—'}</Typography>
              <Typography><strong>Status:</strong> {reservation.status}</Typography>
              <Typography><strong>Dates:</strong> {new Date(reservation.checkIn).toLocaleDateString()} - {new Date(reservation.checkOut).toLocaleDateString()}</Typography>
              <Typography><strong>Total:</strong> ₦{reservation.totalAmount.toLocaleString()}</Typography>
              <Typography><strong>Balance:</strong> ₦{reservation.balance.toLocaleString()}</Typography>
              <Typography><strong>Q-Room:</strong> {reservation.isQRoom ? `Queued (priority ${reservation.qRoomPriority || 0})` : 'No'}</Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
              <Button variant="outlined" onClick={() => setAssignOpen(true)}>
                {reservation.roomId ? 'Change Room' : 'Assign Room'}
              </Button>
              {!reservation.isQRoom && reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && (
                <Button
                  variant="outlined"
                  onClick={() =>
                    void reservationOpsService
                      .setQRoom(reservation.id, { priority: 1, preStayCharging: true, releaseRoom: !reservation.roomId })
                      .then(() => load())
                  }
                >
                  Move To Q-Room
                </Button>
              )}
              {reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && (
                <Button variant="contained" color="success" onClick={() => void performCheckIn()}>
                  Check In
                </Button>
              )}
              {reservation.status === 'CHECKED_IN' && (
                <Button variant="contained" color="warning" onClick={() => void performCheckOut()}>
                  Check Out
                </Button>
              )}
              <Button variant="outlined" onClick={() => void load()}>Refresh</Button>
              <Button variant="outlined" color="secondary" onClick={handlePrint}>Print</Button>
            </Stack>
          </Paper>
        )}

        <RoomAssignmentDialog
          open={assignOpen}
          reservation={reservation}
          title={reservation?.roomId ? 'Change Room' : 'Assign Room'}
          onClose={() => setAssignOpen(false)}
          onAssign={async (roomId, reason) => {
            if (!reservation) return;
            if (reservation.roomId) {
              await reservationOpsService.moveRoom(reservation.id, roomId, reason);
            } else {
              await reservationOpsService.assignRoom(reservation.id, roomId);
            }
            await load();
          }}
        />
      </Container>
    </Layout>
  );
};

export const CheckInPage = () => {
  const { on } = useWebSocket();
  const [targetDate, setTargetDate] = useState(todayDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReservationRecord[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await reservationOpsService.listArrivals(targetDate));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load arrivals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  useEffect(() => {
    const unsubscribers = [
      on('hotel.reservation.updated', () => void load()),
      on('hotel.reservation.checked_in', () => void load()),
      on('hotel.room.updated', () => void load())
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, targetDate]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Check-In Queue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Assign rooms, move early arrivals to Q-room, and complete check-in from one queue.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} size="small" />
            <Button variant="outlined" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <DataTable
          rows={rows}
          rowKey={(reservation) => reservation.id}
          defaultRowsPerPage={10}
          emptyText="No arrivals found for the selected date."
          columns={[
            { key: 'bookingNumber', label: 'Booking #', minWidth: 140 },
            { key: 'guestName', label: 'Guest', minWidth: 180 },
            {
              key: 'roomNumber',
              label: 'Room / Type',
              minWidth: 180,
              render: (reservation) => reservation.roomId ? reservation.roomNumber : reservation.requestedRoomType || 'Unassigned'
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 120,
              render: (reservation) => (
                <Chip size="small" label={reservation.status} color={statusColor(reservation.status) as 'default'} />
              )
            },
            {
              key: 'balance',
              label: 'Balance',
              minWidth: 120,
              render: (reservation) => `₦${reservation.balance.toLocaleString()}`
            },
            {
              key: 'actions',
              label: 'Actions',
              minWidth: 300,
              render: (reservation) => (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button size="small" onClick={() => setSelectedReservation(reservation)}>
                    {reservation.roomId ? 'Change Room' : 'Assign Room'}
                  </Button>
                  {!reservation.isQRoom && (
                    <Button
                      size="small"
                      onClick={() =>
                        void reservationOpsService
                          .setQRoom(reservation.id, { priority: 1, preStayCharging: true, releaseRoom: !reservation.roomId })
                          .then(() => load())
                      }
                    >
                      Q-Room
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="success"
                    disabled={!reservation.roomId}
                    onClick={() => void reservationOpsService.checkIn(reservation.id).then(() => load())}
                  >
                    Check In
                  </Button>
                </Stack>
              )
            }
          ]}
        />

        <RoomAssignmentDialog
          open={Boolean(selectedReservation)}
          reservation={selectedReservation}
          title={selectedReservation?.roomId ? 'Change Room' : 'Assign Room'}
          onClose={() => setSelectedReservation(null)}
          onAssign={async (roomId, reason) => {
            if (!selectedReservation) return;
            if (selectedReservation.roomId) {
              await reservationOpsService.moveRoom(selectedReservation.id, roomId, reason);
            } else {
              await reservationOpsService.assignRoom(selectedReservation.id, roomId);
            }
            await load();
          }}
        />
      </Container>
    </Layout>
  );
};

export const CheckOutPage = () => {
  const { on } = useWebSocket();
  const [targetDate, setTargetDate] = useState(todayDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReservationRecord[]>([]);
  const [zeroBalanceOnly, setZeroBalanceOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await reservationOpsService.listDepartures(targetDate));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load departures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  useEffect(() => {
    const unsubscribers = [
      on('hotel.reservation.checked_out', () => void load()),
      on('hotel.reservation.updated', () => void load())
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, targetDate]);

  const filteredRows = zeroBalanceOnly ? rows.filter((reservation) => reservation.balance <= 0) : rows;

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Check-Out Queue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Departures with quick checkout for zero-balance guests.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} size="small" />
            <TextField
              select
              label="Filter"
              value={zeroBalanceOnly ? 'ZERO' : 'ALL'}
              onChange={(event) => setZeroBalanceOnly(event.target.value === 'ZERO')}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">All Departures</MenuItem>
              <MenuItem value="ZERO">Zero Balance Only</MenuItem>
            </TextField>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <DataTable
          rows={filteredRows}
          rowKey={(reservation) => reservation.id}
          defaultRowsPerPage={10}
          emptyText="No departures found for the selected date."
          columns={[
            { key: 'bookingNumber', label: 'Booking #', minWidth: 140 },
            { key: 'guestName', label: 'Guest', minWidth: 180 },
            { key: 'roomNumber', label: 'Room', minWidth: 120 },
            {
              key: 'balance',
              label: 'Balance',
              minWidth: 130,
              render: (reservation) => `₦${reservation.balance.toLocaleString()}`
            },
            {
              key: 'status',
              label: 'Status',
              minWidth: 130,
              render: (reservation) => (
                <Chip size="small" label={reservation.status} color={statusColor(reservation.status) as 'default'} />
              )
            },
            {
              key: 'actions',
              label: 'Action',
              minWidth: 180,
              render: (reservation) => (
                <Button
                  size="small"
                  color="warning"
                  disabled={reservation.status !== 'CHECKED_IN' || reservation.balance > 0}
                  onClick={() => void reservationOpsService.checkOut(reservation.id).then(() => load())}
                >
                  Quick Check-Out
                </Button>
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};

export const QRoomPage = () => {
  const { on } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState<QRoomRecord[]>([]);
  const [eligible, setEligible] = useState<ReservationRecord[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [queueRows, arrivalRows] = await Promise.all([
        reservationOpsService.listQRoomQueue(),
        reservationOpsService.listArrivals(todayDate())
      ]);
      setQueue(queueRows);
      setEligible(arrivalRows.filter((reservation) => !reservation.isQRoom && reservation.status !== 'CHECKED_IN'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Q-room data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const unsubscribers = [
      on('hotel.reservation.updated', () => void load()),
      on('hotel.room.updated', () => void load()),
      on('hotel.stay_view.updated', () => void load())
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Q-Room
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Early arrivals and pre-stay charging queue with direct room assignment.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <StaySummaryCard label="Queued Reservations" value={queue.length} />
          </Grid>
          <Grid item xs={12} md={4}>
            <StaySummaryCard label="Pre-Stay Charging Enabled" value={queue.filter((row) => row.preStayCharging).length} />
          </Grid>
          <Grid item xs={12} md={4}>
            <StaySummaryCard label="Eligible Arrivals" value={eligible.length} />
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
            Queue Candidates
          </Typography>
          <DataTable
            rows={eligible}
            rowKey={(reservation) => reservation.id}
            defaultRowsPerPage={5}
            emptyText="No arrivals available to move into Q-room."
            columns={[
              { key: 'guestName', label: 'Guest', minWidth: 180 },
              {
                key: 'roomNumber',
                label: 'Current Room',
                minWidth: 150,
                render: (reservation) => reservation.roomId ? reservation.roomNumber : 'Unassigned'
              },
              {
                key: 'requestedRoomType',
                label: 'Requested Type',
                minWidth: 150,
                render: (reservation) => reservation.requestedRoomType || '—'
              },
              {
                key: 'action',
                label: 'Action',
                minWidth: 220,
                render: (reservation) => (
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      onClick={() =>
                        void reservationOpsService
                          .setQRoom(reservation.id, {
                            priority: 1,
                            preStayCharging: true,
                            releaseRoom: !reservation.roomId
                          })
                          .then(() => load())
                      }
                    >
                      Queue
                    </Button>
                    {!reservation.roomId && (
                      <Button size="small" onClick={() => setSelectedReservation(reservation)}>
                        Assign
                      </Button>
                    )}
                  </Stack>
                )
              }
            ]}
          />
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
            Q-Room Queue
          </Typography>
          <DataTable
            rows={queue}
            rowKey={(reservation) => reservation.id}
            defaultRowsPerPage={10}
            emptyText="Q-room queue is empty."
            columns={[
              { key: 'guestName', label: 'Guest', minWidth: 180 },
              {
                key: 'requestedRoomType',
                label: 'Requested Type',
                minWidth: 150,
                render: (reservation) => reservation.requestedRoomType || '—'
              },
              {
                key: 'priority',
                label: 'Priority',
                minWidth: 120,
                render: (reservation) => reservation.priority
              },
              {
                key: 'createdAt',
                label: 'Queued',
                minWidth: 180,
                render: (reservation) => new Date(reservation.createdAt).toLocaleString()
              },
              {
                key: 'preStayCharging',
                label: 'Pre-Stay',
                minWidth: 120,
                render: (reservation) => (reservation.preStayCharging ? 'Enabled' : 'Off')
              },
              {
                key: 'action',
                label: 'Action',
                minWidth: 220,
                render: (reservation) => (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => setSelectedReservation(reservation)}>
                      Assign Room
                    </Button>
                    <Button
                      size="small"
                      color="success"
                      disabled={!reservation.roomId}
                      onClick={() => void reservationOpsService.checkIn(reservation.id).then(() => load())}
                    >
                      Check In
                    </Button>
                  </Stack>
                )
              }
            ]}
          />
        </Paper>

        <RoomAssignmentDialog
          open={Boolean(selectedReservation)}
          reservation={selectedReservation}
          title="Assign Q-Room Reservation"
          onClose={() => setSelectedReservation(null)}
          onAssign={async (roomId) => {
            if (!selectedReservation) return;
            if (selectedReservation.isQRoom) {
              await reservationOpsService.assignFromQRoom(selectedReservation.id, roomId);
            } else {
              await reservationOpsService.assignRoom(selectedReservation.id, roomId);
            }
            await load();
          }}
        />
      </Container>
    </Layout>
  );
};

export const StayViewPage = () => {
  const { on } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(todayDate());
  const [days, setDays] = useState(7);
  const [stayView, setStayView] = useState<StayViewPayload | null>(null);
  const [dragReservation, setDragReservation] = useState<ReservationRecord | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setStayView(await reservationOpsService.listStayView(startDate, days));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stay view');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, days]);

  useEffect(() => {
    const unsubscribers = [
      on('hotel.stay_view.updated', () => void load()),
      on('hotel.reservation.updated', () => void load()),
      on('hotel.reservation.created', () => void load()),
      on('hotel.reservation.checked_in', () => void load()),
      on('hotel.reservation.checked_out', () => void load()),
      on('hotel.room.updated', () => void load())
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, startDate, days]);

  const dates = useMemo(() => {
    const start = new Date(startDate);
    return Array.from({ length: days }).map((_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return date.toISOString().slice(0, 10);
    });
  }, [startDate, days]);

  const handleDrop = async (roomId: string) => {
    if (!dragReservation) {
      return;
    }

    if (dragReservation.isQRoom) {
      await reservationOpsService.assignFromQRoom(dragReservation.id, roomId);
    } else if (dragReservation.roomId) {
      await reservationOpsService.moveRoom(dragReservation.id, roomId);
    } else {
      await reservationOpsService.assignRoom(dragReservation.id, roomId);
    }

    setDragReservation(null);
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Stay View
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real occupancy board with unassigned bookings and drag-to-assign room moves.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} size="small" />
            <TextField
              select
              label="Days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              size="small"
              sx={{ minWidth: 120 }}
            >
              <MenuItem value={7}>7 Days</MenuItem>
              <MenuItem value={14}>14 Days</MenuItem>
              <MenuItem value={30}>30 Days</MenuItem>
            </TextField>
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {stayView && (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={2}>
                <StaySummaryCard label="Total Rooms" value={stayView.summary.totalRooms} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <StaySummaryCard label="Vacant" value={stayView.summary.vacant} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <StaySummaryCard label="Occupied" value={stayView.summary.occupied} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <StaySummaryCard label="Dirty" value={stayView.summary.dirty} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <StaySummaryCard label="Due Out" value={stayView.summary.dueOut} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <StaySummaryCard label="Blocked" value={stayView.summary.blocked} />
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Unassigned Bookings
                  </Typography>
                  <Stack spacing={1.25}>
                    {stayView.unassignedBookings.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No unassigned bookings for the selected window.
                      </Typography>
                    )}
                    {stayView.unassignedBookings.map((reservation) => (
                      <Paper
                        key={reservation.id}
                        variant="outlined"
                        draggable
                        onDragStart={() => setDragReservation(reservation)}
                        sx={{ p: 1.5, cursor: 'grab' }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>{reservation.guestName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {reservation.requestedRoomType || 'Open type'} · {new Date(reservation.checkIn).toLocaleDateString()}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Rate Lookup
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Room Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Base Rate</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Available</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stayView.rates.map((rate) => (
                        <TableRow key={rate.roomType}>
                          <TableCell>{rate.roomType}</TableCell>
                          <TableCell>₦{rate.baseRate.toLocaleString()}</TableCell>
                          <TableCell>{rate.availableRooms}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            </Grid>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Room Grid
              </Typography>
              <Grid container spacing={2}>
                {stayView.rooms.map((room) => (
                  <Grid item xs={12} sm={6} lg={4} xl={3} key={room.id}>
                    <Paper
                      variant="outlined"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => void handleDrop(room.id)}
                      sx={{
                        p: 2,
                        minHeight: 220,
                        borderColor:
                          room.status === 'AVAILABLE'
                            ? 'success.light'
                            : room.status === 'CLEANING'
                              ? 'warning.light'
                              : room.status === 'OCCUPIED'
                                ? 'info.light'
                                : room.status === 'MAINTENANCE'
                                  ? 'error.light'
                                  : 'divider'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {room.roomNumber}
                        </Typography>
                        <Chip size="small" label={room.status} color={room.status === 'MAINTENANCE' ? 'error' : room.status === 'CLEANING' ? 'warning' : room.status === 'OCCUPIED' ? 'info' : 'success'} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {room.roomType} · Floor {room.floor}
                      </Typography>
                      <Divider sx={{ mb: 1.5 }} />
                      <Stack spacing={1}>
                        {room.reservations.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            No reservations in this window.
                          </Typography>
                        )}
                        {room.reservations.map((reservation) => (
                          <Paper
                            key={reservation.id}
                            variant="outlined"
                            draggable
                            onDragStart={() => setDragReservation(reservation)}
                            sx={{ p: 1.25, cursor: 'grab' }}
                          >
                            <Typography sx={{ fontWeight: 700 }}>{reservation.guestName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(reservation.checkIn).toLocaleDateString()} - {new Date(reservation.checkOut).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dates[0]} to {dates[dates.length - 1]} · {reservation.status}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </>
        )}
      </Container>
    </Layout>
  );
};
