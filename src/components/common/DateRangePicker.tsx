import { Stack, TextField } from '@mui/material';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
}

const DateRangePicker = ({ startDate, endDate, onChange }: DateRangePickerProps) => {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField
        type="date"
        label="Start Date"
        value={startDate}
        onChange={(event) => onChange({ startDate: event.target.value, endDate })}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        type="date"
        label="End Date"
        value={endDate}
        onChange={(event) => onChange({ startDate, endDate: event.target.value })}
        InputLabelProps={{ shrink: true }}
      />
    </Stack>
  );
};

export default DateRangePicker;
