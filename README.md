# Nuvix / SkyFlow

Front-end do Nuvix/SkyFlow, um app de streaming pensado para Android TV e futuramente Smart TVs Samsung/LG. O projeto usa Next.js, React e TypeScript no front-end, com um back-end FastAPI separado para validacao/ativacao de dispositivos e painel de revendedores.

Este README foi escrito para ajudar qualquer pessoa a subir o projeto do zero em uma nova maquina.

## Visao geral

O sistema e dividido em duas partes:

- **Front-end:** app de TV e painel web, neste repositorio.
- **Back-end:** API FastAPI separada, normalmente no projeto `IPVT-API`.

Fluxo principal:

1. O usuario abre o front-end em `http://localhost:3000`.
2. O app identifica o dispositivo pelo navegador.
3. O front chama o back-end em `http://127.0.0.1:8000`.
4. O back-end consulta o Supabase para verificar se o dispositivo esta ativado.
5. Se estiver liberado, o front carrega categorias, canais, filmes e series via servidor IPTV/Xtream Codes.
6. O usuario navega pelo app usando setas e OK/Enter, com player em tela cheia.

## Tecnologias

### Front-end

- Next.js 16
- React 19
- TypeScript
- CSS Modules / CSS global
- HLS.js para reproducao de streams
- Norigin Spatial Navigation para navegacao por controle remoto
- Lucide React para icones

### Back-end

- Python
- FastAPI
- Uvicorn
- Supabase client
- Pydantic
- httpx

### Banco de dados

O banco usado e o **Supabase**, que roda sobre **PostgreSQL**.

Tabelas esperadas pelo fluxo atual:

- `activations`: dispositivos ativados, credenciais IPTV, validade e status.
- `resellers`: revendedores e creditos.

## Pre-requisitos

Instale antes de iniciar:

- Node.js 20 ou superior
- npm
- Python 3.11 ou superior
- Git
- Conta/projeto no Supabase configurado
- Back-end FastAPI do projeto `IPVT-API`
- Credenciais IPTV/Xtream validas para testes

Para conferir as versoes:

```powershell
node -v
npm -v
python --version
git --version
```

## Estrutura do front-end

Arquivos e pastas mais importantes:

```txt
src/app/page.tsx
```

Controla o app principal de TV: validacao do dispositivo, menu, categorias, conteudo, favoritos, busca, preview e player.

```txt
src/app/api/xtream/route.ts
```

Proxy interno do Next.js para consultar o servidor IPTV/Xtream Codes.

```txt
src/app/painel
```

Area do painel web de revendedor/admin.

```txt
src/components/MainMenu.tsx
src/components/CategoryGrid.tsx
src/components/ChannelListView.tsx
src/components/VideoPlayer.tsx
```

Componentes principais da experiencia de TV.

```txt
src/lib/iptvEngine.ts
src/lib/favorites.ts
src/lib/search.ts
src/lib/device.ts
```

Funcoes auxiliares para IPTV, favoritos locais, busca inteligente e identificacao do dispositivo.

## Instalar o front-end

Clone o repositorio e entre na pasta:

```powershell
git clone <URL_DO_REPOSITORIO>
cd SkyFLow
```

Instale as dependencias:

```powershell
npm install
```

Rode o front-end:

```powershell
npm run dev
```

Abra:

```txt
http://localhost:3000
```

## Instalar o back-end

O back-end roda separado. Em uma instalacao local comum, ele fica em outra pasta:

```powershell
cd C:\Users\Rafael\IPVT-API
```

Crie um ambiente virtual:

```powershell
python -m venv .venv
```

Ative o ambiente:

```powershell
.\.venv\Scripts\Activate.ps1
```

Se o PowerShell bloquear scripts, use temporariamente:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Instale as dependencias:

```powershell
pip install -r requirements.txt
```

Crie um arquivo `.env` na raiz do back-end:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-chave-do-supabase
SUPABASE_VERIFY_SSL=false
```

Rode a API:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Teste no navegador:

```txt
http://127.0.0.1:8000
```

Resposta esperada:

```json
{
  "message": "Skyflow API rodando perfeitamente"
}
```

## Ordem correta para rodar tudo

Em dois terminais separados:

### Terminal 1: back-end

```powershell
cd C:\Users\Rafael\IPVT-API
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: front-end

```powershell
cd C:\Users\Rafael\SkyFLow
npm run dev
```

Depois acesse:

```txt
http://localhost:3000
```

## Variaveis e configuracoes importantes

O front-end atualmente chama o back-end local em:

```txt
http://127.0.0.1:8000
http://localhost:8000
```

Por isso o back-end precisa estar rodando na porta `8000`.

O front-end roda por padrao na porta `3000`.

Se a porta `8000` estiver ocupada, descubra o processo:

```powershell
netstat -ano | findstr :8000
```

Encerre pelo PID:

```powershell
Stop-Process -Id <PID>
```

## Rotas principais usadas pelo front-end

Back-end FastAPI:

```txt
POST /api/v1/devices/check-device
POST /api/v1/devices/activate
GET  /api/v1/devices/list/
POST /api/v1/auth/login
GET  /api/v1/resellers/
POST /api/v1/resellers/
POST /api/v1/resellers/transfer
```

Proxy interno do Next.js:

```txt
GET /api/xtream
```

Esse proxy monta chamadas para:

```txt
<IPTV_URL>/player_api.php
```

## Dados salvos no navegador

O app usa `localStorage` para alguns dados locais:

```txt
skyflow_device_id
nuvix_favorites_live
nuvix_favorites_movies
nuvix_favorites_series
token
user
```

Favoritos ficam somente no navegador por enquanto. Se limpar dados do navegador, eles somem.

## Comandos uteis do front-end

Rodar em desenvolvimento:

```powershell
npm run dev
```

Rodar lint:

```powershell
npm run lint
```

Gerar build de producao:

```powershell
npm run build
```

Rodar build gerado:

```powershell
npm run start
```

## Checklist para uma maquina nova

1. Instalar Node.js, npm, Python e Git.
2. Clonar o repositorio do front-end.
3. Rodar `npm install` no front-end.
4. Clonar ou copiar o back-end `IPVT-API`.
5. Criar e ativar `.venv` no back-end.
6. Rodar `pip install -r requirements.txt`.
7. Criar `.env` do back-end com `SUPABASE_URL` e `SUPABASE_KEY`.
8. Subir o back-end na porta `8000`.
9. Subir o front-end na porta `3000`.
10. Abrir `http://localhost:3000`.
11. Testar validacao do dispositivo.
12. Testar carregamento de TV ao Vivo, Filmes e Series.
13. Testar player, busca, favoritos e painel.

## Problemas comuns

### Erro no front: Failed to fetch

Normalmente significa que o back-end nao esta rodando ou nao esta na porta correta.

Verifique:

```txt
http://127.0.0.1:8000
```

Se nao abrir, suba o back-end.

### Erro: address already in use / WinError 10048

A porta `8000` ja esta ocupada.

Use:

```powershell
netstat -ano | findstr :8000
Stop-Process -Id <PID>
```

Depois rode o back-end novamente.

### PowerShell bloqueia Activate.ps1

Use:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Depois ative o ambiente virtual de novo.

### Next.js acusa erro estranho em `.next`

Pode ser cache antigo.

Apague a pasta `.next` e rode novamente:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

### App abre, mas dispositivo nao valida

Confira:

- Back-end rodando na porta `8000`.
- Variaveis do Supabase corretas.
- Tabela `activations` existente.
- Registro do MAC/dispositivo no Supabase.
- Credenciais IPTV salvas na ativacao.

### Canais, filmes ou series nao carregam

Confira:

- URL IPTV correta.
- Usuario e senha IPTV corretos.
- Servidor IPTV aceitando chamadas em `player_api.php`.
- Proxy `/api/xtream` respondendo no front.

## Observacoes de desenvolvimento

- Nao altere endpoints do back-end sem atualizar o front.
- Nao commite arquivos `.env`.
- Antes de subir mudancas, rode `npm run lint`.
- Para mudancas grandes, rode tambem `npm run build`.
- O app e pensado para TV, entao sempre teste navegacao por setas e Enter/OK.
- Evite efeitos pesados, muitos videos simultaneos ou renderizacao de listas enormes.

## Estado esperado quando tudo esta funcionando

Com tudo rodando corretamente:

- Back-end responde em `http://127.0.0.1:8000`.
- Front-end abre em `http://localhost:3000`.
- Dispositivo e validado pelo Supabase.
- Menu principal aparece apos validacao.
- Categorias TV ao Vivo, Filmes e Series carregam.
- Conteudos abrem no preview e no player.
- Busca encontra conteudos dentro da categoria.
- Favoritos persistem no navegador.
- Painel abre em `/painel` e `/painel/login`.

