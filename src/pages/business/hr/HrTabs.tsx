import { Box, Tab, Tabs } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import PaymentsIcon from '@mui/icons-material/Payments';
import EventNoteIcon from '@mui/icons-material/EventNote';
import DashboardIcon from '@mui/icons-material/Dashboard';

/**
 * Shared HR section navigation.
 *
 * The HR pages are a single workflow — you look at a staff member, then their
 * attendance, then their payroll — so they get in-page tabs rather than forcing
 * a trip back through the sidebar for every switch.
 */
const TABS = [
  { label: 'Overview', path: '/business/hr', icon: <DashboardIcon /> },
  { label: 'Staff', path: '/business/hr/staff', icon: <PeopleIcon /> },
  { label: 'Attendance', path: '/business/hr/attendance', icon: <EventAvailableIcon /> },
  { label: 'Leave', path: '/business/hr/leave', icon: <BeachAccessIcon /> },
  { label: 'Payroll', path: '/business/hr/payroll', icon: <PaymentsIcon /> },
  { label: 'Rota', path: '/business/hr/rota', icon: <EventNoteIcon /> }
];

export const HrTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Longest match wins, so /business/hr/staff does not also match /business/hr.
  const active = TABS.reduce((best, tab) => {
    if (pathname === tab.path || pathname.startsWith(`${tab.path}/`)) {
      return !best || tab.path.length > best.length ? tab.path : best;
    }
    return best;
  }, '' as string);

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs
        value={active || TABS[0].path}
        onChange={(_event, value: string) => navigate(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="HR sections"
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.path}
            value={tab.path}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            sx={{ minHeight: 52, textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default HrTabs;
