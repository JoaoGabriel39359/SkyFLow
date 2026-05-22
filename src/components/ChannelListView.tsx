'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Search, Star } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import { createIndexedSearchMatcher, createSearchIndex, hasSearchQuery } from '@/lib/search';
import { useChannelEpg } from '@/hooks/useChannelEpg';
import type { EpgProgram, XtreamCredentials } from '@/lib/epg';
import styles from './ChannelListView.module.css';

export type ChannelListViewChannel = {
  id: string;
  name: string;
  logo: string;
  url?: string;
};

type ChannelListViewProps = {
  mediaTitle: string;
  categoryName: string;
  channels: ChannelListViewChannel[];
  searchChannels: ChannelListViewChannel[];
  selectedChannel: ChannelListViewChannel | null;
  preparedChannelId: string | null;
  isLoading: boolean;
  favoriteIds: string[];
  favoriteFeedback: string;
  epgCredentials?: XtreamCredentials | null;
  showEpg?: boolean;
  emptyMessage?: string;
  onBack: () => void;
  onChannelFocus: (channel: ChannelListViewChannel) => void;
  onChannelPress: (channel: ChannelListViewChannel) => void;
  onFavoriteToggle: (channel: ChannelListViewChannel) => void;
  onEndReached?: () => void;
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
}: {
  logo: string;
  name: string;
  variant: 'list' | 'preview';
}) {
  return (
    <ChannelLogoContent
      key={`${variant}-${logo}-${name}`}
      logo={logo}
      name={name}
      variant={variant}
    />
  );
}

function ChannelLogoContent({
  logo,
  name,
  variant,
}: {
  logo: string;
  name: string;
  variant: 'list' | 'preview';
}) {
  const [fallback, setFallback] = useState(() => isLikelyMissingLogoUrl(logo));

  const className = variant === 'preview' ? styles.previewLogo : styles.channelLogo;

  return (
    <span className={`${className} ${fallback ? styles.logoFallback : ''}`} aria-label={name}>
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
      className={`${styles.channelItem} ${focused ? styles.focused : ''} ${selected ? styles.selected : ''}`}
      onClick={() => onPress(channel)}
    >
      <span className={styles.channelIndex}>{index + 1}</span>
      <ChannelLogo logo={channel.logo} name={channel.name} variant="list" />
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

function PreviewPanel({
  channel,
  prepared,
  favorite,
  canFocusEpg,
  onPreviewPress,
  onFavoriteToggle,
  labels,
}: {
  channel: ChannelListViewChannel | null;
  prepared: boolean;
  favorite: boolean;
  canFocusEpg?: boolean;
  onPreviewPress: () => void;
  onFavoriteToggle: (channel: ChannelListViewChannel) => void;
  labels: {
    selected: string;
    lightweightPreview: string;
    fullscreenHint: string;
    selectChannel: string;
    selectChannelDescription: string;
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

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.previewPanel} ${focused ? styles.focused : ''}`}
      onClick={onPreviewPress}
      disabled={!channel}
    >
      {channel ? (
        <>
          <div className={styles.previewArt}>
            <ChannelLogo logo={channel.logo} name={channel.name} variant="preview" />
          </div>
          <div className={styles.previewOverlay}>
            <span className={styles.previewBadge}>{prepared ? labels.selected : labels.lightweightPreview}</span>
            <h2>
              {channel.name}
              {favorite && <Star className={styles.favoriteStar} size={22} fill="currentColor" />}
            </h2>
            <p>{labels.fullscreenHint}</p>
          </div>
          <span className={styles.playIcon}>
            <Play size={34} fill="currentColor" />
          </span>
        </>
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

function EpgInfoCard({
  channel,
  currentProgram,
  isLoading,
  hasEpg,
  labels,
}: {
  channel: ChannelListViewChannel | null;
  currentProgram: EpgProgram | null;
  isLoading: boolean;
  hasEpg: boolean;
  labels: {
    liveBadge: string;
    epgCurrentProgram: string;
    epgLoading: string;
    epgUnavailable: string;
    epgNoChannel: string;
  };
}) {
  return (
    <section className={styles.previewInfoCard} aria-live="polite">
      <span className={styles.liveBadge}>{labels.liveBadge}</span>
      <h2>{channel?.name || labels.epgNoChannel}</h2>

      {channel ? (
        <div className={styles.currentProgram}>
          <span>{labels.epgCurrentProgram}</span>
          {isLoading ? (
            <p>{labels.epgLoading}</p>
          ) : hasEpg && currentProgram ? (
            <>
              <strong>{currentProgram.title}</strong>
              <small>{currentProgram.startTimeLabel} - {currentProgram.endTimeLabel}</small>
              {currentProgram.progressPercent !== undefined && (
                <div className={styles.epgProgress} aria-hidden="true">
                  <span style={{ width: `${currentProgram.progressPercent}%` }} />
                </div>
              )}
            </>
          ) : (
            <p>{labels.epgUnavailable}</p>
          )}
        </div>
      ) : (
        <p className={styles.noEpgText}>{labels.epgNoChannel}</p>
      )}
    </section>
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

export default function ChannelListView({
  mediaTitle,
  categoryName,
  channels,
  searchChannels,
  selectedChannel,
  preparedChannelId,
  isLoading,
  favoriteIds,
  favoriteFeedback,
  epgCredentials,
  showEpg = false,
  emptyMessage,
  onBack,
  onChannelFocus,
  onChannelPress,
  onFavoriteToggle,
  onEndReached,
  onPreviewPress,
  language,
}: ChannelListViewProps) {
  const copy = appCopy[language];
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultLimit, setSearchResultLimit] = useState(SEARCH_RESULT_BATCH_SIZE);
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
    currentProgram,
    isLoading: isEpgLoading,
    hasEpg,
  } = useChannelEpg({
    credentials: epgCredentials,
    streamId: selectedChannel?.id,
    enabled: showEpg && Boolean(selectedChannel),
    limit: 24,
  });
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
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchQuery('');
    setSearchOpen(false);
    setSearchResultLimit(SEARCH_RESULT_BATCH_SIZE);
    window.setTimeout(() => setFocus('content-search'), 0);
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
  const totalChannelCount = Math.max(channels.length, searchChannels.length);
  const hasMoreSearchResults = hasSearch && !isSearchRunning && visibleChannels.length < searchResult.total;

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
                  placeholder={copy.content.searchContent}
                  aria-label={copy.content.searchContent}
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
              <strong>{hasSearch ? copy.content.searchResult : copy.content.channels}</strong>
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

          <aside className={`${styles.previewColumn} ${showEpg ? styles.previewColumnWithEpg : ''}`}>
            {showEpg ? (
              <>
                <div className={styles.previewTop}>
                  <PreviewPanel
                    channel={selectedChannel}
                    prepared={prepared}
                    favorite={selectedChannelFavorite}
                    canFocusEpg={hasEpg}
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

                  <EpgInfoCard
                    channel={selectedChannel}
                    currentProgram={currentProgram}
                    isLoading={isEpgLoading}
                    hasEpg={hasEpg}
                    labels={{
                      liveBadge: copy.content.liveBadge,
                      epgCurrentProgram: copy.content.epgCurrentProgram,
                      epgLoading: copy.content.epgLoading,
                      epgUnavailable: copy.content.epgUnavailable,
                      epgNoChannel: copy.content.epgNoChannel,
                    }}
                  />
                </div>

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
            ) : (
              <PreviewPanel
                channel={selectedChannel}
                prepared={prepared}
                favorite={selectedChannelFavorite}
                canFocusEpg={false}
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
      </section>
    </FocusContext.Provider>
  );
}
