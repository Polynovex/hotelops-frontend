import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Grid, Skeleton, Tooltip, Typography } from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import PaymentsIcon from '@mui/icons-material/Payments';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { MetricCard, SectionHeader } from './premium';
import { formatNaira, performanceService, type PerformanceResponse } from '../services/hr.service';

/**
 * Occupancy, ADR, and RevPAR — the three numbers hoteliers judge a property by.
 *
 * Each carries a tooltip with its definition, because ADR and RevPAR are
 * routinely confused and a wrong reading leads to wrong pricing decisions.
 */
const PerformanceMetrics = () => {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await performanceService.get());
      setError('');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      setError(response?.data?.message || response?.data?.error || 'Could not load performance metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  const c = data?.current;
  const ch = data?.change;

  const cards = [
    {
      label: 'Occupancy',
      value: loading ? '' : `${c?.occupancyRate ?? 0}%`,
      detail: loading ? '' : `${c?.roomNightsSold ?? 0} of ${c?.roomNightsAvailable ?? 0} room nights`,
      change: ch?.occupancyRate ?? null,
      icon: <HotelIcon />,
      variant: 'tinted' as const,
      help: 'Room nights sold divided by room nights available. Rooms out of order are excluded from availability.'
    },
    {
      label: 'ADR',
      value: loading ? '' : formatNaira(c?.adr ?? 0),
      detail: 'Average Daily Rate',
      change: ch?.adr ?? null,
      icon: <PaymentsIcon />,
      variant: 'navy' as const,
      help: 'Average Daily Rate — room revenue divided by room nights sold. Room revenue only; restaurant and bar sales are excluded.'
    },
    {
      label: 'RevPAR',
      value: loading ? '' : formatNaira(c?.revpar ?? 0),
      detail: 'Revenue per available room',
      change: ch?.revpar ?? null,
      icon: <ShowChartIcon />,
      variant: 'navy' as const,
      help: 'Revenue Per Available Room — room revenue divided by every room night available, sold or not. Equals ADR x Occupancy.'
    },
    {
      label: 'Room Revenue',
      value: loading ? '' : formatNaira(c?.roomRevenue ?? 0),
      detail: data ? `${data.period.nights} nights` : '',
      change: ch?.roomRevenue ?? null,
      icon: <TrendingUpIcon />,
      variant: 'plain' as const,
      help: 'Room revenue for the period. Stays crossing the period boundary are apportioned to the nights actually stayed.'
    }
  ];

  return (
    <Box sx={{ mb: 4 }}>
      <SectionHeader title="Performance this month" />
      <Grid container spacing={2.5}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            {loading ? (
              <Skeleton variant="rounded" height={140} />
            ) : (
              <Tooltip title={card.help} arrow placement="top">
                {/* Wrapper keeps the tooltip anchored without altering layout. */}
                <Box>
                  <MetricCard
                    label={card.label}
                    value={card.value}
                    detail={card.detail}
                    icon={card.icon}
                    variant={card.variant}
                    changePercent={card.change}
                  />
                </Box>
              </Tooltip>
            )}
          </Grid>
        ))}
      </Grid>
      {!loading && (c?.roomNightsAvailable ?? 0) === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Add rooms to your property to start tracking occupancy, ADR and RevPAR.
        </Typography>
      )}
    </Box>
  );
};

export default PerformanceMetrics;
