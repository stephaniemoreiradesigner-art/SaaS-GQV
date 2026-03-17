// js/v2/modules/clientes/clientes_core.js
// Núcleo do Módulo Clientes V2
// Orquestra Repo, UI e Contexto

(function(global) {
    const ClientCore = {
        initialized: false,

        init: async function() {
            if (this.initialized) return;
            
            console.log('[ClientCore V2] Inicializando...');

            // Aguardar dependências globais
            if (!global.ClientRepo || !global.ClientUI || !global.ClientContext) {
                console.error('[ClientCore V2] Dependências não encontradas (Repo, UI ou Context).');
                return;
            }

            // 1. Carregar Clientes
            const clients = await global.ClientRepo.getClients();
            console.log(`[ClientCore V2] ${clients.length} clientes carregados.`);

            // 2. Renderizar UI
            // Vamos renderizar, passando o callback de clique
            global.ClientUI.renderClients(clients, this.handleClientSelection.bind(this));

            // 3. Sincronizar estado inicial
            const activeId = global.ClientContext.getActiveClient();
            if (activeId) {
                global.ClientUI.highlightActive(activeId);
            }

            // 4. Ouvir mudanças externas (para manter UI sincronizada se mudar por outro lugar)
            global.addEventListener('gqv:client-changed', (e) => {
                // [GUARD] Proteção contra eventos malformados
                if (!e || !e.detail) {
                    console.warn('[ClientCore V2] Evento gqv:client-changed recebido sem detail', e);
                    return;
                }

                const newId = e.detail.clientId;
                if (newId) {
                    global.ClientUI.highlightActive(newId);
                }
            });

            this.initialized = true;
        },

        loadClients: async function() {
            if (!global.ClientRepo || !global.ClientUI || !global.ClientContext) return [];
            const clients = await global.ClientRepo.getClients();
            global.ClientUI.renderClients(clients, this.handleClientSelection.bind(this));
            const activeId = global.ClientContext.getActiveClient();
            if (activeId) global.ClientUI.highlightActive(activeId);
            return clients || [];
        },

        handleClientSelection: function(client) {
            console.log('[ClientCore V2] Cliente selecionado:', client.nome_fantasia);
            
            // Atualizar o Contexto Global V2
            // O Contexto vai disparar 'gqv:client-changed' e persistir no localStorage
            if (global.ClientContext) {
                // Passando objeto com ID e Nome conforme padronização
                global.ClientContext.setActiveClient({
                    id: client.id,
                    name: client.nome_fantasia || client.razao_social || client.nome_empresa || 'Cliente Sem Nome'
                });
            } else {
                console.error('[ClientCore V2] ClientContext não disponível!');
            }

            if (typeof global.openClientDetailModal === 'function') {
                global.openClientDetailModal(client);
            }
        }
    };

    // Auto-inicialização quando o V2 estiver pronto
    global.addEventListener('v2:ready', () => {
        ClientCore.init();
    });

    global.ClientCore = ClientCore;
    global.loadClients = async function() {
        return await ClientCore.loadClients();
    };

})(window);
