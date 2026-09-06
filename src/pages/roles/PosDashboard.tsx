import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import PointOfSaleRounded from '@mui/icons-material/PointOfSaleRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import TableRestaurantRounded from '@mui/icons-material/TableRestaurantRounded';
import SoupKitchenRounded from '@mui/icons-material/SoupKitchenRounded';
import AddShoppingCartRounded from '@mui/icons-material/AddShoppingCartRounded';
import LocalOfferRounded from '@mui/icons-material/LocalOfferRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import {
  DashboardShell,
  MetricCard,
  MetricGrid,
  QuickActions,
  SectionBlock,
  ShiftStatusBar
} from '../../components/dashboard';
import type { QuickAction } from '../../components/dashboard';
import { PosOrder, posService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * The till operator's landing screen.
 *
 * POS staff previously signed in to the shift page and had to navigate to
 * orders from the sidebar. What they need first is the state of the floor:
 * which orders are still open, what has gone to the kitchen, and what has been
 * taken so far this shift.
 *
 * POS staff are not authorised for the hotel-wide /dashboard payload, so every
 * figure here is derived from the orders they can actually see rather than
 * fetched from an endpoint that would refuse them.
 */
const PosDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isDark = theme.palette.mode === 'dark';

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await posService.getOrders());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orders.filter((order) => new Date(order.createdAt) >= start);
  }, [orders]);

  const open = orders.filter((o) => o.orderStatus === 'OPEN');
  const inKitchen = orders.filter((o) => o.orderStatus === 'SENT_TO_KITCHEN');
  const completedToday = today.filter((o) => o.orderStatus === 'COMPLETED');
  // Voided orders are excluded: takings means money actually taken.
  const takings = completedToday.reduce((sum, o) => sum + (o.total || 0), 0);

  const firstName = user?.firstName?.trim() || 'there';

  const actions: QuickAction[] = [
    {
      label: 'New order',
      hint: 'Start a sale',
      icon: AddShoppingCartRounded,
      primary: true,
      onClick: () => navigate('/business/pos/orders')
    },
    {
      label: 'Tables',
      hint: 'Floor plan',
      icon: TableRestaurantRounded,
      onClick: () => navigate('/business/pos/tables')
    },
    {
      label: 'Kitchen display',
      hint: 'What is cooking',
      icon: SoupKitchenRounded,
      onClick: () => navigate('/business/pos/kds')
    },
    {
      label: 'Order history',
      hint: 'Today’s receipts',
      icon: ReceiptLongRounded,
      onClick: () => navigate('/business/pos/orders')
    },
    {
      label: 'Promotions',
      hint: 'Active offers',
      icon: LocalOfferRounded,
      onClick: () => navigate('/business/promotions')
    }
  ];

  return (
    <DashboardShell
      eyebrow="Point of sale"
      title={`Your floor, ${firstName}.`}
      subtitle="Open orders, the kitchen queue and what you have taken so far."
      actions={
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshRounded />}
          onClick={() => void load()}
          disabled={loading}
          sx={{ minHeight: 38 }}
        >
          Refresh
        </Button>
      }
    >
      <ShiftStatusBar />

      {error ? (
        <Alert severity="warning" action={<Button size="small" onClick={() => void load()}>Retry</Button>}>
          {error}
        </Alert>
      ) : null}

      <SectionBlock title="Right now" description="Across the outlets you serve.">
        <MetricGrid>
          <MetricCard
            label="Open orders"
            value={open.length}
            caption="Not yet settled"
            icon={PointOfSaleRounded}
            loading={loading}
            tone={open.length > 0 ? 'attention' : 'neutral'}
            onClick={() => navigate('/business/pos/orders')}
          />
          <MetricCard
            label="In the kitchen"
            value={inKitchen.length}
            caption="Sent, awaiting service"
            icon={SoupKitchenRounded}
            loading={loading}
            onClick={() => navigate('/business/pos/kds')}
          />
          <MetricCard
            label="Completed today"
            value={completedToday.length}
            caption="Orders closed"
            icon={ReceiptLongRounded}
            loading={loading}
            tone={completedToday.length > 0 ? 'good' : 'neutral'}
          />
          <MetricCard
            label="Taken today"
            value={formatCurrency(takings)}
            caption="Completed orders only"
            icon={PointOfSaleRounded}
            loading={loading}
          />
        </MetricGrid>
      </SectionBlock>

      <SectionBlock title="Quick actions" description="The things a till does most.">
        <QuickActions actions={actions} />
      </SectionBlock>

      <SectionBlock
        title="Open orders"
        description="Settle these before closing your shift."
        action={
          <Button size="small" onClick={() => navigate('/business/pos/orders')}>
            All orders
          </Button>
        }
      >
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          {open.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                {loading ? 'Loading orders…' : 'Nothing open'}
              </Typography>
              {!loading ? (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                  Every order has been settled. Start a new one when the next guest orders.
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {open.slice(0, 8).map((order) => (
                <Stack
                  key={order.id}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ px: 2.25, py: 1.6 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        sx={{
                          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                          fontSize: 13,
                          fontWeight: 600
                        }}
                      >
                        {order.orderNumber}
                      </Typography>
                      <Chip
                        size="small"
                        label={order.orderType.replace(/_/g, ' ').toLowerCase()}
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          textTransform: 'capitalize',
                          background: alpha(theme.palette.text.primary, isDark ? 0.12 : 0.06)
                        }}
                      />
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }} noWrap>
                      {[
                        order.tableNumber ? `Table ${order.tableNumber}` : null,
                        order.outlet?.name
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No table assigned'}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 15,
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    {formatCurrency(order.total || 0)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </SectionBlock>
    </DashboardShell>
  );
};

export default PosDashboard;
