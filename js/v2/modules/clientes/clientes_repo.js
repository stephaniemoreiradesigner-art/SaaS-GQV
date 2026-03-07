// js/v2/modules/clientes/clientes_repo.js
// Repositório de Dados de Clientes V2
// Responsável exclusivamente por buscar dados no Supabase

(function(global) {
    let schemaCache = null;

    const detectSchema = async function() {
        if (schemaCache) return schemaCache;
        if (!global.supabaseClient) return null;

        const testColumn = async (column) => {
            const { error } = await global.supabaseClient
                .from('clientes')
                .select(column)
                .limit(1);
            return !error;
        };

        const columns = {};
        const candidates = [
            'nome_fantasia',
            'nome_empresa',
            'nome',
            'empresa',
            'email',
            'status',
            'status_cliente',
            'situacao',
            'ativo',
            'tipo_documento',
            'documento',
            'tenant_id'
        ];

        for (const column of candidates) {
            columns[column] = await testColumn(column);
        }

        const nameColumn =
            (columns.nome_fantasia && 'nome_fantasia') ||
            (columns.nome_empresa && 'nome_empresa') ||
            (columns.nome && 'nome') ||
            (columns.empresa && 'empresa') ||
            null;

        const statusColumn =
            (columns.status && 'status') ||
            (columns.status_cliente && 'status_cliente') ||
            (columns.situacao && 'situacao') ||
            null;

        schemaCache = {
            columns,
            nameColumn,
            statusColumn,
            hasTenantId: !!columns.tenant_id,
            hasAtivo: !!columns.ativo
        };

        console.log('[ClientRepo] Schema clientes detectado:', schemaCache);
        return schemaCache;
    };

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
                const schema = await detectSchema();
                let query = global.supabaseClient.from('clientes').select('*');
                if (schema?.hasAtivo) {
                    query = query.eq('ativo', true);
                } else if (schema?.statusColumn) {
                    query = query.eq(schema.statusColumn, 'ativo');
                }
                if (schema?.nameColumn) {
                    query = query.order(schema.nameColumn, { ascending: true });
                }
                const { data, error } = await query;

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

            const schema = await detectSchema();
            let tenantId = schema?.hasTenantId && global.TenantContext?.getTenantId ? global.TenantContext.getTenantId() : null;
            let tenantSource = 'tenantContext';
            const { data: userData, error: userError } = await global.supabaseClient.auth.getUser();
            if (userError) {
                console.error('[ClientRepo] Erro ao obter usuário autenticado:', userError);
            }
            const user = userData?.user || null;
            if (!tenantId && user) {
                const rawTenant = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id || user.user_metadata?.cliente_id || user.app_metadata?.cliente_id;
                if (rawTenant) {
                    tenantId = Number(rawTenant);
                    tenantSource = 'auth_metadata';
                }
            }
            if (!tenantId && schema?.hasTenantId) {
                console.warn('[ClientRepo] tenant_id não resolvido para insert em clientes.');
            }
            const payload = {};
            if (schema?.columns?.nome_fantasia) payload.nome_fantasia = name;
            if (schema?.columns?.nome_empresa) payload.nome_empresa = name;
            if (schema?.columns?.nome) payload.nome = name;
            if (schema?.columns?.empresa) payload.empresa = name;
            if (schema?.columns?.email) payload.email = input?.email ? String(input.email).trim() : null;
            if (schema?.columns?.tipo_documento) payload.tipo_documento = input?.tipo_documento || null;
            if (schema?.columns?.documento) payload.documento = input?.documento ? String(input.documento).trim() : null;
            if (schema?.statusColumn) payload[schema.statusColumn] = input?.status || 'ativo';
            if (schema?.hasAtivo) payload.ativo = true;
            if (schema?.hasTenantId && tenantId) payload.tenant_id = tenantId;

            const attempts = [payload];

            if (!Object.keys(payload).length) {
                return { data: null, error: new Error('Schema de clientes não identificado') };
            }

            const withoutTenant = { ...payload };
            delete withoutTenant.tenant_id;
            if (schema?.hasTenantId && Object.keys(withoutTenant).length) {
                attempts.push(withoutTenant);
            }

            console.log('[ClientRepo] createClient payload:', payload);
            console.log('[ClientRepo] createClient tenantId:', tenantId, 'source:', tenantSource);

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
