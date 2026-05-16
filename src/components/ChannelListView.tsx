'use client';

import React, { useEffect } from 'react';
import { ArrowLeft, LogOut, Play } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './ChannelListView.module.css';

export type ChannelListViewChannel = {
  id: string;
  name: string;
  logo: string;
  url?: string;
};

type ChannelListViewProps = {
  mediaTitle: string;
  categoryName: string;
  channels: ChannelListViewChannel[];
  selectedChannel: ChannelListViewChannel | null;
  preparedChannelId: string | null;
  isLoading: boolean;
  onBack: () => void;
  onLogout: () => void;
  onChannelFocus: (channel: ChannelListViewChannel) => void;
  onChannelPress: (channel: ChannelListViewChannel) => void;
  onPreviewPress: () => void;
};

export const createChannelFocusKeyPart = (value: string | number) =>
  String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export const getChannelFocusKey = (channelId: string | number) =>
  `content-channel-${createChannelFocusKeyPart(channelId)}`;

function HeaderButton({
  focusKey,
  className,
  onPress,
  children,
  title,
}: {
  focusKey: string;
  className: string;
  onPress: () => void;
  children: React.ReactNode;
  title: string;
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${className} ${focused ? styles.focused : ''}`}
      onClick={onPress}
      title={title}
    >
      {children}
    </button>
  );
}

function ChannelListItem({
  channel,
  index,
  selected,
  prepared,
  onFocus,
  onPress,
}: {
  channel: ChannelListViewChannel;
  index: number;
  selected: boolean;
  prepared: boolean;
  onFocus: (channel: ChannelListViewChannel) => void;
  onPress: (channel: ChannelListViewChannel) => void;
}) {
  const focusKey = getChannelFocusKey(channel.id);
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onPress(channel),
    onFocus: () => {
      onFocus(channel);

      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    },
    onArrowPress: (direction) => {
      if (direction === 'right') {
        setFocus('content-preview');
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.channelItem} ${focused ? styles.focused : ''} ${selected ? styles.selected : ''}`}
      onClick={() => onPress(channel)}
    >
      <span className={styles.channelIndex}>{index + 1}</span>
      <span
        className={styles.channelLogo}
        style={{ backgroundImage: channel.logo ? `url("${channel.logo}")` : undefined }}
      >
        {!channel.logo && 'N'}
      </span>
      <span className={styles.channelText}>
        <span className={styles.channelName}>{channel.name}</span>
        <span className={styles.channelMeta}>{prepared ? 'Pronto para tela cheia' : 'OK seleciona, OK novamente assiste'}</span>
      </span>
    </button>
  );
}

function PreviewPanel({
  channel,
  prepared,
  onPreviewPress,
}: {
  channel: ChannelListViewChannel | null;
  prepared: boolean;
  onPreviewPress: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: 'content-preview',
    onEnterPress: onPreviewPress,
    onArrowPress: (direction) => {
      if (direction === 'left' && channel) {
        setFocus(getChannelFocusKey(channel.id));
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.previewPanel} ${focused ? styles.focused : ''}`}
      onClick={onPreviewPress}
      disabled={!channel}
    >
      {channel ? (
        <>
          <div
            className={styles.previewArt}
            style={{ backgroundImage: channel.logo ? `url("${channel.logo}")` : undefined }}
          >
            {!channel.logo && <span>N</span>}
          </div>
          <div className={styles.previewOverlay}>
            <span className={styles.previewBadge}>{prepared ? 'Selecionado' : 'Preview leve'}</span>
            <h2>{channel.name}</h2>
            <p>OK para assistir em tela cheia</p>
          </div>
          <span className={styles.playIcon}>
            <Play size={34} fill="currentColor" />
          </span>
        </>
      ) : (
        <div className={styles.emptyPreview}>
          <span>N</span>
          <h2>Selecione um canal</h2>
          <p>Use a lista ao lado para preparar o preview.</p>
        </div>
      )}
    </button>
  );
}

export default function ChannelListView({
  mediaTitle,
  categoryName,
  channels,
  selectedChannel,
  preparedChannelId,
  isLoading,
  onBack,
  onLogout,
  onChannelFocus,
  onChannelPress,
  onPreviewPress,
}: ChannelListViewProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'content-list-view',
    trackChildren: true,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (selectedChannel) {
        setFocus(getChannelFocusKey(selectedChannel.id));
        return;
      }

      setFocus(channels.length > 0 ? getChannelFocusKey(channels[0].id) : 'content-back');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [categoryName, channels, selectedChannel]);

  const prepared = Boolean(selectedChannel && preparedChannelId === selectedChannel.id);

  return (
    <FocusContext.Provider value={focusKey}>
      <section className={styles.screen} ref={ref}>
        <header className={styles.header}>
          <HeaderButton
            focusKey="content-back"
            className={styles.backButton}
            onPress={onBack}
            title="Voltar para pastas"
          >
            <ArrowLeft size={24} />
            <span>Pastas</span>
          </HeaderButton>

          <div className={styles.heading}>
            <span>{mediaTitle} / {categoryName}</span>
            <h1>{categoryName}</h1>
          </div>

          <HeaderButton
            focusKey="content-logout"
            className={styles.iconButton}
            onPress={onLogout}
            title="Sair"
          >
            <LogOut size={27} />
          </HeaderButton>
        </header>

        <div className={styles.layout}>
          <div className={styles.listPanel}>
            <div className={styles.listTitle}>
              <span>{channels.length} itens</span>
              <strong>Canais</strong>
            </div>

            {isLoading ? (
              <div className={styles.loading}>Carregando conteudos...</div>
            ) : (
              <div className={styles.channelList}>
                {channels.length > 0 ? (
                  channels.map((channel, index) => (
                    <ChannelListItem
                      key={`${channel.id}-${index}`}
                      channel={channel}
                      index={index}
                      selected={selectedChannel?.id === channel.id}
                      prepared={preparedChannelId === channel.id}
                      onFocus={onChannelFocus}
                      onPress={onChannelPress}
                    />
                  ))
                ) : (
                  <div className={styles.emptyList}>Nenhum conteudo encontrado nesta pasta.</div>
                )}
              </div>
            )}
          </div>

          <aside className={styles.previewColumn}>
            <PreviewPanel
              channel={selectedChannel}
              prepared={prepared}
              onPreviewPress={onPreviewPress}
            />

            <div className={styles.remoteHint}>
              <span>↑↓ canais</span>
              <span>→ preview</span>
              <span>OK tela cheia</span>
            </div>
          </aside>
        </div>
      </section>
    </FocusContext.Provider>
  );
}
