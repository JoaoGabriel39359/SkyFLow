'use client';
import React, { useState } from 'react';
import styles from './page.module.css';

export default function ClientManagementPage() {
    const [loginMac, setLoginMac] = useState('');
    const [loginKey, setLoginKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Estado pós-login
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [deviceData, setDeviceData] = useState<{
        mac: string;
        deviceKey: string;
        status: string;
        expiresAt: string | null;
    } | null>(null);

    // Campos da playlist
    const [iptvUrl, setIptvUrl] = useState('');
    const [iptvUser, setIptvUser] = useState('');
    const [iptvPass, setIptvPass] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsLoading(true);

        const macFormatted = loginMac.trim().toUpperCase();
        const keyFormatted = loginKey.trim().toUpperCase();

        if (!macFormatted || !keyFormatted) {
            setMessage({ type: 'error', text: 'Preencha todos os campos.' });
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch('http://localhost:8000/api/v1/devices/check-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mac: macFormatted }),
            });

            if (!res.ok) {
                setMessage({ type: 'error', text: 'Erro ao conectar com o servidor.' });
                setIsLoading(false);
                return;
            }

            const data = await res.json();

            if (data.status === 'not_activated') {
                setMessage({ type: 'error', text: 'Este dispositivo não está cadastrado no sistema.' });
                setIsLoading(false);
                return;
            }

            if (data.status === 'inactive') {
                setMessage({ type: 'error', text: 'A ativação do dispositivo está pendente.' });
                setIsLoading(false);
                return;
            }

            // Verifica se a chave coincide
            const serverKey = (data.device_key || '').trim().toUpperCase();
            if (serverKey !== keyFormatted) {
                setMessage({ type: 'error', text: 'Chave do dispositivo incorreta.' });
                setIsLoading(false);
                return;
            }

            // Sucesso no login
            setDeviceData({
                mac: macFormatted,
                deviceKey: keyFormatted,
                status: data.status,
                expiresAt: data.expires_at || null,
            });

            // Preenche as credenciais caso existam
            if (data.credentials) {
                setIptvUrl(data.credentials.url || '');
                setIptvUser(data.credentials.user || '');
                setIptvPass(data.credentials.pass || '');
            }

            setIsLoggedIn(true);
        } catch {
            setMessage({ type: 'error', text: 'Erro na conexão com o servidor.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePlaylist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceData) return;

        setMessage(null);
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:8000/api/v1/devices/update-playlist-public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mac: deviceData.mac,
                    device_key: deviceData.deviceKey,
                    url: iptvUrl.trim(),
                    user: iptvUser.trim(),
                    password: iptvPass.trim(),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Sua lista IPTV foi atualizada com sucesso!' });
            } else {
                setMessage({ type: 'error', text: data.detail || 'Erro ao atualizar a lista.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Erro na conexão com o servidor.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setDeviceData(null);
        setLoginMac('');
        setLoginKey('');
        setIptvUrl('');
        setIptvUser('');
        setIptvPass('');
        setMessage(null);
    };

    const formatExpirationDate = (dateStr: string | null) => {
        if (!dateStr) return 'Vitalício ou Indefinido';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.logo}>
                    <div className={styles.logoIcon}>📺</div>
                    <span className={styles.logoName}>
                        NUVIX<span> PLAY</span>
                    </span>
                </div>
                {isLoggedIn && (
                    <button onClick={handleLogout} className={styles.logoutBtn}>
                        Sair do Aparelho
                    </button>
                )}
            </header>

            {!isLoggedIn ? (
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Gerenciar Playlist</h2>
                    <p className={styles.cardSubtitle}>
                        Acesse para alterar as credenciais da sua lista ou trocar de revendedor.
                    </p>

                    {message && (
                        <div className={message.type === 'success' ? styles.statusSuccess : styles.statusError}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Endereço MAC do Aparelho</label>
                            <input
                                className={styles.input}
                                placeholder="Ex: 00:AA:BB:11:22:33"
                                value={loginMac}
                                onChange={(e) => setLoginMac(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Chave de Ativação (Device Key)</label>
                            <input
                                className={styles.input}
                                placeholder="Código de 6 dígitos que aparece na TV"
                                value={loginKey}
                                onChange={(e) => setLoginKey(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <button type="submit" className={styles.btnSubmit} disabled={isLoading}>
                            {isLoading ? 'Entrando...' : 'Acessar Aparelho'}
                        </button>
                    </form>
                </div>
            ) : (
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Gerenciar Playlist</h2>
                    <p className={styles.cardSubtitle}>
                        Atualize suas credenciais da lista IPTV abaixo. As alterações entram em vigor na hora!
                    </p>

                    <div className={styles.infoBox}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Dispositivo</span>
                            <span className={styles.infoValue}>{deviceData?.mac}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Status da Licença</span>
                            <span className={`${styles.badge} ${deviceData?.status === 'active' ? styles.badgeActive : styles.badgeExpired}`}>
                                {deviceData?.status === 'active' ? 'Ativo' : 'Expirado'}
                            </span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Expiração</span>
                            <span className={styles.infoValue}>{formatExpirationDate(deviceData?.expiresAt ?? null)}</span>
                        </div>
                    </div>

                    {message && (
                        <div className={message.type === 'success' ? styles.statusSuccess : styles.statusError}>
                            {message.text}
                        </div>
                    )}

                    {deviceData?.status === 'expired' && (
                        <div className={styles.statusError} style={{ textAlign: 'left', fontWeight: 'normal' }}>
                            ⚠️ <strong>Sua licença expirou.</strong> Você pode atualizar as credenciais abaixo para salvar a nova playlist, mas o aplicativo na TV continuará pedindo ativação até que você renove sua licença com um revendedor.
                        </div>
                    )}

                    <form onSubmit={handleSavePlaylist}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>URL do Servidor IPTV</label>
                            <input
                                className={styles.input}
                                placeholder="http://exemplo-servidor.xyz:8080"
                                value={iptvUrl}
                                onChange={(e) => setIptvUrl(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className={styles.inputRow}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Usuário IPTV</label>
                                <input
                                    className={styles.input}
                                    placeholder="usuario"
                                    value={iptvUser}
                                    onChange={(e) => setIptvUser(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Senha IPTV</label>
                                <input
                                    className={styles.input}
                                    type="password"
                                    placeholder="senha"
                                    value={iptvPass}
                                    onChange={(e) => setIptvPass(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className={styles.btnSubmit} disabled={isLoading}>
                            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </form>

                    <button onClick={handleLogout} className={styles.helpLink}>
                        Voltar e gerenciar outro dispositivo
                    </button>
                </div>
            )}
        </div>
    );
}
