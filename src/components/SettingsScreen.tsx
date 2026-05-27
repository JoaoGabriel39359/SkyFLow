'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CircleHelp,
  Gauge,
  Info,
  KeyRound,
  MonitorPlay,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { appCopy, languageNames, languageOrder, type AppLanguage } from '@/lib/i18n';
import {
  playerModeOrder,
  type PlayerContentType,
  type PlayerMode,
  type PlayerModeByType,
} from '@/lib/playerSettings';
import type { AppSettings } from '@/lib/settings';
import styles from './SettingsScreen.module.css';

type SettingsSection = 'general' | 'player' | 'performance' | 'remote' | 'subscription' | 'system';

type SettingsScreenProps = {
  settings: AppSettings;
  deviceId: string;
  accountStatus: string;
  onSettingsChange: (settings: AppSettings) => void;
  onBack: () => void;
  onLogout: () => void;
  onRefreshAccount: () => void;
  onClearCatalogCache: () => void;
};

type SectionCardConfig = {
  id: SettingsSection;
  title: string;
  description: string;
  icon: React.ElementType;
};

type ActionRowProps = {
  focusKey: string;
  title: string;
  description: string;
  value: string;
  tone?: 'default' | 'danger' | 'success';
  previousFocusKey: string;
  nextFocusKey: string;
  onPress: () => void;
};

type InfoRowProps = {
  title: string;
  description: string;
  value: string;
  tone?: 'default' | 'success';
};

const CONTROL_TIMEOUT_OPTIONS = [3000, 3500, 5000, 8000];

const formatControlsTimeout = (value: number) => {
  if (value === 3500) return '3,5s';
  return `${Math.round(value / 1000)}s`;
};

const settingsSectionIcons: Array<Pick<SectionCardConfig, 'id' | 'icon'>> = [
  {
    id: 'general',
    icon: Settings,
  },
  {
    id: 'player',
    icon: MonitorPlay,
  },
  {
    id: 'performance',
    icon: Gauge,
  },
  {
    id: 'remote',
    icon: KeyRound,
  },
  {
    id: 'subscription',
    icon: ShieldCheck,
  },
  {
    id: 'system',
    icon: Info,
  },
];

const getSectionFocusKey = (section: SettingsSection) => `settings-section-${section}`;
const getLanguageFocusKey = (language: AppLanguage) => `settings-language-${language}`;
const getPlayerModeFocusKey = (contentType: PlayerContentType, mode: PlayerMode) =>
  `settings-player-${contentType}-${mode}`;

function valueClassName(tone: 'default' | 'danger' | 'success') {
  return [
    styles.value,
    tone === 'danger' ? styles.dangerValue : '',
    tone === 'success' ? styles.successValue : '',
  ].filter(Boolean).join(' ');
}

function PanelButton({
  focusKey,
  onPress,
  children,
  variant = 'default',
  nextFocusKey,
  previousFocusKey,
}: {
  focusKey: string;
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
  nextFocusKey?: string;
  previousFocusKey?: string;
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onArrowPress: (direction: string) => {
      if (direction === 'up' && previousFocusKey) {
        setFocus(previousFocusKey);
        return false;
      }

      if (direction === 'down' && nextFocusKey) {
        setFocus(nextFocusKey);
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={[
        styles.panelButton,
        variant === 'danger' ? styles.panelButtonDanger : '',
        focused ? styles.focused : '',
      ].filter(Boolean).join(' ')}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function SectionCard({
  section,
  index,
  sections,
  onOpen,
}: {
  section: SectionCardConfig;
  index: number;
  sections: SectionCardConfig[];
  onOpen: (section: SettingsSection) => void;
}) {
  const Icon = section.icon;
  const focusKey = getSectionFocusKey(section.id);
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onOpen(section.id),
    onArrowPress: (direction: string) => {
      const columns = 2;
      const nextIndexByDirection = {
        left: index % columns === 0 ? -1 : index - 1,
        right: index % columns === columns - 1 ? -1 : index + 1,
        up: index - columns,
        down: index + columns,
      };
      const nextIndex = nextIndexByDirection[direction as keyof typeof nextIndexByDirection];

      if (typeof nextIndex !== 'number') return true;

      if (nextIndex >= 0 && nextIndex < sections.length) {
        setFocus(getSectionFocusKey(sections[nextIndex].id));
        return false;
      }

      if (direction === 'down') {
        setFocus('settings-main-close');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.sectionCard} ${focused ? styles.focused : ''}`}
      onClick={() => onOpen(section.id)}
    >
      <span className={styles.sectionIcon}>
        <Icon size={42} />
      </span>
      <strong>{section.title}</strong>
      <span>{section.description}</span>
    </button>
  );
}

function ActionRow({
  focusKey,
  title,
  description,
  value,
  tone = 'default',
  previousFocusKey,
  nextFocusKey,
  onPress,
}: ActionRowProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onArrowPress: (direction: string) => {
      if (direction === 'up') {
        setFocus(previousFocusKey);
        return false;
      }

      if (direction === 'down') {
        setFocus(nextFocusKey);
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.optionRow} ${focused ? styles.focused : ''}`}
      onClick={onPress}
    >
      <span className={styles.optionText}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className={valueClassName(tone)}>{value}</span>
    </button>
  );
}

function InfoRow({ title, description, value, tone = 'default' }: InfoRowProps) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.optionText}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className={valueClassName(tone)}>{value}</span>
    </div>
  );
}

function LanguageOptionButton({
  language,
  currentLanguage,
  selectedLabel,
  previousFocusKey,
  nextFocusKey,
  onSelect,
}: {
  language: AppLanguage;
  currentLanguage: AppLanguage;
  selectedLabel: string;
  previousFocusKey: string;
  nextFocusKey: string;
  onSelect: (language: AppLanguage) => void;
}) {
  const focusKey = getLanguageFocusKey(language);
  const languageIndex = languageOrder.indexOf(language);
  const isSelected = language === currentLanguage;
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onSelect(language),
    onArrowPress: (direction: string) => {
      if (direction === 'left' && languageIndex > 0) {
        const previousLanguage = languageOrder[languageIndex - 1];
        if (previousLanguage) {
          setFocus(getLanguageFocusKey(previousLanguage));
        }
        return false;
      }

      if (direction === 'right' && languageIndex < languageOrder.length - 1) {
        const nextLanguage = languageOrder[languageIndex + 1];
        if (nextLanguage) {
          setFocus(getLanguageFocusKey(nextLanguage));
        }
        return false;
      }

      if (direction === 'up') {
        setFocus(previousFocusKey);
        return false;
      }

      if (direction === 'down') {
        setFocus(nextFocusKey);
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={[
        styles.languageOption,
        isSelected ? styles.languageOptionSelected : '',
        focused ? styles.focused : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(language)}
    >
      <span>{languageNames[language]}</span>
      {isSelected && <strong>{selectedLabel}</strong>}
    </button>
  );
}

function LanguageSelect({
  currentLanguage,
  title,
  description,
  selectedLabel,
  previousFocusKey,
  nextFocusKey,
  onSelect,
}: {
  currentLanguage: AppLanguage;
  title: string;
  description: string;
  selectedLabel: string;
  previousFocusKey: string;
  nextFocusKey: string;
  onSelect: (language: AppLanguage) => void;
}) {
  return (
    <div className={styles.languageSelect}>
      <div className={styles.languageSelectHeader}>
        <span className={styles.optionText}>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className={styles.value}>{selectedLabel}: {languageNames[currentLanguage]}</span>
      </div>

      <div className={styles.languageOptions}>
        {languageOrder.map((language) => (
          <LanguageOptionButton
            key={language}
            language={language}
            currentLanguage={currentLanguage}
            selectedLabel={selectedLabel}
            previousFocusKey={previousFocusKey}
            nextFocusKey={nextFocusKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerModeOptionButton({
  contentType,
  mode,
  currentMode,
  selectedLabel,
  previousFocusKey,
  nextFocusKey,
  labels,
  descriptions,
  onSelect,
}: {
  contentType: PlayerContentType;
  mode: PlayerMode;
  currentMode: PlayerMode;
  selectedLabel: string;
  previousFocusKey: string;
  nextFocusKey: string;
  labels: Record<PlayerMode, string>;
  descriptions: Record<PlayerMode, string>;
  onSelect: (contentType: PlayerContentType, mode: PlayerMode) => void;
}) {
  const modeIndex = playerModeOrder.indexOf(mode);
  const isSelected = mode === currentMode;
  const { ref, focused } = useFocusable({
    focusKey: getPlayerModeFocusKey(contentType, mode),
    onEnterPress: () => onSelect(contentType, mode),
    onArrowPress: (direction: string) => {
      if (direction === 'left' && modeIndex > 0) {
        const previousMode = playerModeOrder[modeIndex - 1];
        if (previousMode) {
          setFocus(getPlayerModeFocusKey(contentType, previousMode));
        }
        return false;
      }

      if (direction === 'right' && modeIndex < playerModeOrder.length - 1) {
        const nextMode = playerModeOrder[modeIndex + 1];
        if (nextMode) {
          setFocus(getPlayerModeFocusKey(contentType, nextMode));
        }
        return false;
      }

      if (direction === 'up') {
        setFocus(previousFocusKey);
        return false;
      }

      if (direction === 'down') {
        setFocus(nextFocusKey);
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={[
        styles.modeOption,
        isSelected ? styles.modeOptionSelected : '',
        focused ? styles.focused : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(contentType, mode)}
    >
      <span>
        <strong>{labels[mode]}</strong>
        <small>{descriptions[mode]}</small>
      </span>
      {isSelected && <em>{selectedLabel}</em>}
    </button>
  );
}

function PlayerModeSelect({
  contentType,
  title,
  description,
  currentMode,
  selectedLabel,
  previousFocusKey,
  nextFocusKey,
  labels,
  descriptions,
  onSelect,
}: {
  contentType: PlayerContentType;
  title: string;
  description: string;
  currentMode: PlayerMode;
  selectedLabel: string;
  previousFocusKey: string;
  nextFocusKey: string;
  labels: Record<PlayerMode, string>;
  descriptions: Record<PlayerMode, string>;
  onSelect: (contentType: PlayerContentType, mode: PlayerMode) => void;
}) {
  return (
    <div className={styles.modeSelect}>
      <div className={styles.modeSelectHeader}>
        <span className={styles.optionText}>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className={styles.value}>{labels[currentMode]}</span>
      </div>

      <div className={styles.modeOptions}>
        {playerModeOrder.map((mode) => (
          <PlayerModeOptionButton
            key={mode}
            contentType={contentType}
            mode={mode}
            currentMode={currentMode}
            selectedLabel={selectedLabel}
            previousFocusKey={previousFocusKey}
            nextFocusKey={nextFocusKey}
            labels={labels}
            descriptions={descriptions}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default function SettingsScreen({
  settings,
  deviceId,
  accountStatus,
  onSettingsChange,
  onBack,
  onLogout,
  onRefreshAccount,
  onClearCatalogCache,
}: SettingsScreenProps) {
  const copy = appCopy[settings.language].settings;
  const settingsSections = useMemo<SectionCardConfig[]>(() => (
    settingsSectionIcons.map((section) => {
      const textBySection: Record<SettingsSection, { title: string; description: string }> = {
        general: { title: copy.general, description: copy.generalDescription },
        player: { title: copy.player, description: copy.playerDescription },
        performance: { title: copy.performance, description: copy.performanceDescription },
        remote: { title: copy.remote, description: copy.remoteDescription },
        subscription: { title: copy.subscription, description: copy.subscriptionDescription },
        system: { title: copy.system, description: copy.systemDescription },
      };

      return {
        ...section,
        title: textBySection[section.id].title,
        description: textBySection[section.id].description,
      };
    })
  ), [copy]);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [lastSectionFocusKey, setLastSectionFocusKey] = useState(getSectionFocusKey('general'));
  const [feedback, setFeedback] = useState('');
  const [systemInfo, setSystemInfo] = useState<Record<'resolution' | 'platform' | 'userAgent', string>>({
    resolution: copy.notReported,
    platform: copy.notReported,
    userAgent: copy.notReported,
  });
  const { ref, focusKey } = useFocusable({
    focusKey: 'settings-screen',
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
  });
  const activeSectionConfig = settingsSections.find((section) => section.id === activeSection) ?? settingsSections[0];
  const ActiveIcon = activeSectionConfig.icon;
  const appVersion = useMemo(() => '0.1.0', []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus(getSectionFocusKey('general'));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSystemInfo({
        resolution: `${window.screen.width} x ${window.screen.height}`,
        platform: window.navigator.platform || copy.notReported,
        userAgent: window.navigator.userAgent,
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [copy.notReported]);

  useEffect(() => {
    const handleBackKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return;

      event.preventDefault();

      if (activeSection) {
        setActiveSection(null);
        window.setTimeout(() => setFocus(lastSectionFocusKey), 0);
        return;
      }

      onBack();
    };

    window.addEventListener('keydown', handleBackKey);

    return () => window.removeEventListener('keydown', handleBackKey);
  }, [activeSection, lastSectionFocusKey, onBack]);

  useEffect(() => {
    if (!feedback) return;

    const timeout = window.setTimeout(() => {
      setFeedback('');
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const openSection = useCallback((section: SettingsSection) => {
    const sectionFocusKey = getSectionFocusKey(section);

    setLastSectionFocusKey(sectionFocusKey);
    setActiveSection(section);
    setFeedback('');
    window.setTimeout(() => setFocus('settings-detail-back'), 0);
  }, []);

  const closeSection = useCallback(() => {
    setActiveSection(null);
    window.setTimeout(() => setFocus(lastSectionFocusKey), 0);
  }, [lastSectionFocusKey]);

  const updateSettings = useCallback((nextSettings: AppSettings, message: string) => {
    onSettingsChange(nextSettings);
    setFeedback(message);
  }, [onSettingsChange]);

  const selectLanguage = useCallback((language: AppLanguage) => {
    window.setTimeout(() => setFocus(getLanguageFocusKey(language)), 0);

    if (language === settings.language) {
      setFeedback(`${copy.language}: ${languageNames[language]}.`);
      return;
    }

    updateSettings(
      { ...settings, language },
      `${copy.languageChanged} ${languageNames[language]}.`
    );
  }, [copy.language, copy.languageChanged, settings, updateSettings]);

  const cycleControlsTimeout = useCallback(() => {
    const currentIndex = CONTROL_TIMEOUT_OPTIONS.indexOf(settings.controlsHideDelayMs);
    const nextValue = CONTROL_TIMEOUT_OPTIONS[(currentIndex + 1) % CONTROL_TIMEOUT_OPTIONS.length] ?? CONTROL_TIMEOUT_OPTIONS[0];

    updateSettings(
      { ...settings, controlsHideDelayMs: nextValue },
      `${copy.controlsFeedback} ${formatControlsTimeout(nextValue)}.`
    );
  }, [copy.controlsFeedback, settings, updateSettings]);

  const toggleAutoPlayNext = useCallback(() => {
    const nextValue = !settings.autoPlayNext;

    updateSettings(
      { ...settings, autoPlayNext: nextValue },
      nextValue ? copy.autoNextOn : copy.autoNextOff
    );
  }, [copy.autoNextOff, copy.autoNextOn, settings, updateSettings]);

  const playerModeLabels = useMemo<Record<PlayerMode, string>>(() => ({
    auto: copy.playerAuto,
    native: copy.playerNative,
    hls: copy.playerHls,
  }), [copy.playerAuto, copy.playerHls, copy.playerNative]);

  const playerModeDescriptions = useMemo<Record<PlayerMode, string>>(() => ({
    auto: copy.playerAutoDescription,
    native: copy.playerNativeDescription,
    hls: copy.playerHlsDescription,
  }), [copy.playerAutoDescription, copy.playerHlsDescription, copy.playerNativeDescription]);

  const playerContentTitles = useMemo<Record<PlayerContentType, string>>(() => ({
    live: copy.playerLive,
    movies: copy.playerMovies,
    series: copy.playerSeries,
  }), [copy.playerLive, copy.playerMovies, copy.playerSeries]);

  const getSelectedPlayerModeFocusKey = useCallback((
    contentType: PlayerContentType,
    modes: PlayerModeByType = settings.playerModeByType
  ) => getPlayerModeFocusKey(contentType, modes[contentType]), [settings.playerModeByType]);

  const selectPlayerMode = useCallback((contentType: PlayerContentType, mode: PlayerMode) => {
    window.setTimeout(() => setFocus(getPlayerModeFocusKey(contentType, mode)), 0);

    if (settings.playerModeByType[contentType] === mode) {
      setFeedback(`${playerContentTitles[contentType]}: ${playerModeLabels[mode]}.`);
      return;
    }

    updateSettings(
      {
        ...settings,
        playerModeByType: {
          ...settings.playerModeByType,
          [contentType]: mode,
        },
      },
      `${copy.playerModeFeedback} ${playerContentTitles[contentType]}: ${playerModeLabels[mode]}.`
    );
  }, [copy.playerModeFeedback, playerContentTitles, playerModeLabels, settings, updateSettings]);

  const handleClearCatalogCache = useCallback(() => {
    onClearCatalogCache();
    setFeedback(copy.clearCacheFeedback);
  }, [copy.clearCacheFeedback, onClearCatalogCache]);

  const handleRefreshAccount = useCallback(() => {
    onRefreshAccount();
    setFeedback(copy.refreshFeedback);
  }, [copy.refreshFeedback, onRefreshAccount]);

  const renderSectionContent = () => {
    if (activeSectionConfig.id === 'general') {
      return (
        <>
          <LanguageSelect
            currentLanguage={settings.language}
            title={copy.language}
            description={copy.languageDescription}
            selectedLabel={copy.current}
            previousFocusKey="settings-detail-back"
            nextFocusKey="settings-refresh-account"
            onSelect={selectLanguage}
          />
          <InfoRow title={copy.startupMode} description={copy.startupDescription} value={copy.menu} />
          <ActionRow
            focusKey="settings-refresh-account"
            title={copy.refreshValidation}
            description={copy.refreshDescription}
            value={copy.refreshValidation}
            previousFocusKey={getLanguageFocusKey(settings.language)}
            nextFocusKey="settings-general-cache"
            onPress={handleRefreshAccount}
          />
          <ActionRow
            focusKey="settings-general-cache"
            title={copy.clearCache}
            description={copy.clearCacheDescription}
            value={copy.clearCache}
            previousFocusKey="settings-refresh-account"
            nextFocusKey="settings-detail-close"
            onPress={handleClearCatalogCache}
          />
        </>
      );
    }

    if (activeSectionConfig.id === 'player') {
      return (
        <>
          <PlayerModeSelect
            contentType="live"
            title={copy.playerLive}
            description={`${copy.playerType}: ${copy.playerTypeDescription}`}
            currentMode={settings.playerModeByType.live}
            selectedLabel={copy.current}
            previousFocusKey="settings-detail-back"
            nextFocusKey={getSelectedPlayerModeFocusKey('movies')}
            labels={playerModeLabels}
            descriptions={playerModeDescriptions}
            onSelect={selectPlayerMode}
          />
          <PlayerModeSelect
            contentType="movies"
            title={copy.playerMovies}
            description={`${copy.playerType}: ${copy.playerTypeDescription}`}
            currentMode={settings.playerModeByType.movies}
            selectedLabel={copy.current}
            previousFocusKey={getSelectedPlayerModeFocusKey('live')}
            nextFocusKey={getSelectedPlayerModeFocusKey('series')}
            labels={playerModeLabels}
            descriptions={playerModeDescriptions}
            onSelect={selectPlayerMode}
          />
          <PlayerModeSelect
            contentType="series"
            title={copy.playerSeries}
            description={`${copy.playerType}: ${copy.playerTypeDescription}`}
            currentMode={settings.playerModeByType.series}
            selectedLabel={copy.current}
            previousFocusKey={getSelectedPlayerModeFocusKey('movies')}
            nextFocusKey="settings-controls-timeout"
            labels={playerModeLabels}
            descriptions={playerModeDescriptions}
            onSelect={selectPlayerMode}
          />
          <ActionRow
            focusKey="settings-controls-timeout"
            title={copy.controlsTime}
            description={copy.controlsTimeDescription}
            value={formatControlsTimeout(settings.controlsHideDelayMs)}
            previousFocusKey={getSelectedPlayerModeFocusKey('series')}
            nextFocusKey="settings-auto-next"
            onPress={cycleControlsTimeout}
          />
          <ActionRow
            focusKey="settings-auto-next"
            title={copy.playbackStop}
            description={copy.playbackStopDescription}
            value={settings.autoPlayNext ? copy.autoNext : copy.stay}
            tone={settings.autoPlayNext ? 'success' : 'default'}
            previousFocusKey="settings-controls-timeout"
            nextFocusKey="settings-detail-close"
            onPress={toggleAutoPlayNext}
          />
          <InfoRow
            title={copy.channelChange}
            description={copy.channelChangeDescription}
            value="CH+/CH-"
            tone="success"
          />
        </>
      );
    }

    if (activeSectionConfig.id === 'performance') {
      return (
        <>
          <ActionRow
            focusKey="settings-clear-cache"
            title={copy.clearCache}
            description={copy.clearCacheDescription}
            value={copy.clearCache}
            previousFocusKey="settings-detail-back"
            nextFocusKey="settings-detail-close"
            onPress={handleClearCatalogCache}
          />
          <InfoRow
            title={copy.lightweightPreview}
            description={copy.lightweightPreviewDescription}
            value={copy.active}
            tone="success"
          />
          <InfoRow
            title={copy.render}
            description={copy.renderDescription}
            value={copy.renderValue}
          />
        </>
      );
    }

    if (activeSectionConfig.id === 'remote') {
      return (
        <>
          <InfoRow title={copy.arrows} description={copy.arrowsDescription} value={copy.navigate} />
          <InfoRow title={copy.okShort} description={copy.okShortDescription} value={copy.select} />
          <InfoRow title={copy.okHold} description={copy.okHoldDescription} value={appCopy[settings.language].media.favorites} />
          <InfoRow title="CH+ / CH-" description={copy.remoteChannelsDescription} value="Player" />
        </>
      );
    }

    if (activeSectionConfig.id === 'subscription') {
      return (
        <>
          <InfoRow title={copy.status} description={copy.statusDescription} value={accountStatus} tone="success" />
          <InfoRow title={copy.deviceId} description={copy.deviceIdDescription} value={deviceId} />
          <ActionRow
            focusKey="settings-subscription-refresh"
            title={copy.updateSubscription}
            description={copy.updateSubscriptionDescription}
            value={copy.refreshValidation}
            previousFocusKey="settings-detail-back"
            nextFocusKey="settings-logout"
            onPress={handleRefreshAccount}
          />
          <ActionRow
            focusKey="settings-logout"
            title={copy.logoutAccount}
            description={copy.logoutDescription}
            value={appCopy[settings.language].common.logout}
            tone="danger"
            previousFocusKey="settings-subscription-refresh"
            nextFocusKey="settings-detail-close"
            onPress={onLogout}
          />
        </>
      );
    }

    return (
      <>
        <InfoRow title={copy.appVersion} description={copy.appVersionDescription} value={appVersion} />
        <InfoRow title={copy.resolution} description={copy.resolutionDescription} value={systemInfo.resolution} />
        <InfoRow title={copy.platform} description={copy.platformDescription} value={systemInfo.platform} />
        <InfoRow title={copy.browser} description={copy.browserDescription} value={systemInfo.userAgent} />
      </>
    );
  };

  const firstActionFocusKeyBySection: Record<SettingsSection, string> = {
    general: getLanguageFocusKey(settings.language),
    player: getSelectedPlayerModeFocusKey('live'),
    performance: 'settings-clear-cache',
    remote: 'settings-detail-close',
    subscription: 'settings-subscription-refresh',
    system: 'settings-detail-close',
  };
  const firstActionFocusKey = activeSection ? firstActionFocusKeyBySection[activeSection] : 'settings-main-close';

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.headerIcon}>
              {activeSection ? <ActiveIcon size={34} /> : <Settings size={34} />}
            </span>
            <div>
              <span className={styles.eyebrow}>{copy.eyebrow}</span>
              <h1>{activeSection ? activeSectionConfig.title : copy.title}</h1>
            </div>
          </div>

          {activeSection ? (
            <>
              <div className={styles.detailHeader}>
                <PanelButton
                  focusKey="settings-detail-back"
                  onPress={closeSection}
                  nextFocusKey={firstActionFocusKey}
                >
                  <ArrowLeft size={22} />
                  <span>{appCopy[settings.language].common.back}</span>
                </PanelButton>
                <p>{activeSectionConfig.description}</p>
              </div>

              <div className={styles.optionList}>
                {renderSectionContent()}
              </div>

              <div className={styles.panelFooter}>
                <div className={styles.feedback}>
                  {feedback || copy.useOk}
                </div>
                <PanelButton
                  focusKey="settings-detail-close"
                  onPress={closeSection}
                  previousFocusKey={firstActionFocusKey}
                >
                  {appCopy[settings.language].common.close}
                </PanelButton>
              </div>
            </>
          ) : (
            <>
              <div className={styles.sectionGrid}>
                {settingsSections.map((section, index) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={index}
                    sections={settingsSections}
                    onOpen={openSection}
                  />
                ))}
              </div>

              <div className={styles.panelFooter}>
                <div className={styles.feedback}>
                  <CircleHelp size={18} />
                  <span>{copy.chooseItem}</span>
                </div>
                <PanelButton
                  focusKey="settings-main-close"
                  onPress={onBack}
                  previousFocusKey={getSectionFocusKey('system')}
                >
                  {appCopy[settings.language].common.close}
                </PanelButton>
              </div>
            </>
          )}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
