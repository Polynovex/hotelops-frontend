import { Tabs, Tab, Box } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import BackupRounded from '@mui/icons-material/BackupRounded';
import LockClockRounded from '@mui/icons-material/LockClockRounded';

/**
 * Navigation between the settings pages.
 *
 * There was none. The sidebar offered a single "Settings" link that landed on
 * the business profile, and every other settings page — users, roles, tax,
 * payments, backup — existed, was routed and was reachable only by typing its
 * URL. The payment gateway screen in particular had been built and was, in
 * practice, invisible.
 *
 * Staff accounts and roles are not here: they live once, under Workforce &
 * Admin (Staff, Roles & Permissions), rather than in two places.
 */
const ALL_TABS = [
  { label: 'Business profile', path: '/business/settings/profile', icon: <BusinessRounded /> },
  { label: 'Tax', path: '/business/settings/tax', icon: <ReceiptLongRounded /> },
  { label: 'Payments', path: '/business/settings/payments', icon: <PaymentsRounded /> },
  { label: 'Backup', path: '/business/settings/backup', icon: <BackupRounded /> },
  { label: 'Session', path: '/business/settings/security', icon: <LockClockRounded /> }
];

export function SettingsTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOwner = useAuthStore((state) => String(state.user?.role || '').toUpperCase() === 'BUSINESS_ADMIN');

  // Every tab is the owner's; anyone else sees none.
  const TABS = isOwner ? ALL_TABS : [];
  if (TABS.length === 0) return null;

  // An unknown path selects nothing rather than defaulting to the first tab,
  // which would highlight "Business profile" while showing something else.
  const current = TABS.findIndex((tab) => pathname.startsWith(tab.path));

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs
        value={current === -1 ? false : current}
        onChange={(_event, index: number) => navigate(TABS[index].path)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Settings sections"
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.path}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            sx={{ minHeight: 56, textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
