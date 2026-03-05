// js/social_media_dashboard.js
const HUB_PERIOD_STORAGE_KEY = 'social_hub_selected_period';
const HUB_SCOPE_STORAGE_KEY = 'social_hub_selected_scope';

(function(){
    const isDashboard = document.querySelector('h1')?.textContent?.includes('Social Media Dashboard')
        || document.body?.dataset?.page === 'social-dashboard'
        || document.querySelector('[data-social-dashboard]');

    const storedScope = (() => {
        try {
            const value = localStorage.getItem(HUB_SCOPE_STORAGE_KEY);
            return value === 'agencia' ? 'agencia' : 'cliente';
        } catch {
            return 'cliente';
        }
    })();
    const storedPeriod = (() => {
        try {
            const value = localStorage.getItem(HUB_PERIOD_STORAGE_KEY);
            return value || 'last_30d';
        } catch {
            return 'last_30d';
        }
    })();

    if (!window.operationalHubState) {
        window.operationalHubState = { scope: storedScope, period: storedPeriod };
    } else {
        if (!window.operationalHubState.scope) window.operationalHubState.scope = storedScope;
        if (!window.operationalHubState.period) window.operationalHubState.period = storedPeriod;
    }

    const operationalHubState = window.operationalHubState;
    const getActiveClientId = () => {
        if (typeof window.getActiveClientId === 'function') return window.getActiveClientId();
        return '';
    };

    window.setOperationalScope = function(scope) {
        operationalHubState.scope = scope === 'agencia' ? 'agencia' : 'cliente';
        try {
            localStorage.setItem(HUB_SCOPE_STORAGE_KEY, operationalHubState.scope);
        } catch {}
        if (typeof updateOperationalScopeButtons === 'function') {
            updateOperationalScopeButtons();
        }
        if (typeof loadOperationalDashboard === 'function') {
            loadOperationalDashboard();
        }
    };

    window.showSocialMediaHome = function() {
        if (!isDashboard) return;
        const params = new URLSearchParams(window.location.search || '');
        const tabParam = params.get('tab');
        const hashTab = window.location.hash ? window.location.hash.replace('#', '') : '';
        const targetTab = tabParam || hashTab;
        if (targetTab && typeof window.openSocialMediaTab === 'function') {
            window.openSocialMediaTab(targetTab);
            return;
        }
        const home = document.getElementById('social-media-home');
        const calendarView = document.getElementById('calendar-view');
        const insightsView = document.getElementById('insights-view');
        const logsView = document.getElementById('logs-view');
        const creativeRequestsView = document.getElementById('creative-requests-view');

        if(calendarView) calendarView.classList.add('hidden');
        if(insightsView) insightsView.classList.add('hidden');
        if(logsView) logsView.classList.add('hidden');
        if(creativeRequestsView) creativeRequestsView.classList.add('hidden');
        
        if(calendarView) calendarView.classList.remove('flex');
        if(insightsView) insightsView.classList.remove('flex');
        if(logsView) logsView.classList.remove('flex');
        if(creativeRequestsView) creativeRequestsView.classList.remove('flex');

        if(home) {
            home.classList.remove('hidden');
        }
    };

    if (!isDashboard) {
        window.openSocialMediaTab = window.openSocialMediaTab || function() {};
        return;
    }

// Tab Navigation
window.openSocialMediaTab = window.openSocialMediaTab || function(tabName) {
    // Hide all views
    const home = document.getElementById('social-media-home');
    const calendarView = document.getElementById('calendar-view');
    const insightsView = document.getElementById('insights-view');
    const logsView = document.getElementById('logs-view');
    const creativeRequestsView = document.getElementById('creative-requests-view');
    
    // Floating Button Logic
    const floatingBtn = document.getElementById('btn-floating-add');
    if (floatingBtn) {
        if (tabName === 'calendar') {
            floatingBtn.classList.remove('hidden');
            floatingBtn.classList.add('flex');
        } else {
            floatingBtn.classList.add('hidden');
            floatingBtn.classList.remove('flex');
        }
    }

    if(home) home.classList.add('hidden');
    if(calendarView) calendarView.classList.add('hidden');
    if(insightsView) insightsView.classList.add('hidden');
    if(logsView) logsView.classList.add('hidden');
    if(creativeRequestsView) creativeRequestsView.classList.add('hidden');
    
    if(home) home.classList.remove('flex');
    if(calendarView) calendarView.classList.remove('flex');
    if(insightsView) insightsView.classList.remove('flex');
    if(logsView) logsView.classList.remove('flex');
    if(creativeRequestsView) creativeRequestsView.classList.remove('flex');

    // Show selected view
    if (tabName === 'calendar') {
        if(calendarView) {
            calendarView.classList.remove('hidden');
            calendarView.classList.add('flex');
        }
        // Inicializar calendário quando a aba for aberta
        if (typeof window.initCalendar === 'function') {
            setTimeout(() => {
                window.initCalendar();
            }, 100);
        } else if (window.calendar && typeof window.calendar.render === 'function') {
            setTimeout(() => window.calendar.render(), 100);
        }
        if (typeof window.forceCalendarRerender === 'function') {
            setTimeout(() => window.forceCalendarRerender(), 50);
        }
    } else if (tabName === 'insights') {
        if(insightsView) {
            insightsView.classList.remove('hidden');
            insightsView.classList.add('flex');
        }
        loadInsightsClients(); // Load clients for insights
    } else if (tabName === 'logs') {
        console.log('Abrindo aba Logs...');
        if(logsView) {
            logsView.classList.remove('hidden');
            logsView.classList.add('flex');
        }
        // Load clients for logs filter if not loaded
        loadLogsClients(); 
        if (window.loadWorklogs) {
            console.log('Carregando logs do diário...');
            window.loadWorklogs();
        } else {
            console.error('Função loadWorklogs não encontrada!');
        }
    } else if (tabName === 'creative-requests') {
        if (creativeRequestsView) {
            creativeRequestsView.classList.remove('hidden');
            creativeRequestsView.classList.add('flex');
        }
        initCreativeRequestsView();
        loadCreativeRequests();
    }
};

async function waitForSupabaseReady() {
    if (window.supabaseClient) return true;
    await new Promise((resolve) => {
        window.addEventListener('supabaseReady', resolve, { once: true });
    });
    return !!window.supabaseClient;
}

async function getDashboardAccessToken() {
    const ready = await waitForSupabaseReady();
    if (!ready) return '';
    const sessionResult = await window.supabaseClient?.auth?.getSession?.();
    return sessionResult?.data?.session?.access_token || '';
}

async function getDashboardAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = await getDashboardAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return { headers, token };
}

function getOperationalTenantId() {
    const params = new URLSearchParams(window.location.search || '');
    const queryClientId = params.get('clientId') || params.get('id') || '';
    if (queryClientId) return String(queryClientId);
    const hubClient = String(window.operationalHubState?.clientId || '').trim();
    if (hubClient) return hubClient;
    const hubSelect = document.getElementById('hub-client-select');
    if (hubSelect && hubSelect.value) return String(hubSelect.value);
    if (window.currentClienteId) return String(window.currentClienteId);
    const selectCalendar = document.getElementById('select-cliente');
    if (selectCalendar && selectCalendar.value) return String(selectCalendar.value);
    const selectInsights = document.getElementById('insights-cliente');
    if (selectInsights && selectInsights.value) return String(selectInsights.value);
    return '';
}

function formatPeriodLabel(period) {
    if (period === 'last_30d') return 'Últimos 30 dias';
    if (period === 'last_90d') return 'Últimos 90 dias';
    if (period === 'month') return 'Este mês';
    return 'Últimos 7 dias';
}

function updateOperationalScopeButtons() {
    const btnAgency = document.getElementById('btn-operational-agency');
    const btnClient = document.getElementById('btn-operational-client');
    if (!btnAgency || !btnClient) return;
    if (operationalHubState.scope === 'agencia') {
        btnAgency.className = 'px-4 py-2 rounded-md text-sm font-semibold bg-[var(--color-primary)] text-white';
        btnClient.className = 'px-4 py-2 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900';
    } else {
        btnClient.className = 'px-4 py-2 rounded-md text-sm font-semibold bg-[var(--color-primary)] text-white';
        btnAgency.className = 'px-4 py-2 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900';
    }
}


window.setOperationalPeriod = function(period) {
    let normalized = 'last_7d';
    if (period === '7d' || period === 'last7' || period === 'last_7' || period === 'last_7d') normalized = 'last_7d';
    else if (period === '30d' || period === 'last30' || period === 'last_30' || period === 'last_30d') normalized = 'last_30d';
    else if (period === '90d' || period === 'last90' || period === 'last_90' || period === 'last_90d') normalized = 'last_90d';
    else if (period === 'month') normalized = 'month';
    operationalHubState.period = normalized;
    try {
        if (typeof HUB_PERIOD_STORAGE_KEY === 'undefined') {
            console.error('HUB_PERIOD_STORAGE_KEY não definido');
        }
        const selectedPeriod = normalized;
        localStorage.setItem(HUB_PERIOD_STORAGE_KEY, selectedPeriod);
    } catch {}
    if (typeof window.setActivePeriod === 'function') {
        const mapped = normalized === 'last_90d' ? '90d' : normalized === 'last_7d' ? '7d' : '30d';
        window.setActivePeriod(mapped);
    }
    loadOperationalDashboard();
};

async function loadOperationalDashboard() {
    const statusEl = document.getElementById('operational-status');
    const kpisEl = document.getElementById('operational-kpis');
    if (!statusEl || !kpisEl) return;
    if (typeof window.refreshOperationalHub === 'function') {
        await window.refreshOperationalHub();
        return;
    }
    statusEl.textContent = 'Selecione um cliente para ver o hub operacional.';
    kpisEl.innerHTML = '';
}

// Insights Logic
async function loadInsightsClients() {
    if (typeof window.__debugLoadClientes === 'function') {
        await window.__debugLoadClientes();
        return;
    }
}

const insightsConnectionsCache = {};
const insightsSelectedAssetsCache = {};

async function fetchMetaSelectedAssets(clientId) {
    if (!clientId) return null;
    if (insightsSelectedAssetsCache[clientId]) return insightsSelectedAssetsCache[clientId];
    const res = await fetch(`${window.API_BASE_URL}/api/clients/${encodeURIComponent(clientId)}/assets/selected`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
        insightsSelectedAssetsCache[clientId] = null;
        return null;
    }
    insightsSelectedAssetsCache[clientId] = data.data || null;
    return insightsSelectedAssetsCache[clientId];
}

async function updateInsightsPlatforms(clientId) {
    const platformSelect = document.getElementById('insights-platform');
    const results = document.getElementById('insights-results');
    const btn = document.querySelector('button[onclick="loadInsights()"]');

    if (!platformSelect) return;

    if (!clientId) {
        platformSelect.innerHTML = `
            <option value="instagram" selected>Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="all">Todas (Relatório Unificado)</option>
        `;
        platformSelect.disabled = false;

        if (btn) btn.disabled = false;
        return;
    }

    if (results) results.innerHTML = '';

    const connections = insightsConnectionsCache[clientId] || await window.getConnectedPlatforms(clientId);
    insightsConnectionsCache[clientId] = connections;
    const connected = Array.isArray(connections?.connected) ? connections.connected : [];

    if (!connected.length) {
        platformSelect.innerHTML = `
            <option value="instagram" selected>Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="all">Todas (Relatório Unificado)</option>
        `;
        platformSelect.disabled = false;
        if (btn) btn.disabled = false;
        return;
    }

    const options = [];
    connected.forEach(item => {
        const label = item.platform === 'instagram' ? 'Instagram' : 'Facebook';
        options.push(`<option value="${item.platform}">${label}</option>`);
    });

    if (connected.length > 1) {
        options.push('<option value="all">Todas (Relatório Unificado)</option>');
    }

    platformSelect.innerHTML = options.join('');
    platformSelect.disabled = false;
    if (btn) btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('insights-cliente');
    if (!select) return;
    select.addEventListener('change', (event) => {
        const value = event.target.value;
        if (typeof window.setActiveClientId === 'function') {
            window.setActiveClientId(value);
        }
        if (typeof updateInsightsPlatforms === 'function') {
            updateInsightsPlatforms(value);
        }
        if (typeof window.refreshOperationalHub === 'function') {
            window.refreshOperationalHub();
        }
    });
    const activeId = typeof window.getActiveClientId === 'function' ? window.getActiveClientId() : '';
    if (activeId) {
        select.value = activeId;
    }
    if (select.value && typeof updateInsightsPlatforms === 'function') {
        updateInsightsPlatforms(select.value);
    }
    const platformSelect = document.getElementById('insights-platform');
    if (platformSelect) {
        if (window.socialMediaState?.platform) {
            platformSelect.value = window.socialMediaState.platform;
        }
        platformSelect.addEventListener('change', (event) => {
            if (typeof window.setActivePlatform === 'function') {
                window.setActivePlatform(event.target.value);
            } else if (window.socialMediaState) {
                window.socialMediaState.platform = event.target.value;
            }
            if (typeof window.refreshOperationalHub === 'function') {
                window.refreshOperationalHub();
            }
        });
    }
    const periodSelect = document.getElementById('insights-periodo');
    if (periodSelect) {
        const activePeriod = typeof window.getActivePeriod === 'function' ? window.getActivePeriod() : '30d';
        periodSelect.value = activePeriod === '7d' ? 'last_7_days' : activePeriod === '90d' ? 'last_90_days' : 'last_30_days';
        periodSelect.addEventListener('change', (event) => {
            const raw = event.target.value;
            const normalized = raw === 'last_7_days' ? '7d' : raw === 'last_90_days' ? '90d' : '30d';
            if (typeof window.setActivePeriod === 'function') {
                window.setActivePeriod(normalized);
            }
            if (typeof window.refreshOperationalHub === 'function') {
                window.refreshOperationalHub();
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const hub = document.getElementById('operational-hub');
    if (!hub) return;
    if (typeof HUB_PERIOD_STORAGE_KEY === 'undefined') {
        console.error('HUB_PERIOD_STORAGE_KEY não definido');
    }
    const activePeriod = typeof window.getActivePeriod === 'function' ? window.getActivePeriod() : '30d';
    operationalHubState.period = activePeriod === '90d' ? 'last_90d' : activePeriod === '7d' ? 'last_7d' : 'last_30d';
    const periodSelect = document.getElementById('hub-period-select');
    if (periodSelect) {
        if (operationalHubState.period === 'last_30d') periodSelect.value = '30d';
        else if (operationalHubState.period === 'last_90d') periodSelect.value = '90d';
        else if (operationalHubState.period === 'month') periodSelect.value = 'month';
        else periodSelect.value = '7d';
        periodSelect.addEventListener('change', (event) => {
            window.setOperationalPeriod(event.target.value);
        });
    }
    updateOperationalScopeButtons();
    loadOperationalDashboard();
});

async function loadLogsClients() {
     const select = document.getElementById('filter-cliente');
    if (!select || select.options.length > 1) return; // Already loaded

    try {
        const { data: clients, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_fantasia, nome_empresa')
            .eq('is_demo', false)
            .order('nome_fantasia');

        if (error) throw error;

        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.nome_fantasia || client.nome_empresa;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading clients for logs:', error);
    }
}

// Toggle Custom Date Inputs
window.toggleCustomDate = function() {
    const period = document.getElementById('insights-periodo').value;
    const customContainer = document.getElementById('custom-date-container');
    
    if (period === 'custom') {
        customContainer.classList.remove('hidden');
        customContainer.classList.add('grid');
    } else {
        customContainer.classList.add('hidden');
        customContainer.classList.remove('grid');
    }
}

// Variável global para armazenar dados do relatório
window.currentReportData = {
    clientName: '',
    period: '',
    generatedAt: '',
    platforms: {}, // { instagram: data, facebook: data }
    isUnified: false
};

// Helper function to fetch data for a specific platform
async function fetchPlatformData(platform, clientData, developerToken, since, until, periodFactor) {
    // Seleciona ID baseado na plataforma
    let socialId = '';
    if (platform === 'instagram') {
        socialId = clientData?.instagram_id;
    } else {
        socialId = clientData?.facebook_page_id;
    }

    if (!socialId) {
        throw new Error(`ID do ${platform === 'instagram' ? 'Instagram' : 'Facebook'} não configurado.`);
    }

    let followers = 0;
    let newFollowers = 0; // "Novos Seguidores" no período
    let reach = 0;
    let engagement = 0;
    let growth = 0;
    let topPosts = [];
    let postsCount = 0;
    let apiConnected = false;
    let apiErrorMessage = '';

    // Helper para chamar o Proxy
    const fetchMetaProxy = async (endpoint, tokenOverride = null) => {
        const body = { endpoint };
        if (tokenOverride) body.access_token = tokenOverride;
        
        const res = await fetch(`${window.API_BASE_URL}/api/meta/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return res;
    };

    try {
        // 1. Buscar Seguidores (Perfil)
        let profileFields = 'followers_count,username';
        if (platform === 'facebook') profileFields = 'followers_count,name';

        // VIBECODE: Usando Proxy
        const profileRes = await fetchMetaProxy(`/v18.0/${socialId}?fields=${profileFields}`, developerToken);
        const profileJson = await profileRes.json();
        
        if (profileJson.error) {
            console.warn(`Erro API Perfil (${platform}):`, profileJson.error);
            throw new Error(profileJson.error.message);
        }

        followers = profileJson.followers_count || 0;
        apiConnected = true;

        // 1. Obter Token de Página (Se for Facebook)
        // O developerToken geralmente é um User Token. Para Insights e Posts de Página, precisamos do Page Access Token.
        let targetToken = developerToken;
        const apiVersion = 'v19.0'; // Revertendo para v19.0 (Estável) pois v24.0 retornou erro 400.

        if (platform === 'facebook') {
            if (clientData?.meta_page_access_token) {
                targetToken = clientData.meta_page_access_token;
            } else {
                try {
                    console.log(`[${platform}] Obtendo Page Access Token...`);
                    const tokenRes = await fetchMetaProxy(`/${apiVersion}/${socialId}?fields=access_token`, developerToken);
                    const tokenJson = await tokenRes.json();

                    if (tokenJson.access_token) {
                        targetToken = tokenJson.access_token;
                        console.log(`[${platform}] Page Access Token obtido com sucesso.`);
                    } else {
                        console.warn(`[${platform}] Falha ao obter Page Access Token. Usando User Token (pode falhar para Insights).`, tokenJson);
                    }
                } catch (e) {
                    console.error(`[${platform}] Erro na troca de token:`, e);
                }
            }
        }

        // 2. Buscar Dados do Perfil (Backup para Seguidores Totais)
        try {
            const profileRes = await fetchMetaProxy(`/${apiVersion}/${socialId}?fields=followers_count,fan_count`, targetToken);
            const profileJson = await profileRes.json();
            
            if (profileJson.followers_count) {
                followers = profileJson.followers_count; // Instagram / Facebook Profile
            } else if (profileJson.fan_count) {
                followers = profileJson.fan_count; // Facebook Page Likes
            }
        } catch (e) {
            console.warn(`[${platform}] Erro ao buscar dados de perfil:`, e);
        }

        // 3. Buscar Insights (Separado por Métrica para evitar falha total)
        // Estratégia: Determinar o período correto (day, week, days_28) para obter métricas únicas corretas
        const daysDiff = Math.ceil((until - since) / 86400);
        let apiPeriod = 'day';
        let aggregation = 'sum';

        // Lógica de seleção de período para bater com Meta Business Suite
        // Se o usuário pede 7 dias, usamos 'week' e pegamos o último valor (janela móvel).
        // Se o usuário pede 28/30 dias, usamos 'days_28' e pegamos o último valor.
        if (daysDiff >= 27) { // 28 ou 30 dias
            apiPeriod = 'days_28';
            aggregation = 'last';
        } else if (daysDiff >= 6) { // 7 dias
            apiPeriod = 'week';
            aggregation = 'last';
        } else {
            apiPeriod = 'day';
            aggregation = 'sum';
        }
        
        // OVERRIDE: O usuário solicitou explicitamente usar os parâmetros do Facebook 'day' para métricas específicas
        // REMOVIDO: Para 'Alcance' (Reach), precisamos de period='week' (Last 7d) para ter o valor ÚNICO correto.
        // Vamos controlar o período por métrica individualmente.
        /*
        if (platform === 'facebook') {
            apiPeriod = 'day';
            aggregation = 'sum';
        }
        */

        console.log(`[${platform}] Configuração de Insights: Dias=${daysDiff}, Period=${apiPeriod}, Aggregation=${aggregation}`);

        const fetchMetric = async (metricName, extraParams = '', overridePeriod = null) => {
             try {
                let currentPeriod = overridePeriod || apiPeriod;
                let currentAggregation = aggregation;
                
                // Se forçado para 'day', a agregação deve ser 'sum' (para métricas cumulativas como impressões/adds)
                if (overridePeriod === 'day') {
                    currentAggregation = 'sum';
                }

                // Ajuste: Para períodos móveis (week/days_28), precisamos garantir que a data 'until' pegue o último dado processado.
                // Às vezes o dado de 'hoje' ainda não está pronto, então pegamos uma janela um pouco maior para garantir.
                // FIX: Subtrair 1 dia do 'until' se o período for 'week' ou 'days_28' para evitar erro de dados incompletos
                let adjustUntil = until;
                if (currentPeriod === 'week' || currentPeriod === 'days_28') {
                     adjustUntil = until - 86400; // Voltar 1 dia
                }

                // VIBECODE: Usando Proxy
                const res = await fetchMetaProxy(`/${apiVersion}/${socialId}/insights?metric=${metricName}&period=${currentPeriod}&since=${since}&until=${adjustUntil}${extraParams}`, targetToken);
                const json = await res.json();
                
                if (json.error) {
                    // Se falhar com period=week/days_28 (ex: métrica não suporta), tentamos fallback para day/sum
                    if (currentPeriod !== 'day') {
                        console.warn(`[${platform}] Falha com period=${currentPeriod}, tentando fallback para day...`);
                        const fallbackRes = await fetchMetaProxy(`/${apiVersion}/${socialId}/insights?metric=${metricName}&period=day&since=${since}&until=${until}${extraParams}`, targetToken);
                        const fallbackJson = await fallbackRes.json();
                        if (!fallbackJson.error && fallbackJson.data) {
                            return { data: fallbackJson.data[0], aggregation: 'sum' }; // Força sum no fallback
                        }
                    }
                    console.warn(`[${platform}] Erro na métrica ${metricName}:`, json.error.message);
                    return null;
                }
                return { data: json.data && json.data[0] ? json.data[0] : null, aggregation: currentAggregation };
             } catch (e) {
                 console.error(`[${platform}] Exceção na métrica ${metricName}:`, e);
                 return null;
             }
        };

        let reachDataObj = null;
        let engagementDataObj = null;
        let followersDataObj = null;
        let totalEngagements = 0;

        if (platform === 'facebook') {
            // Request 1: Alcance (Reach)
            // FIX: Usar 'page_impressions_unique' (Reach) com period calculado (week/days_28) para valor Único.
            // Antes usava 'page_impressions' (Total) com sum, o que inflava o valor.
            reachDataObj = await fetchMetric('page_impressions_unique');
            
            // Request 2: Novos Seguidores
            // page_fan_adds (Daily New Fans) - Forçamos 'day' para somar todos os novos fãs do período.
            followersDataObj = await fetchMetric('page_fan_adds', '', 'day'); 
            
            // Se falhar, tentamos page_fans (Total) sem period para pelo menos ter o total.
            if (!followersDataObj) {
                 console.log('Tentando page_fans (Lifetime) fallback...');
                 const pfRes = await fetchMetaProxy(`/${apiVersion}/${socialId}/insights?metric=page_fans&period=lifetime&since=${since}&until=${until}`, targetToken);
                 const pfJson = await pfRes.json();
                 if (pfJson.data && pfJson.data[0]) {
                     followersDataObj = { data: pfJson.data[0], aggregation: 'last' };
                 }
            }

            // Request 3: Engajamento
            // page_engaged_users (Pessoas Engajadas). 
            // Para manter consistência de volume ("Interações"), somamos os usuários engajados por dia.
            // Se quiséssemos alcance engajado único, não usariamos override.
            engagementDataObj = await fetchMetric('page_engaged_users', '', 'day');
        } else if (platform === 'instagram') {
            // Request 1: Alcance
            // 'reach' suporta week/days_28, então usa o default (last).
            reachDataObj = await fetchMetric('reach');
            
            // Request 2: Engajamento
            // total_interactions geralmente é day. Forçamos 'day' para garantir soma.
            engagementDataObj = await fetchMetric('total_interactions', '&metric_type=total_value', 'day');
            
            // Request 3: Novos Seguidores
            // follower_count do insights é total, não novos. 
            // Para novos, precisamos de 'follower_gains' (não disponível na API básica) ou calcular diff (impossível sem histórico).
            // Usamos follower_count profile profile como total.
        }

        // Processar Dados Helper
        const processMetricValue = (dataObj, metricType = 'sum') => {
            if (!dataObj || !dataObj.data || !dataObj.data.values) return 0;
            const values = dataObj.data.values;
            if (values.length === 0) return 0;

            if (metricType === 'delta') {
                // Para calcular crescimento real (Ex: Seguidores)
                // Pega o último valor e subtrai o primeiro valor do período
                const firstVal = values[0].value || 0;
                const lastVal = values[values.length - 1].value || 0;
                // Se só tiver um dia, o delta é 0 (ou null)
                return Math.max(0, lastVal - firstVal);
            }
            
            if (dataObj.aggregation === 'last' || metricType === 'last') {
                // Pega o último valor válido
                const lastVal = values[values.length - 1].value || 0;
                const penultVal = values.length > 1 ? values[values.length - 2].value || 0 : 0;
                return (lastVal === 0 && penultVal > 0) ? penultVal : lastVal;
            } else {
                // Sum
                return values.reduce((acc, curr) => acc + (curr.value || 0), 0);
            }
        };

        reach = processMetricValue(reachDataObj);
        
        // Engajamento sempre soma
        if (platform === 'instagram' && engagementDataObj && engagementDataObj.aggregation !== 'sum') {
             engagementDataObj.aggregation = 'sum'; 
        }
        
        if (engagementDataObj) {
            totalEngagements = processMetricValue(engagementDataObj);
        }

        // Calcular Novos Seguidores (Facebook)
        if (platform === 'facebook') {
            // Se usou page_fan_adds (Novos Fans Diários), basta somar.
            if (followersDataObj && followersDataObj.data && followersDataObj.data.name === 'page_fan_adds') {
                newFollowers = processMetricValue(followersDataObj, 'sum');
            }
            // Se usou page_fans (Total Lifetime), tentamos delta (se houver histórico) ou 0
            else if (followersDataObj && followersDataObj.data && followersDataObj.data.name === 'page_fans') {
                 // page_fans lifetime geralmente retorna apenas 1 ou 2 valores (snapshot). Delta pode ser impreciso.
                 // Mas se tivermos serie temporal (values > 1), usamos delta.
                 newFollowers = processMetricValue(followersDataObj, 'delta');
            } else {
                newFollowers = 0;
            }
        }
        
        // Lógica de mock de crescimento - REMOVIDA
        // growth = Math.floor((Math.random() * 20) * periodFactor); 
        growth = 0; // Se não tiver dados reais, mostramos 0.

        // 3. Buscar Posts para Top Performance e Contagem
        let postsEndpoint = '';
        if (platform === 'instagram') {
            // Adicionado insights.metric(impressions,reach) para ordenação por visualização caso engajamento seja 0
            postsEndpoint = `/${apiVersion}/${socialId}/media?fields=caption,media_type,media_url,timestamp,like_count,comments_count,permalink,thumbnail_url,insights.metric(impressions,reach)&limit=100`;
        } else {
            // Para Facebook, usamos /feed ou /posts.
            // Adicionado insights.metric(post_impressions) para permitir ordenação por visualização (match com Business Suite)
            // Limit reduzido para 25 para evitar timeout com insights
            postsEndpoint = `/${apiVersion}/${socialId}/posts?fields=message,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions)&limit=25`;
        }

        console.log(`[${platform}] Requesting Posts (Proxy):`, postsEndpoint); // DEBUG Log

        // VIBECODE: Usando Proxy
        // Para Instagram usa developerToken (User Token), para Facebook usa targetToken (Page Token)
        const tokenForPosts = (platform === 'instagram') ? developerToken : targetToken;
        const postsRes = await fetchMetaProxy(postsEndpoint, tokenForPosts);
        const postsJson = await postsRes.json();

        if (!postsJson.error && postsJson.data) {
            // Filtrar Posts pelo Período (since, until)
            const allPosts = postsJson.data;
            const postsInPeriod = allPosts.filter(post => {
                const postTime = new Date(post.timestamp || post.created_time).getTime() / 1000;
                return postTime >= since && postTime <= until;
            });

            postsCount = postsInPeriod.length;

            // Processar e Ordenar Posts (apenas do período)
            const processedPosts = postsInPeriod.map(post => {
                let likes = 0;
                let comments = 0;
                let shares = 0;
                let imageUrl = '';
                let caption = '';
                let url = '';
                let impressions = 0; // Visualizações

                if (platform === 'instagram') {
                    likes = post.like_count || 0;
                    comments = post.comments_count || 0;
                    imageUrl = post.thumbnail_url || post.media_url || ''; // thumbnail para video
                    caption = post.caption || '';
                    url = post.permalink || '';
                    
                    // Extrair Insights do Instagram (Impressions)
                    if (post.insights && post.insights.data) {
                        const impData = post.insights.data.find(m => m.name === 'impressions');
                        if (impData && impData.values && impData.values[0]) {
                            impressions = impData.values[0].value || 0;
                        }
                    }
                } else {
                    // Facebook fields might be missing in simplified call, use safer access
                    likes = post.likes?.summary?.total_count || 0;
                    comments = post.comments?.summary?.total_count || 0;
                    shares = post.shares?.count || 0;
                    imageUrl = post.full_picture || 'https://via.placeholder.com/150?text=No+Image'; // Fallback image
                    caption = post.message || 'Sem legenda';
                    url = post.permalink_url || '';
                    
                    // Extrair Insights do Facebook (post_impressions)
                    if (post.insights && post.insights.data) {
                        const impData = post.insights.data.find(m => m.name === 'post_impressions');
                        if (impData && impData.values && impData.values[0]) {
                            impressions = impData.values[0].value || 0;
                        }
                    }
                }

                return {
                    id: post.id,
                    imageUrl,
                    caption,
                    likes,
                    comments,
                    shares,
                    impressions,
                    totalEngagement: likes + comments + shares,
                    url,
                    permalink: url // Alias for compatibility
                };
            });

            // Calculate Total Engagement for Instagram from posts (Proxy)
            // Recalcula APENAS com posts do período se Insights falhar ou for Instagram
            if (platform === 'instagram' || totalEngagements === 0) {
                const postsTotalEngagement = processedPosts.reduce((acc, post) => acc + post.totalEngagement, 0);
                // Se for Facebook e Insights deu 0, usa soma dos posts. Se for Instagram, sempre usa posts.
                if (postsTotalEngagement > 0) {
                    totalEngagements = postsTotalEngagement;
                }
            }

            // Ordenar por Engajamento Total (Descrescente)
            // CRITICAL FIX: Se o Engajamento for igual (ex: 0), usar Impressões/Visualizações como critério de desempate
            // Isso alinha com o Meta Business Suite que ordena por "Relevância (Visualizações)"
            topPosts = processedPosts.sort((a, b) => {
                const engDiff = b.totalEngagement - a.totalEngagement;
                if (engDiff !== 0) return engDiff;
                return b.impressions - a.impressions;
            }).slice(0, 3);
        } else {
             console.warn(`[${platform}] Erro ou sem dados de posts:`, postsJson.error);
             // Partial Mock for Posts if API fails but we have followers
             // DESATIVADO MOCK PARA FACEBOOK POR ENQUANTO PARA NÃO CONFUNDIR O USUÁRIO
             postsCount = 0; 
             topPosts = [];
        }
        
        // Calculate Engagement Rate
        // Fallback: Se alcance (reach) for 0 (erro na API), usamos seguidores como base.
        const denominator = reach > 0 ? reach : followers;
        if (denominator > 0) {
            engagement = ((totalEngagements / denominator) * 100).toFixed(2);
        } else {
            engagement = '0.0';
        }

    } catch (apiError) {
        console.error(`Falha na API Real (${platform}):`, apiError);
        apiErrorMessage = apiError.message;
        // Fallback para Mock apenas se a API falhar totalmente
        if (!apiConnected) {
             // MOCK COMPLETAMENTE DESATIVADO - Se falhar, mostra zeros e erro.
             followers = 0;
             reach = 0;
             engagement = '0.0';
             growth = 0;
             newFollowers = 0;
             postsCount = 0;
             topPosts = [];
        }
    }

    return {
        followers: followers.toLocaleString('pt-BR'),
        newFollowers: newFollowers.toLocaleString('pt-BR'), // Adicionando Novos Seguidores
        reach: reach.toLocaleString('pt-BR'),
        engagement: engagement + '%',
        growth: '+' + growth + '%',
        topPosts: topPosts,
        postsCount: postsCount,
        apiConnected,
        apiErrorMessage,
        socialId
    };
}

window.loadInsights = async function() {
    const clienteId = document.getElementById('insights-cliente').value;
    const platform = document.getElementById('insights-platform') ? document.getElementById('insights-platform').value : 'instagram';
    const periodo = document.getElementById('insights-periodo').value;
    const container = document.getElementById('insights-results');

    if (!clienteId) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div class="bg-blue-50 p-6 rounded-full mb-4">
                    <i class="fas fa-mouse-pointer text-3xl text-[var(--color-primary)]"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">Selecione um Cliente</h3>
                <p class="text-gray-500 max-w-md mx-auto">
                    Escolha um cliente e um período acima, depois clique em "Buscar Métricas" para visualizar os dados.
                </p>
            </div>
        `;
        return;
    }

    const connections = insightsConnectionsCache[clienteId] || await window.getConnectedPlatforms(clienteId);
    insightsConnectionsCache[clienteId] = connections;
    const connectedSet = new Set((connections.connected || []).map(item => item.platform));
    const connectedMeta = ['instagram', 'facebook'].filter(p => connectedSet.has(p));

    if (platform === 'all' && connectedMeta.length === 0) {
        container.innerHTML = window.renderPlatformNotConnectedCTA(clienteId, 'Instagram/Facebook');
        return;
    }

    if (platform !== 'all' && !connectedSet.has(platform)) {
        const label = platform === 'instagram' ? 'Instagram' : 'Facebook';
        container.innerHTML = window.renderPlatformNotConnectedCTA(clienteId, label);
        return;
    }

    const selectedAssets = await fetchMetaSelectedAssets(clienteId);
    const hasMetaPage = !!selectedAssets?.meta_page_id;
    const hasMetaIg = !!selectedAssets?.meta_ig_user_id;

    if (platform === 'facebook' && !hasMetaPage) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div class="bg-blue-50 p-6 rounded-full mb-4">
                    <i class="fas fa-link text-3xl text-[var(--color-primary)]"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">Página não configurada</h3>
                <p class="text-gray-500 max-w-md mx-auto">
                    Conecte e selecione sua Página/Instagram em Integrações.
                </p>
            </div>
        `;
        return;
    }

    if (platform === 'instagram' && !hasMetaIg) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div class="bg-blue-50 p-6 rounded-full mb-4">
                    <i class="fas fa-link text-3xl text-[var(--color-primary)]"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">Instagram não configurado</h3>
                <p class="text-gray-500 max-w-md mx-auto">
                    Conecte e selecione sua Página/Instagram em Integrações.
                </p>
            </div>
        `;
        return;
    }

    if (platform === 'all' && !hasMetaPage && !hasMetaIg) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div class="bg-blue-50 p-6 rounded-full mb-4">
                    <i class="fas fa-link text-3xl text-[var(--color-primary)]"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">Meta não configurado</h3>
                <p class="text-gray-500 max-w-md mx-auto">
                    Conecte e selecione sua Página/Instagram em Integrações.
                </p>
            </div>
        `;
        return;
    }

    // Calcular Datas
    let startDate = new Date();
    let endDate = new Date();
    // Ajuste para bater com Meta Business Suite (Excluir o dia atual para períodos completos)
    // Se hoje é dia 4, "Last 7 Days" deve ser de 28/Jan a 03/Fev (Ontem)
    endDate.setDate(endDate.getDate() - 1); 
    endDate.setHours(23, 59, 59, 999); // Final de ontem
    
    let periodLabel = '';

    if (periodo === 'custom') {
        const startInput = document.getElementById('insights-date-start').value;
        const endInput = document.getElementById('insights-date-end').value;

        if (!startInput || !endInput) {
            alert('Por favor, preencha as datas de início e fim.');
            return;
        }

        startDate = new Date(startInput);
        endDate = new Date(endInput);
        endDate.setHours(23, 59, 59, 999); // Garante fim do dia
        periodLabel = `De ${startDate.toLocaleDateString()} até ${endDate.toLocaleDateString()}`;

        if (startDate > endDate) {
            alert('A data de início não pode ser maior que a data de fim.');
            return;
        }
    } else {
        const days = parseInt(periodo.replace('last_', '').replace('_days', ''));
        // startDate deve ser endDate - days + 1?
        // Meta: "28 Jan - 3 Feb" (7 dias). 
        // Se endDate = 3 Feb. startDate = 3 Feb - 6 days = 28 Jan.
        // My code: startDate.setDate(endDate.getDate() - days + 1);
        const tempStart = new Date(endDate);
        tempStart.setDate(endDate.getDate() - days + 1);
        startDate = tempStart;
        startDate.setHours(0, 0, 0, 0); // Inicio do dia
        
        periodLabel = `Últimos ${days} dias (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
    }

    // Calcular diferença em dias para ajustar métricas
    const diffTime = Math.abs(endDate - startDate);
    const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Mínimo 1 dia
    const periodFactor = daysDiff / 30; // Normalizado para 30 dias

    container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-20">
            <i class="fas fa-spinner fa-spin text-4xl text-[var(--color-primary)] mb-4"></i>
            <p class="text-gray-500 animate-pulse">Conectando às APIs (${periodLabel})...</p>
        </div>
    `;

    try {
        // 1. Busca Token Global (Configurações)
        const { data: configData, error: configError } = await window.supabaseClient
            .from('configuracoes')
            .select('value')
            .eq('key', 'facebook_app_token')
            .single();

        // 2. Busca IDs do Cliente
        const { data: clientData, error: clientError } = await window.supabaseClient
            .from('clientes')
            .select('instagram_id, facebook_page_id, nome_fantasia') 
            .eq('id', clienteId)
            .single();

        if (clientError && clientError.code !== 'PGRST116') throw clientError;

        // Validação de Credenciais Básicas
        if (!configData || !configData.value) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                    <div class="bg-yellow-50 p-6 rounded-full mb-4"><i class="fas fa-key text-3xl text-yellow-600"></i></div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">Token Não Configurado</h3>
                    <p class="text-gray-500 max-w-md mx-auto mb-6">Configure o Token de Desenvolvedor nas configurações gerais.</p>
                    <button onclick="window.location.href='configuracoes.html'" class="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg">Ir para Configurações</button>
                </div>
            `;
            return;
        }

        const developerToken = configData.value;
        const since = Math.floor(startDate.getTime() / 1000);
        const until = Math.floor(endDate.getTime() / 1000);

        // Prepare Data Object
        const platformsToFetch = (platform === 'all') ? ['instagram', 'facebook'].filter(p => connectedSet.has(p)) : [platform];
        const isUnified = platform === 'all' && platformsToFetch.length > 1;

        const mergedClientData = {
            ...clientData,
            instagram_id: selectedAssets?.meta_ig_user_id || clientData?.instagram_id,
            facebook_page_id: selectedAssets?.meta_page_id || clientData?.facebook_page_id,
            meta_page_access_token: selectedAssets?.meta_page_access_token || null
        };

        window.currentReportData = {
            clientName: clientData?.nome_fantasia || 'Cliente',
            period: periodLabel,
            generatedAt: new Date().toLocaleDateString('pt-BR'),
            platforms: {},
            isUnified: isUnified
        };
        let primaryData = null; // Data to show in dashboard (first one)

        for (const p of platformsToFetch) {
            try {
                // Pass full date objects for filtering posts locally if needed, but fetchPlatformData expects timestamps for API
                // We will pass timestamps to fetchPlatformData
                const data = await fetchPlatformData(p, mergedClientData, developerToken, since, until, periodFactor);
                window.currentReportData.platforms[p] = data;
                if (!primaryData && platform !== 'all') primaryData = data; // Keep first one for dashboard display if not unified
            } catch (err) {
                console.error(`Error fetching ${p}:`, err);
            }
        }

        // Se for unificado, tenta criar um objeto combinado
        if (platform === 'all' && platformsToFetch.length > 1) {
            const ig = window.currentReportData.platforms['instagram'];
            const fb = window.currentReportData.platforms['facebook'];

            if (ig && fb) {
                // Função auxiliar para limpar string e converter para número
                const parseNum = (str) => parseInt(str.replace(/\./g, '')) || 0;
                const parseFloatNum = (str) => parseFloat(str.replace('%', '')) || 0;

                primaryData = {
                    followers: (parseNum(ig.followers) + parseNum(fb.followers)).toLocaleString('pt-BR'),
                    newFollowers: (parseNum(ig.newFollowers) + parseNum(fb.newFollowers)).toLocaleString('pt-BR'),
                    reach: (parseNum(ig.reach) + parseNum(fb.reach)).toLocaleString('pt-BR'),
                    engagement: ((parseFloatNum(ig.engagement) + parseFloatNum(fb.engagement)) / 2).toFixed(2) + '%',
                    growth: ig.growth, // Mantém o do IG como referência ou média
                    topPosts: [...ig.topPosts, ...fb.topPosts].sort((a, b) => b.totalEngagement - a.totalEngagement).slice(0, 3),
                    postsCount: ig.postsCount + fb.postsCount,
                    apiConnected: ig.apiConnected && fb.apiConnected,
                    apiErrorMessage: ig.apiErrorMessage || fb.apiErrorMessage,
                    socialId: 'Relatório Unificado'
                };
            } else {
                primaryData = ig || fb; // Fallback se um falhar
            }
        }

        if (!primaryData) {
            throw new Error("Não foi possível carregar dados de nenhuma plataforma selecionada.");
        }

        // Render Dashboard (using primaryData)
        const { followers, newFollowers, reach, engagement, growth, topPosts, apiConnected, apiErrorMessage, socialId, postsCount } = primaryData;
        const displayPlatform = (platform === 'all' && platformsToFetch.length > 1) ? 'Visão Geral Unificada (Instagram + Facebook)' : (platformsToFetch[0] === 'instagram' ? 'Instagram' : 'Facebook');

        // Generate Top Posts HTML for Dashboard
        let postsHtml = '';
        if (topPosts && topPosts.length > 0) {
            postsHtml = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
            topPosts.forEach((post, index) => {
                postsHtml += `
                    <div class="flex flex-col border border-gray-100 rounded-lg bg-gray-50 overflow-hidden hover:shadow-md transition-shadow">
                        <div class="h-40 bg-gray-200 relative group">
                            <img src="${post.imageUrl || 'https://via.placeholder.com/150?text=No+Image'}" alt="Post Image" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href="${post.permalink || '#'}" target="_blank" class="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full text-xs font-bold">Ver Post</a>
                            </div>
                        </div>
                        <div class="p-4 flex-1 flex flex-col">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-bold text-gray-500 uppercase">Top #${index + 1}</span>
                                ${post.impressions > 0 
                                    ? `<span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold" title="Visualizações">${post.impressions} Visualizações</span>`
                                    : `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">${post.totalEngagement} Interações</span>`
                                }
                            </div>
                            <p class="text-gray-700 text-xs line-clamp-2 mb-3 flex-1">${post.caption || 'Sem legenda...'}</p>
                            <div class="flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-3">
                                <span class="flex items-center gap-1"><i class="fas fa-heart text-red-400"></i> ${post.likes}</span>
                                <span class="flex items-center gap-1"><i class="fas fa-comment text-blue-400"></i> ${post.comments}</span>
                                <span class="flex items-center gap-1"><i class="fas fa-share text-gray-400"></i> ${post.shares || 0}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            postsHtml += '</div>';
        } else {
            postsHtml = `
                <div class="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <i class="fas fa-image text-4xl text-gray-300 mb-3"></i>
                    <p class="text-gray-500 text-sm">Nenhum post relevante encontrado neste período.</p>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="col-span-full mb-4 flex items-center justify-between">
                <h3 class="font-bold text-gray-700">${displayPlatform}</h3>
                ${platform === 'all' ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Relatório Unificado Pronto</span>' : ''}
            </div>

            <!-- Card Seguidores -->
            <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-blue-50 p-3 rounded-lg">
                        <i class="fas fa-users text-blue-600 text-xl"></i>
                    </div>
                    <span class="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">+${newFollowers} novos</span>
                </div>
                <h4 class="text-gray-500 text-sm font-medium uppercase mb-1">Seguidores</h4>
                <div class="text-3xl font-bold text-gray-900">${followers}</div>
                <p class="text-gray-400 text-xs mt-2">Total atual</p>
            </div>

            <!-- Card Alcance -->
            <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">    
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-purple-50 p-3 rounded-lg">
                        <i class="fas fa-eye text-purple-600 text-xl"></i>
                    </div>
                    <span class="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Acumulado</span>  
                </div>
                <h4 class="text-gray-500 text-sm font-medium uppercase mb-1">Alcance Total</h4>
                <div class="text-3xl font-bold text-gray-900">${reach}</div>
                <p class="text-gray-400 text-xs mt-2">Soma diária no período</p>
            </div>

            <!-- Card Publicações (NOVO) -->
            <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">    
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-indigo-50 p-3 rounded-lg">
                        <i class="fas fa-camera text-indigo-600 text-xl"></i>
                    </div>
                    <span class="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Feed</span>
                </div>
                <h4 class="text-gray-500 text-sm font-medium uppercase mb-1">Publicações</h4>
                <div class="text-3xl font-bold text-gray-900">${postsCount}</div>
                <p class="text-gray-400 text-xs mt-2">No período selecionado</p>
            </div>

            <!-- Card Engajamento -->
            <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">    
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-pink-50 p-3 rounded-lg">
                        <i class="fas fa-heart text-pink-600 text-xl"></i>
                    </div>
                    <span class="text-xs font-medium px-2 py-1 ${parseFloat(engagement) > 4 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} rounded-full">
                        ${parseFloat(engagement) > 4 ? 'Excelente' : 'Bom'}
                    </span>
                </div>
                <h4 class="text-gray-500 text-sm font-medium uppercase mb-1">Engajamento</h4>
                <div class="text-3xl font-bold text-gray-900">${engagement}</div>
                <p class="text-gray-400 text-xs mt-2">Taxa estimada</p>
            </div>

            <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">    
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-orange-50 p-3 rounded-lg">
                        <i class="fas fa-share-alt text-orange-600 text-xl"></i>
                    </div>
                    <span class="text-xs font-medium px-2 py-1 ${apiConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} rounded-full" title="${apiErrorMessage}">
                        ${apiConnected ? 'API V19.0 (Estável)' : 'Simulação'}
                    </span>
                </div>
                <h4 class="text-gray-500 text-sm font-medium uppercase mb-1">Status da API</h4>
                <div class="text-lg font-bold ${apiConnected ? 'text-green-600' : 'text-red-500'} flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${apiConnected ? 'bg-green-500' : 'bg-red-500'}"></span> 
                    ${apiConnected ? 'Conectado' : 'Erro na Conexão'}
                </div>
                <p class="text-gray-400 text-xs mt-2 truncate w-full" title="${apiErrorMessage || socialId}">
                    ${!apiConnected && apiErrorMessage ? apiErrorMessage.substring(0, 30) + '...' : 'ID: ' + socialId}
                </p>
            </div>

            <!-- Posts Mais Relevantes -->
            <div class="col-span-full bg-white p-6 rounded-xl border border-gray-100 shadow-sm mt-2">
                <div class="flex justify-between items-center mb-6">
                    <h4 class="text-gray-900 font-bold text-lg">Posts Mais Relevantes</h4>
                    <button class="text-sm text-[var(--color-primary)] hover:underline" onclick="generatePDFReport()">Baixar Relatório ${platform === 'all' ? 'Unificado' : 'Completo'}</button>
                </div>
                ${postsHtml}
            </div>
        `;

    } catch (error) {
        console.error('Error loading insights:', error);      
        container.innerHTML = `<p class="text-red-500">Erro ao carregar insights: ${error.message}</p>`;
    }
}

// PDF Report Generation
window.generatePDFReport = function() {
    const data = window.currentReportData;
    
    if (!data || !data.clientName || Object.keys(data.platforms).length === 0) {
        alert('Por favor, gere as métricas primeiro para criar o relatório.');
        return;
    }

    // Populate Header Info
    document.getElementById('report-client-name').textContent = data.clientName;
    document.getElementById('report-period').textContent = 'Período: ' + data.period;
    document.getElementById('report-date-generated').textContent = 'Gerado em: ' + data.generatedAt;
    
    // Clear Content Body
    const contentBody = document.getElementById('report-content-body');
    contentBody.innerHTML = '';

    const normalizeValue = (value, fallback) => {
        if (value === undefined || value === null || value === '') return fallback;
        return value;
    };

    // Generate Sections for each Platform
    const platforms = ['instagram', 'facebook']; // Order matters

    platforms.forEach(platform => {
        if (data.platforms[platform]) {
            const rawData = data.platforms[platform] || {};
            const pData = {
                followers: normalizeValue(rawData.followers, '0'),
                newFollowers: normalizeValue(rawData.newFollowers, '0'),
                reach: normalizeValue(rawData.reach, '0'),
                postsCount: normalizeValue(rawData.postsCount, '0'),
                engagement: normalizeValue(rawData.engagement, '-'),
                growth: normalizeValue(rawData.growth, '-'),
                topPosts: Array.isArray(rawData.topPosts) ? rawData.topPosts : []
            };
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            const colorClass = platform === 'instagram' ? 'text-pink-600' : 'text-blue-600';
            const bgClass = platform === 'instagram' ? 'bg-pink-50' : 'bg-blue-50';
            const iconClass = platform === 'instagram' ? 'fab fa-instagram' : 'fab fa-facebook';

            // Generate Top Posts HTML
            let postsHtml = '';
            if (pData.topPosts && pData.topPosts.length > 0) {
                pData.topPosts.forEach((post, index) => {
                    const postEngagement = normalizeValue(post?.totalEngagement, 0);
                    const postCaption = normalizeValue(post?.caption, 'Sem legenda...');
                    const postImage = normalizeValue(post?.imageUrl, 'https://via.placeholder.com/150?text=No+Image');
                    const postLikes = normalizeValue(post?.likes, 0);
                    const postComments = normalizeValue(post?.comments, 0);
                    postsHtml += `
                        <div class="flex items-start gap-4 p-4 border border-gray-100 rounded-lg bg-gray-50 break-inside-avoid">
                            <div class="w-20 h-20 flex-shrink-0 bg-gray-200 rounded-md overflow-hidden">
                                <img src="${postImage}" alt="Post Image" class="w-full h-full object-cover">
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start mb-1">
                                    <h4 class="font-bold text-gray-800 text-xs">Top #${index + 1}</h4>
                                    <span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">${postEngagement} Interações</span>
                                </div>
                                <p class="text-gray-600 text-[10px] line-clamp-2 mb-1 leading-tight">${postCaption}</p>
                                <div class="flex gap-3 text-[10px] text-gray-500">
                                    <span><i class="fas fa-heart text-red-400 mr-1"></i> ${postLikes}</span>
                                    <span><i class="fas fa-comment text-blue-400 mr-1"></i> ${postComments}</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                postsHtml = '<p class="text-gray-400 text-center py-4 text-sm col-span-3">Nenhum post encontrado no período.</p>';
            }

            // Platform Section HTML
            const sectionHtml = `
                <div class="mb-8 break-inside-avoid">
                    <div class="flex items-center gap-3 mb-4 pb-2 border-b border-gray-100">
                        <div class="${bgClass} w-8 h-8 rounded-full flex items-center justify-center">
                            <i class="${iconClass} ${colorClass} text-lg"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-800">${platformName}</h3>
                    </div>

                    <!-- Metrics Grid -->
                    <div class="grid grid-cols-3 gap-3 mb-6">
                        <div class="bg-gray-50 p-3 rounded-lg text-center">
                            <p class="text-[10px] text-gray-500 uppercase font-medium mb-1">Seguidores</p>
                            <p class="text-lg font-bold text-gray-900">${pData.followers}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg text-center">
                            <p class="text-[10px] text-gray-500 uppercase font-medium mb-1">Novos</p>
                            <p class="text-lg font-bold text-green-600">+${pData.newFollowers}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg text-center">
                            <p class="text-[10px] text-gray-500 uppercase font-medium mb-1">Alcance</p>
                            <p class="text-lg font-bold text-gray-900">${pData.reach}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg text-center">
                            <p class="text-[10px] text-gray-500 uppercase font-medium mb-1">Publicações</p>
                            <p class="text-lg font-bold text-gray-900">${pData.postsCount}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg text-center">
                            <p class="text-[10px] text-gray-500 uppercase font-medium mb-1">Engajamento</p>
                            <p class="text-lg font-bold text-gray-900">${pData.engagement}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg text-center">
                            <p class="text-[10px] text-gray-500 uppercase font-medium mb-1">Crescimento</p>
                            <p class="text-lg font-bold text-green-600">${pData.growth}</p>
                        </div>
                    </div>

                    <!-- Top Posts -->
                    <h4 class="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Melhores Posts</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="report-top-posts-${platform}">
                        ${postsHtml}
                    </div>
                </div>
            `;

            contentBody.insertAdjacentHTML('beforeend', sectionHtml);
        }
    });

    // Show Template temporarily
    const template = document.getElementById('report-template');
    template.classList.remove('hidden');

    // PDF Options
    const opt = {
        margin: 0.5,
        filename: `Relatorio_${data.clientName.replace(/\s+/g, '_')}_${data.isUnified ? 'Unificado' : 'Social'}_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, // useCORS important for external images
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Generate
    html2pdf().set(opt).from(document.getElementById('pdf-content')).save().then(() => {
        template.classList.add('hidden');
    }).catch(err => {
        console.error('Erro ao gerar PDF:', err);
        alert('Erro ao gerar PDF. Verifique o console.');
        template.classList.add('hidden');
    });
}

const creativeRequestsState = {
    initialized: false,
    current: null,
    list: [],
    clientMap: {}
};

async function getCreativeRequestsAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const sessionResult = await window.supabaseClient?.auth?.getSession();
    const token = sessionResult?.data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function resolveCreativeRequestsRole() {
    if (window.currentUserData?.perfil_acesso) {
        return String(window.currentUserData.perfil_acesso).toLowerCase();
    }
    if (!window.supabaseClient) return 'usuario';
    const sessionResult = await window.supabaseClient.auth.getSession();
    const userId = sessionResult?.data?.session?.user?.id;
    if (!userId) return 'usuario';
    const { data } = await window.supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
    return String(data?.role || 'usuario').toLowerCase();
}

function formatCreativeStatus(status) {
    const map = {
        requested: 'Solicitado',
        in_progress: 'Em produção',
        delivered: 'Entregue',
        needs_revision: 'Ajustes',
        approved: 'Aprovado',
        canceled: 'Cancelado'
    };
    return map[status] || status || '-';
}

function formatCreativeDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
}

async function loadCreativeRequestsClients() {
    const select = document.getElementById('creative-requests-client');
    if (!select || select.options.length > 1) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_fantasia, nome_empresa')
            .eq('is_demo', false)
            .order('nome_fantasia');
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        list.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.nome_fantasia || cliente.nome_empresa || `Cliente ${cliente.id}`;
            select.appendChild(option);
            creativeRequestsState.clientMap[String(cliente.id)] = option.textContent;
        });
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

function renderCreativeRequestsList() {
    const tbody = document.getElementById('creative-requests-table-body');
    if (!tbody) return;
    if (!creativeRequestsState.list.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 italic">Nenhuma solicitação encontrada.</td></tr>`;
        return;
    }
    tbody.innerHTML = '';
    creativeRequestsState.list.forEach(item => {
        const createdAt = formatCreativeDate(item.created_at);
        const deadline = formatCreativeDate(item.deadline_date);
        const clientId = item.cliente_id || item.tenant_id;
        const clientName = creativeRequestsState.clientMap[String(clientId)] || `Cliente ${clientId || '-'}`;
        const statusLabel = formatCreativeStatus(item.status);
        const formatLabel = item.format || '-';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-500">${createdAt}</td>
            <td class="px-6 py-4 text-sm font-medium text-gray-800">${clientName}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${item.title || '-'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${formatLabel}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${deadline}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${statusLabel}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="openCreativeRequestModal('${item.id_uuid || ''}')" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Ver</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.initCreativeRequestsView = async function() {
    if (creativeRequestsState.initialized) return;
    creativeRequestsState.initialized = true;
    const modeSelect = document.getElementById('creative-requests-mode');
    const clientWrapper = document.getElementById('creative-requests-client-wrapper');
    const clientSelect = document.getElementById('creative-requests-client');
    const statusSelect = document.getElementById('creative-requests-status');
    const deadlineSelect = document.getElementById('creative-requests-deadline');
    const formatSelect = document.getElementById('creative-requests-format');
    const assetsInput = document.getElementById('creative-request-assets');

    const role = await resolveCreativeRequestsRole();
    const isSuperAdmin = role === 'super_admin';
    if (!isSuperAdmin && modeSelect) {
        modeSelect.value = 'client';
        modeSelect.disabled = true;
    }

    const updateMode = async () => {
        const modeValue = modeSelect?.value || 'client';
        const isAgency = modeValue === 'agencia' && isSuperAdmin;
        if (clientWrapper) clientWrapper.classList.toggle('hidden', !isAgency);
        if (isAgency) await loadCreativeRequestsClients();
    };

    if (modeSelect) {
        modeSelect.addEventListener('change', async () => {
            await updateMode();
        });
    }
    if (clientSelect) clientSelect.addEventListener('change', () => loadCreativeRequests());
    if (statusSelect) statusSelect.addEventListener('change', () => loadCreativeRequests());
    if (deadlineSelect) deadlineSelect.addEventListener('change', () => loadCreativeRequests());
    if (formatSelect) formatSelect.addEventListener('change', () => loadCreativeRequests());
    if (assetsInput) {
        assetsInput.addEventListener('change', () => {
            renderCreativeRequestAssetsList();
        });
    }
    await updateMode();
};

window.loadCreativeRequests = async function() {
    const tbody = document.getElementById('creative-requests-table-body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando solicitações...</td></tr>`;
    }
    try {
        const role = await resolveCreativeRequestsRole();
        const isSuperAdmin = role === 'super_admin';
        const modeSelect = document.getElementById('creative-requests-mode');
        const clientSelect = document.getElementById('creative-requests-client');
        const statusSelect = document.getElementById('creative-requests-status');
        const deadlineSelect = document.getElementById('creative-requests-deadline');
        const formatSelect = document.getElementById('creative-requests-format');

        if (creativeRequestsState.pendingFilter && statusSelect) {
            statusSelect.value = 'pending';
        }

        const scope = modeSelect?.value === 'agencia' && isSuperAdmin ? 'agencia' : 'cliente';
        const url = new URL(`${window.API_BASE_URL}/api/creative-requests`);
        url.searchParams.set('scope', scope);
        if (scope === 'agencia' && clientSelect?.value) {
            url.searchParams.set('cliente_id', clientSelect.value);
            url.searchParams.set('tenant_id', clientSelect.value);
        }
        if (statusSelect?.value && statusSelect.value !== 'pending') {
            url.searchParams.set('status', statusSelect.value);
        }
        if (deadlineSelect?.value) url.searchParams.set('deadline', deadlineSelect.value);
        if (formatSelect?.value) url.searchParams.set('format', formatSelect.value);

        const headers = await getCreativeRequestsAuthHeaders();
        const res = await fetch(url.toString(), { headers });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(json?.error || 'Erro ao carregar solicitações');
        }
        let items = Array.isArray(json?.items) ? json.items : [];
        if (statusSelect?.value === 'pending') {
            items = items.filter(item => ['requested', 'needs_revision'].includes(String(item?.status || '').toLowerCase()));
        }
        creativeRequestsState.list = items;
        await loadCreativeRequestsClients();
        renderCreativeRequestsList();
        creativeRequestsState.pendingFilter = false;
    } catch (error) {
        const tbodyEl = document.getElementById('creative-requests-table-body');
        if (tbodyEl) {
            tbodyEl.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Erro ao carregar solicitações.</td></tr>`;
        }
    }
};

window.openCreativeRequestsPending = function() {
    creativeRequestsState.pendingFilter = true;
    openSocialMediaTab('creative-requests');
};

function renderCreativeRequestAssetsList() {
    const listEl = document.getElementById('creative-request-assets-list');
    if (!listEl) return;
    const assetsInput = document.getElementById('creative-request-assets');
    const existing = Array.isArray(creativeRequestsState.current?.delivered_assets)
        ? creativeRequestsState.current.delivered_assets
        : [];
    const selectedFiles = assetsInput?.files ? Array.from(assetsInput.files) : [];
    const existingNames = existing.map(asset => asset?.name || asset?.file || '').filter(Boolean);
    const selectedNames = selectedFiles.map(file => file.name);
    const allNames = [...existingNames, ...selectedNames].filter(Boolean);
    listEl.textContent = allNames.length ? allNames.join(', ') : 'Nenhum arquivo selecionado.';
}

window.openCreativeRequestModal = async function(requestId) {
    if (!requestId) return;
    try {
        const headers = await getCreativeRequestsAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/creative-requests/${encodeURIComponent(requestId)}`, { headers });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(json?.error || 'Erro ao carregar solicitação');
        }
        creativeRequestsState.current = json?.data || null;
        const data = creativeRequestsState.current;
        const detailClientId = data?.cliente_id || data?.tenant_id;
        const clientName = creativeRequestsState.clientMap[String(detailClientId)] || `Cliente ${detailClientId || '-'}`;
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value ?? '-';
        };
        setText('creative-request-detail-client', clientName);
        setText('creative-request-detail-status', formatCreativeStatus(data?.status));
        setText('creative-request-detail-format', data?.format || '-');
        setText('creative-request-detail-deadline', formatCreativeDate(data?.deadline_date));
        setText('creative-request-detail-title', data?.title || '-');
        setText('creative-request-detail-briefing', data?.briefing || '-');
        setText('creative-request-detail-meta', data?.requested_by_name ? `Solicitado por ${data.requested_by_name}` : '');
        const notesEl = document.getElementById('creative-request-response-notes');
        if (notesEl) notesEl.value = data?.response_notes || '';
        const assetsInput = document.getElementById('creative-request-assets');
        if (assetsInput) assetsInput.value = '';
        renderCreativeRequestAssetsList();
        const modalId = 'creative-request-modal';
        if (typeof openModalAnim === 'function') {
            openModalAnim(modalId);
        } else {
            const el = document.getElementById(modalId);
            if (el) {
                el.classList.remove('hidden');
                el.classList.add('flex');
                el.classList.remove('opacity-0');
            }
        }
    } catch (error) {
        alert('Não foi possível abrir a solicitação.');
    }
};

window.closeCreativeRequestModal = function() {
    const modalId = 'creative-request-modal';
    if (typeof closeModalAnim === 'function') {
        closeModalAnim(modalId);
    } else {
        const el = document.getElementById(modalId);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    }
};

function buildCreativeAssetsPayload() {
    const assetsInput = document.getElementById('creative-request-assets');
    const selectedFiles = assetsInput?.files ? Array.from(assetsInput.files) : [];
    const existing = Array.isArray(creativeRequestsState.current?.delivered_assets)
        ? creativeRequestsState.current.delivered_assets
        : [];
    const newAssets = selectedFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        placeholder: true,
        uploaded_at: new Date().toISOString()
    }));
    if (!newAssets.length) return existing.length ? existing : null;
    const map = new Map();
    [...existing, ...newAssets].forEach(item => {
        const key = `${item?.name || ''}-${item?.size || ''}`;
        if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
}

async function submitCreativeRequestUpdate(extraPayload = {}) {
    const current = creativeRequestsState.current;
    const currentId = current?.id_uuid || current?.id;
    if (!currentId) return;
    const notesEl = document.getElementById('creative-request-response-notes');
    const responseNotes = notesEl ? notesEl.value.trim() : '';
    const deliveredAssets = buildCreativeAssetsPayload();
    const payload = {
        ...extraPayload
    };
    if (responseNotes !== '') payload.response_notes = responseNotes;
    if (deliveredAssets !== null) payload.delivered_assets = deliveredAssets;
    try {
        const headers = await getCreativeRequestsAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/creative-requests/${encodeURIComponent(currentId)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(json?.error || 'Erro ao atualizar solicitação');
        }
        creativeRequestsState.current = json?.data || creativeRequestsState.current;
        await loadCreativeRequests();
        renderCreativeRequestAssetsList();
    } catch (error) {
        alert('Não foi possível atualizar a solicitação.');
    }
}

window.saveCreativeRequestResponse = async function() {
    await submitCreativeRequestUpdate({});
};

window.updateCreativeRequestStatus = async function(status) {
    if (!status) return;
    await submitCreativeRequestUpdate({ status });
};

function mapPeriodToInsightsOption(period) {
    if (period === '7d') return 'last_7_days';
    if (period === '90d') return 'last_90_days';
    return 'last_30_days';
}

function formatActivePeriodLabel(period) {
    if (period === '7d') return 'Últimos 7 dias';
    if (period === '90d') return 'Últimos 90 dias';
    return 'Últimos 30 dias';
}

function resolveInsightsPlatformData(platforms, platform) {
    if (!platforms) return null;
    if (platform && platforms[platform]) return platforms[platform];
    const firstKey = Object.keys(platforms)[0];
    return firstKey ? platforms[firstKey] : null;
}

window.refreshOperationalHub = async function() {
    const statusEl = document.getElementById('operational-status');
    const kpisEl = document.getElementById('operational-kpis');
    if (!statusEl || !kpisEl) return;
    const clientId = typeof window.getActiveClientId === 'function' ? window.getActiveClientId() : '';
    const period = typeof window.getActivePeriod === 'function' ? window.getActivePeriod() : '30d';
    const platform = window.socialMediaState?.platform || 'instagram';
    if (!clientId) {
        statusEl.textContent = 'Selecione um cliente para ver o hub operacional.';
        kpisEl.innerHTML = '';
        return;
    }
    statusEl.textContent = 'Carregando visão operacional...';
    kpisEl.innerHTML = '';
    if (typeof window.__debugLoadClientes === 'function') {
        await window.__debugLoadClientes();
    }
    const clientSelect = document.getElementById('insights-cliente');
    if (clientSelect) clientSelect.value = String(clientId);
    const platformSelect = document.getElementById('insights-platform');
    if (platformSelect) platformSelect.value = platform;
    const periodSelect = document.getElementById('insights-periodo');
    if (periodSelect) periodSelect.value = mapPeriodToInsightsOption(period);
    if (typeof window.loadInsights === 'function') {
        await window.loadInsights();
    } else {
        statusEl.textContent = 'Insights indisponível.';
        return;
    }
    const platforms = window.currentReportData?.platforms || null;
    const data = resolveInsightsPlatformData(platforms, platform);
    if (!data) {
        statusEl.textContent = 'Sem dados de insights para o período.';
        return;
    }
    const platformLabel = platform === 'facebook' ? 'Facebook' : platform === 'instagram' ? 'Instagram' : 'Geral';
    statusEl.textContent = `${platformLabel} • ${formatActivePeriodLabel(period)}`;
    const followers = data.followers || '0';
    const newFollowers = data.newFollowers || '0';
    const reach = data.reach || '0';
    const engagement = data.engagement || '0%';
    const postsCount = String(data.postsCount || '0');
    kpisEl.innerHTML = `
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-bold text-gray-500 uppercase">Seguidores</h3>
                <span class="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">${platformLabel}</span>
            </div>
            <div class="text-2xl font-semibold text-gray-900">${followers}</div>
            <div class="text-xs text-gray-500 mt-1">Novos: ${newFollowers}</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-bold text-gray-500 uppercase">Alcance</h3>
                <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Período</span>
            </div>
            <div class="text-2xl font-semibold text-gray-900">${reach}</div>
            <div class="text-xs text-gray-500 mt-1">Posts: ${postsCount}</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-bold text-gray-500 uppercase">Engajamento</h3>
                <span class="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Taxa</span>
            </div>
            <div class="text-2xl font-semibold text-gray-900">${engagement}</div>
            <div class="text-xs text-gray-500 mt-1">Interações agregadas</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-bold text-gray-500 uppercase">Impressões</h3>
                <span class="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Visibilidade</span>
            </div>
            <div class="text-2xl font-semibold text-gray-900">${data.impressions || '0'}</div>
            <div class="text-xs text-gray-500 mt-1">Cliques: ${data.profileViews || '0'}</div>
        </div>
    `;
};

})();
