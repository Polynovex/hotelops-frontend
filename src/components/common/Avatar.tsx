import { Avatar as MuiAvatar } from '@mui/material';

interface AvatarProps {
  name: string;
}

const Avatar = ({ name }: AvatarProps) => {
  return <MuiAvatar>{name.charAt(0).toUpperCase()}</MuiAvatar>;
};

export default Avatar;
