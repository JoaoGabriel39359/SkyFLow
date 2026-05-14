'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Row from '@/components/Row';
import VideoPlayer from '@/components/VideoPlayer';
import { getCategories, getStreams, buildStreamUrl } from '@/lib/iptvEngine';
import { getDeviceId } from '@/lib/device'; // Nova funcionalidade
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';

// Inicializa o controle global das setas do teclado/controle remoto
init({
  debug: false,
  visualDebug: false
});

const BATCH_SIZE = 3; // Número de categorias carregadas por vez

export default function Home() {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('live');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // --- NOVOS ESTADOS PARA O SISTEMA DE MAC ---
  const [isBlocked, setIsBlocked] = useState(true);
  const [activationData, setActivationData] = useState<any>(null);

  // Estados de Carregamento
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Estados de Dados
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [loadedCategories, setLoadedCategories] = useState<any[]>([]);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Determinar parâmetros com base na aba ativa
  const getActionParams = (tab: string) => {
    if (tab === 'movies') return { cat: 'get_vod_categories', stream: 'get_vod_streams', type: 'vod' as const };
    if (tab === 'series') return { cat: 'get_series_categories', stream: 'get_series', type: 'series' as const };
    return { cat: 'get_live_categories', stream: 'get_live_streams', type: 'live' as const };
  };

  // 1. Carregamento Inicial (MODIFICADO PARA USAR SUA API)
  useEffect(() => {
    const initData = async () => {
      const deviceId = getDeviceId();
      setIsInitialLoading(true);

      try {
        // Chamada para o seu Backend FastAPI
        const response = await fetch(`http://localhost:8000/api/v1/devices/check-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac: deviceId })
        });

        const data = await response.json();

        if (data.status === 'active') {
          // Se o backend liberou, usamos as credenciais que vieram do banco
          const creds = data.credentials;
          setCredentials(creds);
          setIsLoggedIn(true);
          setIsBlocked(false);

          // Lógica original de reset de listas
          setAllCategories([]);
          setLoadedCategories([]);

          const params = getActionParams(activeTab);
          const rawCats = await getCategories(creds.url, creds.user, creds.pass, params.cat);
          const cats = Array.isArray(rawCats) ? rawCats : [];
          setAllCategories(cats);

          // Carrega streams para a primeira leva de categorias
          await loadMoreStreams(creds, cats, 0, params);
        } else {
          // Se não ativado, mostra os dados na tela de bloqueio
          setActivationData(data);
          setIsBlocked(true);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("Erro no carregamento inicial/ativação:", error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initData();
  }, [activeTab]);

  // 2. Lógica para buscar os canais de um lote (batch) de categorias (INTEGRALMENTE MANTIDO)
  const loadMoreStreams = async (creds: any, fullCatList: any[], startIndex: number, params: any) => {
    const catsToLoad = fullCatList.slice(startIndex, startIndex + BATCH_SIZE);
    if (catsToLoad.length === 0) return;

    setIsLoadingMore(true);

    try {
      const categoryPromises = catsToLoad.map(async (cat: any) => {
        const streams = await getStreams(creds.url, creds.user, creds.pass, params.stream, cat.category_id);

        if (Array.isArray(streams) && streams.length > 0) {
          return {
            id: cat.category_id,
            name: cat.category_name,
            channels: streams.slice(0, 30).map((s: any) => {
              const streamId = s.stream_id || s.series_id;
              const name = s.name || s.title || 'Sem Nome';
              const logo = s.stream_icon || s.cover || 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=60';
              const extension = s.container_extension || 'm3u8';

              return {
                id: streamId,
                name: name,
                logo: logo,
                url: buildStreamUrl(creds.url, creds.user, creds.pass, params.type, streamId, extension)
              };
            })
          };
        }
        return null;
      });

      const newLoadedCats = (await Promise.all(categoryPromises)).filter(c => c !== null);
      setLoadedCategories(prev => [...prev, ...newLoadedCats]);
    } catch (error) {
      console.error("Erro ao buscar mais streams:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 3. Intersection Observer (INTEGRALMENTE MANTIDO)
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && !isInitialLoading && !isLoadingMore && loadedCategories.length < allCategories.length && credentials) {
      loadMoreStreams(credentials, allCategories, loadedCategories.length, getActionParams(activeTab));
    }
  }, [isInitialLoading, isLoadingMore, loadedCategories.length, allCategories, credentials, activeTab]);

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(element);

    return () => observer.unobserve(element);
  }, [handleObserver]);

  // Efeito de Foco (INTEGRALMENTE MANTIDO)
  useEffect(() => {
    if (!isInitialLoading && isLoggedIn && !isBlocked && loadedCategories.length > 0) {
      setFocus('sidebar');
    }
  }, [isInitialLoading, isLoggedIn, isBlocked, loadedCategories.length]);

  // --- RENDERS ---

  if (isInitialLoading) return (
    <div className="nuvixLoading">
      <div className="nuvixGlow"></div>
      <div className="nuvixLoaderCard">
        <h1>Nuvix</h1>
        <div className="loadingBar"><span></span></div>
        <p>Carregando sua experiência...</p>
      </div>
    </div>
  );

  // TELA DE BLOQUEIO (Substitui o seu antigo if(!isLoggedIn))
  if (isBlocked) {
    return (
      <div className="nuvixLoading">
        <div className="nuvixLoaderCard" style={{ background: '#111', padding: '50px', borderRadius: '25px', border: '1px solid #8b5cf6' }}>
          <h1 style={{ fontSize: '3rem' }}>Nuvix</h1>
          <p style={{ color: '#8b5cf6', fontWeight: 'bold', letterSpacing: '1px' }}>AGUARDANDO ATIVAÇÃO</p>
          <div style={{ margin: '25px 0', textAlign: 'left', background: '#000', padding: '20px', borderRadius: '15px' }}>
            <small style={{ color: '#666' }}>ID DO DISPOSITIVO:</small><br />
            <code style={{ fontSize: '1.4rem', color: '#fff' }}>{activationData?.mac}</code><br /><br />
            <small style={{ color: '#666' }}>CÓDIGO DE ATIVAÇÃO:</small><br />
            <code style={{ fontSize: '1.4rem', color: '#fff' }}>{activationData?.device_key}</code>
          </div>
          <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Envie esses dados para seu revendedor liberar seu acesso.</p>
        </div>
      </div>
    );
  }

  const heroChannel = loadedCategories.length > 0 && loadedCategories[0].channels.length > 0
    ? loadedCategories[0].channels[0] : null;

  return (
    <main style={{ marginLeft: isSidebarExpanded ? '260px' : '80px', minHeight: '100vh', transition: 'margin-left 0.28s ease' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onExpandedChange={setIsSidebarExpanded} />

      <div className="content-wrapper">
        {heroChannel && <Hero channel={heroChannel} />}

        <div style={{ marginTop: '-150px', position: 'relative', zIndex: 10 }}>
          {loadedCategories.map((category) => (
            <Row key={category.id} title={category.name} channels={category.channels} onChannelClick={(channel) => setSelectedChannel(channel)} />
          ))}

          {!isInitialLoading && loadedCategories.length === 0 && (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'white' }}>
              <h2>Nenhum conteúdo encontrado.</h2>
            </div>
          )}

          <div ref={observerTarget} style={{ height: '50px', width: '100%' }}></div>

          {isLoadingMore && (
            <div style={{ textAlign: 'center', color: '#8b5cf6', padding: '2rem' }}>
              Carregando mais categorias...
            </div>
          )}
        </div>
      </div>

      {selectedChannel && (
        <VideoPlayer url={selectedChannel.url} title={selectedChannel.name} onClose={() => setSelectedChannel(null)} />
      )}

      <style jsx global>{`
        .content-wrapper { padding-bottom: 5rem; }
        body { overflow: ${selectedChannel ? 'hidden' : 'auto'}; }
      `}</style>
    </main>
  );
}