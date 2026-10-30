import React from 'react';
import { Alert, Typography, Button, Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLocalization } from '#localization/LocalizationContext';

interface PrivilegeWarningProps {
  show: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
}

const PrivilegeWarning: React.FC<PrivilegeWarningProps> = ({
  show,
  onRetry,
  isRetrying = false,
}) => {
  const { t } = useLocalization();
  if (!show) return null;

  return (
    <Alert severity='warning'>
      <Typography variant='body2'>
        <strong>{t('insufficientPrivileges')}</strong>
      </Typography>
      <Typography variant='caption' sx={{ display: 'block', mb: 1 }}>
        {t('impersonationPrivilegeRequired')}
      </Typography>
      {onRetry && (
        <Box sx={{ mt: 1 }}>
          <Button
            size='small'
            variant='outlined'
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            disabled={isRetrying}
            sx={{ fontSize: '0.75rem', py: 0.5, px: 1 }}
          >
            {isRetrying ? t('checking') : t('retryCheck')}
          </Button>
        </Box>
      )}
    </Alert>
  );
};

export default PrivilegeWarning;
