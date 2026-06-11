import type { ChannelListViewChannel } from '@/components/ChannelListView';

export type LiveWatchHistoryItem = ChannelListViewChannel & {
  watchCount: number;
  lastWatchedAt: number;
};

const LIVE_WATCH_HISTORY_KEY = 'nuvix_watch_history_live';
const LIVE_WATCH_HISTORY_LIMIT = 40;

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const isLiveChannel = (channel: Pick<ChannelListViewChannel, 'url' | 'extension'>) => {
  const url = channel.url?.toLowerCase() ?? '';
  const extension = channel.extension?.toLowerCase() ?? '';

  return (
    url.includes('/live/') ||
    url.endsWith('.m3u8') ||
    url.endsWith('.ts') ||
    extension === 'm3u8' ||
    extension === 'ts'
  );
};

const readHistory = (): LiveWatchHistoryItem[] => {
  if (!canUseLocalStorage()) return [];

  try {
    const rawHistory = window.localStorage.getItem(LIVE_WATCH_HISTORY_KEY);
    if (!rawHistory) return [];

    const parsedHistory = JSON.parse(rawHistory);
    return Array.isArray(parsedHistory)
      ? parsedHistory.filter((item): item is LiveWatchHistoryItem => (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string'
      ))
      : [];
  } catch {
    return [];
  }
};

const saveHistory = (history: LiveWatchHistoryItem[]) => {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(LIVE_WATCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Local storage can be unavailable on some TV browsers. Failing silently keeps playback intact.
  }
};

export const getLiveWatchHistory = () => {
  const history = readHistory();
  const liveHistory = history.filter(isLiveChannel);

  if (liveHistory.length !== history.length) {
    saveHistory(liveHistory);
  }

  return liveHistory.sort((a, b) => {
    if (b.watchCount !== a.watchCount) return b.watchCount - a.watchCount;
    return b.lastWatchedAt - a.lastWatchedAt;
  });
};

export const recordLiveWatch = (channel: ChannelListViewChannel) => {
  if (!isLiveChannel(channel)) {
    return getLiveWatchHistory();
  }

  const now = Date.now();
  const history = readHistory().filter(isLiveChannel);
  const existingIndex = history.findIndex((item) => item.id === channel.id);
  const existingItem = existingIndex >= 0 ? history[existingIndex] : null;
  const nextItem: LiveWatchHistoryItem = {
    ...existingItem,
    ...channel,
    watchCount: (existingItem?.watchCount ?? 0) + 1,
    lastWatchedAt: now,
  };
  const nextHistory = [
    nextItem,
    ...history.filter((item) => item.id !== channel.id),
  ]
    .sort((a, b) => {
      if (b.watchCount !== a.watchCount) return b.watchCount - a.watchCount;
      return b.lastWatchedAt - a.lastWatchedAt;
    })
    .slice(0, LIVE_WATCH_HISTORY_LIMIT);

  saveHistory(nextHistory);
  return nextHistory;
};
