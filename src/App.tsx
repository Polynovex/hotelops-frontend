import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { useAuthStore } from './store/authStore';
import { useWebSocket } from './hooks/useWebSocket';
import { ColorModeProvider } from './theme/colorMode';
import { authService } from './services/api';
import LoginPage from './pages/LoginPage';
import UserCodeLoginPage from './pages/auth/UserCodeLogin';
import ShiftDashboardPage from './pages/business/ShiftDashboard';
import PromotionsAdminPage from './pages/business/PromotionsAdmin';
import AnomaliesPage from './pages/business/AnomaliesPage';
import DashboardPage from './pages/DashboardPage';
import SuperAdminPage from './pages/SuperAdminPage';
import PosOrdersPage from './pages/business/pos/PosOrdersPage';
import KdsPage from './pages/business/pos/KdsPage';
import PlansPage from './pages/super-admin/PlansPage';
import SystemHealthPage from './pages/super-admin/SystemHealthPage';
import ChartOfAccountsPage from './pages/business/accounting/ChartOfAccountsPage';
import JournalsPage from './pages/business/accounting/JournalsPage';
import BankReconciliationPage from './pages/business/accounting/BankReconciliationPage';
import BudgetsPage from './pages/business/accounting/BudgetsPage';
import FixedAssetsPage from './pages/business/accounting/FixedAssetsPage';
import TrialBalancePage from './pages/business/accounting/TrialBalancePage';
import ProfitLossPage from './pages/business/accounting/ProfitLossPage';
import BalanceSheetPage from './pages/business/accounting/BalanceSheetPage';
import AgingReportsPage from './pages/business/accounting/AgingReportsPage';
import VatSummaryPage from './pages/business/accounting/VatSummaryPage';
import GeneralLedgerPage from './pages/business/accounting/GeneralLedgerPage';
import NightAuditStatusPage from './pages/business/accounting/NightAuditStatusPage';
import NightAuditValidatePage from './pages/business/accounting/NightAuditValidatePage';
import NightAuditRunPage from './pages/business/accounting/NightAuditRunPage';
import NightAuditHistoryPage from './pages/business/accounting/NightAuditHistoryPage';
import FinancialForecastingPage from './pages/business/accounting/FinancialForecastingPage';
import InventoryPage from './pages/business/accounting/InventoryPage';
import MenuEngineeringPage from './pages/business/pos/MenuEngineeringPage';
import LogoutPage from './pages/auth/Logout';
import ForgotPasswordPage from './pages/auth/ForgotPassword';
import ResetPasswordPage from './pages/auth/ResetPassword';
import MfaSetupPage from './pages/auth/MfaSetup';
import MfaVerifyPage from './pages/auth/MfaVerify';
import SuperAdminDashboardPage from './pages/super-admin/Dashboard';
import SuperAdminAuditLogPage from './pages/super-admin/AuditLog';
import ProfileListPage from './pages/business/ProfileManagement/ProfileList';
import CreateProfilePage from './pages/business/ProfileManagement/CreateProfile';
import ProfileDetailPage from './pages/business/ProfileManagement/ProfileDetail';
import CompanyProfilesPage from './pages/business/ProfileManagement/CompanyProfiles';
import TravelAgentProfilesPage from './pages/business/ProfileManagement/TravelAgentProfiles';
import SourceProfilesPage from './pages/business/ProfileManagement/SourceProfiles';
import GroupProfilesPage from './pages/business/ProfileManagement/GroupProfiles';
import StayViewPage from './pages/business/Reservations/StayView';
import CreateReservationPage from './pages/business/Reservations/CreateReservation';
import ReservationListPage from './pages/business/Reservations/ReservationList';
import ReservationDetailPage from './pages/business/Reservations/ReservationDetail';
import CheckInPage from './pages/business/Reservations/CheckIn';
import CheckOutPage from './pages/business/Reservations/CheckOut';
import ArrivalsPage from './pages/business/Reservations/Arrivals';
import DeparturesPage from './pages/business/Reservations/Departures';
import InHousePage from './pages/business/Reservations/InHouse';
import QRoomPage from './pages/business/Reservations/QRoom';
import RoomListPage from './pages/business/Rooms/RoomList';
import RoomDetailPage from './pages/business/Rooms/RoomDetail';
import RoomTypeListPage from './pages/business/Rooms/RoomTypeList';
import CreateRoomTypePage from './pages/business/Rooms/CreateRoomType';
import EditRoomTypePage from './pages/business/Rooms/EditRoomType';
import RoomStatusBoardPage from './pages/business/Rooms/RoomStatusBoard';
import RoomCalendarPage from './pages/business/Rooms/RoomCalendar';
import HousekeepingTaskBoardPage from './pages/business/Housekeeping/TaskBoard';
import RoomStatusUpdatePage from './pages/business/Housekeeping/RoomStatusUpdate';
import InspectionViewPage from './pages/business/Housekeeping/InspectionView';
import LostAndFoundPage from './pages/business/Housekeeping/LostAndFound';
import BusinessProfileSettingsPage from './pages/business/Settings/BusinessProfile';
import UsersSettingsPage from './pages/business/Settings/Users';
import RolesSettingsPage from './pages/business/Settings/Roles';
import TaxSettingsPage from './pages/business/Settings/TaxSettings';
import PaymentGatewaysSettingsPage from './pages/business/Settings/PaymentGateways';
import BackupRestoreSettingsPage from './pages/business/Settings/BackupRestore';
import BusinessAuditTrailPage from './pages/business/AuditTrail';
import PosOutletsPage from './pages/business/pos/OutletList';
import PosMenuManagementPage from './pages/business/pos/MenuManagementPage';
import PosTableManagementPage from './pages/business/pos/TableManagement';
import OccupancyReportPage from './pages/business/Reports/OperationalReports/OccupancyReport';
import RevenueReportPage from './pages/business/Reports/OperationalReports/RevenueReport';
import HousekeepingReportPage from './pages/business/Reports/OperationalReports/HousekeepingReport';
import PosReportPage from './pages/business/Reports/OperationalReports/POSReport';
import CustomReportBuilderPage from './pages/business/Reports/CustomReportBuilder';
import NotFoundPage from './pages/errors/NotFound';
import DesktopOfflineIndicator from './components/DesktopOfflineIndicator';
import ShiftGatedRoute from './components/ShiftGatedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const normalizeRouteRole = (role?: string) => (role === 'RECEPTION' ? 'RECEPTIONIST' : role || '');

type AppModule = 'pms' | 'pos' | 'finance';
type ModuleAwareUser = {
  role: string;
  pmsEnabled?: boolean;
  posEnabled?: boolean;
  financeEnabled?: boolean;
};

const resolveModuleForPath = (path: string): AppModule | null => {
  if (
    path.startsWith('/business/reservations') ||
    path.startsWith('/business/profiles') ||
    path.startsWith('/business/rooms') ||
    path.startsWith('/business/housekeeping') ||
    path === '/business/reports/occupancy' ||
    path === '/business/reports/housekeeping' ||
    path.startsWith('/reception') ||
    path.startsWith('/housekeeping')
  ) {
    return 'pms';
  }

  if (
    path.startsWith('/business/pos') ||
    path.startsWith('/business/menu') ||
    path.startsWith('/pos') ||
    path === '/business/reports/pos'
  ) {
    return 'pos';
  }

  if (
    path.startsWith('/business/accounting') ||
    path.startsWith('/accountant') ||
    path === '/business/reports/revenue' ||
    path === '/business/reports/custom'
  ) {
    return 'finance';
  }

  return null;
};

const isModuleEnabledForUser = (user: ModuleAwareUser, module: AppModule) => {
  if (normalizeRouteRole(user.role) === 'SUPER_ADMIN') {
    return true;
  }

  if (module === 'pms') {
    return user.pmsEnabled !== false;
  }

  if (module === 'pos') {
    return user.posEnabled !== false;
  }

  return user.financeEnabled !== false;
};

const resolveModuleFallbackPath = (user: ModuleAwareUser) => {
  const role = normalizeRouteRole(user.role);
  const pmsEnabled = user.pmsEnabled !== false;
  const posEnabled = user.posEnabled !== false;
  const financeEnabled = user.financeEnabled !== false;

  if (role === 'SUPER_ADMIN') {
    return '/super-admin/dashboard';
  }

  if (role === 'BUSINESS_ADMIN') {
    if (pmsEnabled || posEnabled || financeEnabled) {
      return '/business/dashboard';
    }
    return '/business/settings/profile';
  }

  if (role === 'MANAGER') {
    if (pmsEnabled) {
      return '/business/reservations';
    }
    if (financeEnabled) {
      return '/business/accounting/reports/profit-loss';
    }
    return '/business/audit-trail';
  }

  if (role === 'ACCOUNTANT') {
    if (financeEnabled) {
      return '/business/accounting/night-audit/status';
    }
    return '/business/audit-trail';
  }

  if (role === 'RECEPTIONIST') {
    if (pmsEnabled) {
      return '/business/reservations/arrivals';
    }
    if (posEnabled) {
      return '/business/pos/orders';
    }
    return '/login';
  }

  if (role === 'POS_STAFF') {
    return posEnabled ? '/shift' : '/login';
  }

  if (role === 'HOUSEKEEPING') {
    return pmsEnabled ? '/business/rooms/status-board' : '/login';
  }

  return '/login';
};

const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element; allowedRoles: string[] }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(normalizeRouteRole(user.role))) {
    return <Navigate to="/" />;
  }

  const requiredModule = resolveModuleForPath(location.pathname);
  if (requiredModule && !isModuleEnabledForUser(user, requiredModule)) {
    return <Navigate to={resolveModuleFallbackPath(user)} replace />;
  }

  return children;
};

function App() {
  useWebSocket();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    let active = true;
    if (!token || !user || normalizeRouteRole(user.role) === 'SUPER_ADMIN') {
      return () => {
        active = false;
      };
    }

    const syncSessionUser = async () => {
      try {
        const me = await authService.getMe();
        if (!active) {
          return;
        }
        setUser({
          id: me.id,
          email: me.email,
          firstName: me.firstName,
          lastName: me.lastName,
          name: me.name,
          role: me.role,
          hotelId: me.hotelId,
          hotelName: me.hotelName,
          pmsEnabled: me.pmsEnabled,
          posEnabled: me.posEnabled,
          financeEnabled: me.financeEnabled
        });
      } catch (_error) {
        // ignore sync failures and continue with current session context
      }
    };

    void syncSessionUser();
    const intervalId = window.setInterval(() => {
      void syncSessionUser();
    }, 60000);
    const onFocus = () => {
      void syncSessionUser();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, user?.id, user?.role, setUser]);

  return (
    <ColorModeProvider>
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <DesktopOfflineIndicator />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/usercode-login" element={<UserCodeLoginPage />} />
              <Route path="/logout" element={<LogoutPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/mfa/setup" element={<MfaSetupPage />} />
              <Route path="/mfa/verify" element={<MfaVerifyPage />} />

              <Route
                path="/super-admin/businesses"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <SuperAdminPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin/plans"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <PlansPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin/system-health"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <SystemHealthPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <SuperAdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin/audit-log"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <SuperAdminAuditLogPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST']}>
                    <ShiftGatedRoute>
                      <DashboardPage />
                    </ShiftGatedRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/shift"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'BUSINESS_ADMIN',
                      'MANAGER',
                      'POS_STAFF',
                      'RECEPTIONIST',
                      'ACCOUNTANT'
                    ]}
                  >
                    <ShiftDashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/promotions"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER']}>
                    <PromotionsAdminPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/anomalies"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER', 'ACCOUNTANT']}>
                    <AnomaliesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <ReservationListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER', 'ACCOUNTANT']}>
                    <ProfileListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/individual"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER', 'ACCOUNTANT']}>
                    <ProfileListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/individual/create"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST']}>
                    <CreateProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/:id"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER', 'ACCOUNTANT']}>
                    <ProfileDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/company"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <CompanyProfilesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/travel-agent"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER', 'ACCOUNTANT']}>
                    <TravelAgentProfilesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/source"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <SourceProfilesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/profiles/group"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST']}>
                    <GroupProfilesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/stay-view"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <StayViewPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/create"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <ShiftGatedRoute>
                      <CreateReservationPage />
                    </ShiftGatedRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/:id"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <ReservationDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/arrivals"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER']}>
                    <ArrivalsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/departures"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER']}>
                    <DeparturesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/in-house"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER']}>
                    <InHousePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/q-room"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER']}>
                    <QRoomPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/checkin"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <CheckInPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reservations/checkout"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <CheckOutPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER', 'HOUSEKEEPING']}>
                    <RoomListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms/types"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <RoomTypeListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms/types/create"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <CreateRoomTypePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms/types/:id/edit"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <EditRoomTypePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms/:id"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER', 'HOUSEKEEPING']}>
                    <RoomDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms/calendar"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'RECEPTIONIST', 'MANAGER']}>
                    <RoomCalendarPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/rooms/status-board"
                element={
                  <ProtectedRoute allowedRoles={['HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'BUSINESS_ADMIN']}>
                    <RoomStatusBoardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/housekeeping/tasks"
                element={
                  <ProtectedRoute allowedRoles={['HOUSEKEEPING', 'MANAGER']}>
                    <HousekeepingTaskBoardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/housekeeping/room-status"
                element={
                  <ProtectedRoute allowedRoles={['HOUSEKEEPING', 'MANAGER', 'RECEPTIONIST']}>
                    <RoomStatusUpdatePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/housekeeping/inspection"
                element={
                  <ProtectedRoute allowedRoles={['HOUSEKEEPING']}>
                    <InspectionViewPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/housekeeping/lost-found"
                element={
                  <ProtectedRoute allowedRoles={['HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER']}>
                    <LostAndFoundPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/pos/outlets"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <PosOutletsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/pos/menu"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <PosMenuManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/pos/tables"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST', 'POS_STAFF']}>
                    <PosTableManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/pos/orders"
                element={
                  <ProtectedRoute allowedRoles={['POS_STAFF', 'RECEPTIONIST']}>
                    <ShiftGatedRoute>
                      <PosOrdersPage />
                    </ShiftGatedRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/pos/kds"
                element={
                  <ProtectedRoute allowedRoles={['POS_STAFF', 'RECEPTIONIST']}>
                    <KdsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/chart-of-accounts"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN']}>
                    <ChartOfAccountsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/journals"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN']}>
                    <JournalsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/bank-reconciliation"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT']}>
                    <BankReconciliationPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/budgets"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN']}>
                    <BudgetsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/fixed-assets"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN']}>
                    <FixedAssetsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/reports/trial-balance"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <TrialBalancePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/reports/profit-loss"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <ProfitLossPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/reports/balance-sheet"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <BalanceSheetPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/reports/aging"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <AgingReportsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/reports/vat"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <VatSummaryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/reports/general-ledger"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <GeneralLedgerPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/night-audit/status"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT']}>
                    <NightAuditStatusPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/night-audit/validate"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT']}>
                    <NightAuditValidatePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/night-audit/run"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT']}>
                    <NightAuditRunPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/night-audit/history"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT']}>
                    <NightAuditHistoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/forecasting"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <FinancialForecastingPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/accounting/inventory"
                element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/pos/menu-engineering"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER', 'ACCOUNTANT']}>
                    <MenuEngineeringPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BUSINESS_ADMIN', 'MANAGER']}>
                    <Navigate to="/business/settings/profile" replace />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reports/occupancy"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER']}>
                    <OccupancyReportPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reports/revenue"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER']}>
                    <RevenueReportPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reports/housekeeping"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'HOUSEKEEPING']}>
                    <HousekeepingReportPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reports/pos"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER']}>
                    <PosReportPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reports/custom"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <CustomReportBuilderPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings/profile"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <BusinessProfileSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings/users"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <UsersSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings/roles"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <RolesSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings/tax"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <TaxSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings/payments"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <PaymentGatewaysSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/settings/backup"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN']}>
                    <BackupRestoreSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/audit-trail"
                element={
                  <ProtectedRoute allowedRoles={['BUSINESS_ADMIN', 'MANAGER', 'ACCOUNTANT']}>
                    <BusinessAuditTrailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business/reception"
                element={
                  <ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER']}>
                    <Navigate to="/business/reservations/arrivals" replace />
                  </ProtectedRoute>
                }
              />

              <Route path="/super-admin/stats" element={<Navigate to="/super-admin/system-health" replace />} />
              <Route path="/super-admin/audit" element={<Navigate to="/super-admin/audit-log" replace />} />

              <Route path="/business/users" element={<Navigate to="/business/settings/users" replace />} />
              <Route path="/business/room-types" element={<Navigate to="/business/rooms/types" replace />} />
              <Route path="/business/menu" element={<Navigate to="/business/pos/menu" replace />} />
              <Route path="/business/audit" element={<Navigate to="/business/audit-trail" replace />} />

              <Route path="/reception/dashboard" element={<Navigate to="/business/reservations/arrivals" replace />} />
              <Route path="/reception/stay-view" element={<Navigate to="/business/reservations/stay-view" replace />} />
              <Route path="/reception/arrivals" element={<Navigate to="/business/reservations/arrivals" replace />} />
              <Route path="/reception/departures" element={<Navigate to="/business/reservations/departures" replace />} />
              <Route path="/reception/in-house" element={<Navigate to="/business/reservations/in-house" replace />} />
              <Route path="/reception/waitlist" element={<Navigate to="/business/reservations/q-room" replace />} />
              <Route path="/reception/new-reservation" element={<Navigate to="/business/reservations/create" replace />} />

              <Route path="/pos/dashboard" element={<Navigate to="/business/pos/orders" replace />} />
              <Route path="/pos/order" element={<Navigate to="/business/pos/orders" replace />} />
              <Route path="/pos/tables" element={<Navigate to="/business/pos/tables" replace />} />
              <Route path="/pos/orders" element={<Navigate to="/business/pos/orders" replace />} />

              <Route path="/housekeeping/dashboard" element={<Navigate to="/business/rooms/status-board" replace />} />
              <Route path="/housekeeping/rooms" element={<Navigate to="/business/rooms/status-board" replace />} />
              <Route path="/housekeeping/tasks" element={<Navigate to="/business/housekeeping/tasks" replace />} />

              <Route path="/accountant/dashboard" element={<Navigate to="/business/accounting/reports/profit-loss" replace />} />
              <Route path="/accountant/night-audit" element={<Navigate to="/business/accounting/night-audit/status" replace />} />
              <Route path="/accountant/night-audit/status" element={<Navigate to="/business/accounting/night-audit/status" replace />} />
              <Route path="/accountant/night-audit/validate" element={<Navigate to="/business/accounting/night-audit/validate" replace />} />
              <Route path="/accountant/night-audit/run" element={<Navigate to="/business/accounting/night-audit/run" replace />} />
              <Route path="/accountant/night-audit/history" element={<Navigate to="/business/accounting/night-audit/history" replace />} />
              <Route path="/accountant/revenue" element={<Navigate to="/business/accounting/reports/profit-loss" replace />} />
              <Route path="/accountant/aging" element={<Navigate to="/business/accounting/reports/aging" replace />} />
              <Route path="/accountant/vat" element={<Navigate to="/business/accounting/reports/vat" replace />} />
              <Route path="/accountant/trial-balance" element={<Navigate to="/business/accounting/reports/trial-balance" replace />} />
              <Route path="/accountant/audit" element={<Navigate to="/business/audit-trail" replace />} />

              <Route path="/super-admin" element={<Navigate to="/super-admin/businesses" replace />} />
              <Route path="/business" element={<Navigate to="/business/dashboard" replace />} />
              <Route path="/business/accounting/night-audit" element={<Navigate to="/business/accounting/night-audit/status" replace />} />
              <Route path="/business/accounting" element={<Navigate to="/business/accounting/chart-of-accounts" replace />} />

              <Route path="/dashboard" element={<Navigate to="/business/dashboard" replace />} />
              <Route path="/bookings" element={<Navigate to="/business/reservations" replace />} />
              <Route path="/pos" element={<Navigate to="/business/pos/orders" replace />} />
              <Route path="/settings" element={<Navigate to="/business/settings/profile" replace />} />
              <Route path="/reception" element={<Navigate to="/business/reservations/arrivals" replace />} />

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </SnackbarProvider>
    </ColorModeProvider>
  );
}

export default App;
