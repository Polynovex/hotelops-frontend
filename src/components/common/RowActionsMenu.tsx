import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export type RowAction = {
  /** Stable key. Also used as the fallback label for screen readers. */
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Renders in the error colour and is separated from the safe actions. */
  destructive?: boolean;
  disabled?: boolean;
  /** Shown when the action is disabled, explaining why. */
  disabledReason?: string;
  /** Omit the action entirely — use for permission-gated actions. */
  hidden?: boolean;
};

type Props = {
  actions: RowAction[];
  /** Describes the row, e.g. the person's name, for the trigger's aria-label. */
  subject?: string;
  size?: 'small' | 'medium';
};

/**
 * A single overflow menu replacing the row of inline icon buttons that tables
 * used to render. Inline buttons pushed tables past the viewport on smaller
 * screens and left no room for actions beyond the first two.
 *
 * Destructive actions are grouped last behind a divider so a mis-click on a
 * dense table does not terminate a staff member.
 */
const RowActionsMenu = ({ actions, subject, size = 'small' }: Props) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) {
    return null;
  }

  const safe = visible.filter((action) => !action.destructive);
  const destructive = visible.filter((action) => action.destructive);
  const ordered = [...safe, ...destructive];

  const open = (event: MouseEvent<HTMLElement>) => {
    // Rows are often clickable themselves; don't trigger the row handler.
    event.stopPropagation();
    setAnchor(event.currentTarget);
  };

  const close = () => setAnchor(null);

  const run = (action: RowAction) => {
    close();
    action.onClick();
  };

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size={size}
          onClick={open}
          aria-label={subject ? `Actions for ${subject}` : 'Row actions'}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
        >
          <MoreVertIcon fontSize={size === 'small' ? 'small' : 'medium'} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        {ordered.map((action, index) => {
          const startsDestructiveGroup =
            action.destructive && index > 0 && !ordered[index - 1].destructive;

          const item = (
            <MenuItem
              key={action.key}
              onClick={() => run(action)}
              disabled={action.disabled}
              sx={action.destructive ? { color: 'error.main' } : undefined}
            >
              {action.icon && (
                <ListItemIcon sx={action.destructive ? { color: 'error.main' } : undefined}>
                  {action.icon}
                </ListItemIcon>
              )}
              <ListItemText>{action.label}</ListItemText>
            </MenuItem>
          );

          return [
            startsDestructiveGroup ? <Divider key={`${action.key}-divider`} /> : null,
            // A disabled MenuItem swallows pointer events, so the tooltip needs
            // its own wrapper to stay reachable.
            action.disabled && action.disabledReason ? (
              <Tooltip key={`${action.key}-tip`} title={action.disabledReason} placement="left">
                <span>{item}</span>
              </Tooltip>
            ) : (
              item
            )
          ];
        })}
      </Menu>
    </>
  );
};

export default RowActionsMenu;
