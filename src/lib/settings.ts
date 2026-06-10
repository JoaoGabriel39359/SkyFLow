import type { AppLanguage } from './i18n';
import { isValidParentalPin } from './parentalControl';
import {
  DEFAULT_PLAYER_MODE_BY_TYPE,
  getStoredPlayerModes,
  sanitizePlayerModeByType,
  saveStoredPlayerModes,
  type PlayerModeByType,
} from './playerSettings';

export type AppSettings = {
  controlsHideDelayMs: number;
  autoPlayNext: boolean;
  language: AppLanguage;
  playerModeByType: PlayerModeByType;
  parentalControlEnabled: boolean;
  parentalControlPin: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  controlsHideDelayMs: 3500,
  autoPlayNext: false,
  language: 'pt',
  playerModeByType: DEFAULT_PLAYER_MODE_BY_TYPE,
  parentalControlEnabled: false,
  parentalControlPin: '',
};

const SETTINGS_KEY = 'nuvix_app_settings';

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const sanitizeSettings = (value: Partial<AppSettings>): AppSettings => {
  const parentalControlPin =
    typeof value.parentalControlPin === 'string' && isValidParentalPin(value.parentalControlPin)
      ? value.parentalControlPin
      : '';

  return {
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
    playerModeByType: sanitizePlayerModeByType(value.playerModeByType),
    parentalControlEnabled: Boolean(value.parentalControlEnabled && parentalControlPin),
    parentalControlPin,
  };
};

export const getAppSettings = (): AppSettings => {
  if (!canUseStorage()) return DEFAULT_APP_SETTINGS;

  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (!rawSettings) {
      return {
        ...DEFAULT_APP_SETTINGS,
        playerModeByType: getStoredPlayerModes(DEFAULT_APP_SETTINGS.playerModeByType),
      };
    }

    const settings = sanitizeSettings(JSON.parse(rawSettings) as Partial<AppSettings>);

    return {
      ...settings,
      playerModeByType: getStoredPlayerModes(settings.playerModeByType),
    };
  } catch {
    return {
      ...DEFAULT_APP_SETTINGS,
      playerModeByType: getStoredPlayerModes(DEFAULT_APP_SETTINGS.playerModeByType),
    };
  }
};

export const saveAppSettings = (settings: AppSettings) => {
  if (!canUseStorage()) return;

  const safeSettings = sanitizeSettings(settings);

  saveStoredPlayerModes(safeSettings.playerModeByType);
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings));
};
