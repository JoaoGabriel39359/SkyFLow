/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

// Importa recursos principais do React
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Importa os componentes visuais do app integrados ao repositório
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Row from '@/components/Row';
import VideoPlayer from '@/components/VideoPlayer';
import { getCategories, getStreams, buildStreamUrl } from '@/lib/iptvEngine';
import { getDeviceId } from '@/lib/device'; // Mecanismo de identificação por MAC
import { init, setFocus, useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

// Inicializa o controle global de setas e teclado para Smart TVs
init({
  debug: false,
  visualDebug: false,
});

// Define a quantidade de linhas de categorias renderizadas por lote (Batch)
const BATCH_SIZE = 4;

// Componente de Introdução institucional (Recriado fielmente com as classes globais do commit do amigo)
const HomeIntro = () => (
  <section className="homeIntro">
    <div className="homeIntroText">
      <span className="homeEyebrow">Nuvix Media Player</span>
      <h1>Entretenimento fluido para todos os momentos.</h1>
      <p>
        Organize seus canais, filmes e séries em uma experiência moderna,
        rápida e pensada para telas grandes.
      </p>
    </div>

    {/* Área visual animada da TV mockup com as classes do Git Diff */}
    <div className="homeHeroVisual">
      <div className="homePlayerMockup">
        <div className="homeTvAntenna">
          <span></span>
          <span></span>
        </div>
        <div className="homeTvAntennaBase"></div>
        <div className="homePlayerTop">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="homePlayerScreen">
          <div className="nuvixHeroBrand">
            <div className="nuvixHeroIcon">N</div>
            <div className="nuvixHeroWord">
              <span>N</span>uvix
            </div>
            <p>Streaming leve, rápido e pensado para TV.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

type LogoutConfirmModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

type LogoutConfirmButtonProps = {
  className: string;
  focusKey: string;
  onPress: () => void;
  children: React.ReactNode;
};

function LogoutConfirmButton({ className, focusKey, onPress, children }: LogoutConfirmButtonProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${className} ${focused ? 'modalButtonFocused' : ''}`}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function LogoutConfirmModal({ onCancel, onConfirm }: LogoutConfirmModalProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'logout-confirm-modal',
    trackChildren: true,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('logout-confirm-cancel');
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div className="logoutModalOverlay" role="presentation">
        <div className="logoutModal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="logout-modal-title">
          <div className="logoutModalIcon">N</div>
          <h2 id="logout-modal-title">Deseja realmente sair?</h2>
          <p>Ao confirmar, este dispositivo volta para a tela de ativacao do codigo.</p>

          <div className="logoutModalActions">
            <LogoutConfirmButton
              className="modalButton modalButtonGhost"
              focusKey="logout-confirm-cancel"
              onPress={onCancel}
            >
              Cancelar
            </LogoutConfirmButton>

            <LogoutConfirmButton
              className="modalButton modalButtonDanger"
              focusKey="logout-confirm-confirm"
              onPress={onConfirm}
            >
              Deslogar
            </LogoutConfirmButton>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}

export default function Home() {
  // Estados de Controle Base e Sincronia da Barra Lateral Fixa
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('home'); // Inicia na Home do seu amigo

  // --- ESTADOS DO SISTEMA DE TRAVA DE ATIVAÇÃO POR MAC ---
  const [isBlocked, setIsBlocked] = useState(true);
  const [activationData, setActivationData] = useState<any>(null);

  // Estados de Carregamento e Notificações Visuais de Rolagem
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Estados de Coleções e Categorias IPTV
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [loadedCategories, setLoadedCategories] = useState<any[]>([]);

  // Referência para manipulação do DOM (Fallback do scroll antigo)
  const observerTarget = useRef<HTMLDivElement>(null);
  const hasSetInitialFocus = useRef(false);

  const checkDeviceSecurity = useCallback(async () => {
    const deviceId = getDeviceId();
    setIsInitialLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/api/v1/devices/check-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: deviceId })
      });

      const data = await response.json();

      if (data.status === 'active') {
        setCredentials(data.credentials);
        setIsLoggedIn(true);
        setIsBlocked(false);
        setActivationData(null);
      } else {
        setActivationData(data);
        setCredentials(null);
        setIsBlocked(true);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error("Erro ao conectar no servidor de checagem:", error);
      setActivationData({ mac: deviceId, device_key: 'ERRO_BACKEND' });
      setCredentials(null);
      setIsBlocked(true);
      setIsLoggedIn(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Mapeia os parâmetros de requisição com base na aba de mídia ativa
  const getActionParams = (tab: string) => {
    if (tab.includes('movies')) return { cat: 'get_vod_categories', stream: 'get_vod_streams', type: 'vod' as const };
    if (tab.includes('series')) return { cat: 'get_series_categories', stream: 'get_series', type: 'series' as const };
    return { cat: 'get_live_categories', stream: 'get_live_streams', type: 'live' as const };
  };

  // Carregador assíncrono de lotes de canais por categoria (Batch System)
  const loadMoreStreams = useCallback(async (creds: any, fullCatList: any[], startIndex: number, params: any) => {
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
  }, []);

  // 1. CHECAGEM INICIAL DE ACESSO (Executado uma única vez ao iniciar o aplicativo)
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      checkDeviceSecurity();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [checkDeviceSecurity]);

  const handleLogout = useCallback(() => {
    setIsLogoutConfirmOpen(false);
    localStorage.removeItem('skyflow_device_id');
    hasSetInitialFocus.current = false;
    setSelectedChannel(null);
    setActiveTab('home');
    setAllCategories([]);
    setLoadedCategories([]);
    setCanScrollDown(false);
    checkDeviceSecurity();
  }, [checkDeviceSecurity]);

  // 2. NAVEGAÇÃO DE CONTEÚDO (Alterna as mídias IPTV)
  useEffect(() => {
    if (!isLoggedIn || !credentials) return;

    const updateViewContent = async () => {
      if (activeTab === 'home' || activeTab === 'search' || activeTab === 'settings') {
        setAllCategories([]);
        setLoadedCategories([]);
        return;
      }

      setAllCategories([]);
      setLoadedCategories([]);

      try {
        const params = getActionParams(activeTab);
        const rawCats = await getCategories(credentials.url, credentials.user, credentials.pass, params.cat);
        const cats = Array.isArray(rawCats) ? rawCats : [];
        setAllCategories(cats);

        await loadMoreStreams(credentials, cats, 0, params);
      } catch (error) {
        console.error("Erro na carga de mudança de aba:", error);
      }
    };

    updateViewContent();
  }, [activeTab, isLoggedIn, credentials, loadMoreStreams]);

  // TV: Carrega o próximo bloco de categorias de forma nativa quando o controle focar na última linha
  const handleLoadMoreByFocus = useCallback(() => {
    if (isInitialLoading || isLoadingMore || !credentials || loadedCategories.length >= allCategories.length) {
      return;
    }
    loadMoreStreams(credentials, allCategories, loadedCategories.length, getActionParams(activeTab));
  }, [isInitialLoading, isLoadingMore, credentials, loadedCategories.length, allCategories, activeTab, loadMoreStreams]);

  // 3. Monitoramento visual do indicador "Mais categorias abaixo" trazido pelo seu amigo
  useEffect(() => {
    const checkCanScrollDown = () => {
      const pageHeight = document.documentElement.scrollHeight;
      const screenHeight = window.innerHeight;
      const currentScroll = window.scrollY;

      const hasVerticalScroll = pageHeight > screenHeight + 80;
      const isNearBottom = currentScroll + screenHeight >= pageHeight - 120;

      setCanScrollDown(
        activeTab !== 'home' &&
        activeTab !== 'search' &&
        activeTab !== 'settings' &&
        !selectedChannel &&
        hasVerticalScroll &&
        !isNearBottom
      );
    };

    checkCanScrollDown();
    const timeout = setTimeout(checkCanScrollDown, 300);

    window.addEventListener('scroll', checkCanScrollDown, { passive: true });
    window.addEventListener('resize', checkCanScrollDown);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', checkCanScrollDown);
      window.removeEventListener('resize', checkCanScrollDown);
    };
  }, [activeTab, selectedChannel, loadedCategories.length, isLoadingMore]);

  // 4. Intersection Observer para scroll tradicional com mouse
  useEffect(() => {
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && !isInitialLoading && !isLoadingMore && loadedCategories.length < allCategories.length && credentials) {
        loadMoreStreams(credentials, allCategories, loadedCategories.length, getActionParams(activeTab));
      }
    };

    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(element);

    return () => observer.unobserve(element);
  }, [isInitialLoading, isLoadingMore, loadedCategories.length, allCategories, credentials, activeTab, loadMoreStreams]);

  // 5. Aciona o foco remoto inicial diretamente no menu
  useEffect(() => {
    if (!hasSetInitialFocus.current && !isInitialLoading && isLoggedIn && !isBlocked) {
      hasSetInitialFocus.current = true;
      setFocus('sidebar');
    }
  }, [isInitialLoading, isLoggedIn, isBlocked]);

  const playableChannels = useMemo(
    () => loadedCategories.flatMap((category) => category.channels),
    [loadedCategories]
  );

  const selectedChannelIndex = selectedChannel
    ? playableChannels.findIndex((channel) => channel.url === selectedChannel.url)
    : -1;

  const handleClosePlayer = useCallback(() => {
    setSelectedChannel(null);
    window.setTimeout(() => {
      setFocus('sidebar');
    }, 0);
  }, []);

  const handlePreviousChannel = useCallback(() => {
    if (selectedChannelIndex > 0) {
      setSelectedChannel(playableChannels[selectedChannelIndex - 1]);
    }
  }, [playableChannels, selectedChannelIndex]);

  const handleNextChannel = useCallback(() => {
    if (selectedChannelIndex >= 0 && selectedChannelIndex < playableChannels.length - 1) {
      setSelectedChannel(playableChannels[selectedChannelIndex + 1]);
    }
  }, [playableChannels, selectedChannelIndex]);

  // --- RENDERS CONDICIONAIS ---

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
          <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Envie esses dados para seu revendedor liberar seu acesso de 1 ano.</p>
        </div>
      </div>
    );
  }

  const heroChannel = loadedCategories.length > 0 && loadedCategories[0].channels.length > 0
    ? loadedCategories[0].channels[0] : null;

  return (
    // Como a Sidebar dele agora é FIXA e SEMPRE ABERTA (260px), empurramos o main usando padding fixo à esquerda!
    <main
      style={{
        paddingLeft: '260px',
        width: '100vw',
        minHeight: '100vh',
        backgroundColor: '#0a0a0a'
      }}
    >
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => setIsLogoutConfirmOpen(true)} />

      {activeTab === 'home' ? (
        <HomeIntro />
      ) : (
        <section style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          {heroChannel && <Hero channel={heroChannel} />}

          <div style={{ marginTop: heroChannel ? '-150px' : '20px', position: 'relative', zIndex: 10, width: '100%' }}>
            {loadedCategories.map((category, index) => (
              // Integrado com os novos parâmetros obrigatórios do Row.tsx do seu amigo
              <Row
                key={category.id}
                rowId={category.id}
                title={category.name}
                channels={category.channels}
                rowIndex={index}
                isLastRow={index === loadedCategories.length - 1}
                onEndReached={handleLoadMoreByFocus}
                onChannelClick={(channel: any) => setSelectedChannel(channel)}
              />
            ))}

            {loadedCategories.length === 0 && (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'white' }}>
                <h2>Nenhum conteúdo encontrado nesta categoria.</h2>
              </div>
            )}

            <div ref={observerTarget} style={{ height: '50px', width: '100%' }}></div>

            {isLoadingMore && (
              <div style={{ textAlign: 'center', color: '#8b5cf6', padding: '2rem' }}>
                Carregando mais conteúdos...
              </div>
            )}
          </div>
        </section>
      )}

      {/* Indicador de rolagem do seu amigo com posicionamento fixo do commit */}
      {canScrollDown && (
        <div className="scrollDownHint">
          <span>⌄</span>
          <p>Mais categorias abaixo</p>
        </div>
      )}

      {selectedChannel && (
        <VideoPlayer
          url={selectedChannel.url}
          title={selectedChannel.name}
          onClose={handleClosePlayer}
          onPrevious={handlePreviousChannel}
          onNext={handleNextChannel}
          hasPrevious={selectedChannelIndex > 0}
          hasNext={selectedChannelIndex >= 0 && selectedChannelIndex < playableChannels.length - 1}
        />
      )}

      {isLogoutConfirmOpen && (
        <LogoutConfirmModal
          onCancel={() => setIsLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
        />
      )}

      <style jsx global>{`
        body { overflow: ${selectedChannel ? 'hidden' : 'auto'}; background-color: #000; color: #fff; }
      `}</style>
    </main>
  );
}
