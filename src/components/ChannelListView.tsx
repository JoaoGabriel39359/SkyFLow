'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { ArrowLeft, Play, Search, Star, X } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import { createIndexedSearchMatcher, createSearchIndex, hasSearchQuery } from '@/lib/search';
import { useChannelEpg } from '@/hooks/useChannelEpg';
import type { EpgProgram, XtreamCredentials } from '@/lib/epg';
import { useMediaDetails } from '@/hooks/useMediaDetails';
import type { MediaDetails, MediaDetailsType } from '@/lib/mediaDetails';
import type { PlayerMode } from '@/lib/playerSettings';
import styles from './ChannelListView.module.css';

export type ChannelListViewChannel = {
  id: string;
  name: string;
  logo: string;
  url?: string;
  extension?: string;
  categoryId?: string;
  synopsis?: string;
  rating?: string;
  genre?: string;
  releaseDate?: string;
  backdrop?: string;
  cast?: string;
  director?: string;
  trailerUrl?: string;
};

type ChannelListViewProps = {
  mediaTitle: string;
  categoryName: string;
  channels: ChannelListViewChannel[];
  totalChannels: number;
  searchChannels: ChannelListViewChannel[];
  searchPlaceholder: string;
  searchScopeLabel: string;
  isSearchCatalogLoading?: boolean;
  selectedChannel: ChannelListViewChannel | null;
  preparedChannelId: string | null;
  isLoading: boolean;
  favoriteIds: string[];
  favoriteFeedback: string;
  epgCredentials?: XtreamCredentials | null;
  detailsCredentials?: XtreamCredentials | null;
  previewPlayerMode?: PlayerMode;
  mediaType?: 'live' | MediaDetailsType;
  showEpg?: boolean;
  emptyMessage?: string;
  onBack: () => void;
  onChannelFocus: (channel: ChannelListViewChannel) => void;
  onChannelPress: (channel: ChannelListViewChannel) => void;
  onFavoriteToggle: (channel: ChannelListViewChannel) => void;
  onEndReached?: () => void;
  onSearchOpen?: () => void;
  onPreviewPress: () => void;
  language: AppLanguage;
};

export const createChannelFocusKeyPart = (value: string | number) =>
  String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export const getChannelFocusKey = (channelId: string | number) =>
  `content-channel-${createChannelFocusKeyPart(channelId)}`;

const getEpgFocusKey = (index: number) => `content-epg-${index}`;

const LONG_PRESS_MS = 800;
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_RESULT_BATCH_SIZE = 80;
const SEARCH_SCAN_CHUNK_SIZE = 900;
const MISSING_LOGO_MARKERS = [
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

type EnterDetails = {
  pressedKeys?: Record<string, number>;
};

type SearchResultState = {
  query: string;
  limit: number;
  total: number;
  channels: ChannelListViewChannel[];
  isSearching: boolean;
};

function useLongEnterPress(onShortPress: () => void, onLongPress: () => void) {
  const timerRef = useRef<number | null>(null);
  const longPressHandledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;

    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const onEnterPress = useCallback((_props?: object, details?: EnterDetails) => {
    if ((details?.pressedKeys?.enter ?? 1) > 1 || timerRef.current !== null) return;

    longPressHandledRef.current = false;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressHandledRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const onEnterRelease = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimer();

      if (!longPressHandledRef.current) {
        onShortPress();
      }

      return;
    }

    longPressHandledRef.current = false;
  }, [clearTimer, onShortPress]);

  useEffect(() => clearTimer, [clearTimer]);

  return { onEnterPress, onEnterRelease };
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

function isLikelyMissingLogoUrl(logo: string) {
  if (!logo.trim()) return true;

  try {
    const normalizedUrl = decodeURIComponent(logo).toLowerCase();
    return MISSING_LOGO_MARKERS.some((marker) => normalizedUrl.includes(marker));
  } catch {
    return false;
  }
}

function isLikelyImgurUnavailableImage(logo: string, width: number, height: number) {
  if (!width || !height) return true;

  try {
    const { hostname } = new URL(logo);
    const isImgurImage = hostname.toLowerCase().includes('imgur.com');
    const isSmallWidePlaceholder = width <= 220 && height <= 130 && width / height > 1.45;

    return isImgurImage && isSmallWidePlaceholder;
  } catch {
    return false;
  }
}

function ChannelLogo({
  logo,
  name,
  variant,
  poster = false,
}: {
  logo: string;
  name: string;
  variant: 'list' | 'preview';
  poster?: boolean;
}) {
  return (
    <ChannelLogoContent
      key={`${variant}-${poster ? 'poster' : 'logo'}-${logo}-${name}`}
      logo={logo}
      name={name}
      variant={variant}
      poster={poster}
    />
  );
}

function ChannelLogoContent({
  logo,
  name,
  variant,
  poster,
}: {
  logo: string;
  name: string;
  variant: 'list' | 'preview';
  poster: boolean;
}) {
  const [fallback, setFallback] = useState(() => isLikelyMissingLogoUrl(logo));

  const className = variant === 'preview' ? styles.previewLogo : styles.channelLogo;
  const posterClassName = poster
    ? variant === 'preview'
      ? styles.previewLogoPoster
      : styles.channelLogoPoster
    : '';

  return (
    <span className={`${className} ${posterClassName} ${fallback ? styles.logoFallback : ''}`} aria-label={name}>
      {!fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFallback(true)}
          onLoad={(event) => {
            const image = event.currentTarget;

            if (isLikelyImgurUnavailableImage(logo, image.naturalWidth, image.naturalHeight)) {
              setFallback(true);
            }
          }}
        />
      ) : (
        <span className={styles.logoFallbackText}>{name}</span>
      )}
    </span>
  );
}

function HeaderButton({
  focusKey,
  className,
  onPress,
  children,
  title,
}: {
  focusKey: string;
  className: string;
  onPress: () => void;
  children: React.ReactNode;
  title: string;
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${className} ${focused ? styles.focused : ''}`}
      onClick={onPress}
      title={title}
    >
      {children}
    </button>
  );
}

function ChannelListItem({
  channel,
  index,
  selected,
  prepared,
  favorite,
  posterLayout,
  onFocus,
  onPress,
  onFavoriteToggle,
  labels,
}: {
  channel: ChannelListViewChannel;
  index: number;
  selected: boolean;
  prepared: boolean;
  favorite: boolean;
  posterLayout: boolean;
  onFocus: (channel: ChannelListViewChannel) => void;
  onPress: (channel: ChannelListViewChannel) => void;
  onFavoriteToggle: (channel: ChannelListViewChannel) => void;
  labels: { readyFullscreen: string; okSelect: string };
}) {
  const focusKey = getChannelFocusKey(channel.id);
  const enterHandlers = useLongEnterPress(
    () => onPress(channel),
    () => onFavoriteToggle(channel)
  );
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: enterHandlers.onEnterPress,
    onEnterRelease: enterHandlers.onEnterRelease,
    onFocus: () => {
      onFocus(channel);

      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    },
    onArrowPress: (direction) => {
      if (direction === 'right') {
        setFocus('content-preview');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.channelItem} ${posterLayout ? styles.channelItemPoster : ''} ${focused ? styles.focused : ''} ${selected ? styles.selected : ''}`}
      onClick={() => onPress(channel)}
    >
      <span className={styles.channelIndex}>{index + 1}</span>
      <ChannelLogo logo={channel.logo} name={channel.name} variant="list" poster={posterLayout} />
      <span className={styles.channelText}>
        <span className={styles.channelName}>
          {channel.name}
          {favorite && <Star className={styles.favoriteStar} size={18} fill="currentColor" />}
        </span>
        <span className={styles.channelMeta}>{prepared ? labels.readyFullscreen : labels.okSelect}</span>
      </span>
    </button>
  );
}

function LivePreviewPlayer({
  channel,
  favorite,
  playerMode,
  labels,
}: {
  channel: ChannelListViewChannel;
  favorite: boolean;
  playerMode: PlayerMode;
  labels: {
    liveBadge?: string;
    fullscreenHint: string;
    livePreviewLoading?: string;
    livePreviewError?: string;
  };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let hls: Hls | null = null;
    let triedHls = false;
    let triedNative = false;
    let cancelled = false;
    const video = videoRef.current;
    const url = channel.url || '';

    if (!video) return undefined;

    const showError = () => {
      if (cancelled) return;
      setIsLoading(false);
      setHasError(true);
    };

    const showReady = () => {
      if (cancelled) return;
      setIsLoading(false);
      setHasError(false);
    };

    const playVideo = () => {
      video.play().then(showReady).catch(showReady);
    };

    const destroyHls = () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };

    const nativeHlsSupport = Boolean(
      video.canPlayType('application/vnd.apple.mpegurl') ||
      video.canPlayType('application/x-mpegURL')
    );
    const normalizedUrl = url.toLowerCase();
    const isHlsStream = normalizedUrl.includes('.m3u8') || normalizedUrl.includes('m3u8');
    const isDirectVideoFile = /\.(mp4|webm|ogg|ogv|mov)(\?|#|$)/i.test(url);

    const startNativePlayback = () => {
      triedNative = true;
      destroyHls();
      video.src = url;
      video.load();
      playVideo();
    };

    const startHlsPlayback = () => {
      if (!Hls.isSupported()) {
        if (playerMode === 'auto' && !triedNative) {
          startNativePlayback();
          return;
        }

        showError();
        return;
      }

      triedHls = true;
      destroyHls();
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        maxBufferLength: 18,
        backBufferLength: 8,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, playVideo);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (playerMode === 'auto' && !triedNative) {
          startNativePlayback();
          return;
        }

        showError();
      });
    };

    const handleVideoError = () => {
      if (playerMode === 'auto' && !triedHls && !isDirectVideoFile) {
        startHlsPlayback();
        return;
      }

      showError();
    };

    setIsLoading(true);
    setHasError(false);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.addEventListener('playing', showReady);
    video.addEventListener('canplay', showReady);
    video.addEventListener('error', handleVideoError);

    if (!url) {
      showError();
    } else if (playerMode === 'native') {
      startNativePlayback();
    } else if (playerMode === 'hls') {
      startHlsPlayback();
    } else if (nativeHlsSupport || isDirectVideoFile) {
      startNativePlayback();
    } else if (isHlsStream || Hls.isSupported()) {
      startHlsPlayback();
    } else {
      startNativePlayback();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('playing', showReady);
      video.removeEventListener('canplay', showReady);
      video.removeEventListener('error', handleVideoError);
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel.id, channel.url, playerMode]);

  return (
    <div className={styles.livePlayerShell}>
      <video
        ref={videoRef}
        className={styles.livePreviewVideo}
        muted
        playsInline
        autoPlay
        preload="auto"
      />

      {isLoading && !hasError && (
        <div className={styles.livePreviewState}>
          <span className={styles.previewSpinner} aria-hidden="true" />
          <strong>{labels.livePreviewLoading}</strong>
        </div>
      )}

      {hasError && (
        <div className={styles.livePreviewState}>
          <strong>{labels.livePreviewError}</strong>
        </div>
      )}

      <div className={styles.liveVideoShade} />
      <div className={styles.liveVideoOverlay}>
        <div className={styles.liveVideoTitle}>
          {labels.liveBadge && <span className={styles.liveBadge}>{labels.liveBadge}</span>}
          <h2>
            {channel.name}
            {favorite && <Star className={styles.favoriteStar} size={20} fill="currentColor" />}
          </h2>
        </div>

        <span className={styles.liveFullscreenHint}>
          <Play size={16} fill="currentColor" />
          {labels.fullscreenHint}
        </span>
      </div>
    </div>
  );
}

function PreviewPanel({
  channel,
  prepared,
  favorite,
  canFocusEpg,
  canFocusTrailer,
  posterLayout,
  previewPlayerMode,
  details,
  onPreviewPress,
  onFavoriteToggle,
  labels,
}: {
  channel: ChannelListViewChannel | null;
  prepared: boolean;
  favorite: boolean;
  canFocusEpg?: boolean;
  canFocusTrailer?: boolean;
  posterLayout: boolean;
  previewPlayerMode: PlayerMode;
  details?: MediaDetails | null;
  onPreviewPress: () => void;
  onFavoriteToggle: (channel: ChannelListViewChannel) => void;
  labels: {
    selected: string;
    lightweightPreview: string;
    fullscreenHint: string;
    selectChannel: string;
    selectChannelDescription: string;
    liveBadge?: string;
    livePreviewLoading?: string;
    livePreviewError?: string;
  };
}) {
  const enterHandlers = useLongEnterPress(
    onPreviewPress,
    () => {
      if (channel) {
        onFavoriteToggle(channel);
      }
    }
  );
  const { ref, focused } = useFocusable({
    focusKey: 'content-preview',
    onEnterPress: enterHandlers.onEnterPress,
    onEnterRelease: enterHandlers.onEnterRelease,
    onArrowPress: (direction) => {
      if (direction === 'left' && channel) {
        setFocus(getChannelFocusKey(channel.id));
        return false;
      }

      if (direction === 'down' && canFocusEpg) {
        setFocus(getEpgFocusKey(0));
        return false;
      }

      if (direction === 'down' && canFocusTrailer) {
        setFocus('content-trailer');
        return false;
      }

      return true;
    },
  });
  const heroImage = details?.backdrop || channel?.backdrop || channel?.logo || '';
  const [heroImageFallback, setHeroImageFallback] = useState(() => isLikelyMissingLogoUrl(heroImage));
  const heroMeta = [
    details?.releaseDate || channel?.releaseDate,
    details?.genre || channel?.genre,
  ].filter(Boolean).join(' • ');
  const heroSynopsis = details?.synopsis || channel?.synopsis || '';

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHeroImageFallback(isLikelyMissingLogoUrl(heroImage));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [heroImage]);

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.previewPanel} ${posterLayout ? styles.previewPanelPoster : ''} ${focused ? styles.focused : ''}`}
      onClick={onPreviewPress}
      disabled={!channel}
    >
      {channel ? (
        posterLayout ? (
          <div className={styles.mediaHero}>
            {!heroImageFallback && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.mediaHeroBackdrop}
                src={heroImage}
                alt=""
                loading="eager"
                decoding="async"
                onError={() => setHeroImageFallback(true)}
              />
            )}
            <div className={styles.mediaHeroShade} />
            <div className={styles.mediaHeroInfo}>
              <span className={styles.previewBadge}>{prepared ? labels.selected : labels.lightweightPreview}</span>
              <h2>
                {channel.name}
                {favorite && <Star className={styles.favoriteStar} size={22} fill="currentColor" />}
              </h2>
              {heroMeta && <p className={styles.mediaHeroMeta}>{heroMeta}</p>}
              {heroSynopsis && <p className={styles.mediaHeroSynopsis}>{heroSynopsis}</p>}
            </div>
            <div className={styles.mediaHeroPosterWrap}>
              <ChannelLogo logo={channel.logo} name={channel.name} variant="preview" poster />
              <span className={styles.mediaHeroPlay}>
                <Play size={30} fill="currentColor" />
              </span>
            </div>
          </div>
        ) : labels.liveBadge ? (
          <LivePreviewPlayer
            channel={channel}
            favorite={favorite}
            playerMode={previewPlayerMode}
            labels={{
              liveBadge: labels.liveBadge,
              fullscreenHint: labels.fullscreenHint,
              livePreviewLoading: labels.livePreviewLoading,
              livePreviewError: labels.livePreviewError,
            }}
          />
        ) : (
          <>
            <div className={styles.previewArt}>
              <ChannelLogo logo={channel.logo} name={channel.name} variant="preview" poster={false} />
            </div>
            <div className={styles.previewOverlay}>
              <span className={styles.previewBadge}>{prepared ? labels.selected : labels.lightweightPreview}</span>
              <h2>
                {channel.name}
                {favorite && <Star className={styles.favoriteStar} size={22} fill="currentColor" />}
              </h2>
            </div>
            <span className={styles.playIcon}>
              <Play size={34} fill="currentColor" />
            </span>
          </>
        )
      ) : (
        <div className={styles.emptyPreview}>
          <span>N</span>
          <h2>{labels.selectChannel}</h2>
          <p>{labels.selectChannelDescription}</p>
        </div>
      )}
    </button>
  );
}

function EpgProgramRow({
  program,
  index,
  isNext,
  selectedChannelId,
  labels,
}: {
  program: EpgProgram;
  index: number;
  isNext: boolean;
  selectedChannelId?: string;
  labels: {
    epgNow: string;
    epgNext: string;
  };
}) {
  const { ref, focused } = useFocusable({
    focusKey: getEpgFocusKey(index),
    onEnterPress: () => undefined,
    onFocus: () => {
      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    },
    onArrowPress: (direction) => {
      if (direction === 'left') {
        setFocus(selectedChannelId ? getChannelFocusKey(selectedChannelId) : 'content-preview');
        return false;
      }

      if (direction === 'up' && index === 0) {
        setFocus('content-preview');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.epgRow} ${program.isCurrent ? styles.epgRowCurrent : ''} ${focused ? styles.focused : ''}`}
      aria-label={`${program.startTimeLabel} - ${program.endTimeLabel} ${program.title}`}
    >
      <span className={styles.epgStatus}>
        {program.isCurrent ? labels.epgNow : isNext ? labels.epgNext : ''}
      </span>
      <span className={styles.epgTime}>{program.startTimeLabel} - {program.endTimeLabel}</span>
      <span className={styles.epgText}>
        <strong>{program.title}</strong>
        {program.description && <small>{program.description}</small>}
      </span>
    </button>
  );
}

function EpgProgramList({
  programs,
  isLoading,
  hasChannel,
  hasEpg,
  selectedChannelId,
  labels,
}: {
  programs: EpgProgram[];
  isLoading: boolean;
  hasChannel: boolean;
  hasEpg: boolean;
  selectedChannelId?: string;
  labels: {
    epgTitle: string;
    epgSchedule: string;
    epgNow: string;
    epgNext: string;
    epgLoading: string;
    epgUnavailable: string;
    epgNoChannel: string;
  };
}) {
  const visiblePrograms = programs;
  const nextProgramIndex = visiblePrograms.findIndex((program) => !program.isCurrent);

  return (
    <section className={styles.epgPanel} aria-live="polite">
      <div className={styles.epgHeader}>
        <span>{labels.epgTitle}</span>
        <strong>{labels.epgSchedule}</strong>
      </div>

      {isLoading ? (
        <div className={styles.epgSkeletonList}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.epgSkeletonRow} />
          ))}
        </div>
      ) : !hasChannel ? (
        <div className={styles.epgEmpty}>{labels.epgNoChannel}</div>
      ) : !hasEpg ? (
        <div className={styles.epgEmpty}>{labels.epgUnavailable}</div>
      ) : (
        <div className={styles.epgList}>
          {visiblePrograms.map((program, index) => {
            const isNext = !program.isCurrent && index === nextProgramIndex;

            return (
              <EpgProgramRow
                key={program.id || `${program.startTimeLabel}-${program.title}-${index}`}
                program={program}
                index={index}
                isNext={isNext}
                selectedChannelId={selectedChannelId}
                labels={{
                  epgNow: labels.epgNow,
                  epgNext: labels.epgNext,
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

const getDetailRows = (details: MediaDetails | null, labels: {
  detailsGenre: string;
  detailsYear: string;
  detailsCast: string;
  detailsDirector: string;
}) => {
  if (!details) return [];

  return [
    { label: labels.detailsGenre, value: details.genre },
    { label: labels.detailsYear, value: details.releaseDate },
    { label: labels.detailsCast, value: details.cast },
    { label: labels.detailsDirector, value: details.director },
  ].filter((item) => item.value);
};

function TrailerActionButton({
  trailerUrl,
  label,
  selectedChannelId,
  onPress,
}: {
  trailerUrl: string;
  label: string;
  selectedChannelId?: string;
  onPress: (url: string) => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: 'content-trailer',
    onEnterPress: () => onPress(trailerUrl),
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus('content-preview');
        return false;
      }

      if (direction === 'left' && selectedChannelId) {
        setFocus(getChannelFocusKey(selectedChannelId));
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.trailerButton} ${focused ? styles.focused : ''}`}
      onClick={() => onPress(trailerUrl)}
    >
      <Play size={16} fill="currentColor" aria-hidden="true" />
      {label}
    </button>
  );
}

function TrailerCloseButton({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: 'trailer-close',
    onEnterPress: onClose,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.trailerCloseButton} ${focused ? styles.focused : ''}`}
      onClick={onClose}
      aria-label={label}
      title={label}
    >
      <X size={24} aria-hidden="true" />
    </button>
  );
}

function TrailerModal({
  trailer,
  labels,
  onClose,
}: {
  trailer: { url: string; title: string };
  labels: {
    trailerTitle: string;
    closeTrailer: string;
  };
  onClose: () => void;
}) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'trailer-modal',
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
    preferredChildFocusKey: 'trailer-close',
  });

  useEffect(() => {
    window.setTimeout(() => setFocus('trailer-close'), 0);
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className={styles.trailerOverlay}
        role="dialog"
        aria-modal="true"
        aria-label={`${labels.trailerTitle}: ${trailer.title}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className={styles.trailerModal}>
          <div className={styles.trailerModalHeader}>
            <div>
              <span>{labels.trailerTitle}</span>
              <strong>{trailer.title}</strong>
            </div>
            <TrailerCloseButton label={labels.closeTrailer} onClose={onClose} />
          </div>

          <div className={styles.trailerFrameWrap}>
            <iframe
              className={styles.trailerFrame}
              src={trailer.url}
              title={`${labels.trailerTitle}: ${trailer.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}

function MediaDetailsPanel({
  channel,
  details,
  isLoading,
  labels,
  onTrailerPress,
}: {
  channel: ChannelListViewChannel | null;
  details: MediaDetails | null;
  isLoading: boolean;
  onTrailerPress: (url: string) => void;
  labels: {
    detailsTitle: string;
    detailsInfo: string;
    detailsLoading: string;
    detailsUnavailable: string;
    detailsNoContent: string;
    detailsGenre: string;
    detailsYear: string;
    detailsCast: string;
    detailsDirector: string;
    watchTrailer: string;
  };
}) {
  const detailRows = getDetailRows(details, labels);

  return (
    <section className={styles.detailsPanel} aria-live="polite" aria-label={isLoading ? labels.detailsLoading : labels.detailsTitle}>
      <div className={styles.epgHeader}>
        <span>{labels.detailsTitle}</span>
        <div className={styles.detailsHeaderActions}>
          {details?.trailerUrl && (
            <TrailerActionButton
              trailerUrl={details.trailerUrl}
              label={labels.watchTrailer}
              selectedChannelId={channel?.id}
              onPress={onTrailerPress}
            />
          )}

          {details?.rating ? (
            <strong className={styles.ratingBadge}>
              <Star size={18} fill="currentColor" aria-hidden="true" />
              {details.rating}
            </strong>
          ) : (
            <strong>{labels.detailsInfo}</strong>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.epgSkeletonList}>
          <div className={styles.detailsSkeletonLine} />
          <div className={styles.detailsSkeletonLine} />
          <div className={styles.detailsSkeletonShort} />
        </div>
      ) : !channel ? (
        <div className={styles.epgEmpty}>{labels.detailsNoContent}</div>
      ) : !details ? (
        <div className={styles.epgEmpty}>{labels.detailsUnavailable}</div>
      ) : (
        <div className={styles.detailsBody}>
          {details.synopsis ? (
            <p className={styles.detailsSynopsis}>{details.synopsis}</p>
          ) : (
            <p className={styles.noEpgText}>{labels.detailsUnavailable}</p>
          )}

          {detailRows.length > 0 && (
            <dl className={styles.detailsMetaGrid}>
              {detailRows.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

export default function ChannelListView({
  mediaTitle,
  categoryName,
  channels,
  totalChannels,
  searchChannels,
  searchPlaceholder,
  searchScopeLabel,
  isSearchCatalogLoading = false,
  selectedChannel,
  preparedChannelId,
  isLoading,
  favoriteIds,
  favoriteFeedback,
  epgCredentials,
  detailsCredentials,
  previewPlayerMode = 'auto',
  mediaType = 'live',
  showEpg = false,
  emptyMessage,
  onBack,
  onChannelFocus,
  onChannelPress,
  onFavoriteToggle,
  onEndReached,
  onSearchOpen,
  onPreviewPress,
  language,
}: ChannelListViewProps) {
  const copy = appCopy[language];
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultLimit, setSearchResultLimit] = useState(SEARCH_RESULT_BATCH_SIZE);
  const [activeTrailer, setActiveTrailer] = useState<{ url: string; title: string } | null>(null);
  const [asyncSearchResult, setAsyncSearchResult] = useState<SearchResultState>({
    query: '',
    limit: SEARCH_RESULT_BATCH_SIZE,
    total: 0,
    channels: [],
    isSearching: false,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const { ref, focusKey } = useFocusable({
    focusKey: 'content-list-view',
    trackChildren: true,
  });
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const {
    programs: epgPrograms,
    isLoading: isEpgLoading,
    hasEpg,
  } = useChannelEpg({
    credentials: epgCredentials,
    streamId: selectedChannel?.id,
    enabled: showEpg && Boolean(selectedChannel),
    limit: 24,
  });
  const detailsMediaType = mediaType === 'movies' || mediaType === 'series' ? mediaType : null;
  const detailsSeed = useMemo(() => {
    if (!selectedChannel) return null;

    return {
      id: selectedChannel.id,
      title: selectedChannel.name,
      synopsis: selectedChannel.synopsis,
      rating: selectedChannel.rating,
      genre: selectedChannel.genre,
      releaseDate: selectedChannel.releaseDate,
      backdrop: selectedChannel.backdrop,
      cast: selectedChannel.cast,
      director: selectedChannel.director,
      trailerUrl: selectedChannel.trailerUrl,
    };
  }, [selectedChannel]);
  const {
    details: mediaDetails,
    isLoading: isMediaDetailsLoading,
  } = useMediaDetails({
    credentials: detailsCredentials,
    mediaType: detailsMediaType,
    streamId: selectedChannel?.id,
    seed: detailsSeed,
    enabled: Boolean(detailsMediaType && selectedChannel),
  });
  const showMediaDetails = Boolean(detailsMediaType);
  const usePosterLayout = mediaType === 'movies' || mediaType === 'series';
  const hasSearch = hasSearchQuery(debouncedSearchQuery);
  const searchIndex = useMemo(
    () => createSearchIndex(searchChannels, (channel) => channel.name),
    [searchChannels]
  );
  useEffect(() => {
    if (!hasSearch) return undefined;

    let cancelled = false;
    let scanTimeout: number | null = null;
    const query = debouncedSearchQuery;
    const limit = searchResultLimit;
    const matchesSearch = createIndexedSearchMatcher<ChannelListViewChannel>(debouncedSearchQuery);
    const matchedChannels: ChannelListViewChannel[] = [];
    let total = 0;
    let cursor = 0;

    const startTimeout = window.setTimeout(() => {
      if (cancelled) return;

      setAsyncSearchResult({
        query,
        limit,
        total: 0,
        channels: [],
        isSearching: true,
      });

      const scanChunk = () => {
        const chunkEnd = Math.min(cursor + SEARCH_SCAN_CHUNK_SIZE, searchIndex.length);

        for (; cursor < chunkEnd; cursor += 1) {
          const entry = searchIndex[cursor];
          if (!matchesSearch(entry)) continue;

          total += 1;

          if (matchedChannels.length < limit) {
            matchedChannels.push(entry.item);
          }
        }

        if (cancelled) return;

        if (cursor < searchIndex.length) {
          scanTimeout = window.setTimeout(scanChunk, 0);
          return;
        }

        setAsyncSearchResult({
          query,
          limit,
          total,
          channels: matchedChannels,
          isSearching: false,
        });
      };

      scanTimeout = window.setTimeout(scanChunk, 0);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimeout);

      if (scanTimeout !== null) {
        window.clearTimeout(scanTimeout);
      }
    };
  }, [debouncedSearchQuery, hasSearch, searchIndex, searchResultLimit]);

  const isSearchResultFresh =
    asyncSearchResult.query === debouncedSearchQuery &&
    asyncSearchResult.limit === searchResultLimit;
  const isSearchRunning = hasSearch && (!isSearchResultFresh || asyncSearchResult.isSearching);
  const searchResult = useMemo(() => {
    if (!hasSearch) {
      return {
        total: channels.length,
        channels,
      };
    }

    if (!isSearchResultFresh) {
      return {
        total: 0,
        channels: [],
      };
    }

    return {
      total: asyncSearchResult.total,
      channels: asyncSearchResult.channels,
    };
  }, [asyncSearchResult.channels, asyncSearchResult.total, channels, hasSearch, isSearchResultFresh]);
  const visibleChannels = searchResult.channels;

  const focusFirstChannel = useCallback(() => {
    setFocus(visibleChannels.length > 0 ? getChannelFocusKey(visibleChannels[0].id) : 'content-back');
  }, [visibleChannels]);

  const openSearch = useCallback(() => {
    onSearchOpen?.();
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [onSearchOpen]);

  const closeSearch = useCallback(() => {
    setSearchQuery('');
    setSearchOpen(false);
    setSearchResultLimit(SEARCH_RESULT_BATCH_SIZE);
    window.setTimeout(() => setFocus('content-search'), 0);
  }, []);

  const openTrailer = useCallback((url: string) => {
    if (!selectedChannel) return;

    setActiveTrailer({
      url,
      title: mediaDetails?.title || selectedChannel.name,
    });
  }, [mediaDetails?.title, selectedChannel]);

  const closeTrailer = useCallback(() => {
    setActiveTrailer(null);
    window.setTimeout(() => setFocus('content-trailer'), 0);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchResultLimit(SEARCH_RESULT_BATCH_SIZE);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    if (searchOpen) return;

    const timeout = window.setTimeout(() => {
      const selectedChannelVisible = Boolean(
        selectedChannel && visibleChannels.some((channel) => channel.id === selectedChannel.id)
      );

      if (selectedChannelVisible && selectedChannel) {
        setFocus(getChannelFocusKey(selectedChannel.id));
        return;
      }

      focusFirstChannel();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [categoryName, focusFirstChannel, searchOpen, selectedChannel, visibleChannels]);

  const prepared = Boolean(selectedChannel && preparedChannelId === selectedChannel.id);
  const selectedChannelFavorite = Boolean(selectedChannel && favoriteIdSet.has(selectedChannel.id));
  const totalChannelCount = Math.max(channels.length, totalChannels);
  const hasMoreSearchResults = hasSearch && !isSearchRunning && visibleChannels.length < searchResult.total;
  const listTitleLabel = hasSearch
    ? isSearchCatalogLoading
      ? searchScopeLabel
      : copy.content.searchResult
    : searchOpen
      ? searchScopeLabel
      : copy.content.channels;

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref}>
        <header className={styles.header}>
          <HeaderButton
            focusKey="content-back"
            className={styles.backButton}
            onPress={onBack}
            title={copy.content.backToFolders}
          >
            <ArrowLeft size={24} />
            <span>{copy.common.folders}</span>
          </HeaderButton>

          <div className={styles.heading}>
            <span>{mediaTitle} / {categoryName}</span>
            <h1>{categoryName}</h1>
          </div>

          <div className={styles.headerActions}>
            {searchOpen && (
              <label className={styles.searchBox}>
                <Search size={22} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeSearch();
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      searchInputRef.current?.blur();
                      focusFirstChannel();
                    }
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </label>
            )}

            <HeaderButton
              focusKey="content-search"
              className={styles.iconButton}
              onPress={openSearch}
              title={copy.common.search}
            >
              <Search size={27} />
            </HeaderButton>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.listPanel}>
            <div className={styles.listTitle}>
              <span>
                {hasSearch
                  ? `${visibleChannels.length} / ${searchResult.total}`
                  : `${channels.length} / ${totalChannelCount}`}
              </span>
              <strong>{listTitleLabel}</strong>
            </div>

            {isLoading ? (
              <div className={styles.loading}>{copy.content.loading}</div>
            ) : (
              <div className={styles.channelList}>
                {visibleChannels.length > 0 ? (
                  visibleChannels.map((channel, index) => (
                    <ChannelListItem
                      key={`${channel.id}-${index}`}
                      channel={channel}
                      index={index}
                      selected={selectedChannel?.id === channel.id}
                      prepared={preparedChannelId === channel.id}
                      favorite={favoriteIdSet.has(channel.id)}
                      posterLayout={usePosterLayout}
                      onFocus={(focusedChannel) => {
                        onChannelFocus(focusedChannel);

                        if (hasSearch && index >= visibleChannels.length - 8 && hasMoreSearchResults) {
                          setSearchResultLimit((currentLimit) => currentLimit + SEARCH_RESULT_BATCH_SIZE);
                          return;
                        }

                        if (!hasSearch && index >= visibleChannels.length - 8) {
                          onEndReached?.();
                        }
                      }}
                      onPress={onChannelPress}
                      onFavoriteToggle={onFavoriteToggle}
                      labels={{
                        readyFullscreen: copy.content.readyFullscreen,
                        okSelect: copy.content.okSelect,
                      }}
                    />
                  ))
                ) : (
                  <div className={styles.emptyList}>
                    {hasSearch
                      ? copy.content.emptySearch
                      : emptyMessage || copy.content.emptyFolder}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside
            className={[
              styles.previewColumn,
              showEpg ? styles.previewColumnWithEpg : '',
              showMediaDetails ? styles.previewColumnWithDetails : '',
            ].filter(Boolean).join(' ')}
          >
            {showEpg ? (
              <>
                <PreviewPanel
                  channel={selectedChannel}
                  prepared={prepared}
                  favorite={selectedChannelFavorite}
                  canFocusEpg={hasEpg}
                  posterLayout={usePosterLayout}
                  previewPlayerMode={previewPlayerMode}
                  details={null}
                  onPreviewPress={onPreviewPress}
                  onFavoriteToggle={onFavoriteToggle}
                  labels={{
                    selected: copy.content.selected,
                    lightweightPreview: copy.content.lightweightPreview,
                    fullscreenHint: copy.content.fullscreenHint,
                    selectChannel: copy.content.selectChannel,
                    selectChannelDescription: copy.content.selectChannelDescription,
                    liveBadge: copy.content.liveBadge,
                    livePreviewLoading: copy.content.livePreviewLoading,
                    livePreviewError: copy.content.livePreviewError,
                  }}
                />

                <EpgProgramList
                  programs={epgPrograms}
                  isLoading={isEpgLoading}
                  hasChannel={Boolean(selectedChannel)}
                  hasEpg={hasEpg}
                  selectedChannelId={selectedChannel?.id}
                  labels={{
                    epgTitle: copy.content.epgTitle,
                    epgSchedule: copy.content.epgSchedule,
                    epgNow: copy.content.epgNow,
                    epgNext: copy.content.epgNext,
                    epgLoading: copy.content.epgLoading,
                    epgUnavailable: copy.content.epgUnavailable,
                    epgNoChannel: copy.content.epgNoChannel,
                  }}
                />
              </>
            ) : showMediaDetails ? (
              <>
                <PreviewPanel
                  channel={selectedChannel}
                  prepared={prepared}
                  favorite={selectedChannelFavorite}
                  canFocusEpg={false}
                  canFocusTrailer={Boolean(mediaDetails?.trailerUrl)}
                  posterLayout={usePosterLayout}
                  previewPlayerMode={previewPlayerMode}
                  details={mediaDetails}
                  onPreviewPress={onPreviewPress}
                  onFavoriteToggle={onFavoriteToggle}
                  labels={{
                    selected: copy.content.selected,
                    lightweightPreview: copy.content.lightweightPreview,
                    fullscreenHint: copy.content.fullscreenHint,
                    selectChannel: copy.content.selectChannel,
                    selectChannelDescription: copy.content.selectChannelDescription,
                  }}
                />

                <MediaDetailsPanel
                  channel={selectedChannel}
                  details={mediaDetails}
                  isLoading={isMediaDetailsLoading}
                  onTrailerPress={openTrailer}
                  labels={{
                    detailsTitle: copy.content.detailsTitle,
                    detailsInfo: copy.content.detailsInfo,
                    detailsLoading: copy.content.detailsLoading,
                    detailsUnavailable: copy.content.detailsUnavailable,
                    detailsNoContent: copy.content.detailsNoContent,
                    detailsGenre: copy.content.detailsGenre,
                    detailsYear: copy.content.detailsYear,
                    detailsCast: copy.content.detailsCast,
                    detailsDirector: copy.content.detailsDirector,
                    watchTrailer: copy.content.watchTrailer,
                  }}
                />
              </>
            ) : (
              <PreviewPanel
                channel={selectedChannel}
                prepared={prepared}
                favorite={selectedChannelFavorite}
                canFocusEpg={false}
                posterLayout={usePosterLayout}
                previewPlayerMode={previewPlayerMode}
                details={mediaDetails}
                onPreviewPress={onPreviewPress}
                onFavoriteToggle={onFavoriteToggle}
                labels={{
                  selected: copy.content.selected,
                  lightweightPreview: copy.content.lightweightPreview,
                  fullscreenHint: copy.content.fullscreenHint,
                  selectChannel: copy.content.selectChannel,
                  selectChannelDescription: copy.content.selectChannelDescription,
                }}
              />
            )}

            {favoriteFeedback && (
              <div className={styles.favoriteFeedback}>{favoriteFeedback}</div>
            )}

            <div className={styles.remoteHint}>
              <span>{copy.content.remoteChannelNav}</span>
              <span>{copy.content.remotePreviewNav}</span>
              <span>{copy.content.remoteFullscreen}</span>
              <span>{copy.content.remoteSearchAll}</span>
              <span>{copy.content.remoteFavorites}</span>
            </div>
          </aside>
        </div>

        {activeTrailer && (
          <TrailerModal
            trailer={activeTrailer}
            labels={{
              trailerTitle: copy.content.trailerTitle,
              closeTrailer: copy.content.closeTrailer,
            }}
            onClose={closeTrailer}
          />
        )}
      </section>
    </FocusContext.Provider>
  );
}
