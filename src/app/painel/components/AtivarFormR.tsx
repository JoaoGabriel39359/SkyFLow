'use client';
import React, { useState } from 'react';
import styles from './AtivarForm.module.css';

interface AtivarFormProps {
    onSuccess: () => void;
    setCredits: (credits: number) => void;
}

export default function AtivarForm({ onSuccess, setCredits }: AtivarFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ mac: '', url: '', user: '', password: '', days: 365, reseller_id: 'ADMIN' });
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent, daysToActivate: number) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const dataToSend = { ...formData, days: daysToActivate };
            const res = await fetch('http://localhost:8000/api/v1/devices/activate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dataToSend),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', msg: dataToSend.days === 7 ? 'Teste gerado com sucesso!' : 'Ativado com sucesso!' });
                setCredits(data.credits_remaining);
                setFormData({ ...formData, mac: '', user: '', password: '' });
                onSuccess();
            } else { setStatus({ type: 'error', msg: data.detail || 'Erro ao ativar' }); }
        } catch { setStatus({ type: 'error', msg: 'Erro de conexão' }); }
        finally { setIsLoading(false); }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Ativar Dispositivo</h2>
            <form className={styles.form}>
                <input
                    className={styles.input}
                    placeholder="MAC ADDRESS (Ex: 00:AA:BB...)"
                    value={formData.mac} onChange={e => setFormData({ ...formData, mac: e.target.value.toUpperCase() })}
                />
                <div className={styles.row}>
                    <input className={`${styles.input} ${styles.flex1}`} placeholder="User" value={formData.user} onChange={e => setFormData({ ...formData, user: e.target.value })} />
                    <input className={`${styles.input} ${styles.flex1}`} type="password" placeholder="Pass" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <input className={styles.input} placeholder="Server URL" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />

                <div className={styles.row}>
                    <button type="button" className={`${styles.button} ${styles.flex1}`} style={{ backgroundColor: '#ff9800' }} disabled={isLoading} onClick={(e) => handleSubmit(e, 7)}>
                        {isLoading ? 'PROCESSANDO...' : 'TESTE DE 7 DIAS'}
                    </button>
                    <button type="button" className={`${styles.button} ${styles.flex1}`} disabled={isLoading} onClick={(e) => handleSubmit(e, 365)}>
                        {isLoading ? 'PROCESSANDO...' : 'ATIVAÇÃO (1 ANO)'}
                    </button>
                </div>
            </form>
            {status && (
                <div className={`${styles.statusMessage} ${status.type === 'success' ? styles.success : styles.error}`}>
                    {status.msg}
                </div>
            )}
        </div>
    );
}
