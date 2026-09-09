import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRightRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import { auditOpsService, type AuditRecord } from '../../services/operations';

/**
 * Severity is inferred from the action, not stored.
 *
 * Nothing writes a severity column, so colouring by one would mean inventing a
 * field and backfilling thousands of rows. What an action *is* already carries
 * the weight: deleting a business is not the same as reading a report, and the
 * eye should be drawn to the first without being told.
 */
const HIGH = /DELETE|PURGE|REVOKE|VOID|REFUND|OVERRIDE|SUSPEND|TERMINATE|RESET|ROTATE/;
const MEDIUM = /UPDATE|EDIT|APPROVE|REJECT|CANCEL|DISCOUNT|ADJUST|ASSIGN|GRANT|CHANGE/;

type Severity = 'high' | 'medium' | 'low';

const severityOf = (action: string): Severity => {
  if (HIGH.test(action)) return 'high';
  if (MEDIUM.test(action)) return 'medium';
  return 'low';
};

const SEVERITY_COLOUR: Record<Severity, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default'
};

/** Turns CREATE_RESERVATION into "Create reservation". */
const humanise = (action: string) => {
  const words = action.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Renders a change record as before/after where the entry has both.
 *
 * Most entries carry `{ previousStatus, nextStatus }` or similar pairs, and
 * showing them side by side is the difference between an audit trail and a
 * list of things that happened. Anything that does not pair up is shown as it
 * is rather than forced into a shape it does not have.
 */
const ChangeDetail = ({ details }: { details: Record<string, unknown> }) => {
  const entries = Object.entries(details ?? {});

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No state was recorded for this entry.
      </Typography>
    );
  }

  const pairs: Array<{ field: string; before: unknown; after: unknown }> = [];
  const plain: Array<[string, unknown]> = [];
  const used = new Set<string>();

  for (const [key, value] of entries) {
    const beforeMatch = key.match(/^(previous|old|from)(.+)$/i);
    if (!beforeMatch) continue;

    const field = beforeMatch[2];
    const afterKey = entries.find(([k]) =>
      new RegExp(`^(next|new|to)${field}$`, 'i').test(k)
    );

    if (afterKey) {
      pairs.push({ field, before: value, after: afterKey[1] });
      used.add(key);
      used.add(afterKey[0]);
    }
  }

  for (const [key, value] of entries) {
    if (!used.has(key)) plain.push([key, value]);
  }

  return (
    <Stack spacing={1.5}>
      {pairs.length > 0 && (
        <Box>
          {pairs.map((pair) => (
            <Stack
              key={pair.field}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 0.5, flexWrap: 'wrap' }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 120 }}>
                {humanise(pair.field)}
              </Typography>
              <Chip
                size="small"
                label={String(pair.before ?? '—')}
                sx={{ textDecoration: 'line-through', opacity: 0.7 }}
              />
              <Typography variant="caption" color="text.secondary">→</Typography>
              <Chip size="small" color="primary" label={String(pair.after ?? '—')} />
            </Stack>
          ))}
        </Box>
      )}

      {plain.length > 0 && (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: 'action.hover',
            fontSize: 12,
            lineHeight: 1.6,
            overflowX: 'auto',
            fontFamily: '"JetBrains Mono", monospace'
          }}
        >
          {JSON.stringify(Object.fromEntries(plain), null, 2)}
        </Box>
      )}
    </Stack>
  );
};

const Row = ({ entry }: { entry: AuditRecord }) => {
  const [open, setOpen] = useState(false);
  const severity = severityOf(entry.action);
  const when = new Date(entry.timestamp);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: open ? 'unset' : undefined } }}>
        <TableCell sx={{ width: 44 }}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Hide detail' : 'Show detail'}>
            {open ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
          </IconButton>
        </TableCell>

        <TableCell>
          <Typography variant="body2" fontWeight={600}>
            {when.toLocaleDateString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {when.toLocaleTimeString()}
          </Typography>
        </TableCell>

        <TableCell>
          <Chip size="small" color={SEVERITY_COLOUR[severity]} label={humanise(entry.action)} />
        </TableCell>

        <TableCell>
          <Typography variant="body2">{entry.entity}</Typography>
          {entry.entityId && (
            <Tooltip title={entry.entityId}>
              <Typography variant="caption" color="text.secondary">
                {entry.entityId.slice(0, 8)}…
              </Typography>
            </Tooltip>
          )}
        </TableCell>

        <TableCell>
          <Typography variant="body2">{entry.userName ?? '—'}</Typography>
          {entry.userRole && (
            <Typography variant="caption" color="text.secondary">
              {entry.userRole.replace(/_/g, ' ').toLowerCase()}
            </Typography>
          )}
        </TableCell>

        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {entry.ipAddress ?? '—'}
          </Typography>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 1 }}>
              <ChangeDetail details={entry.details} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

/**
 * The audit trail, readable.
 *
 * It was a flat list with no way to narrow it: on a property with thousands of
 * entries, finding who changed a price last Tuesday meant scrolling. This adds
 * search, filters drawn from what the property has actually recorded, a date
 * range, and per-row expansion showing the before and after of each change.
 */
export function AuditTrailViewer() {
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{ actions: string[]; entities: string[] }>({
    actions: [],
    entities: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditOpsService.search({
        q: search || undefined,
        action: action || undefined,
        entity: entity || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: rowsPerPage,
        offset: page * rowsPerPage
      });
      setRows(result.items);
      setTotal(result.total);
      if (result.facets.actions.length) setFacets(result.facets);
      setError('');
    } catch (_err) {
      setError('Could not load the audit trail.');
    } finally {
      setLoading(false);
    }
  }, [search, action, entity, startDate, endDate, page, rowsPerPage]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per key.
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  /**
   * Severity is derived, so the server cannot filter on it — this narrows the
   * page in hand. The count says so plainly rather than implying it filtered
   * the whole trail.
   */
  const visible = useMemo(
    () => (severity ? rows.filter((row) => severityOf(row.action) === severity) : rows),
    [rows, severity]
  );

  const resetPage = () => setPage(0);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <HistoryRounded color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Audit trail
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Every recorded action, with who did it and what changed.
            </Typography>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search action, entity or record id"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            InputProps={{ startAdornment: <SearchRounded fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> }}
            sx={{ minWidth: 260, flexGrow: 1 }}
          />

          <TextField
            select
            size="small"
            label="Action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              resetPage();
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All actions</MenuItem>
            {facets.actions.map((name) => (
              <MenuItem key={name} value={name}>{humanise(name)}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Entity"
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              resetPage();
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All entities</MenuItem>
            {facets.entities.map((name) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | '')}
            sx={{ minWidth: 150 }}
            helperText={severity ? 'Filters this page' : undefined}
          >
            <MenuItem value="">Any severity</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
          </TextField>

          <TextField
            size="small"
            type="date"
            label="From"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              resetPage();
            }}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            size="small"
            type="date"
            label="To"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              resetPage();
            }}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

      <TableContainer sx={{ maxHeight: 620 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>When</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Record</TableCell>
              <TableCell>Who</TableCell>
              <TableCell>From</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={26} />
                </TableCell>
              </TableRow>
            )}

            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nothing matches these filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading && visible.map((entry) => <Row key={entry.id} entry={entry} />)}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_event, next) => setPage(next)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          resetPage();
        }}
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Paper>
  );
}
