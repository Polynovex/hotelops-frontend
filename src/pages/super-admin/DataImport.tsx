import Layout from '../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  ENTITY_LABEL,
  ENTITY_ORDER,
  migrationService,
  parseCsv,
  type AnalyseResult,
  type CommitResult,
  type MigrationEntity,
  type MigrationJob,
  type TargetField
} from '../../services/migration.service';
import { EmptyState, PageHeader } from '../../components/premium';

const STEPS = ['Choose file', 'Map columns', 'Review', 'Import'];

/**
 * Data import wizard.
 *
 * The whole point of the step order is that the destructive action comes last
 * and only after a dry-run the admin has actually looked at. Rows are held in
 * component state and re-sent at commit, so what is written is exactly what
 * was reviewed.
 */
const DataImport = () => {
  const [step, setStep] = useState(0);
  const [entity, setEntity] = useState<MigrationEntity>('GUEST');
  const [hotelId, setHotelId] = useState('');
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schema, setSchema] = useState<TargetField[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<AnalyseResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [jobs, setJobs] = useState<MigrationJob[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await migrationService.listJobs(hotelId || undefined));
    } catch {
      // History is informational; a failure here must not block an import.
    }
  }, [hotelId]);

  useEffect(() => {
    migrationService.getSchema(entity).then(setSchema).catch(() => setSchema([]));
  }, [entity]);

  useEffect(() => {
    void loadJobs();
    api_listBusinesses().then(setBusinesses).catch(() => setBusinesses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const parsed = await parseCsv(file);
      if (parsed.length === 0) {
        setError('That file has no data rows.');
        return;
      }
      setRows(parsed);
      setFileName(file.name);

      // Ask the server for a suggested mapping straight away, so the admin
      // starts from a proposal rather than a blank grid.
      const suggestion = await migrationService.analyse({
        entity,
        rows: parsed.slice(0, 50),
        sourceName: file.name,
        hotelId: hotelId || undefined
      });
      setMapping(suggestion.mapping);
      setStep(1);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || (err instanceof Error ? err.message : 'Could not read that file'));
    } finally {
      setBusy(false);
    }
  };

  const runAnalysis = async () => {
    setBusy(true);
    setError('');
    try {
      const analysed = await migrationService.analyse({
        entity,
        rows,
        mapping,
        sourceName: fileName,
        hotelId: hotelId || undefined
      });
      setAnalysis(analysed);
      setStep(2);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'Could not analyse the file');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!analysis) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const committed = await migrationService.commit(analysis.jobId, rows);
      setResult(committed);
      setStep(3);
      setToast(`Imported ${committed.imported} record(s)`);
      await loadJobs();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || 'The import failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setRows([]);
    setFileName('');
    setMapping({});
    setAnalysis(null);
    setResult(null);
  };

  const sourceColumns = useMemo(
    () => (rows.length > 0 ? [...new Set(rows.flatMap((row) => Object.keys(row)))] : []),
    [rows]
  );

  const missingRequired = useMemo(
    () => schema.filter((field) => field.required && !mapping[field.field]).map((f) => f.label),
    [schema, mapping]
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Data Import"
        subtitle="Bring guests, rooms, and bookings across from an existing system."
        actions={step > 0 ? <Button onClick={reset}>Start over</Button> : undefined}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ---- Step 0: choose target and file ---- */}
      {step === 0 && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Import order matters</AlertTitle>
            Import <strong>Guests</strong> first, then <strong>Rooms</strong>, then{' '}
            <strong>Bookings</strong> — a booking needs its guest and room to exist already.
          </Alert>

          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Business"
                value={hotelId}
                onChange={(event) => setHotelId(event.target.value)}
                helperText="Which business this data belongs to"
              >
                <MenuItem value="">— select a business —</MenuItem>
                {businesses.map((business) => (
                  <MenuItem key={business.id} value={business.id}>
                    {business.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="What are you importing?"
                value={entity}
                onChange={(event) => setEntity(event.target.value as MigrationEntity)}
              >
                {ENTITY_ORDER.map((value) => (
                  <MenuItem key={value} value={value}>
                    {ENTITY_LABEL[value]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Button
            component="label"
            variant="contained"
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
            disabled={busy || !hotelId}
          >
            {busy ? 'Reading…' : 'Choose CSV file'}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
          </Button>
          {!hotelId && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Select a business first.
            </Typography>
          )}
        </Paper>
      )}

      {/* ---- Step 1: reconcile columns ---- */}
      {step === 1 && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Match your columns to HotelOpX fields
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {fileName} · {rows.length} rows · {sourceColumns.length} columns.
            We have suggested matches where we were confident; please check them.
          </Typography>

          {missingRequired.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Still to map: <strong>{missingRequired.join(', ')}</strong>
            </Alert>
          )}

          <Grid container spacing={2}>
            {schema.map((field) => (
              <Grid item xs={12} sm={6} key={field.field}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={
                    field.required ? `${field.label} *` : field.label
                  }
                  value={mapping[field.field] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => {
                      const next = { ...current };
                      if (event.target.value) {
                        next[field.field] = event.target.value;
                      } else {
                        delete next[field.field];
                      }
                      return next;
                    })
                  }
                  error={field.required && !mapping[field.field]}
                  helperText={field.enumValues ? `One of: ${field.enumValues.join(', ')}` : undefined}
                >
                  <MenuItem value="">— not in my file —</MenuItem>
                  {sourceColumns.map((column) => (
                    <MenuItem key={column} value={column}>
                      {column}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            ))}
          </Grid>

          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button
              variant="contained"
              onClick={() => void runAnalysis()}
              disabled={busy || missingRequired.length > 0}
            >
              {busy ? 'Checking…' : 'Check the data'}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* ---- Step 2: dry-run review ---- */}
      {step === 2 && analysis && (
        <Stack spacing={3}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">Rows in file</Typography>
                <Typography variant="h4" fontWeight={700}>{analysis.summary.total}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'success.main' }}>
                <Typography variant="body2" color="text.secondary">Will import</Typography>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {analysis.summary.valid}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: analysis.summary.invalid ? 'warning.main' : undefined }}>
                <Typography variant="body2" color="text.secondary">Will be skipped</Typography>
                <Typography variant="h4" fontWeight={700} color={analysis.summary.invalid ? 'warning.main' : undefined}>
                  {analysis.summary.invalid}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Alert severity="info">
            Nothing has been written yet. Importing into{' '}
            <strong>{analysis.business.name}</strong>. Re-running the same file later updates the
            same records rather than duplicating them.
          </Alert>

          {analysis.unmappedColumns.length > 0 && (
            <Alert severity="warning">
              These columns will be ignored: {analysis.unmappedColumns.join(', ')}
            </Alert>
          )}

          {analysis.issues.length > 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, pb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>
                    {analysis.issues.length} problem{analysis.issues.length === 1 ? '' : 's'} found
                  </Typography>
                </Stack>
              </Box>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Field</TableCell>
                      <TableCell>Problem</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.issues.slice(0, 100).map((issue, index) => (
                      <TableRow key={`${issue.row}-${issue.field}-${index}`}>
                        <TableCell>{issue.row}</TableCell>
                        <TableCell>{issue.field}</TableCell>
                        <TableCell>{issue.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {analysis.preview.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Preview — first {analysis.preview.length} rows as they will be saved
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {Object.keys(analysis.preview[0]).filter((k) => k !== '__row').map((key) => (
                        <TableCell key={key}>{key}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.preview.map((row, index) => (
                      <TableRow key={index}>
                        {Object.entries(row).filter(([k]) => k !== '__row').map(([key, value]) => (
                          <TableCell key={key}>{value === null || value === undefined ? '—' : String(value)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Stack direction="row" spacing={1}>
            <Button onClick={() => setStep(1)}>Back to mapping</Button>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => void runImport()}
              disabled={busy || !analysis.canCommit}
            >
              {busy ? 'Importing…' : `Import ${analysis.summary.valid} record(s)`}
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ---- Step 3: outcome ---- */}
      {step === 3 && result && (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Import complete
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ my: 3 }}>
            <Chip color="success" label={`${result.imported} imported`} />
            {result.skippedInvalid > 0 && <Chip color="warning" label={`${result.skippedInvalid} skipped`} />}
            {result.failed > 0 && <Chip color="error" label={`${result.failed} failed`} />}
          </Stack>

          {result.failures.length > 0 && (
            <Alert severity="warning" sx={{ textAlign: 'left', mb: 2 }}>
              <AlertTitle>Some rows could not be saved</AlertTitle>
              <Stack spacing={0.5}>
                {result.failures.slice(0, 10).map((failure) => (
                  <Typography key={failure.row} variant="caption">
                    Row {failure.row}: {failure.message}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          <Button variant="contained" onClick={reset}>
            Import something else
          </Button>
        </Paper>
      )}

      {/* ---- History ---- */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          Import history
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>File</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Rows</TableCell>
                <TableCell align="right">Imported</TableCell>
                <TableCell align="right">Skipped</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState title="No imports yet" description="Completed imports will be listed here." />
                  </TableCell>
                </TableRow>
              )}
              {jobs.map((job) => (
                <TableRow key={job.id} hover>
                  <TableCell>{job.sourceName || '—'}</TableCell>
                  <TableCell>{ENTITY_LABEL[job.entity]}</TableCell>
                  <TableCell align="right">{job.totalRows}</TableCell>
                  <TableCell align="right">{job.importedRows}</TableCell>
                  <TableCell align="right">{job.skippedRows}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={job.status}
                      color={job.status === 'COMMITTED' ? 'success' : job.status === 'FAILED' ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(job.createdAt).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

/** Business list for the target selector. */
const api_listBusinesses = async (): Promise<Array<{ id: string; name: string }>> => {
  const { api } = await import('../../services/api');
  const { data } = await api.get('/admin/businesses');
  const rows = Array.isArray(data) ? data : data?.businesses ?? [];
  return rows.map((row: { id: string; businessName?: string; name: string }) => ({
    id: row.id,
    name: row.businessName || row.name
  }));
};

const DataImportWithLayout = () => (
  <Layout>
    <DataImport />
  </Layout>
);

export default DataImportWithLayout;
