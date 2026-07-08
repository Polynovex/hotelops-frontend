import type { ReactNode } from 'react';
import BaseLayout from '../Layout';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return <BaseLayout>{children}</BaseLayout>;
};

export default Layout;
