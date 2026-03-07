// js/v2/modules/social_media/social_media_core.js
// Núcleo do Módulo Social Media V2
// Reage a mudanças no ClientContext e atualiza a UI

(function(global) {
    const SocialMediaCore = {
        initialized: false,
        currentClientId: null,

        init: async function() {
            if (this.initialized) return;
            console.log('[SocialMediaCore V2] Inicializando...');

            if (!global.SocialMediaRepo || !global.SocialMediaUI || !global.ClientContext) {
                console.error('[SocialMediaCore V2] Dependências ausentes.');
                return;
            }

            // Inscrever-se no Contexto
            global.ClientContext.subscribe(this.onClientChange.bind(this));

            // Ouvir evento global também (segurança)
            global.addEventListener('gqv:client-changed', (e) => {
                if (e.detail && e.detail.clientId) {
                    this.onClientChange(e.detail.clientId, e.detail.clientName);
                }
            });

            // Estado inicial
            const activeId = global.ClientContext.getActiveClient();
            if (activeId) {
                // Tenta pegar nome do storage se não vier no init
                const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME');
                this.onClientChange(activeId, name);
            } else {
                global.SocialMediaUI.showEmptyState();
            }

            this.initialized = true;
        },

        onClientChange: async function(clientId, clientName) {
            if (!clientId) {
                this.currentClientId = null;
                global.SocialMediaUI.showEmptyState();
                return;
            }

            // Evitar reloads desnecessários se for o mesmo ID
            if (clientId === this.currentClientId) return;
            
            this.currentClientId = clientId;
            console.log(`[SocialMediaCore V2] Carregando dados para cliente: ${clientId} (${clientName})`);

            global.SocialMediaUI.showLoading();

            try {
                const posts = await global.SocialMediaRepo.getPostsByClient(clientId);
                global.SocialMediaUI.renderFeed(posts, clientName);
            } catch (err) {
                console.error('[SocialMediaCore V2] Erro no fluxo de carga:', err);
                const container = document.getElementById('v2-social-feed');
                if (container) container.innerHTML = '<div class="text-red-500">Erro ao carregar posts.</div>';
            }
        }
    };

    global.addEventListener('v2:ready', () => {
        SocialMediaCore.init();
    });

    // Fallback init
    setTimeout(() => {
        if (!SocialMediaCore.initialized && global.ClientContext) {
            SocialMediaCore.init();
        }
    }, 1500);

    global.SocialMediaCore = SocialMediaCore;

})(window);
