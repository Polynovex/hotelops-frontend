import { Box, Typography } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface OccupancyPoint {
  label: string;
  value: number;
}

interface OccupancyChartProps {
  title?: string;
  data?: OccupancyPoint[];
}

const defaultData: OccupancyPoint[] = [
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 0 },
  { label: 'Wed', value: 0 },
  { label: 'Thu', value: 0 },
  { label: 'Fri', value: 0 },
  { label: 'Sat', value: 0 },
  { label: 'Sun', value: 0 }
];

const OccupancyChart = ({ title = 'Occupancy', data = defaultData }: OccupancyChartProps) => {
  return (
    <Box sx={{ width: '100%', height: 320 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis domain={[0, 100]} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
          <Line dataKey="value" stroke="#1e8e5b" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default OccupancyChart;
