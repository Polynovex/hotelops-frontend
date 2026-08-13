import Layout from '../../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import BlockIcon from '@mui/icons-material/Block';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AddIcon from '@mui/icons-material/Add';
import {
  qrOrderingService,
  type QrCodeRecord,
  type QrOutlet
} from '../../../services/qrOrdering';

const QrCodesPage = () => {
  const [qrCodes, setQrCodes] = useState<QrCodeRecord[]>([]);
  const [outlets, setOutlets] = useState<QrOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const [pendingDeactivate, setPendingDeactivate] = useState<QrCodeRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [codes, outletList] = await Promise.all([
        qrOrderingService.listQrCodes(),
        qrOrderingService.listOutlets()
      ]);
      setQrCodes(codes);
      setOutlets(outletList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!selectedOutlet) {
      return;
    }

    setCreating(true);
    try {
      await qrOrderingService.createQrCode({
        outletId: selectedOutlet,
        label: label.trim() || undefined
      });
      setDialogOpen(false);
      setSelectedOutlet('');
      setLabel('');
      setToast('QR code generated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!pendingDeactivate) {
      return;
    }

    try {
      await qrOrderingService.deactivateQrCode(pendingDeactivate.id);
      setToast(`QR code ${pendingDeactivate.code} deactivated`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate QR code');
    } finally {
      setPendingDeactivate(null);
    }
  };

  const handleReactivate = async (qr: QrCodeRecord) => {
    try {
      await qrOrderingService.reactivateQrCode(qr.id);
      setToast(`QR code ${qr.code} reactivated`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate QR code');
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setToast('Order link copied to clipboard');
    } catch {
      setToast('Could not copy — please copy the link manually');
    }
  };

  /**
   * Fetches the image and saves via an object URL. A plain <a download> does
   * not force a download for cross-origin S3 URLs, and the image may also be
   * an inline data URL when S3 was unavailable at generation time.
   */
  const downloadImage = async (qr: QrCodeRecord) => {
    if (!qr.qrImageUrl) {
      setToast('No image available for this code');
      return;
    }

    try {
      const response = await fetch(qr.qrImageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `qr-${qr.outlet.name.replace(/\s+/g, '-').toLowerCase()}-${qr.code}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(qr.qrImageUrl, '_blank', 'noopener');
    }
  };

  const activeCount = useMemo(() => qrCodes.filter((qr) => qr.isUsable).length, [qrCodes]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            QR Ordering
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate codes customers scan to browse your menu and order directly.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          disabled={outlets.length === 0}
        >
          Generate New QR Code
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {!loading && outlets.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You need at least one active POS outlet before you can generate a QR code.
        </Alert>
      )}

      {!loading && qrCodes.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {activeCount} of {qrCodes.length} code{qrCodes.length === 1 ? '' : 's'} currently active
        </Typography>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>QR</TableCell>
              <TableCell>Outlet</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Orders</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}

            {!loading && qrCodes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <QrCode2Icon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    No QR codes yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generate a code for an outlet, print it, and place it on your tables.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              qrCodes.map((qr) => (
                <TableRow key={qr.id} hover>
                  <TableCell>
                    {qr.qrImageUrl ? (
                      <Box
                        component="img"
                        src={qr.qrImageUrl}
                        alt={`QR code for ${qr.outlet.name}`}
                        sx={{
                          width: 56,
                          height: 56,
                          objectFit: 'contain',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          // Deliberately white in both themes: a QR code needs
                          // a light quiet zone to scan reliably.
                          bgcolor: '#fff'
                        }}
                      />
                    ) : (
                      <QrCode2Icon color="disabled" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {qr.outlet.name}
                    </Typography>
                    {qr.label && (
                      <Typography variant="caption" color="text.secondary">
                        {qr.label}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                      {qr.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={qr.isUsable ? 'Active' : qr.isActive ? 'Expired' : 'Inactive'}
                      color={qr.isUsable ? 'success' : qr.isActive ? 'warning' : 'default'}
                      variant={qr.isUsable ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">{qr.orderCount}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(qr.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Download QR image">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => void downloadImage(qr)}
                            disabled={!qr.qrImageUrl}
                            aria-label={`Download QR code for ${qr.outlet.name}`}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Copy order link">
                        <IconButton
                          size="small"
                          onClick={() => void copyUrl(qr.orderUrl)}
                          aria-label={`Copy order link for ${qr.outlet.name}`}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {qr.isActive ? (
                        <Tooltip title="Deactivate">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setPendingDeactivate(qr)}
                            aria-label={`Deactivate QR code ${qr.code}`}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Reactivate">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => void handleReactivate(qr)}
                            aria-label={`Reactivate QR code ${qr.code}`}
                          >
                            <RestartAltIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generate QR Code</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Outlet"
              value={selectedOutlet}
              onChange={(event) => setSelectedOutlet(event.target.value)}
              fullWidth
              required
              helperText="Customers scanning this code will see this outlet's menu"
            >
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Label (optional)"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              fullWidth
              placeholder="e.g. Table 5, Poolside"
              helperText="Helps you tell printed codes apart"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={!selectedOutlet || creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {creating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingDeactivate)} onClose={() => setPendingDeactivate(null)}>
        <DialogTitle>Deactivate this QR code?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Anyone scanning <strong>{pendingDeactivate?.code}</strong> will no longer be able to
            order. Printed copies stop working immediately. You can reactivate it later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingDeactivate(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeactivate()}>
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

/**
 * Wrapped in Layout so this page carries the same sidebar, header, and
 * page chrome as the rest of the dashboard. Wrapping at the export keeps
 * the loading and error early-returns inside the shell too.
 */
const QrCodesPageWithLayout = () => (
  <Layout>
    <QrCodesPage />
  </Layout>
);

export default QrCodesPageWithLayout;
