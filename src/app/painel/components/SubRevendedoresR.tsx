import { useCallback, useEffect, useState, type FormEvent } from 'react';
import styles from './SubRevendedores.module.css';

type Device = {
    mac_address: string;
    iptv_user: string;
    iptv_url: string;
    expires_at: string;
    is_active: boolean;
    updated_at: string;
};

type SubReseller = {
    id: string;
    username: string;
    credits: number;
    created_at: string;
};

type SubRevendedoresProps = {
    token: string | null;
    onCreditUpdate: () => void | Promise<void>;
};

export default function SubRevendedores({ token, onCreditUpdate }: SubRevendedoresProps) {
    const [subResellers, setSubResellers] = useState<SubReseller[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState<SubReseller | null>(null);
    const [showDevicesModal, setShowDevicesModal] = useState<{ reseller: SubReseller; devices: Device[] } | null>(null);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const [transferAmount, setTransferAmount] = useState('');

    const fetchSubResellers = useCallback(async () => {
        if (!token) return;

        try {
            const res = await fetch('http://localhost:8000/api/v1/resellers/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setSubResellers(await res.json());
        } catch (e) {
            console.error(e);
        }
    }, [token]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            fetchSubResellers();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [fetchSubResellers]);

    const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:8000/api/v1/resellers/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setShowCreateModal(false);
                setForm({ username: '', password: '' });
                fetchSubResellers();
            } else {
                alert('Erro ao criar sub-revendedor');
            }
        } catch {
            alert('Erro de conexão');
        }
    };

    const handleTransfer = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!showTransferModal) return;

        try {
            const res = await fetch('http://localhost:8000/api/v1/resellers/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ to_reseller_id: showTransferModal.id, amount: parseInt(transferAmount) })
            });
            if (res.ok) {
                setShowTransferModal(null);
                setTransferAmount('');
                fetchSubResellers();
                onCreditUpdate();
                alert('Transferência concluída!');
            } else {
                const data = await res.json();
                alert(data.detail || 'Erro na transferência');
            }
        } catch {
            alert('Erro de conexão');
        }
    };

    const handleViewDevices = async (reseller: SubReseller) => {
        setLoadingDevices(true);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/resellers/${reseller.id}/devices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setShowDevicesModal({ reseller, devices: data.devices });
            } else {
                alert('Erro ao carregar clientes do sub-revendedor');
            }
        } catch (e) {
            alert('Erro de conexão');
        } finally {
            setLoadingDevices(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Sub-revendedores</h2>
                <button className={styles.btnPrimary} onClick={() => setShowCreateModal(true)}>+ Cadastrar Novo</button>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.th}>Usuário</th>
                            <th className={styles.th}>Créditos</th>
                            <th className={styles.th}>Data de Criação</th>
                            <th className={styles.th}>Ações</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {subResellers.map((r) => (
                            <tr key={r.id}>
                                <td className={styles.td}><strong>{r.username}</strong></td>
                                <td className={styles.td}><span style={{color: '#8b5cf6', fontWeight: 900}}>{r.credits} CR</span></td>
                                <td className={styles.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                                <td className={styles.td} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button className={styles.btnTransfer} onClick={() => setShowTransferModal(r)}>
                                        Enviar Créditos
                                    </button>
                                    <button className={styles.btnView} onClick={() => handleViewDevices(r)} disabled={loadingDevices}>
                                        {loadingDevices ? '...' : 'Ver Clientes'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {subResellers.length === 0 && (
                            <tr>
                                <td colSpan={4} className={styles.td} style={{textAlign: 'center', color: '#6b7280'}}>Nenhum sub-revendedor cadastrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Criação */}
            {showCreateModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>Novo Sub-revendedor</h3>
                        <form onSubmit={handleCreate}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Nome de Usuário</label>
                                <input className={styles.input} required value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Senha de Acesso</label>
                                <input className={styles.input} type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnCancel} onClick={() => setShowCreateModal(false)}>Cancelar</button>
                                <button type="submit" className={styles.btnSubmit}>Criar Conta</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Transferência */}
            {showTransferModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>Enviar Créditos para {showTransferModal.username}</h3>
                        <form onSubmit={handleTransfer}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Quantidade (CR)</label>
                                <input className={styles.input} type="number" min="1" required value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnCancel} onClick={() => setShowTransferModal(null)}>Cancelar</button>
                                <button type="submit" className={styles.btnSubmit}>Transferir Agora</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Clientes do Sub-Revendedor */}
            {showDevicesModal && (
                <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowDevicesModal(null); }}>
                    <div className={styles.modal} style={{ maxWidth: '780px', width: '95%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 className={styles.modalTitle} style={{ marginBottom: 0 }}>
                                Clientes de <span style={{ color: '#8b5cf6' }}>{showDevicesModal.reseller.username}</span>
                            </h3>
                            <button onClick={() => setShowDevicesModal(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.4rem' }}>✕</button>
                        </div>

                        {showDevicesModal.devices.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                                Este sub-revendedor ainda não ativou nenhum cliente.
                            </p>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead className={styles.thead}>
                                        <tr>
                                            <th className={styles.th}>MAC Address</th>
                                            <th className={styles.th}>Usuário IPTV</th>
                                            <th className={styles.th}>Status</th>
                                            <th className={styles.th}>Expira em</th>
                                        </tr>
                                    </thead>
                                    <tbody className={styles.tbody}>
                                        {showDevicesModal.devices.map((d) => {
                                            const expired = d.expires_at && new Date(d.expires_at) < new Date();
                                            return (
                                                <tr key={d.mac_address}>
                                                    <td className={styles.td}><code style={{ fontSize: '0.8rem' }}>{d.mac_address}</code></td>
                                                    <td className={styles.td}>{d.iptv_user}</td>
                                                    <td className={styles.td}>
                                                        <span style={{
                                                            padding: '2px 10px',
                                                            borderRadius: '999px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: expired ? '#3b1a1a' : '#1a3b2a',
                                                            color: expired ? '#f87171' : '#34d399'
                                                        }}>
                                                            {expired ? 'Expirado' : 'Ativo'}
                                                        </span>
                                                    </td>
                                                    <td className={styles.td}>
                                                        {d.expires_at ? new Date(d.expires_at).toLocaleDateString('pt-BR') : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: '16px', textAlign: 'right' }}>
                            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                Total: {showDevicesModal.devices.length} cliente(s)
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
