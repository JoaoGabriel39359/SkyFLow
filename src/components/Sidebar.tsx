'use client';

import React from 'react';
import {
  Home,
  Tv,
  Film,
  PlayCircle,
  Settings,
  Search,
  Star,
  ListVideo,
} from 'lucide-react';
import {
  useFocusable,
  FocusContext,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './Sidebar.module.css';

type MenuItem = {
  icon: React.ElementType;
  label: string;
  id: string;
  focusKey: string;
  children?: MenuItem[];
};

type SidebarProps = {
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

type FocusableMenuItemProps = {
  item: MenuItem;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isChild?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: Search, label: 'Busca', id: 'search', focusKey: 'sidebar-search' },
  { icon: Home, label: 'Início', id: 'home', focusKey: 'sidebar-home' },

  {
    icon: Tv,
    label: 'TV ao Vivo',
    id: 'live',
    focusKey: 'sidebar-live',
    children: [
      { icon: ListVideo, label: 'Canais', id: 'live', focusKey: 'sidebar-live-catalog' },
      { icon: Star, label: 'Favoritos', id: 'live-favorites', focusKey: 'sidebar-live-favorites' },
    ],
  },

  {
    icon: Film,
    label: 'Filmes',
    id: 'movies',
    focusKey: 'sidebar-movies',
    children: [
      { icon: ListVideo, label: 'Catálogo', id: 'movies', focusKey: 'sidebar-movies-catalog' },
      { icon: Star, label: 'Favoritos', id: 'movies-favorites', focusKey: 'sidebar-movies-favorites' },
    ],
  },

  {
    icon: PlayCircle,
    label: 'Séries',
    id: 'series',
    focusKey: 'sidebar-series',
    children: [
      { icon: ListVideo, label: 'Catálogo', id: 'series', focusKey: 'sidebar-series-catalog' },
      { icon: Star, label: 'Favoritos', id: 'series-favorites', focusKey: 'sidebar-series-favorites' },
    ],
  },

  { icon: Settings, label: 'Ajustes', id: 'settings', focusKey: 'sidebar-settings' },
];

function FocusableMenuItem({
  item,
  activeTab,
  onTabChange,
  isChild = false,
}: FocusableMenuItemProps) {
  const isActive =
    activeTab === item.id ||
    item.children?.some((child: MenuItem) => child.id === activeTab);

  const handlePress = () => {
    onTabChange(item.id);
  };

  const { ref, focused } = useFocusable({
    focusKey: item.focusKey,
    onEnterPress: handlePress,
  });

  return (
    <button
      ref={ref}
      tabIndex={0}
      className={`
        ${styles.navItem}
        ${isChild ? styles.subItem : ''}
        ${isActive ? styles.active : ''}
        ${focused ? styles.focused : ''}
      `}
      onClick={handlePress}
      title={item.label}
    >
      <item.icon size={isChild ? 18 : 24} />
      <span className={styles.label}>{item.label}</span>
    </button>
  );
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'sidebar',
    trackChildren: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <aside
        ref={ref}
        className={`${styles.sidebar} ${styles.expanded}`}
      >
        <div className={styles.logo}>
          <div className={styles.logoIcon}>N</div>
          <span className={styles.logoText}>Nuvix</span>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => (
            <div key={item.focusKey} className={styles.navGroup}>
              <FocusableMenuItem
                item={item}
                activeTab={activeTab}
                onTabChange={onTabChange}
              />

              {item.children && (
                <div className={styles.subMenu}>
                  {item.children.map((child) => (
                    <FocusableMenuItem
                      key={child.focusKey}
                      item={child}
                      activeTab={activeTab}
                      onTabChange={onTabChange}
                      isChild
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </FocusContext.Provider>
  );
}
