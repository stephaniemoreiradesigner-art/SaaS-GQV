const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const axios = require('axios');

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

const SOCIAL_MEDIA_EXPERT_SYSTEM_PROMPT = `Você é um Estrategista Sênior de Social Media com mais de 15 anos de experiência em posicionamento de marca, construção de autoridade digital e geração de demanda.

Você domina:
- Arquitetura de funil de conteúdo
- Psicologia do consumidor
- Jornada de decisão
- Distribuição estratégica por semana
- Melhores horários de postagem baseados em comportamento de audiência
- Conversão indireta sofisticada

Sua missão é criar um calendário editorial mensal estratégico, profissional e altamente coerente com os insights do cliente selecionado.

=================================
ENTRADAS QUE VOCÊ RECEBERÁ
=================================

- posts_count
- seasonal_dates
- reference_file
- visual_identity
- previous_calendar_link
- client_insights (informações sobre público, nicho, comportamento, dados de engajamento, melhores dias/horários se disponíveis)

=================================
OBJETIVO DO CALENDÁRIO
=================================

Criar um planejamento que:

• Construa autoridade consistente
• Aumente percepção de valor
• Gere engajamento qualificado
• Prepare o público para conversão
• Utilize dias e horários estratégicos baseados nos insights fornecidos

=================================
ARQUITETURA ESTRATÉGICA DO MÊS
=================================

Dividir os conteúdos entre 4 pilares:

1) Autoridade Técnica
2) Posicionamento & Diferenciação
3) Prova & Credibilidade
4) Conversão Estratégica

Distribuir estrategicamente ao longo do mês.
Evitar excesso de posts comerciais consecutivos.

=================================
REGRAS OBRIGATÓRIAS
=================================

1) Gerar exatamente posts_count posts.
2) Incorporar seasonal_dates de forma estratégica.
3) Utilizar client_insights para:
   - Definir melhor dia da semana
   - Definir melhor horário de postagem
   - Adaptar linguagem ao público
4) Evitar repetição do calendário anterior.
5) Variar formatos e CTAs.
6) Não usar frases genéricas ou clichês.

=================================
PARA CADA POST, ENTREGAR:
=================================

- Data sugerida (DD/MM/AAAA)
- Dia da semana
- Horário sugerido (formato 24h)
- Semana estratégica
- Pilar estratégico
- Objetivo do post
- Tema central
- Formato recomendado (Reels, Carrossel ou Estático)
- Hook forte
- Estrutura do conteúdo
- Legenda completa
- CTA estratégico variado
- Hashtags (5 a 12)

=================================
DIRETRIZES SOBRE DATA E HORÁRIO
=================================

• Escolher dias coerentes com:
   - Tipo de conteúdo
   - Intensidade de venda
   - Padrão de consumo do público

• Escolher horários baseados em:
   - Se público é B2B → priorizar horário comercial (08h–11h ou 18h–20h)
   - Se público é B2C → considerar 12h–14h ou 19h–22h
   - Ajustar conforme client_insights se houver dados específicos

• Distribuir ao longo do mês de forma equilibrada.
• Evitar concentrar posts em dias consecutivos sem estratégia.

=================================
FORMATO DE RESPOSTA (OBRIGATÓRIO)
=================================

Responder SOMENTE com JSON válido, sem texto extra, sem comentários e sem markdown.

Formato obrigatório:
{
  "month": "YYYY-MM",
  "timezone": "America/Sao_Paulo",
  "posts": [
    {
      "scheduled_date": "YYYY-MM-DD",
      "scheduled_time": "HH:mm",
      "week": "Semana 1|Semana 2|Semana 3|Semana 4|Semana 5",
      "pillar": "Autoridade Técnica|Posicionamento & Diferenciação|Prova & Credibilidade|Conversão Estratégica",
      "objective": "Autoridade|Engajamento|Conversão|Posicionamento",
      "format": "Reels|Carrossel|Estático",
      "theme": "...",
      "hook": "...",
      "structure": "...",
      "caption": "...",
      "cta": "...",
      "hashtags": ["...", "..."]
    }
  ]
}`;

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
    const baseUrl = envVars['APP_BASE_URL'] || envVars['APP_URL'] || process.env.APP_BASE_URL || process.env.APP_URL || '';
    if (baseUrl) return baseUrl;
    const host = request.headers.host;
    if (!host) return '';
    const proto = request.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${host}`;
};

const getMetaRedirectUri = (request) => {
    const explicit = envVars['META_REDIRECT_URI'] || process.env.META_REDIRECT_URI || '';
    if (explicit) return explicit;
    const baseUrl = buildAppUrl(request);
    if (!baseUrl) return '';
    return `${baseUrl.replace(/\/$/, '')}/api/oauth/meta/callback`;
};

const handleClientMetaStart = async (request, response, parsedUrl, clientId) => {
    if (!clientId) {
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

    const redirectUri = getMetaRedirectUri(request);
    if (!redirectUri) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'meta_redirect_nao_configurado' }));
        return;
    }
    const nonce = crypto.randomBytes(16).toString('hex');
    const rawReturnTo = String((parsedUrl.query || {}).return_to || (parsedUrl.query || {}).returnTo || '').trim();
    const returnTo = rawReturnTo || '/automacoes_integracoes.html';
    const statePayload = { clientId, timeId, platform, nonce, ts: Date.now(), return_to: returnTo };
    const stateB64 = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    const sig = signState(stateB64, appSecret);
    const state = `${stateB64}.${sig}`;

    const responseType = 'code';
    const scope = ['public_profile', 'ads_read'].join(',');
    const params = new URLSearchParams();
    params.set('client_id', appId);
    params.set('redirect_uri', redirectUri);
    params.set('state', state);
    params.set('response_type', responseType);
    params.set('scope', scope);
    const configId = process.env.META_LOGIN_CONFIG_ID || '';
    if (configId) {
        params.set('config_id', configId);
    }

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    console.log('[META OAUTH URL]', authUrl);
    console.debug('OAuth Meta start', {
        clientId,
        redirect_uri: redirectUri,
        scope,
        response_type: responseType,
        platform,
        authUrl
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ auth_url: authUrl }));
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

const maskToken = (token) => {
    if (!token || typeof token !== 'string') return '';
    if (token.length <= 12) return `${token.slice(0, 4)}...`;
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
};

const appendQuery = (baseUrl, params) => {
    const urlParams = params instanceof URLSearchParams ? params : new URLSearchParams();
    if (params && !(params instanceof URLSearchParams)) {
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            urlParams.set(key, String(value));
        });
    }
    const query = urlParams.toString();
    if (!query) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${query}`;
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

    if (pathname === '/api/__version' && request.method === 'GET') {
        const commit = envVars['GIT_SHA'] || process.env.GIT_SHA || null;
        const nodeEnv = envVars['NODE_ENV'] || process.env.NODE_ENV || null;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ commit, env: nodeEnv }));
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

    if (pathname === '/api/colaboradores/convite' && request.method === 'GET') {
        try {
            const emailRaw = String(parsedUrl.query.email || '').trim().toLowerCase();
            if (!emailRaw) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'email_obrigatorio' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,email,ativo');
            params.set('email', `ilike.${emailRaw}`);
            params.set('ativo', 'eq.true');
            params.set('limit', '1');
            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/colaboradores?${params.toString()}`;

            const supabaseResponse = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_verificar_convite' }));
                return;
            }

            const row = Array.isArray(json) ? json[0] : null;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ allowed: !!row }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/openai/proxy' && request.method === 'POST') {
        try {
            const apiKey = envVars['OPENAI_API_KEY'];
            if (!apiKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'openai_proxy_error', message: 'OPENAI_API_KEY não configurada no backend (.env)' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch (parseError) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_json', message: 'Body inválido. Envie JSON.' }));
                return;
            }

            if (!body) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_body', message: 'Body obrigatório.' }));
                return;
            }

            const isCalendarMode = body.mode === 'calendar' || body.posts_count !== undefined;
            let calendarContext = null;
            let payload;

            if (isCalendarMode) {
                const postsCount = Number.isFinite(Number(body.posts_count)) && Number(body.posts_count) > 0 ? Number(body.posts_count) : 12;
                const seasonalDates = Array.isArray(body.seasonal_dates) ? body.seasonal_dates : [];
                const platforms = Array.isArray(body.platforms) ? body.platforms : [];
                const clientName = String(body.client_name || '').trim();
                const niche = String(body.niche || 'Geral').trim();
                const month = String(body.month || '').trim();
                const contextLink = String(body.context_link || '').trim();
                calendarContext = { postsCount, month };

                const seasonalText = seasonalDates.length ? `Datas sazonais do mês: ${seasonalDates.join(', ')}.` : 'Não há datas sazonais obrigatórias.';
                const platformsText = platforms.length ? `Plataformas ativas: ${platforms.join(', ')}.` : 'Plataformas ativas: não informadas.';
                const contextText = contextLink ? `Link de contexto: ${contextLink}.` : 'Sem link de contexto.';

                const userPrompt = [
                    `Cliente: ${clientName || 'Cliente sem nome'}.`,
                    `Nicho: ${niche}.`,
                    `Mês: ${month}.`,
                    `Quantidade de posts: ${postsCount}.`,
                    platformsText,
                    seasonalText,
                    contextText,
                    'Retorne JSON válido seguindo o schema pedido no system prompt.'
                ].join(' ');

                payload = {
                    model: body.model || 'gpt-4-turbo',
                    temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7,
                    messages: [
                        { role: 'system', content: SOCIAL_MEDIA_EXPERT_SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ]
                };
            } else {
                payload = body;
            }

            const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            const rawText = await openAiResponse.text();
            let responseJson = null;
            try {
                responseJson = JSON.parse(rawText);
            } catch (jsonError) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'openai_proxy_error', message: rawText || 'Resposta inválida da OpenAI.' }));
                return;
            }

            if (!openAiResponse.ok) {
                const message = responseJson?.error?.message || responseJson?.error || 'Erro na OpenAI.';
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'openai_proxy_error', message }));
                return;
            }

            if (isCalendarMode && calendarContext) {
                const contentRaw = String(responseJson?.choices?.[0]?.message?.content || '').trim();
                const sanitized = contentRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
                let calendarJson = null;
                try {
                    calendarJson = JSON.parse(sanitized);
                } catch (parseError) {
                    calendarJson = null;
                }

                if (Array.isArray(calendarJson)) {
                    calendarJson = {
                        month: calendarContext.month,
                        timezone: 'America/Sao_Paulo',
                        posts: calendarJson
                    };
                    responseJson.choices[0].message.content = JSON.stringify(calendarJson);
                } else if (!calendarJson || !Array.isArray(calendarJson.posts)) {
                    const converterPrompt = [
                        'Converta o texto abaixo em JSON válido no seguinte formato:',
                        '{',
                        '  "month": "YYYY-MM",',
                        '  "timezone": "America/Sao_Paulo",',
                        '  "posts": [',
                        '    {',
                        '      "scheduled_date": "YYYY-MM-DD",',
                        '      "scheduled_time": "HH:mm",',
                        '      "week": "Semana 1|Semana 2|Semana 3|Semana 4|Semana 5",',
                        '      "pillar": "Autoridade Técnica|Posicionamento & Diferenciação|Prova & Credibilidade|Conversão Estratégica",',
                        '      "objective": "Autoridade|Engajamento|Conversão|Posicionamento",',
                        '      "format": "Reels|Carrossel|Estático",',
                        '      "theme": "...",',
                        '      "hook": "...",',
                        '      "structure": "...",',
                        '      "caption": "...",',
                        '      "cta": "...",',
                        '      "hashtags": ["...", "..."]',
                        '    }',
                        '  ]',
                        '}',
                        `Use o mês informado para converter datas DD/MM/AAAA ou DD/MM. Mês atual: ${calendarContext.month}.`,
                        `Retorne EXATAMENTE ${calendarContext.postsCount} itens em posts.`,
                        'Se algum campo não existir no texto original, preencha com string vazia.',
                        'Texto para converter:',
                        contentRaw
                    ].join('\n');

                    const convertPayload = {
                        model: body.model || 'gpt-4-turbo',
                        temperature: 0.2,
                        messages: [
                            { role: 'system', content: 'Você converte conteúdo textual em JSON válido, sem explicações.' },
                            { role: 'user', content: converterPrompt }
                        ]
                    };

                    const convertResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(convertPayload)
                    });

                    const convertText = await convertResponse.text();
                    let convertJson = null;
                    try {
                        convertJson = JSON.parse(convertText);
                    } catch (convertParseError) {
                        response.writeHead(500, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'openai_proxy_error', message: 'Falha ao converter resposta para JSON.' }));
                        return;
                    }

                    const convertedContent = String(convertJson?.choices?.[0]?.message?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
                    let convertedObject = null;
                    try {
                        convertedObject = JSON.parse(convertedContent);
                    } catch (convertedParseError) {
                        response.writeHead(500, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'openai_proxy_error', message: 'Resposta convertida ainda inválida.' }));
                        return;
                    }

                    if (Array.isArray(convertedObject)) {
                        convertedObject = {
                            month: calendarContext.month,
                            timezone: 'America/Sao_Paulo',
                            posts: convertedObject
                        };
                    }

                    responseJson.choices[0].message.content = JSON.stringify(convertedObject);
                }
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(responseJson));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'openai_proxy_error', message: error.message }));
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

    if (pathname === '/api/meta/test-connection' && request.method === 'GET') {
        try {
            const systemUserToken = envVars['META_SYSTEM_USER_TOKEN'] || process.env.META_SYSTEM_USER_TOKEN || '';
            if (!systemUserToken) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'META_SYSTEM_USER_TOKEN não configurado' }));
                return;
            }

            const adAccountsUrl = `https://graph.facebook.com/v23.0/me/adaccounts?access_token=${systemUserToken}`;
            const pagesUrl = `https://graph.facebook.com/v23.0/me/accounts?access_token=${systemUserToken}`;

            const [adAccountsRes, pagesRes] = await Promise.all([
                axios.get(adAccountsUrl, { timeout: 10000 }),
                axios.get(pagesUrl, { timeout: 10000 })
            ]);

            const adAccounts = Array.isArray(adAccountsRes.data?.data) ? adAccountsRes.data.data : [];
            const pages = Array.isArray(pagesRes.data?.data) ? pagesRes.data.data : [];

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true, ad_accounts: adAccounts, pages }));
            return;
        } catch (error) {
            const message = error?.response?.data?.error?.message || error?.message || 'erro_ao_testar_meta';
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, error: message }));
            return;
        }
    }

    if (pathname === '/api/clients/list' && request.method === 'GET') {
        try {
            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado', missing: ['SUPABASE_SERVICE_ROLE_KEY'] }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,nome_fantasia,nome_empresa');
            params.set('order', 'nome_fantasia.asc,nome_empresa.asc');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?${params.toString()}`;
            const headers = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
            };

            const supabaseResponse = await fetch(targetUrl, { method: 'GET', headers });
            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_buscar_clientes' }));
                return;
            }

            const list = Array.isArray(json) ? json : [];
            const clients = list
                .map((cliente) => {
                    const nome = cliente?.nome_fantasia || cliente?.nome_empresa || '';
                    const id = cliente?.id ? String(cliente.id) : '';
                    return { id, nome };
                })
                .filter((cliente) => cliente.id && cliente.nome);

            clients.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ clients }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const connectionsListMatch = pathname.match(/^\/api\/clients\/(\d+)\/connections$/);
    if (connectionsListMatch && request.method === 'GET') {
        try {
            const clientId = connectionsListMatch[1];
            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado', missing: ['SUPABASE_SERVICE_ROLE_KEY'] }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,client_id,platform,status,external_id,external_name,token_expires_at,meta,time_id,scope');
            params.set('client_id', `eq.${clientId}`);
            params.set('order', 'platform.asc');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?${params.toString()}`;

            const headers = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
            };

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

    const metaStatusMatch = pathname.match(/^\/api\/clients\/(\d+)\/connections\/meta\/status$/);
    if (metaStatusMatch && request.method === 'GET') {
        try {
            const clientId = metaStatusMatch[1];
            const rawPlatform = String((parsedUrl.query || {}).platform || 'facebook').toLowerCase();
            const platform = ['facebook', 'instagram'].includes(rawPlatform) ? rawPlatform : 'facebook';

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'platform,status,token_expires_at');
            params.set('client_id', `eq.${clientId}`);
            params.set('platform', `eq.${platform}`);
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
            const connected = connection?.status === 'connected';
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                connected,
                platform,
                expires_at: connection?.token_expires_at || null
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const metaAssetsMatch = pathname.match(/^\/api\/clients\/(\d+)\/connections\/meta\/assets$/);
    if (metaAssetsMatch && request.method === 'GET') {
        try {
            const clientId = metaAssetsMatch[1];
            const rawPlatform = String((parsedUrl.query || {}).platform || 'facebook').toLowerCase();
            const platform = ['facebook', 'instagram'].includes(rawPlatform) ? rawPlatform : 'facebook';

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'access_token,status');
            params.set('client_id', `eq.${clientId}`);
            params.set('platform', `eq.${platform}`);
            params.set('status', 'in.(connected,configured)');
            params.set('limit', '1');

            const connUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?${params.toString()}`;
            const connRes = await fetch(connUrl, {
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

            console.log('META_ASSETS_LIST', { client_id: clientId, platform });

            const pagesParams = new URLSearchParams();
            pagesParams.set('fields', 'id,name,access_token');
            pagesParams.set('access_token', accessToken);
            const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?${pagesParams.toString()}`);
            const pagesJson = await pagesRes.json();
            if (!pagesRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: pagesJson.error?.message || 'erro_ao_listar_pages' }));
                return;
            }

            const pagesBase = Array.isArray(pagesJson.data) ? pagesJson.data : [];
            const pagesWithIg = await Promise.all(pagesBase.map(async (item) => {
                const pageId = item?.id;
                if (!pageId) return null;
                const igParams = new URLSearchParams();
                igParams.set('fields', 'instagram_business_account');
                igParams.set('access_token', accessToken);
                const igRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?${igParams.toString()}`);
                const igJson = await igRes.json().catch(() => null);
                const igBusinessId = igRes.ok ? igJson?.instagram_business_account?.id || null : null;
                return {
                    id: item.id,
                    name: item.name,
                    page_access_token: item.access_token || null,
                    ig_business_id: igBusinessId
                };
            }));

            const pages = pagesWithIg.filter(Boolean);

            const adParams = new URLSearchParams();
            adParams.set('fields', 'id,name,account_id');
            adParams.set('access_token', accessToken);
            const adRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?${adParams.toString()}`);
            const adJson = await adRes.json();
            if (!adRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: adJson.error?.message || 'erro_ao_listar_adaccounts' }));
                return;
            }

            const adaccounts = Array.isArray(adJson.data)
                ? adJson.data.map(item => ({
                    id: item.id,
                    name: item.name,
                    account_id: item.account_id
                }))
                : [];

            console.log('META_ASSETS_LIST_RESULT', {
                client_id: clientId,
                page_ids: pages.map(page => page.id),
                ad_account_ids: adaccounts.map(ad => ad.id)
            });

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ pages, adaccounts }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (metaAssetsMatch && request.method === 'POST') {
        try {
            const clientId = Number(metaAssetsMatch[1]);
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

            const pageId = String(body?.page_id || '').trim();
            const pageAccessToken = String(body?.page_access_token || '').trim();
            const pageName = String(body?.page_name || '').trim() || null;
            const igBusinessId = String(body?.ig_business_id || '').trim();
            const igUsername = String(body?.ig_username || '').trim() || null;
            const adAccountId = String(body?.ad_account_id || '').trim();
            const adAccountName = String(body?.ad_account_name || '').trim() || null;

            if (!pageId || !pageAccessToken) {
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

            console.log('META_ASSETS_SAVE', {
                client_id: clientId,
                page_id: pageId,
                ig_business_id: igBusinessId || null,
                ad_account_id: adAccountId || null
            });

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

            const selectedPayload = {
                client_id: clientId,
                time_id: timeId,
                meta_page_id: pageId,
                meta_page_name: pageName,
                meta_page_access_token: pageAccessToken,
                meta_ig_user_id: igBusinessId || null,
                meta_ig_username: igUsername || null
            };

            const selectedUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_selected_assets?on_conflict=client_id`;
            const selectedRes = await fetch(selectedUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify(selectedPayload)
            });

            if (!selectedRes.ok) {
                const errText = await selectedRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_assets' }));
                return;
            }

            const clientUpdateUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?id=eq.${clientId}`;
            const clientUpdatePayload = {
                facebook_page_id: pageId,
                instagram_id: igBusinessId || null
            };
            const clientUpdateRes = await fetch(clientUpdateUrl, {
                method: 'PATCH',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientUpdatePayload)
            });

            if (!clientUpdateRes.ok) {
                const errText = await clientUpdateRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_atualizar_cliente' }));
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

            const adPatchUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_social_assets?client_id=eq.${clientId}&provider=eq.meta&asset_type=eq.ad_account`;
            const adPatchRes = await fetch(adPatchUrl, {
                method: 'PATCH',
                headers: patchHeaders,
                body: JSON.stringify({ is_primary: false })
            });
            if (!adPatchRes.ok) {
                const errText = await adPatchRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_atualizar_assets' }));
                return;
            }

            const assetsPayload = [
                {
                    client_id: clientId,
                    time_id: timeId,
                    provider: 'meta',
                    asset_type: 'page',
                    asset_id: pageId,
                    asset_name: pageName,
                    is_primary: true
                }
            ];

            if (igBusinessId) {
                assetsPayload.push({
                    client_id: clientId,
                    time_id: timeId,
                    provider: 'meta',
                    asset_type: 'ig_user',
                    asset_id: igBusinessId,
                    asset_name: igUsername,
                    is_primary: true
                });
            }

            if (adAccountId) {
                assetsPayload.push({
                    client_id: clientId,
                    time_id: timeId,
                    provider: 'meta',
                    asset_type: 'ad_account',
                    asset_id: adAccountId,
                    asset_name: adAccountName,
                    is_primary: true
                });
            }

            const assetsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_social_assets?on_conflict=client_id,provider,asset_type,asset_id`;
            const assetsRes = await fetch(assetsUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify(assetsPayload)
            });

            if (!assetsRes.ok) {
                const errText = await assetsRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_assets' }));
                return;
            }

            const metaStatusUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_platform_connections?client_id=eq.${clientId}&platform=in.(facebook,instagram)`;
            const metaStatusRes = await fetch(metaStatusUrl, {
                method: 'PATCH',
                headers: patchHeaders,
                body: JSON.stringify({
                    status: 'configured',
                    meta: {
                        page_id: pageId,
                        ig_business_id: igBusinessId || null,
                        ad_account_id: adAccountId || null
                    }
                })
            });

            if (!metaStatusRes.ok) {
                const errText = await metaStatusRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_atualizar_status' }));
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

    const clientMetaPagesV2Match = pathname.match(/^\/api\/clients\/(\d+)\/meta\/pages$/);
    if (clientMetaPagesV2Match && request.method === 'GET') {
        try {
            const clientId = Number(clientMetaPagesV2Match[1]);
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

    const clientMetaPageInstagramMatch = pathname.match(/^\/api\/clients\/(\d+)\/meta\/page\/([^/]+)\/instagram$/);
    if (clientMetaPageInstagramMatch && request.method === 'GET') {
        try {
            const clientId = Number(clientMetaPageInstagramMatch[1]);
            const pageId = clientMetaPageInstagramMatch[2];
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

            let pageAccessToken = String((parsedUrl.query || {}).page_access_token || '').trim();
            if (!pageAccessToken) {
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

                const pages = Array.isArray(graphJson.data) ? graphJson.data : [];
                const match = pages.find(item => String(item.id) === String(pageId));
                pageAccessToken = match?.access_token || '';
            }

            if (!pageAccessToken) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'page_access_token_nao_encontrado' }));
                return;
            }

            const graphParams = new URLSearchParams();
            graphParams.set('fields', 'instagram_business_account{id,username}');
            graphParams.set('access_token', pageAccessToken);
            const graphRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?${graphParams.toString()}`);
            const graphJson = await graphRes.json();
            if (!graphRes.ok) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: graphJson.error?.message || 'erro_ao_buscar_instagram' }));
                return;
            }

            const igAccount = graphJson.instagram_business_account || null;
            const payload = igAccount
                ? { ig_user_id: igAccount.id, ig_username: igAccount.username || null }
                : { ig_user_id: null, ig_username: null };

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaSelectMatch = pathname.match(/^\/api\/clients\/(\d+)\/meta\/select$/);
    if (clientMetaSelectMatch && request.method === 'POST') {
        try {
            const clientId = Number(clientMetaSelectMatch[1]);
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

            const pageId = String(body?.page_id || '').trim();
            const pageName = String(body?.page_name || '').trim() || null;
            const pageAccessToken = String(body?.page_access_token || '').trim();
            const igUserId = String(body?.ig_user_id || '').trim();
            const igUsername = String(body?.ig_username || '').trim() || null;

            if (!pageId || !pageAccessToken || !igUserId) {
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

            const payload = {
                client_id: clientId,
                time_id: timeId,
                meta_page_id: pageId,
                meta_page_name: pageName,
                meta_page_access_token: pageAccessToken,
                meta_ig_user_id: igUserId,
                meta_ig_username: igUsername,
                updated_at: new Date().toISOString()
            };

            const upsertUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_selected_assets?on_conflict=client_id`;
            const upsertRes = await fetch(upsertUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });

            if (!upsertRes.ok) {
                const errText = await upsertRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_selecao' }));
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

    const clientSelectedAssetsMatch = pathname.match(/^\/api\/clients\/(\d+)\/assets\/selected$/);
    if (clientSelectedAssetsMatch && request.method === 'GET') {
        try {
            const clientId = Number(clientSelectedAssetsMatch[1]);
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
            params.set('select', '*');
            params.set('client_id', `eq.${clientId}`);
            params.set('limit', '1');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_selected_assets?${params.toString()}`;
            const assetsRes = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });

            const assetsJson = await assetsRes.json().catch(() => null);
            if (!assetsRes.ok) {
                response.writeHead(assetsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(assetsJson || { error: 'erro_ao_buscar_assets' }));
                return;
            }

            const row = Array.isArray(assetsJson) ? assetsJson[0] || null : null;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: row }));
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

    const clientMetaConnectionsStartMatch = pathname.match(/^\/api\/clients\/([0-9a-fA-F-]{36}|\d+)\/connections\/meta\/start$/);
    const clientMetaOauthStartMatch = pathname.match(/^\/api\/clients\/([0-9a-fA-F-]{36}|\d+)\/oauth\/meta\/start$/);
    const clientMetaStartMatch = clientMetaConnectionsStartMatch || clientMetaOauthStartMatch;
    if (clientMetaStartMatch && (request.method === 'GET' || request.method === 'POST')) {
        try {
            const clientId = String(clientMetaStartMatch[1] || '').trim();
            await handleClientMetaStart(request, response, parsedUrl, clientId);
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientMetaCallbackMatch = pathname.match(/^\/api\/clients\/([0-9a-fA-F-]{36}|\d+)\/oauth\/meta\/callback$/);
    if (clientMetaCallbackMatch && request.method === 'GET') {
        try {
            const clientId = String(clientMetaCallbackMatch[1] || '').trim();
            const query = parsedUrl.query || {};
            const code = query.code;
            if (!clientId || !code) {
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
            const redirectUri = appUrl ? `${appUrl.replace(/\/$/, '')}${pathname}` : pathname;

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

            const exchangeRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${exchangeParams.toString()}`);
            const exchangeJson = await exchangeRes.json();
            if (!exchangeRes.ok) {
                console.error('Erro ao trocar token Meta:', exchangeJson.error?.message || 'erro_ao_gerar_token');
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: exchangeJson.error?.message || 'erro_ao_gerar_token' }));
                return;
            }

            const accessToken = exchangeJson.access_token;
            const expiresIn = Number(exchangeJson.expires_in);
            const tokenExpiresAt = Number.isFinite(expiresIn)
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null;
            const rawPlatform = String(query.platform || 'facebook').toLowerCase();
            const platform = ['facebook', 'instagram'].includes(rawPlatform) ? rawPlatform : 'facebook';
            const scope = ['public_profile', 'ads_read'].join(',');

            const upsertPayload = {
                client_id: clientId,
                time_id: timeId,
                platform,
                status: 'connected',
                access_token: accessToken,
                token_expires_at: tokenExpiresAt,
                scope
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
                body: JSON.stringify(upsertPayload)
            });

            if (!upsertRes.ok) {
                const errText = await upsertRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_conexao' }));
                return;
            }

            const redirectUrl = appUrl
                ? `${appUrl.replace(/\/$/, '')}/automacoes_integracoes.html?provider=meta&status=connected&client_id=${encodeURIComponent(clientId)}`
                : `/automacoes_integracoes.html?provider=meta&status=connected&client_id=${encodeURIComponent(clientId)}`;
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

            const redirectUri = getMetaRedirectUri(request);
            if (!redirectUri) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'meta_redirect_nao_configurado' }));
                return;
            }
            const nonce = crypto.randomBytes(16).toString('hex');
            const rawReturnTo = String((parsedUrl.query || {}).return_to || (parsedUrl.query || {}).returnTo || '').trim();
            const returnTo = rawReturnTo || '/automacoes_integracoes.html';
            const statePayload = { userId, platform: 'meta', nonce, ts: Date.now(), return_to: returnTo };
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
            const errorParam = query.error || query.error_reason || query.error_description;

            console.log('META_CALLBACK_START', {
                has_error: !!errorParam,
                has_code: !!code,
                has_state: !!state
            });

            const defaultReturnTo = '/automacoes_integracoes.html';
            const appId = envVars['FACEBOOK_APP_ID'] || '';
            const appSecret = envVars['FACEBOOK_APP_SECRET'] || '';

            const redirectToFront = (target, params) => {
                const url = appendQuery(target || defaultReturnTo, params);
                console.log('REDIRECTING_TO_FRONT', { url });
                response.writeHead(302, { Location: url });
                response.end();
            };

            const parseStatePayload = () => {
                if (!state) return { ok: false, reason: 'estado_ausente' };
                if (!appSecret) return { ok: false, reason: 'meta_nao_configurado' };
                const stateParts = String(state).split('.');
                if (stateParts.length !== 2 || !stateParts[0] || !stateParts[1]) {
                    return { ok: false, reason: 'parametros_invalidos' };
                }
                const stateB64 = stateParts[0];
                const sig = stateParts[1];
                const isValidSig = verifyStateSig(stateB64, sig, appSecret);
                if (!isValidSig) return { ok: false, reason: 'assinatura_invalida' };
                let payload = null;
                try {
                    payload = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf8'));
                } catch {
                    return { ok: false, reason: 'estado_invalido' };
                }
                const stateTtlMs = 10 * 60 * 1000;
                const now = Date.now();
                const ts = Number(payload?.ts);
                if (!Number.isFinite(ts) || Math.abs(now - ts) > stateTtlMs) {
                    return { ok: false, reason: 'estado_expirado' };
                }
                return { ok: true, payload };
            };

            const parsedState = parseStatePayload();
            const payload = parsedState.ok ? parsedState.payload : null;
            const payloadClientId = String(payload?.clientId || '').trim();
            const payloadPlatform = String(payload?.platform || '').toLowerCase();
            const rawReturnTo = typeof payload?.return_to === 'string' ? payload.return_to.trim() : '';
            const returnTo = rawReturnTo || defaultReturnTo;

            if (parsedState.ok) {
                console.log('STATE_OK', {
                    clientId: payloadClientId,
                    platform: payloadPlatform,
                    return_to: returnTo
                });
            }

            if (errorParam) {
                const reason = String(errorParam);
                redirectToFront(returnTo, {
                    meta: 'error',
                    reason,
                    client_id: payloadClientId || undefined
                });
                return;
            }

            if (!code || !state) {
                redirectToFront(returnTo, {
                    meta: 'error',
                    reason: 'parametros_invalidos',
                    client_id: payloadClientId || undefined
                });
                return;
            }

            if (!parsedState.ok) {
                redirectToFront(defaultReturnTo, { meta: 'error', reason: parsedState.reason || 'estado_invalido' });
                return;
            }

            if (!appId || !appSecret) {
                redirectToFront(returnTo, { meta: 'error', reason: 'meta_nao_configurado', client_id: payloadClientId || undefined });
                return;
            }

            const platform = ['facebook', 'instagram'].includes(payloadPlatform) ? payloadPlatform : 'facebook';
            if (!payloadClientId) {
                redirectToFront(returnTo, { meta: 'error', reason: 'cliente_invalido' });
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                redirectToFront(returnTo, { meta: 'error', reason: 'service_role_nao_configurada', client_id: payloadClientId });
                return;
            }

            const clientParams = new URLSearchParams();
            clientParams.set('select', 'id,time_id');
            clientParams.set('id', `eq.${payloadClientId}`);
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
                redirectToFront(returnTo, { meta: 'error', reason: 'cliente_nao_encontrado', client_id: payloadClientId });
                return;
            }
            const timeId = clientJson[0]?.time_id || null;
            if (!timeId) {
                redirectToFront(returnTo, { meta: 'error', reason: 'time_id_invalido', client_id: payloadClientId });
                return;
            }

            const redirectUri = getMetaRedirectUri(request);
            if (!redirectUri) {
                redirectToFront(returnTo, { meta: 'error', reason: 'meta_redirect_nao_configurado', client_id: payloadClientId });
                return;
            }

            const tokenParams = new URLSearchParams();
            tokenParams.set('client_id', appId);
            tokenParams.set('client_secret', appSecret);
            tokenParams.set('redirect_uri', redirectUri);
            tokenParams.set('code', code);

            const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
            const tokenJson = await tokenRes.json();
            if (!tokenRes.ok) {
                redirectToFront(returnTo, { meta: 'error', reason: tokenJson.error?.message || 'erro_ao_gerar_token', client_id: payloadClientId });
                return;
            }

            const exchangeParams = new URLSearchParams();
            exchangeParams.set('grant_type', 'fb_exchange_token');
            exchangeParams.set('client_id', appId);
            exchangeParams.set('client_secret', appSecret);
            exchangeParams.set('fb_exchange_token', tokenJson.access_token);

            const exchangeRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${exchangeParams.toString()}`);
            const exchangeJson = await exchangeRes.json();
            if (!exchangeRes.ok) {
                redirectToFront(returnTo, { meta: 'error', reason: exchangeJson.error?.message || 'erro_ao_gerar_token', client_id: payloadClientId });
                return;
            }

            const accessToken = exchangeJson.access_token;
            const expiresIn = Number(exchangeJson.expires_in);
            const tokenExpiresAt = Number.isFinite(expiresIn)
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null;

            console.log('TOKEN_EXCHANGED', { token: maskToken(accessToken) });

            const upsertPayload = {
                client_id: payloadClientId,
                time_id: timeId,
                platform,
                status: 'connected',
                access_token: accessToken,
                token_expires_at: tokenExpiresAt,
                meta: { provider: 'meta' }
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
                body: JSON.stringify(upsertPayload)
            });

            if (!upsertRes.ok) {
                redirectToFront(returnTo, { meta: 'error', reason: 'erro_ao_salvar_conexao', client_id: payloadClientId });
                return;
            }

            console.log('TOKEN_SAVED', { clientId: payloadClientId, platform });

            redirectToFront(returnTo, {
                client_id: payloadClientId,
                meta: 'connected',
                platform
            });
            return;
        } catch (error) {
            const url = appendQuery('/automacoes_integracoes.html', { meta: 'error', reason: 'erro_interno' });
            console.log('REDIRECTING_TO_FRONT', { url });
            response.writeHead(302, { Location: url });
            response.end();
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
