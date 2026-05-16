'use client';

import React, { useEffect } from 'react';
import { ArrowLeft, Folder, LogOut } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './CategoryGrid.module.css';

export type MediaCategory = {
  id: string;
  name: string;
  isAll?: boolean;
};

type CategoryGridProps = {
  title: string;
  subtitle: string;
  categories: MediaCategory[];
  isLoading: boolean;
  onBack: () => void;
  onLogout: () => void;
  onSelect: (category: MediaCategory) => void;
};

const createFocusKeyPart = (value: string | number) =>
  String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

function BackButton({ onBack }: { onBack: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'category-grid-back',
    onEnterPress: onBack,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.backButton} ${focused ? styles.focused : ''}`}
      onClick={onBack}
    >
      <ArrowLeft size={24} />
      <span>Voltar</span>
    </button>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'category-grid-logout',
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

function CategoryCard({ category, onSelect }: { category: MediaCategory; onSelect: (category: MediaCategory) => void }) {
  const focusKey = `category-card-${createFocusKeyPart(category.id)}`;
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onSelect(category),
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.card} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect(category)}
    >
      <span className={styles.folderIcon}>
        <Folder size={34} />
      </span>
      <span className={styles.categoryName}>{category.name}</span>
      {category.isAll && <span className={styles.badge}>Tudo</span>}
    </button>
  );
}

export default function CategoryGrid({
  title,
  subtitle,
  categories,
  isLoading,
  onBack,
  onLogout,
  onSelect,
}: CategoryGridProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'category-grid',
    trackChildren: true,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus(categories.length > 0 ? `category-card-${createFocusKeyPart(categories[0].id)}` : 'category-grid-back');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [categories]);

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref}>
        <div className={styles.topbar}>
          <BackButton onBack={onBack} />
          <div>
            <span className={styles.eyebrow}>Pastas</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <LogoutButton onLogout={onLogout} />
        </div>

        {isLoading ? (
          <div className={styles.loading}>Carregando categorias...</div>
        ) : (
          <div className={styles.grid}>
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} onSelect={onSelect} />
            ))}
          </div>
        )}
      </section>
    </FocusContext.Provider>
  );
}
