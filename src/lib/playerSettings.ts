export type PlayerMode = 'auto' | 'native' | 'hls';

export type PlayerContentType = 'live' | 'movies' | 'series';

export type PlayerModeByType = Record<PlayerContentType, PlayerMode>;

export const playerModeOrder: PlayerMode[] = ['auto', 'native', 'hls'];

export const playerContentTypes: PlayerContentType[] = ['live', 'movies', 'series'];

export const DEFAULT_PLAYER_MODE_BY_TYPE: PlayerModeByType = {
  live: 'auto',
  movies: 'auto',
  series: 'auto',
};

const PLAYER_STORAGE_KEYS: Record<PlayerContentType, string> = {
  live: 'nuvix_player_live',
  movies: 'nuvix_player_movies',
  series: 'nuvix_player_series',
};

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const isPlayerMode = (value: unknown): value is PlayerMode =>
  value === 'auto' || value === 'native' || value === 'hls';

export const sanitizePlayerModeByType = (value?: Partial<PlayerModeByType>): PlayerModeByType => ({
  live: isPlayerMode(value?.live) ? value.live : DEFAULT_PLAYER_MODE_BY_TYPE.live,
  movies: isPlayerMode(value?.movies) ? value.movies : DEFAULT_PLAYER_MODE_BY_TYPE.movies,
  series: isPlayerMode(value?.series) ? value.series : DEFAULT_PLAYER_MODE_BY_TYPE.series,
});

export const getStoredPlayerModes = (fallback?: Partial<PlayerModeByType>): PlayerModeByType => {
  const safeFallback = sanitizePlayerModeByType(fallback);
  if (!canUseStorage()) return safeFallback;

  return playerContentTypes.reduce<PlayerModeByType>((modes, type) => {
    const storedMode = window.localStorage.getItem(PLAYER_STORAGE_KEYS[type]);

    return {
      ...modes,
      [type]: isPlayerMode(storedMode) ? storedMode : safeFallback[type],
    };
  }, safeFallback);
};

export const saveStoredPlayerModes = (modes: PlayerModeByType) => {
  if (!canUseStorage()) return;

  const safeModes = sanitizePlayerModeByType(modes);
  playerContentTypes.forEach((type) => {
    window.localStorage.setItem(PLAYER_STORAGE_KEYS[type], safeModes[type]);
  });
};
