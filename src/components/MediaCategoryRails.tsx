'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Film, PlayCircle, Search, Star } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import type { AppLanguage } from '@/lib/i18n';
import { createIndexedSearchMatcher, createSearchIndex, hasSearchQuery } from '@/lib/search';
import type { ChannelListViewChannel } from './ChannelListView';
import styles from './MediaCategoryRails.module.css';

export type MediaCategoryRailsSection = 'movies' | 'series';

export type MediaCategoryRailData = {
  id: string;
  title: string;
  items: ChannelListViewChannel[];
  kind?: 'favorites' | 'category' | 'search';
};

type MediaCategoryRailsProps = {
  section: MediaCategoryRailsSection;
  language: AppLanguage;
  rails: MediaCategoryRailData[];
  searchItems: ChannelListViewChannel[];
  isLoading: boolean;
  isSearchCatalogLoading: boolean;
  onBack: () => void;
  onOpenSearch: () => void;
  onOpenItem: (section: MediaCategoryRailsSection, item: ChannelListViewChannel, focusKey: string) => void;
};

type Copy = {
  back: string;
  search: string;
  moviesTitle: string;
  seriesTitle: string;
  moviesSubtitle: string;
  seriesSubtitle: string;
  loading: string;
  empty: string;
  searchMovies: string;
  searchSeries: string;
  searchAllMovies: string;
  searchAllSeries: string;
  results: string;
  noResults: string;
  favorite: string;
};

const copyByLanguage: Record<AppLanguage, Copy> = {
  pt: {
    back: 'Voltar',
    search: 'Buscar',
    moviesTitle: 'Explorar Filmes',
    seriesTitle: 'Explorar Series',
    moviesSubtitle: 'Filmes organizados por categoria, com capas grandes e navegacao por TV.',
    seriesSubtitle: 'Series por categoria, com temporadas abertas somente ao selecionar.',
    loading: 'Carregando categorias...',
    empty: 'Nenhum conteudo disponivel agora.',
    searchMovies: 'Buscar filmes',
    searchSeries: 'Buscar series',
    searchAllMovies: 'Buscar em todos os filmes',
    searchAllSeries: 'Buscar em todas as series',
    results: 'Resultado da busca',
    noResults: 'Nenhum resultado encontrado.',
    favorite: 'Favorito',
  },
  en: {
    back: 'Back',
    search: 'Search',
    moviesTitle: 'Explore Movies',
    seriesTitle: 'Explore Series',
    moviesSubtitle: 'Movies organized by category, with TV-friendly poster rows.',
    seriesSubtitle: 'Series by category, with seasons loaded only after selection.',
    loading: 'Loading categories...',
    empty: 'No content available right now.',
    searchMovies: 'Search movies',
    searchSeries: 'Search series',
    searchAllMovies: 'Search all movies',
    searchAllSeries: 'Search all series',
    results: 'Search results',
    noResults: 'No results found.',
    favorite: 'Favorite',
  },
  es: {
    back: 'Volver',
    search: 'Buscar',
    moviesTitle: 'Explorar Peliculas',
    seriesTitle: 'Explorar Series',
    moviesSubtitle: 'Peliculas organizadas por categoria, con filas pensadas para TV.',
    seriesSubtitle: 'Series por categoria, con temporadas cargadas solo al seleccionar.',
    loading: 'Cargando categorias...',
    empty: 'No hay contenido disponible ahora.',
    searchMovies: 'Buscar peliculas',
    searchSeries: 'Buscar series',
    searchAllMovies: 'Buscar en todas las peliculas',
    searchAllSeries: 'Buscar en todas las series',
    results: 'Resultados de busqueda',
    noResults: 'No se encontraron resultados.',
    favorite: 'Favorito',
  },
};

const RAIL_BATCH_SIZE = 12;
const SEARCH_BATCH_SIZE = 24;

const sanitizeFocusPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

export const getMediaRailFocusKey = (
  section: MediaCategoryRailsSection,
  railId: string,
  index: number
) => `media-rails-${section}-${sanitizeFocusPart(railId)}-${index}`;

const getBackFocusKey = (section: MediaCategoryRailsSection) => `media-rails-${section}-back`;
const getSearchFocusKey = (section: MediaCategoryRailsSection) => `media-rails-${section}-search`;

function useFocusScroll<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);

  const scrollIntoView = () => {
    window.requestAnimationFrame(() => {
      elementRef.current?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    });
  };

  return { elementRef, scrollIntoView };
}

function getItemImage(item: ChannelListViewChannel) {
  return item.logo || item.backdrop || '';
}

function PosterFallback({ item, section }: { item: ChannelListViewChannel; section: MediaCategoryRailsSection }) {
  const Icon = section === 'movies' ? Film : PlayCircle;

  return (
    <span className={styles.posterFallback}>
      <Icon size={38} />
      <small>{item.name.slice(0, 2).toUpperCase()}</small>
    </span>
  );
}

function HeaderButton({
  focusKey,
  className,
  children,
  onPress,
  onArrowPress,
  label,
}: {
  focusKey: string;
  className: string;
  children: React.ReactNode;
  onPress: () => void;
  onArrowPress?: (direction: string) => boolean;
  label: string;
}) {
  const { elementRef, scrollIntoView } = useFocusScroll<HTMLButtonElement>();
  const scrollHeaderIntoView = () => {
    scrollIntoView();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  };
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onFocus: scrollHeaderIntoView,
    onArrowPress,
  });

  return (
    <button
      ref={(node) => {
        ref.current = node;
        elementRef.current = node;
      }}
      type="button"
      className={`${className} ${focused ? styles.focused : ''}`}
      onClick={onPress}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function MediaPosterCard({
  section,
  rail,
  item,
  index,
  railIndex,
  visibleItemsCount,
  rails,
  visibleCounts,
  hasMoreItems,
  onReachRailEnd,
  onOpenItem,
}: {
  section: MediaCategoryRailsSection;
  rail: MediaCategoryRailData;
  item: ChannelListViewChannel;
  index: number;
  railIndex: number;
  visibleItemsCount: number;
  rails: MediaCategoryRailData[];
  visibleCounts: Record<string, number>;
  hasMoreItems: boolean;
  onReachRailEnd: (railId: string) => void;
  onOpenItem: (section: MediaCategoryRailsSection, item: ChannelListViewChannel, focusKey: string) => void;
}) {
  const [failedImage, setFailedImage] = useState('');
  const [loadedImage, setLoadedImage] = useState('');
  const { elementRef, scrollIntoView } = useFocusScroll<HTMLButtonElement>();
  const focusKey = getMediaRailFocusKey(section, rail.id, index);
  const image = getItemImage(item);
  const canLoadImage = Boolean(image) && failedImage !== image;
  const isImageReady = canLoadImage && loadedImage === image;
  const previousRail = [...rails].slice(0, railIndex).reverse().find((candidate) => candidate.items.length > 0);
  const nextRail = rails.slice(railIndex + 1).find((candidate) => candidate.items.length > 0);

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onOpenItem(section, item, focusKey),
    onFocus: () => {
      scrollIntoView();
      if (index >= visibleItemsCount - 2 && hasMoreItems) {
        onReachRailEnd(rail.id);
      }
    },
    onArrowPress: (direction) => {
      if (direction === 'left' && index === 0) return false;

      if (direction === 'right' && index === visibleItemsCount - 1) {
        if (hasMoreItems) {
          onReachRailEnd(rail.id);
          window.setTimeout(() => setFocus(getMediaRailFocusKey(section, rail.id, index + 1)), 0);
        }

        return false;
      }

      if (direction === 'up') {
        if (previousRail) {
          const previousVisibleCount = Math.min(
            visibleCounts[previousRail.id] ?? RAIL_BATCH_SIZE,
            previousRail.items.length
          );
          setFocus(getMediaRailFocusKey(section, previousRail.id, Math.min(index, previousVisibleCount - 1)));
        } else {
          setFocus(getBackFocusKey(section));
        }
        return false;
      }

      if (direction === 'down') {
        if (nextRail) {
          const nextVisibleCount = Math.min(
            visibleCounts[nextRail.id] ?? RAIL_BATCH_SIZE,
            nextRail.items.length
          );
          setFocus(getMediaRailFocusKey(section, nextRail.id, Math.min(index, nextVisibleCount - 1)));
        }
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={(node) => {
        ref.current = node;
        elementRef.current = node;
      }}
      type="button"
      className={`${styles.posterCard} ${focused ? styles.focused : ''}`}
      onClick={() => onOpenItem(section, item, focusKey)}
      aria-label={item.name}
    >
      <span className={styles.posterArtwork}>
        {canLoadImage && !isImageReady && (
          <PosterFallback item={item} section={section} />
        )}
        {canLoadImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={!isImageReady ? styles.posterImagePending : undefined}
            src={image}
            alt=""
            loading="eager"
            fetchPriority={index < RAIL_BATCH_SIZE ? 'high' : 'auto'}
            decoding="async"
            onLoad={() => setLoadedImage(image)}
            onError={() => {
              setFailedImage(image);
              setLoadedImage('');
            }}
          />
        ) : (
          <PosterFallback item={item} section={section} />
        )}
        {rail.kind === 'favorites' && (
          <span className={styles.favoriteBadge} aria-label={copyByLanguage.pt.favorite}>
            <Star size={15} fill="currentColor" />
          </span>
        )}
      </span>
      <span className={styles.posterTitle}>{item.name}</span>
    </button>
  );
}

function RailSection({
  section,
  rail,
  railIndex,
  rails,
  visibleCount,
  visibleCounts,
  onReachRailEnd,
  onOpenItem,
}: {
  section: MediaCategoryRailsSection;
  rail: MediaCategoryRailData;
  railIndex: number;
  rails: MediaCategoryRailData[];
  visibleCount: number;
  visibleCounts: Record<string, number>;
  onReachRailEnd: (railId: string) => void;
  onOpenItem: (section: MediaCategoryRailsSection, item: ChannelListViewChannel, focusKey: string) => void;
}) {
  const visibleItems = rail.items.slice(0, visibleCount);
  const hasMoreItems = visibleItems.length < rail.items.length;

  return (
    <section className={styles.railSection}>
      <div className={styles.railHeader}>
        <h2>{rail.title}</h2>
        <span>{visibleItems.length} / {rail.items.length}</span>
      </div>
      <div className={styles.railScroller}>
        {visibleItems.map((item, index) => (
          <MediaPosterCard
            key={`${rail.id}-${item.id}`}
            section={section}
            rail={rail}
            item={item}
            index={index}
            railIndex={railIndex}
            visibleItemsCount={visibleItems.length}
            rails={rails}
            visibleCounts={visibleCounts}
            hasMoreItems={hasMoreItems}
            onReachRailEnd={onReachRailEnd}
            onOpenItem={onOpenItem}
          />
        ))}
      </div>
    </section>
  );
}

export default function MediaCategoryRails({
  section,
  language,
  rails,
  searchItems,
  isLoading,
  isSearchCatalogLoading,
  onBack,
  onOpenSearch,
  onOpenItem,
}: MediaCategoryRailsProps) {
  const copy = copyByLanguage[language];
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const preloadedImagesRef = useRef<HTMLImageElement[]>([]);
  const initialFocusSectionRef = useRef<MediaCategoryRailsSection | null>(null);
  const { ref, focusKey } = useFocusable({
    focusKey: `media-rails-${section}-screen`,
    trackChildren: true,
  });

  const title = section === 'movies' ? copy.moviesTitle : copy.seriesTitle;
  const subtitle = section === 'movies' ? copy.moviesSubtitle : copy.seriesSubtitle;
  const searchPlaceholder = section === 'movies' ? copy.searchAllMovies : copy.searchAllSeries;

  const indexedSearchItems = useMemo(
    () => createSearchIndex(searchItems, (item) => `${item.name} ${item.genre || ''} ${item.releaseDate || ''}`),
    [searchItems]
  );

  const searchResults = useMemo(() => {
    if (!hasSearchQuery(searchQuery)) return [];

    const matcher = createIndexedSearchMatcher<ChannelListViewChannel>(searchQuery);
    return indexedSearchItems
      .filter(matcher)
      .map((entry) => entry.item);
  }, [indexedSearchItems, searchQuery]);

  const visibleRails = useMemo(() => {
    if (!isSearchOpen || !hasSearchQuery(searchQuery)) {
      return rails.filter((rail) => rail.items.length > 0);
    }

    return searchResults.length > 0
      ? [{ id: `${section}-search-results`, title: copy.results, items: searchResults, kind: 'search' as const }]
      : [];
  }, [copy.results, isSearchOpen, rails, searchQuery, searchResults, section]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urls = Array.from(new Set(visibleRails
      .flatMap((rail) => {
        const visibleCount = visibleCounts[rail.id] ?? (rail.kind === 'search' ? SEARCH_BATCH_SIZE : RAIL_BATCH_SIZE);
        return rail.items.slice(0, visibleCount);
      })
      .map(getItemImage)
      .filter((url): url is string => Boolean(url))));

    preloadedImagesRef.current = urls.map((url) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = url;
      return image;
    });
  }, [visibleCounts, visibleRails]);

  useEffect(() => {
    if (initialFocusSectionRef.current === section) return undefined;
    if (isLoading && visibleRails.length === 0) return undefined;

    const firstRail = visibleRails.find((rail) => rail.items.length > 0);
    const target = firstRail
      ? getMediaRailFocusKey(section, firstRail.id, 0)
      : getBackFocusKey(section);

    const timeout = window.setTimeout(() => {
      initialFocusSectionRef.current = section;
      setFocus(target);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isLoading, section, visibleRails]);

  const handleReachRailEnd = useCallback((railId: string) => {
    setVisibleCounts((currentCounts) => ({
      ...currentCounts,
      [railId]: Math.min(
        (currentCounts[railId] ?? (railId.includes('search-results') ? SEARCH_BATCH_SIZE : RAIL_BATCH_SIZE)) +
          (railId.includes('search-results') ? SEARCH_BATCH_SIZE : RAIL_BATCH_SIZE),
        visibleRails.find((rail) => rail.id === railId)?.items.length ?? 0
      ),
    }));
  }, [visibleRails]);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
    onOpenSearch();
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }, [onOpenSearch]);

  const handleBack = useCallback(() => {
    if (isSearchOpen) {
      setSearchQuery('');
      setIsSearchOpen(false);
      window.setTimeout(() => setFocus(getSearchFocusKey(section)), 0);
      return;
    }

    onBack();
  }, [isSearchOpen, onBack, section]);

  const firstRail = visibleRails.find((rail) => rail.items.length > 0);
  const firstRailTarget = firstRail
    ? getMediaRailFocusKey(section, firstRail.id, 0)
    : getBackFocusKey(section);

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} className={styles.screen}>
        <header className={styles.header}>
          <HeaderButton
            focusKey={getBackFocusKey(section)}
            className={styles.backButton}
            onPress={handleBack}
            label={copy.back}
            onArrowPress={(direction) => {
              if (direction === 'right') {
                setFocus(getSearchFocusKey(section));
                return false;
              }

              if (direction === 'down') {
                setFocus(firstRailTarget);
                return false;
              }

              return true;
            }}
          >
            <ArrowLeft size={26} />
            <span>{copy.back}</span>
          </HeaderButton>

          <div className={styles.heading}>
            <span className={styles.eyebrow}>Nuvix</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className={`${styles.searchArea} ${isSearchOpen ? styles.searchAreaOpen : ''}`}>
            {isSearchOpen && (
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className={styles.searchInput}
              />
            )}
            <HeaderButton
              focusKey={getSearchFocusKey(section)}
              className={styles.searchButton}
              onPress={handleOpenSearch}
              label={section === 'movies' ? copy.searchMovies : copy.searchSeries}
              onArrowPress={(direction) => {
                if (direction === 'left') {
                  setFocus(getBackFocusKey(section));
                  return false;
                }

                if (direction === 'down') {
                  setFocus(firstRailTarget);
                  return false;
                }

                return true;
              }}
            >
              <Search size={28} />
            </HeaderButton>
          </div>
        </header>

        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.stateMessage}>{copy.loading}</div>
          ) : visibleRails.length > 0 ? (
            visibleRails.map((rail, index) => (
              <RailSection
                key={rail.id}
                section={section}
                rail={rail}
                railIndex={index}
                rails={visibleRails}
                visibleCount={visibleCounts[rail.id] ?? (rail.kind === 'search' ? SEARCH_BATCH_SIZE : RAIL_BATCH_SIZE)}
                visibleCounts={visibleCounts}
                onReachRailEnd={handleReachRailEnd}
                onOpenItem={onOpenItem}
              />
            ))
          ) : (
            <div className={styles.stateMessage}>
              {isSearchOpen && hasSearchQuery(searchQuery)
                ? isSearchCatalogLoading
                  ? copy.loading
                  : copy.noResults
                : copy.empty}
            </div>
          )}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
