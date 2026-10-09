import { Box, Button, Divider, Grid, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { naira, type DailyRecordData, type Meta } from '../../services/dailyRecords';

/**
 * The daily record editor: revenue by source and payment method, cost of
 * sales, operating expenses, below-the-line items, cash/bank/POS positions and
 * room performance. Totals are shown as the user types; the server computes
 * the same figures from what is saved.
 */

const num = (value: string) => (value === '' ? 0 : Number(value));

export const emptyRecord = (): DailyRecordData => ({
  revenue: [],
  cogs: 0,
  expenses: [],
  belowTheLine: { loanTaken: 0, loanRepaid: 0, ownerWithdrawal: 0, capitalExpenditure: 0, taxes: 0 },
  positions: [],
  rooms: { available: 0, sold: 0, complimentary: 0, outOfOrder: 0, topRoomTypes: [], topRooms: [] },
  notes: ''
});

const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
      <Typography fontWeight={800}>{title}</Typography>
      {action}
    </Stack>
    {children}
  </Paper>
);

export function DailyRecordForm({
  value,
  onChange,
  meta,
  readOnly = false
}: {
  value: DailyRecordData;
  onChange: (next: DailyRecordData) => void;
  meta: Meta | null;
  readOnly?: boolean;
}) {
  const set = (patch: Partial<DailyRecordData>) => onChange({ ...value, ...patch });
  const sources = meta?.revenueSources ?? [];
  const categories = meta?.expenseCategories ?? [];

  const revenueTotal = value.revenue.reduce((sum, line) => sum + line.cash + line.card + line.transfer + line.online + line.other, 0);
  const expenseTotal = value.expenses.reduce((sum, line) => sum + line.amount, 0);
  const gross = revenueTotal - value.cogs;
  const net = gross - expenseTotal;
  const sellable = Math.max(value.rooms.available - value.rooms.outOfOrder, 0);
  const occupancy = sellable ? ((value.rooms.sold + value.rooms.complimentary) / sellable) * 100 : 0;
  const roomRevenue = value.revenue.filter((line) => line.source === 'ROOM_SALES').reduce((sum, line) => sum + line.cash + line.card + line.transfer + line.online + line.other, 0);
  const arr = value.rooms.sold ? roomRevenue / value.rooms.sold : 0;

  const field = (label: string, current: number, update: (next: number) => void, width?: number) => (
    <TextField
      size="small"
      type="number"
      label={label}
      value={current}
      onChange={(event) => update(num(event.target.value))}
      InputProps={{ readOnly }}
      inputProps={{ min: 0, step: 0.01 }}
      sx={width ? { width } : undefined}
      fullWidth={!width}
    />
  );

  return (
    <Stack spacing={2}>
      <Section
        title={`Revenue · ${naira(revenueTotal)}`}
        action={!readOnly && (
          <Button size="small" startIcon={<AddRounded />} onClick={() => set({ revenue: [...value.revenue, { source: sources.find((s) => !value.revenue.some((line) => line.source === s.key))?.key ?? 'OTHER', cash: 0, card: 0, transfer: 0, online: 0, other: 0 }] })}>
            Add source
          </Button>
        )}
      >
        {value.revenue.length === 0 && <Typography variant="body2" color="text.secondary">No revenue lines.</Typography>}
        {value.revenue.map((line, index) => {
          const update = (patch: Partial<typeof line>) => set({ revenue: value.revenue.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
          return (
            <Grid container spacing={1} key={index} sx={{ mb: 1 }} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField select size="small" fullWidth label="Source" value={line.source} onChange={(event) => update({ source: event.target.value })} InputProps={{ readOnly }}>
                  {sources.map((source) => <MenuItem key={source.key} value={source.key}>{source.label}</MenuItem>)}
                </TextField>
              </Grid>
              {(['cash', 'card', 'transfer', 'online', 'other'] as const).map((key) => (
                <Grid item xs={6} sm={4} md key={key}>{field(key.charAt(0).toUpperCase() + key.slice(1), line[key], (next) => update({ [key]: next }))}</Grid>
              ))}
              {!readOnly && (
                <Grid item xs="auto">
                  <IconButton size="small" onClick={() => set({ revenue: value.revenue.filter((_, i) => i !== index) })} aria-label="Remove line"><DeleteOutlineRounded fontSize="small" /></IconButton>
                </Grid>
              )}
            </Grid>
          );
        })}
      </Section>

      <Section
        title={`Operating expenses · ${naira(expenseTotal)}`}
        action={!readOnly && (
          <Button size="small" startIcon={<AddRounded />} onClick={() => set({ expenses: [...value.expenses, { category: 'OTHER', description: '', amount: 0 }] })}>
            Add expense
          </Button>
        )}
      >
        {value.expenses.length === 0 && <Typography variant="body2" color="text.secondary">No expenses.</Typography>}
        {value.expenses.map((line, index) => {
          const update = (patch: Partial<typeof line>) => set({ expenses: value.expenses.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
          return (
            <Grid container spacing={1} key={index} sx={{ mb: 1 }} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField select size="small" fullWidth label="Category" value={line.category} onChange={(event) => update({ category: event.target.value })} InputProps={{ readOnly }}>
                  {categories.map((category) => <MenuItem key={category.key} value={category.key}>{category.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField size="small" fullWidth label="Description" value={line.description ?? ''} onChange={(event) => update({ description: event.target.value })} InputProps={{ readOnly }} />
              </Grid>
              <Grid item xs={10} sm={2}>{field('Amount', line.amount, (next) => update({ amount: next }))}</Grid>
              {!readOnly && (
                <Grid item xs={2} sm={1}>
                  <IconButton size="small" onClick={() => set({ expenses: value.expenses.filter((_, i) => i !== index) })} aria-label="Remove expense"><DeleteOutlineRounded fontSize="small" /></IconButton>
                </Grid>
              )}
            </Grid>
          );
        })}
      </Section>

      <Section title="Profit and loss">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>{field('Cost of goods sold', value.cogs, (next) => set({ cogs: next }))}</Grid>
          <Grid item xs={12} sm={8}>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              <Box><Typography variant="caption" color="text.secondary">Total revenue</Typography><Typography fontWeight={700}>{naira(revenueTotal)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Gross profit</Typography><Typography fontWeight={700}>{naira(gross)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Net operating profit</Typography><Typography fontWeight={800} color={net < 0 ? 'error.main' : 'success.main'}>{naira(net)}</Typography></Box>
            </Stack>
          </Grid>
        </Grid>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Tracked separately, below operating profit:</Typography>
        <Grid container spacing={1}>
          {([
            ['loanTaken', 'Loan taken'],
            ['loanRepaid', 'Loan repaid'],
            ['ownerWithdrawal', 'Owner withdrawal'],
            ['capitalExpenditure', 'Capital expenditure'],
            ['taxes', 'Taxes paid']
          ] as const).map(([key, label]) => (
            <Grid item xs={6} md key={key}>{field(label, value.belowTheLine[key], (next) => set({ belowTheLine: { ...value.belowTheLine, [key]: next } }))}</Grid>
          ))}
        </Grid>
      </Section>

      <Section
        title="Cash, bank and POS positions"
        action={!readOnly && (
          <Button size="small" startIcon={<AddRounded />} onClick={() => set({ positions: [...value.positions, { account: '', type: 'CASH', opening: 0, moneyIn: 0, moneyOut: 0, closing: 0 }] })}>
            Add account
          </Button>
        )}
      >
        {value.positions.map((line, index) => {
          const update = (patch: Partial<typeof line>) => set({ positions: value.positions.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
          const expected = line.opening + line.moneyIn - line.moneyOut;
          const variance = line.closing - expected;
          return (
            <Grid container spacing={1} key={index} sx={{ mb: 1 }} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField size="small" fullWidth label="Account" value={line.account} onChange={(event) => update({ account: event.target.value })} InputProps={{ readOnly }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField select size="small" fullWidth label="Type" value={line.type} onChange={(event) => update({ type: event.target.value as typeof line.type })} InputProps={{ readOnly }}>
                  <MenuItem value="CASH">Cash</MenuItem>
                  <MenuItem value="BANK">Bank</MenuItem>
                  <MenuItem value="POS_TERMINAL">POS terminal</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} md>{field('Opening', line.opening, (next) => update({ opening: next }))}</Grid>
              <Grid item xs={6} md>{field('In', line.moneyIn, (next) => update({ moneyIn: next }))}</Grid>
              <Grid item xs={6} md>{field('Out', line.moneyOut, (next) => update({ moneyOut: next }))}</Grid>
              <Grid item xs={6} md>{field('Closing', line.closing, (next) => update({ closing: next }))}</Grid>
              <Grid item xs={4} md="auto">
                <Typography variant="caption" color={Math.abs(variance) > 0.01 ? 'error.main' : 'success.main'}>
                  {Math.abs(variance) > 0.01 ? `Off by ${naira(variance)}` : 'Balances'}
                </Typography>
              </Grid>
              {!readOnly && (
                <Grid item xs="auto">
                  <IconButton size="small" onClick={() => set({ positions: value.positions.filter((_, i) => i !== index) })} aria-label="Remove account"><DeleteOutlineRounded fontSize="small" /></IconButton>
                </Grid>
              )}
            </Grid>
          );
        })}
      </Section>

      <Section title="Room performance">
        <Grid container spacing={1}>
          <Grid item xs={6} md={3}>{field('Rooms available', value.rooms.available, (next) => set({ rooms: { ...value.rooms, available: next } }))}</Grid>
          <Grid item xs={6} md={3}>{field('Rooms sold', value.rooms.sold, (next) => set({ rooms: { ...value.rooms, sold: next } }))}</Grid>
          <Grid item xs={6} md={3}>{field('Complimentary', value.rooms.complimentary, (next) => set({ rooms: { ...value.rooms, complimentary: next } }))}</Grid>
          <Grid item xs={6} md={3}>{field('Out of order', value.rooms.outOfOrder, (next) => set({ rooms: { ...value.rooms, outOfOrder: next } }))}</Grid>
        </Grid>
        <Stack direction="row" spacing={3} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          <Box><Typography variant="caption" color="text.secondary">Occupancy</Typography><Typography fontWeight={700}>{occupancy.toFixed(1)}%</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Average room rate</Typography><Typography fontWeight={700}>{naira(arr)}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Room revenue</Typography><Typography fontWeight={700}>{naira(roomRevenue)}</Typography></Box>
          {value.rooms.topRoomTypes.length > 0 && (
            <Box><Typography variant="caption" color="text.secondary">Top room types</Typography>
              <Typography variant="body2">{value.rooms.topRoomTypes.slice(0, 3).map((type) => `${type.roomType} (${type.sold})`).join(', ')}</Typography>
            </Box>
          )}
        </Stack>
      </Section>

      <TextField label="Notes" multiline minRows={2} value={value.notes ?? ''} onChange={(event) => set({ notes: event.target.value })} InputProps={{ readOnly }} />
    </Stack>
  );
}
