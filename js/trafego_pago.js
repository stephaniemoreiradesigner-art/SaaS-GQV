// Funções Utilitárias Globais
window.formatCurrency = function(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

window.parseCurrency = function(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        return parseFloat(value.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
    }
    return 0;
};

// --- Gerenciamento de Abas ---
window.switchTab = function(tabId) {
    // Esconde todas as abas
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-fade-in');
    });
    
    // Remove estado ativo dos botões
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active', 'text-primary', 'border-primary', 'bg-primary/5');
        el.classList.add('text-gray-500', 'border-transparent');
    });

    // Mostra aba alvo
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-fade-in');
    }

    // Ativa botão
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) {
        btn.classList.add('active', 'text-primary', 'border-primary', 'bg-primary/5');
        btn.classList.remove('text-gray-500', 'border-transparent');
    }
    
    // Callbacks específicos por aba
    if (tabId === 'logs' && typeof window.loadTrafficLogs === 'function') {
        window.loadTrafficLogs();
    }
    if (tabId === 'solicitacoes' && typeof window.loadCreativeRequests === 'function') {
        window.loadCreativeRequests();
    }
    
    // Atualiza URL sem recarregar
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url);
};

// --- Lógica de Datas do Relatório (Meta Ads Style) ---
window.updateReportDates = function() {
    const select = document.getElementById('report-period-select');
    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    
    if (!select || !startInput || !endInput) return;
    
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);
    
    const val = select.value;
    
    if (val === 'custom') {
        startInput.disabled = false;
        endInput.disabled = false;
        return;
    } else {
        startInput.disabled = true;
        endInput.disabled = true;
    }
    
    switch(val) {
        case 'last_7': 
            start.setDate(today.getDate() - 7); 
            break;
        case 'last_14': 
            start.setDate(today.getDate() - 14); 
            break;
        case 'last_30': 
            start.setDate(today.getDate() - 30); 
            break;
        case 'this_month': 
            start.setDate(1); 
            break;
        case 'last_month': 
            start.setMonth(start.getMonth() - 1); 
            start.setDate(1);
            end = new Date(today.getFullYear(), today.getMonth(), 0); // Último dia do mês anterior
            break;
        case 'this_year': 
            start.setMonth(0, 1); 
            break;
        case 'lifetime': 
            start = new Date('2020-01-01'); 
            break;
    }
    
    startInput.value = start.toISOString().split('T')[0];
    endInput.value = end.toISOString().split('T')[0];
};

const trafficConnectionsCache = {};

function getTrafficPlatformLabel(platformKey) {
    if (platformKey === 'meta_ads') return 'Meta Ads';
    if (platformKey === 'google_ads') return 'Google Ads';
    if (platformKey === 'linkedin_ads') return 'LinkedIn Ads';
    if (platformKey === 'tiktok_ads') return 'TikTok Ads';
    if (platformKey === 'meta') return 'Meta Ads';
    if (platformKey === 'google') return 'Google Ads';
    if (platformKey === 'linkedin') return 'LinkedIn Ads';
    if (platformKey === 'tiktok') return 'TikTok Ads';
    return 'Plataforma';
}

function getTrafficPlatformConnections(platformKey) {
    if (platformKey === 'meta_ads' || platformKey === 'meta') return ['facebook', 'instagram'];
    if (platformKey === 'google_ads' || platformKey === 'google') return ['google'];
    if (platformKey === 'linkedin_ads' || platformKey === 'linkedin') return ['linkedin'];
    if (platformKey === 'tiktok_ads' || platformKey === 'tiktok') return ['tiktok'];
    return [];
}

async function updateTrafficPlatformAvailability(clientId) {
    if (!clientId) return;
    const connections = trafficConnectionsCache[clientId] || await window.getConnectedPlatforms(clientId);
    trafficConnectionsCache[clientId] = connections;
    const connectedSet = new Set((connections.connected || []).map(item => item.platform));

    const reportCheckboxes = document.querySelectorAll('input[name="report_platform"]');
    reportCheckboxes.forEach(input => {
        const label = input.closest('label');
        const textEl = label ? label.querySelector('span') : null;
        const baseLabel = getTrafficPlatformLabel(input.value);
        const required = getTrafficPlatformConnections(input.value);
        const isConnected = required.some(p => connectedSet.has(p));

        input.disabled = !isConnected;
        if (!isConnected) input.checked = false;

        if (textEl) textEl.textContent = isConnected ? baseLabel : `${baseLabel} (Conectar)`;
        if (label) {
            label.classList.toggle('opacity-50', !isConnected);
            label.classList.toggle('cursor-not-allowed', !isConnected);
        }
    });

    const platformRadios = document.querySelectorAll('input[name="platform"]');
    platformRadios.forEach(input => {
        const label = input.closest('label');
        const baseLabel = getTrafficPlatformLabel(input.value);
        const required = getTrafficPlatformConnections(input.value);
        const isConnected = required.some(p => connectedSet.has(p));

        input.disabled = !isConnected;
        if (!isConnected) input.checked = false;

        if (label) {
            const textEl = label.querySelector('span');
            if (textEl) textEl.textContent = isConnected ? baseLabel : `${baseLabel} (Conectar)`;
            label.classList.toggle('opacity-50', !isConnected);
            label.classList.toggle('cursor-not-allowed', !isConnected);
        }
    });

    if (window.updatePlatformSelection) window.updatePlatformSelection();
}

function showTrafficConnectionCTA(clientId, platformLabel) {
    const emptyState = document.getElementById('report-empty');
    const emptyMsg = document.getElementById('report-empty-message');
    const preview = document.getElementById('report-preview');
    if (emptyMsg) emptyMsg.innerHTML = window.renderPlatformNotConnectedCTA(clientId, platformLabel);
    if (emptyState) emptyState.classList.remove('hidden');
    if (preview) preview.classList.add('hidden');
}

function showCampaignConnectionCTA(clientId, platformLabel) {
    const form = document.getElementById('form-campanha-stepper');
    if (!form || !form.parentElement) return;
    let container = document.getElementById('campaign-connection-cta');
    if (!container) {
        container = document.createElement('div');
        container.id = 'campaign-connection-cta';
        container.className = 'mb-6';
        form.parentElement.insertBefore(container, form);
    }
    container.innerHTML = window.renderPlatformNotConnectedCTA(clientId, platformLabel);
}

function clearCampaignConnectionCTA() {
    const container = document.getElementById('campaign-connection-cta');
    if (container) container.innerHTML = '';
}

// --- UI Helpers para Multi-select ---
window.togglePlatformDropdown = function() {
    const dropdown = document.getElementById('platform-multiselect-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.updatePlatformSelection = function() {
    const checkboxes = document.querySelectorAll('input[name="report_platform"]:checked');
    const btnText = document.getElementById('platform-multiselect-text');
    
    if (checkboxes.length === 0) {
        btnText.textContent = 'Selecione...';
    } else if (checkboxes.length === 1) {
        const labels = {
            'meta_ads': 'Meta Ads',
            'google_ads': 'Google Ads',
            'tiktok_ads': 'TikTok Ads',
            'linkedin_ads': 'LinkedIn Ads'
        };
        btnText.textContent = labels[checkboxes[0].value] || checkboxes[0].value;
    } else {
        btnText.textContent = `${checkboxes.length} plataformas selecionadas`;
    }
};

// Fechar dropdown ao clicar fora
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('platform-multiselect-dropdown');
    const btn = document.getElementById('platform-multiselect-btn');
    if (dropdown && !dropdown.classList.contains('hidden') && btn && !dropdown.contains(event.target) && !btn.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

// --- Geração de Relatório ---
window.generateTrafficReport = async function() {
    const filterCliente = document.getElementById('filter-cliente');
    const reportClientSelect = document.getElementById('report-client-select');
    const clientId = filterCliente?.value || reportClientSelect?.value;

    // Pega plataformas selecionadas (Multi-select)
    const selectedPlatforms = Array.from(document.querySelectorAll('input[name="report_platform"]:checked')).map(cb => cb.value);
    
    const startDateVal = document.getElementById('report-start-date').value;
    const endDateVal = document.getElementById('report-end-date').value;

    if (!clientId) {
        alert('Por favor, selecione um cliente no filtro principal.');
        return;
    }
    if (selectedPlatforms.length === 0) {
        alert('Por favor, selecione pelo menos uma plataforma.');
        return;
    }

    const connections = trafficConnectionsCache[clientId] || await window.getConnectedPlatforms(clientId);
    trafficConnectionsCache[clientId] = connections;
    const connectedSet = new Set((connections.connected || []).map(item => item.platform));
    const notConnected = selectedPlatforms.find(platformKey => {
        const required = getTrafficPlatformConnections(platformKey);
        return !required.some(p => connectedSet.has(p));
    });

    if (notConnected) {
        showTrafficConnectionCTA(clientId, getTrafficPlatformLabel(notConnected));
        return;
    }
    if (!startDateVal || !endDateVal) {
        alert('Por favor, selecione o período.');
        return;
    }

    const btn = document.querySelector('button[onclick="generateTrafficReport()"]');
    const originalText = btn ? btn.innerHTML : 'Gerar Relatório';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        btn.disabled = true;
    }

    try {
        console.log(`Gerando relatório para Cliente: ${clientId}, Plataformas: ${selectedPlatforms.join(', ')}, De: ${startDateVal} até ${endDateVal}`);

        let allDetailedData = [];

        // Loop por cada plataforma selecionada
        for (const platform of selectedPlatforms) {
            console.log(`--- Processando plataforma: ${platform} ---`);

            // 0. Buscar IDs de Conta do Cliente (Vínculo Cliente + Plataforma)
            let platformAdAccountId = null;
            if (window.supabaseClient) {
                const { data: clientData, error: clientError } = await window.supabaseClient
                    .from('clientes')
                    .select('meta_ad_account_id, google_ad_account_id, tiktok_ad_account_id, linkedin_ad_account_id')
                    .eq('id', clientId)
                    .single();
                
                if (clientData) {
                    if (platform === 'meta_ads') platformAdAccountId = clientData.meta_ad_account_id;
                    else if (platform === 'google_ads') platformAdAccountId = clientData.google_ad_account_id;
                    else if (platform === 'tiktok_ads') platformAdAccountId = clientData.tiktok_ad_account_id;
                    else if (platform === 'linkedin_ads') platformAdAccountId = clientData.linkedin_ad_account_id;
                }
            }

            // 1. Buscar Dados (Supabase ou Mock)
            let platformData = [];
            
            // Tenta buscar do Supabase
            if (window.supabaseClient) {
                let query = window.supabaseClient
                    .from('traffic_reports_data')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .gte('date', startDateVal)
                    .lte('date', endDateVal)
                    .eq('platform', platform);

                const { data, error } = await query;
                if (!error && data && data.length > 0) {
                    platformData = data;
                }
            }

            // Se não houver dados no Supabase, busca DIRETAMENTE DA API (Meta Ads, etc.)
            if (platformData.length === 0) {
                if (platform === 'meta_ads' && platformAdAccountId) {
                    try {
                        // VIBECODE SECURITY: Token gerenciado pelo backend.
                        // Chamada direta ao proxy (token=null)
                        const apiData = await fetchMetaAdsData(platformAdAccountId, null, startDateVal, endDateVal);
                        
                        if (apiData && apiData.length > 0) {
                            platformData = apiData;
                        }
                    } catch (err) {
                        console.error(`Erro ao consultar Meta Ads API:`, err);
                    }
                } else {
                     console.warn(`Integração direta para ${platform} não disponível ou conta não configurada.`);
                }
            }

            // Adiciona aos dados gerais se encontrou algo
            if (platformData.length > 0) {
                // Adiciona identificador da plataforma nos dados para debug/tabela se necessário
                const taggedData = platformData.map(d => ({ ...d, _platform: platform }));
                allDetailedData = allDetailedData.concat(taggedData);
            }
        }

        const detailedData = allDetailedData;

        // Se AINDA assim vazio
        const reportEmpty = document.getElementById('report-empty');
        const reportPreview = document.getElementById('report-preview');
        const emptyMessage = document.getElementById('report-empty-message');

        if (detailedData.length === 0) {
            console.log('Sem dados reais para o período em nenhuma plataforma selecionada.');
            if (reportEmpty) {
                reportEmpty.classList.remove('hidden');
                if (emptyMessage) {
                    emptyMessage.textContent = "Não há dados para as plataformas selecionadas neste período.";
                }
            }
            if (reportPreview) reportPreview.classList.add('hidden');
            return;
        }

        // 2. Processar Dados (Agregação)
        let totalSpend = 0;
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalConversions = 0;
        let totalRevenue = 0;
        
        const chartMap = new Map();

        detailedData.forEach(item => {
            const spend = parseFloat(item.spend || 0);
            const impr = parseInt(item.impressions || 0);
            const clicks = parseInt(item.clicks || 0);
            const conv = parseInt(item.conversions || 0);
            const rev = parseFloat(item.conversion_values || 0);

            totalSpend += spend;
            totalImpressions += impr;
            totalClicks += clicks;
            totalConversions += conv;
            totalRevenue += rev;

            // Agrupa por data para o gráfico
            const d = item.date; // YYYY-MM-DD
            if (!chartMap.has(d)) {
                chartMap.set(d, { spend: 0, conversions: 0 });
            }
            const curr = chartMap.get(d);
            curr.spend += spend;
            curr.conversions += conv;
        });

        // ROAS
        const periodRoas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;

        // 3. Atualizar DOM (Cards)
        if (document.getElementById('report-spend')) document.getElementById('report-spend').textContent = formatCurrency(totalSpend);
        if (document.getElementById('report-impressions')) document.getElementById('report-impressions').textContent = totalImpressions.toLocaleString('pt-BR');
        if (document.getElementById('report-clicks')) document.getElementById('report-clicks').textContent = totalClicks.toLocaleString('pt-BR');
        if (document.getElementById('report-conversions')) document.getElementById('report-conversions').textContent = totalConversions.toLocaleString('pt-BR');
        if (document.getElementById('report-roas')) document.getElementById('report-roas').textContent = periodRoas.toFixed(2) + 'x';

        // Atualiza Cards de Custo
        if (document.getElementById('report-cpc')) {
            const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
            document.getElementById('report-cpc').textContent = formatCurrency(avgCpc);
        }
        if (document.getElementById('report-cpa')) {
            const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
            document.getElementById('report-cpa').textContent = formatCurrency(avgCpa);
        }
        if (document.getElementById('report-ctr')) {
             const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
             document.getElementById('report-ctr').textContent = avgCtr.toFixed(2) + '%';
        }

        // 4. Mostrar Relatório
        if (reportEmpty) reportEmpty.classList.add('hidden');
        if (reportPreview) reportPreview.classList.remove('hidden');

        // Header do Relatório
        // Atualizar Nome do Cliente (Busca pelo ID para garantir o nome correto independente do select origem)
        let clientName = "Cliente Desconhecido";
        
        // Tenta encontrar o nome em algum dos selects disponíveis
        const sourceSelect = filterCliente || reportClientSelect;
        if (sourceSelect) {
             // Procura a opção que tem o valor == clientId
             const option = Array.from(sourceSelect.options).find(opt => opt.value === clientId);
             if (option) {
                 clientName = option.text;
             }
        }
        
        const clientNameEl = document.getElementById('report-client-name');
        if (clientNameEl) {
            clientNameEl.textContent = `Cliente: ${clientName}`;
        }

        // Busca e atualiza o Logo
        try {
            const logoImg = document.getElementById('report-client-logo');
            if (logoImg) {
                const cachedConfig = localStorage.getItem('whiteLabelConfig');
                let logoUrl = 'assets/logo.png'; 
                if (cachedConfig) {
                    const config = JSON.parse(cachedConfig);
                    if (config.white_label_logo_url) logoUrl = config.white_label_logo_url;
                }
                logoImg.src = logoUrl;
            }
        } catch (err) { console.warn(err); }
        
        // Data Range Texto
        const periodSelect = document.getElementById('report-period-select');
        const periodText = periodSelect ? periodSelect.options[periodSelect.selectedIndex].text : 'Personalizado';
        const fmtDate = (dStr) => {
            if(!dStr) return '';
            const [y, m, d] = dStr.split('-');
            return `${d}/${m}/${y}`;
        };
        if (document.getElementById('report-date-range')) {
            document.getElementById('report-date-range').textContent = `Período: ${periodText} (${fmtDate(startDateVal)} até ${fmtDate(endDateVal)})`;
        }

        // 5. Atualizar Gráfico
        const sortedDates = Array.from(chartMap.keys()).sort();
        const chartLabels = [];
        const chartSpend = [];
        const chartConversions = [];

        sortedDates.forEach(dateStr => {
            const [y, m, d] = dateStr.split('-');
            chartLabels.push(`${d}/${m}`);
            chartSpend.push(chartMap.get(dateStr).spend);
            chartConversions.push(chartMap.get(dateStr).conversions);
        });

        renderReportChart(chartLabels, chartSpend, chartConversions);

        // 6. Atualizar Tabela Detalhada
        renderDetailedTable(detailedData);

    } catch (e) {
        console.error('Erro ao gerar relatório:', e);
        alert('Ocorreu um erro ao gerar o relatório. Verifique o console.');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// --- API Integrations ---

window.fetchMetaAdsData = async function(accountId, token, startDate, endDate) {
    // VIBECODE SECURITY: 
    // A token (param 2) é ignorada aqui pois o backend injeta a chave segura.
    // Mantemos a assinatura da função para compatibilidade, mas passamos null na chamada.

    const cleanId = accountId.replace('act_', '');
    const actId = `act_${cleanId}`;
    
    const fields = 'campaign_name,impressions,clicks,spend,actions,action_values,cpc,ctr';
    const timeRange = JSON.stringify({ since: startDate, until: endDate });
    const level = 'campaign';
    const timeIncrement = '1'; // Para ter dados diários para o gráfico
    
    // Construir apenas o PATH relativo para o proxy (SEM TOKEN)
    const endpoint = `/v19.0/${actId}/insights?level=${level}&fields=${fields}&time_range=${timeRange}&time_increment=${timeIncrement}&limit=100`;

    console.log('Fetching Meta Ads via Proxy:', endpoint);

    // Chamada ao Backend Proxy
    const response = await fetch(`${window.API_BASE_URL}/api/meta/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: endpoint })
    });
    
    if (!response.ok) {
        const errBody = await response.json();
        console.error('Erro Meta Ads API:', errBody);
        throw new Error(errBody.error ? errBody.error.message : 'Erro desconhecido na API do Facebook');
    }

    const json = await response.json();
    const rawData = json.data || [];

    // Normalização
    return rawData.map(item => {
        // Calcular conversões (somando compras e leads principalmente)
        // Se quiser somar TUDO, basta reduce no actions.
        // Vamos tentar ser espertos: pegar purchase > lead > outros.
        let totalConversions = 0;
        let totalRevenue = 0;

        if (item.actions) {
            item.actions.forEach(act => {
                // Lista de ações que consideramos "Conversão" para o dashboard geral
                // Pode ajustar conforme necessidade do cliente
                // Por padrão, somamos tudo que o FB chama de action, mas isso inclui likes e comentários.
                // Vamos focar em resultados de performance.
                if (['purchase', 'lead', 'submit_application', 'complete_registration', 'contact', 'schedule'].includes(act.action_type)) {
                    totalConversions += parseFloat(act.value);
                }
            });
            // Fallback: Se não achou nenhuma das acima, mas tem actions e spend > 0, talvez seja campanha de tráfego/engajamento.
            // Nesse caso, o objetivo principal (link_click, post_engagement) seria a "conversão"?
            // Melhor não misturar. Conversão é conversão.
        }

        if (item.action_values) {
            item.action_values.forEach(val => {
                if (val.action_type === 'purchase' || val.action_type === 'purchase_value') {
                    totalRevenue += parseFloat(val.value);
                }
            });
        }

        return {
            date: item.date_start, // Formato YYYY-MM-DD
            campaign_name: item.campaign_name,
            impressions: item.impressions,
            clicks: item.clicks,
            spend: item.spend,
            conversions: totalConversions,
            conversion_values: totalRevenue
        };
    });
};

// --- Funções Auxiliares de Renderização ---

function renderReportChart(labels, spendData, conversionsData) {
    const ctx = document.getElementById('report-chart')?.getContext('2d');
    if (!ctx) return;

    // Destroi gráfico anterior se existir
    const existingChart = Chart.getChart("report-chart");
    if (existingChart) existingChart.destroy();

    // Get Primary Color from CSS Variable
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#7c3aed';
    
    // Create a transparent version of primary color (simple hex to rgba conversion or hardcoded fallback)
    // Assuming primary is hex #800080 or similar
    let primaryBg = primaryColor;
    if (primaryColor.startsWith('#')) {
        const r = parseInt(primaryColor.slice(1, 3), 16);
        const g = parseInt(primaryColor.slice(3, 5), 16);
        const b = parseInt(primaryColor.slice(5, 7), 16);
        primaryBg = `rgba(${r}, ${g}, ${b}, 0.1)`;
    } else {
        primaryBg = 'rgba(124, 58, 237, 0.1)'; // Fallback violet
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Investimento (R$)',
                    data: spendData,
                    borderColor: primaryColor,
                    backgroundColor: primaryBg,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Conversões',
                    data: conversionsData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Reais (R$)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Qtd. Conversões' }
                },
            }
        }
    });
}

function renderDetailedTable(data) {
    const tbody = document.getElementById('report-detailed-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="px-3 py-8 text-center text-gray-400">Nenhum dado encontrado.</td></tr>`;
        return;
    }

    // Ordena por gasto (desc)
    data.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

    // Limita a 50 linhas para não travar
    const displayData = data.slice(0, 50);

    displayData.forEach(item => {
        const spend = parseFloat(item.spend || 0);
        const clicks = parseInt(item.clicks || 0);
        const conv = parseInt(item.conversions || 0);
        const rev = parseFloat(item.conversion_values || 0);
        const impr = parseInt(item.impressions || 0);

        const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpa = conv > 0 ? spend / conv : 0;
        const roas = spend > 0 ? rev / spend : 0;

        const platformLabels = {
            'meta_ads': '<i class="fab fa-facebook text-blue-600"></i> Meta',
            'google_ads': '<i class="fab fa-google text-red-500"></i> Google',
            'tiktok_ads': '<i class="fab fa-tiktok text-black"></i> TikTok',
            'linkedin_ads': '<i class="fab fa-linkedin text-blue-700"></i> LinkedIn'
        };
        const platformIcon = platformLabels[item._platform] || item._platform || '-';

        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-50 hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="px-3 py-3 font-medium text-gray-700">${platformIcon}</td>
            <td class="px-3 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${item.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                </span>
            </td>
            <td class="px-3 py-3 font-medium text-gray-900 truncate max-w-[150px]" title="${item.campaign_name}">${item.campaign_name}</td>
            <td class="px-3 py-3 text-gray-500 truncate max-w-[120px]" title="${item.adset_name}">${item.adset_name}</td>
            <td class="px-3 py-3 text-gray-500 truncate max-w-[120px]" title="${item.ad_name}">${item.ad_name}</td>
            <td class="px-3 py-3 text-right font-medium text-gray-900">${formatCurrency(spend)}</td>
            <td class="px-3 py-3 text-right text-gray-600">${impr.toLocaleString('pt-BR')}</td>
            <td class="px-3 py-3 text-right text-gray-600">${clicks.toLocaleString('pt-BR')}</td>
            <td class="px-3 py-3 text-right text-gray-600">${ctr.toFixed(2)}%</td>
            <td class="px-3 py-3 text-right text-gray-600">${formatCurrency(cpc)}</td>
            <td class="px-3 py-3 text-right text-gray-900 font-medium">${conv}</td>
            <td class="px-3 py-3 text-right text-gray-600">${formatCurrency(cpa)}</td>
            <td class="px-3 py-3 text-right ${roas >= 1 ? 'text-green-600' : 'text-red-500'} font-bold">${roas.toFixed(2)}x</td>
        `;
        tbody.appendChild(tr);
    });
}

function generateMockTrafficData(start, end, platform = 'meta_ads') {
    const data = [];
    let campaigns = [];
    let adsets = [];
    let ads = [];

    // Personaliza Mock baseado na Plataforma
    if (platform === 'google_ads') {
        campaigns = [
            { id: 'c1', name: 'Pesquisa - Institucional', objective: 'TRAFFIC' },
            { id: 'c2', name: 'Performance Max - Vendas', objective: 'SALES' },
            { id: 'c3', name: 'YouTube - Awareness', objective: 'BRAND_AWARENESS' }
        ];
        adsets = [
            { id: 'a1', name: 'Palavras-Chave Marca', c_id: 'c1' },
            { id: 'a2', name: 'Produtos Mais Vendidos', c_id: 'c2' },
            { id: 'a3', name: 'Interesses - Tecnologia', c_id: 'c3' }
        ];
        ads = [
            { id: 'ad1', name: 'Anúncio de Texto Responsivo', as_id: 'a1' },
            { id: 'ad2', name: 'Shopping - Produto X', as_id: 'a2' },
            { id: 'ad3', name: 'Vídeo Bumper 6s', as_id: 'a3' }
        ];
    } else if (platform === 'tiktok_ads') {
        campaigns = [
            { id: 'c1', name: 'Desafio Viral - Hashtag', objective: 'REACH' },
            { id: 'c2', name: 'Conversão - App Install', objective: 'APP_INSTALL' }
        ];
        adsets = [
            { id: 'a1', name: 'Gen Z - Brasil', c_id: 'c1' },
            { id: 'a2', name: 'Interesse em Games', c_id: 'c2' }
        ];
        ads = [
            { id: 'ad1', name: 'Vídeo UGC Creator', as_id: 'a1' },
            { id: 'ad2', name: 'Gameplay Demo', as_id: 'a2' }
        ];
    } else if (platform === 'linkedin_ads') {
        campaigns = [
            { id: 'c1', name: 'Geração de Leads B2B', objective: 'LEAD_GENERATION' },
            { id: 'c2', name: 'Conteúdo Patrocinado - Blog', objective: 'ENGAGEMENT' }
        ];
        adsets = [
            { id: 'a1', name: 'Cargo: Diretor/CEO', c_id: 'c1' },
            { id: 'a2', name: 'Setor: Tecnologia', c_id: 'c2' }
        ];
        ads = [
            { id: 'ad1', name: 'Formulário Nativo', as_id: 'a1' },
            { id: 'ad2', name: 'Single Image - Ebook', as_id: 'a2' }
        ];
    } else {
        // Meta Ads (Default)
        campaigns = [
            { id: 'c1', name: 'Campanha de Vendas - Black Friday', objective: 'SALES' },
            { id: 'c2', name: 'Tráfego Frio - Institucional', objective: 'TRAFFIC' },
            { id: 'c3', name: 'Remarketing - Checkout', objective: 'CONVERSIONS' }
        ];
        adsets = [
            { id: 'a1', name: 'Aberto - Brasil', c_id: 'c1' },
            { id: 'a2', name: 'Lookalike 1%', c_id: 'c1' },
            { id: 'a3', name: 'Interesses - Marketing', c_id: 'c2' },
            { id: 'a4', name: 'Visitantes 30D', c_id: 'c3' }
        ];
        ads = [
            { id: 'ad1', name: 'Vídeo Depoimento', as_id: 'a1' },
            { id: 'ad2', name: 'Imagem Estática - Oferta', as_id: 'a1' },
            { id: 'ad3', name: 'Carrossel Produtos', as_id: 'a2' },
            { id: 'ad4', name: 'Vídeo Institucional', as_id: 'a3' },
            { id: 'ad5', name: 'Imagem "Você esqueceu"', as_id: 'a4' }
        ];
    }

    // Loop through dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Generate entries for each ad
        ads.forEach(ad => {
            const adset = adsets.find(a => a.id === ad.as_id);
            const campaign = campaigns.find(c => c.id === adset.c_id);
            
            // Random Metrics
            const impressions = Math.floor(Math.random() * 5000) + 100;
            const ctr = (Math.random() * 2 + 0.5) / 100; // 0.5% to 2.5%
            const clicks = Math.floor(impressions * ctr);
            const cpc = Math.random() * 1.5 + 0.5; // 0.50 to 2.00
            const spend = clicks * cpc;
            
            let conversions = 0;
            let conversionValue = 0;
            
            if (campaign.objective === 'SALES' || campaign.objective === 'CONVERSIONS') {
                const cvr = (Math.random() * 3) / 100; // 0 to 3%
                conversions = Math.floor(clicks * cvr);
                conversionValue = conversions * (Math.random() * 100 + 50); // Ticket 50-150
            }

            data.push({
                date: dateStr,
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                adset_id: adset.id,
                adset_name: adset.name,
                ad_id: ad.id,
                ad_name: ad.name,
                status: 'ACTIVE',
                effective_status: 'ACTIVE',
                impressions: impressions,
                clicks: clicks,
                spend: spend.toFixed(2),
                conversions: conversions,
                conversion_values: conversionValue.toFixed(2),
                objective: campaign.objective
            });
        });
    }
    
    return data;
}

// --- Stepper Logic (Criar Campanha) ---
let currentStep = 1;
const totalSteps = 5;

window.updateStepperButtons = function() {
    const prevBtn = document.getElementById('btn-prev-step');
    const nextBtn = document.getElementById('btn-next-step');
    const submitBtn = document.getElementById('btn-submit-campanha');
    
    if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'flex';
    
    if (nextBtn) {
        if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            if (submitBtn) submitBtn.classList.remove('hidden');
        } else {
            nextBtn.style.display = 'flex';
            if (submitBtn) submitBtn.classList.add('hidden');
        }
    }

    // Update Step Indicators
    document.querySelectorAll('.step-item').forEach(item => {
        const step = parseInt(item.getAttribute('data-step'));
        if (step === currentStep) {
            item.classList.add('active');
            item.classList.remove('completed', 'opacity-50');
        } else if (step < currentStep) {
            item.classList.add('completed');
            item.classList.remove('active', 'opacity-50');
            item.querySelector('.w-8').innerHTML = '<i class="fas fa-check"></i>';
        } else {
            item.classList.remove('active', 'completed');
            item.classList.add('opacity-50');
            item.querySelector('.w-8').textContent = step;
        }
    });

    // Show Content
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const currentContent = document.getElementById(`step-${currentStep}`);
    if (currentContent) currentContent.classList.remove('hidden');

    if (currentStep === 5) window.updateReviewStep();
};

window.nextStep = function() {
    if (currentStep < totalSteps) {
        // Validate?
        currentStep++;
        updateStepperButtons();
    }
};

window.prevStep = function() {
    if (currentStep > 1) {
        currentStep--;
        updateStepperButtons();
    }
};

window.updateReviewStep = function() {
    const form = document.getElementById('form-campanha-stepper');
    if (!form) return;
    
    const formData = new FormData(form);
    const reviewDiv = document.getElementById('review-content');
    if (!reviewDiv) return;

    let html = '<div class="grid grid-cols-2 gap-4 text-sm">';
    
    // Map friendly names
    const fields = {
        platform: 'Plataforma',
        ad_account: 'Conta de Anúncio',
        objective: 'Objetivo',
        campaign_name: 'Nome da Campanha',
        daily_budget: 'Orçamento Diário',
        start_date: 'Início'
    };

    for (const [key, label] of Object.entries(fields)) {
        const val = formData.get(key) || '-';
        html += `
            <div class="p-3 bg-gray-50 rounded-lg">
                <span class="block text-xs text-gray-500 font-bold uppercase">${label}</span>
                <span class="font-medium text-gray-900">${val}</span>
            </div>
        `;
    }
    html += '</div>';
    reviewDiv.innerHTML = html;
};

window.handleCreateCampaignStepper = async function(event) {
    event.preventDefault();
    const clientId = document.getElementById('filter-cliente')?.value;
    if (!clientId) {
        alert('Selecione um cliente no filtro principal (topo da página) para criar a campanha.');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-campanha');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
    submitBtn.disabled = true;

    try {
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());

        const connections = trafficConnectionsCache[clientId] || await window.getConnectedPlatforms(clientId);
        trafficConnectionsCache[clientId] = connections;
        const connectedSet = new Set((connections.connected || []).map(item => item.platform));
        const requiredPlatforms = getTrafficPlatformConnections(data.platform);
        const isConnected = requiredPlatforms.some(p => connectedSet.has(p));

        if (!isConnected) {
            showCampaignConnectionCTA(clientId, getTrafficPlatformLabel(data.platform));
            return;
        }

        clearCampaignConnectionCTA();
        
        const payload = {
            cliente_id: clientId,
            campaign_name: data.campaign_name,
            objective: data.objective,
            platform: data.platform,
            daily_budget: data.daily_budget ? parseFloat(data.daily_budget) : 0,
            start_date: data.start_date || null,
            target_audience: data.target_audience,
            creative_url: data.creative_url,
            status: 'draft', 
            ad_account: data.ad_account
        };
        
        console.log('Payload da Campanha:', payload);
        
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('traffic_campaigns')
                .insert([payload]);

            if (error) throw error;
        }

        if (window.Logbook && window.Logbook.addAction) {
            window.Logbook.addAction({
                clienteId: clientId,
                module: 'trafego_pago',
                actionType: 'campaign_created',
                title: 'Campanha criada',
                details: JSON.stringify({
                    platform: payload.platform,
                    campaign_name: payload.campaign_name,
                    objective: payload.objective,
                    daily_budget: payload.daily_budget,
                    start_date: payload.start_date
                }),
                refType: 'traffic_campaign',
                refId: null
            });
        }

        alert('Campanha criada com sucesso! Ela aparecerá na lista de campanhas.');
        event.target.reset();
        currentStep = 1;
        updateStepperButtons();
        window.switchTab('overview'); 

    } catch (e) {
        console.error('Erro ao criar campanha:', e);
        alert('Erro ao criar campanha: ' + (e.message || 'Erro desconhecido'));
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
};

// Aliases
window.handleCreateCampaign = window.handleCreateCampaignStepper;
window.trackCampaignsToday = function() {
    alert('Funcionalidade de rastreamento em tempo real será implementada em breve.');
};

// --- Initialization ---

window.initTrafegoPago = function() {
    const clientSelect = document.getElementById('filter-cliente');
    const activeClientId = typeof window.getActiveClientId === 'function' ? window.getActiveClientId() : '';
    const clientId = clientSelect?.value || activeClientId;
    if (clientSelect && activeClientId && clientSelect.value !== activeClientId) {
        clientSelect.value = activeClientId;
    }

    if (!clientId) {
        // renderEmptyState(); 
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        let tabId = urlParams.get('tab');

        if (!tabId) {
            const activeTabBtn = document.querySelector('.tab-btn.active');
            tabId = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'overview';
        }

        if (window.switchTab) window.switchTab(tabId);
    }
};

window.loadTrafficClients = async function() {
    console.log('Iniciando carregamento de clientes do Tráfego Pago...');
    
    if (!window.supabaseClient) {
        console.warn('Supabase não disponível para carregar clientes.');
        return;
    }

    const clientSelects = [
        document.getElementById('filter-cliente'),
        document.getElementById('report-client-select'),
        document.getElementById('log-cliente')
    ].filter(el => el !== null);

    if (clientSelects.length === 0) {
        console.warn('Nenhum seletor de cliente encontrado.');
        return;
    }

    try {
        console.log('Consultando clientes no Supabase...');
        const { data: clients, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_fantasia, nome_empresa')
            .in('status', ['ativo', 'Ativo']) 
            .order('nome_fantasia');

        if (error) throw error;

        const uniqueClients = Array.isArray(clients)
            ? Array.from(new Map(clients.map(client => [String(client.id), client])).values())
            : [];

        clientSelects.forEach(select => {
            const currentValue = select.value;
            while (select.options.length > 1) {
                select.remove(1);
            }

            uniqueClients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.nome_fantasia || client.nome_empresa;
                select.appendChild(option);
            });

            if (currentValue && uniqueClients.some(c => c.id === currentValue)) {
                select.value = currentValue;
            } 
            else if (select.id === 'filter-cliente') {
                const savedClient = typeof window.getActiveClientId === 'function' ? window.getActiveClientId() : '';
                if (savedClient && uniqueClients.some(c => String(c.id) === String(savedClient))) {
                    select.value = savedClient;
                    window.initTrafegoPago();
                }
            }
        });

        const mainSelect = document.getElementById('filter-cliente');
        if (mainSelect?.value) updateTrafficPlatformAvailability(mainSelect.value);
        const reportSelect = document.getElementById('report-client-select');
        if (reportSelect?.value) updateTrafficPlatformAvailability(reportSelect.value);

    } catch (err) {
        console.error('Erro ao carregar clientes:', err);
    }
};

// --- PDF Export (Manual: html2canvas + jsPDF + AutoTable) ---
window.exportReportPDF = async function () {
    const element = document.getElementById('report-preview');
    if (!element || element.classList.contains('hidden')) {
        alert('Gere o relatório primeiro antes de exportar.');
        return;
    }

    // Captura o nome do cliente diretamente do elemento atualizado no DOM
    const clientNameText = document.getElementById('report-client-name')?.textContent || '';
    // Remove o prefixo "Cliente: " para obter apenas o nome limpo
    const clientName = clientNameText.replace('Cliente: ', '').trim() || 'Relatorio';
    const dateStr = new Date().toISOString().split('T')[0];

    // Feedback visual
    const btn = document.querySelector('button[onclick="exportReportPDF()"]');
    const originalText = btn ? btn.innerHTML : 'Exportar PDF';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';
        btn.disabled = true;
    }

    try {
        // Garantir jsPDF
        const { jsPDF } = window.jspdf;
        if (!jsPDF) throw new Error('Biblioteca jsPDF não carregada.');

        // 1. Clonar e preparar conteúdo para Página 1 (Cards + Gráfico)
        const clone = element.cloneNode(true);
        
        // Limpar estilos conflitantes no clone
                clone.style.margin = '0';
                clone.style.padding = '40px'; // Padding visual para o PDF
                clone.style.width = '1123px'; // A4 Landscape width @ 96dpi
                clone.style.maxWidth = '1123px';
                clone.style.height = 'auto';
                clone.style.overflow = 'visible';
                clone.style.transform = 'none';
                clone.style.boxShadow = 'none';
                clone.style.background = 'white';
                clone.classList.remove('md:w-[calc(100%-250px)]', 'ml-auto', 'overflow-y-auto', 'h-full');

        // Remover a tabela e a análise do gestor do clone
                const tableContainer = clone.querySelector('table')?.closest('.overflow-hidden');
                if (tableContainer) {
                    tableContainer.remove();
                } else {
                    const table = clone.querySelector('table');
                    if (table) table.remove();
                }

                // Remover seção de análise do clone (será movida para página 2)
                const titles = clone.querySelectorAll('h3');
                titles.forEach(h3 => {
                    if (h3.textContent.includes('Detalhamento de Performance') || h3.textContent.includes('Análise do Gestor')) {
                        h3.parentElement?.remove();
                    }
                });
                
                // Remover textareas soltas se houver
                const textareas = clone.querySelectorAll('textarea');
                textareas.forEach(t => t.parentElement?.remove());

        // 2. Converter Canvas em Imagens
        const originalCanvases = element.querySelectorAll('canvas');
        const clonedCanvases = clone.querySelectorAll('canvas');

        originalCanvases.forEach((origCanvas, index) => {
            const clonedCanvas = clonedCanvases[index];
            if (clonedCanvas) {
                const img = document.createElement('img');
                img.src = origCanvas.toDataURL('image/png', 1.0);
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.maxHeight = '300px';
                img.style.objectFit = 'contain';
                clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
            }
        });

        // Wrapper temporário
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.top = '-9999px';
        wrapper.style.left = '0';
        wrapper.style.width = '1123px'; // A4 Landscape
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        // 3. Capturar Imagem da Página 1
        const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1123,
            backgroundColor: '#ffffff'
        });

        document.body.removeChild(wrapper);

        // 4. Criar PDF e adicionar Página 1
        const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = Landscape
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // 5. Preparar dados para Tabela (Página 2)
        const originalTable = element.querySelector('table');
        let tableHead = [];
        let tableBody = [];

        if (originalTable) {
            const ths = originalTable.querySelectorAll('thead th');
            // Usar textContent para garantir texto completo (ignorando truncate do HTML)
            const headers = Array.from(ths).map(th => th.textContent.trim());
            tableHead.push(headers);

            const trs = originalTable.querySelectorAll('tbody tr');
            trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                const row = Array.from(tds).map((td, index) => {
                    // Usar textContent para pegar o valor integral
                    let text = td.textContent.trim();
                    if (text === 'undefined' || text === 'null' || text === '') {
                        if (index >= 5) return '0';
                        return '-';
                    }
                    return text;
                });
                tableBody.push(row);
            });
        }

        // 6. Adicionar Página 2: Análise + Tabela
        if (tableBody.length > 0) {
            // Adicionar página (herdará formato Landscape do documento)
            pdf.addPage();
            
            // Cabeçalho com Nome do Cliente
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Relatório de Tráfego - ${clientName}`, 14, 15);
            
            let currentY = 25;

            // --- Análise do Gestor (Agora na Página 2) ---
            const analysisTextarea = element.querySelector('textarea');
            const analysisText = analysisTextarea ? analysisTextarea.value.trim() : '';

            if (analysisText) {
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Análise do Gestor', 14, currentY);
                currentY += 6;

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                
                // Quebrar texto para caber na largura (A4 Landscape ~297mm -> ~280mm margem útil)
                const splitText = pdf.splitTextToSize(analysisText, 270);
                pdf.text(splitText, 14, currentY);
                
                // Atualizar Y baseado no tamanho do texto
                currentY += (splitText.length * 5) + 10;
            }

            // --- Detalhamento de Performance ---
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Detalhamento de Performance', 14, currentY);
            currentY += 6;

            pdf.autoTable({
                head: tableHead,
                body: tableBody,
                startY: currentY,
                margin: { left: 14, right: 14 }, // Margens ajustadas para Landscape
                theme: 'grid',
                styles: {
                    fontSize: 7, // Fonte levemente menor para caber mais colunas
                    cellPadding: 3,
                    overflow: 'visible', // Permite que o texto extrapole a largura calculada se necessário (mas cellWidth: 'wrap' expande a célula)
                    cellWidth: 'wrap', // Força a célula a ter a largura do conteúdo (white-space: nowrap)
                    font: 'helvetica',
                    textColor: [40, 40, 40],
                    valign: 'middle'
                },
                headStyles: {
                    fillColor: [249, 250, 251],
                    textColor: [75, 85, 99],
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [229, 231, 235],
                    valign: 'middle'
                },
                columnStyles: {
                    // Ajuste fino para colunas numéricas
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                    7: { halign: 'right' },
                    8: { halign: 'right' },
                    9: { halign: 'right' },
                    10: { halign: 'right' },
                    11: { halign: 'right' },
                    12: { halign: 'right' }
                },
                // Garantir que não haja quebra de página horizontal
                horizontalPageBreak: false
            });
        }

        // 7. Salvar PDF
        pdf.save(`Relatorio_Trafego_${clientName}_${dateStr}.pdf`);

    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        alert('Erro ao gerar PDF: ' + err.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// Event Listeners
window.addEventListener('supabaseReady', () => {
    window.loadTrafficClients();
});

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            window.switchTab(targetId);
        });
    });

    if (window.supabaseClient) {
        window.loadTrafficClients();
    }
    
    // Polling de segurança
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        const select = document.getElementById('filter-cliente');
        if (select && select.options.length > 1) {
            clearInterval(poll);
        } else if (window.supabaseClient) {
            window.loadTrafficClients();
        }
        if (attempts > 5) clearInterval(poll);
    }, 2000);
    
    window.addEventListener('focus', () => {
        const select = document.getElementById('filter-cliente');
        if (select && select.options.length <= 1) {
            window.loadTrafficClients();
        }
    });

    updateStepperButtons();
    
    if(window.updateReportDates) window.updateReportDates();
    const periodSelect = document.getElementById('report-period-select');
    if(periodSelect) periodSelect.addEventListener('change', window.updateReportDates);

    const filterSelect = document.getElementById('filter-cliente');
    if (filterSelect) {
        filterSelect.addEventListener('change', (event) => {
            if (typeof window.setActiveClientId === 'function') {
                window.setActiveClientId(event.target.value);
            }
            updateTrafficPlatformAvailability(event.target.value);
            clearCampaignConnectionCTA();
        });
    }

    const reportSelect = document.getElementById('report-client-select');
    if (reportSelect) {
        reportSelect.addEventListener('change', (event) => {
            if (typeof window.setActiveClientId === 'function') {
                window.setActiveClientId(event.target.value);
            }
            updateTrafficPlatformAvailability(event.target.value);
        });
    }

    const logSelect = document.getElementById('log-cliente');
    if (logSelect) {
        logSelect.addEventListener('change', (event) => {
            if (typeof window.setActiveClientId === 'function') {
                window.setActiveClientId(event.target.value);
            }
        });
    }
});
