'use client';
import { useState } from 'react';
import styles from './page.module.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('http://localhost:8000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: username.trim().toLowerCase(), 
                    password: password.trim() 
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Salvar token no navegador e redirecionar para o painel
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/painel';
            } else {
                setError(data.detail || 'Erro ao fazer login');
            }
        } catch {
            setError('Falha de conexão com o servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <h1 className={styles.title}>NUVIX<span>PRO</span></h1>
                
                <form className={styles.form} onSubmit={handleLogin}>
                    {error && <div className={styles.error}>{error}</div>}
                    
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Usuário</label>
                        <input 
                            type="text" 
                            className={styles.input} 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Senha</label>
                        <input 
                            type="password" 
                            className={styles.input} 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.button} disabled={loading}>
                        {loading ? 'Entrando...' : 'ENTRAR NO PAINEL'}
                    </button>
                </form>
            </div>
        </div>
    );
}
