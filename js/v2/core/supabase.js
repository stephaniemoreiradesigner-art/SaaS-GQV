// js/v2/core/supabase.js
// Supabase Singleton & Factory - Centraliza a criação de clientes Supabase

(function(global) {
    // Configuração interna (carregada via fetch ou global)
    let supabaseConfig = null;
    let agencyClientInstance = null;
    let clientPortalInstance = null;

    const SupabaseFactory = {
        
        /**
         * Carrega configurações do endpoint /config se necessário
         */
        loadConfig: async function() {
            if (supabaseConfig) return supabaseConfig;
            if (global.supabaseConfig) {
                supabaseConfig = global.supabaseConfig;
                return supabaseConfig;
            }

            try {
                const res = await fetch('/config');
                if (!res.ok) throw new Error('Falha ao carregar config');
                const data = await res.json();
                
                if (data?.supabaseUrl && data?.supabaseAnonKey) {
                    supabaseConfig = {
                        supabaseUrl: data.supabaseUrl,
                        supabaseAnonKey: data.supabaseAnonKey
                    };
                    global.supabaseConfig = supabaseConfig; // Cache global
                    return supabaseConfig;
                }
            } catch (err) {
                console.error('[SupabaseFactory] Erro ao carregar configuração:', err);
            }
            return null;
        },

        /**
         * Retorna a instância do cliente Supabase para a Agência (Sessão Global)
         * Usa storageKey padrão (sb-...)
         */
        getAgencyClient: async function() {
            if (agencyClientInstance) return agencyClientInstance;
            
            // Se já existe window.supabaseClient criado por app.js legado, reaproveita
            if (global.supabaseClient && !agencyClientInstance) {
                agencyClientInstance = global.supabaseClient;
                return agencyClientInstance;
            }

            const config = await this.loadConfig();
            if (!config || !global.supabase) {
                console.error('[SupabaseFactory] Dependências não prontas');
                return null;
            }

            console.log('[SupabaseFactory] Criando cliente Agência...');
            agencyClientInstance = global.supabase.createClient(
                config.supabaseUrl,
                config.supabaseAnonKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );
            
            // Retrocompatibilidade
            global.supabaseClient = agencyClientInstance;
            
            return agencyClientInstance;
        },

        /**
         * Retorna a instância do cliente Supabase para o Portal do Cliente (Sessão Isolada)
         * Usa storageKey personalizada
         */
        getClientPortalClient: async function() {
            if (clientPortalInstance) return clientPortalInstance;
            
            // Se já existe criado por client_auth.js legado
            if (global.clientPortalSupabase) {
                clientPortalInstance = global.clientPortalSupabase;
                return clientPortalInstance;
            }

            const config = await this.loadConfig();
            if (!config || !global.supabase) {
                console.error('[SupabaseFactory] Dependências não prontas');
                return null;
            }

            console.log('[SupabaseFactory] Criando cliente Portal do Cliente (Isolado)...');
            clientPortalInstance = global.supabase.createClient(
                config.supabaseUrl,
                config.supabaseAnonKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: false, // Gerenciado manualmente no portal
                        storageKey: 'gqv_client_portal_session'
                    }
                }
            );

            // Disponibilizar globalmente para client_auth.js
            global.clientPortalSupabase = clientPortalInstance;

            return clientPortalInstance;
        }
    };

    global.SupabaseFactory = SupabaseFactory;

})(window);
