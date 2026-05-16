import styles from './Dashboard.module.css';
import type { ResellerDevice } from '../types';

type DashboardProps = {
    devices: ResellerDevice[];
    credits: number | null;
};

export default function Dashboard({ devices, credits }: DashboardProps) {
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Dashboard</h2>
            <div className={styles.grid}>
                <div className={styles.card}>
                    <p className={styles.cardLabel}>Clientes Totais</p>
                    <p className={styles.cardValue}>{devices.length}</p>
                </div>
                <div className={styles.card}>
                    <p className={styles.cardLabel}>Créditos</p>
                    <p className={`${styles.cardValue} ${styles.purpleText}`}>{credits}</p>
                </div>
                <div className={`${styles.card} ${styles.cardFlex}`}>
                    <div>
                        <p className={styles.cardLabel}>Nível</p>
                        <p className={styles.goldText}>GOLD</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
