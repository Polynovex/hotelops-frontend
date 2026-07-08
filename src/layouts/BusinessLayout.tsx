import type { ReactNode } from 'react';
import Layout from '../components/common/Layout';

interface BusinessLayoutProps {
  children: ReactNode;
}

const BusinessLayout = ({ children }: BusinessLayoutProps) => {
  return <Layout>{children}</Layout>;
};

export default BusinessLayout;
