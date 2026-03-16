// js/v2/modules/clientes/clientes_repo.js
// Repositório de Dados de Clientes V2
// Responsável exclusivamente por buscar dados no Supabase

(function(global) {
    let schemaCache = null;
    let schemaInFlight = null;
    let schemaAssumed = null;
    const isDebug = () => global.__GQV_DEBUG_CLIENTES__ === true;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const parseMissingColumnError = (error) => {
        const msg = String(error?.message || '');
        const match = msg.match(/Could not find the '([^']+)' column of 'clientes' in the schema cache/i);
        return match ? match[1] : null;
    };

    const detectSchema = async function() {
        if (schemaCache) return schemaCache;
        if (schemaInFlight) return await schemaInFlight;
        if (!global.supabaseClient) return null;

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

        schemaInFlight = (async () => {
            const { data, error } = await global.supabaseClient
                .from('clientes')
                .select('*')
                .limit(1);

            if (error) {
                console.error('[ClientRepo] schema detection error:', error);
                return null;
            }

            const row = Array.isArray(data) ? data[0] : null;
            const rawColumns = row && typeof row === 'object' ? Object.keys(row) : [];
            const columnsSet = new Set(rawColumns);
            const columns = {};
            for (const column of candidates) {
                columns[column] = columnsSet.has(column);
            }

            const nameColumn =
                (rawColumns.includes('nome_fantasia') && 'nome_fantasia') ||
                (rawColumns.includes('nome_empresa') && 'nome_empresa') ||
                (rawColumns.includes('nome') && 'nome') ||
                (rawColumns.includes('empresa') && 'empresa') ||
                null;

            const statusColumn =
                (rawColumns.includes('status') && 'status') ||
                (rawColumns.includes('status_cliente') && 'status_cliente') ||
                (rawColumns.includes('situacao') && 'situacao') ||
                null;

            const logoColumn =
                (rawColumns.includes('logo_url') && 'logo_url') ||
                (rawColumns.includes('brand_logo_url') && 'brand_logo_url') ||
                (rawColumns.includes('imagem_logo') && 'imagem_logo') ||
                (rawColumns.includes('logo') && 'logo') ||
                null;

            const contactColumn =
                (rawColumns.includes('responsavel_nome') && 'responsavel_nome') ||
                (rawColumns.includes('responsavel') && 'responsavel') ||
                (rawColumns.includes('contato_nome') && 'contato_nome') ||
                (rawColumns.includes('contato') && 'contato') ||
                null;

            const phoneColumn =
                (rawColumns.includes('telefone') && 'telefone') ||
                (rawColumns.includes('celular') && 'celular') ||
                (rawColumns.includes('telefone_contato') && 'telefone_contato') ||
                (rawColumns.includes('contato_telefone') && 'contato_telefone') ||
                (rawColumns.includes('phone') && 'phone') ||
                null;

            const whatsappColumn =
                (rawColumns.includes('responsavel_whatsapp') && 'responsavel_whatsapp') ||
                (rawColumns.includes('telefone_whatsapp') && 'telefone_whatsapp') ||
                (rawColumns.includes('whatsapp') && 'whatsapp') ||
                (rawColumns.includes('whatsapp_numero') && 'whatsapp_numero') ||
                (rawColumns.includes('whats') && 'whats') ||
                null;

            const servicesColumn =
                (rawColumns.includes('servicos') && 'servicos') ||
                (rawColumns.includes('servicos_contratados') && 'servicos_contratados') ||
                (rawColumns.includes('servicos_ativos') && 'servicos_ativos') ||
                (rawColumns.includes('planos') && 'planos') ||
                (rawColumns.includes('produtos') && 'produtos') ||
                null;

            const docColumn =
                (rawColumns.includes('documento') && 'documento') ||
                (rawColumns.includes('cnpj') && 'cnpj') ||
                (rawColumns.includes('cpf') && 'cpf') ||
                null;

            const tenantSample = row?.tenant_id;
            const tenantIdValueType = (() => {
                if (typeof tenantSample === 'number') return 'number';
                if (typeof tenantSample === 'string' && UUID_RE.test(tenantSample)) return 'uuid';
                if (typeof tenantSample === 'string' && /^-?\d+$/.test(tenantSample)) return 'number_string';
                return tenantSample === null || tenantSample === undefined ? null : typeof tenantSample;
            })();

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
                hasTenantId: rawColumns.includes('tenant_id'),
                hasAtivo: rawColumns.includes('ativo'),
                tenantIdValueType,
                empty: !rawColumns.length,
                assumed: false
            };

            console.log('[ClientRepo] schema detectado:', schemaCache);
            return schemaCache;
        })();

        try {
            return await schemaInFlight;
        } finally {
            schemaInFlight = null;
        }
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

                let attemptPayload = { ...updatePayload };
                let data = null;
                let error = null;
                let guard = 0;
                while (attemptPayload && Object.keys(attemptPayload).length && guard < 10) {
                    guard += 1;
                    const result = await global.supabaseClient
                        .from('clientes')
                        .update(attemptPayload)
                        .eq('id', normalizedId)
                        .select('*')
                        .maybeSingle();
                    data = result.data;
                    error = result.error;
                    if (!error) break;
                    const missing = parseMissingColumnError(error);
                    if (!missing || attemptPayload[missing] === undefined) break;
                    delete attemptPayload[missing];
                }

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
                if (global.TenantContext?.init) {
                    try {
                        await global.TenantContext.init();
                    } catch (err) {
                        console.error('[ClientRepo] Falha ao inicializar TenantContext:', err);
                    }
                }

                const schema = await detectSchema();
                const buildBaseQuery = () => {
                    let query = global.supabaseClient.from('clientes').select('*');
                    if (schema?.nameColumn) {
                        query = query.order(schema.nameColumn, { ascending: true });
                    }
                    return query;
                };

                const tenantCtx = global.TenantContext?.get ? global.TenantContext.get() : null;
                const tenantCandidates = [];
                const hasNumericTenant = Number.isFinite(tenantCtx?.tenantId);
                const hasUuidTenant = !!String(tenantCtx?.tenantUuid || '').trim();
                if (schema?.hasTenantId) {
                    const pref = String(schema?.tenantIdValueType || '').trim();
                    if (pref === 'uuid') {
                        if (hasUuidTenant) tenantCandidates.push(String(tenantCtx.tenantUuid).trim());
                        else if (hasNumericTenant) tenantCandidates.push(String(tenantCtx.tenantId));
                    } else if (pref === 'number' || pref === 'number_string') {
                        if (hasNumericTenant) tenantCandidates.push(tenantCtx.tenantId);
                        if (hasUuidTenant) tenantCandidates.push(String(tenantCtx.tenantUuid).trim());
                    } else {
                        if (hasNumericTenant) tenantCandidates.push(tenantCtx.tenantId);
                        if (hasUuidTenant) tenantCandidates.push(String(tenantCtx.tenantUuid).trim());
                    }
                }

                if (isDebug()) {
                    console.log('[ClientRepo] getClients debug:', {
                        tenantCtx,
                        tenantCandidates,
                        hasTenantId: !!schema?.hasTenantId,
                        schema: schema ? { hasTenantId: !!schema.hasTenantId, nameColumn: schema.nameColumn, empty: !!schema.empty, assumed: !!schema.assumed } : null,
                        activeClientId: global.ClientContext?.getActiveClient ? global.ClientContext.getActiveClient() : null
                    });
                }

                if (schema?.hasTenantId && tenantCandidates.length) {
                    for (const tenantValue of tenantCandidates) {
                        if (isDebug()) {
                            console.log('[ClientRepo] getClients query attempt:', {
                                filter: { tenant_id: tenantValue },
                                type: typeof tenantValue
                            });
                        }
                        const { data, error } = await buildBaseQuery().eq('tenant_id', tenantValue);
                        if (!error) {
                            const rows = Array.isArray(data) ? data : (data ? [data] : []);
                            if (isDebug()) {
                                console.log('[ClientRepo] getClients query result:', {
                                    count: rows.length,
                                    ids: rows.map((r) => r?.id).filter((id) => id !== undefined && id !== null),
                                    tenantIds: rows.map((r) => r?.tenant_id).filter((v) => v !== undefined && v !== null).slice(0, 6)
                                });
                            }
                            if (rows.length) return rows;
                            if (isDebug()) {
                                try {
                                    const preview = await global.supabaseClient
                                        .from('clientes')
                                        .select('id,tenant_id')
                                        .order('id', { ascending: true })
                                        .limit(10);
                                    const pRows = Array.isArray(preview?.data) ? preview.data : (preview?.data ? [preview.data] : []);
                                    console.log('[ClientRepo] getClients fallback preview (no tenant filter):', {
                                        count: pRows.length,
                                        ids: pRows.map((r) => r?.id).filter((id) => id !== undefined && id !== null),
                                        tenantIds: pRows.map((r) => r?.tenant_id).filter((v) => v !== undefined && v !== null)
                                    });
                                } catch (e) {
                                    console.log('[ClientRepo] getClients fallback preview error:', e);
                                }
                            }
                            continue;
                        }

                        console.error('[ClientRepo][STARTUP_TRACE][QUERY_ERROR]', {
                            function: 'getClients',
                            table: 'clientes',
                            select: '*',
                            filter: { tenant_id: tenantValue },
                            orderBy: schema?.nameColumn || null,
                            activeModule: global.WorkspaceState?.getState ? global.WorkspaceState.getState().activeModule : null,
                            errorCode: error?.code || null,
                            errorMessage: error?.message || null
                        });

                        if (isDebug()) {
                            console.log('[ClientRepo] getClients query error:', {
                                filter: { tenant_id: tenantValue },
                                errorCode: error?.code,
                                errorMessage: error?.message,
                                errorDetails: error?.details,
                                errorHint: error?.hint
                            });
                        }

                        const msg = String(error?.message || '');
                        const canFallback =
                            error?.code === '42883' ||
                            error?.code === '42703' ||
                            msg.includes('invalid input syntax') ||
                            msg.includes('bigint = uuid') ||
                            msg.includes('uuid = bigint');
                        if (!canFallback) {
                            console.error('[ClientRepo] Erro ao buscar clientes:', error);
                            return [];
                        }
                    }
                }

                let query = buildBaseQuery();
                let { data, error } = await query;

                if (error) {
                    const missing = parseMissingColumnError(error);
                    if (missing && schema?.nameColumn === missing) {
                        const retry = await global.supabaseClient.from('clientes').select('*');
                        data = retry.data;
                        error = retry.error;
                    }
                }
                if (error) throw error;
                if (isDebug()) {
                    const rows = Array.isArray(data) ? data : (data ? [data] : []);
                    console.log('[ClientRepo] getClients unfiltered result:', {
                        count: rows.length,
                        ids: rows.map((r) => r?.id).filter((id) => id !== undefined && id !== null),
                        tenantIds: rows.map((r) => r?.tenant_id).filter((v) => v !== undefined && v !== null).slice(0, 6)
                    });
                }
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
            const tenantCandidates = [];
            const tenantCtx = global.TenantContext?.get ? global.TenantContext.get() : null;
            if (tenantCtx?.tenantUuid) tenantCandidates.push({ value: tenantCtx.tenantUuid, source: 'tenantContext_uuid' });
            if (Number.isFinite(tenantCtx?.tenantId)) tenantCandidates.push({ value: tenantCtx.tenantId, source: 'tenantContext_legacy' });

            let tenantSource = tenantCandidates[0]?.source || 'none';
            const { data: userData, error: userError } = await global.supabaseClient.auth.getUser();
            if (userError) {
                console.error('[ClientRepo] Erro ao obter usuário autenticado:', userError);
            }
            const user = userData?.user || null;
            if (!tenantCandidates.length && user) {
                const rawTenant = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;
                if (rawTenant) {
                    const raw = String(rawTenant || '').trim();
                    if (/^-?\d+$/.test(raw)) tenantCandidates.push({ value: Number(raw), source: 'auth_metadata_legacy' });
                    else tenantCandidates.push({ value: raw, source: 'auth_metadata_uuid' });
                    tenantSource = tenantCandidates[0]?.source || tenantSource;
                }
            }
            if (!tenantCandidates.length && schema?.hasTenantId) {
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

            const attempts = [];
            if (schema?.hasTenantId && tenantCandidates.length) {
                for (const candidate of tenantCandidates) {
                    attempts.push({ ...payload, tenant_id: candidate.value });
                }
            }
            attempts.push(payload);

            if (!Object.keys(payload).length) {
                return { data: null, error: new Error('Schema de clientes não identificado') };
            }

            if (schema?.hasTenantId) {
                const withoutTenant = { ...payload };
                delete withoutTenant.tenant_id;
                if (Object.keys(withoutTenant).length) attempts.push(withoutTenant);
            }

            console.log('[ClientRepo] createClient payload:', payload);
            console.log('[ClientRepo] createClient tenant source:', tenantSource);

            let lastError = null;
            for (const payload of attempts) {
                let attemptPayload = { ...payload };
                let guard = 0;
                while (attemptPayload && Object.keys(attemptPayload).length && guard < 10) {
                    guard += 1;
                    console.log('[ClientRepo] Tentando insert clientes:', attemptPayload);
                    const { data, error } = await global.supabaseClient
                        .from('clientes')
                        .insert([attemptPayload])
                        .select('*');
                    console.log('[ClientRepo] Resposta insert clientes:', { data, error });
                    if (!error) {
                        const created = Array.isArray(data) ? data[0] : data;
                        return { data: created || null, error: null };
                    }
                    lastError = error;
                    const missing = parseMissingColumnError(error);
                    if (!missing || attemptPayload[missing] === undefined) break;
                    delete attemptPayload[missing];
                }
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
