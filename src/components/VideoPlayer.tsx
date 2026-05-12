'use client';

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { X } from 'lucide-react';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  url: string;
  onClose: () => void;
  title: string;
}

export default function VideoPlayer({ url, onClose, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let hls: Hls;

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={32} />
        </button>
      </div>
      
      <video 
        ref={videoRef} 
        className={styles.video} 
        controls 
        autoPlay
      />

      <div className={styles.controlsHint}>
        Use o controle para navegar pelos canais
      </div>
    </div>
  );
}
