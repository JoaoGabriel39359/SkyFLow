'use client';
import { LayoutDashboard, Tv, Users, CreditCard, LogOut } from 'lucide-react';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeTab, setActiveTab, credits }: any) {
    const menu = [
        { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'ativar', label: 'Ativar TV', icon: Tv },
        { id: 'clientes', label: 'Clientes Ativos', icon: Users },
        { id: 'pagamento', label: 'Comprar Créditos', icon: CreditCard },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logoContainer}>
                <h1 className={styles.logoTitle}>NUVIX<span className={styles.logoHighlight}>PRO</span></h1>
                <p className={styles.logoSubtitle}>Dealer Panel</p>
            </div>

            <nav className={styles.nav}>
                {menu.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : styles.navItemInactive}`}
                    >
                        <item.icon size={20} /> {item.label}
                    </button>
                ))}
            </nav>

            <div className={styles.footer}>
                <div className={styles.balanceCard}>
                    <p className={styles.balanceLabel}>Saldo em Conta</p>
                    <p className={styles.balanceValue}>{credits} <span className={styles.balanceCurrency}>CR</span></p>
                </div>
                <button className={styles.logoutBtn}>
                    <LogOut size={16} /> Sair
                </button>
            </div>
        </aside>
    );
}