import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRounded from '@mui/icons-material/AddRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import { formatNaira, posFlow, type MenuItem as PosMenuItem, type Outlet, type PosTable } from '../../services/posFlow';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Ringing up an order from the menu.
 *
 * Orders used to be one free-typed "Manual POS Item" with a hand-entered
 * total. Once the server started pricing every line from the menu (so nobody
 * can set their own price), that line named no menu item and every order an
 * attendant created was refused. This builds the order from real menu items,
 * outlet by outlet — Mini-Market, Kitchen, Bar, whatever the menu
 * configuration defines — and shows an estimate; the server sets the price.
 */

type CartLine = { item: PosMenuItem; quantity: number; notes: string };

export function NewOrderDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (orderNumber: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState('');
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    posFlow
      .outlets()
      .then((rows) => {
        setOutlets(rows);
        setOutletId((current) => current || rows[0]?.id || '');
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load outlets')));
  }, [open]);

  useEffect(() => {
    if (!open || !outletId) return;
    setLoadingMenu(true);
    setCategory('ALL');
    // A cart belongs to one outlet: its lines are routed to that outlet's
    // stations and its sale counts for that outlet.
    setCart([]);
    Promise.all([posFlow.menu(outletId), posFlow.tables(outletId).catch(() => [])])
      .then(([items, tableRows]) => {
        setMenu(items);
        setTables(tableRows);
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load the menu')))
      .finally(() => setLoadingMenu(false));
  }, [open, outletId]);

  const categories = useMemo(
    () => ['ALL', ...new Set(menu.map((item) => item.category || 'Other'))],
    [menu]
  );
  const visible = menu.filter(
    (item) =>
      (category === 'ALL' || (item.category || 'Other') === category)
      && (!search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const add = (item: PosMenuItem) =>
    setCart((lines) => {
      const existing = lines.find((line) => line.item.id === item.id);
      return existing
        ? lines.map((line) => (line.item.id === item.id ? { ...line, quantity: Math.min(line.quantity + 1, 99) } : line))
        : [...lines, { item, quantity: 1, notes: '' }];
    });
  const change = (itemId: string, delta: number) =>
    setCart((lines) =>
      lines
        .map((line) => (line.item.id === itemId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );

  const estimate = cart.reduce(
    (sum, line) => sum + line.item.price * line.quantity * (1 + (line.item.taxRate || 0) / 100),
    0
  );

  const reset = () => {
    setCart([]);
    setTableNumber('');
    setBookingId('');
    setOrderType('DINE_IN');
    setSearch('');
  };

  const submit = async () => {
    if (cart.length === 0) {
      setError('Add at least one item.');
      return;
    }
    if (orderType === 'ROOM_SERVICE' && !bookingId.trim()) {
      setError('Room service needs the reservation it is charged to.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const order = await posFlow.createOrder({
        outletId,
        orderType,
        tableNumber: tableNumber || undefined,
        bookingId: orderType === 'ROOM_SERVICE' ? bookingId.trim() : undefined,
        items: cart.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity, notes: line.notes || undefined }))
      });
      reset();
      onCreated(order.orderNumber);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the order'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="lg" fullScreen={fullScreen}>
      <DialogTitle>New order</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {/* Sub-outlets, as configured in Menu Configuration. */}
        <Tabs
          value={outletId || false}
          onChange={(_event, value) => setOutletId(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {outlets.map((outlet) => (
            <Tab key={outlet.id} value={outlet.id} label={outlet.name} sx={{ textTransform: 'none', fontWeight: 700 }} />
          ))}
        </Tabs>

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
              <TextField size="small" label="Search menu" value={search} onChange={(event) => setSearch(event.target.value)} fullWidth />
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              {categories.map((name) => (
                <Chip
                  key={name}
                  label={name === 'ALL' ? 'All' : name}
                  color={category === name ? 'primary' : 'default'}
                  onClick={() => setCategory(name)}
                />
              ))}
            </Stack>
            {loadingMenu ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : visible.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No available items in this outlet. Add them under Menu Configuration.
              </Typography>
            ) : (
              <Grid container spacing={1}>
                {visible.map((item) => (
                  <Grid item xs={6} sm={4} key={item.id}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardActionArea onClick={() => add(item)} sx={{ p: 1.25, height: '100%', alignItems: 'flex-start' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>{item.name}</Typography>
                        <Typography variant="body2" color="primary.main" fontWeight={700}>{formatNaira(item.price)}</Typography>
                        {item.kitchenStation && (
                          <Typography variant="caption" color="text.secondary">{item.kitchenStation}</Typography>
                        )}
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={1.5}>
              <TextField select size="small" label="Order type" value={orderType} onChange={(event) => setOrderType(event.target.value)}>
                <MenuItem value="DINE_IN">Dine in</MenuItem>
                <MenuItem value="TAKEAWAY">Takeaway</MenuItem>
                <MenuItem value="DELIVERY">Delivery</MenuItem>
                <MenuItem value="ROOM_SERVICE">Room service (charge to room)</MenuItem>
                <MenuItem value="NO_CHARGE">No charge</MenuItem>
              </TextField>
              {tables.length > 0 ? (
                <TextField select size="small" label="Table" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)}>
                  <MenuItem value="">No table</MenuItem>
                  {tables.map((table) => (
                    <MenuItem key={table.id} value={table.tableNumber}>Table {table.tableNumber} · seats {table.capacity}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField size="small" label="Table (optional)" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} />
              )}
              {orderType === 'ROOM_SERVICE' && (
                <TextField size="small" label="Reservation ID" value={bookingId} onChange={(event) => setBookingId(event.target.value)} helperText="The checked-in reservation to charge" />
              )}

              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Order ({cart.reduce((sum, line) => sum + line.quantity, 0)} items)</Typography>
              {cart.length === 0 && <Typography variant="body2" color="text.secondary">Tap menu items to add them.</Typography>}
              {cart.map((line) => (
                <Box key={line.item.id}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{line.item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatNaira(line.item.price * line.quantity)}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => change(line.item.id, -1)} aria-label={`Remove one ${line.item.name}`}><RemoveRounded fontSize="small" /></IconButton>
                    <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{line.quantity}</Typography>
                    <IconButton size="small" onClick={() => change(line.item.id, 1)} aria-label={`Add one ${line.item.name}`}><AddRounded fontSize="small" /></IconButton>
                  </Stack>
                  <TextField
                    size="small"
                    variant="standard"
                    placeholder="Note for the kitchen"
                    value={line.notes}
                    onChange={(event) =>
                      setCart((lines) => lines.map((entry) => (entry.item.id === line.item.id ? { ...entry, notes: event.target.value } : entry)))
                    }
                    fullWidth
                  />
                </Box>
              ))}
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>Estimated total</Typography>
                <Typography fontWeight={800}>{formatNaira(estimate)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Priced from the menu by the server; service charge is added if enabled.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving || cart.length === 0}>
          {saving ? 'Creating…' : 'Create order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
