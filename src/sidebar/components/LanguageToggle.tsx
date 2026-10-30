import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { useLocalization } from '#localization/LocalizationContext';

const LanguageToggle: React.FC = () => {
  const { language, setLanguage, t } = useLocalization();
  const nextLanguage = language === 'en' ? 'zh-CN' : 'en';

  return (
    <Tooltip title={t('switchLanguage')}>
      <Button
        aria-label={t('switchLanguage')}
        size='small'
        onClick={() => void setLanguage(nextLanguage)}
        sx={{ minWidth: 0, px: 0.75, textTransform: 'none', fontWeight: 600 }}
      >
        {language === 'en' ? t('languageChinese') : t('languageEnglish')}
      </Button>
    </Tooltip>
  );
};

export default LanguageToggle;
