// js/v2/social_media/social_media_core.js
// Núcleo do Social Media V2
// Responsável por inicializar e gerenciar o módulo de Social Media novo,
// consumindo o ClientContext.

(function(global) {
    if (global.SocialMediaCore) return;

    const SocialMediaCore = {
        /**
         * Inicializa o módulo Social Media v2
         */
        init() {
            console.log('[SocialMediaCore v2] Inicializando...');
            
            // Subscreve ao contexto do cliente
            if (global.ClientContext) {
                global.ClientContext.subscribe((clientId) => {
                    this.onClientChange(clientId);
                });
            } else {
                console.error('[SocialMediaCore v2] ClientContext não encontrado!');
            }
        },

        /**
         * Manipula a mudança de cliente ativo
         * @param {string|null} clientId 
         */
        onClientChange(clientId) {
            console.log('[SocialMediaCore v2] Cliente ativo recebido:', clientId);
            
            if (clientId) {
                // Aqui carregaremos o calendário e insights futuramente
                this.loadModuleData(clientId);
            } else {
                this.clearModuleData();
            }
        },

        /**
         * Carrega dados do módulo para o cliente específico
         */
        async loadModuleData(clientId) {
            console.log(`[SocialMediaCore v2] Carregando dados para cliente ${clientId}...`);
            // Exemplo: await CalendarV2.load(clientId);
            // Exemplo: await InsightsV2.load(clientId);
        },

        /**
         * Limpa dados quando nenhum cliente está selecionado
         */
        clearModuleData() {
            console.log('[SocialMediaCore v2] Limpando dados (nenhum cliente selecionado).');
            // Exemplo: CalendarV2.clear();
        }
    };

    global.SocialMediaCore = SocialMediaCore;
    
    // Auto-init
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        SocialMediaCore.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => SocialMediaCore.init());
    }

})(window);
