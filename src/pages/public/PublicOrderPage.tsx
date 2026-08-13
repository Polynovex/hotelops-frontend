import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
  qrOrderingService,
  type PublicMenu,
  type PublicMenuItem,
  type PublicOrderResult
} from '../../services/qrOrdering';

type CartLine = { item: PublicMenuItem; quantity: number };

/**
 * Customer-facing ordering page reached by scanning a QR code. Renders without
 * authentication and is laid out mobile-first, since essentially every visitor
 * arrives from a phone camera.
 */
const PublicOrderPage = () => {
  const { code = '' } = useParams<{ code: string }>();

  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmation, setConfirmation] = useState<PublicOrderResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await qrOrderingService.getPublicMenu(code);
        if (!cancelled) {
          setMenu(data);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'This menu is unavailable');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const currency = menu?.business.currency || 'NGN';

  const formatMoney = useCallback(
    (value: number) =>
      new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(value),
    [currency]
  );

  const addToCart = (item: PublicMenuItem) => {
    setCart((current) => {
      const existing = current[item.id];
      return {
        ...current,
        [item.id]: { item, quantity: Math.min((existing?.quantity ?? 0) + 1, 99) }
      };
    });
  };

  const decrement = (itemId: string) => {
    setCart((current) => {
      const existing = current[itemId];
      if (!existing) {
        return current;
      }

      if (existing.quantity <= 1) {
        const { [itemId]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [itemId]: { ...existing, quantity: existing.quantity - 1 } };
    });
  };

  const lines = useMemo(() => Object.values(cart), [cart]);
  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
    [lines]
  );

  const canSubmit = customerName.trim().length > 0 && lines.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await qrOrderingService.placePublicOrder(code, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity }))
      });

      setConfirmation(result);
      setCart({});
      setCartOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place your order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading menu…</Typography>
        </Stack>
      </Box>
    );
  }

  if (loadError || !menu) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 420, textAlign: 'center', borderRadius: 3 }}>
          <StorefrontIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Menu unavailable
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {loadError || 'This ordering code is no longer active. Please ask a staff member.'}
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (confirmation) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 460, textAlign: 'center', borderRadius: 3 }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 1 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Order received
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The kitchen has been notified. Please keep this reference.
          </Typography>

          <Stack spacing={1.5} sx={{ textAlign: 'left' }}>
            <Row label="Order number" value={confirmation.orderNumber} mono />
            <Row label="Total" value={formatMoney(confirmation.total)} />
            <Row label="Estimated time" value={`About ${confirmation.estimatedMinutes} minutes`} />
          </Stack>

          <Button fullWidth variant="outlined" sx={{ mt: 3 }} onClick={() => setConfirmation(null)}>
            Place another order
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 12 }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          {menu.business.logoUrl ? (
            <Box
              component="img"
              src={menu.business.logoUrl}
              alt={menu.business.name}
              sx={{ height: 40, maxWidth: 160, objectFit: 'contain' }}
            />
          ) : (
            <Typography variant="h6" fontWeight={700} noWrap>
              {menu.business.name}
            </Typography>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <IconButton onClick={() => setCartOpen(true)} aria-label={`Open cart, ${itemCount} items`}>
            <Badge badgeContent={itemCount} color="primary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {menu.outlet.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Browse the menu and add items to your order.
        </Typography>

        {menu.categories.length === 0 && (
          <Alert severity="info">No items are available right now. Please check back shortly.</Alert>
        )}

        {menu.categories.map((category) => (
          <Box key={category.id} sx={{ mb: 4 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              {category.name}
            </Typography>

            <Stack spacing={1.5}>
              {category.items.map((item) => {
                const quantity = cart[item.id]?.quantity ?? 0;

                return (
                  <Paper key={item.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={600}>
                          {item.name}
                        </Typography>
                        {item.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {item.description}
                          </Typography>
                        )}
                        <Typography variant="body2" fontWeight={700}>
                          {formatMoney(item.price)}
                        </Typography>
                      </Box>

                      {quantity === 0 ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => addToCart(item)}
                          aria-label={`Add ${item.name} to order`}
                        >
                          Add
                        </Button>
                      ) : (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => decrement(item.id)}
                            aria-label={`Remove one ${item.name}`}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography sx={{ minWidth: 20, textAlign: 'center' }} fontWeight={700}>
                            {quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => addToCart(item)}
                            aria-label={`Add one more ${item.name}`}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Container>

      {itemCount > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            borderRadius: 0,
            zIndex: (theme) => theme.zIndex.appBar
          }}
        >
          <Container maxWidth="sm" disableGutters>
            <Button fullWidth size="large" variant="contained" onClick={() => setCartOpen(true)}>
              View order · {itemCount} item{itemCount === 1 ? '' : 's'} · {formatMoney(subtotal)}
            </Button>
          </Container>
        </Paper>
      )}

      <Drawer
        anchor="bottom"
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90vh' } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Your order
          </Typography>

          {lines.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>
              Your cart is empty.
            </Typography>
          ) : (
            <>
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                {lines.map((line) => (
                  <Stack key={line.item.id} direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {line.item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatMoney(line.item.price)} each
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <IconButton size="small" onClick={() => decrement(line.item.id)} aria-label={`Remove one ${line.item.name}`}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{line.quantity}</Typography>
                      <IconButton size="small" onClick={() => addToCart(line.item)} aria-label={`Add one more ${line.item.name}`}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: 72, textAlign: 'right' }}>
                      {formatMoney(line.item.price * line.quantity)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Subtotal
                </Typography>
                <Typography variant="body1" fontWeight={700}>
                  {formatMoney(subtotal)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Tax and any service charge are added on the final bill.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={2}>
                <TextField
                  label="Your name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                  fullWidth
                  autoComplete="name"
                  error={submitting && !customerName.trim()}
                />
                <TextField
                  label="Phone (optional)"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  fullWidth
                  autoComplete="tel"
                  inputMode="tel"
                />
                <TextField
                  label="Table number (optional)"
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Notes for the kitchen (optional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Stack>

              {submitError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {submitError}
                </Alert>
              )}

              <Button
                fullWidth
                size="large"
                variant="contained"
                sx={{ mt: 3 }}
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {submitting ? 'Placing order…' : `Place order · ${formatMoney(subtotal)}`}
              </Button>
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center">
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={700} sx={mono ? { fontFamily: 'monospace' } : undefined}>
      {value}
    </Typography>
  </Stack>
);

export default PublicOrderPage;
