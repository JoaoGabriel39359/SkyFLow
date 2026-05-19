/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import MainMenu, { MainMenuSection } from '@/components/MainMenu';
import CategoryGrid, { MediaCategory } from '@/components/CategoryGrid';
import ChannelListView, {
  ChannelListViewChannel,
  getChannelFocusKey,
} from '@/components/ChannelListView';
import { getCategories, getStreams, buildStreamUrl } from '@/lib/iptvEngine';
import { getDeviceId } from '@/lib/device';
import { getFavoriteIds, getFavorites, toggleFavorite } from '@/lib/favorites';
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

const FALLBACK_LOGO = 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=60';
const CONTENT_BATCH_SIZE = 60;

const mediaTitles: Record<MainMenuSection, { title: string; subtitle: string }> = {
  live: {
    title: 'TV ao Vivo',
    subtitle: 'Escolha uma pasta para carregar apenas os canais dessa categoria.',
  },
  movies: {
    title: 'Filmes',
    subtitle: 'Navegue pelas pastas de filmes e carregue somente o que deseja assistir.',
  },
  series: {
    title: 'Series',
    subtitle: 'Selecione uma pasta para listar as series disponiveis.',
  },
};

const getActionParams = (tab: string): ActionParams => {
  if (tab.includes('movies')) {
    return { cat: 'get_vod_categories', stream: 'get_vod_streams', type: 'vod' };
  }

  if (tab.includes('series')) {
    return { cat: 'get_series_categories', stream: 'get_series', type: 'series' };
  }

  return { cat: 'get_live_categories', stream: 'get_live_streams', type: 'live' };
};

const getCurrentMediaKey = (tab: string): MainMenuSection => {
  if (tab.includes('movies')) return 'movies';
  if (tab.includes('series')) return 'series';
  return 'live';
};

const emptyFavoriteIds: Record<MainMenuSection, string[]> = {
  live: [],
  movies: [],
  series: [],
};

type LogoutConfirmModalProps = {
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

function LogoutConfirmModal({ onCancel, onConfirm }: LogoutConfirmModalProps) {
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
          <h2 id="logout-modal-title">Deseja realmente sair?</h2>
          <p>Ao confirmar, este dispositivo volta para a tela de ativacao do codigo.</p>

          <div className="logoutModalActions">
            <LogoutConfirmButton
              className="modalButton modalButtonGhost"
              focusKey="logout-confirm-cancel"
              onPress={onCancel}
            >
              Cancelar
            </LogoutConfirmButton>

            <LogoutConfirmButton
              className="modalButton modalButtonDanger"
              focusKey="logout-confirm-confirm"
              onPress={onConfirm}
            >
              Deslogar
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
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [loadedCategories, setLoadedCategories] = useState<any[]>([]);
  const [allCategoryChannels, setAllCategoryChannels] = useState<ChannelListViewChannel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | null>(null);
  const [favoriteIdsByType, setFavoriteIdsByType] = useState<Record<MainMenuSection, string[]>>(emptyFavoriteIds);
  const [favoriteFeedback, setFavoriteFeedback] = useState('');
  const hasSetInitialFocus = useRef(false);
  const categoryContentCache = useRef(new Map<string, ChannelListViewChannel[]>());

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
    setActiveTab(section);
  }, []);

  const handleBackToMainMenu = useCallback(() => {
    setActiveTab('home');
    setAllCategories([]);
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    window.setTimeout(() => setFocus('main-menu-live'), 0);
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
      { id: `${currentMediaKey}-favorites`, name: 'Favoritos', isFavorites: true },
      { id: `${currentMediaKey}-all`, name: 'Todos', isAll: true },
      ...mappedCategories,
    ];
  }, [allCategories, currentMediaKey]);

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
          logo: favorite.logo || FALLBACK_LOGO,
          url: favorite.url,
        }));
        const firstChannel = channels[0] ?? null;

        firstChannelFocusKey = firstChannel ? getChannelFocusKey(firstChannel.id) : 'content-back';
        setPreviewChannel(firstChannel);
        setAllCategoryChannels(channels);
        setLoadedCategories([{ id: category.id, name: category.name, channels }]);
        return;
      }

      const cachedChannels = categoryContentCache.current.get(categoryCacheKey);

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
          const logo = stream.stream_icon || stream.cover || FALLBACK_LOGO;
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
      categoryContentCache.current.set(categoryCacheKey, channels);
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
    setFavoriteFeedback(result.isFavorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos');

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
  }, [currentChannels, currentMediaKey, selectedCategory]);

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

  if (isInitialLoading) {
    return (
      <div className="nuvixLoading">
        <div className="nuvixGlow"></div>
        <div className="nuvixLoaderCard">
          <h1>Nuvix</h1>
          <div className="loadingBar"><span></span></div>
          <p>Carregando sua experiencia...</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="nuvixLoading">
        <div className="nuvixLoaderCard activationCard">
          <h1>Nuvix</h1>
          <p className="activationStatus">AGUARDANDO ATIVACAO</p>
          <div className="activationInfo">
            <small>ID DO DISPOSITIVO:</small><br />
            <code>{activationData?.mac}</code><br /><br />
            <small>CODIGO DE ATIVACAO:</small><br />
            <code>{activationData?.device_key}</code>
          </div>
          <p className="activationHelp">Envie esses dados para seu revendedor liberar seu acesso de 1 ano.</p>
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
        <MainMenu onSelect={handleMainMenuSelect} onLogout={handleOpenLogoutConfirm} />
      ) : !selectedCategory ? (
        <CategoryGrid
          title={mediaTitles[currentMediaKey].title}
          subtitle={mediaTitles[currentMediaKey].subtitle}
          categories={categoryGridItems}
          isLoading={isLoadingCategories}
          onBack={handleBackToMainMenu}
          onLogout={handleOpenLogoutConfirm}
          onSelect={loadCategoryStreams}
        />
      ) : (
        <ChannelListView
          mediaTitle={mediaTitles[currentMediaKey].title}
          categoryName={selectedCategory.name}
          channels={currentChannels}
          searchChannels={searchSourceChannels}
          selectedChannel={previewChannel}
          preparedChannelId={preparedPreviewChannelId}
          isLoading={isLoadingMore}
          favoriteIds={currentFavoriteIds}
          favoriteFeedback={favoriteFeedback}
          emptyMessage={
            selectedCategory.isFavorites
              ? 'Nenhum favorito ainda. Segure OK em um conteudo para adicionar aos favoritos.'
              : undefined
          }
          onBack={handleBackToCategories}
          onLogout={handleOpenLogoutConfirm}
          onChannelFocus={handleChannelFocus}
          onChannelPress={handleChannelPress}
          onFavoriteToggle={handleFavoriteToggle}
          onEndReached={handleLoadMoreContent}
          onPreviewPress={handlePreviewPress}
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
        />
      )}

      {isLogoutConfirmOpen && (
        <LogoutConfirmModal
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
