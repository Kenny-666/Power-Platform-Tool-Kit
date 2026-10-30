import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ExtensionConfigService } from '#services/ExtensionConfigService';
import { Language, Translate, translate } from './i18n';

interface LocalizationContextValue {
  language: Language;
  t: Translate;
  setLanguage: (language: Language) => Promise<void>;
}

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

export const LocalizationProvider: React.FC<React.PropsWithChildren<{ language?: Language }>> = ({
  language: initialLanguage,
  children,
}) => {
  const [language, setCurrentLanguage] = useState<Language>(
    initialLanguage ?? ExtensionConfigService.getConfig().language
  );

  useEffect(() => {
    if (initialLanguage) setCurrentLanguage(initialLanguage);
    void ExtensionConfigService.initialize().then(() =>
      setCurrentLanguage(ExtensionConfigService.getConfig().language)
    );
    return ExtensionConfigService.subscribe(config => setCurrentLanguage(config.language));
  }, [initialLanguage]);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      t: (key, values) => translate(language, key, values),
      setLanguage: nextLanguage => ExtensionConfigService.updateConfig({ language: nextLanguage }),
    }),
    [language]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export const useLocalization = (): LocalizationContextValue => {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used within LocalizationProvider');
  return context;
};
