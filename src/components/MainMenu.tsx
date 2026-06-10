'use client';

import React, { useEffect, useState } from 'react';
import { Film, LogOut, PlayCircle, Settings, Tv } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import styles from './MainMenu.module.css';

export type MainMenuSection = 'live' | 'movies' | 'series' | 'settings';

type MainMenuProps = {
  onSelect: (section: MainMenuSection) => void;
  onLogout: () => void;
  initialFocusKey?: string;
  language: AppLanguage;
};

type MenuCard = {
  id: MainMenuSection;
  title: string;
  description: string;
  icon: React.ElementType;
  focusKey: string;
};

function MainMenuCard({
  card,
  onSelect,
  onFocusCard,
}: {
  card: MenuCard;
  onSelect: (section: MainMenuSection) => void;
  onFocusCard: (focusKey: string) => void;
}) {
  const Icon = card.icon;
  const { ref, focused } = useFocusable({
    focusKey: card.focusKey,
    onEnterPress: () => onSelect(card.id),
    onFocus: () => onFocusCard(card.focusKey),
    onArrowPress: (direction) => {
      if (direction === 'down') {
        setFocus('main-menu-logout');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.card} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect(card.id)}
    >
      <span className={styles.iconWrap}>
        <Icon size={54} />
      </span>
      <span className={styles.cardTitle}>{card.title}</span>
      <span className={styles.cardDescription}>{card.description}</span>
    </button>
  );
}

function LogoutButton({
  label,
  lastCardFocusKey,
  onLogout,
}: {
  label: string;
  lastCardFocusKey: string;
  onLogout: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: 'main-menu-logout',
    onEnterPress: onLogout,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus(lastCardFocusKey);
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.logoutButton} ${focused ? styles.focused : ''}`}
      onClick={onLogout}
    >
      <LogOut size={22} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export default function MainMenu({ onSelect, onLogout, initialFocusKey = 'main-menu-live', language }: MainMenuProps) {
  const copy = appCopy[language].mainMenu;
  const commonCopy = appCopy[language].common;
  const [lastCardFocusKey, setLastCardFocusKey] = useState(initialFocusKey);
  const menuCards: MenuCard[] = [
    {
      id: 'live',
      title: copy.live,
      description: copy.liveDescription,
      icon: Tv,
      focusKey: 'main-menu-live',
    },
    {
      id: 'movies',
      title: copy.movies,
      description: copy.moviesDescription,
      icon: Film,
      focusKey: 'main-menu-movies',
    },
    {
      id: 'series',
      title: copy.series,
      description: copy.seriesDescription,
      icon: PlayCircle,
      focusKey: 'main-menu-series',
    },
    {
      id: 'settings',
      title: copy.settings,
      description: copy.settingsDescription,
      icon: Settings,
      focusKey: 'main-menu-settings',
    },
  ];
  const { ref, focusKey } = useFocusable({
    focusKey: 'main-menu',
    trackChildren: true,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus(initialFocusKey);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialFocusKey]);

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref}>
        <div className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>N</div>
            <span>Nuvix</span>
          </div>
        </div>

        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
        </div>

        <div className={styles.grid}>
          {menuCards.map((card) => (
            <MainMenuCard
              key={card.id}
              card={card}
              onSelect={onSelect}
              onFocusCard={setLastCardFocusKey}
            />
          ))}
        </div>

        <div className={styles.footerActions}>
          <LogoutButton
            label={commonCopy.logout}
            lastCardFocusKey={lastCardFocusKey}
            onLogout={onLogout}
          />
        </div>
      </section>
    </FocusContext.Provider>
  );
}
