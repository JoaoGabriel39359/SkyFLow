'use client';
import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import Sidebar from './components/SidebarR';
import Dashboard from './components/DashboardR';
import AtivarForm from './components/AtivarFormR';
import ClientesTable from './components/ClientesTableR';
import Pagamento from './components/PagamentoR';

export default function PainelRevendedor() {
    const [activeTab, setActiveTab] = useState('home');
    const [resellerCredits, setResellerCredits] = useState<number | null>(null);
    const [devices, setDevices] = useState([]);

    const refreshData = async () => {
        try {
            const response = await fetch(`http://localhost:8000/api/v1/devices/list/ADMIN`);
            if (response.ok) {
                const data = await response.json();
                setDevices(data);
                setResellerCredits(prev => prev ?? 10);
            }
        } catch (error) {
            console.error("Erro ao sincronizar dados:", error);
        }
    };

    useEffect(() => { refreshData(); }, []);

    return (
        <div className={styles.container}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} credits={resellerCredits} />

            <main className={styles.main}>
                <div className={styles.content}>
                    {activeTab === 'home' && <Dashboard devices={devices} credits={resellerCredits} />}
                    {activeTab === 'ativar' && <AtivarForm onSuccess={refreshData} setCredits={setResellerCredits} />}
                    {activeTab === 'clientes' && <ClientesTable devices={devices} />}
                    {activeTab === 'pagamento' && <Pagamento />}
                </div>
            </main>
        </div>
    );
}