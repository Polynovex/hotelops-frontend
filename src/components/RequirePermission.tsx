import { Box, Button, Paper, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';
import { usePermissionStore } from '../store/permissionStore';

/**
 * Presentation-level permission guard (Part 2).
 *
 * This hides UI the user cannot use. It is NOT the security boundary — the
 * backend rejects every unauthorised call independently, so a user who routes
 * around this still gets a 403 from the API.
 */
export const RequirePermission = ({
  codes,
  children,
  fallback
}: {
  codes: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  const can = usePermissionStore((state) => state.can);
  const navigate = useNavigate();

  // Loading is owned by Layout, which knows the current user id. This guard
  // only reads; `can` returns true until permissions arrive, so a page never
  // flashes "access denied" while the fetch is still in flight.
  if (can(...codes)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh', p: 3 }}>
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 420, textAlign: 'center', borderRadius: 3 }}>
        <LockOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Access denied
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          You do not have permission to view this page. Ask your administrator if you think this
          is a mistake.
        </Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </Paper>
    </Box>
  );
};

/** Inline variant: renders nothing at all when the permission is missing. */
export const IfPermitted = ({ codes, children }: { codes: string[]; children: React.ReactNode }) => {
  const can = usePermissionStore((state) => state.can);
  return can(...codes) ? <>{children}</> : null;
};

export default RequirePermission;
