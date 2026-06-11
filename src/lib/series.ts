import type { XtreamCredentials } from './epg';
import { buildStreamUrl } from './iptvEngine';

type UnknownRecord = Record<string, unknown>;

export type SeriesEpisode = {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  description: string;
  duration: string;
  thumbnail: string;
  extension: string;
  url: string;
};

export type SeriesSeason = {
  id: string;
  number: number;
  name: string;
  episodes: SeriesEpisode[];
};

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

const toPositiveNumber = (value: unknown, fallback: number) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
};

const formatDuration = (value: unknown) => {
  const rawDuration = asText(value);
  if (!rawDuration) return '';

  if (rawDuration.includes(':')) {
    return rawDuration;
  }

  const seconds = Number(rawDuration);
  if (!Number.isFinite(seconds) || seconds <= 0) return rawDuration;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${remainingMinutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const normalizeEpisode = (
  episode: unknown,
  credentials: XtreamCredentials,
  seasonNumber: number,
  fallbackEpisodeNumber: number
): SeriesEpisode | null => {
  const episodeRecord = readRecord(episode);
  const info = readRecord(episodeRecord.info);
  const id = firstText(
    episodeRecord.id,
    episodeRecord.episode_id,
    episodeRecord.stream_id,
    episodeRecord.series_id
  );

  if (!id) return null;

  const episodeNumber = toPositiveNumber(
    episodeRecord.episode_num || episodeRecord.episode_number || episodeRecord.episode,
    fallbackEpisodeNumber
  );
  const extension = firstText(episodeRecord.container_extension, info.container_extension) || 'mp4';
  const directUrl = firstText(episodeRecord.direct_source, episodeRecord.url, info.direct_source, info.url);

  return {
    id,
    title: firstText(
      episodeRecord.title,
      episodeRecord.name,
      info.name,
      info.title,
      `Episodio ${episodeNumber}`
    ),
    seasonNumber,
    episodeNumber,
    description: firstText(info.plot, info.description, info.desc, info.overview, episodeRecord.plot, episodeRecord.description),
    duration: formatDuration(firstText(info.duration, episodeRecord.duration)),
    thumbnail: firstText(info.movie_image, info.cover_big, info.cover, episodeRecord.movie_image, episodeRecord.cover),
    extension,
    url: directUrl.startsWith('http')
      ? directUrl
      : buildStreamUrl(credentials.url, credentials.user, credentials.pass, 'series', id, extension),
  };
};

const sortSeasons = (seasons: SeriesSeason[]) => (
  [...seasons].sort((firstSeason, secondSeason) => firstSeason.number - secondSeason.number)
);

export async function getSeriesSeasons(
  credentials: XtreamCredentials,
  seriesId: string | number,
  signal?: AbortSignal
): Promise<SeriesSeason[]> {
  const query = new URLSearchParams({
    url: credentials.url,
    username: credentials.user,
    password: credentials.pass,
    action: 'get_series_info',
    series_id: String(seriesId),
  });

  try {
    const response = await fetch(`/api/xtream?${query.toString()}`, { signal });
    if (!response.ok) {
      console.warn(`Series request failed with status ${response.status}`);
      return [];
    }

    const payload = readRecord(await response.json());
    const episodesPayload = payload.episodes;
    const seasonInfoByNumber = new Map<number, UnknownRecord>();

    if (Array.isArray(payload.seasons)) {
      payload.seasons.forEach((season) => {
        const seasonRecord = readRecord(season);
        const seasonNumber = toPositiveNumber(
          seasonRecord.season_number || seasonRecord.season || seasonRecord.number,
          seasonInfoByNumber.size + 1
        );
        seasonInfoByNumber.set(seasonNumber, seasonRecord);
      });
    }

    if (Array.isArray(episodesPayload)) {
      const seasonNumber = 1;
      const episodes = episodesPayload
        .map((episode, index) => normalizeEpisode(episode, credentials, seasonNumber, index + 1))
        .filter((episode): episode is SeriesEpisode => Boolean(episode));

      return episodes.length > 0
        ? [{ id: 'season-1', number: 1, name: 'Temporada 1', episodes }]
        : [];
    }

    if (!isRecord(episodesPayload)) return [];

    const seasons = Object.entries(episodesPayload).map(([seasonKey, seasonEpisodes]) => {
      const seasonNumber = toPositiveNumber(seasonKey, 1);
      const seasonInfo = seasonInfoByNumber.get(seasonNumber) || {};
      const episodes = Array.isArray(seasonEpisodes)
        ? seasonEpisodes
          .map((episode, index) => normalizeEpisode(episode, credentials, seasonNumber, index + 1))
          .filter((episode): episode is SeriesEpisode => Boolean(episode))
        : [];

      return {
        id: `season-${seasonNumber}`,
        number: seasonNumber,
        name: firstText(seasonInfo.name, seasonInfo.title, `Temporada ${seasonNumber}`),
        episodes,
      };
    }).filter((season) => season.episodes.length > 0);

    return sortSeasons(seasons);
  } catch (error) {
    if (signal?.aborted) return [];

    console.warn('Erro ao carregar episodios da serie:', error);
    return [];
  }
}
