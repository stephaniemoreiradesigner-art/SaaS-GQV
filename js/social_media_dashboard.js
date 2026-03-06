// js/social_media_dashboard.js
// Controlador do Dashboard de Social Media - Foco em Seleção de Cliente e Navegação

(function() {
    if (window.__GQV_SM_DASH_BOOTED__) return;
    window.__GQV_SM_DASH_BOOTED__ = true;
    console.log('[SM ROOT FIX] boot único ok');
    window.__socialMediaDashboardActive = true;

    const SELECT_ID = 'social-client-select';
    const STORAGE_KEY = 'social_media_state_v1'; // Mantendo compatibilidade com social_media.js

    // Estado local
    let state = { clientId: null };

    // Função auxiliar para obter cliente Supabase
    function getSupabase() {
        return window.supabaseClient || window.supabase;
    }

    // Carregar estado salvo
    function loadState() {
        try {
            // Tenta recuperar da chave solicitada pelo usuário, com fallbacks para compatibilidade
            const savedId = localStorage.getItem('selectedClientId') || 
                           localStorage.getItem('sm_active_client') || 
                           localStorage.getItem('GQV_ACTIVE_CLIENT_ID');

            if (savedId) {
                state.clientId = savedId;
                // Sincroniza todas as chaves para garantir consistência
                localStorage.setItem('selectedClientId', savedId);
                localStorage.setItem('sm_active_client', savedId);
                localStorage.setItem('GQV_ACTIVE_CLIENT_ID', savedId);
                
                // Atualiza globais
                if (window.socialMediaState) window.socialMediaState.clientId = savedId;
                window.currentClienteId = savedId;
                return;
            }
            
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed.clientId) state.clientId = parsed.clientId;
        } catch (e) {
            console.error('[SM-Dash] Erro ao ler storage:', e);
        }
    }

    // Salvar estado
    function saveState() {
        try {
            const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            current.clientId = state.clientId;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
            
            // Persistência robusta em múltiplas chaves
            const val = state.clientId || '';
            localStorage.setItem('selectedClientId', val);
            localStorage.setItem('sm_active_client', val);
            localStorage.setItem('GQV_ACTIVE_CLIENT_ID', val);
            
            if (window.socialMediaState) window.socialMediaState.clientId = state.clientId;
            window.currentClienteId = state.clientId;
        } catch (e) {
            console.error('[SM-Dash] Erro ao salvar storage:', e);
        }
    }

    // Buscar clientes do banco
    async function fetchClients() {
        const supabase = getSupabase();
        if (!supabase) {
            console.warn('[SM-Dash] Supabase não pronto. Tentando novamente em 500ms...');
            setTimeout(fetchClients, 500);
            return;
        }

        // [PROTEÇÃO] Evitar buscar se já populou (mas permitir refresh se vazio)
        const select = document.getElementById(SELECT_ID);
        if (select && select.options.length > 1) {
             console.log('[SM-Dash] Select já populado, ignorando fetchClients.');
             return;
        }

        try {
            console.log('[SM-Dash] Buscando clientes...');
            let query = supabase
                .from('clientes')
                .select('id, nome_fantasia, razao_social')
                .eq('ativo', true);

            // [FILTRO DEMO]
            // Se NÃO estiver em modo demo, filtra fora os clientes marcados como is_demo
            const isDemoMode = String(localStorage.getItem('demo_mode')) === 'true';
            if (!isDemoMode) {
                query = query.neq('is_demo', true);
            }

            const { data: clientes, error } = await query.order('nome_fantasia');

            if (error) throw error;

            console.log('[SM-Dash] Clientes recebidos:', clientes?.length || 0);
            populateSelect(clientes || []);
        } catch (err) {
            console.error('[SM-Dash] Erro ao buscar clientes:', err);
            if (select) select.innerHTML = '<option value="">Erro ao carregar clientes</option>';
        }
    }

    // Preencher o select
    function populateSelect(clientes) {
        console.log('[SM-Dash] populateSelect chamado com:', clientes);
        const select = document.getElementById(SELECT_ID);
        if (!select) {
            console.warn('[SM-Dash] Select não encontrado no DOM:', SELECT_ID);
            return;
        }

        // Limpar e recriar
        select.innerHTML = '<option value="">Selecione o Cliente...</option>';
        
        clientes.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            // Fallback robusto para nome
            const label = client.nome_fantasia || client.razao_social || `Cliente ${client.id}`;
            option.textContent = label;
            select.appendChild(option);
            // console.log('[SM-Dash] Option adicionada:', label, client.id);
        });

        // [SM ROOT FIX] Restaurar seleção com persistência forçada
        const savedClientHotfix = state.clientId || 
                                localStorage.getItem('selectedClientId') || 
                                localStorage.getItem('sm_active_client') || 
                                localStorage.getItem('GQV_ACTIVE_CLIENT_ID');

        if (savedClientHotfix) {
            console.log('[SM ROOT FIX] cliente restaurado:', savedClientHotfix);
            state.clientId = savedClientHotfix;
            
            // Garante consistência
            localStorage.setItem('selectedClientId', savedClientHotfix);
            localStorage.setItem('GQV_ACTIVE_CLIENT_ID', savedClientHotfix);
            localStorage.setItem('sm_active_client', savedClientHotfix);
            
            // Tenta setar valor direto
            select.value = savedClientHotfix;
            
            // Se falhar (value não bater com options), tenta encontrar manualmente
            if (select.value !== savedClientHotfix) {
                const options = Array.from(select.options);
                const match = options.find(opt => opt.value == savedClientHotfix);
                if (match) {
                    match.selected = true;
                    select.value = match.value; // Garante sync
                } else {
                    console.warn('[SM-Dash] ID salvo não encontrado na lista atual:', savedClientHotfix);
                }
            }

            // [FIX CRÍTICO] Força atualização visual e global
            if (window.socialMediaState) window.socialMediaState.activeClientId = savedClientHotfix;
            if (window.socialMediaState) window.socialMediaState.clientId = savedClientHotfix;
            window.currentClienteId = savedClientHotfix;

            // [BRIDGE V2] Atualiza o contexto V2 se disponível
            if (window.ClientContext && typeof window.ClientContext.setActiveClient === 'function') {
                console.log('[SM-Dash] Sincronizando ClientContext v2:', savedClientHotfix);
                window.ClientContext.setActiveClient(savedClientHotfix);
            }

            // Dispara evento global
            window.dispatchEvent(new CustomEvent('sm:clientChanged', { detail: { clientId: state.clientId } }));
            
            setTimeout(() => {
                const s = document.getElementById(SELECT_ID);
                if (s && s.value !== savedClientHotfix) {
                     s.value = savedClientHotfix;
                }
                updateClientNameUI(s); // Atualiza UI com nome
            }, 100);
        } else {
            console.log('[SM ROOT FIX] nenhum cliente selecionado inicialmente.');
            updateClientNameUI(select);
        }
        
        updateButtonsState();
    }

    // Função auxiliar para atualizar o nome do cliente na UI
    function updateClientNameUI(selectElement) {
        if (!selectElement) return;
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const clientNameDisplay = document.getElementById('selected-client-name-display');
        
        // Se não existir o elemento, cria (ou injeta em algum lugar apropriado)
        // Vamos tentar achar o header do "Cliente ativo" para injetar se precisar
        if (!clientNameDisplay) {
            // Opcional: injetar dinamicamente se não existir no HTML
            // Mas o usuário pediu para "Sincronização de UI".
            // Vamos procurar o container do select e adicionar um texto abaixo se não houver
            const container = selectElement.parentElement;
            if (container) {
                const display = document.createElement('div');
                display.id = 'selected-client-name-display';
                display.className = 'mt-2 text-sm font-semibold text-primary';
                container.appendChild(display);
                
                if (selectedOption && selectedOption.value) {
                    display.textContent = `Cliente Selecionado: ${selectedOption.text}`;
                    display.classList.remove('hidden');
                } else {
                    display.classList.add('hidden');
                }
                return;
            }
        } else {
            if (selectedOption && selectedOption.value) {
                clientNameDisplay.textContent = `Cliente Selecionado: ${selectedOption.text}`;
                clientNameDisplay.classList.remove('hidden');
            } else {
                clientNameDisplay.classList.add('hidden');
            }
        }
    }

    // Atualizar estado dos botões
    function updateButtonsState() {
        const hasClient = !!state.clientId && state.clientId !== '';
        const buttons = document.querySelectorAll('button[data-action]');
        buttons.forEach(btn => {
            if (hasClient) {
                btn.removeAttribute('disabled');
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                btn.setAttribute('disabled', 'true');
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });
        
        const msg = document.getElementById('client-required-message');
        if (msg) {
            if (hasClient) msg.classList.add('hidden');
            else msg.classList.remove('hidden');
        }

        const hubStatus = document.getElementById('operational-status');
        if (hubStatus) {
            hubStatus.textContent = hasClient 
                ? 'Pronto para gerenciar conteúdo.' 
                : 'Selecione um cliente acima para habilitar o painel.';
        }
    }

    // Inicializar listeners
    function initListeners() {
        // [SM ROOT FIX] UI Bind Único
        if (window.__GQV_SM_DASH_UI_BOUND) return;
        window.__GQV_SM_DASH_UI_BOUND = true;
        console.log('[SM ROOT FIX] UI bind único ok');

        const select = document.getElementById(SELECT_ID);
        if (select) {
            select.addEventListener('change', (e) => {
                const clientId = e.target.value;
                state.clientId = clientId;
                
                // Salvar em todas as chaves
                localStorage.setItem('selectedClientId', clientId);
                localStorage.setItem('sm_active_client', clientId);
                localStorage.setItem('GQV_ACTIVE_CLIENT_ID', clientId);
                
                if (typeof window.setActiveClientId === 'function') {
                    window.setActiveClientId(clientId);
                } else {
                    if (window.socialMediaState) window.socialMediaState.activeClientId = clientId;
                    if (window.socialMediaState) window.socialMediaState.clientId = clientId;
                    window.currentClienteId = clientId;
                }

                // [BRIDGE V2] Atualiza o contexto V2 na mudança manual
                if (window.ClientContext && typeof window.ClientContext.setActiveClient === 'function') {
                    window.ClientContext.setActiveClient(clientId);
                }

                // Atualiza UI imediatamente
                updateClientNameUI(select);
                
                saveState();
                updateButtonsState();
                
                window.dispatchEvent(new CustomEvent('sm:clientChanged', { detail: { clientId: state.clientId } }));
            });
        }

        // Listeners para os botões de ação
        document.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Previne comportamento padrão se necessário (embora sejam buttons type=button geralmente)
                e.preventDefault();
                
                const action = btn.getAttribute('data-action');
                console.log(`[SM-Dash] Ação clicada: ${action}, Cliente: ${state.clientId}`);
                
                // Validação robusta
                if (!state.clientId || state.clientId === '') {
                    alert('Por favor, selecione um cliente antes de prosseguir.');
                    // Tenta focar no select para ajudar o usuário
                    if (select) select.focus();
                    return;
                }

                if (action === 'calendar-generate') {
                    console.log(`[SM-Dash] Iniciando geração para o cliente: [${state.clientId}]`);
                    
                    if (window.openSocialMediaTab) {
                        window.openSocialMediaTab('calendar');
                    } else {
                        simpleTabSwitch('calendar');
                    }
                    
                    setTimeout(() => {
                        if (typeof window.openGenerationConfigModal === 'function') {
                            window.openGenerationConfigModal();
                        } else if (typeof window.openConfigModal === 'function') {
                            window.openConfigModal();
                        } else {
                            console.warn('[SM-Dash] Modal function not found');
                        }
                    }, 100);
                    return; 
                }
                
                let targetTabName = 'dashboard';

                switch(action) {
                    case 'posts-approve':
                        targetTabName = 'calendar';
                        break;
                    case 'insights':
                        targetTabName = 'insights';
                        break;
                    case 'diary':
                        targetTabName = 'diary';
                        break;
                    case 'creatives':
                        targetTabName = 'creatives'; // ou 'creative-requests'
                        break;
                }

                if (window.openSocialMediaTab) {
                    window.openSocialMediaTab(targetTabName);
                } else {
                    console.warn('[SM-Dash] openSocialMediaTab não encontrada, usando fallback.');
                    simpleTabSwitch(targetTabName);
                }
            });
        });
    }

    function simpleTabSwitch(tabName) {
        const views = {
            dashboard: document.getElementById('social-media-home'),
            calendar: document.getElementById('calendar-view'),
            insights: document.getElementById('insights-view'),
            diary: document.getElementById('logs-view'),
            creatives: document.getElementById('creative-requests-view')
        };

        let targetKey = tabName;
        if (tabName === 'logs') targetKey = 'diary';
        if (tabName === 'creative-requests') targetKey = 'creatives';

        Object.values(views).forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('flex');
            }
        });

        let targetEl = null;
        if (targetKey === 'calendar') targetEl = views.calendar;
        else if (targetKey === 'insights') targetEl = views.insights;
        else if (targetKey === 'diary') targetEl = views.diary;
        else if (targetKey === 'creatives') targetEl = views.creatives;
        else targetEl = views.dashboard;

        if (targetEl) {
            targetEl.classList.remove('hidden');
            if (targetKey !== 'dashboard') targetEl.classList.add('flex');
        }
    }

    function init() {
        loadState();
        fetchClients();
        initListeners();
        
        updateButtonsState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
