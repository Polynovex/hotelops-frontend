import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import Layout from '../Layout';

interface DashboardShellProps {
  /** Small uppercase line above the title: where the user is. */
  eyebrow: string;
  title: string;
  /** One line naming what this screen is for. */
  subtitle?: string;
  /** Status chips, a refresh control, a date — sits opposite the title. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The frame every role dashboard sits in.
 *
 * Exists so the nine landing screens share one rhythm — the same page padding,
 * the same distance from title to first card, the same maximum width — instead
 * of each page inventing its own and drifting apart. The heading is rendered
 * once, here; pages that also printed their own title ended up showing it
 * twice.
 */
const DashboardShell = ({ eyebrow, title, subtitle, actions, children }: DashboardShellProps) => (
  <Layout>
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        spacing={2}
        sx={{ mb: { xs: 3, md: 3.5 } }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mb: 0.75
            }}
          >
            {eyebrow}
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
              fontWeight: 600,
              fontSize: { xs: 30, sm: 36, md: 40 },
              lineHeight: 1.08,
              letterSpacing: '-.015em',
              textWrap: 'balance'
            }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography sx={{ mt: 0.75, color: 'text.secondary', maxWidth: '62ch' }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
      </Stack>

      {/* One spacing scale down the page, so sections never collide or drift. */}
      <Stack spacing={{ xs: 3, md: 3.5 }}>{children}</Stack>
    </Container>
  </Layout>
);

export default DashboardShell;
