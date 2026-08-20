import Layout from '../../components/Layout';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, Paper, Rating, Snackbar, Stack,
  Switch, TextField, Tooltip, Typography, FormControlLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { api } from '../../services/api';
import { EmptyState, MetricCard, PageHeader } from '../../components/premium';

interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string | null;
  hotelName: string | null;
  location: string | null;
  rating: number | null;
  avatarUrl: string | null;
  logoUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  consentedAt: string | null;
}

const BLANK = {
  quote: '', authorName: '', authorRole: '', hotelName: '', location: '',
  rating: 5 as number | null, avatarUrl: '', logoUrl: '',
  isPublished: false, sortOrder: 0, consentedAt: ''
};

/**
 * Testimonial management. Publishing quotes a real person by name in public,
 * so the form requires a recorded consent date before anything can go live —
 * the API enforces the same rule.
 */
const Testimonials = () => {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [counts, setCounts] = useState({ total: 0, published: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Testimonial | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/testimonials');
      setItems(Array.isArray(data?.testimonials) ? data.testimonials : []);
      setCounts(data?.counts ?? { total: 0, published: 0, draft: 0 });
      setError('');
    } catch (err: unknown) {
      const r = (err as { response?: { data?: { error?: string } } }).response;
      setError(r?.data?.error || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setEditingId(null); setForm({ ...BLANK }); setOpen(true); };

  const openEdit = (t: Testimonial) => {
    setEditingId(t.id);
    setForm({
      quote: t.quote, authorName: t.authorName, authorRole: t.authorRole ?? '',
      hotelName: t.hotelName ?? '', location: t.location ?? '', rating: t.rating,
      avatarUrl: t.avatarUrl ?? '', logoUrl: t.logoUrl ?? '',
      isPublished: t.isPublished, sortOrder: t.sortOrder,
      consentedAt: t.consentedAt ? t.consentedAt.slice(0, 10) : ''
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.quote.trim() || !form.authorName.trim()) {
      setError('A quote and an author name are required');
      return;
    }
    if (form.isPublished && !form.consentedAt) {
      setError('Record the consent date before publishing');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, consentedAt: form.consentedAt || null };
      if (editingId) await api.put(`/admin/testimonials/${editingId}`, payload);
      else await api.post('/admin/testimonials', payload);
      setToast(editingId ? 'Testimonial updated' : 'Testimonial added');
      setOpen(false);
      await load();
    } catch (err: unknown) {
      const r = (err as { response?: { data?: { error?: string } } }).response;
      setError(r?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (t: Testimonial) => {
    if (!t.isPublished && !t.consentedAt) {
      setError(`Record a consent date for ${t.authorName} before publishing`);
      return;
    }
    try {
      await api.put(`/admin/testimonials/${t.id}`, { ...t, isPublished: !t.isPublished });
      setToast(t.isPublished ? 'Unpublished' : 'Published to the website');
      await load();
    } catch (err: unknown) {
      const r = (err as { response?: { data?: { error?: string } } }).response;
      setError(r?.data?.error || 'Could not change publication state');
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await api.delete(`/admin/testimonials/${pendingDelete.id}`);
      setToast('Testimonial deleted');
      await load();
    } catch {
      setError('Could not delete');
    } finally {
      setPendingDelete(null);
    }
  };

  const set = (k: keyof typeof BLANK, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Testimonials"
        subtitle="Published entries appear on the website automatically — no code change needed."
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add testimonial</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><MetricCard label="Total" value={counts.total} icon={<FormatQuoteIcon />} variant="navy" /></Grid>
        <Grid item xs={12} sm={4}><MetricCard label="Live on website" value={counts.published} variant="tinted" /></Grid>
        <Grid item xs={12} sm={4}><MetricCard label="Drafts" value={counts.draft} detail="Not visible publicly" /></Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '30vh' }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <EmptyState
            icon={<FormatQuoteIcon />}
            title="No testimonials yet"
            description="Add one here and it appears on the website as soon as you publish it."
            action={<Button variant="contained" onClick={openNew}>Add the first one</Button>}
          />
        </Paper>
      ) : (
        <Stack spacing={2}>
          {items.map((t) => (
            <Paper key={t.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip size="small" label={t.isPublished ? 'Live' : 'Draft'} color={t.isPublished ? 'success' : 'default'} />
                    {t.rating ? <Rating size="small" value={t.rating} readOnly /> : null}
                    {!t.consentedAt && (
                      <Tooltip title="Consent not recorded — cannot be published">
                        <Chip size="small" label="No consent" color="warning" variant="outlined" />
                      </Tooltip>
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1 }}>“{t.quote}”</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[t.authorName, t.authorRole, t.hotelName, t.location].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <FormControlLabel
                    control={<Switch checked={t.isPublished} onChange={() => void togglePublish(t)} />}
                    label="Live"
                  />
                  <IconButton onClick={() => openEdit(t)} aria-label={`Edit ${t.authorName}`}><EditIcon /></IconButton>
                  <IconButton color="error" onClick={() => setPendingDelete(t)} aria-label={`Delete ${t.authorName}`}><DeleteIcon /></IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit testimonial' : 'Add testimonial'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Quote" value={form.quote} onChange={(e) => set('quote', e.target.value)} fullWidth required multiline minRows={3} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Author name" value={form.authorName} onChange={(e) => set('authorName', e.target.value)} fullWidth required />
              <TextField label="Role" value={form.authorRole} onChange={(e) => set('authorRole', e.target.value)} fullWidth placeholder="General Manager" />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Hotel" value={form.hotelName} onChange={(e) => set('hotelName', e.target.value)} fullWidth />
              <TextField label="Location" value={form.location} onChange={(e) => set('location', e.target.value)} fullWidth placeholder="Lagos, Nigeria" />
            </Stack>
            <Box>
              <Typography variant="body2" gutterBottom>Rating</Typography>
              <Rating value={form.rating} onChange={(_e, v) => set('rating', v)} />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Avatar URL" value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} fullWidth />
              <TextField label="Hotel logo URL" value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Consent given on" type="date" value={form.consentedAt}
                onChange={(e) => set('consentedAt', e.target.value)} fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Required before publishing"
              />
              <TextField label="Sort order" type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} fullWidth helperText="Lower shows first" />
            </Stack>
            <FormControlLabel
              control={<Switch checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)} />}
              label="Publish to the website"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this testimonial?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This permanently removes the quote from <strong>{pendingDelete?.authorName}</strong>.
            To take it off the website without deleting it, switch it to draft instead.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void remove()}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Container>
  );
};

const TestimonialsWithLayout = () => (<Layout><Testimonials /></Layout>);
export default TestimonialsWithLayout;
