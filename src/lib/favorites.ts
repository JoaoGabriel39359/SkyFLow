export type FavoriteType = 'live' | 'movies' | 'series';

export type FavoriteItem = {
  id: string;
  name: string;
  logo?: string;
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
  type: FavoriteType;
};

type FavoriteInput = {
  id: string | number;
  name: string;
  logo?: string;
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

const FAVORITE_KEYS: Record<FavoriteType, string> = {
  live: 'nuvix_favorites_live',
  movies: 'nuvix_favorites_movies',
  series: 'nuvix_favorites_series',
};

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const normalizeFavorite = (type: FavoriteType, item: FavoriteInput): FavoriteItem => ({
  id: String(item.id),
  name: item.name,
  logo: item.logo,
  url: item.url,
  extension: item.extension,
  categoryId: item.categoryId,
  synopsis: item.synopsis,
  rating: item.rating,
  genre: item.genre,
  releaseDate: item.releaseDate,
  backdrop: item.backdrop,
  cast: item.cast,
  director: item.director,
  trailerUrl: item.trailerUrl,
  type,
});

export function getFavorites(type: FavoriteType): FavoriteItem[] {
  if (!canUseStorage()) return [];

  try {
    const rawValue = window.localStorage.getItem(FAVORITE_KEYS[type]);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .filter((item): item is FavoriteItem => Boolean(item?.id && item?.name))
      .map((item) => normalizeFavorite(type, item));
  } catch {
    return [];
  }
}

export function getFavoriteIds(type: FavoriteType): string[] {
  return getFavorites(type).map((item) => item.id);
}

export function isFavorite(type: FavoriteType, id: string | number): boolean {
  const itemId = String(id);
  return getFavorites(type).some((item) => item.id === itemId);
}

export function toggleFavorite(type: FavoriteType, item: FavoriteInput) {
  if (!canUseStorage()) {
    return { isFavorite: false, favorites: [] as FavoriteItem[] };
  }

  const normalizedItem = normalizeFavorite(type, item);
  const currentFavorites = getFavorites(type);
  const alreadyFavorite = currentFavorites.some((favorite) => favorite.id === normalizedItem.id);
  const nextFavorites = alreadyFavorite
    ? currentFavorites.filter((favorite) => favorite.id !== normalizedItem.id)
    : [...currentFavorites, normalizedItem];

  window.localStorage.setItem(FAVORITE_KEYS[type], JSON.stringify(nextFavorites));

  return {
    isFavorite: !alreadyFavorite,
    favorites: nextFavorites,
  };
}
