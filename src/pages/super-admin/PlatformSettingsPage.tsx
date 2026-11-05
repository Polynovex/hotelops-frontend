import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import Layout from '../../components/Layout';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * HotelOpX-wide settings. For now: who is emailed when a demo request comes
 * in from the website. Addresses can be added or removed at any time; the
 * change applies to the next request.
 */
const PlatformSettingsPage = () => {
  const [saved, setSaved] = useState<string[]>([]);
  const [list, setList] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api
      .get('/admin/settings/demo-recipients')
      .then(({ data }) => {
        setSaved(data.recipients);
        setList(data.recipients);
      })
      .catch((err) => setMessage({ kind: 'error', text: getApiErrorMessage(err, 'Could not load the settings') }));
  }, []);

  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      setMessage({ kind: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (!list.includes(email)) setList([...list, email]);
    setDraft('');
    setMessage(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/admin/settings/demo-recipients', { recipients: list });
      setSaved(data.recipients);
      setList(data.recipients);
      setMessage({ kind: 'success', text: 'Saved. The next demo request goes to these addresses.' });
    } catch (err) {
      setMessage({ kind: 'error', text: getApiErrorMessage(err, 'Could not save') });
    } finally {
      setBusy(false);
    }
  };

  const changed = list.length !== saved.length || list.some((e) => !saved.includes(e));

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700}>Settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Settings that apply across HotelOpX.
        </Typography>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700}>Demo request notifications</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Everyone here receives one email for each demo request from the website, so replies stay in one thread. Add or remove addresses whenever the team changes.
          </Typography>
          {message && <Alert severity={message.kind} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {list.map((email) => (
              <Chip
                key={email}
                label={email}
                onDelete={list.length > 1 ? () => setList(list.filter((e) => e !== email)) : undefined}
                variant={saved.includes(email) ? 'outlined' : 'filled'}
                color={saved.includes(email) ? 'default' : 'primary'}
              />
            ))}
            {!list.length && <Typography variant="body2" color="text.secondary">No addresses yet.</Typography>}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              type="email"
              label="Add an email address"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              sx={{ flex: 1 }}
            />
            <Button startIcon={<AddRounded />} onClick={add} disabled={!draft.trim()}>Add</Button>
            <Button variant="contained" onClick={() => void save()} disabled={busy || !changed || !list.length}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            At least one address must stay, so no lead goes unseen.
          </Typography>
        </Paper>
      </Container>
    </Layout>
  );
};

export default PlatformSettingsPage;
