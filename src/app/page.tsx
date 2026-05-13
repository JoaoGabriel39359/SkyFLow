/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

// Importa recursos principais do React
import React, { useState, useEffect, useRef, useCallback } from 'react';

// Importa os componentes visuais do app
import Sidebar from '@/components/Sidebar';
import Row from '@/components/Row';
import VideoPlayer from '@/components/VideoPlayer';
import Login from '@/components/Login';

// Importa funções responsáveis por buscar dados IPTV e montar a URL do vídeo
import { getCategories, getStreams, buildStreamUrl } from '@/lib/iptvEngine';

// Importa a biblioteca de navegação por controle remoto/setas
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';

// Inicializa o sistema global de navegação por controle remoto
init({
  debug: false,
  visualDebug: false,
});

// Define quantas categorias/linhas serão carregadas por vez
// Exemplo: 4 categorias = 4 linhas iniciais na tela
const BATCH_SIZE = 4;

// Componente da tela inicial institucional do app
// Ele aparece quando activeTab === 'home'
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

    {/* Área visual da direita da tela inicial */}
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

// COMPONENTE PRINCIPAL DA PÁGINA
// Tudo que usa useState, useEffect e return precisa ficar dentro dessa função
export default function Home() {
  // Guarda o canal/filme/série selecionado para abrir no player
  const [selectedChannel, setSelectedChannel] = useState<any>(null);

  // Controla se o usuário já está logado
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Guarda url, usuário e senha do login IPTV
  const [credentials, setCredentials] = useState<any>(null);

  // Controla qual aba está ativa: home, live, movies, series, etc.
  const [activeTab, setActiveTab] = useState('home');

  // Controla o carregamento inicial da tela
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Controla o carregamento de mais categorias quando o usuário desce
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Guarda todas as categorias retornadas pela API
  const [allCategories, setAllCategories] = useState<any[]>([]);

  // Guarda somente as categorias já carregadas/renderizadas na tela
  const [loadedCategories, setLoadedCategories] = useState<any[]>([]);

  // Impede que o foco inicial seja aplicado várias vezes
  const hasSetInitialFocus = useRef(false);

  // Descobre a aba principal com base na aba atual
  // Exemplo: live-favorites pertence à base live
  const getBaseTab = (tab: string) => {
    if (tab.includes('movies')) return 'movies';
    if (tab.includes('series')) return 'series';
    if (tab.includes('live')) return 'live';
    return tab;
  };

  // Define quais actions da API Xtream devem ser usadas para cada aba
  const getActionParams = (tab: string) => {
    const baseTab = getBaseTab(tab);

    if (baseTab === 'movies') {
      return {
        cat: 'get_vod_categories',
        stream: 'get_vod_streams',
        type: 'vod' as const,
      };
    }

    if (baseTab === 'series') {
      return {
        cat: 'get_series_categories',
        stream: 'get_series',
        type: 'series' as const,
      };
    }

    // Padrão: TV ao vivo
    return {
      cat: 'get_live_categories',
      stream: 'get_live_streams',
      type: 'live' as const,
    };
  };

  // Função que carrega um lote de categorias e seus canais/filmes/séries
  async function loadMoreStreams(
    creds: any,
    fullCatList: any[],
    startIndex: number,
    params: any
  ) {
    // Pega apenas o próximo bloco de categorias
    const catsToLoad = fullCatList.slice(startIndex, startIndex + BATCH_SIZE);

    // Se não tiver mais categoria, para aqui
    if (catsToLoad.length === 0) return;

    setIsLoadingMore(true);

    try {
      // Para cada categoria, busca os streams/conteúdos dela
      const categoryPromises = catsToLoad.map(async (cat: any) => {
        const streams = await getStreams(
          creds.url,
          creds.user,
          creds.pass,
          params.stream,
          cat.category_id
        );

        // Só monta a linha se a categoria tiver conteúdo
        if (Array.isArray(streams) && streams.length > 0) {
          return {
            id: cat.category_id,
            name: cat.category_name,

            // Limita a quantidade de cards por linha para não pesar na TV
            channels: streams.slice(0, 14).map((s: any) => {
              const streamId = s.stream_id || s.series_id;
              const name = s.name || s.title || 'Sem Nome';

              // Usa logo da API; se não existir, usa imagem padrão
              const logo =
                s.stream_icon ||
                s.cover ||
                'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=60';

              // Extensão padrão para streams
              const extension = s.container_extension || 'm3u8';

              return {
                id: streamId,
                name,
                logo,

                // Monta a URL final do conteúdo
                url: buildStreamUrl(
                  creds.url,
                  creds.user,
                  creds.pass,
                  params.type,
                  streamId,
                  extension
                ),
              };
            }),
          };
        }

        return null;
      });

      // Aguarda todas as categorias carregarem
      const newLoadedCats = (await Promise.all(categoryPromises)).filter(
        (category) => category !== null
      );

      // Adiciona as novas categorias às que já estavam na tela
      setLoadedCategories((prev) => [...prev, ...newLoadedCats]);
    } catch (error) {
      console.error('Erro ao buscar mais streams:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Carregamento inicial quando muda de aba
  useEffect(() => {
    const initData = async () => {
      // Busca login salvo no navegador
      const savedLogin = localStorage.getItem('iptv_login');

      // Se não tiver login salvo, mostra tela de login
      if (!savedLogin) {
        setIsLoggedIn(false);
        setIsInitialLoading(false);
        return;
      }

      // Converte o login salvo de texto para objeto
      const creds = JSON.parse(savedLogin);

      // Salva credenciais no estado
      setCredentials(creds);
      setIsLoggedIn(true);

      // Se estiver na Home, Busca ou Ajustes, não carrega canais
      // Isso deixa a tela inicial mais leve
      if (
        activeTab === 'home' ||
        activeTab === 'search' ||
        activeTab === 'settings'
      ) {
        setIsInitialLoading(false);
        setAllCategories([]);
        setLoadedCategories([]);
        return;
      }

      // Quando entra em TV/Filmes/Séries, limpa dados antigos
      setIsInitialLoading(true);
      setAllCategories([]);
      setLoadedCategories([]);

      // Permite definir foco inicial novamente na nova aba
      hasSetInitialFocus.current = false;

      // Descobre quais parâmetros usar para a aba atual
      const params = getActionParams(activeTab);

      try {
        // Busca categorias da aba atual
        const rawCats = await getCategories(
          creds.url,
          creds.user,
          creds.pass,
          params.cat
        );

        const cats = Array.isArray(rawCats) ? rawCats : [];
        setAllCategories(cats);

        // Carrega o primeiro lote de categorias
        await loadMoreStreams(creds, cats, 0, params);
      } catch (error) {
        console.error('Erro no carregamento inicial:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initData();
  }, [activeTab]);

  // Quando os primeiros cards aparecem, coloca o foco no primeiro card
  // Isso é importante para controle remoto na TV
  useEffect(() => {
    if (
      !hasSetInitialFocus.current &&
      !isInitialLoading &&
      isLoggedIn &&
      activeTab !== 'home' &&
      loadedCategories.length > 0
    ) {
      setFocus('row-0-card-0');
      hasSetInitialFocus.current = true;
    }
  }, [isInitialLoading, isLoggedIn, activeTab, loadedCategories.length]);

  // Carrega mais categorias quando o foco chega na última linha
  const handleLoadMoreByFocus = useCallback(() => {
    // Evita chamadas duplicadas ou desnecessárias
    if (
      isInitialLoading ||
      isLoadingMore ||
      !credentials ||
      loadedCategories.length >= allCategories.length
    ) {
      return;
    }

    // Carrega o próximo lote começando do tamanho atual da lista carregada
    loadMoreStreams(
      credentials,
      allCategories,
      loadedCategories.length,
      getActionParams(activeTab)
    );
  }, [
    isInitialLoading,
    isLoadingMore,
    credentials,
    loadedCategories.length,
    allCategories,
    activeTab,
  ]);

  // Função chamada quando o usuário faz login
  const handleLogin = (data: any) => {
    // Salva login no navegador
    localStorage.setItem('iptv_login', JSON.stringify(data));

    // Atualiza estados do app
    setCredentials(data);
    setIsLoggedIn(true);
    setActiveTab('home');
    setIsInitialLoading(false);
  };

  // Tela de loading inicial
  if (isInitialLoading) {
    return (
      <div className="nuvixLoading">
        <div className="nuvixGlow"></div>

        <div className="nuvixLoaderCard">
          <h1>Nuvix</h1>

          <div className="loadingBar">
            <span></span>
          </div>

          <p>Carregando sua experiência...</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado, mostra tela de login
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Tela principal do app
  return (
    <main
      style={{
        marginLeft: '260px',
        minHeight: '100vh',
        transition: 'margin-left 0.28s ease',
      }}
    >
      {/* Barra lateral fixa */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="content-wrapper">
        {activeTab === 'home' ? (
          // Tela inicial institucional
          <HomeIntro />
        ) : (
          // Tela de listas de conteúdo
          <div
            style={{
              marginTop: '3rem',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Renderiza cada categoria como uma linha */}
            {loadedCategories.map((category, rowIndex) => (
              <Row
                key={category.id}
                rowIndex={rowIndex}
                title={category.name}
                channels={category.channels}
                isLastRow={rowIndex === loadedCategories.length - 1}
                onEndReached={handleLoadMoreByFocus}
                onChannelClick={(channel) => setSelectedChannel(channel)}
              />
            ))}

            {/* Mensagem caso nenhuma categoria tenha conteúdo */}
            {!isInitialLoading && loadedCategories.length === 0 && (
              <div
                style={{
                  padding: '4rem',
                  textAlign: 'center',
                  color: 'white',
                }}
              >
                <h2>Nenhum conteúdo encontrado.</h2>
              </div>
            )}

            {/* Mensagem durante carregamento de mais categorias */}
            {isLoadingMore && (
              <div
                style={{
                  textAlign: 'center',
                  color: '#8b5cf6',
                  padding: '2rem',
                }}
              >
                Carregando mais categorias...
              </div>
            )}

            {/* Indicador visual de que existem mais categorias abaixo */}
            {loadedCategories.length < allCategories.length && (
              <div className="scrollDownHint">
                <span>⌄</span>
                <p>Mais categorias abaixo</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player de vídeo abre quando selectedChannel recebe um item */}
      {selectedChannel && (
        <VideoPlayer
          url={selectedChannel.url}
          title={selectedChannel.name}
          onClose={() => setSelectedChannel(null)}
        />
      )}

      {/* Estilo global simples da página */}
      <style jsx global>{`
        .content-wrapper {
          padding-bottom: 5rem;
        }

        body {
          overflow: ${selectedChannel ? 'hidden' : 'auto'};
        }
      `}</style>
    </main>
  );
}