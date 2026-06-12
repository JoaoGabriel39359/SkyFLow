/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import ExploreHome, { type ExploreMediaSection } from '@/components/ExploreHome';
import MediaCategoryRails, {
  type MediaCategoryRailData,
  type MediaCategoryRailsSection,
} from '@/components/MediaCategoryRails';
import MediaFullscreenDetails from '@/components/MediaFullscreenDetails';
import SeriesEpisodeBrowser from '@/components/SeriesEpisodeBrowser';
import type { MainMenuSection } from '@/components/MainMenu';
import SettingsScreen from '@/components/SettingsScreen';
import CategoryGrid, { getCategoryFocusKey, MediaCategory } from '@/components/CategoryGrid';
import ParentalPinModal from '@/components/ParentalPinModal';
import ChannelListView, {
  ChannelListViewChannel,
  getChannelFocusKey,
} from '@/components/ChannelListView';
import { getCategories, getStreams, buildStreamUrl } from '@/lib/iptvEngine';
import { getDeviceId } from '@/lib/device';
import { getFavoriteIds, getFavorites, toggleFavorite } from '@/lib/favorites';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import { DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings, type AppSettings } from '@/lib/settings';
import { isRestrictedCategoryName, isValidParentalPin } from '@/lib/parentalControl';
import { getLiveWatchHistory, recordLiveWatch } from '@/lib/watchHistory';
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

type ExploreDetailsState = {
  section: Exclude<ExploreMediaSection, 'live'>;
  item: ChannelListViewChannel;
  focusKey: string;
};

type SeriesBrowserState = {
  series: ChannelListViewChannel;
  returnFocusKey: string;
};

const CONTENT_BATCH_SIZE = 60;
const CATEGORY_CONTENT_CACHE_LIMIT = 6;
const EXPLORE_HISTORY_LIMIT = 15;
const INITIAL_MEDIA_RAIL_CATEGORY_COUNT = 4;
const MEDIA_RAIL_ITEM_LIMIT = 20;
const MEDIA_RAIL_EMPTY_SKIP_LIMIT = 12;
type MediaSection = Exclude<MainMenuSection, 'settings'>;
type MediaRailsState = Record<MediaCategoryRailsSection, MediaCategoryRailData[]>;

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

const normalizeCategoryName = (name: string) => (
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const getExploreCategory = (section: MediaSection, categories: any[]) => {
  if (section !== 'movies' && section !== 'series') return categories[0];

  const launch2026Category = categories.find((category) => {
    const normalizedName = normalizeCategoryName(String(category.category_name || ''));
    return (
      normalizedName.includes('lancamento') &&
      normalizedName.includes('2026')
    );
  });

  if (launch2026Category) return launch2026Category;

  return categories.find((category) => {
    const normalizedName = normalizeCategoryName(String(category.category_name || ''));
    return normalizedName.includes('2026') || normalizedName.includes('lancamento');
  }) ?? categories[0];
};

const emptyFavoriteIds: Record<MediaSection, string[]> = {
  live: [],
  movies: [],
  series: [],
};

const emptySearchCatalog: Record<MediaSection, ChannelListViewChannel[]> = {
  live: [],
  movies: [],
  series: [],
};

const emptySearchLoading: Record<MediaSection, boolean> = {
  live: false,
  movies: false,
  series: false,
};

const emptyExploreItems: Record<MediaSection, ChannelListViewChannel[]> = {
  live: [],
  movies: [],
  series: [],
};

const emptyMediaRails: MediaRailsState = {
  movies: [],
  series: [],
};

const getMediaRailPriority = (categoryName: string) => {
  const normalizedName = normalizeCategoryName(categoryName);

  if (normalizedName.includes('lancamento') && normalizedName.includes('2026')) return 0;
  if (normalizedName.includes('lancamento')) return 1;
  if (normalizedName.includes('2026')) return 2;
  if (normalizedName.includes('4k')) return 3;
  if (normalizedName.includes('acao') || normalizedName.includes('aventura')) return 4;
  if (normalizedName.includes('comedia')) return 5;
  if (normalizedName.includes('terror') || normalizedName.includes('suspense') || normalizedName.includes('thriller')) return 6;
  if (normalizedName.includes('drama')) return 7;
  if (normalizedName.includes('infantil') || normalizedName.includes('kids')) return 8;

  return 20;
};

const LOGO_MISSING_MARKERS = [
  'no-logo',
  'no_logo',
  'nologo',
  'noimage',
  'no-image',
  'notfound',
  'not-found',
  'placeholder',
  'unavailable',
  'sem-logo',
  'sem_logo',
];

const CHANNEL_LOGO_BRANDS = [
  ['sportv', 'sport tv', 'sport-tv'],
  ['espn'],
  ['premiere', 'premier'],
  ['combate'],
  ['globo'],
  ['record'],
  ['sbt'],
  ['band'],
  ['cnn'],
  ['bandnews', 'band news'],
  ['globonews', 'globo news'],
  ['telecine'],
  ['hbo'],
  ['cinemax'],
  ['discovery'],
  ['history'],
  ['a&e', 'ae'],
  ['amc'],
  ['sony'],
  ['warner'],
  ['tnt'],
  ['disney'],
  ['cartoon'],
  ['nick'],
  ['multishow'],
  ['gnt'],
  ['bis'],
  ['megapix'],
  ['universal'],
  ['paramount'],
  ['animal planet'],
  ['national geographic', 'nat geo'],
] as const;

const normalizeLogoLookupText = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{1,2}[:h]\d{2}\b/g, ' ')
    .replace(/\b(4k|fhd|fullhd|full hd|hd|sd|uhd|h265|hevc|h\.265|backup|raw)\b/g, ' ')
    .replace(/[^a-z0-9&+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const hasUsableChannelLogo = (logo?: string) => {
  if (!logo?.trim()) return false;

  try {
    const normalizedLogo = decodeURIComponent(logo).toLowerCase();
    return !LOGO_MISSING_MARKERS.some((marker) => normalizedLogo.includes(marker));
  } catch {
    return true;
  }
};

const getLogoBrandKey = (value: string) => {
  const normalizedValue = normalizeLogoLookupText(value);

  if (!normalizedValue) return '';

  const normalizedCompactValue = normalizedValue.replace(/\s+/g, '');

  const matchedBrand = CHANNEL_LOGO_BRANDS.find((aliases) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeLogoLookupText(alias);
      const normalizedCompactAlias = normalizedAlias.replace(/\s+/g, '');

      return (
        normalizedValue.includes(normalizedAlias) ||
        normalizedCompactValue.includes(normalizedCompactAlias)
      );
    })
  );

  return matchedBrand?.[0] ?? '';
};

const createLogoLookup = (channels: ChannelListViewChannel[]) => {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  const byBrand = new Map<string, string>();

  channels.forEach((channel) => {
    if (!hasUsableChannelLogo(channel.logo)) return;

    byId.set(String(channel.id), channel.logo);

    const nameKey = normalizeLogoLookupText(channel.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, channel.logo);
    }

    const brandFromName = getLogoBrandKey(channel.name);
    if (brandFromName && !byBrand.has(brandFromName)) {
      byBrand.set(brandFromName, channel.logo);
    }

    const brandFromLogo = getLogoBrandKey(channel.logo);
    if (brandFromLogo && !byBrand.has(brandFromLogo)) {
      byBrand.set(brandFromLogo, channel.logo);
    }
  });

  return { byId, byName, byBrand };
};

const enrichChannelsWithCatalogLogos = (
  channels: ChannelListViewChannel[],
  catalogChannels: ChannelListViewChannel[]
) => {
  if (channels.length === 0 || catalogChannels.length === 0) return channels;

  const lookup = createLogoLookup(catalogChannels);

  return channels.map((channel) => {
    if (hasUsableChannelLogo(channel.logo)) return channel;

    const nameKey = normalizeLogoLookupText(channel.name);
    const brandKey = getLogoBrandKey(channel.name);
    const enrichedLogo =
      lookup.byId.get(String(channel.id)) ||
      (nameKey ? lookup.byName.get(nameKey) : '') ||
      (brandKey ? lookup.byBrand.get(brandKey) : '');

    return enrichedLogo ? { ...channel, logo: enrichedLogo } : channel;
  });
};

const getStreamExtensionFromUrl = (url?: string) => {
  if (!url) return '';

  const cleanPath = url.split('?')[0]?.split('#')[0] || '';
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);

  return match?.[1] || '';
};

const mapStreamToChannel = (
  stream: any,
  params: ActionParams,
  credentials: any,
  fallbackCategoryId?: string
): ChannelListViewChannel => {
  const streamId = stream.stream_id || stream.series_id;
  const name = stream.name || stream.title || 'Sem Nome';
  const logo = stream.stream_icon || stream.cover || '';
  const extension = stream.container_extension || 'm3u8';
  const synopsis = stream.plot || stream.description || stream.desc || stream.overview || '';
  const rating = stream.rating || stream.imdb_rating || stream.imdb || stream.tmdb_rating || stream.rating_5based || '';
  const releaseDate = stream.releasedate || stream.release_date || stream.releaseDate || stream.year || '';
  const backdrop = Array.isArray(stream.backdrop_path)
    ? stream.backdrop_path[0] || ''
    : stream.backdrop_path || stream.backdrop || stream.cover_big || '';
  const trailerUrl = stream.youtube_trailer ||
    stream.trailer ||
    stream.youtube ||
    stream.youtube_id ||
    stream.youtubeId ||
    stream.video_trailer ||
    '';

  return {
    id: String(streamId),
    name,
    logo,
    url: buildStreamUrl(credentials.url, credentials.user, credentials.pass, params.type, String(streamId), extension),
    extension,
    categoryId: String(stream.category_id || fallbackCategoryId || ''),
    synopsis,
    rating: rating ? String(rating) : '',
    genre: stream.genre || '',
    releaseDate: releaseDate ? String(releaseDate) : '',
    backdrop: backdrop ? String(backdrop) : '',
    cast: stream.cast || stream.actors || '',
    director: stream.director || '',
    trailerUrl: trailerUrl ? String(trailerUrl) : '',
  };
};

const mapFavoriteToChannel = (favorite: ReturnType<typeof getFavorites>[number]): ChannelListViewChannel => ({
  id: String(favorite.id),
  name: favorite.name,
  logo: favorite.logo || '',
  url: favorite.url,
  extension: favorite.extension,
  categoryId: favorite.categoryId,
  synopsis: favorite.synopsis,
  rating: favorite.rating,
  genre: favorite.genre,
  releaseDate: favorite.releaseDate,
  backdrop: favorite.backdrop,
  cast: favorite.cast,
  director: favorite.director,
  trailerUrl: favorite.trailerUrl,
});

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
  const [, setMainMenuFocusKey] = useState('explore-quick-live');
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [loadedCategories, setLoadedCategories] = useState<any[]>([]);
  const [allCategoryChannels, setAllCategoryChannels] = useState<ChannelListViewChannel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | null>(null);
  const [mediaRailsSection, setMediaRailsSection] = useState<MediaCategoryRailsSection | null>(null);
  const [mediaRailsByType, setMediaRailsByType] = useState<MediaRailsState>(emptyMediaRails);
  const [isMediaRailsLoadingByType, setIsMediaRailsLoadingByType] = useState<Record<MediaCategoryRailsSection, boolean>>({
    movies: false,
    series: false,
  });
  const [exploreDetails, setExploreDetails] = useState<ExploreDetailsState | null>(null);
  const [seriesBrowser, setSeriesBrowser] = useState<SeriesBrowserState | null>(null);
  const [activePlayerMediaKey, setActivePlayerMediaKey] = useState<MediaSection | null>(null);
  const [playerQueue, setPlayerQueue] = useState<ChannelListViewChannel[]>([]);
  const [lastSeriesEpisodeFocusKey, setLastSeriesEpisodeFocusKey] = useState('');
  const [favoriteIdsByType, setFavoriteIdsByType] = useState<Record<MediaSection, string[]>>(emptyFavoriteIds);
  const [favoriteFeedback, setFavoriteFeedback] = useState('');
  const [searchCatalogByType, setSearchCatalogByType] = useState<Record<MediaSection, ChannelListViewChannel[]>>(emptySearchCatalog);
  const [isSearchCatalogLoadingByType, setIsSearchCatalogLoadingByType] = useState<Record<MediaSection, boolean>>(emptySearchLoading);
  const [exploreItemsByType, setExploreItemsByType] = useState<Record<MediaSection, ChannelListViewChannel[]>>(emptyExploreItems);
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [pendingRestrictedCategory, setPendingRestrictedCategory] = useState<MediaCategory | null>(null);
  const [restrictedCategoryPin, setRestrictedCategoryPin] = useState('');
  const [restrictedCategoryError, setRestrictedCategoryError] = useState('');
  const hasSetInitialFocus = useRef(false);
  const categoryContentCache = useRef(new Map<string, ChannelListViewChannel[]>());
  const searchCatalogCache = useRef(new Map<string, ChannelListViewChannel[]>());
  const exploreContentCache = useRef(new Map<string, ChannelListViewChannel[]>());
  const mediaRailsCache = useRef(new Map<string, MediaCategoryRailData[]>());
  const mediaRailCategoriesByType = useRef<Record<MediaCategoryRailsSection, any[]>>({
    movies: [],
    series: [],
  });
  const mediaRailNextCategoryIndexByType = useRef<Record<MediaCategoryRailsSection, number>>({
    movies: 0,
    series: 0,
  });
  const mediaRailLoadedCategoryIdsByType = useRef<Record<MediaCategoryRailsSection, Set<string>>>({
    movies: new Set<string>(),
    series: new Set<string>(),
  });
  const isLoadingMoreMediaRailCategoriesByType = useRef<Record<MediaCategoryRailsSection, boolean>>({
    movies: false,
    series: false,
  });
  const liveLogoCatalog = useRef<ChannelListViewChannel[] | null>(null);
  const liveLogoCatalogPromise = useRef<Promise<ChannelListViewChannel[]> | null>(null);
  const isOpeningExploreItem = useRef(false);
  const lastRecordedLiveWatchId = useRef<string | null>(null);
  const copy = appCopy[appSettings.language];

  const resetMediaRailLazyState = useCallback(() => {
    mediaRailCategoriesByType.current = {
      movies: [],
      series: [],
    };
    mediaRailNextCategoryIndexByType.current = {
      movies: 0,
      series: 0,
    };
    mediaRailLoadedCategoryIdsByType.current = {
      movies: new Set<string>(),
      series: new Set<string>(),
    };
    isLoadingMoreMediaRailCategoriesByType.current = {
      movies: false,
      series: false,
    };
  }, []);

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
      setExploreItemsByType((previousItems) => ({
        ...previousItems,
        live: getLiveWatchHistory().slice(0, EXPLORE_HISTORY_LIMIT),
      }));
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

    if (isOpeningExploreItem.current) {
      isOpeningExploreItem.current = false;
      return;
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
    if (!isLoggedIn || !credentials || activeTab !== 'home') return;

    let isCancelled = false;
    const sections: MediaSection[] = ['live', 'movies', 'series'];

    const loadExploreSection = async (section: MediaSection) => {
      const params = getActionParams(section);

      if (section === 'live') {
        const liveHistory = getLiveWatchHistory().slice(0, EXPLORE_HISTORY_LIMIT);

        const cacheKey = `explore:${params.type}:all:${appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off'}`;
        const cachedChannels = exploreContentCache.current.get(cacheKey);

        if (cachedChannels) {
          liveLogoCatalog.current = cachedChannels;

          if (liveHistory.length === 0) return cachedChannels;

          const historyIds = new Set(liveHistory.map((channel) => channel.id));
          return [
            ...liveHistory,
            ...cachedChannels.filter((channel) => !historyIds.has(channel.id)),
          ].slice(0, EXPLORE_HISTORY_LIMIT);
        }

        const rawCategories = appSettings.parentalControlEnabled
          ? await getCategories(credentials.url, credentials.user, credentials.pass, params.cat)
          : [];
        const blockedCategoryIds = new Set(
          Array.isArray(rawCategories)
            ? rawCategories
              .filter((category: any) => isRestrictedCategoryName(category.category_name || ''))
              .map((category: any) => String(category.category_id))
            : []
        );
        const streams = await getStreams(
          credentials.url,
          credentials.user,
          credentials.pass,
          params.stream
        );
        const channels: ChannelListViewChannel[] = Array.isArray(streams)
          ? streams
            .filter((stream: any) => !blockedCategoryIds.has(String(stream.category_id)))
            .map((stream: any) => mapStreamToChannel(stream, params, credentials))
          : [];

        liveLogoCatalog.current = channels;
        exploreContentCache.current.set(cacheKey, channels);

        if (liveHistory.length === 0) {
          return channels;
        }

        const historyIds = new Set(liveHistory.map((channel) => channel.id));
        return [
          ...liveHistory,
          ...channels.filter((channel) => !historyIds.has(channel.id)),
        ].slice(0, EXPLORE_HISTORY_LIMIT);
      }

      const cacheKey = `explore:${params.type}:launch-2026:${appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off'}`;
      const cachedChannels = exploreContentCache.current.get(cacheKey);

      if (cachedChannels) return cachedChannels;

      const rawCategories = await getCategories(credentials.url, credentials.user, credentials.pass, params.cat);
      const visibleCategories = Array.isArray(rawCategories)
        ? rawCategories.filter((category: any) => (
          !appSettings.parentalControlEnabled ||
          !isRestrictedCategoryName(category.category_name || '')
        ))
        : [];
      const sampleCategory = getExploreCategory(section, visibleCategories);

      if (!sampleCategory?.category_id) return [];

      const sampleCategoryId = String(sampleCategory.category_id);
      const streams = await getStreams(
        credentials.url,
        credentials.user,
        credentials.pass,
        params.stream,
        sampleCategoryId
      );
      const channels: ChannelListViewChannel[] = Array.isArray(streams)
        ? streams
          .map((stream: any) => mapStreamToChannel(stream, params, credentials, sampleCategoryId))
        : [];

      exploreContentCache.current.set(cacheKey, channels);
      return channels;
    };

    const loadExploreContent = async () => {
      setIsExploreLoading(true);

      try {
        const [live, movies, series] = await Promise.all(
          sections.map((section) => loadExploreSection(section))
        );

        if (!isCancelled) {
          setExploreItemsByType({ live, movies, series });
        }
      } catch (error) {
        console.error('Erro ao carregar destaques da tela inicial:', error);

        if (!isCancelled) {
          setExploreItemsByType(emptyExploreItems);
        }
      } finally {
        if (!isCancelled) {
          setIsExploreLoading(false);
        }
      }
    };

    loadExploreContent();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, appSettings.parentalControlEnabled, credentials, isLoggedIn]);

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
      setFocus('explore-quick-live');
    }
  }, [isBlocked, isInitialLoading, isLoggedIn]);

  const handleLogout = useCallback(() => {
    setIsLogoutConfirmOpen(false);
    localStorage.removeItem('skyflow_device_id');
    hasSetInitialFocus.current = false;
    lastRecordedLiveWatchId.current = null;
    setSelectedChannel(null);
    setActivePlayerMediaKey(null);
    setPlayerQueue([]);
    setSeriesBrowser(null);
    setLastSeriesEpisodeFocusKey('');
    setExploreDetails(null);
    setMediaRailsSection(null);
    setMainMenuFocusKey('explore-quick-live');
    setActiveTab('home');
    setAllCategories([]);
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setExploreDetails(null);
    setSeriesBrowser(null);
    setActivePlayerMediaKey(null);
    setPlayerQueue([]);
    setLastSeriesEpisodeFocusKey('');
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    setPendingRestrictedCategory(null);
    setRestrictedCategoryPin('');
    setRestrictedCategoryError('');
    setIsLoadingCategories(false);
    setCanScrollDown(false);
    setSearchCatalogByType(emptySearchCatalog);
    setExploreItemsByType(emptyExploreItems);
    setMediaRailsByType(emptyMediaRails);
    setIsSearchCatalogLoadingByType(emptySearchLoading);
    categoryContentCache.current.clear();
    searchCatalogCache.current.clear();
    exploreContentCache.current.clear();
    mediaRailsCache.current.clear();
    resetMediaRailLazyState();
    liveLogoCatalog.current = null;
    liveLogoCatalogPromise.current = null;
    checkDeviceSecurity();
  }, [checkDeviceSecurity, resetMediaRailLazyState]);

  const handleOpenLogoutConfirm = useCallback(() => {
    setIsLogoutConfirmOpen(true);
  }, []);

  const handleCloseLogoutConfirm = useCallback(() => {
    setIsLogoutConfirmOpen(false);
    window.setTimeout(() => {
      setFocus(activeTab === 'home' ? 'explore-logout' : 'settings-logout');
    }, 0);
  }, [activeTab]);

  const handleBackToMainMenu = useCallback(() => {
    setMainMenuFocusKey('explore-quick-live');
    setMediaRailsSection(null);
    setActiveTab('home');
    setAllCategories([]);
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    setPendingRestrictedCategory(null);
    setRestrictedCategoryPin('');
    setRestrictedCategoryError('');
    window.setTimeout(() => setFocus('explore-quick-live'), 0);
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setMainMenuFocusKey('explore-quick-settings');
    setMediaRailsSection(null);
    setActiveTab('home');
  }, []);

  const handleBackFromMediaRails = useCallback(() => {
    const focusKey = mediaRailsSection ? `explore-quick-${mediaRailsSection}` : 'explore-quick-live';
    setMediaRailsSection(null);
    setActiveTab('home');
    window.setTimeout(() => setFocus(focusKey), 0);
  }, [mediaRailsSection]);

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setAppSettings(nextSettings);
    saveAppSettings(nextSettings);
    searchCatalogCache.current.clear();
    mediaRailsCache.current.clear();
    resetMediaRailLazyState();
    liveLogoCatalog.current = null;
    liveLogoCatalogPromise.current = null;
    setSearchCatalogByType(emptySearchCatalog);
    setMediaRailsByType(emptyMediaRails);
  }, [resetMediaRailLazyState]);

  const handleClearCatalogCache = useCallback(() => {
    categoryContentCache.current.clear();
    searchCatalogCache.current.clear();
    exploreContentCache.current.clear();
    mediaRailsCache.current.clear();
    resetMediaRailLazyState();
    liveLogoCatalog.current = null;
    liveLogoCatalogPromise.current = null;
    setSearchCatalogByType(emptySearchCatalog);
    setExploreItemsByType(emptyExploreItems);
    setMediaRailsByType(emptyMediaRails);
  }, [resetMediaRailLazyState]);

  const handleBackToCategories = useCallback(() => {
    setLoadedCategories([]);
    setAllCategoryChannels([]);
    setSelectedCategory(null);
    setPreviewChannel(null);
    setPreparedPreviewChannelId(null);
    setSeriesBrowser(null);
    setPlayerQueue([]);
    setLastSeriesEpisodeFocusKey('');
    window.setTimeout(() => setFocus('category-grid-back'), 0);
  }, []);

  const currentMediaKey = mediaRailsSection ?? getCurrentMediaKey(activeTab);

  const categoryGridItems: MediaCategory[] = useMemo(() => {
    const mappedCategories = allCategories.map((category) => ({
      id: String(category.category_id),
      name: category.category_name || 'Sem nome',
      isRestricted:
        appSettings.parentalControlEnabled &&
        isRestrictedCategoryName(category.category_name || ''),
    }));

    return [
      { id: `${currentMediaKey}-favorites`, name: copy.media.favorites, isFavorites: true },
      { id: `${currentMediaKey}-all`, name: copy.media.all, isAll: true },
      ...mappedCategories,
    ];
  }, [allCategories, appSettings.parentalControlEnabled, copy.media.all, copy.media.favorites, currentMediaKey]);

  const restrictedCategoryIds = useMemo(() => new Set(
    allCategories
      .filter((category) => isRestrictedCategoryName(category.category_name || ''))
      .map((category) => String(category.category_id))
  ), [allCategories]);

  const loadLiveLogoCatalog = useCallback(async () => {
    if (!credentials) return [];
    if (liveLogoCatalog.current) return liveLogoCatalog.current;
    if (liveLogoCatalogPromise.current) return liveLogoCatalogPromise.current;

    const params = getActionParams('live');
    const cacheSuffix = appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off';
    const cachedCatalog =
      exploreContentCache.current.get(`explore:${params.type}:all:${cacheSuffix}`) ||
      searchCatalogCache.current.get(`search:${params.type}:${cacheSuffix}`);

    if (cachedCatalog) {
      liveLogoCatalog.current = cachedCatalog;
      return cachedCatalog;
    }

    liveLogoCatalogPromise.current = getStreams(
      credentials.url,
      credentials.user,
      credentials.pass,
      params.stream
    )
      .then((streams) => {
        const visibleStreams =
          Array.isArray(streams) && appSettings.parentalControlEnabled
            ? streams.filter((stream: any) => !restrictedCategoryIds.has(String(stream.category_id)))
            : streams;
        const channels: ChannelListViewChannel[] = Array.isArray(visibleStreams)
          ? visibleStreams.map((stream: any) => mapStreamToChannel(stream, params, credentials))
          : [];

        liveLogoCatalog.current = channels;
        return channels;
      })
      .catch((error) => {
        console.error('Erro ao carregar catalogo de logos dos canais:', error);
        return [];
      })
      .finally(() => {
        liveLogoCatalogPromise.current = null;
      });

    return liveLogoCatalogPromise.current;
  }, [appSettings.parentalControlEnabled, credentials, restrictedCategoryIds]);

  const loadMoreMediaRailCategories = useCallback(async (
    section: MediaCategoryRailsSection,
    targetCount = 1
  ) => {
    if (!credentials || isLoadingMoreMediaRailCategoriesByType.current[section]) return;

    const categories = mediaRailCategoriesByType.current[section];
    if (categories.length === 0) return;

    const params = getActionParams(section);
    const cacheKey = `media-rails:${params.type}:${appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off'}`;
    const newRails: MediaCategoryRailData[] = [];
    let loadedCount = 0;
    let skippedCount = 0;

    isLoadingMoreMediaRailCategoriesByType.current[section] = true;

    try {
      while (
        loadedCount < targetCount &&
        mediaRailNextCategoryIndexByType.current[section] < categories.length &&
        skippedCount < MEDIA_RAIL_EMPTY_SKIP_LIMIT
      ) {
        const category = categories[mediaRailNextCategoryIndexByType.current[section]];
        mediaRailNextCategoryIndexByType.current[section] += 1;

        const categoryId = String(category?.category_id || '');
        if (!categoryId || mediaRailLoadedCategoryIdsByType.current[section].has(categoryId)) {
          skippedCount += 1;
          continue;
        }

        mediaRailLoadedCategoryIdsByType.current[section].add(categoryId);

        try {
          const streams = await getStreams(
            credentials.url,
            credentials.user,
            credentials.pass,
            params.stream,
            categoryId
          );
          const items: ChannelListViewChannel[] = Array.isArray(streams)
            ? streams
              .slice(0, MEDIA_RAIL_ITEM_LIMIT)
              .map((stream: any) => mapStreamToChannel(stream, params, credentials, categoryId))
            : [];

          if (items.length === 0) {
            skippedCount += 1;
            continue;
          }

          newRails.push({
            id: `${section}-${categoryId}`,
            title: String(category.category_name || 'Sem nome'),
            items,
            kind: 'category',
          });
          loadedCount += 1;
        } catch (error) {
          skippedCount += 1;
          console.error('Erro ao carregar trilho de midia:', error);
        }
      }

      if (newRails.length > 0) {
        setMediaRailsByType((previousRails) => {
          const currentRails = previousRails[section];
          const currentRailIds = new Set(currentRails.map((rail) => rail.id));
          const nextRails = [
            ...currentRails,
            ...newRails.filter((rail) => !currentRailIds.has(rail.id)),
          ];

          mediaRailsCache.current.set(cacheKey, nextRails);

          return {
            ...previousRails,
            [section]: nextRails,
          };
        });
      }
    } finally {
      isLoadingMoreMediaRailCategoriesByType.current[section] = false;
    }
  }, [appSettings.parentalControlEnabled, credentials]);

  const loadMediaRails = useCallback(async (section: MediaCategoryRailsSection) => {
    if (!credentials || isMediaRailsLoadingByType[section]) return;

    const params = getActionParams(section);
    const cacheKey = `media-rails:${params.type}:${appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off'}`;

    if (mediaRailCategoriesByType.current[section].length > 0 || mediaRailsCache.current.has(cacheKey)) {
      const cachedRails = mediaRailsCache.current.get(cacheKey);

      if (cachedRails) {
        setMediaRailsByType((previousRails) => ({
          ...previousRails,
          [section]: cachedRails,
        }));
      }

      return;
    }

    setIsMediaRailsLoadingByType((previousLoading) => ({
      ...previousLoading,
      [section]: true,
    }));

    try {
      const rawCategories = await getCategories(credentials.url, credentials.user, credentials.pass, params.cat);
      const visibleCategories = Array.isArray(rawCategories)
        ? rawCategories
          .filter((category: any) => (
            !appSettings.parentalControlEnabled ||
            !isRestrictedCategoryName(category.category_name || '')
          ))
          .sort((leftCategory: any, rightCategory: any) => (
            getMediaRailPriority(String(leftCategory.category_name || '')) -
              getMediaRailPriority(String(rightCategory.category_name || ''))
          ))
        : [];
      const favoriteItems = getFavorites(section)
        .filter((favorite) => (
          !appSettings.parentalControlEnabled ||
          !isRestrictedCategoryName(favorite.name)
        ))
        .map(mapFavoriteToChannel);
      const favoriteRail: MediaCategoryRailData[] = favoriteItems.length > 0
        ? [{
          id: `${section}-favorites`,
          title: copy.media.favorites,
          items: favoriteItems,
          kind: 'favorites',
        }]
        : [];

      mediaRailCategoriesByType.current[section] = visibleCategories;
      mediaRailNextCategoryIndexByType.current[section] = 0;
      mediaRailLoadedCategoryIdsByType.current[section] = new Set<string>();
      mediaRailsCache.current.set(cacheKey, favoriteRail);
      setMediaRailsByType((previousRails) => ({
        ...previousRails,
        [section]: favoriteRail,
      }));

      await loadMoreMediaRailCategories(section, INITIAL_MEDIA_RAIL_CATEGORY_COUNT);
    } catch (error) {
      console.error('Erro ao carregar trilhos de midia:', error);
      setMediaRailsByType((previousRails) => ({
        ...previousRails,
        [section]: [],
      }));
    } finally {
      setIsMediaRailsLoadingByType((previousLoading) => ({
        ...previousLoading,
        [section]: false,
      }));
    }
  }, [
    appSettings.parentalControlEnabled,
    copy.media.favorites,
    credentials,
    isMediaRailsLoadingByType,
    loadMoreMediaRailCategories,
  ]);

  const handleMainMenuSelect = useCallback((section: MainMenuSection) => {
    isOpeningExploreItem.current = false;
    setMainMenuFocusKey(section === 'settings' ? 'explore-quick-settings' : `explore-quick-${section}`);

    if (section === 'movies' || section === 'series') {
      setMediaRailsSection(section);
      setActiveTab('home');
      setSelectedCategory(null);
      setLoadedCategories([]);
      setAllCategoryChannels([]);
      setPreviewChannel(null);
      setPreparedPreviewChannelId(null);
      loadMediaRails(section);
      return;
    }

    setMediaRailsSection(null);
    setActiveTab(section);
  }, [loadMediaRails]);

  const loadCategoryStreams = useCallback(async (category: MediaCategory) => {
    if (!credentials) return;

    const params = getActionParams(activeTab);
    const categoryCacheKey = `${params.type}:${category.id}:${appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off'}`;
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
        const storedFavorites = getFavorites(currentMediaKey)
          .filter((favorite) => (
            !appSettings.parentalControlEnabled ||
            (
              !restrictedCategoryIds.has(String(favorite.categoryId)) &&
              !isRestrictedCategoryName(favorite.name)
            )
          ));
        const favoriteStreamById = new Map<string, any>();

        if (currentMediaKey === 'live') {
          const favoriteCategoryIds = Array.from(new Set(
            storedFavorites
              .map((favorite) => favorite.categoryId)
              .filter((categoryId): categoryId is string => Boolean(categoryId))
          ));

          await Promise.all(
            favoriteCategoryIds.map(async (favoriteCategoryId) => {
              const streams = await getStreams(
                credentials.url,
                credentials.user,
                credentials.pass,
                params.stream,
                favoriteCategoryId
              );

              if (!Array.isArray(streams)) return;

              streams.forEach((stream: any) => {
                const streamId = stream.stream_id || stream.series_id;

                if (streamId) {
                  favoriteStreamById.set(String(streamId), stream);
                }
              });
            })
          );
        }

        let channels: ChannelListViewChannel[] = storedFavorites.map((favorite) => {
          const matchedStream = favoriteStreamById.get(String(favorite.id));
          const streamId = String(matchedStream?.stream_id || matchedStream?.series_id || favorite.id);
          const extension = matchedStream?.container_extension ||
            favorite.extension ||
            getStreamExtensionFromUrl(favorite.url) ||
            (currentMediaKey === 'live' ? 'm3u8' : 'mp4');
          const name = matchedStream?.name || matchedStream?.title || favorite.name;
          const logo = matchedStream?.stream_icon || matchedStream?.cover || favorite.logo || '';
          const synopsis = matchedStream?.plot ||
            matchedStream?.description ||
            matchedStream?.desc ||
            matchedStream?.overview ||
            favorite.synopsis;
          const rating = matchedStream?.rating ||
            matchedStream?.imdb_rating ||
            matchedStream?.imdb ||
            matchedStream?.tmdb_rating ||
            matchedStream?.rating_5based ||
            favorite.rating;
          const releaseDate = matchedStream?.releasedate ||
            matchedStream?.release_date ||
            matchedStream?.releaseDate ||
            matchedStream?.year ||
            favorite.releaseDate;
          const backdrop = Array.isArray(matchedStream?.backdrop_path)
            ? matchedStream.backdrop_path[0] || ''
            : matchedStream?.backdrop_path || matchedStream?.backdrop || matchedStream?.cover_big || favorite.backdrop;
          const trailerUrl = matchedStream?.youtube_trailer ||
            matchedStream?.trailer ||
            matchedStream?.youtube ||
            matchedStream?.youtube_id ||
            matchedStream?.youtubeId ||
            matchedStream?.video_trailer ||
            favorite.trailerUrl;

          return {
            id: favorite.id,
            name,
            logo,
            url: currentMediaKey === 'live'
              ? buildStreamUrl(
                credentials.url,
                credentials.user,
                credentials.pass,
                'live',
                streamId,
                extension
              )
              : favorite.url || buildStreamUrl(
                credentials.url,
                credentials.user,
                credentials.pass,
                params.type,
                favorite.id,
                'mp4'
              ),
            extension,
            categoryId: String(matchedStream?.category_id || favorite.categoryId || ''),
            synopsis,
            rating: rating ? String(rating) : '',
            genre: matchedStream?.genre || favorite.genre,
            releaseDate: releaseDate ? String(releaseDate) : '',
            backdrop: backdrop ? String(backdrop) : '',
            cast: matchedStream?.cast || matchedStream?.actors || favorite.cast,
            director: matchedStream?.director || favorite.director,
            trailerUrl: trailerUrl ? String(trailerUrl) : '',
          };
        });

        if (currentMediaKey === 'live' && channels.some((channel) => !hasUsableChannelLogo(channel.logo))) {
          channels = enrichChannelsWithCatalogLogos(channels, await loadLiveLogoCatalog());
        }

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
      const visibleStreams =
        Array.isArray(streams) && category.isAll && appSettings.parentalControlEnabled
          ? streams.filter((stream: any) => !restrictedCategoryIds.has(String(stream.category_id)))
          : streams;
      let channels: ChannelListViewChannel[] = Array.isArray(visibleStreams)
        ? visibleStreams.map((stream: any) => mapStreamToChannel(stream, params, credentials, category.id))
        : [];

      if (currentMediaKey === 'live' && channels.some((channel) => !hasUsableChannelLogo(channel.logo))) {
        channels = enrichChannelsWithCatalogLogos(channels, await loadLiveLogoCatalog());
      }

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
  }, [activeTab, appSettings.parentalControlEnabled, credentials, currentMediaKey, loadLiveLogoCatalog, restrictedCategoryIds]);

  const loadSearchCatalogForSection = useCallback(async (section: MediaSection) => {
    if (!credentials || isSearchCatalogLoadingByType[section]) return;

    const params = getActionParams(section);
    const cacheKey = `search:${params.type}:${appSettings.parentalControlEnabled ? 'parental-on' : 'parental-off'}`;
    const cachedChannels = searchCatalogCache.current.get(cacheKey);

    if (cachedChannels) {
      setSearchCatalogByType((previousCatalog) => ({
        ...previousCatalog,
        [section]: cachedChannels,
      }));
      return;
    }

    setIsSearchCatalogLoadingByType((previousLoading) => ({
      ...previousLoading,
      [section]: true,
    }));

    try {
      const streams = await getStreams(credentials.url, credentials.user, credentials.pass, params.stream);
      const visibleStreams =
        Array.isArray(streams) && appSettings.parentalControlEnabled
          ? streams.filter((stream: any) => !restrictedCategoryIds.has(String(stream.category_id)))
          : streams;
      const channels: ChannelListViewChannel[] = Array.isArray(visibleStreams)
        ? visibleStreams.map((stream: any) => mapStreamToChannel(stream, params, credentials))
        : [];

      searchCatalogCache.current.set(cacheKey, channels);
      setSearchCatalogByType((previousCatalog) => ({
        ...previousCatalog,
        [section]: channels,
      }));
    } catch (error) {
      console.error('Erro ao carregar catalogo da busca:', error);
      setSearchCatalogByType((previousCatalog) => ({
        ...previousCatalog,
        [section]: [],
      }));
    } finally {
      setIsSearchCatalogLoadingByType((previousLoading) => ({
        ...previousLoading,
        [section]: false,
      }));
    }
  }, [
    appSettings.parentalControlEnabled,
    credentials,
    isSearchCatalogLoadingByType,
    restrictedCategoryIds,
  ]);

  const loadSearchCatalog = useCallback(
    () => loadSearchCatalogForSection(currentMediaKey),
    [currentMediaKey, loadSearchCatalogForSection]
  );

  const closeRestrictedCategoryModal = useCallback(() => {
    const category = pendingRestrictedCategory;

    setPendingRestrictedCategory(null);
    setRestrictedCategoryPin('');
    setRestrictedCategoryError('');

    window.setTimeout(() => {
      setFocus(category ? getCategoryFocusKey(category.id) : 'category-grid-back');
    }, 0);
  }, [pendingRestrictedCategory]);

  const handleCategorySelect = useCallback((category: MediaCategory) => {
    if (
      appSettings.parentalControlEnabled &&
      isRestrictedCategoryName(category.name)
    ) {
      setPendingRestrictedCategory(category);
      setRestrictedCategoryPin('');
      setRestrictedCategoryError('');
      return;
    }

    loadCategoryStreams(category);
  }, [appSettings.parentalControlEnabled, loadCategoryStreams]);

  const confirmRestrictedCategoryAccess = useCallback(() => {
    if (!pendingRestrictedCategory) return;

    if (!isValidParentalPin(restrictedCategoryPin)) {
      setRestrictedCategoryError(copy.common.parentalPinIncomplete);
      return;
    }

    if (restrictedCategoryPin !== appSettings.parentalControlPin) {
      setRestrictedCategoryPin('');
      setRestrictedCategoryError(copy.common.parentalPinInvalid);
      return;
    }

    const category = pendingRestrictedCategory;

    setPendingRestrictedCategory(null);
    setRestrictedCategoryPin('');
    setRestrictedCategoryError('');
    loadCategoryStreams(category);
  }, [appSettings.parentalControlPin, copy.common.parentalPinIncomplete, copy.common.parentalPinInvalid, loadCategoryStreams, pendingRestrictedCategory, restrictedCategoryPin]);

  const currentChannels: ChannelListViewChannel[] = useMemo(
    () => loadedCategories[0]?.channels ?? [],
    [loadedCategories]
  );
  const searchCatalogChannels = searchCatalogByType[currentMediaKey] ?? [];
  const searchSourceChannels = searchCatalogChannels.length > 0
    ? searchCatalogChannels
    : allCategoryChannels.length > 0
      ? allCategoryChannels
      : currentChannels;
  const searchPlaceholderByType: Record<MediaSection, string> = {
    live: copy.content.searchAllLive,
    movies: copy.content.searchAllMovies,
    series: copy.content.searchAllSeries,
  };
  const searchScopeLabelByType: Record<MediaSection, string> = {
    live: copy.content.searchingAllLive,
    movies: copy.content.searchingAllMovies,
    series: copy.content.searchingAllSeries,
  };
  const mediaRails = mediaRailsSection ? mediaRailsByType[mediaRailsSection] : [];
  const mediaRailsSearchItems = mediaRailsSection
    ? (searchCatalogByType[mediaRailsSection].length > 0
      ? searchCatalogByType[mediaRailsSection]
      : mediaRails.flatMap((rail) => rail.items))
    : [];
  const handleMediaRailsSearchOpen = useCallback(() => {
    if (!mediaRailsSection) return;
    loadSearchCatalogForSection(mediaRailsSection);
  }, [loadSearchCatalogForSection, mediaRailsSection]);
  const handleMediaRailsNearEnd = useCallback(() => {
    if (!mediaRailsSection) return;
    loadMoreMediaRailCategories(mediaRailsSection);
  }, [loadMoreMediaRailCategories, mediaRailsSection]);
  const currentFavoriteIds = favoriteIdsByType[currentMediaKey] ?? [];
  const playerMediaKey = activePlayerMediaKey ?? currentMediaKey;
  const exploreDetailsIsFavorite = exploreDetails
    ? (favoriteIdsByType[exploreDetails.section] ?? []).includes(exploreDetails.item.id)
    : false;

  const playableChannels = useMemo(
    () => playerQueue.length > 0
      ? playerQueue
      : allCategoryChannels.length > 0
        ? allCategoryChannels
        : loadedCategories.flatMap((category) => category.channels),
    [allCategoryChannels, loadedCategories, playerQueue]
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
    setActivePlayerMediaKey(null);
    setPlayerQueue([]);
    lastRecordedLiveWatchId.current = null;
    window.setTimeout(() => {
      if (seriesBrowser) {
        setFocus(lastSeriesEpisodeFocusKey || 'series-browser-back');
        return;
      }

      if (exploreDetails) {
        setFocus('media-fullscreen-primary');
        return;
      }

      setFocus(previewChannel ? getChannelFocusKey(previewChannel.id) : 'content-back');
    }, 0);
  }, [exploreDetails, lastSeriesEpisodeFocusKey, previewChannel, seriesBrowser]);

  const handlePreviousChannel = useCallback(() => {
    if (selectedChannelIndex > 0) {
      const channel = playableChannels[selectedChannelIndex - 1];
      setSelectedChannel(channel);
      setActivePlayerMediaKey((previousKey) => previousKey ?? currentMediaKey);
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
    }
  }, [currentMediaKey, playableChannels, selectedChannelIndex]);

  const handleNextChannel = useCallback(() => {
    if (selectedChannelIndex >= 0 && selectedChannelIndex < playableChannels.length - 1) {
      const channel = playableChannels[selectedChannelIndex + 1];
      setSelectedChannel(channel);
      setActivePlayerMediaKey((previousKey) => previousKey ?? currentMediaKey);
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
    }
  }, [currentMediaKey, playableChannels, selectedChannelIndex]);

  const handleChannelFocus = useCallback((channel: ChannelListViewChannel) => {
    if (previewChannel?.id === channel.id) return;

    setPreviewChannel(channel);
    setPreparedPreviewChannelId(null);
  }, [previewChannel]);

  const handleChannelPress = useCallback((channel: ChannelListViewChannel) => {
    if (currentMediaKey === 'live') {
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
      setActivePlayerMediaKey(currentMediaKey);
      setSelectedChannel(channel);
      return;
    }

    if (currentMediaKey === 'series') {
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
      setSeriesBrowser({
        series: channel,
        returnFocusKey: getChannelFocusKey(channel.id),
      });
      window.setTimeout(() => setFocus('series-browser-back'), 0);
      return;
    }

    if (previewChannel?.id !== channel.id || preparedPreviewChannelId !== channel.id) {
      setPreviewChannel(channel);
      setPreparedPreviewChannelId(channel.id);
      return;
    }

    setActivePlayerMediaKey(currentMediaKey);
    setSelectedChannel(channel);
  }, [currentMediaKey, preparedPreviewChannelId, previewChannel]);

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

    if (currentMediaKey === 'series') {
      setPreparedPreviewChannelId(previewChannel.id);
      setSeriesBrowser({
        series: previewChannel,
        returnFocusKey: getChannelFocusKey(previewChannel.id),
      });
      window.setTimeout(() => setFocus('series-browser-back'), 0);
      return;
    }

    setPreparedPreviewChannelId(previewChannel.id);
    setActivePlayerMediaKey(currentMediaKey);
    setSelectedChannel(previewChannel);
  }, [currentMediaKey, previewChannel]);

  useEffect(() => {
    if (!selectedChannel || playerMediaKey !== 'live') return;
    if (lastRecordedLiveWatchId.current === selectedChannel.id) return;

    lastRecordedLiveWatchId.current = selectedChannel.id;
    const nextHistory = recordLiveWatch(selectedChannel).slice(0, EXPLORE_HISTORY_LIMIT);
    setExploreItemsByType((previousItems) => ({
      ...previousItems,
      live: nextHistory,
    }));
  }, [playerMediaKey, selectedChannel]);

  const openExploreItemInList = useCallback((section: ExploreMediaSection, channel: ChannelListViewChannel) => {
    const sectionTitleByType: Record<MediaSection, string> = {
      live: copy.media.liveTitle,
      movies: copy.media.moviesTitle,
      series: copy.media.seriesTitle,
    };
    const category: MediaCategory = {
      id: `${section}-explore`,
      name: sectionTitleByType[section],
      isAll: true,
    };

    isOpeningExploreItem.current = true;
    setActiveTab(section);
    setSelectedCategory(category);
    setLoadedCategories([{ id: category.id, name: category.name, channels: [channel] }]);
    setAllCategoryChannels([channel]);
    setPreviewChannel(channel);
    setPreparedPreviewChannelId(section === 'live' ? channel.id : null);
    setFavoriteFeedback('');

    if (section === 'live') {
      setActivePlayerMediaKey('live');
      setSelectedChannel(channel);
      return;
    }

    window.setTimeout(() => setFocus(getChannelFocusKey(channel.id)), 0);
  }, [copy.media.liveTitle, copy.media.moviesTitle, copy.media.seriesTitle]);

  const handleExploreItemPress = useCallback((
    section: ExploreMediaSection,
    channel: ChannelListViewChannel,
    focusKey: string
  ) => {
    if (section === 'live') {
      openExploreItemInList(section, channel);
      return;
    }

    setExploreDetails({ section, item: channel, focusKey });
    setFavoriteFeedback('');
    window.setTimeout(() => setFocus('media-fullscreen-primary'), 0);
  }, [openExploreItemInList]);

  const handleExploreSearch = useCallback(() => {
    setActiveTab('live');
    window.setTimeout(() => setFocus('category-grid-search'), 0);
  }, []);

  const handleCloseExploreDetails = useCallback(() => {
    const previousFocusKey = exploreDetails?.focusKey;

    setSeriesBrowser(null);
    setExploreDetails(null);
    window.setTimeout(() => {
      if (previousFocusKey) {
        setFocus(previousFocusKey);
      }
    }, 40);
  }, [exploreDetails]);

  const handlePlayExploreDetails = useCallback(() => {
    if (!exploreDetails) return;

    const sectionItems = exploreItemsByType[exploreDetails.section];
    setAllCategoryChannels(sectionItems.length > 0 ? sectionItems : [exploreDetails.item]);
    setPreviewChannel(exploreDetails.item);
    setPreparedPreviewChannelId(exploreDetails.item.id);
    setActivePlayerMediaKey(exploreDetails.section);
    setSelectedChannel(exploreDetails.item);
  }, [exploreDetails, exploreItemsByType]);

  const handleOpenExploreSeries = useCallback(() => {
    if (!exploreDetails) return;

    setSeriesBrowser({
      series: exploreDetails.item,
      returnFocusKey: 'media-fullscreen-primary',
    });
    window.setTimeout(() => setFocus('series-browser-back'), 0);
  }, [exploreDetails]);

  const handleCloseSeriesBrowser = useCallback(() => {
    const nextFocusKey = seriesBrowser?.returnFocusKey || 'content-back';

    setSeriesBrowser(null);
    setLastSeriesEpisodeFocusKey('');
    window.setTimeout(() => setFocus(nextFocusKey), 0);
  }, [seriesBrowser]);

  const handlePlaySeriesEpisode = useCallback((
    episode: ChannelListViewChannel,
    episodeChannels: ChannelListViewChannel[],
    focusKey: string
  ) => {
    setPreviewChannel(episode);
    setPreparedPreviewChannelId(episode.id);
    setPlayerQueue(episodeChannels);
    setLastSeriesEpisodeFocusKey(focusKey);
    setActivePlayerMediaKey('series');
    setSelectedChannel(episode);
  }, []);

  const handleExploreDetailsFavoriteToggle = useCallback(() => {
    if (!exploreDetails) return;

    const result = toggleFavorite(exploreDetails.section, exploreDetails.item);
    const nextFavoriteIds = result.favorites.map((favorite) => favorite.id);

    setFavoriteIdsByType((previousIds) => ({
      ...previousIds,
      [exploreDetails.section]: nextFavoriteIds,
    }));
    setFavoriteFeedback(result.isFavorite ? copy.content.favoriteAdded : copy.content.favoriteRemoved);
  }, [copy.content.favoriteAdded, copy.content.favoriteRemoved, exploreDetails]);

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
      {mediaRailsSection ? (
        <MediaCategoryRails
          section={mediaRailsSection}
          language={appSettings.language}
          rails={mediaRails}
          searchItems={mediaRailsSearchItems}
          isLoading={isMediaRailsLoadingByType[mediaRailsSection]}
          isSearchCatalogLoading={isSearchCatalogLoadingByType[mediaRailsSection]}
          onBack={handleBackFromMediaRails}
          onOpenSearch={handleMediaRailsSearchOpen}
          onOpenItem={handleExploreItemPress}
          onNearEnd={handleMediaRailsNearEnd}
        />
      ) : activeTab === 'home' ? (
        <ExploreHome
          language={appSettings.language}
          liveItems={exploreItemsByType.live}
          movieItems={exploreItemsByType.movies}
          seriesItems={exploreItemsByType.series}
          isLoading={isExploreLoading}
          onOpenSection={handleMainMenuSelect}
          onOpenSearch={handleExploreSearch}
          onOpenItem={handleExploreItemPress}
          onLogout={handleOpenLogoutConfirm}
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
          onSelect={handleCategorySelect}
          language={appSettings.language}
        />
      ) : (
        <ChannelListView
          mediaTitle={currentMediaTexts[currentMediaKey].title}
          categoryName={selectedCategory.name}
          channels={currentChannels}
          totalChannels={allCategoryChannels.length || currentChannels.length}
          searchChannels={searchSourceChannels}
          searchPlaceholder={searchPlaceholderByType[currentMediaKey]}
          searchScopeLabel={searchScopeLabelByType[currentMediaKey]}
          isSearchCatalogLoading={isSearchCatalogLoadingByType[currentMediaKey]}
          selectedChannel={previewChannel}
          preparedChannelId={preparedPreviewChannelId}
          isLoading={isLoadingMore}
          favoriteIds={currentFavoriteIds}
          favoriteFeedback={favoriteFeedback}
          epgCredentials={currentMediaKey === 'live' ? credentials : null}
          detailsCredentials={currentMediaKey !== 'live' ? credentials : null}
          previewPlayerMode={appSettings.playerModeByType.live}
          mediaType={currentMediaKey}
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
          onSearchOpen={loadSearchCatalog}
          onPreviewPress={handlePreviewPress}
          language={appSettings.language}
        />
      )}

      {exploreDetails && (
        <MediaFullscreenDetails
          item={exploreDetails.item}
          type={exploreDetails.section}
          credentials={credentials}
          favorite={exploreDetailsIsFavorite}
          language={appSettings.language}
          onClose={handleCloseExploreDetails}
          onPlay={handlePlayExploreDetails}
          onOpenSeries={handleOpenExploreSeries}
          onFavoriteToggle={handleExploreDetailsFavoriteToggle}
        />
      )}

      {seriesBrowser && (
        <SeriesEpisodeBrowser
          series={seriesBrowser.series}
          credentials={credentials}
          language={appSettings.language}
          onBack={handleCloseSeriesBrowser}
          onPlayEpisode={handlePlaySeriesEpisode}
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
          playerMode={appSettings.playerModeByType[playerMediaKey]}
          contentType={playerMediaKey}
          language={appSettings.language}
        />
      )}

      {isLogoutConfirmOpen && (
        <LogoutConfirmModal
          language={appSettings.language}
          onCancel={handleCloseLogoutConfirm}
          onConfirm={handleLogout}
        />
      )}

      {pendingRestrictedCategory && (
        <ParentalPinModal
          title={copy.common.parentalPinTitle}
          description={copy.common.parentalPinDescription}
          pin={restrictedCategoryPin}
          error={restrictedCategoryError}
          cancelLabel={copy.common.cancel}
          confirmLabel={copy.common.parentalPinConfirm}
          clearLabel={copy.common.parentalPinClear}
          backspaceLabel={copy.common.parentalPinBackspace}
          onPinChange={(pin) => {
            setRestrictedCategoryPin(pin);
            setRestrictedCategoryError('');
          }}
          onCancel={closeRestrictedCategoryModal}
          onConfirm={confirmRestrictedCategoryAccess}
        />
      )}

      <style jsx global>{`
        body { overflow: ${selectedChannel || exploreDetails || seriesBrowser ? 'hidden' : 'auto'}; background-color: #000; color: #fff; }
      `}</style>
    </main>
  );
}
