// js/v2/shared/auth_guard.js
// Auth Guard Centralizado para V2 (Agência e Cliente)
// Responsável por:
// 1. Inicializar o Supabase via Factory
// 2. Monitorar estado de autenticação
// 3. Gerenciar redirecionamentos automáticos
// 4. Expor estado de sessão globalmente de forma segura

(function(global) {
    const AuthGuard = {
        client: null,
        context: null, // 'agency' | 'client'
        initialized: false,

        init: async function() {
            if (this.initialized) return;
            
            // 1. Detectar Contexto
            const path = window.location.pathname;
            if (path.includes('/v2/client/')) {
                this.context = 'client';
            } else if (path.includes('/v2/agency/')) {
                this.context = 'agency';
            } else {
                console.warn('[AuthGuard] Contexto desconhecido, abortando.');
                return;
            }

            console.log(`[AuthGuard] Inicializando contexto: ${this.context.toUpperCase()}`);

            // 2. Obter Cliente Supabase Apropriado
            if (!global.SupabaseFactory) {
                console.error('[AuthGuard] SupabaseFactory não encontrada.');
                return;
            }

            if (this.context === 'client') {
                this.client = await global.SupabaseFactory.getClientPortalClient();
            } else {
                this.client = await global.SupabaseFactory.getAgencyClient();
            }

            if (!this.client) {
                console.error('[AuthGuard] Falha ao obter cliente Supabase.');
                return;
            }

            // 3. Registrar Listener Único
            this.setupListener();
            this.initialized = true;

            // 4. Verificação Inicial
            this.checkCurrentSession();
        },

        setupListener: function() {
            this.client.auth.onAuthStateChange((event, session) => {
                console.log(`[AuthGuard] Evento: ${event} | Contexto: ${this.context}`);
                this.handleRouting(session, event);
            });
        },

        checkCurrentSession: async function() {
            const { data } = await this.client.auth.getSession();
            this.handleRouting(data.session, 'INITIAL_CHECK');
        },

        handleRouting: function(session, event) {
            const path = window.location.pathname;
            const isLoginPage = path.includes('login.html') || path.includes('register.html');
            
            // Regras para Portal do Cliente
            if (this.context === 'client') {
                // Caso 1: Usuário logado na página de login -> Dashboard
                if (session && isLoginPage) {
                    console.log('[AuthGuard] Cliente logado no login -> Dashboard');
                    window.location.href = '/v2/client/index.html';
                    return;
                }

                // Caso 2: Usuário deslogado em página protegida -> Login
                if (!session && !isLoginPage) {
                    console.log('[AuthGuard] Cliente deslogado em área protegida -> Login');
                    window.location.href = '/v2/client/login.html';
                    return;
                }
            }
            
            // Regras para Agência (Expandir futuramente se necessário)
            if (this.context === 'agency') {
                if (session && isLoginPage) {
                    console.log('[AuthGuard] Agência logada no login -> Dashboard');
                    window.location.href = '/v2/agency/index.html';
                    return;
                }
                if (!session && !isLoginPage) {
                    console.log('[AuthGuard] Agência deslogada em área protegida -> Login');
                    window.location.href = '/v2/agency/login.html';
                    return;
                }
            }
        }
    };

    // Auto-init se DOM estiver pronto, ou aguarda
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AuthGuard.init());
    } else {
        AuthGuard.init();
    }

    global.AuthGuard = AuthGuard;

})(window);
