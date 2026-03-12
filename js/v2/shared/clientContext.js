// js/v2/shared/clientContext.js
// Contexto Único de Cliente para Módulos V2
// Responsável por gerenciar quem é o cliente ativo e notificar interessados.

(function(global) {
    console.log('[V2] clientContext carregado');
    const STORAGE_KEY = 'GQV_ACTIVE_CLIENT_ID';
    const LISTENERS = new Set();
    
    let activeClientId = null;
    let isInitialized = false;
    const normalizeClientId = (value) => {
        const raw = value === null || value === undefined ? '' : String(value).trim();
        if (!raw) return null;
        const lowered = raw.toLowerCase();
        if (lowered === 'null' || lowered === 'undefined') return null;
        return raw;
    };

    const ClientContext = {
        /**
         * Inicializa o contexto lendo do localStorage e validando
         */
        async init() {
            if (isInitialized) return;

            // Aguardar TenantContext estar pronto para validação de segurança (opcional por enquanto)
            // const tenantId = global.TenantContext?.getTenantId();

            const saved = normalizeClientId(localStorage.getItem(STORAGE_KEY));
            if (saved) {
                activeClientId = saved;
                console.log('[ClientContext v2] Inicializado com cliente:', activeClientId);
            } else {
                activeClientId = null;
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('selectedClientId');
                localStorage.removeItem('sm_active_client');
                localStorage.removeItem('GQV_ACTIVE_CLIENT_ID');
                localStorage.removeItem('GQV_ACTIVE_CLIENT_NAME');
                console.log('[ClientContext v2] Inicializado sem cliente ativo');
            }
            isInitialized = true;
            this.notifyListeners();
            
            // Dispara evento global para legado
            this.dispatchGlobalEvent();
        },

        /**
         * Retorna o ID do cliente ativo ou null
         */
        getActiveClient() {
            if (!isInitialized) this.init(); // Lazy init fallback
            return activeClientId;
        },

        /**
         * Define o novo cliente ativo, persiste e notifica
         * @param {string|number|object|null} input - ID ou objeto { id, name }
         */
        setActiveClient(input) {
            let clientId = null;
            let clientName = null;

            if (typeof input === 'object' && input !== null) {
                clientId = input.id;
                clientName = input.name;
            } else {
                clientId = input;
            }

            const normalizedId = normalizeClientId(clientId);
            
            // Mesmo se o ID for igual, o nome pode ter mudado (ou sido carregado agora)
            // Mas para evitar loops, checamos se realmente mudou algo relevante
            if (normalizedId === activeClientId && !clientName) return; 

            const previousClientId = activeClientId;
            activeClientId = normalizedId;
            
            if (activeClientId) {
                localStorage.setItem(STORAGE_KEY, activeClientId);
                // Manter compatibilidade com v1
                localStorage.setItem('selectedClientId', activeClientId);
                localStorage.setItem('sm_active_client', activeClientId);
                localStorage.setItem('GQV_ACTIVE_CLIENT_ID', activeClientId);
                
                // Persistir nome se disponível (opcional, mas útil para UI)
                if (clientName) {
                    localStorage.setItem('GQV_ACTIVE_CLIENT_NAME', clientName);
                }
            } else {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('selectedClientId');
                localStorage.removeItem('sm_active_client');
                localStorage.removeItem('GQV_ACTIVE_CLIENT_ID');
                localStorage.removeItem('GQV_ACTIVE_CLIENT_NAME');
            }

            if (previousClientId !== activeClientId) {
                console.log('[ClientContext v2] Cliente alterado para:', activeClientId, clientName);
            }
            this.notifyListeners();
            this.dispatchGlobalEvent(clientName);
        },

        /**
         * Registra um callback para ser chamado quando o cliente mudar
         * @param {Function} callback (clientId) => void
         * @returns {Function} unsubscribe
         */
        subscribe(callback) {
            if (typeof callback !== 'function') return () => {};
            LISTENERS.add(callback);
            // Chama imediatamente com o valor atual se já inicializado
            if (isInitialized) {
                try {
                    callback(activeClientId);
                } catch (err) {
                    console.error('[ClientContext v2] Erro no callback inicial:', err);
                }
            }
            
            return () => {
                LISTENERS.delete(callback);
            };
        },

        /**
         * Notifica todos os ouvintes (interno)
         */
        notifyListeners() {
            LISTENERS.forEach(cb => {
                try {
                    cb(activeClientId);
                } catch (err) {
                    console.error('[ClientContext v2] Erro em listener:', err);
                }
            });
        },

        /**
         * Dispara evento DOM para compatibilidade com legado
         * @param {string} [clientName] - Nome opcional do cliente
         */
        dispatchGlobalEvent(clientName) {
            try {
                // Tenta recuperar nome do storage se não passado
                const name = clientName || localStorage.getItem('GQV_ACTIVE_CLIENT_NAME');

                const event = new CustomEvent('gqv:client-changed', { 
                    detail: { 
                        clientId: activeClientId,
                        clientName: name
                    } 
                });
                window.dispatchEvent(event);
                document.dispatchEvent(event); // Dispara no document também conforme solicitado
                
                // Evento legado específico do Social Media
                window.dispatchEvent(new CustomEvent('sm:clientChanged', { 
                    detail: { clientId: activeClientId } 
                }));
            } catch (e) {
                console.error('[ClientContext v2] Erro ao disparar eventos globais:', e);
            }
        }
    };

    // Expor globalmente
    global.ClientContext = ClientContext;

    // A inicialização agora deve ser chamada pelo Bootstrap V2, mas mantemos o listener de storage
    // Escutar eventos de storage (para sincronia entre abas)
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY || e.key === 'selectedClientId') {
            const newVal = normalizeClientId(e.newValue);
            if (newVal !== activeClientId) {
                activeClientId = newVal;
                ClientContext.notifyListeners();
                ClientContext.dispatchGlobalEvent();
            }
        }
    });

})(window);
