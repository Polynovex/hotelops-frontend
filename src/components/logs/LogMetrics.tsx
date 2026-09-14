import { useMemo } from 'react';
import {
  Alert, AlertTitle, Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography, useTheme
} from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import ErrorRounded from '@mui/icons-material/ErrorRounded';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { useMediaQuery } from '@mui/material';

/**
 * The at-a-glance half of Live Logs.
 *
 * Built to answer, in order and without reading a single log line: is anything
 * wrong, since when, where, and for whom. The verdict at the top is computed,
 * not decorative — it names the problem in words, because a person glancing at
 * this during a phone call should not have to interpret a chart to learn that
 * the booking endpoint started failing at 14:05.
 *
 * Colours come from a validated categorical palette, not the theme's status
 * colours: the status yellow fails the lightness band as a fill. The dark
 * values are stepped separately and pass against the dark surface. Level is
 * never carried by colour alone — every series has a legend entry, the tooltip
 * names it, and the log table below is the full table view.
 */

export interface LogMetricsData {
  window: { startDate: string; endDate: string; bucketMs: number };
  scanned: number;
  truncated: boolean;
  totals: {
    requests: number;
    serverErrors: number;
    errorRate: number;
    p50Ms: number;
    p95Ms: number;
    affectedTenants: number;
  };
  statusClasses: Record<'2xx' | '3xx' | '4xx' | '5xx', number>;
  timeline: Array<{ t: number; info: number; warn: number; error: number }>;
  topFailingEndpoints: Array<{ endpoint: string; requests: number; errors: number; errorRate: number; p95Ms: number }>;
  slowestEndpoints: Array<{ endpoint: string; requests: number; errors: number; errorRate: number; p95Ms: number }>;
  topErrors: Array<{ message: string; count: number }>;
}

/** Validated with the dataviz palette checker — light and dark stepped separately. */
const PALETTE = {
  light: { info: '#2a78d6', warn: '#eda100', error: '#e34948', grid: '#e7e6e2', axis: '#52514e' },
  dark: { info: '#3987e5', warn: '#c98500', error: '#e34948', grid: '#33332f', axis: '#c3c2b7' }
};

/** Where "fine" ends. Chosen for an operational tool: a front desk feels 1.5s. */
const THRESHOLDS = {
  errorRateWarn: 0.01,
  errorRateCritical: 0.05,
  p95WarnMs: 1500,
  p95CriticalMs: 3000,
  // An error bucket this many times the recent average is a spike, not noise.
  spikeFactor: 3
};

type Severity = 'good' | 'warning' | 'critical';

interface Finding {
  severity: Severity;
  headline: string;
  detail: string;
}

const time = (ms: number, bucketMs: number) =>
  new Date(ms).toLocaleTimeString([], bucketMs >= 3_600_000
    ? { hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' });

const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.01 ? 2 : 1)}%`;

/**
 * Reads the numbers and says what they mean.
 *
 * Ordered by what should be acted on first. Each finding names the endpoint
 * and the time, because "error rate is high" sends someone looking and "POST
 * /bookings failing since 14:05" sends them straight to the fix.
 */
const diagnose = (data: LogMetricsData): Finding[] => {
  const findings: Finding[] = [];
  const { totals, timeline, topFailingEndpoints, slowestEndpoints, window } = data;

  if (totals.requests === 0) {
    return [{
      severity: 'warning',
      headline: 'No requests in this window',
      detail:
        'Either nobody is using the platform, or requests are not reaching the API. If it is business hours, check the site loads at all.'
    }];
  }

  /*
   * A spike, reported by when it started.
   *
   * This first reported the latest bucket, measured against the average of
   * every bucket before it — which included the spike itself. An incident
   * that began at 15:35 was announced as "spike at 15:55" against an average
   * already inflated by twenty minutes of failures. The useful fact is the
   * start, so: walk back from the end while buckets stay elevated, then
   * compare that run with the quiet baseline that preceded it.
   */
  const counts = timeline.map((b) => b.error);
  const last = counts.length - 1;
  if (last >= 1 && counts[last] >= 3) {
    // Median of the first half is a baseline that a late spike cannot skew.
    const early = [...counts.slice(0, Math.max(1, Math.floor(counts.length / 2)))].sort((a, b) => a - b);
    const baseline = early[Math.floor(early.length / 2)] ?? 0;
    const elevated = (n: number) => n >= 3 && n > Math.max(baseline, 0.5) * THRESHOLDS.spikeFactor;

    if (elevated(counts[last])) {
      let start = last;
      while (start > 0 && elevated(counts[start - 1])) start -= 1;
      const run = counts.slice(start);
      const total = run.reduce((sum, n) => sum + n, 0);
      const minutes = Math.round((run.length * window.bucketMs) / 60_000);

      findings.push({
        severity: 'critical',
        headline: `Error spike since ${time(timeline[start].t, window.bucketMs)}`,
        detail:
          `${total} errors over the last ${minutes} min, ${baseline === 0 ? 'where there were normally none' : `against a normal of about ${baseline} per interval`}. ` +
          'Look at what changed at the start — a deploy, a provider outage, or one property’s import.'
      });
    }
  }

  if (totals.errorRate >= THRESHOLDS.errorRateWarn) {
    const worst = topFailingEndpoints[0];
    findings.push({
      severity: totals.errorRate >= THRESHOLDS.errorRateCritical ? 'critical' : 'warning',
      headline: `${pct(totals.errorRate)} of requests are failing on the server`,
      detail: worst
        ? `Most of it is ${worst.endpoint}: ${worst.errors} of ${worst.requests} calls returned 5xx. ${totals.affectedTenants} ${totals.affectedTenants === 1 ? 'property is' : 'properties are'} affected.`
        : `${totals.serverErrors} server errors across ${totals.requests} requests.`
    });
  }

  if (totals.p95Ms >= THRESHOLDS.p95WarnMs) {
    const slowest = slowestEndpoints[0];
    findings.push({
      severity: totals.p95Ms >= THRESHOLDS.p95CriticalMs ? 'critical' : 'warning',
      headline: `Slow: 1 in 20 requests takes over ${(totals.p95Ms / 1000).toFixed(1)}s`,
      detail: slowest
        ? `The slowest route is ${slowest.endpoint} at ${(slowest.p95Ms / 1000).toFixed(1)}s p95. Across many routes at once usually means cold starts or the Lambda concurrency limit; one route usually means its query.`
        : 'Across many routes at once usually means cold starts or the Lambda concurrency limit.'
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'good',
      headline: 'Healthy',
      detail: `${totals.requests} requests, ${pct(totals.errorRate)} server errors, p95 ${totals.p95Ms}ms. Nothing needs attention in this window.`
    });
  }

  return findings;
};

const SEVERITY_UI: Record<Severity, { alert: 'success' | 'warning' | 'error'; icon: JSX.Element; label: string }> = {
  good: { alert: 'success', icon: <CheckCircleRounded />, label: 'Healthy' },
  warning: { alert: 'warning', icon: <WarningAmberRounded />, label: 'Warning' },
  critical: { alert: 'error', icon: <ErrorRounded />, label: 'Critical' }
};

function StatTile({ label, value, sub, severity }: { label: string; value: string; sub?: string; severity?: Severity }) {
  const ui = severity ? SEVERITY_UI[severity] : null;
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={700} sx={{ lineHeight: 1.2, my: 0.5, fontSize: { xs: 24, sm: 34 } }}>{value}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* Status is an icon plus a word, never colour alone. */}
        {ui && severity !== 'good' && (
          <Chip size="small" color={ui.alert} icon={ui.icon} label={ui.label} sx={{ height: 20, '& .MuiChip-icon': { fontSize: 14 } }} />
        )}
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </Stack>
    </Paper>
  );
}

function EndpointBars({
  title, rows, valueKey, format, colour, empty
}: {
  title: string;
  rows: LogMetricsData['topFailingEndpoints'];
  valueKey: 'errors' | 'p95Ms';
  format: (n: number) => string;
  colour: string;
  empty: string;
}) {
  const theme = useTheme();
  const tokens = theme.palette.mode === 'dark' ? PALETTE.dark : PALETTE.light;
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  /*
   * Endpoint names are long and monospace. Recharts wraps category ticks on
   * spaces, which split "POST /api/payments/checkout" over two lines and
   * pulled it out of line with its bar. Drawn by hand instead: one line,
   * truncated to fit, with the full path in a native tooltip.
   */
  const axisWidth = narrow ? 128 : 230;
  // Monospace at 11px renders nearer 7px a character than 6.6 in practice, and
  // the axis keeps a little padding — undercounting clipped the method off the
  // front of every label on a phone.
  const maxChars = Math.floor((axisWidth - 18) / 7.2);
  const Tick = ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const full = String(payload.value);
    const shown = full.length > maxChars ? `${full.slice(0, maxChars - 1)}…` : full;
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fill={tokens.axis} fontSize={11} fontFamily="monospace">
        <title>{full}</title>
        {shown}
      </text>
    );
  };
  const valueLabel = narrow && valueKey === 'p95Ms' ? (n: number) => `${(n / 1000).toFixed(1)}s` : format;
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" gutterBottom>{title}</Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{empty}</Typography>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 34 + 20)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: narrow ? 36 : 56, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={tokens.grid} />
            <XAxis type="number" tick={{ fill: tokens.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category" dataKey="endpoint" width={axisWidth}
              tick={Tick as never} interval={0}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              cursor={{ fill: tokens.grid, opacity: 0.5 }}
              formatter={(value: number) => [format(value), valueKey === 'errors' ? 'Server errors' : 'p95 latency']}
              labelStyle={{ fontFamily: 'monospace' }}
            />
            <Bar
              dataKey={valueKey} fill={colour} barSize={14} radius={[0, 4, 4, 0]}
              // Direct value labels: a top-eight list is read as a ranking, and
              // the numbers are the point.
              label={{ position: 'right', fill: tokens.axis, fontSize: 11, formatter: valueLabel }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}

export function LogMetrics({ data }: { data: LogMetricsData }) {
  const theme = useTheme();
  const tokens = theme.palette.mode === 'dark' ? PALETTE.dark : PALETTE.light;
  const findings = useMemo(() => diagnose(data), [data]);
  const { totals, window } = data;

  const errorRateSeverity: Severity =
    totals.errorRate >= THRESHOLDS.errorRateCritical ? 'critical'
      : totals.errorRate >= THRESHOLDS.errorRateWarn ? 'warning' : 'good';
  const latencySeverity: Severity =
    totals.p95Ms >= THRESHOLDS.p95CriticalMs ? 'critical'
      : totals.p95Ms >= THRESHOLDS.p95WarnMs ? 'warning' : 'good';

  const timeline = data.timeline.map((b) => ({ ...b, label: time(b.t, window.bucketMs) }));

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      {/* The verdict. Everything below is the evidence for it. */}
      {findings.map((finding) => (
        <Alert key={finding.headline} severity={SEVERITY_UI[finding.severity].alert} icon={SEVERITY_UI[finding.severity].icon}>
          <AlertTitle sx={{ mb: 0.25 }}>{finding.headline}</AlertTitle>
          {finding.detail}
        </Alert>
      ))}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
        <StatTile label="Requests" value={totals.requests.toLocaleString()} sub={`${data.statusClasses['4xx']} client errors`} />
        <StatTile label="Server error rate" value={pct(totals.errorRate)} sub={`${totals.serverErrors} × 5xx`} severity={errorRateSeverity} />
        <StatTile label="p95 latency" value={`${totals.p95Ms.toLocaleString()} ms`} sub={`median ${totals.p50Ms} ms`} severity={latencySeverity} />
        <StatTile
          label="Properties affected"
          value={String(totals.affectedTenants)}
          sub={totals.affectedTenants ? 'saw a server error' : 'none'}
          severity={totals.affectedTenants > 1 ? 'critical' : totals.affectedTenants === 1 ? 'warning' : 'good'}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Log volume by level</Typography>
          <Typography variant="caption" color="text.secondary">
            one bar = {window.bucketMs >= 3_600_000 ? `${window.bucketMs / 3_600_000}h` : `${window.bucketMs / 60_000} min`}
          </Typography>
        </Stack>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={timeline} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={tokens.grid} />
            <XAxis dataKey="label" tick={{ fill: tokens.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: tokens.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: tokens.grid, opacity: 0.5 }} />
            {/* Swatch carries identity; the words stay in text ink. */}
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="square"
              formatter={(value) => <span style={{ color: theme.palette.text.secondary }}>{value}</span>}
            />
            {/* Errors stacked on top, where a spike reads first. The 1px
                surface stroke keeps adjacent segments separable. */}
            <Bar dataKey="info" name="Info" stackId="level" fill={tokens.info} stroke={theme.palette.background.paper} strokeWidth={1} />
            <Bar dataKey="warn" name="Warn" stackId="level" fill={tokens.warn} stroke={theme.palette.background.paper} strokeWidth={1} />
            <Bar dataKey="error" name="Error" stackId="level" fill={tokens.error} stroke={theme.palette.background.paper} strokeWidth={1} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <EndpointBars
          title="Where it is failing — server errors by endpoint"
          rows={data.topFailingEndpoints}
          valueKey="errors"
          format={(n) => String(n)}
          colour={tokens.error}
          empty="No endpoint returned a server error in this window."
        />
        <EndpointBars
          title="What is slow — p95 latency by endpoint"
          rows={data.slowestEndpoints}
          valueKey="p95Ms"
          format={(n) => `${n.toLocaleString()} ms`}
          colour={tokens.info}
          empty="Not enough requests per endpoint to measure latency yet."
        />
      </Stack>

      {data.topErrors.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Most frequent errors</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Message</TableCell><TableCell align="right">Count</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {data.topErrors.map((row) => (
                  <TableRow key={row.message}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.message}</TableCell>
                    <TableCell align="right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {data.truncated && (
        <Alert severity="info">
          This window holds more than {data.scanned.toLocaleString()} log lines, so the figures cover the first {data.scanned.toLocaleString()} only. Narrow the time range for exact numbers.
        </Alert>
      )}
    </Stack>
  );
}
