import { Box, Button, Stack, TextField } from '@mui/material';

const MenuItemForm = () => {
  return (
    <Box component="form">
      <Stack spacing={2}>
        <TextField label="SKU" />
        <TextField label="Name" />
        <TextField label="Price" type="number" />
        <Button variant="contained">Save Menu Item</Button>
      </Stack>
    </Box>
  );
};

export default MenuItemForm;
