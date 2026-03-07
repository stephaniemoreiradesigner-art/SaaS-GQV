// js/v2/bootstrap.js
// Bootstrap Oficial V2 - Orquestrador de Inicialização
// Garante que TenantContext e ClientContext sejam carregados na ordem correta
// e que a aplicação só inicie quando os dados fundamentais estiverem prontos.

(function(global) {
    if (global.__GQV_BOOTSTRAP_V2__) return;
    global.__GQV_BOOTSTRAP_V2__ = true;

    console.log('[V2 Bootstrap] Iniciando sequência de boot...');

    async function boot() {
        // 1. Aguardar Supabase e Auth (app.js legado)
        if (!global.supabaseClient) {
            console.log('[V2 Bootstrap] Aguardando supabaseReady...');
            await new Promise(resolve => window.addEventListener('supabaseReady', resolve, { once: true }));
        }

        console.log('[V2 Bootstrap] Supabase detectado. Inicializando contextos...');

        // 2. Inicializar TenantContext (Async - vai ao banco)
        if (global.TenantContext) {
            await global.TenantContext.init();
            const tenant = global.TenantContext.get();
            if (!tenant.tenantId) {
                console.warn('[V2 Bootstrap] Tenant ID não resolvido. App pode estar em estado inconsistente.');
            }
        } else {
            console.error('[V2 Bootstrap] TenantContext não encontrado!');
        }

        // 3. Inicializar ClientContext (Sync/Storage)
        if (global.ClientContext) {
            await global.ClientContext.init();
        } else {
            console.error('[V2 Bootstrap] ClientContext não encontrado!');
        }

        // 4. Sinalizar Prontidão
        console.log('[V2 Bootstrap] Boot completo. Disparando v2:ready');
        window.dispatchEvent(new CustomEvent('v2:ready'));
        document.body.classList.add('v2-ready');
    }

    // Iniciar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})(window);
