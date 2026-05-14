'use client';

import React, { useState, useEffect } from 'react';

export default function AtivarPage() {
    const [formData, setFormData] = useState({
        mac: '',
        url: '',
        user: '',
        password: '',
        days: 365, // Fixo em 365 dias (Anual)
        reseller_id: 'ADMIN' // Usando o ADMIN que acabamos de criar no banco
    });

    // Novos estados para controlar o Saldo Real do Revendedor
    const [resellerCredits, setResellerCredits] = useState<number | null>(null);
    const [resellerName, setResellerName] = useState<string>('Carregando...');

    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({
        type: null,
        message: ''
    });

    const [isLoading, setIsLoading] = useState(false);

    // Função para buscar o saldo atualizado do revendedor no backend Python
    const fetchSaldo = async () => {
        try {
            // Como ainda não criamos uma rota dedicada de perfil, podemos criar uma ou simular
            // Por enquanto, vamos buscar o saldo batendo em uma rota simples se você tiver, 
            // ou atualizamos o saldo logo após o retorno de uma ativação de sucesso.
            // Dica: Se quiser buscar no início, você pode simular ou deixar fixo até criarmos a rota de saldo.
            setResellerName('Administrador');
            setResellerCredits(10); // Valor inicial de segurança (ele atualiza real após ativar)
        } catch (error) {
            console.error("Erro ao buscar dados do revendedor:", error);
        }
    };

    useEffect(() => {
        fetchSaldo();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: null, message: '' });

        try {
            const response = await fetch('http://localhost:8000/api/v1/devices/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({
                    type: 'success',
                    message: `Ativado com sucesso! Expira em: ${data.expires_at}`
                });
                // Atualiza o saldo na tela na hora com o valor retornado pelo Python!
                if (data.credits_remaining !== undefined) {
                    setResellerCredits(data.credits_remaining);
                }
            } else {
                throw new Error(data.detail || 'Erro ao ativar dispositivo');
            }
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-card">
                {/* NOVO TOPO: Barra de Status com o Saldo do Revendedor */}
                <div className="reseller-badge">
                    <div className="reseller-info">
                        <span className="dot"></span>
                        <p>Revendedor: <strong>{resellerName}</strong></p>
                    </div>
                    <div className="credits-info">
                        <p>Saldo: <strong>{resellerCredits !== null ? `${resellerCredits} Cr.` : '...'}</strong></p>
                    </div>
                </div>

                <header className="admin-header">
                    <h1>Nuvix <span>Painel</span></h1>
                    <p>Gestão de Ativação Anual</p>
                </header>

                <form onSubmit={handleSubmit} className="admin-form">
                    <div className="input-group">
                        <label>ID DO DISPOSITIVO (MAC)</label>
                        <input
                            type="text"
                            placeholder="Ex: 68EE5CB28CD4"
                            value={formData.mac}
                            onChange={(e) => setFormData({ ...formData, mac: e.target.value.toUpperCase() })}
                            required
                        />
                    </div>

                    <div className="input-row">
                        <div className="input-group flex-1">
                            <label>USUÁRIO IPTV</label>
                            <input
                                type="text"
                                placeholder="Usuário"
                                value={formData.user}
                                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group flex-1">
                            <label>SENHA IPTV</label>
                            <input
                                type="password"
                                placeholder="Senha"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>URL DO SERVIDOR</label>
                        <input
                            type="text"
                            placeholder="http://exemplo.com:80"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            required
                        />
                    </div>

                    <div className="info-badge">
                        Plano Padrão: <strong>365 Dias (Acesso Anual)</strong>
                    </div>

                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? 'PROCESSANDO...' : 'ATIVAR ACESSO ANUAL'}
                    </button>
                </form>

                {status.type && (
                    <div className={`alert ${status.type}`}>
                        {status.message}
                    </div>
                )}
            </div>

            <style jsx>{`
        .admin-container {
          min-height: 100vh;
          background: radial-gradient(circle at center, #111 0%, #000 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', -apple-system, sans-serif;
          padding: 20px;
        }
        .admin-card {
          background: #141414;
          padding: 40px 50px 50px;
          border-radius: 32px;
          border: 1px solid rgba(139, 92, 246, 0.2);
          width: 100%;
          max-width: 650px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 20px rgba(139, 92, 246, 0.05);
        }
        
        /* CSS do Novo Badge de Saldo */
        .reseller-badge {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px 20px;
          border-radius: 16px;
          margin-bottom: 25px;
          font-size: 0.85rem;
        }
        .reseller-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 10px #10b981;
        }
        .reseller-badge p { margin: 0; color: #aaa; }
        .reseller-badge strong { color: #fff; }
        .credits-info strong { color: #8b5cf6; font-size: 0.95rem; }

        .admin-header {
          text-align: center;
          margin-bottom: 35px;
        }
        h1 { margin: 0; font-size: 2.6rem; color: #fff; letter-spacing: -1.5px; font-weight: 800; }
        h1 span { color: #8b5cf6; }
        .admin-header p { color: #666; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px; }
        
        .admin-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .input-row {
          display: flex;
          gap: 20px;
          width: 100%;
        }
        .flex-1 { flex: 1; }
        .input-group {
          display: flex;
          flex-direction: column;
        }
        label {
          font-size: 0.72rem;
          color: #8b5cf6;
          margin-bottom: 8px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        input {
          background: #000;
          border: 1px solid #222;
          padding: 16px;
          border-radius: 14px;
          color: #fff;
          font-size: 1rem;
          transition: all 0.3s ease;
          width: 100%;
        }
        input:focus {
          border-color: #8b5cf6;
          background: #050505;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
          outline: none;
        }
        .info-badge {
          background: rgba(139, 92, 246, 0.06);
          border: 1px dashed rgba(139, 92, 246, 0.2);
          padding: 15px;
          border-radius: 14px;
          text-align: center;
          font-size: 0.85rem;
          color: #ccc;
        }
        .info-badge strong { color: #8b5cf6; }
        .submit-btn {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          border: none;
          border-radius: 16px;
          color: white;
          font-weight: 800;
          font-size: 1.05rem;
          cursor: pointer;
          margin-top: 5px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 20px rgba(139, 92, 246, 0.2);
        }
        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px rgba(139, 92, 246, 0.3);
          filter: brightness(1.1);
        }
        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .alert {
          margin-top: 25px;
          padding: 15px;
          border-radius: 16px;
          text-align: center;
          font-size: 0.95rem;
          font-weight: 600;
        }
        .success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
      `}</style>
        </div>
    );
}