import { Box, CircularProgress } from '@mui/material';

const LoadingSpinner = () => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
      <CircularProgress size={28} />
    </Box>
  );
};

export default LoadingSpinner;
