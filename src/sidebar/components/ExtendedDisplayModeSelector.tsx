import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Typography,
  Divider,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ViewModule as DefaultIcon,
  ViewList as SimpleIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { ExtensionDisplayMode } from '#types/global';
import { useLocalization } from '#localization/LocalizationContext';

interface ExtendedDisplayModeSelectorProps {
  currentMode: ExtensionDisplayMode;
  onModeChange: (mode: ExtensionDisplayMode) => void;
}

const ExtendedDisplayModeSelector: React.FC<ExtendedDisplayModeSelectorProps> = ({
  currentMode,
  onModeChange,
}) => {
  const { t } = useLocalization();
  const displayModeConfig = {
    default: { label: t('displayModeDefault'), description: t('displayModeDefaultDescription'), icon: DefaultIcon },
    simple: { label: t('displayModeSimple'), description: t('displayModeSimpleDescription'), icon: SimpleIcon },
  } as const;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleModeSelect = (mode: ExtensionDisplayMode) => {
    onModeChange(mode);
  };

  return (
    <>
      <Tooltip title={t('switchSidebarModes')}>
        <IconButton
          onClick={handleClick}
          size='small'
          aria-label={t('switchSidebarModes')}
          sx={{
            color: 'text.primary',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <SettingsIcon fontSize='small' />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              minWidth: 240,
              maxWidth: 280,
              '& .MuiMenuItem-root': {
                py: 1,
              },
            },
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Typography
          variant='overline'
          sx={{
            px: 2,
            py: 1,
            fontWeight: 600,
            color: 'text.secondary',
            fontSize: '0.7rem',
          }}
        >
          {t('displayMode')}
        </Typography>
        <Divider />

        {(
          Object.entries(displayModeConfig) as [
            ExtensionDisplayMode,
            (typeof displayModeConfig)[ExtensionDisplayMode],
          ][]
        ).map(([mode, config]) => {
          const IconComponent = config.icon;
          const isSelected = currentMode === mode;

          return (
            <MenuItem
              key={mode}
              onClick={() => handleModeSelect(mode)}
              selected={isSelected}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  // Ensure text is always readable
                  '& .MuiListItemText-primary': {
                    color: 'primary.contrastText',
                    fontWeight: 600,
                  },
                  '& .MuiListItemText-secondary': {
                    color: 'primary.contrastText',
                    opacity: 0.9,
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isSelected ? 'primary.contrastText' : 'text.secondary',
                  minWidth: 36,
                }}
              >
                <IconComponent fontSize='small' />
              </ListItemIcon>
              <ListItemText
                primary={config.label}
                secondary={config.description}
                sx={{
                  '& .MuiListItemText-primary': {
                    color: isSelected ? 'inherit' : 'text.primary',
                    fontWeight: isSelected ? 600 : 400,
                  },
                  '& .MuiListItemText-secondary': {
                    color: isSelected ? 'inherit' : 'text.secondary',
                    opacity: isSelected ? 0.9 : 0.7,
                    fontSize: '0.75rem',
                  },
                }}
              />
              {isSelected && (
                <CheckIcon
                  fontSize='small'
                  sx={{
                    color: 'primary.contrastText',
                    ml: 1,
                  }}
                />
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default ExtendedDisplayModeSelector;
