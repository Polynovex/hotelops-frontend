import { Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { DailyRecord } from '../../services/dailyRecords';

/**
 * The permanent edit history of a daily record: who submitted, requested,
 * approved or edited, when, and the exact before and after figures.
 */
const ACTION_LABEL: Record<string, string> = {
  SUBMIT: 'Submitted',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  EDIT_REQUEST: 'Edit requested',
  EDIT_APPROVE: 'Edit approved',
  EDIT_REJECT: 'Edit rejected',
  ADMIN_EDIT: 'Edited by admin'
};

const show = (value: unknown) =>
  value === undefined || value === null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export function RecordAudit({ revisions }: { revisions: NonNullable<DailyRecord['revisions']> }) {
  if (revisions.length === 0) return <Typography variant="body2" color="text.secondary">No history yet.</Typography>;

  return (
    <Stack spacing={2}>
      {[...revisions].reverse().map((revision) => (
        <Box key={revision.id} sx={{ borderLeft: '3px solid', borderColor: 'divider', pl: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label={ACTION_LABEL[revision.action] ?? revision.action} />
            <Typography variant="body2" fontWeight={700}>{revision.actor}</Typography>
            {revision.requestedBy && revision.requestedBy !== revision.actor && (
              <Typography variant="body2" color="text.secondary">requested by {revision.requestedBy}</Typography>
            )}
            <Typography variant="caption" color="text.secondary">{new Date(revision.createdAt).toLocaleString()}</Typography>
          </Stack>
          {revision.note && <Typography variant="body2" sx={{ mt: 0.5 }}>“{revision.note}”</Typography>}
          {revision.changes.length > 0 && ['EDIT_REQUEST', 'EDIT_APPROVE', 'EDIT_REJECT', 'ADMIN_EDIT'].includes(revision.action) && (
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow><TableCell>Field</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {revision.changes.slice(0, 40).map((change) => (
                  <TableRow key={change.field}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{change.field}</TableCell>
                    <TableCell sx={{ color: 'error.main', wordBreak: 'break-word' }}>{show(change.before)}</TableCell>
                    <TableCell sx={{ color: 'success.main', wordBreak: 'break-word' }}>{show(change.after)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      ))}
    </Stack>
  );
}
