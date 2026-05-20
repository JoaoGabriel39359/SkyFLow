'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  useFocusable,
  FocusContext,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import { appCopy, type AppLanguage } from '@/lib/i18n';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  url: string;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  title: string;
  controlsHideDelayMs?: number;
  autoPlayNext?: boolean;
  language: AppLanguage;
}

type PlayerButtonProps = {
  focusKey: string;
  className: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  title: string;
};

function PlayerButton({
  focusKey,
  className,
  disabled = false,
  onPress,
  children,
  title,
}: PlayerButtonProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onArrowPress: () => true,
    onEnterPress: () => {
      if (!disabled) {
        onPress();
      }
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${className} ${disabled ? styles.disabled : ''} ${focused ? styles.focused : ''}`}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onPress();
        }
      }}
      title={title}
    >
      {children}
    </button>
  );
}

export default function VideoPlayer({
  url,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  title,
  controlsHideDelayMs = 3500,
  autoPlayNext = false,
  language,
}: VideoPlayerProps) {
  const copy = appCopy[language].player;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeout = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const { ref, focusKey } = useFocusable({
    focusKey: 'video-player',
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
    preferredChildFocusKey: 'player-back',
    onArrowPress: () => false,
  });

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    setFocus('video-player');
  }, []);

  const scheduleControlsHide = useCallback(() => {
    if (hideControlsTimeout.current) {
      window.clearTimeout(hideControlsTimeout.current);
    }

    hideControlsTimeout.current = window.setTimeout(hideControls, controlsHideDelayMs);
  }, [controlsHideDelayMs, hideControls]);

  const showControls = useCallback((focusKeyToRestore?: string) => {
    setControlsVisible(true);
    scheduleControlsHide();

    if (focusKeyToRestore) {
      window.setTimeout(() => {
        setFocus(focusKeyToRestore);
      }, 0);
    }
  }, [scheduleControlsHide]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(e => console.log("Play blocked", e));
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  useEffect(() => {
    let hls: Hls | null = null;

    if (videoRef.current) {
      const video = videoRef.current;
      const isM3u8 = url.includes('.m3u8') || url.includes('.ts');

      if (isM3u8 && Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log("Auto-play blocked", e));
        });
      } else {
        // Nativo para mp4, webm ou fallback em dispositivos Apple (que rodam m3u8 nativamente)
        video.src = url;
        video.play().catch(e => console.log("Auto-play blocked", e));
      }
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [url]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('player-back');
    }, 0);

    scheduleControlsHide();

    return () => {
      window.clearTimeout(timeout);

      if (hideControlsTimeout.current) {
        window.clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [scheduleControlsHide]);

  useEffect(() => {
    const handleActivity = (event: KeyboardEvent) => {
      const key = event.key;
      const shouldOnlyRevealControls =
        !controlsVisible &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter'].includes(key);

      if (shouldOnlyRevealControls) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showControls('player-play');
        return;
      }

      showControls();
    };

    const handlePointerActivity = () => {
      showControls();
    };

    window.addEventListener('keydown', handleActivity, true);
    window.addEventListener('mousemove', handlePointerActivity);
    window.addEventListener('mousedown', handlePointerActivity);

    return () => {
      window.removeEventListener('keydown', handleActivity, true);
      window.removeEventListener('mousemove', handlePointerActivity);
      window.removeEventListener('mousedown', handlePointerActivity);
    };
  }, [controlsVisible, showControls]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.key === 'ChannelDown' || event.key === 'PageDown') && hasPrevious) {
        event.preventDefault();
        onPrevious();
        return;
      }

      if ((event.key === 'ChannelUp' || event.key === 'PageUp') && hasNext) {
        event.preventDefault();
        onNext();
        return;
      }

      if (event.key === ' ' || event.key === 'MediaPlayPause') {
        event.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious, togglePlay]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div className={`${styles.container} ${controlsVisible ? styles.controlsVisible : styles.controlsHidden}`} ref={ref}>
        <div className={styles.header} aria-hidden={!controlsVisible}>
          <PlayerButton
            focusKey="player-back"
            className={styles.backBtn}
            onPress={onClose}
            title={copy.back}
          >
            <ArrowLeft size={24} />
            <span>{copy.back}</span>
          </PlayerButton>

          <h2 className={styles.title}>{title}</h2>

          <PlayerButton
            focusKey="player-close"
            className={styles.iconBtn}
            onPress={onClose}
            title={copy.close}
          >
            <X size={30} />
          </PlayerButton>
        </div>

        <PlayerButton
          focusKey="player-previous"
          className={`${styles.channelBtn} ${styles.previousBtn}`}
          disabled={!hasPrevious}
          onPress={onPrevious}
          title={copy.channelPrevious}
        >
          <ChevronLeft size={42} />
        </PlayerButton>

        <PlayerButton
          focusKey="player-next"
          className={`${styles.channelBtn} ${styles.nextBtn}`}
          disabled={!hasNext}
          onPress={onNext}
          title={copy.channelNext}
        >
          <ChevronRight size={42} />
        </PlayerButton>

        <video
          ref={videoRef}
          className={styles.video}
          tabIndex={-1}
          autoPlay
          onEnded={() => {
            if (autoPlayNext && hasNext) {
              onNext();
            }
          }}
          onPlay={() => setIsPaused(false)}
          onPause={() => setIsPaused(true)}
          onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
        />

        <div className={styles.bottomControls}>
          <PlayerButton
            focusKey="player-play"
            className={styles.controlBtn}
            onPress={togglePlay}
            title={isPaused ? copy.play : copy.pause}
          >
            {isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
            <span>{isPaused ? copy.play : copy.pause}</span>
          </PlayerButton>

          <PlayerButton
            focusKey="player-bottom-previous"
            className={styles.controlBtn}
            disabled={!hasPrevious}
            onPress={onPrevious}
            title={copy.channelPrevious}
          >
            <ChevronLeft size={24} />
            <span>{copy.previous}</span>
          </PlayerButton>

          <PlayerButton
            focusKey="player-bottom-next"
            className={styles.controlBtn}
            disabled={!hasNext}
            onPress={onNext}
            title={copy.channelNext}
          >
            <span>{copy.next}</span>
            <ChevronRight size={24} />
          </PlayerButton>

          <PlayerButton
            focusKey="player-mute"
            className={styles.controlBtn}
            onPress={toggleMute}
            title={isMuted ? copy.sound : copy.mute}
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            <span>{isMuted ? copy.sound : copy.mute}</span>
          </PlayerButton>
        </div>

        <div className={styles.controlsHint}>
          <span>{copy.hintArrows}</span>
          <span>{copy.hintOk}</span>
          <span>{copy.hintChannels}</span>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
