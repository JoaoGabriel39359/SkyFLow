export async function loginXtream(baseUrl: string, user: string, pass: string) {
  const proxyUrl = `/api/xtream?url=${encodeURIComponent(baseUrl)}&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  try {
    const response = await fetch(proxyUrl);
    const data = await response.json();
    
    if (data.user_info && data.user_info.auth === 1) {
      return {
        success: true,
        userInfo: data.user_info,
        serverInfo: data.server_info
      };
    }
    return { success: false, message: 'Falha na autenticação' };
  } catch {
    return { success: false, message: 'Erro de conexão com o servidor proxy' };
  }
}

export async function getCategories(baseUrl: string, user: string, pass: string, action: string = 'get_live_categories') {
  const proxyUrl = `/api/xtream?url=${encodeURIComponent(baseUrl)}&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=${action}`;
  try {
    const response = await fetch(proxyUrl);
    return await response.json();
  } catch (error) {
    console.error(`Erro ao buscar categorias (${action}):`, error);
    return [];
  }
}

export async function getStreams(baseUrl: string, user: string, pass: string, action: string = 'get_live_streams', categoryId?: string) {
  let proxyUrl = `/api/xtream?url=${encodeURIComponent(baseUrl)}&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=${action}`;
  if (categoryId) {
    proxyUrl += `&category_id=${categoryId}`;
  }
  
  try {
    const response = await fetch(proxyUrl);
    return await response.json();
  } catch (error) {
    console.error(`Erro ao buscar streams (${action}):`, error);
    return [];
  }
}

export function buildStreamUrl(baseUrl: string, user: string, pass: string, type: 'live' | 'vod' | 'series', streamId: string, extension: string = 'm3u8') {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanExtension = extension || 'm3u8';
  
  if (type === 'live') {
    return `${cleanBase}/live/${user}/${pass}/${streamId}.${cleanExtension}`;
  } else if (type === 'vod') {
    return `${cleanBase}/movie/${user}/${pass}/${streamId}.${extension || 'mp4'}`;
  } else if (type === 'series') {
    return `${cleanBase}/series/${user}/${pass}/${streamId}.${extension || 'mp4'}`;
  }
  
  return '';
}
