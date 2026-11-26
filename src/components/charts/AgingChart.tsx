import { Box, Typography } from '@mui/material';
import { useChartColors } from '../../hooks/useChartColors';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AgingBucket {
  bucket: string;
  amount: number;
}

interface AgingChartProps {
  title?: string;
  data?: AgingBucket[];
}

const defaultData: AgingBucket[] = [
  { bucket: '0-30', amount: 0 },
  { bucket: '31-60', amount: 0 },
  { bucket: '61-90', amount: 0 },
  { bucket: '90+', amount: 0 }
];

const AgingChart = ({ title = 'Aging Buckets', data = defaultData }: AgingChartProps) => {
  const chart = useChartColors();
  return (
    <Box sx={{ width: '100%', height: 320 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis dataKey="bucket" stroke={chart.axis} tick={{ fill: chart.axis }} />
          <YAxis stroke={chart.axis} tick={{ fill: chart.axis }} />
          <Tooltip {...chart.tooltip} formatter={(value) => `₦${Number(value).toLocaleString()}`} />
          <Bar dataKey="amount" fill={chart.series[1]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default AgingChart;
