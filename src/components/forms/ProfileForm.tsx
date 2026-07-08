import { Box, Button, Stack, TextField } from '@mui/material';

const ProfileForm = () => {
  return (
    <Box component="form">
      <Stack spacing={2}>
        <TextField label="First Name" />
        <TextField label="Last Name" />
        <TextField label="Email" />
        <Button variant="contained">Save Profile</Button>
      </Stack>
    </Box>
  );
};

export default ProfileForm;
