'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Folder, LogOut, Search, Star } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createSearchMatcher, hasSearchQuery } from '@/lib/search';
import styles from './CategoryGrid.module.css';

export type MediaCategory = {
  id: string;
  name: string;
  isAll?: boolean;
  isFavorites?: boolean;
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

function SearchButton({ onOpen }: { onOpen: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'category-grid-search',
    onEnterPress: onOpen,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.iconAction} ${focused ? styles.focused : ''}`}
      onClick={onOpen}
      aria-label="Buscar"
      title="Buscar"
    >
      <Search size={28} />
    </button>
  );
}

function CategoryCard({ category, onSelect }: { category: MediaCategory; onSelect: (category: MediaCategory) => void }) {
  const focusKey = `category-card-${createFocusKeyPart(category.id)}`;
  const Icon = category.isFavorites ? Star : Folder;
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
      <span className={`${styles.folderIcon} ${category.isFavorites ? styles.favoriteIcon : ''}`}>
        <Icon size={34} fill={category.isFavorites ? 'currentColor' : 'none'} />
      </span>
      <span className={styles.categoryName}>{category.name}</span>
      {category.isAll && <span className={styles.badge}>Tudo</span>}
      {category.isFavorites && <span className={styles.favoriteBadge}>Favoritos</span>}
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { ref, focusKey } = useFocusable({
    focusKey: 'category-grid',
    trackChildren: true,
  });
  const hasSearch = hasSearchQuery(searchQuery);
  const matchesSearch = useMemo(() => createSearchMatcher(searchQuery), [searchQuery]);
  const visibleCategories = useMemo(() => {
    if (!hasSearch) return categories;

    return categories.filter((category) => matchesSearch(category.name));
  }, [categories, hasSearch, matchesSearch]);

  const focusFirstCategory = useCallback(() => {
    setFocus(
      visibleCategories.length > 0
        ? `category-card-${createFocusKeyPart(visibleCategories[0].id)}`
        : 'category-grid-search'
    );
  }, [visibleCategories]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchQuery('');
    setSearchOpen(false);
    window.setTimeout(() => setFocus('category-grid-search'), 0);
  }, []);

  useEffect(() => {
    if (searchOpen) return;

    const timeout = window.setTimeout(() => {
      focusFirstCategory();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [focusFirstCategory, searchOpen]);

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
          <div className={styles.topActions}>
            {searchOpen && (
              <label className={styles.searchBox}>
                <Search size={22} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeSearch();
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      searchInputRef.current?.blur();
                      focusFirstCategory();
                    }
                  }}
                  placeholder="Buscar pasta"
                  aria-label="Buscar pasta"
                />
              </label>
            )}
            <SearchButton onOpen={openSearch} />
            <LogoutButton onLogout={onLogout} />
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loading}>Carregando categorias...</div>
        ) : (
          <div className={styles.grid}>
            {visibleCategories.length > 0 ? (
              visibleCategories.map((category) => (
                <CategoryCard key={category.id} category={category} onSelect={onSelect} />
              ))
            ) : (
              <div className={styles.emptyState}>Nenhuma pasta encontrada com esse nome.</div>
            )}
          </div>
        )}
      </section>
    </FocusContext.Provider>
  );
}
