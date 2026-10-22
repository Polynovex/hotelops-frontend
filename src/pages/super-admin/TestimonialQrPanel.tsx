import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper,
  Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { superAdminService, type BusinessSummary } from '../../services/api';
import { feedbackApi, type FeedbackLink } from '../../services/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Testimonial QR codes: one to send a hotel owner (or a general one), which
 * opens a short form. What comes back lands in the list below as a draft,
 * with the owner's consent recorded, ready to review and publish.
 */
const TestimonialQrPanel = ({ onChanged }: { onChanged?: () => void }) => {
  const [links, setLinks] = useState<FeedbackLink[]>([]);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ link: FeedbackLink; dataUrl: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLinks(await feedbackApi.testimonialLinks());
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load testimonial codes'));
    }
  }, []);

  useEffect(() => {
    void load();
    superAdminService.getBusinesses().then(setBusinesses).catch(() => setBusinesses([]));
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const link = await feedbackApi.createTestimonialLink({ hotelId: hotelId || null, label: label.trim() || undefined });
      setLabel('');
      await load();
      const { dataUrl } = await feedbackApi.testimonialQr(link.id);
      setQr({ link: { ...link, hotelName: businesses.find((b) => b.id === hotelId)?.businessName || businesses.find((b) => b.id === hotelId)?.name || null }, dataUrl });
      onChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the code'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (link: FeedbackLink, isActive: boolean) => {
    try {
      await feedbackApi.updateTestimonialLink(link.id, isActive);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the code'));
    }
  };

  const showQr = async (link: FeedbackLink) => {
    try {
      const { dataUrl } = await feedbackApi.testimonialQr(link.id);
      setQr({ link, dataUrl });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the QR code'));
    }
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflowX: 'auto' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={800}>Testimonial QR codes</Typography>
        <Typography variant="body2" color="text.secondary">
          Send a hotel owner a code. Their testimonial arrives here as a draft with consent recorded. Review it, then publish.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <TextField select size="small" label="Business" value={hotelId} onChange={(e) => setHotelId(e.target.value)} sx={{ minWidth: 240 }}>
            <MenuItem value="">Any (general code)</MenuItem>
            {businesses.map((b) => <MenuItem key={b.id} value={b.id}>{b.businessName || b.name}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ minWidth: 200 }} />
          <Button variant="contained" startIcon={<QrCode2Icon />} onClick={() => void create()} disabled={busy}>Create code</Button>
        </Stack>
      </Box>
      {links.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Business</TableCell>
              <TableCell>Label</TableCell>
              <TableCell>Responses</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell>{link.hotelName || 'Any'}</TableCell>
                <TableCell>{link.label || '—'}</TableCell>
                <TableCell>{link.responseCount}</TableCell>
                <TableCell><Switch checked={link.isActive} onChange={(e) => void toggle(link, e.target.checked)} /></TableCell>
                <TableCell align="right"><Button size="small" startIcon={<QrCode2Icon />} onClick={() => void showQr(link)}>QR code</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(qr)} onClose={() => setQr(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Testimonial QR code{qr?.link.hotelName ? ` · ${qr.link.hotelName}` : ''}</DialogTitle>
        {qr && (
          <DialogContent sx={{ textAlign: 'center' }}>
            <Box component="img" src={qr.dataUrl} alt="Testimonial QR code" sx={{ width: 260, maxWidth: '100%' }} />
            <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-all', textTransform: 'none', mt: 1 }}>{qr.link.url}</Typography>
            {qr.link.hotelEmail && <Typography variant="body2" sx={{ mt: 1 }}>Owner's email: {qr.link.hotelEmail}</Typography>}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => qr && void navigator.clipboard?.writeText(qr.link.url)}>Copy link</Button>
          {qr && <Button component="a" href={qr.dataUrl} download={`testimonial-qr-${qr.link.code}.png`}>Download</Button>}
          <Button variant="contained" onClick={() => setQr(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TestimonialQrPanel;
