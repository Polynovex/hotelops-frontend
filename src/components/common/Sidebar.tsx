import { Box, Typography } from '@mui/material';

const Sidebar = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Sidebar is managed in the main app layout.
      </Typography>
    </Box>
  );
};

export default Sidebar;
