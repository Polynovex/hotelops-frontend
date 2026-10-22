import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  Rating,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { RATING_LABEL, publicFeedbackApi } from '../../services/feedback';

// Outside the page component so typing doesn't remount the form.
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 3, md: 6 } }}>
    <Container maxWidth="sm">{children}</Container>
  </Box>
);

/**
 * Reached by scanning a QR code. A hotel's code asks guests to rate its
 * services; HotelOpX's testimonial code asks a hotel owner for a few words
 * for the HotelOpX website. No sign-in.
 */
const PublicFeedbackPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [form, setForm] = useState<Awaited<ReturnType<typeof publicFeedbackApi.form>> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [contact, setContact] = useState('');
  const [recommend, setRecommend] = useState<'yes' | 'no' | null>(null);
  const [t, setT] = useState({ authorName: '', authorRole: '', businessName: '', location: '', email: '', quote: '', rating: 5 as number | null, consent: false });
  const [honeypot, setHoneypot] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    publicFeedbackApi
      .form(code)
      .then(setForm)
      .catch(() => setLoadError('This link is not active. Please ask the hotel for a new one.'));
  }, [code]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const payload =
        form?.kind === 'TESTIMONIAL'
          ? {
              authorName: t.authorName.trim(),
              authorRole: t.authorRole.trim() || undefined,
              businessName: t.businessName.trim() || undefined,
              location: t.location.trim() || undefined,
              email: t.email.trim() || undefined,
              quote: t.quote.trim(),
              rating: t.rating ?? undefined,
              consent: t.consent,
              ...(honeypot ? { website: honeypot } : {})
            }
          : {
              ratings: Object.fromEntries(Object.entries(ratings).filter(([, v]) => v != null)),
              comment: comment.trim() || undefined,
              guestName: guestName.trim() || undefined,
              roomNumber: roomNumber.trim() || undefined,
              contact: contact.trim() || undefined,
              ...(recommend ? { wouldRecommend: recommend === 'yes' } : {}),
              ...(honeypot ? { website: honeypot } : {})
            };
      const result = await publicFeedbackApi.submit(code, payload);
      setDone(result.message);
    } catch (err) {
      const data = (err as { response?: { data?: { issues?: Array<{ message: string }>; error?: string } } })?.response?.data;
      setError(data?.issues?.[0]?.message || data?.error || 'Could not send. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <Shell><Alert severity="warning">{loadError}</Alert></Shell>;
  if (!form) return <Shell><Box sx={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box></Shell>;
  if (done) {
    return (
      <Shell>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <CheckCircleRoundedIcon color="success" sx={{ fontSize: 56 }} />
          <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>{done}</Typography>
        </Paper>
      </Shell>
    );
  }

  const isTestimonial = form.kind === 'TESTIMONIAL';
  const ready = isTestimonial ? t.authorName.trim().length >= 2 && t.quote.trim().length >= 20 && t.consent : Boolean(ratings.overall);

  return (
    <Shell>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Box textAlign="center">
            {form.logoUrl && <Box component="img" src={form.logoUrl} alt="" sx={{ height: 56, mb: 1 }} />}
            <Typography variant="h5" fontWeight={800}>
              {isTestimonial ? 'Share your HotelOpX experience' : `How was your stay${form.hotelName ? ` at ${form.hotelName}` : ''}?`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isTestimonial
                ? 'A few words about running your hotel on HotelOpX. With your permission we may quote you on our website.'
                : 'Your feedback goes straight to the management. It takes a minute.'}
            </Typography>
          </Box>

          {isTestimonial ? (
            <>
              <TextField label="Your name" value={t.authorName} onChange={(e) => setT({ ...t, authorName: e.target.value })} required fullWidth />
              <TextField label="Your role" placeholder="Owner, General Manager…" value={t.authorRole} onChange={(e) => setT({ ...t, authorRole: e.target.value })} fullWidth />
              <TextField label="Hotel" value={t.businessName} placeholder={form.hotelName ?? ''} onChange={(e) => setT({ ...t, businessName: e.target.value })} fullWidth />
              <TextField label="City" value={t.location} onChange={(e) => setT({ ...t, location: e.target.value })} fullWidth />
              <TextField label="Email (not published)" type="email" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} fullWidth />
              <TextField label="Your testimonial" multiline minRows={4} value={t.quote} onChange={(e) => setT({ ...t, quote: e.target.value })} required fullWidth helperText="At least 20 characters" />
              <Box>
                <Typography variant="body2" fontWeight={700}>Your rating</Typography>
                <Rating value={t.rating} size="large" onChange={(_e, v) => setT({ ...t, rating: v })} />
              </Box>
              <FormControlLabel control={<Checkbox checked={t.consent} onChange={(e) => setT({ ...t, consent: e.target.checked })} />}
                label="I agree that HotelOpX may publish this testimonial with my name, role and hotel on its website." />
            </>
          ) : (
            <>
              {(form.services ?? ['overall']).map((key) => (
                <Stack key={key} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={key === 'overall' ? 800 : 500}>{RATING_LABEL[key] ?? key}{key === 'overall' ? ' *' : ''}</Typography>
                  <Rating value={ratings[key] ?? null} size="large" onChange={(_e, v) => setRatings({ ...ratings, [key]: v })} />
                </Stack>
              ))}
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Would you recommend us?</Typography>
                <ToggleButtonGroup exclusive value={recommend} onChange={(_e, v) => setRecommend(v)} size="small">
                  <ToggleButton value="yes">Yes</ToggleButton>
                  <ToggleButton value="no">No</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField label="Anything to tell us?" multiline minRows={3} value={comment} onChange={(e) => setComment(e.target.value)} fullWidth />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Name (optional)" value={guestName} onChange={(e) => setGuestName(e.target.value)} fullWidth />
                <TextField label="Room (optional)" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} fullWidth />
              </Stack>
              <TextField label="Phone or email, if you'd like a reply (optional)" value={contact} onChange={(e) => setContact(e.target.value)} fullWidth />
            </>
          )}

          {/* Left empty by people; bots fill it. */}
          <Box sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
            <input tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          <Button size="large" variant="contained" onClick={() => void submit()} disabled={saving || !ready}>
            {saving ? <CircularProgress size={22} color="inherit" /> : 'Send'}
          </Button>
        </Stack>
      </Paper>
    </Shell>
  );
};

export default PublicFeedbackPage;
