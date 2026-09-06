import React from 'react';
import { Box } from '@mui/material';

/**
 * Lays KPI tiles out so they always fill their row.
 *
 * auto-fit with a minimum track means four tiles never leave one stranded
 * alone on a second row at an awkward width, which is what a fixed 4-column
 * grid did between the md and lg breakpoints.
 */
const MetricGrid = ({ children, min = 200 }: { children: React.ReactNode; min?: number }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      gap: 2
    }}
  >
    {children}
  </Box>
);

export default MetricGrid;
