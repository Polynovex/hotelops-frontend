import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import LogoLoader from '../LogoLoader';
import { useAuthStore } from '../../store/authStore';
import { naira } from '../../services/dailyRecords';
import { usaliApi, type MappingRow, type UsaliDetail, type UsaliMappingResponse, type UsaliStatement } from '../../services/usali';
import { getApiErrorMessage } from '../../utils/apiError';
import { printElement } from '../../utils/printElement';

const firstOfMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
};
const REVENUE_LINES = ['ROOMS', 'FOOD_BEVERAGE', 'OTHER_OPERATED', 'MISC_INCOME', 'NON_OPERATING'];
const pct = (value: number) => `${value.toFixed(1)}%`;

/** One statement row; rows with detail open to show what makes them up. */
const Row: React.FC<{
  label: string;
  amount: number;
  percent?: number;
  budget?: number;
  detail?: UsaliDetail[];
  strong?: boolean;
  indent?: boolean;
}> = ({ label, amount, percent, budget, detail, strong, indent }) => {
  const [open, setOpen] = useState(false);
  const has = Boolean(detail?.length);
  return (
    <>
      <TableRow hover={has} onClick={() => has && setOpen(!open)} sx={{ cursor: has ? 'pointer' : 'default', ...(strong ? { '& td': { fontWeight: 800, bgcolor: 'action.hover' } } : {}) }}>
        <TableCell sx={{ pl: indent ? 4 : 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {has ? <IconButton size="small" sx={{ p: 0 }}>{open ? <ExpandMoreRounded fontSize="small" /> : <ChevronRightRounded fontSize="small" />}</IconButton> : <Box sx={{ width: 20 }} />}
            <span>{label}</span>
          </Stack>
        </TableCell>
        <TableCell align="right">{naira(amount)}</TableCell>
        <TableCell align="right">{percent == null ? '' : pct(percent)}</TableCell>
        <TableCell align="right">{budget == null ? '' : naira(budget)}</TableCell>
        <TableCell align="right" sx={{ color: budget != null && amount > budget ? 'error.main' : undefined }}>
          {budget == null ? '' : naira(budget - amount)}
        </TableCell>
      </TableRow>
      {open && detail?.map((d) => (
        <TableRow key={`${label}-${d.key}`}>
          <TableCell sx={{ pl: indent ? 9 : 7, color: 'text.secondary' }}>
            {d.label}
            {d.note && <Typography component="span" variant="caption" color="text.secondary" sx={{ textTransform: 'none' }}> · {d.note}</Typography>}
          </TableCell>
          <TableCell align="right" sx={{ color: 'text.secondary' }}>{naira(d.amount)}</TableCell>
          <TableCell colSpan={3} />
        </TableRow>
      ))}
    </>
  );
};

const Section: React.FC<{ title: string }> = ({ title }) => (
  <TableRow>
    <TableCell colSpan={5} sx={{ pt: 2.5, fontWeight: 800, textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.6, color: 'text.secondary' }}>{title}</TableCell>
  </TableRow>
);

const Statement: React.FC<{ onOpenMapping: () => void }> = ({ onOpenMapping }) => {
  const [range, setRange] = useState({ from: firstOfMonth(), to: new Date().toISOString().slice(0, 10) });
  const [basis, setBasis] = useState<'approved' | 'provisional'>('approved');
  const [data, setData] = useState<UsaliStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await usaliApi.statement({ from: range.from || undefined, to: range.to || undefined, basis }));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not build the statement'));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, basis]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data;
  const rev = s?.revenue.total ?? 0;
  const of = (amount: number) => (rev ? (amount / rev) * 100 : 0);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField size="small" type="date" label="From" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="To" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} InputLabelProps={{ shrink: true }} />
        <ToggleButtonGroup exclusive size="small" value={basis} onChange={(_e, v) => v && setBasis(v)}>
          <ToggleButton value="approved">Approved (final)</ToggleButton>
          <ToggleButton value="provisional">Provisional</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={() => printElement('usali-statement', 'Summary Operating Statement')} disabled={!s}>Print</Button>
      </Stack>

      {loading && <LogoLoader inline minHeight={120} />}
      {error && <Alert severity="error">{error}</Alert>}
      {s && s.basis === 'PROVISIONAL' && (
        <Alert severity="warning">Provisional: includes {s.pendingDays} day(s) still waiting for the owner&apos;s approval. Not for final reporting.</Alert>
      )}
      {s && s.basis === 'APPROVED' && s.pendingDays > 0 && (
        <Alert severity="info">{s.pendingDays} day(s) in this range are waiting for approval and are shown at their last approved figures (or left out).</Alert>
      )}
      {s && s.unmapped.length > 0 && (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onOpenMapping}>Map them</Button>}>
          {s.unmapped.length} categor{s.unmapped.length === 1 ? 'y is' : 'ies are'} not mapped and left off the statement:{' '}
          {s.unmapped.map((u) => `${u.key} (${naira(u.amount)})`).join(', ')}
        </Alert>
      )}

      {s && (
        <>
          <Grid container spacing={1.5}>
            {[
              ['Occupancy', pct(s.metrics.occupancyPercent)],
              ['ADR', naira(s.metrics.adr)],
              ['RevPAR', naira(s.metrics.revpar)],
              ['TRevPAR', naira(s.metrics.trevpar)],
              ['GOP margin', pct(s.metrics.gopMarginPercent)],
              ['GOPPAR', naira(s.metrics.goppar)],
              ['Labour cost', pct(s.metrics.labourCostPercent)]
            ].map(([label, value]) => (
              <Grid item xs={6} sm={4} md key={label}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={800}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }} id="usali-statement">
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800}>{s.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {s.from} to {s.to} · {s.basis === 'APPROVED' ? 'Approved figures' : 'PROVISIONAL'} · {s.daysIncluded} of {s.daysInRange} day(s) · mapping v{s.mappingVersion}
              </Typography>
            </Box>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">% of revenue</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Under / (over)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <Section title="Operating revenue" />
                {s.revenue.lines.map((l) => <Row key={l.key} indent label={l.label} amount={l.revenue} percent={of(l.revenue)} detail={l.revenueDetail} />)}
                <Row strong label="Total operating revenue" amount={rev} percent={100} />

                <Section title="Departmental expenses" />
                {s.revenue.lines.filter((l) => l.key !== 'MISC_INCOME').map((l) => (
                  <Row key={l.key} indent label={l.label} amount={l.expenses} percent={l.revenue ? (l.expenses / l.revenue) * 100 : undefined} budget={s.budgetByLine[l.key]} detail={l.expenseDetail} />
                ))}
                <Row strong label="Total departmental expenses" amount={s.departmentalExpenses} percent={of(s.departmentalExpenses)} />
                <Row strong label="Total departmental profit" amount={s.departmentalProfit} percent={of(s.departmentalProfit)} />

                <Section title="Undistributed operating expenses" />
                {s.undistributed.lines.map((l) => <Row key={l.key} indent label={l.label} amount={l.amount} percent={l.percentOfRevenue} budget={s.budgetByLine[l.key]} detail={l.detail} />)}
                <Row strong label="Total undistributed expenses" amount={s.undistributed.total} percent={of(s.undistributed.total)} />

                <Row strong label="Gross operating profit (GOP)" amount={s.grossOperatingProfit} percent={of(s.grossOperatingProfit)} />

                <Section title="Management fees and brand costs" />
                {s.fees.lines.map((l) => <Row key={l.key} indent label={l.label} amount={l.amount} percent={l.percentOfRevenue} detail={l.detail} />)}

                <Section title="Non-operating income and expenses" />
                <Row indent label="Non-operating income" amount={s.nonOperating.income} />
                <Row indent label="Non-operating expenses" amount={s.nonOperating.expenses} detail={s.nonOperating.detail} />

                <Row strong label="EBITDA" amount={s.ebitda} percent={of(s.ebitda)} />
              </TableBody>
            </Table>
            <Box sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none', display: 'block' }}>
                Labour {naira(s.labour.total)} ({pct(s.labour.percentOfRevenue)} of revenue){' '}
                {s.labourBasis === 'period' ? 'split by this period’s payroll departments.' : s.labourBasis === 'latest' ? 'split by the latest processed payroll.' : 'not split: no processed payroll yet, shown under Administrative and General.'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none', display: 'block' }}>
                Not on the operating statement (balance sheet): loans taken {naira(s.excluded.loanTaken ?? 0)}, loans repaid {naira(s.excluded.loanRepaid ?? 0)},
                owner withdrawals {naira(s.excluded.ownerWithdrawal ?? 0)}, capital expenditure {naira(s.excluded.capitalExpenditure ?? 0)}.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none', display: 'block', mt: 0.5 }}>
                USALI-aligned: follows the top-level structure of the Uniform System of Accounts for the Lodging Industry, 12th Revised Edition. Detailed account definitions are those of the licensed edition.
              </Typography>
            </Box>
          </Paper>
        </>
      )}
    </Stack>
  );
};

const Mapping: React.FC = () => {
  const isOwner = useAuthStore((state) => state.user?.role) === 'BUSINESS_ADMIN';
  const [data, setData] = useState<UsaliMappingResponse | null>(null);
  const [draft, setDraft] = useState<{ revenue: Record<string, string>; expense: Record<string, string> }>({ revenue: {}, expense: {} });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await usaliApi.mapping();
      setData(result);
      const pick = (rows: MappingRow[]) => Object.fromEntries(rows.filter((r) => r.line).map((r) => [r.key, r.line as string]));
      setDraft({ revenue: pick(result.revenue), expense: pick(result.expense) });
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the mapping'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lineLabel = useMemo(() => Object.fromEntries((data?.lines ?? []).map((l) => [l.key, l.label])), [data]);
  const changed = data
    ? (['revenue', 'expense'] as const).some((kind) => data[kind].some((row) => (draft[kind][row.key] ?? null) !== row.line))
    : false;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await usaliApi.saveMapping(draft);
      setNotice('Mapping saved. Reports use it straight away.');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the mapping'));
    } finally {
      setSaving(false);
    }
  };

  const table = (kind: 'revenue' | 'expense', title: string) => (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
      <Typography fontWeight={800} sx={{ p: 2, pb: 1 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>HotelOpX category</TableCell>
            <TableCell>USALI statement line</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data?.[kind].map((row) => {
            const value = draft[kind][row.key] ?? '';
            return (
              <TableRow key={row.key}>
                <TableCell>
                  {row.label}
                  {row.custom && <Chip size="small" label="Custom" sx={{ ml: 1 }} />}
                  {!value && <Chip size="small" color="warning" label="Unmapped" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>
                  {isOwner ? (
                    <TextField select size="small" value={value} sx={{ minWidth: 280 }} inputProps={{ 'aria-label': `Line for ${row.label}` }}
                      onChange={(e) => setDraft({ ...draft, [kind]: { ...draft[kind], [row.key]: e.target.value } })}>
                      {(data?.lines ?? []).filter((l) => kind === 'expense' || REVENUE_LINES.includes(l.key)).map((l) => (
                        <MenuItem key={l.key} value={l.key}>{l.label}</MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    value ? lineLabel[value] : '—'
                  )}
                  {row.defaultLine && value && value !== row.defaultLine && (
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none', display: 'block' }}>Default: {lineLabel[row.defaultLine]}</Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );

  if (!data && !error) return <LogoLoader inline minHeight={120} />;
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Your team keeps recording with the categories they know. This decides where each one appears on the USALI-aligned statement.
        {data?.version ? ` Version ${data.version}${data.updatedAt ? `, changed ${new Date(data.updatedAt).toLocaleString()}` : ''}.` : ' Using the HotelOpX defaults.'}
        {!isOwner && ' Only the owner can change it.'}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>{table('revenue', 'Revenue sources')}</Grid>
        <Grid item xs={12} md={6}>
          {table('expense', 'Expense categories')}
          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, mt: 2 }}>
            <Typography fontWeight={800}>Staff salaries</Typography>
            <Typography variant="body2" color="text.secondary">
              Split across departments by processed payroll, using each staff member&apos;s HR department
              (front desk and housekeeping → Rooms; kitchen, restaurant and events → Food and Beverage; maintenance → Property Operation; and so on).
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      {isOwner && (
        <Box>
          <Button variant="contained" onClick={() => void save()} disabled={!changed || saving}>Save mapping</Button>
        </Box>
      )}
    </Stack>
  );
};

/** The USALI views on the Finance Reports page. */
const UsaliReports: React.FC<{ view: 'usali' | 'mapping'; onViewChange: (view: 'usali' | 'mapping') => void }> = ({ view, onViewChange }) =>
  view === 'usali' ? <Statement onOpenMapping={() => onViewChange('mapping')} /> : <Mapping />;

export default UsaliReports;
