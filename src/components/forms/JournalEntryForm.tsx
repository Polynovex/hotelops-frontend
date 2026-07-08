import { Box, Button, Stack, TextField } from '@mui/material';

const JournalEntryForm = () => {
  return (
    <Box component="form">
      <Stack spacing={2}>
        <TextField label="Date" type="date" InputLabelProps={{ shrink: true }} />
        <TextField label="Reference" />
        <TextField label="Description" />
        <Button variant="contained">Save Journal</Button>
      </Stack>
    </Box>
  );
};

export default JournalEntryForm;
