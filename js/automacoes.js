// automacoes.js - Módulo de Automação v2.0
const API_BASE = `${window.API_BASE_URL || window.location?.origin || ''}/api/automation`;

document.addEventListener('DOMContentLoaded', () => {
    // Tenta liberar a tela de loading usando a função global do app.js
    if (window.showContent) {
        window.showContent();
    } else {
        // Fallback manual se app.js não tiver carregado a tempo
        const loading = document.querySelector('#loading-screen');
        const wrapper = document.querySelector('.dashboard-wrapper');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
                if (wrapper) wrapper.style.display = 'flex';
            }, 500);
        } else if (wrapper) {
            wrapper.style.display = 'flex';
        }
    }

    // Sempre inicia as automações
    initAutomations();
});

let currentTenantId = null;
let allWorkflows = []; // Store locally for filtering

// Mock Current User (Simulando sessão)
const currentUser = {
    id: 'user_123',
    name: 'Stephanie (Admin)',
    photo: 'assets/avatar_placeholder.png' // Certifique-se de ter uma imagem ou use um placeholder genérico
};

async function getAutomationAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const sessionResult = await window.supabaseClient?.auth?.getSession();
    const token = sessionResult?.data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function fetchWorkflowsFromApi() {
    const headers = await getAutomationAuthHeaders();
    const response = await fetch(`${API_BASE}/workflows`, { headers });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
        const message = json?.error || json?.message || 'erro_ao_buscar_workflows';
        throw new Error(message);
    }
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.workflows)) return json.workflows;
    return [];
}

async function initAutomations() {
    // Aguardar Supabase estar pronto
    if (!window.supabaseClient) {
        console.log('Aguardando Supabase...');
        setTimeout(initAutomations, 500);
        return;
    }

    // 1. Carregar Clientes e Colaboradores (tentativa resiliente)
    try {
        await Promise.allSettled([loadTenants(), loadCollaborators()]);
    } catch (err) {
        console.warn('Erro ao carregar filtros iniciais:', err);
    }
    
    // 2. Verificar URL Params para navegação
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
        switchTab(tab);
    } else {
        // Default load if no tab
        loadDashboardData();
    }
}

async function loadTenants() {
    const filterSelect = document.getElementById('filter-cliente-workflow');
    const modalSelect = document.getElementById('wf-client');
    const filterBackup = document.getElementById('filter-backup-client');
    const logbookFilter = document.getElementById('logbook-client-filter');
    const logbookModal = document.getElementById('logbook-cliente');
    
    try {
        const { data: clientes, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_empresa');
            
        if (clientes) {
            // Helper function to populate select
            const populate = (select, placeholder) => {
                if(!select) return;
                select.innerHTML = `<option value="">${placeholder}</option>`;
                clientes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nome_empresa;
                    select.appendChild(opt);
                });
            };

            populate(filterSelect, 'Todos os Clientes');
            populate(modalSelect, 'Selecione o Cliente...');
            populate(filterBackup, 'Selecione o Cliente...');
            populate(logbookFilter, 'Selecione o Cliente');
            populate(logbookModal, 'Selecione...');
        }
    } catch (e) {
        console.error('Erro ao carregar clientes:', e);
    }
}

// --- TAB NAVIGATION ---
window.switchTab = function(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    
    // Reset buttons style
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-primary', 'text-primary');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Show target
    const target = document.getElementById(tabId);
    if(target) {
        target.classList.add('active');
        target.classList.remove('hidden');
    }
    
    // Update button state
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if(btn) {
        btn.classList.add('active', 'border-primary', 'text-primary');
        btn.classList.remove('border-transparent', 'text-gray-500');
    }

    // Load Data Specific to Tab
    if (tabId === 'fluxos') loadWorkflows();
    if (tabId === 'backups') { /* Load backups logic if needed initially, or wait for selection */ }
    if (tabId === 'visao_geral_automacoes') loadDashboardData();
    if (tabId === 'diario_bordo') {
        const selectedClient = document.getElementById('logbook-client-filter')?.value || '';
        if (selectedClient) {
            loadLogbookRecords(selectedClient);
        }
    }
}

window.connectProvider = function(provider) {
    alert('Conectar: ' + provider);
}

window.openProviderDetails = function(provider) {
    alert('Detalhes: ' + provider);
}

// --- DATA LOADING ---

// Mock de Colaboradores (removido, inicia vazio)
let allCollaborators = [];

async function loadCollaborators() {
    const select = document.getElementById('wf-responsible');
    if (!select) return;

    try {
        // Busca todos os colaboradores para filtrar no cliente (mais seguro contra falhas de query)
        const { data, error } = await window.supabaseClient
            .from('colaboradores')
            .select('id, nome, foto_url, perfil_acesso, permissoes')
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao buscar colaboradores:', error);
            throw error;
        }

        if (data && data.length > 0) {
            // Filtra: Super Admin OU Admin OU tem permissão de automações
            allCollaborators = data.filter(c => {
                const isSuper = c.perfil_acesso === 'super_admin';
                const isAdmin = c.perfil_acesso === 'admin';
                const hasPermission = c.permissoes && Array.isArray(c.permissoes) && c.permissoes.includes('automacoes');
                
                return isSuper || isAdmin || hasPermission;
            });
        } else {
            allCollaborators = [];
        }
    } catch (e) {
        console.warn('Não foi possível carregar colaboradores:', e.message);
        allCollaborators = [];
    }

    // Preenche Select
    select.innerHTML = '<option value="">Selecione um colaborador...</option>';
    
    if (allCollaborators.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = 'Nenhum colaborador habilitado encontrado';
        select.appendChild(opt);
    } else {
        allCollaborators.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome;
            select.appendChild(opt);
        });
    }
}

async function loadDashboardData() {
    // Carrega dados globais (todos os tenants ou filtrado se tivessemos filtro global)
    try {
        const { count } = await window.supabaseClient
            .from('workflows')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');
        
        if(document.getElementById('kpi-active-workflows'))
            document.getElementById('kpi-active-workflows').textContent = count || 0;
            
        renderExecutionChart();
        loadLLMUsage(); // Carrega dados de consumo LLM
        
    } catch (e) {
        console.warn('Erro ao carregar KPI:', e);
    }
}

// --- LLM USAGE TRACKING ---
async function loadLLMUsage() {
    try {
        const { data, error } = await window.supabaseClient
            .from('configuracoes')
            .select('key, value')
            .in('key', ['llm_provider', 'llm_usage_value', 'llm_last_recharge']);

        if (error) throw error;

        // Default values
        let provider = 'OpenAI';
        let usage = '0.00';
        let recharge = '-';

        if (data) {
            data.forEach(item => {
                if (item.key === 'llm_provider') provider = item.value;
                if (item.key === 'llm_usage_value') usage = item.value;
                if (item.key === 'llm_last_recharge') recharge = item.value;
            });
        }

        // Format Currency
        const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedUsage = formatter.format(parseFloat(usage) || 0);

        // Format Date
        let formattedRecharge = '-';
        if (recharge !== '-' && recharge) {
            const parts = recharge.split('-');
            if(parts.length === 3) {
                formattedRecharge = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                formattedRecharge = recharge;
            }
        }

        // Update UI
        const elUsage = document.getElementById('llm-usage-display');
        const elProvider = document.getElementById('llm-provider-display');
        const elRecharge = document.getElementById('llm-last-recharge-display');

        if (elUsage) elUsage.innerText = formattedUsage;
        if (elProvider) elProvider.innerText = provider;
        if (elRecharge) elRecharge.innerText = formattedRecharge;

        // Store for Edit Modal
        window.currentLLMData = { provider, usage, recharge };

    } catch (e) {
        console.error('Erro ao carregar consumo LLM:', e);
    }
}

window.editLLMUsage = function() {
    const data = window.currentLLMData || { provider: 'OpenAI', usage: '0.00', recharge: '' };
    
    document.getElementById('llm-provider').value = data.provider;
    document.getElementById('llm-usage-value').value = data.usage;
    document.getElementById('llm-last-recharge').value = data.recharge;
    
    // Reset tab to manual
    if(window.switchModalTab) switchModalTab('manual');

    const modal = document.getElementById('modal-llm-usage');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

window.switchModalTab = function(mode) {
    const tabManual = document.getElementById('modal-tab-manual');
    const tabAuto = document.getElementById('modal-tab-auto');
    const btns = document.querySelectorAll('#modal-llm-usage .tab-btn');

    if(mode === 'manual') {
        tabManual.classList.remove('hidden');
        tabAuto.classList.add('hidden');
        
        btns[0].classList.add('text-primary', 'border-primary');
        btns[0].classList.remove('text-gray-500', 'border-transparent');
        
        btns[1].classList.remove('text-primary', 'border-primary');
        btns[1].classList.add('text-gray-500', 'border-transparent');
    } else {
        tabManual.classList.add('hidden');
        tabAuto.classList.remove('hidden');
        
        btns[1].classList.add('text-primary', 'border-primary');
        btns[1].classList.remove('text-gray-500', 'border-transparent');
        
        btns[0].classList.remove('text-primary', 'border-primary');
        btns[0].classList.add('text-gray-500', 'border-transparent');

        // Populate API Info
        const url = 'https://gbqknmejsmnizjdnopnq.supabase.co/rest/v1/configuracoes';
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicWtubWVqc21uaXpqZG5vcG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjkyOTMsImV4cCI6MjA3ODgwNTI5M30.w-v_CW3X5DF9x_nnFe3Lhvw_JyrXxfXKv7tPIZAjGaU';
        
        if(document.getElementById('api-url-display')) {
            document.getElementById('api-url-display').textContent = url;
            document.getElementById('api-key-display').textContent = key;
            document.getElementById('api-key-display-2').textContent = key;
        }
    }
}

window.copyJSON = function() {
    const json = `[
  {
    "key": "llm_usage_value",
    "value": "123.45", 
    "description": "Atualizado via n8n"
  },
  {
    "key": "llm_last_recharge",
    "value": "${new Date().toISOString().split('T')[0]}",
    "description": "Data da verificação"
  }
]`;
    navigator.clipboard.writeText(json).then(() => alert('JSON copiado para a área de transferência!'));
}

window.saveLLMUsage = async function(e) {
    e.preventDefault();
    
    const provider = document.getElementById('llm-provider').value;
    const usage = document.getElementById('llm-usage-value').value.replace(',', '.'); // Normalize decimal
    const recharge = document.getElementById('llm-last-recharge').value;

    try {
        const updates = [
            { key: 'llm_provider', value: provider, description: 'Provedor de IA selecionado' },
            { key: 'llm_usage_value', value: usage, description: 'Valor atual de consumo da IA' },
            { key: 'llm_last_recharge', value: recharge, description: 'Data da última recarga de créditos IA' }
        ];

        const { error } = await window.supabaseClient
            .from('configuracoes')
            .upsert(updates);

        if (error) throw error;

        alert('Consumo atualizado com sucesso!');
        closeModal('modal-llm-usage');
        loadLLMUsage();

    } catch (err) {
        console.error('Erro ao salvar consumo LLM:', err);
        alert('Erro ao salvar: ' + err.message);
    }
}

async function loadWorkflows() {
    const tbody = document.getElementById('table-workflows');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">Carregando...</td></tr>';

    try {
        let workflowsData = null;
        const { data, error } = await window.supabaseClient
            .from('workflows')
            .select(`*, clientes ( nome_empresa, nome_fantasia )`)
            .order('created_at', { ascending: false });

        if (!error) {
            workflowsData = data || [];
        } else {
            const { data: plainData, error: plainError } = await window.supabaseClient
                .from('workflows')
                .select('*')
                .order('created_at', { ascending: false });

            if (plainError) throw plainError;

            const tenantIds = Array.from(new Set((plainData || []).map(wf => wf.tenant_id).filter(Boolean)));
            let clientMap = {};
            if (tenantIds.length) {
                const { data: clientsData } = await window.supabaseClient
                    .from('clientes')
                    .select('id, nome_empresa, nome_fantasia')
                    .in('id', tenantIds);
                (clientsData || []).forEach(client => {
                    clientMap[client.id] = client;
                });
            }

            workflowsData = (plainData || []).map(wf => ({
                ...wf,
                clientes: clientMap[wf.tenant_id] || null
            }));
        }

        allWorkflows = workflowsData || [];

        renderWorkflowsTable(allWorkflows);

    } catch (e) {
        console.error('Erro ao carregar fluxos (Supabase):', e);
        try {
            const apiWorkflows = await fetchWorkflowsFromApi();
            allWorkflows = apiWorkflows || [];
            renderWorkflowsTable(allWorkflows);
            return;
        } catch (apiError) {
            console.error('Erro ao carregar fluxos (API):', apiError);
        }
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-red-500">Erro ao carregar fluxos.</td></tr>';
    }
}

function renderWorkflowsTable(workflows) {
    const tbody = document.getElementById('table-workflows');
    tbody.innerHTML = '';
    
    if (workflows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">Nenhum fluxo encontrado.</td></tr>';
        return;
    }

    workflows.forEach(wf => {
        // Tenta extrair metadados extras da descrição (hack para persistência sem mudar schema agora)
        let meta = {};
        try {
            if (wf.description && wf.description.startsWith('{')) {
                meta = JSON.parse(wf.description);
            }
        } catch(e) {}

        const environment = meta.environment || wf.environment || 'dev'; // Default dev
        const integration = meta.integration || '-';
        const version = meta.version || '1.0';
        const clientName = wf.clientes?.nome_fantasia || wf.clientes?.nome_empresa || 'Cliente Desconhecido';

        // Cores de Status e Ambiente - Usando classes Tailwind
        const statusClass = wf.status === 'active' 
            ? 'text-green-600 font-semibold' 
            : 'text-red-500 font-semibold';
        
        const statusLabel = wf.status === 'active' ? 'Ativo' : 'Inativo';
        const statusDot = wf.status === 'active' ? '●' : '●';
        
        let envBadge = '';
        if(environment === 'dev') envBadge = '<span class="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Em Desenvolvimento</span>';
        else if(environment === 'test') envBadge = '<span class="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">Em Teste</span>';
        else envBadge = `<span class="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full bg-gray-100 text-gray-800 border border-gray-200">${environment}</span>`;

        // Assinatura Automática (Quem e Quando)
        let signatureHtml = '';
        if (meta.last_editor) {
            const photo = meta.last_editor.photo || 'assets/avatar_placeholder.png';
            const date = new Date(meta.last_editor.time).toLocaleString('pt-BR');
            signatureHtml = `
                <div class="flex items-center mt-1 text-xs text-gray-400">
                    <img src="${photo}" class="w-4 h-4 rounded-full mr-1.5" title="Responsável: ${meta.responsible_name || 'N/A'}">
                    <span>${meta.last_editor.name} em ${date}</span>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0';
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${wf.name}</div>
                ${signatureHtml}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${clientName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="${statusClass} text-xs uppercase tracking-wide flex items-center gap-1.5">${statusDot} ${statusLabel}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${envBadge}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs bg-gray-50 px-2 py-1 rounded inline-block mt-2">${integration}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${version}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-primary hover:text-primary/80 mr-3 p-1.5 hover:bg-primary/10 rounded transition-colors" onclick="createSnapshot('${wf.id}')" title="Backup"><i class="fas fa-camera"></i></button>
                <button class="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors" onclick="togglePause('${wf.id}')" title="Pausar"><i class="fas fa-power-off"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

const LOGBOOK_API_BASE = window.API_BASE_URL || window.location?.origin || '';
let currentLogbookClientId = '';

const parseLogbookDetails = (details) => {
    if (!details) return {};
    if (typeof details === 'object') return details;
    if (typeof details === 'string') {
        try {
            return JSON.parse(details);
        } catch {
            return {};
        }
    }
    return {};
};

const formatLogbookDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
};

const buildLogbookSummary = (item, details) => {
    const candidates = [
        details?.descricao,
        details?.description,
        details?.details,
        item?.title
    ];
    const found = candidates.find((text) => text && String(text).trim().length);
    return found ? String(found) : '-';
};

const getLogbookApiHeaders = async () => {
    if (typeof getAutomationAuthHeaders === 'function') {
        return await getAutomationAuthHeaders();
    }
    return {};
};

const setLogbookCreatedAt = (date = new Date()) => {
    const display = document.getElementById('logbook-created-at-display');
    const iso = document.getElementById('logbook-created-at-iso');
    if (display) display.value = date.toLocaleString('pt-BR');
    if (iso) iso.value = date.toISOString();
};

window.openLogbookModal = function() {
    const modal = document.getElementById('logbook-modal');
    if (!modal) return;
    const selectedClient = document.getElementById('logbook-client-filter')?.value || '';
    const clienteSelect = document.getElementById('logbook-cliente');
    if (clienteSelect) clienteSelect.value = selectedClient;
    document.getElementById('logbook-tipo').value = '';
    document.getElementById('logbook-status').value = 'aberto';
    document.getElementById('logbook-prioridade').value = 'media';
    document.getElementById('logbook-solicitante').value = '';
    document.getElementById('logbook-descricao').value = '';
    document.getElementById('logbook-acoes').value = '';
    document.getElementById('logbook-prazo').value = '';
    setLogbookCreatedAt(new Date());
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeLogbookModal = function() {
    const modal = document.getElementById('logbook-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.saveLogbookRecord = async function(e) {
    e.preventDefault();
    const clienteId = document.getElementById('logbook-cliente').value;
    const actionType = document.getElementById('logbook-tipo').value;
    const status = document.getElementById('logbook-status').value;
    const prioridade = document.getElementById('logbook-prioridade').value;
    const solicitante = document.getElementById('logbook-solicitante').value;
    const descricao = document.getElementById('logbook-descricao').value;
    const acoesTomadas = document.getElementById('logbook-acoes').value;
    const prazo = document.getElementById('logbook-prazo').value || null;
    const createdAtIso = document.getElementById('logbook-created-at-iso').value || new Date().toISOString();

    if (!clienteId) {
        alert('Selecione um cliente.');
        return;
    }
    if (!actionType) {
        alert('Selecione o tipo de ação.');
        return;
    }

    const detailsPayload = {
        status,
        prioridade,
        solicitante,
        descricao,
        acoes_tomadas: acoesTomadas,
        prazo,
        created_at: createdAtIso
    };

    const payload = {
        cliente_id: clienteId,
        module: 'automacoes',
        action_type: actionType,
        title: `Registro - ${actionType}`,
        details: JSON.stringify(detailsPayload),
        ref_type: 'automation_log',
        ref_id: null,
        created_at: createdAtIso
    };

    try {
        if (window.Logbook?.addAction) {
            const result = await window.Logbook.addAction(payload);
            if (result) {
                alert('Registro salvo com sucesso!');
                window.closeLogbookModal();
                currentLogbookClientId = clienteId;
                loadLogbookRecords(clienteId);
                return;
            }
        }
    } catch (err) {
        console.warn('Falha ao salvar no diário, tentando backend:', err);
    }

    try {
        const headers = await getLogbookApiHeaders();
        const res = await fetch(`${LOGBOOK_API_BASE}/api/logbook/actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(headers || {}) },
            body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'Erro ao salvar registro');
        alert('Registro salvo com sucesso!');
        window.closeLogbookModal();
        currentLogbookClientId = clienteId;
        loadLogbookRecords(clienteId);
    } catch (apiError) {
        console.warn('Erro ao salvar registro (API):', apiError);
        alert('Não foi possível salvar o registro. Tente novamente.');
    }
};

async function loadLogbookRecords(clienteId) {
    const tbody = document.getElementById('logbook-table-body');
    if (!tbody) return;
    currentLogbookClientId = clienteId || '';
    if (!clienteId) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Selecione um cliente para carregar.</td></tr>';
        return;
    }
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Carregando...</td></tr>';

    try {
        const tables = ['logbook_actions', 'actions'];
        let rows = null;
        let lastError = null;

        for (const table of tables) {
            const { data, error } = await window.supabaseClient
                .from(table)
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('module', 'automacoes')
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error) {
                rows = data || [];
                lastError = null;
                break;
            }
            lastError = error;
        }

        if (lastError) throw lastError;

        renderLogbookRows(rows || []);
    } catch (err) {
        try {
            const headers = await getLogbookApiHeaders();
            const url = new URL(`${LOGBOOK_API_BASE}/api/logbook/actions`);
            url.searchParams.set('cliente_id', clienteId);
            url.searchParams.set('module', 'automacoes');
            url.searchParams.set('limit', '50');
            const res = await fetch(url.toString(), { headers: headers || {} });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error || 'Erro ao carregar diário');
            const list = json?.data || [];
            renderLogbookRows(Array.isArray(list) ? list : []);
        } catch (apiErr) {
            console.warn('Erro ao carregar diário (API):', apiErr);
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">Erro ao carregar diário.</td></tr>';
        }
    }
}

function renderLogbookRows(rows) {
    const tbody = document.getElementById('logbook-table-body');
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Nenhum registro encontrado.</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    rows.forEach((item) => {
        const details = parseLogbookDetails(item.details);
        const status = details?.status || '-';
        const prioridade = details?.prioridade || '-';
        const resumo = buildLogbookSummary(item, details);
        const data = formatLogbookDate(item.created_at);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${data}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.action_type || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${prioridade}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${resumo}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACTIONS ---

window.createNewWorkflow = function() {
    const modal = document.getElementById('modal-new-workflow');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

window.saveWorkflow = async function(e) {
    e.preventDefault();
    
    const client_id = document.getElementById('wf-client').value;
    const name = document.getElementById('wf-name').value;
    const status = document.getElementById('wf-status').value;
    const environment = document.getElementById('wf-environment').value;
    const integration = document.getElementById('wf-integration').value;
    const version = document.getElementById('wf-version').value;
    const responsible_id = document.getElementById('wf-responsible').value;
    const fileInput = document.getElementById('wf-file');
    
    // Leitura do Arquivo (Simulada para metadados, upload real precisaria de Storage)
    let fileName = null;
    if (fileInput.files.length > 0) {
        fileName = fileInput.files[0].name;
    }

    try {
        // Empacota metadados extras no campo description (JSON)
        const meta = {
            environment,
            integration,
            version,
            fileName,
            responsible_name: responsible_id ? document.querySelector(`#wf-responsible option[value="${responsible_id}"]`)?.text : null,
            original_desc: '' // Se quisesse manter descrição texto
        };
        const descriptionJSON = JSON.stringify(meta);

        // Salva no Supabase
        const { error } = await window.supabaseClient.from('workflows').insert({
            tenant_id: client_id,
            responsible_id: responsible_id || null, // Salva o responsável
            name,
            description: descriptionJSON, // Hack para salvar extras
            status: status,
            trigger_type: 'manual' // Default
        });

        if (error) throw error;

        if (window.Logbook && window.Logbook.addAction) {
            window.Logbook.addAction({
                clienteId: client_id,
                module: 'automacoes',
                actionType: 'workflow_created',
                title: 'Fluxo criado',
                details: JSON.stringify({ name, status, environment, integration, version }),
                refType: 'workflow',
                refId: null
            });
        }

        alert('Fluxo criado com sucesso!');
        closeModal('modal-new-workflow');
        
        // Reset form
        e.target.reset();
        const fileNameDisplay = document.getElementById('wf-file-name');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = 'JSON até 5MB';
            fileNameDisplay.classList.remove('text-primary', 'font-medium');
        }
        
        loadWorkflows();
        
    } catch (err) {
        console.error(err);
        alert('Erro ao criar fluxo: ' + err.message);
    }
}

// --- FILTERS ---
window.filterWorkflows = function() {
    const term = document.getElementById('search-workflow').value.toLowerCase();
    const status = document.getElementById('filter-status-workflow').value;
    const cliente = document.getElementById('filter-cliente-workflow').value;
    const ambiente = document.getElementById('filter-ambiente-workflow').value;
    
    const filtered = allWorkflows.filter(wf => {
        // Extract Meta
        let meta = {};
        try { if (wf.description && wf.description.startsWith('{')) meta = JSON.parse(wf.description); } catch(e) {}
        const wfEnv = meta.environment || wf.environment || 'dev';
        
        // 1. Term Filter
        const nameMatch = wf.name.toLowerCase().includes(term);
        
        // 2. Status Filter
        let statusMatch = true;
        if (status !== 'all') {
            statusMatch = wf.status === status;
        }
        
        // 3. Client Filter
        let clientMatch = true;
        if (cliente) {
            clientMatch = wf.tenant_id === cliente; // tenant_id = client_id
        }
        
        // 4. Environment Filter
        let envMatch = true;
        if (ambiente) {
            envMatch = wfEnv === ambiente;
        }

        return nameMatch && statusMatch && clientMatch && envMatch;
    });

    renderWorkflowsTable(filtered);
}

function renderExecutionChart() {
    const ctx = document.getElementById('chart-executions');
    if (!ctx) return;

    // Destroy existing if any (need to store instance if updated frequently, but here it's full reload usually)
    // Simple mock chart for visual
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            datasets: [{
                label: 'Execuções com Sucesso',
                data: [65, 59, 80, 81, 56, 55, 40],
                borderColor: '#10B981', // green-500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Erros',
                data: [2, 1, 3, 0, 1, 2, 0],
                borderColor: '#EF4444', // red-500
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f3f4f6'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}
