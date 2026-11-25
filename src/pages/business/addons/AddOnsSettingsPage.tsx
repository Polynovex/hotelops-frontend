import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import { api } from '../../../services/api';
import { formatNaira } from '../../../services/hr.service';
import { apiError } from '../../../services/payments';
import {
  DEPARTMENTS,
  departmentLabel,
  guestExtrasApi,
  type AddOnScope,
  type AvailableAddOns,
  type GuestExtra,
  type GuestExtraInput
} from '../../../services/guestExtras';

/**
 * Settings → Add-ons (Business Admin and GM).
 *
 *  - Property add-ons: the facilities switched on for the business, each run
 *    by one department and sold through its outlet in the POS.
 *  - Guest add-ons: the hotel's guest extras (breakfast, late check-out,
 *    extra bed...). Front desk adds them to a stay; they go on the bill.
 *  - Staff access: which add-on categories a person may work with beyond
 *    their own department.
 */

const EMPTY: GuestExtraInput = { name: '', description: '', price: 0, pricing: 'PER_STAY', responsibleDepartment: 'FRONT_DESK' };

type StaffUser = { id: string; firstName: string; lastName: string; department?: string | null; role: string; roleName?: string | null };

const AddOnsSettingsPage = () => {
  const [tab, setTab] = useState<'PROPERTY' | 'GUEST' | 'ACCESS'>('PROPERTY');
  const [available, setAvailable] = useState<AvailableAddOns | null>(null);
  const [extras, setExtras] = useState<GuestExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [editing, setEditing] = useState<(GuestExtraInput & { id?: string }) | null>(null);

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [userId, setUserId] = useState('');
  const [grants, setGrants] = useState<Array<{ scope: AddOnScope; department: string }>>([]);
  const [ownDepartment, setOwnDepartment] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([guestExtrasApi.available(), guestExtrasApi.list(true)]);
      setAvailable(a);
      setExtras(e);
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, 'Could not load add-ons.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/users').then(({ data }) => setUsers((Array.isArray(data) ? data : []).filter((u: StaffUser) => u.role !== 'BUSINESS_ADMIN' && u.role !== 'SUPER_ADMIN'))).catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    guestExtrasApi
      .access(userId)
      .then((data) => {
        setGrants(data.grants);
        setOwnDepartment(data.ownDepartment);
      })
      .catch((err) => setMessage({ type: 'error', text: apiError(err, 'Could not load access.') }));
  }, [userId]);

  const save = async () => {
    if (!editing) return;
    try {
      const { id, ...input } = editing;
      const payload = { ...input, price: Number(input.price) };
      if (id) await guestExtrasApi.update(id, payload);
      else await guestExtrasApi.create(payload);
      setEditing(null);
      setMessage({ type: 'success', text: `${input.name} saved.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, 'Could not save the extra.') });
    }
  };

  const remove = async (extra: GuestExtra) => {
    try {
      const result = await guestExtrasApi.remove(extra.id);
      setMessage({ type: result.deactivated ? 'info' : 'success', text: result.message ?? `${extra.name} deleted.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, 'Could not delete the extra.') });
    }
  };

  const toggleGrant = (scope: AddOnScope, department: string) =>
    setGrants((current) =>
      current.some((g) => g.scope === scope && g.department === department)
        ? current.filter((g) => !(g.scope === scope && g.department === department))
        : [...current, { scope, department }]
    );

  const saveAccess = async () => {
    try {
      await guestExtrasApi.setAccess(userId, grants);
      setMessage({ type: 'success', text: 'Add-on access saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, 'Could not save access.') });
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700}>Add-ons</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Property add-ons are facilities your hotel runs. Guest add-ons are extras sold to a stay and charged to the guest’s bill. Staff see the add-ons of their own department.
        </Typography>
        {message && <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="PROPERTY" label="Property add-ons" />
          <Tab value="GUEST" label="Guest add-ons" />
          <Tab value="ACCESS" label="Staff access" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : tab === 'PROPERTY' ? (
          available?.property.length ? (
            <Grid container spacing={2}>
              {available.property.map((group) => (
                <Grid item xs={12} md={6} key={group.department}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">{group.label}</Typography>
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {group.items.map((item) => (
                          <Stack key={item.code} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography fontWeight={600}>{item.name}</Typography>
                            {item.outletId ? (
                              <Button size="small" href={`/business/add-ons/${item.code.toLowerCase()}`}>Open</Button>
                            ) : (
                              <Chip size="small" label="Feature" variant="outlined" />
                            )}
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">No property add-ons are switched on for your business. Ask HotelOpX to add the spa, pool, gym, laundry or events.</Alert>
          )
        ) : tab === 'GUEST' ? (
          <>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
              <Button variant="contained" onClick={() => setEditing({ ...EMPTY })}>New guest add-on</Button>
            </Stack>
            <Card variant="outlined">
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Charged</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {extras.length === 0 && (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No guest add-ons yet. Add breakfast, late check-out or an extra bed.</TableCell></TableRow>
                    )}
                    {extras.map((extra) => (
                      <TableRow key={extra.id} hover>
                        <TableCell>
                          <Typography fontWeight={600}>{extra.name}</Typography>
                          {extra.description && <Typography variant="caption" color="text.secondary">{extra.description}</Typography>}
                        </TableCell>
                        <TableCell>{departmentLabel(extra.responsibleDepartment)}</TableCell>
                        <TableCell>{extra.pricing === 'PER_NIGHT' ? 'Per night' : 'Once per stay'}</TableCell>
                        <TableCell align="right">{formatNaira(extra.price)}</TableCell>
                        <TableCell>
                          <Chip size="small" color={extra.isActive ? 'success' : 'default'} label={extra.isActive ? 'Active' : 'Inactive'} />
                          {Boolean(extra.activeOnStays) && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>on {extra.activeOnStays} stay(s)</Typography>}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setEditing({ id: extra.id, name: extra.name, description: extra.description, price: extra.price, pricing: extra.pricing, responsibleDepartment: extra.responsibleDepartment, isActive: extra.isActive })}>Edit</Button>
                          <Button size="small" color="error" onClick={() => remove(extra)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </>
        ) : (
          <Card variant="outlined">
            <CardContent>
              <TextField select fullWidth label="Staff member" value={userId} onChange={(e) => setUserId(e.target.value)} sx={{ mb: 2, maxWidth: 420 }}>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`.trim()} — {u.roleName ?? u.role.replace(/_/g, ' ').toLowerCase()}</MenuItem>
                ))}
              </TextField>
              {userId && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {ownDepartment ? `Already sees the add-ons of ${departmentLabel(ownDepartment)} (their department).` : 'This person has no department set.'} Tick any other categories they should work with.
                  </Alert>
                  <Grid container spacing={2}>
                    {(['PROPERTY', 'GUEST'] as AddOnScope[]).map((scope) => (
                      <Grid item xs={12} md={6} key={scope}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{scope === 'PROPERTY' ? 'Property add-ons' : 'Guest add-ons'}</Typography>
                        <Stack>
                          {DEPARTMENTS.map((d) => (
                            <FormControlLabel
                              key={d.value}
                              control={<Checkbox size="small" checked={d.value === ownDepartment || grants.some((g) => g.scope === scope && g.department === d.value)} disabled={d.value === ownDepartment} onChange={() => toggleGrant(scope, d.value)} />}
                              label={d.label}
                            />
                          ))}
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                  <Button variant="contained" sx={{ mt: 2 }} onClick={saveAccess}>Save access</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{editing?.id ? 'Edit guest add-on' : 'New guest add-on'}</DialogTitle>
          {editing && (
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="Name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <TextField label="Description" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <Stack direction="row" spacing={2}>
                  <TextField label="Price (₦)" type="number" fullWidth value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
                  <TextField select label="Charged" fullWidth value={editing.pricing} onChange={(e) => setEditing({ ...editing, pricing: e.target.value as GuestExtraInput['pricing'] })}>
                    <MenuItem value="PER_STAY">Once per stay</MenuItem>
                    <MenuItem value="PER_NIGHT">Per night</MenuItem>
                  </TextField>
                </Stack>
                <TextField select label="Department that provides it" value={editing.responsibleDepartment} onChange={(e) => setEditing({ ...editing, responsibleDepartment: e.target.value })}>
                  {DEPARTMENTS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
                {editing.id && (
                  <FormControlLabel control={<Switch checked={editing.isActive !== false} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />} label="Active (can be added to stays)" />
                )}
              </Stack>
            </DialogContent>
          )}
          <DialogActions>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="contained" disabled={!editing || editing.name.trim().length < 2} onClick={save}>Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default AddOnsSettingsPage;
