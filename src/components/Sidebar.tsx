'use client';

import React, { useState, useEffect } from 'react';
import { Home, Tv, Film, PlayCircle, Settings, Search, Heart } from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import styles from './Sidebar.module.css';

const menuItems = [
  { icon: Search, label: 'Busca', id: 'search' },
  { icon: Home, label: 'Início', id: 'home' },
  { icon: Tv, label: 'TV ao Vivo', id: 'live' },
  { icon: Film, label: 'Filmes', id: 'movies' },
  { icon: PlayCircle, label: 'Séries', id: 'series' },
  { icon: Heart, label: 'Favoritos', id: 'favorites' },
  { icon: Settings, label: 'Ajustes', id: 'settings' },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

function FocusableMenuItem({ item, activeTab, isExpanded, onTabChange }: any) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onTabChange(item.id)
  });

  return (
    <button
      ref={ref}
      className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''} ${focused ? styles.focused : ''}`}
      onClick={() => onTabChange(item.id)}
      title={item.label}
    >
      <item.icon size={24} />
      {isExpanded && <span className={styles.label}>{item.label}</span>}
    </button>
  );
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'sidebar',
    trackChildren: true,
  });

  // Expande a sidebar automaticamente se algum item dela estiver focado via controle remoto
  useEffect(() => {
    if (hasFocusedChild) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [hasFocusedChild]);

  return (
    <FocusContext.Provider value={focusKey}>
      <aside 
        ref={ref}
        className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className={styles.logo}>
          <div className={styles.logoIcon}>SF</div>
          {isExpanded && <span className={styles.logoText}>SkyFlow</span>}
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => (
            <FocusableMenuItem 
              key={item.id} 
              item={item} 
              activeTab={activeTab} 
              isExpanded={isExpanded} 
              onTabChange={onTabChange} 
            />
          ))}
        </nav>
      </aside>
    </FocusContext.Provider>
  );
}
