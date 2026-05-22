/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import MainMenu, { MainMenuSection } from '@/components/MainMenu';
import SettingsScreen from '@/components/SettingsScreen';
import CategoryGrid, { MediaCategory } from '@/components/CategoryGrid';
import ChannelListView, {
  ChannelListViewChannel,
  getChannelFocusKey,
} from '@/components/ChannelListView';
import { getCategories, getStreams, buildStreamUrl } from '@/lib/iptvEngine';
import { getDeviceId } from '@/lib/device';
import { getFavoriteIds, getFavorites, toggleFavorite } from '@/lib/favorites';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import { DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings, type AppSettings } from '@/lib/settings';
import { init, setFocus, useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

init({
  debug: false,
  visualDebug: false,
});

type ActionParams = {
  cat: string;
  stream: string;
  type: 'live' | 'vod' | 'series';
};

const CONTENT_BATCH_SIZE = 60;
const CATEGORY_CONTENT_CACHE_LIMIT = 6;
type MediaSection = Exclude<MainMenuSection, 'settings'>;

function getCachedCategoryContent(
  cache: Map<string, ChannelListViewChannel[]>,
  key: string
) {
  const cachedChannels = cache.get(key);

  if (!cachedChannels) return null;

  cache.delete(key);
  cache.set(key, cachedChannels);
  return cachedChannels;
}

function setCachedCategoryContent(
  cache: Map<string, ChannelListViewChannel[]>,
  key: string,
  channels: ChannelListViewChannel[]
) {
  cache.delete(key);
  cache.set(key, channels);

  while (cache.size > CATEGORY_CONTENT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
}

const getActionParams = (tab: string): ActionParams => {
  if (tab.includes('movies')) {
    return { cat: 'get_vod_categories', stream: 'get_vod_streams', type: 'vod' };
  }

  if (tab.includes('series')) {
    return { cat: 'get_series_categories', stream: 'get_series', type: 'series' };
  }

  return { cat: 'get_live_categories', stream: 'get_live_streams', type: 'live' };
};

const getCurrentMediaKey = (tab: string): MediaSection => {
  if (tab.includes('movies')) return 'movies';
  if (tab.includes('series')) return 'series';
  return 'live';
};

const emptyFavoriteIds: Record<MediaSection, string[]> = {
  live: [],
  movies: [],
  series: [],
};

type LogoutConfirmModalProps = {
  language: AppLanguage;
  onCancel: () => void;
  onConfirm: () => void;
};

type LogoutConfirmButtonProps = {
  className: string;
  focusKey: string;
  onPress: () => void;
  children: React.ReactNode;
};

function LogoutConfirmButton({ className, focusKey, onPress, children }: LogoutConfirmButtonProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${className} ${focused ? 'modalButtonFocused' : ''}`}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function LogoutConfirmModal({ language, onCancel, onConfirm }: LogoutConfirmModalProps) {
  const copy = appCopy[language].common;
  const { ref, focusKey } = useFocusable({
    focusKey: 'logout-confirm-modal',
    trackChildren: true,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('logout-confirm-cancel');
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div className="logoutModalOverlay" role="presentation">
        <div className="logoutModal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="logout-modal-title">
          <div className="logoutModalIcon">N</div>
          <h2 id="logout-modal-title">{copy.logoutTitle}</h2>
          <p>{copy.logoutDescription}</p>

          <div className="logoutModalActions">
            <LogoutConfirmButton
              className="modalButton modalButtonGhost"
              focusKey="logout-confirm-cancel"
              onPress={onCancel}
            >
              {copy.cancel}
            </LogoutConfirmButton>

            <LogoutConfirmButton
              className="modalButton modalButtonDanger"
              focusKey="logout-confirm-confirm"
              onPress={onConfirm}
            >
              {copy.confirmLogout}
            </LogoutConfirmButton>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}

export default function Home() {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [previewChannel, setPreviewChannel] = useState<ChannelListViewChannel | null>(null);
  const [preparedPreviewChannelId, setPreparedPreviewChannelId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [isBlocked, setIsBlocked] = useState(true);
  const [activationData, setActivationData] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [mainMenuFocusKey, setMainMenuFocusKey] = useState('main-menu-live');
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [loadedCategories, setLoadedCategories] = useState<any[]>([]);
  const [allCategoryChannels, setAllCategoryChannels] = useState<ChannelListViewChannel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | null>(null);
  const [favoriteIdsByType, setFavoriteIdsByType] = useState<Record<MediaSection, string[]>>(emptyFavoriteIds);
  const [favoriteFeedback, setFavoriteFeedback] = useState('');
  const hasSetInitialFocus = useRef(false);
  const categoryContentCache = useRef(new Map<string, ChannelListViewChannel[]>());
  const copy = appCopy[appSettings.language];

  const checkDeviceSecurity = useCallback(async () => {
    const deviceId = getDeviceId();
    setIsInitialLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/devices/check-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: deviceId }),
      });

      const data = await response.json();

      if (data.status === 'active') {
        setCredentials(data.credentials);
        setIsLoggedIn(true);
        setIsBlocked(false);
        setActivationData(null);
      } else {
        setActivationData(data);
        setCredentials(null);
        setIsBlocked(true);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Erro ao conectar no servidor de checagem:', error);
      setActivationData({ mac: deviceId, device_key: 'ERRO_BACKEND' });
      setCredentials(null);
      setIsBlocked(true);
      setIsLoggedIn(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      checkDeviceSecurity();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [checkDeviceSecurity]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFavoriteIdsByType({
        live: getFavoriteIds('live'),
        movies: getFavoriteIds('movies'),
        series: getFavoriteIds('series'),
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppSettings(getAppSettings());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !credentials) return;

    const isUtilityTab = activeTab === 'home' || activeTab === 'search' || activeTab === 'settings';
    if (isUtilityTab) {
      const timeout = window.setTimeout(() => {
        setAllCategories([]);
        setLoadedCategories([]);
        setAllCategoryChannels([]);
        setSelectedCategory(null);
        setPreviewChannel(null);
        setPreparedPreviewChannelId(null);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    let isCancelled = false;

    const loadCategories = async () => {
      setAllCategories([]);
      setLoadedCategories([]);
      setAllCategoryChannels([]);
      setSelectedCategory(null);
      setPreviewChannel(null);
      setPreparedPreviewChannelId(null);
      setIsLoadingCategories(true);

      try {
        const params = getActionParams(activeTab);
        const rawCategories = await getCategories(credentials.url, credentials.user, credentials.pass, params.cat);

        if (!isCancelled) {
          setAllCategories(Array.isArray(rawCategories) ? rawCategories : []);
        }
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);

        if (!isCancelled) {
          setAllCategories([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCategories(false);
        }
      }
    };

    loadCategories();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, credentials, isLoggedIn]);

  useEffect(() => {
    const checkCanScrollDown = () => {
      const pageHeight = document.documentElement.scrollHeight;
      const screenHeight = window.innerHeight;
      const currentScroll = window.scrollY;
      const hasVerticalScroll = pageHeight > screenHeight + 80;
      const isNearBottom = currentScroll + screenHeight >= pageHeight - 120;

      setCanScrollDown(
        activeTab !== 'home' &&
          activeTab !== 'search' &&
          activeTab !== 'settings' &&
          !selectedChannel &&
          hasVerticalScroll &&
          !isNearBottom
      );
    };

    checkCanScrollDown();
    const timeout = window.setTimeout(checkCanScrollDown, 300);

    window.addEventListener('scroll', checkCanScrollDown, { passive: true });
    window.addEventListener('resize', checkCanScrollDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('scroll', checkCanScrollDown);
      window.removeEventListener('resize', checkCanScrollDown);
    };
  }, [activeTab, selectedChannel, loadedCategories.length, isLoadingMore, selectedCategory]);

  useEffect(() => {
    if (!hasSetInitialFocus.current && !isInitialLoading && isLoggedIn && !isBlocked) {
      hasSetInitialFocus.current = true;
      setFocus('main-menu-live');
    }
  }, [isBlocked, isInitialLoading, isLoggedIn]);

  const handleLogout = useCallback(() => {
    setIsLogoutConfirmOpen(false);
    localStorage.removeItem('skyflow_device_id');
    hasSetInitialFocus.current = false;
    setSelectedChannel(null);
    setMainMenuFocusKey('main-menu-live');
    setActiveTab('home');
    setAllCategories([]);
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    setIsLoadingCategories(false);
    setCanScrollDown(false);
    categoryContentCache.current.clear();
    checkDeviceSecurity();
  }, [checkDeviceSecurity]);

  const handleOpenLogoutConfirm = useCallback(() => {
    setIsLogoutConfirmOpen(true);
  }, []);

  const handleMainMenuSelect = useCallback((section: MainMenuSection) => {
    setMainMenuFocusKey(`main-menu-${section}`);
    setActiveTab(section);
  }, []);

  const handleBackToMainMenu = useCallback(() => {
    setMainMenuFocusKey('main-menu-live');
    setActiveTab('home');
    setAllCategories([]);
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    window.setTimeout(() => setFocus('main-menu-live'), 0);
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setMainMenuFocusKey('main-menu-settings');
    setActiveTab('home');
  }, []);

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setAppSettings(nextSettings);
    saveAppSettings(nextSettings);
  }, []);

  const handleClearCatalogCache = useCallback(() => {
    categoryContentCache.current.clear();
  }, []);

  const handleBackToCategories = useCallback(() => {
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    window.setTimeout(() => setFocus('category-grid-back'), 0);
  }, []);

  const currentMediaKey = getCurrentMediaKey(activeTab);

  const categoryGridItems: MediaCategory[] = useMemo(() => {
    const mappedCategories = allCategories.map((category) => ({
      id: String(category.category_id),
      name: category.category_name || 'Sem nome',
    }));

    return [
      { id: `${currentMediaKey}-favorites`, name: copy.media.favorites, isFavorites: true },
      { id: `${currentMediaKey}-all`, name: copy.media.all, isAll: true },
      ...mappedCategories,
    ];
  }, [allCategories, copy.media.all, copy.media.favorites, currentMediaKey]);

  const loadCategoryStreams = useCallback(async (category: MediaCategory) => {
    if (!credentials) return;

    const params = getActionParams(activeTab);
    const categoryCacheKey = `${params.type}:${category.id}`;
    let firstChannelFocusKey = 'content-back';
    setSelectedCategory(category);
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    setIsLoadingMore(true);
    setFavoriteFeedback('');

    try {
      if (category.isFavorites) {
        const channels: ChannelListViewChannel[] = getFavorites(currentMediaKey).map((favorite) => ({
          id: favorite.id,
          name: favorite.name,
          logo: favorite.logo || '',
          url: favorite.url,
        }));
        const firstChannel = channels[0] ?? null;

        firstChannelFocusKey = firstChannel ? getChannelFocusKey(firstChannel.id) : 'content-back';
        setPreviewChannel(firstChannel);
        setAllCategoryChannels(channels);
        setLoadedCategories([{ id: category.id, name: category.name, channels }]);
        return;
      }

      const cachedChannels = getCachedCategoryContent(categoryContentCache.current, categoryCacheKey);

      if (cachedChannels) {
        const firstChannel = cachedChannels[0] ?? null;

        firstChannelFocusKey = firstChannel ? getChannelFocusKey(firstChannel.id) : 'content-back';
        setPreviewChannel(firstChannel);
        setAllCategoryChannels(cachedChannels);
        setLoadedCategories([{
          id: category.id,
          name: category.name,
          channels: cachedChannels.slice(0, CONTENT_BATCH_SIZE),
        }]);
        return;
      }

      const categoryId = category.isAll ? undefined : category.id;
      const streams = await getStreams(credentials.url, credentials.user, credentials.pass, params.stream, categoryId);
      const channels: ChannelListViewChannel[] = Array.isArray(streams)
        ? streams.map((stream: any) => {
          const streamId = stream.stream_id || stream.series_id;
          const name = stream.name || stream.title || 'Sem Nome';
          const logo = stream.stream_icon || stream.cover || '';
          const extension = stream.container_extension || 'm3u8';

          return {
            id: String(streamId),
            name,
            logo,
            url: buildStreamUrl(credentials.url, credentials.user, credentials.pass, params.type, String(streamId), extension),
          };
        })
        : [];

      const firstChannel = channels[0] ?? null;
      firstChannelFocusKey = firstChannel ? getChannelFocusKey(firstChannel.id) : 'content-back';
      setCachedCategoryContent(categoryContentCache.current, categoryCacheKey, channels);
      setPreviewChannel(firstChannel);
      setAllCategoryChannels(channels);
      setLoadedCategories([{ id: category.id, name: category.name, channels: channels.slice(0, CONTENT_BATCH_SIZE) }]);
    } catch (error) {
      console.error('Erro ao carregar conteudo da categoria:', error);
      setAllCategoryChannels([]);
      setLoadedCategories([{ id: category.id, name: category.name, channels: [] }]);
      setPreviewChannel(null);
    } finally {
      setIsLoadingMore(false);
      window.setTimeout(() => setFocus(firstChannelFocusKey), 0);
    }
  }, [activeTab, credentials, currentMediaKey]);

  const currentChannels: ChannelListViewChannel[] = useMemo(
    () => loadedCategories[0]?.channels ?? [],
    [loadedCategories]
  );
  const searchSourceChannels = allCategoryChannels.length > 0 ? allCategoryChannels : currentChannels;
  const currentFavoriteIds = favoriteIdsByType[currentMediaKey] ?? [];

  const playableChannels = useMemo(
    () => allCategoryChannels.length > 0 ? allCategoryChannels : loadedCategories.flatMap((category) => category.channels),
    [allCategoryChannels, loadedCategories]
  );

  const selectedChannelIndex = selectedChannel
    ? playableChannels.findIndex((channel) => channel.url === selectedChannel.url)
    : -1;

  const handleLoadMoreContent = useCallback(() => {
    if (!selectedCategory || selectedCategory.isFavorites) return;
    if (currentChannels.length >= allCategoryChannels.length) return;

    const nextChannels = allCategoryChannels.slice(0, currentChannels.length + CONTENT_BATCH_SIZE);
    setLoadedCategories((categories) =>
      categories.map((category, index) =>
        index === 0 ? { ...category, channels: nextChannels } : category
      )
    );
  }, [allCategoryChannels, currentChannels.length, selectedCategory]);

  const handleClosePlayer = useCallback(() => {
    setSelectedChannel(null);
    window.setTimeout(() => {
      setFocus(previewChannel ? getChannelFocusKey(previewChannel.id) : 'content-back');
    }, 0);
  }, [previewChannel]);

  const handlePreviousChannel = useCallback(() => {
    if (selectedChannelIndex > 0) {
      const channel = playableChannels[selectedChannelIndex - 1];
      setSelectedChannel(channel);
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
    }
  }, [playableChannels, selectedChannelIndex]);

  const handleNextChannel = useCallback(() => {
    if (selectedChannelIndex >= 0 && selectedChannelIndex < playableChannels.length - 1) {
      const channel = playableChannels[selectedChannelIndex + 1];
      setSelectedChannel(channel);
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
    }
  }, [playableChannels, selectedChannelIndex]);

  const handleChannelFocus = useCallback((channel: ChannelListViewChannel) => {
    if (previewChannel?.id === channel.id) return;

    setPreviewChannel(channel);
    setPreparedPreviewChannelId(null);
  }, [previewChannel]);

  const handleChannelPress = useCallback((channel: ChannelListViewChannel) => {
    if (previewChannel?.id !== channel.id || preparedPreviewChannelId !== channel.id) {
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
      return;
    }

    setSelectedChannel(channel);
  }, [preparedPreviewChannelId, previewChannel]);

  const handleFavoriteToggle = useCallback((channel: ChannelListViewChannel) => {
    const result = toggleFavorite(currentMediaKey, channel);
    const nextFavoriteIds = result.favorites.map((favorite) => favorite.id);

    setFavoriteIdsByType((previousIds) => ({
      ...previousIds,
      [currentMediaKey]: nextFavoriteIds,
    }));
    setFavoriteFeedback(result.isFavorite ? copy.content.favoriteAdded : copy.content.favoriteRemoved);

    if (selectedCategory?.isFavorites && !result.isFavorite) {
      const channelIndex = currentChannels.findIndex((currentChannel) => currentChannel.id === channel.id);
      const remainingChannels = currentChannels.filter((currentChannel) => currentChannel.id !== channel.id);
      const nextChannel = remainingChannels[Math.min(Math.max(channelIndex, 0), remainingChannels.length - 1)] ?? null;

      setLoadedCategories((categories) =>
        categories.map((category, index) =>
          index === 0 ? { ...category, channels: remainingChannels } : category
        )
      );
      setPreviewChannel(nextChannel);
      setAllCategoryChannels(remainingChannels);
      setPreparedPreviewChannelId(null);

      window.setTimeout(() => {
        setFocus(nextChannel ? getChannelFocusKey(nextChannel.id) : 'content-back');
      }, 0);
    }
  }, [copy.content.favoriteAdded, copy.content.favoriteRemoved, currentChannels, currentMediaKey, selectedCategory]);

  const handlePreviewPress = useCallback(() => {
    if (!previewChannel) return;

    setPreparedPreviewChannelId(previewChannel.id);
    setSelectedChannel(previewChannel);
  }, [previewChannel]);

  useEffect(() => {
    if (!favoriteFeedback) return;

    const timeout = window.setTimeout(() => {
      setFavoriteFeedback('');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [favoriteFeedback]);

  const activeDeviceId = typeof window === 'undefined' ? '' : getDeviceId();
  const accountStatus = isLoggedIn && !isBlocked ? copy.settings.active : copy.common.waitingActivation;
  const currentMediaTexts = {
    live: {
      title: copy.media.liveTitle,
      subtitle: copy.media.liveSubtitle,
    },
    movies: {
      title: copy.media.moviesTitle,
      subtitle: copy.media.moviesSubtitle,
    },
    series: {
      title: copy.media.seriesTitle,
      subtitle: copy.media.seriesSubtitle,
    },
  } satisfies Record<MediaSection, { title: string; subtitle: string }>;

  if (isInitialLoading) {
    return (
      <div className="nuvixLoading">
        <div className="nuvixGlow"></div>
        <div className="nuvixLoaderCard">
          <h1>Nuvix</h1>
          <div className="loadingBar"><span></span></div>
          <p>{copy.common.loadingExperience}</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="nuvixLoading">
        <div className="nuvixLoaderCard activationCard">
          <h1>Nuvix</h1>
          <p className="activationStatus">{copy.common.waitingActivation}</p>
          <div className="activationInfo">
            <small>{copy.common.deviceId}</small><br />
            <code>{activationData?.mac}</code><br /><br />
            <small>{copy.common.activationCode}</small><br />
            <code>{activationData?.device_key}</code>
          </div>
          <p className="activationHelp">{copy.common.activationHelp}</p>
        </div>
      </div>
    );
  }

  return (
    <main
      style={{
        width: '100vw',
        minHeight: '100vh',
        backgroundColor: '#05050b',
      }}
    >
      {activeTab === 'home' ? (
        <MainMenu
          onSelect={handleMainMenuSelect}
          initialFocusKey={mainMenuFocusKey}
          language={appSettings.language}
        />
      ) : activeTab === 'settings' ? (
        <SettingsScreen
          settings={appSettings}
          deviceId={activeDeviceId}
          accountStatus={accountStatus}
          onSettingsChange={handleSettingsChange}
          onBack={handleBackFromSettings}
          onLogout={handleOpenLogoutConfirm}
          onRefreshAccount={checkDeviceSecurity}
          onClearCatalogCache={handleClearCatalogCache}
        />
      ) : !selectedCategory ? (
        <CategoryGrid
          title={currentMediaTexts[currentMediaKey].title}
          subtitle={currentMediaTexts[currentMediaKey].subtitle}
          categories={categoryGridItems}
          isLoading={isLoadingCategories}
          onBack={handleBackToMainMenu}
          onSelect={loadCategoryStreams}
          language={appSettings.language}
        />
      ) : (
        <ChannelListView
          mediaTitle={currentMediaTexts[currentMediaKey].title}
          categoryName={selectedCategory.name}
          channels={currentChannels}
          searchChannels={searchSourceChannels}
          selectedChannel={previewChannel}
          preparedChannelId={preparedPreviewChannelId}
          isLoading={isLoadingMore}
          favoriteIds={currentFavoriteIds}
          favoriteFeedback={favoriteFeedback}
          epgCredentials={currentMediaKey === 'live' ? credentials : null}
          showEpg={currentMediaKey === 'live'}
          emptyMessage={
            selectedCategory.isFavorites
              ? copy.content.emptyFavorites
              : undefined
          }
          onBack={handleBackToCategories}
          onChannelFocus={handleChannelFocus}
          onChannelPress={handleChannelPress}
          onFavoriteToggle={handleFavoriteToggle}
          onEndReached={handleLoadMoreContent}
          onPreviewPress={handlePreviewPress}
          language={appSettings.language}
        />
      )}

      {canScrollDown && (
        <div className="scrollDownHint">
          <span>v</span>
          <p>Mais categorias abaixo</p>
        </div>
      )}

      {selectedChannel && (
        <VideoPlayer
          url={selectedChannel.url}
          title={selectedChannel.name}
          onClose={handleClosePlayer}
          onPrevious={handlePreviousChannel}
          onNext={handleNextChannel}
          hasPrevious={selectedChannelIndex > 0}
          hasNext={selectedChannelIndex >= 0 && selectedChannelIndex < playableChannels.length - 1}
          controlsHideDelayMs={appSettings.controlsHideDelayMs}
          autoPlayNext={appSettings.autoPlayNext}
          playerMode={appSettings.playerModeByType[currentMediaKey]}
          language={appSettings.language}
        />
      )}

      {isLogoutConfirmOpen && (
        <LogoutConfirmModal
          language={appSettings.language}
          onCancel={() => setIsLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
        />
      )}

      <style jsx global>{`
        body { overflow: ${selectedChannel ? 'hidden' : 'auto'}; background-color: #000; color: #fff; }
      `}</style>
    </main>
  );
}
