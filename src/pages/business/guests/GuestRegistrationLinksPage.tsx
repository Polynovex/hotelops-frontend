import { useCallback, useEffect, useState } from 'react';
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
  Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import BlockIcon from '@mui/icons-material/Block';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Layout from '../../../components/Layout';
import RowActionsMenu from '../../../components/common/RowActionsMenu';
import guestService, { type GuestRegistrationLink } from '../../../services/guest.service';

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;

/**
 * QR codes that let guests fill in their own details. Print one for the
 * reception desk, put one in the room folder, or attach one to an arrival email.
 */
const GuestRegistrationLinksPage = () => {
  const [links, setLinks] = useState<GuestRegistrationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const [qrPreview, setQrPreview] = useState<{ dataUrl: string; url: string; label: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GuestRegistrationLink | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await guestService.listLinks());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load registration links'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      await guestService.createLink({ label: label.trim() || undefined });
      setToast('Registration code created');
      setLabel('');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the registration code'));
    } finally {
      setCreating(false);
    }
  };

  const copy = async (link: GuestRegistrationLink) => {
    try {
      await navigator.clipboard.writeText(link.registrationUrl);
      setToast('Link copied');
    } catch {
      setError('Could not copy — your browser blocked clipboard access.');
    }
  };

  const showQr = async (link: GuestRegistrationLink) => {
    try {
      const qr = await guestService.getLinkQr(link.id);
      setQrPreview({ ...qr, label: link.label || link.code });
    } catch (err) {
      setError(errorMessage(err, 'Could not load the QR code'));
    }
  };

  const toggleActive = async (link: GuestRegistrationLink) => {
    try {
      await guestService.updateLink(link.id, { isActive: !link.isActive });
      setToast(link.isActive ? 'Code deactivated' : 'Code reactivated');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the code'));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    try {
      await guestService.deleteLink(pendingDelete.id);
      setToast('Registration code deleted');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the code'));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Guest Self-Registration</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Generate a QR code guests can scan to enter their own details before arrival.
          Their record lands in the guest book ready for reception to verify.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Label (optional)"
              placeholder="e.g. Reception desk, Room folder"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              fullWidth
              helperText="Helps you tell codes apart when you have several in use."
            />
            <Button
              variant="contained"
              onClick={() => void create()}
              disabled={creating}
              sx={{ minWidth: { md: 200 }, height: 56 }}
            >
              {creating ? 'Generating…' : 'Generate code'}
            </Button>
          </Stack>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">Registrations</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && links.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No registration codes yet. Generate one above.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading && links.map((link) => (
                <TableRow key={link.id} hover>
                  <TableCell>{link.label || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">{link.code}</Typography>
                  </TableCell>
                  <TableCell align="right">{link.useCount}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={link.isActive ? 'Active' : 'Inactive'}
                      color={link.isActive ? 'success' : 'default'}
                      variant={link.isActive ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <RowActionsMenu
                      subject={link.label || link.code}
                      actions={[
                        {
                          key: 'qr',
                          label: 'Show QR code',
                          icon: <QrCode2Icon fontSize="small" />,
                          onClick: () => void showQr(link)
                        },
                        {
                          key: 'copy',
                          label: 'Copy link',
                          icon: <ContentCopyIcon fontSize="small" />,
                          onClick: () => void copy(link)
                        },
                        {
                          key: 'reactivate',
                          label: 'Reactivate',
                          icon: <RestartAltIcon fontSize="small" />,
                          hidden: link.isActive,
                          onClick: () => void toggleActive(link)
                        },
                        {
                          key: 'deactivate',
                          label: 'Deactivate',
                          icon: <BlockIcon fontSize="small" />,
                          hidden: !link.isActive,
                          destructive: true,
                          onClick: () => void toggleActive(link)
                        },
                        {
                          key: 'delete',
                          label: 'Delete code',
                          icon: <DeleteOutlineIcon fontSize="small" />,
                          destructive: true,
                          onClick: () => setPendingDelete(link)
                        }
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={Boolean(qrPreview)} onClose={() => setQrPreview(null)}>
          <DialogTitle>{qrPreview?.label}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
              {qrPreview && (
                <Box
                  component="img"
                  src={qrPreview.dataUrl}
                  alt="Guest registration QR code"
                  sx={{ width: 260, height: 260 }}
                />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {qrPreview?.url}
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Print this and place it where guests check in. Use your browser's print
                function to produce a copy.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setQrPreview(null)}>Close</Button>
            <Button variant="contained" onClick={() => window.print()}>Print</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
          <DialogTitle>Delete this registration code?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Any printed copy of <strong>{pendingDelete?.label || pendingDelete?.code}</strong>{' '}
              will stop working. Guests already registered through it are unaffected.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              To pause it temporarily, deactivate instead — you can turn it back on later.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void confirmDelete()}>
              Delete code
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
    </Layout>
  );
};

export default GuestRegistrationLinksPage;
