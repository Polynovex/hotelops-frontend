import { Chip } from '@mui/material';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const color =
    status === 'ACTIVE' || status === 'COMPLETED'
      ? 'success'
      : status === 'SUSPENDED' || status === 'VOIDED'
        ? 'error'
        : status === 'TRIAL' || status === 'PENDING'
          ? 'warning'
          : 'default';

  return <Chip size="small" label={status} color={color} />;
};

export default StatusBadge;
