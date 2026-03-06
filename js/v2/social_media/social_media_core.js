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
                this.renderActiveClient(clientId);
                this.loadModuleData(clientId);
            } else {
                this.clearView();
            }
        },

        /**
         * Renderiza visualmente o cliente ativo (ex: banner ou indicador)
         */
        renderActiveClient(clientId) {
            // [V2] Indicador visual simples para dev/teste
            const container = document.getElementById('social-media-v2-indicator');
            if (container) {
                container.innerHTML = `
                    <div class="bg-green-100 text-green-800 px-4 py-2 rounded-md mb-4 flex justify-between items-center">
                        <span><strong>[V2] Cliente Ativo:</strong> ${clientId}</span>
                        <div class="flex gap-2">
                            <button onclick="SocialMediaCore.handleGenerateCalendar('${clientId}')" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Gerar Calendário</button>
                            <button onclick="SocialMediaCore.handleApproval('${clientId}')" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Enviar Aprovação</button>
                        </div>
                    </div>
                `;
                container.classList.remove('hidden');
            }
        },

        /**
         * Carrega dados do módulo para o cliente específico
         */
        async loadModuleData(clientId) {
            console.log(`[SocialMediaCore v2] Carregando dados para cliente ${clientId}...`);
            // Exemplo: await CalendarV2.load(clientId);
        },

        /**
         * Limpa a visualização
         */
        clearView() {
            console.log('[SocialMediaCore v2] Limpando visualização.');
            const container = document.getElementById('social-media-v2-indicator');
            if (container) container.classList.add('hidden');
        },

        // --- Handlers de Ação ---

        async handleGenerateCalendar(clientId) {
            if (!clientId) return alert('Selecione um cliente primeiro.');
            
            // [V2] Simplificado: mês atual
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            
            try {
                const calendar = await global.SocialMediaCalendar.createDraft(clientId, currentMonth);
                alert(`Calendário criado/carregado com sucesso! ID: ${calendar.id}`);
                console.log('[SocialMediaCore v2] Calendário:', calendar);
            } catch (error) {
                console.error('Erro ao gerar calendário:', error);
                alert('Erro ao gerar calendário. Verifique o console.');
            }
        },

        async handleApproval(clientId) {
            if (!clientId) return alert('Selecione um cliente primeiro.');
            
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            try {
                // 1. Busca o calendário do mês
                const calendar = await global.SocialMediaCalendar.getCalendar(clientId, currentMonth);
                
                if (!calendar) return alert('Nenhum calendário encontrado para este mês.');
                
                // 2. Envia para aprovação
                const link = await global.SocialMediaApproval.sendForApproval(calendar.id);
                
                alert(`Calendário enviado para aprovação!\nLink: ${link}`);
                // Opcional: abrir em nova aba
                // window.open(link, '_blank');
                
            } catch (error) {
                console.error('Erro ao enviar aprovação:', error);
                alert('Erro ao enviar para aprovação.');
            }
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
