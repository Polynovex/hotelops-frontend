import { Box, Button, Stack, TextField } from '@mui/material';

const RoomTypeForm = () => {
  return (
    <Box component="form">
      <Stack spacing={2}>
        <TextField label="Code" />
        <TextField label="Name" />
        <TextField label="Base Rate" type="number" />
        <Button variant="contained">Save Room Type</Button>
      </Stack>
    </Box>
  );
};

export default RoomTypeForm;
