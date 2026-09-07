import Layout from '../../components/Layout';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, Paper,
  Snackbar, Stack, Switch, TextField, Tooltip, Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '../../services/api';
import { PageHeader } from '../../components/premium';
import { getApiErrorMessage } from '../../utils/apiError';

interface Metric {
  id: string;
  key: string;
  label: string;
  value: string;
  isPublished: boolean;
  sortOrder: number;
}

/**
 * The headline figures on the public website.
 *
 * These used to be literals inside the marketing pages, which meant two
 * things: changing one required a deploy, and — because nobody deploys to
 * correct a number — they drifted a long way from the truth. The site was
 * claiming several hundred hotels while the platform held a handful.
 *
 * Editing is inline rather than behind a dialog. There are only a few figures,
 * each is a single short string, and the point of the screen is to make
 * correcting one take seconds.
 */
const PlatformMetrics = () => {
  const [items, setItems] = useState<Metric[]>([]);
  const [draft, setDraft] = useState<Record<string, { label: string; value: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [adding, setAdding] = useState(false);
  const [newMetric, setNewMetric] = useState({ key: '', label: '', value: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/metrics');
      const rows: Metric[] = Array.isArray(data) ? data : [];
      setItems(rows);
      setDraft(
        Object.fromEntries(rows.map((m) => [m.id, { label: m.label, value: m.value }]))
      );
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the metrics.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (metric: Metric) => {
    const edited = draft[metric.id];
    if (!edited?.value.trim()) {
      setError('A metric needs a value.');
      return;
    }

    setSavingId(metric.id);
    try {
      await api.put(`/admin/metrics/${metric.id}`, {
        label: edited.label.trim(),
        value: edited.value.trim()
      });
      setToast(`${edited.label} updated on the website`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save that figure.'));
    } finally {
      setSavingId(null);
    }
  };

  const togglePublished = async (metric: Metric) => {
    try {
      await api.put(`/admin/metrics/${metric.id}`, { isPublished: !metric.isPublished });
      setToast(metric.isPublished ? 'Hidden from the website' : 'Now shown on the website');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change that.'));
    }
  };

  const remove = async (metric: Metric) => {
    try {
      await api.delete(`/admin/metrics/${metric.id}`);
      setToast('Metric removed');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove that metric.'));
    }
  };

  const create = async () => {
    try {
      await api.post('/admin/metrics', { ...newMetric, sortOrder: items.length });
      setToast('Metric added');
      setAdding(false);
      setNewMetric({ key: '', label: '', value: '' });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add that metric.'));
    }
  };

  const isDirty = (metric: Metric) =>
    draft[metric.id] &&
    (draft[metric.id].label !== metric.label || draft[metric.id].value !== metric.value);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PageHeader
          title="Website metrics"
          subtitle="The headline figures shown on the public site. Changes appear immediately."
          actions={
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
              Add metric
            </Button>
          }
        />

        {error ? (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Alert severity="info" sx={{ mb: 3 }}>
          These numbers are a public claim about the business. Anyone can check
          them, so keep them to figures you could evidence if asked.
        </Alert>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {items.map((metric) => (
              <Paper key={metric.id} variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Label"
                      value={draft[metric.id]?.label ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [metric.id]: { ...draft[metric.id], label: e.target.value }
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Value"
                      value={draft[metric.id]?.value ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [metric.id]: { ...draft[metric.id], value: e.target.value }
                        })
                      }
                      // Free text on purpose: "7", "99.9%" and "24/7" are all
                      // valid figures and none of them is a number.
                      helperText="Shown exactly as typed"
                    />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', color: 'text.secondary', mr: 'auto' }}
                      >
                        {metric.key}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={metric.isPublished}
                            onChange={() => void togglePublished(metric)}
                          />
                        }
                        label={metric.isPublished ? 'Shown' : 'Hidden'}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveIcon />}
                        disabled={!isDirty(metric) || savingId === metric.id}
                        onClick={() => void save(metric)}
                      >
                        {savingId === metric.id ? 'Saving…' : 'Save'}
                      </Button>
                      <Tooltip title="Remove">
                        <IconButton color="error" onClick={() => void remove(metric)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>
        )}

        <Dialog open={adding} onClose={() => setAdding(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add a metric</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Key"
                value={newMetric.key}
                onChange={(e) => setNewMetric({ ...newMetric, key: e.target.value })}
                helperText="Used by the website to find this figure, e.g. rooms_managed"
              />
              <TextField
                label="Label"
                value={newMetric.label}
                onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })}
              />
              <TextField
                label="Value"
                value={newMetric.value}
                onChange={(e) => setNewMetric({ ...newMetric, value: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="contained" onClick={() => void create()}>
              Add
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3000}
          onClose={() => setToast('')}
          message={toast}
        />
      </Container>
    </Layout>
  );
};

export default PlatformMetrics;
