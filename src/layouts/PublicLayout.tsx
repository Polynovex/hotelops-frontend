import type { ReactNode } from 'react';
import { Box } from '@mui/material';

interface PublicLayoutProps {
  children: ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  return <Box>{children}</Box>;
};

export default PublicLayout;
