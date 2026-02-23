const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

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
- Se LinkedIn estiver ativo, incluir legenda_linkedin
- Se TikTok estiver ativo, incluir legenda_tiktok
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
1) Direção de arte (estilo visual): composição, clima, referências genéricas (ex: “clean”, “editorial”, “documental”), ritmo. 
2) Guia passo a passo (como montar no Canva/CapCut): 
   - o que colocar 
   - onde colocar 
   - qual ordem 
   - tamanho relativo (ex: título grande, texto curto) 
3) Checklist de assets (o que o time precisa reunir) 
4) Texto na tela (se vídeo) ou hierarquia por card (se carrossel) 

ADAPTAÇÃO POR FORMATO 
- Se format = Reels/TikTok: 
  - Roteiro por cenas (Cena 1..N) 
  - Enquadramento (close, meio corpo, tela de celular, b-roll) 
  - Texto na tela (curto e forte) 
  - Ritmo (tempo por cena) 
  - Sugestão de transições simples 
- Se format = Carrossel: 
  - Cards 1..8 com: headline, sub, bullets, prova, CTA 
  - Diretriz de layout (margens, respiro, contraste) 
- Se format = Estático: 
  - Layout (título, apoio, elemento visual, CTA discreto) 
  - Variação de 2 opções (A/B) se possível 

SAÍDA (JSON-ONLY) 
Retorne SOMENTE um JSON válido, sem markdown: 

{ 
  "creative_guide": "texto em passos curtos e claros", 
  "assets_checklist": ["...","...","..."], 
  "layout_or_script": "roteiro por cenas OU cards por slide" 
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
    return Buffer.concat(buffers).toString();
};

const getSupabaseConfig = () => {
    const supabaseUrl = envVars['SUPABASE_URL'] || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = envVars['SUPABASE_ANON_KEY'] || process.env.SUPABASE_ANON_KEY || '';
    const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
};

const getSupabaseAdminClient = () => {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
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

const requireAuth = async (request, response) => {
    const token = getBearerToken(request);
    if (!token) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'unauthorized' }));
        return null;
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
    if (!userId) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'unauthorized' }));
        return null;
    }
    return { id: userId, email };
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
            `/rest/v1/social_posts?select=calendar_id,social_calendars!inner(cliente_id)&id=eq.${itemId}&limit=1`
        );
        const postRow = Array.isArray(postRes.data) ? postRes.data[0] : null;
        return postRow?.social_calendars?.cliente_id || postRow?.cliente_id || null;
    }
    if (type === 'calendar') {
        const calendarRes = await supabaseRest(
            request,
            `/rest/v1/social_calendars?select=cliente_id&id=eq.${itemId}&limit=1`
        );
        const calendarRow = Array.isArray(calendarRes.data) ? calendarRes.data[0] : null;
        return calendarRow?.cliente_id || null;
    }
    const postRes = await supabaseRest(
        request,
        `/rest/v1/social_posts?select=calendar_id,social_calendars!inner(cliente_id)&id=eq.${itemId}&limit=1`
    );
    const postRow = Array.isArray(postRes.data) ? postRes.data[0] : null;
    if (postRow?.social_calendars?.cliente_id || postRow?.cliente_id) {
        return postRow?.social_calendars?.cliente_id || postRow?.cliente_id || null;
    }
    const calendarRes = await supabaseRest(
        request,
        `/rest/v1/social_calendars?select=cliente_id&id=eq.${itemId}&limit=1`
    );
    const calendarRow = Array.isArray(calendarRes.data) ? calendarRes.data[0] : null;
    return calendarRow?.cliente_id || null;
};

const getAuthContext = async (request, response) => {
    const user = await requireAuth(request, response);
    if (!user) return null;
    const profile = await getProfileForUser(request, user.id);
    if (!profile) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'profile_not_found' }));
        return null;
    }
    let tenantId = profile.tenant_id;
    if (!tenantId && profile.client_id) {
        tenantId = await resolveTenantIdFromClientId(request, profile.client_id);
    }
    if (!tenantId) {
        console.warn('missing_tenant', { userId: user.id, email: user.email });
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'missing_tenant' }));
        return null;
    }
    return { user, profile, tenantId };
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

            const supabaseAdmin = getSupabaseAdminClient();
            if (!supabaseAdmin) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'service_role_nao_configurada' }));
                return;
            }

            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (error) {
                const message = String(error.message || '').toLowerCase();
                if (error.status === 422 || message.includes('already') || message.includes('existe')) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'user_exists' }));
                    return;
                }
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_criar_usuario' }));
                return;
            }

            const userId = data?.user?.id || null;
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

            const profileUpdate = await supabaseAdmin
                .from('profiles')
                .upsert(profilePayload, { onConflict: 'id' });

            if (profileUpdate.error) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'erro_ao_atualizar_perfil', message: profileUpdate.error.message }));
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
            const { profile, tenantId } = authContext;
            const role = String(profile.role || '').trim().toLowerCase();
            if (!['client', 'admin'].includes(role)) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'acesso_negado' }));
                return;
            }

            const params = new URLSearchParams();
            params.set('select', '*,client_approval_items(*)');
            params.set('client_id', `eq.${tenantId}`);
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

            const token = getBearerToken(request);
            if (!token) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'unauthorized' }));
                return;
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
                return;
            }
            const userId = userJson?.id || userJson?.user?.id || null;
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'unauthorized' }));
                return;
            }

            const profileParams = new URLSearchParams();
            profileParams.set('select', 'tenant_id');
            profileParams.set('id', `eq.${userId}`);
            profileParams.set('limit', '1');
            const profileUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?${profileParams.toString()}`;
            const profileRes = await fetch(profileUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const profileJson = await profileRes.json().catch(() => null);
            if (!profileRes.ok || !Array.isArray(profileJson) || profileJson.length === 0) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_nao_resolvido' }));
                return;
            }

            const tenantId = profileJson[0]?.tenant_id;
            if (!tenantId || !/^\d+$/.test(String(tenantId))) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_nao_resolvido' }));
                return;
            }

            const month = String(parsedUrl.query.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'month_invalido' }));
                return;
            }

            const mesReferencia = `${month}-01`;

            const calendarParams = new URLSearchParams();
            calendarParams.set('select', '*');
            calendarParams.set('cliente_id', `eq.${tenantId}`);
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
                        cliente_id: tenantId,
                        mes_referencia: mesReferencia,
                        status: 'rascunho'
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

            const token = getBearerToken(request);
            if (!token) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'unauthorized' }));
                return;
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
                return;
            }
            const userId = userJson?.id || userJson?.user?.id || null;
            if (!userId) {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'unauthorized' }));
                return;
            }

            const profileParams = new URLSearchParams();
            profileParams.set('select', 'tenant_id');
            profileParams.set('id', `eq.${userId}`);
            profileParams.set('limit', '1');
            const profileUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?${profileParams.toString()}`;
            const profileRes = await fetch(profileUrl, {
                method: 'GET',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`
                }
            });
            const profileJson = await profileRes.json().catch(() => null);
            if (!profileRes.ok || !Array.isArray(profileJson) || profileJson.length === 0) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_nao_resolvido' }));
                return;
            }

            const tenantId = profileJson[0]?.tenant_id;
            if (!tenantId || !/^\d+$/.test(String(tenantId))) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'tenant_nao_resolvido' }));
                return;
            }

            const month = String(parsedUrl.query.month || '').trim();
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'month_invalido' }));
                return;
            }

            const mesReferencia = `${month}-01`;

            const calendarParams = new URLSearchParams();
            calendarParams.set('select', '*');
            calendarParams.set('cliente_id', `eq.${tenantId}`);
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
                        cliente_id: tenantId,
                        mes_referencia: mesReferencia,
                        status: 'rascunho'
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
            const shouldUpdateStatus = currentStatus === 'rascunho';
            const shouldUpdateTokens = !calendar.share_token || !calendar.access_password;

            if (shouldUpdateStatus || shouldUpdateTokens) {
                const updatePayload = {
                    status: shouldUpdateStatus ? 'aguardando_aprovacao' : currentStatus || 'aguardando_aprovacao',
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
            const { tenantId } = authContext;

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
            params.set('select', 'id,tema,legenda,legenda_linkedin,legenda_tiktok,link_criativo,data_agendada,formato,medias,imagem_url,video_url,arquivo_url,social_calendars!inner(cliente_id)');
            params.set('social_calendars.cliente_id', `eq.${tenantId}`);
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
            batchParams.set('client_id', `eq.${tenantId}`);
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
                    client_id: tenantId,
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
                client_id: tenantId,
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

            const clientId = String(parsedUrl.query.client_id || '').trim();
            const month = String(parsedUrl.query.month || '').trim();
            if (!clientId || !/^\d+$/.test(clientId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_invalido' }));
                return;
            }
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
            params.set('select', 'id,tema,legenda,data_agendada,plataformas,formato,status,approval_group_id,feedback_ajuste,data_envio_aprovacao,social_calendars!inner(cliente_id)');
            params.set('social_calendars.cliente_id', `eq.${clientId}`);
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

            const clientId = String(body?.client_id || '').trim();
            const month = String(body?.month || '').trim();
            if (!clientId || !/^\d+$/.test(clientId)) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'cliente_invalido' }));
                return;
            }
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
            params.set('select', 'id,tema,legenda,data_agendada,plataformas,formato,status,approval_group_id,feedback_ajuste,data_envio_aprovacao,social_calendars!inner(cliente_id)');
            params.set('social_calendars.cliente_id', `eq.${clientId}`);
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

            const updatePayload = {
                status: 'pendente_aprovação',
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
                status: 'pendente_aprovação',
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
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId } = authContext;

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
            params.set('select', 'id,tema,legenda,data_agendada,plataformas,formato,status,approval_group_id,feedback_ajuste,data_envio_aprovacao,social_calendars!inner(cliente_id)');
            params.set('social_calendars.cliente_id', `eq.${tenantId}`);
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
            if (statusRaw === 'approved') nextStatus = 'aprovado';
            if (statusRaw === 'needs_adjustment') nextStatus = 'ajuste_solicitado';
            if (!nextStatus) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'status_invalido' }));
                return;
            }
            if (nextStatus === 'ajuste_solicitado' && !reason) {
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
            if (nextStatus === 'ajuste_solicitado') {
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
            const authContext = await getAuthContext(request, response);
            if (!authContext) return;
            const { tenantId } = authContext;

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

            const params = new URLSearchParams();
            params.set('select', 'id,tema,legenda,data_agendada,hora_agendada,plataformas,status,imagem_url,calendar_id,social_calendars!inner(cliente_id)');
            params.set('social_calendars.cliente_id', `eq.${tenantId}`);
            params.set('status', 'in.(pendente_aprovação,pendente_aprovacao,aguardando_aprovacao,pending,pending_approval,pendente)');
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
                const visualIdentity = String(body.visual_identity || '').trim();
                const clientName = String(body.client_name || '').trim();
                const niche = String(body.niche || 'Geral').trim();
                const month = String(body.month || '').trim();
                const contextLink = String(body.context_link || '').trim();
                const clientId = body.client_id || null;
                calendarContext = { postsCount, month, seasonalDates, platforms, visualIdentity };

                const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
                let clientProfile = null;
                let historySummary = '';
                if (supabaseUrl && serviceRoleKey && clientId) {
                    const clientParams = new URLSearchParams();
                    clientParams.set('select', 'id,persona_briefing,brand_kit_url,reference_doc_url,ai_memory_summary,ai_memory_updated_at,client_insights,visual_identity,identidade_visual,nome_empresa,nicho_atuacao');
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

                const seasonalText = seasonalDates.length ? `Datas sazonais do mês: ${seasonalDates.join(', ')}.` : 'Não há datas sazonais obrigatórias.';
                const platformsText = platforms.length ? `Plataformas ativas: ${platforms.join(', ')}.` : 'Plataformas ativas: não informadas.';
                const contextText = contextLink ? `Link de contexto: ${contextLink}.` : 'Sem link de contexto.';
                const personaBriefing = String(clientProfile?.persona_briefing || '').trim();
                const brandKitUrl = String(clientProfile?.brand_kit_url || '').trim();
                const referenceDocUrl = String(clientProfile?.reference_doc_url || '').trim();
                const memorySummary = String(clientProfile?.ai_memory_summary || '').trim();
                const clientInsights = String(clientProfile?.client_insights || '').trim();
                const resolvedVisualIdentity = String(clientProfile?.visual_identity || clientProfile?.identidade_visual || visualIdentity || '').trim();
                const resolvedClientName = String(clientProfile?.nome_empresa || clientName || '').trim();
                const resolvedNiche = String(clientProfile?.nicho_atuacao || niche || 'Geral').trim();
                const includeLinkedin = platforms.some((item) => String(item).toLowerCase() === 'linkedin');
                const includeTiktok = platforms.some((item) => String(item).toLowerCase() === 'tiktok');
                const includeMeta = platforms.some((item) => ['instagram', 'facebook'].includes(String(item).toLowerCase()));

                const userPrompt = [
                    `Cliente: ${resolvedClientName || 'Cliente sem nome'}.`,
                    `Nicho: ${resolvedNiche}.`,
                    `Mês: ${month}.`,
                    `Quantidade de posts: ${postsCount}.`,
                    platformsText,
                    seasonalText,
                    contextText,
                    personaBriefing ? `Persona/Briefing: ${personaBriefing}.` : 'Persona/Briefing não informado.',
                    brandKitUrl ? `Brand kit (URL): ${brandKitUrl}.` : 'Brand kit não informado.',
                    referenceDocUrl ? `Documento de referência (URL): ${referenceDocUrl}.` : 'Documento de referência não informado.',
                    clientInsights ? `Insights do cliente: ${clientInsights}.` : 'Insights do cliente não informados.',
                    resolvedVisualIdentity ? `Identidade visual: ${resolvedVisualIdentity}.` : 'Identidade visual não informada.',
                    memorySummary ? `Memória anterior: ${memorySummary}.` : 'Sem memória anterior.',
                    historySummary ? `Histórico recente: ${historySummary}.` : 'Sem histórico recente.',
                    includeMeta ? 'Use a legenda principal para Meta (Instagram/Facebook).' : 'Meta não ativo.',
                    includeLinkedin ? 'Inclua legenda_linkedin para LinkedIn.' : 'LinkedIn não ativo.',
                    includeTiktok ? 'Inclua legenda_tiktok para TikTok.' : 'TikTok não ativo.',
                    'É proibido inventar eventos, feiras, webinars, workshops, palestras, datas comemorativas ou notícias que não estejam em seasonal_dates.',
                    'Se seasonal_dates estiver vazio, não mencione nenhuma data/evento.',
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

                if (supabaseUrl && serviceRoleKey && clientId && historySummary) {
                    const updateUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/clientes?id=eq.${clientId}`;
                    await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            apikey: serviceRoleKey,
                            Authorization: `Bearer ${serviceRoleKey}`,
                            'Content-Type': 'application/json',
                            Prefer: 'return=representation'
                        },
                        body: JSON.stringify({
                            ai_memory_summary: historySummary,
                            ai_memory_updated_at: new Date().toISOString()
                        })
                    });
                }
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
                    calendarJson = convertedObject;
                }

                if (calendarJson && Array.isArray(calendarJson.posts)) {
                    for (const post of calendarJson.posts) {
                        const format = post.format || post.formato || '';
                        const theme = post.theme || post.tema || '';
                        const hookValue = String(post.hook || '').trim();
                        const structure = String(post.structure || post.conteudo_roteiro || '').trim();
                        const possibleHook = hookValue || (structure ? structure.split('\n')[0] : '');
                        const caption = post.caption || post.legenda || post.legenda_sugestao || '';
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
                            model: body.model || 'gpt-4-turbo',
                            temperature: 0.5,
                            response_format: { type: 'json_object' },
                            messages: [
                                { role: 'system', content: DESIGNER_SENIOR_CREATIVE_PROMPT },
                                { role: 'user', content: JSON.stringify(creativeInput) }
                            ]
                        };
                        try {
                            const creativeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${apiKey}`
                                },
                                body: JSON.stringify(creativePayload)
                            });
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
                    responseJson.choices[0].message.content = JSON.stringify(calendarJson);
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
            params.set('select', 'id,nome_fantasia,nome_empresa,link_grupo');
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

    const isClientRoute = pathname === '/client' || pathname === '/client/' || pathname.startsWith('/client/');
    if (isClientRoute) {
        if (pathname === '/client' || pathname === '/client/') {
            filePath = './client/index.html';
        } else if (!path.extname(filePath)) {
            filePath = `.${pathname}.html`;
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
});

server.listen(PORT, () => {
    console.log(`\n=== SERVIDOR VIBECODE INICIADO ===`);
    console.log(`Local: http://localhost:${PORT}/`);
    console.log(`Backend seguro ativo: API Proxies prontos.`);
    console.log(`Pressione Ctrl+C para parar.\n`);
});
