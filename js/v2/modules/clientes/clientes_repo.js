// js/v2/modules/clientes/clientes_repo.js
// Repositório de Dados de Clientes V2
// Responsável exclusivamente por buscar dados no Supabase

(function(global) {
    const ClientRepo = {
        /**
         * Busca todos os clientes ativos do tenant atual
         * @returns {Promise<Array>} Lista de clientes
         */
        getClients: async function() {
            if (!global.supabaseClient) {
                console.error('[ClientRepo] Supabase não inicializado');
                return [];
            }

            try {
                // A segurança RLS do Supabase já deve filtrar pelo tenant_id
                // Mas garantimos buscar apenas ativos
                const { data, error } = await global.supabaseClient
                    .from('clientes')
                    .select('*')
                    .eq('ativo', true)
                    .order('nome_fantasia', { ascending: true });

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('[ClientRepo] Erro ao buscar clientes:', error);
                return [];
            }
        },

        createClient: async function(input) {
            if (!global.supabaseClient) {
                console.error('[ClientRepo] Supabase não inicializado');
                return { data: null, error: new Error('Supabase não inicializado') };
            }

            const name = String(input?.nome || '').trim();
            if (!name) {
                return { data: null, error: new Error('Nome obrigatório') };
            }

            if (global.TenantContext?.init) {
                try {
                    await global.TenantContext.init();
                } catch (err) {
                    console.error('[ClientRepo] Falha ao inicializar TenantContext:', err);
                }
            }

            const tenantId = global.TenantContext?.getTenantId ? global.TenantContext.getTenantId() : null;
            const base = {
                nome: name,
                nome_fantasia: name,
                nome_empresa: name,
                empresa: name,
                email: input?.email ? String(input.email).trim() : null,
                status: input?.status || 'ativo',
                tipo_documento: input?.tipo_documento || null,
                documento: input?.documento ? String(input.documento).trim() : null,
                tenant_id: tenantId || null
            };

            const withoutTenant = { ...base };
            delete withoutTenant.tenant_id;

            const attempts = [
                base,
                withoutTenant,
                {
                    nome_fantasia: base.nome_fantasia,
                    nome_empresa: base.nome_empresa,
                    email: base.email,
                    status: base.status,
                    tenant_id: base.tenant_id
                },
                {
                    nome_fantasia: base.nome_fantasia,
                    nome_empresa: base.nome_empresa,
                    email: base.email,
                    status: base.status
                },
                {
                    nome: base.nome,
                    email: base.email,
                    status: base.status,
                    tenant_id: base.tenant_id
                },
                {
                    nome: base.nome,
                    email: base.email,
                    status: base.status
                },
                {
                    nome_fantasia: base.nome_fantasia,
                    nome_empresa: base.nome_empresa,
                    tenant_id: base.tenant_id
                },
                {
                    nome_fantasia: base.nome_fantasia,
                    nome_empresa: base.nome_empresa
                },
                {
                    nome: base.nome,
                    tenant_id: base.tenant_id
                },
                {
                    nome: base.nome
                },
                {
                    nome: base.nome,
                    empresa: base.empresa,
                    email: base.email,
                    status: base.status,
                    tenant_id: base.tenant_id
                },
                {
                    nome: base.nome,
                    empresa: base.empresa,
                    email: base.email,
                    status: base.status
                },
                {
                    nome: base.nome,
                    empresa: base.empresa
                }
            ];

            console.log('[ClientRepo] createClient payload base:', base);
            console.log('[ClientRepo] createClient tenantId:', tenantId);

            let lastError = null;
            for (const payload of attempts) {
                console.log('[ClientRepo] Tentando insert clientes:', payload);
                const { data, error } = await global.supabaseClient
                    .from('clientes')
                    .insert([payload])
                    .select('*');
                console.log('[ClientRepo] Resposta insert clientes:', { data, error });
                if (!error) {
                    const created = Array.isArray(data) ? data[0] : data;
                    return { data: created || null, error: null };
                }
                lastError = error;
            }

            return { data: null, error: lastError };
        },

        /**
         * Busca um cliente específico pelo ID
         * @param {string} id 
         * @returns {Promise<Object|null>} Cliente encontrado ou null
         */
        getClientById: async function(id) {
            if (!global.supabaseClient || !id) return null;

            try {
                const { data, error } = await global.supabaseClient
                    .from('clientes')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error(`[ClientRepo] Erro ao buscar cliente ${id}:`, error);
                return null;
            }
        }
    };

    // Expor globalmente
    global.ClientRepo = ClientRepo;

})(window);
