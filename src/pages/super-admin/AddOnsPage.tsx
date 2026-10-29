import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  Grid, MenuItem, Stack, Switch, TextField, Typography
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import { useSnackbar } from 'notistack';
import Layout from '../../components/Layout';
import DataTable from '../../components/common/DataTable';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { addOnApi, BEHAVIOR_LABEL, type AddOnRecord, type AddOnInput } from '../../services/addons';
import { getApiErrorMessage } from '../../utils/apiError';

/** Where an add-on's takings go on the USALI-aligned statement. */
const REVENUE_LINES = [
  { key: 'OTHER_OPERATED', label: 'Other operated departments' },
  { key: 'FOOD_BEVERAGE', label: 'Food and beverage' },
  { key: 'ROOMS', label: 'Rooms' },
  { key: 'MISC_INCOME', label: 'Miscellaneous income' }
];
const ICONS = ['extension', 'pool', 'gym', 'spa', 'laundry', 'salon', 'shop', 'car', 'golf', 'kids', 'tour', 'business'];

const blank: AddOnInput = { name: '', description: '', icon: 'extension', monthlyPriceNgn: null, isPublic: true, revenueLine: 'OTHER_OPERATED' };

/**
 * The add-on catalogue. Built-in add-ons (minibar, events, pool, gym, spa,
 * laundry, saloon, retail) are always here. New add-ons are revenue centres:
 * each business that switches one on gets its own POS outlet for it, its
 * services are priced on that outlet's menu, and its takings reach Finance
 * under its own line. Public add-ons show on the website.
 */
const AddOnsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<AddOnRecord[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id?: string; builtIn?: boolean; form: AddOnInput } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await addOnApi.catalogue());
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load add-ons'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const form = { ...editing.form, monthlyPriceNgn: editing.form.monthlyPriceNgn === null || editing.form.monthlyPriceNgn === undefined || Number.isNaN(Number(editing.form.monthlyPriceNgn)) ? null : Number(editing.form.monthlyPriceNgn) };
      if (editing.id) await addOnApi.update(editing.id, form);
      else await addOnApi.create(form);
      enqueueSnackbar(editing.id ? 'Add-on updated' : 'Add-on created', { variant: 'success' });
      setEditing(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not save the add-on'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: AddOnRecord) => {
    try {
      const result = await addOnApi.remove(row.id);
      enqueueSnackbar(result.message ?? `${row.name} deleted`, { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not delete the add-on'), { variant: 'error' });
    }
  };

  const setField = <K extends keyof AddOnInput>(key: K, value: AddOnInput[K]) =>
    setEditing((current) => (current ? { ...current, form: { ...current.form, [key]: value } } : current));

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Add-ons</Typography>
            <Typography variant="body2" color="text.secondary">
              Extras a business can have on top of its products. Switch them on per business under Businesses, then Manage modules.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditing({ form: { ...blank } })} sx={{ alignSelf: { md: 'center' } }}>
            New add-on
          </Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          defaultRowsPerPage={25}
          emptyText="No add-ons yet."
          columns={[
            {
              key: 'name',
              label: 'Add-on',
              minWidth: 220,
              render: (row) => (
                <Box>
                  <Typography fontWeight={700}>{row.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none' }}>{row.description}</Typography>
                </Box>
              )
            },
            { key: 'behavior', label: 'How it works', minWidth: 200, render: (row) => BEHAVIOR_LABEL[row.behavior] },
            { key: 'businesses', label: 'Businesses', minWidth: 100, render: (row) => row.businesses ?? 0 },
            { key: 'price', label: 'Website price', minWidth: 130, render: (row) => (row.monthlyPriceNgn ? `from ₦${row.monthlyPriceNgn.toLocaleString()}/mo` : '—') },
            {
              key: 'status',
              label: 'Status',
              minWidth: 170,
              render: (row) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={row.isBuiltIn ? 'Built-in' : 'Custom'} />
                  {!row.isActive && <Chip size="small" color="default" label="Retired" />}
                  {row.isActive && row.isPublic && <Chip size="small" color="success" variant="outlined" label="On website" />}
                </Stack>
              )
            },
            {
              key: 'actions',
              label: '',
              minWidth: 60,
              render: (row) => (
                <RowActionsMenu
                  subject={row.name}
                  actions={[
                    {
                      key: 'edit',
                      label: 'Edit',
                      onClick: () =>
                        setEditing({
                          id: row.id,
                          builtIn: row.isBuiltIn,
                          form: { name: row.name, description: row.description, icon: row.icon, monthlyPriceNgn: row.monthlyPriceNgn, isPublic: row.isPublic, revenueLine: row.revenueLine, isActive: row.isActive }
                        })
                    },
                    { key: 'delete', label: row.businesses ? 'Retire' : 'Delete', destructive: true, hidden: row.isBuiltIn || !row.isActive, onClick: () => void remove(row) }
                  ]}
                />
              )
            }
          ]}
        />

        <Dialog open={Boolean(editing)} onClose={() => !busy && setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>{editing?.id ? 'Edit add-on' : 'New add-on'}</DialogTitle>
          {editing && (
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {!editing.id && (
                  <Alert severity="info">
                    A new add-on is a revenue centre. Each business that switches it on gets a POS outlet for it, where its services are priced and sold, paid on the spot or billed to a room. Its takings appear in Finance under its own line.
                  </Alert>
                )}
                <TextField label="Name" value={editing.form.name} onChange={(e) => setField('name', e.target.value)} required fullWidth helperText={editing.id ? 'Renaming also renames each business’s outlet for it.' : 'For example: Car Wash, Kids Club, Airport Shuttle'} />
                <TextField label="Description" value={editing.form.description ?? ''} onChange={(e) => setField('description', e.target.value)} fullWidth multiline minRows={2} helperText="Shown to businesses and on the website." />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField select label="Icon" value={editing.form.icon ?? 'extension'} onChange={(e) => setField('icon', e.target.value)} fullWidth>
                      {ICONS.map((icon) => <MenuItem key={icon} value={icon}>{icon}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField select label="Revenue goes to" value={editing.form.revenueLine ?? 'OTHER_OPERATED'} onChange={(e) => setField('revenueLine', e.target.value)} fullWidth>
                      {REVENUE_LINES.map((line) => <MenuItem key={line.key} value={line.key}>{line.label}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Website price (₦/month, optional)"
                      type="number"
                      value={editing.form.monthlyPriceNgn ?? ''}
                      onChange={(e) => setField('monthlyPriceNgn', e.target.value === '' ? null : Number(e.target.value))}
                      fullWidth
                      helperText="Shown as 'from' on the pricing page"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel control={<Switch checked={editing.form.isPublic !== false} onChange={(e) => setField('isPublic', e.target.checked)} />} label="Show on the website" />
                  </Grid>
                </Grid>
              </Stack>
            </DialogContent>
          )}
          <DialogActions>
            <Button onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button variant="contained" onClick={() => void save()} disabled={busy || !editing?.form.name.trim()}>Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default AddOnsPage;
