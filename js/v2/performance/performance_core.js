// js/v2/performance/performance_core.js
// Núcleo do Performance (Tráfego Pago) V2
// Responsável por gerenciar campanhas e métricas, consumindo o mesmo ClientContext.

(function(global) {
    if (global.PerformanceCore) return;

    const PerformanceCore = {
        /**
         * Inicializa o módulo Performance v2
         */
        init() {
            console.log('[PerformanceCore v2] Inicializando...');
            
            // Subscreve ao contexto do cliente
            if (global.ClientContext) {
                global.ClientContext.subscribe((clientId) => {
                    this.onClientChange(clientId);
                });
            } else {
                console.error('[PerformanceCore v2] ClientContext não encontrado!');
            }
        },

        /**
         * Manipula a mudança de cliente ativo
         * @param {string|null} clientId 
         */
        onClientChange(clientId) {
            console.log('[PerformanceCore v2] Cliente ativo recebido:', clientId);
            
            if (clientId) {
                this.loadCampaigns(clientId);
            } else {
                this.clearView();
            }
        },

        /**
         * Carrega campanhas do cliente
         */
        async loadCampaigns(clientId) {
            console.log(`[PerformanceCore v2] Buscando campanhas para cliente ${clientId}...`);
            // Simulação de fetch
            // const campaigns = await API.getCampaigns(clientId);
        },

        /**
         * Limpa a visualização
         */
        clearView() {
            console.log('[PerformanceCore v2] Limpando visualização de performance.');
        }
    };

    global.PerformanceCore = PerformanceCore;

    // Auto-init
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        PerformanceCore.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => PerformanceCore.init());
    }

})(window);
