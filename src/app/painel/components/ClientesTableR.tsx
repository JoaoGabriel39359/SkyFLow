'use client';
import React, { useState } from 'react';
import styles from './ClientesTable.module.css';
import type { ResellerDevice } from '../types';

type ClientesTableProps = {
    devices: ResellerDevice[];
    onEditSuccess?: () => void;
};

export default function ClientesTable({ devices, onEditSuccess }: ClientesTableProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<ResellerDevice | null>(null);
    
    // Estados do formulário do modal
    const [iptvUrl, setIptvUrl] = useState('');
    const [iptvUser, setIptvUser] = useState('');
    const [iptvPass, setIptvPass] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleOpenEdit = (device: ResellerDevice) => {
        setSelectedDevice(device);
        setIptvUrl(device.iptv_url || '');
        setIptvUser(device.iptv_user || '');
        setIptvPass(device.iptv_pass || '');
        setStatusMsg(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedDevice(null);
        setStatusMsg(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDevice) return;

        setIsLoading(true);
        setStatusMsg(null);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8000/api/v1/devices/update-playlist-reseller', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mac: selectedDevice.mac_address,
                    url: iptvUrl.trim(),
                    user: iptvUser.trim(),
                    password: iptvPass.trim(),
                })
            });

            const data = await res.json();

            if (res.ok) {
                setStatusMsg({ type: 'success', text: 'Playlist atualizada com sucesso!' });
                
                // Dispara o callback para recarregar os dados no painel
                if (onEditSuccess) {
                    onEditSuccess();
                }

                // Fecha o modal após 1.2 segundos para o revendedor ver a mensagem de sucesso
                setTimeout(() => {
                    handleCloseModal();
                }, 1200);
            } else {
                setStatusMsg({ type: 'error', text: data.detail || 'Erro ao atualizar a playlist.' });
            }
        } catch {
            setStatusMsg({ type: 'error', text: 'Erro ao conectar com o servidor.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Gestão de Clientes</h2>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.th}>Dispositivo</th>
                            <th className={styles.th}>Usuário</th>
                            <th className={styles.th}>Vencimento</th>
                            <th className={styles.th}>Status</th>
                            <th className={styles.th}>Ações</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {devices.map((d) => (
                            <tr key={d.mac_address}>
                                <td className={`${styles.td} ${styles.macAddress}`}>{d.mac_address}</td>
                                <td className={`${styles.td} ${styles.user}`}>{d.iptv_user}</td>
                                <td className={`${styles.td} ${styles.date}`}>{new Date(d.expires_at).toLocaleDateString()}</td>
                                <td className={styles.td}><span className={styles.statusBadge}>ATIVO</span></td>
                                <td className={styles.td}>
                                    <button 
                                        className={styles.editBtn}
                                        onClick={() => handleOpenEdit(d)}
                                    >
                                        ✏️ Editar Lista
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {devices.length === 0 && (
                            <tr>
                                <td colSpan={5} className={styles.td} style={{ textAlign: 'center', color: '#6b7280' }}>
                                    Nenhum cliente cadastrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edição */}
            {isModalOpen && selectedDevice && (
                <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle}>Editar Playlist</h3>
                        <p className={styles.modalSubtitle}>
                            Dispositivo: <strong style={{ color: '#8b5cf6' }}>{selectedDevice.mac_address}</strong>
                        </p>

                        {statusMsg && (
                            <div className={`${styles.statusMessage} ${statusMsg.type === 'success' ? styles.success : styles.error}`}>
                                {statusMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleSave}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>URL do Servidor IPTV</label>
                                <input
                                    className={styles.input}
                                    placeholder="http://servidor.xyz:8080"
                                    value={iptvUrl}
                                    onChange={(e) => setIptvUrl(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>

                            <div className={styles.inputRow}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Usuário</label>
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
                                    <label className={styles.label}>Senha</label>
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

                            <div className={styles.modalActions}>
                                <button 
                                    type="button" 
                                    className={styles.btnCancel} 
                                    onClick={handleCloseModal}
                                    disabled={isLoading}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className={styles.btnSubmit} 
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
