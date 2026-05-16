import styles from './Pagamento.module.css';

export default function Pagamento() {
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Recarregar Créditos</h2>
            <div className={styles.grid}>
                <div className={styles.card}>
                    <span className={styles.badge}>Popular</span>
                    <h3 className={styles.cardTitle}>Pack Iniciante</h3>
                    <p className={styles.cardDesc}>10 Ativações Anuais</p>
                    <div className={styles.price}>R$ 150,00</div>
                    <button className={styles.button}>GERAR QR CODE PIX</button>
                </div>
            </div>
        </div>
    );
}