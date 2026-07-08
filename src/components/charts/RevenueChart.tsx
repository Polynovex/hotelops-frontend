import { Box, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface RevenuePoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  title?: string;
  data?: RevenuePoint[];
}

const defaultData: RevenuePoint[] = [
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 0 },
  { label: 'Wed', value: 0 },
  { label: 'Thu', value: 0 },
  { label: 'Fri', value: 0 },
  { label: 'Sat', value: 0 },
  { label: 'Sun', value: 0 }
];

const RevenueChart = ({ title = 'Revenue Trend', data = defaultData }: RevenueChartProps) => {
  return (
    <Box sx={{ width: '100%', height: 320 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip formatter={(value) => `₦${Number(value).toLocaleString()}`} />
          <Bar dataKey="value" fill="#0B4F6C" />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RevenueChart;
