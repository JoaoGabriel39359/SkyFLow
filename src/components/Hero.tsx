'use client';

import React from 'react';
import { Play, Info } from 'lucide-react';
import styles from './Hero.module.css';

interface HeroProps {
  channel: {
    name: string;
    logo: string;
    category: string;
  };
}

export default function Hero({ channel }: HeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.overlay}></div>
      <img src={channel.logo} alt={channel.name} className={styles.background} />
      
      <div className={styles.content}>
        <span className={styles.category}>{channel.category}</span>
        <h1 className={styles.title}>{channel.name}</h1>
        <p className={styles.description}>
          Assista agora aos melhores canais com qualidade 4K. Estabilidade garantida e 
          a melhor experiência de Smart TV do mercado.
        </p>
        
        <div className={styles.actions}>
          <button className={styles.playBtn}>
            <Play fill="currentColor" size={24} />
            <span>Assistir</span>
          </button>
          <button className={styles.infoBtn}>
            <Info size={24} />
            <span>Mais Informações</span>
          </button>
        </div>
      </div>
    </section>
  );
}
