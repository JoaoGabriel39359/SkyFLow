'use client';

import React, { useEffect } from 'react';
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
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './Sidebar.module.css';

type MenuItem = {
  icon: React.ElementType;
  label: string;
  id: string;
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
  { icon: Search, label: 'Busca', id: 'search' },
  { icon: Home, label: 'Início', id: 'home' },

  {
    icon: Tv,
    label: 'TV ao Vivo',
    id: 'live',
    children: [
      { icon: ListVideo, label: 'Canais', id: 'live' },
      { icon: Star, label: 'Favoritos', id: 'live-favorites' },
    ],
  },

  {
    icon: Film,
    label: 'Filmes',
    id: 'movies',
    children: [
      { icon: ListVideo, label: 'Catálogo', id: 'movies' },
      { icon: Star, label: 'Favoritos', id: 'movies-favorites' },
    ],
  },

  {
    icon: PlayCircle,
    label: 'Séries',
    id: 'series',
    children: [
      { icon: ListVideo, label: 'Catálogo', id: 'series' },
      { icon: Star, label: 'Favoritos', id: 'series-favorites' },
    ],
  },

  { icon: Settings, label: 'Ajustes', id: 'settings' },
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

  const { ref, focused } = useFocusable({
    focusKey: `sidebar-${item.id}`,
    onEnterPress: () => onTabChange(item.id),
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
      onClick={() => onTabChange(item.id)}
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

  useEffect(() => {
    const initialFocusKey = activeTab ? `sidebar-${activeTab}` : 'sidebar-home';

    const timeout = setTimeout(() => {
      setFocus(initialFocusKey);
    }, 100);

    return () => clearTimeout(timeout);
  }, [activeTab]);

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
            <div key={item.id} className={styles.navGroup}>
              <FocusableMenuItem
                item={item}
                activeTab={activeTab}
                onTabChange={onTabChange}
              />

              {item.children && (
                <div className={styles.subMenu}>
                  {item.children.map((child) => (
                    <FocusableMenuItem
                      key={child.id}
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