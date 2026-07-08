import type { ReactNode } from 'react';
import { Box } from '@mui/material';

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return <Box sx={{ minHeight: '100vh' }}>{children}</Box>;
};

export default AuthLayout;
