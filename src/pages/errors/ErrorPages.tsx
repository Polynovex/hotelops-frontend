import { Button, Container, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ErrorShell = ({
  code,
  title,
  description
}: {
  code: string;
  title: string;
  description: string;
}) => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontWeight: 800, color: '#1E3A8A' }}>{code}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{description}</Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
          <Button variant="contained" onClick={() => navigate('/business/dashboard')}>Go Dashboard</Button>
          <Button variant="outlined" onClick={() => navigate('/login')}>Go Login</Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export const NotFoundPage = () => (
  <ErrorShell code="404" title="Page Not Found" description="The route you requested does not exist in this HotelOpX build." />
);

export const UnauthorizedPage = () => (
  <ErrorShell code="401" title="Unauthorized" description="You do not have permission to view this resource." />
);

export const ServerErrorPage = () => (
  <ErrorShell code="500" title="Server Error" description="The platform encountered an unexpected issue. Please retry shortly." />
);
