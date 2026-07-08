import { Box, Button, Stack, TextField } from '@mui/material';

const BankReconciliationForm = () => {
  return (
    <Box component="form">
      <Stack spacing={2}>
        <TextField label="Statement Date" type="date" InputLabelProps={{ shrink: true }} />
        <TextField label="Statement Balance" type="number" />
        <Button variant="contained">Reconcile</Button>
      </Stack>
    </Box>
  );
};

export default BankReconciliationForm;
