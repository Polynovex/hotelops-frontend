import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Divider, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import PointOfSaleRounded from '@mui/icons-material/PointOfSaleRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import BalanceRounded from '@mui/icons-material/BalanceRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
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
import { DashboardOverview, dashboardService } from '../../services/api';
import { financeService } from '../../services/finance.service';
import { formatCurrency } from '../../utils/formatters';
import { getApiErrorMessage } from '../../utils/apiError';

interface ExpenseSummary {
  total?: number;
  pending?: number;
  pendingCount?: number;
  approvedCount?: number;
}

/**
 * The accountant's landing screen.
 *
 * Accountants previously landed on the shift page. Their day starts with
 * yesterday's takings and today's exposure: revenue in, expenses out, and
 * anything waiting on a decision.
 *
 * Expense figures are loaded separately from the revenue overview because the
 * two endpoints have different permissions — an accountant who can read one
 * but not the other should still get a working screen, so a failure in either
 * degrades to a dash rather than blanking the page.
 */
const FinanceDashboard = () => {
  const navigate = useNavigate();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [overviewResult, expenseResult] = await Promise.allSettled([
      dashboardService.getOverview(),
      financeService.expenseSummary()
    ]);

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      setError(getApiErrorMessage(overviewResult.reason, 'Could not load revenue figures.'));
    }

    setExpenses(
      expenseResult.status === 'fulfilled' ? (expenseResult.value as ExpenseSummary) : null
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revenue = overview?.revenue;
  const pendingCount = expenses?.pendingCount ?? 0;

  const actions: QuickAction[] = [
    {
      label: 'Record expense',
      hint: 'Log a payment out',
      icon: ReceiptLongRounded,
      primary: true,
      onClick: () => navigate('/business/finance/expenses')
    },
    {
      label: 'Transactions',
      hint: 'Full ledger',
      icon: HistoryRounded,
      onClick: () => navigate('/business/finance/transactions')
    },
    {
      label: 'Trial balance',
      hint: 'Account balances',
      icon: BalanceRounded,
      onClick: () => navigate('/business/finance/trial-balance')
    },
    {
      label: 'Revenue report',
      hint: 'By day and source',
      icon: TrendingUpRounded,
      onClick: () => navigate('/business/finance/revenue')
    },
    {
      label: 'Night audit',
      hint: 'Close the day',
      icon: FactCheckRounded,
      onClick: () => navigate('/business/dashboard')
    }
  ];

  return (
    <DashboardShell
      eyebrow="Finance"
      title="The books, today."
      subtitle="Revenue in, money out, and anything waiting on your decision."
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

      <SectionBlock title="Money" description="Figures for the current business day and month to date.">
        <MetricGrid>
          <MetricCard
            label="Revenue today"
            value={revenue ? formatCurrency(revenue.today) : '—'}
            caption="Rooms and services"
            icon={TrendingUpRounded}
            loading={loading}
            tone={revenue && revenue.today > 0 ? 'good' : 'neutral'}
          />
          <MetricCard
            label="POS sales today"
            value={revenue ? formatCurrency(revenue.posSales) : '—'}
            caption="Food and beverage"
            icon={PointOfSaleRounded}
            loading={loading}
          />
          <MetricCard
            label="Month to date"
            value={revenue ? formatCurrency(revenue.month) : '—'}
            caption="All revenue this month"
            icon={AccountBalanceWalletRounded}
            loading={loading}
          />
          <MetricCard
            label="Awaiting approval"
            value={pendingCount}
            caption={
              expenses
                ? 'Expenses needing sign-off'
                : 'Expense summary unavailable for your role'
            }
            icon={FactCheckRounded}
            loading={loading}
            tone={pendingCount > 0 ? 'attention' : 'neutral'}
            onClick={() => navigate('/business/finance/expenses')}
          />
        </MetricGrid>
      </SectionBlock>

      <SectionBlock title="Quick actions" description="Daily finance tasks.">
        <QuickActions actions={actions} />
      </SectionBlock>

      <SectionBlock
        title="Occupancy context"
        description="Revenue is easier to read next to how full the property was."
      >
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack divider={<Divider flexItem />}>
            <ContextRow
              label="Occupancy"
              value={`${Math.round(overview?.widgets.occupancyRate ?? 0)}%`}
              hint={`${overview?.widgets.occupiedRooms ?? 0} of ${overview?.widgets.totalRooms ?? 0} rooms sold`}
            />
            <ContextRow
              label="Guests in house"
              value={String(overview?.widgets.inHouseGuests ?? 0)}
              hint="Driving food, beverage and incidental spend"
            />
            <ContextRow
              label="Arrivals today"
              value={String(overview?.widgets.arrivalsToday ?? 0)}
              hint="Expected to check in and post charges"
            />
          </Stack>
        </Card>
      </SectionBlock>
    </DashboardShell>
  );
};

const ContextRow = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <Stack
    direction="row"
    alignItems="center"
    justifyContent="space-between"
    spacing={2}
    sx={{ px: 2.25, py: 1.75 }}
  >
    <Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{hint}</Typography>
    </Box>
    <Typography
      sx={{
        fontFamily: '"Inter", system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 22,
        fontWeight: 700
      }}
    >
      {value}
    </Typography>
  </Stack>
);

export default FinanceDashboard;
