'use client';

import React, { useRef } from 'react';
import {
  useFocusable,
  FocusContext,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './Row.module.css';

interface Channel {
  id: string;
  name: string;
  logo: string;
  url?: string;
}

interface RowProps {
  rowId: string;
  title: string;
  channels: Channel[];
  rowIndex: number;
  isLastRow: boolean;
  onEndReached?: () => void;
  onChannelClick: (channel: Channel) => void;
}

interface FocusableCardProps {
  channel: Channel;
  cardFocusKey: string;
  isLastRow: boolean;
  onLastRowFocus?: () => void;
  onClick: (channel: Channel) => void;
}

const createFocusKeyPart = (value: string | number) =>
  String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

function FocusableCard({
  channel,
  cardFocusKey,
  isLastRow,
  onLastRowFocus,
  onClick,
}: FocusableCardProps) {
  const { ref, focused } = useFocusable({
    focusKey: cardFocusKey,
    onEnterPress: () => onClick(channel),
    onFocus: () => {
      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }

      // TV: ao focar qualquer item da última linha, carrega o próximo bloco.
      if (isLastRow) {
        onLastRowFocus?.();
      }
    },
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={`${styles.card} ${focused ? styles.cardFocused : ''}`}
      onClick={() => onClick(channel)}
    >
      <img
        src={channel.logo}
        alt={channel.name}
        className={styles.thumbnail}
        loading="lazy"
      />

      <div className={styles.cardOverlay}>
        <span className={styles.channelName}>{channel.name}</span>
      </div>
    </div>
  );
}

export default function Row({
  rowId,
  title,
  channels,
  rowIndex,
  isLastRow,
  onEndReached,
  onChannelClick,
}: RowProps) {
  const hasTriggeredLoad = useRef(false);
  const rowFocusKey = `row-${createFocusKeyPart(rowId)}`;

  const { ref, focusKey } = useFocusable({
    focusKey: rowFocusKey,
  });

  const handleLastRowFocus = () => {
    if (!isLastRow || hasTriggeredLoad.current) return;

    hasTriggeredLoad.current = true;
    onEndReached?.();
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div className={styles.row} ref={ref}>
        <h2 className={styles.title}>{title}</h2>

        <div className={styles.container}>
          <div className={styles.slider}>
            {channels.map((channel, index) => (
              <FocusableCard
                key={`${rowIndex}-${channel.id}-${index}`}
                channel={channel}
                cardFocusKey={`${rowFocusKey}-card-${createFocusKeyPart(channel.id || index)}`}
                isLastRow={isLastRow}
                onLastRowFocus={handleLastRowFocus}
                onClick={onChannelClick}
              />
            ))}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
