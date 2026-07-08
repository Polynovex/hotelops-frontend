import { Box, Button, Stack, TextField } from '@mui/material';

const ReservationForm = () => {
  return (
    <Box component="form">
      <Stack spacing={2}>
        <TextField label="Guest" />
        <TextField label="Arrival" type="date" InputLabelProps={{ shrink: true }} />
        <TextField label="Departure" type="date" InputLabelProps={{ shrink: true }} />
        <Button variant="contained">Save Reservation</Button>
      </Stack>
    </Box>
  );
};

export default ReservationForm;
