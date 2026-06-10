'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
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
import type { PlayerMode } from '@/lib/playerSettings';
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
  playerMode?: PlayerMode;
  contentType?: 'live' | 'movies' | 'series';
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

function ProgressControl({
  currentTime,
  duration,
  progressPercent,
  label,
  onSeekBackward,
  onSeekForward,
}: {
  currentTime: number;
  duration: number;
  progressPercent: number;
  label: string;
  onSeekBackward: () => void;
  onSeekForward: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: 'player-progress',
    onEnterPress: onSeekForward,
    onArrowPress: (direction) => {
      if (direction === 'left') {
        onSeekBackward();
        return false;
      }

      if (direction === 'right') {
        onSeekForward();
        return false;
      }

      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.progressControl} ${focused ? styles.focused : ''}`}
      onClick={onSeekForward}
      aria-label={label}
    >
      <span className={styles.timeText}>{formatTime(currentTime)}</span>
      <span className={styles.progressTrack}>
        <span className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        <span className={styles.progressThumb} style={{ left: `${progressPercent}%` }} />
      </span>
      <span className={styles.timeText}>{formatTime(duration)}</span>
    </button>
  );
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';

  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const paddedSeconds = String(seconds).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');

  if (hours <= 0) {
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  return `${hours}:${paddedMinutes}:${paddedSeconds}`;
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
  playerMode = 'auto',
  contentType = 'live',
  language,
}: VideoPlayerProps) {
  const copy = appCopy[language].player;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeout = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekFeedback, setSeekFeedback] = useState('');
  const seekFeedbackTimeout = useRef<number | null>(null);
  const isVod = contentType !== 'live';
  const hasKnownDuration = isVod && Number.isFinite(duration) && duration > 0 && duration !== Infinity;
  const progressPercent = hasKnownDuration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const { ref, focusKey } = useFocusable({
    focusKey: 'video-player',
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
    preferredChildFocusKey: 'player-play',
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

  const showSeekFeedback = useCallback((label: string) => {
    setSeekFeedback(label);

    if (seekFeedbackTimeout.current) {
      window.clearTimeout(seekFeedbackTimeout.current);
    }

    seekFeedbackTimeout.current = window.setTimeout(() => {
      setSeekFeedback('');
      seekFeedbackTimeout.current = null;
    }, 850);
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !hasKnownDuration) return;

    const nextTime = Math.min(duration, Math.max(0, video.currentTime + seconds));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    showSeekFeedback(seconds > 0 ? '+30s' : '-30s');
    showControls(seconds > 0 ? 'player-forward-30' : 'player-rewind-30');
  }, [duration, hasKnownDuration, showControls, showSeekFeedback]);

  useEffect(() => {
    let hls: Hls | null = null;
    let triedHls = false;
    let triedNative = false;
    const video = videoRef.current;
    if (!video) return undefined;

    const nativeHlsSupport = Boolean(
      video.canPlayType('application/vnd.apple.mpegurl') ||
      video.canPlayType('application/x-mpegURL')
    );
    const normalizedUrl = url.toLowerCase();
    const isHlsStream = normalizedUrl.includes('.m3u8') || normalizedUrl.includes('m3u8');
    const isDirectVideoFile = /\.(mp4|webm|ogg|ogv|mov)(\?|#|$)/i.test(url);

    const showPlaybackError = () => {
      setPlaybackError(copy.playbackError);
    };

    const playVideo = () => {
      video.play().catch((error) => {
        console.log('Auto-play blocked or delayed', error);
      });
    };

    const destroyHls = () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };

    const startNativePlayback = () => {
      triedNative = true;
      destroyHls();
      video.src = url;
      video.load();
      playVideo();
    };

    const startHlsPlayback = () => {
      if (!Hls.isSupported()) {
        if (playerMode === 'auto' && !triedNative) {
          startNativePlayback();
          return;
        }

        showPlaybackError();
        return;
      }

      triedHls = true;
      destroyHls();
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, playVideo);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (playerMode === 'auto' && !triedNative) {
            startNativePlayback();
            return;
          }

          showPlaybackError();
        }
      });
    };

    const handleVideoError = () => {
      if (playerMode === 'auto' && !triedHls && !isDirectVideoFile) {
        startHlsPlayback();
        return;
      }

      showPlaybackError();
    };

    setPlaybackError('');
    setCurrentTime(0);
    setDuration(0);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.addEventListener('error', handleVideoError);

    if (playerMode === 'native') {
      startNativePlayback();
    } else if (playerMode === 'hls') {
      startHlsPlayback();
    } else if (nativeHlsSupport || isDirectVideoFile) {
      startNativePlayback();
    } else if (isHlsStream || Hls.isSupported()) {
      startHlsPlayback();
    } else {
      startNativePlayback();
    }

    return () => {
      video.removeEventListener('error', handleVideoError);
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [copy.playbackError, playerMode, url]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('player-play');
    }, 0);

    scheduleControlsHide();

    return () => {
      window.clearTimeout(timeout);

      if (hideControlsTimeout.current) {
        window.clearTimeout(hideControlsTimeout.current);
      }

      if (seekFeedbackTimeout.current) {
        window.clearTimeout(seekFeedbackTimeout.current);
      }
    };
  }, [scheduleControlsHide]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const updateCurrentTime = () => setCurrentTime(video.currentTime || 0);
    const updateDuration = () => {
      const nextDuration = video.duration;
      setDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0);
    };

    video.addEventListener('timeupdate', updateCurrentTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('play', updateCurrentTime);
    video.addEventListener('pause', updateCurrentTime);

    updateCurrentTime();
    updateDuration();

    return () => {
      video.removeEventListener('timeupdate', updateCurrentTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('play', updateCurrentTime);
      video.removeEventListener('pause', updateCurrentTime);
    };
  }, [url]);

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
        return;
      }

      if ((event.key === 'MediaRewind' || event.key === 'j') && hasKnownDuration) {
        event.preventDefault();
        seekBy(-30);
        return;
      }

      if ((event.key === 'MediaFastForward' || event.key === 'l') && hasKnownDuration) {
        event.preventDefault();
        seekBy(30);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasKnownDuration, hasNext, hasPrevious, onClose, onNext, onPrevious, seekBy, togglePlay]);

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

        {playbackError && (
          <div className={styles.errorMessage} role="alert">
            {playbackError}
          </div>
        )}

        {seekFeedback && (
          <div className={styles.seekFeedback} aria-live="polite">
            {seekFeedback}
          </div>
        )}

        <div className={`${styles.bottomControls} ${hasKnownDuration ? styles.vodControls : styles.liveControls}`}>
          {hasKnownDuration && (
            <ProgressControl
              currentTime={currentTime}
              duration={duration}
              progressPercent={progressPercent}
              label={copy.progress}
              onSeekBackward={() => seekBy(-30)}
              onSeekForward={() => seekBy(30)}
            />
          )}

          <div className={styles.controlsRow}>
            {hasKnownDuration && (
              <PlayerButton
                focusKey="player-rewind-30"
                className={styles.controlBtn}
                onPress={() => seekBy(-30)}
                title={copy.rewind30}
              >
                <RotateCcw size={23} />
                <span>{copy.rewind30}</span>
              </PlayerButton>
            )}

            <PlayerButton
              focusKey="player-play"
              className={`${styles.controlBtn} ${styles.primaryControlBtn}`}
              onPress={togglePlay}
              title={isPaused ? copy.play : copy.pause}
            >
              {isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
              <span>{isPaused ? copy.play : copy.pause}</span>
            </PlayerButton>

            {hasKnownDuration && (
              <PlayerButton
                focusKey="player-forward-30"
                className={styles.controlBtn}
                onPress={() => seekBy(30)}
                title={copy.forward30}
              >
                <span>{copy.forward30}</span>
                <RotateCw size={23} />
              </PlayerButton>
            )}

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
        </div>

        <div className={styles.controlsHint}>
          <span>{copy.hintArrows}</span>
          <span>{copy.hintOk}</span>
          <span>{hasKnownDuration ? copy.hintSeek : copy.hintChannels}</span>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
