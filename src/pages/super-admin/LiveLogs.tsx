import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Container, FormControlLabel,
  IconButton, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded';
import Layout from '../../components/Layout';
import { EmptyState, PageHeader } from '../../components/premium';
import { api } from '../../services/api';

/**
 * The application's own logs, for a super admin during an incident.
 *
 * Polled rather than streamed. A socket would be tidier, but the value here is
 * "show me the last few minutes while I am on the phone", and polling survives
 * the one situation this screen exists for — the backend being unwell. A
 * stream that drops and silently stops updating is worse than a refresh that
 * visibly fails.
 */

type Level = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'UNKNOWN';

interface LogEntry {
  timestamp: string;
  level: Level;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  hotelId?: string;
  role?: string;
  stack?: string;
  payload?: Record<string, unknown>;
}

const LEVEL_COLOUR: Record<Level, 'error' | 'warning' | 'info' | 'default'> = {
  FATAL: 'error', ERROR: 'error', WARN: 'warning', INFO: 'info', DEBUG: 'default', UNKNOWN: 'default'
};

const WINDOWS = [
  { label: 'Last 15 minutes', minutes: 15 },
  { label: 'Last hour', minutes: 60 },
  { label: 'Last 6 hours', minutes: 360 },
  { label: 'Last 24 hours', minutes: 1440 }
];

export default function LiveLogs() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{ logGroup?: string; truncated?: boolean }>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState('');

  // Held in a ref so the polling effect does not restart on every keystroke.
  const filters = useRef({ level, search, minutes });
  filters.current = { level, search, minutes };

  const load = useCallback(async () => {
    setError('');
    try {
      const { level: lvl, search: term, minutes: window } = filters.current;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - window * 60 * 1000);

      const { data } = await api.get('/admin/logs', {
        params: {
          level: lvl || undefined,
          search: term || undefined,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 200
        }
      });

      setItems(data.items ?? []);
      setMeta({ logGroup: data.logGroup, truncated: data.truncated });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Could not read the logs. If this persists, the API itself may be the problem.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, level, minutes, search]);

  useEffect(() => {
    if (!live) return;
    // Ten seconds: frequent enough to watch an incident, slow enough that a
    // CloudWatch query per tick is not itself a cost problem.
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [live, load]);

  const counts = useMemo(() => {
    const out: Partial<Record<Level, number>> = {};
    for (const item of items) out[item.level] = (out[item.level] ?? 0) + 1;
    return out;
  }, [items]);

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Could not copy — the browser refused clipboard access.');
    }
  };

  const exportAs = (format: 'json' | 'csv') => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    let body: string;

    if (format === 'json') {
      body = JSON.stringify(items, null, 2);
    } else {
      const columns = ['timestamp', 'level', 'method', 'path', 'status', 'durationMs', 'hotelId', 'userId', 'requestId', 'message'];
      // Quoted and doubled: messages contain commas and quotation marks, and a
      // log export that corrupts its own rows is worse than none.
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      body = [
        columns.join(','),
        ...items.map((item) => columns.map((c) => escape((item as any)[c])).join(','))
      ].join('\r\n');
    }

    const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hotelopx-logs-${stamp}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Layout>
      <Container maxWidth={false} sx={{ py: 4 }}>
        <PageHeader
          title="Live logs"
          subtitle={meta.logGroup ? `Reading ${meta.logGroup}` : 'Application logs from CloudWatch'}
          actions={
            <Stack direction="row" spacing={1}>
              <FormControlLabel
                control={<Switch checked={live} onChange={(e) => setLive(e.target.checked)} />}
                label="Live"
              />
              <Button startIcon={<RefreshRounded />} onClick={() => void load()}>Refresh</Button>
              <Button startIcon={<DownloadRounded />} onClick={() => exportAs('csv')} disabled={!items.length}>CSV</Button>
              <Button startIcon={<DownloadRounded />} onClick={() => exportAs('json')} disabled={!items.length}>JSON</Button>
            </Stack>
          }
        />

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select fullWidth size="small" label="Level" value={level}
              onChange={(e) => setLevel(e.target.value)} sx={{ maxWidth: { md: 180 } }}
            >
              <MenuItem value="">All levels</MenuItem>
              {['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((l) => (
                <MenuItem key={l} value={l}>{l}</MenuItem>
              ))}
            </TextField>

            <TextField
              select fullWidth size="small" label="Time window" value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))} sx={{ maxWidth: { md: 200 } }}
            >
              {WINDOWS.map((w) => (
                <MenuItem key={w.minutes} value={w.minutes}>{w.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth size="small" label="Search"
              placeholder="Request ID, hotel ID, path, or any text in the message"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            {(Object.keys(counts) as Level[]).map((l) => (
              <Chip key={l} size="small" color={LEVEL_COLOUR[l]} label={`${l}: ${counts[l]}`} />
            ))}
          </Stack>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {copied && <Alert severity="success" sx={{ mb: 2 }}>{copied} copied.</Alert>}
        {meta.truncated && (
          <Alert severity="info" sx={{ mb: 2 }}>
            More entries exist in this window than were returned. Narrow the time
            range or add a search term — what is shown is not the whole story.
          </Alert>
        )}

        <Paper variant="outlined">
          {loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : items.length === 0 ? (
            <EmptyState
              title="No log entries"
              description="Nothing matched in this window. Widen the time range, or clear the level filter."
            />
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={40} />
                    <TableCell>Time</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Endpoint</TableCell>
                    <TableCell>Tenant / user</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell width={48} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => {
                    const open = expanded.has(index);
                    const hasDetail = Boolean(item.stack || item.payload);
                    return (
                      <>
                        <TableRow key={index} hover sx={{ '& td': { verticalAlign: 'top' } }}>
                          <TableCell>
                            {hasDetail && (
                              <IconButton size="small" onClick={() => toggle(index)}>
                                {open ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
                              </IconButton>
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={item.level} color={LEVEL_COLOUR[item.level]} />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 260 }}>
                            {item.method ? `${item.method} ${item.path ?? ''}` : '—'}
                            {item.status ? (
                              <Typography variant="caption" display="block" color={item.status >= 500 ? 'error.main' : 'text.secondary'}>
                                {item.status}{item.durationMs ? ` · ${item.durationMs}ms` : ''}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, maxWidth: 180 }}>
                            {item.hotelId && <Typography variant="caption" display="block" noWrap>{item.hotelId}</Typography>}
                            {item.userId && <Typography variant="caption" display="block" color="text.secondary" noWrap>{item.userId}</Typography>}
                            {!item.hotelId && !item.userId && '—'}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, maxWidth: 420, wordBreak: 'break-word' }}>
                            {item.message}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Copy this entry">
                              <IconButton
                                size="small"
                                onClick={() => void copy(JSON.stringify(item, null, 2), 'Log entry')}
                              >
                                <ContentCopyRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        {hasDetail && (
                          <TableRow key={`${index}-detail`}>
                            <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                              <Collapse in={open} unmountOnExit>
                                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mb: 1 }}>
                                  {item.stack && (
                                    <>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="subtitle2">Stack trace</Typography>
                                        <Button size="small" startIcon={<ContentCopyRounded />}
                                          onClick={() => void copy(item.stack!, 'Stack trace')}>
                                          Copy
                                        </Button>
                                      </Stack>
                                      <Box component="pre" sx={{ fontSize: 11, overflowX: 'auto', m: 0, mb: 2 }}>
                                        {item.stack}
                                      </Box>
                                    </>
                                  )}
                                  {item.payload && (
                                    <>
                                      <Typography variant="subtitle2">Payload</Typography>
                                      <Box component="pre" sx={{ fontSize: 11, overflowX: 'auto', m: 0 }}>
                                        {JSON.stringify(item.payload, null, 2)}
                                      </Box>
                                    </>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </Layout>
  );
}
