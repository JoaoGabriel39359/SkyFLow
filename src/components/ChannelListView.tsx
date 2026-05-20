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

const LONG_PRESS_MS = 800;
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_RESULT_BATCH_SIZE = 80;

type EnterDetails = {
  pressedKeys?: Record<string, number>;
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
      <span
        className={styles.channelLogo}
        style={{ backgroundImage: channel.logo ? `url("${channel.logo}")` : undefined }}
      >
        {!channel.logo && 'N'}
      </span>
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
  onPreviewPress,
  onFavoriteToggle,
  labels,
}: {
  channel: ChannelListViewChannel | null;
  prepared: boolean;
  favorite: boolean;
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
          <div
            className={styles.previewArt}
            style={{ backgroundImage: channel.logo ? `url("${channel.logo}")` : undefined }}
          >
            {!channel.logo && <span>N</span>}
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const { ref, focusKey } = useFocusable({
    focusKey: 'content-list-view',
    trackChildren: true,
  });
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const hasSearch = hasSearchQuery(debouncedSearchQuery);
  const searchIndex = useMemo(
    () => createSearchIndex(searchChannels, (channel) => channel.name),
    [searchChannels]
  );
  const searchResult = useMemo(() => {
    if (!hasSearch) {
      return {
        total: channels.length,
        channels,
      };
    }

    const matchesSearch = createIndexedSearchMatcher<ChannelListViewChannel>(debouncedSearchQuery);
    const matchedChannels: ChannelListViewChannel[] = [];
    let total = 0;

    for (const entry of searchIndex) {
      if (!matchesSearch(entry)) continue;

      total += 1;

      if (matchedChannels.length < searchResultLimit) {
        matchedChannels.push(entry.item);
      }
    }

    return {
      total,
      channels: matchedChannels,
    };
  }, [channels, debouncedSearchQuery, hasSearch, searchIndex, searchResultLimit]);
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
  const hasMoreChannels = channels.length < searchChannels.length;
  const totalChannelCount = Math.max(channels.length, searchChannels.length);
  const hasMoreSearchResults = hasSearch && visibleChannels.length < searchResult.total;

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
              <strong>{hasSearch ? copy.content.searchResult : hasMoreChannels ? copy.content.blockLoading : copy.content.channels}</strong>
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

          <aside className={styles.previewColumn}>
            <PreviewPanel
              channel={selectedChannel}
              prepared={prepared}
              favorite={selectedChannelFavorite}
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
