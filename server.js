const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// Carregar variáveis de ambiente do arquivo .env manualmente
const envPath = path.join(__dirname, '.env');
const envVars = { ...process.env };
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2 && !line.trim().startsWith('#')) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (envVars[key] === undefined) {
                envVars[key] = value;
            }
        }
    });
    console.log('Variáveis de ambiente carregadas do .env');
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'application/font-woff',
    '.woff2': 'font/woff2',
    '.ttf': 'application/font-ttf'
};

const readRequestBody = async (request) => {
    const buffers = [];
    for await (const chunk of request) {
        buffers.push(chunk);
    }
    return Buffer.concat(buffers).toString();
};

const getSupabaseConfig = () => {
    const supabaseUrl = envVars['SUPABASE_URL'] || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = envVars['SUPABASE_ANON_KEY'] || process.env.SUPABASE_ANON_KEY || '';
    const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
};

const buildAppUrl = (request) => {
    if (envVars['APP_URL']) return envVars['APP_URL'];
    const host = request.headers.host;
    if (!host) return '';
    const proto = request.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${host}`;
};

const getBearerToken = (request) => {
    const header = (request.headers.authorization || '').trim();
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
};

const getSupabaseUserIdFromRequest = async (request) => {
    const token = getBearerToken(request);
    if (!token) return null;

    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`
        }
    });

    const userJson = await userRes.json().catch(() => null);
    if (!userRes.ok) return null;

    return userJson?.id || userJson?.user?.id || null;
};

const signState = (stateB64, appSecret) => {
    return crypto.createHmac('sha256', appSecret).update(stateB64).digest('hex');
};

const verifyStateSig = (stateB64, sig, appSecret) => {
    if (!stateB64 || !sig || !appSecret) return false;
    try {
        const expected = signState(stateB64, appSecret);
        const expectedBuf = Buffer.from(expected, 'hex');
        const sigBuf = Buffer.from(String(sig), 'hex');
        if (expectedBuf.length !== sigBuf.length) return false;
        return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
        return false;
    }
};

const server = http.createServer(async (request, response) => {
    // CORS Headers para permitir desenvolvimento local
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,authorization');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const parsedUrl = url.parse(request.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`${request.method} ${pathname}`);

    // --- API ENDPOINTS ---

    if (pathname === '/config' && request.method === 'GET') {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
        const payload = {
            supabaseUrl,
            supabaseAnonKey,
            missing: !supabaseUrl || !supabaseAnonKey
        };
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(payload));
        return;
    }

    if (pathname === '/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    if (pathname === '/api/config' && request.method === 'GET') {
        const payload = {
            app_url: envVars['APP_URL'] || ''
        };
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(payload));
        return;
    }

    if (pathname === '/colaboradores' && request.method === 'GET') {
        try {
            const departamento = String(parsedUrl.query.departamento || '').trim();
            if (!departamento) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'departamento_obrigatorio' }));
                return;
            }

            const supabaseUrl = envVars['SUPABASE_URL'] || process.env.SUPABASE_URL || '';
            const supabaseAnonKey = envVars['SUPABASE_ANON_KEY'] || process.env.SUPABASE_ANON_KEY || '';
            if (!supabaseUrl || !supabaseAnonKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,nome,email,departamento,ativo,perfil_acesso');
            params.set('ativo', 'eq.true');
            params.set('or', `(departamento.eq.${departamento},perfil_acesso.in.(admin,super_admin))`);

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/colaboradores?${params.toString()}`;

            const headers = {
                apikey: supabaseAnonKey
            };
            if (request.headers.authorization) {
                headers.Authorization = request.headers.authorization;
            } else {
                headers.Authorization = `Bearer ${supabaseAnonKey}`;
            }

            const supabaseResponse = await fetch(targetUrl, {
                method: 'GET',
                headers
            });

            const data = await supabaseResponse.text();
            response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
            response.end(data);
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    // 1. Proxy para OpenAI
    if (pathname === '/api/openai/chat/completions' && request.method === 'POST') {
        try {
            const apiKey = envVars['OPENAI_API_KEY'];
            if (!apiKey) {
                throw new Error('OPENAI_API_KEY não configurada no backend (.env)');
            }

            const data = await readRequestBody(request);
            
            // Fazer chamada para OpenAI
            const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: data
            });

            const responseData = await openAiResponse.json();
            
            response.writeHead(openAiResponse.status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(responseData));
            return;

        } catch (error) {
            console.error('Erro no proxy OpenAI:', error);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    // 2. Proxy para Meta Ads (Exemplo Genérico)
    // O frontend pode enviar a URL relativa e parâmetros no body
    if (pathname === '/api/meta/proxy' && request.method === 'POST') {
        try {
            const appToken = envVars['FACEBOOK_APP_TOKEN'];
            if (!appToken) {
                throw new Error('FACEBOOK_APP_TOKEN não configurado no backend (.env)');
            }

            const body = JSON.parse(await readRequestBody(request));
            
            // Espera receber { endpoint: '/v19.0/me?...', method: 'GET', access_token: '...' (opcional) }
            const metaEndpoint = body.endpoint;
            if (!metaEndpoint) throw new Error('Endpoint não fornecido');

            // Token: Se o frontend enviar um (ex: Page Token), usa. 
            // Caso contrário, usa o Token Global (App Token) do .env.
            const tokenToUse = body.access_token || appToken;

            const separator = metaEndpoint.includes('?') ? '&' : '?';
            const targetUrl = `https://graph.facebook.com${metaEndpoint}${separator}access_token=${tokenToUse}`;
            
            const metaResponse = await fetch(targetUrl, {
                method: body.method || 'GET'
            });

            const metaData = await metaResponse.json();
            response.writeHead(metaResponse.status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(metaData));
            return;

        } catch (error) {
            console.error('Erro no proxy Meta:', error);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const connectionsListMatch = pathname.match(/^\/api\/clients\/(\d+)\/connections$/);
    if (connectionsListMatch && request.method === 'GET') {
        try {
            const clientId = connectionsListMatch[1];
            const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
            if (!supabaseUrl || !supabaseAnonKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,client_id,platform,status,external_id,external_name,token_expires_at,meta');
            params.set('client_id', `eq.${clientId}`);
            params.set('order', 'platform.asc');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?${params.toString()}`;

            const headers = { apikey: supabaseAnonKey };
            if (request.headers.authorization) {
                headers.Authorization = request.headers.authorization;
            } else {
                headers.Authorization = `Bearer ${supabaseAnonKey}`;
            }

            const supabaseResponse = await fetch(targetUrl, { method: 'GET', headers });
            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_buscar_conexoes' }));
                return;
            }

            const platforms = ['instagram', 'facebook', 'google', 'linkedin', 'tiktok'];
            const baseMap = platforms.reduce((acc, platform) => {
                acc[platform] = { platform, status: 'disconnected' };
                return acc;
            }, {});

            const list = Array.isArray(json) ? json : [];
            list.forEach(item => {
                if (item?.platform && baseMap[item.platform]) {
                    baseMap[item.platform] = { ...baseMap[item.platform], ...item };
                }
            });

            const result = platforms.map(platform => baseMap[platform]);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaPagesMatch = pathname.match(/^\/api\/clients\/(\d+)\/meta\/assets\/pages$/);
    if (clientMetaPagesMatch && request.method === 'GET') {
        try {
            const clientId = Number(clientMetaPagesMatch[1]);
            if (!Number.isFinite(clientId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_invalido' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'access_token,status');
            params.set('client_id', `eq.${clientId}`);
            params.set('platform', 'eq.facebook');
            params.set('status', 'eq.connected');
            params.set('limit', '1');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?${params.toString()}`;
            const connRes = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const connJson = await connRes.json().catch(() => null);
            if (!connRes.ok) {
                response.writeHead(connRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(connJson || { error: 'erro_ao_buscar_conexao' }));
                return;
            }

            const connection = Array.isArray(connJson) ? connJson[0] : null;
            const accessToken = connection?.access_token || null;
            if (!accessToken) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'conexao_nao_encontrada' }));
                return;
            }

            const graphParams = new URLSearchParams();
            graphParams.set('fields', 'id,name,access_token');
            graphParams.set('access_token', accessToken);
            const graphRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?${graphParams.toString()}`);
            const graphJson = await graphRes.json();
            if (!graphRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: graphJson.error?.message || 'erro_ao_listar_pages' }));
                return;
            }

            const pages = Array.isArray(graphJson.data)
                ? graphJson.data.map(item => ({
                    id: item.id,
                    name: item.name,
                    page_access_token: item.access_token || null
                }))
                : [];

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ pages }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaInstagramMatch = pathname.match(/^\/api\/clients\/(\d+)\/meta\/assets\/page\/([^/]+)\/instagram$/);
    if (clientMetaInstagramMatch && request.method === 'GET') {
        try {
            const clientId = Number(clientMetaInstagramMatch[1]);
            const pageId = clientMetaInstagramMatch[2];
            if (!Number.isFinite(clientId) || !pageId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'parametros_invalidos' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'access_token,status');
            params.set('client_id', `eq.${clientId}`);
            params.set('platform', 'eq.facebook');
            params.set('status', 'eq.connected');
            params.set('limit', '1');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?${params.toString()}`;
            const connRes = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const connJson = await connRes.json().catch(() => null);
            if (!connRes.ok) {
                response.writeHead(connRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(connJson || { error: 'erro_ao_buscar_conexao' }));
                return;
            }

            const connection = Array.isArray(connJson) ? connJson[0] : null;
            const accessToken = connection?.access_token || null;
            if (!accessToken) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'conexao_nao_encontrada' }));
                return;
            }

            const graphParams = new URLSearchParams();
            graphParams.set('fields', 'instagram_business_account{id,username},connected_instagram_account{id,username}');
            graphParams.set('access_token', accessToken);
            const graphRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?${graphParams.toString()}`);
            const graphJson = await graphRes.json();
            if (!graphRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: graphJson.error?.message || 'erro_ao_buscar_instagram' }));
                return;
            }

            const accounts = [];
            if (graphJson.instagram_business_account?.id) {
                accounts.push({
                    id: graphJson.instagram_business_account.id,
                    username: graphJson.instagram_business_account.username || null
                });
            }
            if (graphJson.connected_instagram_account?.id) {
                accounts.push({
                    id: graphJson.connected_instagram_account.id,
                    username: graphJson.connected_instagram_account.username || null
                });
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ page_id: pageId, accounts }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaAssetsLinkMatch = pathname.match(/^\/api\/clients\/(\d+)\/meta\/assets\/link$/);
    if (clientMetaAssetsLinkMatch && request.method === 'POST') {
        try {
            const clientId = Number(clientMetaAssetsLinkMatch[1]);
            if (!Number.isFinite(clientId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_invalido' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch (error) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const pageId = String(body?.pageId || '').trim();
            const pageName = String(body?.pageName || '').trim() || null;
            const igUserId = String(body?.igUserId || '').trim();
            const igUsername = String(body?.igUsername || '').trim() || null;

            if (!pageId || !igUserId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'parametros_invalidos' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const clientParams = new URLSearchParams();
            clientParams.set('select', 'id,time_id');
            clientParams.set('id', `eq.${clientId}`);
            clientParams.set('limit', '1');
            const clientUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?${clientParams.toString()}`;
            const clientRes = await fetch(clientUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const clientJson = await clientRes.json().catch(() => null);
            if (!clientRes.ok || !Array.isArray(clientJson) || clientJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_nao_encontrado' }));
                return;
            }

            const timeId = clientJson[0]?.time_id || null;
            if (!timeId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'time_id_invalido' }));
                return;
            }

            const patchHeaders = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json'
            };

            const pagePatchUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_social_assets?client_id=eq.${clientId}&provider=eq.meta&asset_type=eq.page`;
            const pagePatchRes = await fetch(pagePatchUrl, {
                method: 'PATCH',
                headers: patchHeaders,
                body: JSON.stringify({ is_primary: false })
            });
            if (!pagePatchRes.ok) {
                const errText = await pagePatchRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_atualizar_assets' }));
                return;
            }

            const igPatchUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_social_assets?client_id=eq.${clientId}&provider=eq.meta&asset_type=eq.ig_user`;
            const igPatchRes = await fetch(igPatchUrl, {
                method: 'PATCH',
                headers: patchHeaders,
                body: JSON.stringify({ is_primary: false })
            });
            if (!igPatchRes.ok) {
                const errText = await igPatchRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_atualizar_assets' }));
                return;
            }

            const upsertPayload = [
                {
                    client_id: clientId,
                    time_id: timeId,
                    provider: 'meta',
                    asset_type: 'page',
                    asset_id: pageId,
                    asset_name: pageName,
                    is_primary: true
                },
                {
                    client_id: clientId,
                    time_id: timeId,
                    provider: 'meta',
                    asset_type: 'ig_user',
                    asset_id: igUserId,
                    asset_name: igUsername,
                    is_primary: true
                }
            ];

            const upsertUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_social_assets?on_conflict=client_id,provider,asset_type,asset_id`;
            const upsertRes = await fetch(upsertUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify(upsertPayload)
            });

            if (!upsertRes.ok) {
                const errText = await upsertRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_assets' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaStartMatch = pathname.match(/^\/api\/clients\/(\d+)\/oauth\/meta\/start$/);
    if (clientMetaStartMatch && request.method === 'GET') {
        try {
            const clientId = Number(clientMetaStartMatch[1]);
            if (!Number.isFinite(clientId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_invalido' }));
                return;
            }

            const platform = String((parsedUrl.query || {}).platform || '').toLowerCase();
            if (!['instagram', 'facebook'].includes(platform)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'plataforma_invalida', message: 'platform deve ser instagram ou facebook' }));
                return;
            }

            const appId = envVars['FACEBOOK_APP_ID'] || '';
            const appSecret = envVars['FACEBOOK_APP_SECRET'] || '';
            if (!appId || !appSecret) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'meta_nao_configurado' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const clientParams = new URLSearchParams();
            clientParams.set('select', 'id,time_id');
            clientParams.set('id', `eq.${clientId}`);
            clientParams.set('limit', '1');
            const clientUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?${clientParams.toString()}`;
            const clientRes = await fetch(clientUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const clientJson = await clientRes.json().catch(() => null);
            if (!clientRes.ok || !Array.isArray(clientJson) || clientJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_nao_encontrado' }));
                return;
            }

            const timeId = clientJson[0]?.time_id || null;
            if (!timeId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'time_id_invalido' }));
                return;
            }

            const appUrl = buildAppUrl(request);
            if (!appUrl) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'app_url_nao_configurada' }));
                return;
            }

            const redirectUri = `${appUrl.replace(/\/$/, '')}/api/clients/${clientId}/oauth/meta/callback`;
            const nonce = crypto.randomBytes(16).toString('hex');
            const statePayload = { clientId, timeId, platform, nonce, ts: Date.now() };
            const stateB64 = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
            const sig = signState(stateB64, appSecret);
            const state = `${stateB64}.${sig}`;

            const params = new URLSearchParams();
            params.set('client_id', appId);
            params.set('redirect_uri', redirectUri);
            params.set('state', state);
            params.set('response_type', 'code');
            params.set('scope', 'public_profile');

            const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ url: authUrl }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaCallbackMatch = pathname.match(/^\/api\/clients\/(\d+)\/oauth\/meta\/callback$/);
    if (clientMetaCallbackMatch && request.method === 'GET') {
        try {
            const clientId = Number(clientMetaCallbackMatch[1]);
            if (!Number.isFinite(clientId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_invalido' }));
                return;
            }

            const query = parsedUrl.query || {};
            const code = query.code;
            const state = query.state;
            if (!code || !state) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'parametros_invalidos' }));
                return;
            }

            const appId = envVars['FACEBOOK_APP_ID'] || '';
            const appSecret = envVars['FACEBOOK_APP_SECRET'] || '';
            if (!appId || !appSecret) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'meta_nao_configurado' }));
                return;
            }

            const stateParts = String(state).split('.');
            if (stateParts.length !== 2 || !stateParts[0] || !stateParts[1]) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'parametros_invalidos' }));
                return;
            }

            const stateB64 = stateParts[0];
            const sig = stateParts[1];
            const isValidSig = verifyStateSig(stateB64, sig, appSecret);
            if (!isValidSig) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'assinatura_invalida' }));
                return;
            }

            let payload = null;
            try {
                payload = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf8'));
            } catch (err) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'estado_invalido' }));
                return;
            }

            const payloadClientId = Number(payload?.clientId);
            const payloadPlatform = String(payload?.platform || '').toLowerCase();
            if (!payload || !Number.isFinite(payloadClientId) || payloadClientId !== clientId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'estado_invalido' }));
                return;
            }

            if (!['facebook', 'instagram'].includes(payloadPlatform)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'estado_invalido' }));
                return;
            }

            const appUrl = buildAppUrl(request);
            const redirectUri = `${appUrl.replace(/\/$/, '')}/api/clients/${clientId}/oauth/meta/callback`;

            const tokenParams = new URLSearchParams();
            tokenParams.set('client_id', appId);
            tokenParams.set('client_secret', appSecret);
            tokenParams.set('redirect_uri', redirectUri);
            tokenParams.set('code', code);

            const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
            const tokenJson = await tokenRes.json();
            if (!tokenRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: tokenJson.error?.message || 'erro_ao_gerar_token' }));
                return;
            }

            const exchangeParams = new URLSearchParams();
            exchangeParams.set('grant_type', 'fb_exchange_token');
            exchangeParams.set('client_id', appId);
            exchangeParams.set('client_secret', appSecret);
            exchangeParams.set('fb_exchange_token', tokenJson.access_token);

            const exchangeRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${exchangeParams.toString()}`);
            const exchangeJson = await exchangeRes.json();
            if (!exchangeRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: exchangeJson.error?.message || 'erro_ao_gerar_token' }));
                return;
            }

            const accessToken = exchangeJson.access_token;
            const expiresIn = exchangeJson.expires_in || tokenJson.expires_in || null;
            const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
            const scope = exchangeJson.scope || tokenJson.scope || null;
            const tokenType = exchangeJson.token_type || tokenJson.token_type || null;

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const meParams = new URLSearchParams();
            meParams.set('fields', 'id,name');
            meParams.set('access_token', accessToken);
            const meRes = await fetch(`https://graph.facebook.com/v19.0/me?${meParams.toString()}`);
            const meJson = await meRes.json();
            if (!meRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: meJson.error?.message || 'erro_ao_buscar_conta' }));
                return;
            }

            const clientParams = new URLSearchParams();
            clientParams.set('select', 'id,time_id');
            clientParams.set('id', `eq.${clientId}`);
            clientParams.set('limit', '1');
            const clientUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?${clientParams.toString()}`;
            const clientRes = await fetch(clientUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const clientJson = await clientRes.json().catch(() => null);
            if (!clientRes.ok || !Array.isArray(clientJson) || clientJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_nao_encontrado' }));
                return;
            }

            const timeId = clientJson[0]?.time_id || null;
            if (!timeId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'time_id_invalido' }));
                return;
            }

            const insertPayload = {
                client_id: clientId,
                time_id: timeId,
                // Não usar 'meta' aqui porque o banco aceita apenas 'facebook' ou 'instagram'
                platform: payloadPlatform,
                status: 'connected',
                external_id: meJson.id || null,
                external_name: meJson.name || null,
                access_token: accessToken,
                token_expires_at: tokenExpiresAt,
                scope,
                meta: {
                    provider: 'meta',
                    token_type: tokenType,
                    raw_scope: scope
                }
            };

            const upsertUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?on_conflict=client_id,platform`;
            const upsertRes = await fetch(upsertUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify(insertPayload)
            });

            if (!upsertRes.ok) {
                const errText = await upsertRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_conexao' }));
                return;
            }

            const redirectUrl = `${appUrl.replace(/\/$/, '')}/clientes.html?client_id=${clientId}#conexoes`;
            response.writeHead(302, { Location: redirectUrl });
            response.end();
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    // DEPRECATED: use /api/clients/:clientId/oauth/meta/start
    const metaStartMatch = pathname.match(/^\/api\/clients\/(\d+)\/connections\/meta\/start$/);
    if (metaStartMatch && (request.method === 'GET' || request.method === 'POST')) {
        try {
            const clientId = metaStartMatch[1];
            const platform = String((parsedUrl.query || {}).platform || '').toLowerCase();
            if (!['instagram', 'facebook'].includes(platform)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'plataforma_invalida', message: 'platform deve ser instagram ou facebook' }));
                return;
            }

            const appId = envVars['FACEBOOK_APP_ID'] || '';
            const appSecret = envVars['FACEBOOK_APP_SECRET'] || '';
            const missing = [];
            if (!appId) missing.push('FACEBOOK_APP_ID');
            if (!appSecret) missing.push('FACEBOOK_APP_SECRET');
            if (missing.length > 0) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'meta_nao_configurado', missing }));
                return;
            }

            const appUrl = buildAppUrl(request);
            if (!appUrl) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'app_url_nao_configurada' }));
                return;
            }

            const redirectUri = `${appUrl.replace(/\/$/, '')}/api/clients/${clientId}/oauth/meta/callback`;
            const nonce = crypto.randomBytes(16).toString('hex');
            const statePayload = { clientId: Number(clientId), platform, nonce, ts: Date.now() };
            const stateB64 = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
            const sig = signState(stateB64, appSecret);
            const state = `${stateB64}.${sig}`;
            const scopes = [
                'pages_show_list',
                'pages_read_engagement',
                'pages_read_user_content',
                'instagram_basic',
                'instagram_manage_insights'
            ].join(',');

            const params = new URLSearchParams();
            params.set('client_id', appId);
            params.set('redirect_uri', redirectUri);
            params.set('state', state);
            params.set('scope', scopes);
            params.set('response_type', 'code');

            const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ url: authUrl }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    // DEPRECATED: use /api/clients/:clientId/oauth/meta/start
    if (pathname === '/api/oauth/meta/start' && request.method === 'GET') {
        try {
            const appId = envVars['FACEBOOK_APP_ID'] || '';
            const appSecret = envVars['FACEBOOK_APP_SECRET'] || '';
            if (!appId || !appSecret) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'meta_nao_configurado' }));
                return;
            }

            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const appUrl = buildAppUrl(request);
            if (!appUrl) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'app_url_nao_configurada' }));
                return;
            }

            const redirectUri = `${appUrl.replace(/\/$/, '')}/api/oauth/meta/callback`;
            const nonce = crypto.randomBytes(16).toString('hex');
            const statePayload = { userId, platform: 'meta', nonce, ts: Date.now() };
            const stateB64 = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
            const sig = signState(stateB64, appSecret);
            const state = `${stateB64}.${sig}`;

            const params = new URLSearchParams();
            params.set('client_id', appId);
            params.set('redirect_uri', redirectUri);
            params.set('state', state);
            params.set('response_type', 'code');
            params.set('scope', 'public_profile');

            const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ url: authUrl }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    // DEPRECATED: use /api/clients/:clientId/oauth/meta/callback
    if (pathname === '/api/oauth/meta/callback' && request.method === 'GET') {
        try {
            const query = parsedUrl.query || {};
            const code = query.code;
            const state = query.state;
            if (!code || !state) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'parametros_invalidos' }));
                return;
            }

            const appId = envVars['FACEBOOK_APP_ID'] || '';
            const appSecret = envVars['FACEBOOK_APP_SECRET'] || '';
            if (!appId || !appSecret) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'meta_nao_configurado' }));
                return;
            }

            const stateParts = String(state).split('.');
            if (stateParts.length !== 2 || !stateParts[0] || !stateParts[1]) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'parametros_invalidos' }));
                return;
            }

            const stateB64 = stateParts[0];
            const sig = stateParts[1];
            const isValidSig = verifyStateSig(stateB64, sig, appSecret);
            if (!isValidSig) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'assinatura_invalida' }));
                return;
            }

            let payload = null;
            try {
                payload = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf8'));
            } catch (err) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'estado_invalido' }));
                return;
            }

            const userId = payload?.userId;
            if (!userId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'estado_invalido' }));
                return;
            }

            const appUrl = buildAppUrl(request);
            const redirectUri = `${appUrl.replace(/\/$/, '')}/api/oauth/meta/callback`;

            const tokenParams = new URLSearchParams();
            tokenParams.set('client_id', appId);
            tokenParams.set('client_secret', appSecret);
            tokenParams.set('redirect_uri', redirectUri);
            tokenParams.set('code', code);

            const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
            const tokenJson = await tokenRes.json();
            if (!tokenRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: tokenJson.error?.message || 'erro_ao_gerar_token' }));
                return;
            }

            const exchangeParams = new URLSearchParams();
            exchangeParams.set('grant_type', 'fb_exchange_token');
            exchangeParams.set('client_id', appId);
            exchangeParams.set('client_secret', appSecret);
            exchangeParams.set('fb_exchange_token', tokenJson.access_token);

            const exchangeRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${exchangeParams.toString()}`);
            const exchangeJson = await exchangeRes.json();
            if (!exchangeRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: exchangeJson.error?.message || 'erro_ao_gerar_token' }));
                return;
            }

            const accessToken = exchangeJson.access_token;
            const expiresIn = exchangeJson.expires_in || tokenJson.expires_in || null;
            const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

            const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
            const meJson = await meRes.json();
            if (!meRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: meJson.error?.message || 'erro_ao_buscar_conta' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const tableName = envVars['OAUTH_TOKENS_TABLE'] || 'user_oauth_tokens';
            const insertPayload = {
                user_id: userId,
                provider: 'meta',
                status: 'connected',
                external_id: meJson.id || null,
                external_name: meJson.name || null,
                access_token: accessToken,
                token_expires_at: tokenExpiresAt,
                meta: {
                    scope: exchangeJson.scope || tokenJson.scope || null,
                    token_type: exchangeJson.token_type || tokenJson.token_type || null
                }
            };

            const upsertUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}?on_conflict=user_id,provider`;
            const upsertRes = await fetch(upsertUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify(insertPayload)
            });

            if (!upsertRes.ok) {
                const errText = await upsertRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_conexao' }));
                return;
            }

            const redirectUrl = `${appUrl.replace(/\/$/, '')}/integracoes.html?provider=meta&status=connected`;
            response.writeHead(302, { Location: redirectUrl });
            response.end();
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const disconnectMatch = pathname.match(/^\/api\/clients\/(\d+)\/connections\/(instagram|facebook|google|linkedin|tiktok)\/disconnect$/);
    if (disconnectMatch && request.method === 'POST') {
        try {
            const clientId = disconnectMatch[1];
            const platform = disconnectMatch[2];
            const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
            if (!supabaseUrl || !supabaseAnonKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('client_id', `eq.${clientId}`);
            params.set('platform', `eq.${platform}`);
            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?${params.toString()}`;

            const headers = { apikey: supabaseAnonKey, 'Content-Type': 'application/json' };
            if (request.headers.authorization) {
                headers.Authorization = request.headers.authorization;
            } else {
                headers.Authorization = `Bearer ${supabaseAnonKey}`;
            }

            const payload = {
                status: 'disconnected',
                external_id: null,
                external_name: null,
                access_token: null,
                token_expires_at: null
            };

            const supabaseResponse = await fetch(targetUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(payload)
            });

            const data = await supabaseResponse.text();
            response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
            response.end(data || JSON.stringify({ success: true }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }


    // --- ARQUIVOS ESTÁTICOS ---
    
    // Remove query string para encontrar o arquivo
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                // Se não achar arquivo, tenta index.html (para rotas de SPA se necessário)
                // ou apenas 404. Aqui vamos de 404.
                console.log(`404: ${filePath}`);
                response.writeHead(404, { 'Content-Type': 'text/html' });
                response.end('<h1>404 - Arquivo não encontrado</h1>', 'utf-8');
            }
            else {
                response.writeHead(500);
                response.end('Erro no servidor: '+error.code+' ..\n');
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n=== SERVIDOR VIBECODE INICIADO ===`);
    console.log(`Local: http://localhost:${PORT}/`);
    console.log(`Backend seguro ativo: API Proxies prontos.`);
    console.log(`Pressione Ctrl+C para parar.\n`);
});
