import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,

  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import { accountingService, FixedAsset } from '../../../services/api';

const FixedAssetsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [form, setForm] = useState({ assetCode: '', assetName: '', category: 'Equipment', purchaseCost: '0' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setAssets(await accountingService.getFixedAssets());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createAsset = async (event: FormEvent) => {
    event.preventDefault();
    await accountingService.createFixedAsset({
      assetCode: form.assetCode,
      assetName: form.assetName,
      category: form.category,
      purchaseDate: new Date().toISOString(),
      purchaseCost: Number(form.purchaseCost || 0),
      depreciationMethod: 'STRAIGHT_LINE',
      usefulLifeYears: 10
    });
    setForm({ assetCode: '', assetName: '', category: 'Equipment', purchaseCost: '0' });
    await load();
  };

  const depreciate = async (assetId: string) => {
    await accountingService.depreciateFixedAsset(assetId);
    await load();
  };

  const dispose = async (assetId: string) => {
    await accountingService.disposeFixedAsset(assetId, { disposalAmount: 0 });
    await load();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Fixed Assets</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Register, depreciate, and dispose assets through v3 endpoints.</Typography>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box component="form" onSubmit={createAsset}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Asset Code" value={form.assetCode} onChange={(e) => setForm((prev) => ({ ...prev, assetCode: e.target.value }))} required />
              <TextField label="Asset Name" value={form.assetName} onChange={(e) => setForm((prev) => ({ ...prev, assetName: e.target.value }))} required />
              <TextField label="Category" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} required />
              <TextField type="number" label="Purchase Cost" value={form.purchaseCost} onChange={(e) => setForm((prev) => ({ ...prev, purchaseCost: e.target.value }))} required />
              <Button type="submit" variant="contained">Add Asset</Button>
            </Stack>
          </Box>
        </Paper>

        <Paper>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Purchase</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Current Value</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id} hover>
                  <TableCell>{asset.assetCode}</TableCell>
                  <TableCell>{asset.assetName}</TableCell>
                  <TableCell>{asset.category}</TableCell>
                  <TableCell>₦{Number(asset.purchaseCost).toLocaleString()}</TableCell>
                  <TableCell>₦{Number(asset.currentValue).toLocaleString()}</TableCell>
                  <TableCell>{asset.status}</TableCell>
                  <TableCell>
                    {asset.status === 'ACTIVE' ? (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => void depreciate(asset.id)}>Depreciate</Button>
                        <Button size="small" color="error" onClick={() => void dispose(asset.id)}>Dispose</Button>
                      </Stack>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Container>
    </Layout>
  );
};

export default FixedAssetsPage;
