// js/v2/shared/clientContext.js
// Contexto Único de Cliente para Módulos V2
// Responsável por gerenciar quem é o cliente ativo e notificar interessados.

(function(global) {
    const STORAGE_KEY = 'GQV_ACTIVE_CLIENT_ID';
    const LISTENERS = new Set();
    
    let activeClientId = null;
    let isInitialized = false;

    const ClientContext = {
        /**
         * Inicializa o contexto lendo do localStorage
         */
        init() {
            if (isInitialized) return;
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                activeClientId = saved;
                console.log('[ClientContext v2] Inicializado com cliente:', activeClientId);
            } else {
                console.log('[ClientContext v2] Inicializado sem cliente ativo');
            }
            isInitialized = true;
            this.notifyListeners();
        },

        /**
         * Retorna o ID do cliente ativo ou null
         */
        getActiveClient() {
            if (!isInitialized) this.init();
            return activeClientId;
        },

        /**
         * Define o novo cliente ativo, persiste e notifica
         * @param {string|number|null} clientId 
         */
        setActiveClient(clientId) {
            const normalized = clientId ? String(clientId).trim() : null;
            
            if (normalized === activeClientId) return; // Sem mudança

            activeClientId = normalized;
            
            if (activeClientId) {
                localStorage.setItem(STORAGE_KEY, activeClientId);
                // Manter compatibilidade com v1 por enquanto
                localStorage.setItem('selectedClientId', activeClientId);
                localStorage.setItem('sm_active_client', activeClientId);
            } else {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('selectedClientId');
                localStorage.removeItem('sm_active_client');
            }

            console.log('[ClientContext v2] Cliente alterado para:', activeClientId);
            this.notifyListeners();
        },

        /**
         * Registra um callback para ser chamado quando o cliente mudar
         * @param {Function} callback (clientId) => void
         * @returns {Function} unsubscribe
         */
        subscribe(callback) {
            if (typeof callback !== 'function') return () => {};
            LISTENERS.add(callback);
            // Chama imediatamente com o valor atual
            try {
                callback(activeClientId);
            } catch (err) {
                console.error('[ClientContext v2] Erro no callback inicial:', err);
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
        }
    };

    // Expor globalmente
    global.ClientContext = ClientContext;

    // Auto-inicializar se o DOM já estiver pronto
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        ClientContext.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => ClientContext.init());
    }

    // Escutar eventos de storage (para sincronia entre abas)
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            if (e.newValue !== activeClientId) {
                console.log('[ClientContext v2] Sincronizado via storage:', e.newValue);
                activeClientId = e.newValue;
                ClientContext.notifyListeners();
            }
        }
    });

})(window);
