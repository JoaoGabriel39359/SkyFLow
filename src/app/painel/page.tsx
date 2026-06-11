'use client';
import React, { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import Sidebar from './components/SidebarR';
import Dashboard from './components/DashboardR';
import AtivarForm from './components/AtivarFormR';
import ClientesTable from './components/ClientesTableR';
import Pagamento from './components/PagamentoR';
import SubRevendedores from './components/SubRevendedoresR';
import type { ResellerDevice, ResellerTab } from './types';

export default function PainelRevendedor() {
    const [activeTab, setActiveTab] = useState<ResellerTab>('home');
    const [resellerCredits, setResellerCredits] = useState<number | null>(null);
    const [devices, setDevices] = useState<ResellerDevice[]>([]);
    const [loading, setLoading] = useState(true);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/painel/login';
    };

    const refreshData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/painel/login';
            return;
        }
        try {
            const response = await fetch(`http://localhost:8000/api/v1/devices/list/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json() as ResellerDevice[];
                setDevices(data);
            }
            
            // O ideal é buscar os dados atualizados do usuário (me) na API.
            const userData = JSON.parse(localStorage.getItem('user') || '{}') as { credits?: number };
            setResellerCredits(userData.credits ?? 0);
            
        } catch (error) {
            console.error("Erro ao sincronizar dados:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            refreshData();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [refreshData]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Carregando painel...</div>;

    return (
        <div className={styles.container}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} credits={resellerCredits} onLogout={handleLogout} />

            <main className={styles.main}>
                <div className={styles.content}>
                    {activeTab === 'home' && <Dashboard devices={devices} credits={resellerCredits} />}
                    {activeTab === 'ativar' && <AtivarForm onSuccess={refreshData} setCredits={setResellerCredits} />}
                    {activeTab === 'clientes' && <ClientesTable devices={devices} onEditSuccess={refreshData} />}
                    {activeTab === 'subrevendedores' && <SubRevendedores token={localStorage.getItem('token')} onCreditUpdate={refreshData} />}
                    {activeTab === 'pagamento' && <Pagamento />}
                </div>
            </main>
        </div>
    );
}
