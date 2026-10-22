import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Rating,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import Layout from '../../../components/Layout';
import { useAuthStore } from '../../../store/authStore';
import { RATING_LABEL, feedbackApi, type FeedbackLink, type FeedbackSummary, type GuestFeedback } from '../../../services/feedback';
import { getApiErrorMessage } from '../../../utils/apiError';
import { printElement } from '../../../utils/printElement';

const STATUS_COLOR: Record<GuestFeedback['status'], 'warning' | 'info' | 'success'> = { NEW: 'warning', REVIEWED: 'info', RESOLVED: 'success' };

/**
 * Guest feedback: what guests said after scanning the hotel's feedback QR
 * code, the averages per service, and the codes themselves (create, print,
 * switch off). Ratings of 2 or below also land in managers' inboxes.
 */
const GuestFeedbackPage: React.FC = () => {
  const role = useAuthStore((state) => state.user?.role);
  const canManageLinks = role === 'BUSINESS_ADMIN' || role === 'MANAGER';
  const [tab, setTab] = useState<'responses' | 'codes'>('responses');
  const [status, setStatus] = useState('');
  const [responses, setResponses] = useState<GuestFeedback[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [links, setLinks] = useState<FeedbackLink[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<GuestFeedback | null>(null);
  const [reply, setReply] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [qr, setQr] = useState<{ link: FeedbackLink; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, codes] = await Promise.all([feedbackApi.list(status ? { status } : {}), feedbackApi.links()]);
      setResponses(list.responses);
      setSummary(list.summary);
      setLinks(codes);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load feedback'));
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveResponse = async (next: GuestFeedback['status']) => {
    if (!open) return;
    const ok = await run(() => feedbackApi.update(open.id, { status: next, ...(reply.trim() ? { response: reply.trim() } : {}) }), 'Could not save');
    if (ok) setOpen(null);
  };

  const showQr = async (link: FeedbackLink) => {
    try {
      const { dataUrl } = await feedbackApi.qr(link.id);
      setQr({ link, dataUrl });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the QR code'));
    }
  };

  const createLink = async () => {
    const ok = await run(() => feedbackApi.createLink(newLabel.trim() || 'Guest feedback'), 'Could not create the code');
    if (ok) setNewLabel('');
  };

  const serviceKeys = Object.keys(RATING_LABEL);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Guest Feedback</Typography>
            <Typography color="text.secondary">Guests scan your feedback QR code and rate their stay. Low ratings are sent to managers straight away.</Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}

          {summary && (
            <Grid container spacing={1.5}>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Responses</Typography>
                  <Typography variant="h5" fontWeight={800}>{summary.count}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Overall</Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h5" fontWeight={800}>{summary.averages.overall?.average?.toFixed(1) ?? '—'}</Typography>
                    <Rating size="small" readOnly precision={0.1} value={summary.averages.overall?.average ?? 0} />
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Would recommend</Typography>
                  <Typography variant="h5" fontWeight={800}>{summary.recommendRate == null ? '—' : `${summary.recommendRate}%`}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Low ratings to resolve</Typography>
                  <Typography variant="h5" fontWeight={800} color={summary.unresolved ? 'error.main' : undefined}>{summary.unresolved}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {serviceKeys.filter((k) => k !== 'overall').map((k) => (
                      <Chip key={k} variant="outlined" label={`${RATING_LABEL[k]}: ${summary.averages[k]?.average?.toFixed(1) ?? '—'}`} />
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}

          <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
            <Tab value="responses" label="Responses" />
            <Tab value="codes" label="QR codes" />
          </Tabs>

          {tab === 'responses' && (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
              <Box sx={{ p: 1.5 }}>
                <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="NEW">New</MenuItem>
                  <MenuItem value="REVIEWED">Reviewed</MenuItem>
                  <MenuItem value="RESOLVED">Resolved</MenuItem>
                </TextField>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Guest</TableCell>
                    <TableCell>Overall</TableCell>
                    <TableCell>Comment</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {responses.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{[row.guestName, row.roomNumber && `Room ${row.roomNumber}`].filter(Boolean).join(' · ') || 'Anonymous'}</TableCell>
                      <TableCell><Rating size="small" readOnly value={row.overall} /></TableCell>
                      <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" noWrap>{row.comment || '—'}</Typography></TableCell>
                      <TableCell><Chip size="small" color={STATUS_COLOR[row.status]} label={row.status} /></TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => { setOpen(row); setReply(row.response ?? ''); }}>Open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!responses.length && (
                    <TableRow><TableCell colSpan={6}><Typography color="text.secondary" sx={{ py: 2 }}>No feedback yet. Print a QR code and place it in rooms or at reception.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {tab === 'codes' && (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
              {canManageLinks && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 1.5 }}>
                  <TextField size="small" label="Where it goes" placeholder="Reception, Room cards, Restaurant…" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} sx={{ minWidth: 260 }} />
                  <Button variant="contained" startIcon={<QrCode2Icon />} onClick={() => void createLink()} disabled={busy}>Create QR code</Button>
                </Stack>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Label</TableCell>
                    <TableCell>Responses</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>{link.label || 'Guest feedback'}</TableCell>
                      <TableCell>{link.responseCount}</TableCell>
                      <TableCell>
                        <Switch checked={link.isActive} disabled={!canManageLinks || busy}
                          onChange={(e) => void run(() => feedbackApi.updateLink(link.id, { isActive: e.target.checked }), 'Could not update the code')} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<QrCode2Icon />} onClick={() => void showQr(link)}>QR code</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!links.length && (
                    <TableRow><TableCell colSpan={4}><Typography color="text.secondary" sx={{ py: 2 }}>No feedback QR codes yet.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Stack>
      </Container>

      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Guest feedback</DialogTitle>
        {open && (
          <DialogContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {new Date(open.createdAt).toLocaleString()}{open.linkLabel ? ` · via ${open.linkLabel}` : ''}
              </Typography>
              {Object.entries(open.ratings).map(([k, v]) => (
                <Stack key={k} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography>{RATING_LABEL[k] ?? k}</Typography>
                  <Rating readOnly size="small" value={v} />
                </Stack>
              ))}
              {open.wouldRecommend != null && <Typography>Would recommend: <b>{open.wouldRecommend ? 'Yes' : 'No'}</b></Typography>}
              {open.comment && <Paper variant="outlined" sx={{ p: 1.5, whiteSpace: 'pre-wrap' }}>{open.comment}</Paper>}
              <Typography variant="body2">
                {[open.guestName, open.roomNumber && `Room ${open.roomNumber}`, open.contact].filter(Boolean).join(' · ') || 'No contact details left'}
              </Typography>
              <TextField label="What was done (internal note)" multiline minRows={2} value={reply} onChange={(e) => setReply(e.target.value)} fullWidth />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setOpen(null)}>Close</Button>
          <Button onClick={() => void saveResponse('REVIEWED')} disabled={busy}>Mark reviewed</Button>
          <Button variant="contained" color="success" onClick={() => void saveResponse('RESOLVED')} disabled={busy}>Resolved</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(qr)} onClose={() => setQr(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Feedback QR code</DialogTitle>
        {qr && (
          <DialogContent>
            <Box id="feedback-qr-print" sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={800}>How was your stay?</Typography>
              <Typography variant="body2">Scan to tell us. It takes a minute.</Typography>
              <Box component="img" src={qr.dataUrl} alt="Feedback QR code" sx={{ width: 260, maxWidth: '100%', my: 1.5 }} />
              <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-all', textTransform: 'none' }}>{qr.link.url}</Typography>
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => qr && void navigator.clipboard?.writeText(qr.link.url)}>Copy link</Button>
          {qr && <Button component="a" href={qr.dataUrl} download={`feedback-qr-${qr.link.code}.png`}>Download</Button>}
          <Button variant="contained" onClick={() => printElement('feedback-qr-print', 'Feedback QR code')}>Print</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default GuestFeedbackPage;
