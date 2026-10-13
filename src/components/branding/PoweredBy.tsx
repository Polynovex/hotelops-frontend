import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * The HotelOpX credit. The business's own name and logo lead every screen,
 * receipt and QR menu; HotelOpX appears only as this quiet line at the end.
 * `print` keeps it visible on paper (receipts, reports, payslips).
 */
const PoweredBy: React.FC<{ tone?: 'light' | 'dark'; sx?: SxProps<Theme> }> = ({ tone = 'dark', sx }) => (
  <Box
    className="hox-powered-by"
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0.75,
      py: 1,
      opacity: 0.7,
      '@media print': { display: 'flex !important', opacity: 1 },
      ...sx
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: tone === 'light' ? 'rgba(248,244,236,0.7)' : 'text.secondary', letterSpacing: 0.4 }}
    >
      Powered by <strong>HotelOpX</strong>
    </Typography>
  </Box>
);

export default PoweredBy;
