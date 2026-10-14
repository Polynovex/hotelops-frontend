import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import { reservationOpsService, roomOpsService, type ReservationRecord, type RoomTypeRecord } from '../../services/operations';
import { promotionsApi, type ApplicableRoomPromotion } from '../../services/promotions';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Edit and Void for a reservation, shared by the list and the detail page.
 * Edits are re-priced by the server from the room rate and the promotions
 * chosen here; nothing typed in the browser sets the total.
 */

const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const naira = (value: number) => `₦${Math.round(value).toLocaleString()}`;

/** Room promotions for a stay, shown like amenities, plus the Quick Promotions picker. */
export const RoomPromotionsPicker: React.FC<{
  promotions: ApplicableRoomPromotion[];
  picked: string[];
  onChange: (ids: string[]) => void;
}> = ({ promotions, picked, onChange }) => {
  const selectable = promotions.filter((promo) => promo.eligible && !promo.autoApply);
  return (
    <Stack spacing={1.5}>
      {promotions.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
          <LocalOfferRoundedIcon fontSize="small" color="secondary" />
          {promotions.map((promo) => (
            <Tooltip key={promo.id} title={promo.eligible ? `${promo.description ?? promo.name} — saves ${naira(promo.discount)}` : promo.reasons.join('; ')}>
              <span>
                <Chip
                  size="small"
                  color={promo.eligible ? 'secondary' : 'default'}
                  variant={promo.eligible && (promo.autoApply || picked.includes(promo.id)) ? 'filled' : 'outlined'}
                  label={`${promo.name}${promo.autoApply ? ' (auto)' : ''}`}
                  disabled={!promo.eligible}
                />
              </span>
            </Tooltip>
          ))}
        </Stack>
      )}
      <TextField
        select
        label="Quick promotions"
        value={picked}
        onChange={(event) => onChange(typeof event.target.value === 'string' ? event.target.value.split(',') : (event.target.value as unknown as string[]))}
        SelectProps={{ multiple: true, renderValue: (ids) => promotions.filter((p) => (ids as string[]).includes(p.id)).map((p) => p.name).join(', ') }}
        helperText={selectable.length ? 'Promotions set up on the Promotions page' : 'No promotions available for this room and dates'}
        disabled={!selectable.length}
        fullWidth
      >
        {selectable.map((promo) => (
          <MenuItem key={promo.id} value={promo.id}>
            {promo.name} — saves {naira(promo.discount)}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
};

/** Loads the promotions that apply to a stay; refreshes as the stay changes. */
export const useRoomPromotions = (params: { roomTypeCode?: string | null; roomId?: string | null; guestId?: string | null; checkIn: string; checkOut: string }) => {
  const [promotions, setPromotions] = useState<ApplicableRoomPromotion[]>([]);
  const [gross, setGross] = useState(0);
  useEffect(() => {
    if (!params.roomTypeCode || !params.checkIn || !params.checkOut || params.checkOut <= params.checkIn) {
      setPromotions([]);
      return;
    }
    let cancelled = false;
    promotionsApi
      .applicableRoom({
        roomTypeCode: params.roomTypeCode,
        arrival: new Date(`${params.checkIn}T14:00:00`).toISOString(),
        departure: new Date(`${params.checkOut}T12:00:00`).toISOString(),
        ...(params.roomId ? { roomId: params.roomId } : {}),
        ...(params.guestId ? { guestId: params.guestId } : {})
      })
      .then((data) => {
        if (cancelled) return;
        setPromotions(data.promotions);
        setGross(data.gross);
      })
      .catch(() => !cancelled && setPromotions([]));
    return () => {
      cancelled = true;
    };
  }, [params.roomTypeCode, params.roomId, params.guestId, params.checkIn, params.checkOut]);
  return { promotions, gross };
};

/** The total the server will compute: best single promotion, or all stackable ones together. */
export const estimateTotal = (gross: number, promotions: ApplicableRoomPromotion[], picked: string[]) => {
  const applied = promotions.filter((p) => p.eligible && (p.autoApply || picked.includes(p.id)));
  const stacked = applied.filter((p) => p.stackable).reduce((sum, p) => sum + p.discount, 0);
  const best = applied.reduce((max, p) => Math.max(max, p.discount), 0);
  const discount = Math.min(Math.max(stacked, best), gross);
  return { discount, total: gross - discount };
};

export const EditReservationDialog: React.FC<{
  reservation: ReservationRecord | null;
  onClose: () => void;
  onSaved: (updated: ReservationRecord) => void;
}> = ({ reservation, onClose, onSaved }) => {
  const [roomTypes, setRoomTypes] = useState<RoomTypeRecord[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [roomType, setRoomType] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reservation) return;
    setCheckIn(day(reservation.checkIn));
    setCheckOut(day(reservation.checkOut));
    setAdults(reservation.adults || 1);
    setChildren(reservation.children || 0);
    setRoomType(reservation.requestedRoomType || '');
    setPicked([]);
    setError('');
    roomOpsService.listRoomTypes().then(setRoomTypes).catch(() => setRoomTypes([]));
  }, [reservation]);

  const checkedIn = reservation?.status === 'CHECKED_IN';
  // A checked-in guest keeps their room; only the stay dates and party change.
  const roomId = reservation?.roomId ?? null;
  const { promotions, gross } = useRoomPromotions({ roomTypeCode: roomType, roomId, guestId: reservation?.guestId, checkIn, checkOut });
  const estimate = useMemo(() => estimateTotal(gross, promotions, picked), [gross, promotions, picked]);

  const save = async () => {
    if (!reservation) return;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await reservationOpsService.updateReservation(reservation.id, {
        arrivalDate: checkIn,
        departureDate: checkOut,
        adults,
        children,
        ...(!checkedIn && roomType && roomType !== reservation.requestedRoomType ? { requestedRoomType: roomType, roomId: null } : {}),
        ...(picked.length ? { promotionIds: picked } : {})
      });
      onSaved(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the reservation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(reservation)} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Edit reservation {reservation?.bookingNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField label="Check in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth disabled={checkedIn} />
            <TextField label="Check out" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Adults" type="number" value={adults} onChange={(e) => setAdults(Math.max(Number(e.target.value), 1))} fullWidth />
            <TextField label="Children" type="number" value={children} onChange={(e) => setChildren(Math.max(Number(e.target.value), 0))} fullWidth />
          </Stack>
          <TextField
            select
            label="Room type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            disabled={checkedIn}
            helperText={checkedIn ? 'Move rooms from the reservation page while the guest is in house.' : 'Changing the type releases the assigned room.'}
            fullWidth
          >
            {roomTypes.map((type) => (
              <MenuItem key={type.id} value={type.code}>{type.name}</MenuItem>
            ))}
          </TextField>
          <RoomPromotionsPicker promotions={promotions} picked={picked} onChange={setPicked} />
          {gross > 0 && (
            <Typography variant="body2">
              New total: <strong>{naira(estimate.total)}</strong>
              {estimate.discount > 0 && <Typography component="span" variant="body2" color="text.secondary"> ({naira(gross)} less {naira(estimate.discount)} promotion)</Typography>}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export const VoidReservationDialog: React.FC<{
  reservation: ReservationRecord | null;
  onClose: () => void;
  onVoided: () => void;
}> = ({ reservation, onClose, onVoided }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setReason('');
    setError('');
  }, [reservation]);

  const confirm = async () => {
    if (!reservation) return;
    setSaving(true);
    try {
      await reservationOpsService.voidReservation(reservation.id, reason.trim());
      onVoided();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not void the reservation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(reservation)} onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Void reservation {reservation?.bookingNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">
            {reservation?.guestName}'s booking will be cancelled and its room released. This cannot be undone.
          </Typography>
          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} autoFocus fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Keep</Button>
        <Button color="error" variant="contained" onClick={() => void confirm()} disabled={saving || reason.trim().length < 3}>
          {saving ? 'Voiding…' : 'Void reservation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
