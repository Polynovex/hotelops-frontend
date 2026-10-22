import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import { roomOpsService, type RoomTypeRecord } from '../../../services/operations';
import { checkoutApi, type MinibarCount, type MinibarItem } from '../../../services/checkout';
import { usePermissionStore } from '../../../store/permissionStore';
import { useRoomTypeNames } from '../../../hooks/useRoomTypeNames';
import { formatCurrency } from '../../../utils/formatters';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Minibar: the items and prices (front desk), what each room holds when full
 * (per room or for a whole room type), and every count housekeeping made —
 * so the owner can see what was taken and charged.
 */
const MinibarPage: React.FC = () => {
  const can = usePermissionStore((state) => state.can);
  const canManage = can('MANAGE_MINIBAR');
  const roomTypeName = useRoomTypeNames();
  const [tab, setTab] = useState<'items' | 'rooms' | 'counts'>('items');
  const [items, setItems] = useState<MinibarItem[]>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; roomType: string }>>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRecord[]>([]);
  const [counts, setCounts] = useState<MinibarCount[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '' });
  const [target, setTarget] = useState<{ kind: 'room' | 'type'; id: string }>({ kind: 'type', id: '' });
  const [par, setPar] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [list, roomList, types, countList] = await Promise.all([
        checkoutApi.minibarItems(),
        roomOpsService.listRooms(),
        roomOpsService.listRoomTypes(),
        checkoutApi.minibarCounts()
      ]);
      setItems(list);
      setRooms([...roomList].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })));
      setRoomTypes(types.filter((t) => t.isActive));
      setCounts(countList);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the minibar'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Picking a single room loads what it holds now.
  useEffect(() => {
    if (target.kind !== 'room' || !target.id) {
      setPar({});
      return;
    }
    checkoutApi
      .roomMinibar(target.id)
      .then((mb) => setPar(Object.fromEntries(mb.items.map((i) => [i.itemId, String(i.parQuantity)]))))
      .catch(() => setPar({}));
  }, [target]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'That did not work'));
    }
  };

  const activeItems = items.filter((i) => i.isActive);
  const totals = useMemo(() => ({
    pending: counts.filter((c) => c.status === 'PENDING_REVIEW').reduce((s, c) => s + c.total, 0),
    charged: counts.filter((c) => c.status === 'CHARGED').reduce((s, c) => s + c.total, 0)
  }), [counts]);

  const saveStock = () => {
    const lines = activeItems.map((i) => ({ itemId: i.id, parQuantity: Number(par[i.id]) || 0 }));
    if (target.kind === 'type') {
      void act(async () => {
        const r = await checkoutApi.applyToRoomType(target.id, lines);
        setNotice(`Minibar set for ${r.rooms} room${r.rooms === 1 ? '' : 's'}.`);
      }, `Minibar set for every ${roomTypeName(target.id)} room.`);
    } else {
      void act(() => checkoutApi.setRoomMinibar(target.id, lines), 'Minibar saved for this room.');
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" fontWeight={800}>Minibar</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Items and prices, what each room holds, and what guests took. Housekeeping counts each minibar during the room inspection.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}><Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="body2" color="text.secondary">Waiting to charge</Typography><Typography variant="h6" fontWeight={800}>{formatCurrency(totals.pending)}</Typography></Paper></Grid>
          <Grid item xs={6} md={3}><Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="body2" color="text.secondary">Charged to guests</Typography><Typography variant="h6" fontWeight={800}>{formatCurrency(totals.charged)}</Typography></Paper></Grid>
        </Grid>

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="items" label="Items and prices" />
          <Tab value="rooms" label="Room stock" />
          <Tab value="counts" label="Counts" />
        </Tabs>

        {tab === 'items' && (
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            {canManage && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2 }}>
                <TextField size="small" label="Item" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                <TextField size="small" type="number" label="Price (₦)" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
                <Button variant="contained" disabled={newItem.name.trim().length < 2 || newItem.price === ''}
                  onClick={() => void act(async () => { await checkoutApi.createMinibarItem({ name: newItem.name.trim(), price: Number(newItem.price) }); setNewItem({ name: '', price: '' }); }, 'Item added.')}>Add item</Button>
              </Stack>
            )}
            <Table size="small">
              <TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Price</TableCell><TableCell>In use</TableCell></TableRow></TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={3} sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>No minibar items yet.</TableCell></TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right" sx={{ width: 160 }}>
                      {canManage ? (
                        <TextField size="small" type="number" defaultValue={item.price} inputProps={{ 'aria-label': `${item.name} price` }}
                          onBlur={(e) => Number(e.target.value) !== item.price && void act(() => checkoutApi.updateMinibarItem(item.id, { price: Number(e.target.value) }), `${item.name} price updated.`)} />
                      ) : formatCurrency(item.price)}
                    </TableCell>
                    <TableCell>
                      <Switch checked={item.isActive} disabled={!canManage} onChange={(e) => void act(() => checkoutApi.updateMinibarItem(item.id, { isActive: e.target.checked }), `${item.name} ${e.target.checked ? 'on' : 'off'}.`)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {tab === 'rooms' && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField select size="small" label="Set for" value={target.kind} onChange={(e) => setTarget({ kind: e.target.value as 'room' | 'type', id: '' })} sx={{ minWidth: 180 }}>
                <MenuItem value="type">Every room of a type</MenuItem>
                <MenuItem value="room">One room</MenuItem>
              </TextField>
              {target.kind === 'type' ? (
                <TextField select size="small" label="Room type" value={target.id} onChange={(e) => setTarget({ kind: 'type', id: e.target.value })} sx={{ minWidth: 240 }}>
                  {roomTypes.map((t) => <MenuItem key={t.code} value={t.code}>{t.name}</MenuItem>)}
                </TextField>
              ) : (
                <TextField select size="small" label="Room" value={target.id} onChange={(e) => setTarget({ kind: 'room', id: e.target.value })} sx={{ minWidth: 240 }}>
                  {rooms.map((r) => <MenuItem key={r.id} value={r.id}>Room {r.roomNumber} · {roomTypeName(r.roomType)}</MenuItem>)}
                </TextField>
              )}
            </Stack>
            {target.id ? (
              <>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Holds when full</TableCell></TableRow></TableHead>
                  <TableBody>
                    {activeItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                        <TableCell align="right" sx={{ width: 160 }}>
                          <TextField size="small" type="number" value={par[item.id] ?? ''} placeholder="0" disabled={!canManage} inputProps={{ min: 0, 'aria-label': `${item.name} quantity` }}
                            onChange={(e) => setPar({ ...par, [item.id]: e.target.value })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {canManage && <Button variant="contained" sx={{ mt: 2 }} onClick={saveStock}>Save</Button>}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Choose a room type or a room.</Typography>
            )}
          </Paper>
        )}

        {tab === 'counts' && (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>When</TableCell><TableCell>Room</TableCell><TableCell>Guest</TableCell><TableCell>Taken</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {counts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>No counts yet.</TableCell></TableRow>
                ) : counts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</TableCell>
                    <TableCell>{c.roomNumber}</TableCell>
                    <TableCell>{c.guestName || '—'}<Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>{c.bookingNumber ? ` · ${c.bookingNumber}` : ''}</Box></TableCell>
                    <TableCell>{c.lines.filter((l) => l.consumed > 0).map((l) => `${l.consumed}× ${l.name}`).join(', ') || 'Nothing'}</TableCell>
                    <TableCell align="right">{formatCurrency(c.total)}</TableCell>
                    <TableCell><Chip size="small" label={c.status === 'PENDING_REVIEW' ? 'To charge' : c.status === 'CHARGED' ? 'Charged' : 'No charge'} color={c.status === 'PENDING_REVIEW' ? 'warning' : c.status === 'CHARGED' ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      {c.status === 'PENDING_REVIEW' && c.bookingId && (
                        <Button size="small" onClick={() => void act(() => checkoutApi.decideMinibarCount(c.id, 'charge'), 'Added to the guest bill.')}>Charge</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default MinibarPage;
