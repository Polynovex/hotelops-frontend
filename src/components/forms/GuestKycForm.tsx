import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { CameraAlt, UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '../../store/authStore';
import { desktopBridge } from '../../services/desktopBridge';
import { apiFetch } from '../../utils/apiFetch';
import { getApiErrorMessage } from '../../utils/apiError';

export interface GuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';
  idNumber: string;
  address: string;
  nationality: string;
  city: string;
  state: string;
  dateOfBirth: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (guest: { id: string; firstName: string; lastName: string }) => void;
}

const ID_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" }
];

const GuestKycForm = ({ open, onClose, onCreated }: Props) => {
  const token = useAuthStore((s) => s.token);
  const { enqueueSnackbar } = useSnackbar();
  const baseUrl = (import.meta as any).env?.VITE_API_URL ?? '';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [, setGuestId] = useState<string | null>(null);

  // id doc upload
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [form, setForm] = useState<GuestFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idType: 'PASSPORT',
    idNumber: '',
    address: '',
    nationality: '',
    city: '',
    state: '',
    dateOfBirth: ''
  });

  const set = (field: keyof GuestFormData) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value as string }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
  };

  // On Electron desktop, use the native file dialog instead of the browser input
  const handleUploadClick = async () => {
    if (desktopBridge) {
      const result = await desktopBridge.readFile({
        filters: [{ name: 'Images & PDF', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] }]
      });
      if (!result) return;
      // Convert base64 → File object so the existing upload logic works unchanged
      const binary = atob(result.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], result.name, { type: result.mimeType });
      setIdFile(file);
      if (result.mimeType.startsWith('image/')) {
        setIdPreview(URL.createObjectURL(file));
      } else {
        setIdPreview(null);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      }, 100);
    } catch {
      enqueueSnackbar('Camera not available. Use file upload instead.', { variant: 'warning' });
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'id-snap.jpg', { type: 'image/jpeg' });
      setIdFile(file);
      setIdPreview(canvas.toDataURL('image/jpeg'));
      stream?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCameraOpen(false);
    }, 'image/jpeg', 0.9);
  };

  const uploadDoc = async (id: string) => {
    if (!idFile) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', idFile);
      // fetch does not reject on 4xx/5xx, and nothing checked res.ok — so a
      // rejected document (wrong type, too large) reported success and the
      // guest was left with no ID on file.
      await apiFetch(`${baseUrl}/guests/${id}/id-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
        fallbackMessage: 'The ID document could not be uploaded'
      });
    } catch (err) {
      enqueueSnackbar(
        `${getApiErrorMessage(err, 'ID document upload failed')} — the guest was still created.`,
        { variant: 'warning' }
      );
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const data = await apiFetch<{ id: string; firstName: string; lastName: string }>(
        `${baseUrl}/guests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
          fallbackMessage: 'Failed to create guest'
        }
      );

      setGuestId(data.id);
      if (idFile) await uploadDoc(data.id);
      enqueueSnackbar('Guest profile created', { variant: 'success' });
      onCreated({ id: data.id, firstName: data.firstName, lastName: data.lastName });
      handleClose();
    } catch (err) {
      // apiFetch already resolved the server's explanation into `message`.
      setError(getApiErrorMessage(err, 'Failed to create guest'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
    setIdFile(null);
    setIdPreview(null);
    setError('');
    setGuestId(null);
    setForm({ firstName: '', lastName: '', email: '', phone: '', idType: 'PASSPORT', idNumber: '', address: '', nationality: '', city: '', state: '', dateOfBirth: '' });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Guest — KYC Registration</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="First Name *" value={form.firstName} onChange={set('firstName')} fullWidth />
            <TextField label="Last Name *" value={form.lastName} onChange={set('lastName')} fullWidth />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Phone *" value={form.phone} onChange={set('phone')} fullWidth />
            <TextField label="Email" value={form.email} onChange={set('email')} fullWidth type="email" />
          </Stack>

          <Divider><Typography variant="caption">Identity Document</Typography></Divider>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>ID Type *</InputLabel>
              <Select
                value={form.idType}
                label="ID Type *"
                onChange={(e) => setForm((p) => ({ ...p, idType: e.target.value as GuestFormData['idType'] }))}
              >
                {ID_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="ID Number *" value={form.idNumber} onChange={set('idNumber')} fullWidth />
          </Stack>

          <TextField label="Nationality *" value={form.nationality} onChange={set('nationality')} fullWidth />
          <TextField label="Address *" value={form.address} onChange={set('address')} fullWidth multiline rows={2} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="City" value={form.city} onChange={set('city')} fullWidth />
            <TextField label="State" value={form.state} onChange={set('state')} fullWidth />
            <TextField label="Date of Birth" value={form.dateOfBirth} onChange={set('dateOfBirth')} type="date" InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>

          <Divider><Typography variant="caption">ID Document Upload</Typography></Divider>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Button startIcon={<UploadFile />} variant="outlined" size="small" onClick={() => void handleUploadClick()}>
              Upload File
            </Button>
            <Button startIcon={<CameraAlt />} variant="outlined" size="small" onClick={openCamera}>
              Use Camera
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" hidden onChange={handleFileSelect} />
            {idPreview && (
              <Box component="img" src={idPreview} alt="ID preview" sx={{ height: 64, borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
            )}
            {idFile && !idPreview && <Typography variant="caption">{idFile.name}</Typography>}
          </Stack>

          {cameraOpen && (
            <Box sx={{ position: 'relative' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 8 }} />
              <canvas ref={canvasRef} hidden />
              <Button variant="contained" onClick={snapPhoto} sx={{ mt: 1 }} fullWidth>
                Snap Photo
              </Button>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving || uploadingDoc}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || uploadingDoc}
          startIcon={(saving || uploadingDoc) ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving…' : uploadingDoc ? 'Uploading…' : 'Create Guest'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GuestKycForm;
