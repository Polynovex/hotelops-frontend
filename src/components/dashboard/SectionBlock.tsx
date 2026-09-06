import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface SectionBlockProps {
  title: string;
  /** Why this section is here, when the title alone is not enough. */
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A titled group within a dashboard.
 *
 * The title is a plain sans heading rather than the display serif: the page
 * already has one serif heading at the top, and repeating it at every section
 * flattens the hierarchy instead of building one.
 */
const SectionBlock = ({ title, description, action, children }: SectionBlockProps) => (
  <Box component="section">
    <Stack
      direction="row"
      alignItems="flex-end"
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 1.75 }}
    >
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 0.25 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
    {children}
  </Box>
);

export default SectionBlock;
