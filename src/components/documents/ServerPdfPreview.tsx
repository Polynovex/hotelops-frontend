import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { api } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Shows the PDF the server generates: the same file that is emailed, so the
 * preview and the attachment cannot differ. `version` changes whenever the
 * document is saved, which fetches it again.
 */
const ServerPdfPreview = ({ path, version, note }: { path: string; version?: string | number; note?: string | null }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('document.pdf');
  const [error, setError] = useState('');

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setError('');
    api
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const name = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''))?.[1];
        if (name) setFilename(name);
        revoked = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setUrl(revoked);
      })
      .catch(async (err) => {
        if (cancelled) return;
        // A JSON error arrives as a blob too.
        let message = getApiErrorMessage(err, 'Could not load the PDF');
        try {
          const text = await (err?.response?.data as Blob | undefined)?.text?.();
          if (text) message = JSON.parse(text).message || JSON.parse(text).error || message;
        } catch {
          // keep the generic message
        }
        setError(message);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [path, version]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{filename}</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<OpenInNewRoundedIcon />} disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener')}>
            Open
          </Button>
          <Button size="small" startIcon={<DownloadRoundedIcon />} disabled={!url} component="a" href={url ?? undefined} download={filename}>
            Download
          </Button>
        </Stack>
      </Stack>
      {note && <Alert severity="info" sx={{ borderRadius: 0 }}>{note}</Alert>}
      {error ? (
        <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
      ) : url ? (
        <Box component="iframe" title={filename} src={`${url}#view=FitH`} sx={{ width: '100%', height: { xs: 520, md: 900 }, border: 0, display: 'block', bgcolor: 'background.default' }} />
      ) : (
        <Stack alignItems="center" justifyContent="center" sx={{ height: 320 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
    </Paper>
  );
};

export default ServerPdfPreview;
