/**
 * Regression guard for two related defects:
 *
 * 1. Layout used `React.useEffect` while `React` was only otherwise referenced
 *    in type position. Under the react-jsx transform the default import gets
 *    elided, so `React` was undefined at runtime and Layout threw — taking the
 *    sidebar and header down on every page that uses it.
 * 2. The pages added in this release returned a bare <Container> instead of
 *    wrapping in <Layout>, so they rendered with no app chrome.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { ColorModeProvider } from '../src/theme/colorMode';
import Layout from '../src/components/Layout';
import { useAuthStore } from '../src/store/authStore';

jest.mock('../src/services/api', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: {} }), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  authService: {}, settingsOpsService: {}, dashboardService: {},
  superAdminService: {}, accountingService: {}
}));

const withProviders = (node: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ColorModeProvider>
      <SnackbarProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{node}</MemoryRouter>
        </QueryClientProvider>
      </SnackbarProvider>
    </ColorModeProvider>
  );
};

const signIn = (role: string) =>
  useAuthStore.setState({
    user: {
      id: 'u1', email: 'a@test.co', firstName: 'A', lastName: 'B', name: 'A B',
      role, hotelId: 'h1', hotelName: 'Test Hotel'
    },
    token: 'test-token',
    isAuthenticated: true
  } as never);

describe('Layout renders app chrome', () => {
  it('does not throw, and shows navigation for a business admin', () => {
    signIn('BUSINESS_ADMIN');
    withProviders(<Layout><div>page content</div></Layout>);

    // Sidebar items unique to BUSINESS_ADMIN — proves the nav rendered.
    expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Roles & Permissions/i)).toBeInTheDocument();
    expect(screen.getByText(/HR & Payroll/i)).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders the housekeeper navigation for a housekeeping user', () => {
    signIn('HOUSEKEEPING');
    withProviders(<Layout><div>hk</div></Layout>);
    expect(screen.getByText(/My Tasks/i)).toBeInTheDocument();
  });
});

describe('new pages are wrapped in Layout', () => {
  const pages: Array<[string, () => Promise<{ default: React.ComponentType }>]> = [
    ['Staff Management', () => import('../src/pages/business/hr/StaffManagement')],
    ['Permissions', () => import('../src/pages/business/PermissionsPage')]
  ];

  for (const [name, importer] of pages) {
    it(`${name} renders with the sidebar`, async () => {
      signIn('BUSINESS_ADMIN');
      const Page = (await importer()).default;
      withProviders(<Page />);

      // If the page were not wrapped, no nav item would exist.
      expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
    });
  }
});
