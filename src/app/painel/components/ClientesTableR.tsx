import styles from './ClientesTable.module.css';

export default function ClientesTable({ devices }: any) {
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
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {devices.map((d: any) => (
                            <tr key={d.mac_address}>
                                <td className={`${styles.td} ${styles.macAddress}`}>{d.mac_address}</td>
                                <td className={`${styles.td} ${styles.user}`}>{d.iptv_user}</td>
                                <td className={`${styles.td} ${styles.date}`}>{new Date(d.expires_at).toLocaleDateString()}</td>
                                <td className={styles.td}><span className={styles.statusBadge}>ATIVO</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}