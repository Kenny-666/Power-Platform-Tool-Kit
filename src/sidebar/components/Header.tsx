import React from 'react';
import { AppBar, Toolbar, Tooltip, Box } from '@mui/material';
import { useTheme } from '#contexts/ThemeContext';
import DisplayModeSelector from './DisplayModeSelector';
import { ExtensionDisplayMode } from '#types/global';
import PixelToggle from './PixelToggle';

interface HeaderProps {
  displayMode: ExtensionDisplayMode;
  onDisplayModeChange: (mode: ExtensionDisplayMode) => void;
}

const HeaderComponent: React.FC<HeaderProps> = ({ displayMode, onDisplayModeChange }) => {
  const { toggleTheme, isDarkMode } = useTheme();

  return (
    <AppBar
      position='static'
      color='default'
      elevation={0}
      sx={{ backgroundColor: 'transparent', padding: 0 }}
    >
      <Toolbar
        sx={{ minHeight: 'auto !important', padding: '0 !important', justifyContent: 'flex-end' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DisplayModeSelector currentMode={displayMode} onModeChange={onDisplayModeChange} />

          <Tooltip title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}>
            <span className='pixel-toggle-tooltip'>
              <PixelToggle
                options={{
                  checked: !isDarkMode,
                  height: 40,
                  transparent: true,
                  onCheckedChange: checked => {
                    if (checked === isDarkMode) toggleTheme();
                  },
                }}
                aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
              />
            </span>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

const Header = React.memo(HeaderComponent);

export default Header;
