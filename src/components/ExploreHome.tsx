'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Film, LogOut, PlayCircle, RadioTower, Search, Settings, Tv } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import type { AppLanguage } from '@/lib/i18n';
import { getChannelLogoBrand } from '@/lib/channelLogos';
import type { ChannelListViewChannel } from './ChannelListView';
import type { MainMenuSection } from './MainMenu';
import styles from './ExploreHome.module.css';

export type ExploreMediaSection = Exclude<MainMenuSection, 'settings'>;

type ExploreHomeProps = {
  language: AppLanguage;
  liveItems: ChannelListViewChannel[];
  movieItems: ChannelListViewChannel[];
  seriesItems: ChannelListViewChannel[];
  isLoading: boolean;
  onOpenSection: (section: MainMenuSection) => void;
  onOpenSearch: () => void;
  onOpenItem: (section: ExploreMediaSection, item: ChannelListViewChannel, focusKey: string) => void;
  onLogout: () => void;
};

type ExploreSelection = {
  section: ExploreMediaSection;
  item: ChannelListViewChannel;
};

type ExploreCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  quickTitle: string;
  live: string;
  movies: string;
  series: string;
  settings: string;
  search: string;
  logout: string;
  liveRail: string;
  movieRail: string;
  seriesRail: string;
  loading: string;
  empty: string;
  historyEmpty: string;
};

type QuickAction = {
  id: ExploreMediaSection;
  label: string;
  description: string;
  icon: React.ElementType;
  focusKey: string;
  onPress: () => void;
};

type RailConfig = {
  id: ExploreMediaSection;
  title: string;
  items: ChannelListViewChannel[];
  emptyText?: string;
};

type VisibleCountBySection = Record<ExploreMediaSection, number>;

type FooterButtonProps = {
  focusKey: string;
  label: string;
  icon: React.ElementType;
  onPress: () => void;
  upTarget: string;
  leftTarget?: string;
  rightTarget?: string;
  danger?: boolean;
};

const copyByLanguage: Record<AppLanguage, ExploreCopy> = {
  pt: {
    eyebrow: 'Explorar Nuvix',
    title: 'O que vamos assistir?',
    subtitle: 'Destaques leves, historico e atalhos pensados para TV.',
    quickTitle: 'Acessos rapidos',
    live: 'TV ao Vivo',
    movies: 'Explorar Filmes',
    series: 'Explorar Series',
    settings: 'Ajustes',
    search: 'Buscar',
    logout: 'Sair',
    liveRail: 'Agora na TV',
    movieRail: 'Filmes para assistir',
    seriesRail: 'Series',
    loading: 'Carregando destaques...',
    empty: 'Destaques indisponiveis agora.',
    historyEmpty: 'Seus canais mais vistos aparecerao aqui.',
  },
  en: {
    eyebrow: 'Explore Nuvix',
    title: 'What should we watch?',
    subtitle: 'Light highlights, history and shortcuts designed for TV.',
    quickTitle: 'Quick access',
    live: 'Live TV',
    movies: 'Explore Movies',
    series: 'Explore Series',
    settings: 'Settings',
    search: 'Search',
    logout: 'Sign out',
    liveRail: 'On Live TV',
    movieRail: 'Movies to watch',
    seriesRail: 'Series',
    loading: 'Loading highlights...',
    empty: 'Highlights unavailable right now.',
    historyEmpty: 'Your most watched channels will appear here.',
  },
  es: {
    eyebrow: 'Explorar Nuvix',
    title: 'Que vamos a ver?',
    subtitle: 'Destacados ligeros, historial y accesos pensados para TV.',
    quickTitle: 'Accesos rapidos',
    live: 'TV en Vivo',
    movies: 'Explorar Peliculas',
    series: 'Explorar Series',
    settings: 'Ajustes',
    search: 'Buscar',
    logout: 'Salir',
    liveRail: 'Ahora en TV',
    movieRail: 'Peliculas para ver',
    seriesRail: 'Series',
    loading: 'Cargando destacados...',
    empty: 'Destacados no disponibles ahora.',
    historyEmpty: 'Tus canales mas vistos apareceran aqui.',
  },
};

export const getExploreRailFocusKey = (section: ExploreMediaSection, index: number) => `explore-${section}-${index}`;
const EXPLORE_RAIL_BATCH_SIZE = 12;
const initialVisibleCounts: VisibleCountBySection = {
  live: 15,
  movies: EXPLORE_RAIL_BATCH_SIZE,
  series: EXPLORE_RAIL_BATCH_SIZE,
};

const CHANNEL_QUALITY_SUFFIXES = [
  ['FULL HD', 'FULL HD'],
  ['FULLHD', 'FULLHD'],
  ['H.265', 'H265'],
  ['H265', 'H265'],
  ['HEVC', 'HEVC'],
  ['4K', '4K'],
  ['UHD', 'UHD'],
  ['FHD', 'FHD'],
  ['HD', 'HD'],
  ['SD', 'SD'],
] as const;

function extractChannelQuality(channelName: string) {
  const normalizedName = channelName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[¹²³]+$/g, '')
    .trim();

  if (!normalizedName) return null;

  const match = CHANNEL_QUALITY_SUFFIXES.find(([suffix]) => (
    normalizedName === suffix || normalizedName.endsWith(` ${suffix}`)
  ));

  return match?.[1] ?? null;
}

function getItemImage(item: ChannelListViewChannel) {
  return item.logo || item.backdrop || '';
}

function useFocusScroll<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);

  const scrollIntoView = () => {
    window.requestAnimationFrame(() => {
      elementRef.current?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
      });
    });
  };

  return { elementRef, scrollIntoView };
}

function ImageFallback({
  label,
  icon: Icon = Tv,
  showLabel = false,
}: {
  label: string;
  icon?: React.ElementType;
  showLabel?: boolean;
}) {
  const brand = showLabel ? getChannelLogoBrand(label) : null;

  if (brand) {
    const brandClassName = styles[`brandFallback_${brand.key}`] ?? '';

    return (
      <span className={`${styles.imageFallback} ${styles.brandFallback} ${brandClassName}`}>
        <strong>{brand.label}</strong>
      </span>
    );
  }

  return (
    <span className={styles.imageFallback}>
      <Icon size={26} />
      <small>{showLabel ? label : label.slice(0, 2).toUpperCase()}</small>
    </span>
  );
}

function HeaderSearchButton({ label, onOpenSearch }: { label: string; onOpenSearch: () => void }) {
  const { elementRef, scrollIntoView } = useFocusScroll<HTMLButtonElement>();
  const { ref, focused } = useFocusable({
    focusKey: 'explore-search',
    onEnterPress: onOpenSearch,
    onFocus: scrollIntoView,
    onArrowPress: (direction) => {
      if (direction === 'down') {
        setFocus('explore-quick-live');
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
      className={`${styles.searchButton} ${focused ? styles.focused : ''}`}
      onClick={onOpenSearch}
      aria-label={label}
    >
      <Search size={26} />
    </button>
  );
}

function QuickCard({ action, upTarget, downTarget }: { action: QuickAction; upTarget: string; downTarget: string }) {
  const Icon = action.icon;
  const { elementRef, scrollIntoView } = useFocusScroll<HTMLButtonElement>();
  const { ref, focused } = useFocusable({
    focusKey: action.focusKey,
    onEnterPress: action.onPress,
    onFocus: scrollIntoView,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus(upTarget);
        return false;
      }

      if (direction === 'down') {
        setFocus(downTarget);
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
      className={`${styles.quickCard} ${focused ? styles.focused : ''}`}
      onClick={action.onPress}
    >
      <span className={styles.quickAura} aria-hidden="true" />
      <span className={styles.quickIcon}><Icon size={34} /></span>
      <span className={styles.quickText}>
        <strong>{action.label}</strong>
        <small>{action.description}</small>
      </span>
      <span className={styles.quickEnter} aria-hidden="true">
        <ArrowRight size={22} />
      </span>
    </button>
  );
}

function MediaCard({
  section,
  item,
  index,
  railCount,
  previousRail,
  nextRail,
  previousRailCount,
  nextRailCount,
  hasMoreItems,
  onOpenItem,
  onFocusItem,
  onReachRailEnd,
}: {
  section: ExploreMediaSection;
  item: ChannelListViewChannel;
  index: number;
  railCount: number;
  previousRail: RailConfig | null;
  nextRail: RailConfig | null;
  previousRailCount: number;
  nextRailCount: number;
  hasMoreItems: boolean;
  onOpenItem: (section: ExploreMediaSection, item: ChannelListViewChannel, focusKey: string) => void;
  onFocusItem: (selection: ExploreSelection) => void;
  onReachRailEnd: (section: ExploreMediaSection) => void;
}) {
  const { elementRef, scrollIntoView } = useFocusScroll<HTMLButtonElement>();
  const image = getItemImage(item);
  const [failedImage, setFailedImage] = useState('');
  const focusKey = getExploreRailFocusKey(section, index);
  const isLive = section === 'live';
  const Icon = isLive ? Tv : section === 'movies' ? Film : PlayCircle;
  const canLoadImage = Boolean(image) && failedImage !== image;
  const qualityLabel = isLive ? extractChannelQuality(item.name) : null;

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onOpenItem(section, item, focusKey),
    onFocus: () => {
      scrollIntoView();
      onFocusItem({ section, item });
      if (index === railCount - 1) {
        onReachRailEnd(section);
      }
    },
    onArrowPress: (direction) => {
      if (direction === 'up') {
        if (previousRail) {
          setFocus(getExploreRailFocusKey(previousRail.id, Math.min(index, previousRailCount - 1)));
        } else {
          setFocus(`explore-quick-${section}`);
        }
        return false;
      }

      if (direction === 'down') {
        if (nextRail) {
          setFocus(getExploreRailFocusKey(nextRail.id, Math.min(index, nextRailCount - 1)));
        } else {
          setFocus('explore-settings');
        }
        return false;
      }

      if (direction === 'left' && index === 0) return false;

      if (direction === 'right' && index === railCount - 1) {
        if (hasMoreItems) {
          onReachRailEnd(section);
          window.setTimeout(() => {
            setFocus(getExploreRailFocusKey(section, index + 1));
          }, 0);
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
      className={`${styles.mediaCard} ${isLive ? styles.liveCard : styles.posterCard} ${focused ? styles.focused : ''}`}
      onClick={() => onOpenItem(section, item, focusKey)}
      aria-label={item.name}
    >
      <span className={styles.mediaArtwork}>
        {canLoadImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.mediaArtworkImage}
            src={image}
            alt=""
            loading="eager"
            fetchPriority={index < 12 ? 'high' : 'auto'}
            decoding={index < 12 ? 'sync' : 'async'}
            onError={() => setFailedImage(image)}
          />
        )}
        {!canLoadImage && (
          <ImageFallback label={item.name} icon={Icon} showLabel={isLive} />
        )}
        {qualityLabel && <span className={styles.qualityBadge}>{qualityLabel}</span>}
      </span>
    </button>
  );
}

function EmptyRailState({ text }: { text: string }) {
  return <div className={styles.emptyRail}>{text}</div>;
}

function Rail({
  rail,
  railIndex,
  rails,
  onOpenItem,
  onFocusItem,
  visibleCount,
  visibleCounts,
  onReachRailEnd,
}: {
  rail: RailConfig;
  railIndex: number;
  rails: RailConfig[];
  onOpenItem: (section: ExploreMediaSection, item: ChannelListViewChannel, focusKey: string) => void;
  onFocusItem: (selection: ExploreSelection) => void;
  visibleCount: number;
  visibleCounts: VisibleCountBySection;
  onReachRailEnd: (section: ExploreMediaSection) => void;
}) {
  const visibleItems = rail.items.slice(0, visibleCount);
  const hasMoreItems = visibleItems.length < rail.items.length;
  const previousRail = [...rails]
    .slice(0, railIndex)
    .reverse()
    .find((candidate) => candidate.items.length > 0) ?? null;
  const nextRail = rails
    .slice(railIndex + 1)
    .find((candidate) => candidate.items.length > 0) ?? null;
  const previousRailCount = previousRail
    ? Math.min(visibleCounts[previousRail.id], previousRail.items.length)
    : 0;
  const nextRailCount = nextRail
    ? Math.min(visibleCounts[nextRail.id], nextRail.items.length)
    : 0;

  return (
    <section className={styles.rail}>
      <div className={styles.railHeader}>
        <h2>{rail.title}</h2>
        <span>{rail.items.length > 0 ? `${visibleItems.length} / ${rail.items.length}` : rail.emptyText}</span>
      </div>
      {visibleItems.length > 0 ? (
        <div className={styles.railScroller}>
          {visibleItems.map((item, index) => (
            <MediaCard
              key={`${rail.id}-${item.id}`}
              section={rail.id}
              item={item}
              index={index}
              railCount={visibleItems.length}
              previousRail={previousRail}
              nextRail={nextRail}
              previousRailCount={previousRailCount}
              nextRailCount={nextRailCount}
              hasMoreItems={hasMoreItems}
              onOpenItem={onOpenItem}
              onFocusItem={onFocusItem}
              onReachRailEnd={onReachRailEnd}
            />
          ))}
        </div>
      ) : (
        <EmptyRailState text={rail.emptyText || ''} />
      )}
    </section>
  );
}

function FooterButton({
  focusKey,
  label,
  icon: Icon,
  onPress,
  upTarget,
  leftTarget,
  rightTarget,
  danger,
}: FooterButtonProps) {
  const { elementRef, scrollIntoView } = useFocusScroll<HTMLButtonElement>();
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onFocus: scrollIntoView,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus(upTarget);
        return false;
      }

      if (direction === 'left' && leftTarget) {
        setFocus(leftTarget);
        return false;
      }

      if (direction === 'right' && rightTarget) {
        setFocus(rightTarget);
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
      className={`${styles.footerButton} ${danger ? styles.dangerButton : ''} ${focused ? styles.focused : ''}`}
      onClick={onPress}
    >
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}

export default function ExploreHome({
  language,
  liveItems,
  movieItems,
  seriesItems,
  isLoading,
  onOpenSection,
  onOpenSearch,
  onOpenItem,
  onLogout,
}: ExploreHomeProps) {
  const copy = copyByLanguage[language];
  const [visibleCounts, setVisibleCounts] = useState<VisibleCountBySection>(initialVisibleCounts);
  const preloadedImagesRef = useRef<HTMLImageElement[]>([]);
  const { ref, focusKey } = useFocusable({
    focusKey: 'explore-home',
    trackChildren: true,
  });

  const rails = useMemo<RailConfig[]>(() => [
    { id: 'live', title: copy.liveRail, items: liveItems, emptyText: copy.historyEmpty },
    { id: 'movies', title: copy.movieRail, items: movieItems, emptyText: copy.empty },
    { id: 'series', title: copy.seriesRail, items: seriesItems, emptyText: copy.empty },
  ], [copy.empty, copy.historyEmpty, copy.liveRail, copy.movieRail, copy.seriesRail, liveItems, movieItems, seriesItems]);

  const firstRail = rails.find((rail) => rail.items.length > 0);
  const firstRailTarget = firstRail
    ? getExploreRailFocusKey(firstRail.id, 0)
    : 'explore-settings';
  const lastRail = [...rails].reverse().find((rail) => rail.items.length > 0);
  const footerUpTarget = lastRail ? getExploreRailFocusKey(lastRail.id, 0) : 'explore-quick-live';

  const handleReachRailEnd = useCallback((section: ExploreMediaSection) => {
    if (section !== 'movies' && section !== 'series') return;

    setVisibleCounts((currentCounts) => {
      const currentLimit = currentCounts[section];
      const totalItems = section === 'movies' ? movieItems.length : seriesItems.length;

      if (currentLimit >= totalItems) return currentCounts;

      return {
        ...currentCounts,
        [section]: Math.min(currentLimit + EXPLORE_RAIL_BATCH_SIZE, totalItems),
      };
    });
  }, [movieItems.length, seriesItems.length]);

  useEffect(() => {
    const urls = Array.from(new Set([
      ...liveItems.slice(0, visibleCounts.live),
      ...movieItems.slice(0, visibleCounts.movies),
      ...seriesItems.slice(0, visibleCounts.series),
    ]
      .map(getItemImage)
      .filter((url): url is string => Boolean(url))))
      .slice(0, 60);

    preloadedImagesRef.current = urls.map((url) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = url;
      return image;
    });
  }, [
    liveItems,
    movieItems,
    seriesItems,
    visibleCounts.live,
    visibleCounts.movies,
    visibleCounts.series,
  ]);

  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'live',
      label: copy.live,
      description: language === 'en'
        ? 'Channels, sports and live programming'
        : language === 'es'
          ? 'Canales, deportes y programacion ahora'
          : 'Canais, esportes e programacao agora',
      icon: RadioTower,
      focusKey: 'explore-quick-live',
      onPress: () => onOpenSection('live'),
    },
    {
      id: 'movies',
      label: copy.movies,
      description: language === 'en'
        ? 'Premieres, action, comedy and more'
        : language === 'es'
          ? 'Estrenos, accion, comedia y mas'
          : 'Lancamentos, acao, comedia e mais',
      icon: Film,
      focusKey: 'explore-quick-movies',
      onPress: () => onOpenSection('movies'),
    },
    {
      id: 'series',
      label: copy.series,
      description: language === 'en'
        ? 'Seasons, episodes and new stories'
        : language === 'es'
          ? 'Temporadas, episodios y novedades'
          : 'Temporadas, episodios e novidades',
      icon: PlayCircle,
      focusKey: 'explore-quick-series',
      onPress: () => onOpenSection('series'),
    },
  ], [copy.live, copy.movies, copy.series, language, onOpenSection]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('explore-quick-live');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} className={styles.screen}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>N</span>
            <span>Nuvix</span>
          </div>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <HeaderSearchButton label={copy.search} onOpenSearch={onOpenSearch} />
        </header>

        <section className={styles.quickSection}>
          <div className={styles.sectionHeader}>
            <h2>{copy.quickTitle}</h2>
            {isLoading && <span>{copy.loading}</span>}
          </div>
          <div className={styles.quickGrid}>
            {quickActions.map((action) => (
              <QuickCard
                key={action.id}
                action={action}
                upTarget="explore-search"
                downTarget={firstRailTarget}
              />
            ))}
          </div>
        </section>

        <div className={styles.rails}>
          {rails.map((rail, index) => (
            <Rail
              key={rail.id}
              rail={rail}
              railIndex={index}
              rails={rails}
              onOpenItem={onOpenItem}
              onFocusItem={() => undefined}
              visibleCount={visibleCounts[rail.id]}
              visibleCounts={visibleCounts}
              onReachRailEnd={handleReachRailEnd}
            />
          ))}
        </div>

        <div className={styles.footerActions}>
          <FooterButton
            focusKey="explore-settings"
            label={copy.settings}
            icon={Settings}
            onPress={() => onOpenSection('settings')}
            upTarget={footerUpTarget}
            rightTarget="explore-logout"
          />
          <FooterButton
            focusKey="explore-logout"
            label={copy.logout}
            icon={LogOut}
            onPress={onLogout}
            upTarget={footerUpTarget}
            leftTarget="explore-settings"
            danger
          />
        </div>
      </section>
    </FocusContext.Provider>
  );
}
