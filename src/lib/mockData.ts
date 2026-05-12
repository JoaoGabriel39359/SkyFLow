export const mockChannels = [
  {
    id: '1',
    name: 'Canais de Filmes 24h',
    category: 'Filmes',
    logo: 'https://images.unsplash.com/photo-1485846234645-a62644ef7467?w=800&auto=format&fit=crop&q=60',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: '2',
    name: 'Documentários Premium',
    category: 'Documentários',
    logo: 'https://images.unsplash.com/photo-1552083375-1447ce886485?w=800&auto=format&fit=crop&q=60',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: '3',
    name: 'Esportes Total',
    category: 'Esportes',
    logo: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&auto=format&fit=crop&q=60',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: '4',
    name: 'Infantil Diversão',
    category: 'Infantil',
    logo: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&auto=format&fit=crop&q=60',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
];

export const mockCategories = [
  { id: '1', name: 'Mais Assistidos', channels: mockChannels },
  { id: '2', name: 'Em Alta', channels: [...mockChannels].reverse() },
  { id: '3', name: 'Esportes', channels: mockChannels },
  { id: '4', name: 'Filmes & Séries', channels: mockChannels },
];
