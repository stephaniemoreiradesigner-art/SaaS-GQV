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
            const page = window.location.pathname;
            if (
                page.includes('/login.html') ||
                page.includes('/register.html')
            ) {
                return;
            }

            const path = page;
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
            // Flag para indicar que a sessão inicial foi verificada
            this.initialCheckDone = true;
            this.handleRouting(data.session, 'INITIAL_CHECK');
        },

        handleRouting: function(session, event) {
            // [GUARD] Ignorar TOKEN_REFRESHED para evitar loops
            if (event === 'TOKEN_REFRESHED') {
                console.log('[AuthGuard] Ignorando TOKEN_REFRESHED');
                return;
            }

            const path = window.location.pathname;
            const isLoginPage = path.includes('login.html') || path.includes('register.html');
            
            // Regras para Portal do Cliente
            if (this.context === 'client') {
                const targetIndex = '/v2/client/index.html';
                const targetLogin = '/v2/client/login.html';
                const hasPortalSessionMeta = !!localStorage.getItem('V2_CLIENT_SESSION');

                // Caso 1: Usuário logado na página de login -> Dashboard
                if (session && isLoginPage) {
                    if (!hasPortalSessionMeta) {
                        console.warn('[AuthGuard] Sessão Supabase ativa, mas V2_CLIENT_SESSION ausente. Mantendo no login para re-hidratar contexto.');
                        return;
                    }
                    if (path !== targetIndex) {
                        console.log('[AuthGuard] Cliente logado no login -> Dashboard');
                        window.location.href = targetIndex;
                    }
                    return;
                }

                // Caso 2: Usuário deslogado em página protegida -> Login
                if (!session && !isLoginPage) {
                    if (path !== targetLogin) {
                        console.log('[AuthGuard] Cliente deslogado em área protegida -> Login');
                        window.location.href = targetLogin;
                    }
                    return;
                }
            }
            
            // Regras para Agência (Expandir futuramente se necessário)
            if (this.context === 'agency') {
                const targetIndex = '/v2/agency/index.html';
                const targetLogin = '/v2/agency/login.html';

                if (session && isLoginPage) {
                    if (path !== targetIndex) {
                        console.log('[AuthGuard] Agência logada no login -> Dashboard');
                        window.location.href = targetIndex;
                    }
                    return;
                }
                if (!session && !isLoginPage) {
                    if (path !== targetLogin) {
                        console.log('[AuthGuard] Agência deslogada em área protegida -> Login');
                        window.location.href = targetLogin;
                    }
                    return;
                }
            }
        }
    };

    global.AuthGuard = AuthGuard;

})(window);
