'use client';
import React, { useState, useEffect } from 'react';
import styles from './AtivarForm.module.css';

interface AtivarFormProps {
    onSuccess: () => void;
    setCredits: (credits: number) => void;
}

export default function AtivarForm({ onSuccess, setCredits }: AtivarFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ mac: '', url: '', user: '', password: '' });
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Estado da verificação do MAC
    const [verifyingMac, setVerifyingMac] = useState(false);
    const [macCheckResult, setMacCheckResult] = useState<{
        status: 'active' | 'expired' | 'not_activated' | 'inactive';
        expiresAt?: string;
        message?: string;
    } | null>(null);
    const [deviceKey, setDeviceKey] = useState('');
    const [mode, setMode] = useState<'normal' | 'claim'>('normal');

    // Executa a checagem do MAC quando o campo mudar e tiver tamanho válido
    useEffect(() => {
        const checkMac = async () => {
            const cleanMac = formData.mac.trim().toUpperCase();
            if (cleanMac.length < 12) {
                setMacCheckResult(null);
                setMode('normal');
                return;
            }

            setVerifyingMac(true);
            try {
                const res = await fetch('http://localhost:8000/api/v1/devices/check-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mac: cleanMac }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setMacCheckResult({
                        status: data.status,
                        expiresAt: data.expires_at,
                        message: data.message
                    });

                    if (data.status === 'active') {
                        // Se o dispositivo já estiver ativo, entra no modo de vinculação automática (migração)
                        setMode('claim');
                    } else {
                        setMode('normal');
                    }
                } else {
                    setMacCheckResult(null);
                    setMode('normal');
                }
            } catch {
                setMacCheckResult(null);
                setMode('normal');
            } finally {
                setVerifyingMac(false);
            }
        };

        const timeout = setTimeout(() => {
            // Só dispara se tiver pelo menos 12 caracteres (tamanho básico de MAC sem pontuação)
            const cleanMac = formData.mac.replace(/[^A-F0-9]/gi, '');
            if (cleanMac.length >= 12 || formData.mac.length >= 12) {
                checkMac();
            }
        }, 800); // Debounce de 800ms para evitar requisições a cada tecla

        return () => clearTimeout(timeout);
    }, [formData.mac]);

    const handleSubmit = async (e: React.FormEvent, daysToActivate: number) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus(null);
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
                setStatus({ type: 'success', msg: daysToActivate === 7 ? 'Teste gerado com sucesso!' : 'Ativado com sucesso!' });
                setCredits(data.credits_remaining);
                setFormData({ mac: '', url: '', user: '', password: '' });
                setDeviceKey('');
                setMacCheckResult(null);
                setMode('normal');
                onSuccess();
            } else { 
                setStatus({ type: 'error', msg: data.detail || 'Erro ao ativar' }); 
            }
        } catch { 
            setStatus({ type: 'error', msg: 'Erro de conexão' }); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceKey.trim()) {
            setStatus({ type: 'error', msg: 'Por favor, insira a Chave do Dispositivo.' });
            return;
        }

        setIsLoading(true);
        setStatus(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8000/api/v1/devices/claim-device', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mac: formData.mac.trim().toUpperCase(),
                    device_key: deviceKey.trim().toUpperCase(),
                    url: formData.url.trim(),
                    user: formData.user.trim(),
                    password: formData.password.trim()
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ 
                    type: 'success', 
                    msg: `Dispositivo vinculado com sucesso! Expiração preservada: ${formatExpiration(data.expires_at)}` 
                });
                setFormData({ mac: '', url: '', user: '', password: '' });
                setDeviceKey('');
                setMacCheckResult(null);
                setMode('normal');
                onSuccess();
            } else { 
                setStatus({ type: 'error', msg: data.detail || 'Erro ao vincular dispositivo' }); 
            }
        } catch { 
            setStatus({ type: 'error', msg: 'Erro de conexão com o servidor.' }); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const formatExpiration = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Ativar Dispositivo</h2>
            <form className={styles.form}>
                <div style={{ position: 'relative' }}>
                    <input
                        className={styles.input}
                        placeholder="MAC ADDRESS (Ex: 00:AA:BB...)"
                        value={formData.mac} 
                        onChange={e => setFormData({ ...formData, mac: e.target.value.toUpperCase() })}
                    />
                    {verifyingMac && (
                        <span style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.8rem',
                            color: '#a78bfa'
                        }}>Verificando...</span>
                    )}
                </div>

                {/* Mensagens sobre o estado do MAC */}
                {macCheckResult && (
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '16px',
                        fontSize: '0.85rem'
                    }}>
                        {macCheckResult.status === 'active' && (
                            <span style={{ color: '#34d399', fontWeight: 600 }}>
                                🟢 Este aparelho já possui licença ATIVA até {formatExpiration(macCheckResult.expiresAt)}.
                            </span>
                        )}
                        {macCheckResult.status === 'expired' && (
                            <span style={{ color: '#f87171', fontWeight: 600 }}>
                                🔴 Licença anterior expirou em {formatExpiration(macCheckResult.expiresAt)}. Nova ativação necessária.
                            </span>
                        )}
                        {macCheckResult.status === 'not_activated' && (
                            <span style={{ color: '#a78bfa' }}>
                                ℹ️ Aparelho livre para nova ativação (nunca ativado antes).
                            </span>
                        )}
                        {macCheckResult.status === 'inactive' && (
                            <span style={{ color: '#fbbf24' }}>
                                ⚠️ Dispositivo registrado, aguardando ativação inicial.
                            </span>
                        )}
                    </div>
                )}

                <div className={styles.row}>
                    <input className={`${styles.input} ${styles.flex1}`} placeholder="User" value={formData.user} onChange={e => setFormData({ ...formData, user: e.target.value })} />
                    <input className={`${styles.input} ${styles.flex1}`} type="password" placeholder="Pass" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <input className={styles.input} placeholder="Server URL" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />

                {mode === 'claim' ? (
                    <div style={{
                        background: 'rgba(124, 58, 237, 0.08)',
                        border: '1.5px dashed rgba(124, 58, 237, 0.3)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px'
                    }}>
                        <h4 style={{ margin: '0 0 8px', color: '#a78bfa', fontSize: '0.9rem' }}>Vincular Aparelho Ativo (Troca de Revendedor)</h4>
                        <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.4 }}>
                            Para migrar este cliente ativo para o seu painel de graça, você deve fornecer a <strong>Chave do Dispositivo (Device Key)</strong> do cliente.
                        </p>
                        <input
                            className={styles.input}
                            placeholder="Chave do Dispositivo (Ex: A1B2C3)"
                            value={deviceKey}
                            onChange={e => setDeviceKey(e.target.value.toUpperCase())}
                            style={{ marginBottom: '12px' }}
                        />
                        <div className={styles.row}>
                            <button 
                                type="button" 
                                className={`${styles.button} ${styles.flex1}`} 
                                disabled={isLoading} 
                                onClick={handleClaim}
                            >
                                {isLoading ? 'VINCULANDO...' : 'VINCULAR APARELHO (GRÁTIS)'}
                            </button>
                            <button 
                                type="button" 
                                className={`${styles.button} ${styles.flex1}`} 
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                onClick={() => setMode('normal')}
                            >
                                FORÇAR NOVA ATIVAÇÃO (1 ANO)
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.row}>
                        <button type="button" className={`${styles.button} ${styles.flex1}`} style={{ backgroundColor: '#ff9800' }} disabled={isLoading} onClick={(e) => handleSubmit(e, 7)}>
                            {isLoading ? 'PROCESSANDO...' : 'TESTE DE 7 DIAS'}
                        </button>
                        <button type="button" className={`${styles.button} ${styles.flex1}`} disabled={isLoading} onClick={(e) => handleSubmit(e, 365)}>
                            {isLoading ? 'PROCESSANDO...' : 'ATIVAÇÃO (1 ANO)'}
                        </button>
                    </div>
                )}
            </form>
            {status && (
                <div className={`${styles.statusMessage} ${status.type === 'success' ? styles.success : styles.error}`}>
                    {status.msg}
                </div>
            )}
        </div>
    );
}
