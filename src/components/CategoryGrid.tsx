'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Folder, LockKeyhole, Search, Star } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import { createSearchMatcher, hasSearchQuery } from '@/lib/search';
import styles from './CategoryGrid.module.css';

export type MediaCategory = {
  id: string;
  name: string;
  isAll?: boolean;
  isFavorites?: boolean;
  isRestricted?: boolean;
};

type CategoryGridProps = {
  title: string;
  subtitle: string;
  categories: MediaCategory[];
  isLoading: boolean;
  onBack: () => void;
  onSelect: (category: MediaCategory) => void;
  language: AppLanguage;
};

const createFocusKeyPart = (value: string | number) =>
  String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export const getCategoryFocusKey = (categoryId: string | number) =>
  `category-card-${createFocusKeyPart(categoryId)}`;

const getGridColumnCount = (element: HTMLElement | null) => {
  const grid = element?.parentElement;
  if (!grid || typeof window === 'undefined') return 1;

  const columns = window
    .getComputedStyle(grid)
    .gridTemplateColumns
    .split(' ')
    .filter(Boolean);

  return Math.max(1, columns.length);
};

const scrollToGridTop = () => {
  if (typeof window === 'undefined') return;

  window.scrollTo({
    top: 0,
    behavior: 'auto',
  });
};

function BackButton({ onBack, label }: { onBack: () => void; label: string }) {
  const { ref, focused } = useFocusable({
    focusKey: 'category-grid-back',
    onEnterPress: onBack,
    onArrowPress: (direction) => {
      if (direction === 'right') {
        setFocus('category-grid-search');
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
      onClick={onBack}
    >
      <ArrowLeft size={24} />
      <span>{label}</span>
    </button>
  );
}

function SearchButton({ onOpen, label }: { onOpen: () => void; label: string }) {
  const { ref, focused } = useFocusable({
    focusKey: 'category-grid-search',
    onEnterPress: onOpen,
    onArrowPress: (direction) => {
      if (direction === 'left') {
        setFocus('category-grid-back');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.iconAction} ${focused ? styles.focused : ''}`}
      onClick={onOpen}
      aria-label={label}
      title={label}
    >
      <Search size={28} />
    </button>
  );
}

function CategoryCard({
  category,
  categories,
  index,
  onSelect,
  labels,
}: {
  category: MediaCategory;
  categories: MediaCategory[];
  index: number;
  onSelect: (category: MediaCategory) => void;
  labels: { allBadge: string; favoritesBadge: string; restrictedBadge: string };
}) {
  const focusKey = getCategoryFocusKey(category.id);
  const Icon = category.isFavorites ? Star : category.isRestricted ? LockKeyhole : Folder;
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onSelect(category),
    onFocus: () => {
      const columnCount = getGridColumnCount(ref.current);

      if (index < columnCount) {
        scrollToGridTop();
        return;
      }

      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    },
    onArrowPress: (direction) => {
      if (direction !== 'down' && direction !== 'up') {
        return true;
      }

      const columnCount = getGridColumnCount(ref.current);
      const nextIndex = direction === 'down' ? index + columnCount : index - columnCount;

      if (nextIndex >= 0 && nextIndex < categories.length) {
        if (nextIndex < columnCount) {
          scrollToGridTop();
        }

        setFocus(getCategoryFocusKey(categories[nextIndex].id));
        return false;
      }

      if (direction === 'up') {
        scrollToGridTop();
        setFocus(index % columnCount === columnCount - 1 ? 'category-grid-search' : 'category-grid-back');
        return false;
      }

      return false;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.card} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect(category)}
    >
      <span className={[
        styles.folderIcon,
        category.isFavorites ? styles.favoriteIcon : '',
        category.isRestricted ? styles.restrictedIcon : '',
      ].filter(Boolean).join(' ')}>
        <Icon size={34} fill={category.isFavorites ? 'currentColor' : 'none'} />
      </span>
      <span className={styles.categoryName}>{category.name}</span>
      {category.isAll && <span className={styles.badge}>{labels.allBadge}</span>}
      {category.isFavorites && <span className={styles.favoriteBadge}>{labels.favoritesBadge}</span>}
      {category.isRestricted && <span className={styles.restrictedBadge}>{labels.restrictedBadge}</span>}
    </button>
  );
}

export default function CategoryGrid({
  title,
  subtitle,
  categories,
  isLoading,
  onBack,
  onSelect,
  language,
}: CategoryGridProps) {
  const copy = appCopy[language];
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
        ? getCategoryFocusKey(visibleCategories[0].id)
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
          <BackButton onBack={onBack} label={copy.common.back} />
          <div>
            <span className={styles.eyebrow}>{copy.categoryGrid.eyebrow}</span>
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
                  placeholder={copy.categoryGrid.searchFolder}
                  aria-label={copy.categoryGrid.searchFolder}
                />
              </label>
            )}
            <SearchButton onOpen={openSearch} label={copy.common.search} />
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loading}>{copy.categoryGrid.loading}</div>
        ) : (
          <div className={styles.grid}>
            {visibleCategories.length > 0 ? (
              visibleCategories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  categories={visibleCategories}
                  index={index}
                  onSelect={onSelect}
                  labels={{
                    allBadge: copy.categoryGrid.allBadge,
                    favoritesBadge: copy.categoryGrid.favoritesBadge,
                    restrictedBadge: copy.categoryGrid.restrictedBadge,
                  }}
                />
              ))
            ) : (
              <div className={styles.emptyState}>{copy.categoryGrid.empty}</div>
            )}
          </div>
        )}
      </section>
    </FocusContext.Provider>
  );
}
