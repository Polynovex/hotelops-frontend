import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import { ROOM_ISSUE_LABEL, roomIssueService, type RoomIssue } from '../../services/housekeeping.service';
import { getApiErrorMessage } from '../../utils/apiError';
import ReportIssueDialog from './ReportIssueDialog';

const PRIORITY_TONE: Record<RoomIssue['priority'], 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error'
};

/**
 * Open room issues for the housekeeping manager: what was reported, by whom,
 * whether the room is out of order, and a Resolve action. Resolving the last
 * issue holding a room out of order sends the room to Dirty for a clean.
 */
const RoomIssuesPanel: React.FC<{ onNotice: (message: string) => void; refreshKey?: number }> = ({ onNotice, refreshKey }) => {
  const [issues, setIssues] = useState<RoomIssue[]>([]);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [resolving, setResolving] = useState<RoomIssue | null>(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setIssues(await roomIssueService.list({ status: 'OPEN' }));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load room issues.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const resolve = async () => {
    if (!resolving) return;
    setSaving(true);
    try {
      const result = await roomIssueService.resolve(resolving.id, resolution.trim());
      onNotice(
        result.roomReleased
          ? `Room ${resolving.roomNumber} is back in service and marked dirty for a clean.`
          : `Issue in room ${resolving.roomNumber} resolved.`
      );
      setResolving(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not resolve the issue.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ mb: 2.5, p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 800 }}>Room issues</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Problems reported by housekeeping and the front desk.
          </Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<BuildRoundedIcon />} onClick={() => setReporting(true)}>
          Report an issue
        </Button>
      </Stack>

      {error ? <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {issues.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 1 }}>No open issues.</Typography>
      ) : (
        <Stack spacing={1}>
          {issues.map((issue) => (
            <Stack
              key={issue.id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Room {issue.roomNumber}</Typography>
                  <Chip size="small" label={ROOM_ISSUE_LABEL[issue.category]} />
                  <Chip size="small" color={PRIORITY_TONE[issue.priority]} label={issue.priority.toLowerCase()} />
                  {issue.outOfOrder ? <Chip size="small" color="error" variant="outlined" label="Out of order" /> : null}
                </Stack>
                <Typography sx={{ fontSize: 13, mt: 0.5, wordBreak: 'break-word' }}>{issue.description}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
                  {issue.reportedByName} · {new Date(issue.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setResolution('');
                  setResolving(issue);
                }}
              >
                Resolve
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      <Dialog open={Boolean(resolving)} onClose={() => !saving && setResolving(null)} fullWidth maxWidth="xs">
        <DialogTitle>Resolve issue in room {resolving?.roomNumber}</DialogTitle>
        <DialogContent>
          <TextField
            label="What was done (optional)"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            sx={{ mt: 1 }}
          />
          {resolving?.outOfOrder ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              If no other issue is holding this room, it goes back in service as Dirty so it is cleaned first.
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolving(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void resolve()} disabled={saving}>Mark resolved</Button>
        </DialogActions>
      </Dialog>

      <ReportIssueDialog
        open={reporting}
        onClose={() => setReporting(false)}
        onReported={(message) => {
          setReporting(false);
          onNotice(message);
          void load();
        }}
      />
    </Paper>
  );
};

export default RoomIssuesPanel;
