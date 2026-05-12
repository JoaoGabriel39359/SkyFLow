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
        <h1 className={styles.title}>SkyFlow IPTV</h1>
        <p className={styles.subtitle}>Entre com seus dados Xtream Codes</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>URL do Servidor</label>
            <input 
              type="text" 
              placeholder="http://exemplo.com:8080" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Usuário</label>
            <input 
              type="text" 
              placeholder="Seu usuário" 
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="Sua senha" 
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className={styles.loginBtn}>Entrar Agora</button>
        </form>
        
        <p className={styles.disclaimer}>
          Não fornecemos conteúdo. Este é apenas um player de mídia.
        </p>
      </div>
    </div>
  );
}
