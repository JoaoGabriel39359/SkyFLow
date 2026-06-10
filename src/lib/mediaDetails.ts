import type { XtreamCredentials } from './epg';

export type MediaDetailsType = 'movies' | 'series';

export type MediaDetailsSeed = {
  id?: string | number;
  title?: string;
  synopsis?: string;
  rating?: string;
  genre?: string;
  releaseDate?: string;
  backdrop?: string;
  cast?: string;
  director?: string;
  trailerUrl?: string;
};

export type MediaDetails = {
  id: string;
  title: string;
  synopsis: string;
  rating: string;
  genre: string;
  releaseDate: string;
  backdrop: string;
  cast: string;
  director: string;
  trailerUrl: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const asText = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }

  return '';
};

const normalizeRating = (value: unknown) => {
  const rawRating = asText(value).replace('/10', '').trim();
  if (!rawRating) return '';

  const numericRating = Number(rawRating.replace(',', '.'));
  if (!Number.isFinite(numericRating)) return rawRating;

  return numericRating % 1 === 0 ? String(numericRating) : numericRating.toFixed(1);
};

const normalizeReleaseDate = (...values: unknown[]) => {
  const rawDate = firstText(...values);
  if (!rawDate) return '';

  const yearMatch = rawDate.match(/\b(19|20)\d{2}\b/);
  return yearMatch?.[0] ?? rawDate;
};

const normalizeBackdrop = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const backdrop = firstText(...value);
      if (backdrop) return backdrop;
      continue;
    }

    const backdrop = firstText(value);
    if (backdrop) return backdrop;
  }

  return '';
};

export const normalizeTrailerUrl = (...values: unknown[]) => {
  const rawTrailer = firstText(...values);
  if (!rawTrailer) return '';

  const trailer = rawTrailer.trim();
  const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  const toEmbedUrl = (id: string) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

  if (youtubeIdPattern.test(trailer)) {
    return toEmbedUrl(trailer);
  }

  try {
    const trailerUrl = new URL(trailer);
    const host = trailerUrl.hostname.toLowerCase();

    if (host.includes('youtu.be')) {
      const videoId = trailerUrl.pathname.split('/').filter(Boolean)[0];
      return videoId && youtubeIdPattern.test(videoId) ? toEmbedUrl(videoId) : '';
    }

    if (host.includes('youtube.com')) {
      const pathParts = trailerUrl.pathname.split('/').filter(Boolean);
      const embeddedId = ['embed', 'shorts'].includes(pathParts[0]) ? pathParts[1] : '';
      const videoId = trailerUrl.searchParams.get('v') || embeddedId;
      return videoId && youtubeIdPattern.test(videoId) ? toEmbedUrl(videoId) : '';
    }

    return trailer;
  } catch {
    return '';
  }
};

const normalizeDetails = (
  payload: unknown,
  type: MediaDetailsType,
  streamId: string | number,
  seed?: MediaDetailsSeed | null
): MediaDetails => {
  const root = readRecord(payload);
  const info = readRecord(root.info);
  const movieData = readRecord(root.movie_data);
  const seriesData = readRecord(root.series_data);
  const primary = type === 'movies' ? movieData : seriesData;

  return {
    id: String(seed?.id ?? streamId),
    title: firstText(info.name, info.title, primary.name, primary.title, root.name, root.title, seed?.title),
    synopsis: firstText(info.plot, info.description, info.desc, info.overview, primary.plot, primary.description, seed?.synopsis),
    rating: normalizeRating(firstText(info.rating, info.imdb_rating, info.imdb, info.tmdb_rating, info.rating_5based, primary.rating, seed?.rating)),
    genre: firstText(info.genre, primary.genre, seed?.genre),
    releaseDate: normalizeReleaseDate(info.releasedate, info.release_date, info.releaseDate, info.year, primary.releasedate, primary.year, seed?.releaseDate),
    backdrop: normalizeBackdrop(info.backdrop_path, info.backdrop, info.movie_image, info.cover_big, primary.backdrop_path, seed?.backdrop),
    cast: firstText(info.cast, info.actors, primary.cast, seed?.cast),
    director: firstText(info.director, primary.director, seed?.director),
    trailerUrl: normalizeTrailerUrl(
      info.youtube_trailer,
      info.trailer,
      info.youtube,
      info.youtube_id,
      info.youtubeId,
      info.video_trailer,
      primary.youtube_trailer,
      primary.trailer,
      primary.youtube,
      primary.youtube_id,
      root.youtube_trailer,
      root.trailer,
      seed?.trailerUrl
    ),
  };
};

const hasUsefulDetails = (details: MediaDetails) => (
  Boolean(details.synopsis || details.rating || details.genre || details.releaseDate || details.cast || details.director || details.trailerUrl)
);

export async function getMediaDetails(
  credentials: XtreamCredentials,
  mediaType: MediaDetailsType,
  streamId: string | number,
  seed?: MediaDetailsSeed | null,
  signal?: AbortSignal
) {
  const action = mediaType === 'movies' ? 'get_vod_info' : 'get_series_info';
  const idParam = mediaType === 'movies' ? 'vod_id' : 'series_id';
  const query = new URLSearchParams({
    url: credentials.url,
    username: credentials.user,
    password: credentials.pass,
    action,
    [idParam]: String(streamId),
  });

  try {
    const response = await fetch(`/api/xtream?${query.toString()}`, { signal });
    if (!response.ok) {
      const fallbackDetails = normalizeDetails({}, mediaType, streamId, seed);
      return hasUsefulDetails(fallbackDetails) ? fallbackDetails : null;
    }

    const payload = await response.json();
    const details = normalizeDetails(payload, mediaType, streamId, seed);
    return hasUsefulDetails(details) ? details : null;
  } catch {
    if (signal?.aborted) throw new DOMException('Media details request aborted', 'AbortError');

    const fallbackDetails = normalizeDetails({}, mediaType, streamId, seed);
    return hasUsefulDetails(fallbackDetails) ? fallbackDetails : null;
  }
}
