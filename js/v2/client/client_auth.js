// js/v2/client/client_auth.js
// Autenticação específica para o Portal do Cliente V2

(function(global) {
    const ClientAuth = {
        sessionKey: 'V2_CLIENT_SESSION',

        init: async function() {
            // Se já temos o cliente isolado, retorna
            if (global.clientPortalSupabase) return;

            // Aguarda configuração do Supabase carregar (via app.js ou fetch direto)
            if (!global.supabaseConfig) {
                if (global.loadSupabaseConfig) {
                    await global.loadSupabaseConfig();
                }
            }

            if (!global.supabase || !global.supabaseConfig) {
                console.error('[ClientAuth] Dependências do Supabase não encontradas.');
                return;
            }

            // [ISOLATION] Criar instância isolada para o Portal do Cliente
            // Usa storageKey diferente para não compartilhar sessão com a Agência
            console.log('[ClientAuth] Inicializando cliente Supabase ISOLADO para o Portal...');
            global.clientPortalSupabase = global.supabase.createClient(
                global.supabaseConfig.supabaseUrl,
                global.supabaseConfig.supabaseAnonKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: false, // Gerenciado manualmente se precisar
                        storageKey: 'gqv_client_portal_session' // Chave exclusiva
                    }
                }
            );
        },

        /**
         * Realiza login do cliente
         * @param {string} email 
         * @param {string} password 
         */
        login: async function(email, password) {
            await this.init();

            try {
                // 1. Auth no Supabase (Cliente Isolado)
                const { data: authData, error: authError } = await global.clientPortalSupabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (authError) throw authError;
                const user = authData.session?.user;

                if (!user) throw new Error('Sessão não criada.');

                // 2. Verificar se é cliente na tabela 'clientes'
                // Usa o cliente isolado para a query também (mesmo banco)
                const { data: clientDataList, error: clientError } = await global.clientPortalSupabase
                    .from('clientes')
                    .select('*')
                    .eq('email', email);

                if (clientError) {
                    console.error('[ClientAuth] Erro ao buscar cliente:', clientError);
                }

                if (!clientDataList || clientDataList.length === 0) {
                    await global.clientPortalSupabase.auth.signOut();
                    throw new Error('Este e-mail não está vinculado a nenhum cliente ativo. Solicite acesso à sua agência.');
                }

                if (clientDataList.length > 1) {
                    await global.clientPortalSupabase.auth.signOut();
                    console.warn('[ClientAuth] E-mail duplicado em clientes:', email);
                    throw new Error('Este e-mail está vinculado a mais de um cliente. Ajuste o cadastro para usar um e-mail exclusivo no portal.');
                }

                const clientData = clientDataList[0];

                // 3. Salvar sessão do cliente (Metadados extras)
                const sessionPayload = {
                    auth_id: user.id,
                    client_id: clientData.id,
                    name: clientData.nome_fantasia || clientData.nome || 'Cliente',
                    email: clientData.email,
                    token: authData.session.access_token
                };
                
                localStorage.setItem(this.sessionKey, JSON.stringify(sessionPayload));
                
                return { success: true, client: sessionPayload };

            } catch (error) {
                console.error('[ClientAuth] Falha no login:', error);
                return { success: false, error: error.message || 'Erro desconhecido' };
            }
        },

        /**
         * Registra senha (primeiro acesso)
         * @param {string} email 
         * @param {string} password 
         */
        register: async function(email, password) {
            await this.init();

            try {
                // 1. Cria usuário no Auth (Cliente Isolado)
                const { data, error } = await global.clientPortalSupabase.auth.signUp({
                    email,
                    password
                });

                if (error) throw error;
                
                return { success: true, data };
            } catch (error) {
                console.error('[ClientAuth] Falha no registro:', error);
                let msg = error.message;
                if (msg.includes('already registered')) msg = 'Este e-mail já possui cadastro. Tente fazer login.';
                return { success: false, error: msg };
            }
        },

        logout: async function() {
            await this.init();
            if (global.clientPortalSupabase) {
                await global.clientPortalSupabase.auth.signOut();
            }
            localStorage.removeItem(this.sessionKey);
            window.location.href = '/v2/client/login.html';
        },

        checkSession: function() {
            const json = localStorage.getItem(this.sessionKey);
            if (!json) {
                return null;
            }
            try {
                return JSON.parse(json);
            } catch (e) {
                return null;
            }
        },

        requireAuth: function() {
            const session = this.checkSession();
            if (!session) {
                window.location.href = '/v2/client/login.html';
                return null;
            }
            return session;
        }
    };

    global.ClientAuth = ClientAuth;

})(window);
