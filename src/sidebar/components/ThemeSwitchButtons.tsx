import React from 'react';
import { useTheme } from '#contexts/ThemeContext';
import { Tooltip } from '@mui/material';
import { useLocalization } from '#localization/LocalizationContext';
import PixelToggle from './PixelToggle';

const ThemeSwitchButtons: React.FC = () => {
  const { mode, toggleTheme } = useTheme();
  const { t } = useLocalization();
  const label = t('switchTheme', { mode: mode === 'dark' ? t('light') : t('dark') });
  return (
    <Tooltip title={label} arrow placement='top'>
      <span className='pixel-toggle-tooltip'>
        <PixelToggle
          options={{
            checked: mode === 'light',
            height: 44,
            transparent: true,
            onCheckedChange: checked => {
              const nextMode = checked ? 'light' : 'dark';
              if (nextMode !== mode) toggleTheme();
            },
          }}
          aria-label={label}
        />
      </span>
    </Tooltip>
  );
};

export default ThemeSwitchButtons;
