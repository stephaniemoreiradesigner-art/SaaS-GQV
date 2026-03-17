// js/v2/shared/clientContext.js
// Contexto Único de Cliente para Módulos V2
// Responsável por gerenciar quem é o cliente ativo e notificar interessados.

(function(global) {
    console.log('[V2] clientContext carregado');
    const isClientPortal = String(global.location?.pathname || '').includes('/v2/client/');
    const STORAGE_KEY = isClientPortal ? 'GQV_CLIENT_PORTAL_ACTIVE_CLIENT_ID' : 'GQV_ACTIVE_CLIENT_ID';
    const NAME_KEY = isClientPortal ? 'GQV_CLIENT_PORTAL_ACTIVE_CLIENT_NAME' : 'GQV_ACTIVE_CLIENT_NAME';
    const LISTENERS = new Set();
    const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;
    
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
                if (isDebug()) {
                    console.log('[ClientContext] active client restored:', {
                        clientId: activeClientId,
                        clientName: localStorage.getItem(NAME_KEY) || null
                    });
                }
            } else {
                activeClientId = null;
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(NAME_KEY);
                if (!isClientPortal) {
                    localStorage.removeItem('selectedClientId');
                    localStorage.removeItem('sm_active_client');
                    localStorage.removeItem('GQV_ACTIVE_CLIENT_ID');
                    localStorage.removeItem('GQV_ACTIVE_CLIENT_NAME');
                }
                console.log('[ClientContext v2] Inicializado sem cliente ativo');
                if (isDebug()) {
                    console.log('[ClientContext] active client restored:', { clientId: null, clientName: null });
                }
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

        getActiveClientName() {
            if (!isInitialized) this.init(); // Lazy init fallback
            const name = localStorage.getItem(NAME_KEY);
            return name ? String(name).trim() : null;
        },

        getActiveClientInfo() {
            if (!isInitialized) this.init(); // Lazy init fallback
            return {
                clientId: activeClientId,
                clientName: this.getActiveClientName()
            };
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
                if (!isClientPortal) {
                    localStorage.setItem('selectedClientId', activeClientId);
                    localStorage.setItem('sm_active_client', activeClientId);
                    localStorage.setItem('GQV_ACTIVE_CLIENT_ID', activeClientId);
                }
                
                // Persistir nome se disponível (opcional, mas útil para UI)
                if (clientName) {
                    localStorage.setItem(NAME_KEY, clientName);
                }
            } else {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(NAME_KEY);
                if (!isClientPortal) {
                    localStorage.removeItem('selectedClientId');
                    localStorage.removeItem('sm_active_client');
                    localStorage.removeItem('GQV_ACTIVE_CLIENT_ID');
                    localStorage.removeItem('GQV_ACTIVE_CLIENT_NAME');
                }
            }

            if (isDebug()) {
                console.log('[ClientContext] active client set:', {
                    clientId: activeClientId,
                    clientName: clientName || localStorage.getItem(NAME_KEY) || null
                });
            }
            if (previousClientId !== activeClientId) {
                console.log('[ClientContext v2] Cliente alterado para:', activeClientId, clientName);
                if (isDebug()) {
                    console.log('[ClientContext] client changed:', { from: previousClientId, to: activeClientId });
                }
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
                const name = clientName || localStorage.getItem(NAME_KEY);

                const event = new CustomEvent('gqv:client-changed', { 
                    detail: { 
                        clientId: activeClientId,
                        clientName: name
                    } 
                });
                window.dispatchEvent(event);
                document.dispatchEvent(event); // Dispara no document também conforme solicitado
                
                // Evento legado específico do Social Media
                if (!isClientPortal) {
                    window.dispatchEvent(new CustomEvent('sm:clientChanged', { 
                        detail: { clientId: activeClientId } 
                    }));
                }
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
                if (isDebug()) {
                    console.log('[ClientContext] active client restored:', {
                        clientId: activeClientId,
                        clientName: localStorage.getItem(NAME_KEY) || null,
                        source: 'storage'
                    });
                }
                ClientContext.notifyListeners();
                ClientContext.dispatchGlobalEvent();
            }
        }
    });

})(window);
