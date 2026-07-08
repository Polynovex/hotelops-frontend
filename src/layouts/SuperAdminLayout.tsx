import type { ReactNode } from 'react';
import Layout from '../components/common/Layout';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

const SuperAdminLayout = ({ children }: SuperAdminLayoutProps) => {
  return <Layout>{children}</Layout>;
};

export default SuperAdminLayout;
