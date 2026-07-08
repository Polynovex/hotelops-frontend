import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AddRounded,
  AutorenewRounded,
  ContentCopyRounded,
  DeleteOutlineRounded,
  EditRounded,
  EventAvailableRounded,
  LocalOfferRounded,
  PercentRounded,
  ShieldRounded,
  TrendingUpRounded
} from '@mui/icons-material';
import { Promotion, PromotionPayload, promotionService } from '../../services/discount.service';
import Layout from '../../components/Layout';
import LogoLoader from '../../components/LogoLoader';

const emptyDraft: Partial<PromotionPayload> = {
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  value: 10,
  scope: 'RECEIVER',
  startsAt: new Date().toISOString().slice(0, 10),
  requiresApproval: false,
  isActive: true
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const isLive = (p: Promotion) => {
  const now = new Date();
  if (!p.isActive) return false;
  if (new Date(p.startsAt) > now) return false;
  if (p.endsAt && new Date(p.endsAt) < now) return false;
  if (p.maxRedemptions && p.redemptionCount >= p.maxRedemptions) return false;
  return true;
};

const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'default' | 'gold' | 'navy';
}> = ({ label, value, icon, tone = 'default' }) => {
  const theme = useTheme();
  const bg =
    tone === 'gold'
      ? `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`
      : tone === 'navy'
        ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.light} 100%)`
        : undefined;
  const fg = tone === 'default' ? theme.palette.text.primary : tone === 'gold' ? theme.palette.primary.main : '#fff';
  const labelFg = tone === 'default' ? theme.palette.text.secondary : alpha(fg, 0.7);

  return (
    <Card sx={{ backgroundImage: bg, color: fg, border: tone === 'default' ? undefined : 'none', boxShadow: tone === 'default' ? undefined : '0 18px 40px rgba(15, 42, 68, 0.2)' }}>
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.2}>
          <Typography variant="caption" sx={{ color: labelFg, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            {label}
          </Typography>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              background: tone === 'default' ? alpha(theme.palette.secondary.main, 0.16) : alpha('#fff', 0.18),
              color: tone === 'default' ? theme.palette.secondary.dark : '#fff'
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="h3" sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 700, lineHeight: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};

const PromotionsAdmin: React.FC = () => {
  const theme = useTheme();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<(Partial<Promotion> & Partial<PromotionPayload>) | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPromos(await promotionService.list());
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = promos.filter(isLive).length;
    const totalRedemptions = promos.reduce((s, p) => s + (p.redemptionCount || 0), 0);
    return { total: promos.length, active, totalRedemptions };
  }, [promos]);

  const save = async () => {
    if (!editing) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: editing.code!,
        name: editing.name!,
        description: editing.description,
        discountType: editing.discountType!,
        value: Number(editing.value),
        scope: editing.scope!,
        startsAt: editing.startsAt!,
        endsAt: editing.endsAt || undefined,
        maxRedemptions: editing.maxRedemptions ? Number(editing.maxRedemptions) : undefined,
        minOrderAmount: editing.minOrderAmount ? Number(editing.minOrderAmount) : undefined,
        requiresApproval: !!editing.requiresApproval,
        isActive: editing.isActive !== false
      };
      if (editing.id) {
        await promotionService.update(editing.id, payload);
      } else {
        await promotionService.create(payload);
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!window.confirm('Deactivate this promotion? It will no longer apply at the POS.')) return;
    await promotionService.deactivate(id);
    await load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" mb={3}>
          <Box>
            <Typography variant="caption">POS · Marketing</Typography>
            <Typography variant="h2" sx={{ fontFamily: '"Cormorant Garamond", serif' }}>
              Promotions
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 540 }}>
              Create receiver-level or item-level discounts that staff can apply at the POS. Promotions requiring
              manager approval ask for the manager's usercode at checkout.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} mt={{ xs: 2, sm: 0 }}>
            <IconButton onClick={load} title="Refresh">
              <AutorenewRounded />
            </IconButton>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditing(emptyDraft)}>
              New promotion
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
            mb: 3
          }}
        >
          <StatTile label="Total" value={stats.total} icon={<LocalOfferRounded fontSize="small" />} tone="navy" />
          <StatTile label="Live now" value={stats.active} icon={<EventAvailableRounded fontSize="small" />} tone="gold" />
          <StatTile label="Redemptions" value={stats.totalRedemptions} icon={<TrendingUpRounded fontSize="small" />} />
        </Box>

        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <LogoLoader inline minHeight={260} label="Loading promotions" />
            ) : promos.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
                <Avatar sx={{ width: 56, height: 56, mx: 'auto', mb: 2, bgcolor: alpha(theme.palette.secondary.main, 0.18), color: theme.palette.secondary.dark }}>
                  <LocalOfferRounded />
                </Avatar>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  No promotions yet
                </Typography>
                <Typography variant="body2" sx={{ maxWidth: 380, mx: 'auto', mb: 3 }}>
                  Launch your first promotion — happy hour, repeat-guest discount, NYE special. Active promotions
                  appear instantly in the POS discount picker.
                </Typography>
                <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditing(emptyDraft)}>
                  Create first promotion
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Discount</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Window</TableCell>
                      <TableCell>Used</TableCell>
                      <TableCell>Approval</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {promos.map((p) => {
                      const live = isLive(p);
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography className="mono" fontWeight={700}>
                                {p.code}
                              </Typography>
                              <Tooltip title={copied === p.code ? 'Copied' : 'Copy'}>
                                <IconButton size="small" onClick={() => copyCode(p.code)}>
                                  <ContentCopyRounded fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {p.name}
                            </Typography>
                            {p.description ? (
                              <Typography variant="caption" color="text.secondary">
                                {p.description}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={p.discountType === 'PERCENTAGE' ? `${p.value}%` : fmt(p.value)}
                              color="secondary"
                              variant="filled"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={p.scope === 'RECEIVER' ? 'Bill' : 'Items'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" display="block">
                              {new Date(p.startsAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              → {p.endsAt ? new Date(p.endsAt).toLocaleDateString() : 'No end'}
                            </Typography>
                          </TableCell>
                          <TableCell className="mono">
                            {p.redemptionCount}
                            {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}
                          </TableCell>
                          <TableCell>
                            {p.requiresApproval ? (
                              <Chip size="small" icon={<ShieldRounded />} label="Manager" color="warning" />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                None
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={live ? 'Live' : p.isActive ? 'Scheduled' : 'Inactive'}
                              color={live ? 'success' : p.isActive ? 'info' : 'default'}
                              variant="filled"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => setEditing(p)}>
                                <EditRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Deactivate">
                              <IconButton size="small" onClick={() => deactivate(p.id)}>
                                <DeleteOutlineRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>{editing?.id ? 'Edit promotion' : 'New promotion'}</DialogTitle>
          <DialogContent>
            {editing && (
              <Grid container spacing={2} pt={1}>
                <Grid item xs={5}>
                  <TextField
                    fullWidth
                    label="Code"
                    autoFocus
                    placeholder="HAPPYHR"
                    value={editing.code || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })
                    }
                    InputProps={{ sx: { fontFamily: '"JetBrains Mono", monospace' } }}
                  />
                </Grid>
                <Grid item xs={7}>
                  <TextField
                    fullWidth
                    label="Name"
                    placeholder="Happy Hour 50%"
                    value={editing.name || ''}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    placeholder="Visible at POS when staff selects this promotion"
                    multiline
                    rows={2}
                    value={editing.description || ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    select
                    fullWidth
                    label="Discount type"
                    value={editing.discountType || 'PERCENTAGE'}
                    onChange={(e) => setEditing({ ...editing, discountType: e.target.value as any })}
                  >
                    <MenuItem value="PERCENTAGE">Percentage</MenuItem>
                    <MenuItem value="FIXED">Fixed amount (₦)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Value"
                    type="number"
                    value={editing.value ?? ''}
                    onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {editing.discountType === 'PERCENTAGE' ? (
                            <PercentRounded fontSize="small" />
                          ) : (
                            <Typography variant="caption">NGN</Typography>
                          )}
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    select
                    fullWidth
                    label="Scope"
                    value={editing.scope || 'RECEIVER'}
                    onChange={(e) => setEditing({ ...editing, scope: e.target.value as any })}
                  >
                    <MenuItem value="RECEIVER">Whole bill (receiver)</MenuItem>
                    <MenuItem value="ITEM">Per-item (selected items only)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Max redemptions"
                    type="number"
                    value={editing.maxRedemptions ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, maxRedemptions: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Starts"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={(editing.startsAt || '').slice(0, 10)}
                    onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Ends"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={(editing.endsAt || '').slice(0, 10)}
                    onChange={(e) => setEditing({ ...editing, endsAt: e.target.value || undefined })}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={6}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Switch
                      checked={!!editing.requiresApproval}
                      onChange={(e) => setEditing({ ...editing, requiresApproval: e.target.checked })}
                    />
                    <Box>
                      <Typography fontWeight={600}>Manager approval</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Requires manager usercode at POS
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Switch
                      checked={editing.isActive !== false}
                      onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                    />
                    <Box>
                      <Typography fontWeight={600}>Active</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Visible at POS
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={save}
              disabled={saving || !editing?.code || !editing?.name || !editing?.value}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {editing?.id ? 'Save changes' : 'Create promotion'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default PromotionsAdmin;
