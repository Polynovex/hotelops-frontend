import { Box, Typography } from '@mui/material';
import { useChartColors } from '../../hooks/useChartColors';
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
  const chart = useChartColors();
  return (
    <Box sx={{ width: '100%', height: 320 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis dataKey="label" stroke={chart.axis} tick={{ fill: chart.axis }} />
          <YAxis stroke={chart.axis} tick={{ fill: chart.axis }} />
          <Tooltip {...chart.tooltip} formatter={(value) => `₦${Number(value).toLocaleString()}`} />
          <Bar dataKey="value" fill={chart.series[0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RevenueChart;
