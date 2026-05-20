import type { AppLanguage } from './i18n';

export type AppSettings = {
  controlsHideDelayMs: number;
  autoPlayNext: boolean;
  language: AppLanguage;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  controlsHideDelayMs: 3500,
  autoPlayNext: false,
  language: 'pt',
};

const SETTINGS_KEY = 'nuvix_app_settings';

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const sanitizeSettings = (value: Partial<AppSettings>): AppSettings => ({
  controlsHideDelayMs:
    typeof value.controlsHideDelayMs === 'number' && value.controlsHideDelayMs >= 3000
      ? value.controlsHideDelayMs
      : DEFAULT_APP_SETTINGS.controlsHideDelayMs,
  autoPlayNext:
    typeof value.autoPlayNext === 'boolean'
      ? value.autoPlayNext
      : DEFAULT_APP_SETTINGS.autoPlayNext,
  language:
    value.language === 'pt' || value.language === 'en' || value.language === 'es'
      ? value.language
      : DEFAULT_APP_SETTINGS.language,
});

export const getAppSettings = (): AppSettings => {
  if (!canUseStorage()) return DEFAULT_APP_SETTINGS;

  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (!rawSettings) return DEFAULT_APP_SETTINGS;

    return sanitizeSettings(JSON.parse(rawSettings) as Partial<AppSettings>);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings) => {
  if (!canUseStorage()) return;

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)));
};
