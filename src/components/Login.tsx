'use client';

import React, { useState } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  onLogin: (data: { url: string; user: string; pass: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ url, user, pass });
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Nuvix</h1>
        <p className={styles.subtitle}>
  Sua experiência premium de streaming começa aqui
</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>URL do Servidor</label>
            <input 
              type="text" 
              placeholder="https://servidor.com" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Usuário</label>
            <input 
              type="text" 
              placeholder="Digite seu usuário" 
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="Digite sua senha" 
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className={styles.loginBtn}>Continuar</button>
        </form>
        
        <p className={styles.disclaimer}>
          Nuvix é um player de mídia e não hospeda conteúdos.
        </p>
      </div>
    </div>
  );
}
