'use client';

import React, { useEffect } from 'react';
import { Film, LogOut, PlayCircle, Tv } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './MainMenu.module.css';

export type MainMenuSection = 'live' | 'movies' | 'series';

type MainMenuProps = {
  onSelect: (section: MainMenuSection) => void;
  onLogout: () => void;
};

type MenuCard = {
  id: MainMenuSection;
  title: string;
  description: string;
  icon: React.ElementType;
  focusKey: string;
};

const menuCards: MenuCard[] = [
  {
    id: 'live',
    title: 'TV ao Vivo',
    description: 'Canais organizados por categoria.',
    icon: Tv,
    focusKey: 'main-menu-live',
  },
  {
    id: 'movies',
    title: 'Filmes',
    description: 'Pastas de filmes por colecao.',
    icon: Film,
    focusKey: 'main-menu-movies',
  },
  {
    id: 'series',
    title: 'Series',
    description: 'Temporadas e series em categorias.',
    icon: PlayCircle,
    focusKey: 'main-menu-series',
  },
];

function MainMenuCard({ card, onSelect }: { card: MenuCard; onSelect: (section: MainMenuSection) => void }) {
  const Icon = card.icon;
  const { ref, focused } = useFocusable({
    focusKey: card.focusKey,
    onEnterPress: () => onSelect(card.id),
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

function MainMenuLogoutButton({ onLogout }: { onLogout: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'main-menu-logout',
    onEnterPress: onLogout,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.iconAction} ${focused ? styles.focused : ''}`}
      onClick={onLogout}
      aria-label="Sair"
      title="Sair"
    >
      <LogOut size={28} />
    </button>
  );
}

export default function MainMenu({ onSelect, onLogout }: MainMenuProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'main-menu',
    trackChildren: true,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('main-menu-live');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref}>
        <div className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>N</div>
            <span>Nuvix</span>
          </div>
          <MainMenuLogoutButton onLogout={onLogout} />
        </div>

        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Media Player</span>
            <h1>Escolha uma categoria</h1>
            <p>Entre rapidamente no que quer assistir, com navegacao simples para TV.</p>
          </div>
        </div>

        <div className={styles.grid}>
          {menuCards.map((card) => (
            <MainMenuCard key={card.id} card={card} onSelect={onSelect} />
          ))}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
