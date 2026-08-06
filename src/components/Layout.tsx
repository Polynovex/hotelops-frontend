import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  useMediaQuery,
  useTheme,
  Badge,
  Chip,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  InputAdornment
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  DarkModeRounded,
  LightModeRounded,
  Menu as MenuIcon,
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Hotel as HotelIcon,
  RestaurantMenu as MenuBookIcon,
  CalendarToday as CalendarIcon,
  Receipt as ReceiptIcon,
  Assessment as AssessmentIcon,
  Settings,
  MeetingRoom as RoomIcon,
  CleaningServices as CleaningIcon,
  PointOfSale as PosIcon,
  BusinessCenter as BusinessIcon,
  PersonAdd as UserIcon,
  History as AuditIcon,
  History as HistoryIcon,
  FactCheck as KdsIcon,
  Logout as LogoutIcon,
  Notifications,
  WorkspacePremium,
  NightShelterRounded,
  AccountBalanceWalletRounded,
  RestaurantRounded,
  AutoAwesomeRounded,
  TrendingUpRounded,
  PersonOutlineRounded,
  LockOutlined,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useColorMode } from '../theme/colorMode';
import { DemoModeBanner } from './DemoModeBanner';
import DesktopUpdateBanner from './DesktopUpdateBanner';

interface LayoutProps {
  children: React.ReactNode;
}

type NavRole =
  | 'SUPER_ADMIN'
  | 'BUSINESS_ADMIN'
  | 'RECEPTION'
  | 'POS_STAFF'
  | 'HOUSEKEEPING'
  | 'ACCOUNTANT'
  | 'MANAGER';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  module?: 'pms' | 'pos' | 'finance';
}

const navigationConfig: Record<NavRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard', icon: DashboardIcon, path: '/super-admin/dashboard' },
    { label: 'Businesses', icon: BusinessIcon, path: '/super-admin/businesses' },
    { label: 'Package Configuration', icon: WorkspacePremium, path: '/super-admin/plans' },
    { label: 'System Stats', icon: AssessmentIcon, path: '/super-admin/stats' },
    { label: 'Audit Log', icon: AuditIcon, path: '/super-admin/audit' }
  ],
  BUSINESS_ADMIN: [
    { label: 'Dashboard', icon: DashboardIcon, path: '/business/dashboard' },
    { label: 'Staff', icon: UserIcon, path: '/business/users' },
    { label: 'Room Types', icon: HotelIcon, path: '/business/room-types', module: 'pms' },
    { label: 'Rooms', icon: RoomIcon, path: '/business/rooms', module: 'pms' },
    { label: 'Menu Configuration', icon: MenuBookIcon, path: '/business/menu', module: 'pos' },
    {
      label: 'Menu Engineering',
      icon: AssessmentIcon,
      path: '/business/pos/menu-engineering',
      module: 'pos'
    },
    { label: 'Promotions', icon: WorkspacePremium, path: '/business/promotions', module: 'pos' },
    { label: 'Anomalies (AI)', icon: AutoAwesomeRounded, path: '/business/anomalies' },
    { label: 'Profiles (View)', icon: PeopleIcon, path: '/business/profiles', module: 'pms' },
    {
      label: 'Inventory',
      icon: ReceiptIcon,
      path: '/business/accounting/inventory',
      module: 'finance'
    },
    {
      label: 'Forecasting',
      icon: TrendingUpRounded,
      path: '/business/accounting/forecasting',
      module: 'finance'
    },
    {
      label: 'Reports',
      icon: AssessmentIcon,
      path: '/business/reports/revenue',
      module: 'finance'
    },
    { label: 'Audit Trail', icon: AuditIcon, path: '/business/audit' },
    { label: 'Settings', icon: Settings, path: '/business/settings' }
  ],
  RECEPTION: [
    { label: 'Shift', icon: HistoryIcon, path: '/shift' },
    { label: 'Dashboard', icon: DashboardIcon, path: '/reception/dashboard', module: 'pms' },
    { label: 'Stay View', icon: CalendarIcon, path: '/reception/stay-view', module: 'pms' },
    { label: 'Arrivals', icon: PeopleIcon, path: '/reception/arrivals', module: 'pms' },
    { label: 'Departures', icon: PeopleIcon, path: '/reception/departures', module: 'pms' },
    { label: 'In-House', icon: HotelIcon, path: '/reception/in-house', module: 'pms' },
    { label: 'Waitlist', icon: ReceiptIcon, path: '/reception/waitlist', module: 'pms' },
    {
      label: 'New Reservation',
      icon: CalendarIcon,
      path: '/reception/new-reservation',
      module: 'pms'
    },
    { label: 'Guest Profiles', icon: PeopleIcon, path: '/business/profiles', module: 'pms' }
  ],
  POS_STAFF: [
    { label: 'Shift', icon: HistoryIcon, path: '/shift' },
    { label: 'Dashboard', icon: DashboardIcon, path: '/pos/dashboard', module: 'pos' },
    { label: 'Take Orders', icon: PosIcon, path: '/pos/order', module: 'pos' },
    { label: 'Tables', icon: RoomIcon, path: '/pos/tables', module: 'pos' },
    { label: 'Kitchen Display', icon: KdsIcon, path: '/pos/orders', module: 'pos' }
  ],
  HOUSEKEEPING: [
    { label: 'Dashboard', icon: DashboardIcon, path: '/housekeeping/dashboard', module: 'pms' },
    { label: 'Room Status', icon: CleaningIcon, path: '/housekeeping/rooms', module: 'pms' },
    { label: 'My Tasks', icon: AssessmentIcon, path: '/housekeeping/tasks', module: 'pms' }
  ],
  ACCOUNTANT: [
    { label: 'Dashboard', icon: DashboardIcon, path: '/accountant/dashboard', module: 'finance' },
    {
      label: 'Night Audit Status',
      icon: AssessmentIcon,
      path: '/accountant/night-audit/status',
      module: 'finance'
    },
    {
      label: 'Validate Audit',
      icon: ReceiptIcon,
      path: '/accountant/night-audit/validate',
      module: 'finance'
    },
    {
      label: 'Run Night Audit',
      icon: AuditIcon,
      path: '/accountant/night-audit/run',
      module: 'finance'
    },
    {
      label: 'Audit History',
      icon: HistoryIcon,
      path: '/accountant/night-audit/history',
      module: 'finance'
    },
    // { label: 'Anomalies (AI)', icon: AutoAwesomeRounded, path: '/business/anomalies' },
    { label: 'Revenue', icon: AssessmentIcon, path: '/accountant/revenue', module: 'finance' },
    {
      label: 'Inventory',
      icon: ReceiptIcon,
      path: '/business/accounting/inventory',
      module: 'finance'
    },
    {
      label: 'Forecasting',
      icon: TrendingUpRounded,
      path: '/business/accounting/forecasting',
      module: 'finance'
    },
    { label: 'Aging', icon: ReceiptIcon, path: '/accountant/aging', module: 'finance' },
    { label: 'VAT', icon: ReceiptIcon, path: '/accountant/vat', module: 'finance' },
    {
      label: 'Trial Balance',
      icon: AssessmentIcon,
      path: '/accountant/trial-balance',
      module: 'finance'
    }
  ],
  MANAGER: [
    { label: 'Dashboard', icon: DashboardIcon, path: '/business/dashboard' },
    { label: 'Reservations', icon: CalendarIcon, path: '/business/reservations', module: 'pms' },
    { label: 'Arrivals', icon: PeopleIcon, path: '/business/reservations/arrivals', module: 'pms' },
    { label: 'Anomalies (AI)', icon: AutoAwesomeRounded, path: '/business/anomalies' },
    {
      label: 'Revenue',
      icon: AssessmentIcon,
      path: '/business/accounting/reports/profit-loss',
      module: 'finance'
    },
    {
      label: 'Trial Balance',
      icon: AssessmentIcon,
      path: '/business/accounting/reports/trial-balance',
      module: 'finance'
    },
    { label: 'Audit Trail', icon: AuditIcon, path: '/business/audit-trail' }
  ]
};

const drawerWidth = 304;

const moduleMeta = {
  pms: { label: 'PMS', icon: NightShelterRounded },
  pos: { label: 'POS', icon: RestaurantRounded },
  finance: { label: 'Finance', icon: AccountBalanceWalletRounded }
} as const;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUser } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [resetCodeOpen, setResetCodeOpen] = useState(false);
  const [resetCodeUserId, setResetCodeUserId] = useState('');
  const [resetCodeResult, setResetCodeResult] = useState<string | null>(null);
  const [resetCodeLoading, setResetCodeLoading] = useState(false);
  const [resetCodeError, setResetCodeError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = mode === 'dark';

  const isSuperAdmin = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN';
  const logoSrc = isSuperAdmin ? '/logo.png' : user?.logoUrl || '/logo.png';
  const brandName = isSuperAdmin ? 'HotelOpX' : user?.hotelName || 'HotelOpX';

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwLoading(true);
    try {
      const { api } = await import('../services/api');
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setUser({ mustResetPassword: false });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err?.response?.data?.error || err?.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleResetUserCode = async () => {
    if (!resetCodeUserId.trim()) {
      setResetCodeError('User ID is required.');
      return;
    }
    setResetCodeLoading(true);
    setResetCodeError('');
    setResetCodeResult(null);
    try {
      const { authService } = await import('../services/api');
      const result = await authService.resetUserCode(resetCodeUserId.trim());
      setResetCodeResult(result.userCode);
    } catch (err: any) {
      setResetCodeError(err?.response?.data?.error || err?.message || 'Failed to reset usercode.');
    } finally {
      setResetCodeLoading(false);
    }
  };

  const normalizedRole = String(user?.role || '').toUpperCase();
  const roleMap: Record<string, NavRole> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    BUSINESS_ADMIN: 'BUSINESS_ADMIN',
    RECEPTION: 'RECEPTION',
    RECEPTIONIST: 'RECEPTION',
    POS_STAFF: 'POS_STAFF',
    HOUSEKEEPING: 'HOUSEKEEPING',
    ACCOUNTANT: 'ACCOUNTANT',
    MANAGER: 'MANAGER'
  };
  const role = roleMap[normalizedRole] || 'BUSINESS_ADMIN';
  const isModuleEnabled = (module: 'pms' | 'pos' | 'finance') => {
    if (normalizedRole === 'SUPER_ADMIN') {
      return true;
    }

    if (module === 'pms') {
      return user?.pmsEnabled !== false;
    }
    if (module === 'pos') {
      return user?.posEnabled !== false;
    }
    return user?.financeEnabled !== false;
  };

  const displayRole = (r: string) => {
    const map: Record<string, string> = {
      RECEPTIONIST: 'FRONT OFFICE',
      RECEPTION: 'FRONT OFFICE',
      SUPER_ADMIN: 'SUPER ADMIN',
      BUSINESS_ADMIN: 'ADMIN',
      POS_STAFF: 'POS STAFF'
    };
    return map[r] ?? r.replace(/_/g, ' ');
  };

  const menuItems = (navigationConfig[role] || []).filter((item) => {
    if (!item.module) {
      return true;
    }
    return isModuleEnabled(item.module);
  });
  const activeItem =
    menuItems.find(
      (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    ) || menuItems[0];
  const enabledModules = (Object.keys(moduleMeta) as Array<keyof typeof moduleMeta>).map(
    (moduleKey) => ({
      ...moduleMeta[moduleKey],
      enabled: isModuleEnabled(moduleKey)
    })
  );

  const drawerContent = (
    <Box sx={{ width: drawerWidth, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          p: 3,
          pb: 2.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <Box
          component="img"
          src={logoSrc}
          alt={brandName}
          sx={{ width: 240, height: 120, objectFit: 'contain' }}
        />
        <Typography variant="body2" sx={{ color: 'rgba(248,244,236,0.76)', mt: 2.5 }}>
          Premium hotel operations control with PMS, POS, and finance in one command layer.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2.5 }}>
          {enabledModules.map((moduleItem) => (
            <Chip
              key={moduleItem.label}
              size="small"
              icon={<moduleItem.icon />}
              label={moduleItem.label}
              sx={{
                color: moduleItem.enabled ? '#F9F5EE' : 'rgba(255,255,255,0.44)',
                backgroundColor: moduleItem.enabled
                  ? alpha(theme.palette.secondary.main, isDark ? 0.22 : 0.16)
                  : alpha('#FFFFFF', isDark ? 0.08 : 0.05),
                border: `1px solid ${moduleItem.enabled ? 'rgba(215,163,77,0.24)' : 'rgba(255,255,255,0.08)'}`,
                '& .MuiChip-icon': {
                  color: 'inherit'
                }
              }}
            />
          ))}
        </Stack>
      </Box>
      <Box sx={{ px: 2, pt: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: 'rgba(248,244,236,0.58)', px: 1.25, pb: 1.25 }}
        >
          Navigation
        </Typography>
      </Box>
      <List sx={{ mt: 0, px: 2 }}>
        {menuItems.map((item) => {
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <ListItemButton
              key={item.label}
              selected={isActive}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setDrawerOpen(false);
              }}
              sx={{
                mb: 0.75,
                color: isActive ? theme.palette.secondary.light : 'rgba(248,244,236,0.84)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.06)'
                }
              }}
            >
              <ListItemIcon
                sx={{ color: isActive ? theme.palette.secondary.light : 'rgba(248,244,236,0.6)' }}
              >
                <item.icon />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ mt: 'auto', p: 2.5, pt: 2 }}>
        <Paper
          sx={{
            p: 2.25,
            borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.06)',
            color: '#F9F5EE',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar sx={{ bgcolor: 'secondary.main', color: 'primary.main' }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {isSuperAdmin ? user?.name || 'Super Admin' : user?.hotelName || 'Demo Property'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(248,244,236,0.66)' }}>
                {displayRole(normalizedRole)}
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ my: 1.75, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <WorkspacePremium sx={{ fontSize: 18, color: 'secondary.main' }} />
            <Typography variant="body2" sx={{ color: 'rgba(248,244,236,0.72)' }}>
              Premium operations suite enabled
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: isDark ? '#0E1418' : '#FFFFFF'
      }}
    >
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` }
        }}
      >
        <Toolbar sx={{ minHeight: '88px !important', px: { xs: 2, md: 3 } }}>
          <IconButton
            color="inherit"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            {drawerOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', letterSpacing: '0.12em' }}
              >
                COMMAND CENTER
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                {activeItem?.label || brandName}
              </Typography>
            </Box>
          </Box>

          <Paper
            sx={{
              display: { xs: 'none', lg: 'flex' },
              alignItems: 'center',
              px: 1.75,
              py: 1,
              mr: 1.5,
              borderRadius: '10px',
              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.82 : 0.84),
              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {!isSuperAdmin ? user?.hotelName || 'Demo Property' : ''}
            </Typography>
          </Paper>

          <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton color="inherit" onClick={toggleColorMode} sx={{ mr: 1 }}>
              {isDark ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>

          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={3} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <Box
            onClick={handleProfileMenuOpen}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <Avatar sx={{ bgcolor: 'secondary.main', mr: 1 }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption">{displayRole(normalizedRole)}</Typography>
            </Box>
          </Box>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleProfileMenuClose}>
            <MenuItem
              onClick={() => {
                handleProfileMenuClose();
                setProfileOpen(true);
              }}
            >
              <PersonOutlineRounded sx={{ mr: 1 }} fontSize="small" />
              Profile
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleProfileMenuClose();
                setSecurityOpen(true);
              }}
            >
              <LockOutlined sx={{ mr: 1 }} fontSize="small" />
              Security
            </MenuItem>
            {normalizedRole === 'BUSINESS_ADMIN' && (
              <MenuItem
                onClick={() => {
                  handleProfileMenuClose();
                  setResetCodeOpen(true);
                  setResetCodeUserId('');
                  setResetCodeResult(null);
                  setResetCodeError('');
                }}
              >
                <LockOutlined sx={{ mr: 1 }} fontSize="small" />
                Reset Staff Usercode
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>

          {/* Profile Modal */}
          <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>My Profile</DialogTitle>
            <DialogContent>
              <Stack spacing={2} pt={1}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'secondary.main',
                      fontSize: 22,
                      fontWeight: 700
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {user?.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {displayRole(normalizedRole)}
                    </Typography>
                  </Box>
                </Stack>
                <Divider />
                {[
                  { label: 'Email', value: user?.email },
                  { label: 'First Name', value: user?.firstName },
                  { label: 'Last Name', value: user?.lastName },
                  { label: 'Role', value: displayRole(normalizedRole) },
                  { label: 'Business', value: user?.hotelName || '—' },
                  { label: 'Usercode', value: user?.userCode || '—' }
                ].map(({ label, value }) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {value || '—'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setProfileOpen(false)} variant="contained">
                Close
              </Button>
            </DialogActions>
          </Dialog>

          {/* Reset Usercode Modal — Business Admin only */}
          <Dialog
            open={resetCodeOpen}
            onClose={() => {
              setResetCodeOpen(false);
              setResetCodeResult(null);
              setResetCodeError('');
            }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Reset Staff Usercode</DialogTitle>
            <DialogContent>
              <Stack spacing={2} pt={1}>
                {resetCodeError && (
                  <Alert severity="error" onClose={() => setResetCodeError('')}>
                    {resetCodeError}
                  </Alert>
                )}
                {resetCodeResult ? (
                  <Alert severity="success">
                    New usercode: <strong style={{ letterSpacing: '0.2em', fontSize: 18 }}>{resetCodeResult}</strong>
                    <br />
                    <Typography variant="caption">Share this securely — it is shown only once.</Typography>
                  </Alert>
                ) : (
                  <TextField
                    fullWidth
                    label="User ID"
                    value={resetCodeUserId}
                    onChange={(e) => setResetCodeUserId(e.target.value)}
                    helperText="Enter the ID of the staff member whose usercode you want to reset."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                  />
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setResetCodeOpen(false);
                  setResetCodeResult(null);
                  setResetCodeError('');
                }}
              >
                {resetCodeResult ? 'Close' : 'Cancel'}
              </Button>
              {!resetCodeResult && (
                <Button
                  variant="contained"
                  onClick={() => void handleResetUserCode()}
                  disabled={resetCodeLoading || !resetCodeUserId.trim()}
                >
                  {resetCodeLoading ? 'Resetting…' : 'Reset Usercode'}
                </Button>
              )}
            </DialogActions>
          </Dialog>

          {/* Security Modal */}
          <Dialog
            open={securityOpen}
            onClose={() => {
              setSecurityOpen(false);
              setPwError('');
              setPwSuccess(false);
            }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Security — Change Password</DialogTitle>
            <DialogContent>
              <Stack spacing={2} pt={1}>
                {pwError && (
                  <Alert severity="error" onClose={() => setPwError('')}>
                    {pwError}
                  </Alert>
                )}
                {pwSuccess && <Alert severity="success">Password changed successfully.</Alert>}
                <TextField
                  fullWidth
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <TextField
                  fullWidth
                  label="New password"
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Minimum 8 characters"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNewPw((s) => !s)}>
                          {showNewPw ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <TextField
                  fullWidth
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setSecurityOpen(false);
                  setPwError('');
                  setPwSuccess(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleChangePassword()}
                disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {pwLoading ? 'Saving…' : 'Change Password'}
              </Button>
            </DialogActions>
          </Dialog>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? drawerOpen : true}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            height: '100vh'
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component={motion.main}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, md: 3 },
          marginTop: '88px',
          minHeight: 'calc(100vh - 88px)',
          overflowX: 'hidden'
        }}
      >
        <DemoModeBanner />
        <DesktopUpdateBanner />
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Box>
    </Box>
  );
};

export default Layout;
