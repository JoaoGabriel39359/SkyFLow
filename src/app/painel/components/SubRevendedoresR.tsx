import { useState, useEffect } from 'react';
import styles from './SubRevendedores.module.css';

export default function SubRevendedores({ token, onCreditUpdate }: any) {
    const [subResellers, setSubResellers] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState<any>(null);
    const [form, setForm] = useState({ username: '', password: '' });
    const [transferAmount, setTransferAmount] = useState('');

    const fetchSubResellers = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/v1/resellers/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setSubResellers(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { fetchSubResellers(); }, []);

    const handleCreate = async (e: any) => {
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
        } catch (e) {
            alert('Erro de conexão');
        }
    };

    const handleTransfer = async (e: any) => {
        e.preventDefault();
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
        } catch (e) {
            alert('Erro de conexão');
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
                        {subResellers.map((r: any) => (
                            <tr key={r.id}>
                                <td className={styles.td}><strong>{r.username}</strong></td>
                                <td className={styles.td}><span style={{color: '#8b5cf6', fontWeight: 900}}>{r.credits} CR</span></td>
                                <td className={styles.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                                <td className={styles.td}>
                                    <button className={styles.btnTransfer} onClick={() => setShowTransferModal(r)}>
                                        Enviar Créditos
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
        </div>
    );
}
