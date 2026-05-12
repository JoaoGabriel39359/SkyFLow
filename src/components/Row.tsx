'use client';

import React, { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import styles from './Row.module.css';

interface Channel {
  id: string;
  name: string;
  logo: string;
}

interface RowProps {
  title: string;
  channels: Channel[];
  onChannelClick: (channel: Channel) => void;
}

function FocusableCard({ channel, onClick }: { channel: Channel, onClick: (c: Channel) => void }) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onClick(channel),
    onFocus: () => {
      // Faz o scroll automático do carrossel para manter o item focado visível
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  });

  return (
    <div 
      ref={ref}
      className={`${styles.card} ${focused ? styles.cardFocused : ''}`} 
      onClick={() => onClick(channel)}
    >
      <img src={channel.logo} alt={channel.name} className={styles.thumbnail} />
      <div className={styles.cardOverlay}>
        <span className={styles.channelName}>{channel.name}</span>
      </div>
    </div>
  );
}

export default function Row({ title, channels, onChannelClick }: RowProps) {
  const { ref, focusKey } = useFocusable();

  return (
    <FocusContext.Provider value={focusKey}>
      <div className={styles.row} ref={ref}>
        <h2 className={styles.title}>{title}</h2>
        
        <div className={styles.container}>
          <div className={styles.slider}>
            {channels.map((channel) => (
              <FocusableCard key={channel.id} channel={channel} onClick={onChannelClick} />
            ))}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
