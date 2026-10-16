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
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { ThemeProvider } from '@mui/material/styles';
import PoweredBy from '../../components/branding/PoweredBy';
import { createAppTheme } from '../../theme/theme';
import {
  qrOrderingService,
  type PublicMenu,
  type PublicMenuItem,
  type PublicOrderResult,
  type PaymentPreference
} from '../../services/qrOrdering';
import { posItemImage } from '../../utils/posItemImage';

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
  const [roomNumber, setRoomNumber] = useState('');
  const [guestSurname, setGuestSurname] = useState('');
  const [notes, setNotes] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  /** Chosen from what the venue actually accepts (menu.paymentOptions). */
  const [payment, setPayment] = useState<PaymentPreference | ''>('');
  const [payEmail, setPayEmail] = useState('');
  const [paying, setPaying] = useState('');
  const [payError, setPayError] = useState('');

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
  // Numeric order (2 before 10), names after numbers.
  const tables = useMemo(
    () => [...(menu?.tables ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [menu]
  );
  const menuItemsById = useMemo(
    () => new Map((menu?.categories ?? []).flatMap((category) => category.items.map((item) => [item.id, item] as const))),
    [menu]
  );
  // The business's colours on its own menu.
  const brandColors = menu?.business.colors;
  const brandTheme = useMemo(
    () => createAppTheme('light', { primary: brandColors?.primary ?? null, accent: brandColors?.accent ?? null }),
    [brandColors?.primary, brandColors?.accent]
  );
  const promoItems = useMemo(
    () => (menu?.promotions ?? []).flatMap((promo) => promo.items).filter((entry) => menuItemsById.has(entry.menuItemId)),
    [menu, menuItemsById]
  );
  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
    [lines]
  );

  const onlineOptions = menu?.paymentOptions?.online ?? [];
  const manualOptions = menu?.paymentOptions?.manual ?? ['CARD', 'TRANSFER'];
  // Default: online if the venue has a gateway, else the first in-person method.
  const effectivePayment: PaymentPreference = payment || (onlineOptions.length > 0 ? 'ONLINE' : manualOptions[0]);

  const canSubmit =
    customerName.trim().length > 0
    && lines.length > 0
    && !submitting
    && (effectivePayment !== 'ROOM' || (roomNumber.trim().length > 0 && guestSurname.trim().length > 0));

  const payOnline = async (provider: string) => {
    if (!confirmation) return;
    setPaying(provider);
    setPayError('');
    try {
      const { authorizationUrl } = await qrOrderingService.startOnlinePayment(confirmation.orderId, provider, payEmail.trim() || undefined);
      window.location.href = authorizationUrl;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Online payment could not be started');
      setPaying('');
    }
  };

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
        roomNumber: roomNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentPreference: effectivePayment,
        ...(effectivePayment === 'ROOM' ? { guestSurname: guestSurname.trim() } : {}),
        promotionCode: promotionCode.trim() || undefined,
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
            {(confirmation.discount ?? 0) > 0 && (
              <Row label={`Promotion${(confirmation.promotions?.length ?? 0) > 1 ? 's' : ''} (${(confirmation.promotions ?? []).map((p) => p.name).join(', ')})`} value={`− ${formatMoney(confirmation.discount ?? 0)}`} />
            )}
            <Row label="Total" value={formatMoney(confirmation.total)} />
            <Row label="Estimated time" value={`About ${confirmation.estimatedMinutes} minutes`} />
          </Stack>

          {effectivePayment === 'ONLINE' && onlineOptions.length > 0 ? (
            <Stack spacing={1.5} sx={{ mt: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" fontWeight={700}>Pay now</Typography>
              <TextField size="small" label="Email for your receipt" value={payEmail} onChange={(event) => setPayEmail(event.target.value)} type="email" />
              {payError && <Alert severity="error">{payError}</Alert>}
              {onlineOptions.map((option) => (
                <Button
                  key={option.provider}
                  fullWidth
                  variant="contained"
                  onClick={() => void payOnline(option.provider)}
                  disabled={Boolean(paying)}
                  startIcon={paying === option.provider ? <CircularProgress size={18} color="inherit" /> : undefined}
                >
                  Pay with {option.provider.charAt(0) + option.provider.slice(1).toLowerCase()}{option.testMode ? ' (test mode)' : ''}
                </Button>
              ))}
              <Typography variant="caption" color="text.secondary">Or pay a staff member by {manualOptions.map((method) => method.toLowerCase()).join(', ')} when you are served.</Typography>
            </Stack>
          ) : (
            <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
              {effectivePayment === 'ROOM'
                ? 'This order has been added to your room bill. You can settle it when you check out.'
                : `Pay by ${effectivePayment.toLowerCase()} when your order is served. A staff member will come to you.`}
            </Alert>
          )}

          <Button fullWidth variant="outlined" sx={{ mt: 3 }} onClick={() => setConfirmation(null)}>
            Place another order
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={brandTheme}>
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 12 }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          {/* The business's own logo and name lead; HotelOpX is the footer credit. */}
          {menu.business.logoUrl ? (
            <Box component="img" src={menu.business.logoUrl} alt="" sx={{ height: 36, maxWidth: 120, objectFit: 'contain' }} />
          ) : null}
          <Typography variant="h6" fontWeight={800} noWrap>
            {menu.business.name}
          </Typography>

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

        {promoItems.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LocalOfferIcon color="secondary" />
              <Typography variant="subtitle1" fontWeight={800}>On promotion</Typography>
            </Stack>
            <Stack spacing={1}>
              {(menu.promotions ?? []).map((promo) => (
                <Paper key={promo.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: 'secondary.main' }}>
                  <Typography variant="body2" fontWeight={700}>{promo.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {[promo.description, promo.startTime && promo.endTime ? `${promo.startTime}–${promo.endTime}` : null, promo.autoApply ? 'Applied automatically' : `Use code ${promo.code}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {promo.items.filter((entry) => menuItemsById.has(entry.menuItemId)).slice(0, 8).map((entry) => (
                      <Stack key={entry.menuItemId} direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>{entry.name}</Typography>
                          <Typography variant="caption">
                            {entry.promotionalPrice < entry.price && (
                              <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.disabled', mr: 0.75 }}>{formatMoney(entry.price)}</Box>
                            )}
                            <strong>{formatMoney(entry.promotionalPrice)}</strong>
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined" onClick={() => {
                          addToCart(menuItemsById.get(entry.menuItemId)!);
                          if (!promo.autoApply && !promotionCode) setPromotionCode(promo.code);
                        }}>
                          Add
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

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
                      {/*
                        A picture for every item, uploaded or drawn.
                        This is the surface where the image does the most work:
                        a guest choosing from their phone buys with their eyes,
                        and a list of plain text reads as an unfinished menu.
                      */}
                      <Box
                        component="img"
                        src={posItemImage(item.imageUrl, category.name)}
                        alt=""
                        loading="lazy"
                        sx={{
                          width: 72,
                          height: 72,
                          flexShrink: 0,
                          borderRadius: 2,
                          objectFit: 'cover',
                          bgcolor: 'action.hover'
                        }}
                      />
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
        <PoweredBy sx={{ mt: 2 }} />
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
                {/* Both optional: they only help staff find you. */}
                <Stack direction="row" spacing={1.5}>
                  {tables.length > 0 ? (
                    <TextField
                      select
                      label="Table (optional)"
                      value={tableNumber}
                      onChange={(event) => setTableNumber(event.target.value)}
                      fullWidth
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">Choose your table</option>
                      {tables.map((table) => (
                        <option key={table} value={table}>Table {table}</option>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      label="Table number (optional)"
                      value={tableNumber}
                      onChange={(event) => setTableNumber(event.target.value)}
                      fullWidth
                    />
                  )}
                  <TextField
                    label={effectivePayment === 'ROOM' ? 'Room number' : 'Room number (optional)'}
                    value={roomNumber}
                    onChange={(event) => setRoomNumber(event.target.value)}
                    fullWidth
                  />
                </Stack>
                <TextField
                  select
                  label="How will you pay?"
                  value={effectivePayment}
                  onChange={(event) => setPayment(event.target.value as PaymentPreference)}
                  fullWidth
                  SelectProps={{ native: true }}
                >
                  {onlineOptions.length > 0 && (
                    <option value="ONLINE">
                      Pay online now ({onlineOptions.map((option) => option.provider.charAt(0) + option.provider.slice(1).toLowerCase()).join(' or ')})
                    </option>
                  )}
                  {manualOptions.map((method) => (
                    <option key={method} value={method}>
                      {method === 'CARD' ? 'Card, when served' : method === 'TRANSFER' ? 'Bank transfer, when served' : method === 'ROOM' ? 'Charge to my room (hotel guests)' : 'Cash, when served'}
                    </option>
                  ))}
                </TextField>
                {effectivePayment === 'ROOM' && (
                  <Stack spacing={1}>
                    <Alert severity="info" sx={{ py: 0 }}>Enter your room number above and the surname on your booking; the order goes on your room bill.</Alert>
                    <TextField label="Surname on your booking" value={guestSurname} onChange={(event) => setGuestSurname(event.target.value)} fullWidth required />
                  </Stack>
                )}
                <TextField
                  label="Promo code (optional)"
                  value={promotionCode}
                  onChange={(event) => setPromotionCode(event.target.value.toUpperCase().slice(0, 40))}
                  fullWidth
                  helperText="Promotions that apply automatically are added for you."
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
    </ThemeProvider>
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
