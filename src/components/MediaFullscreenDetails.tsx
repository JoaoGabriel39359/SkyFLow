'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Film, Heart, Play, Star, Tv, X } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { useMediaDetails } from '@/hooks/useMediaDetails';
import type { XtreamCredentials } from '@/lib/epg';
import type { AppLanguage } from '@/lib/i18n';
import type { MediaDetailsSeed } from '@/lib/mediaDetails';
import type { ChannelListViewChannel } from './ChannelListView';
import styles from './MediaFullscreenDetails.module.css';

type MediaFullscreenType = 'movies' | 'series';

type MediaFullscreenDetailsProps = {
  item: ChannelListViewChannel;
  type: MediaFullscreenType;
  credentials: XtreamCredentials | null;
  favorite: boolean;
  language: AppLanguage;
  onClose: () => void;
  onPlay: () => void;
  onOpenSeries: () => void;
  onFavoriteToggle: () => void;
};

type Labels = {
  back: string;
  watch: string;
  openSeries: string;
  trailer: string;
  favorite: string;
  removeFavorite: string;
  synopsis: string;
  synopsisUnavailable: string;
  genre: string;
  year: string;
  cast: string;
  director: string;
  trailerTitle: string;
  close: string;
};

const labelsByLanguage: Record<AppLanguage, Labels> = {
  pt: {
    back: 'Voltar',
    watch: 'Assistir',
    openSeries: 'Temporadas',
    trailer: 'Trailer',
    favorite: 'Favoritar',
    removeFavorite: 'Favorito',
    synopsis: 'Sinopse',
    synopsisUnavailable: 'Sinopse indisponivel.',
    genre: 'Genero',
    year: 'Ano',
    cast: 'Elenco',
    director: 'Direcao',
    trailerTitle: 'Trailer',
    close: 'Fechar',
  },
  en: {
    back: 'Back',
    watch: 'Watch',
    openSeries: 'Seasons',
    trailer: 'Trailer',
    favorite: 'Favorite',
    removeFavorite: 'Favorite',
    synopsis: 'Synopsis',
    synopsisUnavailable: 'Synopsis unavailable.',
    genre: 'Genre',
    year: 'Year',
    cast: 'Cast',
    director: 'Director',
    trailerTitle: 'Trailer',
    close: 'Close',
  },
  es: {
    back: 'Volver',
    watch: 'Ver',
    openSeries: 'Temporadas',
    trailer: 'Trailer',
    favorite: 'Favorito',
    removeFavorite: 'Favorito',
    synopsis: 'Sinopsis',
    synopsisUnavailable: 'Sinopsis no disponible.',
    genre: 'Genero',
    year: 'Ano',
    cast: 'Elenco',
    director: 'Direccion',
    trailerTitle: 'Trailer',
    close: 'Cerrar',
  },
};

function ActionButton({
  focusKey,
  children,
  onPress,
  variant = 'secondary',
  upTarget,
  downTarget,
}: {
  focusKey: string;
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  upTarget?: string;
  downTarget?: string;
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onArrowPress: (direction) => {
      if (direction === 'up' && upTarget) {
        setFocus(upTarget);
        return false;
      }

      if (direction === 'down' && downTarget) {
        setFocus(downTarget);
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.actionButton} ${styles[variant]} ${focused ? styles.focused : ''}`}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function getYear(...values: Array<string | undefined>) {
  for (const value of values) {
    const match = value?.match(/\b(19|20)\d{2}\b/);
    if (match) return match[0];
  }

  return '';
}

function TrailerOverlay({
  url,
  title,
  labels,
  onClose,
}: {
  url: string;
  title: string;
  labels: Labels;
  onClose: () => void;
}) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'media-fullscreen-trailer-modal',
    trackChildren: true,
    preferredChildFocusKey: 'media-fullscreen-trailer-close',
  });
  const { ref: closeRef, focused } = useFocusable({
    focusKey: 'media-fullscreen-trailer-close',
    onEnterPress: onClose,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setFocus('media-fullscreen-trailer-close'), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div className={styles.trailerOverlay} role="presentation">
        <section className={styles.trailerModal} ref={ref} aria-label={`${labels.trailerTitle}: ${title}`}>
          <div className={styles.trailerHeader}>
            <span>{labels.trailerTitle}</span>
            <strong>{title}</strong>
            <button
              ref={closeRef}
              type="button"
              className={`${styles.trailerClose} ${focused ? styles.focused : ''}`}
              onClick={onClose}
              aria-label={labels.close}
            >
              <X size={24} />
            </button>
          </div>
          <iframe
            className={styles.trailerFrame}
            src={url}
            title={`${labels.trailerTitle}: ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </section>
      </div>
    </FocusContext.Provider>
  );
}

export default function MediaFullscreenDetails({
  item,
  type,
  credentials,
  favorite,
  language,
  onClose,
  onPlay,
  onOpenSeries,
  onFavoriteToggle,
}: MediaFullscreenDetailsProps) {
  const labels = labelsByLanguage[language];
  const [failedBackdrop, setFailedBackdrop] = useState('');
  const [failedPoster, setFailedPoster] = useState('');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { ref, focusKey } = useFocusable({
    focusKey: 'media-fullscreen-details',
    trackChildren: true,
    preferredChildFocusKey: 'media-fullscreen-primary',
  });
  const seed: MediaDetailsSeed = useMemo(() => ({
    id: item.id,
    title: item.name,
    synopsis: item.synopsis,
    rating: item.rating,
    genre: item.genre,
    releaseDate: item.releaseDate,
    backdrop: item.backdrop,
    cast: item.cast,
    director: item.director,
    trailerUrl: item.trailerUrl,
  }), [item]);
  const { details, isLoading } = useMediaDetails({
    credentials,
    mediaType: type,
    streamId: item.id,
    seed,
    enabled: Boolean(credentials && item.id),
  });
  const title = details?.title || item.name;
  const poster = item.logo || details?.backdrop || item.backdrop || '';
  const backdrop = details?.backdrop || item.backdrop || item.logo || '';
  const synopsis = details?.synopsis || item.synopsis || labels.synopsisUnavailable;
  const year = getYear(details?.releaseDate, item.releaseDate);
  const genre = details?.genre || item.genre || '';
  const rating = details?.rating || item.rating || '';
  const cast = details?.cast || item.cast || '';
  const director = details?.director || item.director || '';
  const trailerUrl = details?.trailerUrl || item.trailerUrl || '';
  const canShowBackdrop = Boolean(backdrop) && failedBackdrop !== backdrop;
  const canShowPoster = Boolean(poster) && failedPoster !== poster;
  const metaLine = [year, genre].filter(Boolean).join(' • ');
  const primaryLabel = type === 'movies' ? labels.watch : labels.openSeries;
  const primaryAction = type === 'movies' ? onPlay : onOpenSeries;

  useEffect(() => {
    const timeout = window.setTimeout(() => setFocus('media-fullscreen-primary'), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (trailerOpen) return;

      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, trailerOpen]);

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref} aria-label={title}>
        {canShowBackdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.backdrop}
            src={backdrop}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setFailedBackdrop(backdrop)}
          />
        )}
        <div className={styles.backdropShade} />

        <div className={styles.topBar}>
          <ActionButton focusKey="media-fullscreen-back" variant="ghost" onPress={onClose} downTarget="media-fullscreen-primary">
            <ArrowLeft size={24} />
            {labels.back}
          </ActionButton>
        </div>

        <div className={styles.content}>
          <div className={styles.info}>
            <span className={styles.badge}>{type === 'movies' ? 'Filme' : 'Serie'}</span>
            <h1>
              {title}
              {favorite && <Star className={styles.titleStar} size={28} fill="currentColor" />}
            </h1>
            {metaLine && <p className={styles.meta}>{metaLine}</p>}
            <p className={styles.synopsis}>{isLoading && !details ? labels.synopsisUnavailable : synopsis}</p>

            <div className={styles.actions}>
              <ActionButton focusKey="media-fullscreen-primary" variant="primary" onPress={primaryAction} upTarget="media-fullscreen-back">
                <Play size={22} fill="currentColor" />
                {primaryLabel}
              </ActionButton>

              {trailerUrl && (
                <ActionButton
                  focusKey="media-fullscreen-trailer"
                  variant="secondary"
                  onPress={() => setTrailerOpen(true)}
                  upTarget="media-fullscreen-back"
                >
                  <Film size={22} />
                  {labels.trailer}
                </ActionButton>
              )}

              <ActionButton
                focusKey="media-fullscreen-favorite"
                variant="secondary"
                onPress={onFavoriteToggle}
                upTarget="media-fullscreen-back"
              >
                <Heart size={22} fill={favorite ? 'currentColor' : 'none'} />
                {favorite ? labels.removeFavorite : labels.favorite}
              </ActionButton>
            </div>
          </div>

          <div className={styles.posterWrap}>
            {canShowPoster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.poster}
                src={poster}
                alt=""
                loading="eager"
                decoding="async"
                onError={() => setFailedPoster(poster)}
              />
            ) : (
              <div className={styles.posterFallback}>
                <Tv size={54} />
                <strong>Nuvix</strong>
              </div>
            )}
            {rating && (
              <span className={styles.rating}>
                <Star size={18} fill="currentColor" />
                {rating}
              </span>
            )}
          </div>
        </div>

        <div className={styles.detailsGrid}>
          {[
            [labels.genre, genre],
            [labels.year, year],
            [labels.cast, cast],
            [labels.director, director],
          ].filter(([, value]) => value).map(([label, value]) => (
            <div className={styles.detailCard} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        {trailerOpen && trailerUrl && (
          <TrailerOverlay
            url={trailerUrl}
            title={title}
            labels={labels}
            onClose={() => {
              setTrailerOpen(false);
              window.setTimeout(() => setFocus('media-fullscreen-trailer'), 0);
            }}
          />
        )}
      </section>
    </FocusContext.Provider>
  );
}
