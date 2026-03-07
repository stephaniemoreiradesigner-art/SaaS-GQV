// js/v2/trafego_pago_bridge.js
// Ponte para integrar o módulo de Tráfego Pago legado ao ClientContext V2

(function() {
    console.log('[Trafego Bridge] Inicializando ponte...');

    function syncTrafegoContext() {
        const filterSelect = document.getElementById('filter-cliente');
        const reportSelect = document.getElementById('report-client-select');
        
        // Se não houver selects na tela, talvez não estejamos na página certa
        if (!filterSelect && !reportSelect) return;

        // 1. Ler contexto atual
        let currentId = null;
        if (window.ClientContext) {
            currentId = window.ClientContext.getActiveClient();
        } else {
            currentId = localStorage.getItem('GQV_ACTIVE_CLIENT_ID');
        }

        // 2. Atualizar selects se tiver ID
        if (currentId) {
            if (filterSelect) filterSelect.value = currentId;
            if (reportSelect) reportSelect.value = currentId;
            
            // Disparar evento change para atualizar a UI do módulo
            // Mas cuidado com loops infinitos se o change listener atualizar o contexto de volta
        }

        // 3. Adicionar listeners nos selects para atualizar o Contexto
        const updateContext = (e) => {
            const newVal = e.target.value;
            if (window.ClientContext) {
                window.ClientContext.setActiveClient(newVal);
            } else {
                localStorage.setItem('GQV_ACTIVE_CLIENT_ID', newVal);
            }
        };

        if (filterSelect) filterSelect.addEventListener('change', updateContext);
        if (reportSelect) reportSelect.addEventListener('change', updateContext);

        // 4. Ouvir mudanças externas do Contexto
        window.addEventListener('gqv:client-changed', (e) => {
            const newId = e.detail?.clientId;
            if (newId) {
                if (filterSelect && filterSelect.value !== newId) {
                    filterSelect.value = newId;
                    // Forçar recarga se necessário
                    if (window.generateTrafficReport) window.generateTrafficReport(); 
                }
                if (reportSelect && reportSelect.value !== newId) {
                    reportSelect.value = newId;
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncTrafegoContext);
    } else {
        syncTrafegoContext();
    }
})();
