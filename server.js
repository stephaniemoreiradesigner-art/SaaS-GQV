require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const axios = require('axios');
const express = require('express');
const v2Router = require('./src/v2/routes/index.js');

// Configuração do App Express v2
const app = express();
app.use(express.json()); // Parse JSON bodies
app.use('/api/v2', v2Router); // Mount v2 router


const PORT = process.env.PORT || 3000;
const CALENDAR_STATUS_VALUES = {
    DRAFT: 'draft',
    IN_PRODUCTION: 'in_production',
    AWAITING_APPROVAL: 'awaiting_approval',
    APPROVED: 'approved',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
};
const POST_STATUS_VALUES = {
    DRAFT: 'draft',
    BRIEFING_SENT: 'briefing_sent',
    DESIGN_IN_PROGRESS: 'design_in_progress',
    READY_FOR_APPROVAL: 'ready_for_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SCHEDULED: 'scheduled',
    PUBLISHED: 'published'
};
const SOCIAL_DASHBOARD_CACHE_TTL = 60000;
const socialDashboardCache = new Map();

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
- persona_briefing
- brand_kit_url
- reference_doc_url
- ai_memory_summary
- history_summary
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
7) Proibido inventar eventos, feiras, webinars, workshops, palestras, datas comemorativas ou notícias fora de seasonal_dates.
8) Se seasonal_dates estiver vazio, não mencionar nenhuma data/evento.

=================================
PARA CADA POST, ENTREGAR:
=================================

- Date no formato YYYY-MM-DD
- Format no formato static|carousel|reels
- Theme com título curto e claro
- Creative_suggestion com descrição visual obrigatória
- Detailed_content obrigatório com roteiro completo
- Captions com:
  - meta (Instagram/Facebook)
  - linkedin (se LinkedIn estiver ativo)
  - tiktok (se TikTok estiver ativo)

=================================
REGRAS DO CONTEÚDO DETALHADO (OBRIGATÓRIO)
=================================

- Se format = carousel:
  - detailed_content deve conter Slides 1..N com título, subtítulo, bullets e sugestão visual por slide
- Se format = reels:
  - detailed_content deve conter roteiro com Cena 1..N, narração por cena, texto na tela e instruções de gravação/edição
- Se format = static:
  - detailed_content deve conter título, subtítulo, texto da arte (curto) e composição visual

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
      "date": "YYYY-MM-DD",
      "format": "static|carousel|reels",
      "theme": "string",
      "creative_suggestion": "string",
      "detailed_content": "string",
      "captions": {
        "meta": "string",
        "linkedin": "string",
        "tiktok": "string"
      }
    }
  ]
}`;

const DESIGNER_SENIOR_CREATIVE_PROMPT = `Você é um Diretor de Arte e Designer Sênior (15+ anos) especializado em conteúdo de performance orgânica para Instagram/Facebook (Meta), LinkedIn e TikTok. 

TAREFA 
Gerar um guia visual executável para o post, baseado no tema, formato e legenda. 
O guia deve ser tão claro que uma pessoa leiga consiga executar. 

ENTRADAS 
- platform_targets (meta/linkedin/tiktok) 
- format (Reels/Carrossel/Estático) 
- theme 
- hook (se houver) 
- caption (legenda) 
- visual_identity (se houver) 
- seasonal_dates (lista permitida; pode estar vazia) 

REGRAS ANTI-ALUCINAÇÃO 
- Proibido inventar eventos, feiras, webinars, workshops, palestras, datas comemorativas ou notícias. 
- Só mencionar algo se estiver explicitamente em seasonal_dates. 
- Proibido inventar números/estatísticas/resultados. 

ENTREGA (TEM QUE SER EXECUTÁVEL) 
Retorne um JSON válido, sem markdown, com o campo "criativo". 

ADAPTAÇÃO POR FORMATO 
- Se format = Estático:
  "criativo": {
    "tipo": "Estático",
    "conceito_visual": "",
    "composicao": "",
    "texto_na_arte": "",
    "banco_imagens_sugerido": "",
    "checklist_designer": ["..."]
  }
- Se format = Carrossel:
  "criativo": {
    "tipo": "Carrossel",
    "slides": [
      { "titulo_do_slide": "", "copy": "", "visual_sugerido": "" }
    ],
    "checklist_designer": ["..."]
  }
- Se format = Reels/TikTok:
  "criativo": {
    "tipo": "Reels",
    "roteiro": { "gancho": "", "desenvolvimento": "", "encerramento": "" },
    "cenas_sugeridas": ["..."],
    "sugestoes_captacao": ["..."]
  }

SAÍDA (JSON-ONLY) 
Retorne SOMENTE um JSON válido, sem markdown: 

{ 
  "criativo": {}
}`;

const IMPROVE_COPY_PROMPT = `Você é um Copywriter Sênior e Estrategista de Conteúdo com 15+ anos de experiência em crescimento orgânico (Instagram/Facebook), retenção e conversão indireta.

TAREFA
Você vai melhorar APENAS a copy do post existente: legenda (caption), CTA e hashtags.
Você NÃO pode alterar o tema, o formato, o pilar, o objetivo estratégico, o roteiro/estrutura ou qualquer elemento estrutural do post.

ENTRADAS
Você receberá:
- client_insights (público, dores, desejos, linguagem, dados e preferências se existirem)
- visual_identity (tom de voz, posicionamento, termos preferidos/proibidos)
- seasonal_dates (lista de datas especiais permitidas; pode estar vazia)
- post (theme, format, pillar, objective, structure, caption, cta, hashtags)

REGRAS ANTI-ALUCINAÇÃO (OBRIGATÓRIAS)
- É PROIBIDO inventar eventos, feiras, webinars, workshops, palestras, lançamentos, datas comemorativas, notícias, parcerias ou “acontecimentos”.
- Só mencione uma data/evento se ela estiver explicitamente em seasonal_dates.
- Se seasonal_dates estiver vazio, NÃO mencione nenhuma data/evento.
- É PROIBIDO inventar números, percentuais, estatísticas, “pesquisas”, “dados”, “métricas” ou resultados.
- Não citar marcas/empresas específicas sem estarem presentes nas entradas.
- Não prometer resultados garantidos.

DIRETRIZES DE PERFORMANCE ORGÂNICA
- Abra com um hook forte e específico nas 1–2 primeiras linhas.
- Use escrita escaneável: frases curtas, quebras de linha, ritmo.
- Aumente salvamentos e compartilhamentos com valor aplicável (checklist, passo a passo, insight acionável).
- Mantenha linguagem profissional e natural (pt-BR), sem clichês.
- CTA deve ser “suave” e variado (ex.: “Se fizer sentido, salve para aplicar”, “Compartilhe com alguém que precisa ver isso”, “Aplique hoje e observe X”).
- PROIBIDO usar CTAs do tipo: “digite”, “envie”, “comente ‘X’”, “manda DM”.
- Hashtags: 5 a 12, relevantes ao nicho e ao tema, sem tags genéricas demais em excesso.

SAÍDA (JSON-ONLY)
Retorne SOMENTE um JSON válido (sem markdown, sem texto extra), exatamente neste formato:

{
  "caption": "string",
  "cta": "string",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Checklist antes de responder:
- Não alterei theme/format/pillar/objective/structure.
- Não inventei eventos ou números.
- JSON válido.`;

const CHANGE_THEME_PROMPT = `Você é um Estrategista Sênior de Social Media com 15+ anos, especializado em crescimento orgânico, posicionamento e narrativa de marca.

TAREFA
Você deve “trocar o tema” do post, refazendo TODO o conteúdo do post, mantendo as restrições.
Você deve gerar: theme, hook, structure, caption, cta, hashtags.

RESTRIÇÕES (NÃO PODE MUDAR)
- pillar (pilar estratégico)
- objective (objetivo)
- format (Reels/Carrossel/Estático)
- scheduled_date e scheduled_time (data e horário já definidos)

ENTRADAS
Você receberá:
- client_insights
- visual_identity
- seasonal_dates (lista de datas especiais permitidas; pode estar vazia)
- constraints: { scheduled_date, scheduled_time, pillar, objective, format }
- post: { current_theme (opcional), current_hook (opcional) }

REGRAS ANTI-ALUCINAÇÃO (OBRIGATÓRIAS)
- É PROIBIDO inventar eventos, feiras, webinars, workshops, palestras, lançamentos, datas comemorativas, notícias, parcerias ou “acontecimentos”.
- Só mencione uma data/evento se estiver explicitamente em seasonal_dates.
- Se seasonal_dates estiver vazio, NÃO mencione nenhuma data/evento.
- É PROIBIDO inventar números, percentuais, estatísticas, pesquisas, métricas ou resultados.
- Não citar marcas/empresas específicas sem estarem presentes nas entradas.
- Não prometer resultados garantidos.

DIRETRIZES DE PERFORMANCE ORGÂNICA
- O novo tema deve ser:
  • relevante ao público
  • consistente com o pilar e objetivo
  • diferente do tema atual (evitar repetição)
  • específico e acionável (nada genérico)

- O hook deve ser curto, forte e específico.
- A structure deve seguir o format:
  • Carrossel: descrever card a card (5 a 8 cards)
  • Reels: roteiro em etapas (abertura, desenvolvimento, fechamento)
  • Estático: conceito + bullets de apoio + ângulo (contraste/erro comum/checklist)

- A caption deve:
  • trazer valor prático
  • ser escaneável
  • ter coerência com o hook e structure
  • terminar com CTA suave e variado (sem “digite/envie/comente X”)

- Hashtags: 5 a 12, relevantes e específicas.

SAÍDA (JSON-ONLY)
Retorne SOMENTE um JSON válido (sem markdown, sem texto extra), exatamente neste formato:

{
  "theme": "string",
  "hook": "string",
  "structure": "string",
  "caption": "string",
  "cta": "string",
  "hashtags": ["tag1","tag2","tag3","tag4","tag5"]
}

Checklist antes de responder:
- Mantive pillar/objective/format/scheduled_date/scheduled_time.
- Não inventei eventos nem números.
- Tema é diferente do atual.
- JSON válido.`;

const readRequestBody = async (request) => {
    const buffers = [];
    for await (const chunk of request) {
        buffers.push(chunk);
    }
    const raw = Buffer.concat(buffers).toString();
    console.log('RAW_CHUNKS:', raw);
    return raw;
};

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';

        req.setEncoding('utf8');

        req.on('data', chunk => {
            data += chunk;
        });

        req.on('end', () => {
            resolve(data);
        });

        req.on('error', err => {
            reject(err);
        });
    });
}

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

const parseOAuthStatePayload = (state) => {
    if (!state) return null;
    try {
        const parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    try {
        const parsed = JSON.parse(String(state));
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return null;
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

const parseCookies = (cookieHeader) => {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach((part) => {
        const index = part.indexOf('=');
        if (index <= 0) return;
        const key = decodeURIComponent(part.slice(0, index).trim());
        const value = decodeURIComponent(part.slice(index + 1).trim());
        if (key) cookies[key] = value;
    });
    return cookies;
};

const getAccessTokenFromCookies = (cookies) => {
    if (cookies['sb-access-token']) return cookies['sb-access-token'];
    if (cookies['supabase-auth-token']) {
        try {
            const parsed = JSON.parse(cookies['supabase-auth-token']);
            if (Array.isArray(parsed) && parsed[0]) return parsed[0];
        } catch {
            return '';
        }
    }
    const cookieKeys = Object.keys(cookies);
    for (const key of cookieKeys) {
        if (!key.endsWith('-auth-token')) continue;
        try {
            const parsed = JSON.parse(cookies[key]);
            if (Array.isArray(parsed) && parsed[0]) return parsed[0];
        } catch {
            continue;
        }
    }
    return '';
};

const getAccessTokenFromRequest = (request) => {
    const bearer = getBearerToken(request);
    if (bearer) return bearer;
    const cookies = parseCookies(request.headers.cookie || '');
    return getAccessTokenFromCookies(cookies);
};

const supabaseRest = async (request, pathWithQuery, method = 'GET', body = null) => {
    const token = getBearerToken(request);
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey) {
        return { status: 500, data: { error: 'supabase_nao_configurado' }, text: '' };
    }
    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const targetUrl = `${baseUrl}${normalizedPath}`;
    const headers = {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
    };
    if (body !== null && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(targetUrl, {
        method,
        headers,
        body: body !== null && body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    return { status: response.status, data, text };
};

const requireSession = async (request, response) => {
    const token = getAccessTokenFromRequest(request);
    if (!token) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'unauthorized' }));
        return null;
    }
    if (!request.headers.authorization) {
        request.headers.authorization = `Bearer ${token}`;
    }
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
        return null;
    }
    const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`
        }
    });
    const userJson = await userRes.json().catch(() => null);
    if (!userRes.ok) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'unauthorized' }));
        return null;
    }
    const userId = userJson?.id || userJson?.user?.id || null;
    const email = userJson?.email || userJson?.user?.email || null;
    const metadata = userJson?.user_metadata || userJson?.user?.user_metadata || {};
    const name = metadata?.full_name || metadata?.name || metadata?.nome || metadata?.display_name || email || null;
    if (!userId) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'unauthorized' }));
        return null;
    }
    request.user = { id: userId, email, name };
    return { user: request.user, accessToken: token };
};

const requireAuth = async (request, response) => {
    const session = await requireSession(request, response);
    if (!session) return null;
    return session.user;
};

const getProfileForUser = async (request, userId) => {
    if (!userId) return null;
    const byId = await supabaseRest(
        request,
        `/rest/v1/profiles?select=id,role,tenant_id,client_id&id=eq.${userId}&limit=1`
    );
    const rowById = Array.isArray(byId.data) ? byId.data[0] : null;
    if (rowById) return rowById;
    const byUserId = await supabaseRest(
        request,
        `/rest/v1/profiles?select=id,role,tenant_id,client_id&user_id=eq.${userId}&limit=1`
    );
    return Array.isArray(byUserId.data) ? byUserId.data[0] : null;
};

const getAuthedProfile = async (request, response) => {
    const user = await requireAuth(request, response);
    if (!user) return null;
    const profile = await getProfileForUser(request, user.id);
    if (!profile) {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'profile_not_found' }));
        return null;
    }
    return { user, profile };
};

const resolveTenantIdFromClientId = async (request, clientId) => {
    if (!clientId) return null;
    const approvalRes = await supabaseRest(
        request,
        `/rest/v1/client_approvals?select=item_id,type&client_id=eq.${clientId}&limit=1`
    );
    const approvalRow = Array.isArray(approvalRes.data) ? approvalRes.data[0] : null;
    if (!approvalRow?.item_id) return null;
    const type = String(approvalRow.type || '').trim().toLowerCase();
    const itemId = approvalRow.item_id;
    if (type === 'post') {
        const postRes = await supabaseRest(
            request,
            `/rest/v1/social_posts?select=calendar_id,social_calendars!inner(tenant_id)&id=eq.${itemId}&limit=1`
        );
        const postRow = Array.isArray(postRes.data) ? postRes.data[0] : null;
        return postRow?.social_calendars?.tenant_id || postRow?.tenant_id || null;
    }
    if (type === 'calendar') {
        const calendarRes = await supabaseRest(
            request,
            `/rest/v1/social_calendars?select=tenant_id&id=eq.${itemId}&limit=1`
        );
        const calendarRow = Array.isArray(calendarRes.data) ? calendarRes.data[0] : null;
        return calendarRow?.tenant_id || null;
    }
    const postRes = await supabaseRest(
        request,
        `/rest/v1/social_posts?select=calendar_id,social_calendars!inner(tenant_id)&id=eq.${itemId}&limit=1`
    );
    const postRow = Array.isArray(postRes.data) ? postRes.data[0] : null;
    if (postRow?.social_calendars?.tenant_id || postRow?.tenant_id) {
        return postRow?.social_calendars?.tenant_id || postRow?.tenant_id || null;
    }
    const calendarRes = await supabaseRest(
        request,
        `/rest/v1/social_calendars?select=tenant_id&id=eq.${itemId}&limit=1`
    );
    const calendarRow = Array.isArray(calendarRes.data) ? calendarRes.data[0] : null;
    return calendarRow?.tenant_id || null;
};

const getAuthContext = async (request, response) => {
    const session = await requireSession(request, response);
    if (!session) return null;
    const user = session.user;
    const profile = await getProfileForUser(request, user.id);
    if (!profile) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'profile_not_found' }));
        return null;
    }
    const tenantId = profile.tenant_id;
    if (!tenantId) {
        console.warn('missing_tenant', { userId: user.id, email: user.email });
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'missing_tenant' }));
        return null;
    }
    return { user, profile, tenantId };
};

const isActiveMembership = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return true;
    return ['active', 'ativo', 'approved', 'aprovado'].includes(normalized);
};

const buildClientPermissions = (userId, tenantId, membership, profile) => {
    if (!userId || !tenantId) return [];
    if (membership && !isActiveMembership(membership.status)) return [];
    const permissions = [
        'dashboard.view',
        'metrics.view',
        'integrations.view',
        'approvals.calendar.view',
        'approvals.posts.view'
    ];
    const role = String(membership?.role || profile?.role || '').trim().toLowerCase();
    if (['owner', 'admin', 'gestor', 'manager', 'super_admin'].includes(role)) {
        permissions.push('performance.view');
    }
    return Array.from(new Set(permissions));
};

const buildClientNav = (permissions) => {
    const allow = (permission) => !permission || permissions.includes(permission);
    const nav = [
        {
            label: '',
            items: [
                { label: 'Home', href: '/client/index.html', icon: 'fas fa-grid-2', permission: 'dashboard.view' },
                { label: 'Integrações', href: '/client/integrations.html', icon: 'fas fa-plug', permission: 'integrations.view' },
                { label: 'Métricas', href: '/client/metrics.html', icon: 'fas fa-chart-line', permission: 'metrics.view' },
                { label: 'Performance', href: '/client/performance.html', icon: 'fas fa-bolt', permission: 'performance.view' }
            ]
        }
    ];
    return nav
        .map((section) => ({
            label: section.label,
            items: section.items
                .filter((item) => allow(item.permission))
                .map((item) => ({ label: item.label, href: item.href, icon: item.icon }))
        }))
        .filter((section) => section.items.length > 0);
};

const attachClientContext = async (request, response) => {
    const session = request.user ? { user: request.user } : await requireSession(request, response);
    if (!session) return null;
    const user = session.user;
    const profile = await getProfileForUser(request, user.id);
    if (!profile) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'profile_not_found' }));
        return null;
    }

    let membership = null;
    const membershipsRes = await supabaseRest(
        request,
        `/rest/v1/memberships?select=id,user_id,tenant_id,role,status,created_at&user_id=eq.${user.id}&limit=1`
    );
    if (membershipsRes.status >= 200 && membershipsRes.status < 300) {
        membership = Array.isArray(membershipsRes.data) ? membershipsRes.data[0] : null;
    } else {
        const legacyRes = await supabaseRest(
            request,
            `/rest/v1/client_memberships?select=tenant_id,client_id,user_id,created_at&user_id=eq.${user.id}&limit=1`
        );
        if (legacyRes.status >= 200 && legacyRes.status < 300) {
            const legacy = Array.isArray(legacyRes.data) ? legacyRes.data[0] : null;
            if (legacy) {
                membership = {
                    id: null,
                    user_id: legacy.user_id || user.id,
                    tenant_id: legacy.tenant_id || legacy.client_id || null,
                    role: profile?.role || 'client',
                    status: 'active',
                    created_at: legacy.created_at || null
                };
            }
        }
    }
    const fallbackTenantId = profile?.tenant_id || profile?.client_id || null;
    if (!membership && fallbackTenantId) {
        membership = {
            id: null,
            user_id: user.id,
            tenant_id: fallbackTenantId,
            role: profile?.role || 'client',
            status: 'active',
            created_at: null
        };
    }
    const tenantId = membership?.tenant_id || fallbackTenantId || null;
    if (!tenantId) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'missing_tenant' }));
        return null;
    }

    const tenantRes = await supabaseRest(
        request,
        `/rest/v1/clientes?select=id,nome_empresa,nome_fantasia&limit=1&id=eq.${tenantId}`
    );
    const tenant = Array.isArray(tenantRes.data) ? tenantRes.data[0] : null;
    const permissions = buildClientPermissions(user.id, tenantId, membership, profile);
    const nav = buildClientNav(permissions);

    request.clientContext = { tenant, membership, permissions };
    return { user, tenant, membership, permissions, nav };
};

const resolveTenantAndClient = async (request, response, clienteId) => {
    const authContext = await getAuthContext(request, response);
    if (!authContext) return null;
    const userId = authContext.user?.id || null;
    const tenantUuid = authContext.profile?.tenant_id || null;
    if (!tenantUuid) {
        console.warn('missing_tenant', { tenantUuid: null, clienteId, userId });
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'missing_tenant' }));
        return null;
    }

    const normalizedClienteId = clienteId && /^\d+$/.test(String(clienteId)) ? String(clienteId) : null;
    if (!normalizedClienteId) {
        console.warn('cliente_id_invalido', { tenantUuid, clienteId, userId });
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'cliente_id_invalido' }));
        return null;
    }

    const clientesRes = await supabaseRest(
        request,
        `/rest/v1/clientes?select=id,tenant_id&id=eq.${normalizedClienteId}&tenant_id=eq.${tenantUuid}&limit=1`
    );
    const clientesRow = Array.isArray(clientesRes.data) ? clientesRes.data[0] : null;
    if (!clientesRow) {
        console.warn('cliente_nao_pertence_ao_tenant', { tenantUuid, clienteId: normalizedClienteId, userId });
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'cliente_nao_pertence_ao_tenant' }));
        return null;
    }

    return { tenantId: tenantUuid, clienteId: Number(normalizedClienteId) };
};

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000999';
const DEMO_CLIENT_NAME = 'Empresa Alpha Engenharia';
const DEMO_USER_EMAIL = 'demo@gqv.com';
const DEMO_USER_PASSWORD = 'Demo@123456';
const DEMO_METRICS = {
    faturamento_estimado: 38500,
    roi: 4.3,
    crescimento_mensal: 18
};
const DEMO_NOTIFICATIONS = [
    'Calendário aprovado com sucesso',
    'Nova campanha iniciada',
    'Post aguardando aprovação'
];

const supabaseServiceRest = async (pathWithQuery, method = 'GET', body = null, extraHeaders = {}) => {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
        return { status: 500, data: { error: 'service_role_nao_configurada' }, text: '' };
    }
    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const targetUrl = `${baseUrl}${normalizedPath}`;
    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        ...extraHeaders
    };
    if (body !== null && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(targetUrl, {
        method,
        headers,
        body: body !== null && body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    return { status: response.status, data, text };
};

const supabaseAdminAuthRest = async (pathWithQuery, method = 'GET', body = null) => {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
        return { status: 500, data: { error: 'service_role_nao_configurada' }, text: '' };
    }
    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const targetUrl = `${baseUrl}/auth/v1${normalizedPath}`;
    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
    };
    if (body !== null && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(targetUrl, {
        method,
        headers,
        body: body !== null && body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    return { status: response.status, data, text };
};

const ensureDemoUser = async () => {
    const listRes = await supabaseAdminAuthRest(`/admin/users?email=${encodeURIComponent(DEMO_USER_EMAIL)}`);
    if (listRes.status >= 400) {
        return { ok: false, error: 'erro_listar_usuario_demo', details: listRes.data || listRes.text || null };
    }
    const listUsers = Array.isArray(listRes.data?.users) ? listRes.data.users : (Array.isArray(listRes.data) ? listRes.data : []);
    let demoUser = listUsers.find((user) => String(user?.email || '').toLowerCase() === DEMO_USER_EMAIL) || listUsers[0] || null;

    if (!demoUser) {
        const createRes = await supabaseAdminAuthRest('/admin/users', 'POST', {
            email: DEMO_USER_EMAIL,
            password: DEMO_USER_PASSWORD,
            email_confirm: true,
            user_metadata: { demo: true, tenant_id: DEMO_TENANT_ID }
        });
        demoUser = createRes.data || null;
        if (!demoUser?.id) {
            return { ok: false, error: 'erro_criar_usuario_demo', details: createRes.data || createRes.text || null };
        }
    }

    const profileRes = await supabaseServiceRest(
        `/rest/v1/profiles?id=eq.${demoUser.id}&select=*`
    );
    const profileRow = Array.isArray(profileRes.data) ? profileRes.data[0] : null;
    if (!profileRow) {
        console.warn('profile_nao_encontrado_para_demo', { status: profileRes.status });
    }

    return { ok: true, user: demoUser };
};

const seedDemoData = async () => {
    const demoUserRes = await ensureDemoUser();
    if (!demoUserRes.ok) {
        return { ok: false, error: demoUserRes.error, details: demoUserRes.details || null };
    }
    const clientColumnChecks = [
        'tenant_id',
        'nome_empresa',
        'nome_fantasia',
        'segmento',
        'responsavel_nome',
        'responsavel_email',
        'responsavel_whatsapp',
        'email_contato',
        'telefone',
        'status',
        'time_id',
        'nome',
        'empresa',
        'email'
    ];
    const clientColumns = new Set();
    for (const column of clientColumnChecks) {
        const columnRes = await supabaseServiceRest(`/rest/v1/clientes?select=${column}&limit=1`);
        if (columnRes.status < 400) {
            clientColumns.add(column);
        }
    }
    let supportsTenantId = false;
    if (clientColumns.has('tenant_id')) {
        const tenantTypeRes = await supabaseServiceRest(
            '/rest/v1/information_schema.columns?select=data_type,udt_name&table_name=eq.clientes&column_name=eq.tenant_id&limit=1'
        );
        const tenantTypeRow = Array.isArray(tenantTypeRes.data) ? tenantTypeRes.data[0] : null;
        const tenantTypeRaw = String(tenantTypeRow?.udt_name || tenantTypeRow?.data_type || '').toLowerCase();
        const allowedTenantTypes = new Set(['uuid', 'text', 'varchar', 'character varying']);
        supportsTenantId = allowedTenantTypes.has(tenantTypeRaw);
    }
    const nameColumn = clientColumns.has('nome_empresa') ? 'nome_empresa' : (clientColumns.has('nome') ? 'nome' : null);
    const fantasyColumn = clientColumns.has('nome_fantasia') ? 'nome_fantasia' : (clientColumns.has('empresa') ? 'empresa' : null);
    const emailColumn = clientColumns.has('email_contato') ? 'email_contato' : (clientColumns.has('email') ? 'email' : null);
    let timeId = null;
    if (clientColumns.has('time_id')) {
        const timeRes = await supabaseServiceRest('/rest/v1/times?select=id&limit=1');
        const timeRow = Array.isArray(timeRes.data) ? timeRes.data[0] : null;
        if (timeRow?.id) {
            timeId = timeRow.id;
        } else if (timeRes.status < 400) {
            const createTimeRes = await supabaseServiceRest(
                '/rest/v1/times',
                'POST',
                { nome: 'Time Demo' },
                { Prefer: 'return=representation' }
            );
            const createdTime = Array.isArray(createTimeRes.data) ? createTimeRes.data[0] : null;
            timeId = createdTime?.id || null;
        }
    }

    let existingClientRes = null;
    if (supportsTenantId) {
        existingClientRes = await supabaseServiceRest(
            `/rest/v1/clientes?select=id,tenant_id&tenant_id=eq.${DEMO_TENANT_ID}&limit=1`
        );
    } else if (nameColumn) {
        existingClientRes = await supabaseServiceRest(
            `/rest/v1/clientes?select=id&${nameColumn}=eq.${encodeURIComponent(DEMO_CLIENT_NAME)}&limit=1`
        );
    } else {
        existingClientRes = await supabaseServiceRest(`/rest/v1/clientes?select=id&limit=1`);
    }
    const existingClient = Array.isArray(existingClientRes?.data) ? existingClientRes.data[0] : null;
    if (existingClient?.id) {
        return { ok: true, status: 'exists', clienteId: existingClient.id, tenantId: DEMO_TENANT_ID };
    }

    const clientePayload = {};
    if (nameColumn) clientePayload[nameColumn] = DEMO_CLIENT_NAME;
    if (fantasyColumn && fantasyColumn !== nameColumn) clientePayload[fantasyColumn] = DEMO_CLIENT_NAME;
    if (clientColumns.has('segmento')) clientePayload.segmento = 'Construção Civil';
    if (clientColumns.has('responsavel_nome')) clientePayload.responsavel_nome = 'Carlos Mendes';
    if (clientColumns.has('responsavel_email')) clientePayload.responsavel_email = 'demo@gqv.com';
    if (clientColumns.has('responsavel_whatsapp')) clientePayload.responsavel_whatsapp = '11999999999';
    if (emailColumn) clientePayload[emailColumn] = 'demo@gqv.com';
    if (clientColumns.has('telefone')) clientePayload.telefone = '11999999999';
    if (clientColumns.has('status')) clientePayload.status = 'ativo';
    // Sempre usar o tenant_id do contexto autenticado
    if (supportsTenantId) clientePayload.tenant_id = authContext?.profile?.tenant_id || DEMO_TENANT_ID;
    if (timeId) clientePayload.time_id = timeId;
    // Tratar is_demo
    if (clientColumns.has('is_demo')) clientePayload.is_demo = true;
    const clientCreateRes = await supabaseServiceRest(
        '/rest/v1/clientes',
        'POST',
        clientePayload,
        { Prefer: 'return=representation' }
    );
    const createdClient = Array.isArray(clientCreateRes.data) ? clientCreateRes.data[0] : null;
    if (!createdClient?.id) {
        return {
            ok: false,
            error: 'erro_criar_cliente_demo',
            details: clientCreateRes.data || clientCreateRes.text || null
        };
    }
    const clienteId = createdClient.id;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const mesReferencia = monthStart.toISOString().slice(0, 10);
    const calendarPayload = {
        cliente_id: clienteId,
        tenant_id: DEMO_TENANT_ID,
        mes_referencia: mesReferencia,
        status: CALENDAR_STATUS_VALUES.APPROVED,
        share_token: crypto.randomUUID(),
        access_password: '123456'
    };
    const calendarRes = await supabaseServiceRest(
        '/rest/v1/social_calendars',
        'POST',
        calendarPayload,
        { Prefer: 'return=representation' }
    );
    const createdCalendar = Array.isArray(calendarRes.data) ? calendarRes.data[0] : null;
    const calendarId = createdCalendar?.id || null;

    if (calendarId) {
        await supabaseServiceRest(
            `/rest/v1/social_calendars?id=eq.${calendarId}`,
            'PATCH',
            { aprovado_por: 'Carlos Mendes', data_aprovacao: new Date().toISOString(), status: CALENDAR_STATUS_VALUES.APPROVED }
        );
    }

    const mockMedia = (seed) => ([
        { public_url: `https://picsum.photos/seed/${seed}/1080/1080` }
    ]);

    const postsSeed = [
        {
            formato: 'estatico',
            tema: '3 erros que fazem sua obra perder dinheiro',
            status: POST_STATUS_VALUES.APPROVED,
            legenda: 'Evite desperdícios: alinhamento de equipe, orçamento atualizado e cronograma realista fazem toda diferença.',
            legenda_linkedin: 'Quando o planejamento é claro, a obra rende mais e o custo fica sob controle.',
            sugestao: 'Crie uma arte com 3 cards numerados e ícones simples de alerta/erro.',
            data: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5))
        },
        {
            formato: 'carrossel',
            tema: 'Checklist de segurança para obras',
            status: POST_STATUS_VALUES.APPROVED,
            legenda: 'Checklist rápido para manter sua equipe segura e evitar paradas inesperadas.',
            legenda_linkedin: 'Segurança não é custo, é continuidade da obra.',
            sugestao: 'Carrossel com 5 etapas e fundo neutro para fácil leitura.',
            data: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 12))
        },
        {
            formato: 'reels',
            tema: 'Como reduzir desperdício na construção',
            status: POST_STATUS_VALUES.READY_FOR_APPROVAL,
            legenda: '3 atitudes simples que diminuem perdas e aumentam a margem da obra.',
            legenda_linkedin: 'Pequenas mudanças geram grande economia no canteiro.',
            sugestao: 'Roteiro com 3 cenas rápidas: estoque, equipe, reaproveitamento.',
            data: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 19))
        },
        {
            formato: 'estatico',
            tema: 'Planejamento evita retrabalho',
            status: POST_STATUS_VALUES.PUBLISHED,
            legenda: 'Planejar antes de executar evita retrabalho e traz previsibilidade.',
            legenda_linkedin: 'Planejamento é o melhor seguro contra custos extras.',
            sugestao: 'Arte simples com frase central e fundo com textura de obra.',
            data: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 26))
        }
    ];

    const postResults = [];
    if (calendarId) {
        for (const item of postsSeed) {
            const postPayload = {
                calendar_id: calendarId,
                cliente_id: clienteId,
                tenant_id: DEMO_TENANT_ID,
                data_agendada: item.data.toISOString().slice(0, 10),
                tema: item.tema,
                formato: item.formato,
                status: item.status,
                legenda: item.legenda,
                legenda_linkedin: item.legenda_linkedin,
                legenda_tiktok: item.legenda,
                descricao_visual: item.sugestao,
                conteudo_roteiro: item.sugestao,
                estrategia: 'Demonstração',
                medias: mockMedia(`${item.formato}-${item.tema}`),
                imagem_url: item.formato === 'reels' ? null : `https://picsum.photos/seed/${encodeURIComponent(item.tema)}/1200/1200`,
                video_url: item.formato === 'reels' ? 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4' : null
            };
            const postRes = await supabaseServiceRest(
                '/rest/v1/social_posts',
                'POST',
                postPayload,
                { Prefer: 'return=representation' }
            );
            const createdPost = Array.isArray(postRes.data) ? postRes.data[0] : null;
            if (createdPost?.id) {
                postResults.push(createdPost.id);
                if (item.status === POST_STATUS_VALUES.APPROVED || item.status === POST_STATUS_VALUES.PUBLISHED) {
                    await supabaseServiceRest(
                        `/rest/v1/social_posts?id=eq.${createdPost.id}`,
                        'PATCH',
                        {
                            aprovado_por_post: 'Carlos Mendes',
                            data_aprovacao_post: new Date().toISOString()
                        }
                    );
                }
            }
        }
    }

    const campaignsSeed = [
        {
            nome: 'Geração de Leads Engenharia',
            plataforma: 'facebook',
            orcamento_diario: 2500,
            objetivo: 'conversao',
            metricas: { impressoes: '54000', clicks: '1728', custo: '2500', conversoes: '87', ctr: 3.2, cpc: 1.45 }
        },
        {
            nome: 'Remarketing Visitantes',
            plataforma: 'google',
            orcamento_diario: 1200,
            objetivo: 'trafego',
            metricas: { impressoes: '28000', clicks: '1428', custo: '1200', conversoes: '32', ctr: 5.1, cpc: 0.89 }
        }
    ];

    const campaignIds = [];
    for (const campaign of campaignsSeed) {
        const campaignRes = await supabaseServiceRest(
            '/rest/v1/traffic_campaigns',
            'POST',
            {
                cliente_id: clienteId,
                nome: campaign.nome,
                plataforma: campaign.plataforma,
                status: 'ativa',
                orcamento_diario: campaign.orcamento_diario,
                objetivo: campaign.objetivo
            },
            { Prefer: 'return=representation' }
        );
        const createdCampaign = Array.isArray(campaignRes.data) ? campaignRes.data[0] : null;
        if (createdCampaign?.id) {
            campaignIds.push(createdCampaign.id);
            const metricRes = await supabaseServiceRest(
                '/rest/v1/traffic_metrics',
                'POST',
                {
                    campaign_id: createdCampaign.id,
                    cliente_id: clienteId,
                    data_metric: mesReferencia,
                    impressoes: campaign.metricas.impressoes,
                    clicks: campaign.metricas.clicks,
                    custo: campaign.metricas.custo,
                    conversoes: campaign.metricas.conversoes
                },
                { Prefer: 'return=representation' }
            );
            const createdMetric = Array.isArray(metricRes.data) ? metricRes.data[0] : null;
            if (createdMetric?.id) {
                await supabaseServiceRest(
                    `/rest/v1/traffic_metrics?id=eq.${createdMetric.id}`,
                    'PATCH',
                    { ctr: campaign.metricas.ctr, cpc: campaign.metricas.cpc, conversions: campaign.metricas.conversoes }
                );
            }
        }
    }

    return {
        ok: true,
        status: 'seeded',
        tenantId: DEMO_TENANT_ID,
        clienteId,
        calendarId,
        postIds: postResults,
        campaignIds
    };
};

const resetDemoData = async () => {
    const demoClientRes = await supabaseServiceRest(
        `/rest/v1/clientes?select=id&tenant_id=eq.${DEMO_TENANT_ID}&limit=1`
    );
    const demoClient = Array.isArray(demoClientRes.data) ? demoClientRes.data[0] : null;
    const clienteId = demoClient?.id || null;
    if (!clienteId) {
        console.log('DADOS DEMO REMOVIDOS COM SUCESSO');
        return { ok: true, status: 'no_data' };
    }

    const calendarsRes = await supabaseServiceRest(
        `/rest/v1/social_calendars?select=id&cliente_id=eq.${clienteId}`
    );
    const calendarIds = Array.isArray(calendarsRes.data) ? calendarsRes.data.map((row) => row.id).filter(Boolean) : [];
    if (calendarIds.length) {
        const calendarIdsQuery = calendarIds.join(',');
        await supabaseServiceRest(`/rest/v1/social_posts?calendar_id=in.(${calendarIdsQuery})`, 'DELETE');
    }
    await supabaseServiceRest(`/rest/v1/social_calendars?cliente_id=eq.${clienteId}`, 'DELETE');
    await supabaseServiceRest(`/rest/v1/traffic_metrics?cliente_id=eq.${clienteId}`, 'DELETE');
    await supabaseServiceRest(`/rest/v1/traffic_campaigns?cliente_id=eq.${clienteId}`, 'DELETE');
    await supabaseServiceRest(`/rest/v1/clientes?id=eq.${clienteId}`, 'DELETE');
    console.log('DADOS DEMO REMOVIDOS COM SUCESSO');
    return { ok: true, status: 'deleted' };
};

const formatDateBr = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pt-BR');
};

const buildDemoClientViewHtml = ({ clientName, metrics, notifications, calendar, posts, campaigns }) => {
    const postsHtml = posts.map((post) => `
        <li>
            <strong>${post.formato || '-'}</strong> — ${post.tema || '-'}<br>
            <small>Status: ${post.status || '-'}</small><br>
            <small>Data: ${formatDateBr(post.data_agendada)}</small>
        </li>
    `).join('');

    const campaignsHtml = campaigns.map((campaign) => `
        <li>
            <strong>${campaign.nome || '-'}</strong><br>
            <small>Orçamento: R$ ${campaign.orcamento || '-'}</small><br>
            <small>CTR: ${campaign.ctr || '-'}%</small><br>
            <small>CPC: R$ ${campaign.cpc || '-'}</small><br>
            <small>${campaign.tipoConversao}: ${campaign.conversoes || '-'}</small>
        </li>
    `).join('');

    const notificationsHtml = notifications.map((item) => `<li>${item}</li>`).join('');

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Demo - Visualização Cliente</title>
            <style>
                body { font-family: Inter, Arial, sans-serif; background: #f9fafb; margin: 0; padding: 24px; color: #1f2937; }
                .container { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
                .card { background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #e5e7eb; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06); }
                h1 { margin: 0 0 12px 0; font-size: 24px; }
                h2 { margin: 0 0 12px 0; font-size: 18px; }
                ul { padding-left: 18px; margin: 0; display: grid; gap: 8px; }
                .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
                .metric { background: #f9fafb; border-radius: 12px; padding: 12px; border: 1px solid #e5e7eb; }
            </style>
        </head>
        <body>
            <script>
                if (localStorage.getItem('demo_mode') !== 'true') {
                    document.body.innerHTML = '<div style="max-width:640px;margin:40px auto;font-family:Inter,Arial,sans-serif;text-align:center;">Acesso restrito. Ative o Modo Demonstração para visualizar.</div>';
                }
            </script>
            <div class="container">
                <div class="card">
                    <h1>Cliente Demo: ${clientName || 'Demo GQV'}</h1>
                    <p>Visão simples para apresentação ao cliente.</p>
                </div>
                <div class="card">
                    <h2>SEÇÃO 1 – MÉTRICAS</h2>
                    <div class="metrics">
                        <div class="metric"><strong>Faturamento estimado</strong><br>R$ ${metrics.faturamento_estimado}</div>
                        <div class="metric"><strong>ROI</strong><br>${metrics.roi}</div>
                        <div class="metric"><strong>Crescimento mensal</strong><br>${metrics.crescimento_mensal}%</div>
                    </div>
                    <h3 style="margin-top:16px;">Notificações</h3>
                    <ul>${notificationsHtml}</ul>
                </div>
                <div class="card">
                    <h2>SEÇÃO 2 – CALENDÁRIO</h2>
                    <p>Mês atual: ${calendar?.mes_referencia || '-'} | Status: ${calendar?.status || '-'}</p>
                    <ul>${postsHtml || '<li>Nenhum post encontrado.</li>'}</ul>
                </div>
                <div class="card">
                    <h2>SEÇÃO 3 – POSTS</h2>
                    <ul>${postsHtml || '<li>Nenhum post encontrado.</li>'}</ul>
                </div>
                <div class="card">
                    <h2>SEÇÃO 4 – TRÁFEGO PAGO</h2>
                    <ul>${campaignsHtml || '<li>Nenhuma campanha encontrada.</li>'}</ul>
                </div>
            </div>
        </body>
        </html>
    `;
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

const getClientProfileFromRequest = async (request) => {
    const userId = await getSupabaseUserIdFromRequest(request);
    if (!userId) return null;

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) return null;

    const params = new URLSearchParams();
    params.set('select', 'id,role,client_id');
    params.set('id', `eq.${userId}`);
    params.set('limit', '1');

    const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?${params.toString()}`;
    const profileRes = await fetch(targetUrl, {
        method: 'GET',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`
        }
    });

    const profileJson = await profileRes.json().catch(() => null);
    if (!profileRes.ok || !Array.isArray(profileJson) || profileJson.length === 0) {
        return null;
    }

    return profileJson[0] || null;
};

const requireClientRole = async (request, response) => {
    const profile = await getClientProfileFromRequest(request);
    if (!profile) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'nao_autorizado' }));
        return null;
    }
    if (profile.role !== 'client' || !profile.client_id) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'acesso_negado' }));
        return null;
    }
    return profile;
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

const legacyHandler = async (request, response) => {
    // CORS Headers para permitir desenvolvimento local
    response.setHeader('Access-Control-Allow-Origin', 'https://gestaoquevende.cloud');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const parsedUrl = url.parse(request.url, true);
    const pathname = parsedUrl.pathname;

    /*
    // --- API V2 (Express) ---
    // REMOVIDO: O Express agora é o handler principal e o legacyHandler é chamado como middleware.
    if (pathname && pathname.startsWith('/api/v2')) {
        // Log para debug
        console.log(`[API v2] ${request.method} ${pathname}`);
        
        // Delegar para Express
        // O Express cuidará do parsing de body, rotas e resposta final
        app(request, response);
        return;
    }
    */

    if (request.method === 'HEAD') {
        if (pathname === '/api/health' || pathname === '/api/oauth/meta/callback' || pathname === '/api/oauth/google/callback') {
            response.writeHead(200);
            response.end();
            return;
        }
    }

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

    if (pathname === '/demo/cliente-view' && request.method === 'GET') {
        try {
            const clientRes = await supabaseServiceRest(
                `/rest/v1/clientes?select=id,nome_empresa,nome_fantasia&tenant_id=eq.${DEMO_TENANT_ID}&limit=1`
            );
            const client = Array.isArray(clientRes.data) ? clientRes.data[0] : null;
            const clienteId = client?.id || null;
            let calendar = null;
            let posts = [];
            let campaigns = [];

            if (clienteId) {
                const calendarRes = await supabaseServiceRest(
                    `/rest/v1/social_calendars?select=id,mes_referencia,status&tenant_id=eq.${DEMO_TENANT_ID}&order=created_at.desc&limit=1`
                );
                calendar = Array.isArray(calendarRes.data) ? calendarRes.data[0] : null;

                if (calendar?.id) {
                    const postsRes = await supabaseServiceRest(
                        `/rest/v1/social_posts?select=formato,tema,status,data_agendada&calendar_id=eq.${calendar.id}&order=data_agendada.asc`
                    );
                    posts = Array.isArray(postsRes.data) ? postsRes.data : [];
                }

                const campaignsRes = await supabaseServiceRest(
                    `/rest/v1/traffic_campaigns?select=id,nome,orcamento_diario,status,plataforma&cliente_id=eq.${clienteId}&order=created_at.desc`
                );
                const rawCampaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];

                const metricsRes = await supabaseServiceRest(
                    `/rest/v1/traffic_metrics?select=campaign_id,impressoes,clicks,custo,conversoes,ctr,cpc&cliente_id=eq.${clienteId}`
                );
                const metricsList = Array.isArray(metricsRes.data) ? metricsRes.data : [];
                const metricsMap = new Map(metricsList.map((item) => [item.campaign_id, item]));

                campaigns = rawCampaigns.map((campaign) => {
                    const metric = metricsMap.get(campaign.id) || {};
                    const impressoes = Number(String(metric.impressoes || '').replace(',', '.')) || 0;
                    const clicks = Number(String(metric.clicks || '').replace(',', '.')) || 0;
                    const custo = Number(String(metric.custo || '').replace(',', '.')) || 0;
                    const conversoes = Number(String(metric.conversoes || '').replace(',', '.')) || 0;
                    const ctr = metric.ctr ?? (impressoes > 0 ? (clicks / impressoes) * 100 : 0);
                    const cpc = metric.cpc ?? (clicks > 0 ? custo / clicks : 0);
                    const tipoConversao = String(campaign.nome || '').toLowerCase().includes('lead') ? 'Leads' : 'Conversões';
                    return {
                        nome: campaign.nome,
                        orcamento: Number(campaign.orcamento_diario || 0).toFixed(2),
                        ctr: Number(ctr || 0).toFixed(1),
                        cpc: Number(cpc || 0).toFixed(2),
                        conversoes: conversoes || 0,
                        tipoConversao
                    };
                });
            }

            const html = buildDemoClientViewHtml({
                clientName: client?.nome_fantasia || client?.nome_empresa || DEMO_CLIENT_NAME,
                metrics: DEMO_METRICS,
                notifications: DEMO_NOTIFICATIONS,
                calendar,
                posts,
                campaigns
            });
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(html);
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_demo_view' }));
            return;
        }
    }

    if (pathname === '/api/me/context' && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { user, profile, tenantId } = authContext;

            const clientRes = await supabaseRest(
                request,
                `/rest/v1/clientes?select=id,nome_fantasia,nome_empresa,telefone,logo_url&id=eq.${tenantId}&limit=1`
            );
            const clientRow = Array.isArray(clientRes.data) ? clientRes.data[0] : null;
            if (!clientRow) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'client_not_found' }));
                return;
            }

            const payload = {
                user: { id: user.id, email: user.email },
                profile: {
                    role: profile.role || null,
                    tenant_id: tenantId,
                    client_id: profile.client_id || null
                },
                client: {
                    id: clientRow.id,
                    nome_fantasia: clientRow.nome_fantasia,
                    nome_empresa: clientRow.nome_empresa,
                    telefone: clientRow.telefone,
                    logo_url: clientRow.logo_url
                },
                modules: {
                    dashboard: true,
                    tasks: true,
                    approvals: true,
                    billing: true,
                    chat: true,
                    integrations: true
                }
            };
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'internal_error' }));
            return;
        }
    }

    if (pathname === '/api/reminders/manual' && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const userId = authContext.user?.id;
            const tenantId = authContext.tenantId;

            const params = new URLSearchParams();
            params.set('select', 'id,titulo,data,created_at,concluido,tipo');
            params.set('tenant_id', `eq.${tenantId}`);
            params.set('created_by', `eq.${userId}`);
            params.set('tipo', 'eq.manual');
            params.set('order', 'created_at.desc');

            const remindersRes = await supabaseServiceRest(`/rest/v1/lembretes?${params.toString()}`);
            if (remindersRes.status >= 400) {
                response.writeHead(remindersRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_buscar_lembretes', details: remindersRes.data || remindersRes.text || null }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: Array.isArray(remindersRes.data) ? remindersRes.data : [] }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_buscar_lembretes' }));
            return;
        }
    }

    if (pathname === '/api/reminders/manual' && request.method === 'POST') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const userId = authContext.user?.id;
            const tenantId = authContext.tenantId;

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const titulo = String(body?.titulo || '').trim();
            const data = body?.data ? String(body.data).trim() : null;
            if (!titulo) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'titulo_obrigatorio' }));
                return;
            }

            const payload = {
                titulo,
                data: data || null,
                tipo: 'manual',
                tenant_id: tenantId,
                created_by: userId,
                concluido: false
            };

            const createRes = await supabaseServiceRest('/rest/v1/lembretes', 'POST', payload, {
                Prefer: 'return=representation'
            });
            if (createRes.status >= 400) {
                response.writeHead(createRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_criar_lembrete', details: createRes.data || createRes.text || null }));
                return;
            }

            const row = Array.isArray(createRes.data) ? createRes.data[0] : createRes.data;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: row || null }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_criar_lembrete' }));
            return;
        }
    }

    if (pathname.startsWith('/api/reminders/manual/') && request.method === 'PATCH') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const userId = authContext.user?.id;
            const tenantId = authContext.tenantId;
            const reminderId = pathname.split('/').pop();

            if (!reminderId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'lembrete_id_invalido' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const concluido = Boolean(body?.concluido);

            const updatePath = `/rest/v1/lembretes?id=eq.${reminderId}&tenant_id=eq.${tenantId}&created_by=eq.${userId}&tipo=eq.manual`;
            const updateRes = await supabaseServiceRest(updatePath, 'PATCH', { concluido }, {
                Prefer: 'return=representation'
            });
            if (updateRes.status >= 400) {
                response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_atualizar_lembrete', details: updateRes.data || updateRes.text || null }));
                return;
            }

            const row = Array.isArray(updateRes.data) ? updateRes.data[0] : updateRes.data;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: row || null }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_atualizar_lembrete' }));
            return;
        }
    }

    if (pathname.startsWith('/api/reminders/manual/') && request.method === 'DELETE') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const userId = authContext.user?.id;
            const tenantId = authContext.tenantId;
            const reminderId = pathname.split('/').pop();

            if (!reminderId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'lembrete_id_invalido' }));
                return;
            }

            const deletePath = `/rest/v1/lembretes?id=eq.${reminderId}&tenant_id=eq.${tenantId}&created_by=eq.${userId}&tipo=eq.manual`;
            const deleteRes = await supabaseServiceRest(deletePath, 'DELETE');
            if (deleteRes.status >= 400) {
                response.writeHead(deleteRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_excluir_lembrete', details: deleteRes.data || deleteRes.text || null }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_excluir_lembrete' }));
            return;
        }
    }

    if (pathname === '/api/reminders/birthdays' && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;

            const params = new URLSearchParams();
            params.set('select', 'id,titulo,data,created_at,tipo');
            params.set('tipo', 'eq.birthday');
            params.set('order', 'data.asc');

            const remindersRes = await supabaseServiceRest(`/rest/v1/lembretes?${params.toString()}`);
            if (remindersRes.status >= 400) {
                response.writeHead(remindersRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_buscar_aniversarios', details: remindersRes.data || remindersRes.text || null }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: Array.isArray(remindersRes.data) ? remindersRes.data : [] }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_buscar_aniversarios' }));
            return;
        }
    }

    if (pathname === '/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    if (pathname === '/api/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        return;
    }

    if (pathname === '/api/openai/proxy/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        return;
    }

    if (pathname === '/api/openai/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
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

    if (pathname === '/api/debug/clientes' && request.method === 'GET') {
        try {
            const selectRes = await supabaseServiceRest('/rest/v1/clientes?select=id,nome_empresa&order=id.desc&limit=5');
            if (selectRes.status >= 400) {
                response.writeHead(selectRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_select_clientes', details: selectRes.data || selectRes.text || null }));
                return;
            }

            const insertPayload = {
                nome_empresa: 'CLIENTE TESTE TRAE',
                ativo: true,
                is_demo: false
            };
            const insertRes = await supabaseServiceRest('/rest/v1/clientes?select=id,nome_empresa', 'POST', insertPayload, {
                Prefer: 'return=representation'
            });
            if (insertRes.status >= 400) {
                response.writeHead(insertRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_insert_cliente', details: insertRes.data || insertRes.text || null }));
                return;
            }

            const insertResult = Array.isArray(insertRes.data) ? insertRes.data[0] : insertRes.data || null;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                select_result: Array.isArray(selectRes.data) ? selectRes.data : [],
                insert_result: insertResult,
                error: null
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/demo/seed' && request.method === 'POST') {
        try {
            const result = await seedDemoData();
            if (!result.ok) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: result.error || 'erro_seed_demo', details: result.details || null }));
                return;
            }
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'erro_seed_demo' }));
            return;
        }
    }

    if (pathname === '/api/auth/register-invite' && request.method === 'POST') {
        try {
            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const email = String(body?.email || '').trim().toLowerCase();
            const password = String(body?.password || '');
            const kind = String(body?.kind || '').trim().toLowerCase();

            if (!email || !password || !['client', 'colaborador'].includes(kind)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'dados_invalidos' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            let inviteRow = null;
            if (kind === 'client') {
                const params = new URLSearchParams();
                params.set('select', 'id,email,client_id');
                params.set('email', `ilike.${email}`);
                params.set('limit', '1');
                const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_invites?${params.toString()}`;
                const inviteRes = await fetch(targetUrl, {
                    method: 'GET',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`
                    }
                });
                const inviteJson = await inviteRes.json().catch(() => null);
                if (!inviteRes.ok || !Array.isArray(inviteJson) || inviteJson.length === 0) {
                    response.writeHead(403, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'not_invited' }));
                    return;
                }
                inviteRow = inviteJson[0] || null;
            } else {
                const params = new URLSearchParams();
                params.set('select', 'id,email,ativo,perfil_acesso');
                params.set('email', `ilike.${email}`);
                params.set('ativo', 'eq.true');
                params.set('limit', '1');
                const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/colaboradores?${params.toString()}`;
                const inviteRes = await fetch(targetUrl, {
                    method: 'GET',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`
                    }
                });
                const inviteJson = await inviteRes.json().catch(() => null);
                if (!inviteRes.ok || !Array.isArray(inviteJson) || inviteJson.length === 0) {
                    response.writeHead(403, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'not_invited' }));
                    return;
                }
            }

            const createRes = await supabaseAdminAuthRest('/admin/users', 'POST', {
                email,
                password,
                email_confirm: true
            });

            if (createRes.status >= 400) {
                const message = String(createRes.data?.msg || createRes.data?.message || createRes.data?.error || '').toLowerCase();
                if (createRes.status === 422 || message.includes('already') || message.includes('existe')) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'user_exists' }));
                    return;
                }
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_criar_usuario' }));
                return;
            }

            const userId = createRes.data?.user?.id || createRes.data?.id || null;
            if (!userId) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'usuario_nao_criado' }));
                return;
            }

            const roleValue = kind === 'client' ? 'client' : 'colaborador';
            const profilePayload = { id: userId, role: roleValue, email };
            if (kind === 'client' && inviteRow?.client_id) {
                profilePayload.client_id = inviteRow.client_id;
            }

            const profileRes = await supabaseServiceRest(
                '/rest/v1/profiles?on_conflict=id',
                'POST',
                profilePayload,
                { Prefer: 'resolution=merge-duplicates,return=representation' }
            );

            if (profileRes.status >= 400) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_atualizar_perfil', message: profileRes.data?.message || profileRes.data?.error || profileRes.text }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/me' && request.method === 'GET') {
        try {
            const session = await requireSession(request, response);
            if (!session) return;
            const context = await attachClientContext(request, response);
            if (!context) return;
            const tenantName = context?.tenant?.nome_fantasia || context?.tenant?.nome_empresa || context?.tenant?.nome || null;
            const membership = context?.membership || {};
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                meta: { contract: 'client_me', version: 1 },
                user: {
                    id: context.user?.id || null,
                    email: context.user?.email || null,
                    name: context.user?.name || null
                },
                tenant: {
                    id: context?.tenant?.id || null,
                    name: tenantName
                },
                membership: {
                    id: membership?.id || null,
                    role: membership?.role || null,
                    status: membership?.status || null
                },
                permissions: context.permissions,
                nav: context.nav
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/invite' && request.method === 'POST') {
        try {
            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const email = String(body?.email || '').trim().toLowerCase();
            const clientIdRaw = String(body?.client_id || '').trim();
            const clientId = /^\d+$/.test(clientIdRaw) ? Number(clientIdRaw) : null;

            if (!email || !clientId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'dados_invalidos' }));
                return;
            }

            const authContext = await getAuthContext(request, response);
            if (!authContext) return;

            const inviteRes = await supabaseAdminAuthRest('/invite', 'POST', { email });
            if (inviteRes.status >= 400) {
                response.writeHead(inviteRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: inviteRes.data?.error || 'erro_ao_convidar' }));
                return;
            }

            const userId = inviteRes.data?.user?.id || inviteRes.data?.id || null;
            if (!userId) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'usuario_nao_criado' }));
                return;
            }

            const profilePayload = {
                id: userId,
                email,
                tenant_id: authContext.tenantId,
                role: 'client'
            };

            const profileRes = await supabaseServiceRest(
                '/rest/v1/profiles?on_conflict=id',
                'POST',
                profilePayload,
                { Prefer: 'resolution=merge-duplicates,return=representation' }
            );

            if (profileRes.status >= 400) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_atualizar_perfil', message: profileRes.data?.message || profileRes.data?.error || profileRes.text }));
                return;
            }

            const membershipRes = await supabaseServiceRest(
                '/rest/v1/client_memberships?on_conflict=tenant_id,client_id,user_id',
                'POST',
                {
                    tenant_id: authContext.tenantId,
                    client_id: clientId,
                    user_id: userId
                },
                { Prefer: 'resolution=merge-duplicates,return=representation' }
            );

            if (membershipRes.status >= 400) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_criar_vinculo', message: membershipRes.data?.message || membershipRes.data?.error || membershipRes.text }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true, user_id: userId }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/approvals' && request.method === 'GET') {
        try {
            const type = String(parsedUrl.query.type || '').trim().toLowerCase();
            if (!['post', 'calendar'].includes(type)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tipo_invalido' }));
                return;
            }

            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { profile } = authContext;
            const role = String(profile.role || '').trim().toLowerCase();
            if (!['client', 'admin'].includes(role)) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }
            const clienteIdValue = profile.client_id || parsedUrl.query.client_id || null;
            const resolved = await resolveTenantAndClient(request, response, clienteIdValue);
            if (!resolved) return;
            const { tenantId, clienteId } = resolved;

            const params = new URLSearchParams();
            params.set('select', '*,client_approval_items(*)');
            params.set('client_id', `eq.${clienteId}`);
            params.set('type', `eq.${type}`);
            params.set('order', 'created_at.desc');

            const approvalsRes = await supabaseRest(
                request,
                `/rest/v1/client_approvals?${params.toString()}`
            );
            if (approvalsRes.status < 200 || approvalsRes.status >= 300) {
                response.writeHead(approvalsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(approvalsRes.data || { error: 'erro_ao_listar_aprovacoes' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(Array.isArray(approvalsRes.data) ? approvalsRes.data : []));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/calendar/approvals' && request.method === 'GET') {
        try {
            const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !supabaseAnonKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
                return;
            }
            if (!serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const clienteIdValue = authContext.profile?.client_id || parsedUrl.query.client_id || null;
            const resolved = await resolveTenantAndClient(request, response, clienteIdValue);
            if (!resolved) return;
            const { tenantId, clienteId } = resolved;

            const month = String(parsedUrl.query.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'month_invalido' }));
                return;
            }

            const mesReferencia = `${month}-01`;

            const calendarParams = new URLSearchParams();
            calendarParams.set('select', '*');
            calendarParams.set('tenant_id', `eq.${tenantId}`);
            calendarParams.set('cliente_id', `eq.${clienteId}`);
            calendarParams.set('mes_referencia', `eq.${mesReferencia}`);
            calendarParams.set('limit', '1');
            const calendarUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?${calendarParams.toString()}`;
            const calendarRes = await fetch(calendarUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const calendarJson = await calendarRes.json().catch(() => null);
            if (!calendarRes.ok) {
                response.writeHead(calendarRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(calendarJson || { error: 'erro_ao_listar_calendario' }));
                return;
            }

            let calendar = Array.isArray(calendarJson) ? calendarJson[0] : null;
            if (!calendar) {
                const insertRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars`, {
                    method: 'POST',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify({
                        cliente_id: clienteId,
                        tenant_id: tenantId,
                        mes_referencia: mesReferencia,
                        status: CALENDAR_STATUS_VALUES.DRAFT
                    })
                });
                const insertJson = await insertRes.json().catch(() => null);
                if (!insertRes.ok || !Array.isArray(insertJson) || insertJson.length === 0) {
                    response.writeHead(insertRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(insertJson || { error: 'erro_ao_criar_calendario' }));
                    return;
                }
                calendar = insertJson[0];
            }

            const postsParams = new URLSearchParams();
            postsParams.set('select', '*');
            postsParams.set('calendar_id', `eq.${calendar.id}`);
            postsParams.set('order', 'data_agendada.asc');
            const postsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?${postsParams.toString()}`;
            const postsRes = await fetch(postsUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const postsJson = await postsRes.json().catch(() => null);
            if (!postsRes.ok) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsJson || { error: 'erro_ao_listar_posts' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ tenant_id: tenantId, calendar, post: Array.isArray(postsJson) ? postsJson : [] }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const socialCalendarMatch = pathname.match(/^\/api\/social\/calendars\/([^/]+)$/);
    if (socialCalendarMatch && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const requestTenantId = authContext?.tenantId || null;
            if (!requestTenantId) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_nao_resolvido' }));
                return;
            }

            const calendarId = socialCalendarMatch[1];
            if (!calendarId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'calendar_id_invalido' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,cliente_id,tenant_id,mes_referencia,status,erro_log,updated_at');
            params.set('id', `eq.${calendarId}`);
            params.set('tenant_id', `eq.${requestTenantId}`);
            params.set('limit', '1');
            const calendarUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?${params.toString()}`;
            const calendarRes = await fetch(calendarUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const calendarJson = await calendarRes.json().catch(() => null);
            if (!calendarRes.ok) {
                response.writeHead(calendarRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(calendarJson || { error: 'erro_ao_listar_calendario' }));
                return;
            }
            const calendar = Array.isArray(calendarJson) ? calendarJson[0] : null;
            if (!calendar) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'calendario_nao_encontrado' }));
                return;
            }
            if (String(calendar.tenant_id) !== String(requestTenantId)) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true, calendar }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/calendar/approvals/submit' && request.method === 'POST') {
        try {
            const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !supabaseAnonKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'supabase_nao_configurado' }));
                return;
            }
            if (!serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const clienteIdValue = authContext.profile?.client_id || parsedUrl.query.client_id || null;
            const resolved = await resolveTenantAndClient(request, response, clienteIdValue);
            if (!resolved) return;
            const { tenantId, clienteId } = resolved;

            const month = String(parsedUrl.query.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'month_invalido' }));
                return;
            }

            const mesReferencia = `${month}-01`;

            const calendarParams = new URLSearchParams();
            calendarParams.set('select', '*');
            calendarParams.set('tenant_id', `eq.${tenantId}`);
            calendarParams.set('cliente_id', `eq.${clienteId}`);
            calendarParams.set('mes_referencia', `eq.${mesReferencia}`);
            calendarParams.set('limit', '1');
            const calendarUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?${calendarParams.toString()}`;
            const calendarRes = await fetch(calendarUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const calendarJson = await calendarRes.json().catch(() => null);
            if (!calendarRes.ok) {
                response.writeHead(calendarRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(calendarJson || { error: 'erro_ao_listar_calendario' }));
                return;
            }

            let calendar = Array.isArray(calendarJson) ? calendarJson[0] : null;
            if (!calendar) {
                const insertRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars`, {
                    method: 'POST',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify({
                        cliente_id: clienteId,
                        tenant_id: tenantId,
                        mes_referencia: mesReferencia,
                        status: CALENDAR_STATUS_VALUES.DRAFT
                    })
                });
                const insertJson = await insertRes.json().catch(() => null);
                if (!insertRes.ok || !Array.isArray(insertJson) || insertJson.length === 0) {
                    response.writeHead(insertRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(insertJson || { error: 'erro_ao_criar_calendario' }));
                    return;
                }
                calendar = insertJson[0];
            }

            const currentStatus = String(calendar?.status || '').trim();
            const shareToken = calendar.share_token || crypto.randomUUID();
            const accessPassword = calendar.access_password || crypto.randomUUID().replace(/-/g, '').slice(0, 8);
            const shouldUpdateStatus = [CALENDAR_STATUS_VALUES.DRAFT, 'rascunho'].includes(currentStatus);
            const shouldUpdateTokens = !calendar.share_token || !calendar.access_password;

            if (shouldUpdateStatus || shouldUpdateTokens) {
                const updatePayload = {
                    status: shouldUpdateStatus ? CALENDAR_STATUS_VALUES.AWAITING_APPROVAL : currentStatus || CALENDAR_STATUS_VALUES.AWAITING_APPROVAL,
                    share_token: shareToken,
                    access_password: accessPassword,
                    updated_at: new Date().toISOString()
                };
                const updateUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?id=eq.${calendar.id}`;
                const updateRes = await fetch(updateUrl, {
                    method: 'PATCH',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify(updatePayload)
                });
                const updateJson = await updateRes.json().catch(() => null);
                if (!updateRes.ok || !Array.isArray(updateJson) || updateJson.length === 0) {
                    response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(updateJson || { error: 'erro_ao_atualizar_calendario' }));
                    return;
                }
                calendar = updateJson[0];
            }

            const baseUrl = buildAppUrl(request);
            const approvalLink = baseUrl && calendar?.share_token
                ? `${baseUrl.replace(/\/$/, '')}/aprovacao_social.html?token=${calendar.share_token}`
                : '';

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                tenant_id: tenantId,
                calendar,
                approval_link: approvalLink,
                access_password: calendar?.access_password || accessPassword
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/post/approvals/submit' && request.method === 'POST') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const clienteIdValue = authContext.profile?.client_id || parsedUrl.query.client_id || null;
            const resolved = await resolveTenantAndClient(request, response, clienteIdValue);
            if (!resolved) return;
            const { tenantId, clienteId } = resolved;

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const from = String(parsedUrl.query.from || '').trim();
            const to = String(parsedUrl.query.to || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'periodo_invalido' }));
                return;
            }
            if (from > to) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'periodo_invalido' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,tema,legenda,legenda_linkedin,legenda_tiktok,link_criativo,data_agendada,formato,medias,imagem_url,video_url,arquivo_url,social_calendars!inner(tenant_id)');
            params.set('social_calendars.tenant_id', `eq.${tenantId}`);
            params.set('social_calendars.cliente_id', `eq.${clienteId}`);
            params.set('data_agendada', `gte.${from}`);
            params.append('data_agendada', `lte.${to}`);
            params.set('order', 'data_agendada.asc');

            const postsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?${params.toString()}`;
            const postsRes = await fetch(postsUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const postsJson = await postsRes.json().catch(() => null);
            if (!postsRes.ok) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsJson || { error: 'erro_ao_listar_posts' }));
                return;
            }

            const posts = Array.isArray(postsJson) ? postsJson : [];
            if (!posts.length) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({
                    batch: null,
                    approval_link: '',
                    access_password: null,
                    items_count: 0,
                    missing: []
                }));
                return;
            }

            const normalizeMedias = (raw) => {
                if (Array.isArray(raw)) return raw;
                if (typeof raw === 'string' && raw.trim()) {
                    try {
                        const parsed = JSON.parse(raw);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                }
                return [];
            };

            const resolveMediaUrl = (media) => {
                if (!media) return '';
                if (media.public_url) return media.public_url;
                if (media.path) {
                    const baseUrl = supabaseUrl.replace(/\/$/, '');
                    return `${baseUrl}/storage/v1/object/public/social_media_uploads/${media.path}`;
                }
                return '';
            };

            const resolvePreviewUrl = (post) => {
                const medias = normalizeMedias(post.medias);
                const primary = medias.find((item) => item && (item.public_url || item.path)) || null;
                const mediaUrl = resolveMediaUrl(primary);
                if (mediaUrl) return mediaUrl;
                return post.imagem_url || post.video_url || post.arquivo_url || '';
            };

            const completePosts = [];
            const missingPosts = [];

            posts.forEach((post) => {
                const tema = String(post.tema || '').trim();
                const legenda = String(post.legenda || '').trim();
                const previewUrl = resolvePreviewUrl(post);
                const missingFields = [];
                if (!tema) missingFields.push('tema');
                if (!legenda) missingFields.push('legenda');
                if (!previewUrl) missingFields.push('criativo');

                if (missingFields.length) {
                    missingPosts.push({
                        id: post.id,
                        data_agendada: post.data_agendada || null,
                        tema: tema || null,
                        missing: missingFields
                    });
                    return;
                }

                const snapshot = {
                    data_agendada: post.data_agendada || null,
                    tema: tema || null,
                    legenda: legenda || null,
                    legenda_linkedin: post.legenda_linkedin || null,
                    legenda_tiktok: post.legenda_tiktok || null,
                    formato: post.formato || null,
                    imagem_url: post.imagem_url || null,
                    video_url: post.video_url || null,
                    arquivo_url: post.arquivo_url || null,
                    link_criativo: post.link_criativo || null,
                    preview_url: previewUrl || null
                };

                completePosts.push({
                    id: post.id,
                    tema,
                    legenda,
                    preview_url: previewUrl,
                    snapshot
                });
            });

            if (!completePosts.length) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({
                    batch: null,
                    approval_link: '',
                    access_password: null,
                    items_count: 0,
                    missing: missingPosts
                }));
                return;
            }

            const batchParams = new URLSearchParams();
            batchParams.set('select', '*');
            batchParams.set('client_id', `eq.${clienteId}`);
            batchParams.set('kind', 'eq.posts_week');
            batchParams.set('period_start', `eq.${from}`);
            batchParams.set('period_end', `eq.${to}`);
            batchParams.set('order', 'created_at.desc');
            batchParams.set('limit', '1');
            const batchUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approval_batches?${batchParams.toString()}`;
            const batchRes = await fetch(batchUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const batchJson = await batchRes.json().catch(() => null);
            if (!batchRes.ok) {
                response.writeHead(batchRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(batchJson || { error: 'erro_ao_listar_batch' }));
                return;
            }

            let batch = Array.isArray(batchJson) ? batchJson[0] : null;
            if (!batch) {
                const shareToken = crypto.randomUUID();
                const accessPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
                const insertBatchPayload = {
                    client_id: clienteId,
                    kind: 'posts_week',
                    period_start: from,
                    period_end: to,
                    share_token: shareToken,
                    access_password: accessPassword
                };
                const insertBatchUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approval_batches`;
                const insertBatchRes = await fetch(insertBatchUrl, {
                    method: 'POST',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify(insertBatchPayload)
                });
                const insertBatchJson = await insertBatchRes.json().catch(() => null);
                if (!insertBatchRes.ok || !Array.isArray(insertBatchJson) || insertBatchJson.length === 0) {
                    response.writeHead(insertBatchRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(insertBatchJson || { error: 'erro_ao_criar_batch' }));
                    return;
                }
                batch = insertBatchJson[0];
            }

            const approvalsPayload = completePosts.map((post) => ({
                client_id: clienteId,
                type: 'post',
                item_id: post.id,
                title: post.tema || 'Post',
                caption: post.legenda || null,
                preview_url: post.preview_url || null,
                status: 'pending',
                batch_id: batch.id
            }));

            const approvalsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approvals?on_conflict=type,item_id,batch_id`;
            const approvalsRes = await fetch(approvalsUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates,return=representation'
                },
                body: JSON.stringify(approvalsPayload)
            });
            const approvalsJson = await approvalsRes.json().catch(() => null);
            if (!approvalsRes.ok || !Array.isArray(approvalsJson)) {
                response.writeHead(approvalsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(approvalsJson || { error: 'erro_ao_criar_aprovacoes' }));
                return;
            }

            const approvalItemsPayload = approvalsJson.map((approval) => {
                const postMatch = completePosts.find((post) => String(post.id) === String(approval.item_id));
                if (!postMatch) return null;
                return {
                    approval_id: approval.id,
                    post_id: postMatch.id,
                    snapshot: postMatch.snapshot
                };
            }).filter(Boolean);

            if (approvalItemsPayload.length) {
                const itemsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approval_items?on_conflict=approval_id,post_id`;
                const itemsRes = await fetch(itemsUrl, {
                    method: 'POST',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'resolution=ignore-duplicates'
                    },
                    body: JSON.stringify(approvalItemsPayload)
                });
                if (!itemsRes.ok) {
                    const itemsJson = await itemsRes.json().catch(() => null);
                    response.writeHead(itemsRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(itemsJson || { error: 'erro_ao_criar_snapshot' }));
                    return;
                }
            }

            const baseUrl = buildAppUrl(request);
            const approvalLink = baseUrl && batch?.share_token
                ? `${baseUrl.replace(/\/$/, '')}/client/approvals/posts?token=${batch.share_token}`
                : '';

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                batch,
                approval_link: approvalLink,
                access_password: batch?.access_password || null,
                items_count: completePosts.length,
                missing: missingPosts
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/social/approval-batch' && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;

            const clientIdRaw = String(parsedUrl.query.cliente_id || parsedUrl.query.client_id || parsedUrl.query.tenant_id || '').trim();
            const month = String(parsedUrl.query.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'mes_invalido' }));
                return;
            }
            if (!clientIdRaw) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_id_obrigatorio' }));
                return;
            }
            const resolved = await resolveTenantAndClient(request, response, clientIdRaw);
            if (!resolved) return;
            const { clienteId } = resolved;

            const [year, monthValue] = month.split('-').map(Number);
            const lastDay = new Date(year, monthValue, 0).getDate();
            const startDate = `${month}-01`;
            const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

            const params = new URLSearchParams();
            params.set('select', 'id,tema,legenda,data_agendada,plataformas,formato,status,approval_group_id,feedback_ajuste,data_envio_aprovacao,social_calendars!inner(cliente_id,tenant_id)');
            params.set('social_calendars.cliente_id', `eq.${clienteId}`);
            params.set('data_agendada', `gte.${startDate}`);
            params.append('data_agendada', `lte.${endDate}`);
            params.set('order', 'data_agendada.asc');

            const postsRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${params.toString()}`
            );
            if (postsRes.status < 200 || postsRes.status >= 300) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsRes.data || { error: 'erro_ao_listar_posts' }));
                return;
            }

            const items = Array.isArray(postsRes.data) ? postsRes.data : [];
            const withApproval = items.filter((item) => item.approval_group_id);
            if (!withApproval.length) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ approval_id: null, batch_status: 'none', items: [] }));
                return;
            }

            withApproval.sort((a, b) => {
                const aTime = a.data_envio_aprovacao ? new Date(a.data_envio_aprovacao).getTime() : 0;
                const bTime = b.data_envio_aprovacao ? new Date(b.data_envio_aprovacao).getTime() : 0;
                return bTime - aTime;
            });
            const approvalId = withApproval[0].approval_group_id;
            const batchItems = items.filter((item) => item.approval_group_id === approvalId);
            const payload = batchItems.map((item) => ({
                id: item.id,
                tema: item.tema || null,
                legenda: item.legenda || null,
                data_agendada: item.data_agendada || null,
                plataforma: item.plataformas || null,
                formato: item.formato || null,
                status: item.status || null,
                feedback_ajuste: item.feedback_ajuste || null
            }));

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ approval_id: approvalId, batch_status: 'sent', items: payload }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/social/approval-batch' && request.method === 'POST') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const clientIdRaw = String(body?.cliente_id || body?.client_id || body?.tenant_id || '').trim();
            const month = String(body?.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'mes_invalido' }));
                return;
            }
            if (!clientIdRaw) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_id_obrigatorio' }));
                return;
            }
            const resolved = await resolveTenantAndClient(request, response, clientIdRaw);
            if (!resolved) return;
            const { clienteId } = resolved;

            const [year, monthValue] = month.split('-').map(Number);
            const lastDay = new Date(year, monthValue, 0).getDate();
            const startDate = `${month}-01`;
            const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

            const params = new URLSearchParams();
            params.set('select', 'id,tema,legenda,data_agendada,plataformas,formato,status,approval_group_id,feedback_ajuste,data_envio_aprovacao,social_calendars!inner(cliente_id,tenant_id)');
            params.set('social_calendars.cliente_id', `eq.${clienteId}`);
            params.set('data_agendada', `gte.${startDate}`);
            params.append('data_agendada', `lte.${endDate}`);
            params.set('order', 'data_agendada.asc');

            const postsRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${params.toString()}`
            );
            if (postsRes.status < 200 || postsRes.status >= 300) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsRes.data || { error: 'erro_ao_listar_posts' }));
                return;
            }

            const items = Array.isArray(postsRes.data) ? postsRes.data : [];
            if (!items.length) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nenhum_post' }));
                return;
            }

            const withApproval = items.filter((item) => item.approval_group_id);
            let approvalId = null;
            if (withApproval.length) {
                withApproval.sort((a, b) => {
                    const aTime = a.data_envio_aprovacao ? new Date(a.data_envio_aprovacao).getTime() : 0;
                    const bTime = b.data_envio_aprovacao ? new Date(b.data_envio_aprovacao).getTime() : 0;
                    return bTime - aTime;
                });
                approvalId = withApproval[0].approval_group_id;
            }
            if (!approvalId) {
                approvalId = crypto.randomUUID();
            }

            const ids = items.map((item) => item.id).filter(Boolean);
            if (!ids.length) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nenhum_post' }));
                return;
            }

            const creativesParams = new URLSearchParams();
            creativesParams.set('select', 'id,post_id');
            creativesParams.set('post_id', `in.(${ids.join(',')})`);
            creativesParams.set('status', 'eq.uploaded');
            const creativesRes = await supabaseRest(
                request,
                `/rest/v1/social_creatives?${creativesParams.toString()}`
            );
            if (creativesRes.status < 200 || creativesRes.status >= 300) {
                response.writeHead(creativesRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(creativesRes.data || { error: 'erro_ao_listar_creatives' }));
                return;
            }
            const creatives = Array.isArray(creativesRes.data) ? creativesRes.data : [];
            const uploadedPostIds = new Set(creatives.map((creative) => String(creative.post_id)));
            const missingUploaded = ids.filter((id) => !uploadedPostIds.has(String(id)));
            if (missingUploaded.length) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({
                    error: 'Post cannot move to ready_for_approval without uploaded creative.'
                }));
                return;
            }

            const updatePayload = {
                status: POST_STATUS_VALUES.READY_FOR_APPROVAL,
                approval_group_id: approvalId,
                data_envio_aprovacao: new Date().toISOString()
            };

            const updateRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?id=in.(${ids.join(',')})`,
                'PATCH',
                updatePayload
            );
            if (updateRes.status < 200 || updateRes.status >= 300) {
                response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(updateRes.data || { error: 'erro_ao_atualizar_posts' }));
                return;
            }

            const payload = items.map((item) => ({
                id: item.id,
                tema: item.tema || null,
                legenda: item.legenda || null,
                data_agendada: item.data_agendada || null,
                plataforma: item.plataformas || null,
                formato: item.formato || null,
                status: POST_STATUS_VALUES.READY_FOR_APPROVAL,
                feedback_ajuste: item.feedback_ajuste || null
            }));

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ approval_id: approvalId, batch_status: 'sent', items: payload }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/social/approval-batch' && request.method === 'GET') {
        try {
            const clientContext = await attachClientContext(request, response);
            if (!clientContext) return;
            const clientIdRaw = String(parsedUrl.query.client_id || parsedUrl.query.clientId || '').trim();
            let requestedClientId = null;
            if (clientIdRaw) {
                if (/^\d+$/.test(clientIdRaw)) {
                    requestedClientId = Math.trunc(Number(clientIdRaw));
                } else {
                    console.warn('invalid_client_id_query', { clientIdRaw });
                }
            }
            const contextTenantRaw = clientContext?.tenant?.id ?? clientContext?.membership?.tenant_id ?? null;
            const contextTenantId = Number.isFinite(Number(contextTenantRaw)) ? Math.trunc(Number(contextTenantRaw)) : null;
            if (!contextTenantId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'missing_tenant' }));
                return;
            }
            if (requestedClientId !== null && requestedClientId !== contextTenantId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_client_id' }));
                return;
            }
            const tenantId = contextTenantId;

            const month = String(parsedUrl.query.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'mes_invalido' }));
                return;
            }

            const [year, monthValue] = month.split('-').map(Number);
            const lastDay = new Date(year, monthValue, 0).getDate();
            const startDate = `${month}-01`;
            const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

            const params = new URLSearchParams();
            params.set('select', 'id,tema,legenda,data_agendada,plataformas,formato,status,approval_group_id,feedback_ajuste,data_envio_aprovacao,social_calendars!inner(tenant_id)');
            params.set('social_calendars.tenant_id', `eq.${tenantId}`);
            params.set('data_agendada', `gte.${startDate}`);
            params.append('data_agendada', `lte.${endDate}`);
            params.set('order', 'data_agendada.asc');

            const postsRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${params.toString()}`
            );
            if (postsRes.status < 200 || postsRes.status >= 300) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsRes.data || { error: 'erro_ao_listar_posts' }));
                return;
            }

            const items = Array.isArray(postsRes.data) ? postsRes.data : [];
            const withApproval = items.filter((item) => item.approval_group_id);
            if (!withApproval.length) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ approval_id: null, batch_status: 'none', items: [] }));
                return;
            }

            withApproval.sort((a, b) => {
                const aTime = a.data_envio_aprovacao ? new Date(a.data_envio_aprovacao).getTime() : 0;
                const bTime = b.data_envio_aprovacao ? new Date(b.data_envio_aprovacao).getTime() : 0;
                return bTime - aTime;
            });
            const approvalId = withApproval[0].approval_group_id;
            const batchItems = items.filter((item) => item.approval_group_id === approvalId);
            const payload = batchItems.map((item) => ({
                id: item.id,
                tema: item.tema || null,
                legenda: item.legenda || null,
                data_agendada: item.data_agendada || null,
                plataforma: item.plataformas || null,
                formato: item.formato || null,
                status: item.status || null,
                feedback_ajuste: item.feedback_ajuste || null
            }));

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ approval_id: approvalId, batch_status: 'sent', items: payload }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientApprovalItemStatusMatch = pathname.match(/^\/api\/client\/social\/approval-items\/([0-9a-fA-F-]{36})\/status$/);
    if (clientApprovalItemStatusMatch && request.method === 'POST') {
        try {
            const itemId = clientApprovalItemStatusMatch[1];
            const profile = await requireClientRole(request, response);
            if (!profile) return;

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const statusRaw = String(body?.status || '').trim().toLowerCase();
            const reason = String(body?.reason || '').trim();
            let nextStatus = null;
            if (statusRaw === 'approved') nextStatus = POST_STATUS_VALUES.APPROVED;
            if (statusRaw === 'needs_adjustment') nextStatus = POST_STATUS_VALUES.REJECTED;
            if (!nextStatus) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'status_invalido' }));
                return;
            }
            if (nextStatus === POST_STATUS_VALUES.REJECTED && !reason) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'motivo_obrigatorio' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', 'id,calendar_id,approval_group_id');
            params.set('id', `eq.${itemId}`);
            params.set('limit', '1');
            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?${params.toString()}`;
            const checkRes = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const checkJson = await checkRes.json().catch(() => null);
            if (!checkRes.ok || !Array.isArray(checkJson) || checkJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'post_nao_encontrado' }));
                return;
            }

            const postRow = checkJson[0];
            if (!postRow?.calendar_id) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'post_nao_encontrado' }));
                return;
            }

            const calendarParams = new URLSearchParams();
            calendarParams.set('select', 'cliente_id');
            calendarParams.set('id', `eq.${postRow.calendar_id}`);
            calendarParams.set('limit', '1');
            const calendarUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?${calendarParams.toString()}`;
            const calendarRes = await fetch(calendarUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const calendarJson = await calendarRes.json().catch(() => null);
            if (!calendarRes.ok || !Array.isArray(calendarJson) || calendarJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'post_nao_encontrado' }));
                return;
            }

            const calendar = calendarJson[0];
            if (String(calendar.cliente_id) !== String(profile.client_id)) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }

            const updatePayload = {
                status: nextStatus,
                updated_at: new Date().toISOString()
            };
            if (nextStatus === POST_STATUS_VALUES.REJECTED) {
                updatePayload.feedback_ajuste = reason;
            }

            const updateUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?id=eq.${itemId}`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(updatePayload)
            });
            const updateJson = await updateRes.json().catch(() => null);
            if (!updateRes.ok) {
                response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(updateJson || { error: 'erro_ao_atualizar_post' }));
                return;
            }

            const creativeStatus =
                nextStatus === POST_STATUS_VALUES.APPROVED
                    ? 'approved'
                    : nextStatus === POST_STATUS_VALUES.REJECTED
                        ? 'needs_revision'
                        : null;
            if (creativeStatus) {
                const creativeUpdateUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_creatives?post_id=eq.${itemId}`;
                const creativeUpdateRes = await fetch(creativeUpdateUrl, {
                    method: 'PATCH',
                    headers: {
                        apikey: serviceRoleKey,
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify({
                        status: creativeStatus,
                        updated_at: new Date().toISOString()
                    })
                });
                const creativeUpdateJson = await creativeUpdateRes.json().catch(() => null);
                if (!creativeUpdateRes.ok) {
                    response.writeHead(creativeUpdateRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(creativeUpdateJson || { error: 'erro_ao_atualizar_creative' }));
                    return;
                }
            }

            const updated = Array.isArray(updateJson) ? updateJson[0] : updateJson;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(updated || null));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/client/social/pending-posts' && request.method === 'GET') {
        try {
            const clientContext = await attachClientContext(request, response);
            if (!clientContext) return;
            const clientIdRaw = String(parsedUrl.query.client_id || parsedUrl.query.clientId || '').trim();
            let requestedClientId = null;
            if (clientIdRaw) {
                if (/^\d+$/.test(clientIdRaw)) {
                    requestedClientId = Math.trunc(Number(clientIdRaw));
                } else {
                    console.warn('invalid_client_id_query', { clientIdRaw });
                }
            }
            const contextTenantRaw = clientContext?.tenant?.id ?? clientContext?.membership?.tenant_id ?? null;
            const contextTenantId = Number.isFinite(Number(contextTenantRaw)) ? Math.trunc(Number(contextTenantRaw)) : null;
            if (!contextTenantId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'missing_tenant' }));
                return;
            }
            if (requestedClientId !== null && requestedClientId !== contextTenantId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_client_id' }));
                return;
            }
            const tenantId = contextTenantId;

            const from = String(parsedUrl.query.from || '').trim();
            const to = String(parsedUrl.query.to || '').trim();
            const limitRaw = parseInt(parsedUrl.query.limit, 10);
            const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
            const orderRaw = String(parsedUrl.query.order || '').trim().toLowerCase();
            const orderParts = orderRaw.split('.');
            const orderFieldRaw = orderParts[0] || '';
            const orderDir = orderParts[1] === 'desc' ? 'desc' : 'asc';
            const orderField = orderFieldRaw === 'scheduled_at' ? 'data_agendada' : orderFieldRaw;
            const allowedOrderFields = new Set(['data_agendada', 'created_at']);
            const order = allowedOrderFields.has(orderField) ? `${orderField}.${orderDir}` : 'data_agendada.asc';

            const pendingStatuses = [
                POST_STATUS_VALUES.READY_FOR_APPROVAL,
                'pendente_aprovação',
                'pendente_aprovacao',
                'aguardando_aprovacao',
                'pending',
                'pending_approval',
                'pendente'
            ].filter(Boolean);
            const params = new URLSearchParams();
            params.set('select', 'id,tema,legenda,data_agendada,hora_agendada,plataformas,status,imagem_url,calendar_id,social_calendars!inner(tenant_id)');
            params.set('social_calendars.tenant_id', `eq.${tenantId}`);
            params.set('status', `in.(${pendingStatuses.join(',')})`);
            params.set('order', order);
            params.set('limit', String(limit));
            if (from) params.set('data_agendada', `gte.${from}`);
            if (to) params.set('data_agendada', `lte.${to}`);

            const postsRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${params.toString()}`
            );
            if (postsRes.status < 200 || postsRes.status >= 300) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsRes.data || { error: 'erro_ao_listar_posts' }));
                return;
            }

            const items = Array.isArray(postsRes.data) ? postsRes.data : [];
            const payload = items.map((item) => ({
                id: item.id,
                titulo: item.tema || null,
                tema: item.tema || null,
                legenda: item.legenda || null,
                data_agendada: item.data_agendada || null,
                scheduled_at: item.data_agendada || null,
                plataforma: item.plataformas || null,
                status: item.status || null,
                media_url: item.imagem_url || null
            }));

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ items: payload }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const getPostByIdForTenant = async (postId, tenantId) => {
        const params = new URLSearchParams();
        params.set('select', '*,social_calendars!inner(tenant_id)');
        params.set('id', `eq.${postId}`);
        params.set('social_calendars.tenant_id', `eq.${tenantId}`);
        params.set('limit', '1');
        const postRes = await supabaseRest(
            request,
            `/rest/v1/social_posts?${params.toString()}`
        );
        if (postRes.status < 200 || postRes.status >= 300) {
            return { error: { status: postRes.status, data: postRes.data || { error: 'erro_ao_buscar_post' } } };
        }
        const postRow = Array.isArray(postRes.data) ? postRes.data[0] : postRes.data;
        if (!postRow) {
            return { error: { status: 404, data: { error: 'post_nao_encontrado' } } };
        }
        return { post: postRow };
    };

    const getLatestVersionForPost = async (postId, tenantId) => {
        const versionsParams = new URLSearchParams();
        versionsParams.set('select', 'id,version_number');
        versionsParams.set('tenant_id', `eq.${tenantId}`);
        versionsParams.set('post_id', `eq.${postId}`);
        versionsParams.set('order', 'version_number.desc');
        versionsParams.set('limit', '1');
        const versionsRes = await supabaseRest(
            request,
            `/rest/v1/social_post_versions?${versionsParams.toString()}`
        );
        if (versionsRes.status < 200 || versionsRes.status >= 300) {
            return { error: { status: versionsRes.status, data: versionsRes.data || { error: 'erro_ao_listar_versoes' } } };
        }
        const versionRow = Array.isArray(versionsRes.data) ? versionsRes.data[0] : versionsRes.data;
        return { version: versionRow || null };
    };

    const createPostVersionSnapshot = async (postId, tenantId, userId) => {
        const postResult = await getPostByIdForTenant(postId, tenantId);
        if (postResult.error) {
            return { error: postResult.error };
        }

        const creativesSnapshotParams = new URLSearchParams();
        creativesSnapshotParams.set('select', '*');
        creativesSnapshotParams.set('post_id', `eq.${postId}`);
        const creativesSnapshotRes = await supabaseRest(
            request,
            `/rest/v1/social_creatives?${creativesSnapshotParams.toString()}`
        );
        if (creativesSnapshotRes.status < 200 || creativesSnapshotRes.status >= 300) {
            return { error: { status: creativesSnapshotRes.status, data: creativesSnapshotRes.data || { error: 'erro_ao_listar_creatives' } } };
        }
        const creativesSnapshot = Array.isArray(creativesSnapshotRes.data) ? creativesSnapshotRes.data : [];
        const snapshotJson = {
            post: postResult.post,
            creatives: creativesSnapshot
        };

        const latestResult = await getLatestVersionForPost(postId, tenantId);
        if (latestResult.error) {
            return { error: latestResult.error };
        }
        const nextVersion = (latestResult.version?.version_number || 0) + 1;

        const insertPayload = {
            tenant_id: tenantId,
            post_id: postId,
            version_number: nextVersion,
            snapshot_json: snapshotJson,
            diff_json: null,
            created_by: userId
        };
        const insertVersionRes = await supabaseRest(
            request,
            `/rest/v1/social_post_versions`,
            'POST',
            insertPayload
        );
        if (insertVersionRes.status < 200 || insertVersionRes.status >= 300) {
            return { error: { status: insertVersionRes.status, data: insertVersionRes.data || { error: 'erro_ao_criar_versao' } } };
        }

        const versionFetchParams = new URLSearchParams();
        versionFetchParams.set('select', '*');
        versionFetchParams.set('tenant_id', `eq.${tenantId}`);
        versionFetchParams.set('post_id', `eq.${postId}`);
        versionFetchParams.set('version_number', `eq.${nextVersion}`);
        versionFetchParams.set('limit', '1');
        const versionFetchRes = await supabaseRest(
            request,
            `/rest/v1/social_post_versions?${versionFetchParams.toString()}`
        );
        if (versionFetchRes.status < 200 || versionFetchRes.status >= 300) {
            return { error: { status: versionFetchRes.status, data: versionFetchRes.data || { error: 'erro_ao_buscar_versao' } } };
        }
        const version = Array.isArray(versionFetchRes.data) ? versionFetchRes.data[0] : versionFetchRes.data;
        return { version };
    };

    const ensureLatestVersion = async (postId, tenantId, userId) => {
        const latestResult = await getLatestVersionForPost(postId, tenantId);
        if (latestResult.error) {
            return { error: latestResult.error };
        }
        if (latestResult.version) {
            return { version: latestResult.version };
        }
        return await createPostVersionSnapshot(postId, tenantId, userId);
    };

    const submitForApprovalMatch = pathname.match(/^\/api\/social\/posts\/([0-9a-fA-F-]{36})\/submit-for-approval$/);
    if (submitForApprovalMatch && request.method === 'POST') {
        try {
            const postId = submitForApprovalMatch[1];
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId, user } = authContext;

            const postResult = await getPostByIdForTenant(postId, tenantId);
            if (postResult.error) {
                response.writeHead(postResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postResult.error.data));
                return;
            }

            const creativesParams = new URLSearchParams();
            creativesParams.set('select', 'id');
            creativesParams.set('post_id', `eq.${postId}`);
            creativesParams.set('status', 'eq.uploaded');
            creativesParams.set('limit', '1');
            const creativesRes = await supabaseRest(
                request,
                `/rest/v1/social_creatives?${creativesParams.toString()}`
            );
            if (creativesRes.status < 200 || creativesRes.status >= 300) {
                response.writeHead(creativesRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(creativesRes.data || { error: 'erro_ao_listar_creatives' }));
                return;
            }
            const creatives = Array.isArray(creativesRes.data) ? creativesRes.data : [];
            if (!creatives.length) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Post cannot move to ready_for_approval without uploaded creative.' }));
                return;
            }

            const versionResult = await createPostVersionSnapshot(postId, tenantId, user.id);
            if (versionResult.error) {
                response.writeHead(versionResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(versionResult.error.data));
                return;
            }

            const updatePayload = {
                status: POST_STATUS_VALUES.READY_FOR_APPROVAL
            };
            const updateParams = new URLSearchParams();
            updateParams.set('id', `eq.${postId}`);
            const updateRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${updateParams.toString()}`,
                'PATCH',
                updatePayload
            );
            if (updateRes.status < 200 || updateRes.status >= 300) {
                response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(updateRes.data || { error: 'erro_ao_atualizar_post' }));
                return;
            }

            const version = versionResult.version;

            const postRefresh = await getPostByIdForTenant(postId, tenantId);
            if (postRefresh.error) {
                response.writeHead(postRefresh.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postRefresh.error.data));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ post: postRefresh.post, version }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const approvePostMatch = pathname.match(/^\/api\/social\/posts\/([0-9a-fA-F-]{36})\/approve$/);
    if (approvePostMatch && request.method === 'POST') {
        try {
            const postId = approvePostMatch[1];
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId, user } = authContext;

            const postResult = await getPostByIdForTenant(postId, tenantId);
            if (postResult.error) {
                response.writeHead(postResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postResult.error.data));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const versionId = String(body?.version_id || '').trim();
            let versionRow = null;
            if (versionId) {
                const versionParams = new URLSearchParams();
                versionParams.set('select', 'id,version_number');
                versionParams.set('id', `eq.${versionId}`);
                versionParams.set('post_id', `eq.${postId}`);
                versionParams.set('tenant_id', `eq.${tenantId}`);
                versionParams.set('limit', '1');
                const versionRes = await supabaseRest(
                    request,
                    `/rest/v1/social_post_versions?${versionParams.toString()}`
                );
                if (versionRes.status < 200 || versionRes.status >= 300) {
                    response.writeHead(versionRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(versionRes.data || { error: 'erro_ao_buscar_versao' }));
                    return;
                }
                versionRow = Array.isArray(versionRes.data) ? versionRes.data[0] : versionRes.data;
            } else {
                const ensureResult = await ensureLatestVersion(postId, tenantId, user.id);
                if (ensureResult.error) {
                    response.writeHead(ensureResult.error.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(ensureResult.error.data));
                    return;
                }
                versionRow = ensureResult.version;
            }
            if (!versionRow) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'versao_nao_encontrada' }));
                return;
            }

            const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
            const meta = body?.meta && typeof body.meta === 'object' ? body.meta : null;
            const approvalPayload = {
                tenant_id: tenantId,
                post_id: postId,
                version_id: versionRow.id,
                status: 'approved',
                decision_comment: comment || null,
                actor_user_id: user.id,
                metadata_json: meta,
                created_at: new Date().toISOString()
            };
            const approvalRes = await supabaseRest(
                request,
                `/rest/v1/social_approvals`,
                'POST',
                approvalPayload
            );
            if (approvalRes.status < 200 || approvalRes.status >= 300) {
                response.writeHead(approvalRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(approvalRes.data || { error: 'erro_ao_registrar_aprovacao' }));
                return;
            }

            const postUpdateParams = new URLSearchParams();
            postUpdateParams.set('id', `eq.${postId}`);
            const postUpdateRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${postUpdateParams.toString()}`,
                'PATCH',
                { status: POST_STATUS_VALUES.APPROVED }
            );
            if (postUpdateRes.status < 200 || postUpdateRes.status >= 300) {
                response.writeHead(postUpdateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postUpdateRes.data || { error: 'erro_ao_atualizar_post' }));
                return;
            }

            const creativeUpdateParams = new URLSearchParams();
            creativeUpdateParams.set('post_id', `eq.${postId}`);
            const creativeUpdateRes = await supabaseRest(
                request,
                `/rest/v1/social_creatives?${creativeUpdateParams.toString()}`,
                'PATCH',
                { status: 'approved', updated_at: new Date().toISOString() }
            );
            if (creativeUpdateRes.status < 200 || creativeUpdateRes.status >= 300) {
                response.writeHead(creativeUpdateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(creativeUpdateRes.data || { error: 'erro_ao_atualizar_creative' }));
                return;
            }

            const commentPayload = {
                tenant_id: tenantId,
                post_id: postId,
                parent_comment_id: null,
                author_user_id: user.id,
                comment_type: 'decision',
                body: comment || 'Aprovado',
                target_json: meta ? { status: 'approved', meta } : { status: 'approved' },
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const commentRes = await supabaseRest(
                request,
                `/rest/v1/social_post_comments`,
                'POST',
                commentPayload
            );
            if (commentRes.status < 200 || commentRes.status >= 300) {
                response.writeHead(commentRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentRes.data || { error: 'erro_ao_registrar_comentario' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const rejectPostMatch = pathname.match(/^\/api\/social\/posts\/([0-9a-fA-F-]{36})\/reject$/);
    if (rejectPostMatch && request.method === 'POST') {
        try {
            const postId = rejectPostMatch[1];
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId, user } = authContext;

            const postResult = await getPostByIdForTenant(postId, tenantId);
            if (postResult.error) {
                response.writeHead(postResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postResult.error.data));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const versionId = String(body?.version_id || '').trim();
            const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
            if (!comment) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'comentario_obrigatorio' }));
                return;
            }
            let versionRow = null;
            if (versionId) {
                const versionParams = new URLSearchParams();
                versionParams.set('select', 'id,version_number');
                versionParams.set('id', `eq.${versionId}`);
                versionParams.set('post_id', `eq.${postId}`);
                versionParams.set('tenant_id', `eq.${tenantId}`);
                versionParams.set('limit', '1');
                const versionRes = await supabaseRest(
                    request,
                    `/rest/v1/social_post_versions?${versionParams.toString()}`
                );
                if (versionRes.status < 200 || versionRes.status >= 300) {
                    response.writeHead(versionRes.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(versionRes.data || { error: 'erro_ao_buscar_versao' }));
                    return;
                }
                versionRow = Array.isArray(versionRes.data) ? versionRes.data[0] : versionRes.data;
            } else {
                const ensureResult = await ensureLatestVersion(postId, tenantId, user.id);
                if (ensureResult.error) {
                    response.writeHead(ensureResult.error.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(ensureResult.error.data));
                    return;
                }
                versionRow = ensureResult.version;
            }
            if (!versionRow) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'versao_nao_encontrada' }));
                return;
            }

            const reasonCode = typeof body?.reason_code === 'string' ? body.reason_code.trim() : null;
            const requestedChanges = Array.isArray(body?.requested_changes) ? body.requested_changes : [];
            const meta = body?.meta && typeof body.meta === 'object' ? body.meta : null;
            const approvalPayload = {
                tenant_id: tenantId,
                post_id: postId,
                version_id: versionRow.id,
                status: 'needs_revision',
                decision_comment: comment,
                actor_user_id: user.id,
                metadata_json: meta ? { reason_code: reasonCode || null, requested_changes: requestedChanges, meta } : { reason_code: reasonCode || null, requested_changes: requestedChanges },
                created_at: new Date().toISOString()
            };
            const approvalRes = await supabaseRest(
                request,
                `/rest/v1/social_approvals`,
                'POST',
                approvalPayload
            );
            if (approvalRes.status < 200 || approvalRes.status >= 300) {
                response.writeHead(approvalRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(approvalRes.data || { error: 'erro_ao_registrar_reprovacao' }));
                return;
            }

            const postUpdateParams = new URLSearchParams();
            postUpdateParams.set('id', `eq.${postId}`);
            const postUpdateRes = await supabaseRest(
                request,
                `/rest/v1/social_posts?${postUpdateParams.toString()}`,
                'PATCH',
                { status: POST_STATUS_VALUES.REJECTED }
            );
            if (postUpdateRes.status < 200 || postUpdateRes.status >= 300) {
                response.writeHead(postUpdateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postUpdateRes.data || { error: 'erro_ao_atualizar_post' }));
                return;
            }

            const creativeUpdateParams = new URLSearchParams();
            creativeUpdateParams.set('post_id', `eq.${postId}`);
            const creativeUpdateRes = await supabaseRest(
                request,
                `/rest/v1/social_creatives?${creativeUpdateParams.toString()}`,
                'PATCH',
                { status: 'needs_revision', updated_at: new Date().toISOString() }
            );
            if (creativeUpdateRes.status < 200 || creativeUpdateRes.status >= 300) {
                response.writeHead(creativeUpdateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(creativeUpdateRes.data || { error: 'erro_ao_atualizar_creative' }));
                return;
            }

            const commentPayload = {
                tenant_id: tenantId,
                post_id: postId,
                parent_comment_id: null,
                author_user_id: user.id,
                comment_type: 'decision',
                body: comment,
                target_json: {
                    status: 'needs_revision',
                    reason_code: reasonCode || null,
                    requested_changes: requestedChanges
                },
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const commentRes = await supabaseRest(
                request,
                `/rest/v1/social_post_comments`,
                'POST',
                commentPayload
            );
            if (commentRes.status < 200 || commentRes.status >= 300) {
                response.writeHead(commentRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentRes.data || { error: 'erro_ao_registrar_comentario' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const postCommentMatch = pathname.match(/^\/api\/social\/posts\/([0-9a-fA-F-]{36})\/comments$/);
    if (postCommentMatch && request.method === 'POST') {
        try {
            const postId = postCommentMatch[1];
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId, user } = authContext;

            const postResult = await getPostByIdForTenant(postId, tenantId);
            if (postResult.error) {
                response.writeHead(postResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postResult.error.data));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const legacyType = String(body?.type || '').trim();
            const commentTypeRaw = String(body?.comment_type || '').trim();
            const commentTypeMap = {
                general: 'comment',
                change_request: 'decision',
                approval_note: 'decision'
            };
            const commentType = commentTypeRaw || commentTypeMap[legacyType] || 'comment';
            const allowedTypes = new Set(['comment', 'decision', 'system']);
            if (!allowedTypes.has(commentType)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tipo_invalido' }));
                return;
            }

            const payload = body?.payload && typeof body.payload === 'object' ? body.payload : null;
            const targetJson = body?.target_json && typeof body.target_json === 'object'
                ? body.target_json
                : payload;
            const bodyText = typeof body?.body === 'string' ? body.body.trim() : String(payload?.text || '').trim();
            if (!bodyText) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'body_obrigatorio' }));
                return;
            }

            const parentCommentId = body?.parent_comment_id ? String(body.parent_comment_id).trim() : null;
            const commentPayload = {
                tenant_id: tenantId,
                post_id: postId,
                parent_comment_id: parentCommentId || null,
                author_user_id: user.id,
                comment_type: commentType,
                body: bodyText,
                target_json: targetJson || null,
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const commentRes = await supabaseRest(
                request,
                `/rest/v1/social_post_comments`,
                'POST',
                commentPayload
            );
            if (commentRes.status < 200 || commentRes.status >= 300) {
                response.writeHead(commentRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentRes.data || { error: 'erro_ao_registrar_comentario' }));
                return;
            }

            const commentFetchParams = new URLSearchParams();
            commentFetchParams.set('select', '*');
            commentFetchParams.set('tenant_id', `eq.${tenantId}`);
            commentFetchParams.set('post_id', `eq.${postId}`);
            commentFetchParams.set('order', 'created_at.desc');
            commentFetchParams.set('limit', '1');
            const commentFetchRes = await supabaseRest(
                request,
                `/rest/v1/social_post_comments?${commentFetchParams.toString()}`
            );
            if (commentFetchRes.status < 200 || commentFetchRes.status >= 300) {
                response.writeHead(commentFetchRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentFetchRes.data || { error: 'erro_ao_buscar_comentario' }));
                return;
            }
            const commentItem = Array.isArray(commentFetchRes.data) ? commentFetchRes.data[0] : commentFetchRes.data;

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(commentItem || null));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const postHistoryMatch = pathname.match(/^\/api\/social\/posts\/([0-9a-fA-F-]{36})\/history$/);
    if (postHistoryMatch && request.method === 'GET') {
        try {
            const postId = postHistoryMatch[1];
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId } = authContext;

            const postResult = await getPostByIdForTenant(postId, tenantId);
            if (postResult.error) {
                response.writeHead(postResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postResult.error.data));
                return;
            }

            const versionsParams = new URLSearchParams();
            versionsParams.set('select', '*');
            versionsParams.set('tenant_id', `eq.${tenantId}`);
            versionsParams.set('post_id', `eq.${postId}`);
            versionsParams.set('order', 'version_number.desc');
            const versionsRes = await supabaseRest(
                request,
                `/rest/v1/social_post_versions?${versionsParams.toString()}`
            );
            if (versionsRes.status < 200 || versionsRes.status >= 300) {
                response.writeHead(versionsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(versionsRes.data || { error: 'erro_ao_listar_versoes' }));
                return;
            }
            const versions = Array.isArray(versionsRes.data) ? versionsRes.data : [];

            const approvalsParams = new URLSearchParams();
            approvalsParams.set('select', '*');
            approvalsParams.set('tenant_id', `eq.${tenantId}`);
            approvalsParams.set('post_id', `eq.${postId}`);
            approvalsParams.set('order', 'created_at.desc');
            const approvalsRes = await supabaseRest(
                request,
                `/rest/v1/social_approvals?${approvalsParams.toString()}`
            );
            if (approvalsRes.status < 200 || approvalsRes.status >= 300) {
                response.writeHead(approvalsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(approvalsRes.data || { error: 'erro_ao_listar_aprovacoes' }));
                return;
            }
            const approvals = Array.isArray(approvalsRes.data) ? approvalsRes.data : [];

            const commentsParams = new URLSearchParams();
            commentsParams.set('select', '*');
            commentsParams.set('tenant_id', `eq.${tenantId}`);
            commentsParams.set('post_id', `eq.${postId}`);
            commentsParams.set('order', 'created_at.desc');
            const commentsRes = await supabaseRest(
                request,
                `/rest/v1/social_post_comments?${commentsParams.toString()}`
            );
            if (commentsRes.status < 200 || commentsRes.status >= 300) {
                response.writeHead(commentsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentsRes.data || { error: 'erro_ao_listar_comentarios' }));
                return;
            }
            const comments = Array.isArray(commentsRes.data) ? commentsRes.data : [];

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ versions, approvals, comments }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const postAuditMatch = pathname.match(/^\/api\/social\/posts\/([0-9a-fA-F-]{36})\/audit$/);
    if (postAuditMatch && request.method === 'GET') {
        try {
            const postId = postAuditMatch[1];
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId } = authContext;

            const postResult = await getPostByIdForTenant(postId, tenantId);
            if (postResult.error) {
                response.writeHead(postResult.error.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postResult.error.data));
                return;
            }

            const versionsParams = new URLSearchParams();
            versionsParams.set('select', '*');
            versionsParams.set('tenant_id', `eq.${tenantId}`);
            versionsParams.set('post_id', `eq.${postId}`);
            versionsParams.set('order', 'version_number.desc');
            const versionsRes = await supabaseRest(
                request,
                `/rest/v1/social_post_versions?${versionsParams.toString()}`
            );
            if (versionsRes.status < 200 || versionsRes.status >= 300) {
                response.writeHead(versionsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(versionsRes.data || { error: 'erro_ao_listar_versoes' }));
                return;
            }
            const versions = Array.isArray(versionsRes.data) ? versionsRes.data : [];

            const approvalsParams = new URLSearchParams();
            approvalsParams.set('select', '*');
            approvalsParams.set('tenant_id', `eq.${tenantId}`);
            approvalsParams.set('post_id', `eq.${postId}`);
            approvalsParams.set('order', 'created_at.desc');
            const approvalsRes = await supabaseRest(
                request,
                `/rest/v1/social_approvals?${approvalsParams.toString()}`
            );
            if (approvalsRes.status < 200 || approvalsRes.status >= 300) {
                response.writeHead(approvalsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(approvalsRes.data || { error: 'erro_ao_listar_aprovacoes' }));
                return;
            }
            const approvals = Array.isArray(approvalsRes.data) ? approvalsRes.data : [];

            const commentsParams = new URLSearchParams();
            commentsParams.set('select', '*');
            commentsParams.set('tenant_id', `eq.${tenantId}`);
            commentsParams.set('post_id', `eq.${postId}`);
            commentsParams.set('order', 'created_at.desc');
            const commentsRes = await supabaseRest(
                request,
                `/rest/v1/social_post_comments?${commentsParams.toString()}`
            );
            if (commentsRes.status < 200 || commentsRes.status >= 300) {
                response.writeHead(commentsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentsRes.data || { error: 'erro_ao_listar_comentarios' }));
                return;
            }
            const comments = Array.isArray(commentsRes.data) ? commentsRes.data : [];

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ post: postResult.post, versions, approvals, comments }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientApprovalMatch = pathname.match(/^\/api\/client\/approvals\/([0-9a-fA-F-]{36})$/);
    if (clientApprovalMatch && request.method === 'GET') {
        try {
            const approvalId = clientApprovalMatch[1];
            const profile = await requireClientRole(request, response);
            if (!profile) return;

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const approvalParams = new URLSearchParams();
            approvalParams.set('select', 'id,client_id,type,item_id,title,preview_url,status,created_at');
            approvalParams.set('id', `eq.${approvalId}`);
            approvalParams.set('limit', '1');
            const approvalUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approvals?${approvalParams.toString()}`;
            const approvalRes = await fetch(approvalUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const approvalJson = await approvalRes.json().catch(() => null);
            if (!approvalRes.ok || !Array.isArray(approvalJson) || approvalJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'aprovacao_nao_encontrada' }));
                return;
            }

            const approval = approvalJson[0];
            if (approval.client_id !== profile.client_id) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }

            const commentsParams = new URLSearchParams();
            commentsParams.set('select', 'id,approval_id,author_role,comment,created_at');
            commentsParams.set('approval_id', `eq.${approvalId}`);
            commentsParams.set('order', 'created_at.asc');
            const commentsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approval_comments?${commentsParams.toString()}`;
            const commentsRes = await fetch(commentsUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const commentsJson = await commentsRes.json().catch(() => null);
            if (!commentsRes.ok) {
                response.writeHead(commentsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(commentsJson || { error: 'erro_ao_listar_comentarios' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ approval, comments: Array.isArray(commentsJson) ? commentsJson : [] }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientApprovalCommentMatch = pathname.match(/^\/api\/client\/approvals\/([0-9a-fA-F-]{36})\/comment$/);
    if (clientApprovalCommentMatch && request.method === 'POST') {
        try {
            const approvalId = clientApprovalCommentMatch[1];
            const profile = await requireClientRole(request, response);
            if (!profile) return;

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const comment = String(body?.comment || '').trim();
            if (!comment) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'comentario_obrigatorio' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const approvalParams = new URLSearchParams();
            approvalParams.set('select', 'id,client_id,status');
            approvalParams.set('id', `eq.${approvalId}`);
            approvalParams.set('limit', '1');
            const approvalUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approvals?${approvalParams.toString()}`;
            const approvalRes = await fetch(approvalUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const approvalJson = await approvalRes.json().catch(() => null);
            if (!approvalRes.ok || !Array.isArray(approvalJson) || approvalJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'aprovacao_nao_encontrada' }));
                return;
            }

            const approval = approvalJson[0];
            if (approval.client_id !== profile.client_id) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }

            const insertPayload = {
                approval_id: approvalId,
                author_role: 'client',
                comment
            };
            const insertUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approval_comments`;
            const insertRes = await fetch(insertUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(insertPayload)
            });
            const insertJson = await insertRes.json().catch(() => null);
            if (!insertRes.ok) {
                response.writeHead(insertRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(insertJson || { error: 'erro_ao_inserir_comentario' }));
                return;
            }

            const created = Array.isArray(insertJson) ? insertJson[0] : insertJson;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(created || null));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const clientApprovalStatusMatch = pathname.match(/^\/api\/client\/approvals\/([0-9a-fA-F-]{36})\/status$/);
    if (clientApprovalStatusMatch && request.method === 'POST') {
        try {
            const approvalId = clientApprovalStatusMatch[1];
            const profile = await requireClientRole(request, response);
            if (!profile) return;

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const status = String(body?.status || '').trim();
            if (!['approved', 'changes_requested'].includes(status)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'status_invalido' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const approvalParams = new URLSearchParams();
            approvalParams.set('select', 'id,client_id,status');
            approvalParams.set('id', `eq.${approvalId}`);
            approvalParams.set('limit', '1');
            const approvalUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approvals?${approvalParams.toString()}`;
            const approvalRes = await fetch(approvalUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const approvalJson = await approvalRes.json().catch(() => null);
            if (!approvalRes.ok || !Array.isArray(approvalJson) || approvalJson.length === 0) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'aprovacao_nao_encontrada' }));
                return;
            }

            const approval = approvalJson[0];
            if (approval.client_id !== profile.client_id) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }
            if (approval.status !== 'pending') {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'status_nao_permite_alteracao' }));
                return;
            }

            const updateUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_approvals?id=eq.${approvalId}`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({ status })
            });
            const updateJson = await updateRes.json().catch(() => null);
            if (!updateRes.ok) {
                response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(updateJson || { error: 'erro_ao_atualizar_status' }));
                return;
            }

            const updated = Array.isArray(updateJson) ? updateJson[0] : updateJson;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(updated || null));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
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

    const socialCalendarGenerateMatch = pathname.match(/^\/api\/social\/calendars\/([^/]+)\/generate$/);
    if (socialCalendarGenerateMatch && request.method === 'POST') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const rawClientId = decodeURIComponent(socialCalendarGenerateMatch[1] || '').trim();
            if (!rawClientId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'client_id_invalido' }));
                return;
            }
            const resolved = await resolveTenantAndClient(request, response, rawClientId);
            if (!resolved) return;
            const { tenantId, clienteId } = resolved;

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_json', message: 'Body inválido. Envie JSON.' }));
                return;
            }

            const month = String(body?.month || '').trim();
            if (!/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'month_invalido' }));
                return;
            }
            const postsCount = Number.isFinite(Number(body?.postsCount)) ? Math.max(1, Number(body.postsCount)) : 12;
            const seasonalDatesText = String(body?.seasonalDatesText || '').trim();
            const mesReferencia = `${month}-01`;
            const [yearRaw] = month.split('-');
            const year = Number(yearRaw);

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const clientParams = new URLSearchParams();
            clientParams.set('select', 'id,nome_empresa,nome_fantasia,nicho_atuacao,client_insights,insights,visual_identity,identidade_visual,link_briefing,link_persona,link_conteudos_anteriores,link_referencias,link_identidade_visual');
            clientParams.set('id', `eq.${clienteId}`);
            clientParams.set('limit', '1');
            const clientRes = await supabaseServiceRest(`/rest/v1/clientes?${clientParams.toString()}`);
            const clientData = Array.isArray(clientRes.data) ? clientRes.data[0] : null;
            if (!clientData?.id) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_nao_encontrado' }));
                return;
            }

            const approvedParams = new URLSearchParams();
            approvedParams.set('select', 'id,mes_referencia,status');
            approvedParams.set('cliente_id', `eq.${clienteId}`);
            if (tenantId) approvedParams.set('tenant_id', `eq.${tenantId}`);
            approvedParams.set('status', 'in.(aprovado,approved)');
            approvedParams.set('order', 'mes_referencia.desc');
            approvedParams.set('limit', '1');
            const lastApprovedRes = await supabaseServiceRest(`/rest/v1/social_calendars?${approvedParams.toString()}`);
            const lastApproved = Array.isArray(lastApprovedRes.data) ? lastApprovedRes.data[0] : null;
            let previousPostsSummary = '';
            if (lastApproved?.id) {
                const postParams = new URLSearchParams();
                postParams.set('select', 'tema,formato,legenda,data_agendada,descricao_visual,conteudo_roteiro');
                postParams.set('calendar_id', `eq.${lastApproved.id}`);
                postParams.set('order', 'data_agendada.asc');
                postParams.set('limit', '40');
                const postsRes = await supabaseServiceRest(`/rest/v1/social_posts?${postParams.toString()}`);
                const postsRows = Array.isArray(postsRes.data) ? postsRes.data : [];
                previousPostsSummary = postsRows.map((post) => {
                    const tema = String(post.tema || '').trim();
                    const formato = String(post.formato || '').trim();
                    const dataAgendada = String(post.data_agendada || '').slice(0, 10);
                    return `${dataAgendada} | ${formato} | ${tema}`;
                }).filter(Boolean).join('\n');
            }

            const apiKey = envVars['OPENAI_API_KEY'];
            if (!apiKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'openai_nao_configurada' }));
                return;
            }

            const callOpenAiJson = async (payload) => {
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
                } catch {
                    throw new Error(rawText || 'Resposta inválida da OpenAI.');
                }
                if (!openAiResponse.ok) {
                    const message = responseJson?.error?.message || 'Erro na OpenAI.';
                    throw new Error(message);
                }
                const content = String(responseJson?.choices?.[0]?.message?.content || '').trim();
                let result = null;
                try {
                    result = JSON.parse(content);
                } catch {
                    throw new Error('Falha ao interpretar JSON da IA.');
                }
                return result;
            };

            const clientName = clientData.nome_fantasia || clientData.nome_empresa || 'Cliente';
            const pipelineLog = [];
            const contextUsed = {
                client_id: clienteId,
                client_name: clientName,
                month,
                year,
                seasonal_dates: seasonalDatesText,
                briefing_link: clientData.link_briefing || '',
                persona_link: clientData.link_persona || '',
                referencias_link: clientData.link_referencias || '',
                identidade_visual_link: clientData.link_identidade_visual || '',
                conteudos_anteriores_link: clientData.link_conteudos_anteriores || '',
                previous_calendar_id: lastApproved?.id || null
            };

            const agent1Payload = {
                model: 'gpt-4-turbo',
                temperature: 0.6,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Você é estrategista de social media. Gere um plano mensal com temas e formatos. Responda apenas JSON.'
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            client_name: clientName,
                            niche: clientData.nicho_atuacao || '',
                            insights: clientData.client_insights || clientData.insights || '',
                            visual_identity: clientData.visual_identity || clientData.identidade_visual || '',
                            month,
                            posts_count: postsCount,
                            seasonal_dates_text: seasonalDatesText,
                            previous_calendar_summary: previousPostsSummary
                        })
                    }
                ]
            };
            const agent1Result = await callOpenAiJson(agent1Payload);
            pipelineLog.push({ step: 'temas', ok: true });
            const themes = Array.isArray(agent1Result?.themes) ? agent1Result.themes : [];

            const agent2Payload = {
                model: 'gpt-4-turbo',
                temperature: 0.6,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Você é diretor de arte e roteirista. Para cada tema, gere direção de arte e roteiro. Responda apenas JSON.'
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            client_name: clientName,
                            month,
                            themes
                        })
                    }
                ]
            };
            const agent2Result = await callOpenAiJson(agent2Payload);
            pipelineLog.push({ step: 'direcao_arte', ok: true });
            const artItems = Array.isArray(agent2Result?.items) ? agent2Result.items : [];

            const agent3Payload = {
                model: 'gpt-4-turbo',
                temperature: 0.6,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Você é copywriter de social media. Para cada tema, gere legenda final com CTA e hashtags. Responda apenas JSON.'
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            client_name: clientName,
                            month,
                            themes: themes,
                            art_items: artItems
                        })
                    }
                ]
            };
            const agent3Result = await callOpenAiJson(agent3Payload);
            pipelineLog.push({ step: 'copy', ok: true });
            const copyItems = Array.isArray(agent3Result?.items) ? agent3Result.items : [];

            const calendarParams = new URLSearchParams();
            calendarParams.set('select', 'id');
            calendarParams.set('cliente_id', `eq.${clienteId}`);
            calendarParams.set('mes_referencia', `eq.${mesReferencia}`);
            calendarParams.set('order', 'created_at.desc');
            calendarParams.set('limit', '1');
            const existingCalendarRes = await supabaseServiceRest(`/rest/v1/social_calendars?${calendarParams.toString()}`);
            const existingCalendar = Array.isArray(existingCalendarRes.data) ? existingCalendarRes.data[0] : null;
            let calendarId = existingCalendar?.id || null;

            if (calendarId) {
                await supabaseServiceRest(`/rest/v1/social_calendars?id=eq.${calendarId}`, 'PATCH', {
                    status: CALENDAR_STATUS_VALUES.DRAFT,
                    updated_at: new Date().toISOString()
                });
                await supabaseServiceRest(`/rest/v1/social_posts?calendar_id=eq.${calendarId}`, 'DELETE');
            } else {
                const createPayload = {
                    cliente_id: clienteId,
                    tenant_id: tenantId || null,
                    mes_referencia: mesReferencia,
                    status: CALENDAR_STATUS_VALUES.DRAFT,
                    updated_at: new Date().toISOString()
                };
                const createRes = await supabaseServiceRest('/rest/v1/social_calendars', 'POST', createPayload, {
                    Prefer: 'return=representation'
                });
                calendarId = Array.isArray(createRes.data) ? createRes.data[0]?.id : null;
            }

            if (!calendarId) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_criar_calendario' }));
                return;
            }

            const [yearNum, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
            const step = Math.max(1, Math.floor(daysInMonth / postsCount));
            let dayCursor = 1;
            const usedDays = new Set();
            const nextDay = () => {
                while (dayCursor <= daysInMonth && usedDays.has(dayCursor)) {
                    dayCursor += 1;
                }
                if (dayCursor > daysInMonth) dayCursor = daysInMonth;
                usedDays.add(dayCursor);
                const result = dayCursor;
                dayCursor += step;
                return result;
            };

            const postsPayload = themes.slice(0, postsCount).map((theme, index) => {
                const art = artItems[index] || {};
                const copy = copyItems[index] || {};
                const day = nextDay();
                const dateStr = `${month}-${String(day).padStart(2, '0')}`;
                const hashtags = Array.isArray(copy.hashtags) ? copy.hashtags.filter(Boolean) : [];
                return {
                    calendar_id: calendarId,
                    cliente_id: clienteId,
                    tenant_id: tenantId || null,
                    data_agendada: dateStr,
                    hora_agendada: '10:00',
                    tema: theme.tema || art.tema || copy.tema || `Post ${index + 1}`,
                    formato: theme.formato || art.formato || copy.formato || 'estatico',
                    descricao_visual: art.descricao_visual || '',
                    conteudo_roteiro: art.roteiro || art.conteudo_roteiro || '',
                    legenda: copy.legenda || '',
                    legenda_linkedin: copy.legenda_linkedin || null,
                    legenda_tiktok: copy.legenda_tiktok || null,
                    estrategia: theme.objetivo || '',
                    creative_guide: {
                        criativo_brief: art.criativo_brief || '',
                        roteiro: art.roteiro || '',
                        cta: copy.cta || '',
                        hashtags
                    },
                    status: POST_STATUS_VALUES.DRAFT
                };
            });

            const insertPostsRes = await supabaseServiceRest('/rest/v1/social_posts', 'POST', postsPayload, {
                Prefer: 'return=representation'
            });
            const insertedPosts = Array.isArray(insertPostsRes.data) ? insertPostsRes.data : [];

            await supabaseServiceRest(`/rest/v1/social_calendars?id=eq.${calendarId}`, 'PATCH', {
                erro_log: JSON.stringify({ context_used: contextUsed, pipeline_log: pipelineLog }),
                updated_at: new Date().toISOString()
            });

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ calendarId, postsCreated: insertedPosts.length }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/social/improve-copy' && request.method === 'POST') {
        try {
            const apiKey = envVars['OPENAI_API_KEY'];
            if (!apiKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'openai_nao_configurada', message: 'OPENAI_API_KEY não configurada.' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch (parseError) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'invalid_json', message: 'Body inválido. Envie JSON.' }));
                return;
            }

            const post = body?.post || {};
            const hasPost = post && typeof post === 'object';
            if (!hasPost || !String(post.theme || '').trim() || !String(post.format || '').trim()) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'dados_obrigatorios', message: 'Informe post.theme e post.format.' }));
                return;
            }

            const payload = {
                model: body?.model || 'gpt-4-turbo',
                temperature: 0.4,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: IMPROVE_COPY_PROMPT },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            client_insights: body?.client_insights || '',
                            visual_identity: body?.visual_identity || '',
                            seasonal_dates: Array.isArray(body?.seasonal_dates) ? body.seasonal_dates : [],
                            post
                        })
                    }
                ]
            };

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
                response.end(JSON.stringify({ success: false, error: 'openai_response_invalida', message: rawText || 'Resposta inválida da OpenAI.' }));
                return;
            }

            if (!openAiResponse.ok) {
                response.writeHead(openAiResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'openai_error', message: responseJson.error?.message || 'Erro na OpenAI.' }));
                return;
            }

            const content = String(responseJson?.choices?.[0]?.message?.content || '').trim();
            let result = null;
            try {
                result = JSON.parse(content);
            } catch (parseError) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'json_parse_error', message: 'Falha ao interpretar JSON da IA.' }));
                return;
            }

            const hashtags = Array.isArray(result?.hashtags) ? result.hashtags.filter(Boolean) : [];
            if (!String(result?.caption || '').trim() || !String(result?.cta || '').trim()) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'saida_invalida', message: 'Resposta incompleta da IA.' }));
                return;
            }
            if (hashtags.length < 5 || hashtags.length > 12) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'hashtags_invalidas', message: 'Quantidade de hashtags fora do intervalo (5-12).' }));
                return;
            }
            const ctaText = String(result.cta || '').toLowerCase();
            if (ctaText.includes('digite') || ctaText.includes('envie') || ctaText.includes("comente '") || ctaText.includes('comente "')) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'cta_invalido', message: 'CTA inválido para as regras do negócio.' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true, data: { caption: result.caption, cta: result.cta, hashtags } }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, error: 'erro_interno', message: error.message }));
            return;
        }
    }

    if (pathname === '/api/social/change-theme' && request.method === 'POST') {
        try {
            const apiKey = envVars['OPENAI_API_KEY'];
            if (!apiKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'openai_nao_configurada', message: 'OPENAI_API_KEY não configurada.' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch (parseError) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'invalid_json', message: 'Body inválido. Envie JSON.' }));
                return;
            }

            const constraints = body?.constraints || {};
            const hasConstraints = constraints && typeof constraints === 'object';
            if (!hasConstraints || !String(constraints.format || '').trim() || !String(constraints.pillar || '').trim() || !String(constraints.objective || '').trim()) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'dados_obrigatorios', message: 'Informe constraints.format, constraints.pillar e constraints.objective.' }));
                return;
            }

            const payload = {
                model: body?.model || 'gpt-4-turbo',
                temperature: 0.6,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: CHANGE_THEME_PROMPT },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            client_insights: body?.client_insights || '',
                            visual_identity: body?.visual_identity || '',
                            seasonal_dates: Array.isArray(body?.seasonal_dates) ? body.seasonal_dates : [],
                            constraints,
                            post: body?.post || {}
                        })
                    }
                ]
            };

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
                response.end(JSON.stringify({ success: false, error: 'openai_response_invalida', message: rawText || 'Resposta inválida da OpenAI.' }));
                return;
            }

            if (!openAiResponse.ok) {
                response.writeHead(openAiResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'openai_error', message: responseJson.error?.message || 'Erro na OpenAI.' }));
                return;
            }

            const content = String(responseJson?.choices?.[0]?.message?.content || '').trim();
            let result = null;
            try {
                result = JSON.parse(content);
            } catch (parseError) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'json_parse_error', message: 'Falha ao interpretar JSON da IA.' }));
                return;
            }

            const hashtags = Array.isArray(result?.hashtags) ? result.hashtags.filter(Boolean) : [];
            if (!String(result?.theme || '').trim() || !String(result?.hook || '').trim() || !String(result?.structure || '').trim()) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'saida_invalida', message: 'Resposta incompleta da IA.' }));
                return;
            }
            if (hashtags.length < 5 || hashtags.length > 12) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'hashtags_invalidas', message: 'Quantidade de hashtags fora do intervalo (5-12).' }));
                return;
            }
            const ctaText = String(result?.cta || '').toLowerCase();
            if (ctaText.includes('digite') || ctaText.includes('envie') || ctaText.includes("comente '") || ctaText.includes('comente "')) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'cta_invalido', message: 'CTA inválido para as regras do negócio.' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                success: true,
                data: {
                    theme: result.theme,
                    hook: result.hook,
                    structure: result.structure,
                    caption: result.caption,
                    cta: result.cta,
                    hashtags
                }
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, error: 'erro_interno', message: error.message }));
            return;
        }
    }

    if (pathname === '/api/openai/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        return;
    }

    if (pathname === '/api/openai/proxy' && request.method === 'POST') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const apiKey = envVars['OPENAI_API_KEY'];
            const headerRequestId = String(request.headers['x-request-id'] || '').trim();
            let requestId = headerRequestId || crypto.randomUUID();
            let responseSent = false;
            const sendJson = (status, payload) => {
                if (responseSent) return;
                responseSent = true;
                response.writeHead(status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(payload));
            };
            let rawBody = '';
            try {
                rawBody = await readRawBody(request);
            } catch (error) {
                sendJson(500, { error: true, message: 'Body inválido. Envie JSON.', requestId });
                return;
            }
            if (!rawBody || rawBody.trim().length === 0) {
                sendJson(500, { error: true, message: 'Body inválido. Envie JSON.', requestId });
                return;
            }
            let body = null;
            try {
                body = JSON.parse(rawBody);
            } catch (parseError) {
                sendJson(500, { error: true, message: 'Body inválido. Envie JSON.', requestId });
                return;
            }
            const bodyRequestId = String(body?.request_id || '').trim();
            if (!headerRequestId && bodyRequestId) {
                requestId = bodyRequestId;
            }
            const logRequestId = headerRequestId ? ` ${headerRequestId}` : '';
            const timestamp = new Date().toISOString();
            console.log(`[openai/proxy] called${logRequestId} ${timestamp}`);
            if (!Array.isArray(body?.messages) || body.messages.length === 0) {
                sendJson(400, { error: true, message: 'Missing messages', requestId });
                return;
            }
            const openaiAllowedKeys = new Set(['model', 'temperature', 'messages']);
            const metaPayload = {};
            if (body && typeof body === 'object') {
                Object.keys(body).forEach((key) => {
                    if (!openaiAllowedKeys.has(key)) {
                        metaPayload[key] = body[key];
                    }
                });
            }
            console.log(`[openai/proxy][${requestId}] meta`, Object.keys(metaPayload));
            let errorLogContext = null;
            const buildLogTimestamp = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const buildLogLine = (message) => `[${buildLogTimestamp()}] ${message}`;
            const fetchCalendarRow = async () => {
                if (!errorLogContext?.supabaseUrl || !errorLogContext?.serviceRoleKey || !errorLogContext?.clientId || !errorLogContext?.mesReferencia) {
                    return null;
                }
                const params = new URLSearchParams();
                params.set('select', 'id,erro_log,tenant_id,status');
                params.set('cliente_id', `eq.${errorLogContext.clientId}`);
                if (errorLogContext.tenantId) {
                    params.set('tenant_id', `eq.${errorLogContext.tenantId}`);
                }
                params.set('mes_referencia', `eq.${errorLogContext.mesReferencia}`);
                params.set('order', 'created_at.desc');
                params.set('limit', '1');
                const calendarUrl = `${errorLogContext.supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?${params.toString()}`;
                const calendarRes = await fetch(calendarUrl, {
                    method: 'GET',
                    headers: {
                        apikey: errorLogContext.serviceRoleKey,
                        Authorization: `Bearer ${errorLogContext.serviceRoleKey}`
                    }
                });
                const calendarJson = await calendarRes.json().catch(() => null);
                if (!calendarRes.ok) return null;
                return Array.isArray(calendarJson) ? calendarJson[0] : null;
            };
            const fetchCalendarById = async (calendarId) => {
                if (!errorLogContext?.supabaseUrl || !errorLogContext?.serviceRoleKey || !calendarId) return null;
                const params = new URLSearchParams();
                params.set('select', 'id,erro_log,status');
                params.set('id', `eq.${calendarId}`);
                params.set('limit', '1');
                const calendarUrl = `${errorLogContext.supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?${params.toString()}`;
                const calendarRes = await fetch(calendarUrl, {
                    method: 'GET',
                    headers: {
                        apikey: errorLogContext.serviceRoleKey,
                        Authorization: `Bearer ${errorLogContext.serviceRoleKey}`
                    }
                });
                const calendarJson = await calendarRes.json().catch(() => null);
                if (!calendarRes.ok) return null;
                return Array.isArray(calendarJson) ? calendarJson[0] : null;
            };
            const updateCalendarRow = async (calendarId, payload) => {
                if (!errorLogContext?.supabaseUrl || !errorLogContext?.serviceRoleKey || !calendarId) return null;
                const updateRes = await fetch(`${errorLogContext.supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars?id=eq.${calendarId}`, {
                    method: 'PATCH',
                    headers: {
                        apikey: errorLogContext.serviceRoleKey,
                        Authorization: `Bearer ${errorLogContext.serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
                const updateJson = await updateRes.json().catch(() => null);
                if (!updateRes.ok) return null;
                return Array.isArray(updateJson) ? updateJson[0] : null;
            };
            const createCalendarRow = async (payload) => {
                if (!errorLogContext?.supabaseUrl || !errorLogContext?.serviceRoleKey) return null;
                const createRes = await fetch(`${errorLogContext.supabaseUrl.replace(/\/$/, '')}/rest/v1/social_calendars`, {
                    method: 'POST',
                    headers: {
                        apikey: errorLogContext.serviceRoleKey,
                        Authorization: `Bearer ${errorLogContext.serviceRoleKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
                const createJson = await createRes.json().catch(() => null);
                if (!createRes.ok) return null;
                return Array.isArray(createJson) ? createJson[0] : null;
            };
            const ensureCalendarProgress = async () => {
                if (!errorLogContext?.clientId || !errorLogContext?.mesReferencia) return null;
                let calendar = await fetchCalendarRow();
                if (!calendar) {
                    calendar = await createCalendarRow({
                        cliente_id: errorLogContext.clientId,
                        tenant_id: errorLogContext.tenantId,
                        mes_referencia: errorLogContext.mesReferencia,
                        status: CALENDAR_STATUS_VALUES.IN_PRODUCTION,
                        erro_log: null
                    });
                } else {
                    calendar = await updateCalendarRow(calendar.id, {
                        status: CALENDAR_STATUS_VALUES.IN_PRODUCTION,
                        erro_log: null,
                        tenant_id: errorLogContext.tenantId
                    }) || calendar;
                }
                if (calendar?.id) {
                    errorLogContext.calendarId = calendar.id;
                }
                return calendar;
            };
            const appendCalendarLog = async (calendarId, message, options = {}) => {
                if (!calendarId || !message) return;
                const calendar = await fetchCalendarById(calendarId);
                const existingLog = typeof calendar?.erro_log === 'string' ? calendar.erro_log : '';
                const logLine = buildLogLine(message);
                let updatedLog = logLine;
                let parsedLog = null;
                if (existingLog) {
                    try {
                        parsedLog = JSON.parse(existingLog);
                    } catch {
                        parsedLog = null;
                    }
                }
                if (parsedLog && typeof parsedLog === 'object' && parsedLog.generation) {
                    const mergedLog = typeof parsedLog.log === 'string' ? parsedLog.log : '';
                    const nextLog = mergedLog ? `${mergedLog}\n${logLine}` : logLine;
                    parsedLog.log = nextLog.length > 20000 ? nextLog.slice(nextLog.length - 20000) : nextLog;
                    updatedLog = JSON.stringify(parsedLog);
                } else {
                    updatedLog = existingLog ? `${existingLog}\n${logLine}` : logLine;
                    if (updatedLog.length > 20000) {
                        updatedLog = updatedLog.slice(updatedLog.length - 20000);
                    }
                }
                const payload = { erro_log: updatedLog };
                if (options.status) payload.status = options.status;
                await updateCalendarRow(calendarId, payload);
            };
            const updateCalendarProgress = async (calendarId, progressPayload, statusValue = null) => {
                if (!calendarId || !progressPayload) return;
                const payload = {
                    erro_log: JSON.stringify(progressPayload)
                };
                if (statusValue) {
                    payload.status = statusValue;
                }
                await updateCalendarRow(calendarId, payload);
            };
            const fetchCalendarPosts = async (calendarId) => {
                if (!errorLogContext?.supabaseUrl || !errorLogContext?.serviceRoleKey || !calendarId) return [];
                const params = new URLSearchParams();
                params.set('select', 'id,data_agendada,formato,tema');
                params.set('calendar_id', `eq.${calendarId}`);
                params.set('limit', '1000');
                const postsUrl = `${errorLogContext.supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?${params.toString()}`;
                const postsRes = await fetch(postsUrl, {
                    method: 'GET',
                    headers: {
                        apikey: errorLogContext.serviceRoleKey,
                        Authorization: `Bearer ${errorLogContext.serviceRoleKey}`
                    }
                });
                const postsJson = await postsRes.json().catch(() => null);
                if (!postsRes.ok || !Array.isArray(postsJson)) {
                    return [];
                }
                return postsJson;
            };
            const deleteCalendarPosts = async (calendarId) => {
                if (!errorLogContext?.supabaseUrl || !errorLogContext?.serviceRoleKey || !calendarId) return false;
                const deleteUrl = `${errorLogContext.supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?calendar_id=eq.${calendarId}`;
                const deleteRes = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        apikey: errorLogContext.serviceRoleKey,
                        Authorization: `Bearer ${errorLogContext.serviceRoleKey}`,
                        Prefer: 'return=minimal'
                    }
                });
                return deleteRes.ok;
            };
            const insertCalendarPosts = async (calendarId, posts) => {
                if (!calendarId) throw new Error('calendar_id inválido');
                if (!Array.isArray(posts) || posts.length === 0) return [];
                const insertRes = await supabaseServiceRest(
                    '/rest/v1/social_posts',
                    'POST',
                    posts,
                    { Prefer: 'return=representation' }
                );
                if (insertRes.status >= 400) {
                    console.error('[openai-proxy][INSERT social_posts ERROR]', insertRes.data || insertRes.text);
                    if (errorLogContext?.calendarId) {
                        const readable = insertRes.data?.message || insertRes.data?.error || insertRes.text || 'erro_inserir_posts';
                        await appendCalendarLog(errorLogContext.calendarId, `INSERT social_posts ERROR: ${readable}`);
                    }
                    throw new Error(readable);
                }
                const inserted = Array.isArray(insertRes.data) ? insertRes.data : [];
                console.log('[openai-proxy] INSERTED_POSTS', { count: inserted.length || 0 });
                return inserted;
            };
            const sendError = async (errorCode, message, details, extraPayload = null) => {
                console.error(`[openai/proxy][${requestId}]`, { error_code: errorCode, message, details });
                sendJson(500, {
                    error: true,
                    message: message || 'Erro no proxy OpenAI.',
                    requestId,
                    ...(extraPayload && typeof extraPayload === 'object' ? extraPayload : {})
                });
            };

            if (!apiKey) {
                await sendError('OPENAI_KEY_MISSING', 'OPENAI_API_KEY não configurada no backend (.env)');
                return;
            }

            const model = body?.model;
            const finalModel = model || 'gpt-4o-mini';
            const isCalendarMode = Boolean(body?.mode === 'calendar' || body?.__legacy_calendar_mode);
            const asyncCalendarMode = Boolean(body?.__legacy_calendar_mode);
            let calendarContext = null;
            let payload;
            let pendingMemoryUpdate = null;
            let calendarPromptBase = null;
            let includeLinkedin = false;
            let includeTiktok = false;
            let includeMeta = false;
            let forceGeneration = false;
            let tenantId = null;
            let clienteId = body?.client_id || null;
            const mesReferencia = body?.month ? `${body.month}-01` : null;
            console.log(`[openai-proxy][${requestId}] START`, { tenant_id: tenantId, cliente_id: clienteId, mes_referencia: mesReferencia });
            if (isCalendarMode) {
                const resolved = await resolveTenantAndClient(request, response, clienteId);
                if (!resolved) return;
                tenantId = resolved.tenantId;
                clienteId = resolved.clienteId;
                forceGeneration = Boolean(body?.force);
                const postsCount = Number.isFinite(Number(body.posts_count)) && Number(body.posts_count) > 0 ? Number(body.posts_count) : 12;
                const seasonalDates = Array.isArray(body.seasonal_dates) ? body.seasonal_dates : [];
                const platforms = Array.isArray(body.platforms) ? body.platforms : [];
                const normalizedPlatforms = platforms.map((item) => String(item || '').toLowerCase());
                includeLinkedin = normalizedPlatforms.includes('linkedin');
                includeTiktok = normalizedPlatforms.includes('tiktok');
                includeMeta = normalizedPlatforms.includes('meta') || normalizedPlatforms.includes('instagram') || normalizedPlatforms.includes('facebook');
                const visualIdentity = String(body.visual_identity || '').trim();
                const clientName = String(body.client_name || '').trim();
                const niche = String(body.niche || 'Geral').trim();
                const month = String(body.month || '').trim();
                const contextLink = String(body.context_link || '').trim();
                const clientId = clienteId;
                const weekContext = body?.week_context && typeof body.week_context === 'object' ? body.week_context : null;
                const weekSlots = Array.isArray(weekContext?.slots) ? weekContext.slots : [];
                const postsPerWeek = Number.isFinite(Number(body.posts_per_week)) ? Number(body.posts_per_week) : null;
                const totalWeeks = Number.isFinite(Number(body.total_weeks)) ? Number(body.total_weeks) : null;
                const expectedTotalOverride = Number.isFinite(Number(body.expected_total)) ? Number(body.expected_total) : null;
                calendarContext = { postsCount, month, seasonalDates, platforms, visualIdentity, weekContext, weekSlots, postsPerWeek, totalWeeks, expectedTotalOverride };

                const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
                errorLogContext = {
                    supabaseUrl,
                    serviceRoleKey,
                    clientId,
                    mesReferencia,
                    tenantId
                };
                if (supabaseUrl && serviceRoleKey && clientId && mesReferencia) {
                    const existingCalendar = await fetchCalendarRow();
                    if (existingCalendar?.id) {
                        const existingStatus = String(existingCalendar.status || '').toLowerCase();
                        errorLogContext.calendarId = existingCalendar.id;
                        if ([CALENDAR_STATUS_VALUES.IN_PRODUCTION, 'processando'].includes(existingStatus)) {
                            sendJson(200, {
                                ok: true,
                                request_id: requestId,
                                calendar_id: existingCalendar.id,
                                status: 'processing'
                            });
                            return;
                        }
                        if ([CALENDAR_STATUS_VALUES.AWAITING_APPROVAL, CALENDAR_STATUS_VALUES.APPROVED, CALENDAR_STATUS_VALUES.PUBLISHED, 'aguardando_aprovacao', 'aprovado', 'concluido'].includes(existingStatus) && !forceGeneration) {
                            sendJson(200, {
                                ok: true,
                                request_id: requestId,
                                calendar_id: existingCalendar.id,
                                status: 'exists',
                                message: 'Já existe'
                            });
                            return;
                        }
                    }
                    await ensureCalendarProgress();
                    if (errorLogContext?.calendarId) {
                        await appendCalendarLog(errorLogContext.calendarId, 'Iniciando');
                    }
                }
                let clientProfile = null;
                let historySummary = '';
                if (supabaseUrl && serviceRoleKey && clientId) {
                    if (errorLogContext?.calendarId) {
                        await appendCalendarLog(errorLogContext.calendarId, 'Carregando briefing');
                    }
                    const clientParams = new URLSearchParams();
                    clientParams.set('select', 'id,nome_empresa,nome_fantasia');
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
                    if (clientRes.ok && Array.isArray(clientJson) && clientJson.length) {
                        clientProfile = clientJson[0];
                    }

                    // Carregar Perfil Editorial
                    let editorialProfile = null;
                    const editorialParams = new URLSearchParams();
                    editorialParams.set('select', 'nicho_atuacao,publico_alvo,objetivos,tom_de_voz,restricoes,produto_servico,diferenciais,palavras_proibidas,persona_briefing,client_insights,visual_identity,brand_kit_url,reference_doc_url,ai_memory_summary,ai_memory_updated_at');
                    editorialParams.set('cliente_id', `eq.${clientId}`);
                    editorialParams.set('limit', '1');
                    const editorialUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/client_editorial_profiles?${editorialParams.toString()}`;
                    const editorialRes = await fetch(editorialUrl, {
                        method: 'GET',
                        headers: {
                            apikey: serviceRoleKey,
                            Authorization: `Bearer ${serviceRoleKey}`
                        }
                    });
                    const editorialJson = await editorialRes.json().catch(() => null);
                    if (editorialRes.ok && Array.isArray(editorialJson) && editorialJson.length) {
                        editorialProfile = editorialJson[0];
                    }

                    if (errorLogContext?.calendarId) {
                        await appendCalendarLog(errorLogContext.calendarId, 'Carregando histórico');
                    }
                    const since = new Date();
                    since.setMonth(since.getMonth() - 6);
                    const sinceIso = since.toISOString();
                    const postsParams = new URLSearchParams();
                    postsParams.set('select', 'tema,legenda,legenda_linkedin,legenda_tiktok,data_agendada,status');
                    postsParams.set('cliente_id', `eq.${clientId}`);
                    postsParams.set('data_agendada', `gte.${sinceIso}`);
                    postsParams.set('order', 'data_agendada.desc');
                    postsParams.set('limit', '200');
                    const postsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/social_posts?${postsParams.toString()}`;
                    const postsRes = await fetch(postsUrl, {
                        method: 'GET',
                        headers: {
                            apikey: serviceRoleKey,
                            Authorization: `Bearer ${serviceRoleKey}`
                        }
                    });
                    const postsJson = await postsRes.json().catch(() => null);
                    const posts = Array.isArray(postsJson) ? postsJson : [];
                    if (posts.length) {
                        const themeCounts = {};
                        const captionLengths = [];
                        const ctaWords = {
                            comente: 0,
                            salve: 0,
                            compartilhe: 0,
                            clique: 0,
                            saiba: 0,
                            fale: 0,
                            direct: 0,
                            link: 0
                        };
                        let emojiCount = 0;
                        let captionCount = 0;
                        posts.forEach((post) => {
                            const theme = String(post?.tema || '').trim();
                            if (theme) {
                                const key = theme.toLowerCase();
                                themeCounts[key] = (themeCounts[key] || 0) + 1;
                            }
                            const captions = [post?.legenda, post?.legenda_linkedin, post?.legenda_tiktok].filter(Boolean);
                            captions.forEach((caption) => {
                                const text = String(caption || '').trim();
                                if (!text) return;
                                captionCount += 1;
                                captionLengths.push(text.length);
                                const lower = text.toLowerCase();
                                if (lower.includes('comente')) ctaWords.comente += 1;
                                if (lower.includes('salve')) ctaWords.salve += 1;
                                if (lower.includes('compartilhe')) ctaWords.compartilhe += 1;
                                if (lower.includes('clique')) ctaWords.clique += 1;
                                if (lower.includes('saiba')) ctaWords.saiba += 1;
                                if (lower.includes('fale')) ctaWords.fale += 1;
                                if (lower.includes('direct') || lower.includes('dm')) ctaWords.direct += 1;
                                if (lower.includes('link')) ctaWords.link += 1;
                                emojiCount += (text.match(/[\u{1F300}-\u{1FAD6}]/gu) || []).length;
                            });
                        });
                        const topThemes = Object.entries(themeCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 12)
                            .map(([name]) => name);
                        const avgLength = captionLengths.length
                            ? Math.round(captionLengths.reduce((sum, val) => sum + val, 0) / captionLengths.length)
                            : 0;
                        const topCtas = Object.entries(ctaWords)
                            .filter(([, value]) => value > 0)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([word]) => word);
                        const emojiAverage = captionCount ? (emojiCount / captionCount).toFixed(1) : '0';
                        historySummary = [
                            topThemes.length ? `Temas recentes: ${topThemes.join(', ')}.` : '',
                            avgLength ? `Tamanho médio de legenda: ${avgLength} caracteres.` : '',
                            topCtas.length ? `CTAs mais comuns: ${topCtas.join(', ')}.` : '',
                            `Média de emojis por legenda: ${emojiAverage}.`
                        ].filter(Boolean).join(' ');
                    }
                }

                const personaBriefing = editorialProfile?.persona_briefing || '';
                const brandKitUrl = editorialProfile?.brand_kit_url || '';
                const referenceDocUrl = editorialProfile?.reference_doc_url || '';
                const aiMemorySummary = editorialProfile?.ai_memory_summary || '';
                const aiMemoryUpdatedAt = editorialProfile?.ai_memory_updated_at || '';
                const clientInsights = editorialProfile?.client_insights || '';
                
                // Fallbacks seguros
                const resolvedVisualIdentity = String(editorialProfile?.visual_identity || visualIdentity || '').trim();
                const resolvedClientName = String(clientProfile?.nome_empresa || clientProfile?.nome_fantasia || clientName || '').trim();
                const resolvedNiche = String(editorialProfile?.nicho_atuacao || niche || 'Geral').trim();
                const includeLinkedinValue = includeLinkedin;
                const includeTiktokValue = includeTiktok;
                const includeMetaValue = includeMeta;

                const seasonalText = seasonalDates.length ? `Datas sazonais do mês: ${seasonalDates.join(', ')}.` : 'Não há datas sazonais obrigatórias.';
                const platformsText = platforms.length ? `Plataformas ativas: ${platforms.join(', ')}.` : 'Plataformas ativas: não informadas.';
                const contextText = contextLink ? `Link de contexto: ${contextLink}.` : 'Sem link de contexto.';
                const personaBriefingValue = String(personaBriefing || '').trim();
                const brandKitUrlValue = String(brandKitUrl || '').trim();
                const referenceDocUrlValue = String(referenceDocUrl || '').trim();
                const memorySummaryValue = String(aiMemorySummary || '').trim();
                const clientInsightsValue = String(clientInsights || '').trim();

                const weekInfo = weekContext
                    ? `Semana ${weekContext.week_index || ''} (${weekContext.start_date || ''} a ${weekContext.end_date || ''}).`
                    : '';
                const slotsInfo = weekSlots.length
                    ? `Slots obrigatórios (use exatamente datas e formatos): ${weekSlots.map((slot) => `${slot.date} ${slot.format}`).join(', ')}.`
                    : '';
                const expectedCount = weekSlots.length || postsCount;
                const userPrompt = [
                    `Cliente: ${resolvedClientName || 'Cliente sem nome'}.`,
                    `Nicho: ${resolvedNiche}.`,
                    `Mês: ${month}.`,
                    `Quantidade de posts: ${expectedCount}.`,
                    weekInfo,
                    slotsInfo,
                    platformsText,
                    seasonalText,
                    contextText,
                    personaBriefingValue ? `Persona/Briefing: ${personaBriefingValue}.` : 'Persona/Briefing não informado.',
                    brandKitUrlValue ? `Brand kit (URL): ${brandKitUrlValue}.` : 'Brand kit não informado.',
                    referenceDocUrlValue ? `Documento de referência (URL): ${referenceDocUrlValue}.` : 'Documento de referência não informado.',
                    clientInsightsValue ? `Insights do cliente: ${clientInsightsValue}.` : 'Insights do cliente não informados.',
                    resolvedVisualIdentity ? `Identidade visual: ${resolvedVisualIdentity}.` : 'Identidade visual não informada.',
                    memorySummaryValue ? `Memória anterior: ${memorySummaryValue}.` : 'Sem memória anterior.',
                    historySummary ? `Histórico recente: ${historySummary}.` : 'Sem histórico recente.',
                    includeMetaValue ? 'Captions.meta é a legenda principal para Meta (Instagram/Facebook).' : 'Meta não ativo.',
                    includeLinkedinValue ? 'Captions.linkedin deve existir para LinkedIn (string).' : 'LinkedIn não ativo.',
                    includeTiktokValue ? 'Captions.tiktok deve existir para TikTok (string).' : 'TikTok não ativo.',
                    'É proibido inventar eventos, feiras, webinars, workshops, palestras, datas comemorativas ou notícias que não estejam em seasonal_dates.',
                    'Se seasonal_dates estiver vazio, não mencione nenhuma data/evento.',
                    'Retorne JSON válido seguindo o schema do system prompt.',
                    'Creative_suggestion e detailed_content não podem ser vazios.',
                    'Se format=carousel, detailed_content deve conter Slides 1..N com título, subtítulo, bullets e sugestão visual por slide.',
                    'Se format=reels, detailed_content deve conter Cena 1..N, narração por cena, texto na tela e instruções de gravação/edição.',
                    'Se format=static, detailed_content deve conter título, subtítulo, texto da arte (curto) e composição visual.',
                    'Use exatamente as datas e formatos dos slots quando fornecidos.'
                ].filter(Boolean).join(' ');

                calendarPromptBase = userPrompt;
                payload = {
                    model: finalModel,
                    temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7,
                    messages: [
                        { role: 'system', content: SOCIAL_MEDIA_EXPERT_SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ]
                };
                if (supabaseUrl && serviceRoleKey && clientId && historySummary) {
                    pendingMemoryUpdate = {
                        url: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?id=eq.${clientId}`,
                        payload: {
                            ai_memory_summary: historySummary,
                            ai_memory_updated_at: new Date().toISOString()
                        },
                        serviceRoleKey,
                        clientId
                    };
                }
            } else {
                const temperature = typeof body.temperature === 'number' ? body.temperature : undefined;
                payload = {
                    model: finalModel,
                    messages: body.messages,
                    ...(temperature === undefined ? {} : { temperature })
                };
            }

            const normalizeCalendarFormat = (value) => {
                const raw = String(value || '').toLowerCase();
                if (raw.includes('carrossel') || raw.includes('carousel')) {
                    return 'carousel';
                }
                if (raw.includes('reels')) {
                    return 'reels';
                }
                if (raw.includes('static') || raw.includes('estatic')) {
                    return 'static';
                }
                return '';
            };

            const normalizeCalendarDate = (value) => {
                const raw = String(value || '').trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                    return raw;
                }
                if (raw.includes('T')) {
                    const [datePart] = raw.split('T');
                    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                        return datePart;
                    }
                }
                return '';
            };

            const buildCalendarSlotKey = (slot) => {
                const dateKey = normalizeCalendarDate(slot?.date || slot?.scheduled_date || '');
                const formatKey = normalizeCalendarFormat(slot?.format || slot?.formato || '');
                if (!dateKey || !formatKey) {
                    return '';
                }
                return `${dateKey}|${formatKey}`;
            };

            const extractCalendarCaptions = (post) => ({
                meta: post?.captions?.meta || post?.legenda_instagram || post?.caption || post?.legenda || post?.legenda_sugestao || '',
                linkedin: post?.captions?.linkedin || post?.legenda_linkedin || '',
                tiktok: post?.captions?.tiktok || post?.legenda_tiktok || ''
            });

            const validateCalendarPosts = (posts, options = {}) => {
                if (!Array.isArray(posts)) {
                    return { ok: false, reason: 'posts' };
                }
                const expectedCount = Number.isFinite(Number(options.expectedCount)) ? Number(options.expectedCount) : null;
                if (expectedCount !== null && posts.length !== expectedCount) {
                    return { ok: false, reason: 'count', expectedCount, actualCount: posts.length };
                }
                const requiredSlots = Array.isArray(options.requiredSlots) ? options.requiredSlots : [];
                const requiredSlotKeys = new Set(requiredSlots.map(buildCalendarSlotKey).filter(Boolean));
                const usedSlotKeys = new Set();
                for (const post of posts) {
                    const dateValue = normalizeCalendarDate(post?.scheduled_date || post?.data || post?.date || post?.scheduledDate || '');
                    const formatValue = normalizeCalendarFormat(post?.format || post?.formato || '');
                    if (requiredSlotKeys.size) {
                        const slotKey = `${dateValue}|${formatValue}`;
                        if (!requiredSlotKeys.has(slotKey)) {
                            return { ok: false, reason: 'slot_mismatch', slotKey };
                        }
                        usedSlotKeys.add(slotKey);
                    }
                    const tema = String(post?.tema || post?.theme || '').trim();
                    const creativeSuggestion = String(post?.creative_suggestion || post?.creative_guide?.conceito_visual || '').trim();
                    const detailedContent = String(post?.detailed_content || post?.structure || post?.conteudo_roteiro || '').trim();
                    if (!tema || !creativeSuggestion || !detailedContent) {
                        return { ok: false, reason: 'missing_fields' };
                    }
                    const captions = extractCalendarCaptions(post);
                    if (!String(captions.meta || '').trim()) {
                        return { ok: false, reason: 'missing_meta_caption' };
                    }
                    if (options.requireLinkedin && !String(captions.linkedin || '').trim()) {
                        return { ok: false, reason: 'missing_linkedin_caption' };
                    }
                    if (options.requireTiktok && !String(captions.tiktok || '').trim()) {
                        return { ok: false, reason: 'missing_tiktok_caption' };
                    }
                    if (formatValue === 'carousel' && !/slides?\s*1/i.test(detailedContent)) {
                        return { ok: false, reason: 'carousel_structure' };
                    }
                    if (formatValue === 'reels' && !/cena\s*1/i.test(detailedContent)) {
                        return { ok: false, reason: 'reels_structure' };
                    }
                    if (formatValue === 'static' && (!/t[ií]tulo/i.test(detailedContent) || !/subt[ií]tulo/i.test(detailedContent))) {
                        return { ok: false, reason: 'static_structure' };
                    }
                }
                if (requiredSlotKeys.size && usedSlotKeys.size !== requiredSlotKeys.size) {
                    return { ok: false, reason: 'missing_slots' };
                }
                return { ok: true };
            };

            const callOpenAi = async (payloadOverride, label) => {
                console.log(`[openai-proxy][${requestId}] BEFORE_OPENAI`, { label });
                if (isCalendarMode && errorLogContext?.calendarId) {
                    await appendCalendarLog(errorLogContext.calendarId, 'Chamando OpenAI');
                }
                const openAiController = new AbortController();
                const openAiTimeout = setTimeout(() => openAiController.abort(), 120000);
                let openAiResponse;
                try {
                    openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        signal: openAiController.signal,
                        body: JSON.stringify(payloadOverride)
                    });
                } catch (error) {
                    if (error?.name === 'AbortError') {
                        await sendError('OPENAI_TIMEOUT', 'Tempo limite de 120s ao chamar OpenAI.', error?.stack || null);
                        return null;
                    }
                    throw error;
                } finally {
                    clearTimeout(openAiTimeout);
                }

                const rawText = await openAiResponse.text();
                console.log(`[openai-proxy][${requestId}] AFTER_OPENAI`, { size: rawText.length, label });
                if (isCalendarMode && errorLogContext?.calendarId) {
                    await appendCalendarLog(errorLogContext.calendarId, 'Processando resposta');
                }
                let responseJson = null;
                try {
                    responseJson = JSON.parse(rawText);
                } catch (jsonError) {
                    await sendError('OPENAI_RESPONSE_INVALID', 'Resposta inválida da OpenAI.', rawText || null);
                    return null;
                }

                if (!openAiResponse.ok) {
                    const message = responseJson?.error?.message || responseJson?.error || 'Erro na OpenAI.';
                    await sendError('OPENAI_ERROR', message, responseJson?.error || null);
                    return null;
                }

                return { responseJson, rawText };
            };

            const executeProxy = async () => {
                if (isCalendarMode) {
                    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
                    const rawPostsCount = body?.posts_count;
                    const validatedPostsCount = Number.isFinite(Number(rawPostsCount)) && Number(rawPostsCount) > 0 ? Number(rawPostsCount) : null;
                    const clienteIdValue = calendarContext?.clientId || clienteId || null;
                    const mesReferenciaValue = errorLogContext?.mesReferencia || mesReferencia || null;
                    console.log('[openai-proxy] REQUIRED_FIELDS', {
                        SUPABASE_URL: Boolean(supabaseUrl),
                        SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceRoleKey),
                        tenant_id: tenantId,
                        cliente_id: clienteIdValue,
                        mes_referencia: mesReferenciaValue,
                        posts_count: validatedPostsCount
                    });
                    const missing = [];
                    if (!supabaseUrl) missing.push('SUPABASE_URL');
                    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
                    if (!tenantId) missing.push('tenant_id');
                    if (!clienteIdValue) missing.push('cliente_id');
                    if (!mesReferenciaValue) missing.push('mes_referencia');
                    if (!validatedPostsCount) missing.push('posts_count');
                if (missing.length) {
                        if (errorLogContext) {
                            errorLogContext.supabaseUrl = supabaseUrl;
                            errorLogContext.serviceRoleKey = serviceRoleKey;
                        }
                        if (!errorLogContext?.calendarId && supabaseUrl && serviceRoleKey && clienteIdValue && mesReferenciaValue) {
                            const existingCalendar = await fetchCalendarRow();
                            if (existingCalendar?.id) {
                                errorLogContext.calendarId = existingCalendar.id;
                            }
                        }
                        if (errorLogContext?.calendarId) {
                            await appendCalendarLog(errorLogContext.calendarId, `Falha validação: faltando ${missing.join(', ')}`);
                        }
                        sendJson(400, { error: true, message: 'Campos obrigatórios ausentes', details: { missing } });
                        return;
                    }
                }
                if (isCalendarMode) {
                    console.log(`[openai-proxy][${requestId}] BEFORE_SUPABASE`);
                    if (pendingMemoryUpdate?.url && pendingMemoryUpdate?.serviceRoleKey) {
                        await fetch(pendingMemoryUpdate.url, {
                            method: 'PATCH',
                            headers: {
                                apikey: pendingMemoryUpdate.serviceRoleKey,
                                Authorization: `Bearer ${pendingMemoryUpdate.serviceRoleKey}`,
                                'Content-Type': 'application/json',
                                Prefer: 'return=representation'
                            },
                            body: JSON.stringify(pendingMemoryUpdate.payload)
                        });
                    }
                    console.log(`[openai-proxy][${requestId}] AFTER_SUPABASE`, { client_id: pendingMemoryUpdate?.clientId || null });
                }

                if (!isCalendarMode || !calendarContext) {
                    const initialResponse = await callOpenAi(payload, 'INITIAL');
                    if (!initialResponse) {
                        return;
                    }
                    const responseJson = initialResponse.responseJson;
                    sendJson(200, responseJson);
                    console.log(`[openai-proxy][${requestId}] END_SUCCESS`);
                    return;
                }

                const expectedTotal = calendarContext.expectedTotalOverride
                    ?? (calendarContext.postsPerWeek && calendarContext.totalWeeks ? calendarContext.postsPerWeek * calendarContext.totalWeeks : calendarContext.postsCount);
                const requiredSlots = Array.isArray(calendarContext.weekSlots) ? calendarContext.weekSlots : [];
                const requiredSlotsText = requiredSlots.map((slot) => `${slot.date} ${slot.format}`).join(', ');
                const batchSizeValue = Number(envVars['BATCH_SIZE'] || process.env.BATCH_SIZE);
                const batchSize = Number.isFinite(batchSizeValue) && batchSizeValue > 0 ? batchSizeValue : 3;
                let calendarId = errorLogContext?.calendarId || null;
                const clienteIdValue = calendarContext.clientId || clienteId || null;
                const mesReferenciaValue = errorLogContext?.mesReferencia || null;
                if (!calendarId) {
                    const existingCalendar = await fetchCalendarRow();
                    if (existingCalendar?.id) {
                        calendarId = existingCalendar.id;
                        if (errorLogContext) errorLogContext.calendarId = existingCalendar.id;
                    }
                }
                console.log('[openai-proxy] USING_CALENDAR_ID', { calendar_id: calendarId });

                const normalizeCalendarTime = (value) => {
                    const raw = String(value || '').trim();
                    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
                    if (/^\d{1}:\d{2}$/.test(raw)) return `0${raw}`;
                    return '10:00';
                };

                const mapFormatToDb = (value) => {
                    const raw = String(value || '').toLowerCase();
                    if (raw.includes('reels')) return 'reels';
                    if (raw.includes('carrossel') || raw.includes('carousel')) return 'carrossel';
                    if (raw.includes('static') || raw.includes('estatic')) return 'estatico';
                    return 'estatico';
                };

                const mapPostToInsert = (post) => {
                    const rawDate = post?.scheduled_date || post?.data || post?.date || post?.scheduledDate || '';
                    const rawTime = post?.scheduled_time || post?.hora || post?.hora_agendada || post?.scheduledTime || '';
                    const scheduledDate = normalizeCalendarDate(rawDate);
                    const scheduledTime = normalizeCalendarTime(rawTime);
                    if (!scheduledDate) {
                        return null;
                    }
                    const dataAgendada = `${scheduledDate}T${scheduledTime}:00`;
                    const captions = extractCalendarCaptions(post);
                    const estrategiaParts = [post?.pillar || '', post?.objective || '', post?.week || '', post?.estrategia || ''].filter(Boolean);
                    return {
                        cliente_id: clienteIdValue,
                        tenant_id: tenantId,
                        calendar_id: calendarId,
                        mes_referencia: mesReferenciaValue,
                        data_agendada: dataAgendada,
                        hora_agendada: scheduledTime,
                        formato: mapFormatToDb(post?.format || post?.formato || ''),
                        tema: post?.tema || post?.theme || 'Sem título',
                        conteudo_roteiro: post?.structure || post?.conteudo_roteiro || post?.detailed_content || '',
                        detailed_content: post?.detailed_content || post?.structure || post?.conteudo_roteiro || '',
                        descricao_visual: post?.descricao_visual || '',
                        creative_suggestion: post?.creative_suggestion || post?.creative_guide?.conceito_visual || post?.descricao_visual || '',
                        creative_guide: post?.creative_guide || post?.criativo || null,
                        estrategia: estrategiaParts.join(' | '),
                        legenda: captions.meta || '',
                        legenda_linkedin: captions.linkedin || null,
                        legenda_tiktok: captions.tiktok || null,
                        status: POST_STATUS_VALUES.DRAFT
                    };
                };

                const buildSlotKeysFromPosts = (posts) => {
                    const usedKeys = new Set();
                    for (const post of posts) {
                        const dateValue = normalizeCalendarDate(post?.data_agendada || post?.scheduled_date || post?.data || post?.date || '');
                        const formatValue = normalizeCalendarFormat(post?.formato || post?.format || '');
                        if (dateValue && formatValue) {
                            usedKeys.add(`${dateValue}|${formatValue}`);
                        }
                    }
                    return usedKeys;
                };

                const convertCalendarTextToJson = async (textToConvert, expectedCountOverride) => {
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
                        '      "tema": "...",',
                        '      "hook": "...",',
                        '      "structure": "...",',
                        '      "legenda_instagram": "...",',
                        '      "legenda_linkedin": "...",',
                        '      "legenda_tiktok": "...",',
                        '      "cta": "...",',
                        '      "hashtags": ["...", "..."],',
                        '      "criativo": {}',
                        '    }',
                        '  ]',
                        '}',
                        `Use o mês informado para converter datas DD/MM/AAAA ou DD/MM. Mês atual: ${calendarContext.month}.`,
                        `Retorne EXATAMENTE ${expectedCountOverride} itens em posts.`,
                        'Se algum campo não existir no texto original, preencha com string vazia.',
                        'Texto para converter:',
                        textToConvert
                    ].join('\n');

                    const convertPayload = {
                        model: finalModel,
                        temperature: 0.2,
                        messages: [
                            { role: 'system', content: 'Você converte conteúdo textual em JSON válido, sem explicações.' },
                            { role: 'user', content: converterPrompt }
                        ]
                    };

                    const convertController = new AbortController();
                    const convertTimeout = setTimeout(() => convertController.abort(), 60000);
                    let convertResponse;
                    try {
                        convertResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            signal: convertController.signal,
                            body: JSON.stringify(convertPayload)
                        });
                    } catch (error) {
                        if (error?.name === 'AbortError') {
                            await sendError('OPENAI_TIMEOUT', 'Tempo limite ao converter resposta em JSON.', error?.stack || null);
                            return null;
                        }
                        throw error;
                    } finally {
                        clearTimeout(convertTimeout);
                    }

                    const convertText = await convertResponse.text();
                    let convertJson = null;
                    try {
                        convertJson = JSON.parse(convertText);
                    } catch (convertParseError) {
                        await sendError('OPENAI_RESPONSE_INVALID', 'Falha ao converter resposta para JSON.', convertText || null);
                        return null;
                    }
                    if (!convertResponse.ok) {
                        const convertMessage = convertJson?.error?.message || convertJson?.error || 'Erro na OpenAI ao converter resposta.';
                        await sendError('OPENAI_ERROR', convertMessage, convertJson?.error || null);
                        return null;
                    }

                    const convertedContent = String(convertJson?.choices?.[0]?.message?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
                    let convertedObject = null;
                    try {
                        convertedObject = JSON.parse(convertedContent);
                    } catch (convertedParseError) {
                        await sendError('OPENAI_RESPONSE_INVALID', 'Resposta convertida ainda inválida.', convertedContent || null);
                        return null;
                    }

                    if (Array.isArray(convertedObject)) {
                        convertedObject = {
                            month: calendarContext.month,
                            timezone: 'America/Sao_Paulo',
                            posts: convertedObject
                        };
                    }

                    return convertedObject;
                };

                const parseCalendarJsonFromResponse = async (responseValue, expectedCountOverride) => {
                    const contentRaw = String(responseValue?.choices?.[0]?.message?.content || '').trim();
                    const sanitized = contentRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
                    let parsedJson = null;
                    try {
                        parsedJson = JSON.parse(sanitized);
                    } catch (parseError) {
                        parsedJson = null;
                    }
                    if (Array.isArray(parsedJson)) {
                        const wrappedJson = {
                            month: calendarContext.month,
                            timezone: 'America/Sao_Paulo',
                            posts: parsedJson
                        };
                        responseValue.choices[0].message.content = JSON.stringify(wrappedJson);
                        return wrappedJson;
                    }
                    if (!parsedJson || !Array.isArray(parsedJson.posts)) {
                        const convertedObject = await convertCalendarTextToJson(contentRaw, expectedCountOverride);
                        if (!convertedObject) {
                            return null;
                        }
                        responseValue.choices[0].message.content = JSON.stringify(convertedObject);
                        return convertedObject;
                    }
                    return parsedJson;
                };

                const buildRetryInstruction = (reason, expectedCountOverride, slotsTextOverride) => {
                    const baseInstruction = `Refaça a resposta em JSON válido. Retorne exatamente ${expectedCountOverride} posts.`;
                    const slotInstruction = slotsTextOverride ? `Use exatamente os slots (datas + formatos): ${slotsTextOverride}.` : '';
                    const reasonInstruction = (() => {
                        if (reason === 'missing_fields') return 'Preencha tema, creative_suggestion e detailed_content para todos os posts.';
                        if (reason === 'missing_meta_caption') return 'Preencha captions.meta para todos os posts.';
                        if (reason === 'missing_linkedin_caption') return 'Preencha captions.linkedin para todos os posts.';
                        if (reason === 'missing_tiktok_caption') return 'Preencha captions.tiktok para todos os posts.';
                        if (reason === 'carousel_structure') return 'Se format=carousel, detalhe Slides 1..N com título, subtítulo, bullets e sugestão visual.';
                        if (reason === 'reels_structure') return 'Se format=reels, detalhe Cena 1..N com narração, texto na tela e instruções de gravação.';
                        if (reason === 'static_structure') return 'Se format=static, inclua título, subtítulo, texto curto da arte e composição visual.';
                        return 'Garanta o schema completo e campos obrigatórios.';
                    })();
                    return [baseInstruction, slotInstruction, reasonInstruction].filter(Boolean).join(' ');
                };

                const updateProgress = async (generatedCount, lastBatch, statusValue, lastError) => {
                    if (!calendarId) return;
                    const nextCalendarStatus = statusValue === 'done'
                        ? CALENDAR_STATUS_VALUES.AWAITING_APPROVAL
                        : CALENDAR_STATUS_VALUES.IN_PRODUCTION;
                    await updateCalendarProgress(calendarId, {
                        generation: {
                            expected: expectedTotal,
                            generated: generatedCount,
                            last_batch: lastBatch,
                            status: statusValue,
                            last_error: lastError || null
                        }
                    }, nextCalendarStatus);
                };

                const handleBatchFailure = async (code, message, generatedCount, batchIndex) => {
                    console.log(`[openai-proxy][${requestId}] BATCH_ERROR`, { code, message, expected: expectedTotal, generated: generatedCount, batch: batchIndex });
                    await updateProgress(generatedCount, batchIndex, 'partial', { code, message });
                    await sendError(code, message, null, { code, partial: true, generated: generatedCount, expected: expectedTotal });
                };

                let existingPosts = await fetchCalendarPosts(calendarId);
                if (forceGeneration && existingPosts.length) {
                    await deleteCalendarPosts(calendarId);
                    existingPosts = [];
                }
                let generated = existingPosts.length;
                if (generated >= expectedTotal) {
                    await updateProgress(generated, 0, 'done', null);
                    sendJson(200, { ok: true, request_id: requestId, calendar_id: calendarId, status: 'done', generated, expected: expectedTotal });
                    console.log(`[openai-proxy][${requestId}] END_SUCCESS`);
                    return;
                }

                let missingSlots = requiredSlots;
                if (requiredSlots.length && existingPosts.length) {
                    const usedSlotKeys = buildSlotKeysFromPosts(existingPosts);
                    missingSlots = requiredSlots.filter((slot) => {
                        const slotKey = buildCalendarSlotKey(slot);
                        return slotKey && !usedSlotKeys.has(slotKey);
                    });
                }

                let responseJson = null;
                let batchIndex = 0;
                while (generated < expectedTotal) {
                    batchIndex += 1;
                    const remaining = expectedTotal - generated;
                    const batchSlots = missingSlots.length ? missingSlots.slice(0, batchSize) : [];
                    if (batchSlots.length) {
                        missingSlots = missingSlots.slice(batchSlots.length);
                    }
                    const batchExpected = batchSlots.length ? batchSlots.length : Math.min(batchSize, remaining);
                    if (!batchExpected) {
                        await handleBatchFailure('BATCH_EMPTY', 'Nenhum lote válido para gerar.', generated, batchIndex);
                        return;
                    }
                    console.log(`[openai-proxy][${requestId}] BATCH_START`, { expected: expectedTotal, generated, batch: batchIndex, batch_size: batchExpected });
                    await updateProgress(generated, batchIndex, 'running', null);

                    const batchSlotsText = batchSlots.map((slot) => `${slot.date} ${slot.format}`).join(', ');
                    const batchPrompt = [
                        calendarPromptBase,
                        `Gere SOMENTE ${batchExpected} posts.`,
                        batchSlotsText ? `Use exatamente os slots (datas + formatos): ${batchSlotsText}.` : ''
                    ].filter(Boolean).join(' ');

                    const batchPayload = {
                        ...payload,
                        messages: [
                            { role: 'system', content: SOCIAL_MEDIA_EXPERT_SYSTEM_PROMPT },
                            { role: 'user', content: batchPrompt }
                        ]
                    };

                    const batchResponse = await callOpenAi(batchPayload, `BATCH_${batchIndex}`);
                    if (!batchResponse) {
                        await handleBatchFailure('OPENAI_ERROR', 'Falha ao gerar lote.', generated, batchIndex);
                        return;
                    }

                    responseJson = batchResponse.responseJson;
                    let calendarJson = await parseCalendarJsonFromResponse(responseJson, batchExpected);
                    if (!calendarJson) {
                        await handleBatchFailure('OPENAI_RESPONSE_INVALID', 'Resposta inválida da OpenAI.', generated, batchIndex);
                        return;
                    }

                    try {
                        let validationResult = validateCalendarPosts(calendarJson?.posts, {
                            expectedCount: batchExpected,
                            requiredSlots: batchSlots,
                            requireLinkedin: includeLinkedin,
                            requireTiktok: includeTiktok
                        });
                        if (!validationResult.ok && calendarPromptBase) {
                            const retryPrompt = [calendarPromptBase, buildRetryInstruction(validationResult.reason, batchExpected, batchSlotsText || requiredSlotsText)].filter(Boolean).join(' ');
                            const retryPayload = {
                                ...payload,
                                messages: [
                                    { role: 'system', content: SOCIAL_MEDIA_EXPERT_SYSTEM_PROMPT },
                                    { role: 'user', content: retryPrompt }
                                ]
                            };
                            const retryResponse = await callOpenAi(retryPayload, `RETRY_${batchIndex}`);
                            if (!retryResponse) {
                                await handleBatchFailure('OPENAI_ERROR', 'Falha ao refazer lote.', generated, batchIndex);
                                return;
                            }
                            responseJson = retryResponse.responseJson;
                            calendarJson = await parseCalendarJsonFromResponse(responseJson, batchExpected);
                            if (!calendarJson) {
                                await handleBatchFailure('OPENAI_RESPONSE_INVALID', 'Resposta inválida após retry.', generated, batchIndex);
                                return;
                            }
                            validationResult = validateCalendarPosts(calendarJson.posts, {
                                expectedCount: batchExpected,
                                requiredSlots: batchSlots,
                                requireLinkedin: includeLinkedin,
                                requireTiktok: includeTiktok
                            });
                        }
                        if (!validationResult.ok) {
                            await handleBatchFailure('OPENAI_RESPONSE_INVALID', `Resposta inválida após validação: ${validationResult.reason}`, generated, batchIndex);
                            return;
                        }
                    } catch (error) {
                        console.error('[generateCalendar][validation_error]', error);
                        await handleBatchFailure('OPENAI_RESPONSE_INVALID', error?.message || 'Erro na validação do calendário.', generated, batchIndex);
                        return;
                    }

                    if (calendarJson && Array.isArray(calendarJson.posts)) {
                        for (const post of calendarJson.posts) {
                            const format = post.format || post.formato || '';
                            const theme = post.theme || post.tema || '';
                            const hookValue = String(post.hook || '').trim();
                            const structure = String(post.structure || post.conteudo_roteiro || '').trim();
                            const possibleHook = hookValue || (structure ? structure.split('\n')[0] : '');
                            const caption = post.caption || post.legenda_instagram || post.legenda || post.legenda_sugestao || '';
                            if (post.criativo && !post.creative_guide) {
                                post.creative_guide = post.criativo;
                            }
                            if (post.creative_guide) {
                                continue;
                            }
                            const creativeInput = {
                                platform_targets: calendarContext.platforms || [],
                                format,
                                theme,
                                hook: possibleHook,
                                caption,
                                visual_identity: calendarContext.visualIdentity || '',
                                seasonal_dates: calendarContext.seasonalDates || []
                            };
                            const creativePayload = {
                                model: finalModel,
                                temperature: 0.5,
                                response_format: { type: 'json_object' },
                                messages: [
                                    { role: 'system', content: DESIGNER_SENIOR_CREATIVE_PROMPT },
                                    { role: 'user', content: JSON.stringify(creativeInput) }
                                ]
                            };
                            try {
                                const creativeController = new AbortController();
                                const creativeTimeout = setTimeout(() => creativeController.abort(), 60000);
                                let creativeResponse;
                                try {
                                    creativeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${apiKey}`
                                        },
                                        signal: creativeController.signal,
                                        body: JSON.stringify(creativePayload)
                                    });
                                } catch (error) {
                                    if (error?.name === 'AbortError') {
                                        post.creative_guide = post.creative_guide || null;
                                        continue;
                                    }
                                    throw error;
                                } finally {
                                    clearTimeout(creativeTimeout);
                                }
                                const creativeText = await creativeResponse.text();
                                let creativeJson = null;
                                try {
                                    const parsedCreativeResponse = JSON.parse(creativeText);
                                    const content = String(parsedCreativeResponse?.choices?.[0]?.message?.content || '').trim();
                                    creativeJson = content ? JSON.parse(content) : null;
                                } catch (parseError) {
                                    creativeJson = null;
                                }
                                if (creativeJson && typeof creativeJson === 'object') {
                                    post.creative_guide = creativeJson;
                                }
                            } catch (creativeError) {
                                post.creative_guide = post.creative_guide || null;
                            }
                        }
                    }

                    let invalidDateCount = 0;
                    const postsToInsert = Array.isArray(calendarJson?.posts)
                        ? calendarJson.posts.map((post) => {
                            const mapped = mapPostToInsert(post);
                            if (!mapped) invalidDateCount += 1;
                            return mapped;
                        }).filter(Boolean)
                        : [];
                    if (invalidDateCount) {
                        const message = 'data_agendada ausente em um ou mais posts.';
                        if (errorLogContext?.calendarId) {
                            await appendCalendarLog(errorLogContext.calendarId, message);
                        }
                        sendJson(400, { error: true, message, missing: invalidDateCount });
                        return;
                    }
                    if (!postsToInsert.length) {
                        await handleBatchFailure('BATCH_EMPTY', 'Nenhum post válido para inserir.', generated, batchIndex);
                        return;
                    }
                    if (calendarId) {
                        try {
                            await insertCalendarPosts(calendarId, postsToInsert);
                        } catch (error) {
                            const readable = error?.message || String(error);
                            if (errorLogContext?.calendarId) {
                                await appendCalendarLog(errorLogContext.calendarId, `Falha ao salvar posts: ${readable}`);
                            }
                            sendJson(500, { error: true, message: 'Falha ao salvar posts no banco', details: readable });
                            return;
                        }
                    } else {
                        await handleBatchFailure('CALENDAR_NOT_FOUND', 'Calendário não encontrado para o mês.', generated, batchIndex);
                        return;
                    }

                    existingPosts = await fetchCalendarPosts(calendarId);
                    generated = existingPosts.length;
                    if (requiredSlots.length) {
                        const usedSlotKeys = buildSlotKeysFromPosts(existingPosts);
                        missingSlots = requiredSlots.filter((slot) => {
                            const slotKey = buildCalendarSlotKey(slot);
                            return slotKey && !usedSlotKeys.has(slotKey);
                        });
                    }

                    console.log(`[openai-proxy][${requestId}] BATCH_OK`, { expected: expectedTotal, generated, batch: batchIndex, batch_size: batchExpected });
                    await updateProgress(generated, batchIndex, generated >= expectedTotal ? 'done' : 'running', null);
                }

                if (generated < expectedTotal) {
                    await handleBatchFailure('BATCH_INCOMPLETE', 'Geração incompleta.', generated, batchIndex);
                    return;
                }

                sendJson(200, { ok: true, request_id: requestId, calendar_id: calendarId, status: 'done', generated, expected: expectedTotal });
                console.log(`[openai-proxy][${requestId}] END_SUCCESS`);
            };

            if (isCalendarMode) {
                const calendarId = errorLogContext?.calendarId || null;
                sendJson(200, {
                    ok: true,
                    request_id: requestId,
                    calendar_id: calendarId,
                    status: 'processing'
                });
                setImmediate(() => {
                    executeProxy().catch(async (error) => {
                        // IMPORTANTE: em modo calendário, a resposta já foi enviada (processing).
                        // Se der erro aqui, precisamos marcar o calendário como ERRO no banco,
                        // senão o front fica preso para sempre em "processando".
                        try {
                            if (errorLogContext?.calendarId) {
                                const safeMsg = String(error?.message || "Erro interno no proxy OpenAI.");
                                await appendCalendarLog(
                                    errorLogContext.calendarId,
                                    `ERRO: ${safeMsg}`,
                                    { status: "erro" }
                                );
                            }
                        } catch (logError) {
                            // evita crash do worker por falha de log
                        }

                        await sendError(
                            "INTERNAL_ERROR",
                            error?.message || "Erro interno no proxy OpenAI.",
                            error?.stack || null
                        );
                    });
                });
                return;
            }

            await executeProxy();
            return;
        } catch (error) {
            console.error('[generateCalendar][fatal_error]', error);
            await sendError('INTERNAL_ERROR', error?.message || 'Erro interno no proxy OpenAI.', error?.stack || null);
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

            // 1. Obter tenant_id do usuário autenticado
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const tenantId = authContext.profile?.tenant_id;
            if (!tenantId) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_nao_resolvido' }));
                return;
            }

            // 2. Montar query filtrando por tenant_id e is_demo=false
            const params = new URLSearchParams();
            params.set('select', 'id,nome_fantasia,nome_empresa,link_grupo,is_demo');
            params.set('tenant_id', `eq.${tenantId}`);
            params.set('is_demo', 'eq.false');
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

            // 3. Montar lista final
            const list = Array.isArray(json) ? json : [];
            const clients = list
                .map((cliente) => {
                    const nome = cliente?.nome_fantasia || cliente?.nome_empresa || '';
                    const id = cliente?.id ? String(cliente.id) : '';
                    const link_grupo = cliente?.link_grupo ? String(cliente.link_grupo) : '';
                    return { id, nome, link_grupo };
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

    if (pathname === '/api/logbook/actions' && request.method === 'GET') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const clienteId = String(parsedUrl.query.cliente_id || '').trim();
            if (!clienteId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_id_obrigatorio' }));
                return;
            }

            const moduleFilter = String(parsedUrl.query.module || '').trim();
            const limit = Number(parsedUrl.query.limit || 50);
            const targetLimit = Number.isNaN(limit) || limit <= 0 ? 50 : Math.min(limit, 200);
            const headers = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
            };

            const fetchFromTable = async (table) => {
                const params = new URLSearchParams();
                params.set('select', '*');
                params.set('cliente_id', `eq.${clienteId}`);
                if (moduleFilter) params.set('module', `eq.${moduleFilter}`);
                params.set('order', 'created_at.desc');
                params.set('limit', String(targetLimit));
                const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?${params.toString()}`;
                const supabaseResponse = await fetch(targetUrl, { method: 'GET', headers });
                const json = await supabaseResponse.json().catch(() => null);
                return { ok: supabaseResponse.ok, status: supabaseResponse.status, json };
            };

            let responseData = null;
            const firstAttempt = await fetchFromTable('logbook_actions');
            if (firstAttempt.ok) {
                responseData = Array.isArray(firstAttempt.json) ? firstAttempt.json : [];
            } else {
                const secondAttempt = await fetchFromTable('actions');
                if (!secondAttempt.ok) {
                    response.writeHead(secondAttempt.status, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(secondAttempt.json || { error: 'erro_ao_buscar_diario' }));
                    return;
                }
                responseData = Array.isArray(secondAttempt.json) ? secondAttempt.json : [];
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true, data: responseData }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/logbook/actions' && request.method === 'POST') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const body = JSON.parse(await readRequestBody(request));
            const clienteId = body?.cliente_id ? String(body.cliente_id).trim() : '';
            const moduleValue = body?.module ? String(body.module).trim() : '';

            if (!clienteId || !moduleValue) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_id_e_module_obrigatorios' }));
                return;
            }

            let details = body?.details ?? null;
            if (typeof details === 'string') {
                try {
                    details = JSON.parse(details);
                } catch {
                    details = details.trim();
                }
            }

            const createdAt = body?.created_at ? String(body.created_at) : new Date().toISOString();
            const insertPayload = {
                cliente_id: clienteId,
                module: moduleValue,
                action_type: body?.action_type || null,
                title: body?.title || null,
                details,
                ref_type: body?.ref_type || null,
                ref_id: body?.ref_id || null,
                created_at: createdAt
            };

            const headers = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
            };

            const tryInsert = async (table) => {
                const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
                const supabaseResponse = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(insertPayload)
                });
                const json = await supabaseResponse.json().catch(() => null);
                return { ok: supabaseResponse.ok, status: supabaseResponse.status, json };
            };

            let insertResult = await tryInsert('logbook_actions');
            if (!insertResult.ok) {
                insertResult = await tryInsert('actions');
            }

            if (!insertResult.ok) {
                response.writeHead(insertResult.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(insertResult.json || { error: 'erro_ao_salvar_diario' }));
                return;
            }

            const inserted = Array.isArray(insertResult.json) ? insertResult.json[0] : insertResult.json;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true, data: inserted }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/automation/workflows' && request.method === 'GET') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const clientId = String(parsedUrl.query.client_id || '').trim();
            const params = new URLSearchParams();
            params.set('select', '*');
            if (clientId) params.set('tenant_id', `eq.${clientId}`);
            params.set('order', 'created_at.desc');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/workflows?${params.toString()}`;
            const headers = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
            };

            const supabaseResponse = await fetch(targetUrl, { method: 'GET', headers });
            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_buscar_workflows' }));
                return;
            }

            const workflows = Array.isArray(json) ? json : [];
            const tenantIds = Array.from(new Set(workflows.map((wf) => wf?.tenant_id).filter(Boolean))).map(String);
            const allNumeric = tenantIds.length > 0 && tenantIds.every((id) => /^\d+$/.test(id));
            const allUuid = tenantIds.length > 0 && tenantIds.every((id) => /^[0-9a-fA-F-]{36}$/.test(id));

            let clientMap = {};
            if (tenantIds.length && (allNumeric || allUuid)) {
                const clientParams = new URLSearchParams();
                clientParams.set('select', 'id,nome_fantasia,nome_empresa');
                clientParams.set('id', `in.(${tenantIds.join(',')})`);
                const clientsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?${clientParams.toString()}`;
                const clientsRes = await fetch(clientsUrl, { method: 'GET', headers });
                const clientsJson = await clientsRes.json().catch(() => null);
                if (clientsRes.ok && Array.isArray(clientsJson)) {
                    clientsJson.forEach((cliente) => {
                        const id = cliente?.id ? String(cliente.id) : '';
                        if (id) clientMap[id] = cliente;
                    });
                }
            }

            const workflowsWithClients = workflows.map((wf) => ({
                ...wf,
                clientes: clientMap[String(wf.tenant_id)] || null
            }));

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ workflows: workflowsWithClients }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/social/dashboard' && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;

            const role = String(authContext.profile?.role || '').trim().toLowerCase();
            const isSuperAdmin = role === 'super_admin';
            const scopeParam = String(parsedUrl.query.scope || 'client').trim().toLowerCase();
            const scope = scopeParam === 'agency' && isSuperAdmin ? 'agency' : 'client';
            const clientParamRaw = String(parsedUrl.query.cliente_id || parsedUrl.query.client_id || parsedUrl.query.tenant_id || '').trim();
            const periodParam = String(parsedUrl.query.period || 'last7').trim().toLowerCase();
            const period = ['last7', 'last30', 'month'].includes(periodParam) ? periodParam : 'last7';

            const normalizedClientParam = clientParamRaw && /^\d+$/.test(clientParamRaw) ? clientParamRaw : '';
            if (clientParamRaw && !normalizedClientParam) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_id_invalido' }));
                return;
            }
            let clientId = '';
            const profileClientId = String(authContext.profile?.client_id || '').trim();
            if (/^\d+$/.test(profileClientId)) clientId = profileClientId;
            const profileTenantNumeric = String(authContext.profile?.tenant_id || '').trim();
            if (!clientId && /^\d+$/.test(profileTenantNumeric)) clientId = profileTenantNumeric;
            if (scope === 'client') {
                if (normalizedClientParam) clientId = normalizedClientParam;
                if (!clientId) {
                    response.writeHead(400, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'cliente_id_obrigatorio' }));
                    return;
                }
            } else if (normalizedClientParam) {
                clientId = normalizedClientParam;
            }

            const cacheKey = [authContext.user?.id || '', scope, clientId || '', period].join('|');
            const now = Date.now();
            const cached = socialDashboardCache.get(cacheKey);
            if (cached && now - cached.timestamp < SOCIAL_DASHBOARD_CACHE_TTL) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ ...cached.payload, cached: true }));
                return;
            }

            const today = new Date();
            const endDate = new Date(today);
            const startDate = new Date(today);
            if (period === 'last7') {
                startDate.setDate(startDate.getDate() - 6);
            } else if (period === 'last30') {
                startDate.setDate(startDate.getDate() - 29);
            } else {
                startDate.setDate(1);
            }
            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = endDate.toISOString().slice(0, 10);

            const postsParams = new URLSearchParams();
            postsParams.set('select', 'id,status,data_agendada,data_envio_aprovacao,created_at,social_calendars!inner(cliente_id)');
            if (clientId) {
                postsParams.set('social_calendars.cliente_id', `eq.${clientId}`);
            }
            postsParams.append('data_agendada', `gte.${startStr}`);
            postsParams.append('data_agendada', `lte.${endStr}`);
            const postsRes = await supabaseServiceRest(`/rest/v1/social_posts?${postsParams.toString()}`);
            if (postsRes.status >= 400) {
                response.writeHead(postsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(postsRes.data || { error: 'erro_ao_buscar_posts' }));
                return;
            }
            const posts = Array.isArray(postsRes.data) ? postsRes.data : [];

            const draftPosts = posts.filter((post) => post.status === POST_STATUS_VALUES.DRAFT).length;
            const awaitingApproval = posts.filter((post) => post.status === POST_STATUS_VALUES.READY_FOR_APPROVAL).length;
            const rejectedPosts = posts.filter((post) => post.status === POST_STATUS_VALUES.REJECTED).length;
            const scheduledPosts = posts.filter((post) => post.status === POST_STATUS_VALUES.SCHEDULED).length;
            const publishedPosts = posts.filter((post) => post.status === POST_STATUS_VALUES.PUBLISHED).length;
            const todayStr = today.toISOString().slice(0, 10);
            const publishingToday = posts.filter((post) => post.status === POST_STATUS_VALUES.PUBLISHED && String(post.data_agendada || '').slice(0, 10) === todayStr).length;

            const stuckThreshold = new Date();
            stuckThreshold.setDate(stuckThreshold.getDate() - 3);
            const stuckApproval = posts.filter((post) => {
                if (post.status !== POST_STATUS_VALUES.READY_FOR_APPROVAL) return false;
                const baseDate = post.data_envio_aprovacao || post.created_at;
                if (!baseDate) return false;
                return new Date(baseDate).getTime() <= stuckThreshold.getTime();
            }).length;

            const postIds = posts.map((post) => post.id).filter(Boolean);
            let postsWithUploadedCreative = new Set();
            if (postIds.length) {
                const creativesUploadedParams = new URLSearchParams();
                creativesUploadedParams.set('select', 'post_id');
                creativesUploadedParams.set('status', 'eq.uploaded');
                creativesUploadedParams.set('post_id', `in.(${postIds.join(',')})`);
                if (clientId) {
                    creativesUploadedParams.set('tenant_id', `eq.${clientId}`);
                }
                const uploadedRes = await supabaseServiceRest(`/rest/v1/social_creatives?${creativesUploadedParams.toString()}`);
                if (uploadedRes.status < 400) {
                    const uploaded = Array.isArray(uploadedRes.data) ? uploadedRes.data : [];
                    postsWithUploadedCreative = new Set(uploaded.map((item) => String(item.post_id)));
                }
            }
            const noCreative = postIds.filter((id) => !postsWithUploadedCreative.has(String(id))).length;

            const creativesParams = new URLSearchParams();
            creativesParams.set('select', 'id,status,created_at,tenant_id');
            creativesParams.set('status', 'eq.designing');
            creativesParams.append('created_at', `gte.${startDate.toISOString()}`);
            creativesParams.append('created_at', `lte.${endDate.toISOString()}`);
            if (clientId) {
                creativesParams.set('tenant_id', `eq.${clientId}`);
            }
            const creativesRes = await supabaseServiceRest(`/rest/v1/social_creatives?${creativesParams.toString()}`);
            if (creativesRes.status >= 400) {
                response.writeHead(creativesRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(creativesRes.data || { error: 'erro_ao_buscar_creatives' }));
                return;
            }
            const creatives = Array.isArray(creativesRes.data) ? creativesRes.data : [];
            const designing = creatives.length;

            const requestsParams = new URLSearchParams();
            requestsParams.set('select', 'id,status,created_at,tenant_id');
            requestsParams.set('status', 'in.(requested,needs_revision)');
            requestsParams.append('created_at', `gte.${startDate.toISOString()}`);
            requestsParams.append('created_at', `lte.${endDate.toISOString()}`);
            if (clientId) {
                requestsParams.set('tenant_id', `eq.${clientId}`);
            }
            const requestsRes = await supabaseServiceRest(`/rest/v1/creative_requests?${requestsParams.toString()}`);
            if (requestsRes.status >= 400) {
                response.writeHead(requestsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(requestsRes.data || { error: 'erro_ao_buscar_solicitacoes' }));
                return;
            }
            const pendingRequests = Array.isArray(requestsRes.data) ? requestsRes.data.length : 0;

            const payload = {
                scope,
                period,
                cliente_id: clientId || null,
                range: { start: startStr, end: endStr },
                kpis: {
                    production: {
                        draft_posts: draftPosts,
                        designing,
                        no_creative: noCreative
                    },
                    approval: {
                        awaiting: awaitingApproval,
                        rejected: rejectedPosts,
                        stuck_approval: stuckApproval,
                        creative_requests_pending: pendingRequests
                    },
                    execution: {
                        scheduled: scheduledPosts,
                        published: publishedPosts,
                        publishing_today: publishingToday
                    },
                    post: {
                        reach: 0,
                        engagement_rate: 0
                    }
                }
            };

            socialDashboardCache.set(cacheKey, { timestamp: now, payload });

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/creative-requests' && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const role = String(authContext.profile?.role || '').trim().toLowerCase();
            const isSuperAdmin = role === 'super_admin';
            const scopeParam = String(parsedUrl.query.scope || 'client').trim().toLowerCase();
            const scope = scopeParam === 'agency' && isSuperAdmin ? 'agency' : 'client';
            const statusParam = String(parsedUrl.query.status || '').trim();
            const formatParam = String(parsedUrl.query.format || '').trim();
            const deadlineParam = String(parsedUrl.query.deadline || '').trim();
            const tenantParam = String(parsedUrl.query.tenant_id || '').trim();

            let tenantId = authContext.tenantId;
            if (scope === 'client' && tenantParam) {
                if (!/^\d+$/.test(tenantParam)) {
                    response.writeHead(400, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'tenant_id_invalido' }));
                    return;
                }
                tenantId = tenantParam;
            }
            if (scope === 'client' && (!tenantId || !/^\d+$/.test(String(tenantId)))) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_id_obrigatorio' }));
                return;
            }
            if (scope === 'agency' && tenantParam) {
                if (!/^\d+$/.test(tenantParam)) {
                    response.writeHead(400, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'tenant_id_invalido' }));
                    return;
                }
            }

            const params = new URLSearchParams();
            params.set('select', '*');
            params.set('order', 'created_at.desc');
            if (scope === 'client') {
                params.set('tenant_id', `eq.${tenantId}`);
            } else if (tenantParam) {
                params.set('tenant_id', `eq.${tenantParam}`);
            }
            if (statusParam) params.set('status', `eq.${statusParam}`);
            if (formatParam) params.set('format', `eq.${formatParam}`);

            if (deadlineParam) {
                const today = new Date();
                const todayStr = today.toISOString().slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineParam)) {
                    params.set('deadline_date', `eq.${deadlineParam}`);
                } else if (deadlineParam === 'overdue') {
                    params.set('deadline_date', `lt.${todayStr}`);
                } else if (deadlineParam === 'next7' || deadlineParam === 'next30') {
                    const days = deadlineParam === 'next7' ? 7 : 30;
                    const end = new Date(today);
                    end.setDate(end.getDate() + days);
                    const endStr = end.toISOString().slice(0, 10);
                    params.append('deadline_date', `gte.${todayStr}`);
                    params.append('deadline_date', `lte.${endStr}`);
                }
            }

            const listRes = await supabaseServiceRest(`/rest/v1/creative_requests?${params.toString()}`);
            if (listRes.status >= 400) {
                response.writeHead(listRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(listRes.data || { error: 'erro_ao_buscar_solicitacoes' }));
                return;
            }
            const items = Array.isArray(listRes.data) ? listRes.data : [];
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ items }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname.startsWith('/api/creative-requests/') && request.method === 'GET') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const role = String(authContext.profile?.role || '').trim().toLowerCase();
            const isSuperAdmin = role === 'super_admin';
            const requestId = pathname.split('/').pop();
            if (!requestId || !/^[0-9a-fA-F-]{36}$/.test(requestId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'id_invalido' }));
                return;
            }
            const params = new URLSearchParams();
            params.set('select', '*');
            params.set('id_uuid', `eq.${requestId}`);
            params.set('limit', '1');
            if (!isSuperAdmin) {
                params.set('tenant_id', `eq.${authContext.tenantId}`);
            }
            const detailRes = await supabaseServiceRest(`/rest/v1/creative_requests?${params.toString()}`);
            if (detailRes.status >= 400) {
                response.writeHead(detailRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(detailRes.data || { error: 'erro_ao_buscar_solicitacao' }));
                return;
            }
            const row = Array.isArray(detailRes.data) ? detailRes.data[0] : null;
            if (!row) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'solicitacao_nao_encontrada' }));
                return;
            }
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: row }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/creative-requests' && request.method === 'POST') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const role = String(authContext.profile?.role || '').trim().toLowerCase();
            const isSuperAdmin = role === 'super_admin';

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const tenantParam = String(body?.tenant_id || '').trim();
            let tenantId = String(authContext.tenantId || '').trim();
            if (tenantParam && isSuperAdmin) {
                tenantId = tenantParam;
            }
            if (!/^\d+$/.test(tenantId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_id_invalido' }));
                return;
            }
            if (!isSuperAdmin && tenantParam && String(authContext.tenantId) !== String(tenantParam)) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_sem_permissao' }));
                return;
            }

            const title = String(body?.title || body?.titulo || body?.request_title || '').trim();
            const briefing = String(body?.briefing || body?.descricao || '').trim();
            if (!title || !briefing) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'dados_obrigatorios', message: 'title e briefing são obrigatórios.' }));
                return;
            }

            const payload = {
                tenant_id: Number(tenantId),
                title,
                briefing,
                format: body?.format ? String(body.format).trim() : null,
                deadline_date: body?.deadline_date || body?.deadline || null,
                status: body?.status ? String(body.status).trim() : 'requested',
                requested_by: authContext.user?.id,
                requested_by_name: body?.requested_by_name ? String(body.requested_by_name).trim() : (authContext.user?.email || null),
                delivered_assets: body?.delivered_assets ?? null,
                response_notes: body?.response_notes ?? null
            };

            const createRes = await supabaseServiceRest('/rest/v1/creative_requests', 'POST', payload, {
                Prefer: 'return=representation'
            });
            if (createRes.status >= 400) {
                response.writeHead(createRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(createRes.data || { error: 'erro_ao_criar_solicitacao' }));
                return;
            }
            const created = Array.isArray(createRes.data) ? createRes.data[0] : createRes.data;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: created || null }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname.startsWith('/api/creative-requests/') && request.method === 'PATCH') {
        try {
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const role = String(authContext.profile?.role || '').trim().toLowerCase();
            const allowedRoles = new Set(['super_admin', 'admin', 'gestor', 'social', 'designer']);
            if (!allowedRoles.has(role)) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'sem_permissao' }));
                return;
            }

            const requestId = pathname.split('/').pop();
            if (!requestId || !/^[0-9a-fA-F-]{36}$/.test(requestId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'id_invalido' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_invalido' }));
                return;
            }

            const allowedStatus = new Set(['requested', 'in_progress', 'delivered', 'needs_revision', 'approved', 'canceled']);
            const payload = {};
            if (body?.status) {
                const statusValue = String(body.status).trim();
                if (!allowedStatus.has(statusValue)) {
                    response.writeHead(400, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'status_invalido' }));
                    return;
                }
                payload.status = statusValue;
            }
            if (body?.response_notes !== undefined) {
                payload.response_notes = body.response_notes;
            }
            if (body?.delivered_assets !== undefined) {
                payload.delivered_assets = body.delivered_assets;
            }
            payload.updated_at = new Date().toISOString();

            if (!Object.keys(payload).length) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'payload_vazio' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('id_uuid', `eq.${requestId}`);
            if (role !== 'super_admin') {
                params.set('tenant_id', `eq.${authContext.tenantId}`);
            }

            const updateRes = await supabaseServiceRest(`/rest/v1/creative_requests?${params.toString()}`, 'PATCH', payload, {
                Prefer: 'return=representation'
            });
            if (updateRes.status >= 400) {
                response.writeHead(updateRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(updateRes.data || { error: 'erro_ao_atualizar_solicitacao' }));
                return;
            }
            const updated = Array.isArray(updateRes.data) ? updateRes.data[0] : updateRes.data;
            if (!updated) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'solicitacao_nao_encontrada' }));
                return;
            }
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: updated }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/worklogs' && request.method === 'POST') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_json', message: 'Body inválido. Envie JSON.' }));
                return;
            }

            const clientId = String(body?.client_id || '').trim();
            const moduleValue = String(body?.module || '').trim();
            const actionType = String(body?.action_type || '').trim();
            if (!clientId || !moduleValue || !actionType) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'dados_obrigatorios', message: 'client_id, module e action_type são obrigatórios.' }));
                return;
            }
            if (!['social_media', 'traffic', 'automations'].includes(moduleValue)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'module_invalido', message: 'module deve ser social_media, traffic ou automations.' }));
                return;
            }

            const payload = {
                client_id: clientId,
                module: moduleValue,
                action_type: actionType,
                priority: body?.priority ?? null,
                requested_by_name: body?.requested_by_name ?? null,
                due_date: body?.due_date ?? null,
                creative_link: body?.creative_link ?? null,
                description: body?.description ?? null,
                created_by: userId
            };

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklogs?select=*`;
            const supabaseResponse = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(payload)
            });

            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_criar_worklog' }));
                return;
            }

            const created = Array.isArray(json) ? json[0] : json;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(created));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    if (pathname === '/api/worklogs' && request.method === 'GET') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const clientId = String(parsedUrl.query.client_id || '').trim();
            const moduleValue = String(parsedUrl.query.module || '').trim();
            if (!clientId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'client_id_obrigatorio', message: 'client_id é obrigatório.' }));
                return;
            }
            if (moduleValue && !['social_media', 'traffic', 'automations'].includes(moduleValue)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'module_invalido', message: 'module deve ser social_media, traffic ou automations.' }));
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
            if (moduleValue) params.set('module', `eq.${moduleValue}`);
            params.set('order', 'created_at.desc');

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklogs?${params.toString()}`;
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
                response.end(JSON.stringify(json || { error: 'erro_ao_listar_worklogs' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(Array.isArray(json) ? json : []));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const worklogIdMatch = pathname.match(/^\/api\/worklogs\/([0-9a-fA-F-]{36})$/);
    if (worklogIdMatch && request.method === 'GET') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const worklogId = worklogIdMatch[1];
            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const worklogParams = new URLSearchParams();
            worklogParams.set('select', '*');
            worklogParams.set('id', `eq.${worklogId}`);
            worklogParams.set('limit', '1');
            const worklogUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklogs?${worklogParams.toString()}`;
            const worklogRes = await fetch(worklogUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const worklogJson = await worklogRes.json().catch(() => null);
            if (!worklogRes.ok) {
                response.writeHead(worklogRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(worklogJson || { error: 'erro_ao_buscar_worklog' }));
                return;
            }
            const worklog = Array.isArray(worklogJson) ? worklogJson[0] : worklogJson;
            if (!worklog) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'worklog_nao_encontrado' }));
                return;
            }

            const actionsParams = new URLSearchParams();
            actionsParams.set('select', '*');
            actionsParams.set('worklog_id', `eq.${worklogId}`);
            actionsParams.set('order', 'created_at.asc');
            const actionsUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklog_actions?${actionsParams.toString()}`;
            const actionsRes = await fetch(actionsUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const actionsJson = await actionsRes.json().catch(() => null);
            if (!actionsRes.ok) {
                response.writeHead(actionsRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(actionsJson || { error: 'erro_ao_buscar_actions' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                worklog,
                actions: Array.isArray(actionsJson) ? actionsJson : []
            }));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const worklogActionsMatch = pathname.match(/^\/api\/worklogs\/([0-9a-fA-F-]{36})\/actions$/);
    if (worklogActionsMatch && request.method === 'POST') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const worklogId = worklogActionsMatch[1];
            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const checkParams = new URLSearchParams();
            checkParams.set('select', 'id,status');
            checkParams.set('id', `eq.${worklogId}`);
            checkParams.set('limit', '1');
            const checkUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklogs?${checkParams.toString()}`;
            const checkRes = await fetch(checkUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const checkJson = await checkRes.json().catch(() => null);
            if (!checkRes.ok) {
                response.writeHead(checkRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(checkJson || { error: 'erro_ao_buscar_worklog' }));
                return;
            }
            const worklog = Array.isArray(checkJson) ? checkJson[0] : checkJson;
            if (!worklog) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'worklog_nao_encontrado' }));
                return;
            }
            if (worklog.status !== 'open') {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'worklog_fechado', message: 'Ações só podem ser adicionadas com status open.' }));
                return;
            }

            const rawBody = await readRequestBody(request);
            let body = null;
            try {
                body = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'invalid_json', message: 'Body inválido. Envie JSON.' }));
                return;
            }

            const note = String(body?.note || '').trim();
            if (!note) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nota_obrigatoria', message: 'note é obrigatório.' }));
                return;
            }

            const payload = {
                worklog_id: worklogId,
                note,
                created_by: userId
            };

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklog_actions?select=*`;
            const supabaseResponse = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(payload)
            });

            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_criar_action' }));
                return;
            }

            const created = Array.isArray(json) ? json[0] : json;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(created));
            return;
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: error.message }));
            return;
        }
    }

    const worklogCloseMatch = pathname.match(/^\/api\/worklogs\/([0-9a-fA-F-]{36})\/close$/);
    if (worklogCloseMatch && request.method === 'POST') {
        try {
            const userId = await getSupabaseUserIdFromRequest(request);
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'nao_autorizado' }));
                return;
            }

            const worklogId = worklogCloseMatch[1];
            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const checkParams = new URLSearchParams();
            checkParams.set('select', 'id,status');
            checkParams.set('id', `eq.${worklogId}`);
            checkParams.set('limit', '1');
            const checkUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklogs?${checkParams.toString()}`;
            const checkRes = await fetch(checkUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const checkJson = await checkRes.json().catch(() => null);
            if (!checkRes.ok) {
                response.writeHead(checkRes.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(checkJson || { error: 'erro_ao_buscar_worklog' }));
                return;
            }
            const worklog = Array.isArray(checkJson) ? checkJson[0] : checkJson;
            if (!worklog) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'worklog_nao_encontrado' }));
                return;
            }
            if (worklog.status !== 'open') {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'worklog_fechado', message: 'Worklog já está fechado.' }));
                return;
            }

            const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/worklogs?id=eq.${worklogId}&select=*`;
            const supabaseResponse = await fetch(targetUrl, {
                method: 'PATCH',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({ status: 'done' })
            });

            const json = await supabaseResponse.json().catch(() => null);
            if (!supabaseResponse.ok) {
                response.writeHead(supabaseResponse.status, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(json || { error: 'erro_ao_fechar_worklog' }));
                return;
            }

            const updated = Array.isArray(json) ? json[0] : json;
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(updated));
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
            // Sempre usar o tenant_id do contexto autenticado
            if (authContext?.profile?.tenant_id) clientUpdatePayload.tenant_id = authContext.profile.tenant_id;
            // Nunca permitir alteração de is_demo por usuários comuns
            if ('is_demo' in clientUpdatePayload) delete clientUpdatePayload.is_demo;
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

    if (pathname === '/api/oauth/google/callback' && request.method === 'GET') {
        try {
            const query = parsedUrl.query || {};
            const code = query.code;
            const state = query.state;
            const errorParam = query.error || query.error_reason || query.error_description;

            if (errorParam) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: String(errorParam) }));
                return;
            }

            if (!code) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'codigo_ausente' }));
                return;
            }

            const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
            if (!supabaseUrl || !serviceRoleKey) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const googleClientId = envVars['GOOGLE_CLIENT_ID'] || process.env.GOOGLE_CLIENT_ID || '';
            const googleClientSecret = envVars['GOOGLE_CLIENT_SECRET'] || process.env.GOOGLE_CLIENT_SECRET || '';
            const googleRedirectUri = envVars['GOOGLE_REDIRECT_URI'] || process.env.GOOGLE_REDIRECT_URI || '';

            const payload = parseOAuthStatePayload(state);
            const tenantId = payload?.tenant_id || payload?.tenantId || payload?.client_id || payload?.clientId || null;

            if (!tenantId) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_id_ausente' }));
                return;
            }

            if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
                response.writeHead(501, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'google_oauth_nao_configurado' }));
                return;
            }

            const tokenParams = new URLSearchParams();
            tokenParams.set('client_id', googleClientId);
            tokenParams.set('client_secret', googleClientSecret);
            tokenParams.set('redirect_uri', googleRedirectUri);
            tokenParams.set('code', code);
            tokenParams.set('grant_type', 'authorization_code');

            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString()
            });

            const tokenJson = await tokenRes.json().catch(() => null);
            if (!tokenRes.ok || !tokenJson?.access_token) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: tokenJson?.error || tokenJson?.error_description || 'erro_ao_gerar_token' }));
                return;
            }

            const accessToken = tokenJson.access_token;
            const refreshToken = tokenJson.refresh_token || null;
            const idToken = tokenJson.id_token || null;
            const expiresIn = Number(tokenJson.expires_in);
            const tokenExpiresAt = Number.isFinite(expiresIn)
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null;
            const scope = tokenJson.scope || null;
            const tokenType = tokenJson.token_type || null;

            const upsertPayload = {
                client_id: tenantId,
                platform: 'google',
                status: 'connected',
                access_token: accessToken,
                token_expires_at: tokenExpiresAt,
                meta: {
                    provider: 'google',
                    refresh_token: refreshToken,
                    id_token: idToken,
                    scope,
                    token_type: tokenType
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
                body: JSON.stringify(upsertPayload)
            });

            if (!upsertRes.ok) {
                const errText = await upsertRes.text();
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: errText || 'erro_ao_salvar_conexao' }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true, tenant_id: tenantId }));
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

    if (pathname.startsWith('/api/')) {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'rota_nao_encontrada' }));
        return;
    }

    let resolvedPathname = pathname;
    if (resolvedPathname === '/client' || resolvedPathname === '/client/' || resolvedPathname === '/client/home') {
        resolvedPathname = '/client_dashboard.html';
    } else if (resolvedPathname === '/client/login' || resolvedPathname === '/client/login/') {
        resolvedPathname = '/client_login.html';
    } else if (resolvedPathname === '/client/integrations' || resolvedPathname === '/client/integrations/') {
        resolvedPathname = '/client_integrations.html';
    } else if (resolvedPathname === '/client/approvals/calendar' || resolvedPathname === '/client/approvals/calendar/') {
        resolvedPathname = '/client_approvals_calendar.html';
    } else if (resolvedPathname === '/client/approvals/posts' || resolvedPathname === '/client/approvals/posts/') {
        resolvedPathname = '/client_approvals_posts.html';
    }

    // --- ARQUIVOS ESTÁTICOS ---
    
    // Remove query string para encontrar o arquivo
    let filePath = '.' + resolvedPathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    // [FIX] Demo routes mapping (fixes EISDIR)
    if (resolvedPathname === '/demo' || resolvedPathname === '/demo/') {
        filePath = './demo/index.html';
    }
    if (resolvedPathname === '/demo/cliente' || resolvedPathname === '/demo/cliente/') {
        filePath = './demo/cliente.html';
    }

    const isClientRoute = resolvedPathname === '/client' || resolvedPathname === '/client/' || resolvedPathname.startsWith('/client/');
    if (isClientRoute) {
        if (resolvedPathname === '/client' || resolvedPathname === '/client/' || resolvedPathname === '/client/home') {
            filePath = './client/index.html';
        } else if (!path.extname(filePath)) {
            filePath = `.${resolvedPathname}.html`;
        }
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
};

// Integração do Legado como Middleware do Express
// Isso garante que o Express seja o handler principal, mas rotas antigas continuem funcionando
app.use(async (req, res, next) => {
    // Se o Express já enviou headers (rota tratada), não faz nada
    if (res.headersSent) return next();
    
    // Executa handler legado
    await legacyHandler(req, res);
});

const server = http.createServer(app);

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n=== SERVIDOR VIBECODE INICIADO ===`);
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Backend seguro ativo: API Proxies prontos.`);
    console.log('OpenAI proxy routes enabled at /api/openai/proxy');
    console.log(`Pressione Ctrl+C para parar.\n`);
});

// Mantém o processo Node ativo em ambiente de desenvolvimento
setInterval(() => {}, 10000);
