import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = searchParams.get('url');
  
  if (!baseUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Remontando a query string para enviar ao servidor Xtream Codes
  const targetParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'url') {
      targetParams.append(key, value);
    }
  });

  // Limpando barra no final da baseUrl se existir
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const targetUrl = `${cleanBaseUrl}/player_api.php?${targetParams.toString()}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        // Enviar um User-Agent comum para evitar bloqueios 403 de servidores IPTV restritos
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Server responded with ${response.status}` }, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    if (!contentType.includes('application/json')) {
      console.error('Xtream returned non-JSON response:', responseText.slice(0, 180));
      return NextResponse.json(
        {
          error: 'IPTV server returned a non-JSON response',
          status: response.status,
          preview: responseText.slice(0, 180),
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch from IPTV server' }, { status: 500 });
  }
}
