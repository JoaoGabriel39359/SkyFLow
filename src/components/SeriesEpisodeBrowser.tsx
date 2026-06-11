'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import type { XtreamCredentials } from '@/lib/epg';
import type { AppLanguage } from '@/lib/i18n';
import { getSeriesSeasons, type SeriesEpisode, type SeriesSeason } from '@/lib/series';
import type { ChannelListViewChannel } from './ChannelListView';
import styles from './SeriesEpisodeBrowser.module.css';

type Labels = {
  back: string;
  seasons: string;
  episodes: string;
  watch: string;
  loading: string;
  empty: string;
  selectedSeries: string;
};

const labelsByLanguage: Record<AppLanguage, Labels> = {
  pt: {
    back: 'Voltar',
    seasons: 'Temporadas',
    episodes: 'Episodios',
    watch: 'Assistir',
    loading: 'Carregando episodios...',
    empty: 'Temporadas indisponiveis para esta serie.',
    selectedSeries: 'Serie selecionada',
  },
  en: {
    back: 'Back',
    seasons: 'Seasons',
    episodes: 'Episodes',
    watch: 'Watch',
    loading: 'Loading episodes...',
    empty: 'Seasons unavailable for this series.',
    selectedSeries: 'Selected series',
  },
  es: {
    back: 'Volver',
    seasons: 'Temporadas',
    episodes: 'Episodios',
    watch: 'Ver',
    loading: 'Cargando episodios...',
    empty: 'Temporadas no disponibles para esta serie.',
    selectedSeries: 'Serie seleccionada',
  },
};

export const getSeriesSeasonFocusKey = (seasonNumber: string | number) =>
  `series-season-${String(seasonNumber).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

export const getSeriesEpisodeFocusKey = (episodeId: string | number) =>
  `series-episode-${String(episodeId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'series-browser-back',
    onEnterPress: onPress,
    onArrowPress: (direction) => {
      if (direction === 'down') {
        setFocus('series-browser-first-season');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.backButton} ${focused ? styles.focused : ''}`}
      onClick={onPress}
    >
      <ArrowLeft size={24} />
      {label}
    </button>
  );
}

function SeasonButton({
  season,
  active,
  onSelect,
}: {
  season: SeriesSeason;
  active: boolean;
  onSelect: () => void;
}) {
  const focusKey = getSeriesSeasonFocusKey(season.number);
  const { ref, focused } = useFocusable({
    focusKey: active ? 'series-browser-first-season' : focusKey,
    onEnterPress: onSelect,
    onFocus: onSelect,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus('series-browser-back');
        return false;
      }

      if (direction === 'down') {
        const firstEpisode = season.episodes[0];
        setFocus(firstEpisode ? getSeriesEpisodeFocusKey(firstEpisode.id) : 'series-browser-back');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.seasonButton} ${active ? styles.active : ''} ${focused ? styles.focused : ''}`}
      onClick={onSelect}
    >
      {season.name}
    </button>
  );
}

function EpisodeButton({
  episode,
  isFirst,
  onPlay,
}: {
  episode: SeriesEpisode;
  isFirst: boolean;
  onPlay: (episode: SeriesEpisode, focusKey: string) => void;
}) {
  const focusKey = getSeriesEpisodeFocusKey(episode.id);
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onPlay(episode, focusKey),
    onFocus: () => {
      ref.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    },
    onArrowPress: (direction) => {
      if (direction === 'up' && isFirst) {
        setFocus('series-browser-first-season');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.episodeButton} ${focused ? styles.focused : ''}`}
      onClick={() => onPlay(episode, focusKey)}
    >
      <span className={styles.episodeNumber}>E{episode.episodeNumber}</span>
      <span className={styles.episodeInfo}>
        <strong>{episode.title}</strong>
        {episode.duration && <span>{episode.duration}</span>}
        {episode.description && <small>{episode.description}</small>}
      </span>
      <span className={styles.playButton}>
        <Play size={16} fill="currentColor" />
        OK
      </span>
    </button>
  );
}

type SeriesEpisodeBrowserProps = {
  series: ChannelListViewChannel;
  credentials: XtreamCredentials | null;
  language: AppLanguage;
  onBack: () => void;
  onPlayEpisode: (
    episode: ChannelListViewChannel,
    episodeChannels: ChannelListViewChannel[],
    focusKey: string
  ) => void;
};

export default function SeriesEpisodeBrowser({
  series,
  credentials,
  language,
  onBack,
  onPlayEpisode,
}: SeriesEpisodeBrowserProps) {
  const labels = labelsByLanguage[language];
  const [seasons, setSeasons] = useState<SeriesSeason[]>([]);
  const [activeSeasonIndex, setActiveSeasonIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const { ref, focusKey } = useFocusable({
    focusKey: 'series-browser',
    trackChildren: true,
    preferredChildFocusKey: 'series-browser-first-season',
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
  });

  const activeSeason = seasons[activeSeasonIndex] ?? null;

  const episodeChannels = useMemo(() => (
    activeSeason?.episodes.map((episode) => ({
      id: episode.id,
      name: `${series.name} - T${episode.seasonNumber} E${episode.episodeNumber} - ${episode.title}`,
      logo: episode.thumbnail || series.logo,
      url: episode.url,
      extension: episode.extension,
      categoryId: series.categoryId,
      synopsis: episode.description || series.synopsis,
      rating: series.rating,
      genre: series.genre,
      releaseDate: series.releaseDate,
      backdrop: series.backdrop,
      cast: series.cast,
      director: series.director,
      trailerUrl: series.trailerUrl,
    })) ?? []
  ), [activeSeason, series]);

  const handlePlayEpisode = useCallback((episode: SeriesEpisode, episodeFocusKey: string) => {
    const selectedEpisode = episodeChannels.find((channel) => channel.id === episode.id);
    if (!selectedEpisode) return;

    onPlayEpisode(selectedEpisode, episodeChannels, episodeFocusKey);
  }, [episodeChannels, onPlayEpisode]);

  useEffect(() => {
    if (!credentials || !series.id) {
      const timeout = window.setTimeout(() => {
        setSeasons([]);
        setActiveSeasonIndex(0);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    const controller = new AbortController();
    let cancelled = false;
    const loadingTimeout = window.setTimeout(() => {
      if (cancelled) return;

      setIsLoading(true);
      setActiveSeasonIndex(0);
    }, 0);

    getSeriesSeasons(credentials, series.id, controller.signal)
      .then((nextSeasons) => {
        if (cancelled) return;

        setSeasons(nextSeasons);
        window.setTimeout(() => {
          if (cancelled) return;

          setFocus(nextSeasons.length > 0 ? 'series-browser-first-season' : 'series-browser-back');
        }, 0);
      })
      .finally(() => {
        if (!cancelled && !controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimeout);
      controller.abort();
    };
  }, [credentials, series.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} className={styles.screen} aria-label={`${labels.seasons}: ${series.name}`}>
        <header className={styles.header}>
          <BackButton label={labels.back} onPress={onBack} />
          <div className={styles.titleBlock}>
            <span>{labels.selectedSeries}</span>
            <h1>{series.name}</h1>
          </div>
        </header>

        <div className={styles.layout}>
          <aside className={styles.seriesCard}>
            <div className={styles.posterWrap}>
              {series.logo && !posterFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={series.logo}
                  alt=""
                  loading="eager"
                  decoding="async"
                  onError={() => setPosterFailed(true)}
                />
              ) : (
                <div className={styles.posterFallback}>N</div>
              )}
            </div>
            <div className={styles.seriesInfo}>
              <h2>{series.name}</h2>
              {series.synopsis && <p>{series.synopsis}</p>}
            </div>
          </aside>

          <div className={styles.content}>
            <nav className={styles.seasonRail} aria-label={labels.seasons}>
              {seasons.map((season, index) => (
                <SeasonButton
                  key={season.id}
                  season={season}
                  active={index === activeSeasonIndex}
                  onSelect={() => setActiveSeasonIndex(index)}
                />
              ))}
            </nav>

            <section className={styles.episodesPanel}>
              <div className={styles.episodesHeader}>
                <span>{labels.episodes}</span>
                <strong>{activeSeason ? `${activeSeason.name} - ${activeSeason.episodes.length}` : ''}</strong>
              </div>

              {isLoading ? (
                <div className={styles.loadingState}>{labels.loading}</div>
              ) : !activeSeason ? (
                <div className={styles.emptyState}>{labels.empty}</div>
              ) : (
                <div className={styles.episodeList}>
                  {activeSeason.episodes.map((episode, index) => (
                    <EpisodeButton
                      key={episode.id}
                      episode={episode}
                      isFirst={index === 0}
                      onPlay={handlePlayEpisode}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  );
}
