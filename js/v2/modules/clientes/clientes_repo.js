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
            'logo_url',
            'logo',
            'imagem_logo',
            'brand_logo_url',
            'responsavel_nome',
            'responsavel',
            'contato',
            'contato_nome',
            'telefone',
            'celular',
            'phone',
            'telefone_contato',
            'contato_telefone',
            'whatsapp',
            'responsavel_whatsapp',
            'telefone_whatsapp',
            'whatsapp_numero',
            'whats',
            'servicos',
            'servicos_contratados',
            'servicos_ativos',
            'produtos',
            'planos',
            'status',
            'status_cliente',
            'situacao',
            'ativo',
            'tipo_documento',
            'documento',
            'cnpj',
            'cpf',
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

        const logoColumn =
            (columns.logo_url && 'logo_url') ||
            (columns.brand_logo_url && 'brand_logo_url') ||
            (columns.imagem_logo && 'imagem_logo') ||
            (columns.logo && 'logo') ||
            null;

        const contactColumn =
            (columns.responsavel_nome && 'responsavel_nome') ||
            (columns.responsavel && 'responsavel') ||
            (columns.contato_nome && 'contato_nome') ||
            (columns.contato && 'contato') ||
            null;

        const phoneColumn =
            (columns.telefone && 'telefone') ||
            (columns.celular && 'celular') ||
            (columns.telefone_contato && 'telefone_contato') ||
            (columns.contato_telefone && 'contato_telefone') ||
            (columns.phone && 'phone') ||
            null;

        const whatsappColumn =
            (columns.responsavel_whatsapp && 'responsavel_whatsapp') ||
            (columns.telefone_whatsapp && 'telefone_whatsapp') ||
            (columns.whatsapp && 'whatsapp') ||
            (columns.whatsapp_numero && 'whatsapp_numero') ||
            (columns.whats && 'whats') ||
            null;

        const servicesColumn =
            (columns.servicos && 'servicos') ||
            (columns.servicos_contratados && 'servicos_contratados') ||
            (columns.servicos_ativos && 'servicos_ativos') ||
            (columns.planos && 'planos') ||
            (columns.produtos && 'produtos') ||
            null;

        const docColumn =
            (columns.documento && 'documento') ||
            (columns.cnpj && 'cnpj') ||
            (columns.cpf && 'cpf') ||
            null;

        schemaCache = {
            columns,
            nameColumn,
            statusColumn,
            logoColumn,
            contactColumn,
            phoneColumn,
            whatsappColumn,
            servicesColumn,
            docColumn,
            hasTenantId: !!columns.tenant_id,
            hasAtivo: !!columns.ativo
        };

        console.log('[ClientRepo] Schema clientes detectado:', schemaCache);
        return schemaCache;
    };

    const ClientRepo = {
        updateClient: async function(clientId, input) {
            if (!global.supabaseClient) {
                console.error('[ClientRepo] Supabase não inicializado');
                return { data: null, error: new Error('Supabase não inicializado') };
            }
            const normalizedId = clientId ? String(clientId).trim() : '';
            if (!normalizedId) {
                return { data: null, error: new Error('clientId obrigatório') };
            }

            try {
                const schema = await detectSchema();
                if (!schema) return { data: null, error: new Error('Schema de clientes não identificado') };

                const companyName = String(input?.nome_empresa || input?.nome || '').trim();
                const tradeName = String(input?.nome_fantasia || '').trim();
                const emailValue = input?.email !== undefined ? String(input.email || '').trim() : undefined;
                const contactValue = input?.responsavel !== undefined
                    ? String(input.responsavel || '').trim()
                    : (input?.responsavel_nome !== undefined ? String(input.responsavel_nome || '').trim() : undefined);
                const phoneValue = input?.telefone !== undefined ? String(input.telefone || '').trim() : undefined;
                const whatsappValue = input?.whatsapp !== undefined ? String(input.whatsapp || '').trim() : undefined;
                const logoValue = input?.logo_url !== undefined ? String(input.logo_url || '').trim() : undefined;
                const docTypeValue = input?.tipo_documento !== undefined ? String(input.tipo_documento || '').trim() : undefined;
                const documentoValue = input?.documento !== undefined ? String(input.documento || '').trim() : undefined;
                const statusValue = input?.status !== undefined ? String(input.status || '').trim() : undefined;

                const updatePayload = {};
                if (schema.columns.nome_empresa && companyName) updatePayload.nome_empresa = companyName;
                if (schema.columns.nome_fantasia && tradeName) updatePayload.nome_fantasia = tradeName;
                if (!updatePayload[schema.nameColumn] && schema.nameColumn) {
                    const fallbackName = companyName || tradeName;
                    if (fallbackName) updatePayload[schema.nameColumn] = fallbackName;
                }
                if (schema.columns.nome && companyName && schema.nameColumn !== 'nome') updatePayload.nome = companyName;
                if (schema.columns.empresa && companyName && schema.nameColumn !== 'empresa') updatePayload.empresa = companyName;
                if (schema.columns.email && emailValue !== undefined) updatePayload.email = emailValue === '' ? null : emailValue;
                if (schema.contactColumn && contactValue !== undefined) updatePayload[schema.contactColumn] = contactValue === '' ? null : contactValue;
                if (schema.phoneColumn && phoneValue !== undefined) updatePayload[schema.phoneColumn] = phoneValue === '' ? null : phoneValue;
                if (schema.whatsappColumn && whatsappValue !== undefined) updatePayload[schema.whatsappColumn] = whatsappValue === '' ? null : whatsappValue;
                if (schema.logoColumn && logoValue !== undefined) updatePayload[schema.logoColumn] = logoValue === '' ? null : logoValue;
                if (schema.columns.tipo_documento && docTypeValue !== undefined) updatePayload.tipo_documento = docTypeValue === '' ? null : docTypeValue;
                if (schema.docColumn && documentoValue !== undefined) updatePayload[schema.docColumn] = documentoValue === '' ? null : documentoValue;
                if (schema.statusColumn && statusValue !== undefined) updatePayload[schema.statusColumn] = statusValue === '' ? 'ativo' : statusValue;
                if (schema.hasAtivo && statusValue !== undefined) updatePayload.ativo = (statusValue === '' ? 'ativo' : statusValue) === 'ativo';

                if (schema.servicesColumn) {
                    const services = Array.isArray(input?.servicos) ? input.servicos : undefined;
                    if (services !== undefined) {
                        if (schema.servicesColumn === 'servicos') updatePayload[schema.servicesColumn] = services;
                        else updatePayload[schema.servicesColumn] = services.length ? services.join(', ') : null;
                    }
                }

                const { data, error } = await global.supabaseClient
                    .from('clientes')
                    .update(updatePayload)
                    .eq('id', normalizedId)
                    .select('*')
                    .maybeSingle();

                if (error) {
                    console.error('[ClientRepo] Erro ao atualizar cliente:', error, updatePayload);
                    return { data: null, error };
                }
                return { data: data || null, error: null };
            } catch (error) {
                console.error('[ClientRepo] Erro inesperado ao atualizar cliente:', error);
                return { data: null, error };
            }
        },

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

            const name = String(input?.nome_empresa || input?.nome_fantasia || input?.nome || '').trim();
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
            if (schema?.columns?.nome_empresa) payload.nome_empresa = String(input?.nome_empresa || name).trim();
            if (schema?.columns?.nome_fantasia) {
                const tradeName = String(input?.nome_fantasia || '').trim();
                if (tradeName) payload.nome_fantasia = tradeName;
            }
            if (schema?.columns?.nome) payload.nome = name;
            if (schema?.columns?.empresa) payload.empresa = name;
            if (schema?.columns?.email) payload.email = input?.email ? String(input.email).trim() : null;
            if (schema?.columns?.tipo_documento) payload.tipo_documento = input?.tipo_documento || null;
            if (schema?.docColumn && input?.documento) payload[schema.docColumn] = String(input.documento).trim();
            if (schema?.statusColumn) payload[schema.statusColumn] = input?.status || 'ativo';
            if (schema?.hasAtivo) payload.ativo = true;
            if (schema?.hasTenantId && tenantId) payload.tenant_id = tenantId;
            if (schema?.contactColumn && (input?.responsavel || input?.responsavel_nome)) {
                payload[schema.contactColumn] = String(input?.responsavel || input?.responsavel_nome || '').trim() || null;
            }
            if (schema?.phoneColumn && input?.telefone) {
                payload[schema.phoneColumn] = String(input.telefone).trim() || null;
            }
            if (schema?.whatsappColumn && input?.whatsapp) {
                payload[schema.whatsappColumn] = String(input.whatsapp).trim() || null;
            }
            if (schema?.servicesColumn && Array.isArray(input?.servicos) && input.servicos.length) {
                if (schema.servicesColumn === 'servicos') payload[schema.servicesColumn] = input.servicos;
                else payload[schema.servicesColumn] = input.servicos.join(', ');
            }
            if (schema?.logoColumn && input?.logo_url) {
                payload[schema.logoColumn] = String(input.logo_url).trim() || null;
            }

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
