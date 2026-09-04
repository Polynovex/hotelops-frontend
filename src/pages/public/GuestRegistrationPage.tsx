import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  publicGuestService,
  type GuestRegistrationInput,
  type RegistrationContext
} from '../../services/guest.service';

const ID_TYPES = [
  'National ID (NIN)',
  "Driver's Licence",
  'International Passport',
  'Voter Card',
  'Other'
];

const REQUIRED_FIELDS: Array<keyof GuestRegistrationInput> = ['firstName', 'lastName', 'phone'];

/**
 * Guest self-registration, reached by scanning a printed QR code.
 *
 * The audience is a guest on their own phone, possibly on a slow connection and
 * standing at a desk — so the form is single-column, asks for the minimum, and
 * never mentions anything about the hotel's guest book.
 */
const GuestRegistrationPage = () => {
  const { code = '' } = useParams();

  const [context, setContext] = useState<RegistrationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState('');

  const [form, setForm] = useState<GuestRegistrationInput>({
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const setField = (field: keyof GuestRegistrationInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContext(await publicGuestService.getContext(code));
      setLinkError('');
    } catch {
      setLinkError('This registration link is no longer active. Please ask reception for a new one.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const missing = REQUIRED_FIELDS.filter((field) => !form[field]?.trim());
    if (missing.length > 0) {
      setError('Please fill in your first name, last name, and phone number.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await publicGuestService.submit(code, form);
      setSubmitted(true);
    } catch (err) {
      const response = (err as {
        response?: { status?: number; data?: { issues?: Array<{ message: string }> } };
      }).response;

      if (response?.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (response?.data?.issues?.length) {
        setError(response.data.issues[0].message);
      } else {
        setError('We could not save your details. Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (linkError) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">{linkError}</Alert>
      </Container>
    );
  }

  if (submitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Thank you
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your details have been sent to {context?.hotelName}. Reception will have
            everything ready when you arrive — no need to fill in a form at the desk.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Stack spacing={1} sx={{ mb: 3, textAlign: 'center' }}>
          {/* Platform branding; the hotel name below identifies who is asking. */}
          <Box
            component="img"
            src="/logo.png"
            alt="HotelOpX"
            sx={{ height: 44, objectFit: 'contain', mx: 'auto', mb: 1 }}
          />
          <Typography variant="h5" fontWeight={700}>
            {context?.hotelName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {context?.label || 'Please share your details so we can prepare your arrival.'}
          </Typography>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={submit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="First name"
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                fullWidth
                required
                autoComplete="given-name"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Last name"
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                fullWidth
                required
                autoComplete="family-name"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Phone number"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                fullWidth
                required
                type="tel"
                autoComplete="tel"
                placeholder="08012345678"
                helperText="We use this to find your booking."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email (optional)"
                value={form.email ?? ''}
                onChange={(e) => setField('email', e.target.value)}
                fullWidth
                type="email"
                autoComplete="email"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Identification (optional)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="ID type"
                value={form.idType ?? ''}
                onChange={(e) => setField('idType', e.target.value)}
                fullWidth
              >
                {ID_TYPES.map((entry) => (
                  <MenuItem key={entry} value={entry}>{entry}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="ID number"
                value={form.idNumber ?? ''}
                onChange={(e) => setField('idNumber', e.target.value)}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Address (optional)"
                value={form.address ?? ''}
                onChange={(e) => setField('address', e.target.value)}
                fullWidth
                multiline
                rows={2}
                autoComplete="street-address"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="City"
                value={form.city ?? ''}
                onChange={(e) => setField('city', e.target.value)}
                fullWidth
                autoComplete="address-level2"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nationality"
                value={form.nationality ?? ''}
                onChange={(e) => setField('nationality', e.target.value)}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitting}
                sx={{ mt: 1 }}
              >
                {submitting ? 'Sending…' : 'Submit my details'}
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 3, textAlign: 'center' }}
        >
          Your details are shared only with {context?.hotelName} to prepare your stay,
          and are held in line with their privacy policy.
        </Typography>
      </Paper>
    </Container>
  );
};

export default GuestRegistrationPage;
