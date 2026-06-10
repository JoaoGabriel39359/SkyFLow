'use client';
import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

// ─── Re-use existing painel components for admin mode ───
import Sidebar from '@/app/painel/components/SidebarR';
import Dashboard from '@/app/painel/components/DashboardR';
import AtivarForm from '@/app/painel/components/AtivarFormR';
import ClientesTable from '@/app/painel/components/ClientesTableR';
import Pagamento from '@/app/painel/components/PagamentoR';
import SubRevendedores from '@/app/painel/components/SubRevendedoresR';
import type { ResellerDevice, ResellerTab } from '@/app/painel/types';

// ─── Types ───────────────────────────────────────────────
type Plan = { days: 90 | 365; label: string; price: number; popular: boolean };

const PLANS: Plan[] = [
    { days: 90,  label: '3 Meses',  price: 30,  popular: false },
    { days: 365, label: '1 Ano',    price: 60,  popular: true  },
];

type ActivationStatus =
    | { type: 'success'; mac: string; deviceKey: string; expiresAt: string; plan: string }
    | { type: 'error'; msg: string }
    | null;

// ─── Login Modal ──────────────────────────────────────────
function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const body = new URLSearchParams();
            body.append('username', username.trim().toLowerCase());
            body.append('password', password.trim());
            const res = await fetch('http://localhost:8000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                onSuccess();
            } else {
                setError(data.detail || 'Usuário ou senha incorretos');
            }
        } catch {
            setError('Falha de conexão com o servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modalCard}>
                <h2 className={styles.modalTitle}>🔐 Área do Revendedor</h2>
                <p className={styles.modalSubtitle}>Faça login para acessar seu painel de gestão</p>
                <form onSubmit={handleSubmit}>
                    {error && <div className={styles.statusError}>{error}</div>}
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Usuário</label>
                        <input id="reseller-username" className={styles.input} type="text"
                            value={username} onChange={e => setUsername(e.target.value)}
                            placeholder="seu_usuario" required autoComplete="username" />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Senha</label>
                        <input id="reseller-password" className={styles.input} type="password"
                            value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" required autoComplete="current-password" />
                    </div>
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
                        <button type="submit" className={styles.btnLogin} disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar no Painel'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Admin Panel Overlay ───────────────────────────────────
function AdminPanel({ onClose }: { onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<ResellerTab>('home');
    const [resellerCredits, setResellerCredits] = useState<number | null>(null);
    const [devices, setDevices] = useState<ResellerDevice[]>([]);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const refreshData = useCallback(async () => {
        if (!token) return;
        try {
            const devRes = await fetch('http://localhost:8000/api/v1/devices/list/', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (devRes.ok) setDevices(await devRes.json());
            const userData = JSON.parse(localStorage.getItem('user') || '{}') as { credits?: number };
            setResellerCredits(userData.credits ?? 0);
        } catch { /* silent */ }
    }, [token]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            refreshData();
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [refreshData]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        onClose();
    };

    return (
        <div className={styles.adminOverlay}>
            <div className={styles.adminWrapper}>
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} credits={resellerCredits} onLogout={handleLogout} />
                <main className={styles.adminMain}>
                    {activeTab === 'home'            && <Dashboard devices={devices} credits={resellerCredits} />}
                    {activeTab === 'ativar'          && <AtivarForm onSuccess={refreshData} setCredits={setResellerCredits} />}
                    {activeTab === 'clientes'        && <ClientesTable devices={devices} />}
                    {activeTab === 'subrevendedores' && <SubRevendedores token={token} onCreditUpdate={refreshData} />}
                    {activeTab === 'pagamento'       && <Pagamento />}
                </main>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────
export default function ResellerPortalPage() {
    const params = useParams();
    const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug ?? '');

    const [pageLoading, setPageLoading] = useState(true);
    const [exists, setExists] = useState(false);
    const [resellerName, setResellerName] = useState('');

    // Portal state
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState({ mac: '', url: '', user: '', password: '' });
    const [activating, setActivating] = useState(false);
    const [status, setStatus] = useState<ActivationStatus>(null);

    // Admin state
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setIsLoggedIn(!!localStorage.getItem('token'));
            if (!slug) { setPageLoading(false); return; }
            fetch(`http://localhost:8000/api/v1/public/${slug}/info`)
                .then(r => r.json())
                .then(data => { if (data.exists) { setExists(true); setResellerName(data.username); } })
                .catch(() => {})
                .finally(() => setPageLoading(false));
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [slug]);

    const handleActivate = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedPlan) return;
        setActivating(true);
        setStatus(null);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/public/${slug}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mac: form.mac, url: form.url, user: form.user, password: form.password, days: selectedPlan.days }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', mac: data.mac, deviceKey: data.device_key, expiresAt: data.expires_at, plan: data.plan });
                setForm({ mac: '', url: '', user: '', password: '' });
                setSelectedPlan(null);
            } else {
                setStatus({ type: 'error', msg: data.detail || 'Erro ao ativar dispositivo' });
            }
        } catch {
            setStatus({ type: 'error', msg: 'Falha de conexão com o servidor. Tente novamente.' });
        } finally {
            setActivating(false);
        }
    };

    if (pageLoading) {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.spinner} />
                <span>Carregando portal...</span>
            </div>
        );
    }

    if (!exists) {
        return (
            <div className={styles.loadingScreen}>
                <span style={{ fontSize: '2.5rem' }}>😕</span>
                <span style={{ color: '#9ca3af', fontWeight: 600 }}>Portal não encontrado</span>
                <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>O revendedor &quot;{slug}&quot; não existe.</span>
            </div>
        );
    }

    return (
        <>
            <div className={styles.portal}>
                {/* ── Header ── */}
                <header className={styles.header}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>📺</div>
                        <span className={styles.logoName}>
                            {resellerName.toUpperCase()}<span> IPTV</span>
                        </span>
                    </div>

                    {isLoggedIn ? (
                        <button id="open-admin-btn" className={styles.adminBtn} onClick={() => setShowAdminPanel(true)}>
                            ⚙️ Meu Painel
                        </button>
                    ) : (
                        <button id="reseller-login-btn" className={styles.resellerBadge} onClick={() => setShowLoginModal(true)}>
                            🔐 Área do Revendedor
                        </button>
                    )}
                </header>

                {/* ── Hero Section ── */}
                <section className={styles.hero}>
                    <div className={styles.heroTag}>✨ Ativação Online — Rápida e Segura</div>
                    <h1 className={styles.heroTitle}>
                        Ative sua TV<br /><span>em minutos</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Escolha seu plano, preencha os dados e tenha acesso imediato ao melhor conteúdo IPTV.
                    </p>
                </section>

                {/* ── Plans ── */}
                <div className={styles.plansGrid}>
                    {PLANS.map(plan => (
                        <div
                            key={plan.days}
                            id={`plan-${plan.days}`}
                            className={`${styles.planCard} ${selectedPlan?.days === plan.days ? styles.planCardSelected : ''}`}
                            onClick={() => setSelectedPlan(plan)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && setSelectedPlan(plan)}
                        >
                            {plan.popular && <span className={styles.planPopularLabel}>🔥 Mais Popular</span>}
                            <div className={`${styles.planBadge} ${plan.popular ? styles.planBadgePrimary : styles.planBadgeSecondary}`}>
                                {plan.label}
                            </div>
                            <div className={styles.planDuration}>
                                {plan.days === 90 ? '3 meses de acesso completo' : '365 dias de acesso completo'}
                            </div>
                            <div className={styles.planPrice}><sup>R$</sup>{plan.price}</div>
                            <div className={styles.planPriceNote}>pagamento único • sem mensalidade</div>
                            <ul className={styles.planFeatures}>
                                <li>Canais ao vivo + filmes e séries</li>
                                <li>Suporte para Smart TV, Celular e PC</li>
                                <li>Ativação imediata online</li>
                                {plan.popular && <li>Melhor custo-benefício</li>}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* ── Activation Form ── */}
                <section className={styles.formSection}>
                    <div className={styles.formCard}>
                        <h2 className={styles.formTitle}>Preencha os dados do seu aparelho</h2>

                        {status?.type === 'success' && (
                            <div className={styles.statusSuccess}>
                                <strong>✅ Dispositivo ativado com sucesso!</strong>
                                MAC: {status.mac} &nbsp;|&nbsp; Plano: {status.plan}<br />
                                Válido até: <strong>{status.expiresAt}</strong><br />
                                Chave: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{status.deviceKey}</code>
                            </div>
                        )}
                        {status?.type === 'error' && (
                            <div className={styles.statusError}>⚠️ {status.msg}</div>
                        )}

                        {selectedPlan ? (
                            <div className={styles.planSelectedInfo}>
                                <span className={styles.planSelectedLabel}>🎯 Plano: {selectedPlan.label}</span>
                                <span className={styles.planSelectedPrice}>R$ {selectedPlan.price},00</span>
                            </div>
                        ) : (
                            <div className={styles.noPlanSelected}>👆 Selecione um plano acima para continuar</div>
                        )}

                        <form onSubmit={handleActivate}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>MAC Address do Aparelho</label>
                                <input id="public-mac" className={styles.input}
                                    placeholder="Ex: 00:1A:2B:3C:4D:5E"
                                    value={form.mac} onChange={e => setForm({ ...form, mac: e.target.value.toUpperCase() })} required />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>URL do Servidor IPTV</label>
                                <input id="public-url" className={styles.input}
                                    placeholder="http://servidor.iptv.com"
                                    value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
                            </div>
                            <div className={styles.inputRow}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Usuário IPTV</label>
                                    <input id="public-user" className={styles.input} placeholder="usuario"
                                        value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Senha IPTV</label>
                                    <input id="public-password" className={styles.input} type="password" placeholder="senha"
                                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                                </div>
                            </div>
                            <button id="public-activate-btn" type="submit" className={styles.btnSubmit} disabled={activating || !selectedPlan}>
                                {activating ? '⏳ Ativando...' : `⚡ Ativar Agora${selectedPlan ? ` — R$ ${selectedPlan.price},00` : ''}`}
                            </button>
                        </form>
                    </div>
                </section>

                {/* ── Footer ── */}
                <footer className={styles.footer}>
                    <p className={styles.footerText}>
                        Parceiro autorizado &nbsp;•&nbsp;{' '}
                        <button onClick={() => setShowLoginModal(true)}>Sou revendedor — fazer login</button>
                    </p>
                </footer>
            </div>

            {/* ── Modals / Overlays ── */}
            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    onSuccess={() => {
                        setShowLoginModal(false);
                        setIsLoggedIn(true);
                    }}
                />
            )}

            {showAdminPanel && (
                <AdminPanel onClose={() => { setShowAdminPanel(false); setIsLoggedIn(false); }} />
            )}
        </>
    );
}
