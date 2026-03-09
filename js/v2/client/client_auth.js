// js/v2/client/client_auth.js
// Autenticação específica para o Portal do Cliente V2

(function(global) {
    const ClientAuth = {
        sessionKey: 'V2_CLIENT_SESSION',

        init: async function() {
            // Garantir Supabase
            if (!global.supabaseClient) {
                if (global.initSupabase) {
                    await global.initSupabase();
                } else {
                    console.error('[ClientAuth] Supabase não encontrado.');
                }
            }
        },

        /**
         * Realiza login do cliente
         * @param {string} email 
         * @param {string} password 
         */
        login: async function(email, password) {
            if (!global.supabaseClient) await this.init();

            try {
                // 1. Auth no Supabase
                const { data: authData, error: authError } = await global.supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (authError) throw authError;
                const user = authData.session?.user;

                if (!user) throw new Error('Sessão não criada.');

                // 2. Verificar se é cliente na tabela 'clientes'
                // Tenta buscar pelo email exato
                const { data: clientData, error: clientError } = await global.supabaseClient
                    .from('clientes')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle();

                if (clientError) {
                    console.error('[ClientAuth] Erro ao buscar cliente:', clientError);
                    // Não bloqueia login se der erro de permissão (RLS), mas avisa
                    // Se RLS bloquear, clientData será null
                }

                if (!clientData) {
                    // Se não achou cliente com esse email, faz logout e nega
                    await global.supabaseClient.auth.signOut();
                    throw new Error('Este e-mail não está vinculado a nenhum cliente ativo.');
                }

                // 3. Salvar sessão do cliente
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
            if (!global.supabaseClient) await this.init();

            try {
                // 1. Cria usuário no Auth
                const { data, error } = await global.supabaseClient.auth.signUp({
                    email,
                    password
                });

                if (error) throw error;

                // Nota: Não verificamos 'clientes' aqui pois o RLS pode impedir leitura para anônimos.
                // A verificação real acontece no primeiro login.
                
                return { success: true, data };
            } catch (error) {
                console.error('[ClientAuth] Falha no registro:', error);
                // Tratamento de mensagens amigáveis
                let msg = error.message;
                if (msg.includes('already registered')) msg = 'Este e-mail já possui cadastro. Tente fazer login.';
                return { success: false, error: msg };
            }
        },

        logout: async function() {
            if (global.supabaseClient) {
                await global.supabaseClient.auth.signOut();
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
