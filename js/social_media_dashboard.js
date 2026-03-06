// js/social_media_dashboard.js
// Controlador do Dashboard de Social Media - Foco em Seleção de Cliente e Navegação

(function() {
    console.log('[SM-Dash] Inicializando controlador do Dashboard...');
    window.__socialMediaDashboardActive = true; // Flag para evitar conflitos

    const SELECT_ID = 'social-client-select';
    const STORAGE_KEY = 'social_media_state_v1'; // Mantendo compatibilidade com social_media.js

    // Estado local
    let state = {
        clientId: null
    };

    // Função auxiliar para obter cliente Supabase
    function getSupabase() {
        return window.supabaseClient || window.supabase;
    }

    // Carregar estado salvo
    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.clientId) {
                    state.clientId = parsed.clientId;
                    console.log('[SM-Dash] Cliente restaurado do storage:', state.clientId);
                }
            }
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
            
            // Também salvar na chave legado/global se necessário
            localStorage.setItem('GQV_ACTIVE_CLIENT_ID', state.clientId || '');
            
            // Atualizar variáveis globais para outros scripts
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

        try {
            const { data: clientes, error } = await supabase
                .from('clientes')
                .select('id, nome_fantasia, razao_social')
                .eq('ativo', true)
                .order('nome_fantasia');

            if (error) throw error;

            populateSelect(clientes || []);
        } catch (err) {
            console.error('[SM-Dash] Erro ao buscar clientes:', err);
            const select = document.getElementById(SELECT_ID);
            if (select) select.innerHTML = '<option value="">Erro ao carregar clientes</option>';
        }
    }

    // Preencher o select
    function populateSelect(clientes) {
        console.log('[SM] select populated by: social_media_dashboard.js');
        const select = document.getElementById(SELECT_ID);
        if (!select) return;

        // Limpar e recriar
        select.innerHTML = '<option value="">Selecione o Cliente...</option>';
        
        clientes.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.nome_fantasia || client.razao_social || `Cliente ${client.id}`;
            select.appendChild(option);
        });

        // Restaurar seleção com persistência forçada
        const savedClientHotfix = localStorage.getItem('sm_active_client');
        if (savedClientHotfix) {
            state.clientId = savedClientHotfix;
        }

        if (state.clientId) {
            select.value = state.clientId;
            
            // Se falhar (value não bater com options), tenta encontrar manualmente
            if (select.value !== state.clientId) {
                const options = Array.from(select.options);
                const match = options.find(opt => opt.value == state.clientId);
                if (match) {
                    match.selected = true;
                    select.value = match.value; // Garante sync
                } else {
                    console.warn('[SM-Dash] ID salvo não encontrado na lista atual:', state.clientId);
                }
            }
            console.log('[SM HOTFIX] cliente restaurado no select:', select.value);
            
            // Disparar evento para sincronizar outros módulos imediatamente
            window.dispatchEvent(new CustomEvent('sm:clientChanged', { detail: { clientId: state.clientId } }));
        } else {
            console.log('[SM HOTFIX] nenhum cliente selecionado inicialmente.');
        }
        
        updateButtonsState();
    }

    // Atualizar estado dos botões
    function updateButtonsState() {
        const hasClient = !!state.clientId && state.clientId !== '';
        console.log('[SM-Dash] Atualizando botões. Cliente selecionado:', hasClient);

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
        
        // Esconder mensagem de "Selecione um cliente"
        const msg = document.getElementById('client-required-message');
        if (msg) {
            if (hasClient) msg.classList.add('hidden');
            else msg.classList.remove('hidden');
        }

        // Atualizar Hub Operacional (Stub para manter layout)
        const hubStatus = document.getElementById('operational-status');
        if (hubStatus) {
            hubStatus.textContent = hasClient 
                ? 'Pronto para gerenciar conteúdo.' 
                : 'Selecione um cliente acima para habilitar o painel.';
        }
    }

    // Inicializar listeners
    function initListeners() {
        const select = document.getElementById(SELECT_ID);
        if (select) {
            select.addEventListener('change', (e) => {
                const clientId = e.target.value;
                state.clientId = clientId;
                
                // HOTFIX: Persistência reforçada
                localStorage.setItem('sm_active_client', clientId);
                console.log('[SM HOTFIX] cliente selecionado:', clientId);

                setTimeout(() => { 
                    const s = document.getElementById(SELECT_ID); 
                    if(s) s.value = clientId; 
                }, 50);
                
                console.log('[SM-Dash] Novo cliente selecionado:', state.clientId);
                saveState();
                updateButtonsState();
                
                // Notificar outros componentes
                window.dispatchEvent(new CustomEvent('sm:clientChanged', { detail: { clientId: state.clientId } }));
            });
        }

        // Listeners para os botões de ação
        document.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // HOTFIX: Permitir gerar calendário mesmo sem cliente (vai pedir depois ou usar fallback)
                // Mas para consistência, se não tiver cliente, avisa.
                
                const action = btn.getAttribute('data-action');
                console.log('[SM-Dash] Ação disparada:', action);
                
                if (!state.clientId && action !== 'calendar-generate') {
                    alert('Por favor, selecione um cliente primeiro.');
                    return;
                }

                // HOTFIX: Se for calendar-generate, força abrir a aba
                if (action === 'calendar-generate') {
                    if (window.openSocialMediaTab) {
                        window.openSocialMediaTab('calendar');
                    } else {
                        simpleTabSwitch('calendar');
                    }
                    
                    // Pequeno delay para garantir que a aba abriu antes do modal
                    setTimeout(() => {
                        // Tenta abrir o modal de configuração se a função existir
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
                
                // Outras ações
                if (!state.clientId) {
                     alert('Por favor, selecione um cliente primeiro.');
                     return;
                }
                
                // Mapear ação para aba
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

    // Navegação simples de fallback
    function simpleTabSwitch(tabName) {
        const views = {
            dashboard: document.getElementById('social-media-home'),
            calendar: document.getElementById('calendar-view'),
            insights: document.getElementById('insights-view'),
            diary: document.getElementById('logs-view'),
            creatives: document.getElementById('creative-requests-view')
        };

        // Mapeamento de nomes
        let targetKey = tabName;
        if (tabName === 'logs') targetKey = 'diary';
        if (tabName === 'creative-requests') targetKey = 'creatives';

        // Esconder tudo
        Object.values(views).forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('flex');
            }
        });

        // Mostrar alvo
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

    // Inicialização principal
    function init() {
        loadState();
        fetchClients();
        initListeners();
        
        // Forçar atualização inicial da UI
        updateButtonsState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
