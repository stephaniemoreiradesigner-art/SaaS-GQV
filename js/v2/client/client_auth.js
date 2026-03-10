// js/v2/client/client_auth.js
// Autenticação específica para o Portal do Cliente V2

(function(global) {
    const ClientAuth = {
        sessionKey: 'V2_CLIENT_SESSION',

        init: async function() {
            // Se já temos o cliente isolado, retorna
            if (global.clientPortalSupabase) return;

            // Tentar usar Factory Centralizada
            if (global.SupabaseFactory) {
                const client = await global.SupabaseFactory.getClientPortalClient();
                if (client) {
                    global.clientPortalSupabase = client;
                    return;
                }
            }

            // Fallback legado (caso Factory não esteja carregada)
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
            console.log('[ClientAuth] Inicializando cliente Supabase ISOLADO para o Portal (Legado/Fallback)...');
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

            // [AUTH-GUARD] Lógica centralizada em auth_guard.js
            // Listener removido daqui para evitar conflitos
        },

        getPortalLink: async function(userId) {
            await this.init();
            const supabase = global.clientPortalSupabase;
            if (!supabase || !userId) return { data: null, error: new Error('Supabase ou userId ausente') };

            const { data, error } = await supabase
                .from('client_portal_users')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            return { data, error };
        },

        createPortalLink: async function({ userId, clientId, tenantId, email }) {
            await this.init();
            const supabase = global.clientPortalSupabase;
            if (!supabase) return { ok: false, reason: 'supabase_missing' };
            if (!userId) return { ok: false, reason: 'user_missing' };
            const normalizedClientId = clientId ? Number(clientId) : null;
            if (!normalizedClientId || Number.isNaN(normalizedClientId)) return { ok: false, reason: 'client_id_missing' };

            const payload = {
                user_id: userId,
                client_id: normalizedClientId,
                tenant_id: tenantId ? Number(tenantId) : normalizedClientId
            };

            const { data: inserted, error } = await supabase
                .from('client_portal_users')
                .insert(payload)
                .select('*')
                .maybeSingle();
            if (error) {
                console.error('[ClientAuth] Falha ao inserir vínculo em client_portal_users:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    payload
                });
                return { ok: false, reason: 'portal_link_insert_failed', error };
            }
            if (!inserted) {
                console.error('[ClientAuth] Insert não retornou registro em client_portal_users:', payload);
                return { ok: false, reason: 'portal_link_insert_no_return' };
            }

            try {
                await supabase.auth.updateUser({ data: { tenant_id: normalizedClientId } });
            } catch {}
            try {
                const refreshed = await supabase.auth.refreshSession();
                const newToken = refreshed?.data?.session?.access_token || null;
                if (newToken) {
                    const existing = this.checkSession();
                    const updated = existing && typeof existing === 'object' ? { ...existing, token: newToken } : null;
                    if (updated) localStorage.setItem(this.sessionKey, JSON.stringify(updated));
                }
            } catch {}

            return { ok: true, data: inserted };
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

                // 2. Resolver vínculo via tabela do portal
                const { data: link, error: linkError } = await this.getPortalLink(user.id);
                if (linkError) {
                    console.error('[ClientAuth] Erro ao buscar vínculo do portal:', linkError);
                }
                if (!link?.client_id) {
                    await global.clientPortalSupabase.auth.signOut();
                    throw new Error('Seu usuário do portal ainda não está vinculado a um cliente. Solicite o convite correto.');
                }

                const linkedClientId = String(link.client_id);
                try {
                    await global.clientPortalSupabase.auth.updateUser({ data: { tenant_id: Number(link.client_id) } });
                    await global.clientPortalSupabase.auth.refreshSession();
                } catch {}

                let clientData = null;
                try {
                    const { data } = await global.clientPortalSupabase
                        .from('clientes')
                        .select('*')
                        .eq('id', linkedClientId)
                        .maybeSingle();
                    clientData = data || null;
                } catch {}

                // 3. Salvar sessão do cliente (Metadados extras)
                const sessionPayload = {
                    auth_id: user.id,
                    client_id: linkedClientId,
                    name: clientData?.nome_fantasia || clientData?.nome || clientData?.nome_empresa || 'Cliente',
                    email: email,
                    token: authData.session.access_token
                };
                
                localStorage.setItem(this.sessionKey, JSON.stringify(sessionPayload));
                
                // [AUTH-GUARD] Redirect automático ocorrerá via AuthGuard.js ao detectar sessão
                
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

        registerAndLink: async function(email, password, { clientId, tenantId } = {}) {
            await this.init();
            const supabase = global.clientPortalSupabase;
            if (!supabase) return { success: false, error: 'Falha ao iniciar autenticação do portal.' };

            try {
                const signUpResult = await this.register(email, password);
                if (!signUpResult.success) return signUpResult;

                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) throw signInError;

                const userId = signInData?.session?.user?.id || null;
                if (!userId) throw new Error('Usuário não encontrado após registro.');

                const linkResult = await this.createPortalLink({ userId, clientId, tenantId, email });
                if (!linkResult.ok) {
                    await supabase.auth.signOut();
                    if (linkResult.reason === 'client_id_missing') {
                        throw new Error('Não foi possível identificar o cliente do convite. Solicite um link de registro com client_id.');
                    }
                    throw new Error('Não foi possível vincular o usuário ao cliente. Solicite suporte.');
                }

                await supabase.auth.signOut();
                localStorage.removeItem(this.sessionKey);
                return { success: true };
            } catch (error) {
                console.error('[ClientAuth] Falha no registro com vínculo:', error);
                return { success: false, error: error.message || 'Erro desconhecido' };
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

        ensurePortalSession: async function() {
            await this.init();
            const supabase = global.clientPortalSupabase;
            if (!supabase) {
                return { ok: false, reason: 'supabase_missing' };
            }

            const { data: sessionData } = await supabase.auth.getSession();
            const authSession = sessionData?.session || null;
            if (!authSession) {
                localStorage.removeItem(this.sessionKey);
                return { ok: false, reason: 'no_auth_session' };
            }

            const email = authSession.user?.email || null;
            if (!email) {
                await supabase.auth.signOut();
                localStorage.removeItem(this.sessionKey);
                return { ok: false, reason: 'no_email' };
            }

            const { data: link, error: linkError } = await this.getPortalLink(authSession.user?.id);
            if (linkError) {
                await supabase.auth.signOut();
                localStorage.removeItem(this.sessionKey);
                return { ok: false, reason: 'portal_link_query_error', error: linkError };
            }

            if (!link?.client_id) {
                await supabase.auth.signOut();
                localStorage.removeItem(this.sessionKey);
                return { ok: false, reason: 'portal_link_missing' };
            }

            const linkedClientId = String(link.client_id);
            try {
                await supabase.auth.updateUser({ data: { tenant_id: Number(link.client_id) } });
            } catch {}
            try {
                const refreshed = await supabase.auth.refreshSession();
                const newToken = refreshed?.data?.session?.access_token || null;
                if (newToken) authSession.access_token = newToken;
            } catch {}

            let clientName = 'Cliente';
            try {
                const { data: clientData } = await supabase
                    .from('clientes')
                    .select('id,nome_fantasia,nome,nome_empresa')
                    .eq('id', linkedClientId)
                    .maybeSingle();
                clientName = clientData?.nome_fantasia || clientData?.nome || clientData?.nome_empresa || clientName;
            } catch {}

            const sessionPayload = {
                auth_id: authSession.user?.id,
                client_id: linkedClientId,
                name: clientName,
                email,
                token: authSession.access_token
            };

            localStorage.setItem(this.sessionKey, JSON.stringify(sessionPayload));
            return { ok: true, session: sessionPayload };
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
